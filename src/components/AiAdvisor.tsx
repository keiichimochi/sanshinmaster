import React, { useState } from "react";
import { Song } from "../types";
import { MessageSquare, Volume2, VolumeX, Sparkles, Loader2, Send, CornerDownLeft, Sunset } from "lucide-react";

interface AiAdvisorProps {
  activeSong: Song;
  practiceStats: {
    correctCount: number;
    flatCount: number;
    sharpCount: number;
    difficultyNotes: string[];
    score: number;
  };
}

export default function AiAdvisor({
  activeSong,
  practiceStats
}: AiAdvisorProps) {
  const [loading, setLoading] = useState(false);
  const [adviceText, setAdviceText] = useState<string>("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechUtterance, setSpeechUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  
  // Custom comments
  const [userComment, setUserComment] = useState("");

  const fetchAdvice = async () => {
    try {
      setLoading(true);
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }

      const response = await fetch("/api/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songName: activeSong.title,
          score: practiceStats.score,
          correctCount: practiceStats.correctCount,
          flatCount: practiceStats.flatCount,
          sharpCount: practiceStats.sharpCount,
          difficultyNotes: practiceStats.difficultyNotes,
          comments: userComment
        })
      });

      const data = await response.json();
      setAdviceText(data.advice || "おじぃの知恵袋、ちょっと見当たらないさぁ。もう一回聞いてね。");
      
      // Auto speech speak once loaded
      speakAdvice(data.advice);
    } catch (e) {
      console.error(e);
      setAdviceText("おじぃの耳がちょっと驚いてしまって、アドバイスが出てこなかったさぁ。（エラーが発生しました。やり直してみてね）");
    } finally {
      setLoading(false);
    }
  };

  // Speaks using the browser native web SpeechSynthesis API
  const speakAdvice = (textToSpeak: string) => {
    if (!window.speechSynthesis || !textToSpeak) return;

    // Stop former speeches
    window.speechSynthesis.cancel();

    // Clean markdown symbols to make pronunciation natural
    const cleanText = textToSpeak
      .replace(/[#*`_\[\]()【】]/g, "")
      .replace(/[\n\r]+/g, "。");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Attempt to locate a Japanese language speaker
    const voices = window.speechSynthesis.getVoices();
    const jaVoice = voices.find(v => v.lang === "ja-JP" || v.lang.startsWith("ja"));
    if (jaVoice) {
      utterance.voice = jaVoice;
    }
    
    // Grandpa speed: warm, slow, comfortable
    utterance.rate = 0.88;
    utterance.pitch = 0.85; // slightly lower pitch for older gentleman style
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setSpeechUtterance(utterance);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  return (
    <div id="ai-advisor-container" className="bg-slate-900/40 rounded-3xl p-6 border border-slate-700/50 shadow-2xl backdrop-blur-md relative overflow-hidden flex flex-col justify-between">
      
      {/* Visual top accent Okinawan hibiscus flower / sunset */}
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <Sunset className="w-24 h-24 text-amber-500" />
      </div>

      <div>
        <div className="flex justify-between items-start gap-3 mb-4">
          <div>
            <h3 className="text-xl font-bold text-amber-100 flex items-center gap-2">
              <span>🌺 三線の大家・比嘉おじぃのAI音声指導</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              今の演奏の出来栄え（正解率や音ズレの癖）を比嘉おじぃが丁寧に聞き取り、音声＆テキストで直伝アドバイスするさぁ。
            </p>
          </div>
          
          {adviceText && (
            <button
              onClick={isSpeaking ? stopSpeaking : () => speakAdvice(adviceText)}
              className={`p-2.5 rounded-xl text-xs transition-all pointer-events-auto border outline-none cursor-pointer flex items-center justify-center ${
                isSpeaking
                  ? "bg-red-950/40 text-red-400 border-red-900/40 hover:bg-red-950/60"
                  : "bg-emerald-950/40 text-emerald-400 border-emerald-900/40 hover:bg-emerald-950/60"
              }`}
              title={isSpeaking ? "音声を一時停止" : "おじぃの声を再生"}
            >
              {isSpeaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          )}
        </div>

        {/* User questions inputs */}
        <div className="bg-slate-950/30 p-4 rounded-2xl border border-slate-800 mb-6">
          <label className="block text-xs uppercase text-slate-400 font-bold mb-2">おじぃに質問・相談、または調子が悪い部分を伝える：</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="例（中から工への指移動がむずかしい、弦が鳴りにくい、爪が痛いなど...）"
              value={userComment}
              onChange={(e) => setUserComment(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2 text-sm text-white focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  fetchAdvice();
                }
              }}
            />
            <button
              onClick={fetchAdvice}
              disabled={loading}
              className="bg-amber-600 hover:bg-amber-505 disabled:bg-stone-800 text-slate-900 hover:text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition-colors flex items-center gap-1 shrink-0"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              <span>指導をもらうさぁ</span>
            </button>
          </div>
          <span className="text-[10px] text-zinc-500 mt-1.5 block">
            ※ 練習ストリームが途中の状態でも、おじぃにいつでも三線の質問ができます。
          </span>
        </div>

        {/* Advice response displaying */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-300">比嘉おじぃが三線の音色を思い出しているさぁ...</p>
            <p className="text-xs text-slate-500 mt-1 animate-pulse">「ちばりよー、なんくるないさー...」</p>
          </div>
        ) : adviceText ? (
          <div className="flex gap-4 items-start bg-slate-950/40 p-5 rounded-2xl border border-slate-800 animate-fade-in">
            
            {/* Okinawan Grandmaster avatar portrait */}
            <div className="shrink-0 flex flex-col items-center text-center">
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border-2 border-yellow-300 flex items-center justify-center shadow-lg overflow-hidden">
                {/* Visual elderly master head silhouette using clean CSS or text */}
                <span className="text-2xl">👴</span>
                
                {/* Small absolute guitar neck badge */}
                <span className="absolute bottom-0 right-0 text-xs bg-stone-900 border border-stone-700 rounded-full px-1 py-0.5">🎸</span>
              </div>
              <span className="text-[10px] font-bold text-amber-400 mt-1 block">比嘉おじぃさぁ</span>
              <span className="text-[9px] text-slate-500">（78 / 師範）</span>
            </div>

            {/* Speach bubble */}
            <div className="flex-1 relative bg-stone-900 border border-stone-800 p-4 rounded-2xl">
              {/* Pointer triangle */}
              <div className="absolute left-[-6px] top-6 w-3 h-3 bg-stone-900 border-l border-b border-stone-800 transform rotate-45"></div>
              
              <div className="text-xs md:text-sm text-slate-200 leading-relaxed space-y-2 whitespace-pre-wrap font-serif">
                {adviceText}
              </div>

              {/* TTS Voice indicators */}
              {isSpeaking && (
                <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between text-[11px] text-emerald-400">
                  <span className="flex items-center gap-1.5 animate-pulse">
                    <Volume2 size={13} />
                    音声ガイダンスを読み上げ中...
                  </span>
                  <button 
                    onClick={stopSpeaking}
                    className="text-gray-500 hover:text-white transition-colors"
                  >
                    再生停止
                  </button>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="py-8 text-center border-2 border-dashed border-slate-850 rounded-2xl bg-slate-950/20">
            <MessageSquare size={36} className="text-slate-600 mx-auto mb-2" />
            <h4 className="font-bold text-slate-400 text-sm">比嘉おじぃのアドバイス待機中</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
              工工四の練習を少し進めるか、上の入力ボックスに三線の疑問などを入力して、「指導をもらう」をクリックしてごらん。
            </p>
          </div>
        )}
      </div>

      {/* Stats and visual badge footer */}
      <div className="mt-6 pt-4 border-t border-slate-800/60 flex justify-between items-center text-[10px] text-slate-500">
        <span>比嘉おじぃAI音声指導モデル：Gemini 3.5 Flash</span>
        <span className="text-amber-500">はいさい！毎日特訓して名奏者になるさぁ！</span>
      </div>
    </div>
  );
}
