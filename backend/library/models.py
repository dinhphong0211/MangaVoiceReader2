from django.db import models
from accounts.models import User


class Comic(models.Model):
    class ReadingDirection(models.TextChoices):
        LTR = 'ltr', 'Left to Right'
        RTL = 'rtl', 'Right to Left'

    class SourceType(models.TextChoices):
        USER_UPLOAD = 'user_upload', 'User Upload'
        OPEN_LICENSE = 'open_license', 'Open License'
        SYNTHETIC = 'synthetic', 'Synthetic'

    class CastType(models.TextChoices):
        FULL_CAST = 'full_cast', 'Dàn Diễn Viên'
        DUAL_CAST = 'dual_cast', 'Dual Cast'

    id = models.BigAutoField(primary_key=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='comics', db_column='owner_id')
    title = models.CharField(max_length=255)
    author = models.CharField(max_length=255, default="LiveComic Studio • CC-BY")
    cast_type = models.CharField(max_length=20, choices=CastType.choices, default=CastType.FULL_CAST)
    is_featured = models.BooleanField(default=True)
    has_audio_desc = models.BooleanField(default=True)
    reading_direction = models.CharField(max_length=5, choices=ReadingDirection.choices, default=ReadingDirection.LTR)
    source_type = models.CharField(max_length=20, choices=SourceType.choices, default=SourceType.USER_UPLOAD)
    license_note = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'comics'
        indexes = [
            models.Index(fields=['owner']),
        ]

    def __str__(self):
        return self.title


class Chapter(models.Model):
    class Status(models.TextChoices):
        UPLOADED = 'uploaded', 'Uploaded'
        PROCESSING = 'processing', 'Processing'
        DONE = 'done', 'Done'
        FAILED = 'failed', 'Failed'

    id = models.BigAutoField(primary_key=True)
    comic = models.ForeignKey(Comic, on_delete=models.CASCADE, related_name='chapters', db_column='comic_id')
    chapter_no = models.IntegerField()
    title = models.CharField(max_length=255, null=True, blank=True)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.UPLOADED)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'chapters'
        constraints = [
            models.UniqueConstraint(fields=['comic', 'chapter_no'], name='unique_comic_chapter_no')
        ]

    def __str__(self):
        return f"{self.comic.title} - Chap {self.chapter_no}"


class Page(models.Model):
    id = models.BigAutoField(primary_key=True)
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE, related_name='pages', db_column='chapter_id')
    page_no = models.IntegerField()
    page_label = models.CharField(max_length=20, null=True, blank=True)
    image_path = models.CharField(max_length=500)
    width = models.IntegerField()
    height = models.IntegerField()
    sha256 = models.CharField(max_length=64, null=True, blank=True)

    class Meta:
        db_table = 'pages'
        constraints = [
            models.UniqueConstraint(fields=['chapter', 'page_no'], name='unique_chapter_page_no')
        ]

    def __str__(self):
        return f"{self.chapter} - Page {self.page_no}"


class ReadingHistory(models.Model):
    user = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='reading_histories')
    comic = models.ForeignKey(Comic, on_delete=models.CASCADE)
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE)
    last_read_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'reading_histories'
        unique_together = ('user', 'comic')