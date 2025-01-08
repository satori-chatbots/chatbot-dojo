from rest_framework import serializers
from .models import TestCase, TestFile

class TestFileSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = TestFile
        #fields = ['id', 'file', 'file_url', 'uploaded_at']
        fields = '__all__'

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and hasattr(obj.file, 'url'):
            return request.build_absolute_uri(obj.file.url)
        return None

class TestCaseSerializer(serializers.ModelSerializer):
    test_files = serializers.PrimaryKeyRelatedField(queryset=TestFile.objects.all(), many=True)
    #test_files = TestFileSerializer(many=True, read_only=True)

    class Meta:
        model = TestCase
        fields = '__all__'
