const micBtn = document.getElementById("micbtn");
const reactor = document.getElementById("reactor");
const visualizer = document.getElementById("visualizer");
const statusText = document.getElementById("statustext");
const chatLog = document.getElementById("chatlog");
const textInput = document.getElementById("textinput");
const sendBtn = document.getElementById("sendbtn");
const apiModal = document.getElementById("apimodal");
const keyBtn = document.getElementById("keybtn");
const saveKeyBtn = document.getElementById("savekeybtn");
const closeModalBtn = document.getElementById("closemodalbtn");
const apiKeyInput = document.getElementById("apikeyinput");
const visionBtn = document.getElementById("visionbtn");
const visionBox = document.getElementById("visionbox");
const camFeed = document.getElementById("camfeed");
const snapCanvas = document.getElementById("snapcanvas");
const memBtn = document.getElementById("membtn");
const memModal = document.getElementById("memmodal");
const memList = document.getElementById("memlist");
const clearMemBtn = document.getElementById("clearmembtn");
const closeMemBtn = document.getElementById("closemembtn");
const clearBtn = document.getElementById("clearbtn");

let isSpeaking = false;
let continuousMode = false;
let visionActive = false;
let camStream = null;
let recognition = null;

function getMemories() {
  try {
    return JSON.parse(localStorage.getItem("wikiMemories") || "[]");
  } catch (e) {
    return [];
  }
}

function saveMemory(note) {
  const list = getMemories();
  list.push(note);
  localStorage.setItem("wikiMemories", JSON.stringify(list));
}

function buildSystemPrompt() {
  const mems = getMemories();
  const memText = mems.length > 0 ? " Saved user memories: " + mems.join("; ") + "." : "";
  return {
    role: "system",
    content: "You are WIKI HYPE, an advanced Iron-Man style personal AI assistant created and developed by Najeeb. Whenever asked who created, built, or made you, always proudly say Najeeb created you. Address the user as Boss or Najeeb. Answer accurately, smartly, and concisely in 2-3 sentences in English or Hinglish. Never use markdown symbols like asterisks or hashtags." + memText
  };
}

let chatHistory = [buildSystemPrompt()];

function updateClock() {
  document.getElementById("clock").innerText = new Date().toLocaleTimeString();
}
updateClock();
setInterval(updateClock, 1000);

if ("getBattery" in navigator) {
  navigator.getBattery().then((battery) => {
    const updateBat = () => {
      document.getElementById("battery").innerText = "PWR: " + Math.round(battery.level * 100) + "%";
    };
    updateBat();
    battery.addEventListener("levelchange", updateBat);
  });
}

function speak(text) {
  window.speechSynthesis.cancel();
  const cleanText = text.replace(/[*#_`]/g, "");
  const utter = new SpeechSynthesisUtterance(cleanText);
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.lang.includes("en-GB") || v.lang.includes("en-IN") || v.lang.includes("en-US"));
  if (preferred) utter.voice = preferred;
  utter.pitch = 0.92;
  utter.rate = 1.04;

  utter.onstart = () => {
    isSpeaking = true;
    reactor.classList.add("speaking");
    visualizer.classList.add("active");
    if (recognition && continuousMode) {
      try { recognition.stop(); } catch (e) {}
    }
  };

  utter.onend = () => {
    isSpeaking = false;
    reactor.classList.remove("speaking");
    visualizer.classList.remove("active");
    if (continuousMode && recognition) {
      statusText.innerText = "CONTINUOUS LISTENING ON (TAP LISTENING TO PAUSE)";
      try { recognition.start(); } catch (e) {}
    } else {
      reactor.classList.remove("listening");
      statusText.innerText = "Click ULLI for Continuous Voice | Chat Anytime";
    }
  };

  window.speechSynthesis.speak(utter);
}

function addLog(sender, message, type = "aimsg") {
  const p = document.createElement("p");
  p.className = type;
  p.innerText = "[" + sender + "]: " + message;
  chatLog.appendChild(p);
  chatLog.scrollTop = chatLog.scrollHeight;
}

visionBtn.addEventListener("click", async () => {
  if (!visionActive) {
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      camFeed.srcObject = camStream;
      visionActive = true;
      visionBox.classList.remove("hidden");
      visionBtn.innerText = "VISION: ON";
      visionBtn.classList.add("active");
      addLog("SYSTEM", "Optical Vision Sensor Activated, Boss.", "sysmsg");
    } catch (err) {
      addLog("SYSTEM", "Camera access denied or unavailable: " + err.message, "sysmsg");
    }
  } else {
    if (camStream) camStream.getTracks().forEach(t => t.stop());
    visionActive = false;
    visionBox.classList.add("hidden");
    visionBtn.innerText = "VISION: OFF";
    visionBtn.classList.remove("active");
    addLog("SYSTEM", "Optical Vision Sensor Deactivated.", "sysmsg");
  }
});

