import os, sys, re
os.environ['DJANGO_SETTINGS_MODULE'] = 'Backend.settings'
sys.path.insert(0, '/app/Backend')
import django
django.setup()
from chatbot.routing import websocket_urlpatterns
for p in websocket_urlpatterns:
    print(f"Pattern: {p.pattern}")
    path = "ws/chat/1/"
    print(f"  Match {path!r}: {re.match(p.pattern, path)}")
