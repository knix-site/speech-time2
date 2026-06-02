// ─────────────────────────────────────────────
//  TAB SWITCHING
// ─────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.querySelector('[onclick="switchTab(\'' + name + '\')"]').classList.add("active");
  document.getElementById("page-" + name).classList.remove("hidden");
}

// ─────────────────────────────────────────────
//  OFFLINE AI TRANSLATOR (Transformers.js)
// ─────────────────────────────────────────────
let aiTranslator   = null;
let aiLoading      = false;
let aiReady        = false;
let aiLoadPromise  = null;

const modelStatusEl = document.getElementById("model-status");
const modelBarEl    = document.getElementById("model-bar");
const modelBarFill  = document.getElementById("model-bar-fill");
const modelPct      = document.getElementById("model-pct");

function showModelStatus(msg, pct = null) {
  if (!modelStatusEl) return;
  modelStatusEl.style.display = "flex";
  modelStatusEl.querySelector(".model-status-text").textContent = msg;
  if (pct !== null) {
    modelBarEl.style.display = "block";
    modelBarFill.style.width = pct + "%";
    modelPct.textContent     = Math.round(pct) + "%";
  }
}

function hideModelStatus() {
  if (modelStatusEl) modelStatusEl.style.display = "none";
}

async function loadAIModel() {
  if (aiReady || aiLoading) return aiLoadPromise;
  aiLoading     = true;
  aiLoadPromise = (async () => {
    try {
      showModelStatus("🤖 AI model yuklanmoqda... (bir martalik)", 0);

      const { pipeline, env } = await import(
        "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1/dist/transformers.min.js"
      );

      // Model fayllarini keshda saqlash
      env.allowLocalModels  = false;
      env.useBrowserCache   = true;

      aiTranslator = await pipeline(
        "translation",
        "Xenova/nllb-200-distilled-600M",
        {
          progress_callback: (p) => {
            if (p.status === "downloading") {
              const pct = p.total > 0 ? (p.loaded / p.total) * 100 : 0;
              showModelStatus(
                `📥 Yuklanmoqda: ${p.file?.split("/").pop() || "..."}`,
                pct
              );
            } else if (p.status === "loading") {
              showModelStatus("⚙️ Model ishga tushirilmoqda...", 95);
            }
          }
        }
      );

      aiReady   = true;
      aiLoading = false;
      showModelStatus("✅ AI model tayyor! Offline tarjima ishlaydi.", 100);
      setTimeout(hideModelStatus, 2500);
      return true;
    } catch (e) {
      aiLoading = false;
      console.error("AI model yuklanmadi:", e);
      showModelStatus("⚠️ AI model yuklanmadi. Internet tarjimasi ishlatiladi.");
      setTimeout(hideModelStatus, 3000);
      return false;
    }
  })();
  return aiLoadPromise;
}

// Sahifa ochilishi bilan model yuklanishni boshlash
window.addEventListener("load", () => {
  setTimeout(loadAIModel, 1500);
});

// ─────────────────────────────────────────────
//  TRANSLATE PAGE
// ─────────────────────────────────────────────
let recognition    = null;
let isRecording    = false;
let fullTranscript = "";
let translateTimer = null;
let lastTranslated = "";

const transcriptEl  = document.getElementById("transcript");
const tPh           = document.getElementById("t-ph");
const translationEl = document.getElementById("translation");
const trPh          = document.getElementById("tr-ph");
const dots          = document.getElementById("dots");
const wordCountEl   = document.getElementById("word-count");
const micBtn        = document.getElementById("mic-btn");
const micStatus     = document.getElementById("mic-status");
const micHint       = document.getElementById("mic-hint");
const errEl         = document.getElementById("err");

function showErr(msg) {
  errEl.textContent   = msg;
  errEl.style.display = "block";
  setTimeout(() => { errEl.style.display = "none"; }, 5000);
}

// Internet bor-yo'qligini tekshirish
async function isOnline() {
  try {
    await fetch("https://www.google.com/favicon.ico", {
      method: "HEAD", cache: "no-store", mode: "no-cors",
      signal: AbortSignal.timeout(2000)
    });
    return true;
  } catch { return false; }
}

// Google Translate orqali tarjima
async function translateOnline(text) {
  const url = "https://translate.googleapis.com/translate_a/single" +
    "?client=gtx&sl=en&tl=uz&dt=t&q=" + encodeURIComponent(text);
  const res  = await fetch(url);
  const data = await res.json();
  return data[0].map(s => s[0]).join("");
}

// AI model orqali tarjima (offline)
async function translateOffline(text) {
  if (!aiReady) {
    showModelStatus("🤖 AI model yuklanmoqda, kuting...", 0);
    await loadAIModel();
  }
  if (!aiReady) throw new Error("AI model mavjud emas");
  const result = await aiTranslator(text, {
    src_lang: "eng_Latn",   // Inglizcha
    tgt_lang: "uzb_Latn",   // O'zbekcha (lotin)
    max_new_tokens: 400
  });
  return result[0].translation_text;
}

