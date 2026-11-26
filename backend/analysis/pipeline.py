import os
import hashlib
from rapidocr_onnxruntime import RapidOCR
from django.conf import settings
from django.utils import timezone
from .models import Bubble, OCRResult, AudioClip, ProcessingJob

# Khởi tạo RapidOCR (siêu nhẹ, không bị Windows chặn DLL như PyTorch)
ocr_engine = RapidOCR()

def extract_bubbles_from_image(image_path):
    """Hàm dùng chung để quét ảnh và trả về danh sách tọa độ + chữ"""
    result, _ = ocr_engine(image_path)
    extracted = []
    if not result:
        return extracted

    for idx, item in enumerate(result, start=1):
        bbox, text, conf = item
        if not text or not text.strip():
            continue
        xs = [int(p[0]) for p in bbox]
        ys = [int(p[1]) for p in bbox]
        x, y = min(xs), min(ys)
        w, h = max(xs) - x, max(ys) - y
        extracted.append({
            "x": x, "y": y, "w": w, "h": h,
            "reading_order": idx,
            "text": text.strip(),
            "confidence": round(float(conf), 2),
        })
    return extracted


def run_ai_pipeline_for_chapter(chapter):
    chapter.status = 'processing'
    chapter.save(update_fields=['status'])

    job_detect = ProcessingJob.objects.create(chapter=chapter, task='detect', status='running', started_at=timezone.now())
    job_ocr = ProcessingJob.objects.create(chapter=chapter, task='ocr', status='running', started_at=timezone.now())
    job_tts = ProcessingJob.objects.create(chapter=chapter, task='tts', status='pending')

    try:
        pages = chapter.pages.all().order_by('page_no')

        for page in pages:
            abs_image_path = os.path.join(settings.MEDIA_ROOT, page.image_path)
            items = extract_bubbles_from_image(abs_image_path)

            for item in items:
                bubble = Bubble.objects.create(
                    page=page,
                    bubble_type='speech',
                    x=item['x'], y=item['y'], w=item['w'], h=item['h'],
                    confidence=item['confidence'],
                    reading_order=item['reading_order'],
                    is_manual=False
                )

                OCRResult.objects.create(
                    bubble=bubble,
                    text_raw=item['text'],
                    text_tts=item['text'],
                    confidence=item['confidence']
                )

                text_hash = hashlib.sha256(item['text'].encode('utf-8')).hexdigest()
                AudioClip.objects.create(
                    bubble=bubble,
                    voice="vi-VN-NamMinhNeural",
                    text_hash=text_hash,
                    file_path=f"audio/chap_{chapter.id}_bubble_{bubble.id}.mp3",
                    duration_ms=max(1000, len(item['text']) * 80)
                )

        now = timezone.now()
        job_detect.status = 'done'; job_detect.finished_at = now; job_detect.save()
        job_ocr.status = 'done'; job_ocr.finished_at = now; job_ocr.save()
        job_tts.status = 'done'; job_tts.started_at = now; job_tts.finished_at = now; job_tts.save()

        chapter.status = 'done'
        chapter.save(update_fields=['status'])

    except Exception as e:
        chapter.status = 'failed'
        chapter.save(update_fields=['status'])
        job_detect.status = 'failed'
        job_detect.error_message = str(e)
        job_detect.save()
        raise e