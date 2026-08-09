# Generated manually for TelegramUser and TelegramMemory models

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('chatbot', '0021_messageattachment_ai_document_id'),
    ]

    operations = [
        migrations.CreateModel(
            name='TelegramUser',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('telegram_id', models.BigIntegerField(db_index=True, unique=True)),
                ('telegram_username', models.CharField(blank=True, default='', max_length=64)),
                ('chat_id', models.BigIntegerField(db_index=True, help_text='Chat ID (may differ from telegram_id in groups)')),
                ('first_name', models.CharField(blank=True, default='', max_length=128)),
                ('last_name', models.CharField(blank=True, default='', max_length=128)),
                ('linked_at', models.DateTimeField(auto_now_add=True)),
                ('is_authenticated', models.BooleanField(default=False, help_text='True if user completed the /link flow')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='telegram_accounts', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Telegram User',
                'verbose_name_plural': 'Telegram Users',
                'ordering': ['-linked_at'],
            },
        ),
        migrations.CreateModel(
            name='TelegramMemory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('chat_id', models.BigIntegerField(db_index=True, unique=True)),
                ('memory_facts', models.JSONField(default=list)),
                ('memory_preferences', models.JSONField(default=list)),
                ('memory_episodes', models.JSONField(default=list)),
                ('rolling_summary', models.TextField(blank=True, default='')),
                ('turn_count_since_compaction', models.IntegerField(default=0)),
                ('last_compacted_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Telegram Memory',
                'verbose_name_plural': 'Telegram Memories',
                'ordering': ['-updated_at'],
            },
        ),
    ]
