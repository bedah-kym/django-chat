import asyncio
import websockets
import json
import sys

async def test():
    token = sys.argv[1] if len(sys.argv) > 1 else ""
    room_id = sys.argv[2] if len(sys.argv) > 2 else "13"
    for path, desc in [
        (f"/ws/chat/{room_id}/?token={token}", "WITH TOKEN"),
        (f"/ws/chat/{room_id}/", "NO TOKEN"),
    ]:
        url = f"ws://localhost:8000{path}"
        try:
            async with websockets.connect(url, close_timeout=2) as ws:
                msg = await asyncio.wait_for(ws.recv(), timeout=8)
                print(f"CONNECTED {desc}: {json.loads(msg).get('command','?')[:50]}")
                return
        except websockets.exceptions.InvalidStatus as e:
            print(f"REJECTED {desc}: {e.response.status_code}")
        except Exception as e:
            print(f"ERROR {desc}: {type(e).__name__}: {str(e)[:80]}")

asyncio.run(test())
