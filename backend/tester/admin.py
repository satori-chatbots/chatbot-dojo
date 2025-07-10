"""Admin configurations for the tester app."""

from typing import ClassVar

from django.contrib import admin
from django.db.models import QuerySet
from django.http import HttpRequest

from .models import (
    ChatbotConnector,
    Conversation,
    CustomUser,
    GlobalReport,
    OriginalTracerProfile,
    ProfileExecution,
    ProfileReport,
    Project,
    TestCase,
    TestError,
    TestFile,
    TracerAnalysisResult,
    UserAPIKey,
)


@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    """Admin configuration for CustomUser model."""

    list_display = ("email", "first_name", "last_name", "is_staff")
    search_fields = ("email", "first_name", "last_name")
    list_filter = ("is_staff", "is_active")


class TestFileInline(admin.TabularInline):
    """Inline admin configuration for TestFile model."""

    model = TestFile
    extra = 1


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    """Admin configuration for Project model."""

    list_display = ("name", "created_at", "chatbot_connector")
    search_fields = ("name",)
    inlines: ClassVar[list] = [TestFileInline]


@admin.register(ChatbotConnector)
class ChatbotConnectorAdmin(admin.ModelAdmin):
    """Admin configuration for ChatbotConnector model."""

    list_display = ("name", "technology", "link", "owner")
    search_fields = ("name", "technology", "owner__email")
    list_filter = ("technology", "owner")


class ProfileReportInline(admin.TabularInline):
    """Inline admin configuration for ProfileReport model."""

    model = ProfileReport
    extra = 0


@admin.register(TestCase)
class TestCaseAdmin(admin.ModelAdmin):
    """Admin configuration for TestCase model."""

    list_display = ("name", "executed_at", "status", "execution_time", "project")
    search_fields = ("name",)
    list_filter = ("status", "project")


@admin.register(GlobalReport)
class GlobalReportAdmin(admin.ModelAdmin):
    """Admin configuration for GlobalReport model."""

    list_display = ("name", "avg_execution_time", "total_cost", "test_case")
    search_fields = ("name",)
    inlines: ClassVar[list] = [ProfileReportInline]


class ConversationInline(admin.TabularInline):
    """Inline admin configuration for Conversation model."""

    model = Conversation
    extra = 0


@admin.register(ProfileReport)
class ProfileReportAdmin(admin.ModelAdmin):
    """Admin configuration for ProfileReport model."""

    list_display = ("name", "serial", "language", "personality", "total_cost")
    search_fields = ("name", "serial")
    list_filter = ("language",)
    inlines: ClassVar[list] = [ConversationInline]


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    """Admin configuration for Conversation model."""

    list_display = ("name", "total_cost", "conversation_time", "response_time_avg")
    search_fields = ("name",)


@admin.register(TestError)
class TestErrorAdmin(admin.ModelAdmin):
    """Admin configuration for TestError model."""

    list_display = ("code", "count")
    search_fields = ("code",)


@admin.register(UserAPIKey)
class UserAPIKeyAdmin(admin.ModelAdmin):
    """Admin configuration for UserAPIKey model."""

    list_display = ("user", "api_key_encrypted", "created_at")
    search_fields = ("user", "api_key_encrypted")
    list_filter = ("created_at",)


# Admin configurations for TRACER integration models


class OriginalTracerProfileInline(admin.TabularInline):
    """Inline admin configuration for OriginalTracerProfile model."""

    model = OriginalTracerProfile
    extra = 0
    readonly_fields = ("original_filename", "original_content", "created_at")


@admin.register(ProfileExecution)
class ProfileExecutionAdmin(admin.ModelAdmin):
    """Admin configuration for ProfileExecution model."""

    list_display = ("execution_name", "execution_type", "project", "status", "created_at", "generated_profiles_count")
    search_fields = ("execution_name", "project__name")
    list_filter = ("execution_type", "status", "created_at")
    readonly_fields = ("created_at",)
    inlines: ClassVar[list] = [OriginalTracerProfileInline]

    def get_queryset(self, request: HttpRequest) -> QuerySet["ProfileExecution"]:
        """Override queryset to order by execution_type and creation date."""
        return super().get_queryset(request).order_by("execution_type", "-created_at")


@admin.register(TracerAnalysisResult)
class TracerAnalysisResultAdmin(admin.ModelAdmin):
    """Admin configuration for TracerAnalysisResult model."""

    list_display = ("execution", "total_interactions", "coverage_percentage", "unique_paths_discovered")
    search_fields = ("execution__execution_name", "execution__project__name")
    list_filter = ("execution__project",)


@admin.register(OriginalTracerProfile)
class OriginalTracerProfileAdmin(admin.ModelAdmin):
    """Admin configuration for OriginalTracerProfile model."""

    list_display = ("original_filename", "execution", "created_at")
    search_fields = ("original_filename", "execution__execution_name")
    list_filter = ("execution__execution_type", "created_at")
    readonly_fields = ("original_content", "created_at")
