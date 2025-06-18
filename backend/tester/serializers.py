from rest_framework import serializers
from .models import (
    ChatbotTechnology,
    GlobalReport,
    TestCase,
    TestError,
    TestFile,
    Project,
    ProfileReport,
    Conversation,
    UserAPIKey,
    PersonalityFile,
    RuleFile,
    TypeFile,
    ProjectConfig,
)
from django.contrib.auth import get_user_model

# Get the latest version of the user model
User = get_user_model()


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def to_representation(self, instance):
        if isinstance(instance, get_user_model()):
            return {
                "id": instance.id,
                "email": instance.email,
                "first_name": instance.first_name,
                "last_name": instance.last_name,
            }
        return super().to_representation(instance)


class RegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "password", "first_name", "last_name"]
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        return user


class ConversationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Conversation
        fields = "__all__"


class ProfileReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProfileReport
        fields = "__all__"


class TestFileSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = TestFile
        fields = "__all__"
        read_only_fields = ["name"]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and hasattr(obj.file, "url"):
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url  # Fallback to relative URL if request is not available
        return None


class ChatbotTechnologySerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatbotTechnology
        fields = "__all__"


class ProjectSerializer(serializers.ModelSerializer):
    test_cases = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    chatbot_technology = serializers.PrimaryKeyRelatedField(
        queryset=ChatbotTechnology.objects.all()
    )
    is_owner = serializers.SerializerMethodField()
    # Add the API key field to the serializer
    api_key = serializers.PrimaryKeyRelatedField(
        queryset=UserAPIKey.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Project
        fields = "__all__"
        read_only_fields = ["owner"]

    def get_is_owner(self, obj):
        request = self.context.get("request")
        if request and hasattr(request, "user"):
            return request.user == obj.owner
        return False


class TestCaseSerializer(serializers.ModelSerializer):
    # test_files = serializers.PrimaryKeyRelatedField(queryset=TestFile.objects.all(), many=True)
    # test_files = TestFileSerializer(many=True, read_only=True)
    copied_files = serializers.JSONField()
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all())

    class Meta:
        model = TestCase
        fields = "__all__"


class GlobalReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = GlobalReport
        fields = "__all__"


class TestErrorSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestError
        fields = "__all__"


class UserAPIKeySerializer(serializers.ModelSerializer):
    api_key = serializers.CharField(write_only=True, required=False)
    decrypted_api_key = serializers.SerializerMethodField()

    class Meta:
        model = UserAPIKey
        fields = ["id", "name", "api_key", "created_at", "decrypted_api_key"]
        read_only_fields = ["id", "created_at", "decrypted_api_key"]

    def create(self, validated_data):
        # Get the plain text API key
        api_key_plain = validated_data.pop("api_key")
        # Create the UserAPIKey instance
        user_api_key = UserAPIKey(**validated_data)
        user_api_key.user = self.context["request"].user
        user_api_key.set_api_key(api_key_plain)
        return user_api_key

    def update(self, instance, validated_data):
        # Get the plain text API key
        api_key_plain = validated_data.pop("api_key", None)
        # Update the API key if it is provided
        if api_key_plain is not None:
            instance.set_api_key(api_key_plain)
        # Update the name
        instance.name = validated_data.get("name", instance.name)
        instance.save()
        return instance

    def get_decrypted_api_key(self, obj):
        return obj.get_api_key()


class PersonalityFileSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = PersonalityFile
        fields = "__all__"
        read_only_fields = ["name"]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and hasattr(obj.file, "url"):
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class RuleFileSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = RuleFile
        fields = "__all__"
        read_only_fields = ["name"]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and hasattr(obj.file, "url"):
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class TypeFileSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = TypeFile
        fields = "__all__"
        read_only_fields = ["name"]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and hasattr(obj.file, "url"):
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class ProjectConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectConfig
        fields = "__all__"
