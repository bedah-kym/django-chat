import os
import logging
from django.conf import settings
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import Chatroom, Message, Member
from .tasks import transcribe_voice_note

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_voice_note(request, room_id):
    """
    Endpoint for uploading a recorded voice note.
    Saves the file and triggers transcription.
    """
    try:
        chatroom = get_object_or_404(Chatroom, id=room_id)

        # Security: check if user is in room
        if not Chatroom.objects.filter(id=room_id, participants__User=request.user).exists():
            return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

        if 'audio' not in request.FILES:
            return Response({"error": "No audio file provided"}, status=status.HTTP_400_BAD_REQUEST)

        audio_file = request.FILES['audio']

        # Save via storage so the URL is correctly MEDIA-prefixed (/uploads/...).
        from django.core.files.storage import default_storage
        import uuid as _uuid
        ext = os.path.splitext(audio_file.name)[1] or '.webm'
        stored_path = default_storage.save(f"voice_notes/{room_id}/{_uuid.uuid4().hex}{ext}", audio_file)
        audio_url = default_storage.url(stored_path)

        # Create a pending voice message
        member, _ = Member.objects.get_or_create(User=request.user)
        message = Message.objects.create(
            member=member,
            content="[Voice Message]",
            timestamp=timezone.now(),
            is_voice=True,
            audio_url=audio_url,
            voice_transcript="Transcribing..."
        )
        chatroom.chats.add(message)

        # Trigger transcription task
        transcribe_voice_note.delay(message.id)

        # Broadcast so the note appears live in the room (the REST path isn't a
        # WS consumer, so we push it to the channel group).
        message_json = {
            'id': message.id,
            'member': request.user.username,
            'content': "[Voice Message]",
            'timestamp': str(message.timestamp),
            'parent_id': None,
            'edited_at': None,
            'is_deleted': False,
            'is_voice': True,
            'audio_url': audio_url,
            'voice_transcript': "Transcribing…",
            'attachments': [],
        }
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            async_to_sync(get_channel_layer().group_send)(
                f"chat_{room_id}",
                {'type': 'broadcast_message', 'command': 'new_message', 'message': message_json},
            )
        except Exception as e:
            logger.warning(f"Voice note broadcast skipped: {e}")

        return Response({
            "success": True,
            "message_id": message.id,
            "audio_url": audio_url,
            "status": "Transcribing..."
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        logger.error(f"Error uploading voice note: {e}")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_voice_status(request, message_id):
    """
    Check transcription status of a voice message.
    """
    message = get_object_or_404(Message, id=message_id)
    return Response({
        "message_id": message.id,
        "is_voice": message.is_voice,
        "transcript": message.voice_transcript,
        "audio_url": message.audio_url
    })
