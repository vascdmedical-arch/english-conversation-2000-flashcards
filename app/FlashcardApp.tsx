"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Languages,
  RotateCcw,
  Search,
  Shuffle,
  Sparkles,
  Star,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";

type Phrase = {
  id: number;
  localNo: number;
  chapter: "1-1000" | "1001-2000";
  chapterTitle: string;
  level: string;
  category: string;
  scene: string;
  japanese: string;
  english: string;
  politeness: string;
  note: string;
};

type BackMode = "english" | "japanese" | "memo" | "all";
type VoiceMode = "gpt" | "browser";

const CHAPTERS = [
  { id: "1-1000", label: "1-1000", title: "基本1000" },
  { id: "1001-2000", label: "1001-2000", title: "追加1000" },
] as const;

const BACK_MODES: Array<{ id: BackMode; label: string }> = [
  { id: "english", label: "英語" },
  { id: "japanese", label: "日本語" },
  { id: "memo", label: "メモ" },
  { id: "all", label: "全部" },
];

const VOICES = ["marin", "cedar", "coral", "nova"] as const;
const SWIPE_DISTANCE = 52;
const LAST_PHRASE_KEY = "english-2000-last-phrase";

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "ja"),
  );
}

function readSet(key: string) {
  if (typeof window === "undefined") return new Set<number>();

  try {
    const values = JSON.parse(window.localStorage.getItem(key) || "[]");
    return new Set<number>(Array.isArray(values) ? values : []);
  } catch {
    return new Set<number>();
  }
}

function saveSet(key: string, values: Set<number>) {
  window.localStorage.setItem(key, JSON.stringify(Array.from(values)));
}

function readNumber(key: string) {
  if (typeof window === "undefined") return null;

  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function saveNumber(key: string, value: number) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Progress is helpful, but the card should still work if storage is blocked.
  }
}

function findNearestIndexById(phrases: Phrase[], phraseId: number) {
  if (!phrases.length) return 0;

  let bestIndex = 0;
  let bestDistance = Math.abs(phrases[0].id - phraseId);

  phrases.forEach((phrase, index) => {
    const distance = Math.abs(phrase.id - phraseId);
    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  });

  return bestIndex;
}

function pickBrowserVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return (
    voices.find((voice) => voice.lang === "en-US" && /natural|premium|siri|ava|jenny|aria/i.test(voice.name)) ||
    voices.find((voice) => voice.lang === "en-US") ||
    voices.find((voice) => voice.lang.startsWith("en-")) ||
    null
  );
}

function englishIsVisible(nextFlipped: boolean, backMode: BackMode) {
  if (nextFlipped) return backMode === "english" || backMode === "all";
  return backMode === "japanese";
}

