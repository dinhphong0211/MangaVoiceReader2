import React, { useEffect, useState } from "react";
import { History, BookOpen, Clock } from "lucide-react";

export default function HistoryPage({ currentUser, onSelectChapter }) {
  const [webHistory, setWebHistory] = useState([]);
  const [personalHistory, setPersonalHistory] = useState([]);

  useEffect(() => {
    if (currentUser?.email) {
      fetch("http://127.0.0.1:8000/api/history/", {
        headers: { "X-User-Email": currentUser.email },
      })
        .then((res) => res.json())
        .then((data) => setWebHistory(data))
        .catch(() => {});
    }

    const savedPersonal = JSON.parse(localStorage.getItem("personal_read_history") || "[]");
    setPersonalHistory(savedPersonal);
  }, [currentUser]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-4">
        <History className="w-6 h-6 text-amber-400" />
        <h1 className="text-2xl font-black italic uppercase text-amber-400">Lịch Sử Truyện Đã Đọc</h1>
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase text-zinc-300">Truyện Đã Đọc Trên Thư Viện Web</h2>
        {!currentUser ? (
          <p className="text-xs text-zinc-500">Đăng nhập tài khoản để đồng bộ lịch sử đọc truyện trên web.</p>
        ) : webHistory.length === 0 ? (
          <p className="text-xs text-zinc-500">Bạn chưa đọc bộ truyện nào trên thư viện web.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {webHistory.map((item) => (
              <div
                key={item.comic_id}
                onClick={() => onSelectChapter(item.chapter_id)}
                className="flex items-center gap-3 bg-[#181824] border border-zinc-800 hover:border-amber-400 p-3 rounded-xl cursor-pointer transition"
              >
                <img src={item.cover} alt={item.title} className="w-12 h-16 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-white truncate">{item.title}</h3>
                  <p className="text-xs text-amber-400 font-semibold">Đang đọc: Chương {item.chapter_no}</p>
                  <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" /> {item.last_read_at}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase text-zinc-300">Truyện Cá Nhân Đã Quăng Vào Đọc</h2>
        {personalHistory.length === 0 ? (
          <p className="text-xs text-zinc-500">Chưa có lịch sử truyện cá nhân.</p>
        ) : (
          <div className="space-y-2">
            {personalHistory.map((p, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-[#181824] border border-zinc-800 px-4 py-3 rounded-xl text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-violet-400" />
                  <span className="font-semibold text-zinc-200">{p.title}</span>
                  <span className="text-xs text-zinc-500">({p.pageCount} trang)</span>
                </div>
                <span className="text-xs text-zinc-400">{p.readAt}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}