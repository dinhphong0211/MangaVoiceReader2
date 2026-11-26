import hashlib
from PIL import Image
from django.core.files.storage import default_storage
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status

from accounts.models import User
from .models import Comic, Chapter, Page, ReadingHistory


@api_view(['POST'])
def register_account(request):
    """Tạo tài khoản User mới (mặc định role='user', không được đăng truyện lên web)"""
    display_name = request.data.get('display_name', '').strip()
    email = request.data.get('email', '').strip().lower()
    password = request.data.get('password', '').strip()

    if not display_name or not email or not password:
        return Response({"error": "Vui lòng nhập đầy đủ Tên hiển thị, Email và Mật khẩu."}, status=400)

    if email == "admin@livecomic.ai" or User.objects.filter(email=email).exists():
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
    """Đăng nhập bằng tài khoản Admin hoặc User đã đăng ký"""
    email = request.data.get('email', '').strip().lower()
    password = request.data.get('password', '').strip()

    if not email or not password:
        return Response({"error": "Vui lòng nhập Email và Mật khẩu."}, status=400)

    if email == "admin@livecomic.ai" and password == "admin123":
        admin_user, _ = User.objects.get_or_create(
            email="admin@livecomic.ai",
            defaults={"password_hash": "admin123", "display_name": "Quản trị viên", "role": "admin"}
        )
        return Response({
            "id": admin_user.id,
            "email": admin_user.email,
            "display_name": admin_user.display_name,
            "role": admin_user.role,
        })

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
    """Trả về toàn bộ truyện Admin đã đăng để mọi User vào trang chủ đều thấy"""
    comics = Comic.objects.all().order_by('-created_at')
    data = []
    for comic in comics:
        latest_chap = comic.chapters.order_by('-chapter_no').first()
        first_page = latest_chap.pages.order_by('page_no').first() if latest_chap else None
        cover_url = f"http://127.0.0.1:8000/media/{first_page.image_path}" if first_page else ""

        data.append({
            "id": comic.id,
            "latestChapterId": latest_chap.id if latest_chap else None,
            "title": comic.title,
            "author": comic.author,
            "castType": comic.cast_type,
            "isFeatured": comic.is_featured,
            "hasAudioDesc": comic.has_audio_desc,
            "cover": cover_url,
            "latestChapter": f"Chap {latest_chap.chapter_no}" if latest_chap else "Chưa có chương",
            "hasVoice": latest_chap.status == 'done' if latest_chap else False,
            "readingDirection": comic.reading_direction,
        })
    return Response(data)


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def upload_comic_chapter(request):
    """CHỈ ADMIN mới được đăng truyện chính thức lên thư viện web (Chưa chạy AI/TTS)"""
    user_role = request.headers.get('X-User-Role', 'user')
    if user_role != 'admin':
        return Response(
            {"error": "Bạn không có quyền đăng truyện lên thư viện chung. Chỉ Admin mới được phép!"},
            status=status.HTTP_403_FORBIDDEN
        )

    title = request.data.get('title', 'Truyện mới tải lên')
    chapter_no = int(request.data.get('chapter_no', 1))
    reading_direction = request.data.get('reading_direction', 'ltr')
    files = sorted(request.FILES.getlist('images'), key=lambda f: f.name)

    if not files:
        return Response({"error": "Vui lòng chọn ít nhất 1 ảnh trang truyện."}, status=400)

    owner, _ = User.objects.get_or_create(
        email="admin@livecomic.ai",
        defaults={"password_hash": "admin123", "display_name": "Quản trị viên", "role": "admin"}
    )

    author = request.data.get('author', 'LiveComic Studio • CC-BY').strip() or 'LiveComic Studio • CC-BY'
    cast_type = request.data.get('cast_type', 'full_cast')
    is_featured = request.data.get('is_featured', 'true').lower() == 'true'
    has_audio_desc = request.data.get('has_audio_desc', 'true').lower() == 'true'

    comic, created = Comic.objects.get_or_create(
        title=title,
        defaults={
            "owner": owner,
            "author": author,
            "cast_type": cast_type,
            "is_featured": is_featured,
            "has_audio_desc": has_audio_desc,
            "reading_direction": reading_direction,
        }
    )
    if not created:
        comic.author = author
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
    }, status=status.HTTP_201_CREATED)


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