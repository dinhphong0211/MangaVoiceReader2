from django.contrib import admin
from .models import AIModel, Bubble, OCRResult, AudioClip, ProcessingJob


@admin.register(Bubble)
class BubbleAdmin(admin.ModelAdmin):
    list_display = ("id", "page", "reading_order", "x", "y", "w", "h", "confidence", "bubble_type")
    list_filter = ("bubble_type", "page__chapter__comic")
    ordering = ("page", "reading_order")


@admin.register(AIModel)
class AIModelAdmin(admin.ModelAdmin):
    list_display = ("id", "task", "name", "version", "is_active", "created_at")


@admin.register(ProcessingJob)
class ProcessingJobAdmin(admin.ModelAdmin):
    list_display = ("id", "chapter", "task", "status", "started_at", "finished_at")
    list_filter = ("task", "status")


admin.site.register(OCRResult)
admin.site.register(AudioClip)