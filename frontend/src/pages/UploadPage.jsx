import React, { useState } from "react";
import { UploadCloud, BookOpen, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

export default function UploadPage({ mode, currentUser, onUploadSuccess, onPersonalReadReady }) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("LiveComic Studio • CC-BY");
  const [description, setDescription] = useState("");
  const [isFeatured, setIsFeatured] = useState(true);
  const [hasAudioDesc, setHasAudioDesc] = useState(true);
  const [chapterNo, setChapterNo] = useState(1);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isAdminMode = mode === "admin";

  const handleFileChange = (e) => {
    if (e.target.files) {
      const sorted = Array.from(e.target.files).sort((a, b) => a.name.localeCompare(b.name));
      setFiles(sorted);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const sorted = Array.from(e.dataTransfer.files).sort((a, b) => a.name.localeCompare(b.name));
      setFiles(sorted);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      setError("Vui lòng chọn ít nhất 1 ảnh trang truyện.");
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("title", title.trim() || (isAdminMode ? "Truyện mới" : "Truyện cá nhân"));
    formData.append("author", author);
    formData.append("description", description);
    formData.append("cast_type", "full_cast");
    formData.append("is_featured", isFeatured);
    formData.append("has_audio_desc", hasAudioDesc);
    formData.append("chapter_no", chapterNo);
    files.forEach((file) => formData.append("images", file));

    try {
      if (isAdminMode) {
        const res = await fetch("http://127.0.0.1:8000/api/comics/upload/", {
          method: "POST",
          headers: { "X-User-Role": currentUser?.role || "user" },
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Không có quyền đăng truyện.");
        onUploadSuccess(data.chapter_id);
      } else {
        const res = await fetch("http://127.0.0.1:8000/api/comics/quick-read/", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Lỗi xử lý truyện.");

        const mergedPages = data.pages.map((p, index) => ({
          ...p,
          image_url: URL.createObjectURL(files[index]),
        }));

        const personalBook = { ...data, pages: mergedPages };

        const localHist = JSON.parse(localStorage.getItem("personal_read_history") || "[]");
        localHist.unshift({
          title: personalBook.comic_title,
          pageCount: files.length,
          readAt: new Date().toLocaleString("vi-VN"),
        });
        localStorage.setItem("personal_read_history", JSON.stringify(localHist.slice(0, 20)));

        onPersonalReadReady(personalBook);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="bg-[#181824] border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <div>
          <span
            className={`inline-block text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded mb-2 ${
              isAdminMode ? "bg-[#e11d48] text-white" : "bg-violet-600 text-white"
            }`}
          >
            {isAdminMode
              ? "Quyền Quản Trị Viên (Tự động nhận diện thể loại bằng CLIP AI)"
              : "Chế Độ Đọc Cá Nhân (Không lưu server)"}
          </span>
          <h1 className="text-2xl font-bold text-white">
            {isAdminMode ? "Đăng Truyện Mới Lên Thư Viện LIVECOMICS" : "Quăng Truyện Vào Đọc Ngay"}
          </h1>
        </div>

        {isAdminMode && currentUser?.role !== "admin" && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>Chỉ tài khoản Admin mới được đăng truyện lên thư viện chung.</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Tên bộ truyện</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Gorgo #02, Doraemon..."
                className="w-full bg-[#11111b] border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            {isAdminMode && (
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Số chương</label>
                <input
                  type="number"
                  min="1"
                  value={chapterNo}
                  onChange={(e) => setChapterNo(e.target.value)}
                  className="w-full bg-[#11111b] border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            )}
          </div>

          {isAdminMode && (
            <div className="space-y-4 bg-[#11111b] p-4 rounded-xl border border-zinc-800/80">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Tác giả / Nguồn truyện</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="VD: Joe Gill và Steve Ditko"
                  className="w-full bg-[#181824] border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Mô tả nội dung truyện (Hiển thị trong Popup thông tin)
                </label>
                <textarea
                  rows="3"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Nhập tóm tắt cốt truyện (để trống hệ thống sẽ tự tạo mô tả theo danh mục AI nhận diện)..."
                  className="w-full bg-[#181824] border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="rounded border-zinc-600 text-amber-400"
                  />
                  <span>Ghim vào hàng ★ NỔI BẬT</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasAudioDesc}
                    onChange={(e) => setHasAudioDesc(e.target.checked)}
                    className="rounded border-zinc-600 text-amber-400"
                  />
                  <span>Bật Voice AI đọc thoại</span>
                </label>
              </div>
            </div>
          )}

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-zinc-700 hover:border-amber-400 rounded-2xl p-8 text-center transition bg-[#11111b]/60"
          >
            <UploadCloud className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-zinc-200">
              Kéo thả các trang ảnh truyện (JPG, PNG, WEBP) vào đây (Tấm đầu tiên dùng làm ảnh bìa & phân loại danh mục)
            </p>
            <label className="inline-block mt-3 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer">
              Chọn file từ máy
              <input type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>

            {files.length > 0 && (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Đã chọn {files.length} trang ảnh</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 font-bold py-3 rounded-xl transition cursor-pointer ${
              isAdminMode
                ? "bg-[#e11d48] hover:bg-[#f43f5e] text-white"
                : "bg-amber-400 hover:bg-amber-300 text-black"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Đang tải truyện & phân tích danh mục AI...</span>
              </>
            ) : (
              <>
                <BookOpen className="w-5 h-5" />
                <span>{isAdminMode ? "Đăng Lên Trang Chủ Cho Mọi Người Xem" : "Mở Đọc Ngay"}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}