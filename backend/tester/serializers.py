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
                "api_key": instance.api_key,
            }
        return super().to_representation(instance)


class RegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "password", "first_name", "last_name", "api_key"]
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

    class Meta:
        model = Project
        fields = "__all__"


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
