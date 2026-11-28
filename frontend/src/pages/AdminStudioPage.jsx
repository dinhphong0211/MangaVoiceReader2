import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Loader2,
  Eye,
  MessageSquareText,
  AlertTriangle,
  BookOpen,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

const API = "http://127.0.0.1:8000";

// Luôn đọc dạng text rồi mới parse JSON, để hiện lỗi thật thay vì "Unexpected token '<'"
async function postJson(url, user) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "X-User-Role": user?.role || "user" },
  });
  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      `Server lỗi ${res.status} (không trả JSON). Xem terminal chạy Django để biết chi tiết.`
    );
  }
  if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
  return data;
}

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
  const [hoveredBubbleId, setHoveredBubbleId] = useState(null);

  // Tải thông tin & ảnh các trang của chương khi mở trang
  useEffect(() => {
    if (!chapterId) return;
    fetch(`${API}/api/chapters/${chapterId}/`)
      .then((res) => res.json())
      .then((data) => {
        setChapterInfo({
          comic_title: data.comic_title,
          chapter_no: data.chapter_no,
        });
        setPages(data.pages || []);
      })
      .catch(() => setError("Không tải được dữ liệu chương truyện."));
  }, [chapterId]);

  // Nút 1: nhận diện bóng thoại cho TẤT CẢ các trang
  const handleDetectBubbles = async () => {
    if (!chapterId) return;
    setDetecting(true);
    setError("");
    setStatusMsg("");
    try {
      const data = await postJson(
        `${API}/api/chapters/${chapterId}/detect-bubbles/`,
        currentUser
      );
      setStatusMsg(
        `✅ Đã nhận diện & lưu ${data.total_bubbles} bóng thoại trên ${
          (data.pages || []).length
        } trang!`
      );
      setPages(data.pages || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetecting(false);
    }
  };

  // Nút 2: nhận diện tiếng Việt cho TẤT CẢ các trang
  const handleOcrBubbles = async () => {
    if (!chapterId) return;
    setOcring(true);
    setError("");
    setStatusMsg("");
    try {
      const data = await postJson(
        `${API}/api/chapters/${chapterId}/ocr-bubbles/`,
        currentUser
      );
      setStatusMsg(`🎉 ${data.message}`);
      setPages(data.pages || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setOcring(false);
    }
  };

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

      {(detecting || ocring) && (
        <p className="text-xs text-amber-300 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Đang xử lý {pages.length} trang, có thể mất vài phút...
        </p>
      )}

      {/* Kết quả của TẤT CẢ các trang, xếp dọc ngay bên dưới thanh admin */}
      {pages.map((page) => (
        <div
          key={page.id}
          className="bg-[#181824] border border-zinc-800 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 pb-3 border-b border-zinc-800">
            <Eye className="w-4 h-4" />
            <span>
              Trang {page.page_no} / {pages.length} — {page.bubbles?.length || 0} bóng thoại
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* TRÁI: ảnh + khung xanh */}
            <div className="lg:col-span-7 flex justify-center bg-black/95 rounded-xl p-3 border border-zinc-800">
              <div className="relative inline-block max-w-full">
                <img
                  src={page.image_url}
                  alt={`Trang ${page.page_no}`}
                  className="block max-h-[800px] w-auto h-auto select-none"
                />

                {(page.bubbles || []).map((b) => {
                  const isHovered = hoveredBubbleId === b.id;
                  return (
                    <div
                      key={b.id}
                      onMouseEnter={() => setHoveredBubbleId(b.id)}
                      onMouseLeave={() => setHoveredBubbleId(null)}
                      style={{
                        left: `${(b.x / page.width) * 100}%`,
                        top: `${(b.y / page.height) * 100}%`,
                        width: `${(b.w / page.width) * 100}%`,
                        height: `${(b.h / page.height) * 100}%`,
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

            {/* PHẢI: hội thoại tiếng Việt */}
            <div className="lg:col-span-5 bg-[#11111b] border border-zinc-800 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
                <MessageSquareText className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                  Thứ tự đọc & Hội thoại tiếng Việt
                </h3>
              </div>

              {!page.bubbles || page.bubbles.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-8">
                  Chưa có bóng thoại. Bấm nút{" "}
                  <strong className="text-amber-400">1. Nhận diện bóng thoại</strong>.
                </p>
              ) : (
                page.bubbles.map((b) => {
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
                        {b.needs_review && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
                            <AlertTriangle className="w-3 h-3" /> Cần kiểm tra lại
                          </span>
                        )}
                      </div>

                      <div className="text-xs bg-black/50 border border-zinc-800 rounded-lg px-3 py-2 space-y-1">
                        {b.text ? (
                          <>
                            <p className="text-zinc-100 font-medium leading-relaxed">
                              {b.text}
                            </p>
                            {b.text_tts && b.text_tts !== b.text && (
                              <p className="text-[11px] text-emerald-400/90 border-t border-zinc-800/80 pt-1">
                                🔊 Chuẩn đọc: {b.text_tts}
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="text-zinc-500 italic">
                            Chưa nhận diện chữ (bấm nút 2).
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
      ))}
    </div>
  );
}