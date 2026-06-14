import React, { useState, useEffect, useRef } from "react";
import { ChiiTuning, TUNINGS, KUNKUNSHI_MAP, KunkunshiMeta, Song, TrackedPlay } from "../types";
import { Volume2, VolumeX, Mic, Compass, Play, RotateCcw, Award, Sparkles, AlertCircle, Music, Radio, CheckCircle2 } from "lucide-react";

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
  const activeOscillatorRef = useRef<OscillatorNode | null>(null);

  // App UI State
  const [isPlaying, setIsPlaying] = useState(false);
  const [micError, setMicError] = useState("");
  const [liveFreq, setLiveFreq] = useState<number | null>(null);
  const [detectedNote, setDetectedNote] = useState<KunkunshiMeta | null>(null);
  const [centsOffset, setCentsOffset] = useState<number>(0);
  const [isNotePerfect, setIsNotePerfect] = useState(false);

  // Audio energy monitor level (dB or RMS representation)
  const [rmsVolume, setRmsVolume] = useState<number>(0);

  // Tuner function mode: "practice" is original scrolling kunkunshi, "chindami" is new dedicated tuner!
  const [tunerMode, setTunerMode] = useState<"practice" | "chindami">("practice");
  const [stringToTune, setStringToTune] = useState<0 | 1 | 2>(0); // 0: 男弦 (Low), 1: 中弦 (Mid), 2: 女弦 (High)

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
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048; // perfect window for 130Hz - 440Hz detection
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      setIsPlaying(true);
      // Wait briefly for mic to initialize before launching detector loop
      setTimeout(() => {
        detectPitchLoop();
      }, 50);
    } catch (err: any) {
      console.error(err);
      setMicError("マイクの使用許可が得られませんでした。ブラウザのマイク設定をオンにしてください。また、他のアプリやタブがマイクを独占していないか確認してください。");
      setIsPlaying(false);
    }
  };

  const stopMic = () => {
    setIsPlaying(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (activeOscillatorRef.current) {
      try {
        activeOscillatorRef.current.stop();
        activeOscillatorRef.current.disconnect();
      } catch (e) {}
      activeOscillatorRef.current = null;
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
    setRmsVolume(0);
  };

  // Plucks synthesized reference tone (Triangle wave for natural warm string emulation)
  const playReferenceTone = (freq: number) => {
    let ctx = audioContextRef.current;
    if (!ctx || ctx.state === "closed") {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;
    }

    // Attempt to resume audio context if suspended (Chrome Autoplay policy)
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    // Stop former active oscillators immediately
    if (activeOscillatorRef.current) {
      try {
        activeOscillatorRef.current.stop();
        activeOscillatorRef.current.disconnect();
      } catch (e) {}
    }

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    // Warm decay envelope mimicking Sanshin plucking behavior
    gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 1.8);
    activeOscillatorRef.current = osc;
  };

  // Highly robust Autocorrelation algorithm (Zero-crossing based with no aggressive noise cutoffs)
  const autoCorrelate = (buffer: Float32Array, sampleRate: number): number => {
    const SIZE = buffer.length;
    let rms = 0;

    // Detect signal volume level
    for (let i = 0; i < SIZE; i++) {
      const val = buffer[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    
    // Pass latest volume gauge up to local hook and save
    setRmsVolume(rms);

    // Dynamic threshold limit: tolerates much lower volume (acoustic inputs)
    if (rms < 0.002) {
      return -1; // Volume too low
    }

    // Subdivide the buffer for auto-correlation calculations
    const correlations = new Float32Array(SIZE);
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE - i; j++) {
        correlations[i] += buffer[j] * buffer[j + i];
      }
    }

    // Locate the first zero-crossing or local minimum
    let d = 0;
    while (d < SIZE - 1 && correlations[d] > correlations[d + 1]) {
      d++;
    }

    // Find the absolute highest peak after the zero lag threshold minimum
    let maxval = -1;
    let maxpos = -1;
    for (let i = d; i < SIZE - 1; i++) {
      if (correlations[i] > maxval) {
        maxval = correlations[i];
        maxpos = i;
      }
    }

    let T0 = maxpos;
    if (T0 < 0 || T0 >= SIZE) {
      return -1;
    }

    // Parabolic interpolation for fine tuning fractional wavelength
    if (T0 > 0 && T0 < SIZE - 1) {
      const x1 = correlations[T0 - 1];
      const x2 = correlations[T0];
      const x3 = correlations[T0 + 1];
      const a = (x1 + x3 - 2 * x2) / 2;
      const b = (x3 - x1) / 2;
      if (a !== 0) {
        T0 = T0 - b / (2 * a);
      }
    }

    const freq = sampleRate / T0;

    // Bound the result to standard Sanshin spectrum range (100 Hz to 600 Hz) to eliminate low humming / computer fan noises
    if (freq < 100 || freq > 600) {
      return -1;
    }

    return freq;
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
    if (!isPlaying) return;
    if (!analyserRef.current) {
      animationFrameRef.current = requestAnimationFrame(detectPitchLoop);
      return;
    }

    const bufferLength = analyserRef.current.fftSize;
    const dataArray = new Float32Array(bufferLength);
    analyserRef.current.getFloatTimeDomainData(dataArray);

    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    const frequency = autoCorrelate(dataArray, sampleRate);

    // Draw raw waveform to canvas
    drawWaveform(dataArray);

    if (frequency > 0 && frequency < 1000) {
      setLiveFreq(Math.round(frequency * 10) / 10);
      
      if (tunerMode === "chindami") {
        // Dedicated tuning mode logic for Low, Mid, and High strings
        // Find target frequency
        const targetFreq = stringToTune === 0 
          ? selectedTuning.maleFreq 
          : stringToTune === 1 
            ? selectedTuning.nakaFreq 
            : selectedTuning.femaleFreq;

        const semitonesFromTarget = 12 * Math.log2(frequency / targetFreq);
        const cents = Math.round(semitonesFromTarget * 100);
        
        setCentsOffset(cents);
        setIsNotePerfect(Math.abs(cents) <= 15);
        
        const matchedChar = stringToTune === 0 ? "合" : stringToTune === 1 ? "四" : "工";
        const meta = KUNKUNSHI_MAP[matchedChar];
        if (meta) {
          setDetectedNote(meta);
        }
      } else {
        // Standard Practice scroll mode
        const match = mapFrequencyToKunkunshi(frequency, selectedTuning);
        if (match) {
          setDetectedNote(match.meta);
          setCentsOffset(match.cents);

          // A pitch is perfectly in-tune if within -15 to +15 cents
          const isPerfect = Math.abs(match.cents) <= 15;
          setIsNotePerfect(isPerfect);

          // Practice check: are they playing the current target note?
          const targetChar = activeSong?.notes?.[practiceIndex] || "";
          
          // Skip dots or rests immediately on sequence
          if (targetChar === "・" || targetChar === "休") {
            advancePractice(targetChar, "correct", frequency, 0);
          } else if (match.meta.char === targetChar) {
            // Must hold the pitch perfectly
            if (isPerfect) {
              advancePractice(targetChar, "correct", frequency, match.cents);
            }
          } else {
            // Keeps track of wrong note plucked to suggest finger adjustments in AI Advice
            const isSharp = match.cents > 15;
            const status = isSharp ? "sharp" : "flat";
            
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

    if (nextIndex >= (activeSong?.notes?.length || 0)) {
      setPracticeCompleted(true);
      setPracticeIndex((activeSong?.notes?.length || 1) - 1);
    } else {
      setPracticeIndex(nextIndex);
      
      // Auto-jump over dots ("・") and rests ("休") immediately to keep note plucks smooth
      const nextChar = activeSong?.notes?.[nextIndex];
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
      
      {/* Upper selector tuning controls & Tab selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <h3 className="text-xl font-bold bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent flex items-center gap-2">
            <span>🎤 リアルタイム音程解析・特訓＆調弦ゲージ</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            音を拾いにくい場合はマイクの横にある「入力音量」がピコピコ動いているか確認してねぇ。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Switcher */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setTunerMode("practice")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                tunerMode === "practice"
                  ? "bg-amber-600 text-slate-950"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              工工四特訓
            </button>
            <button
              onClick={() => {
                setTunerMode("chindami");
                // Stop any previous search
                setIsNotePerfect(false);
                setDetectedNote(null);
                setCentsOffset(0);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                tunerMode === "chindami"
                  ? "bg-amber-600 text-slate-950"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              ちんだみ（調弦）
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label className="text-xs font-semibold text-slate-350">基本調律:</label>
            <select
              value={selectedTuning.id}
              onChange={handleTuningChange}
              className="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-2.5 py-1.5 text-xs text-amber-300 focus:outline-none cursor-pointer"
            >
              {TUNINGS.map((tuning) => (
                <option key={tuning.id} value={tuning.id}>
                  {tuning.id.toUpperCase()}: {tuning.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {apiIndicatorOrError()}

      {/* Grid of Tuner Gauges & Practice/Tuning content */}
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
          <div className="text-xs bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 z-10 min-h-[56px] flex items-center justify-center">
            {detectedNote ? (
              <p className="text-slate-300 leading-snug">
                {isNotePerfect ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1 justify-center">
                    <CheckCircle2 size={13} />
                    ほぼジャスト！上等さぁ！
                  </span>
                ) : centsOffset < 0 ? (
                  <span className="text-amber-450">ちょっと<strong>【音が低い（フラット）】</strong>さぁ。糸巻きを少し締めて。</span>
                ) : (
                  <span className="text-amber-455">ちょっと<strong>【音が高い（シャープ）】</strong>さぁ。糸巻きを少し緩めて。</span>
                )}
              </p>
            ) : (
              <p className="text-slate-400 text-xs">
                {isPlaying 
                  ? "三線の弦を1本ずつ弾いてみてね。マイクが音をキャッチするとここに振幅が表示されるよ。" 
                  : "上のマイク開始ボタンを押して練習を始めるさぁ。"}
              </p>
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

        {/* Dynamic Display side panel based on tuner mode */}
        {tunerMode === "practice" ? (
          /* Practice Scrolling timeline (8 Columns) */
          <div className="lg:col-span-8 flex flex-col justify-between p-5 bg-slate-950/40 rounded-2xl border border-slate-800">
            
            <div className="flex justify-between items-center mb-4">
              <div>
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-amber-400" />
                  <span>工工四（くんくんしー）練習ストリーム</span>
                </h4>
                <p className="text-[11px] text-gray-400 font-medium">
                  対象曲: <span className="text-amber-400">{activeSong.title || "唄を選んでね"}</span>
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
              {activeSong.notes && activeSong.notes.length > 0 ? (
                activeSong.notes.map((char, index) => {
                  const isPast = index < practiceIndex;
                  const isCurrent = index === practiceIndex;
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
                      <span className="text-[10px] text-gray-400 leading-tight font-serif uppercase">
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
                })
              ) : (
                <div className="text-center w-full py-4 text-slate-500 text-xs">
                  「1. 曲を選ぶ」タブから唄（練習曲）を選択してねぇ。
                </div>
              )}

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
                  {activeSong.notes ? Math.round((practiceIndex / activeSong.notes.length) * 100) : 0}%
                </span>
              </div>
              <div className="text-center">
                <span className="text-[9px] text-gray-400 block font-bold">パーフェクト音</span>
                <span className="text-xs font-bold font-mono text-emerald-400">
                  {correctCount} / {activeSong.notes?.length || 0}
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
              <span>※ リアルタイム感度は非常に高く調整済みです。マイク付近でゆっくり一弦ずつ爪で弾いてね。</span>
              {practiceCompleted && (
                <span className="text-emerald-400 flex items-center gap-1 font-bold animate-pulse">
                  <Sparkles size={11} />
                  おじぃにアドバイスを求めてね！
                </span>
              )}
            </div>
          </div>
        ) : (
          /* NEW: Dedicated Chindami Tuning Mode layout (8 Columns) */
          <div className="lg:col-span-8 flex flex-col justify-between p-5 bg-slate-950/40 rounded-2xl border border-slate-800">
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h4 className="font-bold text-slate-200 text-sm flex items-center gap-1.5 animate-pulse">
                    <Radio className="w-4 h-4 text-emerald-400" />
                    <span>ちんだみ（調弦）アシスタント</span>
                  </h4>
                  <p className="text-[11px] text-gray-400 font-medium">
                    選択中のキー調律: <span className="text-amber-405 font-bold">{selectedTuning.name} ({selectedTuning.label})</span>
                  </p>
                </div>
                <span className="text-[10px] text-amber-500 bg-amber-505/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-serif">
                  本調子 (Honchoshi)
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                三線の3本の弦を個別に調律するさぁ。合わせたい弦（男・中・女）を選んでから弦を弾いてみてね。
                <strong>「お手本の音を鳴らす」</strong>ボタンを押すと、基準となる正しい音色がスピーカーから響くよ。耳でもしっかり聴き比べてみてねぇ！
              </p>

              {/* Three string select cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* LOW STRING */}
                <button
                  onClick={() => {
                    setStringToTune(0);
                    // Reset live feedback to allow clean sweep
                    setIsNotePerfect(false);
                    setDetectedNote(null);
                    setCentsOffset(0);
                  }}
                  className={`p-4 rounded-xl text-left border transition-all flex flex-col justify-between h-28 relative overflow-hidden ${
                    stringToTune === 0
                      ? "bg-amber-950/40 border-amber-500 text-amber-200 shadow-lg"
                      : "bg-slate-900/30 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <span className="text-xs font-bold font-serif">一の弦：男弦 (Low)</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${stringToTune === 0 ? "bg-amber-500 text-slate-950 font-bold" : "bg-slate-950"}`}>合</span>
                  </div>
                  <div>
                    <span className="text-xl font-black block font-mono">{selectedTuning.basePitch}3</span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-0.5">{selectedTuning.maleFreq} Hz</span>
                  </div>
                  {/* Subtle decorative target string lines */}
                  <div className="absolute right-3 bottom-2 flex gap-1 items-end h-8">
                    <div className="w-1.5 h-full bg-amber-500 rounded-full"></div>
                    <div className="w-0.5 h-6 bg-slate-800 rounded-full"></div>
                    <div className="w-0.5 h-4 bg-slate-800 rounded-full"></div>
                  </div>
                </button>

                {/* MID STRING */}
                <button
                  onClick={() => {
                    setStringToTune(1);
                    // Reset live feedback
                    setIsNotePerfect(false);
                    setDetectedNote(null);
                    setCentsOffset(0);
                  }}
                  className={`p-4 rounded-xl text-left border transition-all flex flex-col justify-between h-28 relative overflow-hidden ${
                    stringToTune === 1
                      ? "bg-amber-950/40 border-amber-500 text-amber-200 shadow-lg"
                      : "bg-slate-900/30 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <span className="text-xs font-bold font-serif">二の弦：中弦 (Mid)</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${stringToTune === 1 ? "bg-amber-500 text-slate-950 font-bold" : "bg-slate-950"}`}>四</span>
                  </div>
                  <div>
                    <span className="text-xl font-black block font-mono">
                      {selectedTuning.id === "4chii" ? "F" : selectedTuning.id === "5chii" ? "F#" : selectedTuning.id === "6chii" ? "G" : selectedTuning.id === "7chii" ? "G#" : "A"}3
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-0.5">{selectedTuning.nakaFreq} Hz</span>
                  </div>
                  {/* Decorative */}
                  <div className="absolute right-3 bottom-2 flex gap-1 items-end h-8">
                    <div className="w-0.5 h-6 bg-slate-800 rounded-full"></div>
                    <div className="w-1 h-full bg-amber-500 rounded-full"></div>
                    <div className="w-0.5 h-4 bg-slate-800 rounded-full"></div>
                  </div>
                </button>

                {/* HIGH STRING */}
                <button
                  onClick={() => {
                    setStringToTune(2);
                    // Reset live feedback
                    setIsNotePerfect(false);
                    setDetectedNote(null);
                    setCentsOffset(0);
                  }}
                  className={`p-4 rounded-xl text-left border transition-all flex flex-col justify-between h-28 relative overflow-hidden ${
                    stringToTune === 2
                      ? "bg-amber-950/40 border-amber-500 text-amber-200 shadow-lg"
                      : "bg-slate-900/30 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <span className="text-xs font-bold font-serif">三の弦：女弦 (High)</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${stringToTune === 2 ? "bg-amber-500 text-slate-950 font-bold" : "bg-slate-950"}`}>工</span>
                  </div>
                  <div>
                    <span className="text-xl font-black block font-mono">{selectedTuning.basePitch}4</span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-0.5">{selectedTuning.femaleFreq} Hz</span>
                  </div>
                  {/* Decorative */}
                  <div className="absolute right-3 bottom-2 flex gap-1 items-end h-8">
                    <div className="w-0.5 h-6 bg-slate-800 rounded-full"></div>
                    <div className="w-0.5 h-4 bg-slate-800 rounded-full"></div>
                    <div className="w-0.5 h-full bg-amber-500 rounded-full"></div>
                  </div>
                </button>
              </div>

              {/* Guide actions */}
              <div className="flex flex-col sm:flex-row gap-4 items-center bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <button
                  onClick={() => {
                    const reqFreq = stringToTune === 0 
                      ? selectedTuning.maleFreq 
                      : stringToTune === 1 
                        ? selectedTuning.nakaFreq 
                        : selectedTuning.femaleFreq;
                    playReferenceTone(reqFreq);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-550 text-slate-950 text-xs font-bold shrink-0 flex items-center justify-center gap-2 outline-none"
                >
                  <Volume2 size={15} />
                  <span>お手本の音を再生（1.8秒）</span>
                </button>

                <p className="text-[11px] text-slate-400">
                  <span className="text-yellow-400 font-bold">比嘉おじぃのちんだみのコツ：</span>
                  「まずは男弦（合）の音をしっかりと合わせるのが基本さぁ。男弦が決まれば、残りの弦はその響きを元に調和していくさぁね。耳でもよく聴くさぁねぇ。」
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800/50 text-[10px] text-slate-500 leading-snug">
              ※ 本調子（ほんちょうし）は男弦、中弦を4度（5半音）、男弦、女弦を8度（12半音／完全オクターブ）にする沖縄伝統の最も代表的な三線の調律法です。
            </div>
          </div>
        )}

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
      <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 shrink-0">
            <div className={`w-3 h-3 rounded-full ${isPlaying ? "bg-emerald-500 animate-pulse" : "bg-zinc-700"}`}></div>
            <span className="text-xs font-bold text-slate-300">
              {isPlaying 
                ? "マイクON：音程検知中さぁ！" 
                : "マイクOFF：音程検知は停止中"}
            </span>
          </div>

          {/* NEW LIVE AUDIO VOLUME LEVEL GAUGE */}
          {isPlaying && (
            <div className="flex items-center gap-2.5 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-zinc-800/60 w-full sm:w-44 select-none">
              <span className="text-[9px] text-amber-500 font-bold tracking-wider font-mono uppercase shrink-0">入力音量</span>
              <div className="flex-1 h-2 bg-slate-900 rounded-md overflow-hidden relative flex items-center">
                <div 
                  className={`h-full rounded-md transition-all duration-75 ${
                    rmsVolume > 0.08 ? "bg-amber-500" : rmsVolume > 0.002 ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" : "bg-slate-700"
                  }`} 
                  style={{ width: `${Math.min(100, Math.max(0, rmsVolume * 650))}%` }}
                ></div>
              </div>
              <span className="text-[8px] text-slate-500 font-mono shrink-0">
                {rmsVolume > 0.002 ? "検知中" : "無音"}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={isPlaying ? stopMic : startMic}
          className={`w-full md:w-auto px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all outline-none ${
            isPlaying
              ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700"
              : "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-slate-950 shadow-md shadow-amber-950/10"
          }`}
        >
          {isPlaying ? <VolumeX size={14} /> : <Mic size={14} />}
          <span>{isPlaying ? "マイクをOFFにするさぁ" : "マイクをONにするさぁ"}</span>
        </button>
      </div>
    );
  }
}
