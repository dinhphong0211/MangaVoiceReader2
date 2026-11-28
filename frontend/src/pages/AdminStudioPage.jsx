import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  MessageSquareText,
  AlertTriangle,
  BookOpen,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

export default function AdminStudioPage({
  chapterId,
  currentUser,
  onBackToUpload,
  onOpenReader,
}) {
  const [detecting, setDetecting] = useState(false);
  const [ocring, setOcring] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");

  const [chapterInfo, setChapterInfo] = useState(null);
  const [pages, setPages] = useState([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [hoveredBubbleId, setHoveredBubbleId] = useState(null);

  // Tự động tải thông tin & ảnh các trang của chương ngay khi chuyển sang trang này
  useEffect(() => {
    if (!chapterId) return;
    fetch(`http://127.0.0.1:8000/api/chapters/${chapterId}/`)
      .then((res) => res.json())
      .then((data) => {
        setChapterInfo({
          comic_title: data.comic_title,
          chapter_no: data.chapter_no,
        });
        setPages(data.pages || []);
        setPageIdx(0);
      })
      .catch(() => setError("Không tải được dữ liệu chương truyện."));
  }, [chapterId]);

  const handleDetectBubbles = async () => {
    if (!chapterId) return;
    setDetecting(true);
    setError("");
    setStatusMsg("");
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/chapters/${chapterId}/detect-bubbles/`,
        {
          method: "POST",
          headers: { "X-User-Role": currentUser?.role || "user" },
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi nhận diện bóng thoại.");
      setStatusMsg(`✅ Đã nhận diện & lưu ${data.total_bubbles} bóng thoại vào CSDL!`);
      setPages(data.pages || []);
      setPageIdx(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetecting(false);
    }
  };

  const handleOcrBubbles = async () => {
    if (!chapterId) return;
    setOcring(true);
    setError("");
    setStatusMsg("");
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/chapters/${chapterId}/ocr-bubbles/`,
        {
          method: "POST",
          headers: { "X-User-Role": currentUser?.role || "user" },
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi nhận diện chữ tiếng Việt.");
      setStatusMsg(`🎉 ${data.message}`);
      setPages(data.pages || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setOcring(false);
    }
  };

  const activePage = pages[pageIdx];
  const hasAnyBubbles = pages.some((p) => p.bubbles && p.bubbles.length > 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Thanh Header Studio */}
      <div className="bg-[#181824] border border-zinc-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBackToUpload}
              className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Đăng chương khác
            </button>
            <span className="text-zinc-600">•</span>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-[#e11d48] text-white">
              AI Studio Kiểm Duyệt
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-white">
            {chapterInfo
              ? `${chapterInfo.comic_title} — Chương ${chapterInfo.chapter_no}`
              : `Xử lý AI cho Chapter #${chapterId}`}
          </h1>
        </div>

        {/* Cụm nút chức năng chính */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDetectBubbles}
            disabled={detecting || ocring}
            className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-black text-xs font-extrabold px-4 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            {detecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Đang chạy YOLOv8...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> ⚡ 1. Nhận diện bóng thoại
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleOcrBubbles}
            disabled={ocring || detecting || !hasAnyBubbles}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold px-4 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            {ocring ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Đang chạy Gemini OCR...
              </>
            ) : (
              <>🔤 2. Nhận diện tiếng Việt</>
            )}
          </button>

          <button
            type="button"
            onClick={() => onOpenReader(chapterId)}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer"
          >
            <BookOpen className="w-4 h-4" /> Xem trang đọc →
          </button>
        </div>
      </div>

      {/* Thông báo trạng thái / Lỗi */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {statusMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Khu vực làm việc 2 cột */}
      {activePage && (
        <div className="bg-[#181824] border border-zinc-800 rounded-2xl p-5 space-y-4">
          {/* Thanh điều hướng trang */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <Eye className="w-4 h-4" />
              <span>
                Trang {activePage.page_no} / {pages.length} —{" "}
                {activePage.bubbles?.length || 0} bóng thoại
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPageIdx((i) => Math.max(0, i - 1))}
                disabled={pageIdx === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs text-white cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Trang trước
              </button>
              <button
                type="button"
                onClick={() => setPageIdx((i) => Math.min(pages.length - 1, i + 1))}
                disabled={pageIdx >= pages.length - 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs text-white cursor-pointer"
              >
                Trang sau <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2 CỘT: TRÁI (Ảnh + Khung xanh) | PHẢI (Hội thoại tiếng Việt) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* CỘT TRÁI */}
            <div className="lg:col-span-7 flex justify-center bg-black/95 rounded-xl p-3 border border-zinc-800 overflow-auto">
              <div className="relative inline-block max-w-full">
                <img
                  src={activePage.image_url}
                  alt={`Trang ${activePage.page_no}`}
                  className="block max-h-[800px] w-auto h-auto select-none"
                />

                {(activePage.bubbles || []).map((b) => {
                  const leftPct = (b.x / activePage.width) * 100;
                  const topPct = (b.y / activePage.height) * 100;
                  const widthPct = (b.w / activePage.width) * 100;
                  const heightPct = (b.h / activePage.height) * 100;
                  const isHovered = hoveredBubbleId === b.id;

                  return (
                    <div
                      key={b.id}
                      onMouseEnter={() => setHoveredBubbleId(b.id)}
                      onMouseLeave={() => setHoveredBubbleId(null)}
                      style={{
                        left: `${leftPct}%`,
                        top: `${topPct}%`,
                        width: `${widthPct}%`,
                        height: `${heightPct}%`,
                      }}
                      className={`absolute border-[3px] transition-colors ${
                        isHovered
                          ? "border-amber-400 bg-amber-400/15 z-20"
                          : "border-[#00ff00] z-10"
                      }`}
                    >
                      <span
                        className={`absolute -top-6 -left-[3px] text-black text-[11px] font-extrabold px-1.5 py-0.5 leading-none whitespace-nowrap shadow ${
                          isHovered ? "bg-amber-400" : "bg-[#00ff00]"
                        }`}
                      >
                        #{b.reading_order}
                        {b.confidence ? ` (${Number(b.confidence).toFixed(2)})` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CỘT PHẢI */}
            <div className="lg:col-span-5 bg-[#11111b] border border-zinc-800 rounded-xl p-4 flex flex-col max-h-[825px]">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                    Thứ tự đọc & Hội thoại tiếng Việt
                  </h3>
                </div>
                <span className="text-[11px] text-zinc-400">
                  {activePage.bubbles?.length || 0} khung
                </span>
              </div>

              <div className="space-y-2.5 overflow-y-auto pr-1">
                {!activePage.bubbles || activePage.bubbles.length === 0 ? (
                  <div className="text-center py-12 space-y-2">
                    <p className="text-xs text-zinc-400">
                      Chưa có dữ liệu bong bóng thoại ở trang này.
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Hãy bấm nút <strong className="text-amber-400">⚡ 1. Nhận diện bóng thoại</strong> ở góc trên bên phải.
                    </p>
                  </div>
                ) : (
                  activePage.bubbles.map((b) => {
                    const isHovered = hoveredBubbleId === b.id;
                    return (
                      <div
                        key={b.id}
                        onMouseEnter={() => setHoveredBubbleId(b.id)}
                        onMouseLeave={() => setHoveredBubbleId(null)}
                        className={`p-3 rounded-xl border transition ${
                          isHovered
                            ? "bg-amber-400/10 border-amber-400"
                            : b.needs_review
                            ? "bg-amber-500/5 border-amber-500/40"
                            : "bg-[#181824] border-zinc-800"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-extrabold text-[#00ff00]">
                            #{b.reading_order}
                          </span>
                          {b.needs_review ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
                              <AlertTriangle className="w-3 h-3" /> Cần kiểm tra lại
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-500 font-mono">
                              x:{b.x}, y:{b.y}
                            </span>
                          )}
                        </div>

                        <div className="text-xs bg-black/50 border border-zinc-800 rounded-lg px-3 py-2 space-y-1">
                          {b.text ? (
                            <>
                              <p className="text-zinc-100 font-medium leading-relaxed">{b.text}</p>
                              {b.text_tts && b.text_tts !== b.text && (
                                <p className="text-[11px] text-emerald-400/90 border-t border-zinc-800/80 pt-1">
                                  🔊 Chuẩn đọc: {b.text_tts}
                                </p>
                              )}
                            </>
                          ) : (
                            <span className="text-zinc-500 italic">
                              Bấm nút "🔤 2. Nhận diện tiếng Việt" ở trên để trích xuất chữ...
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}