from rest_framework import serializers
from .models import TestCase, TestFile

class TestCaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestCase
        fields = '__all__'

class TestFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestFile
        fields = '__all__'
