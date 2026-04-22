// Dynamic Configuration
const isHosted = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && window.location.hostname !== '';
const BACKEND_BASE = isHosted ? window.location.origin : `http://127.0.0.1:8000`;
const WS_BASE = isHosted ? window.location.origin.replace('http', 'ws') : `ws://127.0.0.1:8000`;

const API_URL = `${BACKEND_BASE}/analyze-frame/`;
const LIVENESS_URL = `${BACKEND_BASE}/liveness-check/`;
const AUTH_URL = `${BACKEND_BASE}/auth/`;
const BIND_URL = `${BACKEND_BASE}/bind-partner/`;
const CHAT_HISTORY_URL = `${BACKEND_BASE}/chat-history/`;
const WS_URL = `${WS_BASE}/ws/`;

const welcomeScreen = document.getElementById("welcome-screen");
const signupScreen = document.getElementById("signup-screen");
const goLoginBtn = document.getElementById("go-login-btn");
const goSignupBtn = document.getElementById("go-signup-btn");
const startSignupFaceBtn = document.getElementById("start-signup-face-btn");
const newUsernameInput = document.getElementById("new-username");
const signupError = document.getElementById("signup-error");
const backToWelcomeBtn1 = document.getElementById("back-to-welcome-btn1");
const backToWelcomeBtn2 = document.getElementById("back-to-welcome-btn2");

const livenessScreen = document.getElementById("liveness-screen");
const livenessCam = document.getElementById("liveness-webcam");
const livenessCanvas = document.getElementById("liveness-canvas");
const livenessCtx = livenessCanvas.getContext("2d");
const livenessInstruction = document.getElementById("liveness-instruction");
const livenessProgress = document.getElementById("liveness-progress");
const livenessStatus = document.getElementById("liveness-status");

const loginScreen = document.getElementById("login-screen"); // old Setup Dashboard (removed, but keep var if needed)
const partnerSetupScreen = document.getElementById("partner-setup-screen");
const chatHubScreen = document.getElementById("chat-hub-screen");
const partnerUsernameInput = document.getElementById("partner-username-input");
const bindPartnerBtn = document.getElementById("bind-partner-btn");
const partnerBindError = document.getElementById("partner-bind-error");

const backToDashBtn = document.getElementById("back-to-dash-btn");
const chatPartnerName = document.getElementById("chat-partner-name");
const voiceCallBtn = document.getElementById("voice-call-btn");
const videoCallBtn = document.getElementById("video-call-btn");
const chatMessagesContainer = document.getElementById("chat-messages-container");
const chatTextInput = document.getElementById("chat-text-input");
const sendMsgBtn = document.getElementById("send-msg-btn");
const attachFileBtn = document.getElementById("attach-file-btn");
const voiceNoteBtn = document.getElementById("voice-note-btn");
const chatAttachmentInput = document.getElementById("chat-attachment-input");

const callScreen = document.getElementById("video-call-screen");
const memoriesScreen = document.getElementById("memories-screen");
const endCallBtn = document.getElementById("end-call-btn");
const backToChatBtn = document.getElementById("back-to-chat-btn");
const backToDashboardBtn = document.getElementById("back-to-dashboard-btn");

const dashboardScreen = document.getElementById("dashboard-screen");
const goToChatBtn = document.getElementById("go-to-chat-btn");
const sendHeartbeatBtn = document.getElementById("send-heartbeat-btn");
const capsuleBtn = document.getElementById("capsule-btn");
const scratchBtn = document.getElementById("scratch-btn");
const generateTrailerBtn = document.getElementById("generate-trailer-btn");
const massiveHeartbeatLayer = document.getElementById("massive-heartbeat-layer");
const goToMemoriesBtn = document.getElementById("go-to-memories-btn");

const myPfpPreview = document.getElementById("my-pfp-preview");
const pfpUploadInput = document.getElementById("pfp-upload-input");
const myPfpImg = document.getElementById("my-pfp-img");
const myPfpIcon = document.getElementById("my-pfp-icon");
const chatPartnerAvatar = document.getElementById("chat-partner-avatar");

const voiceCallScreen = document.getElementById("voice-call-screen");
const voiceCallTitle = document.getElementById("voice-call-title");
const voiceCallTimer = document.getElementById("voice-call-timer");
const endVoiceCallBtn = document.getElementById("end-voice-call-btn");

const video = document.getElementById("webcam");
const canvas = document.getElementById("capture-canvas");
const ctx = canvas.getContext("2d");
const gallery = document.getElementById("gallery");
const emptyState = document.getElementById("empty-state");

// --- AUTHENTICATION STATE & LOGIC ---
let connectedPartner = null;
let activeUsername = null;
let ws = null; // WebSocket connection

