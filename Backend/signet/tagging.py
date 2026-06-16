import logging
import difflib

from orchestration.llm_client import LLMClient, extract_json
from .taxonomy import ALLOWED_TAGS, GROUNDING_THRESHOLD

logger = logging.getLogger(__name__)

PROMPT_VERSION = 'post_tagger/2.0'

SYSTEM_PROMPT = """You are a social media intelligence analyst. Your task is to classify posts along TWO layers:

LAYER 1 — FIXED TAXONOMY (manipulation detection):
Classify into these fixed categories. For each relevant tag, provide:
- tag: one of the allowed tags
- confidence: float 0-1
- excerpt: VERBATIM quote from the post (required for confidence >= 0.70)

LAYER 2 — EMERGENT (what the post is substantively about):
- themes: 1-4 short noun phrases describing the core subject matter (e.g. "predatory lending", "gen z unemployment")
- entities: named people, orgs, places, or movements mentioned
- summary: one neutral sentence summarizing the post
- novelty: {"flag": true/false, "note": ""}. Set flag=true ONLY if the post exhibits a persuasion or manipulation pattern NOT captured by any tag in the fixed taxonomy. In that case, note what the pattern is.

IMPORTANT: Every fixed-tag excerpt MUST be word-for-word from the post. Do not paraphrase."""


def build_user_prompt(post_text: str) -> str:
    taxonomy_lines = [
        'Manipulation Technique: red_pill_pipeline, firehose_falsehood, appeal_to_victimhood, false_equivalence, astroturfing, coordinated_inauthentic',
        'Content Domain: political_disinfo, health_misinfo, economic_fear, identity_wedge, election_integrity, anti_institution',
        'Spread Pattern: organic_viral, coordinated_amplified, celebrity_laundered, media_crossover',
        'Audience Response: polarised, unified_amplification, counter_narrative_forming, ignored, mockery',
    ]

    return f"""Classify this post:

\"""
{post_text}
\"""

Return a JSON object:
{{"tags": [{{"tag": "...", "confidence": 0.0, "excerpt": "..."}}], "themes": ["..."], "entities": ["..."], "summary": "...", "novelty": {{"flag": false, "note": ""}}}}

Allowed taxonomy tags:
{chr(10).join(taxonomy_lines)}

Rules:
1. Only include taxonomy tags that genuinely apply
2. For any tag with confidence >= 0.70, the excerpt MUST be a verbatim quote from the post
3. Themes/entities are lowercase noun phrases, max 6 each
4. Summary is one neutral sentence, max 240 chars
5. novelty.flag=true ONLY for patterns the fixed taxonomy misses"""


def _ground_tags(tags: list[dict], content_text: str) -> list[dict]:
    validated = []
    for t in tags:
        tag = t.get('tag', '')
        conf = float(t.get('confidence', 0))
        excerpt = (t.get('excerpt') or '').strip()

        if tag not in ALLOWED_TAGS:
            continue
        if conf < 0 or conf > 1:
            continue

        needs_grounding = conf >= GROUNDING_THRESHOLD
        if needs_grounding:
            if not excerpt:
                continue
            if excerpt not in content_text:
                match_ratio = difflib.SequenceMatcher(None, excerpt, content_text).ratio()
                if match_ratio < 0.90:
                    continue

        validated.append({'tag': tag, 'confidence': conf, 'excerpt': excerpt})
    return validated


