import json
from asgiref.sync import async_to_sync
from django.utils import timezone
from channels.generic.websocket import WebsocketConsumer
from .models import Message
from django.contrib.auth import get_user_model

user=get_user_model()

class ChatConsumer(WebsocketConsumer):

    def fetch_messages(self,data):
        messages = Message.last10messages()
        content = {
            "command":"messages",
            "messages":self.messages_to_json(messages)
        }
        self.send_message(content)

    def messages_to_json(self,messages):
        result =[]
        for message in messages:
            result.append(self.message_to_json(message))
        return result

    def message_to_json(self,message):
        return{
            'author':message.author.username,
            'content':message.content,
            'timestamp':str(message.timestamp)
        }

    
    def new_message(self,data):
        author = data['from']
        author_user=user.objects.filter(username=author)[0]
        message=Message.objects.create(author=author_user,content=data['message'],timestamp=timezone.now())
        content={
            "command":"new_message",
            "message":self.message_to_json(message)
        }
        
        self.send_chat_message(content)

    command = {
        "fetch_messages":fetch_messages,
        "new_message":new_message
    }
    def connect(self):
        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
        self.room_group_name = "chat_%s" % self.room_name

        # Join room group
        async_to_sync(self.channel_layer.group_add)(
            self.room_group_name, self.channel_name
        )

        self.accept()

    def disconnect(self, close_code):
        # Leave room group
        async_to_sync(self.channel_layer.group_discard)(
            self.room_group_name, self.channel_name
        )
                                                 
    def receive(self, text_data):       # Receive message from WebSocket
        data = json.loads(text_data)
        self.command[data["command"]](self,data)

    def send_chat_message(self,message):              # Send message to room group
        async_to_sync(self.channel_layer.group_send)(
            self.room_group_name, {
            "type": "chat_message",
            "message": message
            }
        )
    def send_message(self,message):
        self.send(text_data=json.dumps(message))
    
    def chat_message(self, event):          # Receive message from room group
        message = event["message"]
        # Send message to WebSocket
        self.send(text_data=json.dumps(message))