let isLivenessChecking = false;
let livenessState = "center"; // Flow: center -> right -> left -> unlocked
let holdStartTime = null;
const HOLD_DURATION = 3000;
let registeredFaceHash = null; // The secure token for this session
let livenessStream = null;

// Routing listeners
goLoginBtn.addEventListener("click", () => {
    authMode = 'login';
    welcomeScreen.classList.remove("active");
    livenessScreen.classList.add("active");
    initLivenessCamera();
});

goSignupBtn.addEventListener("click", () => {
    welcomeScreen.classList.remove("active");
    signupScreen.classList.add("active");
});

backToWelcomeBtn1.addEventListener("click", () => {
    signupScreen.classList.remove("active");
    signupError.style.display = "none";
    welcomeScreen.classList.add("active");
});

backToWelcomeBtn2.addEventListener("click", () => {
    isLivenessChecking = false;
    livenessScreen.classList.remove("active");
    if(livenessStream) livenessStream.getTracks().forEach(t => t.stop());
    welcomeScreen.classList.add("active");
    backToWelcomeBtn2.style.display = "none";
    livenessStatus.style.color = ""; // Reset styling
    livenessStatus.innerText = "Waiting for face...";
});

startSignupFaceBtn.addEventListener("click", () => {
    const val = newUsernameInput.value.trim();
    // Validate: no spaces, only alphanumeric and specials allowed
    const validRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]*$/;
    
    if (val.length < 3) {
        signupError.innerText = "Username must be at least 3 characters.";
        signupError.style.display = "block";
        return;
    }
    
    if (!validRegex.test(val)) {
        signupError.innerText = "No spaces allowed. Use only characters, numbers, and special symbols.";
        signupError.style.display = "block";
        return;
    }
    
    // Check if user already exists
    if (localStorage.getItem(`lvme_user_${val}`)) {
        signupError.innerText = "Username is already taken by another face!";
        signupError.style.display = "block";
        return;
    }
    
    signupError.style.display = "none";
    pendingUsername = val;
    authMode = 'signup';
    
    signupScreen.classList.remove("active");
    livenessScreen.classList.add("active");
    initLivenessCamera();
});

async function initLivenessCamera() {
    try {
        livenessStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
        });
        livenessCam.srcObject = livenessStream;
        
        // Force play for mobile WebViews
        livenessCam.play().catch(err => console.error("Autoplay prevented:", err));
        
        livenessCam.onloadedmetadata = () => {
            // Android WebViews sometimes have 0 width during this event
            livenessCanvas.width = livenessCam.videoWidth || 640;
            livenessCanvas.height = livenessCam.videoHeight || 480;
            checkLiveness(); // Start looping
        };
    } catch (err) {
        console.error("Webcam error:", err);
        livenessInstruction.innerText = "Camera access required for security check.";
    }
}

async function checkLiveness() {
    if (livenessState === "unlocked") return; // Stop checking if done
    if (isLivenessChecking) return;
    
    isLivenessChecking = true;
    
    try {
        if (livenessCanvas.width === 0 || livenessCanvas.height === 0) {
            livenessCanvas.width = livenessCam.videoWidth || 640;
            livenessCanvas.height = livenessCam.videoHeight || 480;
        }
        livenessCtx.drawImage(livenessCam, 0, 0, livenessCanvas.width, livenessCanvas.height);
    } catch(e) {
        isLivenessChecking = false;
        setTimeout(checkLiveness, 400);
        return;
    }
    
    livenessCanvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append("file", blob, "live.jpg");
        
        try {
            const response = await fetch(LIVENESS_URL, { method: "POST", body: formData });
            const data = await response.json();
            
            processLivenessResult(data);
        } catch (error) {
            livenessStatus.innerText = "Connecting to Secure Server...";
        } finally {
            isLivenessChecking = false;
            // Poll rapidly for smooth UI progression
            setTimeout(checkLiveness, 400); 
        }
    }, "image/jpeg", 0.5);
}

