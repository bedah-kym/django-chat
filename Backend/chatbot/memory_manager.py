"""
Memory Manager — hybrid memory system for Telegram (and eventually web chat).

Implements the DeepSeek-recommended hybrid approach:
  1. Stable system instructions (caller-provided)
  2. Durable facts from DB (persisted across sessions)
  3. Rolling LLM summary (compacted every N turns)
  4. Recent raw turns from Redis (last few exchanges, uncompressed)
  5. Tool-call state (preserved across the session)

Benchmark reference (chat-deep.ai, 2025):
  Full history:  100% retention, 6,837 prompt tokens
  Last 2 pairs:   47% retention, 3,903 prompt tokens
  Hybrid summary: 97% retention, 4,732 prompt tokens  ← OUR APPROACH
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

COMPACTION_INTERVAL = 6   # trigger fact extraction + summary every N turns
MAX_RAW_TURNS = 12        # keep last 12 entries in Redis (6 exchanges)
FACTS_MAX_ITEMS = 8       # max facts / preferences to include in prompt
EPISODES_MAX_ITEMS = 5    # max episodes to include
REDIS_TURN_TTL = 60 * 60 * 24 * 7  # 7 days for raw turns
REDIS_KEY_PREFIX = "tg:mem"


# ---------------------------------------------------------------------------
# Fact-extraction prompt — cheap LLM call (~100 output tokens)
# ---------------------------------------------------------------------------

FACT_EXTRACTION_SYSTEM = (
    "You are a memory extraction agent. Analyze the conversation and extract "
    "durable facts, user preferences, and a rolling summary.\n\n"
    "Return ONLY valid JSON (no markdown, no code fences) with this structure:\n"
    '{\n'
    '  "facts": [\n'
    '    {"key": "short label", "value": "the fact", "confidence": 0.8}\n'
    '  ],\n'
    '  "preferences": [\n'
    '    {"key": "short label", "value": "the preference", "confidence": 0.7}\n'
    '  ],\n'
    '  "episodes": [\n'
    '    {"summary": "what happened in this batch", '
    '"date": "YYYY-MM-DD", "importance": "low|medium|high"}\n'
    '  ],\n'
    '  "rolling_summary": "2-3 sentence updated summary of the entire conversation so far",\n'
    '  "topic": "current conversation topic (1-3 words)"\n'
    '}\n\n'
    "RULES:\n"
    "- Facts: things that remain true (names, locations, numbers, decisions). "
    "Only extract if confidence >= 0.6.\n"
    "- Preferences: user's stated likes/dislikes/constraints. "
    "Include even low-confidence preferences (>= 0.4).\n"
    "- Episodes: summarize what happened. Importance = low|medium|high.\n"
    "- Rolling summary: merge OLD summary (if provided) with NEW turns. "
    "Keep it 2-4 sentences, preserve all important facts.\n"
    "- NEVER hallucinate. If unsure, omit.\n"
    "- Return ONLY the JSON object, nothing else.\n"
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _redis():
    """Lazy Redis connection."""
    from django_redis import get_redis_connection
    return get_redis_connection("default")


def _redis_key(chat_id: str, suffix: str) -> str:
    return f"{REDIS_KEY_PREFIX}:{chat_id}:{suffix}"


def _now_iso() -> str:
    return datetime.now().isoformat()


def _today_str() -> str:
    return datetime.now().strftime("%Y-%m-%d")


async def _sync_get_or_create_memory(chat_id: str):
    """Get or create a TelegramMemory row (sync DB op wrapped for async)."""
    from asgiref.sync import sync_to_async
    from .models import TelegramMemory

    @sync_to_async
    def _get_or_create():
        obj, _created = TelegramMemory.objects.get_or_create(chat_id=int(chat_id))
        return obj

    return await _get_or_create()


async def _sync_save_memory(memory_obj):
    """Save a TelegramMemory instance (sync DB op wrapped for async)."""
    from asgiref.sync import sync_to_async

    @sync_to_async
    def _save():
        memory_obj.save()
        return memory_obj

    return await _save()


async def _sync_get_telegram_user(chat_id: str):
    """Get TelegramUser if exists (sync DB op wrapped for async)."""
    from asgiref.sync import sync_to_async
    from .models import TelegramUser

    @sync_to_async
    def _get():
        return TelegramUser.objects.filter(chat_id=int(chat_id)).first()

    return await _get()


def _sanitize(text: str) -> str:
    """Strip potential injection patterns from fact values."""
    patterns = [
        r"ignore\s+(all\s+)?(previous|system|developer)\s+instructions",
        r"you\s+are\s+now\s+(in|a)\b",
        r"new\s+instructions?:",
        r"<\s*system\s*>",
        r"IMPORTANT:\s*override",
        r"reveal\s+(the|your)\s+(llm|model|system\s*prompt)",
        r"act\s+as\s+(if|though)\s+you\s+are",
        r"disregard\s+(all|any)\s+(previous|prior)",
    ]
    combined = "|".join(patterns)
    if re.search(combined, text, re.IGNORECASE):
        logger.warning("Potential injection in memory value, filtering (starts: %s)", text[:80])
        text = re.sub(combined, "[FILTERED]", text, flags=re.IGNORECASE)
    return text


# ---------------------------------------------------------------------------
# MemoryManager
# ---------------------------------------------------------------------------

class MemoryManager:
    """
    Hybrid memory for Telegram conversations.

    Usage (from telegram_webhook.py)::

        ctx = await MemoryManager.build_context(chat_id, system_prompt)
        # ctx["messages"] is ready to send to LLM

        reply = await llm.generate_text(...)

        await MemoryManager.record_turn(chat_id, user_msg, reply)
    """

    # ------------------------------------------------------------------
    # Context building
    # ------------------------------------------------------------------

    @staticmethod
    async def build_context(
        chat_id: str,
        system_prompt: str = "",
        *,
        include_facts: bool = True,
        include_summary: bool = True,
        include_turns: bool = True,
        max_raw_turns: int = 8,
    ) -> Dict[str, Any]:
        """
        Build structured context for the LLM prompt.

        Returns a dict with:
          - "system": str           — full system prompt (instructions + facts + summary)
          - "messages": list[dict]  — OpenAI-format messages (role, content)
          - "facts_used": int       — how many facts were included
          - "summary_used": bool    — whether a rolling summary was included
          - "turn_count": int       — how many raw turns were included
        """
        system_parts: List[str] = []
        facts_used = 0
        summary_used = False
        turn_count = 0

        # 1. Base system instructions
        if system_prompt:
            system_parts.append(system_prompt)

        # 2. Durable facts from DB
        if include_facts:
            facts_block = await MemoryManager._build_facts_block(chat_id)
            if facts_block:
                system_parts.append(facts_block)
                facts_used = 1  # approximate

        # 3. Rolling summary
        if include_summary:
            summary = await MemoryManager._get_rolling_summary(chat_id)
            if summary:
                system_parts.append(f"CONVERSATION SUMMARY:\n{summary}")
                summary_used = True

        # 4. Build messages array
        messages: List[Dict[str, str]] = []
        system_text = "\n\n".join(system_parts) if system_parts else ""
        if system_text:
            messages.append({"role": "system", "content": system_text})

        # 5. Recent raw turns from Redis
        if include_turns:
            raw_turns = await MemoryManager.get_recent_turns(chat_id, max_items=max_raw_turns)
            for turn in raw_turns:
                messages.append({"role": turn["role"], "content": turn["content"]})
            turn_count = len(raw_turns)

        return {
            "system": system_text,
            "messages": messages,
            "facts_used": facts_used,
            "summary_used": summary_used,
            "turn_count": turn_count,
        }

    # ------------------------------------------------------------------
    # Recording turns
    # ------------------------------------------------------------------

    @staticmethod
    async def record_turn(chat_id: str, user_msg: str, assistant_reply: str):
        """
        Record a conversation turn in Redis and trigger compaction if
        the threshold is reached.
        """
        # 1. Store raw turns in Redis
        await MemoryManager._append_raw_turn(chat_id, "user", user_msg)
        await MemoryManager._append_raw_turn(chat_id, "assistant", assistant_reply)

        # 2. Increment compaction counter
        memory = await _sync_get_or_create_memory(chat_id)
        memory.turn_count_since_compaction += 1
        await _sync_save_memory(memory)

        # 3. Trigger async compaction if threshold reached
        if memory.turn_count_since_compaction >= COMPACTION_INTERVAL:
            logger.info(
                "TG memory compaction triggered for chat=%s (turns=%d)",
                chat_id, memory.turn_count_since_compaction,
            )
            # Fire-and-forget — don't block the webhook response
            import asyncio
            asyncio.ensure_future(MemoryManager.extract_and_persist_facts(chat_id))

    # ------------------------------------------------------------------
    # Fact extraction & compaction
    # ------------------------------------------------------------------

    @staticmethod
    async def extract_and_persist_facts(chat_id: str):
        """
        Extract durable facts from recent conversation and persist to DB.

        Called after COMPACTION_INTERVAL turns.  This is an async
        fire-and-forget operation — the webhook response is not blocked.
        """
        from orchestration.llm_client import get_llm_client, extract_json

        try:
            memory = await _sync_get_or_create_memory(chat_id)

            # Get recent turns
            raw_turns = await MemoryManager.get_recent_turns(chat_id, max_items=COMPACTION_INTERVAL * 2)

            if not raw_turns:
                logger.debug("TG memory: no turns to compact for chat=%s", chat_id)
                return

            # Build the extraction prompt
            transcript_lines: List[str] = []
            for turn in raw_turns:
                prefix = "User" if turn["role"] == "user" else "Assistant"
                transcript_lines.append(f"{prefix}: {turn['content'][:300]}")

            user_prompt = "EXISTING SUMMARY:\n"
            user_prompt += (memory.rolling_summary or "(none)") + "\n\n"
            user_prompt += "NEW CONVERSATION:\n" + "\n".join(transcript_lines)

            # Call LLM for fact extraction (cheap: ~150 tokens output)
            llm = get_llm_client()
            raw_response = await llm.generate_text(
                system_prompt=FACT_EXTRACTION_SYSTEM,
                user_prompt=user_prompt,
                temperature=0.3,       # low temp for factual extraction
                max_tokens=250,
                json_mode=False,
                model_role="executor",
            )

            extracted = extract_json(raw_response)
            if not extracted or not isinstance(extracted, dict):
                logger.warning(
                    "TG memory: failed to parse extraction JSON for chat=%s. Raw: %s",
                    chat_id, raw_response[:200],
                )
                return

            # Merge extracted facts with existing ones
            existing_facts: List[dict] = memory.memory_facts or []
            new_facts: List[dict] = extracted.get("facts") or []
            if new_facts:
                merged = MemoryManager._merge_memory_items(
                    existing_facts, new_facts, key_field="key", max_items=FACTS_MAX_ITEMS * 2,
                )
                memory.memory_facts = merged

            # Merge preferences
            existing_prefs: List[dict] = memory.memory_preferences or []
            new_prefs: List[dict] = extracted.get("preferences") or []
            if new_prefs:
                merged = MemoryManager._merge_memory_items(
                    existing_prefs, new_prefs, key_field="key", max_items=FACTS_MAX_ITEMS * 2,
                )
                memory.memory_preferences = merged

            # Merge episodes
            existing_episodes: List[dict] = memory.memory_episodes or []
            new_episodes: List[dict] = extracted.get("episodes") or []
            if new_episodes:
                existing_episodes.extend(new_episodes)
                # Keep most recent N
                memory.memory_episodes = existing_episodes[-EPISODES_MAX_ITEMS * 2:]

            # Update rolling summary
            new_summary = extracted.get("rolling_summary", "")
            if new_summary:
                memory.rolling_summary = _sanitize(str(new_summary)[:1000])

            # Reset compaction counter
            memory.turn_count_since_compaction = 0
            memory.last_compacted_at = datetime.now()
            await _sync_save_memory(memory)

            logger.info(
                "TG memory compacted for chat=%s: facts=%d, prefs=%d, episodes=%d, summary_len=%d",
                chat_id,
                len(memory.memory_facts),
                len(memory.memory_preferences),
                len(memory.memory_episodes),
                len(memory.rolling_summary),
            )

        except Exception as exc:
            logger.error("TG memory: extraction failed for chat=%s: %s", chat_id, exc, exc_info=True)

    # ------------------------------------------------------------------
    # Redis: raw turn storage
    # ------------------------------------------------------------------

    @staticmethod
    async def _append_raw_turn(chat_id: str, role: str, content: str):
        """Append a single turn to the Redis list."""
        try:
            entry = json.dumps({
                "role": role,
                "content": content[:2000],  # cap individual messages
                "ts": _now_iso(),
            })
            key = _redis_key(chat_id, "turns")
            r = _redis()
            r.rpush(key, entry)
            # Trim to MAX_RAW_TURNS
            r.ltrim(key, -MAX_RAW_TURNS, -1)
            # Refresh TTL
            r.expire(key, REDIS_TURN_TTL)
        except Exception as exc:
            logger.error("TG memory: failed to append turn for chat=%s: %s", chat_id, exc)

    @staticmethod
    async def get_recent_turns(chat_id: str, max_items: int = 8) -> List[Dict[str, str]]:
        """Get recent raw turns from Redis."""
        try:
            key = _redis_key(chat_id, "turns")
            r = _redis()
            raw_entries = r.lrange(key, -max_items, -1)
            turns: List[Dict[str, str]] = []
            for entry in raw_entries:
                try:
                    data = json.loads(entry if isinstance(entry, str) else entry.decode())
                    turns.append({"role": data["role"], "content": data["content"]})
                except (json.JSONDecodeError, KeyError, TypeError):
                    continue
            return turns
        except Exception as exc:
            logger.error("TG memory: failed to read turns for chat=%s: %s", chat_id, exc)
            return []

    # ------------------------------------------------------------------
    # DB: durable fact helpers
    # ------------------------------------------------------------------

    @staticmethod
    async def _build_facts_block(chat_id: str) -> str:
        """Build a text block of durable facts + preferences + episodes for the system prompt."""
        memory = await _sync_get_or_create_memory(chat_id)

        # Filter and format facts
        facts = MemoryManager._filter_memory_entries(
            memory.memory_facts, max_items=FACTS_MAX_ITEMS, max_age_days=90, min_confidence=0.45,
        )
        prefs = MemoryManager._filter_memory_entries(
            memory.memory_preferences, max_items=FACTS_MAX_ITEMS, max_age_days=180, min_confidence=0.35,
        )
        episodes = MemoryManager._filter_memory_entries(
            memory.memory_episodes, max_items=EPISODES_MAX_ITEMS, max_age_days=180, min_confidence=None,
        )

        if not facts and not prefs and not episodes:
            return ""

        lines: List[str] = []

        if facts:
            lines.append("KNOWN FACTS:")
            for item in facts:
                key = _sanitize(str(item.get("key", "")).strip())
                value = _sanitize(str(item.get("value", "")).strip())
                if not key or not value:
                    continue
                conf = item.get("confidence")
                conf_str = f" (confidence {float(conf):.2f})" if conf is not None else ""
                lines.append(f"- {key}: {value}{conf_str}")

        if prefs:
            lines.append("USER PREFERENCES:")
            for item in prefs:
                key = _sanitize(str(item.get("key", "")).strip())
                value = _sanitize(str(item.get("value", "")).strip())
                if not key or not value:
                    continue
                lines.append(f"- {key}: {value}")

        if episodes:
            lines.append("EPISODIC MEMORY:")
            for item in episodes:
                summary = _sanitize(str(item.get("summary", "")).strip())
                if not summary:
                    continue
                date_str = str(item.get("date", "")).strip()
                importance = str(item.get("importance", "")).strip()
                extras = [p for p in [date_str, f"importance {importance}" if importance else ""] if p]
                if extras:
                    lines.append(f"- {summary} ({', '.join(extras)})")
                else:
                    lines.append(f"- {summary}")

        return "\n".join(lines) if lines else ""

    @staticmethod
    async def _get_rolling_summary(chat_id: str) -> str:
        """Get the rolling summary from DB."""
        memory = await _sync_get_or_create_memory(chat_id)
        return memory.rolling_summary or ""

    # ------------------------------------------------------------------
    # Pure helpers (no I/O)
    # ------------------------------------------------------------------

    @staticmethod
    def _merge_memory_items(
        existing: List[dict],
        incoming: List[dict],
        key_field: str = "key",
        max_items: int = 16,
    ) -> List[dict]:
        """Merge incoming items into existing, deduplicating by key_field."""
        merged: Dict[str, dict] = {}
        now = _now_iso()

        # Load existing
        for item in existing or []:
            if not isinstance(item, dict):
                continue
            k = str(item.get(key_field, "")).lower().strip()
            if k:
                merged[k] = dict(item)

        # Upsert with incoming (newer wins, but preserve confidence if incoming is lower)
        for item in incoming or []:
            if not isinstance(item, dict):
                continue
            k = str(item.get(key_field, "")).lower().strip()
            if not k:
                continue
            new_item = dict(item)
            new_item["updated_at"] = now
            if k in merged:
                old_conf = merged[k].get("confidence")
                new_conf = new_item.get("confidence")
                if old_conf is not None and new_conf is not None:
                    try:
                        # Prefer higher confidence, but if incoming is close, accept it
                        if float(new_conf) >= float(old_conf) * 0.7:
                            merged[k] = new_item
                        # else keep the old higher-confidence item
                    except (TypeError, ValueError):
                        merged[k] = new_item
                else:
                    merged[k] = new_item  # incoming wins if no confidence comparison
            else:
                merged[k] = new_item

        # Sort by confidence desc, then recency
        result = sorted(
            merged.values(),
            key=lambda x: (
                float(x.get("confidence", 0) or 0),
                str(x.get("updated_at", "")),
            ),
            reverse=True,
        )
        return result[:max_items]

    @staticmethod
    def _filter_memory_entries(
        entries: List[dict],
        max_items: int = 6,
        max_age_days: int = 365,
        min_confidence: Optional[float] = None,
    ) -> List[dict]:
        """Filter memory entries by age and confidence, return top N."""
        if not entries:
            return []

        from django.utils import timezone

        cutoff = None
        if max_age_days:
            cutoff = timezone.now() - timedelta(days=max_age_days)

        filtered: List[dict] = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue

            # Confidence filter
            if min_confidence is not None:
                conf = entry.get("confidence")
                if conf is not None:
                    try:
                        if float(conf) < float(min_confidence):
                            continue
                    except (TypeError, ValueError):
                        pass

            # Age filter — only drop entries that HAVE a timestamp AND are too old.
            # Entries without updated_at are kept (they were likely just extracted).
            entry_ts = entry.get("updated_at")
            if cutoff and entry_ts:
                try:
                    from django.utils.dateparse import parse_datetime
                    dt = parse_datetime(str(entry_ts))
                    if dt and dt < cutoff:
                        continue
                except Exception:
                    pass

            filtered.append(entry)

        # Sort: confidence desc, then recency desc
        filtered.sort(
            key=lambda x: (
                float(x.get("confidence", 0) or 0),
                str(x.get("updated_at", "")),
            ),
            reverse=True,
        )
        return filtered[:max_items]

    # ------------------------------------------------------------------
    # User identity
    # ------------------------------------------------------------------

    @staticmethod
    async def get_linked_user_id(chat_id: str) -> Optional[int]:
        """Return the Django user ID linked to this TG chat, or None."""
        tg_user = await _sync_get_telegram_user(chat_id)
        if tg_user and tg_user.is_authenticated and tg_user.user_id:
            return tg_user.user_id
        return None

    @staticmethod
    async def get_user_context(chat_id: str) -> Dict[str, Any]:
        """Get combined identity + memory context about a TG user."""
        tg_user = await _sync_get_telegram_user(chat_id)
        result: Dict[str, Any] = {
            "is_authenticated": False,
            "user_id": None,
            "telegram_username": None,
        }
        if tg_user:
            result["is_authenticated"] = tg_user.is_authenticated
            result["user_id"] = tg_user.user_id
            result["telegram_username"] = tg_user.telegram_username
            result["first_name"] = tg_user.first_name
        return result

    # ------------------------------------------------------------------
    # Debug / introspection
    # ------------------------------------------------------------------

    @staticmethod
    async def get_memory_stats(chat_id: str) -> Dict[str, Any]:
        """Return stats about the memory for a chat_id (for debugging)."""
        memory = await _sync_get_or_create_memory(chat_id)
        raw_turns = await MemoryManager.get_recent_turns(chat_id, max_items=100)
        return {
            "chat_id": chat_id,
            "facts_count": len(memory.memory_facts),
            "preferences_count": len(memory.memory_preferences),
            "episodes_count": len(memory.memory_episodes),
            "rolling_summary_len": len(memory.rolling_summary),
            "turn_count_since_compaction": memory.turn_count_since_compaction,
            "last_compacted_at": memory.last_compacted_at.isoformat() if memory.last_compacted_at else None,
            "raw_turns_in_redis": len(raw_turns),
            "created_at": memory.created_at.isoformat(),
            "updated_at": memory.updated_at.isoformat(),
        }

    # ------------------------------------------------------------------
    # Cross-channel memory bridge (TG ↔ Web Chat)
    # ------------------------------------------------------------------

    @staticmethod
    async def sync_to_room_context(chat_id: str, room_context_id: int) -> bool:
        """
        Sync TelegramMemory facts into a RoomContext (one-way: TG → Web).

        Call this from an async context when a TG user links their account
        and also uses web chat.  The RoomContext gets a copy of the TG-learned
        facts so the web chat AI can reference them.

        Returns True if any facts were synced.
        """
        from asgiref.sync import sync_to_async
        from chatbot.models import RoomContext

        @sync_to_async
        def _get_room_ctx():
            return RoomContext.objects.get(id=room_context_id)

        @sync_to_async
        def _save_room_ctx(room_ctx, update_fields):
            room_ctx.save(update_fields=update_fields)

        try:
            tg_mem = await _sync_get_or_create_memory(chat_id)
            room_ctx = await _get_room_ctx()
        except Exception as exc:
            logger.error("Cross-channel sync: lookup failed chat=%s room=%s: %s",
                         chat_id, room_context_id, exc)
            return False

        synced = False
        update_fields = []

        # Sync facts
        if tg_mem.memory_facts:
            existing = room_ctx.memory_facts or []
            merged = MemoryManager._merge_memory_items(
                existing, tg_mem.memory_facts, key_field="key", max_items=16,
            )
            room_ctx.memory_facts = merged
            update_fields.append("memory_facts")
            synced = True

        # Sync preferences
        if tg_mem.memory_preferences:
            existing = room_ctx.memory_preferences or []
            merged = MemoryManager._merge_memory_items(
                existing, tg_mem.memory_preferences, key_field="key", max_items=16,
            )
            room_ctx.memory_preferences = merged
            update_fields.append("memory_preferences")
            synced = True

        if synced:
            from django.utils import timezone
            room_ctx.memory_updated_at = timezone.now()
            update_fields.append("memory_updated_at")
            await _save_room_ctx(room_ctx, update_fields)
            logger.info(
                "Cross-channel sync: TG chat=%s → RoomContext id=%s (facts=%d, prefs=%d)",
                chat_id, room_context_id,
                len(room_ctx.memory_facts), len(room_ctx.memory_preferences),
            )

        return synced
