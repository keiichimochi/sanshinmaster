import React, { useState, useEffect } from "react";
import { Song, KUNKUNSHI_MAP } from "../types";
import { FileUp, BookOpen, Music, Trash2, Plus, Edit2, AlertCircle } from "lucide-react";

interface SongSelectorProps {
  onSelectSong: (song: Song) => void;
  selectedSongId: string;
}

// Preloaded famous Okinawan songs
const DEFAULT_SONGS: Song[] = [
  {
    id: "shimanchu_takara",
    title: "島人ぬ宝 (Shimanchu nu Takara)",
    artist: "BEGIN",
    description: "沖縄を代表するBEGINの名曲さぁ！イントロの三線のフレーズとサビの工工四をまとめて、初心者でも弾けるようにしたさぁ。",
    notes: [
      // Intro Part
      "五", "六", "工", "六", "五", "六", "工", "・",
      "五", "六", "工", "六", "五", "工", "五", "・",
      "四", "上", "中", "上", "四", "上", "中", "・",
      "中", "中", "中", "中", "上", "四", "合", "・",
      // Chorus section (僕が生まれたこの島の海を)
      "工", "工", "工", "工", "五", "六", "工", "五", 
      "五", "五", "五", "五", "四", "上", "中", "上",
      "中", "中", "中", "中", "上", "四", "合", "四"
    ]
  },
  {
    id: "shimauta",
    title: "島唄 (Shima Uta)",
    artist: "THE BOOM",
    description: "世界中で愛される島唄。おじぃイチオシのお手本さぁ！「デイゴの花が咲き、風を呼び嵐が来た」のなめらかで美しい主旋律を奏でるさぁ。",
    notes: [
      // Verse 1: デイゴの花が咲き
      "工", "工", "五", "六", "六", "五", "六", "五", "工", "・",
      // 風を呼び嵐が来た
      "工", "五", "六", "六", "五", "六", "五", "工", "工", "・",
      // 繰り返す哀しみは
      "五", "六", "七", "七", "七", "六", "七", "六", "五", "・",
      // 島わたる波のよう
      "五", "六", "工", "工", "五", "六", "五", "工"
    ]
  },
  {
    id: "basic_scale",
    title: "三線 基礎練習（勘所の上がり下がり）",
    artist: "比嘉おじぃの基本",
    description: "初心者が最初に覚える指慣らしの曲さぁ。合から九まで順に押さえて、一音一音キレイな響きを確認してみようねぇ。",
    notes: [
      "合", "乙", "老", "・", "四", "上", "中", "尺", "・",
      "工", "五", "六", "七", "八", "九", "・",
      "九", "八", "七", "六", "五", "工", "・",
      "尺", "中", "上", "四", "・", "老", "乙", "合"
    ]
  }
];

