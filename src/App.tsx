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
import { Sunset, HelpCircle, BookOpen, Volume2, Award } from "lucide-react";

export default function App() {
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
      <header className="relative bg-gradient-to-r from-amber-600 via-orange-600 to-indigo-950 py-10 px-6 border-b border-orange-500/30 overflow-hidden shadow-2xl">
        {/* Subtle Okinawan wave border overlay style */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-400/10 via-transparent to-transparent"></div>
        
        <div className="max-w-7xl mx-auto relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold tracking-widest text-yellow-300 uppercase bg-amber-950/60 px-2.5 py-1 rounded-full border border-yellow-500/30">
              <Sunset size={12} className="text-yellow-400 animate-spin-slow" />
              めんそーれ沖縄！三線特訓アプリ
            </span>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight font-serif drop-shadow-md">
              沖縄三線 工工四特訓 <span className="text-yellow-300">&</span> 比嘉おじぃのAIボイス指導
            </h1>
            <p className="text-xs md:text-sm text-amber-150/90 max-w-2xl font-medium leading-relaxed">
              あなたの三線の音色をマイクで聞き取り、工工四（楽譜）や指使い（勘所）をナビゲート！石垣島グランドマスター「比嘉おじぃ」があなたの弾き姿勢をテキストや合成音声で優しくアドバイスしてくれるさぁ。
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <div className="bg-slate-950/75 backdrop-blur-md border border-amber-500/30 rounded-2xl p-3 px-4 flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <div className="text-left">
                <p className="text-[10px] text-gray-400 block font-mono">ACTIVE TUNING</p>
                <p className="text-xs font-bold text-amber-400">{selectedTuning.id.toUpperCase()}: {selectedTuning.label}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative Wave Waveforms */}
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-[url('data:image/svg+xml;utf8,<svg viewBox=%220 0 1440 320%22 xmlns=%22http://www.w3.org/2000/svg%22><path fill=%22%23020617%22 d=%22M0,160L48,176C96,192,192,224,288,208C384,192,480,128,576,122.7C672,117,768,171,864,197.3C960,224,1056,224,1152,197.3C1248,171,1344,117,1392,90.7L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z%22></path></svg>')] bg-cover"></div>
      </header>

      {/* Main Section */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 mt-8">
        
        {/* Help Banner Information */}
        <div id="kunkunshi-helper-banner" className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80 flex gap-3 items-start">
            <div className="bg-amber-950/60 p-2.5 rounded-xl border border-amber-500/30 text-amber-400">
              <BookOpen size={18} />
            </div>
            <div>
              <h4 className="font-bold text-slate-200 text-sm">工工四（くんくんしー）とは？</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                沖縄伝統の三線用ハングル・楽譜表記です。漢字一文字が「抑えるべき指の位置（勘所/弦）」をダイレクトに示しているさぁ。
              </p>
            </div>
          </div>

          <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80 flex gap-3 items-start">
            <div className="bg-amber-950/60 p-2.5 rounded-xl border border-amber-500/30 text-amber-400">
              <Volume2 size={18} />
            </div>
            <div>
              <h4 className="font-bold text-slate-200 text-sm">どうやって音程を合わせるさぁ？</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                初心者用としては「4のちぃ（C-F-C）」や「6のちぃ（D-G-D）」が一般的。調弦ゲージを見ながらカラクイ（糸巻き）を締めたり緩めたりしてねぇ。
              </p>
            </div>
          </div>

          <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80 flex gap-3 items-start">
            <div className="bg-amber-950/60 p-2.5 rounded-xl border border-amber-500/30 text-amber-400">
              <span className="text-lg">👴</span>
            </div>
            <div>
              <h4 className="font-bold text-slate-200 text-sm">AI比嘉おじぃの生きたレッスン</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                ただの機械判定じゃないさぁ！沖縄民謡に携わって数十年の比嘉おじぃが、あなたのピッチのズレや指移動のアドバイスを愛を込めてしゃべってくれるよ。
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic App Layout Bento Box */}
        <div id="sanshin-bento-grid" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column (6 Cols) - Selection and AI Advisor */}
          <div className="lg:col-span-6 space-y-6 flex flex-col justify-stretch">
            {/* Song Selector */}
            <SongSelector
              onSelectSong={setSelectedSong}
              selectedSongId={selectedSong.id}
            />

            {/* AI Advisor speech box */}
            <AiAdvisor
              activeSong={selectedSong}
              practiceStats={practiceStats}
            />
          </div>

          {/* Right Column (6 Cols) - Musical Stream / Pitch Recognizer & Fretboard */}
          <div className="lg:col-span-6 space-y-6 flex flex-col justify-stretch1">
            {/* Audio Tuner & Practice Stream Tape */}
            <Tuner
              activeSong={selectedSong}
              onSelectTuning={setSelectedTuning}
              selectedTuning={selectedTuning}
              onNoteTrackingUpdate={(note, matches, play) => {
                setDetectedChar(note);
                setIsNoteMatched(matches);
              }}
              onPracticeSessionUpdate={(stats) => {
                setPracticeStats(stats);
              }}
            />

            {/* Graphic Fingerboard / Fretboard Guide */}
            <SanshinFretboard
              currentTargetChar={selectedSong.notes && selectedSong.notes.length > 0 ? selectedSong.notes[practiceStats.correctCount >= selectedSong.notes.length ? selectedSong.notes.length - 1 : practiceStats.correctCount] : ""}
              detectedChar={detectedChar}
            />
          </div>

        </div>

      </main>

      {/* Decorative Traditional Okinawan Minser Pattern Footer (いつの世までも、いっしょに。) */}
      <footer className="mt-20 border-t border-slate-900 pt-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center justify-center gap-4">
          
          {/* Okinawan Minser Symbol representation */}
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
