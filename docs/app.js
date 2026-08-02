const BACK_MODES = [
  { id: "english", label: "英語" },
  { id: "japanese", label: "日本語" },
  { id: "memo", label: "メモ" },
  { id: "all", label: "全部" },
];

const SWIPE_DISTANCE = 52;
const LAST_PHRASE_KEY = "english-2000-last-phrase";

const state = {
  phrases: [],
  chapter: "1-1000",
  backMode: "english",
  query: "",
  category: "all",
  scene: "all",
  index: 0,
  flipped: false,
  known: readSet("english-2000-known"),
  starred: readSet("english-2000-starred"),
  showStarredOnly: false,
  status: "",
  swipeStart: null,
  ignoreNextClick: false,
};

const elements = {
  chapterTabs: document.querySelectorAll("[data-chapter]"),
  backModeTabs: document.querySelectorAll("[data-back-mode]"),
  query: document.querySelector("#query"),
  category: document.querySelector("#category"),
  scene: document.querySelector("#scene"),
  phraseCount: document.querySelector("#phrase-count"),
  progressValue: document.querySelector("#progress-value"),
  progressBar: document.querySelector("#progress-bar"),
  starredFilter: document.querySelector("#starred-filter"),
  phraseNo: document.querySelector("#phrase-no"),
  phraseLevel: document.querySelector("#phrase-level"),
  phrasePoliteness: document.querySelector("#phrase-politeness"),
  starButton: document.querySelector("#star-button"),
  shuffleButton: document.querySelector("#shuffle-button"),
  speechButton: document.querySelector("#speech-button"),
  flashcard: document.querySelector("#flashcard"),
  frontLabel: document.querySelector("#front-label"),
  frontText: document.querySelector("#front-text"),
  sceneLine: document.querySelector("#scene-line"),
  backLabel: document.querySelector("#back-label"),
  backContent: document.querySelector("#back-content"),
  prevButton: document.querySelector("#prev-button"),
  flipButton: document.querySelector("#flip-button"),
  knownButton: document.querySelector("#known-button"),
  nextButton: document.querySelector("#next-button"),
  position: document.querySelector("#position"),
  status: document.querySelector("#status"),
  chapterTitle: document.querySelector("#chapter-title"),
  listCount: document.querySelector("#list-count"),
  phraseList: document.querySelector("#phrase-list"),
  jumpCurrent: document.querySelector("#jump-current"),
  phraseSlider: document.querySelector("#phrase-slider"),
  jumpMin: document.querySelector("#jump-min"),
  jumpMax: document.querySelector("#jump-max"),
  jumpNumber: document.querySelector("#jump-number"),
};

function readSet(key) {
  try {
    const values = JSON.parse(localStorage.getItem(key) || "[]");
    return new Set(Array.isArray(values) ? values : []);
  } catch {
    return new Set();
  }
}

function saveSet(key, values) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(values)));
    return true;
  } catch {
    return false;
  }
}

function readNumber(key) {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function saveNumber(key, value) {
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

function findNearestIndexById(phrases, phraseId) {
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

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "ja"));
}

function chapterPhrases() {
  return state.phrases.filter((phrase) => phrase.chapter === state.chapter);
}

function sceneOptions() {
  const source =
    state.category === "all"
      ? chapterPhrases()
      : chapterPhrases().filter((phrase) => phrase.category === state.category);
  return unique(source.map((phrase) => phrase.scene));
}

