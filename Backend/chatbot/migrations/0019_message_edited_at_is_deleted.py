# Generated migration for Message edit/delete fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('chatbot', '0018_chatroom_domain_chatroom_name'),
    ]

    operations = [
        migrations.AddField(
            model_name='message',
            name='edited_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='message',
            name='is_deleted',
            field=models.BooleanField(default=False),
        ),
    ]
