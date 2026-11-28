import hashlib
from PIL import Image
from django.core.files.storage import default_storage
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status
from analysis.bubble_service import process_chapter_bubbles
from analysis.ocr_service import process_chapter_ocr

from accounts.models import User
from .models import Comic, Chapter, Page, ReadingHistory

# Khởi tạo Lazy-load cho mô hình CLIP của OpenAI để nhận diện danh mục truyện từ ảnh bìa
_clip_model = None
_clip_processor = None

MANGA_GENRES = {
    "Hành động": "anime manga cover with action, fighting, swords, explosions, battle",
    "Phiêu lưu": "adventure manga cover, journey, exploring new worlds",
    "Tình cảm": "romantic shoujo manga cover with love, couple, flowers, soft colors",
    "Kinh dị": "dark horror manga cover with ghosts, monsters, blood, scary atmosphere",
    "Hài hước": "funny comedy slice of life manga cover, school life, happy daily life",
    "Giả tưởng": "fantasy isekai manga cover with magic, dragons, medieval world, RPG",
    "Sci-Fi": "sci-fi mecha manga cover with giant robots, spaceships, futuristic technology",
    "Thể thao": "sports manga cover with basketball, football, volleyball, stadium, athletes",
    "Trinh thám": "mystery detective manga cover with clues, magnifying glass, suspense, crime"
}


def predict_genres_from_cover(pil_image):
    """Dùng mô hình CLIP của OpenAI nhận diện top danh mục truyện bằng tiếng Việt"""
    global _clip_model, _clip_processor
    try:
        import torch
        from transformers import CLIPProcessor, CLIPModel

        device = "cuda" if torch.cuda.is_available() else "cpu"
        if _clip_model is None or _clip_processor is None:
            model_id = "openai/clip-vit-large-patch14"
            _clip_model = CLIPModel.from_pretrained(model_id).to(device)
            _clip_processor = CLIPProcessor.from_pretrained(model_id)

        labels = list(MANGA_GENRES.keys())
        prompts = list(MANGA_GENRES.values())
        rgb_img = pil_image.convert("RGB")

        inputs = _clip_processor(text=prompts, images=rgb_img, return_tensors="pt", padding=True).to(device)
        with torch.no_grad():
            outputs = _clip_model(**inputs)
            probs = outputs.logits_per_image.softmax(dim=1).cpu().numpy()[0]

        results = sorted(zip(labels, probs), key=lambda x: x[1], reverse=True)
        top_genres = [label for label, prob in results[:3] if prob > 0.12]
        return top_genres if top_genres else [results[0][0]]
    except Exception as e:
        print(f"[CLIP Warning] Không thể chạy CLIP tự động ({e}), dùng danh mục mặc định.")
        return ["Hành động", "Phiêu lưu"]


