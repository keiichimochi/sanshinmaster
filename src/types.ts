/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Chii tuning definitions
export interface ChiiTuning {
  id: string; // e.g. "4chii", "6chii"
  name: string; // e.g. "四のちぃ", "六のちぃ"
  basePitch: string; // e.g. "C3", "D3"
  maleFreq: number; // e.g. 130.81 for C3
  nakaFreq: number;  // e.g. 174.61 for F3
  femaleFreq: number; // e.g. 261.63 for C4
  label: string; // e.g. "C-F-C (低め)", "D-G-D (標準)"
}

export const TUNINGS: ChiiTuning[] = [
  { id: "4chii", name: "四の本調子 (低め)", basePitch: "C", maleFreq: 130.81, nakaFreq: 174.61, femaleFreq: 261.63, label: "C - F - C (練習しやすい低域)" },
  { id: "5chii", name: "五の本調子 (中)", basePitch: "C#", maleFreq: 138.59, nakaFreq: 185.00, femaleFreq: 277.18, label: "C# - F# - C# (女性が歌いやすい)" },
  { id: "6chii", name: "六の本調子 (標準)", basePitch: "D", maleFreq: 146.83, nakaFreq: 196.00, femaleFreq: 293.66, label: "D - G - D (男性標準・島人ぬ宝で多用)" },
  { id: "7chii", name: "七の本調子 (高め)", basePitch: "D#", maleFreq: 155.56, nakaFreq: 207.65, femaleFreq: 311.13, label: "D# - G# - D# (高めの唄)" },
  { id: "8chii", name: "八の本調子 (最高音)", basePitch: "E", maleFreq: 164.81, nakaFreq: 220.00, femaleFreq: 329.63, label: "E - A - E (伸びやかな声の唄)" }
];

export interface KunkunshiMeta {
  char: string;       // e.g. "工"
  english: string;    // e.g. "Kou"
  stringIndex: number; // 0: 男弦, 1: 中弦, 2: 女弦
  fingerIndex: number; // 0: 開放, 1: 上のツマ, 2: 下のツマ, etc.
  semitonesFromMaleOpen: number; // semitones offset from Male Open (合)
}

// Full specifications of Kunkunshi characters mapped in Honchoshi (本調子)
export const KUNKUNSHI_MAP: { [key: string]: KunkunshiMeta } = {
  // 男弦 (Lowest string)
  "合": { char: "合", english: "Ai", stringIndex: 0, fingerIndex: 0, semitonesFromMaleOpen: 0 },
  "乙": { char: "乙", english: "Otsu", stringIndex: 0, fingerIndex: 1, semitonesFromMaleOpen: 2 },
  "老": { char: "老", english: "Rou", stringIndex: 0, fingerIndex: 2, semitonesFromMaleOpen: 4 },
  
  // 中弦 (Middle string, tuned 5 semitones above Low)
  "四": { char: "四", english: "Shi", stringIndex: 1, fingerIndex: 0, semitonesFromMaleOpen: 5 },
  "上": { char: "上", english: "Jou", stringIndex: 1, fingerIndex: 1, semitonesFromMaleOpen: 7 },
  "中": { char: "中", english: "Chu", stringIndex: 1, fingerIndex: 2, semitonesFromMaleOpen: 9 },
  "尺": { char: "尺", english: "Shaku", stringIndex: 1, fingerIndex: 3, semitonesFromMaleOpen: 11 },

  // 女弦 (Highest string, tuned 12 semitones above Low)
  "工": { char: "工", english: "Kou", stringIndex: 2, fingerIndex: 0, semitonesFromMaleOpen: 12 },
  "五": { char: "五", english: "Go", stringIndex: 2, fingerIndex: 1, semitonesFromMaleOpen: 14 },
  "六": { char: "六", english: "Roku", stringIndex: 2, fingerIndex: 2, semitonesFromMaleOpen: 16 },
  "七": { char: "七", english: "Shichi", stringIndex: 2, fingerIndex: 3, semitonesFromMaleOpen: 17 },
  "八": { char: "八", english: "Hachi", stringIndex: 2, fingerIndex: 4, semitonesFromMaleOpen: 19 },
  "九": { char: "九", english: "Kyu", stringIndex: 2, fingerIndex: 5, semitonesFromMaleOpen: 21 },
  
  // Rest (休) or spacers
  "休": { char: "休", english: "Rest", stringIndex: -1, fingerIndex: -1, semitonesFromMaleOpen: -1 },
  "・": { char: "・", english: "Dot", stringIndex: -1, fingerIndex: -1, semitonesFromMaleOpen: -1 }
};

export interface Song {
  id: string;
  title: string;
  artist?: string;
  description: string;
  notes: string[]; // List of characters from Kunkunshi
  isCustom?: boolean;
}

export interface TrackedPlay {
  timestamp: number;
  targetChar: string;
  playedPitch: number;
  playedCentsOffset: number;
  status: "correct" | "sharp" | "flat" | "miss";
  detectedKunkunshi?: string;
}

export interface PracticeSession {
  songId: string;
  songTitle: string;
  startedAt: number;
  notesAttempted: number;
  correctNotes: number;
  flatNotes: number;
  sharpNotes: number;
  trackedPlays: TrackedPlay[];
}