export default function SongSelector({
  onSelectSong,
  selectedSongId
}: SongSelectorProps) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"presets" | "upload" | "maker">("presets");

  // Load preset and custom songs from localStorage on boot
  useEffect(() => {
    const saved = localStorage.getItem("sanshin_custom_songs");
    let parsedCustom: Song[] = [];
    if (saved) {
      try {
        parsedCustom = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse custom songs", e);
      }
    }
    setSongs([...DEFAULT_SONGS, ...parsedCustom]);
    
    // Auto-select first song if none selected yet
    if (selectedSongId === "") {
      onSelectSong(DEFAULT_SONGS[0]);
    }
  }, []);

  // Sync state list and trigger callback on song change
  const selectSongById = (id: string) => {
    const matched = songs.find(s => s.id === id);
    if (matched) {
      onSelectSong(matched);
    }
  };

  // Extract Okinawan Kunkunshi characters using regex to allow easy custom parser
  const parseNotesText = (text: string): string[] => {
    // Regex for Okinawan characters & spaces / rests / dot
    const validChars = /[合乙老四上中尺工五六七八九休・]/;
    const parsed: string[] = [];
    for (const char of text) {
      if (validChars.test(char)) {
        parsed.push(char);
      } else if (char === " " || char === "　" || char === "\n" || char === ",") {
        // Map spacers or rests as dots if appropriate
        if (parsed.length > 0 && parsed[parsed.length - 1] !== "・") {
          parsed.push("・");
        }
      }
    }
    // Clean trailing dots
    return parsed.filter((c, i) => !(c === "・" && parsed[i + 1] === "・"));
  };

  // Save custom defined song helper
  const handleCreateCustomSong = (title: string, desc: string, notesRaw: string) => {
    if (!title.trim()) {
      setErrorMsg("楽譜のタイトルを入力してねぇ。");
      return;
    }
    const notesParsed = parseNotesText(notesRaw);
    if (notesParsed.length === 0) {
      setErrorMsg("工工四（合、乙、老、四、上、中、工、五、六、七など）が検出できなかったさぁ。テキストに入力してごらん。");
      return;
    }

    const newSong: Song = {
      id: "custom_" + Date.now(),
      title: title.trim(),
      artist: "ユーザ創作",
      description: desc.trim() || "自分で作成、またはアップロードした工工四楽譜さぁ。おじぃと一緒に一生懸命練習しようねぇ！",
      notes: notesParsed,
      isCustom: true
    };

    const saved = localStorage.getItem("sanshin_custom_songs");
    const parsedCustom: Song[] = saved ? JSON.parse(saved) : [];
    const updated = [...parsedCustom, newSong];
    localStorage.setItem("sanshin_custom_songs", JSON.stringify(updated));

    setSongs([...DEFAULT_SONGS, ...updated]);
    onSelectSong(newSong);

    // Reset fields
    setCustomTitle("");
    setCustomDescription("");
    setCustomNotes("");
    setErrorMsg("");
    setActiveTab("presets");
  };

  // Drag and Drop files of type .txt, .json or .csv
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      try {
        // Check if JSON Kunkunshi
        if (file.name.endsWith(".json")) {
          const parsed = JSON.parse(content);
          if (parsed.title && Array.isArray(parsed.notes)) {
            handleCreateCustomSong(parsed.title, parsed.description || "JSONからインポートした楽譜", parsed.notes.join(""));
            return;
          }
        }
        
        // Treat as raw text
        const titleFromFilename = file.name.replace(/\.[^/.]+$/, "");
        handleCreateCustomSong(titleFromFilename, "ファイルアップロードからおじぃが読み取った工工四さぁ！", content);
      } catch (err) {
        setErrorMsg("ファイルの読み込み、または解析に失敗してしまったさぁ。プレーンテキストでアップロードしてね。");
      }
    };
    reader.readAsText(file);
  };

  // Delete custom defined song
  const handleDeleteCustomSong = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("この楽譜を削除しても大丈夫ねぇ？")) return;

    const saved = localStorage.getItem("sanshin_custom_songs");
    const parsedCustom: Song[] = saved ? JSON.parse(saved) : [];
    const updated = parsedCustom.filter(s => s.id !== id);
    localStorage.setItem("sanshin_custom_songs", JSON.stringify(updated));

    const refreshed = [...DEFAULT_SONGS, ...updated];
    setSongs(refreshed);

    // If active was deleted, fall back to first song
    if (selectedSongId === id) {
      onSelectSong(refreshed[0]);
    }
  };

  return (
    <div id="song-selector-container" className="bg-slate-900/40 rounded-3xl p-6 border border-slate-700/50 shadow-2xl backdrop-blur-md">
      
      {/* Tab navigation */}
      <div className="flex border-b border-slate-800 mb-6 gap-2">
        <button
          onClick={() => { setActiveTab("presets"); setErrorMsg(""); }}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-medium transition-all duration-205 border-b-2 ${
            activeTab === "presets"
              ? "border-amber-500 text-amber-400"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          <BookOpen size={16} />
          <span>おじぃの唄本（既定曲）</span>
        </button>
        <button
          onClick={() => { setActiveTab("upload"); setErrorMsg(""); }}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-medium transition-all duration-205 border-b-2 ${
            activeTab === "upload"
              ? "border-amber-500 text-amber-400"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          <FileUp size={16} />
          <span>楽譜の読み込み (ファイル)</span>
        </button>
        <button
          onClick={() => { setActiveTab("maker"); setErrorMsg(""); }}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-medium transition-all duration-205 border-b-2 ${
            activeTab === "maker"
              ? "border-amber-500 text-amber-400"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          <Plus size={16} />
          <span>自分で工工四を作る</span>
        </button>
      </div>

      {/* Tabs inner */}
      {activeTab === "presets" && (
        <div className="space-y-4">
          <p className="text-xs text-slate-300">
            練習したい工工四楽譜を選択してねぇ。島人ぬ宝や島唄など、王道のプレイリストを用意しているさぁ。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
            {songs.map((song) => {
              const songMeta = song.notes.filter(n => n !== "・" && n !== "休");
              const isSelected = selectedSongId === song.id;
              
              return (
                <div
                  key={song.id}
                  onClick={() => selectSongById(song.id)}
                  className={`relative p-4 rounded-2xl border transition-all duration-250 cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "bg-amber-950/30 border-amber-500 shadow-lg shadow-amber-950/20"
                      : "bg-slate-950/30 border-slate-800 hover:border-slate-700 hover:bg-slate-950/50"
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h4 className="font-bold text-slate-100 flex items-center gap-1.5 text-sm md:text-base">
                        <Music className={`w-4 h-4 ${isSelected ? "text-amber-400" : "text-slate-400"}`} />
                        {song.title}
                      </h4>
                      {song.isCustom && (
                        <span className="text-[10px] bg-indigo-900/40 text-indigo-300 font-mono px-1.5 py-0.5 rounded border border-indigo-700">
                          カスタム
                        </span>
                      )}
                    </div>
                    {song.artist && (
                      <p className="text-xs text-amber-400/80 mb-2 font-medium">演奏：{song.artist}</p>
                    )}
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                      {song.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800/60 flex justify-between items-center">
                    <span className="text-[10px] text-gray-500 font-mono">
                      全 {song.notes.length} 小節・{songMeta.length} 音符
                    </span>
                    {song.isCustom && (
                      <button
                        onClick={(e) => handleDeleteCustomSong(song.id, e)}
                        className="text-red-400 hover:text-red-300 transition-colors p-1 rounded-md"
                        title="このカスタム楽譜を削除"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "upload" && (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-700 rounded-2xl p-6 bg-slate-950/30 text-center flex flex-col items-center justify-center">
            <FileUp size={36} className="text-amber-500 mb-3 animate-bounce" />
            <h4 className="font-bold text-slate-200 mb-1 text-sm md:text-base">工工四の楽譜ファイルをアップロード</h4>
            <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">
              工工四の文字（合 乙 老 四 上 中 尺 工 五 六 七 八 九）が含まれるテキストファイル（.txt）や、
              楽譜用のJSONデータをドラッグ＆ドロップ、またはファイル選択してね。おじぃが全自動でノートを取り出して練習用にするさぁ！
            </p>
            
            <input
              type="file"
              accept=".txt,.json"
              onChange={handleFileUpload}
              className="hidden"
              id="sanshin-file-picker"
            />
            <label
              htmlFor="sanshin-file-picker"
              className="cursor-pointer bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-slate-900 font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-amber-950/30 text-sm transition-all duration-200"
            >
              ファイルを選んで読み込む
            </label>
          </div>
          
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
            <h5 className="text-xs font-bold text-amber-200 mb-1 flex items-center gap-1">
              <AlertCircle size={13} />
              アップロード形式のコツ
            </h5>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              工工四と歌詞が混ざった一般的なブログ記事の下書きや歌詞テキストなどをそのまま読み込ませても大丈夫！おじぃのAI機能が、工工四の「工」「五」などの記号だけを自動で見つけて抽出するさぁ。
            </p>
          </div>
        </div>
      )}

      {activeTab === "maker" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">楽譜タイトル *</label>
                <input
                  type="text"
                  placeholder="例：安里屋ユンタ（サビ部分）"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">説明やコメント</label>
                <textarea
                  placeholder="例：安里屋ユンタのノリの良いサビさぁ。マタハーリヌチンダラカヌシャマ。"
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none resize-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">工工四を入力してね（自由に入力・スペースで小節区切り）</label>
              <textarea
                placeholder="例: 工 五 六 工 五 五 五 四 上 中 四 （ここにそのまま三線の記号を並べてね）"
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                rows={5}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none font-serif leading-relaxed"
              />
            </div>
          </div>

          {/* Quickly click-to-add notes helper pad */}
          <div className="pt-2">
            <span className="text-[11px] text-slate-400 block mb-1.5 font-medium">⚡️ クリックして工工四記号を追加：</span>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(KUNKUNSHI_MAP).map(noteChar => (
                <button
                  key={`btn-pad-${noteChar}`}
                  type="button"
                  onClick={() => setCustomNotes(prev => prev + noteChar + " ")}
                  className="bg-slate-950 hover:bg-stone-850 border border-slate-800 hover:border-amber-500/50 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg font-bold font-serif transition-all"
                >
                  {noteChar}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-800/60">
            <button
              onClick={() => handleCreateCustomSong(customTitle, customDescription, customNotes)}
              className="bg-amber-600 hover:bg-amber-500 text-slate-900 font-bold px-5 py-2 rounded-xl text-xs transition-colors flex items-center gap-1"
            >
              <Edit2 size={13} />
              <span>この工工四を追加するさぁ！</span>
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="mt-4 p-3 rounded-xl bg-red-950/30 text-red-300 border border-red-900/40 text-xs flex items-center gap-2">
          <span>⚠️ {errorMsg}</span>
        </div>
      )}
    </div>
  );
}