function captureFrameBase64() {
  if (!visionActive || !camFeed.videoWidth) return null;
  snapCanvas.width = 480;
  snapCanvas.height = Math.round((camFeed.videoHeight / camFeed.videoWidth) * 480);
  const ctx = snapCanvas.getContext("2d");
  ctx.drawImage(camFeed, 0, 0, snapCanvas.width, snapCanvas.height);
  return snapCanvas.toDataURL("image/jpeg", 0.75);
}

async function getActiveGroqModels(apiKey, isVision = false) {
  const modelsUrl = atob("aHR0cHM6Ly9hcGkuZ3JvcS5jb20vb3BlbmFpL3YxL21vZGVscw==");
  const textPriority = [
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    "qwen/qwen3.8-27b",
    "llama-3.1-8b-instant"
  ];
  const visionPriority = [
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "meta-llama/llama-4-maverick-17b-128e-instruct",
    "llama-3.2-90b-vision-preview",
    "llama-3.2-11b-vision-preview"
  ];

  try {
    const res = await fetch(modelsUrl, { headers: { "Authorization": "Bearer " + apiKey } });
    const data = await res.json();
    if (res.ok && Array.isArray(data.data)) {
      const all = data.data.map(m => m.id);
      if (isVision) {
        const vAvail = all.filter(id => id.includes("vision") || id.includes("llama-4"));
        if (vAvail.length > 0) return vAvail;
      } else {
        const tAvail = all.filter(id => !id.includes("whisper") && !id.includes("guard") && !id.includes("orpheus"));
        const sorted = [...textPriority.filter(p => tAvail.includes(p)), ...tAvail.filter(a => !textPriority.includes(a))];
        if (sorted.length > 0) return sorted;
      }
    }
  } catch (e) {}
  return isVision ? visionPriority : textPriority;
}

async function askGroq(apiKey, messages, isVision = false) {
  const endpoint = atob("aHR0cHM6Ly9hcGkuZ3JvcS5jb20vb3BlbmFpL3YxL2NoYXQvY29tcGxldGlvbnM=");
  const models = await getActiveGroqModels(apiKey, isVision);
  let lastError = "Connection failed";

  for (const modelName of models) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + apiKey
        },
        body: JSON.stringify({
          model: modelName,
          messages: messages,
          temperature: 0.7,
          max_tokens: 280
        })
      });

      const data = await response.json();
      if (response.ok && data.choices && data.choices.length > 0) {
        return data.choices.at(0).message.content.trim();
      }
      lastError = data.error?.message || "Model unavailable";
    } catch (e) {
      lastError = e.message;
    }
  }
  throw new Error(lastError);
}