async function processLivenessResult(data) {
    if (!data.face_found) {
        holdStartTime = null;
        livenessProgress.style.width = "0%";
        livenessStatus.innerText = "No face detected in frame";
        return;
    }
    
    // On very first detection frame, verify or register depending on mode
    if (!registeredFaceHash) {
        const formData = new FormData();
        formData.append("mode", authMode);
        formData.append("face_hash", data.face_hash);
        if (authMode === "signup") formData.append("username", pendingUsername);
        
        try {
            const res = await fetch(AUTH_URL, { method: "POST", body: formData });
            const result = await res.json();
            
            if (result.status === "error") {
                livenessStatus.innerText = result.message;
                livenessStatus.style.color = "red";
                backToWelcomeBtn2.style.display = "inline-block";
                return;
            }
            
            registeredFaceHash = result.face_hash;
            activeUsername = result.username;
            connectedPartner = result.partner || null;
            
            loadMemoriesFromDatabase(registeredFaceHash); 
        } catch (e) {
            console.error("Auth error:", e);
            return;
        }
    }
    
    // Evaluate Pose vs Required State
    let isCorrectPose = false;
    
    // Strict Pose Evaluation
    if (livenessState === "center" && data.pose === "center") isCorrectPose = true;
    if (livenessState === "right" && data.pose === "right") isCorrectPose = true; 
    if (livenessState === "left" && data.pose === "left") isCorrectPose = true;

    if (isCorrectPose) {
        if (!holdStartTime) holdStartTime = Date.now();
        
        const elapsed = Date.now() - holdStartTime;
        const percent = Math.min((elapsed / HOLD_DURATION) * 100, 100);
        livenessProgress.style.width = `${percent}%`;
        livenessStatus.innerText = "Hold still...";
        
        if (elapsed >= HOLD_DURATION) {
            advanceLivenessState();
        }
    } else {
        // Reset holding pattern
        holdStartTime = null;
        livenessProgress.style.width = "0%";
        livenessStatus.innerText = "Adjusting...";
    }
}

function advanceLivenessState() {
    holdStartTime = null;
    livenessProgress.style.width = "0%";
    
    if (livenessState === "center") {
        livenessState = "right";
        livenessInstruction.innerHTML = "Perfect. Now <b>look to your right</b> for 3 seconds.";
    } else if (livenessState === "right") {
        livenessState = "left";
        livenessInstruction.innerHTML = "Great! Finally, <b>look to your left</b> for 3 seconds.";
    } else if (livenessState === "left") {
        livenessState = "unlocked";
        livenessStatus.style.color = "#00ff88";
        livenessStatus.innerText = `Welcome to your universe, ${activeUsername}!`;
        
        // Stop the liveness feed
        if(livenessStream) livenessStream.getTracks().forEach(t => t.stop());
        
        // Routing Transition Logic
        setTimeout(() => {
            livenessScreen.classList.remove("active");
            
            // Load user's PFP if exists
            loadUserPfp();
            
            if (connectedPartner) {
                // Show dashboard instead of directly opening chat
                checkNostalgia();
                dashboardScreen.classList.add("active");
            } else {
                // Must bind a partner
                partnerSetupScreen.classList.add("active");
            }
        }, 1500);
    }
}


// --- MAIN APP LOGIC ---
let isProcessing = false;
let isRecordingVideo = false;
let activeStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let sessionMemories = [];

let voiceStream = null;
let voiceCallInterval = null;
let voiceCallSeconds = 0;

function loadMemoriesFromDatabase(faceHash) {
    const savedData = localStorage.getItem(`lvme_${faceHash}`);
    if (savedData) {
        console.log("Restoring memories for User Hash:", faceHash);
        // Note: HTML LocalStorage can't store Blobs easily without Base64 encoding. 
        // For production, this would fetch from SQLite using the face_hash.
        // We will just leave sessionMemories empty for now, but the link is established!
    } else {
         console.log("New user detected! Hash:", faceHash);
    }
}

function checkNostalgia() {
    const nostalgiaWidget = document.getElementById("nostalgia-widget");
    const nostalgiaImg = document.getElementById("nostalgia-img");
    const nostalgiaCaption = document.getElementById("nostalgia-caption");
    const nostalgiaTime = document.getElementById("nostalgia-time");
    
    if (!nostalgiaWidget) return;
    
    // We mock the probability of finding a memory today
    if (Math.random() > 0.2) {
        nostalgiaWidget.style.display = "block";
        
        const times = [
            "🕰️ A whisper from the past...", 
            "🕰️ Do you remember this moment?", 
            "🕰️ Stolen in time, just for you...",
            "🕰️ A fleeting second captured forever...",
            "🕰️ Look how far we've come..."
        ];
        
        const pfpCaptions = [
            "Your smile lit up my entire universe here ✨",
            "I could get lost in these eyes forever 💖",
            "A beautiful reminder of why I fell for you 💕"
        ];
        
        nostalgiaTime.innerText = times[Math.floor(Math.random() * times.length)];
        
        // Mocking an old memory check:
        let fallbackFound = false;
        if(connectedPartner) {
             const partnerHashSimulation = localStorage.getItem(`lvme_user_${connectedPartner}`);
             if (partnerHashSimulation) {
                  const pfpData = localStorage.getItem(`lvme_pfp_${partnerHashSimulation}`);
                  if (pfpData) {
                       nostalgiaImg.src = pfpData;
                       nostalgiaCaption.innerText = pfpCaptions[Math.floor(Math.random() * pfpCaptions.length)];
                       fallbackFound = true;
                  }
             }
        }
        
        if (!fallbackFound) {
             // Default cute placeholder
             nostalgiaImg.src = "data:image/svg+xml;utf8,<svg width='200' height='200' xmlns='http://www.w3.org/2000/svg'><rect width='200' height='200' fill='%23ffb3c6'/><text x='100' y='100' font-family='Arial' font-size='60' text-anchor='middle' alignment-baseline='middle' fill='%23ff3366'>💖</text></svg>";
             const fallbacks = [
                 "The very spark that started our universe ✨",
                 "To all the unwritten memories we've yet to make 💫"
             ];
             nostalgiaCaption.innerText = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        }
    }
}

