from django.db import models
from library.models import Chapter, Page

class AIModel(models.Model):
    class Task(models.TextChoices):
        DETECT = 'detect', 'Detect'
        OCR = 'ocr', 'OCR'
        TTS = 'tts', 'TTS'

    id = models.BigAutoField(primary_key=True)
    task = models.CharField(max_length=10, choices=Task.choices)
    name = models.CharField(max_length=100)
    version = models.CharField(max_length=50)
    weights_path = models.CharField(max_length=500, null=True, blank=True)
    is_active = models.BooleanField(default=False)
    metrics_json = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ai_models'
        constraints = [
            models.UniqueConstraint(fields=['task', 'name', 'version'], name='unique_ai_model_version')
        ]

    def __str__(self):
        return f"[{self.task}] {self.name} ({self.version})"


class Bubble(models.Model):
    class BubbleType(models.TextChoices):
        SPEECH = 'speech', 'Speech'
        SHOUT = 'shout', 'Shout'
        TEXT_FREE = 'text_free', 'Text Free'
        SFX = 'sfx', 'SFX'
        OTHER = 'other', 'Other'

    id = models.BigAutoField(primary_key=True)
    page = models.ForeignKey(Page, on_delete=models.CASCADE, related_name='bubbles', db_column='page_id')
    detect_model = models.ForeignKey(
        AIModel, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='detected_bubbles', db_column='detect_model_id'
    )
    bubble_type = models.CharField(max_length=15, choices=BubbleType.choices, default=BubbleType.SPEECH)
    x = models.IntegerField()
    y = models.IntegerField()
    w = models.IntegerField()
    h = models.IntegerField()
    confidence = models.FloatField(null=True, blank=True)
    reading_order = models.IntegerField(null=True, blank=True)
    is_manual = models.BooleanField(default=False)

    class Meta:
        db_table = 'bubbles'
        indexes = [
            models.Index(fields=['page', 'reading_order']),
        ]

    def __str__(self):
        return f"Bubble #{self.id} (Page {self.page_id})"


class OCRResult(models.Model):
    id = models.BigAutoField(primary_key=True)
    bubble = models.OneToOneField(Bubble, on_delete=models.CASCADE, related_name='ocr_result', db_column='bubble_id')
    ocr_model = models.ForeignKey(
        AIModel, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='ocr_results', db_column='ocr_model_id'
    )
    text_raw = models.TextField()
    text_corrected = models.TextField(null=True, blank=True)
    text_tts = models.TextField(null=True, blank=True)
    confidence = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = 'ocr_results'

    def __str__(self):
        return f"OCR for Bubble #{self.bubble_id}"


class AudioClip(models.Model):
    id = models.BigAutoField(primary_key=True)
    bubble = models.ForeignKey(Bubble, on_delete=models.CASCADE, related_name='audio_clips', db_column='bubble_id')
    tts_model = models.ForeignKey(
        AIModel, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='generated_clips', db_column='tts_model_id'
    )
    voice = models.CharField(max_length=50)
    text_hash = models.CharField(max_length=64)
    file_path = models.CharField(max_length=500)
    duration_ms = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audio_clips'
        constraints = [
            models.UniqueConstraint(fields=['bubble', 'voice', 'text_hash'], name='unique_bubble_voice_hash')
        ]
        indexes = [
            models.Index(fields=['text_hash', 'voice']),
        ]

    def __str__(self):
        return f"Audio ({self.voice}) for Bubble #{self.bubble_id}"


class ProcessingJob(models.Model):
    class JobStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        DONE = 'done', 'Done'
        FAILED = 'failed', 'Failed'

    id = models.BigAutoField(primary_key=True)
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE, related_name='jobs', db_column='chapter_id')
    task = models.CharField(max_length=10, choices=AIModel.Task.choices)
    status = models.CharField(max_length=15, choices=JobStatus.choices, default=JobStatus.PENDING)
    error_message = models.TextField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'processing_jobs'
        indexes = [
            models.Index(fields=['chapter', 'task']),
        ]

    def __str__(self):
        return f"Job [{self.task}] - {self.chapter} ({self.status})"