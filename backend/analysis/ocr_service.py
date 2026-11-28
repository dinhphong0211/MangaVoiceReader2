import json
import os
import re
import time
import cv2
from django.conf import settings
from django.utils import timezone
from google import genai
from google.genai import types

from analysis.bubble_service import resolve_image_full_path
from analysis.models import AIModel, Bubble, OCRResult, ProcessingJob

# Thứ tự thử: rẻ/nhanh trước, mạnh sau, cuối cùng là model đời cũ làm dự phòng
MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-3.8-flash",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
]
MAX_SIDE = 1000
CHUNK = 12
ROUNDS = 2  # số vòng thử lại toàn bộ danh sách model

PROMPT = """Bạn là công cụ OCR cho truyện tranh tiếng Việt.
Các ảnh trên là những bong bóng thoại, mỗi ảnh có số thứ tự ghi ngay sau nó (đã xếp theo thứ tự đọc).

Hãy chép lại CHÍNH XÁC chữ trong từng ảnh:
- Nhìn kỹ và giữ đúng dấu thanh/dấu mũ tiếng Việt (ví dụ phân biệt ừ/ữ/ứ, ễ/ê, ư/ơ).
- Giữ đúng chữ IN HOA như trong ảnh và giữ dấu câu: , . ! ? … (dấu ba chấm viết là …).
- Bỏ dấu ngoặc kép bao quanh lời thoại nếu có.
- Nối các dòng thành một câu liền mạch; từ bị ngắt dòng bằng dấu gạch nối thì nối liền (ví dụ ĐÔ-RÊ-MON).
- Không dịch, không sửa nội dung, không thêm hay bớt chữ. Bỏ qua mọi thứ không phải thoại (hình vẽ, nét lạ ở rìa ảnh).
- Nếu có chữ nào không chắc chắn, đặt "uncertain": true cho bong bóng đó. Nếu ảnh không có chữ đọc được, để "text": "".

Chỉ trả về MỘT đối tượng JSON, không kèm lời giải thích hay ```:
{"bubbles": [{"order": <số thứ tự>, "text": "<nội dung>", "uncertain": false}]}"""


def get_gemini_client():
    api_key = getattr(settings, "GEMINI_API_KEY", None) or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("Chưa cấu hình GEMINI_API_KEY trong biến môi trường hoặc settings.py.")
    return genai.Client(api_key=api_key)


def crop_to_png(img_bgr, bubble: Bubble, pad: int = 8) -> bytes:
    """Cắt vùng bong bóng thoại từ ảnh gốc và mã hóa sang PNG bytes."""
    H, W = img_bgr.shape[:2]
    x1, y1 = max(0, bubble.x - pad), max(0, bubble.y - pad)
    x2, y2 = min(W, bubble.x + bubble.w + pad), min(H, bubble.y + bubble.h + pad)
    crop = img_bgr[y1:y2, x1:x2]
    if crop.size == 0:
        raise ValueError(f"Vùng cắt rỗng cho Bubble #{bubble.id}")

    h, w = crop.shape[:2]
    scale = min(2.0, MAX_SIDE / max(h, w))
    if abs(scale - 1.0) > 1e-3:
        interp = cv2.INTER_CUBIC if scale > 1 else cv2.INTER_AREA
        crop = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=interp)

    ok, buf = cv2.imencode(".png", crop)
    if not ok:
        raise ValueError("Không mã hóa được ảnh bong bóng sang PNG.")
    return buf.tobytes()


def extract_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    i, j = text.find("{"), text.rfind("}")
    if i < 0 or j < 0:
        raise ValueError("Phản hồi từ Gemini không chứa JSON hợp lệ.")
    return json.loads(text[i:j + 1])


def clean_text(t: str) -> str:
    t = re.sub(r"[“”«»\"]", "", t)
    t = re.sub(r"\.{2,}", "…", t)
    t = re.sub(r"\s+", " ", t).strip()
    t = re.sub(r"\s+([,.!?…])", r"\1", t)
    t = re.sub(r"([…])(?=\S)", r"\1 ", t)
    return t.strip()


