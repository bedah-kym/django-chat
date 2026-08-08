import os, sys
os.environ['DJANGO_SETTINGS_MODULE'] = 'Backend.settings'
sys.path.insert(0, '/app/Backend')
import django; django.setup()
from django.contrib.auth import get_user_model
from chatbot.models import Chatroom, Member, Message
from datetime import datetime

User = get_user_model()
user = User.objects.get(username='alex')

# Create a room for testing
room = Chatroom.objects.create()
member, _ = Member.objects.get_or_create(User=user)
room.participants.add(member)

# Create mathia member
mathia_user = User.objects.filter(username='mathia').first()
if not mathia_user:
    mathia_user = User.objects.create_user(username='mathia', email='mathia@local', password='x'*20)
mathia_member, _ = Member.objects.get_or_create(User=mathia_user)
room.participants.add(mathia_member)

# Add fake messages
messages = [
    ('alex', 'Hello Mathia!', '2026-06-10 07:00:00'),
    ('mathia', 'Hello! How can I help you today?', '2026-06-10 07:00:05'),
    ('alex', 'Can you show me my tasks?', '2026-06-10 07:01:00'),
    ('mathia', "I found 3 pending tasks:\n\n1. Review Q2 budget\n2. Update security policy\n3. Schedule team sync\n\nWould you like me to take action on any of these?", '2026-06-10 07:01:10'),
    ('alex', 'Yes, please schedule the team sync for Friday 3pm', '2026-06-10 07:02:00'),
    ('mathia', "Done! I've scheduled 'Team Sync' for Friday at 3:00 PM EAT. I'll send reminders to everyone 30 minutes before.", '2026-06-10 07:02:15'),
]

for username, content, ts in messages:
    msg_user = User.objects.get(username=username)
    msg_member = Member.objects.get(User=msg_user)
    msg = Message.objects.create(
        member=msg_member,
        content=content,
        timestamp=datetime.strptime(ts, '%Y-%m-%d %H:%M:%S'),
    )
    room.chats.add(msg)

print(f"Seeded room {room.id} with {len(messages)} messages")
print(f"Room participants: {[m.User.username for m in room.participants.all()]}")
print(f"Visit: http://localhost:8000/app/ops/chat/{room.id}/")
