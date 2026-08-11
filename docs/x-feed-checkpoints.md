# X Feed Collector — Deployment Checkpoints

## Checkpoint 01 — 2026-08-11
- Fixed: twikit 2.3.3 `httpx.Cookies` dict-unpacking bug
- Fixed: list-of-dicts cookie format from browser export
- Fixed: `asyncio.run()` for async twikit methods
- Fixed: `noUncheckedIndexedAccess` TypeScript error in SignetTopBar
- Added: error tracking in collection status UI
- Added: x-diag diagnostic endpoint
- State: cookies load, auth works, collector calls `await`

**If you see this commit on Railway Celery worker, all fixes are deployed.**
