import os, sys
os.environ['DJANGO_SETTINGS_MODULE'] = 'Backend.settings'
sys.path.insert(0, '/app/Backend')

import django
django.setup()

from chatbot.consumers import ChatConsumer
import inspect
src = inspect.getsource(ChatConsumer.connect)
print('YES' if 'WS CONNECT' in src else 'STALE')
print('Lines:', len(src.split('\n')))
