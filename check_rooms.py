import os, sys
os.environ['DJANGO_SETTINGS_MODULE'] = 'Backend.settings'
sys.path.insert(0, '/app/Backend')
import django; django.setup()
from chatbot.models import Chatroom, Member
from django.contrib.auth import get_user_model
User = get_user_model()
u = User.objects.get(username="alex")
rooms = Chatroom.objects.filter(participants__User=u)
print(f"User alex in {rooms.count()} rooms: {list(rooms.values_list('id', flat=True))}")
room1 = Chatroom.objects.get(id=1)
print(f"Room 1 participants: {list(room1.participants.all().values_list('User__username', flat=True))}")