@api_view(['POST'])
def register_account(request):
    """Tạo tài khoản User mới (mặc định role='user', không được đăng truyện lên web)"""
    display_name = request.data.get('display_name', '').strip()
    email = request.data.get('email', '').strip().lower()
    password = request.data.get('password', '').strip()

    if not display_name or not email or not password:
        return Response({"error": "Vui lòng nhập đầy đủ Tên hiển thị, Email và Mật khẩu."}, status=400)

    if User.objects.filter(email=email).exists():
        return Response({"error": "Email này đã được sử dụng. Vui lòng chọn email khác."}, status=400)

    user = User.objects.create(
        email=email,
        password_hash=password,
        display_name=display_name,
        role="user",
    )

    return Response({
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role,
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def simple_login(request):
    """Đăng nhập bằng tài khoản Admin hoặc User trong CSDL"""
    email = request.data.get('email', '').strip().lower()
    password = request.data.get('password', '').strip()

    if not email or not password:
        return Response({"error": "Vui lòng nhập Email và Mật khẩu."}, status=400)

    user = User.objects.filter(email=email).first()
    if not user or user.password_hash != password:
        return Response({"error": "Sai Email hoặc Mật khẩu (nếu chưa có tài khoản hãy bấm Tạo tài khoản)."}, status=401)

    return Response({
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role,
    })


@api_view(['GET'])
def list_comics(request):
    """Trả về toàn bộ truyện Admin đã đăng kèm mô tả, danh mục CLIP và danh sách chương"""
    comics = Comic.objects.all().order_by('-created_at')
    data = []
    for comic in comics:
        chapters_qs = comic.chapters.all().order_by('chapter_no')
        first_chap = chapters_qs.first()
        latest_chap = chapters_qs.last()

        cover_chap = first_chap or latest_chap
        first_page = cover_chap.pages.order_by('page_no').first() if cover_chap else None
        cover_url = f"http://127.0.0.1:8000/media/{first_page.image_path}" if first_page else ""

        chapters_list = []
        total_pages = 0
        for ch in chapters_qs:
            p_count = ch.pages.count()
            total_pages += p_count
            ch_first_page = ch.pages.order_by('page_no').first()
            ch_thumb = f"http://127.0.0.1:8000/media/{ch_first_page.image_path}" if ch_first_page else cover_url
            chapters_list.append({
                "id": ch.id,
                "chapter_no": ch.chapter_no,
                "title": ch.title or f"Chương {ch.chapter_no}",
                "page_count": p_count,
                "thumbnail": ch_thumb,
            })

        data.append({
            "id": comic.id,
            "firstChapterId": first_chap.id if first_chap else None,
            "latestChapterId": latest_chap.id if latest_chap else None,
            "title": comic.title,
            "author": comic.author,
            "description": comic.description,
            "genres": comic.genres if comic.genres else ["Hành động", "Phiêu lưu"],
            "castType": comic.cast_type,
            "isFeatured": comic.is_featured,
            "hasAudioDesc": comic.has_audio_desc,
            "cover": cover_url,
            "totalPages": total_pages,
            "chapters": chapters_list,
            "latestChapter": f"Chap {latest_chap.chapter_no}" if latest_chap else "Chưa có chương",
            "hasVoice": latest_chap.status == 'done' if latest_chap else False,
            "readingDirection": comic.reading_direction,
        })
    return Response(data)


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def upload_comic_chapter(request):
    """CHỈ ADMIN mới được đăng truyện chính thức lên thư viện web + Tự động nhận diện danh mục bằng CLIP"""
    user_role = request.headers.get('X-User-Role', 'user')
    user_email = request.headers.get('X-User-Email', '').strip().lower()

    if user_role != 'admin':
        return Response(
            {"error": "Bạn không có quyền đăng truyện lên thư viện chung. Chỉ Admin mới được phép!"},
            status=status.HTTP_403_FORBIDDEN
        )

    owner = User.objects.filter(email=user_email, role='admin').first()
    if not owner:
        return Response(
            {"error": "Không xác thực được tài khoản Admin đang đăng nhập (vui lòng đăng xuất và đăng nhập lại)."},
            status=status.HTTP_403_FORBIDDEN
        )

    title = request.data.get('title', 'Truyện mới tải lên')
    chapter_no = int(request.data.get('chapter_no', 1))
    reading_direction = request.data.get('reading_direction', 'ltr')
    description = request.data.get('description', '').strip()
    files = sorted(request.FILES.getlist('images'), key=lambda f: f.name)

    if not files:
        return Response({"error": "Vui lòng chọn ít nhất 1 ảnh trang truyện."}, status=400)

    author = request.data.get('author', 'LiveComic Studio • CC-BY').strip() or 'LiveComic Studio • CC-BY'
    cast_type = request.data.get('cast_type', 'full_cast')
    is_featured = request.data.get('is_featured', 'true').lower() == 'true'
    has_audio_desc = request.data.get('has_audio_desc', 'true').lower() == 'true'

    first_img = Image.open(files[0])
    detected_genres = predict_genres_from_cover(first_img)
    files[0].seek(0)

    default_desc = (
        description
        if description
        else f"Bộ truyện {title} thuộc thể loại {', '.join(detected_genres)}. Từng khung tranh được đọc to với giọng nhân vật AI và hiệu ứng âm thanh sống động."
    )

    comic, created = Comic.objects.get_or_create(
        title=title,
        defaults={
            "owner": owner,
            "author": author,
            "description": default_desc,
            "genres": detected_genres,
            "cast_type": cast_type,
            "is_featured": is_featured,
            "has_audio_desc": has_audio_desc,
            "reading_direction": reading_direction,
        }
    )
    if not created:
        comic.owner = owner
        comic.author = author
        if description:
            comic.description = description
        if not comic.genres:
            comic.genres = detected_genres
        comic.cast_type = cast_type
        comic.is_featured = is_featured
        comic.has_audio_desc = has_audio_desc
        comic.save()

    chapter, _ = Chapter.objects.update_or_create(
        comic=comic,
        chapter_no=chapter_no,
        defaults={"title": f"Chương {chapter_no}", "status": "done"}
    )
    chapter.pages.all().delete()

    for idx, f in enumerate(files, start=1):
        raw_bytes = f.read()
        sha256_hash = hashlib.sha256(raw_bytes).hexdigest()
        f.seek(0)
        img = Image.open(f)
        width, height = img.size
        f.seek(0)

        rel_path = f"comics/comic_{comic.id}/chap_{chapter.chapter_no}/page_{idx}_{f.name}"
        saved_path = default_storage.save(rel_path, f)

        Page.objects.create(
            chapter=chapter,
            page_no=idx,
            image_path=saved_path.replace("\\", "/"),
            width=width,
            height=height,
            sha256=sha256_hash
        )

    return Response({
        "message": "Admin đã đăng truyện lên thư viện thành công!",
        "comic_id": comic.id,
        "chapter_id": chapter.id,
        "detected_genres": comic.genres,
    }, status=status.HTTP_201_CREATED)


@api_view(['PUT', 'PATCH'])
def update_comic(request, comic_id):
    """CHỈ ADMIN: Cập nhật tên truyện, tác giả, mô tả, danh mục và trạng thái nổi bật"""
    user_role = request.headers.get('X-User-Role', 'user')
    if user_role != 'admin':
        return Response(
            {"error": "Chỉ Admin mới có quyền chỉnh sửa truyện!"},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        comic = Comic.objects.get(id=comic_id)
    except Comic.DoesNotExist:
        return Response({"error": "Không tìm thấy truyện."}, status=404)

    title = request.data.get('title', '').strip()
    author = request.data.get('author', '').strip()
    description = request.data.get('description', '').strip()
    genres = request.data.get('genres')
    is_featured = request.data.get('is_featured')
    has_audio_desc = request.data.get('has_audio_desc')

    if title:
        comic.title = title
    if author:
        comic.author = author
    if description is not None:
        comic.description = description
    if isinstance(genres, list):
        comic.genres = [g.strip() for g in genres if g.strip()]
    if is_featured is not None:
        comic.is_featured = bool(is_featured)
    if has_audio_desc is not None:
        comic.has_audio_desc = bool(has_audio_desc)

    comic.save()
    return Response({"message": "Cập nhật truyện thành công!"})


@api_view(['DELETE'])
def delete_comic(request, comic_id):
    """CHỈ ADMIN: Xóa toàn bộ truyện, các chương và file ảnh liên quan"""
    user_role = request.headers.get('X-User-Role', 'user')
    if user_role != 'admin':
        return Response(
            {"error": "Chỉ Admin mới có quyền xóa truyện!"},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        comic = Comic.objects.get(id=comic_id)
    except Comic.DoesNotExist:
        return Response({"error": "Không tìm thấy truyện."}, status=404)

    for chapter in comic.chapters.all():
        for page in chapter.pages.all():
            if page.image_path and default_storage.exists(page.image_path):
                default_storage.delete(page.image_path)

    comic.delete()
    return Response({"message": "Đã xóa bộ truyện thành công!"})


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def quick_read_personal_comic(request):
    """Dành cho USER: Mở đọc truyện cá nhân ngay (Chưa chạy AI/TTS, không lưu DB)"""
    title = request.data.get('title', 'Truyện cá nhân của tôi')
    files = sorted(request.FILES.getlist('images'), key=lambda f: f.name)

    if not files:
        return Response({"error": "Vui lòng chọn ảnh trang truyện để đọc."}, status=400)

    pages_data = []
    for idx, f in enumerate(files, start=1):
        img = Image.open(f)
        width, height = img.size
        pages_data.append({
            "id": f"temp-page-{idx}",
            "page_no": idx,
            "width": width,
            "height": height,
            "bubbles": [],
        })

    return Response({
        "is_personal": True,
        "comic_title": title,
        "chapter_no": 1,
        "pages": pages_data,
    })


@api_view(['GET'])
def chapter_detail(request, chapter_id):
    try:
        chapter = Chapter.objects.get(id=chapter_id)
    except Chapter.DoesNotExist:
        return Response({"error": "Không tìm thấy chương"}, status=404)

    user_email = request.headers.get('X-User-Email')
    if user_email:
        user = User.objects.filter(email=user_email).first()
        if user:
            ReadingHistory.objects.update_or_create(
                user=user,
                comic=chapter.comic,
                defaults={"chapter": chapter}
            )

    pages_data = []
    for page in chapter.pages.all().order_by('page_no'):
        bubbles_data = []
        for b in page.bubbles.all().order_by('reading_order'):
            ocr = getattr(b, 'ocr_result', None)
            bubbles_data.append({
                "id": b.id,
                "x": b.x, "y": b.y, "w": b.w, "h": b.h,
                "reading_order": b.reading_order,
                "text": ocr.text_corrected or ocr.text_raw if ocr else "",
            })

        pages_data.append({
            "id": page.id,
            "page_no": page.page_no,
            "image_url": f"http://127.0.0.1:8000/media/{page.image_path}",
            "width": page.width,
            "height": page.height,
            "bubbles": bubbles_data
        })

    return Response({
        "comic_id": chapter.comic.id,
        "comic_title": chapter.comic.title,
        "chapter_no": chapter.chapter_no,
        "pages": pages_data
    })


@api_view(['GET'])
def get_reading_history(request):
    """Lấy danh sách truyện user đã đọc"""
    user_email = request.headers.get('X-User-Email')
    if not user_email:
        return Response([])

    user = User.objects.filter(email=user_email).first()
    if not user:
        return Response([])

    histories = ReadingHistory.objects.filter(user=user).select_related('comic', 'chapter').order_by('-last_read_at')
    data = []
    for h in histories:
        first_page = h.chapter.pages.order_by('page_no').first()
        cover_url = f"http://127.0.0.1:8000/media/{first_page.image_path}" if first_page else ""
        data.append({
            "comic_id": h.comic.id,
            "chapter_id": h.chapter.id,
            "title": h.comic.title,
            "chapter_no": h.chapter.chapter_no,
            "cover": cover_url,
            "last_read_at": h.last_read_at.strftime("%d/%m/%Y %H:%M"),
        })
    return Response(data)


@api_view(['POST'])
def detect_chapter_bubbles_api(request, chapter_id):
    """CHỈ ADMIN: Chạy YOLOv8 + XY-Cut nhận diện bóng thoại cho toàn bộ chương và lưu vào DB"""
    user_role = request.headers.get('X-User-Role', 'user')
    if user_role != 'admin':
        return Response(
            {"error": "Chỉ Admin mới có quyền chạy xử lý nhận diện bóng thoại!"},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        chapter = Chapter.objects.get(id=chapter_id)
    except Chapter.DoesNotExist:
        return Response({"error": "Không tìm thấy chương."}, status=status.HTTP_404_NOT_FOUND)

    total_bubbles = process_chapter_bubbles(chapter)

    preview_pages = []
    for page in chapter.pages.all().order_by('page_no'):
        bubbles = list(
            page.bubbles.all()
            .order_by('reading_order')
            .values('id', 'reading_order', 'x', 'y', 'w', 'h', 'confidence')
        )
        preview_pages.append({
            "id": page.id,
            "page_no": page.page_no,
            "image_url": f"http://127.0.0.1:8000/media/{page.image_path}",
            "width": page.width,
            "height": page.height,
            "bubbles": bubbles,
        })

    return Response({
        "message": "Đã nhận diện và lưu bóng thoại vào cơ sở dữ liệu thành công!",
        "chapter_id": chapter.id,
        "total_bubbles": total_bubbles,
        "pages": preview_pages,
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
def ocr_chapter_bubbles_api(request, chapter_id):
    """CHỈ ADMIN: Chạy Gemini OCR đọc chữ tiếng Việt trong các bóng thoại đã detect và lưu vào DB"""
    if request.headers.get('X-User-Role', 'user') != 'admin':
        return Response({"error": "Chỉ Admin mới có quyền chạy OCR!"}, status=status.HTTP_403_FORBIDDEN)

    try:
        chapter = Chapter.objects.get(id=chapter_id)
    except Chapter.DoesNotExist:
        return Response({"error": "Không tìm thấy chương."}, status=status.HTTP_404_NOT_FOUND)

    try:
        total_ocr = process_chapter_ocr(chapter)
    except Exception as e:
        return Response({"error": f"Lỗi OCR: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    preview_pages = []
    for page in chapter.pages.all().order_by('page_no'):
        bubbles_data = []
        for b in page.bubbles.all().order_by('reading_order'):
            ocr = getattr(b, 'ocr_result', None)
            bubbles_data.append({
                "id": b.id,
                "reading_order": b.reading_order,
                "x": b.x, "y": b.y, "w": b.w, "h": b.h,
                "confidence": b.confidence,
                "text": ocr.text_raw if ocr else "",
                "text_tts": ocr.text_corrected if ocr else "",
                "needs_review": ocr.needs_review if ocr else False,
            })
        preview_pages.append({
            "id": page.id,
            "page_no": page.page_no,
            "image_url": f"http://127.0.0.1:8000/media/{page.image_path}",
            "width": page.width,
            "height": page.height,
            "bubbles": bubbles_data,
        })

    return Response({
        "message": f"Đã nhận diện chữ tiếng Việt cho {total_ocr} bóng thoại!",
        "total_ocr": total_ocr,
        "pages": preview_pages,
    }, status=status.HTTP_200_OK)