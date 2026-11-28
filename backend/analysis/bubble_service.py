import os
import cv2
import numpy as np
from django.conf import settings
from huggingface_hub import hf_hub_download
from analysis.models import AIModel, Bubble

CONF_THRES = 0.65
IOU_THRES = 0.45
MIN_WHITE_RATIO = 0.35
SHRINK = 0.6

_bubble_detector = None


def get_detector():
    global _bubble_detector
    if _bubble_detector is None:
        from ultralytics import YOLO  # Chỉ import khi Admin thực sự bấm nút xử lý
        model_path = hf_hub_download(
            repo_id="ogkalu/comic-speech-bubble-detector-yolov8m",
            filename="comic-speech-bubble-detector.pt",
        )
        _bubble_detector = YOLO(model_path)
    return _bubble_detector


def is_valid_speech_bubble(img_bgr, x1, y1, x2, y2, min_white_ratio=MIN_WHITE_RATIO):
    crop = img_bgr[y1:y2, x1:x2]
    if crop.size == 0:
        return False
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    white_mask = (hsv[:, :, 1] < 60) & (hsv[:, :, 2] > 180)
    return np.mean(white_mask) >= min_white_ratio


def core_box(b, shrink):
    cx, cy = b["x"] + b["w"] / 2, b["y"] + b["h"] / 2
    hw, hh = b["w"] * shrink / 2, b["h"] * shrink / 2
    return cx - hw, cy - hh, cx + hw, cy + hh


def sort_bubbles_xy_cut(bubbles, direction="ltr", shrink=SHRINK):
    if len(bubbles) <= 1:
        return bubbles

    for axis in (1, 0):
        items = sorted(bubbles, key=lambda b: core_box(b, shrink)[axis])
        end = core_box(items[0], shrink)[axis + 2]
        for i in range(1, len(items)):
            c = core_box(items[i], shrink)
            if c[axis] > end:
                first = sort_bubbles_xy_cut(items[:i], direction, shrink)
                second = sort_bubbles_xy_cut(items[i:], direction, shrink)
                if axis == 0 and direction == "rtl":
                    first, second = second, first
                return first + second
            end = max(end, c[axis + 2])

    sign = -1 if direction == "rtl" else 1
    return sorted(
        bubbles,
        key=lambda b: (b["y"] + b["h"] / 2, sign * (b["x"] + b["w"] / 2)),
    )


def resolve_image_full_path(image_path: str) -> str:
    if os.path.isabs(image_path) and os.path.exists(image_path):
        return image_path
    clean_rel = image_path.lstrip("/")
    if clean_rel.startswith("media/"):
        clean_rel = clean_rel[len("media/"):]
    return os.path.join(settings.MEDIA_ROOT, clean_rel)
def merge_split_vertical_bubbles(bubbles: list[dict]) -> list[dict]:
    """
    Tự động gộp 2 khung bị YOLO tách đôi từ 1 bóng thoại thắt eo (hình số 8):
    Điều kiện: 2 khung thẳng cột theo trục X và giao nhau theo trục Y.
    """
    if len(bubbles) < 2:
        return bubbles

    merged = [dict(b) for b in bubbles]
    changed = True

    while changed:
        changed = False
        n = len(merged)
        for i in range(n):
            for j in range(i + 1, n):
                a, b = merged[i], merged[j]
                ax1, ay1, ax2, ay2 = a["x"], a["y"], a["x"] + a["w"], a["y"] + a["h"]
                bx1, by1, bx2, by2 = b["x"], b["y"], b["x"] + b["w"], b["y"] + b["h"]

                # Kiểm tra độ thẳng hàng theo chiều ngang (X)
                x_overlap = max(0, min(ax2, bx2) - max(ax1, bx1))
                min_w = max(1, min(a["w"], b["w"]))
                x_align_ratio = x_overlap / min_w
                left_diff = abs(ax1 - bx1)

                # Kiểm tra có chạm hoặc đè lên nhau theo chiều dọc (Y) không
                y_overlap = min(ay2, by2) - max(ay1, by1)

                # Nếu thẳng cột (trùng > 70% bề ngang & mép trái lệch < 25px) và đè lên nhau theo chiều dọc
                if x_align_ratio >= 0.70 and left_diff <= 25 and y_overlap >= -5:
                    nx1 = min(ax1, bx1)
                    ny1 = min(ay1, by1)
                    nx2 = max(ax2, bx2)
                    ny2 = max(ay2, by2)

                    new_box = {
                        "x": nx1,
                        "y": ny1,
                        "w": nx2 - nx1,
                        "h": ny2 - ny1,
                        "confidence": max(a["confidence"], b["confidence"]),
                        "bubble_type": a.get("bubble_type", "speech"),
                    }
                    # Xóa 2 khung cũ và thay bằng 1 khung đã gộp
                    merged = [merged[k] for k in range(n) if k != i and k != j]
                    merged.append(new_box)
                    changed = True
                    break
            if changed:
                break

    return merged