function filteredPhrases() {
  const normalizedQuery = state.query.trim().toLowerCase();

  return chapterPhrases().filter((phrase) => {
    if (state.category !== "all" && phrase.category !== state.category) return false;
    if (state.scene !== "all" && phrase.scene !== state.scene) return false;
    if (state.showStarredOnly && !state.starred.has(phrase.id)) return false;
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
}

function resetPosition() {
  state.index = 0;
  state.flipped = false;
  state.status = "";
}

function activePhrase(filtered) {
  if (!filtered.length) return null;
  state.index = Math.min(state.index, filtered.length - 1);
  return filtered[state.index];
}

function renderOptions(select, options, value) {
  select.replaceChildren();

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "すべて";
  select.append(allOption);

  options.forEach((option) => {
    const item = document.createElement("option");
    item.value = option;
    item.textContent = option;
    select.append(item);
  });

  select.value = value;
}

function setText(element, text) {
  element.textContent = text || "";
}

function makeParagraph(text, className) {
  const paragraph = document.createElement("p");
  paragraph.className = className;
  paragraph.textContent = text || "";
  return paragraph;
}

function renderBackContent(active) {
  elements.backContent.replaceChildren();
  elements.backContent.className = state.backMode === "all" || state.backMode === "memo"
    ? "answer-stack"
    : "answer-stack";

  if (!active) return;

  if (state.backMode === "english") {
    elements.backContent.append(makeParagraph(active.english, "answer-text english-text"));
    return;
  }

  if (state.backMode === "japanese") {
    elements.backContent.append(makeParagraph(active.japanese, "answer-text japanese-text"));
    return;
  }

  if (state.backMode === "memo") {
    elements.backContent.append(makeParagraph(active.note || active.scene, "answer-text"));
    elements.backContent.append(makeParagraph(active.category, "detail-line"));
    return;
  }

  elements.backContent.append(makeParagraph(active.english, "answer-text english-text"));
  elements.backContent.append(makeParagraph(active.japanese, "answer-text japanese-text"));
  elements.backContent.append(makeParagraph(active.note, "detail-line"));
}

function renderList(filtered, active) {
  elements.phraseList.replaceChildren();
  const start = Math.max(0, state.index - 18);
  const visible = filtered.slice(start, state.index + 19);

  visible.forEach((phrase) => {
    const row = document.createElement("button");
    row.className = phrase.id === active?.id ? "row active" : "row";
    row.type = "button";

    const number = document.createElement("span");
    number.textContent = String(phrase.id);
    const english = document.createElement("span");
    english.textContent = phrase.english;
    const check = document.createElement("span");
    check.textContent = state.known.has(phrase.id) ? "✓" : "";

    row.append(number, english, check);
    row.addEventListener("click", () => {
      state.index = filtered.findIndex((item) => item.id === phrase.id);
      state.flipped = false;
      render();
    });

    elements.phraseList.append(row);
  });
}

function render() {
  const categories = unique(chapterPhrases().map((phrase) => phrase.category));
  const scenes = sceneOptions();

  if (state.scene !== "all" && !scenes.includes(state.scene)) {
    state.scene = "all";
  }

  renderOptions(elements.category, categories, state.category);
  renderOptions(elements.scene, scenes, state.scene);

  const filtered = filteredPhrases();
  const active = activePhrase(filtered);
  const knownCount = filtered.filter((phrase) => state.known.has(phrase.id)).length;
  const progress = filtered.length ? Math.round((knownCount / filtered.length) * 100) : 0;
  const sliderMin = filtered[0]?.id ?? 1;
  const sliderMax = filtered[filtered.length - 1]?.id ?? sliderMin;
  const sliderValue = active?.id ?? sliderMin;
  const emptyMessage = state.phrases.length
    ? state.showStarredOnly
      ? "お気に入りはまだありません"
      : "該当する文がありません"
    : "読み込み中";

  elements.chapterTabs.forEach((tab) => {
    const selected = tab.dataset.chapter === state.chapter;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });

  elements.backModeTabs.forEach((tab) => {
    const selected = tab.dataset.backMode === state.backMode;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });

  setText(elements.phraseCount, `${filtered.length.toLocaleString()}文`);
  setText(elements.progressValue, `${progress}%`);
  elements.progressBar.style.width = `${progress}%`;
  setText(elements.listCount, filtered.length.toLocaleString());

  elements.starredFilter.classList.toggle("active", state.showStarredOnly);
  elements.starredFilter.setAttribute("aria-pressed", String(state.showStarredOnly));
  elements.starredFilter.textContent = state.showStarredOnly
    ? "★ お気に入りだけ表示"
    : "☆ お気に入りだけ表示";

  setText(elements.phraseNo, `No. ${active?.id ?? "-"}`);
  setText(elements.phraseLevel, active?.level ?? "-");
  setText(elements.phrasePoliteness, active?.politeness ?? "-");

  const frontIsEnglish = state.backMode === "japanese";
  setText(elements.frontLabel, frontIsEnglish ? "A面 英語" : "A面 日本語");
  setText(elements.frontText, active ? (frontIsEnglish ? active.english : active.japanese) : emptyMessage);
  elements.frontText.className = frontIsEnglish ? "prompt english-text" : "prompt japanese-text";
  setText(elements.sceneLine, active ? `${active.category} / ${active.scene}` : "");

  const backModeLabel = BACK_MODES.find((mode) => mode.id === state.backMode)?.label ?? "";
  setText(elements.backLabel, `B面 ${backModeLabel}`);
  renderBackContent(active);

  elements.flashcard.classList.toggle("flipped", state.flipped);
  elements.flashcard.disabled = !active;
  elements.flashcard.querySelector(".card-front").setAttribute("aria-hidden", String(state.flipped));
  elements.flashcard.querySelector(".card-back").setAttribute("aria-hidden", String(!state.flipped));

  const isStarred = Boolean(active && state.starred.has(active.id));
  const isKnown = Boolean(active && state.known.has(active.id));
  elements.starButton.classList.toggle("active", isStarred);
  elements.starButton.textContent = isStarred ? "★" : "☆";
  elements.starButton.setAttribute(
    "aria-label",
    isStarred ? "お気に入りから外す" : "この文をお気に入りに追加",
  );
  elements.starButton.title = isStarred ? "お気に入りから外す" : "この文をお気に入りに追加";
  elements.knownButton.classList.toggle("active", isKnown);

  [
    elements.starButton,
    elements.shuffleButton,
    elements.speechButton,
    elements.prevButton,
    elements.flipButton,
    elements.knownButton,
    elements.nextButton,
  ].forEach((button) => {
    button.disabled = !active;
  });

  setText(elements.position, filtered.length ? `${state.index + 1} / ${filtered.length}` : "0 / 0");
  setText(elements.status, state.status);
  setText(elements.chapterTitle, active?.chapterTitle ?? "");

  setText(elements.jumpCurrent, `No. ${active?.id ?? "-"}`);
  setText(elements.jumpMin, `No. ${sliderMin}`);
  setText(elements.jumpMax, `No. ${sliderMax}`);
  elements.phraseSlider.min = String(sliderMin);
  elements.phraseSlider.max = String(sliderMax);
  elements.phraseSlider.value = String(sliderValue);
  elements.phraseSlider.disabled = !active;
  elements.jumpNumber.min = String(sliderMin);
  elements.jumpNumber.max = String(sliderMax);
  elements.jumpNumber.value = active?.id ?? "";
  elements.jumpNumber.disabled = !active;

  if (active) saveNumber(LAST_PHRASE_KEY, active.id);

  renderList(filtered, active);
}

function englishIsVisible(nextFlipped) {
  if (nextFlipped) return state.backMode === "english" || state.backMode === "all";
  return state.backMode === "japanese";
}

function pickBrowserVoice() {
  const voices = speechSynthesis.getVoices?.() || [];
  return (
    voices.find((voice) => voice.lang === "en-US" && /natural|premium|siri|ava|jenny|aria/i.test(voice.name)) ||
    voices.find((voice) => voice.lang === "en-US") ||
    voices.find((voice) => voice.lang.startsWith("en-")) ||
    null
  );
}

function playSpeech() {
  const active = activePhrase(filteredPhrases());
  if (!active || !("speechSynthesis" in window)) {
    state.status = "音声を再生できません";
    render();
    return;
  }

  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(active.english);
  utterance.lang = "en-US";
  utterance.rate = 0.92;
  utterance.pitch = 1;

  const voice = pickBrowserVoice();
  if (voice) utterance.voice = voice;

  utterance.onend = () => {
    state.status = "";
    render();
  };

  speechSynthesis.speak(utterance);
  state.status = "音声";
  render();
}

function flipCard() {
  if (!activePhrase(filteredPhrases())) return;
  state.flipped = !state.flipped;
  const shouldPlaySpeech = englishIsVisible(state.flipped);
  render();
  if (shouldPlaySpeech) playSpeech();
}

function move(direction) {
  const filtered = filteredPhrases();
  if (!filtered.length) return;
  state.index = (state.index + direction + filtered.length) % filtered.length;
  state.flipped = false;
  state.status = "";
  render();
}

function jumpToPhraseId(phraseId) {
  const filtered = filteredPhrases();
  if (!filtered.length || !Number.isFinite(phraseId)) return;
  state.index = findNearestIndexById(filtered, phraseId);
  state.flipped = false;
  state.status = "";
  render();
}

function shuffle() {
  const filtered = filteredPhrases();
  if (!filtered.length) return;
  const next = Math.floor(Math.random() * filtered.length);
  state.index = next === state.index && filtered.length > 1 ? (next + 1) % filtered.length : next;
  state.flipped = false;
  state.status = "";
  render();
}

function toggleKnown() {
  const active = activePhrase(filteredPhrases());
  if (!active) return;

  if (state.known.has(active.id)) {
    state.known.delete(active.id);
  } else {
    state.known.add(active.id);
  }
  if (!saveSet("english-2000-known", state.known)) {
    state.status = "保存できませんでした";
  }
  render();
}

function toggleStarred() {
  const active = activePhrase(filteredPhrases());
  if (!active) return;

  if (state.starred.has(active.id)) {
    state.starred.delete(active.id);
  } else {
    state.starred.add(active.id);
  }
  state.status = saveSet("english-2000-starred", state.starred) ? "" : "保存できませんでした";
  render();
}

function wireEvents() {
  elements.chapterTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      state.chapter = tab.dataset.chapter;
      state.category = "all";
      state.scene = "all";
      resetPosition();
      render();
    });
  });

  elements.backModeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      state.backMode = tab.dataset.backMode;
      state.flipped = false;
      state.status = "";
      render();
    });
  });

  elements.query.addEventListener("input", (event) => {
    state.query = event.target.value;
    resetPosition();
    render();
  });

  elements.category.addEventListener("change", (event) => {
    state.category = event.target.value;
    state.scene = "all";
    resetPosition();
    render();
  });

  elements.scene.addEventListener("change", (event) => {
    state.scene = event.target.value;
    resetPosition();
    render();
  });

  elements.starredFilter.addEventListener("click", () => {
    state.showStarredOnly = !state.showStarredOnly;
    resetPosition();
    render();
  });

  elements.starButton.addEventListener("click", toggleStarred);
  elements.shuffleButton.addEventListener("click", shuffle);
  elements.speechButton.addEventListener("click", playSpeech);
  elements.prevButton.addEventListener("click", () => move(-1));
  elements.nextButton.addEventListener("click", () => move(1));
  elements.flipButton.addEventListener("click", flipCard);
  elements.knownButton.addEventListener("click", toggleKnown);
  elements.phraseSlider.addEventListener("input", (event) => {
    jumpToPhraseId(Number(event.target.value));
  });
  elements.jumpNumber.addEventListener("input", (event) => {
    if (event.target.value) jumpToPhraseId(Number(event.target.value));
  });

  elements.flashcard.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    state.swipeStart = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  });

  elements.flashcard.addEventListener("pointercancel", () => {
    state.swipeStart = null;
  });

  elements.flashcard.addEventListener("pointerup", (event) => {
    const start = state.swipeStart;
    state.swipeStart = null;
    if (!start || start.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX >= SWIPE_DISTANCE && absX > absY * 1.25) {
      state.ignoreNextClick = true;
      event.preventDefault();
      move(deltaX < 0 ? 1 : -1);
    }
  });

  elements.flashcard.addEventListener("click", () => {
    if (state.ignoreNextClick) {
      state.ignoreNextClick = false;
      return;
    }
    flipCard();
  });

  window.addEventListener("keydown", (event) => {
    if (event.target?.matches?.("input, select, textarea")) return;
    if (event.key === "ArrowLeft") move(-1);
    if (event.key === "ArrowRight") move(1);
    if (event.key === " ") {
      event.preventDefault();
      flipCard();
    }
    if (event.key.toLowerCase() === "p") playSpeech();
  });
}

async function boot() {
  wireEvents();

  try {
    const response = await fetch("./phrases-v5.json");
    if (!response.ok) throw new Error(String(response.status));
    state.phrases = await response.json();

    const lastPhraseId = readNumber(LAST_PHRASE_KEY);
    const lastPhrase = lastPhraseId
      ? state.phrases[findNearestIndexById(state.phrases, lastPhraseId)]
      : null;
    if (lastPhrase) {
      state.chapter = lastPhrase.chapter;
      state.index = findNearestIndexById(chapterPhrases(), lastPhrase.id);
      state.status = lastPhrase.id === lastPhraseId ? "前回の続きから再開" : "前回の近くから再開";
    }

    render();
  } catch {
    state.status = "データを読み込めませんでした";
    render();
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}

boot();
