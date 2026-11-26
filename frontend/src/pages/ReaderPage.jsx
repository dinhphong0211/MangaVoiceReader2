import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Play,
  Square,
} from "lucide-react";

export default function ReaderPage({ chapterId, personalData, currentUser, onBack }) {
  const [chapterData, setChapterData] = useState(null);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setCurrentPageIdx(0);
    setIsPlaying(false);
    if (personalData) {
      setChapterData(personalData);
      return;
    }
    if (!chapterId) return;

    const headers = {};
    if (currentUser?.email) {
      headers["X-User-Email"] = currentUser.email;
    }

    fetch(`http://127.0.0.1:8000/api/chapters/${chapterId}/`, { headers })
      .then((res) => res.json())
      .then((data) => setChapterData(data))
      .catch((err) => console.error("Lỗi tải chương:", err));
  }, [chapterId, personalData, currentUser]);

  const totalPages = chapterData?.pages?.length || 0;

  const goPrev = () => setCurrentPageIdx((prev) => Math.max(0, prev - 1));
  const goNext = () => setCurrentPageIdx((prev) => Math.min(totalPages - 1, prev + 1));

  // Hỗ trợ bấm phím mũi tên Trái / Phải để chuyển trang
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [totalPages]);

  const handleToggleAudio = () => {
    // Sau này gắn hàm gọi phát / dừng file âm thanh TTS tại đây
    setIsPlaying((prev) => !prev);
  };

  if (!chapterData) {
    return <div className="text-center py-20 text-zinc-400">Đang tải dữ liệu chương truyện...</div>;
  }

  const currentPage = chapterData.pages[currentPageIdx];

  return (
    <div className="max-w-5xl mx-auto px-4 py-3 pb-20 flex flex-col gap-2.5">
      {/* Thanh tiêu đề & nút chuyển trang phía trên */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#181824] border border-zinc-800 px-4 py-2.5 rounded-xl">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 hover:text-amber-400 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Thư viện
        </button>

        <h1 className="font-bold text-white text-xs sm:text-sm truncate">
          {chapterData.comic_title} —{" "}
          <span className="text-amber-400">Chương {chapterData.chapter_no}</span>
        </h1>

        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            disabled={currentPageIdx === 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" /> Trước
          </button>

          <span className="text-xs font-bold text-amber-400 bg-[#11111b] border border-zinc-800 px-3 py-1 rounded-lg">
            Trang {currentPageIdx + 1} / {totalPages}
          </span>

          <button
            onClick={goNext}
            disabled={currentPageIdx >= totalPages - 1}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition cursor-pointer"
          >
            Sau <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Khung ảnh truyện nằm chính giữa, tự co giãn vừa khít chiều cao màn hình */}
      <div className="relative bg-black/95 rounded-xl border border-zinc-800 flex items-center justify-center h-[calc(100vh-195px)] min-h-[440px] overflow-hidden select-none">
        <button
          onClick={goPrev}
          disabled={currentPageIdx === 0}
          title="Trang trước (Mũi tên trái)"
          className="absolute left-3 z-10 p-2.5 rounded-full bg-black/70 hover:bg-amber-400 hover:text-black text-white border border-zinc-700 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer shadow-lg"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {currentPage && (
          <img
            src={currentPage.image_url}
            alt={`Trang ${currentPage.page_no}`}
            className="max-h-full max-w-full w-auto h-auto object-contain mx-auto"
          />
        )}

        <button
          onClick={goNext}
          disabled={currentPageIdx >= totalPages - 1}
          title="Trang sau (Mũi tên phải)"
          className="absolute right-3 z-10 p-2.5 rounded-full bg-black/70 hover:bg-amber-400 hover:text-black text-white border border-zinc-700 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer shadow-lg"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Thanh điều khiển Phát / Dừng âm thanh ở đáy màn hình */}
      <div className="fixed bottom-0 inset-x-0 z-50 bg-[#181824]/95 backdrop-blur-md border-t border-zinc-800 px-4 py-2.5">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-amber-400/15 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Volume2 className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-xs font-bold text-white truncate">
              {isPlaying
                ? `Đang phát giọng đọc AI — Trang ${currentPageIdx + 1}/${totalPages}`
                : `Giọng đọc Voice AI — Trang ${currentPageIdx + 1}/${totalPages}`}
            </p>
          </div>

          {!isPlaying ? (
            <button
              onClick={handleToggleAudio}
              className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-black text-xs font-extrabold px-5 py-2 rounded-full transition cursor-pointer shadow-md"
            >
              <Play className="w-3.5 h-3.5 fill-black" /> Phát âm thanh
            </button>
          ) : (
            <button
              onClick={handleToggleAudio}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold px-5 py-2 rounded-full transition cursor-pointer shadow-md"
            >
              <Square className="w-3.5 h-3.5 fill-white" /> Dừng âm thanh
            </button>
          )}
        </div>
      </div>
    </div>
  );
}