// Asosiy tarjima funksiyasi — smart fallback
async function translate(text) {
  if (!text.trim() || text === lastTranslated) return;
  lastTranslated = text;
  trPh.style.display = "none";
  dots.classList.add("active");

  try {
    const online = await isOnline();
    let result   = "";

    if (online) {
      // Internet bor — Google Translate
      result = await translateOnline(text);
    } else if (aiReady) {
      // Offline — AI model
      result = await translateOffline(text);
    } else {
      // AI ham tayyor emas — kutish
      dots.classList.remove("active");
      showErr("📡 Internet yo'q. AI model hali yuklanmoqda...");
      await loadAIModel();
      if (aiReady) {
        dots.classList.add("active");
        result = await translateOffline(text);
      } else {
        showErr("❌ Tarjima qilib bo'lmadi. Internetga ulanib qayta urinib ko'ring.");
        return;
      }
    }

    dots.classList.remove("active");
    if (result) {
      translationEl.textContent = result;
      // Qaysi usul ishlatilganini ko'rsatish
      const badge = online ? "" : " 🤖";
      if (badge) {
        const b = document.createElement("span");
        b.className   = "translate-badge";
        b.textContent = "Offline AI";
        translationEl.appendChild(b);
      }
    }
  } catch (e) {
    dots.classList.remove("active");
    console.error(e);
    showErr("Tarjimada xatolik yuz berdi.");
  }
}

function updateTranscript(text) {
  tPh.style.display        = "none";
  transcriptEl.textContent = text;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  wordCountEl.textContent  = words > 0 ? words + " so'z" : "";
  clearTimeout(translateTimer);
  translateTimer = setTimeout(() => { if (text.trim()) translate(text); }, 1000);
}

function toggleRecording() {
  isRecording ? stopRecording() : startRecording();
}

function startRecording() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showErr("Chrome ishlatib ko'ring."); return; }
  recognition = new SR();
  recognition.lang           = "en-US";
  recognition.continuous     = true;
  recognition.interimResults = true;
  recognition.onstart = () => {
    isRecording = true;
    micBtn.classList.add("rec");
    micStatus.textContent = "Tinglayapman...";
    micStatus.classList.add("active");
    micHint.textContent = "To'xtatish uchun bosing";
  };
  recognition.onresult = (e) => {
    let interim = "", final = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final   += e.results[i][0].transcript + " ";
      else                      interim += e.results[i][0].transcript;
    }
    if (final) fullTranscript += final;
    updateTranscript(fullTranscript + interim);
  };
  recognition.onerror = (e) => {
    if (e.error === "not-allowed") showErr("Mikrofonga ruxsat berilmadi.");
    else if (e.error !== "no-speech") showErr("Xatolik: " + e.error);
    stopRecording();
  };
  recognition.onend = () => { if (isRecording) recognition.start(); };
  recognition.start();
}

function stopRecording() {
  isRecording = false;
  if (recognition) { recognition.onend = null; recognition.stop(); recognition = null; }
  micBtn.classList.remove("rec");
  micStatus.textContent = "Tayyor";
  micStatus.classList.remove("active");
  micHint.textContent = "Gapirish uchun bosing";
  if (fullTranscript.trim()) translate(fullTranscript.trim());
}

function clearAll() {
  fullTranscript = ""; lastTranslated = "";
  transcriptEl.textContent  = "";
  translationEl.textContent = "";
  tPh.style.display  = "";
  trPh.style.display = "";
  wordCountEl.textContent = "";
  dots.classList.remove("active");
  if (isRecording) stopRecording();
}

// ─────────────────────────────────────────────
//  PRONUNCIATION PAGE
// ─────────────────────────────────────────────
let pRecognition = null;
let pIsRecording = false;
let targetPhrase = "";

const pMicBtn     = document.getElementById("p-mic-btn");
const pMicStatus  = document.getElementById("p-mic-status");
const pMicHint    = document.getElementById("p-mic-hint");
const pErrEl      = document.getElementById("p-err");
const practiceArea= document.getElementById("practice-area");
const scoreArea   = document.getElementById("score-area");
const saidTextEl  = document.getElementById("said-text");
const scoreNum    = document.getElementById("score-num");
const scoreCircle = document.querySelector(".score-circle");
const scoreLbl    = document.getElementById("score-label");
const scoreDetail = document.getElementById("score-detail");

function showPErr(msg) {
  pErrEl.textContent   = msg;
  pErrEl.style.display = "block";
  setTimeout(() => { pErrEl.style.display = "none"; }, 5000);
}

