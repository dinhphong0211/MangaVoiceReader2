from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static

from library.views import (
    register_account,
    simple_login,
    list_comics,
    upload_comic_chapter,
    quick_read_personal_comic,
    chapter_detail,
    get_reading_history,
    update_comic,
    delete_comic,
    detect_chapter_bubbles_api,
    ocr_chapter_bubbles_api,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/register/', register_account),
    path('api/login/', simple_login),
    path('api/comics/', list_comics),
    path('api/comics/upload/', upload_comic_chapter),
    path('api/comics/quick-read/', quick_read_personal_comic),
    path('api/comics/<int:comic_id>/update/', update_comic),
    path('api/comics/<int:comic_id>/delete/', delete_comic),
    path('api/chapters/<int:chapter_id>/', chapter_detail),
    path('api/chapters/<int:chapter_id>/detect-bubbles/', detect_chapter_bubbles_api),
    path('api/chapters/<int:chapter_id>/ocr-bubbles/', ocr_chapter_bubbles_api),
    path('api/history/', get_reading_history),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)