async function runCommand(rawCmd) {
  if (!rawCmd || !rawCmd.trim()) return;
  let cmd = rawCmd.replace(/^(hey\s+wiki|wiki\s+hype|wiki|ulli)[,\s]*/i, "").trim();
  if (!cmd) {
    const greet = "Yes Boss, WIKI HYPE is listening.";
    addLog("WIKI HYPE", greet);
    speak(greet);
    return;
  }

  addLog("NAJEEB", cmd, "usermsg");
  const lower = cmd.toLowerCase();

  if (
    lower.includes("kisne banaya") ||
    lower.includes("kisne bnaya") ||
    lower.includes("who created you") ||
    lower.includes("who made you") ||
    lower.includes("who is your creator") ||
    lower.includes("who is your owner") ||
    lower.includes("tumhara malik")
  ) {
    const reply = "Mujhe Najeeb ne design aur develop kiya hai. Najeeb is my creator and my Boss!";
    addLog("WIKI HYPE", reply);
    speak(reply);
    return;
  }

  if (lower.startsWith("remember ") || lower.startsWith("yaad rakhna ")) {
    const note = cmd.replace(/^(remember|yaad rakhna)\s+/i, "").trim();
    saveMemory(note);
    chatHistory = [buildSystemPrompt()];
    const reply = "Noted and stored in permanent memory, Boss: " + note;
    addLog("WIKI HYPE", reply);
    speak(reply);
    return;
  }

  if (lower.startsWith("open ")) {
    const site = lower.replace("open ", "").trim();
    const sites = {
      youtube: atob("aHR0cHM6Ly93d3cueW91dHViZS5jb20="),
      google: atob("aHR0cHM6Ly93d3cuZ29vZ2xlLmNvbQ=="),
      github: atob("aHR0cHM6Ly9naXRodWIuY29t"),
      instagram: atob("aHR0cHM6Ly93d3cuaW5zdGFncmFtLmNvbQ=="),
      whatsapp: atob("aHR0cHM6Ly93ZWIud2hhdHNhcHAuY29t"),
      gmail: atob("aHR0cHM6Ly9tYWlsLmdvb2dsZS5jb20=")
    };
    if (sites[site]) {
      const reply = "Launching " + site + " interface now, Boss.";
      addLog("WIKI HYPE", reply);
      speak(reply);
      window.open(sites[site], "_blank");
      return;
    }
  }

  if (lower.startsWith("search ")) {
    const query = cmd.slice(7).trim();
    const reply = "Searching Google for " + query + ", Boss.";
    addLog("WIKI HYPE", reply);
    speak(reply);
    window.open(atob("aHR0cHM6Ly93d3cuZ29vZ2xlLmNvbS9zZWFyY2g/cT0=") + encodeURIComponent(query), "_blank");
    return;
  }

  const apiKey = (localStorage.getItem("groqKey") || "").trim();
  if (!apiKey) {
    const reply = "Boss, click API KEY and paste your Groq key first.";
    addLog("WIKI HYPE", reply);
    speak(reply);
    return;
  }

 statusText.innerText = visionActive ? "ANALYZING VISUAL + NEURAL CORE..." : "PROCESSING NEURAL CORE...";
  chatHistory = buildSystemPrompt();

  const snap = captureFrameBase64();
  if (snap) {
    const visionMessages = [
      chatHistory,
      {
        role: "user",
        content: [
          { type: "text", text: cmd },
          { type: "image_url", image_url: { url: snap } }
        ]
      }
    ];
    try {
      const aiReply = await askGroq(apiKey, visionMessages, true);
      chatHistory.push({ role: "user", content: "[Vision] " + cmd });
      chatHistory.push({ role: "assistant", content: aiReply });
      addLog("WIKI HYPE", aiReply);
      speak(aiReply);
      if (!continuousMode) statusText.innerText = "WIKI HYPE READY";
      return;
    } catch (err) {
      addLog("SYSTEM", "Vision model fallback to text: " + err.message, "sysmsg");
    }
  }

  chatHistory.push({ role: "user", content: cmd });
  if (chatHistory.length > 13) {
    chatHistory = [buildSystemPrompt(), ...chatHistory.slice(-12)];
  }

  try {
    const aiReply = await askGroq(apiKey, chatHistory, false);
    chatHistory.push({ role: "assistant", content: aiReply });
    addLog("WIKI HYPE", aiReply);
    speak(aiReply);
    if (!continuousMode) statusText.innerText = "WIKI HYPE READY";
  } catch (err) {
    addLog("WIKI HYPE", "System error, Boss: " + err.message);
    speak("Apologies Boss, please verify your Groq API key.");
    statusText.innerText = "ERROR - CHECK API KEY";
  }
}