// --- PROFILE PICTURE (DP) LOGIC ---
function loadUserPfp() {
    if (!registeredFaceHash) return;
    const pfpData = localStorage.getItem(`lvme_pfp_${registeredFaceHash}`);
    if (pfpData) {
        myPfpImg.src = pfpData;
        myPfpImg.style.display = "block";
        myPfpIcon.style.display = "none";
    }
}

function loadPartnerPfp() {
    if (!connectedPartner) return;
    // In a real app we'd fetch this from the backend by partner ID.
    // For this prototype, we'll try to find a mock storage item if testing on same browser.
    // Otherwise fallback to icon
    let pfpFound = false;
    // We would need the partner's hash, but we only have their username right now. 
    // To simulate, we just leave the default or check if we stored it by username locally.
    const partnerHashSimulation = localStorage.getItem(`lvme_user_${connectedPartner}`);
    if (partnerHashSimulation) {
         const pfpData = localStorage.getItem(`lvme_pfp_${partnerHashSimulation}`);
         if (pfpData) {
              chatPartnerAvatar.innerHTML = `<img src="${pfpData}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
              pfpFound = true;
         }
    }
    
    if (!pfpFound) {
         chatPartnerAvatar.innerHTML = "👤"; // default
    }
}

myPfpPreview.addEventListener("click", () => {
    pfpUploadInput.click();
});

pfpUploadInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const base64Img = event.target.result;
        // Update UI
        myPfpImg.src = base64Img;
        myPfpImg.style.display = "block";
        myPfpIcon.style.display = "none";
        
        // Save locally using the secure hash
        if (registeredFaceHash) {
             localStorage.setItem(`lvme_pfp_${registeredFaceHash}`, base64Img);
             
             // Also store username->hash map for easy simulated partner lookup
             localStorage.setItem(`lvme_user_${activeUsername}`, registeredFaceHash);
        }
    };
    reader.readAsDataURL(file);
});

// --- CHAT HUB & PARTNER BINDING LOGIC ---

bindPartnerBtn.addEventListener("click", async () => {
    const val = partnerUsernameInput.value.trim();
    if (!val) return;
    
    const formData = new FormData();
    formData.append("user_hash", registeredFaceHash);
    formData.append("partner_username", val);
    
    try {
        const res = await fetch(BIND_URL, { method: "POST", body: formData });
        const result = await res.json();
        
        if (result.status === "error") {
             partnerBindError.innerText = result.message;
             partnerBindError.style.display = "block";
             return;
        }
        
        partnerBindError.style.display = "none";
        connectedPartner = result.partner_username;
        
        // Proceed to dashboard
        partnerSetupScreen.classList.remove("active");
        dashboardScreen.classList.add("active");
    } catch(e) {
        partnerBindError.innerText = "Connection failed.";
        partnerBindError.style.display = "block";
    }
});

// Dashboard Listeners
if (backToDashBtn) {
    backToDashBtn.addEventListener("click", () => {
        chatHubScreen.classList.remove("active");
        dashboardScreen.classList.add("active");
    });
}

goToChatBtn.addEventListener("click", () => {
    dashboardScreen.classList.remove("active");
    initChatHub(connectedPartner);
});

goToMemoriesBtn.addEventListener("click", () => {
    dashboardScreen.classList.remove("active");
    memoriesScreen.classList.add("active");
    renderGallery();
});

let chatHistory = [];

function getChatKey() {
    // Sort usernames alphabetically to create a unique unified thread key
    const sorted = [activeUsername, connectedPartner].sort();
    return `lvme_chat_${sorted[0]}_${sorted[1]}`;
}

function initChatHub(partnerName) {
    chatPartnerName.innerText = partnerName;
    chatHubScreen.classList.add("active");
    
    // Init WebSocket!
    if (!ws) {
        ws = new WebSocket(WS_URL + registeredFaceHash);
        ws.onopen = () => console.log("WebSocket connected!");
        ws.onmessage = (event) => {
             const data = JSON.parse(event.data);
             handleIncomingMessage(data);
        };
    }
    
    loadPartnerPfp();
    loadChatHistory();
}

async function loadChatHistory() {
    chatMessagesContainer.innerHTML = '<div class="chat-date-divider">Today</div>';
    try {
        const res = await fetch(CHAT_HISTORY_URL + registeredFaceHash);
        const history = await res.json();
        history.forEach(msg => {
            renderMessage({
                sender: msg.sender_hash === registeredFaceHash ? activeUsername : connectedPartner,
                type: msg.type.replace("chat_", ""),
                content: msg.content,
                timestamp: msg.timestamp
            });
        });
    } catch (e) {
        console.error("Failed to load chat history", e);
    }
}

function renderMessage(msg) {
    const el = document.createElement("div");
    el.className = `chat-bubble ${msg.sender === activeUsername ? 'sent' : 'received'}`;
    
    if (msg.type === 'text') {
        el.innerText = msg.content;
    } else if (msg.type === 'image') {
        el.innerHTML = `<img src="${msg.content}" class="chat-attachment-img" />`;
    } else if (msg.type === 'document') {
        el.innerHTML = `📎 <b>Document Attached</b><br><span style="font-size:0.8rem;opacity:0.8;">${msg.content}</span>`;
    } else if (msg.type === 'audio') {
        el.innerHTML = `<audio controls src="${msg.content}" style="max-width: 200px; height: 40px; margin-top: 5px; outline: none;"></audio>`;
    } else if (msg.type === 'capsule') {
        try {
            const capData = JSON.parse(msg.content);
            const now = Date.now();
            if (now < capData.unlockTime) {
                el.innerHTML = `<div class="time-capsule">🔒 Locked Capsule<br><span style="font-size:0.8rem">Opens later</span></div>`;
            } else {
                el.innerHTML = `✨ <b>Time Capsule Unlocked!</b><br>${capData.text}`;
            }
        } catch(e) {}
    } else if (msg.type === 'scratch') {
        el.innerHTML = `<div class="scratch-container" style="width:200px; height:100px; background:var(--bg-pink); position:relative; display:flex; align-items:center; justify-content:center; color:black; border-radius:8px; overflow:hidden;">
            <div style="padding:10px; z-index:1; font-weight:600;">${msg.content}</div>
            <canvas class="scratch-overlay" width="200" height="100"></canvas>
        </div>`;
        setTimeout(() => {
            const canvas = el.querySelector('canvas');
            if(!canvas) return;
            const context = canvas.getContext('2d');
            context.fillStyle = '#cfb0b8';
            context.fillRect(0,0,200,100);
            context.font = "16px sans-serif";
            context.fillStyle = "white";
            context.fillText("Scratch Me ✨", 50, 55);
            
            let isDrawing = false;
            canvas.onmousedown = () => isDrawing = true;
            canvas.onmouseup = () => isDrawing = false;
            canvas.onmousemove = (e) => {
                if(!isDrawing) return;
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                context.globalCompositeOperation = 'destination-out';
                context.beginPath();
                context.arc(x, y, 15, 0, Math.PI*2);
                context.fill();
            }
        }, 300);
    }
    
    const time = document.createElement("span");
    time.className = "chat-timestamp";
    time.innerText = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    el.appendChild(time);
    
    chatMessagesContainer.appendChild(el);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

function saveMessage(type, content) {
    const msg = {
        type: `chat_${type}`,
        content: content,
        timestamp: Date.now()
    };
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
    }
    
    // Render locally immediately
    renderMessage({
        sender: activeUsername,
        type: type,
        content: content,
        timestamp: msg.timestamp
    });
}

// Input Handlers
chatTextInput.addEventListener("input", () => {
    sendMsgBtn.style.display = chatTextInput.value.trim() ? "inline-flex" : "none";
});

sendMsgBtn.addEventListener("click", () => {
    const val = chatTextInput.value.trim();
    if (val) {
        saveMessage('text', val);
        chatTextInput.value = '';
        sendMsgBtn.style.display = "none";
    }
});

chatTextInput.addEventListener("keypress", (e) => {
    if (e.key === 'Enter') sendMsgBtn.click();
});

attachFileBtn.addEventListener("click", () => {
    chatAttachmentInput.click();
});

chatAttachmentInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        if (file.type.startsWith('image/')) {
            saveMessage('image', event.target.result);
            
            // Feature: Add best pics logically to memories gallery automatically from chat attachments
            // Using a mock Blob creation here to put it into the gallery memory flow
            fetch(event.target.result).then(res => res.blob()).then(blob => {
                 sessionMemories.push({
                     type: 'photo',
                     blob: blob,
                     caption: "Attached from Chat 💞"
                 });
            });
            
        } else {
            saveMessage('document', file.name);
        }
    };
    reader.readAsDataURL(file);
});

let mediaRecorderAudio = null;
let audioChunks = [];
let isRecordingAudio = false;

voiceNoteBtn.addEventListener("click", async () => {
    if (!isRecordingAudio) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderAudio = new MediaRecorder(stream);
            voiceNoteBtn.classList.add("recording-pulse");
            isRecordingAudio = true;
            
            mediaRecorderAudio.ondataavailable = event => {
                if (event.data.size > 0) audioChunks.push(event.data);
            };
            
            mediaRecorderAudio.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    const base64Audio = reader.result;
                    saveMessage('audio', base64Audio);
                };
                audioChunks = [];
                isRecordingAudio = false;
                voiceNoteBtn.classList.remove("recording-pulse");
                stream.getTracks().forEach(t => t.stop());
            };
            
            mediaRecorderAudio.start();
            // Optional: visual clue in input box
            chatTextInput.placeholder = "Recording voice note... (Click mic to stop)";
            chatTextInput.disabled = true;
        } catch(err) {
            console.error("Audio recording failed:", err);
            alert("Microphone permission denied or an error occurred.");
        }
    } else {
        // Stop recording
        if (mediaRecorderAudio && mediaRecorderAudio.state === "recording") {
             mediaRecorderAudio.stop();
        }
        chatTextInput.placeholder = "Whisper something...";
        chatTextInput.disabled = false;
    }
});

sendHeartbeatBtn?.addEventListener("click", () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "action_heartbeat" }));
        if(massiveHeartbeatLayer) {
            massiveHeartbeatLayer.style.animation = "none";
            void massiveHeartbeatLayer.offsetWidth;
            massiveHeartbeatLayer.style.animation = "massivePulse 1.5s ease-out";
        }
    }
});

capsuleBtn?.addEventListener("click", () => {
    // Prototype feature: Locks capsule for 1 minute
    const val = chatTextInput.value.trim();
    if(val) {
        const payload = JSON.stringify({ unlockTime: Date.now() + 60000, text: val });
        saveMessage('capsule', payload);
        chatTextInput.value = '';
    } else {
        alert("Type a message to lock in the capsule!");
    }
});

scratchBtn?.addEventListener("click", () => {
    const val = chatTextInput.value.trim();
    if(val) {
        saveMessage('scratch', val);
        chatTextInput.value = '';
    } else {
        alert("Type a secret message before pressing Scratch!");
    }
});

const TRAILER_URL = `${PROTOCOL}://${BACKEND_HOST}${PORT_STR}/generate-trailer/`;
generateTrailerBtn?.addEventListener("click", async () => {
    generateTrailerBtn.innerText = "Generating (This takes ~30s)...";
    generateTrailerBtn.disabled = true;
    try {
        const res = await fetch(TRAILER_URL + registeredFaceHash);
        if(!res.ok) throw new Error("Error generating trailer.");
        const blob = await res.blob();
        if(blob.size > 0) {
            sessionMemories.push({ type: 'video', blob: blob, caption: "Our Love Trailer 🎥✨" });
            renderGallery();
        }
    } catch(e) {
        alert("Could not generate trailer. Ensure you have sent messages/audios/photos first!");
    }
    generateTrailerBtn.innerText = "Generate Love Trailer ✨";
    generateTrailerBtn.disabled = false;
});


let peerConnection = null;
const configuration = { 'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}] };

function handleIncomingMessage(data) {
    if (data.type === "action_heartbeat") {
        if(navigator.vibrate) navigator.vibrate([200, 100, 200]);
        if(massiveHeartbeatLayer) {
            massiveHeartbeatLayer.style.animation = "none";
            void massiveHeartbeatLayer.offsetWidth; // trigger reflow
            massiveHeartbeatLayer.style.animation = "massivePulse 1.5s ease-out";
        }
    } else if (data.type.startsWith("chat_")) {
        renderMessage({
            sender: connectedPartner,
            type: data.type.replace("chat_", ""),
            content: data.content,
            timestamp: data.timestamp || Date.now()
        });
    } else if (data.type === "webrtc_offer") {
        showIncomingCallOverlay(data);
    } else if (data.type === "webrtc_answer") {
        handleAnswer(data.sdp);
    } else if (data.type === "ice_candidate") {
        handleNewICECandidateMsg(data.candidate);
    } else if (data.type === "call_ended") {
        endCallCleanly();
    }
}

const incomingOverlay = document.getElementById("incoming-call-overlay");
const incomingText = document.getElementById("incoming-call-text");
const btnAnswer = document.getElementById("answer-call-btn");
const btnReject = document.getElementById("reject-call-btn");
let pendingOffer = null;

function showIncomingCallOverlay(offerData) {
    pendingOffer = offerData;
    incomingText.innerText = `${connectedPartner} is calling...`;
    incomingOverlay.style.display = "flex";
}

btnReject.addEventListener("click", () => {
    incomingOverlay.style.display = "none";
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "call_ended" }));
    }
});

