import os
import hashlib
from PIL import Image
from django.core.management.base import BaseCommand
from django.core.files import File
from django.core.files.storage import default_storage
from accounts.models import User
from library.models import Comic, Chapter, Page
from analysis.pipeline import run_ai_pipeline_for_chapter

class Command(BaseCommand):
    help = "Tự động quét thư mục raw_comics và nạp toàn bộ truyện thật vào Database"

    def add_arguments(self, parser):
        parser.add_argument('--folder', type=str, default='raw_comics', help='Đường dẫn thư mục chứa truyện')

    def handle(self, *args, **options):
        base_dir = options['folder']
        if not os.path.exists(base_dir):
            os.makedirs(base_dir)
            self.stdout.write(self.style.WARNING(f"Đã tạo thư mục '{base_dir}'. Hãy bỏ các folder truyện vào đây rồi chạy lại lệnh!"))
            return

        owner, _ = User.objects.get_or_create(
            email="creator@livecomic.ai",
            defaults={"password_hash": "default_hash", "display_name": "Creator", "role": "admin"}
        )

        # Tự động duyệt từng thư mục truyện bên trong
        for comic_name in sorted(os.listdir(base_dir)):
            comic_path = os.path.join(base_dir, comic_name)
            if not os.path.isdir(comic_path):
                continue

            comic, _ = Comic.objects.get_or_create(
                title=comic_name,
                defaults={"owner": owner, "reading_direction": "ltr"}
            )

            # Duyệt từng thư mục chương
            for chap_idx, chap_name in enumerate(sorted(os.listdir(comic_path)), start=1):
                chap_path = os.path.join(comic_path, chap_name)
                if not os.path.isdir(chap_path):
                    continue

                chapter, _ = Chapter.objects.update_or_create(
                    comic=comic,
                    chapter_no=chap_idx,
                    defaults={"title": chap_name, "status": "uploaded"}
                )
                chapter.pages.all().delete()

                valid_exts = ('.jpg', '.jpeg', '.png', '.webp')
                image_files = sorted([f for f in os.listdir(chap_path) if f.lower().endswith(valid_exts)])

                for page_no, img_name in enumerate(image_files, start=1):
                    full_img_path = os.path.join(chap_path, img_name)
                    with open(full_img_path, 'rb') as f:
                        sha256_hash = hashlib.sha256(f.read()).hexdigest()
                        f.seek(0)
                        img = Image.open(f)
                        width, height = img.size
                        f.seek(0)

                        rel_path = f"comics/comic_{comic.id}/chap_{chap_idx}/{img_name}"
                        saved_path = default_storage.save(rel_path, File(f))

                    Page.objects.create(
                        chapter=chapter,
                        page_no=page_no,
                        image_path=saved_path.replace("\\", "/"),
                        width=width,
                        height=height,
                        sha256=sha256_hash
                    )

                run_ai_pipeline_for_chapter(chapter)
                self.stdout.write(self.style.SUCCESS(f"Đã nạp & bóc tách AI: {comic_name} - {chap_name}"))