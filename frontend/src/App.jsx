import React, { useState, useEffect } from "react";
import {
  Search,
  Shuffle,
  Layers,
  User,
  LogOut,
  Upload,
  Sparkles,
  History,
  X,
  Wand2,
} from "lucide-react";
import HomePage from "./pages/HomePage";
import UploadPage from "./pages/UploadPage";
import ReaderPage from "./pages/ReaderPage";
import HistoryPage from "./pages/HistoryPage";
import AdminStudioPage from "./pages/AdminStudioPage";

export default function App() {
  const [activePage, setActivePage] = useState("home"); // 'home' | 'upload' | 'personal-upload' | 'admin-studio' | 'reader' | 'history'
  const [selectedChapterId, setSelectedChapterId] = useState(null);
  const [studioChapterId, setStudioChapterId] = useState(null);
  const [personalBookData, setPersonalBookData] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [audioDescOnly, setAudioDescOnly] = useState(false);
  const [randomTrigger, setRandomTrigger] = useState(0);

  // Quản lý tài khoản đăng nhập / đăng ký
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // 'login' | 'register'
  const [displayName, setDisplayName] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("livecomic_user");
    if (saved) {
      try {
        setCurrentUser(JSON.parse(saved));
      } catch {
        localStorage.removeItem("livecomic_user");
      }
    }
  }, []);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    const url =
      authMode === "register"
        ? "http://127.0.0.1:8000/api/register/"
        : "http://127.0.0.1:8000/api/login/";

    const payload =
      authMode === "register"
        ? { display_name: displayName, email: loginEmail, password: loginPassword }
        : { email: loginEmail, password: loginPassword };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server Backend chưa mở đường dẫn API hoặc đang gặp lỗi.");
      }

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Thao tác thất bại.");
        return;
      }

      setCurrentUser(data);
      localStorage.setItem("livecomic_user", JSON.stringify(data));
      setShowAuthModal(false);
      setDisplayName("");
      setLoginEmail("");
      setLoginPassword("");
    } catch (err) {
      setAuthError(err.message || "Không kết nối được tới Backend (127.0.0.1:8000).");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("livecomic_user");
    setActivePage("home");
  };

  return (
    <div className="min-h-screen bg-[#11111b] text-zinc-100 font-sans">
      {/* Thanh Header phong cách LIVECOMICS.TO */}
      <header className="sticky top-0 z-40 bg-[#181824] border-b border-zinc-800/90 shadow-lg">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Logo & Các nút điều hướng trái */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <button
              onClick={() => {
                setPersonalBookData(null);
                setActivePage("home");
              }}
              className="text-xl sm:text-2xl font-black italic tracking-tighter text-amber-400 hover:text-amber-300 transition cursor-pointer"
            >
              LIVECOMICS<span className="text-white">.AI</span>
            </button>

            <button
              onClick={() => {
                setPersonalBookData(null);
                setActivePage("home");
              }}
              className={`hidden md:flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activePage === "home"
                  ? "bg-amber-400 text-black"
                  : "text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Thư viện
            </button>

            {currentUser?.role === "admin" ? (
              <>
                <button
                  onClick={() => setActivePage("upload")}
                  className="flex items-center gap-1.5 bg-[#e11d48] hover:bg-[#f43f5e] text-white text-xs font-extrabold px-3.5 py-2 rounded-lg shadow transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" /> Đăng Truyện Lên Web (Admin)
                </button>

                {studioChapterId && (
                  <button
                    onClick={() => setActivePage("admin-studio")}
                    className={`flex items-center gap-1.5 text-xs font-extrabold px-3 py-2 rounded-lg transition cursor-pointer ${
                      activePage === "admin-studio"
                        ? "bg-emerald-500 text-black"
                        : "bg-zinc-800 hover:bg-zinc-700 text-emerald-400"
                    }`}
                  >
                    <Wand2 className="w-3.5 h-3.5" /> AI Studio
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={() => setActivePage("personal-upload")}
                className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-extrabold px-3.5 py-2 rounded-lg shadow transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" /> Quăng Truyện Vào Đọc
              </button>
            )}

            <button
              onClick={() => setActivePage("history")}
              className={`hidden sm:flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition cursor-pointer ${
                activePage === "history"
                  ? "bg-zinc-700 text-amber-400"
                  : "bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200"
              }`}
            >
              <History className="w-3.5 h-3.5" /> Lịch sử đọc
            </button>

            <button
              onClick={() => {
                setActivePage("home");
                setRandomTrigger((prev) => prev + 1);
              }}
              className="hidden lg:flex items-center gap-1.5 bg-[#e11d48] hover:bg-[#f43f5e] text-white text-xs font-extrabold uppercase px-3.5 py-2 rounded-lg transition cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5" /> Ngẫu nhiên
            </button>
          </div>

          {/* Thanh tìm kiếm giữa */}
          <div className="flex-1 max-w-md hidden sm:block">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên truyện, tác giả..."
                className="w-full bg-[#11111b] border border-zinc-800 focus:border-amber-400 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Bộ lọc & Tài khoản bên phải */}
          <div className="flex items-center gap-3 shrink-0">
            <label className="hidden xl:flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={audioDescOnly}
                onChange={(e) => setAudioDescOnly(e.target.checked)}
                className="rounded border-zinc-700 text-amber-400 focus:ring-0"
              />
              <span>Mô tả âm thanh</span>
            </label>

            {currentUser ? (
              <div className="flex items-center gap-2.5">
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                    currentUser.role === "admin"
                      ? "bg-amber-400 text-black"
                      : "bg-zinc-800 text-zinc-300"
                  }`}
                >
                  {currentUser.role === "admin" ? "ADMIN" : "USER"}
                </span>
                <span className="text-xs font-bold text-white hidden sm:inline">
                  {currentUser.display_name}
                </span>
                <button
                  onClick={handleLogout}
                  title="Đăng xuất"
                  className="p-2 rounded-lg bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 text-zinc-300 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthMode("login");
                  setAuthError("");
                  setShowAuthModal(true);
                }}
                className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-amber-400" /> Tài khoản
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Nội dung từng trang */}
      <main>
        {activePage === "home" && (
          <HomePage
            currentUser={currentUser}
            searchQuery={searchQuery}
            audioDescOnly={audioDescOnly}
            randomTrigger={randomTrigger}
            onNavigateUpload={() =>
              setActivePage(currentUser?.role === "admin" ? "upload" : "personal-upload")
            }
            onSelectComic={(chapId) => {
              setPersonalBookData(null);
              setSelectedChapterId(chapId);
              setActivePage("reader");
            }}
          />
        )}

        {(activePage === "upload" || activePage === "personal-upload") && (
          <UploadPage
            mode={activePage === "upload" ? "admin" : "personal"}
            currentUser={currentUser}
            onUploadSuccess={(chapId) => {
              setPersonalBookData(null);
              setStudioChapterId(chapId);
              setActivePage("admin-studio");
            }}
            onPersonalReadReady={(bookData) => {
              setSelectedChapterId(null);
              setPersonalBookData(bookData);
              setActivePage("reader");
            }}
          />
        )}

        {activePage === "admin-studio" && studioChapterId && (
          <AdminStudioPage
            chapterId={studioChapterId}
            currentUser={currentUser}
            onBackToUpload={() => setActivePage("upload")}
            onOpenReader={(chapId) => {
              setPersonalBookData(null);
              setSelectedChapterId(chapId);
              setActivePage("reader");
            }}
          />
        )}

        {activePage === "reader" && (
          <ReaderPage
            chapterId={selectedChapterId}
            personalData={personalBookData}
            currentUser={currentUser}
            onBack={() => {
              setPersonalBookData(null);
              setActivePage("home");
            }}
          />
        )}

        {activePage === "history" && (
          <HistoryPage
            currentUser={currentUser}
            onSelectChapter={(chapId) => {
              setPersonalBookData(null);
              setSelectedChapterId(chapId);
              setActivePage("reader");
            }}
          />
        )}
      </main>

      {/* Modal Đăng Nhập / Tạo Tài Khoản */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#181824] border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5 relative">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex gap-6 border-b border-zinc-800 pb-2 text-sm font-bold">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setAuthError("");
                }}
                className={`pb-2 border-b-2 transition cursor-pointer ${
                  authMode === "login"
                    ? "border-amber-400 text-amber-400"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("register");
                  setAuthError("");
                }}
                className={`pb-2 border-b-2 transition cursor-pointer ${
                  authMode === "register"
                    ? "border-amber-400 text-amber-400"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Tạo tài khoản mới
              </button>
            </div>

            {authError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === "register" && (
                <div>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Tên hiển thị của bạn"
                    className="w-full bg-[#11111b] border border-zinc-800 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
              )}

              <div>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="Email (Admin: admin@livecomic.ai)"
                  className="w-full bg-[#11111b] border border-zinc-800 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Mật khẩu (Admin: admin123)"
                  className="w-full bg-[#11111b] border border-zinc-800 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="bg-amber-400 hover:bg-amber-300 text-black text-xs font-extrabold px-5 py-2.5 rounded-xl transition cursor-pointer"
                >
                  {authMode === "register" ? "Đăng ký ngay" : "Đăng nhập"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}