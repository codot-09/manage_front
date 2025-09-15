// CONFIG
const API_BASE = "https://api.managelc.uz";
const API_START = `${API_BASE}/api/test/startTest`;
const API_RESULT_FALLBACK = `${API_BASE}/api/test/result`; // optional
const token = localStorage.getItem("token");

if (!token) {
  location.href = "/login";
}

// STATE
let mediaStream = null;
let audioSegments = []; // { questionId, blob }
let finalTranscripts = []; // { questionId, transcript }
let currentQuestion = null;
let recognition = null;
let partialTranscript = "";
let timerInterval = null;
let timerTotal = 0;
let timerLeft = 0;

// UI
const startOverlay = document.getElementById("startOverlay");
const startBtn = document.getElementById("startBtn");
const testContainer = document.getElementById("testContainer");
const questionTextEl = document.getElementById("questionText");
const imageContainer = document.getElementById("imageContainer");
const partNameEl = document.getElementById("partName");
const timerNumberEl = document.getElementById("timerNumber");
const timerProgressEl = document.querySelector(".timer-progress");
const timerCircleEl = document.getElementById("timerCircle");
const endOverlay = document.getElementById("endOverlay");
const endInfo = document.getElementById("endInfo");
const toDashboardBtn = document.getElementById("toDashboard");
const transcriptEl = document.getElementById("transcriptDisplay");

// Ensure transcript element exists; create if not
if (!transcriptEl) {
  transcriptEl = document.createElement("div");
  transcriptEl.id = "transcriptDisplay";
  transcriptEl.style.cssText = "font-size: 18px; color: #007bff; margin-top: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; min-height: 20px; display: none;";
  if (questionTextEl && questionTextEl.parentNode) {
    questionTextEl.parentNode.insertBefore(transcriptEl, questionTextEl.nextSibling);
  } else {
    testContainer.appendChild(transcriptEl);
  }
}

// START
startBtn.addEventListener("click", async () => {
  startOverlay.classList.add("hidden");
  testContainer.classList.remove("hidden");
  blockCheatActions();
  try {
    await initMedia();
  } catch (e) {
    alert("Microphone access is required.");
    location.href = "/dashboard";
    return;
  }
  const started = startRecognition();
  if (!started) {
    alert("Speech recognition is not supported in your browser. Please use a compatible browser.");
    location.href = "/dashboard";
    return;
  }
  // first call: no body
  await startTest(null);
});

// prevent cheating (copy/refresh/leave)
function blockCheatActions() {
  document.addEventListener("copy", e => e.preventDefault());
  document.addEventListener("cut", e => e.preventDefault());
  document.addEventListener("contextmenu", e => e.preventDefault());
  document.addEventListener("selectstart", e => e.preventDefault());
  window.addEventListener("beforeunload", e => { e.preventDefault(); e.returnValue = ""; });
  document.addEventListener("keydown", (e) => {
    if (e.key === "F5" || (e.ctrlKey && (e.key === "r" || e.key === "R" || e.key === "w")) ) e.preventDefault();
    if (e.metaKey && (e.key === "r" || e.key === "R")) e.preventDefault();
  });
}

// init microphone only once (keep stream)
async function initMedia() {
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
}

// SpeechRecognition (collect transcript but do NOT show) - now with real-time display update
function startRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return false;
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.onresult = (ev) => {
    let interim = "";
    let final = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) final += r[0].transcript + " ";
      else interim += r[0].transcript;
    }
    partialTranscript = (final + interim).trim();
    // Real-time update to UI if element exists
    if (transcriptEl) {
      transcriptEl.textContent = partialTranscript;
    }
  };
  recognition.onerror = (e) => { 
    console.warn("SpeechRecognition error", e); 
    // Optionally restart on error
    try { recognition.start(); } catch (err) {}
  };
  recognition.onend = () => {
    // Restart to keep continuous
    try { recognition.start(); } catch (err) {}
  };
  try { recognition.start(); return true; } catch (e) { return false; }
}

