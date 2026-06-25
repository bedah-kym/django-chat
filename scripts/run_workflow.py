import os
import sys
from asgiref.sync import async_to_sync

sys.path.insert(0, '/app/Backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Backend.settings')
import django
django.setup()

from django.contrib.auth import get_user_model
from workflows.models import UserWorkflow, WorkflowExecution
from workflows.temporal_integration import start_workflow_execution

User = get_user_model()
user = User.objects.filter(username='alex').first()
if not user:
    print('User alex not found')
    raise SystemExit(1)

wf = UserWorkflow.objects.filter(user=user, status='active').first() or UserWorkflow.objects.filter(user=user).first()
if not wf:
    print('No workflow for alex')
    raise SystemExit(1)

print('Running workflow', wf.id, wf.name)
try:
    exec_obj = async_to_sync(start_workflow_execution)(wf, trigger_data={}, trigger_type='manual')
    print('Started execution id', exec_obj.id, 'status', exec_obj.status)
except Exception as e:
    print('Failed to start workflow:', e)
    raise
