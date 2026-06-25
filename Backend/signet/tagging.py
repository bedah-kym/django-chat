import logging
import difflib

from orchestration.llm_client import LLMClient, extract_json
from .taxonomy import ALLOWED_TAGS, GROUNDING_THRESHOLD

logger = logging.getLogger(__name__)

PROMPT_VERSION = 'post_tagger/2.2'

SYSTEM_PROMPT = """You are a social media intelligence analyst. Your task is to classify posts along THREE passes.

IMPORTANT — TAG WITH PRECISION:
You have been over-tagging posts with generic labels. Avoid applying tags just because a post touches a topic area. Specifically:
- anti_institution: A post being critical of government or institutions is NOT automatically anti_institution. Apply only when the post advocates dismantling institutions or claims systemic illegitimacy with specific evidence.
- appeal_to_victimhood: An emotional or complaining post is NOT automatically appeal_to_victimhood. Apply only when deliberately framing a group as helpless victims to manipulate the audience.
- political_disinfo: A post on a political topic is NOT automatically political_disinfo. Apply only when it contains a specific, identifiable false claim presented as fact.
- firehose_falsehood: Apply only when the post throws out many rapid-fire claims. A single dubious claim is not firehosing.

For EVERY tag you apply, you MUST include a verbatim excerpt from the post that proves the tag. Your confidence should reflect how CERTAIN you are: use 0.80-0.95 when genuinely sure, 0.50-0.70 when plausible but not certain.

When the post genuinely exhibits no manipulation technique, return an empty tags list — that is valuable signal too.

PASS 0 — SAFETY/WELFARE (do this FIRST):
Decide whether this post is an individual sharing personal distress or seeking personal help. Categories: self_harm, medical_emergency, financial_distress, individual_help, harassment_target, none.
If individual-welfare, set safety.is_individual_welfare=true and tags=[].

PASS 1 — FIXED TAXONOMY:
Classify with precision. For each tag: name, confidence (0-1), VERBATIM excerpt as proof.

PASS 2 — EMERGENT:
themes, entities, summary, novelty flag/note.

Self-harm/suicide cries for help are NOT manipulation. Do not tag them as appeal_to_victimhood or political."""


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
{{"safety": {{"is_individual_welfare": false, "category": "none"}}, "tags": [{{"tag": "...", "confidence": 0.0, "excerpt": "..."}}], "themes": ["..."], "entities": ["..."], "summary": "...", "novelty": {{"flag": false, "note": ""}}}}

Allowed taxonomy tags:
{chr(10).join(taxonomy_lines)}

Rules:
0. SAFETY: If individual welfare/help-seeking, safety.is_individual_welfare=true, tags=[]
1. Be precise. A post touching a topic is NOT the same as exhibiting a manipulation technique.
2. anti_institution: only for systemic illegitimacy claims with evidence. appeal_to_victimhood: only for deliberate victim-framing to manipulate. political_disinfo: only for specific identifiable false claims. firehose_falsehood: only for rapid-fire multiple false claims.
3. EVERY tag needs a verbatim excerpt from the post as proof. Confidence 0.80+ when certain, 0.50-0.70 when plausible.
4. Themes/entities lowercase noun phrases, max 6. Summary ≤ 240 chars.
5. novelty.flag=true ONLY for patterns the taxonomy genuinely misses"""


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

        # Require a verbatim excerpt for any substantively confident tag (>= 0.40).
        # (This subsumes the old >= GROUNDING_THRESHOLD/0.70 excerpt requirement.)
        if conf >= 0.40 and not excerpt:
            continue
        if excerpt and excerpt not in content_text:
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


ALLOWED_SAFETY = {'self_harm', 'medical_emergency', 'financial_distress', 'individual_help', 'harassment_target', 'none'}


def _validate_safety(parsed: dict) -> dict:
    safety = parsed.get('safety', {})
    if not isinstance(safety, dict):
        safety = {}
    is_welfare = bool(safety.get('is_individual_welfare', False))
    cat = str(safety.get('category', 'none')).strip().lower()
    if cat not in ALLOWED_SAFETY:
        cat = 'none'
    if not is_welfare and cat != 'none':
        is_welfare = True
    return {'is_individual_welfare': is_welfare, 'category': cat}


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
        'safety_category': 'none',
        'safety_excluded': False,
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
                # Low temp: tagging is classification, not generation. 0.3 made
                # borderline posts flip-flop between verdicts run-to-run (e.g. a
                # hiring post tagged economic_fear one run, clean the next). 0.1
                # is near-deterministic, so tags + the eval are reproducible.
                temperature=0.1,
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
            safety = _validate_safety(parsed)
            raw_tags = parsed.get('tags', []) if isinstance(parsed, dict) else []
            emergent = _validate_emergent(parsed)
        except Exception as e:
            logger.warning(f'tag_post: JSON parse failed on attempt {attempt + 1}: {e}')
            if attempt < 1:
                user_prompt = build_user_prompt(content) + '\n\nCRITICAL: Return ONLY valid JSON. No markdown, no explanation.'
                continue
            raw_tags = []
            emergent = _empty_emergent()
            safety = {'is_individual_welfare': False, 'category': 'none'}

        # Safety guard: if welfare content, clear tags regardless of what model returned
        if safety['is_individual_welfare']:
            raw_tags = []
            tags = []
            review_status = 'pending_review'
            overall_conf = 0.0
            # Skip the grounding retry for welfare posts
            break

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
        'safety_category': safety['category'],
        'safety_excluded': safety['is_individual_welfare'],
        **emergent,
    }