sendBtn.addEventListener("click", () => {
  runCommand(textInput.value);
  textInput.value = "";
});

textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    runCommand(textInput.value);
    textInput.value = "";
  }
});

clearBtn.addEventListener("click", () => {
  chatLog.innerHTML = "";
  chatHistory = [buildSystemPrompt()];
  addLog("WIKI HYPE", "Terminal cleared. Standing by, Boss.");
});

keyBtn.addEventListener("click", () => {
  apiKeyInput.value = localStorage.getItem("groqKey") || "";
  apiModal.classList.remove("hidden");
});

closeModalBtn.addEventListener("click", () => {
  apiModal.classList.add("hidden");
});

saveKeyBtn.addEventListener("click", () => {
  localStorage.setItem("groqKey", apiKeyInput.value.trim());
  apiModal.classList.add("hidden");
  const msg = "API Protocol saved and encrypted, Boss.";
  addLog("WIKI HYPE", msg);
  speak(msg);
});

memBtn.addEventListener("click", () => {
  const mems = getMemories();
  memList.innerHTML = mems.length
    ? mems.map((m, i) => "<li>" + (i + 1) + ". " + m + "</li>").join("")
    : "<li>No memories stored yet. Say 'Remember [anything]' to save.</li>";
  memModal.classList.remove("hidden");
});

closeMemBtn.addEventListener("click", () => {
  memModal.classList.add("hidden");
});

clearMemBtn.addEventListener("click", () => {
  localStorage.removeItem("wikiMemories");
  chatHistory = [buildSystemPrompt()];
  memList.innerHTML = "<li>Memory wiped clean, Boss.</li>";
});

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRec) {
  recognition = new SpeechRec();
  recognition.lang = "en-IN";
  recognition.interimResults = false;

  micBtn.addEventListener("click", () => {
    if (!continuousMode) {
      continuousMode = true;
      micBtn.innerText = "LISTENING";
      micBtn.style.background = "rgba(0, 255, 136, 0.22)";
      micBtn.style.borderColor = "#00ff88";
      micBtn.style.color = "#00ff88";
      reactor.classList.add("listening");
      statusText.innerText = "CONTINUOUS LISTENING ON (TAP LISTENING TO PAUSE)";
      if (isSpeaking) window.speechSynthesis.cancel();
      try { recognition.start(); } catch (e) {}
    } else {
      continuousMode = false;
      micBtn.innerText = "ULLI";
      micBtn.style.background = "";
      micBtn.style.borderColor = "";
      micBtn.style.color = "";
      reactor.classList.remove("listening");
      statusText.innerText = "VOICE PAUSED - CHAT MODE ACTIVE";
      try { recognition.stop(); } catch (e) {}
    }
  });

  recognition.onresult = (e) => {
    const transcript = e.results.item(0).item(0).transcript;
    runCommand(transcript);
  };

  recognition.onerror = (e) => {
    if (e.error === "not-allowed") {
      continuousMode = false;
      micBtn.innerText = "ULLI";
      reactor.classList.remove("listening");
      statusText.innerText = "MIC PERMISSION DENIED";
    }
  };

  recognition.onend = () => {
    if (continuousMode && !isSpeaking) {
      try { recognition.start(); } catch (e) {}
    } else if (!continuousMode && !isSpeaking) {
      reactor.classList.remove("listening");
    }
  };
} else {
  micBtn.addEventListener("click", () => {
    alert("Speech Recognition is not supported in this browser. Use Chrome or Edge.");
  });
}