function startPractice() {
  const val = document.getElementById("phrase-input").value.trim();
  if (!val) { showPErr("Iltimos ibora kiriting."); return; }
  targetPhrase = val;
  document.getElementById("target-phrase").textContent = val;
  practiceArea.classList.remove("hidden");
  scoreArea.classList.add("hidden");
  saidTextEl.innerHTML = '<span class="ph">Quyidagi tugmani bosing...</span>';
  speakCorrect(val);
}

function resetPractice() {
  scoreArea.classList.add("hidden");
  saidTextEl.innerHTML = '<span class="ph">Quyidagi tugmani bosing...</span>';
  if (pIsRecording) stopPronounce();
}

function togglePronounce() {
  pIsRecording ? stopPronounce() : startPronounce();
}

function startPronounce() {
  if (!targetPhrase) { showPErr("Avval ibora kiriting."); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showPErr("Chrome ishlatib ko'ring."); return; }

  pRecognition = new SR();
  pRecognition.lang           = "en-US";
  pRecognition.continuous     = false;
  pRecognition.interimResults = true;

  pRecognition.onstart = () => {
    pIsRecording = true;
    pMicBtn.classList.add("rec");
    pMicStatus.textContent = "Tinglayapman...";
    pMicStatus.classList.add("active");
    pMicHint.textContent = "Gapiring...";
    scoreArea.classList.add("hidden");
    saidTextEl.textContent = "";
  };

  pRecognition.onresult = (e) => {
    let text = "";
    for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
    saidTextEl.textContent = text;
  };

  pRecognition.onend = () => {
    const said = saidTextEl.textContent.trim();
    if (said) {
      scorePronounciation(targetPhrase, said);
      speakCorrect(targetPhrase);
    }
    stopPronounce();
  };

  pRecognition.onerror = (e) => {
    if (e.error === "not-allowed") showPErr("Mikrofonga ruxsat berilmadi.");
    else if (e.error !== "no-speech") showPErr("Xatolik: " + e.error);
    stopPronounce();
  };

  pRecognition.start();
}

function stopPronounce() {
  pIsRecording = false;
  if (pRecognition) { pRecognition.stop(); pRecognition = null; }
  pMicBtn.classList.remove("rec");
  pMicStatus.textContent = "Tayyor";
  pMicStatus.classList.remove("active");
  pMicHint.textContent = "Iborani aytish uchun bosing";
}

// ─────────────────────────────────────────────
//  TEXT-TO-SPEECH
// ─────────────────────────────────────────────
function speakCorrect(text) {
  if (!text) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang  = "en-US";
  utter.rate  = 0.85;
  utter.pitch = 1;
  const voices   = window.speechSynthesis.getVoices();
  const enVoice  = voices.find(v =>
    v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Female"))
  ) || voices.find(v => v.lang.startsWith("en"));
  if (enVoice) utter.voice = enVoice;
  window.speechSynthesis.speak(utter);
}

if (typeof window.speechSynthesis !== "undefined") {
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

// ─────────────────────────────────────────────
//  SCORING ALGORITHM
// ─────────────────────────────────────────────
function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function levenshtein(a, b) {
  const dp = Array.from({length: a.length + 1}, (_, i) =>
    Array.from({length: b.length + 1}, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[a.length][b.length];
}

function wordScore(target, said) {
  const tWords = normalize(target).split(" ");
  const sWords = normalize(said).split(" ").slice();
  let matched  = 0;
  tWords.forEach(tw => {
    const idx = sWords.findIndex(sw =>
      sw === tw || levenshtein(tw, sw) <= Math.floor(tw.length * 0.35)
    );
    if (idx !== -1) { matched++; sWords.splice(idx, 1); }
  });
  return matched / tWords.length;
}

function scorePronounciation(target, said) {
  const ratio = wordScore(target, said);
  const score = Math.max(1, Math.min(10, Math.round(ratio * 10)));

  scoreNum.textContent = score;
  scoreCircle.classList.remove("good", "medium", "bad");

  if (score >= 8) {
    scoreCircle.classList.add("good");
    scoreLbl.textContent = "Ajoyib! Talaffuzingiz juda yaxshi";
  } else if (score >= 5) {
    scoreCircle.classList.add("medium");
    scoreLbl.textContent = "Yomon emas, lekin mashq kerak";
  } else {
    scoreCircle.classList.add("bad");
    scoreLbl.textContent = "Ko'proq mashq qiling";
  }

  const tWords = normalize(target).split(" ");
  const sWords = normalize(said).split(" ").slice();
  const missed = tWords.filter(tw =>
    !sWords.some(sw => sw === tw || levenshtein(tw, sw) <= Math.floor(tw.length * 0.35))
  );

  scoreDetail.textContent = missed.length > 0
    ? "Qiyin bo'lgan so'zlar: " + missed.join(", ")
    : "Barcha so'zlar to'g'ri talaffuz qilindi!";

  scoreArea.classList.remove("hidden");
}