def to_tts_text(t: str) -> str:
    """Chuẩn hóa câu thoại sang dạng tự nhiên cho bộ đọc giọng TTS."""
    t = t.replace("…", ", ")
    t = re.sub(r"\s+", " ", t).strip(" ,").lower()
    return t[:1].upper() + t[1:] if t else t


def _ocr_chunk(client, img_bgr, items: list[tuple[int, Bubble]]) -> tuple[dict, str]:
    contents = []
    for order, b in items:
        contents.append(types.Part.from_bytes(data=crop_to_png(img_bgr, b), mime_type="image/png"))
        contents.append(f"Bong bóng số {order}")
    contents.append(PROMPT)

    last_err = None
    for round_no in range(ROUNDS):
        for model in MODELS:
            try:
                resp = client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=types.GenerateContentConfig(response_mime_type="application/json"),
                )
                data = extract_json(resp.text)
                return {int(d["order"]): d for d in data.get("bubbles", [])}, model
            except Exception as e:
                last_err = e
                print(f"[OCR] {model} lỗi: {e}")
                msg = str(e).lower()
                # Key sai thì thử model khác cũng vô ích
                if "api key not valid" in msg or "api_key_invalid" in msg:
                    raise
                # Hết quota / quá tải / model không tồn tại: chuyển ngay sang model kế tiếp
                continue
        # Đã thử hết mọi model mà vẫn lỗi: chờ một lúc rồi thử lại cả danh sách
        if round_no < ROUNDS - 1:
            time.sleep(20 * (round_no + 1))
    raise last_err


def process_chapter_ocr(chapter) -> int:
    """Chạy OCR tiếng Việt cho toàn bộ bong bóng đã detect của Chapter và lưu vào OCRResult."""
    client = get_gemini_client()
    job = ProcessingJob.objects.create(
        chapter=chapter,
        task=AIModel.Task.OCR,
        status=ProcessingJob.JobStatus.RUNNING,
        started_at=timezone.now(),
    )

    try:
        used_model_name = MODELS[0]
        total_ocr = 0

        for page in chapter.pages.all().order_by("page_no"):
            bubbles = list(page.bubbles.all().order_by("reading_order"))
            if not bubbles:
                continue

            full_path = resolve_image_full_path(page.image_path)
            img_bgr = cv2.imread(full_path)
            if img_bgr is None:
                continue

            numbered = [(b.reading_order, b) for b in bubbles]
            found = {}
            for start in range(0, len(numbered), CHUNK):
                part = numbered[start:start + CHUNK]
                chunk_map, active_model = _ocr_chunk(client, img_bgr, part)
                found.update(chunk_map)
                used_model_name = active_model

            ocr_model, _ = AIModel.objects.get_or_create(
                task=AIModel.Task.OCR,
                name=used_model_name,
                version="v1",
                defaults={"is_active": True},
            )

            for order, bubble in numbered:
                item = found.get(order)
                raw_txt = item.get("text", "") if item else ""
                cleaned = clean_text(raw_txt)
                tts_ready = to_tts_text(cleaned)
                needs_review = (item is None) or bool(item.get("uncertain")) or not cleaned

                OCRResult.objects.update_or_create(
                    bubble=bubble,
                    defaults={
                        "ocr_model": ocr_model,
                        "text_raw": raw_txt,
                        "text_corrected": tts_ready,
                        "confidence": 0.5 if needs_review else 0.95,
                    },
                )
                total_ocr += 1

        job.status = ProcessingJob.JobStatus.DONE
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "finished_at"])
        return total_ocr

    except Exception as exc:
        job.status = ProcessingJob.JobStatus.FAILED
        job.error_message = str(exc)
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "error_message", "finished_at"])
        raise