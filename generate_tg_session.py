"""One-time Pyrogram USER session-string generator for SIGNET Telegram collection.

Run this in YOUR OWN terminal (it asks for your phone number + the login code
Telegram sends you). It reads API_ID / API_HASH from .env (or env vars) and
prints a TELEGRAM_SESSION_STRING you can hand back.

    pip install pyrogram        # tgcrypto is optional (faster, but not required)
    python generate_tg_session.py

Nothing is written to disk (in_memory=True); no .session file is created.
Delete this file when you're done.
"""
import os


def load_env(path=".env"):
    env = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def pick(env, *names):
    for n in names:
        val = os.environ.get(n) or env.get(n)
        if val:
            return val
    return None


def main():
    env = load_env()
    api_id = pick(env, "TELEGRAM_API_ID", "API_ID")
    api_hash = pick(env, "TELEGRAM_API_HASH", "API_HASH")
    if not api_id or not api_hash:
        raise SystemExit("Missing API_ID / API_HASH in .env or environment.")

    # Pyrogram 2.0.x calls asyncio.get_event_loop() at import time, which raises
    # on Python 3.12+ when no current loop exists. Pre-create one so the import
    # (and Pyrogram's sync wrappers) work on Python 3.14.
    import asyncio
    try:
        asyncio.get_event_loop()
    except RuntimeError:
        asyncio.set_event_loop(asyncio.new_event_loop())

    try:
        from pyrogram import Client
    except ImportError:
        raise SystemExit("Pyrogram not installed. Run:  pip install pyrogram")

    print("Logging in as a USER account (not the bot).")
    print("You'll be asked for your phone number, then the code Telegram texts you")
    print("(and your 2FA password, if you have one set).\n")

    with Client("gen_session", api_id=int(api_id), api_hash=api_hash, in_memory=True) as app:
        me = app.get_me()
        session_string = app.export_session_string()
        print("\nLogged in as: %s (id=%s)\n" % (me.first_name, me.id))
        print("==== TELEGRAM_SESSION_STRING (copy the whole line below) ====\n")
        print(session_string)
        print("\n=============================================================\n")
        print("Paste that back, or set it yourself on Railway as TELEGRAM_SESSION_STRING.")


if __name__ == "__main__":
    main()
