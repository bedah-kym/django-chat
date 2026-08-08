import urllib.request, json, os, sys
os.environ['DJANGO_SETTINGS_MODULE'] = 'Backend.settings'
sys.path.insert(0, '/app/Backend')
import django; django.setup()

# Test 1: Direct HTTP
req = urllib.request.Request('http://127.0.0.1:8000/auth/', 
    data=json.dumps({'username':'alex','password':'mathia123'}).encode(),
    headers={'Content-Type':'application/json'}, method='POST')
try:
    r = urllib.request.urlopen(req, timeout=10)
    token = json.loads(r.read()).get('token','')
    print(f"HTTP auth: OK, token={token[:15]}...")
except Exception as e:
    print(f"HTTP auth FAILED: {e}")

# Test 2: Rooms via direct Django
from django.contrib.auth import get_user_model
from chatbot.models import Chatroom
User = get_user_model()
user = User.objects.get(username='alex')
rooms = Chatroom.objects.filter(participants__User=user)
print(f"Direct DB: user alex is in {rooms.count()} rooms")
r28 = Chatroom.objects.filter(id=28, participants__User=user).first()
if r28:
    print(f"Room 28: {r28.chats.count()} messages")
