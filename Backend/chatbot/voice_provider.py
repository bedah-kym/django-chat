import os
import logging

logger = logging.getLogger(__name__)

OPENAI_KEY = os.environ.get('OPENAI_API_KEY', '').strip()
HAS_OPENAI = bool(OPENAI_KEY)

_openai_module = None


def _get_openai():
    global _openai_module
    if _openai_module is not None:
        return _openai_module
    try:
        import openai as mod
        _openai_module = mod
    except ImportError:
        _openai_module = False
    return _openai_module


def transcribe(audio_path: str) -> str:
    if not HAS_OPENAI:
        logger.info("Voice provider: OPENAI_API_KEY not set — returning mock transcription")
        return "[Voice transcription not available — set OPENAI_API_KEY to enable]"

    openai = _get_openai()
    if not openai:
        logger.warning("Voice provider: openai package not installed")
        return "[Voice transcription not available — install openai package]"

    try:
        client = openai.OpenAI(api_key=OPENAI_KEY)
        with open(audio_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
            )
        return transcript.text
    except Exception as e:
        logger.error(f"Voice provider: transcription failed — {e}")
        raise


def generate_speech(text: str, output_path: str) -> None:
    if not HAS_OPENAI:
        logger.info("Voice provider: OPENAI_API_KEY not set — skipping TTS generation")
        return

    openai = _get_openai()
    if not openai:
        logger.warning("Voice provider: openai package not installed")
        return

    try:
        client = openai.OpenAI(api_key=OPENAI_KEY)
        response = client.audio.speech.create(
            model="tts-1",
            voice="alloy",
            input=text,
        )
        response.stream_to_file(output_path)
    except Exception as e:
        logger.error(f"Voice provider: TTS generation failed — {e}")
        raise
