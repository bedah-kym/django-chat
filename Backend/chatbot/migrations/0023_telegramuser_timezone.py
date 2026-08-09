# Generated for TelegramUser.timezone field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('chatbot', '0022_telegram_memory'),
    ]

    operations = [
        migrations.AddField(
            model_name='telegramuser',
            name='timezone',
            field=models.CharField(blank=True, default='Africa/Nairobi', help_text='IANA timezone e.g. Africa/Nairobi, America/New_York', max_length=64),
        ),
    ]