btnAnswer.addEventListener("click", async () => {
    incomingOverlay.style.display = "none";
    if (pendingOffer) {
        if (pendingOffer.callType === "video") {
            chatHubScreen.classList.remove("active");
            callScreen.classList.add("active");
            await acceptCall(pendingOffer.sdp, true);
        } else {
            chatHubScreen.classList.remove("active");
            voiceCallScreen.classList.add("active");
            voiceCallTitle.innerText = `On call with ${connectedPartner}`;
            voiceCallTimer.innerText = "00:00";
            await acceptCall(pendingOffer.sdp, false);
        }
    }
});

async function createPeerConnection(isVideo) {
    peerConnection = new RTCPeerConnection(configuration);
    
    // Send ICE candidates safely to partner
    peerConnection.onicecandidate = event => {
        if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ice_candidate', candidate: event.candidate }));
        }
    };
    
    // Inject remote track
    peerConnection.ontrack = event => {
        if (isVideo) {
            const remoteVid = document.getElementById("remote-webcam");
            if (remoteVid) {
                remoteVid.srcObject = event.streams[0];
                remoteVid.play().catch(e => console.error("Autoplay prevented:", e));
            }
        } else {
            // we could attach an invisible audio element, or reuse video tag
            const remoteVid = document.getElementById("remote-webcam");
            if (remoteVid) {
                remoteVid.srcObject = event.streams[0]; 
                remoteVid.play().catch(e => console.error("Autoplay prevented:", e));
            }
            // the video element plays audio even without video tracks
        }
    };
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
        activeStream = stream;
        
        if (isVideo) {
            video.srcObject = stream;
            video.play().catch(e => console.error("Autoplay prevented:", e));
            
            // Re-setup background analysis strictly on local video
            setupMediaRecorder(stream);
            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                setInterval(captureAndAnalyze, 2000); 
            };
        } else {
            voiceStream = stream;
            voiceCallSeconds = 0;
            voiceCallInterval = setInterval(() => {
                voiceCallSeconds++;
                voiceCallTimer.innerText = formatCallTime(voiceCallSeconds);
            }, 1000);
        }
        
        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
    } catch(err) {
         console.error("Error accessing media devices.", err);
    }
}