// START / NEXT question
async function startTest(answerText, retries = 3) {
  const body = {};
  if (currentQuestion && answerText !== null) {
    body.questionId = currentQuestion.id;
    body.answer = answerText;
  }

  const options = {
    method: "POST",
    headers: { "accept": "*/*", "Authorization": `Bearer ${token}` }
  };
  if (Object.keys(body).length) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const r = await fetch(API_START, options);
      const res = await r.json();
      if (!res || !res.success) throw new Error("Invalid response");

      // Check if response indicates test completion (contains totalQuestions or percentage)
      if (!res.data || res.data.totalQuestions !== undefined || res.data.percentage !== undefined) {
        await onTestFinished(res);
        return;
      }

      const q = res.data;
      showQuestion(q);
      return;
    } catch (err) {
      console.error(`startTest attempt ${attempt} failed`, err);
      if (attempt === retries) {
        await finishByError();
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
    }
  }
}

// render question and auto-run think->speak
function showQuestion(q) {
  currentQuestion = q;

  // faqat Part qismi (categoryName chiqadi)
  partNameEl.textContent = q.categoryName || "—";
  questionTextEl.textContent = q.question || "—";

  imageContainer.innerHTML = "";
  if (Array.isArray(q.imgUrls) && q.imgUrls.length) {
    q.imgUrls.forEach(url => {
      const img = document.createElement("img");
      img.src = url;
      img.alt = "Question image";
      imageContainer.appendChild(img);
    });
  }

  // Hide transcript display for new question
  if (transcriptEl) {
    transcriptEl.style.display = "none";
    transcriptEl.textContent = "";
  }

  // reset partial transcript then start
  partialTranscript = "";

  const thinkSeconds = Number(q.timeToThink || 5);
  const speakSeconds = Number(q.timeToComplete || 30);
  startThinkThenSpeak(thinkSeconds, speakSeconds);
}

// think -> speak sequence
async function startThinkThenSpeak(thinkSeconds, speakSeconds) {
  // Hide transcript during think phase
  if (transcriptEl) {
    transcriptEl.style.display = "none";
    transcriptEl.textContent = "";
  }

  // Think
  await runTimer(thinkSeconds, false);

  // Speak: start per-question recorder + set partialTranscript="" + show transcript display
  const recorder = startRecordingForQuestion(currentQuestion.id);
  partialTranscript = "";
  if (transcriptEl) {
    transcriptEl.style.display = "block";
    transcriptEl.textContent = "";
  }
  await runTimer(speakSeconds, true);

  // finish speak: stop recorder, get blob
  const blob = await stopRecordingForQuestion(recorder);
  const transcriptText = partialTranscript || ""; // may be empty if SpeechRecognition not available
  if (!transcriptText.trim()) {
    console.warn("No transcript captured for question:", currentQuestion.id);
    // Optionally, you can add user notification here if needed
  }
  finalTranscripts.push({ questionId: currentQuestion.id, transcript: transcriptText });

  if (blob) audioSegments.push({ questionId: currentQuestion.id, blob });

  // automatically call next (server will respond with next question or finish)
  await startTest(transcriptText);
}

// run countdown and update svg progress; resolves when complete
function runTimer(seconds, isSpeak) {
  return new Promise((resolve) => {
    clearInterval(timerInterval);
    timerTotal = seconds;
    timerLeft = seconds;
    const r = 52;
    const circumference = 2 * Math.PI * r;
    timerProgressEl.style.strokeDasharray = `${circumference}`;
    timerProgressEl.style.strokeDashoffset = `${circumference}`;
    setTimerNumber(timerLeft);
    if (isSpeak) timerCircleEl.classList.add("speaking"); else timerCircleEl.classList.remove("speaking");

    timerInterval = setInterval(() => {
      timerLeft--;
      if (timerLeft < 0) timerLeft = 0;
      const progress = ((timerTotal - timerLeft) / timerTotal);
      const offset = circumference * (1 - progress);
      timerProgressEl.style.strokeDashoffset = offset;
      setTimerNumber(timerLeft);

      // visual warnings for speaking phase
      if (isSpeak && timerLeft <= 5 && timerLeft > 0) timerCircleEl.classList.add("warning");
      if (isSpeak && timerLeft === 0) {
        timerCircleEl.classList.remove("warning");
        timerCircleEl.classList.add("final");
        setTimeout(() => timerCircleEl.classList.remove("final"), 400);
      }

      if (timerLeft <= 0) {
        clearInterval(timerInterval);
        resolve();
      }
    }, 1000);
  });
}

