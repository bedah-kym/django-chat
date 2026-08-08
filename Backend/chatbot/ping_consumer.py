import json
from channels.generic.websocket import AsyncWebsocketConsumer

class PingConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        print("PING CONSUMER: connect called", flush=True)
        await self.accept()
        await self.send(text_data=json.dumps({"command": "pong"}))

    async def receive(self, text_data=None, bytes_data=None):
        pass

    async def disconnect(self, close_code):
        pass