async function acceptCall(sdp, isVideo) {
    await createPeerConnection(isVideo);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    ws.send(JSON.stringify({ type: 'webrtc_answer', sdp: peerConnection.localDescription }));
}

async function handleAnswer(sdp) {
    if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    }
}

async function handleNewICECandidateMsg(candidate) {
    if (peerConnection) {
        try {
            await peerConnection.addIceCandidate(candidate);
        } catch(e) {}
    }
}

function stopAllMedia() {
    if (activeStream) activeStream.getTracks().forEach(track => track.stop());
    if (typeof voiceStream !== 'undefined' && voiceStream) voiceStream.getTracks().forEach(t => t.stop());
    if (peerConnection) {
         peerConnection.close();
         peerConnection = null;
    }
    if (typeof voiceCallInterval !== 'undefined' && voiceCallInterval) clearInterval(voiceCallInterval);
}

function endCallCleanly() {
    stopAllMedia();
    callScreen.classList.remove("active");
    voiceCallScreen.classList.remove("active");
    memoriesScreen.classList.add("active");
    renderGallery();
}

endVoiceCallBtn.addEventListener("click", () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "call_ended" }));
    }
    endCallCleanly();
    saveMessage("text", `📞 Voice Call ended (${formatCallTime(voiceCallSeconds)})`);
});

