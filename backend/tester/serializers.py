from rest_framework import serializers
from .models import ChatbotTechnology, GlobalReport, TestCase, TestFile, Project


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