export function FlashcardApp() {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [chapter, setChapter] = useState<(typeof CHAPTERS)[number]["id"]>("1-1000");
  const [backMode, setBackMode] = useState<BackMode>("english");
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("gpt");
  const [voice, setVoice] = useState<(typeof VOICES)[number]>("marin");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [scene, setScene] = useState("all");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(() => readSet("english-2000-known"));
  const [starred, setStarred] = useState<Set<number>>(() => readSet("english-2000-starred"));
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [status, setStatus] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const swipeStartRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const ignoreNextCardClickRef = useRef(false);

  const resetPosition = useCallback(() => {
    setIndex(0);
    setFlipped(false);
    setStatus("");
  }, []);

  useEffect(() => {
    fetch("/phrases.json")
      .then((response) => response.json())
      .then((data: Phrase[]) => {
        const lastPhraseId = readNumber(LAST_PHRASE_KEY);
        const lastPhrase = lastPhraseId ? data[findNearestIndexById(data, lastPhraseId)] : null;

        setPhrases(data);

        if (lastPhrase) {
          const lastChapterPhrases = data.filter((phrase) => phrase.chapter === lastPhrase.chapter);
          setChapter(lastPhrase.chapter);
          setIndex(findNearestIndexById(lastChapterPhrases, lastPhrase.id));
          setStatus(lastPhrase.id === lastPhraseId ? "前回の続きから再開" : "前回の近くから再開");
        }
      })
      .catch(() => setStatus("データを読み込めませんでした"));
  }, []);

  const chapterPhrases = useMemo(
    () => phrases.filter((phrase) => phrase.chapter === chapter),
    [phrases, chapter],
  );

  const categoryOptions = useMemo(
    () => unique(chapterPhrases.map((phrase) => phrase.category)),
    [chapterPhrases],
  );

  const sceneOptions = useMemo(() => {
    const source =
      category === "all"
        ? chapterPhrases
        : chapterPhrases.filter((phrase) => phrase.category === category);
    return unique(source.map((phrase) => phrase.scene));
  }, [category, chapterPhrases]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return chapterPhrases.filter((phrase) => {
      if (category !== "all" && phrase.category !== category) return false;
      if (scene !== "all" && phrase.scene !== scene) return false;
      if (showStarredOnly && !starred.has(phrase.id)) return false;
      if (!normalizedQuery) return true;

      return [
        phrase.japanese,
        phrase.english,
        phrase.category,
        phrase.scene,
        phrase.level,
        phrase.note,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [category, chapterPhrases, query, scene, showStarredOnly, starred]);

  const currentIndex = filtered.length ? Math.min(index, filtered.length - 1) : 0;
  const active = filtered[currentIndex] ?? null;
  const knownCount = filtered.filter((phrase) => known.has(phrase.id)).length;
  const progress = filtered.length ? Math.round((knownCount / filtered.length) * 100) : 0;
  const emptyMessage = phrases.length
    ? showStarredOnly
      ? "お気に入りはまだありません"
      : "該当する文がありません"
    : "読み込み中";
  const sliderMin = filtered[0]?.id ?? 1;
  const sliderMax = filtered[filtered.length - 1]?.id ?? sliderMin;
  const sliderValue = active?.id ?? sliderMin;

  useEffect(() => {
    if (active) saveNumber(LAST_PHRASE_KEY, active.id);
  }, [active]);

  const move = useCallback(
    (direction: -1 | 1) => {
      setIndex((current) => {
        if (!filtered.length) return 0;
        return (current + direction + filtered.length) % filtered.length;
      });
      setFlipped(false);
      setStatus("");
    },
    [filtered.length],
  );

  const shuffle = useCallback(() => {
    if (!filtered.length) return;
    const next = Math.floor(Math.random() * filtered.length);
    setIndex(next === currentIndex && filtered.length > 1 ? (next + 1) % filtered.length : next);
    setFlipped(false);
    setStatus("");
  }, [currentIndex, filtered.length]);

  const jumpToPhraseId = useCallback(
    (phraseId: number) => {
      if (!filtered.length || !Number.isFinite(phraseId)) return;
      setIndex(findNearestIndexById(filtered, phraseId));
      setFlipped(false);
      setStatus("");
    },
    [filtered],
  );

  const toggleKnown = useCallback(() => {
    if (!active) return;
    setKnown((current) => {
      const next = new Set(current);
      if (next.has(active.id)) {
        next.delete(active.id);
      } else {
        next.add(active.id);
      }
      saveSet("english-2000-known", next);
      return next;
    });
  }, [active]);

  const toggleStarred = useCallback(() => {
    if (!active) return;
    setStarred((current) => {
      const next = new Set(current);
      if (next.has(active.id)) {
        next.delete(active.id);
      } else {
        next.add(active.id);
      }
      saveSet("english-2000-starred", next);
      return next;
    });
  }, [active]);

  const playBrowserSpeech = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) {
      setStatus("音声を再生できません");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.92;
    utterance.pitch = 1;
    const selectedVoice = pickBrowserVoice();
    if (selectedVoice) utterance.voice = selectedVoice;
    window.speechSynthesis.speak(utterance);
    setStatus("ブラウザ音声");
  }, []);

  const playSpeech = useCallback(async () => {
    if (!active) return;
    const text = active.english;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (voiceMode === "browser") {
      playBrowserSpeech(text);
      return;
    }

    setStatus("GPT音声を準備中");

    try {
      const response = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
      });

      if (!response.ok) throw new Error(String(response.status));

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      setStatus("GPT音声");
    } catch {
      playBrowserSpeech(text);
      setStatus("GPT音声未設定 / ブラウザ音声");
    }
  }, [active, playBrowserSpeech, voice, voiceMode]);

  const flipCard = useCallback(() => {
    if (!active) return;
    const nextFlipped = !flipped;
    setFlipped(nextFlipped);

    if (englishIsVisible(nextFlipped, backMode)) {
      void playSpeech();
    }
  }, [active, backMode, flipped, playSpeech]);

  const handleCardPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (!active || event.pointerType === "mouse") return;
      swipeStartRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
    },
    [active],
  );

  const handleCardPointerUp = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const start = swipeStartRef.current;
      swipeStartRef.current = null;
      if (!active || !start || start.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - start.x;
      const deltaY = event.clientY - start.y;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX >= SWIPE_DISTANCE && absX > absY * 1.25) {
        ignoreNextCardClickRef.current = true;
        event.preventDefault();
        move(deltaX < 0 ? 1 : -1);
      }
    },
    [active, move],
  );

  const handleCardClick = useCallback(() => {
    if (ignoreNextCardClickRef.current) {
      ignoreNextCardClickRef.current = false;
      return;
    }

    flipCard();
  }, [flipCard]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, select, textarea")) return;
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
      if (event.key === " ") {
        event.preventDefault();
        flipCard();
      }
      if (event.key.toLowerCase() === "p") {
        void playSpeech();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flipCard, move, playSpeech]);

  const frontLabel = backMode === "japanese" ? "A面 英語" : "A面 日本語";
  const frontText = active ? (backMode === "japanese" ? active.english : active.japanese) : "";

  const backContent = useMemo(() => {
    if (!active) return null;
    if (backMode === "english") {
      return <p className="answer-text english-text">{active.english}</p>;
    }
    if (backMode === "japanese") {
      return <p className="answer-text japanese-text">{active.japanese}</p>;
    }
    if (backMode === "memo") {
      return (
        <div className="answer-stack">
          <p className="answer-text">{active.note || active.scene}</p>
          <p className="detail-line">{active.category}</p>
        </div>
      );
    }
    return (
      <div className="answer-stack">
        <p className="answer-text english-text">{active.english}</p>
        <p className="answer-text japanese-text">{active.japanese}</p>
        <p className="detail-line">{active.note}</p>
      </div>
    );
  }, [active, backMode]);

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="学習セット">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <Languages size={22} />
          </div>
          <div>
            <p className="eyebrow">Daily English</p>
            <h1>英会話カード</h1>
          </div>
        </div>

        <div className="chapter-tabs" role="tablist" aria-label="章">
          {CHAPTERS.map((item) => (
            <button
              aria-selected={chapter === item.id}
              className={chapter === item.id ? "tab active" : "tab"}
              key={item.id}
              onClick={() => {
                setChapter(item.id);
                setCategory("all");
                setScene("all");
                resetPosition();
              }}
              role="tab"
              type="button"
            >
              <span>{item.label}</span>
              <strong>{item.title}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="workspace">
        <aside className="control-panel" aria-label="絞り込み">
          <label className="search-box">
            <Search size={18} />
            <input
              aria-label="検索"
              onChange={(event) => {
                setQuery(event.target.value);
                resetPosition();
              }}
              placeholder="検索"
              type="search"
              value={query}
            />
          </label>

          <div className="field-grid">
            <label>
              <span>カテゴリー</span>
              <select
                onChange={(event) => {
                  setCategory(event.target.value);
                  setScene("all");
                  resetPosition();
                }}
                value={category}
              >
                <option value="all">すべて</option>
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>場面</span>
              <select
                onChange={(event) => {
                  setScene(event.target.value);
                  resetPosition();
                }}
                value={scene}
              >
                <option value="all">すべて</option>
                {sceneOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mode-block">
            <span className="section-label">B面</span>
            <div className="segmented" role="tablist" aria-label="B面">
              {BACK_MODES.map((item) => (
                <button
                  aria-selected={backMode === item.id}
                  className={backMode === item.id ? "active" : ""}
                  key={item.id}
                  onClick={() => {
                    setBackMode(item.id);
                    setFlipped(false);
                  }}
                  role="tab"
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mode-block">
            <span className="section-label">音声</span>
            <div className="segmented compact" role="group" aria-label="音声">
              <button
                className={voiceMode === "gpt" ? "active" : ""}
                onClick={() => setVoiceMode("gpt")}
                type="button"
              >
                GPT
              </button>
              <button
                className={voiceMode === "browser" ? "active" : ""}
                onClick={() => setVoiceMode("browser")}
                type="button"
              >
                Browser
              </button>
            </div>
            <select
              aria-label="GPT音声"
              className="voice-select"
              onChange={(event) => setVoice(event.target.value as (typeof VOICES)[number])}
              value={voice}
            >
              {VOICES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="progress-panel">
            <div>
              <span>{filtered.length.toLocaleString()}文</span>
              <strong>{progress}%</strong>
            </div>
            <div className="progress-track" aria-hidden="true">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>

          <button
            aria-pressed={showStarredOnly}
            className={showStarredOnly ? "wide-action active" : "wide-action"}
            onClick={() => {
              setShowStarredOnly((value) => !value);
              resetPosition();
            }}
            type="button"
          >
            <Star size={17} />
            お気に入りだけ表示
          </button>
        </aside>

        <section className="study-area" aria-label="カード">
          <div className="card-toolbar">
            <div className="meta-row">
              <span>No. {active?.id ?? "-"}</span>
              <span>{active?.level ?? "-"}</span>
              <span>{active?.politeness ?? "-"}</span>
            </div>
            <div className="toolbar-actions">
              <button
                aria-label={active && starred.has(active.id) ? "お気に入りから外す" : "この文をお気に入りに追加"}
                className={active && starred.has(active.id) ? "icon-button active" : "icon-button"}
                disabled={!active}
                onClick={toggleStarred}
                title={active && starred.has(active.id) ? "お気に入りから外す" : "この文をお気に入りに追加"}
                type="button"
              >
                <Star size={19} />
              </button>
              <button
                aria-label="シャッフル"
                className="icon-button"
                disabled={!active}
                onClick={shuffle}
                title="シャッフル"
                type="button"
              >
                <Shuffle size={19} />
              </button>
              <button
                aria-label="発音"
                className="icon-button primary"
                disabled={!active}
                onClick={() => void playSpeech()}
                title="発音"
                type="button"
              >
                <Volume2 size={19} />
              </button>
            </div>
          </div>

          <button
            aria-label="カードを反転。左右スワイプで前後へ移動"
            className={flipped ? "flashcard flipped" : "flashcard"}
            disabled={!active}
            onClick={handleCardClick}
            onPointerCancel={() => {
              swipeStartRef.current = null;
            }}
            onPointerDown={handleCardPointerDown}
            onPointerUp={handleCardPointerUp}
            type="button"
          >
            <span className="card-face card-front" aria-hidden={flipped}>
              <span className="card-label">{frontLabel}</span>
              <span className={backMode === "japanese" ? "prompt english-text" : "prompt japanese-text"}>
                {frontText || emptyMessage}
              </span>
              <span className="scene-line">
                {active ? `${active.category} / ${active.scene}` : ""}
              </span>
            </span>

            <span className="card-face card-back" aria-hidden={!flipped}>
              <span className="card-label">B面 {BACK_MODES.find((item) => item.id === backMode)?.label}</span>
              {backContent}
            </span>
          </button>

          <div className="jump-panel" aria-label="番号で移動">
            <div className="jump-header">
              <span>番号</span>
              <strong>No. {active?.id ?? "-"}</strong>
            </div>
            <input
              aria-label="文番号スライダー"
              className="phrase-slider"
              disabled={!active}
              max={sliderMax}
              min={sliderMin}
              onChange={(event) => jumpToPhraseId(Number(event.target.value))}
              step={1}
              type="range"
              value={sliderValue}
            />
            <div className="jump-footer">
              <span>No. {sliderMin}</span>
              <label className="jump-number">
                <span>No.</span>
                <input
                  aria-label="文番号"
                  disabled={!active}
                  inputMode="numeric"
                  max={sliderMax}
                  min={sliderMin}
                  onChange={(event) => {
                    if (event.target.value) jumpToPhraseId(Number(event.target.value));
                  }}
                  type="number"
                  value={active?.id ?? ""}
                />
              </label>
              <span>No. {sliderMax}</span>
            </div>
          </div>

          <div className="nav-row">
            <button disabled={!active} onClick={() => move(-1)} type="button">
              <ArrowLeft size={19} />
              前へ
            </button>
            <button disabled={!active} onClick={flipCard} type="button">
              <RotateCcw size={19} />
              反転
            </button>
            <button
              className={active && known.has(active.id) ? "known active" : "known"}
              disabled={!active}
              onClick={toggleKnown}
              type="button"
            >
              <Check size={19} />
              覚えた
            </button>
            <button disabled={!active} onClick={() => move(1)} type="button">
              次へ
              <ArrowRight size={19} />
            </button>
          </div>

          <div className="phrase-strip" aria-live="polite">
            <span>
              {filtered.length ? `${currentIndex + 1} / ${filtered.length}` : "0 / 0"}
            </span>
            <span>{status}</span>
            <span>
              <Sparkles size={15} />
              {active?.chapterTitle ?? ""}
            </span>
          </div>
        </section>

        <aside className="list-panel" aria-label="フレーズ一覧">
          <div className="list-header">
            <span>一覧</span>
            <strong>{filtered.length.toLocaleString()}</strong>
          </div>
          <div className="phrase-list">
            {filtered.slice(Math.max(0, currentIndex - 18), currentIndex + 19).map((phrase) => (
              <button
                className={phrase.id === active?.id ? "row active" : "row"}
                key={phrase.id}
                onClick={() => {
                  setIndex(filtered.findIndex((item) => item.id === phrase.id));
                  setFlipped(false);
                }}
                type="button"
              >
                <span>{phrase.id}</span>
                <span>{phrase.english}</span>
                {known.has(phrase.id) ? <Check size={15} /> : null}
              </button>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
