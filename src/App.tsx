/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Song, ChiiTuning, TUNINGS } from "./types";
import SongSelector from "./components/SongSelector";
import Tuner from "./components/Tuner";
import SanshinFretboard from "./components/SanshinFretboard";
import AiAdvisor from "./components/AiAdvisor";
import { Sunset, BookOpen, Volume2, Music, Sparkles, Sliders } from "lucide-react";

type MainTab = "songs" | "practice" | "advisor";

export default function App() {
  // Navigation tabs state
  const [activeTab, setActiveTab] = useState<MainTab>("songs");

  // Global active state declarations
  const [selectedSong, setSelectedSong] = useState<Song>({
    id: "",
    title: "",
    description: "",
    notes: []
  });
  
  const [selectedTuning, setSelectedTuning] = useState<ChiiTuning>(TUNINGS[2]); // Default: 6chii (D-G-D)
  const [detectedChar, setDetectedChar] = useState<string>("");
  const [isNoteMatched, setIsNoteMatched] = useState<boolean>(false);

  // Stats gathered from practicing to feed into Gemini 3.5 Flash advisor
  const [practiceStats, setPracticeStats] = useState({
    correctCount: 0,
    flatCount: 0,
    sharpCount: 0,
    difficultyNotes: [] as string[],
    score: 0
  });

  return (
    <div id="sanshin-training-app" className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12 selection:bg-amber-500 selection:text-slate-900">
      
      {/* Visual Okinawan Sunset Wave Header */}
      <header className="relative bg-gradient-to-r from-amber-600 via-orange-600 to-indigo-950 py-8 px-6 border-b border-orange-500/30 overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-400/10 via-transparent to-transparent"></div>
        
        <div className="max-w-7xl mx-auto relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-widest text-yellow-300 uppercase bg-amber-950/60 px-2.5 py-1 rounded-full border border-yellow-500/30">
              <Sunset size={11} className="text-yellow-400" />
              めんそーれ沖縄！三線特訓アプリ
            </span>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight font-serif drop-shadow-md">
              沖縄三線 工工四特訓 <span className="text-yellow-300">&</span> 比嘉おじぃのAI指導
            </h1>
            <p className="text-xs text-amber-150/90 max-w-xl font-medium leading-relaxed">
              ごちゃごちゃしないよう機能をスッキリ整えたさぁ。まずは「唄を選ぶ」から好きな曲を選択して練習を始めてねぇ！
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <div className="bg-slate-950/75 backdrop-blur-md border border-amber-500/30 rounded-2xl p-2.5 px-3.5 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <div className="text-left">
                <p className="text-[9px] text-gray-500 block font-mono">ACTIVE TUNING</p>
                <p className="text-xs font-bold text-amber-400">{selectedTuning.id.toUpperCase()}: {selectedTuning.label}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-4 bg-[url('data:image/svg+xml;utf8,<svg viewBox=%220 0 1440 320%22 xmlns=%22http://www.w3.org/2000/svg%22><path fill=%22%23020617%22 d=%22M0,160L48,176C96,192,192,224,288,208C384,192,480,128,576,122.7C672,117,768,171,864,197.3C960,224,1056,224,1152,197.3C1248,171,1344,117,1392,90.7L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z%22></path></svg>')] bg-cover"></div>
      </header>

      {/* Main Section */}
      <main className="max-w-5xl mx-auto px-4 md:px-6 mt-6">
        
        {/* Simple Dashboard Status Summary Card */}
        <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500/10 text-amber-400 p-2 rounded-xl border border-amber-500/20">
              <Music size={18} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 block font-semibold">選択中の曲</p>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                {selectedSong.title || "ロード中..."}
                {selectedSong.artist && <span className="text-xs text-amber-500 font-normal">({selectedSong.artist})</span>}
              </h3>
            </div>
          </div>

          {/* Core progress indicator */}
          <div className="flex gap-6 text-xs text-slate-300">
            <div>
              <span className="text-gray-500 text-[10px] block font-bold">練習進捗</span>
              <span className="font-mono font-bold text-slate-200">
                {practiceStats.correctCount} / {selectedSong.notes?.length || 0} 音 ({Math.round(((practiceStats.correctCount / (selectedSong.notes?.length || 1)) * 100)) || 0}%)
              </span>
            </div>
            <div>
              <span className="text-gray-500 text-[10px] block font-bold">名音率</span>
              <span className="font-mono font-bold text-emerald-400">{practiceStats.score}%</span>
            </div>
          </div>
        </div>

        {/* Core Tab Switcher Navigation */}
        <div className="flex border-b border-slate-800 mb-6 gap-2">
          <button
            onClick={() => setActiveTab("songs")}
            className={`flex items-center gap-2 pb-3.5 px-5 text-sm font-bold transition-all duration-200 border-b-2 outline-none ${
              activeTab === "songs"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <BookOpen size={16} />
            <span>1. 曲を選ぶ・楽譜</span>
          </button>
          
          <button
            onClick={() => setActiveTab("practice")}
            className={`flex items-center gap-2 pb-3.5 px-5 text-sm font-bold transition-all duration-200 border-b-2 outline-none ${
              activeTab === "practice"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <Sliders size={16} />
            <span>2. 特訓する・指使い</span>
          </button>
          
          <button
            onClick={() => setActiveTab("advisor")}
            className={`flex items-center gap-2 pb-3.5 px-5 text-sm font-bold transition-all duration-200 border-b-2 outline-none ${
              activeTab === "advisor"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <span className="text-xs">👴</span>
            <span>3. 比嘉おじぃのAI指導</span>
            {practiceStats.correctCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            )}
          </button>
        </div>

        {/* Tab Display Area with Smooth transitions concept */}
        <div className="transition-all duration-300">
          
          {/* TAB 1: Song Selection & Score upload */}
          {activeTab === "songs" && (
            <div className="space-y-6 animate-fade-in">
              <SongSelector
                onSelectSong={(song) => {
                  setSelectedSong(song);
                  // Auto-switch tab to practice to make the flow natural & comfortable
                  setActiveTab("practice");
                }}
                selectedSongId={selectedSong.id}
              />
              
              <div className="bg-slate-900/20 border border-slate-800/80 p-5 rounded-2xl flex items-start gap-3.5">
                <div className="text-amber-400 shrink-0 mt-0.5">
                  <Sparkles size={16} />
                </div>
                <div className="text-xs text-slate-400 leading-relaxed">
                  <strong className="text-slate-200 block mb-1">おじぃからのアドバイス：</strong>
                  「島人ぬ宝」や「島唄」など初心者練習用の楽譜がたくさん入っているさぁ。新しく楽譜ファイル（テキスト）をドラッグして読み込ませることもできるから、いろいろ試してみると楽しいよ。曲を選んだら、すぐに特訓タブで三線を持とうね！
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Pitch Detection Tuner & Neck Finger guide */}
          {activeTab === "practice" && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* Main pitch detection and score scroll sequence (7 Columns) */}
                <div className="md:col-span-8 space-y-6">
                  <Tuner
                    activeSong={selectedSong}
                    onSelectTuning={setSelectedTuning}
                    selectedTuning={selectedTuning}
                    onNoteTrackingUpdate={(note, matches) => {
                      setDetectedChar(note);
                      setIsNoteMatched(matches);
                    }}
                    onPracticeSessionUpdate={(stats) => {
                      setPracticeStats(stats);
                    }}
                  />
                </div>

                {/* Vertical fretboard graphic mapping finger placements (4 Columns) */}
                <div className="md:col-span-4">
                  <SanshinFretboard
                    currentTargetChar={selectedSong.notes && selectedSong.notes.length > 0 ? selectedSong.notes[practiceStats.correctCount >= selectedSong.notes.length ? selectedSong.notes.length - 1 : practiceStats.correctCount] : ""}
                    detectedChar={detectedChar}
                  />
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: Grandpa's AI Advice with Synthesis Voice */}
          {activeTab === "advisor" && (
            <div className="space-y-6 animate-fade-in">
              <AiAdvisor
                activeSong={selectedSong}
                practiceStats={practiceStats}
              />
            </div>
          )}

        </div>

      </main>

      {/* Traditional Okinawan Minser Pattern Footer (いつの世までも、いっしょに。) */}
      <footer className="mt-20 border-t border-slate-900 pt-8 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col items-center justify-center gap-4">
          
          <div className="flex items-center gap-3 select-none py-1.5 px-3 bg-slate-900/60 rounded-xl border border-slate-800">
            <span className="text-amber-500 tracking-wider font-mono">⬛ ⬛ ⬛ ⬛</span>
            <span className="text-gray-600 font-bold text-[10px] tracking-widest uppercase">いつの世までも末長く。</span>
            <span className="text-amber-500 tracking-wider font-mono">⬛ ⬛ ⬛ ⬛ ⬛</span>
          </div>

          <p>© 2026 沖縄三線 工工四特訓・AI比嘉おじぃマスターギルド. Developed in Google AI Studio Build with pride.</p>
        </div>
      </footer>
    </div>
  );
}

