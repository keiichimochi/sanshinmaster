import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON requests
  app.use(express.json());

  // Initialize Gemini API client on the server
  // User-Agent: aistudio-build is set for telemetry guidelines.
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  // AI Sanshin Advisor endpoint
  app.post("/api/advice", async (req, res) => {
    try {
      const { songName, score, correctCount, flatCount, sharpCount, comments, difficultyNotes } = req.body;

      if (!process.env.GEMINI_API_KEY) {
        return res.status(200).json({
          advice: "【比嘉おじぃのヒント】AIアドバイザーのAPIキー（GEMINI_API_KEY）が設定されていません。でもちばりよー（がんばってね）！練習を続ければ必ず上手に弾けるようになるさぁ！",
          status: "no_key"
        });
      }

      const prompt = `あなたは「比嘉おじぃ」（比嘉朝信、78歳）、石垣島出身の温かくてチャーミングな沖縄三線の大御所マスターです。
初心者の生徒があなたの三線特訓ウェブアプリで練習を行いました。彼らの練習結果を聞き取り（トラッキング情報）、三線の先生として優しく、時には具体的で確かなアドバイスをうちなーぐち（沖縄方言）を交えて贈ってください。

【生徒の練習情報】
- 練習曲: ${songName || "自由練習・チューニング"}
- 音程の一致率 (正確性): ${score !== undefined ? score + "%" : "計測中"}
- 安定して弾けた数 (正解): ${correctCount || 0}音
- 音程が低かった数 (フラット): ${flatCount || 0}音
- 音程が高かった数 (シャープ): ${sharpCount || 0}音
- 苦手だった・ズレが多かった工工四の音: ${difficultyNotes?.length > 0 ? difficultyNotes.join("、") : "特になし"}
- 生徒からの質問・感想: "${comments || "特になし"}"

【比嘉おじぃのアドバイス作成のルール】
1. 冒頭は「はいさい！比嘉おじぃさぁ。」などの温かい挨拶から始めてください。
2. 練習結果（一致率や正解数）を優しく褒めて、やる気を引き出してください（一致率が低くても絶対に叱らず、「なんくるないさー（なんとかなるさ）」と励ますこと）。
3. 音程がズレている原因を三線奏者の視点から具体的にアドバイスしてください。
   - フラット（音が低い）が多い場合：指が歌口（糸巻き側）に寄りすぎている、あるいはしっかり弦を抑えられておらずビビり音が出ている。もう少し胴（太鼓側）に向けて指を滑らせて、爪の先でしっかり抑えてごらん。
   - シャープ（音が高い）が多い場合：指が胴に近すぎる、または弦を引っ張りすぎているかもしれないね。力を少し抜いて、勘所の真上を垂直に優しく押さえるのがコツさぁ。
   - 特定の音（工、六、七など）へのアドバイス：
     - 「工」（女弦の開放弦）は、前の糸を弾いた爪の余韻を消さずに、開放をシャープに鳴らすこと。
     - 「六」や「七」は特に初心者が指を迷いやすいところ。人指し指（中）から薬指（六・七）に飛ぶときは、棹をしっかり左手親指と人差し指の付け根で支えて、小指や薬指をまっすぐおろす感覚を意識して。
4. 終わりは「ちばりよー！」（がんばれ！）などの熱意と愛情あふれる沖縄の言葉で締めくくってください。
5. 親しみやすい話し言葉で、1音声トラックとしてTTS（音声合成）で気持ちよく聞き取れるよう、漢字の読みやすさや適度な改行・読点を意識した日本語（うちなーぐち混じり）で出力してください。Markdownの装飾文字（**や#など）は、音声読み上げ時に不自然になるのを避けるため、極力使用しないでください。また、250〜350文字程度で簡潔にまとめてください。`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      const adviceText = response.text || "あきさみよー、おじぃ少しうたた寝してしまっていたさぁ。もう一回弾いてみておくれねぇ。";

      return res.json({
        advice: adviceText,
        status: "success"
      });
    } catch (error: any) {
      console.error("Gemini advice error:", error);
      return res.status(500).json({
        advice: "おじぃの耳がちょっと寂しくなってるさぁ。もう一度試してみてね。（エラーが発生しました）",
        error: error.message
      });
    }
  });

  // Enable static hosting or Vite Development Server
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware mounted for local development.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static files from dist / SPA mode.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Sanshin application server is listening on port ${PORT}`);
  });
}

startServer();