def process_chapter_bubbles(chapter):
    detector = get_detector()
    ai_model, _ = AIModel.objects.get_or_create(
        task=AIModel.Task.DETECT,
        name="ogkalu/comic-speech-bubble-detector-yolov8m",
        version="v1",
        defaults={"is_active": True},
    )

    read_direction = chapter.comic.reading_direction or "ltr"
    total_saved = 0

    for page in chapter.pages.all().order_by("page_no"):
        full_path = resolve_image_full_path(page.image_path)
        img_cv = cv2.imread(full_path)
        if img_cv is None:
            continue

        img_h, img_w = img_cv.shape[:2]
        results = detector.predict(
            source=full_path, conf=CONF_THRES, iou=IOU_THRES, verbose=False
        )[0]

        raw_boxes = []
        for box in results.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(img_w, x2), min(img_h, y2)
            conf = float(box.conf[0])
            if is_valid_speech_bubble(img_cv, x1, y1, x2, y2):
                raw_boxes.append([x1, y1, x2, y2, conf])

        filtered_boxes = []
        for i, (x1, y1, x2, y2, conf) in enumerate(raw_boxes):
            area_i = (x2 - x1) * (y2 - y1)
            is_nested = False
            for j, (ox1, oy1, ox2, oy2, _) in enumerate(raw_boxes):
                if i == j:
                    continue
                inter_x1, inter_y1 = max(x1, ox1), max(y1, oy1)
                inter_x2, inter_y2 = min(x2, ox2), min(y2, oy2)
                if inter_x2 > inter_x1 and inter_y2 > inter_y1:
                    inter_area = (inter_x2 - inter_x1) * (inter_y2 - inter_y1)
                    if (inter_area / area_i) > 0.7 and area_i < ((ox2 - ox1) * (oy2 - oy1)):
                        is_nested = True
                        break
            if not is_nested:
                filtered_boxes.append({
                    "x": x1, "y": y1, "w": x2 - x1, "h": y2 - y1,
                    "confidence": round(conf, 4),
                })
        filtered_boxes = merge_split_vertical_bubbles(filtered_boxes) 
        ordered = sort_bubbles_xy_cut(filtered_boxes, read_direction, SHRINK)

        Bubble.objects.filter(page=page).delete()
        Bubble.objects.bulk_create([
            Bubble(
                page=page,
                detect_model=ai_model,
                bubble_type=Bubble.BubbleType.SPEECH,
                x=item["x"],
                y=item["y"],
                w=item["w"],
                h=item["h"],
                confidence=item["confidence"],
                reading_order=idx,
            )
            for idx, item in enumerate(ordered, 1)
        ])
        total_saved += len(ordered)

    chapter.status = chapter.Status.DONE
    chapter.save(update_fields=["status"])
    return total_saved