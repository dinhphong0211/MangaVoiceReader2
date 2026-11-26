import React, { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Volume2,
  Upload,
  BookOpen,
  Star,
  Play,
  ChevronLeft,
  Sparkles,
  Pencil,
  Trash2,
  Save,
  X,
} from "lucide-react";

function ComicRow({ title, icon, comics, onOpenDetail }) {
  const rowRef = useRef(null);

  const scrollRight = () => {
    if (rowRef.current) {
      rowRef.current.scrollBy({ left: 650, behavior: "smooth" });
    }
  };

  if (comics.length === 0) return null;

  return (
    <section className="space-y-3 relative">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-xl sm:text-2xl font-black italic uppercase tracking-wide text-amber-400 drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)]">
          {title}
        </h2>
      </div>

      <div className="relative">
        <div
          ref={rowRef}
          className="flex gap-4 overflow-x-auto pb-2 scroll-smooth"
        >
          {comics.map((comic) => (
            <div
              key={`${title}-${comic.id}`}
              onClick={() => onOpenDetail(comic)}
              className="w-[155px] sm:w-[175px] shrink-0 cursor-pointer group flex flex-col"
            >
              <div className="relative aspect-[3/4] w-full rounded-lg overflow-hidden bg-zinc-900 border-2 border-zinc-800 group-hover:border-amber-400 transition shadow-md">
                <img
                  src={comic.cover}
                  alt={comic.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />

                <span className="absolute top-2 left-2 bg-[#e11d48] text-white text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full shadow">
                  VOICE AI
                </span>

                {comic.hasAudioDesc && (
                  <span className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/85 border border-amber-400/70 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    <Volume2 className="w-3 h-3 text-amber-400" />
                    <span>Mô tả âm thanh</span>
                  </span>
                )}
              </div>

              <h3 className="mt-2 text-xs sm:text-sm font-bold text-zinc-100 group-hover:text-amber-400 truncate transition">
                {comic.title}
              </h3>
              <p className="text-[11px] text-zinc-400 truncate">
                {comic.author}
              </p>
            </div>
          ))}
        </div>

        {comics.length > 5 && (
          <button
            onClick={scrollRight}
            className="hidden sm:flex items-center justify-center w-9 h-16 bg-black/80 hover:bg-black text-white border border-zinc-700 rounded-l-lg absolute right-0 top-[38%] -translate-y-1/2 z-10 cursor-pointer shadow-lg"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </section>
  );
}

export default function HomePage({
  currentUser,
  searchQuery,
  audioDescOnly,
  randomTrigger,
  onNavigateUpload,
  onSelectComic,
}) {
  const [comics, setComics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedComicDetail, setSelectedComicDetail] = useState(null);

  // State cho chế độ chỉnh sửa truyện (Admin)
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editGenresText, setEditGenresText] = useState("");
  const [editIsFeatured, setEditIsFeatured] = useState(true);
  const [editHasAudioDesc, setEditHasAudioDesc] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const isAdmin = currentUser?.role === "admin";

  const fetchComics = () => {
    setLoading(true);
    fetch("http://127.0.0.1:8000/api/comics/")
      .then((res) => res.json())
      .then((data) => {
        setComics(data);
        setLoading(false);
        if (selectedComicDetail) {
          const updated = data.find((item) => item.id === selectedComicDetail.id);
          setSelectedComicDetail(updated || null);
        }
      })
      .catch((err) => {
        console.error("Lỗi gọi API:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchComics();
  }, []);

  useEffect(() => {
    if (randomTrigger > 0 && comics.length > 0) {
      const randomComic = comics[Math.floor(Math.random() * comics.length)];
      if (randomComic) {
        openComicModal(randomComic);
      }
    }
  }, [randomTrigger]);

  const openComicModal = (comic) => {
    setSelectedComicDetail(comic);
    setIsEditing(false);
  };

  const startEditMode = () => {
    if (!selectedComicDetail) return;
    setEditTitle(selectedComicDetail.title || "");
    setEditAuthor(selectedComicDetail.author || "");
    setEditDescription(selectedComicDetail.description || "");
    setEditGenresText((selectedComicDetail.genres || []).join(", "));
    setEditIsFeatured(Boolean(selectedComicDetail.isFeatured));
    setEditHasAudioDesc(Boolean(selectedComicDetail.hasAudioDesc));
    setIsEditing(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedComicDetail) return;
    setActionLoading(true);

    const parsedGenres = editGenresText
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/comics/${selectedComicDetail.id}/update/`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-User-Role": currentUser?.role || "user",
          },
          body: JSON.stringify({
            title: editTitle,
            author: editAuthor,
            description: editDescription,
            genres: parsedGenres,
            is_featured: editIsFeatured,
            has_audio_desc: editHasAudioDesc,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cập nhật thất bại.");

      setIsEditing(false);
      fetchComics();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteComic = async () => {
    if (!selectedComicDetail) return;
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa toàn bộ truyện "${selectedComicDetail.title}" và tất cả các chương không?`
    );
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/comics/${selectedComicDetail.id}/delete/`,
        {
          method: "DELETE",
          headers: {
            "X-User-Role": currentUser?.role || "user",
          },
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xóa thất bại.");

      setSelectedComicDetail(null);
      setIsEditing(false);
      fetchComics();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = comics.filter((c) => {
    const matchSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.author && c.author.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchVoice = audioDescOnly ? c.hasAudioDesc : true;
    return matchSearch && matchVoice;
  });

  const featuredComics = filtered.filter((c) => c.isFeatured);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-8">
      {loading ? (
        <div className="text-sm text-zinc-400 py-10">Đang tải thư viện truyện...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-[#181824] border border-zinc-800 rounded-2xl space-y-4">
          <BookOpen className="w-12 h-12 text-amber-400/70 mx-auto" />
          <p className="text-zinc-200 font-semibold">
            Chưa có bộ truyện nào trên trang chủ. Hãy đăng nhập Admin để đăng truyện đầu tiên!
          </p>
          <button
            onClick={onNavigateUpload}
            className="inline-flex items-center gap-2 bg-[#e11d48] hover:bg-[#f43f5e] text-white text-sm font-bold px-5 py-2.5 rounded-lg cursor-pointer shadow-lg transition"
          >
            <Upload className="w-4 h-4" /> Đăng truyện ngay
          </button>
        </div>
      ) : (
        <>
          <ComicRow
            title="NỔI BẬT"
            icon={<Star className="w-6 h-6 text-amber-400 fill-amber-400" />}
            comics={featuredComics.length > 0 ? featuredComics : filtered}
            onOpenDetail={openComicModal}
          />

          <ComicRow
            title="MỚI THÊM GẦN ĐÂY"
            icon={null}
            comics={filtered}
            onOpenDetail={openComicModal}
          />
        </>
      )}

      {/* POPUP THÔNG TIN CHI TIẾT TRUYỆN */}
      {selectedComicDetail && (
        <div
          onClick={() => setSelectedComicDetail(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl bg-[#141622] border-2 border-amber-400/90 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden my-auto"
          >
            {/* Thanh Header trên cùng của Popup */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 sm:px-7 py-3.5 border-b border-zinc-800/80 bg-[#11131d]">
              <span className="text-lg sm:text-xl font-black italic tracking-tighter text-amber-400">
                LIVECOMICS<span className="text-white">.AI</span>
              </span>

              <div className="flex items-center gap-2">
                {isAdmin && !isEditing && (
                  <>
                    <button
                      onClick={startEditMode}
                      disabled={actionLoading}
                      className="flex items-center gap-1 bg-amber-400 hover:bg-amber-300 text-black text-[11px] font-extrabold uppercase px-3 py-1.5 rounded transition cursor-pointer shadow"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Sửa truyện
                    </button>
                    <button
                      onClick={handleDeleteComic}
                      disabled={actionLoading}
                      className="flex items-center gap-1 bg-zinc-800 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/40 text-[11px] font-extrabold uppercase px-3 py-1.5 rounded transition cursor-pointer shadow"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Xóa
                    </button>
                  </>
                )}

                <button
                  onClick={() => setSelectedComicDetail(null)}
                  className="flex items-center gap-1 bg-[#e11d48] hover:bg-[#f43f5e] text-white text-[11px] font-extrabold uppercase px-3 py-1.5 rounded transition cursor-pointer shadow"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> VỀ THƯ VIỆN TRUYỆN
                </button>
              </div>
            </div>

            {/* Nội dung chính: Ảnh bìa bên trái - Thông tin chi tiết (hoặc Form sửa) bên phải */}
            <div className="p-5 sm:p-8">
              <div className="flex flex-col md:flex-row gap-6 sm:gap-8">
                {/* Cột trái: Bìa truyện viền vàng */}
                <div className="w-48 sm:w-60 mx-auto md:mx-0 shrink-0">
                  <div className="aspect-[3/4] rounded-lg overflow-hidden border-2 border-amber-400 shadow-[0_10px_30px_rgba(0,0,0,0.75)] bg-zinc-900">
                    <img
                      src={selectedComicDetail.cover}
                      alt={selectedComicDetail.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* Cột phải: Chế độ Sửa (Admin) hoặc Chế độ Xem */}
                {isEditing ? (
                  <form onSubmit={handleSaveEdit} className="flex-1 space-y-3.5">
                    <div className="text-sm font-black uppercase text-amber-400">
                      Chỉnh sửa thông tin bộ truyện
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                        Tên bộ truyện
                      </label>
                      <input
                        type="text"
                        required
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full bg-[#11111b] border border-zinc-700 focus:border-amber-400 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                        Tác giả / Nguồn
                      </label>
                      <input
                        type="text"
                        value={editAuthor}
                        onChange={(e) => setEditAuthor(e.target.value)}
                        className="w-full bg-[#11111b] border border-zinc-700 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                        Danh mục (cách nhau bởi dấu phẩy)
                      </label>
                      <input
                        type="text"
                        value={editGenresText}
                        onChange={(e) => setEditGenresText(e.target.value)}
                        placeholder="VD: Hành động, Phiêu lưu, Hài hước"
                        className="w-full bg-[#11111b] border border-zinc-700 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                        Mô tả cốt truyện
                      </label>
                      <textarea
                        rows="3"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full bg-[#11111b] border border-zinc-700 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-wrap gap-5 pt-1">
                      <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editIsFeatured}
                          onChange={(e) => setEditIsFeatured(e.target.checked)}
                          className="rounded border-zinc-600 text-amber-400"
                        />
                        <span>Ghim vào hàng ★ NỔI BẬT</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editHasAudioDesc}
                          onChange={(e) => setEditHasAudioDesc(e.target.checked)}
                          className="rounded border-zinc-600 text-amber-400"
                        />
                        <span>Bật Voice AI đọc thoại</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold uppercase px-4 py-2 rounded-lg cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        {actionLoading ? "Đang lưu..." : "Lưu thay đổi"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="inline-flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
                      >
                        <X className="w-4 h-4" /> Hủy
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-amber-400 text-black text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                          COMIC
                        </span>
                        <span className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
                          ĐỌC MIỄN PHÍ
                        </span>
                        {selectedComicDetail.hasAudioDesc && (
                          <span className="border border-amber-400/80 text-amber-300 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
                            MÔ TẢ ÂM THANH
                          </span>
                        )}
                      </div>

                      <div>
                        <h1 className="text-2xl sm:text-4xl font-black italic uppercase text-amber-400 tracking-wide drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)]">
                          {selectedComicDetail.title}
                        </h1>
                        <p className="text-xs text-zinc-400 mt-1">
                          của{" "}
                          <span className="text-zinc-300 font-medium">
                            {selectedComicDetail.author}
                          </span>
                        </p>
                      </div>

                      <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                        {selectedComicDetail.description}
                      </p>

                      {/* Danh mục truyện */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-400/90 font-semibold mr-1">
                          <Sparkles className="w-3.5 h-3.5" /> Danh mục:
                        </span>
                        {(selectedComicDetail.genres || ["Hành động", "Phiêu lưu"]).map(
                          (genre, i) => (
                            <span
                              key={i}
                              className="bg-[#222536] border border-zinc-700/90 text-zinc-100 text-xs font-bold px-2.5 py-1 rounded"
                            >
                              {genre}
                            </span>
                          )
                        )}
                      </div>

                      <div className="text-[11px] text-zinc-400 pt-1 space-y-0.5">
                        <p>
                          {selectedComicDetail.totalPages || 0} trang •{" "}
                          {selectedComicDetail.chapters?.length || 1} chương • Đọc thành tiếng, kèm âm thanh
                        </p>
                        <p>Mọi khung tranh đều được mô tả thành lời</p>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => {
                          const targetChapId =
                            selectedComicDetail.firstChapterId ||
                            selectedComicDetail.latestChapterId;
                          setSelectedComicDetail(null);
                          if (targetChapId) onSelectComic(targetChapId);
                        }}
                        className="inline-flex items-center gap-2 bg-[#e11d48] hover:bg-[#f43f5e] text-white text-sm sm:text-base font-black uppercase px-7 py-3 rounded-lg shadow-[0_4px_20px_rgba(225,29,72,0.45)] transition transform hover:-translate-y-0.5 cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-white" /> BẮT ĐẦU ĐỌC
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Khu vực Danh sách Chương (Chapter) ở dưới cùng */}
              <div className="mt-7 pt-5 border-t border-zinc-800/90">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-200">
                    DANH SÁCH CHƯƠNG{" "}
                    <span className="text-amber-400 italic ml-1">
                      Cả {selectedComicDetail.chapters?.length || 0} chương
                    </span>
                  </h3>
                </div>

                {selectedComicDetail.chapters && selectedComicDetail.chapters.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-52 overflow-y-auto pr-1">
                    {selectedComicDetail.chapters.map((chap) => (
                      <button
                        key={chap.id}
                        onClick={() => {
                          setSelectedComicDetail(null);
                          onSelectComic(chap.id);
                        }}
                        className="flex items-center gap-2.5 bg-[#1b1e2e] hover:bg-[#25293e] border border-zinc-800 hover:border-amber-400 rounded-lg p-2 text-left transition group cursor-pointer"
                      >
                        <img
                          src={chap.thumbnail || selectedComicDetail.cover}
                          alt={chap.title}
                          className="w-10 h-14 object-cover rounded border border-zinc-700 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-extrabold text-amber-400 group-hover:text-amber-300 truncate">
                            {chap.title}
                          </div>
                          <div className="text-[11px] text-zinc-400 mt-0.5">
                            {chap.page_count} trang
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">Chưa có chương nào được tải lên.</p>
                )}
              </div>

              <p className="text-center text-[11px] text-zinc-500 mt-6">
                Từng khung tranh được đọc to, có giọng nhân vật, hiệu ứng âm thanh và âm thanh nền.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}