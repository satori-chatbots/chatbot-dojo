"""Authentication API endpoints for user management."""

from django.contrib.auth import authenticate
from knox.models import AuthToken
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import UserAPIKey
from ..serializers import LoginSerializer, RegisterSerializer, UserAPIKeySerializer
from .base import User


class LoginViewSet(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]
    serializer_class = LoginSerializer

    def create(self, request):
        """Login the user"""
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
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        serializer = RegisterSerializer(
            request.user, data=request.data, partial=True
        )  # Use RegisterSerializer for updating
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
def validate_token(request):
    """Validate if the provided token is valid and not expired"""
    if request.user.is_authenticated:
        return Response({"valid": True}, status=status.HTTP_200_OK)
    return Response({"valid": False}, status=status.HTTP_401_UNAUTHORIZED)


class RegisterViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.AllowAny]
    queryset = User.objects.all()
    serializer_class = RegisterSerializer

    def create(self, request):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Create user
        user = serializer.save()
        # Create token
        _, token = AuthToken.objects.create(user)

        return Response({"user": serializer.data, "token": token}, status=status.HTTP_201_CREATED)


class UserAPIKeyViewSet(viewsets.ModelViewSet):
    serializer_class = UserAPIKeySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Return API keys only for the current authenticated user.
        return UserAPIKey.objects.filter(user=self.request.user)
