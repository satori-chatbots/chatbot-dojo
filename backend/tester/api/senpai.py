"""Senpai Assistant API endpoints."""

import logging
from typing import ClassVar

from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from tester.senpai import build_assistant_for_conversation, get_or_create_senpai_conversation
from tester.serializers import (
    SenpaiConversationInitializeSerializer,
    SenpaiConversationMessageSerializer,
    SenpaiConversationSerializer,
)

logger = logging.getLogger(__name__)


class SenpaiConversationInitializeView(APIView):
    """Create or return the authenticated user's single Senpai conversation."""

    permission_classes: ClassVar = [permissions.IsAuthenticated]

    def post(self, request: Request) -> Response:
        """Initialize the active Senpai conversation for the authenticated user."""
        serializer = SenpaiConversationInitializeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        force_new = serializer.validated_data["force_new"]
        conversation, created_new_thread = get_or_create_senpai_conversation(
            request.user,
            force_new=force_new,
        )

        response_status = status.HTTP_201_CREATED if created_new_thread else status.HTTP_200_OK
        return Response(
            {
                "conversation": SenpaiConversationSerializer(conversation).data,
                "created_new_thread": created_new_thread,
            },
            status=response_status,
        )


class SenpaiConversationMessageView(APIView):
    """Send a message to the authenticated user's Senpai conversation."""

    permission_classes: ClassVar = [permissions.IsAuthenticated]

    def post(self, request: Request) -> Response:
        """Send a single message to Senpai and return the assistant response."""
        serializer = SenpaiConversationMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        conversation, created_new_thread = get_or_create_senpai_conversation(request.user)
        assistant = None

        try:
            assistant = build_assistant_for_conversation(conversation)
            reply = assistant.send_message(serializer.validated_data["message"])
        except (FileNotFoundError, NotADirectoryError, RuntimeError, ValueError) as exc:
            logger.warning(
                "Senpai Assistant request failed for user_id=%s thread_id=%s: %s",
                request.user.id,
                conversation.thread_id,
                exc,
            )
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            logger.exception(
                "Unexpected Senpai Assistant failure for user_id=%s thread_id=%s",
                request.user.id,
                conversation.thread_id,
            )
            return Response(
                {"error": "Senpai Assistant failed to process the message."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        finally:
            if assistant is not None:
                assistant.close()

        conversation.save(update_fields=["updated_at"])

        return Response(
            {
                "conversation": SenpaiConversationSerializer(conversation).data,
                "created_new_thread": created_new_thread,
                "response": reply,
            },
            status=status.HTTP_200_OK,
        )
