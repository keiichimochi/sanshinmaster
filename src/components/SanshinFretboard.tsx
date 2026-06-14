import React from "react";
import { KUNKUNSHI_MAP, KunkunshiMeta } from "../types";

interface SanshinFretboardProps {
  currentTargetChar: string; // The note they are supposed to play
  detectedChar: string;      // The note they are currently playing
}

export default function SanshinFretboard({
  currentTargetChar,
  detectedChar
}: SanshinFretboardProps) {
  
  // Organized finger positions along the neck from top (nut) to bottom (body)
  // Distance percentages from standard fingerboards to give an authentic vertical perspective
  const positions = [
    { label: "開放音", desc: "（押さえない・開放）", percent: 8 },
    { label: "一の勘所", desc: "（乙・上・五）", percent: 25, fingerIndex: 1 },
    { label: "二の勘所", desc: "（老・中・六）", percent: 45, fingerIndex: 2 },
    { label: "三の勘所", desc: "（尺・七）", percent: 62, fingerIndex: 3 },
    { label: "四の勘所", desc: "（八）", percent: 78, fingerIndex: 4 },
    { label: "五の勘所", desc: "（九）", percent: 90, fingerIndex: 5 },
  ];

  // Strings from left to right on standard playing view: Low (男弦), Middle (中弦), High (女弦)
  const strings = [
    { name: "男弦 (Low)", color: "border-amber-700", notes: ["合", "乙", "老"], index: 0 },
    { name: "中弦 (Mid)", color: "border-amber-600", notes: ["四", "上", "中", "尺"], index: 1 },
    { name: "女弦 (High)", color: "border-amber-500", notes: ["工", "五", "六", "七", "八", "九"], index: 2 }
  ];

  // Helper to match meta info to render on positions
  const getNoteForPositionAndString = (stringIndex: number, fingerIndex: number): KunkunshiMeta | null => {
    for (const key of Object.keys(KUNKUNSHI_MAP)) {
      const meta = KUNKUNSHI_MAP[key];
      if (meta.stringIndex === stringIndex && meta.fingerIndex === fingerIndex) {
        return meta;
      }
    }
    return null;
  };

  return (
    <div id="sanshin-fretboard-container" className="bg-slate-900/40 rounded-3xl p-6 border border-slate-700/50 shadow-2xl backdrop-blur-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-amber-100 flex items-center gap-2">
          <span>🎸 リアルタイム指使い・勘所（かんどころ）表示</span>
        </h3>
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-gray-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse border border-amber-300"></span>
            お手本
          </span>
          <span className="flex items-center gap-1.5 text-gray-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border border-emerald-300"></span>
            現在検出中
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-300 mb-6 leading-relaxed">
        三線はフレットがないため、比嘉おじぃの言う<strong>「勘所」</strong>を正確に押さえるのがコツです。以下は棹（棹）を上から覗き込んだ様子です。お手本マークの場所を左手で押さえ、右手で弦を弾くさぁ！
      </p>

      {/* Main Wooden Neck Graphic */}
      <div className="relative flex justify-center py-6 px-2 bg-gradient-to-b from-stone-900 via-neutral-900 to-amber-950/40 rounded-2xl overflow-hidden border border-amber-900/30">
        
        {/* Nut (Kara-kui position at top) */}
        <div className="absolute top-0 left-0 right-0 h-4 bg-stone-950 border-b-2 border-amber-800 flex items-center justify-center">
          <div className="w-1/2 h-1.5 bg-yellow-600/60 rounded-full"></div>
        </div>

        {/* Traditional Okinawan Red/Black accent vertical rail */}
        <div className="absolute left-6 top-12 bottom-12 w-2 bg-red-800/30 rounded-full"></div>
        <div className="absolute right-6 top-12 bottom-12 w-2 bg-red-800/30 rounded-full"></div>

        {/* Visual neck body block */}
        <div className="relative w-72 md:w-80 h-[500px] bg-gradient-to-r from-stone-850 via-stone-800 to-stone-850 rounded-lg shadow-inner flex border-x border-stone-700/30">
          
          {/* Background horizontal position stripes for guidance */}
          {positions.map((pos, pIdx) => (
            <div 
              key={`line-${pIdx}`}
              className="absolute left-0 right-0 border-t border-dashed border-stone-800/80 flex items-center justify-between px-3 text-[10px] text-gray-500 pointer-events-none"
              style={{ top: `${pos.percent}%` }}
            >
              <span>{pos.label}</span>
              <span className="opacity-40">{pos.desc}</span>
            </div>
          ))}

          {/* Strings and notes layout */}
          <div className="flex w-full justify-around items-stretch relative">
            {strings.map((str, sIdx) => (
              <div 
                key={`string-${sIdx}`}
                className="relative flex flex-col items-center justify-between w-1/3 pt-4 pb-8"
              >
                {/* Visual String Line (White/Yellow Okinawan Style Strings) */}
                <div 
                  className={`absolute top-0 bottom-0 w-1 border-r shadow-[0_0_8px_rgba(251,191,36,0.3)] pointer-events-none z-0 ${
                    sIdx === 0 ? "border-amber-100 h-full opacity-90 scale-x-125" : 
                    sIdx === 1 ? "border-amber-200/90 h-full scale-x-105" : 
                    "border-amber-300 h-full"
                  }`}
                  style={{ left: "50%", transform: "translateX(-50%)" }}
                />

                {/* String string headers */}
                <span className="absolute -top-3 text-[10px] bg-stone-900 px-1 rounded border border-slate-700 text-stone-300 uppercase z-10 font-mono">
                  {sIdx === 0 ? "男 (C)" : sIdx === 1 ? "中 (F)" : "女 (C)"}
                </span>

                {/* Active note points along the string */}
                {positions.map((pos) => {
                  const hasNote = getNoteForPositionAndString(str.index, pos.fingerIndex ?? 0);
                  if (!hasNote) return <div key={`empty-${pos.label}`} className="h-6" />;

                  const isTarget = currentTargetChar === hasNote.char;
                  const isDetected = detectedChar === hasNote.char;

                  return (
                    <div 
                      key={`note-${hasNote.char}`} 
                      className="absolute flex items-center justify-center z-10" 
                      style={{ top: `${pos.percent}%`, transform: "translateY(-50%)" }}
                    >
                      {/* Interactive indicator circle */}
                      <div 
                        className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 cursor-help group ${
                          isTarget && isDetected 
                            ? "bg-gradient-to-br from-emerald-500 to-amber-500 scale-125 shadow-lg shadow-emerald-500/50 animate-bounce"
                            : isTarget
                              ? "bg-amber-600 text-amber-50 border-2 border-yellow-300 animate-pulse scale-110 shadow-lg shadow-yellow-500/40"
                              : isDetected
                                ? "bg-emerald-600 text-emerald-50 border-2 border-emerald-300 scale-110 shadow-lg shadow-emerald-500/40"
                                : "bg-zinc-800 text-gray-400 border border-zinc-700 hover:bg-stone-700 hover:text-white"
                        }`}
                        title={`${hasNote.char} (${hasNote.english})`}
                      >
                        <span className="text-sm font-bold font-serif">{hasNote.char}</span>

                        {/* Note Detail Info Bubble on Hover */}
                        <div className="absolute top-10 hidden group-hover:flex flex-col items-center bg-zinc-950 text-white text-[10px] p-2 rounded-md shadow-xl border border-zinc-700 whitespace-nowrap z-50 pointer-events-none">
                          <p className="font-bold">{hasNote.char} ({hasNote.english})</p>
                          <p className="text-amber-400">{str.name}</p>
                          <p className="text-gray-400">{pos.label}</p>
                        </div>

                        {/* Visual Ping Waves for active matches */}
                        {isTarget && (
                          <span className="absolute top-0 left-0 w-full h-full rounded-full bg-amber-400 opacity-20 animate-ping border border-amber-300"></span>
                        )}
                        {isDetected && (
                          <span className="absolute top-0 left-0 w-full h-full rounded-full bg-emerald-400 opacity-20 animate-ping border border-emerald-300"></span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Visual Okinawan design footer */}
      <div className="mt-4 flex justify-between text-[11px] text-slate-400 px-3 py-2 bg-slate-950/40 rounded-lg">
        <span>※ 工工四（くんくんしー）は上（低音）から下にむけて弾きます</span>
        <span className="text-amber-500/80">唄、奏でる喜びを。</span>
      </div>
    </div>
  );
}