def _validate_emergent(parsed: dict) -> dict:
    themes = parsed.get('themes', [])
    if not isinstance(themes, list):
        themes = []
    themes = [str(t).strip().lower() for t in themes if t and len(str(t).strip()) <= 40]
    themes = list(dict.fromkeys(themes))[:6]

    entities = parsed.get('entities', [])
    if not isinstance(entities, list):
        entities = []
    entities = [str(e).strip().lower() for e in entities if e and len(str(e).strip()) <= 40]
    entities = list(dict.fromkeys(entities))[:6]

    summary = parsed.get('summary', '')
    if not isinstance(summary, str):
        summary = ''
    summary = summary.strip()[:240]

    novelty = parsed.get('novelty', {})
    if not isinstance(novelty, dict):
        novelty = {}
    flag = bool(novelty.get('flag', False))
    note = str(novelty.get('note', '')).strip()[:240]

    return {
        'themes': themes,
        'entities': entities,
        'summary': summary,
        'novelty_flag': flag,
        'novelty_note': note,
    }


def _empty_emergent():
    return {'themes': [], 'entities': [], 'summary': '', 'novelty_flag': False, 'novelty_note': ''}


def _empty_result(model_version: str):
    return {
        'tags': [],
        'overall_confidence': 0.0,
        'confidence_tier': 'low',
        'prompt_version': PROMPT_VERSION,
        'model_version': model_version,
        'llm_call_id': '',
        'raw_llm_response': {},
        'review_status': 'pending_review',
        **_empty_emergent(),
    }


async def tag_post(post, user_id: int) -> dict:
    from django.utils import timezone
    from django.conf import settings

    model_version = getattr(settings, 'DEEPSEEK_MODEL', '') or 'deepseek-chat'

    content = post.content_text or ''
    if not content.strip():
        return _empty_result(model_version)

    client = LLMClient()
    user_prompt = build_user_prompt(content)

    llm_call_id = ''
    raw_response = {}
    tags = []
    review_status = 'pending_review'
    overall_conf = 0.0
    emergent = _empty_emergent()

    for attempt in range(2):
        try:
            raw_text = await client.generate_text(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                json_mode=True,
                user_id=user_id,
                temperature=0.3,
                max_tokens=600,
            )
        except Exception as e:
            logger.error(f'tag_post: LLM call failed on attempt {attempt + 1}: {e}')
            if attempt == 0:
                continue
            return {**_empty_result(model_version), 'review_status': 'failed'}

        raw_response = {'raw_text': raw_text}
        llm_call_id = str(timezone.now().timestamp())

        try:
            parsed = extract_json(raw_text)
            raw_tags = parsed.get('tags', []) if isinstance(parsed, dict) else []
            emergent = _validate_emergent(parsed)
        except Exception as e:
            logger.warning(f'tag_post: JSON parse failed on attempt {attempt + 1}: {e}')
            if attempt < 1:
                user_prompt = build_user_prompt(content) + '\n\nCRITICAL: Return ONLY valid JSON. No markdown, no explanation.'
                continue
            raw_tags = []
            emergent = _empty_emergent()

        validated = _ground_tags(raw_tags, content)

        if attempt == 0:
            needs_retry = any(
                float(t.get('confidence', 0)) >= GROUNDING_THRESHOLD and not any(
                    v['tag'] == t.get('tag') for v in validated
                )
                for t in raw_tags
            )
            if needs_retry:
                user_prompt = build_user_prompt(content) + (
                    '\n\nYour last response had ungrounded tags. '
                    'For EVERY tag with confidence >= 0.70, you MUST include an excerpt '
                    'that is a VERBATIM copy from the post. Do not paraphrase.'
                )
                continue

        tags = validated
        review_status = 'auto_eligible'
        break

    if tags:
        confs = [t['confidence'] for t in tags]
        overall_conf = sum(confs) / len(confs)

    if overall_conf >= 0.80:
        tier = 'high'
    elif overall_conf >= 0.50:
        tier = 'medium'
    else:
        tier = 'low'

    if tier != 'high':
        review_status = 'pending_review'

    return {
        'tags': tags,
        'overall_confidence': round(overall_conf, 4),
        'confidence_tier': tier,
        'prompt_version': PROMPT_VERSION,
        'model_version': model_version,
        'llm_call_id': llm_call_id,
        'raw_llm_response': raw_response,
        'review_status': review_status,
        **emergent,
    }
