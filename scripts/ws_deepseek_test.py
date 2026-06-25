import asyncio
import json
import websockets

TOKEN_FILE = '/app/ws-test-token.txt'
ROOM = '28'
WS_URL = f"ws://127.0.0.1:8000/ws/chat/{ROOM}/?token="

async def main():
    with open(TOKEN_FILE,'r') as f:
        token = f.read().strip()
    uri = WS_URL + token
    async with websockets.connect(uri) as websocket:
        # receive presence snapshot
        msg = await websocket.recv()
        print('RECV:', msg)
        # send a @mathia message
        body = {
            'command': 'new_message',
            'from': 'alex',
            'chatid': ROOM,
            'message': '@mathia Please confirm DeepSeek is active in-chat.'
        }
        await websocket.send(json.dumps(body))
        # read a few messages
        for i in range(6):
            try:
                m = await asyncio.wait_for(websocket.recv(), timeout=10)
                print('MSG', i, m)
            except asyncio.TimeoutError:
                print('No message received, timing out')
                break

if __name__ == '__main__':
    asyncio.run(main())
