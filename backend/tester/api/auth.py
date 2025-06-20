"""Authentication API endpoints for user management."""

from typing import ClassVar

from django.contrib.auth import authenticate
from django.db.models.query import QuerySet
from knox.models import AuthToken
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from tester.api.base import User
from tester.models import UserAPIKey
from tester.serializers import (
    LoginSerializer,
    RegisterSerializer,
    UserAPIKeySerializer,
)


class LoginViewSet(viewsets.ViewSet):
    """Handles user login and token generation."""

    permission_classes: ClassVar = [permissions.AllowAny]
    serializer_class = LoginSerializer

    def create(self, request: Request) -> Response:
        """Login the user."""
        serializer = self.serializer_class(data=request.data)

        if serializer.is_valid():
            email = serializer.validated_data["email"]
            password = serializer.validated_data["password"]
            # Check if the user exists and the password is correct
            user = authenticate(email=email, password=password)

            # If the user exists, create a token
            if user:
                # This creates a token in the database
                _, token = AuthToken.objects.create(user)
                return Response(
                    {
                        "user": self.serializer_class(user).data,
                        "token": token,
                    }
                )
            # If the user does not exist, return an error
            return Response(
                {"error": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UpdateProfileView(APIView):
    """Handles user profile updates."""

    permission_classes: ClassVar = [permissions.IsAuthenticated]

    def patch(self, request: Request) -> Response:
        """Update the authenticated user's profile."""
        serializer = RegisterSerializer(
            request.user, data=request.data, partial=True
        )  # Use RegisterSerializer for updating
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
def validate_token(request: Request) -> Response:
    """Validate if the provided token is valid and not expired."""
    if request.user.is_authenticated:
        return Response({"valid": True}, status=status.HTTP_200_OK)
    return Response({"valid": False}, status=status.HTTP_401_UNAUTHORIZED)


class RegisterViewSet(viewsets.ModelViewSet):
    """Handles user registration."""

    permission_classes: ClassVar = [permissions.AllowAny]
    queryset = User.objects.all()
    serializer_class = RegisterSerializer

    def create(self, request: Request) -> Response:
        """Create a new user and return an auth token."""
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Create user
        user = serializer.save()
        # Create token
        _, token = AuthToken.objects.create(user)

        return Response({"user": serializer.data, "token": token}, status=status.HTTP_201_CREATED)


class UserAPIKeyViewSet(viewsets.ModelViewSet):
    """Manages API keys for the authenticated user."""

    serializer_class = UserAPIKeySerializer
    permission_classes: ClassVar = [permissions.IsAuthenticated]

    def get_queryset(self) -> QuerySet[UserAPIKey]:
        """Return API keys only for the current authenticated user."""
        return UserAPIKey.objects.filter(user=self.request.user)
