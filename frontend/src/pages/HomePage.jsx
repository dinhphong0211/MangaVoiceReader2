import React, { useEffect, useRef, useState } from "react";
import { ChevronRight, Volume2, Upload, BookOpen, Star } from "lucide-react";

function ComicRow({ title, icon, comics, onSelectComic }) {
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
              onClick={() => onSelectComic(comic.latestChapterId)}
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
  searchQuery,
  audioDescOnly,
  randomTrigger,
  onNavigateUpload,
  onSelectComic,
}) {
  const [comics, setComics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/comics/")
      .then((res) => res.json())
      .then((data) => {
        setComics(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Lỗi gọi API:", err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (randomTrigger > 0 && comics.length > 0) {
      const randomComic = comics[Math.floor(Math.random() * comics.length)];
      if (randomComic?.latestChapterId) {
        onSelectComic(randomComic.latestChapterId);
      }
    }
  }, [randomTrigger]);

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
            onSelectComic={onSelectComic}
          />

          <ComicRow
            title="MỚI THÊM GẦN ĐÂY"
            icon={null}
            comics={filtered}
            onSelectComic={onSelectComic}
          />
        </>
      )}
    </div>
  );
}