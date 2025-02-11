from django.contrib import admin
from .models import (
    CustomUser,
    TestFile,
    Project,
    ChatbotTechnology,
    TestCase,
    GlobalReport,
    ProfileReport,
    Conversation,
    TestError,
)


@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ("email", "first_name", "last_name", "is_staff")
    search_fields = ("email", "first_name", "last_name")
    list_filter = ("is_staff", "is_active")


class TestFileInline(admin.TabularInline):
    model = TestFile
    extra = 1


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "created_at", "chatbot_technology")
    search_fields = ("name",)
    inlines = [TestFileInline]


@admin.register(ChatbotTechnology)
class ChatbotTechnologyAdmin(admin.ModelAdmin):
    list_display = ("name", "technology", "link")
    search_fields = ("name", "technology")
    list_filter = ("technology",)


class ProfileReportInline(admin.TabularInline):
    model = ProfileReport
    extra = 0


@admin.register(TestCase)
class TestCaseAdmin(admin.ModelAdmin):
    list_display = ("name", "executed_at", "status", "execution_time", "project")
    search_fields = ("name",)
    list_filter = ("status", "project")


@admin.register(GlobalReport)
class GlobalReportAdmin(admin.ModelAdmin):
    list_display = ("name", "avg_execution_time", "total_cost", "test_case")
    search_fields = ("name",)
    inlines = [ProfileReportInline]


class ConversationInline(admin.TabularInline):
    model = Conversation
    extra = 0


@admin.register(ProfileReport)
class ProfileReportAdmin(admin.ModelAdmin):
    list_display = ("name", "serial", "language", "personality", "total_cost")
    search_fields = ("name", "serial")
    list_filter = ("language",)
    inlines = [ConversationInline]


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("name", "total_cost", "conversation_time", "response_time_avg")
    search_fields = ("name",)


@admin.register(TestError)
class TestErrorAdmin(admin.ModelAdmin):
    list_display = ("code", "count")
    search_fields = ("code",)