endCallBtn.addEventListener("click", () => {
    try {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "call_ended" }));
        }
    } catch (e) { console.error(e); }
    endCallCleanly();
});

voiceCallBtn.addEventListener("click", async () => {
    chatHubScreen.classList.remove("active");
    voiceCallScreen.classList.add("active");
    voiceCallTitle.innerText = `Calling ${connectedPartner}...`;
    voiceCallTimer.innerText = "Ringing...";
    
    await createPeerConnection(false);
    
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    ws.send(JSON.stringify({
        type: 'webrtc_offer', 
        callType: 'voice',
        sdp: peerConnection.localDescription
    }));
});

videoCallBtn.addEventListener("click", async () => {
    chatHubScreen.classList.remove("active");
    callScreen.classList.add("active");
    
    await createPeerConnection(true);
    
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    ws.send(JSON.stringify({
        type: 'webrtc_offer', 
        callType: 'video',
        sdp: peerConnection.localDescription
    }));
});

function setupMediaRecorder(stream) {
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunks.push(event.data);
    };
    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        sessionMemories.push({ type: 'video', blob: blob, caption: currentRecordingCaption });
        recordedChunks = [];
        isRecordingVideo = false;
        
        // In reality, this is where we'd POST the Blob to the backend Database using registeredFaceHash as the key!
    };
}

