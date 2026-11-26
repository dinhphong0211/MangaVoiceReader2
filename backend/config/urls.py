from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from library import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/login/', views.simple_login, name='simple_login'),
    path('api/comics/', views.list_comics, name='list_comics'),
    path('api/comics/upload/', views.upload_comic_chapter, name='upload_comic'),
    path('api/comics/quick-read/', views.quick_read_personal_comic, name='quick_read'),
    path('api/chapters/<int:chapter_id>/', views.chapter_detail, name='chapter_detail'),
    path('api/history/', views.get_reading_history, name='reading_history'),
    path('api/register/', views.register_account, name='register_account'),
    path('api/login/', views.simple_login, name='simple_login'),  
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)