from django.contrib import admin
from .models import Comic, Chapter, ReadingHistory

@admin.register(Comic)
class ComicAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'owner', 'reading_direction', 'created_at')

@admin.register(Chapter)
class ChapterAdmin(admin.ModelAdmin):
    list_display = ('id', 'comic', 'chapter_no', 'status')

@admin.register(ReadingHistory)
class ReadingHistoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'comic', 'chapter', 'last_read_at')