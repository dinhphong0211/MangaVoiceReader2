# Truyện nói - Ứng dụng đọc truyện tranh bằng giọng đọc

Ứng dụng web: tải truyện (ảnh/PDF) -> phát hiện khung chữ -> OCR -> phân tích cảm xúc -> đọc bằng giọng nói.

## Cấu trúc
- frontend/  React + Tailwind CSS
- backend/   Django + Django REST Framework (accounts, library, analysis)
- ai/        Module AI: detect_bubble (YOLOv8), ocr (VietOCR), emotion, tts
- docs/      ERD, use case, API, báo cáo, Figma

## Git Flow
- main: bản ổn định | develop: tích hợp | feature/ten-chuc-nang: làm việc
- Commit theo Conventional Commits: feat, fix, docs, refactor, chore, test
