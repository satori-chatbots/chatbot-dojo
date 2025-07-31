"""Serializers for the tester app."""

from typing import Any, ClassVar

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import (
    ChatbotConnector,
    Conversation,
    GlobalReport,
    PersonalityFile,
    ProfileReport,
    Project,
    ProjectConfig,
    RuleFile,
    TestCase,
    TestError,
    TestFile,
    TypeFile,
    UserAPIKey,
)

# Get the latest version of the user model
User = get_user_model()


class FileURLMixin:
    """Mixin to provide file URL generation functionality for serializers."""

    context: dict  # Add type annotation for context attribute

    def get_file_url(
        self,
        obj: TestFile | PersonalityFile | RuleFile | TypeFile,
    ) -> str | None:
        """Get the absolute URL of the file."""
        request = self.context.get("request")
        if obj.file and hasattr(obj.file, "url"):
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class LoginSerializer(serializers.Serializer):
    """Serializer for user login."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def to_representation(self, instance: object) -> dict[str, object]:
        """Convert the instance to a representation."""
        if isinstance(instance, get_user_model()):
            return {
                "id": instance.id,
                "email": instance.email,
                "first_name": instance.first_name,
                "last_name": instance.last_name,
            }
        return super().to_representation(instance)


class RegisterSerializer(serializers.ModelSerializer):
    """Serializer for user registration."""

    class Meta:
        """Meta class for RegisterSerializer."""

        model = User
        fields: ClassVar[list[str]] = ["id", "email", "password", "first_name", "last_name"]
        extra_kwargs: ClassVar[dict[str, Any]] = {"password": {"write_only": True}}

    def create(self, validated_data: dict[str, object]) -> object:
        """Create a new user."""
        password = validated_data.pop("password")
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        return user


class ConversationSerializer(serializers.ModelSerializer):
    """Serializer for the Conversation model."""

    class Meta:
        """Meta class for ConversationSerializer."""

        model = Conversation
        fields = "__all__"


class ProfileReportSerializer(serializers.ModelSerializer):
    """Serializer for the ProfileReport model."""

    class Meta:
        """Meta class for ProfileReportSerializer."""

        model = ProfileReport
        fields = "__all__"


class TestFileSerializer(FileURLMixin, serializers.ModelSerializer):
    """Serializer for the TestFile model."""

    file_url = serializers.SerializerMethodField()

    class Meta:
        """Meta class for TestFileSerializer."""

        model = TestFile
        fields = "__all__"
        read_only_fields: ClassVar[list[str]] = ["project"]


class ChatbotConnectorSerializer(serializers.ModelSerializer):
    """Serializer for the ChatbotConnector model."""

    class Meta:
        """Meta class for ChatbotConnectorSerializer."""

        model = ChatbotConnector
        fields = [
            "id",
            "name",
            "technology",
            "parameters",
            "link",
        ]  # Include both parameters and link for backward compatibility
        read_only_fields: ClassVar[list[str]] = ["owner"]

    def validate_parameters(self, value):
        """Validate that parameters is a valid JSON object."""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Parameters must be a valid JSON object")
        return value


class ProjectSerializer(serializers.ModelSerializer):
    """Serializer for the Project model."""

    test_cases = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    chatbot_connector = serializers.PrimaryKeyRelatedField(queryset=ChatbotConnector.objects.none())
    is_owner = serializers.SerializerMethodField()
    llm_provider = serializers.ReadOnlyField()  # Derived from API key
    # Add the API key field to the serializer
    api_key = serializers.PrimaryKeyRelatedField(queryset=UserAPIKey.objects.all(), required=False, allow_null=True)

    class Meta:
        """Meta class for ProjectSerializer."""

        model = Project
        fields = "__all__"
        read_only_fields: ClassVar[list[str]] = ["owner"]

    def __init__(self, *args: object, **kwargs: object) -> None:
        """Initialize the serializer and filter querysets based on the user."""
        super().__init__(*args, **kwargs)
        if (
            self.context.get("request")
            and hasattr(self.context["request"], "user")
            and self.context["request"].user.is_authenticated
        ):
            user = self.context["request"].user
            # Filter chatbot connectors to only show those owned by the user
            self.fields["chatbot_connector"].queryset = ChatbotConnector.objects.filter(owner=user)
            # Filter API keys to only show those owned by the user
            self.fields["api_key"].queryset = UserAPIKey.objects.filter(user=user)

    def get_is_owner(self, obj: Project) -> bool:
        """Check if the request user is the owner of the project."""
        request = self.context.get("request")
        if request and hasattr(request, "user"):
            return request.user == obj.owner
        return False


class TestCaseSerializer(serializers.ModelSerializer):
    """Serializer for the TestCase model."""

    copied_files = serializers.JSONField()
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all())

    class Meta:
        """Meta class for TestCaseSerializer."""

        model = TestCase
        fields = "__all__"


class GlobalReportSerializer(serializers.ModelSerializer):
    """Serializer for the GlobalReport model."""

    class Meta:
        """Meta class for GlobalReportSerializer."""

        model = GlobalReport
        fields = "__all__"


class TestErrorSerializer(serializers.ModelSerializer):
    """Serializer for the TestError model."""

    class Meta:
        """Meta class for TestErrorSerializer."""

        model = TestError
        fields = "__all__"


class UserAPIKeySerializer(serializers.ModelSerializer):
    """Serializer for the UserAPIKey model."""

    api_key = serializers.CharField(write_only=True, required=False)
    decrypted_api_key = serializers.SerializerMethodField()

    class Meta:
        """Meta class for UserAPIKeySerializer."""

        model = UserAPIKey
        fields: ClassVar[list[str]] = ["id", "name", "provider", "api_key", "created_at", "decrypted_api_key"]
        read_only_fields: ClassVar[list[str]] = ["id", "created_at", "decrypted_api_key"]

    def create(self, validated_data: dict[str, Any]) -> UserAPIKey:
        """Create a new UserAPIKey."""
        # Get the plain text API key
        api_key_plain = validated_data.pop("api_key")
        # Create the UserAPIKey instance
        user_api_key = UserAPIKey(**validated_data)
        user_api_key.user = self.context["request"].user
        user_api_key.set_api_key(api_key_plain)
        return user_api_key

    def update(self, instance: UserAPIKey, validated_data: dict[str, Any]) -> UserAPIKey:
        """Update an existing UserAPIKey."""
        # Get the plain text API key
        api_key_plain = validated_data.pop("api_key", None)
        # Update the API key if it is provided
        if api_key_plain is not None:
            instance.set_api_key(api_key_plain)
        # Update the name and provider
        instance.name = validated_data.get("name", instance.name)
        instance.provider = validated_data.get("provider", instance.provider)
        instance.save()
        return instance

    def get_decrypted_api_key(self, obj: UserAPIKey) -> str:
        """Get the decrypted API key."""
        return obj.get_api_key()


class PersonalityFileSerializer(FileURLMixin, serializers.ModelSerializer):
    """Serializer for the PersonalityFile model."""

    file_url = serializers.SerializerMethodField()

    class Meta:
        """Meta class for PersonalityFileSerializer."""

        model = PersonalityFile
        fields = "__all__"
        read_only_fields: ClassVar[list[str]] = ["name"]


class RuleFileSerializer(FileURLMixin, serializers.ModelSerializer):
    """Serializer for the RuleFile model."""

    file_url = serializers.SerializerMethodField()

    class Meta:
        """Meta class for RuleFileSerializer."""

        model = RuleFile
        fields = "__all__"
        read_only_fields: ClassVar[list[str]] = ["name"]


class TypeFileSerializer(FileURLMixin, serializers.ModelSerializer):
    """Serializer for the TypeFile model."""

    file_url = serializers.SerializerMethodField()

    class Meta:
        """Meta class for TypeFileSerializer."""

        model = TypeFile
        fields = "__all__"
        read_only_fields: ClassVar[list[str]] = ["name"]


class ProjectConfigSerializer(serializers.ModelSerializer):
    """Serializer for the ProjectConfig model."""

    class Meta:
        """Meta class for ProjectConfigSerializer."""

        model = ProjectConfig
        fields = "__all__"
