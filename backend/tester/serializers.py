from rest_framework import serializers
from .models import TestCase, TestFile

class TestFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestFile
        fields = '__all__'

class TestCaseSerializer(serializers.ModelSerializer):
    test_files = serializers.PrimaryKeyRelatedField(queryset=TestFile.objects.all(), many=True)
    #test_files = TestFileSerializer(many=True, read_only=True)

    class Meta:
        model = TestCase
        fields = '__all__'