let currentRecordingCaption = "";

async function captureAndAnalyze() {
    if (isProcessing || isRecordingVideo) return;
    
    isProcessing = true;
    
    try {
        if (canvas.width === 0 || canvas.height === 0) {
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    } catch(e) {
        isProcessing = false;
        return;
    }
    
    canvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append("file", blob, "frame.jpg");
        
        try {
            const response = await fetch(API_URL, { method: "POST", body: formData });
            const data = await response.json();
            
            if (data.action === "save_memory") {
                // Emotion-Sync Lighting Update
                if(data.reasons && data.reasons.includes("synchronized_smiles")) {
                     document.documentElement.style.setProperty('--ambient-color1', 'rgba(255, 51, 102, 0.7)');
                } else if(data.reasons && data.reasons.includes("hand_hearts_detected")) {
                     document.documentElement.style.setProperty('--ambient-color1', 'rgba(150, 0, 255, 0.7)');
                } else {
                     document.documentElement.style.setProperty('--ambient-color1', 'rgba(255, 120, 160, 0.4)');
                }
                
                if (Math.random() > 0.6 && mediaRecorder && mediaRecorder.state === "inactive") {
                    startVideoRecording(data.reasons);
                } else {
                    savePhotoSilently(blob, data.reasons);
                }
            }
        } catch (error) {} 
        finally {
            isProcessing = false;
        }
    }, "image/jpeg", 0.7);
}

function getCaptionForReasons(reasons) {
    if (!reasons || reasons.length === 0) return "A perfect moment 💖";
    const primary = reasons[Math.floor(Math.random() * reasons.length)];
    if (primary === "hand_hearts_detected") return "Hand Hearts! 🫶";
    if (primary === "synchronized_smiles") return "Laughing Together 😊";
    if (primary === "leaning_in_close") return "So Intimate ✨";
    return "Beautiful Smile! 📸";
}

function savePhotoSilently(blob, reasons) {
    sessionMemories.push({
        type: 'photo',
        blob: blob,
        caption: getCaptionForReasons(reasons)
    });
}

function startVideoRecording(reasons) {
    isRecordingVideo = true;
    currentRecordingCaption = "Video: " + getCaptionForReasons(reasons);
    mediaRecorder.start();
    
    setTimeout(() => { if (mediaRecorder.state === "recording") mediaRecorder.stop(); }, 5500);
}

// Note: WebRTC automatically cleans the camera when stopped

function renderGallery() {
    if (sessionMemories.length > 0 && emptyState) emptyState.style.display = "none";
    
    sessionMemories.reverse().forEach(memory => {
        const itemUrl = URL.createObjectURL(memory.blob);
        const card = document.createElement("div");
        card.className = "memory-card";
        
        if (memory.type === 'photo') {
            const img = document.createElement("img");
            img.src = itemUrl;
            img.className = "memory-media";
            card.appendChild(img);
        } else if (memory.type === 'video') {
            const vid = document.createElement("video");
            vid.src = itemUrl;
            vid.autoplay = true; vid.loop = true; vid.muted = true;
            vid.className = "memory-media";
            card.appendChild(vid);
        }
        
        const caption = document.createElement("div");
        caption.className = "memory-caption";
        caption.innerText = memory.caption;
        card.appendChild(caption);
        
        gallery.appendChild(card);
    });
}

// Memory Screen Controls
backToChatBtn.addEventListener("click", () => {
    memoriesScreen.classList.remove("active");
    chatHubScreen.classList.add("active");
});

backToDashboardBtn.addEventListener("click", () => {
    memoriesScreen.classList.remove("active");
    dashboardScreen.classList.add("active");
});

// Note: initLivenessCamera() is no longer called immediately. It awaits user input from Welcome Screen.
