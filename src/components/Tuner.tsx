import React, { useState, useEffect, useRef } from "react";
import { ChiiTuning, TUNINGS, KUNKUNSHI_MAP, KunkunshiMeta, Song, TrackedPlay } from "../types";
import { Volume2, VolumeX, Mic, Compass, Play, RotateCcw, Award, Sparkles, AlertCircle } from "lucide-react";

interface TunerProps {
  activeSong: Song;
  onSelectTuning: (tuning: ChiiTuning) => void;
  selectedTuning: ChiiTuning;
  onNoteTrackingUpdate: (detectedNote: string, isMatched: boolean, trackedPlay?: TrackedPlay) => void;
  onPracticeSessionUpdate: (stats: {
    correctCount: number;
    flatCount: number;
    sharpCount: number;
    difficultyNotes: string[];
    score: number;
  }) => void;
}

export default function Tuner({
  activeSong,
  onSelectTuning,
  selectedTuning,
  onNoteTrackingUpdate,
  onPracticeSessionUpdate
}: TunerProps) {
  // Mic and audio context refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // App UI State
  const [isPlaying, setIsPlaying] = useState(false);
  const [micError, setMicError] = useState("");
  const [liveFreq, setLiveFreq] = useState<number | null>(null);
  const [detectedNote, setDetectedNote] = useState<KunkunshiMeta | null>(null);
  const [centsOffset, setCentsOffset] = useState<number>(0);
  const [isNotePerfect, setIsNotePerfect] = useState(false);

  // Practice controller state
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceHistory, setPracticeHistory] = useState<TrackedPlay[]>([]);
  const [practiceCompleted, setPracticeCompleted] = useState(false);
  
  // Stats tracking for AI Advisor
  const [correctCount, setCorrectCount] = useState(0);
  const [flatCount, setFlatCount] = useState(0);
  const [sharpCount, setSharpCount] = useState(0);
  const [wrongNotes, setWrongNotes] = useState<{ [key: string]: number }>({});

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync tuning on select
  const handleTuningChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const matched = TUNINGS.find(t => t.id === e.target.value);
    if (matched) {
      onSelectTuning(matched);
      resetPractice();
    }
  };

  // Reset practice tracking session
  const resetPractice = () => {
    setPracticeIndex(0);
    setPracticeHistory([]);
    setPracticeCompleted(false);
    setCorrectCount(0);
    setFlatCount(0);
    setSharpCount(0);
    setWrongNotes({});
    onPracticeSessionUpdate({
      correctCount: 0,
      flatCount: 0,
      sharpCount: 0,
      difficultyNotes: [],
      score: 0
    });
  };

  // Reset when song changes
  useEffect(() => {
    resetPractice();
  }, [activeSong]);

  // Clean active pitch tracker on unmount
  useEffect(() => {
    return () => {
      stopMic();
    };
  }, []);

  // Initialize Mic stream
  const startMic = async () => {
    try {
      setMicError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048; // perfect window for 130Hz - 440Hz detection
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      setIsPlaying(true);
      detectPitchLoop();
    } catch (err: any) {
      console.error(err);
      setMicError("マイクの使用許可が得られませんでした。ブラウザのマイク設定をオンにしてください。");
      setIsPlaying(false);
    }
  };

  const stopMic = () => {
    setIsPlaying(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
    }
    setLiveFreq(null);
    setDetectedNote(null);
    setCentsOffset(0);
    setIsNotePerfect(false);
  };

  // High quality adaptive autocorrelation pitch finder
  // Designed to easily pick up string vibration and filter harmonic duplication
  const autoCorrelate = (buffer: Float32Array, sampleRate: number): number => {
    const SIZE = buffer.length;
    let rms = 0;

    // Detect signal volume
    for (let i = 0; i < SIZE; i++) {
      const val = buffer[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.008) {
      return -1; // Volume too low
    }

    // Clip low amplitude noise out
    let r1 = 0;
    let r2 = SIZE - 1;
    const thres = 0.15;
    for (let i = 0; i < SIZE / 2; i++) {
      if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
    }
    for (let i = SIZE - 1; i >= SIZE / 2; i--) {
      if (Math.abs(buffer[i]) < thres) { r2 = i; break; }
    }

    const buf = buffer.subarray(r1, r2);
    const len = buf.length;

    const correlations = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      for (let j = 0; j < len - i; j++) {
        correlations[i] += buf[j] * buf[j + i];
      }
    }

    // Find first local minimum after zero-lag peak
    let d = 0;
    while (correlations[d] > correlations[d + 1]) d++;
    
    let maxval = -1;
    let maxpos = -1;
    for (let i = d; i < len; i++) {
      if (correlations[i] > maxval) {
        maxval = correlations[i];
        maxpos = i;
      }
    }

    let T0 = maxpos;
    if (T0 < 0) return -1;

    // Parabolic interpolation for fine tuning frequency float representation
    const x1 = correlations[T0 - 1];
    const x2 = correlations[T0];
    const x3 = correlations[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a) {
      T0 = T0 - b / (2 * a);
    }

    return sampleRate / T0;
  };

  // Map frequency dynamically to standard Okinawan scale notes relative to current Male open (合)
  const mapFrequencyToKunkunshi = (freq: number, tuning: ChiiTuning): { meta: KunkunshiMeta; cents: number } | null => {
    const maleOpenFreq = tuning.maleFreq; // e.g. 146.83 Hz for 6chii (D)
    
    // Low frequency boundary
    if (freq < maleOpenFreq * 0.8) return null;
    
    // Semitones difference
    const semitonesFromRoot = 12 * Math.log2(freq / maleOpenFreq);
    const roundedSemitones = Math.round(semitonesFromRoot);
    const cents = Math.round((semitonesFromRoot - roundedSemitones) * 100);

    // Find best match in KUNKUNSHI_MAP matching semitonesFromMaleOpen
    let bestNoteMeta: KunkunshiMeta | null = null;
    let minDiff = 1000;

    for (const key of Object.keys(KUNKUNSHI_MAP)) {
      const meta = KUNKUNSHI_MAP[key];
      if (meta.semitonesFromMaleOpen === -1) continue;

      const diff = Math.abs(roundedSemitones - meta.semitonesFromMaleOpen);
      if (diff < minDiff && diff <= 1) { // must be within 1 semitone
        minDiff = diff;
        bestNoteMeta = meta;
      }
    }

    if (bestNoteMeta) {
      return { meta: bestNoteMeta, cents };
    }

    return null;
  };

  // Main drawing loop + audio analyser loop
  const detectPitchLoop = () => {
    if (!analyserRef.current || !isPlaying) return;

    const bufferLength = analyserRef.current.fftSize;
    const dataArray = new Float32Array(bufferLength);
    analyserRef.current.getFloatTimeDomainData(dataArray);

    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    const frequency = autoCorrelate(dataArray, sampleRate);

    // Draw raw waveform to canvas
    drawWaveform(dataArray);

    if (frequency > 0 && frequency < 1000) {
      setLiveFreq(Math.round(frequency * 10) / 10);
      
      const match = mapFrequencyToKunkunshi(frequency, selectedTuning);
      if (match) {
        setDetectedNote(match.meta);
        setCentsOffset(match.cents);

        // A pitch is perfectly in-tune if within -15 to +15 cents
        const isPerfect = Math.abs(match.cents) <= 15;
        setIsNotePerfect(isPerfect);

        // Practice check: are they playing the current target note?
        const targetChar = activeSong.notes[practiceIndex];
        
        // Skip dots or rests immediately on sequence
        if (targetChar === "・" || targetChar === "休") {
          advancePractice(targetChar, "correct", frequency, 0);
        } else if (match.meta.char === targetChar) {
          // They matches! We require them to sustain for perfect tuning
          if (isPerfect) {
            advancePractice(targetChar, "correct", frequency, match.cents);
          }
        } else {
          // Keeps track of wrong note plucked to suggest finger adjustments in AI Advice
          const isSharp = match.cents > 15;
          const status = isSharp ? "sharp" : "flat";
          
          // Small debounce tracker to register attempt
          if (Math.random() < 0.15) { // sub-selected statistics sample
            recordFailedAttempt(targetChar, match.meta.char, status, frequency, match.cents);
          }
        }

        onNoteTrackingUpdate(match.meta.char, match.meta.char === targetChar, {
          timestamp: Date.now(),
          targetChar: targetChar,
          playedPitch: frequency,
          playedCentsOffset: match.cents,
          status: match.meta.char === targetChar ? "correct" : (match.cents > 0 ? "sharp" : "flat"),
          detectedKunkunshi: match.meta.char
        });

      } else {
        setDetectedNote(null);
        setCentsOffset(0);
        setIsNotePerfect(false);
      }
    } else {
      setLiveFreq(null);
      setDetectedNote(null);
      setCentsOffset(0);
      setIsNotePerfect(false);
    }

    animationFrameRef.current = requestAnimationFrame(detectPitchLoop);
  };

  // record failed plucks to populate AI advisor dataset
  const recordFailedAttempt = (target: string, played: string, direction: "sharp" | "flat", pitch: number, cents: number) => {
    setWrongNotes(prev => {
      const next = { ...prev };
      next[played] = (next[played] || 0) + 1;
      return next;
    });

    if (direction === "sharp") {
      setSharpCount(c => c + 1);
    } else {
      setFlatCount(c => c + 1);
    }

    // Append to stats
    onPracticeSessionUpdate({
      correctCount,
      flatCount: flatCount + (direction === "flat" ? 1 : 0),
      sharpCount: sharpCount + (direction === "sharp" ? 1 : 0),
      difficultyNotes: Object.keys(wrongNotes),
      score: Math.round((correctCount / (practiceIndex + 1)) * 100)
    });
  };

  // Move visual timeline cursor forward in practice
  const advancePractice = (note: string, status: "correct", pitch: number, cents: number) => {
    if (practiceCompleted) return;

    // Visual tracking record
    const play: TrackedPlay = {
      timestamp: Date.now(),
      targetChar: note,
      playedPitch: pitch,
      playedCentsOffset: cents,
      status: "correct",
      detectedKunkunshi: note
    };

    const nextHistory = [...practiceHistory, play];
    setPracticeHistory(nextHistory);

    const nextIndex = practiceIndex + 1;
    const nextCorrect = correctCount + 1;
    setCorrectCount(nextCorrect);

    // Communicate up to state
    const currentScore = Math.round((nextCorrect / nextIndex) * 100);
    onPracticeSessionUpdate({
      correctCount: nextCorrect,
      flatCount,
      sharpCount,
      difficultyNotes: Object.keys(wrongNotes),
      score: currentScore
    });

    if (nextIndex >= activeSong.notes.length) {
      setPracticeCompleted(true);
      setPracticeIndex(activeSong.notes.length - 1);
    } else {
      setPracticeIndex(nextIndex);
      
      // Auto-jump over dots ("・") and rests ("休") immediately to keep note plucks smooth
      const nextChar = activeSong.notes[nextIndex];
      if (nextChar === "・" || nextChar === "休") {
        setTimeout(() => {
          advancePractice(nextChar, "correct", 0, 0);
        }, 320);
      }
    }
  };

  // Waveform visualization drawer
  const drawWaveform = (data: Float32Array) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    
    // Draw subtle glowing audio container grid
    ctx.strokeStyle = "rgba(245, 158, 11, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Draw active amplitude wavelength
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = isNotePerfect 
      ? "rgba(16, 185, 129, 0.85)" // Emerald in-tune
      : liveFreq 
        ? "rgba(245, 158, 11, 0.85)" // Gold plucking
        : "rgba(156, 163, 175, 0.35)"; // Gray ambient

    const sliceWidth = width / data.length;
    let x = 0;

    for (let i = 0; i < data.length; i++) {
      const v = data[i] * 1.5; // Boost magnitude visuals
      const y = (v * height / 2) + height / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();
  };

  return (
    <div id="sanshin-pitch-tuner-container" className="bg-slate-900/40 rounded-3xl p-6 border border-slate-700/50 shadow-2xl backdrop-blur-md">
      
      {/* Upper selector tuning controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <h3 className="text-xl font-bold bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent flex items-center gap-2">
            <span>🎤 リアルタイム音程解析・特訓ゲージ</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            マイクをオンにして弾くと、鳴らした音と一致する工工四（くんくんしー）が光るさぁ。
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label className="text-xs font-semibold text-slate-300">調弦 (ちぃ/キー):</label>
          <select
            value={selectedTuning.id}
            onChange={handleTuningChange}
            className="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-1.5 text-xs text-amber-300 focus:outline-none"
          >
            {TUNINGS.map((tuning) => (
              <option key={tuning.id} value={tuning.id}>
                {tuning.id.toUpperCase()}: {tuning.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {apiIndicatorOrError()}

      {/* Grid of Tuner Gauges & Practice timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Needle Cent Gauges (4 Columns) */}
        <div className="lg:col-span-4 flex flex-col justify-between p-5 bg-slate-950/40 rounded-2xl border border-slate-800 text-center relative overflow-hidden">
          
          <div className="z-10">
            <span className="text-[10px] text-gray-500 tracking-wider block font-mono">TUNER PITCH GAUGE</span>
            
            {/* Real-time Frequency numerical displays */}
            {liveFreq ? (
              <div className="my-2 animate-pulse">
                <span className="text-4xl font-black text-amber-400 tracking-tight font-mono">{detectedNote ? detectedNote.char : "?"}</span>
                <span className="text-[10px] text-gray-400 block font-mono mt-1">{liveFreq} Hz</span>
              </div>
            ) : (
              <div className="my-2 text-slate-500">
                <span className="text-4xl font-bold tracking-tight">--</span>
                <span className="text-[10px] block mt-1">無音（plucking...）</span>
              </div>
            )}
          </div>

          {/* Visual Round Needle Meter */}
          <div className="relative h-20 w-full flex items-center justify-center my-2">
            
            {/* Interactive Semi-circle Dial indicator */}
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-slate-800 rounded-full"></div>
            
            {/* Cents guidelines */}
            <span className="absolute left-1 bottom-3 text-[9px] text-slate-500">-50c (低)</span>
            <span className="absolute right-1 bottom-3 text-[9px] text-slate-500">+50c (高)</span>
            <span className="absolute left-1/2 -translate-x-1/2 bottom-3 text-[9px] text-emerald-500 font-bold">● ジャスト</span>

            {/* Simulated Hand pointer needle */}
            <div 
              className={`absolute bottom-0 w-0.5 h-16 origin-bottom transform transition-all duration-150 ${
                isNotePerfect ? "bg-emerald-500 h-16 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-amber-600"
              }`}
              style={{ 
                left: "49.5%", 
                transform: `rotate(${liveFreq ? Math.max(-60, Math.min(60, centsOffset * 1.2)) : 0}deg)` 
              }}
            />
            
            {/* Center Pin peg */}
            <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-slate-200 z-10 border border-slate-800"></div>
          </div>

          {/* Helper feedback text */}
          <div className="text-xs bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 z-10">
            {detectedNote ? (
              <p className="text-slate-300 leading-snug">
                {isNotePerfect ? (
                  <span className="text-emerald-400 font-semibold">上等（ピッタリ）さぁ！合格！</span>
                ) : centsOffset < 0 ? (
                  <span className="text-amber-500">少し<strong>【音が低い（フラット）】</strong>さぁ。指を胴にちょっと寄せて。</span>
                ) : (
                  <span className="text-amber-500">少し<strong>【音が高い（シャープ）】</strong>さぁ。指を歌口に向けて緩めて。</span>
                )}
              </p>
            ) : (
              <p className="text-gray-500">三線の弦を弾いてみてね。調弦（チューニング）にも使えるよ！</p>
            )}
          </div>

          {/* Waveform Micro Canvas reactions background */}
          <canvas 
            ref={canvasRef} 
            width={180} 
            height={44} 
            className="w-full h-11 pointer-events-none mt-2 rounded bg-slate-950/20"
          />
        </div>

        {/* Practice Sequence scrolling View tape (8 Columns) */}
        <div className="lg:col-span-8 flex flex-col justify-between p-5 bg-slate-950/40 rounded-2xl border border-slate-800">
          
          <div className="flex justify-between items-center mb-4">
            <div>
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-amber-400" />
                <span>工工四（くんくんしー）練習ストリーム</span>
              </h4>
              <p className="text-[11px] text-gray-400 font-medium">
                対象曲: <span className="text-amber-400">{activeSong.title}</span>
              </p>
            </div>
            
            <button
              onClick={resetPractice}
              className="text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 p-1.5 rounded-lg text-xs flex items-center gap-1 transition-all"
              title="最初からやり直す"
            >
              <RotateCcw size={12} />
              <span>初めから</span>
            </button>
          </div>

          {/* Scrolling Note blocks */}
          <div className="relative flex items-center gap-3 overflow-x-auto py-5 px-3 min-h-24 bg-zinc-950 rounded-2xl border border-zinc-800 custom-scrollbar scroll-smooth">
            {activeSong.notes.map((char, index) => {
              const isPast = index < practiceIndex;
              const isCurrent = index === practiceIndex;
              const isNext = index > practiceIndex;
              const noteMeta = KUNKUNSHI_MAP[char];

              return (
                <div
                  key={`note-scroller-${index}`}
                  className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center transition-all duration-300 border ${
                    isCurrent
                      ? "bg-amber-600 text-amber-50 border-yellow-300 scale-110 shadow-lg shadow-yellow-500/40 font-bold"
                      : isPast
                        ? "bg-emerald-950/30 text-emerald-400/60 border-emerald-900/60 opacity-60 scale-95"
                        : "bg-slate-900/60 text-slate-400 border-slate-800 opacity-80"
                  }`}
                >
                  <span className="text-[10px] text-gray-500 leading-tight font-serif uppercase">
                    {noteMeta && noteMeta.stringIndex === 0 ? "男" : noteMeta && noteMeta.stringIndex === 1 ? "中" : noteMeta && noteMeta.stringIndex === 2 ? "女" : "間"}
                  </span>
                  <span className="text-lg font-bold font-serif my-0.5">{char}</span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    {noteMeta ? noteMeta.english : "-"}
                  </span>
                  
                  {isCurrent && (
                    <span className="absolute -top-1 right-3.5 w-2.5 h-2.5 rounded-full bg-yellow-400 animate-ping"></span>
                  )}
                </div>
              );
            })}

            {/* Complete Finish Block */}
            {practiceCompleted && (
              <div className="flex-shrink-0 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-slate-900 font-bold rounded-2xl flex items-center gap-1.5 border border-emerald-300 shadow-md">
                <Award size={16} />
                <span>完奏！</span>
              </div>
            )}
          </div>

          {/* Stats Bar */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/60 p-3 rounded-xl border border-zinc-800/80">
            <div className="text-center">
              <span className="text-[9px] text-gray-400 block font-bold">進捗度</span>
              <span className="text-xs font-bold font-mono text-slate-100">
                {Math.round((practiceIndex / activeSong.notes.length) * 100)}%
              </span>
            </div>
            <div className="text-center">
              <span className="text-[9px] text-gray-400 block font-bold">パーフェクト音</span>
              <span className="text-xs font-bold font-mono text-emerald-400">
                {correctCount} / {activeSong.notes.length}
              </span>
            </div>
            <div className="text-center">
              <span className="text-[9px] text-gray-400 block font-bold">低かった音</span>
              <span className="text-xs font-bold font-mono text-amber-500">{flatCount} 音</span>
            </div>
            <div className="text-center">
              <span className="text-[9px] text-gray-400 block font-bold">高かった音</span>
              <span className="text-xs font-bold font-mono text-amber-500">{sharpCount} 音</span>
            </div>
          </div>

          <div className="mt-4 flex justify-between items-center text-[10px] text-slate-400">
            <span>※ チューナーが声を拾いすぎる場合は、三線のボディの近くに置いて弾くと反応しやすいさぁ。</span>
            {practiceCompleted && (
              <span className="text-emerald-400 flex items-center gap-1 font-bold animate-pulse">
                <Sparkles size={11} />
                おじぃにアドバイスを求めてね！
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  );

  function apiIndicatorOrError() {
    if (micError) {
      return (
        <div className="mb-6 p-4 rounded-xl bg-red-950/30 text-red-300 border border-red-900/40 text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{micError}</span>
        </div>
      );
    }

    return (
      <div className="mb-6 flex flex-col sm:flex-row gap-3 items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isPlaying ? "bg-emerald-500 animate-pulse" : "bg-zinc-700"}`}></div>
          <span className="text-xs font-semibold text-slate-300">
            {isPlaying 
              ? "マイクはONさぁ！三線を鳴らせば自動で検知して工工四がステップアップするよ！" 
              : "三線の音の検知を開始するには、マイクをオンにセットしてね。"}
          </span>
        </div>

        <button
          onClick={isPlaying ? stopMic : startMic}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all outline-none ${
            isPlaying
              ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700"
              : "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-slate-950 shadow-md shadow-amber-950/10"
          }`}
        >
          {isPlaying ? <VolumeX size={14} /> : <Mic size={14} />}
          <span>{isPlaying ? "マイクをストップするさぁ" : "マイクの使用を開始する！"}</span>
        </button>
      </div>
    );
  }
}