function setTimerNumber(n) {
  timerNumberEl.textContent = String(n).padStart(2, "0");
}

// per-question recorder helpers
function startRecordingForQuestion(questionId) {
  if (!mediaStream) return null;
  let mime = 'audio/webm';
  if (!MediaRecorder.isTypeSupported(mime)) {
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mime = 'audio/webm;codecs=opus';
    else if (MediaRecorder.isTypeSupported('audio/ogg')) mime = 'audio/ogg';
    else {
      console.warn("No supported audio format for recording.");
      return null;
    }
  }
  const recorder = new MediaRecorder(mediaStream, { mimeType: mime });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  recorder.start();
  recorder._chunks = chunks;
  return recorder;
}

function stopRecordingForQuestion(recorder) {
  return new Promise((resolve) => {
    if (!recorder) return resolve(null);
    recorder.onstop = () => {
      const blob = new Blob(recorder._chunks || [], { type: recorder.mimeType || 'audio/webm' });
      resolve(blob);
    };
    try { recorder.stop(); } catch (e) { resolve(null); }
  });
}

// when test finishes: cleanup and show end overlay
async function onTestFinished(res) {
  // Hide transcript display
  if (transcriptEl) {
    transcriptEl.style.display = "none";
  }
  try { if (recognition) recognition.stop(); } catch (e) {}
  try { if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; } } catch (e) {}
  // try to get final result from fallback endpoint
  let finalData = res?.data || null;
  if (!finalData) {
    try {
      const r = await fetch(API_RESULT_FALLBACK, { headers: { "accept": "*/*", "Authorization": `Bearer ${token}` } });
      const j = await r.json();
      if (j && j.success && j.data) finalData = j.data;
    } catch (e) { /* ignore */ }
  }

  // create download links for audio & transcripts (only now)
  endInfo.innerHTML = "";
  if (finalData) {
    endInfo.innerHTML += `<p><strong>Score:</strong> ${finalData.percentage ?? "—"}%</p>
      <p><strong>Status:</strong> ${finalData.status ?? "—"}</p>
      <p><strong>Date:</strong> ${finalData.localDate ?? "—"}</p>`;
  } else {
    endInfo.innerHTML += `<p>Your test is finished. Results will appear on dashboard.</p>`;
  }

  if (audioSegments.length) {
    const all = audioSegments.map(s => s.blob);
    const combined = new Blob(all, { type: all[0]?.type || 'audio/webm' });
    const url = URL.createObjectURL(combined);
    const a = document.createElement("a");
    a.className = "btn";
    a.textContent = "Download audio";
    a.href = url;
    a.download = `speaking-audio.webm`;
    a.style.marginRight = "8px";
    endInfo.appendChild(a);
  }

  if (finalTranscripts.length) {
    const tb = new Blob([JSON.stringify(finalTranscripts, null, 2)], { type: 'application/json' });
    const turl = URL.createObjectURL(tb);
    const a2 = document.createElement("a");
    a2.className = "btn";
    a2.textContent = "Download transcripts";
    a2.href = turl;
    a2.download = `transcripts.json`;
    endInfo.appendChild(a2);
  }

  endOverlay.classList.remove("hidden");

  toDashboardBtn.onclick = () => {
    // revoke object URLs
    const links = endInfo.querySelectorAll("a");
    links.forEach(l => URL.revokeObjectURL(l.href));
    location.href = "/dashboard";
  };

  // remove beforeunload blocking so user can leave
  window.onbeforeunload = null;
}

// fallback finish on error
async function finishByError() {
  if (transcriptEl) {
    transcriptEl.style.display = "none";
  }
  endInfo.innerHTML = `<p>Network error. Test ended.</p>`;
  endOverlay.classList.remove("hidden");
  window.onbeforeunload = null;
}

// show start overlay
startOverlay.classList.remove("hidden");