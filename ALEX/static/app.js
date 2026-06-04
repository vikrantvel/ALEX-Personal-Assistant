// ALEX Client Controller - Stark Industries
// Handles WebSocket streams, Speech Recognition/Synthesis, Custom Shell Commands, 3D Canvas, and Telemetry.

let socket = null;
let voiceEnabled = true;
let currentResponseElement = null;
let currentResponseText = "";
let speechRecognition = null;
let isListening = false;
let isSessionActive = false;
let sessionTimeout = null;
let uvicornWsUrl = `ws://${window.location.host}/ws`;
let isAborted = false;

// 3D Octagonal Prism variables
let prismCanvas = null;
let prismCtx = null;
let prismAnimationId = null;
let rotX = 0.45;
let rotY = 0.55;
let rotZ = 0.15;

// Processor Telemetry variables
const cpuHistory = Array(45).fill(12); // Rolling history
let cpuCanvas = null;
let cpuCtx = null;

// Holo-Simulation variables
// Holo-Simulation variables
let isHoloActive = false;
let holoAnimationId = null;
let holoLoadingAnimationId = null;
let activeHoloShape = "torus"; // Default idle state
let holoVertices = [];
let holoEdges = [];
let holoRotX = 0.37;
let holoRotY = 3.98;
let holoRotZ = 0.05;
let holoZoom = 1.4; // Default to 1.4x as requested by user / visual reference
let isDraggingHolo = false;
let isAutoRotateActive = true;
let lastMouseX = 0;
let lastMouseY = 0;
let selectedVehicle = null;
let isDraggingVehicle = false;

let isShutdownActive = false;
let holoWidth = 0;
let holoHeight = 0;
let cpuWidth = 0;
let cpuHeight = 0;

// Screenshot Upload state variables
let activeUploadedImagePath = null;
let screenshotUploadInput = null;
let uploadBtn = null;
let uploadPreviewContainer = null;
let uploadPreviewImg = null;
let removePreviewBtn = null;

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
const handleResize = debounce(() => {
    if (isHoloActive) {
        resizeHoloCanvas();
    }
    if (cpuCanvas) {
        initProcessorGraph();
    }
}, 60);
let cachedCosX = Math.cos(holoRotX), cachedSinX = Math.sin(holoRotX);
let cachedCosY = Math.cos(holoRotY), cachedSinY = Math.sin(holoRotY);
let cachedCosZ = Math.cos(holoRotZ), cachedSinZ = Math.sin(holoRotZ);

function updateTrigCache() {
    cachedCosX = Math.cos(holoRotX); cachedSinX = Math.sin(holoRotX);
    cachedCosY = Math.cos(holoRotY); cachedSinY = Math.sin(holoRotY);
    cachedCosZ = Math.cos(holoRotZ); cachedSinZ = Math.sin(holoRotZ);
}

function projectPointToScreen(x, y, z, w, h) {
    const distance = 4.0;
    const scale = 320;
    
    let rx = x * holoZoom;
    let ry = y * holoZoom;
    let rz = z * holoZoom;
    
    let tx1 = rx * cachedCosY + rz * cachedSinY;
    let tz1 = -rx * cachedSinY + rz * cachedCosY;
    
    let ty2 = ry * cachedCosX - tz1 * cachedSinX;
    let tz2 = ry * cachedSinX + tz1 * cachedCosX;
    
    let tx3 = tx1 * cachedCosZ - ty2 * cachedSinZ;
    let ty3 = tx1 * cachedSinZ + ty2 * cachedCosZ;
    
    if (tz2 >= distance - 0.15) return null;
    
    const perspective = 1 / (distance - tz2);
    const sx = tx3 * perspective * scale + w / 2;
    const sy = -ty3 * perspective * scale + h / 2;
    return { x: sx, y: sy, depth: tz2 };
}
const networkPackets = [];
const projectedCache = [];

// Pre-computed static circular angle caches for projector pedestal base drawing loops
const pedestalAngleCache32 = [];
for (let i = 0; i <= 32; i++) {
    const theta = (i * 2 * Math.PI) / 32;
    pedestalAngleCache32.push({ cos: Math.cos(theta), sin: Math.sin(theta) });
}
const pedestalAngleCache24 = [];
for (let i = 0; i <= 24; i++) {
    const theta = (i * 2 * Math.PI) / 24;
    pedestalAngleCache24.push({ cos: Math.cos(theta), sin: Math.sin(theta) });
}

let activeVehicles = [];

// Animation Matrix State variables
let isAnimVehicleActive = true;
let isAnimHumanActive = true;
let isAnimBuildingActive = true;
let isAnimEnvActive = true;

// World Building Matrix Sandbox state variables
let isWorldBuildingMode = false;
let selectedEntityPanel = null;
let selectedEntityNameLabel = null;
let btnAnimSelected = null;
let btnDeleteSelected = null;
let btnHoloMode = null;

// Hand Gesture Control state variables
let isHandControlMode = false;
let handCursorPos = null; // { x, y }
let isHandPinching = false;
let pinchFrameCounter = 0;
let isGestureLocked = false;
let lastHandX = null;
let lastHandY = null;
let lastRightHandX = null;
let lastRightHandY = null;
let lastLeftHandX = null;
let lastLeftHandY = null;
let leftHandSpecialMode = false;
let leftFistHoldFrames = 0;
let leftFistReleaseFrames = 0;
let leftFistLockout = false;
let leftPinchFrameCounter = 0;
let rightGestureHistory = [];
let leftGestureHistory = [];
let isProcessingFrame = false;
let lastWebcamFrameTime = 0;
let mediaPipeLoaded = false;
let mpHands = null;
let mpCamera = null;



// Single View floating sparks above the car
const holoCarSparks = [];

function ensureProjectedCacheSize(size) {
    while (projectedCache.length < size) {
        projectedCache.push({ x: 0, y: 0, z: 0, origColor: null, clipped: false });
    }
}

function updateHoloZoomUI() {
    const zoomRange = document.getElementById("zoom-range");
    const zoomDisplay = document.getElementById("zoom-display");
    if (zoomRange) zoomRange.value = holoZoom;
    if (zoomDisplay) zoomDisplay.textContent = holoZoom.toFixed(1) + "x";
}

// Holo DOM Elements
let hudHoloBtn = null;
let holoLoadingScreen = null;
let holoLoadingCanvas = null;
let holoLoadingCtx = null;
let holoSimulationScreen = null;
let holoCanvas = null;
let holoCtx = null;
let holoConsoleOutput = null;
let holoConsoleForm = null;
let holoConsoleInput = null;
let holoReturnBtn = null;
let holoMetaCoords = null;
let holoMetaShape = null;

let currentHoloThoughtElement = null;

// DOM Elements
const consoleOutput = document.getElementById("console-output");
const thoughtContainer = document.getElementById("thought-container");
const thoughtContent = document.getElementById("thought-content");
const terminalForm = document.getElementById("terminal-form");
const terminalInput = document.getElementById("terminal-input");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");
const voiceToggleBtn = document.getElementById("voice-toggle-btn");
const apiKeyInput = document.getElementById("api-key-input");
const saveApiKeyBtn = document.getElementById("save-api-key");
const shutdownCoreBtn = document.getElementById("shutdown-core-btn");
const apiStatusLabel = document.getElementById("api-status");
const systemStatusText = document.getElementById("system-status");
const timeDisplay = document.getElementById("time-display");
const connectionModeSelect = document.getElementById("connection-mode");
const ollamaModelInput = document.getElementById("ollama-model-input");
const stopBtn = document.getElementById("stop-btn");

// Telemetry & Alert Board Elements
const cpuBar = document.getElementById("cpu-bar");
const cpuValueLabel = document.getElementById("cpu-value");
const cpuAlertsList = document.getElementById("cpu-alerts-list");
const cpuAlertsEmpty = document.getElementById("cpu-alerts-empty");

// SFX elements
const sfxBeep = document.getElementById("sfx-beep");
const sfxAlarm = document.getElementById("sfx-alarm");
const sfxScan = document.getElementById("sfx-scan");

// Initialize on Load
window.addEventListener("DOMContentLoaded", () => {
    updateTime();
    setInterval(updateTime, 1000);
    loadSavedApiKey();
    setupTelemetrySimulation();
    setupSpeech();
    
    // SFX volumes
    sfxBeep.volume = 0.15;
    sfxAlarm.volume = 0.12;
    sfxScan.volume = 0.25;

    // Fetch Holo DOM elements
    hudHoloBtn = document.getElementById("hud-holo-btn");
    holoLoadingScreen = document.getElementById("holo-loading-screen");
    holoLoadingCanvas = document.getElementById("holo-loading-canvas");
    holoSimulationScreen = document.getElementById("holo-simulation-screen");
    holoCanvas = document.getElementById("holo-canvas");
    holoConsoleOutput = document.getElementById("holo-console-output");
    holoConsoleForm = document.getElementById("holo-console-form");
    holoConsoleInput = document.getElementById("holo-console-input");
    holoReturnBtn = document.getElementById("holo-return-btn");
    holoMetaCoords = document.getElementById("holo-meta-coords");
    holoMetaShape = document.getElementById("holo-meta-shape");
    
    // World Building Matrix DOM elements
    btnHoloMode = document.getElementById("holo-mode-btn");
    selectedEntityPanel = document.getElementById("selected-entity-panel");
    selectedEntityNameLabel = document.getElementById("selected-entity-name");
    btnAnimSelected = document.getElementById("btn-anim-selected");
    btnDeleteSelected = document.getElementById("btn-delete-selected");

    // Fetch Screenshot upload components
    screenshotUploadInput = document.getElementById("screenshot-upload");
    uploadBtn = document.getElementById("upload-btn");
    uploadPreviewContainer = document.getElementById("upload-preview-container");
    uploadPreviewImg = document.getElementById("upload-preview-img");
    removePreviewBtn = document.getElementById("remove-preview-btn");

    // Fetch Dual-Mode elements & buttons
    // Quad Core canvas elements and toggles decommissioned in Single-Core Volumetric upgrade

    if (holoLoadingCanvas) {
        holoLoadingCtx = holoLoadingCanvas.getContext("2d");
    }

    // Connect WebSocket
    connectWebSocket();

    // Event Listeners
    saveApiKeyBtn.addEventListener("click", initializeAlexCore);
    shutdownCoreBtn.addEventListener("click", shutdownCoreSystem);
    terminalForm.addEventListener("submit", handleTerminalSubmit);
    micBtn.addEventListener("click", toggleVoiceListening);

    if (uploadBtn) {
        uploadBtn.addEventListener("click", () => {
            screenshotUploadInput.click();
        });
    }
    if (screenshotUploadInput) {
        screenshotUploadInput.addEventListener("change", handleScreenshotSelection);
    }
    if (removePreviewBtn) {
        removePreviewBtn.addEventListener("click", clearScreenshotPreview);
    }
    voiceToggleBtn.addEventListener("click", toggleVoiceOutput);
    stopBtn.addEventListener("click", abortActiveResponse);

    if (hudHoloBtn) {
        hudHoloBtn.addEventListener("click", startHoloSimulationTransition);
    }
    if (holoReturnBtn) {
        holoReturnBtn.addEventListener("click", exitHoloSimulationToMainHUD);
    }
    if (btnHoloMode) {
        btnHoloMode.addEventListener("click", () => {
            if (!isWorldBuildingMode) {
                startWorldBuildingTransition();
            } else {
                exitWorldBuildingToScenarioMode();
            }
        });
    }
    if (holoConsoleForm) {
        holoConsoleForm.addEventListener("submit", handleHoloConsoleSubmit);
    }

    // Click trigger on 3D Prism to wake up microphone
    const prismTrigger = document.getElementById("prism-click-trigger");
    if (prismTrigger) {
        prismTrigger.addEventListener("click", () => {
            playSFX(sfxBeep);
            if (!isListening) {
                startVoiceListeningSession();
            } else {
                stopVoiceListeningSession();
            }
        });
    }

    // Keyboard Spacebar Wake trigger
    window.addEventListener("keydown", (e) => {
        // If Spacebar is pressed, and focus is not inside any input field, wake microphone!
        if (e.code === "Space" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA" && document.activeElement.tagName !== "SELECT") {
            e.preventDefault();
            playSFX(sfxBeep);
            if (!isListening) {
                startVoiceListeningSession();
            }
        }
    });

    // Mode Selector change listener
    if (connectionModeSelect) {
        connectionModeSelect.addEventListener("change", () => {
            const mode = connectionModeSelect.value;
            if (mode === "online") {
                apiKeyInput.style.display = "block";
                ollamaModelInput.style.display = "none";
            } else {
                apiKeyInput.style.display = "none";
                ollamaModelInput.style.display = "block";
            }
            playSFX(sfxBeep);
        });
    }

    // Dynamic hover sound on interactive nodes
    document.querySelectorAll(".stark-button, .stark-select, input").forEach(element => {
        element.addEventListener("mouseenter", () => playSFX(sfxBeep));
    });

    // Drag rotation controls on holo canvas
    if (holoCanvas) {
        holoCanvas.addEventListener("mousedown", (e) => {
            if (!isHoloActive) return;
            const rect = holoCanvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            let clickedVehicle = null;
            let minDistance = 35; // 35px comfortable radius
            
            activeVehicles.forEach(vehicle => {
                // To be robust against rotated/tall structures (e.g. skyscrapers or windmills),
                // we project every individual vertex of the wireframe and find the closest match!
                const numVerts = vehicle.vertices.length;
                const dynamicY = (Math.sin((holoSimState ? holoSimState.time : 0) * 25.0 + vehicle.bobbingOffset) * 0.003) + 
                                 (Math.sin((holoSimState ? holoSimState.time : 0) * 3.5 + vehicle.bobbingOffset) * 0.006);
                                 
                for (let i = 0; i < numVerts; i++) {
                    const v = vehicle.vertices[i];
                    let vx = v.x;
                    let vy = v.y;
                    let vz = v.z;
                    
                    // Wheel axle rotation
                    if (v.isWheel) {
                        const theta = (vehicle.isAnimated !== false) ? (vehicle.wheelSpinTime || 0) : 0;
                        const dy = v.y - v.axleY;
                        const dz = v.z - v.axleZ;
                        const rDist = Math.sqrt(dy * dy + dz * dz);
                        const currentAngle = Math.atan2(dy, dz);
                        const newAngle = currentAngle + theta;
                        vy = v.axleY + rDist * Math.sin(newAngle);
                        vz = v.axleZ + rDist * Math.cos(newAngle);
                    }
                    
                    // Windmill blade rotation
                    if (v.isWindmillBlade) {
                        const rotSpeed = 1.8;
                        const theta = (isAnimBuildingActive && vehicle.isAnimated !== false) ? ((holoSimState ? holoSimState.time : 0) * rotSpeed) : 0;
                        const bDx = v.x - v.pivotX;
                        const bDy = v.y - v.pivotY;
                        const rDist = Math.sqrt(bDx * bDx + bDy * bDy);
                        const baseAngle = Math.atan2(bDy, bDx);
                        const newAngle = baseAngle + theta;
                        vx = v.pivotX + rDist * Math.cos(newAngle);
                        vy = v.pivotY + rDist * Math.sin(newAngle);
                    }
                    
                    const screenPos = projectPointToScreen(vx + vehicle.x, vy + vehicle.y + dynamicY, vz + vehicle.z, rect.width, rect.height);
                    if (screenPos) {
                        const dist = Math.sqrt((mouseX - screenPos.x) * (mouseX - screenPos.x) + (mouseY - screenPos.y) * (mouseY - screenPos.y));
                        if (dist < minDistance) {
                            minDistance = dist;
                            clickedVehicle = vehicle;
                        }
                    }
                }
            });
            
            if (clickedVehicle) {
                selectedVehicle = clickedVehicle;
                selectedVehicle.manualLocation = true;
                selectedVehicle.manualHeight = true;
                isDraggingVehicle = true;
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
                playSFX(sfxBeep);
                printSystemMessage(`[HOLO-SYSTEM]: Selected ${selectedVehicle.type.toUpperCase()} for manual relocation.`);
                
                if (selectedEntityPanel) {
                    selectedEntityPanel.style.display = "flex";
                }
                if (selectedEntityNameLabel) {
                    selectedEntityNameLabel.textContent = `SELECTED: ${selectedVehicle.type.toUpperCase()}`;
                }
                if (btnAnimSelected) {
                    if (selectedVehicle.isAnimated !== false) {
                        btnAnimSelected.classList.remove("paused");
                        btnAnimSelected.textContent = "ANIMATE: ON";
                    } else {
                        btnAnimSelected.classList.add("paused");
                        btnAnimSelected.textContent = "ANIMATE: OFF";
                    }
                }
            } else {
                isDraggingHolo = true;
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
                
                selectedVehicle = null;
                if (selectedEntityPanel) {
                    selectedEntityPanel.style.display = "none";
                }
            }
        });
        window.addEventListener("mousemove", (e) => {
            if (isDraggingVehicle && selectedVehicle && isHoloActive) {
                const dx = e.clientX - lastMouseX;
                const dy = e.clientY - lastMouseY;
                
                const dragScale = 0.0035 / holoZoom;
                const moveX = dx * dragScale;
                const moveY = dy * dragScale;
                
                // 3D movement: 
                // Left/right drag dx moves left/right in screen-relative camera coordinate system (rotated by RotY)
                selectedVehicle.x += moveX * Math.cos(holoRotY);
                selectedVehicle.z += moveX * Math.sin(holoRotY);
                
                // Up/down drag dy moves vertically (up/down Y axis)
                selectedVehicle.y -= moveY;
                selectedVehicle.manualHeight = true; // Flag to bypass default ground height clamping
                selectedVehicle.manualLocation = true; // Flag to bypass path-correction & lane pulling
                
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
                
            } else if (isDraggingHolo && isHoloActive) {
                if (!isGestureLocked) {
                    const dx = e.clientX - lastMouseX;
                    const dy = e.clientY - lastMouseY;
                    holoRotY += dx * 0.007;
                    holoRotX += dy * 0.007;
                }
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
            }
        });
        window.addEventListener("mouseup", () => {
            isDraggingHolo = false;
            isDraggingVehicle = false;
        });
        // Add zoom / relocation depth control via mouse scroll wheel!
        holoCanvas.addEventListener("wheel", (e) => {
            if (isHoloActive) {
                if (isDraggingVehicle && selectedVehicle) {
                    e.preventDefault();
                    const depthScale = 0.012 / holoZoom;
                    // Scroll Z depth translation - front/back relative to camera RotY
                    selectedVehicle.x -= e.deltaY * depthScale * Math.sin(holoRotY);
                    selectedVehicle.z += e.deltaY * depthScale * Math.cos(holoRotY);
                    selectedVehicle.initialZ = selectedVehicle.z;
                } else {
                    e.preventDefault();
                    if (!isGestureLocked) {
                        holoZoom += e.deltaY * -0.001;
                        holoZoom = Math.min(18.0, Math.max(0.2, holoZoom));
                        updateHoloZoomUI();
                    }
                }
            }
        }, { passive: false });

        // Bind interactive floating zoom tool buttons & range slider
        const zoomInBtn = document.getElementById("zoom-in-btn");
        const zoomOutBtn = document.getElementById("zoom-out-btn");
        const zoomResetBtn = document.getElementById("zoom-reset-btn");
        const zoomRange = document.getElementById("zoom-range");

        if (zoomInBtn) {
            zoomInBtn.addEventListener("click", () => {
                if (!isGestureLocked) {
                    holoZoom = Math.min(18.0, holoZoom + 0.5);
                    updateHoloZoomUI();
                    playSFX(sfxBeep);
                }
            });
        }
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener("click", () => {
                if (!isGestureLocked) {
                    holoZoom = Math.max(0.2, holoZoom - 0.5);
                    updateHoloZoomUI();
                    playSFX(sfxBeep);
                }
            });
        }
        if (zoomResetBtn) {
            zoomResetBtn.addEventListener("click", () => {
                if (!isGestureLocked) {
                    holoZoom = 1.0;
                    updateHoloZoomUI();
                    playSFX(sfxBeep);
                }
            });
        }
        if (zoomRange) {
            zoomRange.addEventListener("input", () => {
                if (!isGestureLocked) {
                    holoZoom = parseFloat(zoomRange.value);
                    const zoomDisplay = document.getElementById("zoom-display");
                    if (zoomDisplay) zoomDisplay.textContent = holoZoom.toFixed(1) + "x";
                } else {
                    zoomRange.value = holoZoom;
                }
            });
        }
        
        const rotateToggle = document.getElementById("holo-rotate-toggle");
        if (rotateToggle) {
            rotateToggle.addEventListener("click", () => {
                isAutoRotateActive = !isAutoRotateActive;
                if (isAutoRotateActive) {
                    rotateToggle.classList.remove("paused");
                    rotateToggle.textContent = "ACTIVE";
                } else {
                    rotateToggle.classList.add("paused");
                    rotateToggle.textContent = "PAUSED";
                }
                playSFX(sfxBeep);
            });
        }
        const holoHandToggle = document.getElementById("holo-hand-toggle");
        if (holoHandToggle) {
            holoHandToggle.addEventListener("click", () => {
                toggleHandControlMode();
            });
        }

        const btnAnimVehicle = document.getElementById("btn-anim-vehicle");
        if (btnAnimVehicle) {
            btnAnimVehicle.addEventListener("click", () => {
                isAnimVehicleActive = !isAnimVehicleActive;
                if (isAnimVehicleActive) {
                    btnAnimVehicle.classList.remove("paused");
                    btnAnimVehicle.textContent = "VEHICLES: ON";
                } else {
                    btnAnimVehicle.classList.add("paused");
                    btnAnimVehicle.textContent = "VEHICLES: OFF";
                }
                playSFX(sfxBeep);
            });
        }
        const btnAnimHuman = document.getElementById("btn-anim-human");
        if (btnAnimHuman) {
            btnAnimHuman.addEventListener("click", () => {
                isAnimHumanActive = !isAnimHumanActive;
                if (isAnimHumanActive) {
                    btnAnimHuman.classList.remove("paused");
                    btnAnimHuman.textContent = "HUMANS: ON";
                } else {
                    btnAnimHuman.classList.add("paused");
                    btnAnimHuman.textContent = "HUMANS: OFF";
                }
                playSFX(sfxBeep);
            });
        }
        const btnAnimBuilding = document.getElementById("btn-anim-building");
        if (btnAnimBuilding) {
            btnAnimBuilding.addEventListener("click", () => {
                isAnimBuildingActive = !isAnimBuildingActive;
                if (isAnimBuildingActive) {
                    btnAnimBuilding.classList.remove("paused");
                    btnAnimBuilding.textContent = "BUILDINGS: ON";
                } else {
                    btnAnimBuilding.classList.add("paused");
                    btnAnimBuilding.textContent = "BUILDINGS: OFF";
                }
                playSFX(sfxBeep);
            });
        }
        const btnAnimEnv = document.getElementById("btn-anim-env");
        if (btnAnimEnv) {
            btnAnimEnv.addEventListener("click", () => {
                isAnimEnvActive = !isAnimEnvActive;
                if (isAnimEnvActive) {
                    btnAnimEnv.classList.remove("paused");
                    btnAnimEnv.textContent = "ENVIRON: ON";
                } else {
                    btnAnimEnv.classList.add("paused");
                    btnAnimEnv.textContent = "ENVIRON: OFF";
                }
                playSFX(sfxBeep);
            });
        }
        if (btnAnimSelected) {
            btnAnimSelected.addEventListener("click", () => {
                if (selectedVehicle) {
                    selectedVehicle.isAnimated = selectedVehicle.isAnimated !== false ? false : true;
                    if (selectedVehicle.isAnimated) {
                        btnAnimSelected.classList.remove("paused");
                        btnAnimSelected.textContent = "ANIMATE: ON";
                    } else {
                        btnAnimSelected.classList.add("paused");
                        btnAnimSelected.textContent = "ANIMATE: OFF";
                    }
                    playSFX(sfxBeep);
                }
            });
        }
        if (btnDeleteSelected) {
            btnDeleteSelected.addEventListener("click", () => {
                if (selectedVehicle) {
                    const idx = activeVehicles.indexOf(selectedVehicle);
                    if (idx > -1) {
                        activeVehicles.splice(idx, 1);
                    }
                    selectedVehicle = null;
                    if (selectedEntityPanel) {
                        selectedEntityPanel.style.display = "none";
                    }
                    playSFX(sfxBeep);
                }
            });
        }
    }

    // Initialize Canvas Renders
    init3DPrism();
    initProcessorGraph();
});

// Update Futuristic Timestamp
function updateTime() {
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').substring(0, 19) + " UTC";
    if (timeDisplay) timeDisplay.textContent = timeStr;
}

// Play UI Sound Effects
function playSFX(audioElement) {
    if (audioElement) {
        audioElement.currentTime = 0;
        audioElement.play().catch(() => {}); // bypass browser security blocking auto-play
    }
}

// WebSocket Connection Setup
function connectWebSocket() {
    socket = new WebSocket(uvicornWsUrl);

    socket.onopen = () => {
        printSystemMessage("[SYSTEM]: Quantum WebSocket Link Established.");
        disableConsoleControls(); // Enable local command console inputs immediately
        
        const savedMode = localStorage.getItem("pa_connection_mode") || "online";
        const savedKey = localStorage.getItem("gemini_api_key");
        const savedModel = localStorage.getItem("ollama_model_name") || "deepseek-r1:8b";
        
        if (savedMode === "offline" || (savedMode === "online" && savedKey)) {
            socket.send(JSON.stringify({ 
                type: "init", 
                mode: savedMode, 
                apiKey: savedKey,
                modelName: savedModel
            }));
        }
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
            case "status":
                printSystemMessage("[ALEX]: " + data.message);
                apiStatusLabel.textContent = "CORE READY";
                apiStatusLabel.style.color = "var(--neon-green)";
                systemStatusText.textContent = "CORE STATUS: SECURE";
                enableConsoleControls();
                speak("At your service, Sir.");
                break;
            case "autonomous_alert":
                // Handle alert silently if CPU or memory, otherwise regular
                if (data.alertType === "cpu_spike" || data.alertType === "mem_spike") {
                    // Push to our silent alerts notification console inside the CPU widget
                    logSilentProcessorAlert(data.alertType, data.message);
                } else {
                    // For network threats, render in main console and announce
                    printErrorMessage(`[AUTONOMOUS WARNING]: ${data.message}`);
                    if (data.alertType === "port_exposure") {
                        activateCyberAlertMode(); 
                    } else {
                        playSFX(sfxBeep);
                    }
                    speak(data.message);
                }
                break;
            case "typing":
                if (!isAborted) {
                    stopBtn.style.display = "inline-block";
                    showTypingIndicator();
                }
                break;
            case "thought":
                if (isAborted) return;
                stopBtn.style.display = "inline-block";
                if (isHoloActive) {
                    removeTypingIndicator();
                    streamHoloThoughtToken(data.text);
                } else {
                    thoughtContainer.classList.remove("hidden");
                    removeTypingIndicator();
                    thoughtContent.textContent = data.text;
                    thoughtContainer.scrollTop = thoughtContainer.scrollHeight;
                }
                break;
            case "token":
                if (isAborted) return;
                stopBtn.style.display = "inline-block";
                removeTypingIndicator();
                streamResponseToken(data.text);
                break;
            case "done":
                stopBtn.style.display = "none";
                if (isAborted) {
                    isAborted = false;
                } else {
                    finalizeResponse();
                }
                break;
            case "error":
                stopBtn.style.display = "none";
                isAborted = false;
                removeTypingIndicator();
                printErrorMessage("[ALERT ERROR]: " + data.message);
                disableConsoleControls();
                apiStatusLabel.textContent = "INITIALIZE ERROR";
                apiStatusLabel.style.color = "var(--neon-red)";
                speak("Apologies Sir, we have encountered an operational core link failure.");
                break;
        }
    };

    socket.onclose = () => {
        if (isShutdownActive) {
            printErrorMessage("[SYSTEM]: Core deactivated. Connection severed.");
            return;
        }
        printSystemMessage("[SYSTEM]: WebSocket Link Offline. Reconnecting in 5 seconds...");
        disableConsoleControls();
        setTimeout(connectWebSocket, 5000);
    };

    socket.onerror = (err) => {
        console.error("WS Error:", err);
    };
}

// Setup and Save Key
function loadSavedApiKey() {
    const mode = localStorage.getItem("pa_connection_mode") || "online";
    const key = localStorage.getItem("gemini_api_key");
    const model = localStorage.getItem("ollama_model_name") || "deepseek-r1:8b";
    
    if (connectionModeSelect) connectionModeSelect.value = mode;
    
    if (connectionModeSelect) {
        if (mode === "online") {
            apiKeyInput.style.display = "block";
            ollamaModelInput.style.display = "none";
        } else {
            apiKeyInput.style.display = "none";
            ollamaModelInput.style.display = "block";
        }
    }
    
    if (key && apiKeyInput) {
        apiKeyInput.value = "••••••••••••••••••••••••";
        apiStatusLabel.textContent = "KEY SECURED";
        apiStatusLabel.style.color = "var(--neon-red)";
    }
    
    if (model && ollamaModelInput) {
        ollamaModelInput.value = model;
    }
}

function initializeAlexCore() {
    const mode = connectionModeSelect ? connectionModeSelect.value : "online";
    const key = apiKeyInput.value.trim();
    const modelName = ollamaModelInput ? (ollamaModelInput.value.trim() || "deepseek-r1:8b") : "deepseek-r1:8b";
    
    localStorage.setItem("pa_connection_mode", mode);
    localStorage.setItem("ollama_model_name", modelName);
    
    if (mode === "online" && key) {
        if (key !== "••••••••••••••••••••••••") {
            localStorage.setItem("gemini_api_key", key);
        }
    }
    
    const targetKey = key === "••••••••••••••••••••••••" ? localStorage.getItem("gemini_api_key") : key;
    
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ 
            type: "init", 
            mode: mode, 
            apiKey: targetKey,
            modelName: modelName
        }));
        playSFX(sfxBeep);
    }
}

// Programmatic Shutdown of Background Python uvicorn
function shutdownCoreSystem() {
    if (confirm("Deactivate system processes and sever the ALEX core, Sir?")) {
        isShutdownActive = true;
        playSFX(sfxBeep);
        speak("Deactivating system cores. Farewell, Sir.");
        printSystemMessage("[SYSTEM]: Deploying deactivation sequence...");
        
        fetch("/api/shutdown", { method: "POST" })
            .then(res => res.json())
            .then(() => {
                printErrorMessage("[SYSTEM]: Core deactivation successful.");
                disableConsoleControls();
                apiStatusLabel.textContent = "CORES INACTIVE";
                apiStatusLabel.style.color = "var(--text-dim)";
            })
            .catch(() => {
                printErrorMessage("[SYSTEM]: Core severed.");
                disableConsoleControls();
                apiStatusLabel.textContent = "CORES INACTIVE";
                apiStatusLabel.style.color = "var(--text-dim)";
            });
    }
}

// Enable HUD console inputs
function enableConsoleControls() {
    terminalInput.disabled = false;
    sendBtn.disabled = false;
    terminalInput.placeholder = "Enter high-tech command or speak...";
}

// Disable Console Controls
function disableConsoleControls() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        terminalInput.disabled = false;
        sendBtn.disabled = false;
        terminalInput.placeholder = "AI offline. Diagnostics commands active...";
    } else {
        terminalInput.disabled = true;
        sendBtn.disabled = true;
        terminalInput.placeholder = "ALEX Core unlinked. Reconnecting...";
    }
}

// Terminal Messages Log
function printSystemMessage(msg) {
    const targetConsole = isHoloActive ? holoConsoleOutput : consoleOutput;
    const div = document.createElement("div");
    div.className = "system-message";
    div.textContent = msg;
    targetConsole.appendChild(div);
    targetConsole.scrollTop = targetConsole.scrollHeight;
}

// Terminal Error Messages Log
function printErrorMessage(msg) {
    const targetConsole = isHoloActive ? holoConsoleOutput : consoleOutput;
    const div = document.createElement("div");
    div.className = "system-message";
    div.style.color = "var(--neon-red)";
    div.textContent = msg;
    targetConsole.appendChild(div);
    targetConsole.scrollTop = targetConsole.scrollHeight;
}

// Show Typing Indicator
function showTypingIndicator() {
    removeTypingIndicator();
    const targetConsole = isHoloActive ? holoConsoleOutput : consoleOutput;
    const div = document.createElement("div");
    div.id = "typing-indicator";
    div.className = "pa-response";
    div.innerHTML = `<span class="label">ALEX</span><span style="font-style: italic; opacity: 0.6;">compiling logic sequence...</span>`;
    targetConsole.appendChild(div);
    targetConsole.scrollTop = targetConsole.scrollHeight;
}

// Remove Typing Indicator
function removeTypingIndicator() {
    const ind = document.getElementById("typing-indicator");
    if (ind) ind.remove();
}

function streamResponseToken(token) {
    const targetConsole = isHoloActive ? holoConsoleOutput : consoleOutput;
    
    if (!currentResponseElement) {
        currentResponseElement = document.createElement("div");
        currentResponseElement.className = "pa-response";
        currentResponseElement.innerHTML = `<span class="label">ALEX</span><span class="response-text"></span>`;
        targetConsole.appendChild(currentResponseElement);
        currentResponseText = "";
    }
    
    const textNode = currentResponseElement.querySelector(".response-text");
    currentResponseText += token;
    textNode.innerHTML = formatMarkdown(currentResponseText);
    targetConsole.scrollTop = targetConsole.scrollHeight;
}

function finalizeResponse() {
    if (voiceEnabled && currentResponseText) {
        const cleanText = currentResponseText
            .replace(/<\/?[^>]+(>|$)/g, "") // remove HTML
            .replace(/[\*\_#`]/g, "");     // remove basic MD
        speak(cleanText);
    }
    
    currentResponseElement = null;
    currentResponseText = "";
    currentHoloThoughtElement = null;
    thoughtContainer.classList.add("hidden");
    thoughtContent.textContent = "";
}

function escapeHTML(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Simple markdown formatting
function formatMarkdown(text) {
    let escaped = escapeHTML(text);
    let formatted = escaped
        .replace(/`([^`]+)`/g, '<code class="code-span">$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
    return formatted;
}

// Command execution helper
function triggerCommand(cmdText) {
    terminalInput.value = cmdText;
    handleTerminalSubmit(new Event('submit'));
}

// Terminal Query Handling
function handleTerminalSubmit(e) {
    if (e) e.preventDefault();
    
    const text = terminalInput.value.trim();
    if (!text) return;

    const userDiv = document.createElement("div");
    userDiv.className = "user-query";
    const safeText = escapeHTML(text);
    userDiv.innerHTML = `<span class="label">USER</span>${safeText}`;
    consoleOutput.appendChild(userDiv);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;

    terminalInput.value = "";
    playSFX(sfxBeep);

    // Stop microphone session immediately on transmit
    if (isListening) {
        stopVoiceListeningSession();
    }

    isAborted = false;
    stopBtn.style.display = "none";

    if (text.startsWith("/")) {
        handleShellCommand(text);
    } else {
        const cleanText = text.toLowerCase();
        if (cleanText.includes("hologram") || cleanText.includes("holo") || cleanText.includes("simulate")) {
            if (isHoloActive) {
                // Already inside the holo dashboard, just submit directly without reloading/re-transitioning!
                if (holoConsoleInput) {
                    let coreQuery = text;
                    const strips = [
                        /make\s+a\s+hologram\s+of\s+/i,
                        /make\s+hologram\s+of\s+/i,
                        /create\s+a\s+hologram\s+of\s+/i,
                        /create\s+hologram\s+of\s+/i,
                        /simulate\s+a\s+/i,
                        /simulate\s+/i,
                        /hologram\s+of\s+/i,
                        /hologram\s+/i,
                        /holo-simulation\s+of\s+/i,
                        /holo\s+/i
                    ];
                    for (const rx of strips) {
                        coreQuery = coreQuery.replace(rx, "");
                    }
                    holoConsoleInput.value = coreQuery;
                    handleHoloConsoleSubmit();
                }
            } else {
                // Auto transition to the premium Stark Holographic Visualizer Dashboard
                startHoloSimulationTransition();
                
                // Clean query and submit to Holo-Simulation Console once visualizer transitions online
                setTimeout(() => {
                    if (holoConsoleInput) {
                        let coreQuery = text;
                        const strips = [
                            /make\s+a\s+hologram\s+of\s+/i,
                            /make\s+hologram\s+of\s+/i,
                            /create\s+a\s+hologram\s+of\s+/i,
                            /create\s+hologram\s+of\s+/i,
                            /simulate\s+a\s+/i,
                            /simulate\s+/i,
                            /hologram\s+of\s+/i,
                            /hologram\s+/i,
                            /holo-simulation\s+of\s+/i,
                            /holo\s+/i
                        ];
                        for (const rx of strips) {
                            coreQuery = coreQuery.replace(rx, "");
                        }
                        holoConsoleInput.value = coreQuery;
                        handleHoloConsoleSubmit();
                    }
                }, 2600);
            }
        } else {
            if (socket && socket.readyState === WebSocket.OPEN) {
                const statusText = apiStatusLabel.textContent;
                if (statusText !== "CORE READY" && statusText !== "KEY SECURED") {
                    printErrorMessage("[ALEX SYSTEM UNCOUPLED]: Sir, my AI cores are unlinked.");
                    printSystemMessage("Please couple cores via the Top Right Configuration settings.");
                    speak("Core coupling required, Sir. Local diagnostic overrides are available.");
                    return;
                }
                socket.send(JSON.stringify({ 
                    type: "chat", 
                    text: text,
                    image_path: activeUploadedImagePath
                }));
                
                // Clear screenshot preview after transmitting
                clearScreenshotPreview();
            }
        }
    }
}

// Shell command logic
function handleShellCommand(cmd) {
    const parts = cmd.split(" ");
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(" ");

    switch (command) {
        case "/help":
            printSystemMessage("[ALEX CORE COMMAND DIRECTORY]:");
            printSystemMessage("  /cyber           - Trigger tactical cybersecurity posture.");
            printSystemMessage("  /secure          - Secure visual sensors back to CLEAR.");
            printSystemMessage("  /deepscan        - Run structural forensics on operating systems & services.");
            printSystemMessage("  /malware         - Deploy heuristics keylogger & Trojan network logs.");
            printSystemMessage("  /scan [ports]    - Scan standard localhost ports (e.g. /scan 1-1024).");
            printSystemMessage("  /audit [code]    - Performs secure audit checks on code input.");
            printSystemMessage("  /bugbro          - Deploy patient cybersecurity step-by-step bug bounty mentor.");
            printSystemMessage("  /clear           - Wipe console diagnostic lines.");
            speak("Displaying shell commands, Sir.");
            break;
            
        case "/clear":
            consoleOutput.innerHTML = "";
            printSystemMessage("[SYSTEM]: Diagnostics wiped.");
            break;

        case "/cyber":
            activateCyberAlertMode();
            break;

        case "/secure":
            deactivateCyberAlertMode();
            break;

        case "/deepscan":
            runDeepSystemAuditTool();
            break;

        case "/malware":
            runMalwareAuditTool();
            break;

        case "/scan":
            runPortScannerTool(args || "1-1024");
            break;

        case "/audit":
            runCodeAuditorTool(args);
            break;

        case "/bugbro":
            runBugBroTool();
            break;

        default:
            printErrorMessage(`[SYSTEM ERROR]: Command "${command}" not indexed.`);
            speak("Apologies Sir, command not found.");
            break;
    }
}

// Tactical Alert Mode (/cyber)
function activateCyberAlertMode() {
    document.body.classList.add("tactical-alert");
    systemStatusText.textContent = "CORE STATUS: INTRUSION IMMINENT";
    playSFX(sfxAlarm);
    printErrorMessage("[WARNING]: Cyber Alert Protocol Engaged. Securing perimeter channels.");
    speak("Sir, I have triggered tactical warning parameters. All firewalls deployed.");
}

// Deactivate Cyber Alert Mode
function deactivateCyberAlertMode() {
    document.body.classList.remove("tactical-alert");
    systemStatusText.textContent = "CORE STATUS: SECURE";
    sfxAlarm.pause();
    sfxAlarm.currentTime = 0;
    printSystemMessage("[SYSTEM]: Perimeter secured. Returning core parameters to normal.");
    speak("System logs clear. Security posture secure.");
}

// Deep System Auditor Tool
function runDeepSystemAuditTool() {
    playSFX(sfxScan);
    printSystemMessage("[SYSTEM]: Deploying core OS diagnostics. Compiling metrics...");
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "chat", text: "/deepscan" }));
    }
}

// BUG BRO Educational Assistant Tool
function runBugBroTool() {
    playSFX(sfxScan);
    printSystemMessage("[BUG BRO]: Initializing Interactive Step-by-Step Bug Bounty Assistant...");
    printSystemMessage("Welcome, Sir! I am BUG BRO, your patient cybersecurity mentor.");
    printSystemMessage("I will guide you step-by-step through setting up, scanning, and testing local educational sandboxes with zero prior knowledge.");
    speak("BUG BRO coupled, Sir. I am ready to guide your security walkthrough.");
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "chat", text: "BUG BRO: Please initialize the step-by-step bug bounty mentor assistant for legal, educational testing." }));
    }
}

// Malware & Network Packet Forensics Scanner Tool
function runMalwareAuditTool() {
    playSFX(sfxScan);
    printSystemMessage("[SYSTEM]: Initializing heuristic malware scan...");
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "chat", text: "/malware" }));
    }
}

// Port Scanner command trigger
function runPortScannerTool(portsRange) {
    playSFX(sfxScan);
    printSystemMessage(`[SYSTEM]: Scanning local port bindings: ${portsRange}...`);
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "chat", text: `/scan ${portsRange}` }));
    }
}

// Code Auditor command trigger
function runCodeAuditorTool(codeSnippet) {
    if (!codeSnippet) {
        printErrorMessage("[SYSTEM ERROR]: Input block required.");
        speak("I require code variables to audit, Sir.");
        return;
    }
    printSystemMessage("[SYSTEM]: Commencing static heuristic code vulnerability scan...");
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "chat", text: `/audit ${codeSnippet}` }));
    }
}

// Telemetry Simulation (client-side rolling telemetry loop)
function setupTelemetrySimulation() {
    setInterval(() => {
        if (document.hidden) return;
        
        let isCyber = document.body.classList.contains("tactical-alert");
        let cpuBase = isCyber ? 68 : 14;
        let cpu = Math.min(100, Math.max(0, cpuBase + Math.floor(Math.random() * 14 - 7)));

        // Skip DOM progress updates when HUD is hidden / holo is active
        if (!isHoloActive) {
            if (cpuBar) cpuBar.style.width = `${cpu}%`;
            if (cpuValueLabel) cpuValueLabel.textContent = `${cpu}%`;
        }

        // Update sparkline data
        cpuHistory.push(cpu);
        cpuHistory.shift();

        // Re-draw CPU graph
        drawProcessorGraph();
    }, 1500);
}

// Draw Processor sparkline graph
function initProcessorGraph() {
    cpuCanvas = document.getElementById("cpu-graph-canvas");
    if (cpuCanvas) {
        cpuCtx = cpuCanvas.getContext("2d");
        
        // Scale for high pixel density
        const dpr = window.devicePixelRatio || 1;
        const rect = cpuCanvas.getBoundingClientRect();
        cpuWidth = rect.width;
        cpuHeight = rect.height;
        cpuCanvas.width = cpuWidth * dpr;
        cpuCanvas.height = cpuHeight * dpr;
        cpuCtx.scale(dpr, dpr);
    }
}

function drawProcessorGraph() {
    if (isHoloActive || document.hidden) return;
    if (!cpuCanvas || !cpuCtx) return;
    const w = cpuWidth;
    const h = cpuHeight;
    if (w === 0 || h === 0) return;
    
    cpuCtx.clearRect(0, 0, w, h);

    // Draw Grid Lines (Futuristic Grid)
    cpuCtx.strokeStyle = "rgba(255, 42, 42, 0.08)";
    cpuCtx.lineWidth = 1;
    
    // Vertical grid lines
    for (let x = 0; x < w; x += 30) {
        cpuCtx.beginPath();
        cpuCtx.moveTo(x, 0);
        cpuCtx.lineTo(x, h);
        cpuCtx.stroke();
    }
    // Horizontal grid lines
    for (let y = 0; y < h; y += 20) {
        cpuCtx.beginPath();
        cpuCtx.moveTo(0, y);
        cpuCtx.lineTo(w, y);
        cpuCtx.stroke();
    }

    if (cpuHistory.length === 0) return;

    // Draw sparkline path
    const pointsCount = cpuHistory.length;
    cpuCtx.beginPath();
    
    for (let i = 0; i < pointsCount; i++) {
        const val = cpuHistory[i];
        const x = (i / (pointsCount - 1)) * w;
        // Invert Y axis
        const y = h - (val / 100) * (h - 10) - 5;
        
        if (i === 0) {
            cpuCtx.moveTo(x, y);
        } else {
            cpuCtx.lineTo(x, y);
        }
    }

    // Fill under graph (Neon Red Area)
    const gradient = cpuCtx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "rgba(255, 42, 42, 0.22)");
    gradient.addColorStop(1, "rgba(255, 42, 42, 0.0)");
    
    cpuCtx.lineTo(w, h);
    cpuCtx.lineTo(0, h);
    cpuCtx.closePath();
    cpuCtx.fillStyle = gradient;
    cpuCtx.fill();

    // Draw Line Outline
    cpuCtx.beginPath();
    for (let i = 0; i < pointsCount; i++) {
        const val = cpuHistory[i];
        const x = (i / (pointsCount - 1)) * w;
        const y = h - (val / 100) * (h - 10) - 5;
        if (i === 0) cpuCtx.moveTo(x, y);
        else cpuCtx.lineTo(x, y);
    }
    cpuCtx.strokeStyle = "rgba(255, 42, 42, 0.85)";
    cpuCtx.lineWidth = 1.8;
    cpuCtx.stroke();

    // Pulse Dot on Latest point
    const latestVal = cpuHistory[pointsCount - 1];
    const dx = w;
    const dy = h - (latestVal / 100) * (h - 10) - 5;
    
    cpuCtx.beginPath();
    cpuCtx.arc(dx - 3, dy, 3.5, 0, 2 * Math.PI);
    cpuCtx.fillStyle = "rgba(255, 42, 42, 1)";
    cpuCtx.fill();
    
    cpuCtx.beginPath();
    cpuCtx.arc(dx - 3, dy, 7, 0, 2 * Math.PI);
    cpuCtx.strokeStyle = "rgba(255, 42, 42, 0.4)";
    cpuCtx.stroke();
}

// Log Silent alerts in bottom right board (no TTS sound)
function logSilentProcessorAlert(type, message) {
    if (!cpuAlertsList) return;
    
    // Hide empty placeholder
    if (cpuAlertsEmpty) cpuAlertsEmpty.style.display = "none";

    const timestamp = new Date().toTimeString().split(' ')[0];
    const alertDiv = document.createElement("div");
    
    // Add classes
    alertDiv.className = "cpu-alert-item critical";
    alertDiv.innerHTML = `<span class="alert-time">[${timestamp}]</span><span class="alert-msg">${message}</span>`;
    
    // Prepend to top of list
    cpuAlertsList.insertBefore(alertDiv, cpuAlertsList.firstChild);
    
    // Play a subtle beep
    playSFX(sfxBeep);

    // Limit elements to 15 to preserve performance
    while (cpuAlertsList.children.length > 15) {
        cpuAlertsList.lastChild.remove();
    }
}

// Pre-generated static vertices to prevent heavy garbage collection overhead in drawing loop
const baseVertices = [];
const prismProjectedCache = [];
const cachedFaces = [];

function ensurePrismCacheSize(size) {
    while (prismProjectedCache.length < size) {
        prismProjectedCache.push({ x: 0, y: 0, z: 0 });
    }
}

function initCachedFaces() {
    // 8 Side Rectangular Panels
    for (let i = 0; i < 8; i++) {
        const next = (i + 1) % 8;
        let color = "rgba(255, 42, 42, 0.25)"; 
        let stroke = "rgba(255, 42, 42, 0.75)";
        
        if (i % 3 === 1) {
            color = "rgba(0, 240, 255, 0.25)"; 
            stroke = "rgba(0, 240, 255, 0.75)";
        } else if (i % 3 === 2) {
            color = "rgba(5, 1, 2, 0.82)";     
            stroke = "rgba(255, 42, 42, 0.4)";
        }
        
        cachedFaces.push({
            indices: [i, next, next + 8, i + 8],
            color: color,
            stroke: stroke,
            avgZ: 0
        });
    }

    // Top Octagon Face
    cachedFaces.push({
        indices: [0, 1, 2, 3, 4, 5, 6, 7],
        color: "rgba(14, 2, 4, 0.72)",
        stroke: "rgba(255, 42, 42, 0.8)",
        avgZ: 0
    });

    // Bottom Octagon Face
    cachedFaces.push({
        indices: [15, 14, 13, 12, 11, 10, 9, 8],
        color: "rgba(5, 1, 2, 0.8)",
        stroke: "rgba(255, 42, 42, 0.6)",
        avgZ: 0
    });
}

let lastFrameTime = 0;
const fpsLimit = 18; 
const frameDelay = 1000 / fpsLimit;

function pregeneratePrismVertices() {
    const radius = 1.0;
    const heightLimit = 0.85;
    baseVertices.length = 0;
    // Generate Top face vertices (indices 0-7)
    for (let i = 0; i < 8; i++) {
        const theta = (i * Math.PI) / 4;
        baseVertices.push({ x: radius * Math.cos(theta), y: -heightLimit, z: radius * Math.sin(theta) });
    }
    // Generate Bottom face vertices (indices 8-15)
    for (let i = 0; i < 8; i++) {
        const theta = (i * Math.PI) / 4;
        baseVertices.push({ x: radius * Math.cos(theta), y: heightLimit, z: radius * Math.sin(theta) });
    }
}

function init3DPrism() {
    prismCanvas = document.getElementById("prism-canvas");
    if (!prismCanvas) return;
    prismCtx = prismCanvas.getContext("2d");
    
    // Pregenerate vertices once
    pregeneratePrismVertices();
    
    const renderLoop = (timestamp) => {
        if (!lastFrameTime) lastFrameTime = timestamp;
        const elapsed = timestamp - lastFrameTime;
        
        if (elapsed >= frameDelay) {
            if (!document.hidden && !isHoloActive) {
                draw3DPrism();
            }
            lastFrameTime = timestamp - (elapsed % frameDelay);
        }
        prismAnimationId = requestAnimationFrame(renderLoop);
    };
    
    prismAnimationId = requestAnimationFrame(renderLoop);
}

function draw3DPrism() {
    if (isHoloActive) return; // Suspended when Holo is active to save CPU!
    if (!prismCanvas || !prismCtx) return;
    const w = prismCanvas.width;
    const h = prismCanvas.height;
    
    prismCtx.clearRect(0, 0, w, h);

    // Apply incremental rotations
    rotY += 0.012; 
    rotX = 0.45 + Math.sin(rotY * 0.25) * 0.1; 
    rotZ = Math.cos(rotY * 0.15) * 0.06;      

    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const cosZ = Math.cos(rotZ), sinZ = Math.sin(rotZ);

    const scale = 320;
    const distance = 3.2; 
    
    const numVerts = baseVertices.length;
    ensurePrismCacheSize(numVerts);
    
    // Rotate and project in-place
    for (let i = 0; i < numVerts; i++) {
        const v = baseVertices[i];
        let x1 = v.x * cosY + v.z * sinY;
        let z1 = -v.x * sinY + v.z * cosY;
        
        let y2 = v.y * cosX - z1 * sinX;
        let z2 = v.y * sinX + z1 * cosX;
        
        let x3 = x1 * cosZ - y2 * sinZ;
        let y3 = x1 * sinZ + y2 * cosZ;
        
        const perspective = 1 / (distance - z2);
        
        const p = prismProjectedCache[i];
        p.x = x3 * perspective * scale + w / 2;
        p.y = y3 * perspective * scale + h / 2;
        p.z = z2;
    }

    // Initialize static faces array once if empty
    if (cachedFaces.length === 0) {
        initCachedFaces();
    }

    // Calculate depths in-place
    for (let i = 0; i < cachedFaces.length; i++) {
        const face = cachedFaces[i];
        let sumZ = 0;
        const numIndices = face.indices.length;
        for (let j = 0; j < numIndices; j++) {
            sumZ += prismProjectedCache[face.indices[j]].z;
        }
        face.avgZ = sumZ / numIndices;
    }

    // Sort cachedFaces in-place (Painter's algorithm sorting on small size of 10 elements is extremely fast)
    cachedFaces.sort((a, b) => a.avgZ - b.avgZ);

    // Render sorted faces using fast index indexing
    for (let i = 0; i < cachedFaces.length; i++) {
        const face = cachedFaces[i];
        prismCtx.beginPath();
        const numIndices = face.indices.length;
        for (let j = 0; j < numIndices; j++) {
            const pt = prismProjectedCache[face.indices[j]];
            if (j === 0) prismCtx.moveTo(pt.x, pt.y);
            else prismCtx.lineTo(pt.x, pt.y);
        }
        prismCtx.closePath();

        prismCtx.fillStyle = face.color;
        prismCtx.fill();

        prismCtx.strokeStyle = face.stroke;
        prismCtx.lineWidth = 1.2;
        prismCtx.stroke();
    }
}

// ----------------------------------------------------------------------
// ON-DEMAND VOICE CONTROL & SPEECH ENGINE
// ----------------------------------------------------------------------
function setupSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        speechRecognition = new SpeechRecognition();
        speechRecognition.continuous = false; // ON-DEMAND (STOP WHEN DONE / TIMEOUT)
        speechRecognition.interimResults = true; // REAL-TIME RESPONSE
        speechRecognition.lang = 'en-US';

        speechRecognition.onstart = () => {
            isListening = true;
            micBtn.classList.add("active");
            document.getElementById("voice-label").textContent = "ALEX MIC: ACTIVE (SPEAK NOW)";
            document.getElementById("voice-label").style.color = "var(--neon-blue)";
            playSFX(sfxBeep);
            
            // Set safety auto-sleep countdown (Inactivity timer)
            resetMicrophoneInactivityTimer();
        };

        speechRecognition.onresult = (event) => {
            // Keep microphone alive while speaking
            resetMicrophoneInactivityTimer();

            const lastIndex = event.results.length - 1;
            const result = event.results[lastIndex];
            const transcript = result[0].transcript.trim();
            const isFinal = result.isFinal;

            // Stream interim text into input field to let user see feedback
            if (transcript.length > 0) {
                terminalInput.value = transcript;
            }

            if (isFinal) {
                clearTimeout(sessionTimeout);
                // Transmit query immediately on final detection
                if (transcript.length > 0) {
                    handleTerminalSubmit();
                }
            }
        };

        speechRecognition.onerror = (e) => {
            console.error("Speech Recognition Error:", e);
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
                stopVoiceListeningSession();
                document.getElementById("voice-label").textContent = "ALEX MIC BLOCKED (CHECK PERMISSIONS)";
                document.getElementById("voice-label").style.color = "var(--neon-red)";
            }
        };

        speechRecognition.onend = () => {
            // Re-engage ONLY if flag still holds true, otherwise shut off cleanly
            if (isListening) {
                // If it ended due to system pausing, restart it
                try {
                    speechRecognition.start();
                } catch(_) {
                    stopVoiceListeningSession();
                }
            } else {
                stopVoiceListeningSession();
            }
        };
    } else {
        // Speech Recognition API unsupported
        micBtn.style.opacity = "0.3";
        micBtn.style.cursor = "not-allowed";
        micBtn.title = "Chrome required for Voice recognition.";
        document.getElementById("voice-label").textContent = "VOICE RECOGNITION UNSUPPORTED (USE CHROME)";
        document.getElementById("voice-label").style.color = "var(--neon-red)";
    }
}

// Reset activity sleep timer (microphones shuts off in 6s if completely quiet)
function resetMicrophoneInactivityTimer() {
    if (sessionTimeout) clearTimeout(sessionTimeout);
    sessionTimeout = setTimeout(() => {
        printSystemMessage("[ALEX]: Microphone sleeping due to inactivity, Sir.");
        stopVoiceListeningSession();
    }, 6000); // 6 seconds auto-sleep
}

// Toggle microphone session state on wake button clicks
function toggleVoiceListening() {
    playSFX(sfxBeep);
    if (isListening) {
        stopVoiceListeningSession();
    } else {
        startVoiceListeningSession();
    }
}

// Call ALEX voice awake
function startVoiceListeningSession() {
    if (!speechRecognition) return;
    
    isListening = true;
    try {
        speechRecognition.start();
        printSystemMessage("[ALEX]: Standing by for instructions, Sir...");
        speak("Yes, Sir? Directives.");
    } catch(err) {
        console.log("Failed to start speech recognition:", err);
    }
}

// Sever voice microphone
function stopVoiceListeningSession() {
    isListening = false;
    if (sessionTimeout) clearTimeout(sessionTimeout);
    
    if (speechRecognition) {
        try {
            speechRecognition.stop();
        } catch(_) {}
    }
    
    if (micBtn) micBtn.classList.remove("active");
    
    const voiceLabel = document.getElementById("voice-label");
    if (voiceLabel) {
        voiceLabel.textContent = "MIC STANDBY (CLICK PRISM / SPACEBAR TO WAKE)";
        voiceLabel.style.color = "var(--text-dim)";
    }
}

function toggleVoiceOutput() {
    voiceEnabled = !voiceEnabled;
    if (voiceEnabled) {
        voiceToggleBtn.innerHTML = "<span>&#128266;</span> VOICE DIALOGUE: ON";
        speak("Voice protocol re-engaged, Sir.");
    } else {
        voiceToggleBtn.innerHTML = "<span>&#128263;</span> VOICE DIALOGUE: OFF";
        window.speechSynthesis.cancel();
    }
}

// TTS engine
function speak(text) {
    if (!voiceEnabled) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    
    // British Daniel/Microsoft George Voice selection
    const ukRegex = /(uk|united kingdom|great britain|en-gb|daniel)/i;
    const maleRegex = /(male|george|google uk)/i;
    
    let bestVoice = voices.find(v => ukRegex.test(v.name) && maleRegex.test(v.name)) ||
                    voices.find(v => ukRegex.test(v.name)) ||
                    voices.find(v => /daniel/i.test(v.name)) ||
                    voices.find(v => /google/i.test(v.name)) ||
                    voices.find(v => v.lang.startsWith("en-GB")) ||
                    voices[0];
                    
    if (bestVoice) {
        utterance.voice = bestVoice;
    }
    
    utterance.rate = 1.05; // Sophisticated, crisp
    utterance.pitch = 0.95; // Warm British male accent
    
    window.speechSynthesis.speak(utterance);
}

if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {};
}

// Abort active streaming and speaking response instantly
function abortActiveResponse() {
    // 1. Halt TTS speech synthesis
    window.speechSynthesis.cancel();
    
    // 2. Set client side cancellation state
    isAborted = true;
    
    // 3. Render visual cancellation inline marker
    if (currentResponseElement) {
        const textNode = currentResponseElement.querySelector(".response-text");
        if (textNode) {
            textNode.innerHTML += ` <span style="color: var(--neon-red); font-family: var(--font-mono); font-weight: bold; font-style: italic; margin-left: 8px;">[TRANSMISSION INTERRUPTED BY SIR]</span>`;
        }
    }
    
    // 4. Reset streaming structures
    currentResponseElement = null;
    currentResponseText = "";
    removeTypingIndicator();
    if (thoughtContainer) thoughtContainer.classList.add("hidden");
    if (thoughtContent) thoughtContent.textContent = "";
    
    // 5. Hide stop button
    if (stopBtn) stopBtn.style.display = "none";
    
    // 6. Log visual system warning line
    printErrorMessage("[SYSTEM INTERRUPT]: Response stream halted on your instruction.");
    playSFX(sfxBeep);
}

// ----------------------------------------------------------------------
// HOLO-SIMULATION CONTROLLER & 3D CANVAS MATH ENGINE
// ----------------------------------------------------------------------

function streamHoloThoughtToken(text) {
    if (!currentHoloThoughtElement) {
        currentHoloThoughtElement = document.createElement("div");
        currentHoloThoughtElement.className = "pa-response thought-message";
        currentHoloThoughtElement.style.opacity = "0.75";
        currentHoloThoughtElement.style.borderLeft = "2px solid var(--neon-blue)";
        currentHoloThoughtElement.style.paddingLeft = "8px";
        currentHoloThoughtElement.style.fontSize = "0.78rem";
        currentHoloThoughtElement.innerHTML = `<span class="label" style="color: var(--neon-blue);">ANALYSIS</span><span class="response-text"></span>`;
        holoConsoleOutput.appendChild(currentHoloThoughtElement);
    }
    const textNode = currentHoloThoughtElement.querySelector(".response-text");
    textNode.textContent = text;
    holoConsoleOutput.scrollTop = holoConsoleOutput.scrollHeight;
}

function startHoloSimulationTransition() {
    playSFX(sfxBeep);
    
    // Stop microphone session immediately if listening
    if (isListening) {
        stopVoiceListeningSession();
    }
    
    // Completely suspend the main HUD's 3D octagonal prism rendering loop to save CPU!
    if (prismAnimationId) {
        cancelAnimationFrame(prismAnimationId);
        prismAnimationId = null;
    }
    
    // Hide main HUD container
    const hudContainer = document.querySelector(".hud-container");
    if (hudContainer) hudContainer.style.display = "none";
    
    // Show Loading Screen
    if (holoLoadingScreen) {
        holoLoadingScreen.style.display = "flex";
    }
    
    // Start Loading Screen Prism Animation
    loadingRotX = 0.45;
    loadingRotY = 0.55;
    loadingRotZ = 0.15;
    lastLoadingFrameTime = 0;
    
    if (holoLoadingCanvas && holoLoadingCtx) {
        // High DPR scaling
        const dpr = window.devicePixelRatio || 1;
        holoLoadingCanvas.width = 280 * dpr;
        holoLoadingCanvas.height = 280 * dpr;
        holoLoadingCtx.scale(dpr, dpr);
    }
    
    holoLoadingAnimationId = requestAnimationFrame(drawHoloLoadingPrism);
    
    speak("Accessing Stark holo-simulation matrix, coupling holographic cores.");
    
    // Transition after 2.5 seconds (2500ms)
    setTimeout(() => {
        // Cancel loading animation
        if (holoLoadingAnimationId) {
            cancelAnimationFrame(holoLoadingAnimationId);
            holoLoadingAnimationId = null;
        }
        
        // Hide loading screen
        if (holoLoadingScreen) holoLoadingScreen.style.display = "none";
        
        // Show Holo Simulation Workspace Screen
        if (holoSimulationScreen) holoSimulationScreen.style.display = "flex";
        
        // Initialize and start Holo-Engine
        isHoloActive = true;
        initHoloEngine();
        
        speak("Holo-simulation matrix online, Sir. Environment templates ready.");
        printSystemMessage("[HOLO-SYSTEM]: Tactical holographic projection successfully loaded.");
    }, 2500);
}

function exitHoloSimulationToMainHUD() {
    playSFX(sfxBeep);
    
    // Disable Holo-Engine
    isHoloActive = false;
    if (holoAnimationId) {
        cancelAnimationFrame(holoAnimationId);
        holoAnimationId = null;
    }
    if (holoLoadingAnimationId) {
        cancelAnimationFrame(holoLoadingAnimationId);
        holoLoadingAnimationId = null;
    }
    
    // Hide Holo screen & loading screen
    if (holoSimulationScreen) holoSimulationScreen.style.display = "none";
    if (holoLoadingScreen) holoLoadingScreen.style.display = "none";
    
    // Show Main HUD container
    const hudContainer = document.querySelector(".hud-container");
    if (hudContainer) hudContainer.style.display = "flex";
    
    // Safe restart of the main HUD's 3D prism loop!
    if (!prismAnimationId) {
        init3DPrism();
    }
    
    speak("System coordinates restored. Main HUD operational.");
}

function startWorldBuildingTransition() {
    playSFX(sfxScan);
    
    // Set loader screen messages
    const loaderText = document.querySelector(".holo-loading-text");
    const loaderSub = document.querySelector(".holo-loading-sub");
    if (loaderText) loaderText.textContent = "Initializing World Building Core...";
    if (loaderSub) loaderSub.textContent = "DEPLOYING VOLUMETRIC SANDBOX CORES";
    
    if (holoLoadingScreen) {
        holoLoadingScreen.style.display = "flex";
    }
    
    // Start Loading Screen Prism Animation
    loadingRotX = 0.45;
    loadingRotY = 0.55;
    loadingRotZ = 0.15;
    lastLoadingFrameTime = 0;
    
    if (holoLoadingCanvas && holoLoadingCtx) {
        const dpr = window.devicePixelRatio || 1;
        holoLoadingCanvas.width = 280 * dpr;
        holoLoadingCanvas.height = 280 * dpr;
        holoLoadingCtx.scale(dpr, dpr);
    }
    
    holoLoadingAnimationId = requestAnimationFrame(drawHoloLoadingPrism);
    
    speak("Accessing Stark world building core, coupling sandbox coordinates.");
    
    setTimeout(() => {
        if (holoLoadingAnimationId) {
            cancelAnimationFrame(holoLoadingAnimationId);
            holoLoadingAnimationId = null;
        }
        
        if (holoLoadingScreen) holoLoadingScreen.style.display = "none";
        if (holoSimulationScreen) holoSimulationScreen.style.display = "flex";
        
        // Boot Sandbox Mode
        isHoloActive = true;
        isWorldBuildingMode = true;
        
        // Set UI Header state
        const holoSystemStatus = document.getElementById("holo-system-status");
        if (holoSystemStatus) holoSystemStatus.textContent = "WORLD-BUILDING SANDBOX MATRIX";
        if (btnHoloMode) {
            btnHoloMode.style.borderColor = "var(--neon-green)";
            btnHoloMode.style.color = "var(--neon-green)";
            btnHoloMode.innerHTML = "<span>&#9881;</span> SANDBOX MODE: ACTIVE";
        }
        
        initHoloEngine();
        
        // Clear active shape coordinates & grid so it is a blank slate sandbox!
        activeHoloShape = "world_building_sandbox";
        holoVertices = [];
        holoEdges = [];
        activeVehicles = [];
        selectedVehicle = null;
        if (selectedEntityPanel) selectedEntityPanel.style.display = "none";
        
        if (holoMetaShape) {
            holoMetaShape.textContent = "MATRIX ACTIVE: SANDBOX WORKSPACE";
        }
        
        // Disable automatic simulation road/water/terrain layers by default
        holoSimState.envs.terrain = false;
        holoSimState.envs.road = false;
        holoSimState.envs.water = false;
        holoSimState.envs.desert = false;
        holoSimState.envs.forest = false;
        holoSimState.envs.city = false;
        holoSimState.envs.space = false;
        holoSimState.envs.storm = false;
        holoSimState.envs.fire = false;
        holoSimState.envs.sky = false;
        
        speak("World building sandbox online, Sir. Build your scenario.");
        printSystemMessage("[HOLO-SYSTEM]: Volumetric sandbox core successfully loaded. Accumulative spawning enabled.");
    }, 2500);
}

function exitWorldBuildingToScenarioMode() {
    playSFX(sfxScan);
    isWorldBuildingMode = false;
    
    // Clear sandbox
    activeVehicles = [];
    selectedVehicle = null;
    if (selectedEntityPanel) selectedEntityPanel.style.display = "none";
    
    const holoSystemStatus = document.getElementById("holo-system-status");
    if (holoSystemStatus) holoSystemStatus.textContent = "RESOLUTION: 4X DETAILED MATRIX";
    
    if (btnHoloMode) {
        btnHoloMode.style.borderColor = "var(--neon-blue)";
        btnHoloMode.style.color = "var(--neon-blue)";
        btnHoloMode.innerHTML = "<span>&#9881;</span> ENTER WORLD BUILDING";
    }
    
    // Reconfigure to standard shape
    changeHoloShape("prism");
    
    speak("Restored standard holographic scenario core, Sir.");
    printSystemMessage("[HOLO-SYSTEM]: Standard scenario matrix online.");
}

let loadingRotX = 0.45;
let loadingRotY = 0.55;
let loadingRotZ = 0.15;
let lastLoadingFrameTime = 0;
const loadingFpsLimit = 24;
const loadingFrameDelay = 1000 / loadingFpsLimit;

function drawHoloLoadingPrism(timestamp) {
    if (!holoLoadingScreen || holoLoadingScreen.style.display === "none") return;
    
    if (!lastLoadingFrameTime) lastLoadingFrameTime = timestamp;
    const elapsed = timestamp - lastLoadingFrameTime;
    
    if (elapsed >= loadingFrameDelay) {
        renderLoadingPrism();
        lastLoadingFrameTime = timestamp - (elapsed % loadingFrameDelay);
    }
    
    holoLoadingAnimationId = requestAnimationFrame(drawHoloLoadingPrism);
}

function renderLoadingPrism() {
    if (!holoLoadingCanvas || !holoLoadingCtx) return;
    const w = holoLoadingCanvas.width;
    const h = holoLoadingCanvas.height;
    
    holoLoadingCtx.clearRect(0, 0, w, h);
    
    loadingRotY += 0.024; // rotate faster for loading animation energy
    loadingRotX = 0.45 + Math.sin(loadingRotY * 0.3) * 0.15;
    loadingRotZ = Math.cos(loadingRotY * 0.2) * 0.1;
    
    const cosX = Math.cos(loadingRotX), sinX = Math.sin(loadingRotX);
    const cosY = Math.cos(loadingRotY), sinY = Math.sin(loadingRotY);
    const cosZ = Math.cos(loadingRotZ), sinZ = Math.sin(loadingRotZ);
    
    // Scale the rotating prism larger for the full-screen loading screen
    const scale = 400; 
    const distance = 3.2;
    
    const projected = baseVertices.map(v => {
        let x1 = v.x * cosY + v.z * sinY;
        let z1 = -v.x * sinY + v.z * cosY;
        let y2 = v.y * cosX - z1 * sinX;
        let z2 = v.y * sinX + z1 * cosX;
        let x3 = x1 * cosZ - y2 * sinZ;
        let y3 = x1 * sinZ + y2 * cosZ;
        const perspective = 1 / (distance - z2);
        return {
            x: x3 * perspective * scale + w / 2,
            y: y3 * perspective * scale + h / 2,
            z: z2
        };
    });
    
    const faces = [];
    for (let i = 0; i < 8; i++) {
        const next = (i + 1) % 8;
        let color = "rgba(255, 42, 42, 0.28)"; 
        let stroke = "rgba(255, 42, 42, 0.85)";
        
        if (i % 3 === 1) {
            color = "rgba(0, 240, 255, 0.28)"; 
            stroke = "rgba(0, 240, 255, 0.85)";
        } else if (i % 3 === 2) {
            color = "rgba(5, 1, 2, 0.88)";     
            stroke = "rgba(255, 42, 42, 0.5)";
        }
        
        faces.push({
            indices: [i, next, next + 8, i + 8],
            color: color,
            stroke: stroke
        });
    }
    
    faces.push({
        indices: [0, 1, 2, 3, 4, 5, 6, 7],
        color: "rgba(14, 2, 4, 0.78)",
        stroke: "rgba(255, 42, 42, 0.9)"
    });
    
    faces.push({
        indices: [15, 14, 13, 12, 11, 10, 9, 8],
        color: "rgba(5, 1, 2, 0.85)",
        stroke: "rgba(255, 42, 42, 0.7)"
    });
    
    const facesWithDepth = faces.map(f => {
        const avgZ = f.indices.reduce((sum, idx) => sum + projected[idx].z, 0) / f.indices.length;
        return { ...f, avgZ: avgZ };
    });
    facesWithDepth.sort((a, b) => a.avgZ - b.avgZ);
    
    facesWithDepth.forEach(face => {
        holoLoadingCtx.beginPath();
        face.indices.forEach((idx, i) => {
            const pt = projected[idx];
            if (i === 0) holoLoadingCtx.moveTo(pt.x, pt.y);
            else holoLoadingCtx.lineTo(pt.x, pt.y);
        });
        holoLoadingCtx.closePath();
        
        holoLoadingCtx.fillStyle = face.color;
        holoLoadingCtx.fill();
        
        holoLoadingCtx.strokeStyle = face.stroke;
        holoLoadingCtx.lineWidth = 1.6;
        holoLoadingCtx.stroke();
    });
}

let lastHoloFrameTime = 0;
const holoFpsLimit = 60; 
const holoFrameDelay = 1000 / holoFpsLimit;

function resizeHoloCanvas() {
    if (!holoCanvas || !holoCtx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = holoCanvas.getBoundingClientRect();
    holoWidth = rect.width;
    holoHeight = rect.height;
    holoCanvas.width = holoWidth * dpr;
    holoCanvas.height = holoHeight * dpr;
    holoCtx.scale(dpr, dpr);
}

function initHoloEngine() {
    if (!holoCanvas) return;
    holoCtx = holoCanvas.getContext("2d");
    
    // Scale for high pixel density
    resizeHoloCanvas();
    
    // Start with default zoom and environment
    holoZoom = 1.4;
    updateHoloZoomUI();
    
    // Set default simulation environment to a rotating octagonal glass prism (only)
    changeHoloShape("prism");
    
    holoSimState.motion = "spin";
    holoSimState.speed = 1.0;
    holoSimState.envs.terrain = false;
    holoSimState.envs.road = false;
    holoSimState.envs.forest = false;
    holoSimState.envs.water = false;
    holoSimState.envs.desert = false;
    holoSimState.envs.city = false;
    holoSimState.envs.space = false;
    holoSimState.envs.storm = false;
    holoSimState.envs.fire = false;
    holoSimState.envs.sky = false;
    
    // Window Resize Event Handler
    window.removeEventListener("resize", handleResize);
    window.addEventListener("resize", handleResize);
    
    if (holoAnimationId) {
        cancelAnimationFrame(holoAnimationId);
        holoAnimationId = null;
    }
    
    const holoLoop = (timestamp) => {
        if (!isHoloActive) return;
        
        if (!lastHoloFrameTime) lastHoloFrameTime = timestamp;
        const elapsed = timestamp - lastHoloFrameTime;
        
        if (elapsed >= holoFrameDelay) {
            if (!document.hidden) {
                drawHoloSimulation();
            }
            lastHoloFrameTime = timestamp - (elapsed % holoFrameDelay);
        }
        holoAnimationId = requestAnimationFrame(holoLoop);
    };
    
    holoAnimationId = requestAnimationFrame(holoLoop);
    
    // Auto-reconnect hand tracking cursor system on engine boot
    reconnectHandGestureSystem().catch(err => console.warn("Failed to reconnect gesture system:", err));
}


// Shared environmental height formulas - exposed globally to prevent ReferenceErrors in rendering loop
const getTerrainHeight = (x, z) => {
    let h = -0.65;
    const absX = Math.abs(x);
    
    const M = Math.max(3, activeVehicles.length);
    const laneWidth = 1.35;
    const totalWidth = (M - 1) * laneWidth;
    const roadHalfWidth = totalWidth / 2 + 0.8;
    const valleyHalfWidth = holoSimState.envs.road ? roadHalfWidth + 0.15 : 0.85;
    
    if (absX > valleyHalfWidth) {
        const rise = absX - valleyHalfWidth;
        h += rise * 0.85 + Math.sin(x * 6.5 + z * 3.5) * 0.18 + Math.cos(x * 4.0) * 0.08;
    } else if (holoSimState.envs.water && !holoSimState.envs.road) {
        // River running down center of canyon valley if there's no road!
        h += Math.sin(x * 5.0 + holoSimState.time * 1.8) * 0.045 + Math.cos(z * 4.5 + holoSimState.time * 1.4) * 0.035;
    }
    return h;
};

const getDuneHeight = (x, z) => {
    return -0.55 + Math.sin(x * 1.5 + z * 1.2 + holoSimState.time * 0.3) * 0.08 + Math.cos(x * 0.6) * 0.06;
};

const getWaterHeight = (x, z) => {
    return -0.55 + Math.sin(x * 5.0 + holoSimState.time * 1.8) * 0.06 + Math.cos(z * 4.5 + holoSimState.time * 1.4) * 0.05;
};

const getSurfaceHeight = (x, z) => {
    const M = Math.max(3, activeVehicles.length);
    const laneWidth = 1.35;
    const totalWidth = (M - 1) * laneWidth;
    const roadHalfWidth = totalWidth / 2 + 0.8;
    
    let rawHeight = -0.55;
    if (holoSimState.envs.terrain) {
        rawHeight = getTerrainHeight(x, z);
    } else if (holoSimState.envs.desert) {
        rawHeight = getDuneHeight(x, z);
    } else if (holoSimState.envs.water) {
        rawHeight = getWaterHeight(x, z);
    }
    
    if (holoSimState.envs.road) {
        const absX = Math.abs(x);
        if (absX < roadHalfWidth) {
            return -0.52;
        } else if (absX < roadHalfWidth + 0.15) {
            const t = (absX - roadHalfWidth) / 0.15;
            return -0.52 + t * (rawHeight - (-0.52));
        }
    }
    
    return rawHeight;
};

function drawHologramSimulationEnvironment(w, h, cosX, sinX, cosY, sinY, cosZ, sinZ, distance, scale, projectAndDrawLine, projectAndDrawNode) {
    if (!holoSimState || !holoSimState.envs) return;
    
    const envs = holoSimState.envs;
    const time = holoSimState.time;
    const speed = holoSimState.speed;

    // --- LAYER 1: WATER (Vibrant Blue Bobbing Ocean Mesh) ---
    if (envs.water) {
        const steps = 20;
        const width = 2.5;
        const depth = 3.0;
        
        // Cache ocean wave heights to optimize CPU trig calculations
        const heightCache = [];
        for (let i = 0; i <= steps; i++) {
            heightCache[i] = [];
            const x = -width + (i / steps) * 2 * width;
            for (let j = 0; j <= steps; j++) {
                const z = -depth/2 + (j / steps) * depth;
                heightCache[i][j] = getSurfaceHeight(x, z);
            }
        }
        
        for (let i = 0; i <= steps; i++) {
            const x = -width + (i / steps) * 2 * width;
            for (let j = 0; j < steps; j++) {
                const z1 = -depth/2 + (j / steps) * depth;
                const z2 = -depth/2 + ((j + 1) / steps) * depth;
                const y1 = heightCache[i][j];
                const y2 = heightCache[i][j+1];
                projectAndDrawLine(x, y1, z1, x, y2, z2, "rgba(0, 140, 255, 0.45)", 1.2);
                projectAndDrawNode(x, y1, z1, "rgba(255, 255, 255, 0.35)", 1.0);
            }
        }
        for (let j = 0; j <= steps; j++) {
            const z = -depth/2 + (j / steps) * depth;
            for (let i = 0; i < steps; i++) {
                const x1 = -width + (i / steps) * 2 * width;
                const x2 = -width + ((i + 1) / steps) * 2 * width;
                const y1 = heightCache[i][j];
                const y2 = heightCache[i+1][j];
                projectAndDrawLine(x1, y1, z, x2, y2, z, "rgba(0, 140, 255, 0.45)", 1.2);
            }
        }
    }

    // --- LAYER 2: DESERT (Warm Orange Dunes Grid) ---
    if (envs.desert) {
        const steps = 20;
        const width = 2.5;
        const depth = 3.0;
        const scrollZ = (time * 0.5) % (depth / steps);
        
        // Cache sand dune heights to optimize CPU trig calculations
        const heightCache = [];
        for (let i = 0; i <= steps; i++) {
            heightCache[i] = [];
            const x = -width + (i / steps) * 2 * width;
            for (let j = 0; j <= steps; j++) {
                const z = -depth/2 + (j / steps) * depth - scrollZ;
                heightCache[i][j] = getSurfaceHeight(x, z);
            }
        }
        
        for (let i = 0; i <= steps; i++) {
            const x = -width + (i / steps) * 2 * width;
            for (let j = 0; j < steps; j++) {
                const z1 = -depth/2 + (j / steps) * depth - scrollZ;
                const z2 = -depth/2 + ((j + 1) / steps) * depth - scrollZ;
                const y1 = heightCache[i][j];
                const y2 = heightCache[i][j+1];
                projectAndDrawLine(x, y1, z1, x, y2, z2, "rgba(255, 160, 0, 0.4)", 1.2);
                projectAndDrawNode(x, y1, z1, "rgba(255, 255, 255, 0.35)", 1.0);
            }
        }
        for (let j = 0; j <= steps; j++) {
            const z = -depth/2 + (j / steps) * depth - scrollZ;
            for (let i = 0; i < steps; i++) {
                const x1 = -width + (i / steps) * 2 * width;
                const x2 = -width + ((i + 1) / steps) * 2 * width;
                const y1 = heightCache[i][j];
                const y2 = heightCache[i+1][j];
                projectAndDrawLine(x1, y1, z, x2, y2, z, "rgba(255, 160, 0, 0.4)", 1.2);
            }
        }
    }

    // --- LAYER 3: TERRAIN / VALLEY (High-Contrast Neon-Cyan Mountains) ---
    if (envs.terrain) {
        const steps = 36;
        const width = 6.5;
        const depth = 4.5;
        const scrollZ = (time * 0.8) % (depth / steps);
        
        // Cache canyon heights to optimize CPU trig calculations (huge 66% performance gain)
        const heightCache = [];
        for (let i = 0; i <= steps; i++) {
            heightCache[i] = [];
            const x = -width + (i / steps) * 2 * width;
            for (let j = 0; j <= steps; j++) {
                const z = -depth/2 + (j / steps) * depth - scrollZ;
                heightCache[i][j] = getTerrainHeight(x, z);
            }
        }
        
        for (let i = 0; i <= steps; i++) {
            const x = -width + (i / steps) * 2 * width;
            for (let j = 0; j <= steps; j++) {
                const z = -depth/2 + (j / steps) * depth - scrollZ;
                const y = heightCache[i][j];
                
                // Draw coordinate nodes to create detailed 3D point cloud
                projectAndDrawNode(x, y, z, "rgba(255, 255, 255, 0.55)", 1.2);
                
                if (j < steps) {
                    const nextZ = -depth/2 + ((j + 1) / steps) * depth - scrollZ;
                    const nextY = heightCache[i][j+1];
                    projectAndDrawLine(x, y, z, x, nextY, nextZ, "rgba(0, 240, 255, 0.42)", 1.3);
                }
                if (i < steps) {
                    const nextX = -width + ((i + 1) / steps) * 2 * width;
                    const nextY = heightCache[i+1][j];
                    projectAndDrawLine(x, y, z, nextX, nextY, z, "rgba(0, 240, 255, 0.42)", 1.3);
                }
            }
        }
    }

    // --- LAYER 4: ROAD (Dynamic lane curbs + high-visibility lane markers scaling with vehicles count) ---
    if (envs.road) {
        const length = 2.4;
        const M = Math.max(3, activeVehicles.length); // Dynamic number of lanes (at least 3)
        const laneWidth = 1.35; // Generously wide lanes so vehicles fit with a clean gap!
        const totalWidth = (M - 1) * laneWidth;
        const width = totalWidth / 2 + 0.8; // Road half-width has perfect margin to prevent clipping curbs!
        
        const scrollZ = (time * 1.5) % 0.6;
        
        // Draw curbs
        projectAndDrawLine(-width, -0.52, -length/2, -width, -0.52, length/2, "rgba(255, 42, 42, 0.75)", 1.8);
        projectAndDrawLine(width, -0.52, -length/2, width, -0.52, length/2, "rgba(255, 42, 42, 0.75)", 1.8);
        projectAndDrawLine(-width, -0.52, -length/2, -width, -0.52, length/2, "rgba(255, 42, 42, 0.28)", 4.0);
        projectAndDrawLine(width, -0.52, -length/2, width, -0.52, length/2, "rgba(255, 42, 42, 0.28)", 4.0);
        
        // Draw dashed neon-cyan divider lines between lanes
        for (let l = 1; l < M; l++) {
            const dividerX = -totalWidth/2 + (l - 0.5) * laneWidth;
            const numDashes = 8;
            for (let i = 0; i < numDashes; i++) {
                const zStart = -length/2 + (i / numDashes) * length - scrollZ;
                const zEnd = zStart + 0.18;
                if (zStart < length/2 && zEnd > -length/2) {
                    projectAndDrawLine(dividerX, -0.52, zStart, dividerX, -0.52, zEnd, "rgba(0, 240, 255, 0.65)", 1.4);
                }
            }
        }
        
        // Draw horizontal support grid lines across entire road width
        const numHLines = 6;
        const hScrollZ = (time * 1.5) % (length / numHLines);
        for (let i = 0; i <= numHLines; i++) {
            const z = -length/2 + (i / numHLines) * length - hScrollZ;
            if (z < length/2 && z > -length/2) {
                const color = envs.space ? "rgba(180, 100, 255, 0.5)" : "rgba(0, 240, 255, 0.3)";
                projectAndDrawLine(-width, -0.52, z, width, -0.52, z, color, 1.0);
            }
        }

        // Draw bridge support pillars if water is active
        if (envs.water) {
            const pillarZ = [-0.9, 0, 0.9];
            pillarZ.forEach(pz => {
                // Left pillar down into water
                projectAndDrawLine(-width + 0.05, -0.52, pz, -width + 0.05, -0.9, pz, "rgba(0, 240, 255, 0.5)", 2.0);
                // Right pillar down into water
                projectAndDrawLine(width - 0.05, -0.52, pz, width - 0.05, -0.9, pz, "rgba(0, 240, 255, 0.5)", 2.0);
            });
            // Draw safety side railings
            projectAndDrawLine(-width, -0.42, -length/2, -width, -0.42, length/2, "rgba(255, 200, 60, 0.8)", 1.5);
            projectAndDrawLine(width, -0.42, -length/2, width, -0.42, length/2, "rgba(255, 200, 60, 0.8)", 1.5);
            // Railing posts
            for (let i = 0; i <= 6; i++) {
                const rz = -length/2 + (i / 6) * length;
                projectAndDrawLine(-width, -0.52, rz, -width, -0.42, rz, "rgba(255, 200, 60, 0.8)", 1.2);
                projectAndDrawLine(width, -0.52, rz, width, -0.42, rz, "rgba(255, 200, 60, 0.8)", 1.2);
            }
        }
    }

    // --- LAYER 5: FOREST (Sharp Neon-Green Pine Trees climbing mountain ridges) ---
    if (envs.forest) {
        if (!window.forestTrees) {
            window.forestTrees = [];
            for (let i = 0; i < 8; i++) {
                window.forestTrees.push({
                    side: i % 2 === 0 ? 'left' : 'right',
                    z: -1.2 + (i / 7) * 2.4,
                    height: 0.45 + Math.random() * 0.15
                });
            }
        }
        
        const M = Math.max(3, activeVehicles.length);
        const laneWidth = 1.35;
        const totalWidth = (M - 1) * laneWidth;
        const roadHalfWidth = envs.road ? (totalWidth / 2 + 0.8) : 0.45;
        const treeXOffset = roadHalfWidth + 0.45;
        
        window.forestTrees.forEach(t => {
            if (isAnimEnvActive) {
                t.z -= 0.015 * speed;
                if (t.z < -1.2) {
                    t.z = 1.2;
                    t.height = 0.45 + Math.random() * 0.15;
                }
            }
            
            const actualX = t.side === 'left' ? -treeXOffset : treeXOffset;
            const base = getSurfaceHeight(actualX, t.z);
            
            projectAndDrawLine(actualX, base, t.z, actualX, base + 0.15, t.z, "rgba(255, 200, 60, 0.6)", 1.6);
            const foliageRings = 3;
            for (let fr = 0; fr < foliageRings; fr++) {
                const ringBaseY = base + 0.12 + fr * 0.14;
                const ringTopY = ringBaseY + 0.22;
                const radius = 0.16 * (1.0 - fr * 0.22);
                const segs = 6;
                for (let s = 0; s < segs; s++) {
                    const a1 = (s * Math.PI * 2) / segs;
                    const a2 = ((s + 1) * Math.PI * 2) / segs;
                    const x1 = actualX + radius * Math.cos(a1);
                    const z1 = t.z + radius * Math.sin(a1);
                    const x2 = actualX + radius * Math.cos(a2);
                    const z2 = t.z + radius * Math.sin(a2);
                    projectAndDrawLine(x1, ringBaseY, z1, x2, ringBaseY, z2, "rgba(0, 255, 80, 0.5)", 1.25);
                    projectAndDrawLine(x1, ringBaseY, z1, actualX, ringTopY, t.z, "rgba(0, 255, 80, 0.45)", 1.2);
                }
            }
        });
    }

    // --- LAYER 5.5: DESERT CACTUS ---
    if (envs.desert) {
        if (!window.desertCactus) {
            window.desertCactus = [];
            for (let i = 0; i < 6; i++) {
                window.desertCactus.push({
                    side: i % 2 === 0 ? 'left' : 'right',
                    z: -1.2 + (i / 5) * 2.4,
                    height: 0.18 + Math.random() * 0.1
                });
            }
        }
        
        const M = Math.max(3, activeVehicles.length);
        const laneWidth = 1.35;
        const totalWidth = (M - 1) * laneWidth;
        const roadHalfWidth = envs.road ? (totalWidth / 2 + 0.8) : 0.45;
        const cactusXOffset = roadHalfWidth + 0.45;
        
        window.desertCactus.forEach(c => {
            if (isAnimEnvActive) {
                c.z -= 0.012 * speed;
                if (c.z < -1.2) {
                    c.z = 1.2;
                    c.height = 0.18 + Math.random() * 0.1;
                }
            }
            
            const actualX = c.side === 'left' ? -cactusXOffset : cactusXOffset;
            const base = getSurfaceHeight(actualX, c.z);
            
            const color = "rgba(0, 255, 80, 0.65)"; // glowing neon green!
            
            // Main trunk
            projectAndDrawLine(actualX, base, c.z, actualX, base + c.height, c.z, color, 1.8);
            
            // Left arm
            const armLeftY = base + c.height * 0.45;
            projectAndDrawLine(actualX, armLeftY, c.z, actualX - 0.05, armLeftY, c.z, color, 1.4);
            projectAndDrawLine(actualX - 0.05, armLeftY, c.z, actualX - 0.05, armLeftY + c.height * 0.35, c.z, color, 1.4);
            
            // Right arm
            const armRightY = base + c.height * 0.6;
            projectAndDrawLine(actualX, armRightY, c.z, actualX + 0.05, armRightY, c.z, color, 1.4);
            projectAndDrawLine(actualX + 0.05, armRightY, c.z, actualX + 0.05, armRightY + c.height * 0.3, c.z, color, 1.4);
        });
    }

    // --- LAYER 5.6: SWIMMING FISHES (Under the water) ---
    if (envs.water) {
        if (!window.oceanFishes) {
            window.oceanFishes = [];
            for (let i = 0; i < 8; i++) {
                window.oceanFishes.push({
                    x: (Math.random() - 0.5) * 2.0,
                    y: -0.65 - Math.random() * 0.15,
                    z: (Math.random() - 0.5) * 2.0,
                    size: 0.08 + Math.random() * 0.05,
                    speed: 0.01 + Math.random() * 0.015,
                    wiggleOffset: Math.random() * Math.PI * 2
                });
            }
        }
        
        window.oceanFishes.forEach(f => {
            if (isAnimEnvActive) {
                f.z -= f.speed * speed;
                if (f.z < -1.5) {
                    f.z = 1.5;
                    f.x = (Math.random() - 0.5) * 2.0;
                    f.y = -0.65 - Math.random() * 0.15;
                }
            }
            
            const wiggle = Math.sin(time * 8.0 + f.wiggleOffset) * 0.03;
            const color = "rgba(255, 160, 0, 0.75)"; // glowing goldfish
            
            const headX = f.x;
            const headY = f.y;
            const headZ = f.z + f.size * 0.5;
            
            const bodyMidY = f.y;
            const bodyMidZ = f.z;
            const bodyLeftX = f.x - f.size * 0.25;
            const bodyRightX = f.x + f.size * 0.25;
            
            const tailZ = f.z - f.size * 0.5;
            const tailTopX = f.x - f.size * 0.2 + wiggle;
            const tailBotX = f.x + f.size * 0.2 + wiggle;
            const tailYTop = f.y + f.size * 0.18;
            const tailYBot = f.y - f.size * 0.18;
            
            projectAndDrawLine(headX, headY, headZ, bodyLeftX, bodyMidY, bodyMidZ, color, 1.25);
            projectAndDrawLine(headX, headY, headZ, bodyRightX, bodyMidY, bodyMidZ, color, 1.25);
            projectAndDrawLine(bodyLeftX, bodyMidY, bodyMidZ, f.x + wiggle, f.y, tailZ, color, 1.25);
            projectAndDrawLine(bodyRightX, bodyMidY, bodyMidZ, f.x + wiggle, f.y, tailZ, color, 1.25);
            projectAndDrawLine(f.x + wiggle, f.y, tailZ, tailTopX, tailYTop, tailZ - 0.04, color, 1.2);
            projectAndDrawLine(f.x + wiggle, f.y, tailZ, tailBotX, tailYBot, tailZ - 0.04, color, 1.2);
            projectAndDrawLine(tailTopX, tailYTop, tailZ - 0.04, tailBotX, tailYBot, tailZ - 0.04, color, 1.2);
        });
    }

    // --- LAYER 6: FIRE (Glowing orange eruptions + floating cyber sparks) ---
    if (envs.fire) {
        if (!window.fireEmbers) {
            window.fireEmbers = [];
            for (let i = 0; i < 40; i++) {
                window.fireEmbers.push({
                    x: (Math.random() - 0.5) * 1.2,
                    y: Math.random() * 1.5 - 0.5,
                    z: (Math.random() - 0.5) * 1.2
                });
            }
        }
        const volHeight = 0.28;
        const volBase = -0.55;
        const rings = 5;
        for (let r = 0; r < rings; r++) {
            const rad = 0.38 * (1 - r / rings);
            const y = volBase + (r / rings) * volHeight;
            const segs = 16;
            for (let s = 0; s < segs; s++) {
                const a1 = (s * Math.PI * 2) / segs;
                const a2 = ((s + 1) * Math.PI * 2) / segs;
                projectAndDrawLine(rad * Math.cos(a1), y, rad * Math.sin(a1), rad * Math.cos(a2), y, rad * Math.sin(a2), "rgba(255, 70, 0, 0.6)", 1.45);
            }
        }
        window.fireEmbers.forEach(e => {
            if (isAnimEnvActive) {
                e.y += 0.02 * speed;
                e.x += Math.sin(e.y * 12 + time) * 0.007;
                if (e.y > 1.0) {
                    e.y = getSurfaceHeight(e.x, e.z);
                    e.x = (Math.random() - 0.5) * 1.0;
                    e.z = (Math.random() - 0.5) * 1.0;
                }
            }
            const flare = Math.max(0.1, (1.0 - e.y));
            projectAndDrawNode(e.x, e.y, e.z, `rgba(${Math.round(255 * flare)}, ${Math.round(80 * flare)}, 0, ${0.85 * flare})`, 2.0);
        });
    }

    // --- LAYER 7: SPACE (Brilliant stars + trails) ---
    if (envs.space) {
        if (!window.spaceStars) {
            window.spaceStars = [];
            for (let i = 0; i < 45; i++) {
                window.spaceStars.push({
                    x: (Math.random() - 0.5) * 3.0,
                    y: (Math.random() - 0.5) * 2.0 + 0.15,
                    z: Math.random() * 3.0 - 1.5
                });
            }
        }
        window.spaceStars.forEach(s => {
            if (isAnimEnvActive) {
                s.z -= 0.02 * speed;
                if (s.z < -1.5) {
                    s.z = 1.5;
                    s.x = (Math.random() - 0.5) * 3.0;
                    s.y = (Math.random() - 0.5) * 2.0 + 0.15;
                }
            }
            projectAndDrawNode(s.x, s.y, s.z, "rgba(255, 255, 255, 0.85)", 1.8);
            projectAndDrawLine(s.x, s.y, s.z, s.x, s.y, s.z + 0.08, "rgba(0, 240, 255, 0.6)", 1.0);
        });
    }

    // --- LAYER 8: SKY (Vivid Cloud Formations) ---
    if (envs.sky) {
        if (!window.skyClouds) {
            window.skyClouds = [];
            for (let i = 0; i < 5; i++) {
                window.skyClouds.push({
                    x: (Math.random() - 0.5) * 1.8,
                    y: 0.55 + Math.random() * 0.25,
                    z: -1.2 + (i / 4) * 2.4,
                    radius: 0.18 + Math.random() * 0.08
                });
            }
        }
        window.skyClouds.forEach(c => {
            if (isAnimEnvActive) {
                c.z -= 0.005 * speed;
                if (c.z < -1.2) {
                    c.z = 1.2;
                    c.x = (Math.random() - 0.5) * 1.8;
                    c.y = 0.55 + Math.random() * 0.25;
                }
            }
            const circles = 3;
            for (let k = 0; k < circles; k++) {
                const offsetZ = -0.06 + k * 0.06;
                const r = c.radius * (1 - Math.abs(offsetZ) * 2);
                const segs = 8;
                for (let s = 0; s < segs; s++) {
                    const a1 = (s * Math.PI * 2) / segs;
                    const a2 = ((s + 1) * Math.PI * 2) / segs;
                    const x1 = c.x + r * Math.cos(a1);
                    const y1 = c.y + r * Math.sin(a1);
                    const x2 = c.x + r * Math.cos(a2);
                    const y2 = c.y + r * Math.sin(a2);
                    projectAndDrawLine(x1, y1, c.z + offsetZ, x2, y2, c.z + offsetZ, "rgba(255, 255, 255, 0.4)", 1.2);
                }
            }
        });
    }

    // --- LAYER 9: STORM (Intense rain + cracking neon lightning) ---
    if (envs.storm) {
        if (!window.stormRain) {
            window.stormRain = [];
            for (let i = 0; i < 40; i++) {
                window.stormRain.push({
                    x: (Math.random() - 0.5) * 2.4,
                    y: Math.random() * 1.8 - 0.6,
                    z: (Math.random() - 0.5) * 2.0
                });
            }
        }
        window.stormRain.forEach(r => {
            if (isAnimEnvActive) {
                r.y -= 0.075 * speed;
                r.z -= 0.02 * speed;
                if (r.y < -0.65) {
                    r.y = 1.2;
                    r.x = (Math.random() - 0.5) * 2.4;
                    r.z = (Math.random() - 0.5) * 2.0;
                }
            }
            projectAndDrawLine(r.x, r.y, r.z, r.x, r.y - 0.12, r.z - 0.03, "rgba(100, 200, 255, 0.6)", 1.0);
        });
        if (isAnimEnvActive && Math.random() < 0.005) {
            holoCtx.fillStyle = "rgba(0, 240, 255, 0.075)";
            holoCtx.fillRect(0, 0, w, h);
            let lx = (Math.random() - 0.5) * 0.8;
            let lz = (Math.random() - 0.5) * 0.8;
            let ly = 1.2;
            for (let b = 0; b < 6; b++) {
                let nly = ly - 0.3;
                let nlx = lx + (Math.random() - 0.5) * 0.15;
                let nlz = lz + (Math.random() - 0.5) * 0.15;
                projectAndDrawLine(lx, ly, lz, nlx, nly, nlz, "rgba(255, 255, 255, 0.95)", 1.5);
                projectAndDrawLine(lx, ly, lz, nlx, nly, nlz, "rgba(0, 240, 255, 0.35)", 4.0);
                lx = nlx; ly = nly; lz = nlz;
            }
        }
    }

    // --- LAYER 10: CITY (Tall 3D Wireframe Skyscraper Buildings on the side) ---
    if (envs.city) {
        if (!window.cityBuildings) {
            const buildingTypes = ["skyscraper", "tower", "pyramid", "castle", "house", "windmill"];
            window.cityBuildings = [];
            for (let i = 0; i < 8; i++) {
                window.cityBuildings.push({
                    side: i % 2 === 0 ? 'left' : 'right',
                    z: -1.5 + (i / 7) * 3.0,
                    type: buildingTypes[i % buildingTypes.length],
                    scale: 0.78 + Math.random() * 0.35
                });
            }
        }
        
        const M = Math.max(3, activeVehicles.length);
        const laneWidth = 1.35;
        const totalWidth = (M - 1) * laneWidth;
        const roadHalfWidth = envs.road ? (totalWidth / 2 + 0.8) : 0.45;
        const buildingXOffset = roadHalfWidth + 0.32;
        
        window.cityBuildings.forEach(b => {
            if (isAnimEnvActive) {
                b.z -= 0.015 * speed;
                if (b.z < -1.5) {
                    b.z = 1.5;
                }
            }
            
            const actualX = b.side === 'left' ? -buildingXOffset - 0.25 : buildingXOffset + 0.25;
            const base = -0.52; // flat highway base in city!
            
            // Retrieve static model vertices and edges for this specific building type!
            const data = getVehicleData(b.type);
            
            // Project the building vertices with scale and translation!
            const localProjected = [];
            data.vertices.forEach(v => {
                let vx = v.x * b.scale;
                let vy = (v.y + 0.48) * b.scale; // Shifting so that base of model aligns to y=0 locally!
                let vz = v.z * b.scale;
                
                // If it is a windmill blade, rotate it over time!
                if (v.isWindmillBlade) {
                    const rotSpeed = 1.8;
                    const theta = isAnimBuildingActive ? (time * rotSpeed + (b.z * 10)) : 0;
                    const bDx = v.x - v.pivotX;
                    const bDy = v.y - v.pivotY;
                    const rDist = Math.sqrt(bDx * bDx + bDy * bDy);
                    const baseAngle = Math.atan2(bDy, bDx);
                    const newAngle = baseAngle + theta;
                    vx = (v.pivotX + rDist * Math.cos(newAngle)) * b.scale;
                    vy = (v.pivotY + rDist * Math.sin(newAngle) + 0.48) * b.scale;
                }
                
                const rx = (actualX + vx) * holoZoom;
                const ry = (base + vy) * holoZoom;
                const rz = (b.z + vz) * holoZoom;
                
                const x1 = rx * cosY + rz * sinY;
                const z1 = -rx * sinY + rz * cosY;
                
                const y2 = ry * cosX - z1 * sinX;
                const z2 = ry * sinX + z1 * cosX;
                
                const x3 = x1 * cosZ - y2 * sinZ;
                const y3 = x1 * sinZ + y2 * cosZ;
                
                const p = { z: z2, clipped: false, x: 0, y: 0, origColor: v.color };
                if (z2 >= distance - 0.15) {
                    p.clipped = true;
                } else {
                    const perspective = 1 / (distance - z2);
                    p.x = x3 * perspective * scale + w / 2;
                    p.y = -y3 * perspective * scale + h / 2;
                }
                localProjected.push(p);
            });
            
            // Draw Edges
            data.edges.forEach(edge => {
                const p1 = localProjected[edge[0]];
                const p2 = localProjected[edge[1]];
                if (!p1 || !p2 || p1.clipped || p2.clipped) return;
                
                const avgZ = (p1.z + p2.z) / 2;
                const alpha = Math.max(0.08, Math.min(0.55, (avgZ + 1.2) * 0.28));
                
                holoCtx.beginPath();
                holoCtx.moveTo(p1.x, p1.y);
                holoCtx.lineTo(p2.x, p2.y);
                holoCtx.strokeStyle = `rgba(${p1.origColor.r}, ${p1.origColor.g}, ${p1.origColor.b}, ${alpha * 0.8})`;
                holoCtx.lineWidth = 1.0;
                holoCtx.stroke();
            });
        });
    }
}

function drawHoloSimulation() {

    if (!holoCanvas || !holoCtx) return;
    try {
        const w = holoWidth;
        const h = holoHeight;
        if (w === 0 || h === 0) return;
    
    holoCtx.clearRect(0, 0, w, h);
    
    // Auto rotation (if user is not dragging, auto-rotation toggle is active, and not in special tactical mode)
    if (!isDraggingHolo && isAutoRotateActive && !leftHandSpecialMode) {
        holoRotY += 0.008;
        holoRotX = 0.3 + Math.sin(holoRotY * 0.2) * 0.1;
        holoRotZ = Math.cos(holoRotY * 0.1) * 0.05;
    }
    
    // Display coordinates on telemetry panel
    if (holoMetaCoords) {
        holoMetaCoords.textContent = `ROT: X ${holoRotX.toFixed(2)} | Y ${holoRotY.toFixed(2)} | Z ${holoRotZ.toFixed(2)}`;
    }
    
    updateTrigCache();
    const cosX = cachedCosX, sinX = cachedSinX;
    const cosY = cachedCosY, sinY = cachedSinY;
    const cosZ = cachedCosZ, sinZ = cachedSinZ;
    
    const distance = 4.0;
    const scale = 320; 
    
    // Project and draw line helper — optimized with thick well-defined strokes
    const projectAndDrawLine = (x1, y1, z1, x2, y2, z2, strokeStyle, lineWidth = 1.35) => {
        let rx1 = x1 * holoZoom;
        let ry1 = y1 * holoZoom;
        let rz1 = z1 * holoZoom;
        let tx1 = rx1 * cosY + rz1 * sinY;
        let tz1 = -rx1 * sinY + rz1 * cosY;
        let ty2 = ry1 * cosX - tz1 * sinX;
        let tz2 = ry1 * sinX + tz1 * cosX;
        let tx3 = tx1 * cosZ - ty2 * sinZ;
        let ty3 = tx1 * sinZ + ty2 * cosZ;
        
        let rx2 = x2 * holoZoom;
        let ry2 = y2 * holoZoom;
        let rz2 = z2 * holoZoom;
        let ux1 = rx2 * cosY + rz2 * sinY;
        let uz1 = -rx2 * sinY + rz2 * cosY;
        let uy2 = ry2 * cosX - uz1 * sinX;
        let uz2 = ry2 * sinX + uz1 * cosX;
        let ux3 = ux1 * cosZ - uy2 * sinZ;
        let uy3 = ux1 * sinZ + uy2 * cosZ;
        
        if (tz2 >= distance - 0.15 || uz2 >= distance - 0.15) return;
        
        const p1 = 1 / (distance - tz2);
        const p2 = 1 / (distance - uz2);
        
        const sx1 = tx3 * p1 * scale + w / 2;
        const sy1 = -ty3 * p1 * scale + h / 2;
        
        const sx2 = ux3 * p2 * scale + w / 2;
        const sy2 = -uy3 * p2 * scale + h / 2;
        
        holoCtx.beginPath();
        holoCtx.moveTo(sx1, sy1);
        holoCtx.lineTo(sx2, sy2);
        holoCtx.strokeStyle = strokeStyle;
        holoCtx.lineWidth = lineWidth;
        holoCtx.stroke();
    };
    
    // Project and draw node helper
    const projectAndDrawNode = (x, y, z, fillStyle, radius = 2.0) => {
        let rx = x * holoZoom;
        let ry = y * holoZoom;
        let rz = z * holoZoom;
        let tx1 = rx * cosY + rz * sinY;
        let tz1 = -rx * sinY + rz * cosY;
        let ty2 = ry * cosX - tz1 * sinX;
        let tz2 = ry * sinX + tz1 * cosX;
        let tx3 = tx1 * cosZ - ty2 * sinZ;
        let ty3 = tx1 * sinZ + ty2 * cosZ;
        
        if (tz2 >= distance - 0.15) return;
        
        const p = 1 / (distance - tz2);
        const sx = tx3 * p * scale + w / 2;
        const sy = -ty3 * p * scale + h / 2;
        
        holoCtx.beginPath();
        holoCtx.arc(sx, sy, radius * Math.max(0.6, (tz2 + 1.2)), 0, 2 * Math.PI);
        holoCtx.fillStyle = fillStyle;
        holoCtx.fill();
    };
    
    // --- 1. PREMIUM VISUAL EFFECT: Volumetric Projection Scanner Cone (Filling Lower Half) ---
    const coneGrad = holoCtx.createLinearGradient(w / 2, h, w / 2, h * 0.5);
    coneGrad.addColorStop(0, "rgba(0, 240, 255, 0.35)");
    coneGrad.addColorStop(0.5, "rgba(0, 240, 255, 0.12)");
    coneGrad.addColorStop(1, "rgba(0, 240, 255, 0)");
    
    holoCtx.fillStyle = coneGrad;
    holoCtx.beginPath();
    holoCtx.moveTo(w / 2 - 50, h);
    holoCtx.lineTo(w / 2 + 50, h);
    holoCtx.lineTo(w / 2 + w * 0.5, h * 0.5);
    holoCtx.lineTo(w / 2 - w * 0.5, h * 0.5);
    holoCtx.closePath();
    holoCtx.fill();
    
    holoCtx.strokeStyle = "rgba(0, 240, 255, 0.055)";
    holoCtx.lineWidth = 0.55;
    const scanRays = 36; 
    for (let i = 0; i < scanRays; i++) {
        const angle = Math.PI + 0.08 + (i / (scanRays - 1)) * (Math.PI - 0.16);
        const rx = Math.cos(angle) * 980;
        const ry = Math.sin(angle) * 980;
        
        holoCtx.beginPath();
        holoCtx.moveTo(w / 2, h);
        holoCtx.lineTo(w / 2 + rx, h + ry);
        holoCtx.stroke();
    }
    
    // --- 2. 3D PERSPECTIVE PROJECTOR PEDESTAL BASE ---
    const groundY = -0.65;
    const pedestalRadii = [0.35, 0.75, 1.15];
    holoCtx.lineWidth = 0.75;
    
    pedestalRadii.forEach((r, rIdx) => {
        holoCtx.beginPath();
        let first = true;
        
        for (let i = 0; i <= 32; i++) {
            const cachedAngle = pedestalAngleCache32[i];
            const px = r * cachedAngle.cos;
            const py = groundY;
            const pz = r * cachedAngle.sin;
            
            let rx = px * holoZoom;
            let ry = py * holoZoom;
            let rz = pz * holoZoom;
            
            let x1 = rx * cosY + rz * sinY;
            let z1 = -rx * sinY + rz * cosY;
            
            let y2 = ry * cosX - z1 * sinX;
            let z2 = ry * sinX + z1 * cosX;
            
            let x3 = x1 * cosZ - y2 * sinZ;
            let y3 = x1 * sinZ + y2 * cosZ;
            
            if (z2 >= distance - 0.15) continue;
            
            const perspective = 1 / (distance - z2);
            const sx = x3 * perspective * scale + w / 2;
            const sy = -y3 * perspective * scale + h / 2;
            
            if (first) {
                holoCtx.moveTo(sx, sy);
                first = false;
            } else {
                holoCtx.lineTo(sx, sy);
            }
        }
        holoCtx.strokeStyle = `rgba(0, 240, 255, ${0.14 - rIdx * 0.045})`;
        holoCtx.stroke();
    });
    
    // --- 2.5 DRAW SIMULATION SCENARIO ENVIRONMENT ---
    drawHologramSimulationEnvironment(w, h, cosX, sinX, cosY, sinY, cosZ, sinZ, distance, scale, projectAndDrawLine, projectAndDrawNode);
    
    // Increment simulation time
    if (isAnimEnvActive) {
        if (holoSimState && holoSimState.motion) {
            holoSimState.time += 0.025 * holoSimState.speed;
        } else if (holoSimState) {
            holoSimState.time += 0.005;
        }
    }
    
    // --- 3. PROJECT & RENDER ENGINE CHANNELS ---
    if (activeVehicles && activeVehicles.length > 0) {
        // Multi-vehicle Volumetric Core Rendering Loop
        activeVehicles.forEach((vehicle, idx) => {
            if (!vehicle || !vehicle.vertices || vehicle.vertices.length === 0) return;
            
            // Dynamic ground-clamping using vertex scan minY (only if not manually translated vertically)
            if (!vehicle.manualHeight) {
                let minY = 0;
                const numVerts = vehicle.vertices.length;
                for (let i = 0; i < numVerts; i++) {
                    const v = vehicle.vertices[i];
                    if (v && v.y < minY) minY = v.y;
                }
                const groundH = getSurfaceHeight(vehicle.x || 0, vehicle.z || 0);
                vehicle.y = groundH - minY;
            }
            
            // A. Increment wheel spin time
            const isVehicle = ["car", "truck", "suv", "bus", "motorcycle"].includes(vehicle.type);
            const isHuman = ["man", "woman", "boy", "girl"].includes(vehicle.type);
            
            if (isAnimVehicleActive && isVehicle && vehicle.isAnimated !== false) {
                vehicle.wheelSpinTime = (vehicle.wheelSpinTime || 0) + 0.075 * (vehicle.speedFactor ?? 1.0) * (holoSimState ? holoSimState.speed : 1.0);
            }
            
            // B. Engine rumble & suspension bobbing
            let dynamicY = 0;
            if (isAnimVehicleActive && isVehicle && vehicle.isAnimated !== false) {
                const rumbleY = Math.sin(holoSimState.time * 25.0 + (vehicle.bobbingOffset || 0)) * 0.003;
                const suspensionBob = Math.sin(holoSimState.time * 3.5 + (vehicle.bobbingOffset || 0)) * 0.006;
                dynamicY = rumbleY + suspensionBob;
            } else if (isAnimHumanActive && isHuman && vehicle.isAnimated !== false) {
                const timeVal = holoSimState ? holoSimState.time : (Date.now() * 0.005);
                dynamicY = Math.abs(Math.sin(timeVal * 4.5 + (vehicle.bobbingOffset || 0))) * 0.015;
            }
            
            // C. Dynamic Multi-Lane Keeping AI & Dynamic Lane Expansion
            if (!vehicle.manualLocation) {
                const M = Math.max(3, activeVehicles.length);
                const laneWidth = 1.35; // Generous lane width aligned to visual road lanes!
                const totalWidth = (M - 1) * laneWidth;
                
                if (vehicle.laneIndex === undefined || vehicle.laneIndex >= M) {
                    vehicle.laneIndex = idx % M;
                }
                
                // Periodically switch to neighboring lane if safe and empty
                if (Math.random() < 0.002 && holoSimState && holoSimState.motion === "translate") {
                    const neighborOffset = Math.random() < 0.5 ? -1 : 1;
                    const targetLaneIdx = vehicle.laneIndex + neighborOffset;
                    if (targetLaneIdx >= 0 && targetLaneIdx < M) {
                        let laneOccupied = false;
                        for (let k = 0; k < activeVehicles.length; k++) {
                            if (activeVehicles[k] !== vehicle && activeVehicles[k].laneIndex === targetLaneIdx) {
                                if (Math.abs((activeVehicles[k].z || 0) - (vehicle.z || 0)) < 0.7) {
                                    laneOccupied = true;
                                    break;
                                }
                            }
                        }
                        if (!laneOccupied) {
                            vehicle.laneIndex = targetLaneIdx;
                        }
                    }
                }
                
                vehicle.targetLaneX = -totalWidth/2 + vehicle.laneIndex * laneWidth;
                vehicle.x = (vehicle.x || 0) + (vehicle.targetLaneX - (vehicle.x || 0)) * 0.045;
                
                // D. Longitudinal Racing Drift & Collision Prevention
                if (holoSimState && holoSimState.motion === "translate") {
                    const targetZOffset = Math.sin(holoSimState.time * 0.4 + (vehicle.bobbingOffset || 0)) * 0.4;
                    const targetZ = (vehicle.initialZ || 0) + targetZOffset;
                    vehicle.z = (vehicle.z || 0) + (targetZ - (vehicle.z || 0)) * 0.015;
                    
                    // Repulse vehicles in the same lane if they get too close (minimum 0.65 units along Z)
                    const numVehicles = activeVehicles.length;
                    for (let k = 0; k < numVehicles; k++) {
                        const other = activeVehicles[k];
                        if (!other || other === vehicle || other.manualLocation) continue;
                        if (other.laneIndex === vehicle.laneIndex) {
                            const zDiff = (vehicle.z || 0) - (other.z || 0);
                            const minSep = 0.65;
                            if (Math.abs(zDiff) < minSep) {
                                const force = (minSep - Math.abs(zDiff)) * 0.045 * Math.sign(zDiff || 1);
                                vehicle.z = (vehicle.z || 0) + force;
                                other.z = (other.z || 0) - force;
                            }
                        }
                    }
                }
            }
            
            // E. Project Vertices
            const localProjected = [];
            const numVerts = vehicle.vertices.length;
            
            for (let i = 0; i < numVerts; i++) {
                const v = vehicle.vertices[i];
                if (!v) {
                    localProjected.push({ z: 0, origColor: { r: 255, g: 255, b: 255 }, clipped: true, x: 0, y: 0 });
                    continue;
                }
                let vx = v.x ?? 0;
                let vy = v.y ?? 0;
                let vz = v.z ?? 0;
                
                // Wheel axle rotation
                if (v.isWheel && v.axleY !== undefined && v.axleZ !== undefined) {
                    const theta = (vehicle.isAnimated !== false) ? (vehicle.wheelSpinTime || 0) : 0;
                    const dy = vy - v.axleY;
                    const dz = vz - v.axleZ;
                    const rDist = Math.sqrt(dy * dy + dz * dz);
                    const currentAngle = Math.atan2(dy, dz);
                    const newAngle = currentAngle + theta;
                    vy = v.axleY + rDist * Math.sin(newAngle);
                    vz = v.axleZ + rDist * Math.cos(newAngle);
                }
                
                // Windmill blade rotation (XY plane around front pivot)
                if (v.isWindmillBlade && v.pivotX !== undefined && v.pivotY !== undefined) {
                    const rotSpeed = 1.8;
                    const theta = (isAnimBuildingActive && vehicle.isAnimated !== false) ? ((holoSimState ? holoSimState.time : 0) * rotSpeed) : 0;
                    const bDx = vx - v.pivotX;
                    const bDy = vy - v.pivotY;
                    const rDist = Math.sqrt(bDx * bDx + bDy * bDy);
                    const baseAngle = Math.atan2(bDy, bDx);
                    const newAngle = baseAngle + theta;
                    vx = v.pivotX + rDist * Math.cos(newAngle);
                    vy = v.pivotY + rDist * Math.sin(newAngle);
                }
                
                // Walking limb animation (arms and legs swing in gait cycle)
                if (v.isLimb && v.pivotY !== undefined && v.pivotZ !== undefined) {
                    const walkSpeed = 4.5;
                    const timeVal = holoSimState ? holoSimState.time : (Date.now() * 0.005);
                    const walkTime = timeVal * walkSpeed + (vehicle.bobbingOffset || 0);
                    const swingAmplitude = (isAnimHumanActive && vehicle.isAnimated !== false) ? 0.18 : 0.0; // Make swing very visible and premium!
                    
                    // Left and right are opposite phase; arms and legs are also opposite
                    let phase = 0;
                    if (v.limbSide === 'left' && v.limbType === 'leg') phase = 0;
                    else if (v.limbSide === 'right' && v.limbType === 'leg') phase = Math.PI;
                    else if (v.limbSide === 'left' && v.limbType === 'arm') phase = Math.PI; // opposite to left leg
                    else if (v.limbSide === 'right' && v.limbType === 'arm') phase = 0;     // opposite to right leg
                    
                    const swing = Math.sin(walkTime + phase) * swingAmplitude;
                    
                    // Rotate the limb vertex around its pivot point in the YZ plane (forward/backward swing)
                    const dy = vy - v.pivotY;
                    const dz = vz - v.pivotZ;
                    const dist = Math.sqrt(dy * dy + dz * dz);
                    if (dist > 0.001) {
                        const baseAngle = Math.atan2(dz, dy);
                        const newAngle = baseAngle + swing;
                        vy = v.pivotY + dist * Math.cos(newAngle);
                        vz = v.pivotZ + dist * Math.sin(newAngle);
                        
                        // Dynamic vertical step lift!
                        if (v.limbType === 'leg') {
                            const lift = (isAnimHumanActive && vehicle.isAnimated !== false) ? (Math.abs(Math.sin(walkTime + phase)) * 0.045) : 0.0;
                            vy += lift;
                        }
                    }
                }
                
                // River/water block wave bobbing animation
                if (v.isRiverGrid) {
                    const timeVal = (isAnimEnvActive && vehicle.isAnimated !== false) ? holoSimState.time : 0;
                    vy = -0.52 + Math.sin(v.origX * 5.0 + timeVal * 1.8) * 0.04 + Math.cos(v.origZ * 4.5 + timeVal * 1.4) * 0.03;
                }
                
                let rx = (vx + (vehicle.x || 0)) * holoZoom;
                let ry = (vy + (vehicle.y || 0) + (dynamicY || 0)) * holoZoom;
                let rz = (vz + (vehicle.z || 0)) * holoZoom;
                
                let x1 = rx * cosY + rz * sinY;
                let z1 = -rx * sinY + rz * cosY;
                
                let y2 = ry * cosX - z1 * sinX;
                let z2 = ry * sinX + z1 * cosX;
                
                let x3 = x1 * cosZ - y2 * sinZ;
                let y3 = x1 * sinZ + y2 * cosZ;
                
                const p = { z: z2, origColor: v.color || { r: 255, g: 255, b: 255 }, clipped: false, x: 0, y: 0 };
                if (z2 >= distance - 0.15) {
                    p.clipped = true;
                } else {
                    const perspective = 1 / (distance - z2);
                    p.x = x3 * perspective * scale + w / 2;
                    p.y = -y3 * perspective * scale + h / 2;
                }
                localProjected.push(p);
            }
            
            // F. Draw Vector Edges (Double pass glow lines)
            const numEdges = vehicle.edges ? vehicle.edges.length : 0;
            holoCtx.lineWidth = 1.6;
            for (let i = 0; i < numEdges; i++) {
                const edge = vehicle.edges[i];
                if (!edge) continue;
                const p1 = localProjected[edge[0]];
                const p2 = localProjected[edge[1]];
                
                if (!p1 || !p2 || p1.clipped || p2.clipped) continue;
                
                const avgZ = (p1.z + p2.z) / 2;
                const alpha = Math.max(0.04, Math.min(0.24, (avgZ + 1.2) * 0.16));
                
                const r = Math.round(((p1.origColor?.r ?? 255) + (p2.origColor?.r ?? 255)) / 2);
                const g = Math.round(((p1.origColor?.g ?? 255) + (p2.origColor?.g ?? 255)) / 2);
                const b = Math.round(((p1.origColor?.b ?? 255) + (p2.origColor?.b ?? 255)) / 2);
                
                holoCtx.beginPath();
                holoCtx.moveTo(p1.x, p1.y);
                holoCtx.lineTo(p2.x, p2.y);
                holoCtx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.45})`;
                holoCtx.stroke();
            }
            
            holoCtx.lineWidth = 0.85;
            for (let i = 0; i < numEdges; i++) {
                const edge = vehicle.edges[i];
                if (!edge) continue;
                const p1 = localProjected[edge[0]];
                const p2 = localProjected[edge[1]];
                
                if (!p1 || !p2 || p1.clipped || p2.clipped) continue;
                
                const avgZ = (p1.z + p2.z) / 2;
                const alpha = Math.max(0.12, Math.min(0.65, (avgZ + 1.2) * 0.32));
                
                const r = Math.round(((p1.origColor?.r ?? 255) + (p2.origColor?.r ?? 255)) / 2);
                const g = Math.round(((p1.origColor?.g ?? 255) + (p2.origColor?.g ?? 255)) / 2);
                const b = Math.round(((p1.origColor?.b ?? 255) + (p2.origColor?.b ?? 255)) / 2);
                
                holoCtx.beginPath();
                holoCtx.moveTo(p1.x, p1.y);
                holoCtx.lineTo(p2.x, p2.y);
                holoCtx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
                holoCtx.stroke();
            }
            
            // G. Draw Nodes (High-performance batched rectangle path rendering for flawless 60fps)
            const dotsPerEdge = 10;
            
            // 1. Batch Core Nodes (White Core)
            holoCtx.beginPath();
            holoCtx.fillStyle = "rgba(255, 255, 255, 0.9)";
            for (let i = 0; i < numEdges; i++) {
                const edge = vehicle.edges[i];
                if (!edge) continue;
                const p1 = localProjected[edge[0]];
                const p2 = localProjected[edge[1]];
                if (!p1 || !p2 || p1.clipped || p2.clipped) continue;
                
                const avgZ = (p1.z + p2.z) / 2;
                const radius = Math.max(0.65, (avgZ + 1.2) * 0.95);
                const rCore = radius * 0.45;
                const size = rCore * 2;
                
                for (let d = 0; d <= dotsPerEdge; d++) {
                    const t = d / dotsPerEdge;
                    const dx = p1.x + (p2.x - p1.x) * t;
                    const dy = p1.y + (p2.y - p1.y) * t;
                    holoCtx.rect(dx - rCore, dy - rCore, size, size);
                }
            }
            holoCtx.fill();
            
            // 2. Batch Glow Nodes (Vehicle Color Glow)
            holoCtx.beginPath();
            const vColor = vehicle.color || { r: 0, g: 240, b: 255 };
            holoCtx.fillStyle = `rgba(${vColor.r}, ${vColor.g}, ${vColor.b}, 0.22)`;
            for (let i = 0; i < numEdges; i++) {
                const edge = vehicle.edges[i];
                if (!edge) continue;
                const p1 = localProjected[edge[0]];
                const p2 = localProjected[edge[1]];
                if (!p1 || !p2 || p1.clipped || p2.clipped) continue;
                
                const avgZ = (p1.z + p2.z) / 2;
                const radius = Math.max(0.65, (avgZ + 1.2) * 0.95);
                const rGlow = radius * 1.5;
                const size = rGlow * 2;
                
                for (let d = 0; d <= dotsPerEdge; d++) {
                    const t = d / dotsPerEdge;
                    const dx = p1.x + (p2.x - p1.x) * t;
                    const dy = p1.y + (p2.y - p1.y) * t;
                    holoCtx.rect(dx - rGlow, dy - rGlow, size, size);
                }
            }
            holoCtx.fill();
            
            // Draw original vertices to ensure structural intersections are bright
            for (let i = 0; i < numVerts; i++) {
                const p = localProjected[i];
                if (!p || p.clipped) continue;
                const radius = Math.max(0.85, (p.z + 1.2) * 1.15);
                const alpha = Math.max(0.35, Math.min(0.95, (p.z + 1.2) * 0.6));
                
                const r = p.origColor?.r ?? 255;
                const g = p.origColor?.g ?? 255;
                const b = p.origColor?.b ?? 255;
                
                holoCtx.beginPath();
                holoCtx.arc(p.x, p.y, radius * 2.2, 0, 2 * Math.PI);
                holoCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.32})`;
                holoCtx.fill();
                
                holoCtx.beginPath();
                holoCtx.arc(p.x, p.y, radius * 0.45, 0, 2 * Math.PI);
                holoCtx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
                holoCtx.fill();
            }
            
            // H. Update and Render Exhaust Sparks
            if (vehicle.sparks) {
                vehicle.sparks.forEach(s => {
                    s.z += s.vz * (vehicle.speedFactor ?? 1.0);
                    s.y += s.vy * (vehicle.speedFactor ?? 1.0);
                    s.x += s.vx + Math.sin(s.y * 12.0 + holoSimState.time) * 0.003;
                    s.life -= s.decay;
                    
                    if (s.life <= 0) {
                        s.x = (vehicle.x ?? 0) + (Math.random() - 0.5) * 0.08;
                        s.y = (vehicle.y ?? 0) - 0.25 + (Math.random() - 0.5) * 0.04;
                        s.z = (vehicle.z ?? 0) - 0.3 - Math.random() * 0.2;
                        s.vx = (Math.random() - 0.5) * 0.012;
                        s.vy = 0.008 + Math.random() * 0.012;
                        s.vz = -0.015 - Math.random() * 0.015;
                        s.life = 1.0;
                    }
                    
                    const vr = vehicle.color?.r ?? 0;
                    const vg = vehicle.color?.g ?? 240;
                    const vb = vehicle.color?.b ?? 255;
                    
                    projectAndDrawNode(s.x, s.y, s.z, `rgba(${vr}, ${vg}, ${vb}, ${s.life * 0.8})`, 1.6);
                    projectAndDrawNode(s.x, s.y, s.z, `rgba(255, 255, 255, ${s.life * 0.95})`, 0.6);
                });
            }
            
            // Selection highlight ring & vertical dashed alignment spire
            if (vehicle === selectedVehicle) {
                const ringRadius = 0.38;
                holoCtx.beginPath();
                let firstRingPoint = true;
                for (let aIdx = 0; aIdx <= 24; aIdx++) {
                    const angle = (aIdx * Math.PI * 2) / 24;
                    const rx = (vehicle.x || 0) + ringRadius * Math.cos(angle);
                    const rz = (vehicle.z || 0) + ringRadius * Math.sin(angle);
                    const ry = (vehicle.y || 0);
                    
                    const screenPos = projectPointToScreen(rx, ry, rz, w, h);
                    if (screenPos) {
                        if (firstRingPoint) {
                            holoCtx.moveTo(screenPos.x, screenPos.y);
                            firstRingPoint = false;
                        } else {
                            holoCtx.lineTo(screenPos.x, screenPos.y);
                        }
                    }
                }
                holoCtx.strokeStyle = "rgba(255, 200, 60, 0.95)";
                holoCtx.lineWidth = 2.0;
                holoCtx.stroke();
                
                // Draw vertical indicator line
                const topScreen = projectPointToScreen(vehicle.x || 0, (vehicle.y || 0) + 0.5, vehicle.z || 0, w, h);
                const bottomScreen = projectPointToScreen(vehicle.x || 0, vehicle.y || 0, vehicle.z || 0, w, h);
                if (topScreen && bottomScreen) {
                    holoCtx.beginPath();
                    holoCtx.moveTo(bottomScreen.x, bottomScreen.y);
                    holoCtx.lineTo(topScreen.x, topScreen.y);
                    holoCtx.strokeStyle = "rgba(255, 200, 60, 0.4)";
                    holoCtx.lineWidth = 1.0;
                    holoCtx.setLineDash([2, 2]);
                    holoCtx.stroke();
                    holoCtx.setLineDash([]);
                }
            }
        });
    } else {
        // Fallback: Project & Draw single global model
        const numVerts = holoVertices.length;
        ensureProjectedCacheSize(numVerts);
        
        for (let i = 0; i < numVerts; i++) {
            const v = holoVertices[i];
            
            let vx = v.x;
            let vy = v.y;
            let vz = v.z;
            
            if (v.isWheel && holoSimState && (holoSimState.motion === "translate" || holoSimState.motion === "spin" || holoSimState.motion === "fly")) {
                const spinFactor = (holoSimState.motion === "spin" ? 8.0 : 4.5) * holoSimState.speed;
                const theta = holoSimState.time * spinFactor;
                const dy = v.y - v.axleY;
                const dz = v.z - v.axleZ;
                const rDist = Math.sqrt(dy * dy + dz * dz);
                const currentAngle = Math.atan2(dy, dz);
                const newAngle = currentAngle + theta;
                vy = v.axleY + rDist * Math.sin(newAngle);
                vz = v.axleZ + rDist * Math.cos(newAngle);
            }
            
            if (holoSimState && holoSimState.motion === "translate") {
                vy += Math.sin(holoSimState.time * 25.0) * 0.004;
            }
            
            let rx = vx * holoZoom;
            let ry = vy * holoZoom;
            let rz = vz * holoZoom;
            
            let x1 = rx * cosY + rz * sinY;
            let z1 = -rx * sinY + rz * cosY;
            
            let y2 = ry * cosX - z1 * sinX;
            let z2 = ry * sinX + z1 * cosX;
            
            let x3 = x1 * cosZ - y2 * sinZ;
            let y3 = x1 * sinZ + y2 * cosZ;
            
            const p = projectedCache[i];
            p.z = z2;
            p.origColor = v.color;
            
            if (z2 >= distance - 0.15) {
                p.clipped = true;
            } else {
                p.clipped = false;
                const perspective = 1 / (distance - z2);
                p.x = x3 * perspective * scale + w / 2;
                p.y = -y3 * perspective * scale + h / 2;
            }
        }
        
        // Draw vector edges (Double pass glow lines)
        const numEdges = holoEdges.length;
        holoCtx.lineWidth = 1.6;
        for (let i = 0; i < numEdges; i++) {
            const edge = holoEdges[i];
            const p1 = projectedCache[edge[0]];
            const p2 = projectedCache[edge[1]];
            
            if (!p1 || !p2 || p1.clipped || p2.clipped) continue;
            
            const avgZ = (p1.z + p2.z) / 2;
            const alpha = Math.max(0.04, Math.min(0.24, (avgZ + 1.2) * 0.16));
            
            const r = Math.round((p1.origColor.r + p2.origColor.r) / 2);
            const g = Math.round((p1.origColor.g + p2.origColor.g) / 2);
            const b = Math.round((p1.origColor.b + p2.origColor.b) / 2);
            
            holoCtx.beginPath();
            holoCtx.moveTo(p1.x, p1.y);
            holoCtx.lineTo(p2.x, p2.y);
            holoCtx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.45})`;
            holoCtx.stroke();
        }
        
        holoCtx.lineWidth = 0.85;
        for (let i = 0; i < numEdges; i++) {
            const edge = holoEdges[i];
            const p1 = projectedCache[edge[0]];
            const p2 = projectedCache[edge[1]];
            
            if (!p1 || !p2 || p1.clipped || p2.clipped) continue;
            
            const avgZ = (p1.z + p2.z) / 2;
            const alpha = Math.max(0.12, Math.min(0.65, (avgZ + 1.2) * 0.32));
            
            const r = Math.round((p1.origColor.r + p2.origColor.r) / 2);
            const g = Math.round((p1.origColor.g + p2.origColor.g) / 2);
            const b = Math.round((p1.origColor.b + p2.origColor.b) / 2);
            
            holoCtx.beginPath();
            holoCtx.moveTo(p1.x, p1.y);
            holoCtx.lineTo(p2.x, p2.y);
            holoCtx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            holoCtx.stroke();
        }
        
        // Draw Nodes (High-performance single-path batched rendering for fallback/blueprint shapes)
        const dotsPerEdge = 10;
        
        // 1. Batch Core Nodes (White Core)
        holoCtx.beginPath();
        holoCtx.fillStyle = "rgba(255, 255, 255, 0.9)";
        for (let i = 0; i < numEdges; i++) {
            const edge = holoEdges[i];
            const p1 = projectedCache[edge[0]];
            const p2 = projectedCache[edge[1]];
            if (!p1 || !p2 || p1.clipped || p2.clipped) continue;
            
            const avgZ = (p1.z + p2.z) / 2;
            const radius = Math.max(0.65, (avgZ + 1.2) * 0.95);
            const rCore = radius * 0.45;
            const size = rCore * 2;
            
            for (let d = 0; d <= dotsPerEdge; d++) {
                const t = d / dotsPerEdge;
                const dx = p1.x + (p2.x - p1.x) * t;
                const dy = p1.y + (p2.y - p1.y) * t;
                holoCtx.rect(dx - rCore, dy - rCore, size, size);
            }
        }
        holoCtx.fill();
        
        // 2. Batch Glow Nodes (Mixed Edge Colors)
        for (let i = 0; i < numEdges; i++) {
            const edge = holoEdges[i];
            const p1 = projectedCache[edge[0]];
            const p2 = projectedCache[edge[1]];
            if (!p1 || !p2 || p1.clipped || p2.clipped) continue;
            
            const avgZ = (p1.z + p2.z) / 2;
            const radius = Math.max(0.65, (avgZ + 1.2) * 0.95);
            const rGlow = radius * 1.5;
            const size = rGlow * 2;
            
            const r = Math.round((p1.origColor.r + p2.origColor.r) / 2);
            const g = Math.round((p1.origColor.g + p2.origColor.g) / 2);
            const b = Math.round((p1.origColor.b + p2.origColor.b) / 2);
            
            holoCtx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.22)`;
            holoCtx.beginPath();
            for (let d = 0; d <= dotsPerEdge; d++) {
                const t = d / dotsPerEdge;
                const dx = p1.x + (p2.x - p1.x) * t;
                const dy = p1.y + (p2.y - p1.y) * t;
                holoCtx.rect(dx - rGlow, dy - rGlow, size, size);
            }
            holoCtx.fill();
        }
        
        for (let i = 0; i < numVerts; i++) {
            const p = projectedCache[i];
            if (p.clipped) continue;
            
            const radius = Math.max(0.85, (p.z + 1.2) * 1.15);
            const alpha = Math.max(0.35, Math.min(0.95, (p.z + 1.2) * 0.6));
            
            holoCtx.beginPath();
            holoCtx.arc(p.x, p.y, radius * 2.2, 0, 2 * Math.PI);
            holoCtx.fillStyle = `rgba(${p.origColor.r}, ${p.origColor.g}, ${p.origColor.b}, ${alpha * 0.32})`;
            holoCtx.fill();
            
            holoCtx.beginPath();
            holoCtx.arc(p.x, p.y, radius * 0.45, 0, 2 * Math.PI);
            holoCtx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
            holoCtx.fill();
        }
        
        // Single sparks loop
        if (holoCarSparks.length === 0) {
            for (let i = 0; i < 35; i++) {
                holoCarSparks.push({
                    x: (Math.random() - 0.5) * 0.6,
                    y: -0.22 + Math.random() * 0.5,
                    z: (Math.random() - 0.5) * 0.8,
                    speedY: 0.005 + Math.random() * 0.008
                });
            }
        }
        const sparksTime = holoSimState ? holoSimState.time : Date.now() * 0.001;
        holoCarSparks.forEach(s => {
            s.y += s.speedY;
            s.x += Math.sin(s.y * 10 + sparksTime) * 0.004;
            if (s.y > 0.4) {
                s.y = -0.22;
                s.x = (Math.random() - 0.5) * 0.6;
                s.z = (Math.random() - 0.5) * 0.8;
            }
            projectAndDrawNode(s.x, s.y, s.z, "rgba(255, 42, 42, 0.85)", 2.0);
            projectAndDrawNode(s.x, s.y, s.z, "rgba(255, 255, 255, 0.95)", 0.8);
        });
        
        if (activeHoloShape === "network") {
            drawCyberPackets(projectedCache);
        }
        
        // Draw Hand Gesture UI Overlay
        if (isHandControlMode && handCursorPos) {
            holoCtx.save();
            
            // Draw top warning banner if locked or in tactical sandbox mode
            if (isGestureLocked) {
                holoCtx.save();
                holoCtx.font = "bold 9px Share Tech Mono";
                holoCtx.fillStyle = "#ff2a2a";
                holoCtx.textAlign = "center";
                holoCtx.fillText("▲ GESTURE LOCK ACTIVE // HUD TELEMETRY PAUSED", w / 2, 40);
                holoCtx.restore();
            } else if (leftHandSpecialMode) {
                holoCtx.save();
                holoCtx.font = "bold 9px Share Tech Mono";
                const pulseAlpha = 0.6 + Math.sin(Date.now() * 0.007) * 0.3;
                holoCtx.fillStyle = `rgba(255, 170, 0, ${pulseAlpha})`;
                holoCtx.textAlign = "center";
                holoCtx.fillText("▲ TACTICAL MODE ACTIVE // AUTO TELEMETRY STANDBY", w / 2, 40);
                holoCtx.restore();
            }
            
            // Draw Virtual Cursor
            let cursorColor = "rgba(255, 255, 255, 0.95)"; // Appear white when not grabbing
            let cursorOuterGlow = leftHandSpecialMode ? "rgba(255, 170, 0, 0.45)" : "rgba(0, 240, 255, 0.45)"; // Custom accent outer glow
            let isGrabbingActive = isHandPinching;
            
            if (isGestureLocked) {
                cursorColor = "rgba(255, 42, 42, 0.95)"; // Neon red when locked
                cursorOuterGlow = "rgba(255, 42, 42, 0.35)";
            } else if (isGrabbingActive) {
                cursorColor = "rgba(255, 42, 42, 0.95)"; // Neon red when actively grabbing/moving
                cursorOuterGlow = "rgba(255, 42, 42, 0.35)";
            }
            
            // Draw futuristic outer glow ring
            holoCtx.beginPath();
            holoCtx.arc(handCursorPos.x, handCursorPos.y, 14, 0, 2 * Math.PI);
            holoCtx.strokeStyle = cursorOuterGlow;
            holoCtx.lineWidth = 1.2;
            if (!isGrabbingActive && !isGestureLocked) {
                holoCtx.setLineDash([2, 2]); // Dotted outer ring when scanning
            }
            holoCtx.stroke();
            holoCtx.setLineDash([]);
            
            // Draw central smooth circular indicator
            holoCtx.beginPath();
            holoCtx.arc(handCursorPos.x, handCursorPos.y, 7, 0, 2 * Math.PI);
            holoCtx.strokeStyle = cursorColor;
            holoCtx.lineWidth = 2.0;
            holoCtx.stroke();
            
            // Draw inner tiny micro-dot core
            holoCtx.beginPath();
            holoCtx.arc(handCursorPos.x, handCursorPos.y, 1.5, 0, 2 * Math.PI);
            holoCtx.fillStyle = cursorColor;
            holoCtx.fill();
            
            // Futuristic focus targeting indicator linking cursor to 3D object
            if (isGrabbingActive && selectedVehicle) {
                const proj = projectPointToScreen(selectedVehicle.x, selectedVehicle.y, selectedVehicle.z, w, h);
                if (proj) {
                    // 1. Draw glowing neon laser linking line
                    holoCtx.save();
                    holoCtx.beginPath();
                    holoCtx.moveTo(handCursorPos.x, handCursorPos.y);
                    holoCtx.lineTo(proj.x, proj.y);
                    holoCtx.strokeStyle = "rgba(255, 42, 42, 0.35)";
                    holoCtx.lineWidth = 1.0;
                    holoCtx.setLineDash([3, 3]);
                    holoCtx.stroke();
                    holoCtx.restore();
                    
                    // 2. Draw dual concentric holographic selection focus target rings around the object
                    holoCtx.save();
                    holoCtx.beginPath();
                    holoCtx.arc(proj.x, proj.y, 22, 0, 2 * Math.PI);
                    holoCtx.strokeStyle = "rgba(255, 42, 42, 0.8)";
                    holoCtx.lineWidth = 1.5;
                    holoCtx.stroke();
                    
                    holoCtx.beginPath();
                    holoCtx.arc(proj.x, proj.y, 27, 0, 2 * Math.PI);
                    holoCtx.strokeStyle = "rgba(255, 42, 42, 0.3)";
                    holoCtx.lineWidth = 1.0;
                    holoCtx.setLineDash([4, 4]);
                    holoCtx.stroke();
                    holoCtx.restore();
                }
            }
            
            // Target locked reticle if pinching/selecting, or square double alert ring if gesture lock active
            if (isGestureLocked) {
                // Double neon-red locking alert squares
                holoCtx.beginPath();
                holoCtx.rect(handCursorPos.x - 12, handCursorPos.y - 12, 24, 24);
                holoCtx.strokeStyle = "rgba(255, 42, 42, 0.85)";
                holoCtx.lineWidth = 1.2;
                holoCtx.stroke();
                
                holoCtx.beginPath();
                holoCtx.rect(handCursorPos.x - 16, handCursorPos.y - 16, 32, 32);
                holoCtx.strokeStyle = "rgba(255, 42, 42, 0.35)";
                holoCtx.lineWidth = 1.0;
                holoCtx.setLineDash([2, 2]);
                holoCtx.stroke();
                holoCtx.setLineDash([]);
                
                // Draw hand telemetry text
                holoCtx.font = "9px Share Tech Mono";
                holoCtx.fillStyle = "#ff2a2a";
                holoCtx.fillText("INTERFACE LOCKED", handCursorPos.x + 22, handCursorPos.y + 3);
            } else if (isHandPinching) {
                holoCtx.font = "9px Share Tech Mono";
                holoCtx.fillStyle = leftHandSpecialMode ? "rgba(255, 170, 0, 0.95)" : "rgba(255, 42, 42, 0.95)";
                holoCtx.fillText(leftHandSpecialMode ? "TACTICAL GRAB" : "PINCH ACQUIRED", handCursorPos.x + 22, handCursorPos.y + 3);
            } else {
                holoCtx.font = "9px Share Tech Mono";
                holoCtx.fillStyle = leftHandSpecialMode ? "rgba(255, 170, 0, 0.95)" : "rgba(0, 240, 255, 0.95)";
                holoCtx.fillText(leftHandSpecialMode ? "TACTICAL TARGETING" : "HAND TARGETING", handCursorPos.x + 22, handCursorPos.y + 3);
            }
            
            holoCtx.restore();
        }
    }
} catch (err) {
        console.error("Holo-Simulation render error:", err);
        if (typeof printSystemMessage === "function") {
            printSystemMessage(`[HOLO-SYSTEM ERROR]: ${err.name}: ${err.message}`);
        }
    }
}

function drawCyberPackets(projected) {
    if (networkPackets.length === 0 && holoEdges.length > 0) {
        for (let i = 0; i < 15; i++) {
            const edgeIdx = Math.floor(Math.random() * holoEdges.length);
            networkPackets.push({
                edgeIdx: edgeIdx,
                progress: Math.random(), 
                speed: 0.015 + Math.random() * 0.02
            });
        }
    }
    
    networkPackets.forEach(pkt => {
        const edge = holoEdges[pkt.edgeIdx];
        if (!edge) return;
        
        const p1 = projected[edge[0]];
        const p2 = projected[edge[1]];
        if (!p1 || !p2) return;
        if (p1.clipped || p2.clipped) {
            pkt.progress = 0;
            pkt.edgeIdx = Math.floor(Math.random() * holoEdges.length);
            return;
        }
        
        const x = p1.x + (p2.x - p1.x) * pkt.progress;
        const y = p1.y + (p2.y - p1.y) * pkt.progress;
        
        holoCtx.beginPath();
        holoCtx.arc(x, y, 1.8, 0, 2 * Math.PI);
        holoCtx.fillStyle = "rgba(255, 255, 255, 0.95)";
        holoCtx.fill();
        
        holoCtx.beginPath();
        holoCtx.arc(x, y, 4.0, 0, 2 * Math.PI);
        holoCtx.fillStyle = "rgba(0, 240, 255, 0.35)";
        holoCtx.fill();
        
        pkt.progress += pkt.speed;
        if (pkt.progress >= 1.0) {
            pkt.progress = 0;
            pkt.edgeIdx = Math.floor(Math.random() * holoEdges.length);
        }
    });
}

function changeHoloShape(shapeName) {
    activeHoloShape = shapeName;
    holoVertices = [];
    holoEdges = [];
    
    // Resiliently verify and reconnect hand tracking cursor on shape/scene change
    reconnectHandGestureSystem().catch(err => console.warn("Failed to reconnect cursor on shape change:", err));
    
    if (holoMetaShape) {
        holoMetaShape.textContent = `MATRIX ACTIVE: ${shapeName.toUpperCase()}`;
    }
    
    switch (shapeName) {
        case "dna":
            generateDNAHelix();
            break;
        case "reactor":
            generateArcReactor();
            break;
        case "network":
            generateCyberNetwork();
            break;
        case "tesseract":
            generateTesseract();
            break;
        case "sphere":
            generateHoloSphere();
            break;
        case "prism":
            generateOctagonalPrism();
            break;
        case "torus":
        default:
            generateDefaultTorus();
            break;
    }
}

function generateOctagonalPrism() {
    activeHoloShape = "prism";
    holoVertices = [];
    holoEdges = [];
    activeVehicles = []; // Clear active vehicles
    
    if (holoMetaShape) {
        holoMetaShape.textContent = `MATRIX ACTIVE: OCTAGONAL PRISM`;
    }
    
    const radius = 0.55; 
    const height = 0.65;
    
    // Top octagon (y = -height)
    for (let i = 0; i < 8; i++) {
        const theta = (i * Math.PI) / 4;
        holoVertices.push({
            x: radius * Math.cos(theta),
            y: -height,
            z: radius * Math.sin(theta),
            color: { r: 0, g: 240, b: 255 } // Cyan
        });
    }
    
    // Bottom octagon (y = height)
    for (let i = 0; i < 8; i++) {
        const theta = (i * Math.PI) / 4;
        holoVertices.push({
            x: radius * Math.cos(theta),
            y: height,
            z: radius * Math.sin(theta),
            color: { r: 255, g: 42, b: 42 } // Red
        });
    }
    
    // Edges
    for (let i = 0; i < 8; i++) {
        const next = (i + 1) % 8;
        // Top octagon edges
        holoEdges.push([i, next]);
        // Bottom octagon edges
        holoEdges.push([i + 8, next + 8]);
        // Vertical pillars
        holoEdges.push([i, i + 8]);
    }
}

function generateDefaultTorus() {
    const R = 1.1;
    const r = 0.35;
    const stepsU = 32; 
    const stepsV = 16;  
    
    for (let i = 0; i < stepsU; i++) {
        const u = (i * 2 * Math.PI) / stepsU;
        for (let j = 0; j < stepsV; j++) {
            const v = (j * 2 * Math.PI) / stepsV;
            
            const x = (R + r * Math.cos(v)) * Math.cos(u);
            const y = r * Math.sin(v);
            const z = (R + r * Math.cos(v)) * Math.sin(u);
            
            const isRed = (i + j) % 2 === 0;
            const color = isRed ? { r: 255, g: 42, b: 42 } : { r: 0, g: 240, b: 255 };
            
            holoVertices.push({ x, y, z, color });
        }
    }
    
    for (let i = 0; i < stepsU; i++) {
        for (let j = 0; j < stepsV; j++) {
            const currentIdx = i * stepsV + j;
            const nextUIdx = ((i + 1) % stepsU) * stepsV + j;
            const nextVIdx = i * stepsV + ((j + 1) % stepsV);
            
            holoEdges.push([currentIdx, nextUIdx]);
            holoEdges.push([currentIdx, nextVIdx]);
        }
    }
}

function generateDNAHelix() {
    const numPoints = 72; 
    const R = 0.65;
    const height = 2.4;
    const pitch = 2.5; 
    
    for (let i = 0; i < numPoints; i++) {
        const t = (i / (numPoints - 1)) * 4 * Math.PI - 2 * Math.PI; 
        const y = (t / (2 * Math.PI)) * (height / 2);
        
        const x1 = R * Math.cos(t * pitch);
        const z1 = R * Math.sin(t * pitch);
        holoVertices.push({
            x: x1, y: y, z: z1,
            color: { r: 255, g: 42, b: 42 } 
        });
        
        const x2 = R * Math.cos(t * pitch + Math.PI);
        const z2 = R * Math.sin(t * pitch + Math.PI);
        holoVertices.push({
            x: x2, y: y, z: z2,
            color: { r: 0, g: 240, b: 255 } 
        });
    }
    
    for (let i = 0; i < numPoints; i++) {
        const idx1 = i * 2;
        const idx2 = i * 2 + 1;
        
        if (i < numPoints - 1) {
            holoEdges.push([idx1, idx1 + 2]); 
            holoEdges.push([idx2, idx2 + 2]); 
        }
        
        if (i % 3 === 0) {
            holoEdges.push([idx1, idx2]);
        }
    }
}

function generateArcReactor() {
    const rings = [
        { radius: 0.3, numPoints: 20, z: 0.1, color: { r: 255, g: 255, b: 255 } }, 
        { radius: 0.6, numPoints: 36, z: 0.0, color: { r: 0, g: 240, b: 255 } },
        { radius: 1.0, numPoints: 48, z: -0.1, color: { r: 0, g: 240, b: 255 } },
        { radius: 1.2, numPoints: 64, z: -0.2, color: { r: 255, g: 42, b: 42 } }  
    ];
    
    let baseOffset = 0;
    
    rings.forEach((ring, rIdx) => {
        for (let i = 0; i < ring.numPoints; i++) {
            const theta = (i * 2 * Math.PI) / ring.numPoints;
            const x = ring.radius * Math.cos(theta);
            const y = ring.radius * Math.sin(theta);
            const z = ring.z;
            
            holoVertices.push({ x, y, z, color: ring.color });
            
            const currentIdx = baseOffset + i;
            const nextIdx = baseOffset + ((i + 1) % ring.numPoints);
            holoEdges.push([currentIdx, nextIdx]);
        }
        
        if (rIdx > 0) {
            const prevRing = rings[rIdx - 1];
            const prevOffset = baseOffset - prevRing.numPoints;
            
            for (let i = 0; i < ring.numPoints; i++) {
                if (i % 3 === 0) { 
                    const nearestPrevIdx = prevOffset + Math.round((i / ring.numPoints) * prevRing.numPoints) % prevRing.numPoints;
                    holoEdges.push([baseOffset + i, nearestPrevIdx]);
                }
            }
        }
        
        baseOffset += ring.numPoints;
    });
}

function generateTesseract() {
    const coords = [
        [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
        [-1, -1, 1],  [1, -1, 1],  [1, 1, 1],  [-1, 1, 1]
    ];
    
    const sOuter = 0.9;
    const sInner = 0.45;
    
    coords.forEach(c => {
        holoVertices.push({
            x: c[0] * sOuter, y: c[1] * sOuter, z: c[2] * sOuter,
            color: { r: 255, g: 42, b: 42 } 
        });
    });
    
    coords.forEach(c => {
        holoVertices.push({
            x: c[0] * sInner, y: c[1] * sInner, z: c[2] * sInner,
            color: { r: 0, g: 240, b: 255 } 
        });
    });
    
    const addCubeEdges = (offset) => {
        holoEdges.push([offset + 0, offset + 1]);
        holoEdges.push([offset + 1, offset + 2]);
        holoEdges.push([offset + 2, offset + 3]);
        holoEdges.push([offset + 3, offset + 0]);
        holoEdges.push([offset + 4, offset + 5]);
        holoEdges.push([offset + 5, offset + 6]);
        holoEdges.push([offset + 6, offset + 7]);
        holoEdges.push([offset + 7, offset + 4]);
        holoEdges.push([offset + 0, offset + 4]);
        holoEdges.push([offset + 1, offset + 5]);
        holoEdges.push([offset + 2, offset + 6]);
        holoEdges.push([offset + 3, offset + 7]);
    };
    
    addCubeEdges(0); 
    addCubeEdges(8); 
    
    for (let i = 0; i < 8; i++) {
        holoEdges.push([i, i + 8]);
    }
}

function generateCyberNetwork() {
    const numNodes = 80;
    const radius = 1.1;
    
    for (let i = 0; i < numNodes; i++) {
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2.0 * Math.PI;
        const phi = Math.acos(2.0 * v - 1.0);
        const r = radius * Math.cbrt(Math.random()); 
        
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);
        
        const color = Math.random() > 0.4 ? { r: 0, g: 240, b: 255 } : { r: 255, g: 42, b: 42 };
        
        holoVertices.push({ x, y, z, color });
    }
    
    const distanceThreshold = 0.55;
    for (let i = 0; i < numNodes; i++) {
        for (let j = i + 1; j < numNodes; j++) {
            const p1 = holoVertices[i];
            const p2 = holoVertices[j];
            
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const dz = p1.z - p2.z;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            if (dist < distanceThreshold) {
                holoEdges.push([i, j]);
            }
        }
    }
}

function generateHoloSphere() {
    const radius = 1.0;
    const rings = 18;
    const sectors = 24;
    
    for (let r = 0; r <= rings; r++) {
        const phi = (r * Math.PI) / rings;
        for (let s = 0; s < sectors; s++) {
            const theta = (s * 2 * Math.PI) / sectors;
            
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.cos(phi);
            const z = radius * Math.sin(phi) * Math.sin(theta);
            
            const color = r % 2 === 0 ? { r: 255, g: 42, b: 42 } : { r: 0, g: 240, b: 255 };
            
            holoVertices.push({ x, y, z, color });
        }
    }
    
    for (let r = 0; r < rings; r++) {
        for (let s = 0; s < sectors; s++) {
            const current = r * sectors + s;
            const nextSector = r * sectors + ((s + 1) % sectors);
            const nextRing = (r + 1) * sectors + s;
            
            holoEdges.push([current, nextSector]);
            
            if (r < rings) {
                holoEdges.push([current, nextRing]);
            }
        }
    }
}

function handleHoloConsoleSubmit(e) {
    if (e) e.preventDefault();
    
    const text = holoConsoleInput.value.trim();
    if (!text) return;
    
    const userDiv = document.createElement("div");
    userDiv.className = "user-query";
    const safeText = escapeHTML(text);
    userDiv.innerHTML = `<span class="label">USER</span>${safeText}`;
    holoConsoleOutput.appendChild(userDiv);
    holoConsoleOutput.scrollTop = holoConsoleOutput.scrollHeight;
    
    holoConsoleInput.value = "";
    playSFX(sfxBeep);
    
    isAborted = false;
    if (stopBtn) stopBtn.style.display = "none";
    
    const cleanText = text.toLowerCase();
    
    if (isWorldBuildingMode) {
        if (cleanText.includes("clear") || cleanText.includes("reset") || cleanText.includes("empty") || cleanText.includes("wipe")) {
            activeVehicles = [];
            selectedVehicle = null;
            if (selectedEntityPanel) selectedEntityPanel.style.display = "none";
            speak("Cleared sandbox grid, Sir.");
            printSystemMessage("[HOLO-SYSTEM]: Sandbox grid cleared successfully.");
            return;
        }
        
        // Parse entities to spawn in World Building Mode
        const sandboxEntityMap = {
            "truck": "truck", "semi": "truck",
            "motorcycle": "motorcycle", "bike": "motorcycle",
            "bus": "bus",
            "suv": "suv", "jeep": "suv",
            "hovercraft": "hovercraft",
            "spaceship": "spaceship",
            "car": "car", "vehicle": "car",
            "boat": "boat", "speedboat": "boat", "ship": "boat",
            "man": "man", "men": "man", "guy": "man", "male": "man", "human": "man",
            "woman": "woman", "women": "woman", "lady": "woman", "female": "woman",
            "boy": "boy", "boys": "boy",
            "girl": "girl", "girls": "girl",
            "child": "boy", "kid": "boy",
            "skyscraper": "skyscraper",
            "tower": "tower", "lighthouse": "tower",
            "pyramid": "pyramid",
            "castle": "castle", "fortress": "castle",
            "house": "house", "cabin": "house",
            "windmill": "windmill",
            
            // Draggable environment shapes
            "mountain": "mountain", "valley": "mountain", "hill": "mountain",
            "river": "river", "water_tile": "river", "water": "river",
            "road_block": "road_block", "road": "road_block", "highway": "road_block",
            "tree": "tree", "forest": "tree",
            "cactus": "cactus", "desert": "cactus",
            "cloud": "cloud", "sky": "cloud"
        };
        
        let foundAny = false;
        const numberWords = {
            "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
            "a": 1, "an": 1
        };
        
        // Process matches in sorted index order to support multiple distinct spawns in one sentence!
        const spawnJobs = [];
        for (const [keyword, typeName] of Object.entries(sandboxEntityMap)) {
            const regex = new RegExp("\\b" + keyword + "s?\\b", "gi");
            let match;
            while ((match = regex.exec(cleanText)) !== null) {
                spawnJobs.push({
                    index: match.index,
                    keyword: keyword,
                    typeName: typeName
                });
            }
        }
        
        // Sort by index so it parses logically left-to-right
        spawnJobs.sort((a, b) => a.index - b.index);
        
        const processedSeen = new Set();
        spawnJobs.forEach(job => {
            if (processedSeen.has(job.typeName)) return; // prevent duplicate spawns of same parsed type in one word
            processedSeen.add(job.typeName);
            
            // Determine quantity from prefix
            let quantity = 1;
            const preStr = cleanText.substring(Math.max(0, job.index - 15), job.index).trim();
            const numMatch = preStr.match(/(\b\d+\b|\b[a-z]+\b)\s*$/i);
            if (numMatch) {
                const word = numMatch[1];
                if (/^\d+$/.test(word)) {
                    quantity = parseInt(word, 10);
                } else if (numberWords[word] !== undefined) {
                    quantity = numberWords[word];
                }
            }
            
            quantity = Math.min(10, Math.max(1, quantity));
            
            // Spawn specified quantity
            for (let q = 0; q < quantity; q++) {
                const spreadX = (Math.random() - 0.5) * 0.8;
                const spreadZ = (Math.random() - 0.5) * 0.8;
                
                spawnVehicle(job.typeName, spreadX, -0.22, spreadZ, 1.0, null, 1);
                
                const spawned = activeVehicles[activeVehicles.length - 1];
                if (spawned) {
                    spawned.manualLocation = true;
                    spawned.manualHeight = true;
                    spawned.isAnimated = true; // default animated
                }
            }
            
            foundAny = true;
            speak(`Imported ${quantity > 1 ? quantity + " " + job.keyword + "s" : job.keyword} into sandbox grid, Sir.`);
            printSystemMessage(`[HOLO-SYSTEM]: Spawned ${quantity > 1 ? quantity + "x " + job.typeName.toUpperCase() : job.typeName.toUpperCase()} in sandbox matrix.`);
        });
        
        if (!foundAny) {
            speak("Apologies Sir, I couldn't resolve that asset type for the sandbox matrix.");
            printSystemMessage("[HOLO-SYSTEM ERROR]: Unresolved sandbox asset query. Try spawning 'car', 'tree', 'mountain', or 'river'.");
        }
        return;
    }
    let shapeFound = false;
    
    if (cleanText.includes("dna") || cleanText.includes("helix")) {
        changeHoloShape("dna");
        shapeFound = true;
    } else if (cleanText.includes("reactor") || cleanText.includes("arc")) {
        changeHoloShape("reactor");
        shapeFound = true;
    } else if (cleanText.includes("network") || cleanText.includes("cyber")) {
        changeHoloShape("network");
        shapeFound = true;
    } else if (cleanText.includes("cube") || cleanText.includes("tesseract")) {
        changeHoloShape("tesseract");
        shapeFound = true;
    } else if (cleanText.includes("sphere") || cleanText.includes("globe")) {
        changeHoloShape("sphere");
        shapeFound = true;
    } else if (cleanText.includes("torus") || cleanText.includes("donut") || cleanText.includes("default")) {
        changeHoloShape("torus");
        shapeFound = true;
    }
    
    if (shapeFound) {
        // Reset any active simulation animations
        holoSimState = { 
            motion: null, 
            speed: 1.0, 
            envs: { terrain: false, road: false, water: false, space: false, storm: false, fire: false, forest: false, desert: false, sky: false, city: false }, 
            time: 0 
        };
        speak(`Hologram reconfigured, Sir.`);
        printSystemMessage(`[HOLO-SYSTEM]: Matrix transitioned to ${activeHoloShape.toUpperCase()}.`);
    } else {
        // --- Parse simulation scenario (motion + compound environment) FIRST ---
        parseSimulationScenario(cleanText);
        
        // --- THEN generate the hologram with parsed state context ---
        generateCustomScenarioHologram(cleanText);
        
        const simDesc = [];
        if (holoSimState.motion) simDesc.push(holoSimState.motion.toUpperCase());
        
        const activeEnvs = [];
        for (const [k, v] of Object.entries(holoSimState.envs)) {
            if (v) activeEnvs.push(k.toUpperCase());
        }
        
        const simLabel = simDesc.length > 0 || activeEnvs.length > 0 
            ? ` | SIM: ${[...simDesc, ...activeEnvs].join(" + ")}` 
            : "";
        
        speak(`Holographic projection loaded, Sir.`);
        printSystemMessage(`[HOLO-SYSTEM]: Structural matrix for "${text.toUpperCase()}" deployed.${simLabel}`);
    }
}

// Simulation State — drives per-frame motion and environmental effects on the hologram
let holoSimState = { 
    motion: null, 
    speed: 1.0, 
    envs: {
        terrain: false,
        road: false,
        water: false,
        space: false,
        storm: false,
        fire: false,
        forest: false,
        desert: false,
        sky: false,
        city: false
    },
    time: 0 
};

function parseSimulationScenario(query) {
    const q = query.toLowerCase();
    
    // Reset
    holoSimState = { 
        motion: null, 
        speed: 1.0, 
        envs: {
            terrain: false,
            road: false,
            water: false,
            space: false,
            storm: false,
            fire: false,
            forest: false,
            desert: false,
            sky: false,
            city: false
        },
        time: 0 
    };
    
    // --- Motion type detection ---
    if (q.includes("running") || q.includes("moving") || q.includes("driving") || q.includes("racing") || q.includes("speeding") || q.includes("cruising") || q.includes("going")) {
        holoSimState.motion = "translate";
        holoSimState.speed = q.includes("fast") || q.includes("racing") || q.includes("speeding") ? 2.5 : 1.2;
    } else if (q.includes("flying") || q.includes("soaring") || q.includes("gliding") || q.includes("hovering")) {
        holoSimState.motion = "fly";
        holoSimState.speed = q.includes("fast") ? 2.0 : 1.0;
    } else if (q.includes("spinning") || q.includes("rotating") || q.includes("twisting") || q.includes("revolving")) {
        holoSimState.motion = "spin";
        holoSimState.speed = q.includes("fast") ? 3.0 : 1.5;
    } else if (q.includes("floating") || q.includes("drifting") || q.includes("levitating") || q.includes("orbiting")) {
        holoSimState.motion = "float";
        holoSimState.speed = 0.6;
    } else if (q.includes("bouncing") || q.includes("jumping") || q.includes("hopping")) {
        holoSimState.motion = "bounce";
        holoSimState.speed = 1.8;
    } else if (q.includes("falling") || q.includes("dropping") || q.includes("diving") || q.includes("plunging")) {
        holoSimState.motion = "fall";
        holoSimState.speed = 1.5;
    } else if (q.includes("walking") || q.includes("strolling") || q.includes("patrolling")) {
        holoSimState.motion = "translate";
        holoSimState.speed = 0.5;
    }
    
    // --- Environment detection (supports concurrent compound layers!) ---
    if (q.includes("valley") || q.includes("mountain") || q.includes("hill") || q.includes("terrain") || q.includes("cliff") || q.includes("canyon") || q.includes("pass") || q.includes("peak") || q.includes("ridge") || q.includes("slope") || q.includes("range")) {
        holoSimState.envs.terrain = true;
    }
    if (q.includes("ocean") || q.includes("sea") || q.includes("water") || q.includes("lake") || q.includes("river") || q.includes("underwater") || q.includes("pond") || q.includes("stream") || q.includes("surf") || q.includes("wave") || q.includes("waves") || q.includes("tide")) {
        holoSimState.envs.water = true;
    }
    if (q.includes("space") || q.includes("galaxy") || q.includes("cosmos") || q.includes("orbit") || q.includes("nebula") || q.includes("star") || q.includes("stars") || q.includes("celestial") || q.includes("universe")) {
        holoSimState.envs.space = true;
    }
    if (q.includes("rain") || q.includes("storm") || q.includes("thunder") || q.includes("lightning") || q.includes("wind") || q.includes("cyclone") || q.includes("monsoon") || q.includes("drizzle")) {
        holoSimState.envs.storm = true;
    }
    if (q.includes("fire") || q.includes("lava") || q.includes("volcano") || q.includes("flame") || q.includes("flames") || q.includes("inferno") || q.includes("embers") || q.includes("heat") || q.includes("magma") || q.includes("burning")) {
        holoSimState.envs.fire = true;
    }
    if (q.includes("city") || q.includes("town") || q.includes("urban") || q.includes("skyscraper") || q.includes("metropolis") || q.includes("downtown") || q.includes("building") || q.includes("buildings")) {
        holoSimState.envs.city = true;
        holoSimState.envs.road = true;
    } else if (q.includes("road") || q.includes("highway") || q.includes("street") || q.includes("track") || q.includes("circuit") || q.includes("path") || q.includes("curb") || q.includes("strip") || q.includes("asphalt") || q.includes("concrete") || q.includes("tunnel")) {
        holoSimState.envs.road = true;
    }
    if (q.includes("sky") || q.includes("cloud") || q.includes("clouds") || q.includes("air") || q.includes("atmosphere") || q.includes("stratosphere") || q.includes("fog")) {
        holoSimState.envs.sky = true;
    }
    if (q.includes("desert") || q.includes("sand") || q.includes("dune") || q.includes("dunes") || q.includes("dust") || q.includes("oasis")) {
        holoSimState.envs.desert = true;
    }
    if (q.includes("forest") || q.includes("jungle") || q.includes("woods") || q.includes("garden") || q.includes("tree") || q.includes("trees") || q.includes("pine") || q.includes("leaf") || q.includes("leaves") || q.includes("nature")) {
        holoSimState.envs.forest = true;
    }
}

function getVehicleData(type) {
    const backupVertices = holoVertices;
    const backupEdges = holoEdges;
    holoVertices = [];
    holoEdges = [];
    
    if (type === "truck") generateProceduralTruck();
    else if (type === "motorcycle") generateProceduralMotorcycle();
    else if (type === "hovercraft") generateProceduralHovercraft();
    else if (type === "suv") generateProceduralSUV();
    else if (type === "bus") generateProceduralBus();
    else if (type === "spaceship") generateProceduralSpaceship();
    else if (type === "man") generateProceduralHumanMale();
    else if (type === "woman") generateProceduralHumanFemale();
    else if (type === "boy") generateProceduralHumanChild(false);
    else if (type === "girl") generateProceduralHumanChild(true);
    else if (type === "boat") generateProceduralBoat();
    else if (type === "skyscraper") generateProceduralSkyscraper();
    else if (type === "tower") generateProceduralTower();
    else if (type === "pyramid") generateProceduralPyramid();
    else if (type === "castle") generateProceduralCastle();
    else if (type === "house") generateProceduralHouse();
    else if (type === "windmill") generateProceduralWindmill();
    else if (type === "mountain") generateProceduralMountain();
    else if (type === "river" || type === "water_tile") generateProceduralRiver();
    else if (type === "road_block" || type === "highway") generateProceduralRoadBlock();
    else if (type === "tree") generateProceduralTree();
    else if (type === "cactus") generateProceduralCactus();
    else if (type === "cloud") generateProceduralCloud();
    else generateProceduralCar(); // Default sports car
    
    const verts = holoVertices.map(v => ({
        ...v
    }));
    const edges = holoEdges.map(e => [e[0], e[1]]);
    
    holoVertices = backupVertices;
    holoEdges = backupEdges;
    return { vertices: verts, edges: edges };
}

function spawnVehicle(type, initialX, initialY, initialZ, speedFactor = 1.0, colorOverride = null, lane = 0) {
    const data = getVehicleData(type);
    
    // Buildings are static (do not run along Z or trigger sparks)
    const isBuilding = ["skyscraper", "tower", "pyramid", "castle", "house", "windmill"].includes(type);
    const finalSpeedFactor = isBuilding ? 0 : speedFactor;
    
    // Sparks array specific to this vehicle - only if it is not a building!
    const sparks = [];
    if (!isBuilding) {
        for (let i = 0; i < 20; i++) {
            sparks.push({
                x: initialX + (Math.random() - 0.5) * 0.1,
                y: initialY + 0.1 + (Math.random() - 0.5) * 0.05,
                z: initialZ - 0.2 - Math.random() * 0.4,
                vx: (Math.random() - 0.5) * 0.015,
                vy: 0.01 + Math.random() * 0.015,
                vz: -0.02 - Math.random() * 0.02,
                life: Math.random(),
                decay: 0.025 + Math.random() * 0.025
            });
        }
    }
    
    activeVehicles.push({
        type: type,
        vertices: data.vertices,
        edges: data.edges,
        x: initialX,
        y: initialY,
        z: initialZ,
        initialZ: initialZ, // Store dynamic initial base Z
        targetLaneX: initialX,
        lane: lane,
        laneIndex: lane,
        speedFactor: finalSpeedFactor,
        bobbingOffset: Math.random() * Math.PI * 2,
        wheelSpinTime: 0,
        color: colorOverride || { r: 0, g: 240, b: 255 },
        sparks: sparks
    });
}

// ----------------------------------------------------------------------
// DYNAMIC PROCEDURAL SCENARIO PARTICLE GENERATORS
// ----------------------------------------------------------------------

function generateCustomScenarioHologram(query) {
    activeHoloShape = "custom: " + query.substring(0, 15);
    holoVertices = [];
    holoEdges = [];
    
    // Resiliently reconnect hand tracking cursor on scenario generation
    reconnectHandGestureSystem().catch(err => console.warn("Failed to reconnect cursor on scenario generation:", err));
    
    activeVehicles = []; // Reset active vehicles pool
    selectedVehicle = null; // Clear active relocation selection
    
    if (holoMetaShape) {
        holoMetaShape.textContent = `MATRIX ACTIVE: ${activeHoloShape.toUpperCase()}`;
    }
    
    const clean = query.toLowerCase();
    
    // Check if this query is a command to inject another vehicle/building to the matrix
    if (clean.startsWith("add ") || clean.startsWith("spawn ")) {
        let addedType = "car";
        if (clean.includes("truck") || clean.includes("semi")) addedType = "truck";
        else if (clean.includes("motorcycle") || clean.includes("bike")) addedType = "motorcycle";
        else if (clean.includes("hovercraft")) addedType = "hovercraft";
        else if (clean.includes("suv") || clean.includes("jeep")) addedType = "suv";
        else if (clean.includes("bus")) addedType = "bus";
        else if (clean.includes("spaceship")) addedType = "spaceship";
        else if (clean.includes("man") || clean.includes("male") || clean.includes("guy")) addedType = "man";
        else if (clean.includes("woman") || clean.includes("female") || clean.includes("lady")) addedType = "woman";
        else if (clean.includes("boy")) addedType = "boy";
        else if (clean.includes("girl")) addedType = "girl";
        else if (clean.includes("child") || clean.includes("kid")) addedType = Math.random() < 0.5 ? "boy" : "girl";
        else if (clean.includes("boat") || clean.includes("speedboat")) addedType = "boat";
        else if (clean.includes("skyscraper")) addedType = "skyscraper";
        else if (clean.includes("tower")) addedType = "tower";
        else if (clean.includes("pyramid")) addedType = "pyramid";
        else if (clean.includes("castle")) addedType = "castle";
        else if (clean.includes("house")) addedType = "house";
        else if (clean.includes("windmill")) addedType = "windmill";
        
        const zPos = (Math.random() - 0.5) * 1.1;
        const colors = [{ r: 0, g: 240, b: 255 }, { r: 255, g: 42, b: 42 }, { r: 255, g: 200, b: 60 }, { r: 0, g: 255, b: 80 }];
        const chosenColor = colors[Math.floor(Math.random() * colors.length)];
        
        spawnVehicle(addedType, 0, -0.22, zPos, 0.8 + Math.random() * 0.4, chosenColor, 0);
        
        speak(`Added ${addedType} to simulation grid, Sir.`);
        printSystemMessage(`[HOLO-SYSTEM]: Spawned instanced ${addedType.toUpperCase()} in newly scaled lane.`);
        return;
    }
    
    // Detect ALL distinct entity types mentioned in query using strict word boundaries to avoid substring false-positives
    const entityTypeMap = {
        "truck": "truck", "semi": "truck",
        "motorcycle": "motorcycle", "bike": "motorcycle",
        "bus": "bus",
        "suv": "suv", "jeep": "suv",
        "hovercraft": "hovercraft",
        "spaceship": "spaceship",
        "car": "car", "vehicle": "car",
        "boat": "boat", "speedboat": "boat", "ship": "boat", "yacht": "boat",
        "man": "man", "men": "man", "guy": "man", "male": "man",
        "woman": "woman", "women": "woman", "lady": "woman", "female": "woman",
        "boy": "boy", "boys": "boy",
        "girl": "girl", "girls": "girl",
        "child": "boy", "kid": "boy", "children": "boy", "kids": "boy",
        "person": "man", "human": "man", "people": "man",
        "pedestrian": "man", "walker": "man",
        "skyscraper": "skyscraper",
        "tower": "tower", "lighthouse": "tower", "obelisk": "tower",
        "pyramid": "pyramid",
        "castle": "castle", "fortress": "castle", "temple": "castle",
        "house": "house", "cottage": "house", "cabin": "house", "home": "house",
        "windmill": "windmill",
        "building": "skyscraper"
    };
    
    const foundTypes = [];
    const seenTypes = new Set();
    for (const [keyword, typeName] of Object.entries(entityTypeMap)) {
        // Match with optional plural 's' and strict word boundaries
        const regex = new RegExp("\\b" + keyword + "s?\\b", "i");
        if (regex.test(clean) && !seenTypes.has(typeName)) {
            seenTypes.add(typeName);
            foundTypes.push(typeName);
        }
    }
    
    // Advanced Index-Segmented Spatial Parser
    const matches = [];
    for (const [keyword, typeName] of Object.entries(entityTypeMap)) {
        const regex = new RegExp("\\b" + keyword + "s?\\b", "gi");
        let m;
        while ((m = regex.exec(clean)) !== null) {
            matches.push({
                index: m.index,
                length: m[0].length,
                typeName: typeName,
                keyword: keyword
            });
        }
    }
    matches.sort((a, b) => a.index - b.index);
    
    const spatialAssignments = {};
    for (let i = 0; i < matches.length; i++) {
        const curr = matches[i];
        const next = matches[i + 1];
        const startIdx = curr.index;
        const endIdx = next ? next.index : clean.length;
        const segment = clean.substring(startIdx, endIdx);
        
        if (!spatialAssignments[curr.typeName]) {
            spatialAssignments[curr.typeName] = { lane: null, z: null };
        }
        if (/\bleft\b/i.test(segment)) {
            spatialAssignments[curr.typeName].lane = 0; // Left lane
        }
        if (/\bright\b/i.test(segment)) {
            spatialAssignments[curr.typeName].lane = 2; // Right lane
        }
        if (/\b(center|middle)\b/i.test(segment)) {
            spatialAssignments[curr.typeName].lane = 1; // Center lane
            spatialAssignments[curr.typeName].z = 0;
        }
        if (/\b(front|ahead|forward)\b/i.test(segment)) {
            spatialAssignments[curr.typeName].z = 0.55;
        }
        if (/\b(back|behind|rear)\b/i.test(segment)) {
            spatialAssignments[curr.typeName].z = -0.55;
        }
    }
    
    const isEntityScenario = foundTypes.length > 0;
    
    if (isEntityScenario) {
        // Auto-enable road for any vehicle/entity scenario!
        holoSimState.envs.road = true;
        
        // Auto-set motion to translate if not already set
        if (!holoSimState.motion) {
            holoSimState.motion = "translate";
            holoSimState.speed = 1.2;
        }
        
        const colors = [
            { r: 0, g: 240, b: 255 },
            { r: 255, g: 42, b: 42 },
            { r: 255, g: 200, b: 60 },
            { r: 0, g: 255, b: 80 },
            { r: 180, g: 100, b: 255 },
            { r: 255, g: 140, b: 0 }
        ];
        
        // Detect if user explicitly requested multiple instances using word boundaries
        const multiKeywords = [
            "multiple", "highway", "traffic", "racing", "cars", "vehicles", 
            "people", "crowd", "men", "women", "boys", "girls", "kids", "children",
            "trucks", "suvs", "motorcycles", "buses", "hovercrafts", "spaceships",
            "semi-trucks", "pedestrians", "walkers", "humans"
        ];
        const isMultiRequested = multiKeywords.some(kw => {
            const regex = new RegExp("\\b" + kw + "\\b", "i");
            return regex.test(clean);
        });
        
        const isSingularOverride = /\b(a|an|one|single|only)\b/i.test(clean) || /\b(man|woman|boy|girl|child|car|truck|suv|motorcycle|bus|spaceship|hovercraft|boat|windmill|house|castle|pyramid|tower|skyscraper)\b/i.test(clean);
        const shouldBeMulti = isMultiRequested && !isSingularOverride;
        
        // Dynamic water boat conversion
        if (holoSimState.envs.water) {
            foundTypes.forEach((t, idx) => {
                if (t === "car" || t === "vehicle") {
                    foundTypes[idx] = "boat";
                }
            });
        }
        
        const numberWords = {
            "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
            "single": 1, "only": 1, "a": 1, "an": 1
        };

        const spawnList = [];
        foundTypes.forEach(typeName => {
            let quantity = 1;
            for (const [keyword, mappedName] of Object.entries(entityTypeMap)) {
                if (mappedName === typeName) {
                    const regex = new RegExp("\\b" + keyword + "s?\\b", "i");
                    const match = regex.exec(clean);
                    if (match) {
                        const preStr = clean.substring(Math.max(0, match.index - 15), match.index).trim();
                        const numMatch = preStr.match(/(\b\d+\b|\b[a-z]+\b)\s*$/i);
                        if (numMatch) {
                            const word = numMatch[1];
                            if (/^\d+$/.test(word)) {
                                quantity = parseInt(word, 10);
                            } else if (numberWords[word] !== undefined) {
                                quantity = numberWords[word];
                            }
                        }
                        break;
                    }
                }
            }
            quantity = Math.min(15, Math.max(1, quantity));
            spawnList.push({ type: typeName, quantity: quantity });
        });

        const totalItems = spawnList.reduce((sum, item) => sum + item.quantity, 0);

        if (totalItems >= 2) {
            // Multiple items requested - distribute across lanes and Z offsets
            let globalIdx = 0;
            spawnList.forEach(item => {
                const assign = spatialAssignments[item.type] || {};
                for (let q = 0; q < item.quantity; q++) {
                    const lane = assign.lane != null ? assign.lane : (globalIdx % 3);
                    const zOffset = assign.z != null 
                        ? assign.z + (q * 0.22) // add subtle offset sequence
                        : (-0.65 + (globalIdx / Math.max(1, totalItems - 1)) * 1.3);
                    
                    const color = colors[globalIdx % colors.length];
                    const speed = 0.8 + Math.random() * 0.5;
                    spawnVehicle(item.type, 0, -0.22, zOffset, speed, color, lane);
                    globalIdx++;
                }
            });
        } else if (shouldBeMulti) {
            // Single type keyword + explicit multi-scenario keyword (plural) — spawn 3 varied entities
            const primaryType = foundTypes[0];
            const assign = spatialAssignments[primaryType] || {};
            const pLane = assign.lane != null ? assign.lane : 0;
            const pZ = assign.z != null ? assign.z : -0.55;
            
            spawnVehicle(primaryType, 0, -0.22, pZ, 1.0, colors[0], pLane);
            
            let secondaryType = primaryType === "motorcycle" ? "car" : "motorcycle";
            if (primaryType === "man" || primaryType === "woman" || primaryType === "boy" || primaryType === "girl") secondaryType = primaryType === "man" ? "woman" : "man";
            spawnVehicle(secondaryType, 0, -0.22, 0, 1.15, colors[1], 1);
            
            let tertiaryType = primaryType === "truck" ? "suv" : "truck";
            if (primaryType === "man" || primaryType === "woman" || primaryType === "boy" || primaryType === "girl") tertiaryType = "boy";
            spawnVehicle(tertiaryType, 0, -0.22, 0.55, 0.85, colors[2], 2);
        } else {
            // Single entity mentioned — spawn EXACTLY one in the center lane of a 3-lane road (or spatial slot)
            const primaryType = foundTypes[0];
            const assign = spatialAssignments[primaryType] || {};
            const pLane = assign.lane != null ? assign.lane : 1;
            const pZ = assign.z != null ? assign.z : 0;
            
            spawnVehicle(primaryType, 0, -0.22, pZ, 1.0, colors[0], pLane);
        }
        
        if (holoMetaShape) {
            holoMetaShape.textContent = `VOLUMETRIC: ${foundTypes.map(t => t.toUpperCase()).join(" + ")} SIMULATION ACTIVE`;
        }
    } else {
        // Fallback to static coordinate shapes
        if (clean.includes("workshop") || clean.includes("threat") || clean.includes("dome") || clean.includes("simulation") || clean.includes("scenario") || clean.includes("iron man") || clean.includes("lab") || clean.includes("laboratory")) {
            generateHoloDefenseWorkshopScene();
        } else if (clean.includes("security") || clean.includes("audit") || clean.includes("firewall") || clean.includes("intrusion") || clean.includes("shield") || clean.includes("defense") || clean.includes("protect") || clean.includes("encrypt") || clean.includes("cyber") || clean.includes("hack")) {
            generateSecurityShieldDome();
        } else if (clean.includes("traffic") || clean.includes("road") || clean.includes("city") || clean.includes("grid") || clean.includes("map") || clean.includes("town") || clean.includes("urban") || clean.includes("street") || clean.includes("highway")) {
            generateUrbanGridMatrix();
        } else if (clean.includes("space") || clean.includes("flight") || clean.includes("rocket") || clean.includes("orbit") || clean.includes("galaxy") || clean.includes("satellite") || clean.includes("star") || clean.includes("planet") || clean.includes("solar") || clean.includes("moon") || clean.includes("cosmos") || clean.includes("nebula") || clean.includes("asteroid")) {
            generateOrbitalSystem();
        } else if (clean.includes("cup") || clean.includes("glass") || clean.includes("mug") || clean.includes("bottle") || clean.includes("bowl") || clean.includes("container") || clean.includes("drink") || clean.includes("vase") || clean.includes("pot") || clean.includes("jar") || clean.includes("chalice") || clean.includes("goblet")) {
            generateProceduralCup();
        } else if (clean.includes("sword") || clean.includes("dagger") || clean.includes("blade") || clean.includes("weapon") || clean.includes("knife") || clean.includes("spear") || clean.includes("axe") || clean.includes("hammer") || clean.includes("trident") || clean.includes("scythe") || clean.includes("katana") || clean.includes("saber")) {
            generateProceduralSword();
        } else if (clean.includes("spaceship") || clean.includes("plane") || clean.includes("jet") || clean.includes("wing") || clean.includes("aircraft") || clean.includes("ufo") || clean.includes("starship") || clean.includes("helicopter") || clean.includes("drone") || clean.includes("bomber") || clean.includes("fighter") || clean.includes("shuttle")) {
            generateProceduralSpaceship();
        } else if (clean.includes("tower") || clean.includes("building") || clean.includes("castle") || clean.includes("house") || clean.includes("bridge") || clean.includes("monument") || clean.includes("skyscraper") || clean.includes("pyramid") || clean.includes("temple") || clean.includes("church") || clean.includes("mosque") || clean.includes("palace") || clean.includes("fortress") || clean.includes("lighthouse") || clean.includes("statue")) {
            generateProceduralTower();
        } else if (clean.includes("cat") || clean.includes("dog") || clean.includes("animal") || clean.includes("lion") || clean.includes("tiger") || clean.includes("bear") || clean.includes("creature") || clean.includes("horse") || clean.includes("wolf") || clean.includes("monster") || clean.includes("dragon") || clean.includes("bird") || clean.includes("fish") || clean.includes("snake") || clean.includes("elephant") || clean.includes("dinosaur") || clean.includes("shark") || clean.includes("whale") || clean.includes("eagle") || clean.includes("spider")) {
            generateProceduralAnimal();
        } else {
            generateDynamicSuperformulaShape(query);
        }
    }
}

function generateProceduralMountain() {
    const CYAN = { r: 0, g: 240, b: 255 };
    const steps = 6;
    const size = 1.0;
    const startIdx = holoVertices.length;
    
    // Grid of vertices forming peaky ridges
    for (let i = 0; i < steps; i++) {
        const u = (i / (steps - 1) - 0.5) * size;
        for (let j = 0; j < steps; j++) {
            const v = (j / (steps - 1) - 0.5) * size;
            // Height formula to form a peak in the center
            const r = Math.sqrt(u * u + v * v);
            const height = 0.5 * Math.exp(-r * 3) * (0.8 + 0.2 * Math.cos(u * 10) * Math.sin(v * 10));
            holoVertices.push({ x: u, y: -0.48 + height, z: v, color: CYAN });
        }
    }
    // Generate grid connections
    for (let i = 0; i < steps; i++) {
        for (let j = 0; j < steps; j++) {
            const idx = startIdx + i * steps + j;
            if (i < steps - 1) holoEdges.push([idx, idx + steps]);
            if (j < steps - 1) holoEdges.push([idx, idx + 1]);
            // Cross diagonals to make it look like a high-tech triangulated digital surface!
            if (i < steps - 1 && j < steps - 1) holoEdges.push([idx, idx + steps + 1]);
        }
    }
}

function generateProceduralRiver() {
    const BLUE = { r: 0, g: 140, b: 255 };
    const steps = 6;
    const size = 1.0;
    const startIdx = holoVertices.length;
    for (let i = 0; i < steps; i++) {
        const u = (i / (steps - 1) - 0.5) * size;
        for (let j = 0; j < steps; j++) {
            const v = (j / (steps - 1) - 0.5) * size;
            holoVertices.push({
                x: u,
                y: -0.52,
                z: v,
                color: BLUE,
                isRiverGrid: true,
                origX: u,
                origZ: v
            });
        }
    }
    for (let i = 0; i < steps; i++) {
        for (let j = 0; j < steps; j++) {
            const idx = startIdx + i * steps + j;
            if (i < steps - 1) holoEdges.push([idx, idx + steps]);
            if (j < steps - 1) holoEdges.push([idx, idx + 1]);
        }
    }
}

function generateProceduralRoadBlock() {
    const GRAY = { r: 100, g: 120, b: 140 };
    const CYAN = { r: 0, g: 240, b: 255 };
    const RED = { r: 255, g: 42, b: 42 };
    
    const startIdx = holoVertices.length;
    const halfW = 0.5;
    const halfL = 0.6;
    
    // Outer corners
    holoVertices.push({ x: -halfW, y: -0.52, z: -halfL, color: GRAY }); // 0
    holoVertices.push({ x:  halfW, y: -0.52, z: -halfL, color: GRAY }); // 1
    holoVertices.push({ x:  halfW, y: -0.52, z:  halfL, color: GRAY }); // 2
    holoVertices.push({ x: -halfW, y: -0.52, z:  halfL, color: GRAY }); // 3
    
    // Curbs (slightly raised)
    holoVertices.push({ x: -halfW - 0.05, y: -0.50, z: -halfL, color: RED }); // 4
    holoVertices.push({ x: -halfW - 0.05, y: -0.50, z:  halfL, color: RED }); // 5
    holoVertices.push({ x:  halfW + 0.05, y: -0.50, z: -halfL, color: RED }); // 6
    holoVertices.push({ x:  halfW + 0.05, y: -0.50, z:  halfL, color: RED }); // 7
    
    // Dash lines in the middle
    holoVertices.push({ x: 0, y: -0.52, z: -halfL * 0.6, color: CYAN }); // 8
    holoVertices.push({ x: 0, y: -0.52, z: -halfL * 0.2, color: CYAN }); // 9
    holoVertices.push({ x: 0, y: -0.52, z:  halfL * 0.2, color: CYAN }); // 10
    holoVertices.push({ x: 0, y: -0.52, z:  halfL * 0.6, color: CYAN }); // 11
    
    // Connect outer road boundary
    holoEdges.push([startIdx, startIdx + 1]);
    holoEdges.push([startIdx + 1, startIdx + 2]);
    holoEdges.push([startIdx + 2, startIdx + 3]);
    holoEdges.push([startIdx + 3, startIdx]);
    
    // Connect curbs
    holoEdges.push([startIdx + 4, startIdx + 5]);
    holoEdges.push([startIdx + 6, startIdx + 7]);
    holoEdges.push([startIdx, startIdx + 4]);
    holoEdges.push([startIdx + 3, startIdx + 5]);
    holoEdges.push([startIdx + 1, startIdx + 6]);
    holoEdges.push([startIdx + 2, startIdx + 7]);
    
    // Center dash lines
    holoEdges.push([startIdx + 8, startIdx + 9]);
    holoEdges.push([startIdx + 10, startIdx + 11]);
}

function generateProceduralTree() {
    const GREEN = { r: 0, g: 255, b: 80 };
    const BROWN = { r: 255, g: 200, b: 60 };
    const startIdx = holoVertices.length;
    
    // Trunk (base cylinder)
    holoVertices.push({ x: 0, y: -0.48, z: 0, color: BROWN });       // 0 center base
    holoVertices.push({ x: 0, y: -0.33, z: 0, color: BROWN });       // 1 center trunk top
    
    const trunkSides = 4;
    for (let i = 0; i < trunkSides; i++) {
        const theta = (i * 2 * Math.PI) / trunkSides;
        holoVertices.push({ x: 0.05 * Math.cos(theta), y: -0.48, z: 0.05 * Math.sin(theta), color: BROWN }); // 2..5
    }
    for (let i = 0; i < trunkSides; i++) {
        holoEdges.push([startIdx, startIdx + 2 + i]);
        holoEdges.push([startIdx + 2 + i, startIdx + 2 + (i + 1) % trunkSides]);
        holoEdges.push([startIdx + 2 + i, startIdx + 1]);
    }
    
    // Foliage (stacked cones)
    const foliageRings = 3;
    
    for (let fr = 0; fr < foliageRings; fr++) {
        const ringBaseY = -0.36 + fr * 0.14;
        const ringTopY = ringBaseY + 0.22;
        const radius = 0.16 * (1.0 - fr * 0.22);
        const segs = 6;
        
        const peakIdx = holoVertices.length;
        holoVertices.push({ x: 0, y: ringTopY, z: 0, color: GREEN }); // peak
        
        const ringStart = holoVertices.length;
        for (let s = 0; s < segs; s++) {
            const a = (s * Math.PI * 2) / segs;
            holoVertices.push({ x: radius * Math.cos(a), y: ringBaseY, z: radius * Math.sin(a), color: GREEN });
        }
        
        // Connect ring neighbors and to peak
        for (let s = 0; s < segs; s++) {
            holoEdges.push([ringStart + s, ringStart + (s + 1) % segs]);
            holoEdges.push([ringStart + s, peakIdx]);
        }
    }
}

function generateProceduralCactus() {
    const GREEN = { r: 0, g: 255, b: 80 };
    const startIdx = holoVertices.length;
    
    // Main trunk
    holoVertices.push({ x: 0, y: -0.48, z: 0, color: GREEN }); // 0
    holoVertices.push({ x: 0, y: -0.22, z: 0, color: GREEN }); // 1
    holoEdges.push([startIdx, startIdx + 1]);
    
    // Left arm
    holoVertices.push({ x: -0.06, y: -0.38, z: 0, color: GREEN }); // 2
    holoVertices.push({ x: -0.06, y: -0.28, z: 0, color: GREEN }); // 3
    holoEdges.push([startIdx + 1, startIdx + 2]); // Connect to trunk
    holoEdges.push([startIdx + 2, startIdx + 3]);
    
    // Right arm
    holoVertices.push({ x: 0.06, y: -0.34, z: 0, color: GREEN }); // 4
    holoVertices.push({ x: 0.06, y: -0.24, z: 0, color: GREEN }); // 5
    holoEdges.push([startIdx + 1, startIdx + 4]); // Connect to trunk
    holoEdges.push([startIdx + 4, startIdx + 5]);
}

function generateProceduralCloud() {
    const WHITE = { r: 255, g: 255, b: 255 };
    const startIdx = holoVertices.length;
    
    // Multi-sphere wireframe puff
    const puffCenters = [
        { x: 0, y: 0.45, z: 0, r: 0.16 },
        { x: -0.15, y: 0.42, z: -0.05, r: 0.12 },
        { x: 0.15, y: 0.42, z: 0.05, r: 0.12 },
        { x: -0.05, y: 0.44, z: 0.12, r: 0.13 },
        { x: 0.05, y: 0.44, z: -0.12, r: 0.13 }
    ];
    
    puffCenters.forEach((c, puffIdx) => {
        const pStart = holoVertices.length;
        const segs = 6;
        
        // Circle in XY
        for (let i = 0; i < segs; i++) {
            const a = (i * Math.PI * 2) / segs;
            holoVertices.push({ x: c.x + c.r * Math.cos(a), y: c.y + c.r * Math.sin(a), z: c.z, color: WHITE });
            holoEdges.push([pStart + i, pStart + (i + 1) % segs]);
        }
        
        // Circle in ZY
        const pStart2 = holoVertices.length;
        for (let i = 0; i < segs; i++) {
            const a = (i * Math.PI * 2) / segs;
            holoVertices.push({ x: c.x, y: c.y + c.r * Math.sin(a), z: c.z + c.r * Math.cos(a), color: WHITE });
            holoEdges.push([pStart2 + i, pStart2 + (i + 1) % segs]);
        }
        
        // Interconnect centers slightly
        if (puffIdx > 0) {
            const parentCenterIdx = startIdx + (puffIdx - 1) * segs * 2;
            holoEdges.push([pStart, parentCenterIdx]);
        }
    });
}

function generateProceduralCar() {
    // ========================================================================
    //  SPORTS CAR — Low-profile, sleek chassis, 4 vertical torus wheels,
    //  cockpit cage, front grille, headlights, rear spoiler, dual exhaust
    // ========================================================================
    const CYAN  = { r: 0, g: 240, b: 255 };
    const RED   = { r: 255, g: 42, b: 42 };
    const WHITE = { r: 255, g: 255, b: 255 };
    const GOLD  = { r: 255, g: 200, b: 60 };

    // --- Helper: Vertical torus wheel in YZ plane (axle along X) ---
    function addWheel(cx, cy, cz, majorR, minorR, majorSegs, minorSegs) {
        const startIdx = holoVertices.length;
        for (let i = 0; i < majorSegs; i++) {
            const theta = (i * 2 * Math.PI) / majorSegs;
            for (let j = 0; j < minorSegs; j++) {
                const phi = (j * 2 * Math.PI) / minorSegs;
                // Torus in YZ plane — wheel stands upright
                const x = cx + minorR * Math.sin(phi);
                const y = cy + (majorR + minorR * Math.cos(phi)) * Math.sin(theta);
                const z = cz + (majorR + minorR * Math.cos(phi)) * Math.cos(theta);
                holoVertices.push({ x, y, z, color: WHITE, isWheel: true, axleX: cx, axleY: cy, axleZ: cz });
            }
        }
        for (let i = 0; i < majorSegs; i++) {
            const nextI = (i + 1) % majorSegs;
            for (let j = 0; j < minorSegs; j++) {
                const nextJ = (j + 1) % minorSegs;
                const cur  = startIdx + i * minorSegs + j;
                const ring = startIdx + i * minorSegs + nextJ;
                const tube = startIdx + nextI * minorSegs + j;
                holoEdges.push([cur, ring]);
                holoEdges.push([cur, tube]);
            }
        }
        // Hub + spokes
        const hubIdx = holoVertices.length;
        holoVertices.push({ x: cx, y: cy, z: cz, color: RED });
        for (let s = 0; s < 5; s++) {
            const sTheta = (s * 2 * Math.PI) / 5;
            const rimIdx = startIdx + Math.round((sTheta / (2 * Math.PI)) * majorSegs) * minorSegs;
            holoEdges.push([hubIdx, rimIdx]);
        }
        return hubIdx;
    }

    // 1. FOUR WHEELS
    const wR = 0.14, wMinR = 0.04, wMaj = 32, wMin = 16;
    const wY = -0.30;
    const hub0 = addWheel(-0.50, wY,  0.42, wR, wMinR, wMaj, wMin);
    const hub1 = addWheel( 0.50, wY,  0.42, wR, wMinR, wMaj, wMin);
    const hub2 = addWheel(-0.50, wY, -0.42, wR, wMinR, wMaj, wMin);
    const hub3 = addWheel( 0.50, wY, -0.42, wR, wMinR, wMaj, wMin);
    // Axles
    holoEdges.push([hub0, hub1]);
    holoEdges.push([hub2, hub3]);

    // 2. CHASSIS (cross-sections along Z)
    const profiles = [
        [-0.72,  0.16, -0.26, -0.20],
        [-0.52,  0.46, -0.26, -0.06],
        [-0.32,  0.50, -0.26, -0.03],
        [-0.08,  0.50, -0.26,  0.10],
        [ 0.10,  0.50, -0.26,  0.14],
        [ 0.28,  0.48, -0.26,  0.06],
        [ 0.46,  0.40, -0.26, -0.08],
        [ 0.65,  0.28, -0.23, -0.14],
        [ 0.80,  0.16, -0.20, -0.17],
    ];
    for (let s = 0; s < profiles.length; s++) {
        const [z, hw, fy, ry] = profiles[s];
        const si = holoVertices.length;
        holoVertices.push({ x: -hw, y: fy, z, color: CYAN });
        holoVertices.push({ x:  hw, y: fy, z, color: CYAN });
        holoVertices.push({ x:  hw, y: ry, z, color: CYAN });
        holoVertices.push({ x: -hw, y: ry, z, color: CYAN });
        holoEdges.push([si, si+1]); holoEdges.push([si+1, si+2]);
        holoEdges.push([si+2, si+3]); holoEdges.push([si+3, si]);
        if (s > 0) {
            const prev = si - 4;
            for (let c = 0; c < 4; c++) holoEdges.push([prev+c, si+c]);
        }
    }

    // 3. COCKPIT CAGE
    const cage = [
        [-0.06, 0.40, -0.16, 0.08],
        [ 0.06, 0.40, -0.16, 0.12],
        [ 0.18, 0.38, -0.16, 0.08],
        [ 0.26, 0.34, -0.16, 0.00],
    ];
    for (let s = 0; s < cage.length; s++) {
        const [z, hw, fy, ry] = cage[s];
        const si = holoVertices.length;
        holoVertices.push({ x: -hw, y: fy, z, color: RED });
        holoVertices.push({ x:  hw, y: fy, z, color: RED });
        holoVertices.push({ x:  hw, y: ry, z, color: RED });
        holoVertices.push({ x: -hw, y: ry, z, color: RED });
        holoEdges.push([si, si+1]); holoEdges.push([si+1, si+2]);
        holoEdges.push([si+2, si+3]); holoEdges.push([si+3, si]);
        holoEdges.push([si, si+2]); holoEdges.push([si+1, si+3]);
        if (s > 0) {
            const prev = si - 4;
            for (let c = 0; c < 4; c++) holoEdges.push([prev+c, si+c]);
        }
    }

    // 4. FRONT GRILLE + HEADLIGHTS
    const gz = 0.82;
    for (let i = 0; i < 5; i++) {
        const y = -0.21 + (i / 4) * 0.05;
        const l = holoVertices.length;
        holoVertices.push({ x: -0.14, y, z: gz, color: RED });
        holoVertices.push({ x:  0.14, y, z: gz, color: RED });
        holoEdges.push([l, l+1]);
    }
    function addHL(cx, cy, cz, r) {
        const s = holoVertices.length;
        for (let i = 0; i < 6; i++) {
            const t = (i * Math.PI * 2) / 6;
            holoVertices.push({ x: cx + r*Math.cos(t), y: cy + r*Math.sin(t), z: cz, color: GOLD });
            holoEdges.push([s+i, s+(i+1)%6]);
        }
        const ci = holoVertices.length;
        holoVertices.push({ x: cx, y: cy, z: cz, color: WHITE });
        for (let i = 0; i < 6; i++) holoEdges.push([ci, s+i]);
    }
    addHL(-0.22, -0.18, gz, 0.04);
    addHL( 0.22, -0.18, gz, 0.04);

    // 5. REAR SPOILER
    const ws = holoVertices.length;
    holoVertices.push({ x: -0.48, y: -0.04, z: -0.74, color: RED });
    holoVertices.push({ x:  0.48, y: -0.04, z: -0.74, color: RED });
    holoVertices.push({ x:  0.48, y: -0.02, z: -0.82, color: RED });
    holoVertices.push({ x: -0.48, y: -0.02, z: -0.82, color: RED });
    holoEdges.push([ws, ws+1]); holoEdges.push([ws+1, ws+2]);
    holoEdges.push([ws+2, ws+3]); holoEdges.push([ws+3, ws]);
    holoEdges.push([ws, ws+2]); holoEdges.push([ws+1, ws+3]);
    const st = holoVertices.length;
    holoVertices.push({ x: -0.20, y: -0.08, z: -0.56, color: CYAN });
    holoVertices.push({ x:  0.20, y: -0.08, z: -0.56, color: CYAN });
    holoEdges.push([st, ws]); holoEdges.push([st+1, ws+1]);

    // 6. EXHAUST PIPES
    function addExh(cx, cy, cz) {
        const s1 = holoVertices.length;
        for (let i = 0; i < 8; i++) {
            const t = (i * Math.PI * 2) / 8;
            holoVertices.push({ x: cx + 0.025*Math.cos(t), y: cy + 0.025*Math.sin(t), z: cz, color: GOLD });
            holoEdges.push([s1+i, s1+(i+1)%8]);
        }
        const s2 = holoVertices.length;
        for (let i = 0; i < 8; i++) {
            const t = (i * Math.PI * 2) / 8;
            holoVertices.push({ x: cx + 0.025*Math.cos(t), y: cy + 0.025*Math.sin(t), z: cz - 0.06, color: RED });
            holoEdges.push([s2+i, s2+(i+1)%8]);
            holoEdges.push([s1+i, s2+i]);
        }
    }
    addExh(-0.12, -0.24, -0.74);
    addExh( 0.12, -0.24, -0.74);

    // 7. SIDE SKIRTS
    let sk = holoVertices.length;
    holoVertices.push({ x: -0.50, y: -0.26, z: 0.48, color: CYAN });
    holoVertices.push({ x: -0.50, y: -0.26, z: -0.52, color: CYAN });
    holoEdges.push([sk, sk+1]);
    sk = holoVertices.length;
    holoVertices.push({ x: 0.50, y: -0.26, z: 0.48, color: CYAN });
    holoVertices.push({ x: 0.50, y: -0.26, z: -0.52, color: CYAN });
    holoEdges.push([sk, sk+1]);
}

// ============================================================================
//  TRUCK — Heavy-duty cab-over + flatbed/trailer, 6 wheels, tall exhaust stacks
// ============================================================================
function generateProceduralTruck() {
    const CYAN  = { r: 0, g: 240, b: 255 };
    const RED   = { r: 255, g: 42, b: 42 };
    const WHITE = { r: 255, g: 255, b: 255 };
    const GOLD  = { r: 255, g: 200, b: 60 };

    function addWheel(cx, cy, cz, R, r, ms, ns) {
        const si = holoVertices.length;
        for (let i = 0; i < ms; i++) {
            const t = (i * 2 * Math.PI) / ms;
            for (let j = 0; j < ns; j++) {
                const p = (j * 2 * Math.PI) / ns;
                holoVertices.push({
                    x: cx + r * Math.sin(p),
                    y: cy + (R + r * Math.cos(p)) * Math.sin(t),
                    z: cz + (R + r * Math.cos(p)) * Math.cos(t),
                    color: WHITE,
                    isWheel: true,
                    axleX: cx,
                    axleY: cy,
                    axleZ: cz
                });
            }
        }
        for (let i = 0; i < ms; i++) {
            const ni = (i+1) % ms;
            for (let j = 0; j < ns; j++) {
                const nj = (j+1) % ns;
                holoEdges.push([si + i*ns+j, si + i*ns+nj]);
                holoEdges.push([si + i*ns+j, si + ni*ns+j]);
            }
        }
        const hub = holoVertices.length;
        holoVertices.push({ x: cx, y: cy, z: cz, color: RED });
        for (let s = 0; s < 5; s++) {
            const idx = si + Math.round((s/5)*ms)*ns;
            holoEdges.push([hub, idx]);
        }
        return hub;
    }

    const wR = 0.16, wMr = 0.05, wMs = 24, wNs = 12;
    const wY = -0.42;
    // 6 wheels: 2 front, 4 rear (dual rear axle)
    const h0 = addWheel(-0.55, wY, 0.60, wR, wMr, wMs, wNs);
    const h1 = addWheel( 0.55, wY, 0.60, wR, wMr, wMs, wNs);
    const h2 = addWheel(-0.55, wY, -0.40, wR, wMr, wMs, wNs);
    const h3 = addWheel( 0.55, wY, -0.40, wR, wMr, wMs, wNs);
    const h4 = addWheel(-0.55, wY, -0.72, wR, wMr, wMs, wNs);
    const h5 = addWheel( 0.55, wY, -0.72, wR, wMr, wMs, wNs);
    holoEdges.push([h0,h1]); holoEdges.push([h2,h3]); holoEdges.push([h4,h5]);

    // CAB (front box)
    const cabSections = [
        [0.90,  0.50, -0.38, 0.30],
        [0.68,  0.52, -0.38, 0.38],
        [0.45,  0.52, -0.38, 0.40],
        [0.25,  0.52, -0.38, 0.40],
    ];
    for (let s = 0; s < cabSections.length; s++) {
        const [z, hw, fy, ry] = cabSections[s];
        const si = holoVertices.length;
        holoVertices.push({ x: -hw, y: fy, z, color: CYAN });
        holoVertices.push({ x:  hw, y: fy, z, color: CYAN });
        holoVertices.push({ x:  hw, y: ry, z, color: CYAN });
        holoVertices.push({ x: -hw, y: ry, z, color: CYAN });
        holoEdges.push([si,si+1]); holoEdges.push([si+1,si+2]);
        holoEdges.push([si+2,si+3]); holoEdges.push([si+3,si]);
        if (s > 0) { const p = si-4; for (let c=0;c<4;c++) holoEdges.push([p+c,si+c]); }
    }

    // FLATBED / TRAILER (long cargo box behind cab)
    const bedSections = [
        [ 0.20,  0.54, -0.38, 0.10],
        [-0.10,  0.54, -0.38, 0.10],
        [-0.40,  0.54, -0.38, 0.10],
        [-0.70,  0.54, -0.38, 0.10],
        [-0.95,  0.54, -0.38, 0.10],
    ];
    for (let s = 0; s < bedSections.length; s++) {
        const [z, hw, fy, ry] = bedSections[s];
        const si = holoVertices.length;
        holoVertices.push({ x: -hw, y: fy, z, color: RED });
        holoVertices.push({ x:  hw, y: fy, z, color: RED });
        holoVertices.push({ x:  hw, y: ry, z, color: RED });
        holoVertices.push({ x: -hw, y: ry, z, color: RED });
        holoEdges.push([si,si+1]); holoEdges.push([si+1,si+2]);
        holoEdges.push([si+2,si+3]); holoEdges.push([si+3,si]);
        if (s > 0) { const p = si-4; for (let c=0;c<4;c++) holoEdges.push([p+c,si+c]); }
    }

    // EXHAUST STACKS (tall vertical pipes beside cab)
    function addStack(cx, cz) {
        const pts = 6;
        for (let h = 0; h < 4; h++) {
            const y = -0.10 + h * 0.18;
            const si = holoVertices.length;
            for (let i = 0; i < pts; i++) {
                const t = (i*2*Math.PI)/pts;
                holoVertices.push({ x: cx + 0.04*Math.cos(t), y, z: cz + 0.04*Math.sin(t), color: GOLD });
                holoEdges.push([si+i, si+(i+1)%pts]);
            }
            if (h > 0) {
                const prev = si - pts;
                for (let i = 0; i < pts; i++) holoEdges.push([prev+i, si+i]);
            }
        }
    }
    addStack(-0.56, 0.40);
    addStack( 0.56, 0.40);

    // HEADLIGHTS
    function addHL(cx, cy, cz) {
        const si = holoVertices.length;
        for (let i = 0; i < 6; i++) {
            const t = (i*Math.PI*2)/6;
            holoVertices.push({ x: cx+0.05*Math.cos(t), y: cy+0.05*Math.sin(t), z: cz, color: GOLD });
            holoEdges.push([si+i, si+(i+1)%6]);
        }
    }
    addHL(-0.35, -0.20, 0.92);
    addHL( 0.35, -0.20, 0.92);
}

// ============================================================================
//  BUS — Long rectangular body, 4 wheels, window rows, destination sign
// ============================================================================
function generateProceduralBus() {
    const CYAN  = { r: 0, g: 240, b: 255 };
    const RED   = { r: 255, g: 42, b: 42 };
    const WHITE = { r: 255, g: 255, b: 255 };
    const GOLD  = { r: 255, g: 200, b: 60 };

    function addWheel(cx, cy, cz, R, r, ms, ns) {
        const si = holoVertices.length;
        for (let i = 0; i < ms; i++) {
            const t = (i*2*Math.PI)/ms;
            for (let j = 0; j < ns; j++) {
                const p = (j*2*Math.PI)/ns;
                holoVertices.push({
                    x: cx + r*Math.sin(p),
                    y: cy + (R + r*Math.cos(p))*Math.sin(t),
                    z: cz + (R + r*Math.cos(p))*Math.cos(t),
                    color: WHITE,
                    isWheel: true,
                    axleX: cx,
                    axleY: cy,
                    axleZ: cz
                });
            }
        }
        for (let i = 0; i < ms; i++) {
            const ni = (i+1)%ms;
            for (let j = 0; j < ns; j++) {
                holoEdges.push([si+i*ns+j, si+i*ns+(j+1)%ns]);
                holoEdges.push([si+i*ns+j, si+ni*ns+j]);
            }
        }
        const hub = holoVertices.length;
        holoVertices.push({ x: cx, y: cy, z: cz, color: RED });
        for (let s = 0; s < 5; s++) holoEdges.push([hub, si+Math.round((s/5)*ms)*ns]);
        return hub;
    }

    const wY = -0.40;
    const hub0 = addWheel(-0.42, wY,  0.70, 0.14, 0.04, 24, 12);
    const hub1 = addWheel( 0.42, wY,  0.70, 0.14, 0.04, 24, 12);
    const hub2 = addWheel(-0.42, wY, -0.70, 0.14, 0.04, 24, 12);
    const hub3 = addWheel( 0.42, wY, -0.70, 0.14, 0.04, 24, 12);
    holoEdges.push([hub0,hub1]); holoEdges.push([hub2,hub3]);

    // BODY (tall rectangular sections along Z)
    const sections = [
        [-0.95, 0.40, -0.36, 0.30],
        [-0.60, 0.40, -0.36, 0.30],
        [-0.25, 0.40, -0.36, 0.30],
        [ 0.10, 0.40, -0.36, 0.30],
        [ 0.45, 0.40, -0.36, 0.30],
        [ 0.80, 0.40, -0.36, 0.30],
        [ 0.98, 0.38, -0.34, 0.28],
    ];
    for (let s = 0; s < sections.length; s++) {
        const [z, hw, fy, ry] = sections[s];
        const si = holoVertices.length;
        holoVertices.push({ x: -hw, y: fy, z, color: CYAN });
        holoVertices.push({ x:  hw, y: fy, z, color: CYAN });
        holoVertices.push({ x:  hw, y: ry, z, color: CYAN });
        holoVertices.push({ x: -hw, y: ry, z, color: CYAN });
        holoEdges.push([si,si+1]); holoEdges.push([si+1,si+2]);
        holoEdges.push([si+2,si+3]); holoEdges.push([si+3,si]);
        if (s > 0) { const p = si-4; for (let c=0;c<4;c++) holoEdges.push([p+c,si+c]); }
    }

    // WINDOW ROWS (rectangular windows along both sides)
    for (let side = -1; side <= 1; side += 2) {
        const sx = side * 0.41;
        for (let w = 0; w < 6; w++) {
            const zc = -0.80 + w * 0.30;
            const wi = holoVertices.length;
            holoVertices.push({ x: sx, y: -0.05, z: zc, color: GOLD });
            holoVertices.push({ x: sx, y:  0.18, z: zc, color: GOLD });
            holoVertices.push({ x: sx, y:  0.18, z: zc + 0.20, color: GOLD });
            holoVertices.push({ x: sx, y: -0.05, z: zc + 0.20, color: GOLD });
            holoEdges.push([wi,wi+1]); holoEdges.push([wi+1,wi+2]);
            holoEdges.push([wi+2,wi+3]); holoEdges.push([wi+3,wi]);
        }
    }

    // DESTINATION SIGN (front top)
    const di = holoVertices.length;
    holoVertices.push({ x: -0.25, y: 0.22, z: 1.00, color: RED });
    holoVertices.push({ x:  0.25, y: 0.22, z: 1.00, color: RED });
    holoVertices.push({ x:  0.25, y: 0.30, z: 1.00, color: RED });
    holoVertices.push({ x: -0.25, y: 0.30, z: 1.00, color: RED });
    holoEdges.push([di,di+1]); holoEdges.push([di+1,di+2]);
    holoEdges.push([di+2,di+3]); holoEdges.push([di+3,di]);

    // DOOR (left side, near front)
    const dr = holoVertices.length;
    holoVertices.push({ x: -0.41, y: -0.36, z: 0.65, color: RED });
    holoVertices.push({ x: -0.41, y:  0.15, z: 0.65, color: RED });
    holoVertices.push({ x: -0.41, y:  0.15, z: 0.85, color: RED });
    holoVertices.push({ x: -0.41, y: -0.36, z: 0.85, color: RED });
    holoEdges.push([dr,dr+1]); holoEdges.push([dr+1,dr+2]);
    holoEdges.push([dr+2,dr+3]); holoEdges.push([dr+3,dr]);

    // HEADLIGHTS
    function addHL(cx, cy, cz) {
        const s = holoVertices.length;
        for (let i = 0; i < 6; i++) {
            const t = (i*Math.PI*2)/6;
            holoVertices.push({ x: cx+0.04*Math.cos(t), y: cy+0.04*Math.sin(t), z: cz, color: GOLD });
            holoEdges.push([s+i, s+(i+1)%6]);
        }
    }
    addHL(-0.28, -0.18, 1.00);
    addHL( 0.28, -0.18, 1.00);
}

// ============================================================================
//  MOTORCYCLE — 2 vertical wheels, tubular frame, handlebars, seat, exhaust pipe
// ============================================================================
function generateProceduralMotorcycle() {
    const CYAN  = { r: 0, g: 240, b: 255 };
    const RED   = { r: 255, g: 42, b: 42 };
    const WHITE = { r: 255, g: 255, b: 255 };
    const GOLD  = { r: 255, g: 200, b: 60 };

    // Vertical wheel (YZ plane, axle along X, but motorcycle wheels are inline along Z)
    // For a motorcycle the wheels are in the XY plane with axle along Z... actually
    // motorcycle viewed from side: wheels are circles in XY, bike goes along Z.
    // So wheel torus in XY plane with axle along Z:
    function addWheel(cx, cy, cz, R, r, ms, ns) {
        const si = holoVertices.length;
        for (let i = 0; i < ms; i++) {
            const t = (i*2*Math.PI)/ms;
            for (let j = 0; j < ns; j++) {
                const p = (j*2*Math.PI)/ns;
                // Torus in YZ plane — wheel stands upright, axle along X
                holoVertices.push({
                    x: cx + r*Math.sin(p),
                    y: cy + (R + r*Math.cos(p))*Math.sin(t),
                    z: cz + (R + r*Math.cos(p))*Math.cos(t),
                    color: WHITE,
                    isWheel: true,
                    axleX: cx,
                    axleY: cy,
                    axleZ: cz
                });
            }
        }
        for (let i = 0; i < ms; i++) {
            const ni = (i+1)%ms;
            for (let j = 0; j < ns; j++) {
                holoEdges.push([si+i*ns+j, si+i*ns+(j+1)%ns]);
                holoEdges.push([si+i*ns+j, si+ni*ns+j]);
            }
        }
        const hub = holoVertices.length;
        holoVertices.push({ x: cx, y: cy, z: cz, color: RED });
        for (let s = 0; s < 6; s++) holoEdges.push([hub, si+Math.round((s/6)*ms)*ns]);
        return hub;
    }

    const wY = -0.35;
    const hubF = addWheel(0, wY,  0.55, 0.20, 0.04, 24, 12);  // Front wheel
    const hubR = addWheel(0, wY, -0.50, 0.22, 0.05, 24, 12);  // Rear wheel (slightly bigger)

    // FRAME — main tube structure connecting wheels
    // Steering head (top of front fork)
    const frame = holoVertices.length;
    holoVertices.push({ x: 0, y: -0.08, z:  0.42, color: CYAN }); // 0 steering head
    holoVertices.push({ x: 0, y: -0.05, z:  0.15, color: CYAN }); // 1 top tube front
    holoVertices.push({ x: 0, y: -0.10, z: -0.10, color: CYAN }); // 2 top tube mid
    holoVertices.push({ x: 0, y: -0.15, z: -0.35, color: CYAN }); // 3 seat post
    holoVertices.push({ x: 0, y: -0.35, z: -0.40, color: CYAN }); // 4 rear axle mount
    holoVertices.push({ x: 0, y: -0.28, z:  0.10, color: CYAN }); // 5 bottom tube
    holoVertices.push({ x: 0, y: -0.35, z:  0.45, color: CYAN }); // 6 front fork bottom

    // Frame connections
    holoEdges.push([frame, frame+6]);    // Front fork
    holoEdges.push([frame, frame+1]);    // Steering head to top tube
    holoEdges.push([frame+1, frame+2]);  // Top tube
    holoEdges.push([frame+2, frame+3]);  // To seat
    holoEdges.push([frame+3, frame+4]);  // Seat to rear
    holoEdges.push([frame+5, frame+6]);  // Bottom tube to fork
    holoEdges.push([frame+1, frame+5]);  // Down tube
    holoEdges.push([frame+5, frame+4]);  // Bottom to rear
    holoEdges.push([frame+2, frame+5]);  // Cross brace

    // Connect frame to wheel hubs
    holoEdges.push([frame+6, hubF]);     // Fork to front hub
    holoEdges.push([frame+4, hubR]);     // Rear mount to rear hub

    // ENGINE BLOCK (under top tube)
    const eng = holoVertices.length;
    const eHW = 0.08;
    holoVertices.push({ x: -eHW, y: -0.15, z:  0.05, color: RED });
    holoVertices.push({ x:  eHW, y: -0.15, z:  0.05, color: RED });
    holoVertices.push({ x:  eHW, y: -0.28, z:  0.05, color: RED });
    holoVertices.push({ x: -eHW, y: -0.28, z:  0.05, color: RED });
    holoVertices.push({ x: -eHW, y: -0.15, z: -0.12, color: RED });
    holoVertices.push({ x:  eHW, y: -0.15, z: -0.12, color: RED });
    holoVertices.push({ x:  eHW, y: -0.28, z: -0.12, color: RED });
    holoVertices.push({ x: -eHW, y: -0.28, z: -0.12, color: RED });
    // Front face
    holoEdges.push([eng,eng+1]); holoEdges.push([eng+1,eng+2]);
    holoEdges.push([eng+2,eng+3]); holoEdges.push([eng+3,eng]);
    // Back face
    holoEdges.push([eng+4,eng+5]); holoEdges.push([eng+5,eng+6]);
    holoEdges.push([eng+6,eng+7]); holoEdges.push([eng+7,eng+4]);
    // Connections
    for (let i = 0; i < 4; i++) holoEdges.push([eng+i, eng+4+i]);

    // HANDLEBARS
    const hb = holoVertices.length;
    holoVertices.push({ x: -0.22, y: -0.02, z: 0.38, color: GOLD });
    holoVertices.push({ x:  0,    y: -0.06, z: 0.40, color: GOLD });
    holoVertices.push({ x:  0.22, y: -0.02, z: 0.38, color: GOLD });
    holoEdges.push([hb, hb+1]); holoEdges.push([hb+1, hb+2]);
    holoEdges.push([hb+1, frame]); // Connect to steering head

    // SEAT (flat pad on top)
    const seat = holoVertices.length;
    holoVertices.push({ x: -0.06, y: -0.10, z: -0.05, color: RED });
    holoVertices.push({ x:  0.06, y: -0.10, z: -0.05, color: RED });
    holoVertices.push({ x:  0.05, y: -0.13, z: -0.30, color: RED });
    holoVertices.push({ x: -0.05, y: -0.13, z: -0.30, color: RED });
    holoEdges.push([seat,seat+1]); holoEdges.push([seat+1,seat+2]);
    holoEdges.push([seat+2,seat+3]); holoEdges.push([seat+3,seat]);

    // EXHAUST PIPE (along right side, curves down from engine to rear)
    const exh = holoVertices.length;
    holoVertices.push({ x: 0.10, y: -0.26, z:  0.02, color: GOLD });
    holoVertices.push({ x: 0.12, y: -0.30, z: -0.15, color: GOLD });
    holoVertices.push({ x: 0.12, y: -0.28, z: -0.30, color: GOLD });
    holoVertices.push({ x: 0.10, y: -0.25, z: -0.45, color: GOLD });
    holoEdges.push([exh,exh+1]); holoEdges.push([exh+1,exh+2]); holoEdges.push([exh+2,exh+3]);
    // Exhaust tip ring
    const tip = holoVertices.length;
    for (let i = 0; i < 6; i++) {
        const t = (i*Math.PI*2)/6;
        holoVertices.push({ x: 0.10+0.03*Math.cos(t), y: -0.25+0.03*Math.sin(t), z: -0.47, color: GOLD });
        holoEdges.push([tip+i, tip+(i+1)%6]);
    }

    // FENDERS (arcs over each wheel)
    function addFender(cz, R) {
        const pts = 8;
        const fsi = holoVertices.length;
        for (let i = 0; i < pts; i++) {
            const a = Math.PI * 0.15 + (i/(pts-1)) * Math.PI * 0.7;
            holoVertices.push({
                x: 0, y: wY + R * Math.sin(a) * 1.15, z: cz + R * Math.cos(a),
                color: CYAN
            });
            if (i > 0) holoEdges.push([fsi+i-1, fsi+i]);
        }
    }
    addFender(0.55, 0.24);   // Front fender
    addFender(-0.50, 0.26);  // Rear fender

    // HEADLIGHT
    const hl = holoVertices.length;
    for (let i = 0; i < 8; i++) {
        const t = (i*Math.PI*2)/8;
        holoVertices.push({ x: 0.045*Math.cos(t), y: -0.06+0.045*Math.sin(t), z: 0.60, color: GOLD });
        holoEdges.push([hl+i, hl+(i+1)%8]);
    }
    const hlc = holoVertices.length;
    holoVertices.push({ x: 0, y: -0.06, z: 0.60, color: WHITE });
    for (let i = 0; i < 8; i++) holoEdges.push([hlc, hl+i]);
}

// ============================================================================
//  SUV / VAN — Tall boxy body, 4 wheels, roof rack, bull bar, running boards
// ============================================================================
function generateProceduralSUV() {
    const CYAN  = { r: 0, g: 240, b: 255 };
    const RED   = { r: 255, g: 42, b: 42 };
    const WHITE = { r: 255, g: 255, b: 255 };
    const GOLD  = { r: 255, g: 200, b: 60 };

    function addWheel(cx, cy, cz, R, r, ms, ns) {
        const si = holoVertices.length;
        for (let i = 0; i < ms; i++) {
            const t = (i*2*Math.PI)/ms;
            for (let j = 0; j < ns; j++) {
                const p = (j*2*Math.PI)/ns;
                holoVertices.push({
                    x: cx + r*Math.sin(p),
                    y: cy + (R + r*Math.cos(p))*Math.sin(t),
                    z: cz + (R + r*Math.cos(p))*Math.cos(t),
                    color: WHITE,
                    isWheel: true,
                    axleX: cx,
                    axleY: cy,
                    axleZ: cz
                });
            }
        }
        for (let i = 0; i < ms; i++) {
            const ni = (i+1)%ms;
            for (let j = 0; j < ns; j++) {
                holoEdges.push([si+i*ns+j, si+i*ns+(j+1)%ns]);
                holoEdges.push([si+i*ns+j, si+ni*ns+j]);
            }
        }
        const hub = holoVertices.length;
        holoVertices.push({ x: cx, y: cy, z: cz, color: RED });
        for (let s = 0; s < 5; s++) holoEdges.push([hub, si+Math.round((s/5)*ms)*ns]);
        return hub;
    }

    const wY = -0.38;
    const hub0 = addWheel(-0.48, wY,  0.48, 0.15, 0.045, 24, 12);
    const hub1 = addWheel( 0.48, wY,  0.48, 0.15, 0.045, 24, 12);
    const hub2 = addWheel(-0.48, wY, -0.48, 0.15, 0.045, 24, 12);
    const hub3 = addWheel( 0.48, wY, -0.48, 0.15, 0.045, 24, 12);
    holoEdges.push([hub0,hub1]); holoEdges.push([hub2,hub3]);

    // TALL BOXY BODY
    const sections = [
        [-0.72,  0.44, -0.34, 0.30],
        [-0.45,  0.48, -0.34, 0.32],
        [-0.15,  0.48, -0.34, 0.32],
        [ 0.15,  0.48, -0.34, 0.32],
        [ 0.40,  0.46, -0.34, 0.28],
        [ 0.60,  0.40, -0.32, 0.18],
        [ 0.78,  0.32, -0.28, 0.10],
    ];
    for (let s = 0; s < sections.length; s++) {
        const [z, hw, fy, ry] = sections[s];
        const si = holoVertices.length;
        holoVertices.push({ x: -hw, y: fy, z, color: CYAN });
        holoVertices.push({ x:  hw, y: fy, z, color: CYAN });
        holoVertices.push({ x:  hw, y: ry, z, color: CYAN });
        holoVertices.push({ x: -hw, y: ry, z, color: CYAN });
        holoEdges.push([si,si+1]); holoEdges.push([si+1,si+2]);
        holoEdges.push([si+2,si+3]); holoEdges.push([si+3,si]);
        if (s > 0) { const p = si-4; for (let c=0;c<4;c++) holoEdges.push([p+c,si+c]); }
    }

    // ROOF RACK (rectangle on top)
    const rr = holoVertices.length;
    holoVertices.push({ x: -0.38, y: 0.34, z: -0.55, color: RED });
    holoVertices.push({ x:  0.38, y: 0.34, z: -0.55, color: RED });
    holoVertices.push({ x:  0.38, y: 0.34, z:  0.20, color: RED });
    holoVertices.push({ x: -0.38, y: 0.34, z:  0.20, color: RED });
    holoEdges.push([rr,rr+1]); holoEdges.push([rr+1,rr+2]);
    holoEdges.push([rr+2,rr+3]); holoEdges.push([rr+3,rr]);
    // Cross bars
    for (let i = 0; i < 3; i++) {
        const z = -0.40 + i * 0.30;
        const ci = holoVertices.length;
        holoVertices.push({ x: -0.38, y: 0.34, z, color: RED });
        holoVertices.push({ x:  0.38, y: 0.34, z, color: RED });
        holoEdges.push([ci, ci+1]);
    }

    // BULL BAR (front protection bars)
    const bb = holoVertices.length;
    holoVertices.push({ x: -0.35, y: -0.30, z: 0.82, color: RED });
    holoVertices.push({ x:  0.35, y: -0.30, z: 0.82, color: RED });
    holoVertices.push({ x:  0.35, y: -0.10, z: 0.82, color: RED });
    holoVertices.push({ x: -0.35, y: -0.10, z: 0.82, color: RED });
    holoEdges.push([bb,bb+1]); holoEdges.push([bb+1,bb+2]);
    holoEdges.push([bb+2,bb+3]); holoEdges.push([bb+3,bb]);
    // Middle bar
    const bm = holoVertices.length;
    holoVertices.push({ x: -0.35, y: -0.20, z: 0.82, color: RED });
    holoVertices.push({ x:  0.35, y: -0.20, z: 0.82, color: RED });
    holoEdges.push([bm, bm+1]);

    // RUNNING BOARDS (side steps)
    for (let side = -1; side <= 1; side += 2) {
        const sx = side * 0.49;
        const rb = holoVertices.length;
        holoVertices.push({ x: sx, y: -0.34, z: -0.40, color: GOLD });
        holoVertices.push({ x: sx, y: -0.34, z:  0.40, color: GOLD });
        holoEdges.push([rb, rb+1]);
    }

    // HEADLIGHTS
    function addHL(cx, cy, cz) {
        const s = holoVertices.length;
        for (let i = 0; i < 6; i++) {
            const t = (i*Math.PI*2)/6;
            holoVertices.push({ x: cx+0.04*Math.cos(t), y: cy+0.04*Math.sin(t), z: cz, color: GOLD });
            holoEdges.push([s+i, s+(i+1)%6]);
        }
    }
    addHL(-0.24, -0.14, 0.80);
    addHL( 0.24, -0.14, 0.80);

    // SPARE TIRE (on rear door)
    const spare = holoVertices.length;
    for (let i = 0; i < 12; i++) {
        const t = (i*Math.PI*2)/12;
        holoVertices.push({ x: 0.12*Math.cos(t), y: -0.08+0.12*Math.sin(t), z: -0.74, color: WHITE });
        holoEdges.push([spare+i, spare+(i+1)%12]);
    }
    const sc = holoVertices.length;
    holoVertices.push({ x: 0, y: -0.08, z: -0.74, color: RED });
    for (let i = 0; i < 6; i++) holoEdges.push([sc, spare+i*2]);
}

function generateProceduralCup() {
    const R = 0.65;
    const stepsTheta = 16;
    const stepsHeight = 8;
    
    // Cylindrical walls
    for (let j = 0; j < stepsHeight; j++) {
        const y = -0.5 + (j / (stepsHeight - 1)) * 1.0; 
        for (let i = 0; i < stepsTheta; i++) {
            const theta = (i * 2 * Math.PI) / stepsTheta;
            const x = R * Math.cos(theta);
            const z = R * Math.sin(theta);
            
            holoVertices.push({
                x, y, z,
                color: { r: 0, g: 240, b: 255 } 
            });
        }
    }
    
    // Base disc
    const rOffset = holoVertices.length;
    for (let r = 0; r <= 3; r++) {
        const radius = (r / 3) * R;
        for (let i = 0; i < stepsTheta; i++) {
            const theta = (i * 2 * Math.PI) / stepsTheta;
            const x = radius * Math.cos(theta);
            const z = radius * Math.sin(theta);
            const y = -0.5;
            
            holoVertices.push({
                x, y, z,
                color: { r: 0, g: 240, b: 255 }
            });
        }
    }
    
    // Handle
    const handleOffset = holoVertices.length;
    const handlePoints = 10;
    for (let i = 0; i < handlePoints; i++) {
        const alpha = -Math.PI / 2 + (i / (handlePoints - 1)) * Math.PI; 
        const x = R + 0.3 * Math.cos(alpha);
        const y = 0.4 * Math.sin(alpha);
        const z = 0;
        
        holoVertices.push({
            x, y, z,
            color: { r: 255, g: 42, b: 42 } 
        });
    }
    
    // Connect Edges
    for (let j = 0; j < stepsHeight; j++) {
        for (let i = 0; i < stepsTheta; i++) {
            const cur = j * stepsTheta + i;
            const nextTheta = j * stepsTheta + ((i + 1) % stepsTheta);
            holoEdges.push([cur, nextTheta]);
            
            if (j < stepsHeight - 1) {
                const nextY = (j + 1) * stepsTheta + i;
                holoEdges.push([cur, nextY]);
            }
        }
    }
    
    for (let r = 0; r <= 3; r++) {
        for (let i = 0; i < stepsTheta; i++) {
            const cur = rOffset + r * stepsTheta + i;
            const nextTheta = rOffset + r * stepsTheta + ((i + 1) % stepsTheta);
            holoEdges.push([cur, nextTheta]);
            
            if (r < 3) {
                const nextRad = rOffset + (r + 1) * stepsTheta + i;
                holoEdges.push([cur, nextRad]);
            }
        }
    }
    
    for (let i = 0; i < handlePoints - 1; i++) {
        holoEdges.push([handleOffset + i, handleOffset + i + 1]);
    }
    const topCupIdx = (stepsHeight - 2) * stepsTheta;
    const bottomCupIdx = 1 * stepsTheta;
    holoEdges.push([handleOffset, bottomCupIdx]);
    holoEdges.push([handleOffset + handlePoints - 1, topCupIdx]);
}

function generateProceduralSword() {
    const stepsBlade = 10;
    const wMax = 0.12;
    for (let j = 0; j < stepsBlade; j++) {
        const y = -0.2 + (j / (stepsBlade - 1)) * 1.4; 
        const taper = 1.0 - (j / (stepsBlade - 1)); 
        const w = wMax * taper;
        
        const idx = holoVertices.length;
        holoVertices.push({ x: -w, y, z: 0, color: { r: 0, g: 240, b: 255 } }); 
        holoVertices.push({ x: w, y, z: 0, color: { r: 0, g: 240, b: 255 } });  
        holoVertices.push({ x: 0, y, z: 0.02 * taper, color: { r: 255, g: 255, b: 255 } }); 
        holoVertices.push({ x: 0, y, z: -0.02 * taper, color: { r: 255, g: 255, b: 255 } }); 
        
        holoEdges.push([idx, idx + 2]);
        holoEdges.push([idx + 2, idx + 1]);
        holoEdges.push([idx + 1, idx + 3]);
        holoEdges.push([idx + 3, idx]);
        
        if (j > 0) {
            const prev = idx - 4;
            holoEdges.push([prev, idx]);
            holoEdges.push([prev + 1, idx + 1]);
            holoEdges.push([prev + 2, idx + 2]);
            holoEdges.push([prev + 3, idx + 3]);
        }
    }
    
    const guardStart = holoVertices.length;
    const guardPoints = 7;
    for (let i = 0; i < guardPoints; i++) {
        const x = -0.3 + (i / (guardPoints - 1)) * 0.6; 
        holoVertices.push({
            x, y: -0.2, z: 0,
            color: { r: 255, g: 42, b: 42 } 
        });
        
        if (i > 0) {
            holoEdges.push([guardStart + i - 1, guardStart + i]);
        }
    }
    
    const handleStart = holoVertices.length;
    const handlePoints = 5;
    for (let i = 0; i < handlePoints; i++) {
        const y = -0.25 - (i / (handlePoints - 1)) * 0.35; 
        const ptsOffset = holoVertices.length;
        for (let th = 0; th < 6; th++) {
            const theta = (th * 2 * Math.PI) / 6;
            const x = 0.04 * Math.cos(theta);
            const z = 0.04 * Math.sin(theta);
            
            holoVertices.push({
                x, y, z,
                color: { r: 255, g: 255, b: 255 } 
            });
            
            const cur = ptsOffset + th;
            const nxt = ptsOffset + ((th + 1) % 6);
            holoEdges.push([cur, nxt]);
            
            if (i > 0) {
                const prev = cur - 6;
                holoEdges.push([prev, cur]);
            }
        }
    }
    
    const pommelStart = holoVertices.length;
    const pommelPoints = 6;
    for (let i = 0; i < pommelPoints; i++) {
        const theta = (i * 2 * Math.PI) / pommelPoints;
        const x = 0.07 * Math.cos(theta);
        const z = 0.07 * Math.sin(theta);
        const y = -0.63;
        
        holoVertices.push({
            x, y, z,
            color: { r: 255, g: 42, b: 42 } 
        });
        
        const cur = pommelStart + i;
        const nxt = pommelStart + ((i + 1) % pommelPoints);
        holoEdges.push([cur, nxt]);
        
        const gripBottomOffset = handleStart + (handlePoints - 1) * 6;
        holoEdges.push([cur, gripBottomOffset + (i % 6)]);
    }
}

function generateProceduralSpaceship() {
    const stepsFuse = 12;
    for (let j = 0; j < stepsFuse; j++) {
        const z = -0.9 + (j / (stepsFuse - 1)) * 1.8; 
        let r = 0.16;
        if (z > 0.3) {
            r = 0.16 * (1.0 - (z - 0.3) / 0.6); 
        } else if (z < -0.4) {
            r = 0.16 * (1.0 - (-0.4 - z) / 1.0 * 0.3); 
        }
        
        const offset = holoVertices.length;
        for (let i = 0; i < 8; i++) {
            const theta = (i * 2 * Math.PI) / 8;
            const x = r * Math.cos(theta);
            const y = r * Math.sin(theta);
            
            holoVertices.push({
                x, y, z,
                color: { r: 0, g: 240, b: 255 } 
            });
            
            const cur = offset + i;
            const nxt = offset + ((i + 1) % 8);
            holoEdges.push([cur, nxt]);
            
            if (j > 0) {
                const prev = cur - 8;
                holoEdges.push([prev, cur]);
            }
        }
    }
    
    const wingStart = holoVertices.length;
    holoVertices.push({ x: -0.15, y: 0, z: 0.1, color: { r: 255, g: 42, b: 42 } }); 
    holoVertices.push({ x: -1.1, y: -0.05, z: -0.5, color: { r: 255, g: 42, b: 42 } }); 
    holoVertices.push({ x: -0.15, y: 0, z: -0.6, color: { r: 255, g: 42, b: 42 } }); 
    
    holoVertices.push({ x: 0.15, y: 0, z: 0.1, color: { r: 255, g: 42, b: 42 } });
    holoVertices.push({ x: 1.1, y: -0.05, z: -0.5, color: { r: 255, g: 42, b: 42 } });
    holoVertices.push({ x: 0.15, y: 0, z: -0.6, color: { r: 255, g: 42, b: 42 } });
    
    holoEdges.push([wingStart, wingStart + 1]);
    holoEdges.push([wingStart + 1, wingStart + 2]);
    holoEdges.push([wingStart + 2, wingStart]);
    
    holoEdges.push([wingStart + 3, wingStart + 4]);
    holoEdges.push([wingStart + 4, wingStart + 5]);
    holoEdges.push([wingStart + 5, wingStart + 3]);
    
    const tailStart = holoVertices.length;
    holoVertices.push({ x: 0, y: 0.15, z: -0.3, color: { r: 255, g: 255, b: 255 } }); 
    holoVertices.push({ x: 0, y: 0.6, z: -0.85, color: { r: 255, g: 255, b: 255 } });  
    holoVertices.push({ x: 0, y: 0.15, z: -0.8, color: { r: 255, g: 255, b: 255 } });  
    
    holoEdges.push([tailStart, tailStart + 1]);
    holoEdges.push([tailStart + 1, tailStart + 2]);
    holoEdges.push([tailStart + 2, tailStart]);
}

function generateProceduralTower() {
    const stepsTower = 8;
    const hMax = 1.3;
    const hMin = -0.7;
    const wBase = 0.45;
    
    for (let j = 0; j < stepsTower; j++) {
        const y = hMin + (j / (stepsTower - 1)) * (hMax - hMin); 
        const taper = 1.0 - (j / (stepsTower - 1)); 
        const w = wBase * taper;
        
        const offset = holoVertices.length;
        holoVertices.push({ x: -w, y, z: -w, color: { r: 0, g: 240, b: 255 } });
        holoVertices.push({ x: w, y, z: -w, color: { r: 0, g: 240, b: 255 } });
        holoVertices.push({ x: w, y, z: w, color: { r: 0, g: 240, b: 255 } });
        holoVertices.push({ x: -w, y, z: w, color: { r: 0, g: 240, b: 255 } });
        
        holoEdges.push([offset, offset + 1]);
        holoEdges.push([offset + 1, offset + 2]);
        holoEdges.push([offset + 2, offset + 3]);
        holoEdges.push([offset + 3, offset]);
        
        if (j > 0) {
            const prev = offset - 4;
            holoEdges.push([prev, offset]);
            holoEdges.push([prev + 1, offset + 1]);
            holoEdges.push([prev + 2, offset + 2]);
            holoEdges.push([prev + 3, offset + 3]);
            
            holoEdges.push([prev, offset + 1]);
            holoEdges.push([prev + 1, offset]);
            holoEdges.push([prev + 2, offset + 3]);
            holoEdges.push([prev + 3, offset + 2]);
        }
    }
    
    const topPtIdx = holoVertices.length;
    holoVertices.push({ x: 0, y: 1.6, z: 0, color: { r: 255, g: 42, b: 42 } });
    
    const topmostSquare = (stepsTower - 1) * 4;
    holoEdges.push([topPtIdx, topmostSquare]);
    holoEdges.push([topPtIdx, topmostSquare + 1]);
    holoEdges.push([topPtIdx, topmostSquare + 2]);
    holoEdges.push([topPtIdx, topmostSquare + 3]);
}

function generateProceduralAnimal() {
    const stepsTorso = 6;
    for (let j = 0; j < stepsTorso; j++) {
        const z = -0.45 + (j / (stepsTorso - 1)) * 0.9; 
        const offset = holoVertices.length;
        for (let i = 0; i < 5; i++) {
            const theta = (i * 2 * Math.PI) / 5;
            const x = 0.15 * Math.cos(theta);
            const y = 0.15 * Math.sin(theta) + 0.05; 
            
            holoVertices.push({
                x, y, z,
                color: { r: 0, g: 240, b: 255 }
            });
            
            const cur = offset + i;
            const nxt = offset + ((i + 1) % 5);
            holoEdges.push([cur, nxt]);
            
            if (j > 0) {
                const prev = cur - 5;
                holoEdges.push([prev, cur]);
            }
        }
    }
    
    const legStart = holoVertices.length;
    holoVertices.push({ x: -0.15, y: -0.2, z: -0.4, color: { r: 255, g: 42, b: 42 } });
    holoVertices.push({ x: -0.15, y: -0.6, z: -0.4, color: { r: 255, g: 42, b: 42 } });
    
    holoVertices.push({ x: 0.15, y: -0.2, z: -0.4, color: { r: 255, g: 42, b: 42 } });
    holoVertices.push({ x: 0.15, y: -0.6, z: -0.4, color: { r: 255, g: 42, b: 42 } });
    
    holoVertices.push({ x: -0.15, y: -0.2, z: 0.4, color: { r: 255, g: 42, b: 42 } });
    holoVertices.push({ x: -0.15, y: -0.6, z: 0.4, color: { r: 255, g: 42, b: 42 } });
    
    holoVertices.push({ x: 0.15, y: -0.2, z: 0.4, color: { r: 255, g: 42, b: 42 } });
    holoVertices.push({ x: 0.15, y: -0.6, z: 0.4, color: { r: 255, g: 42, b: 42 } });
    
    for (let i = 0; i < 4; i++) {
        holoEdges.push([legStart + i * 2, legStart + i * 2 + 1]);
    }
    
    const neckStart = holoVertices.length;
    holoVertices.push({ x: 0, y: 0.25, z: 0.48, color: { r: 255, g: 255, b: 255 } }); 
    holoVertices.push({ x: 0, y: 0.45, z: 0.6, color: { r: 255, g: 255, b: 255 } });  
    holoVertices.push({ x: 0, y: 0.4, z: 0.72, color: { r: 255, g: 255, b: 255 } });  
    
    holoEdges.push([neckStart, neckStart + 1]);
    holoEdges.push([neckStart + 1, neckStart + 2]);
    
    const tailStart = holoVertices.length;
    holoVertices.push({ x: 0, y: 0.15, z: -0.45, color: { r: 255, g: 255, b: 255 } }); 
    holoVertices.push({ x: 0, y: -0.2, z: -0.75, color: { r: 255, g: 255, b: 255 } }); 
    
    holoEdges.push([tailStart, tailStart + 1]);
}

function generateProceduralHovercraft() {
    const CYAN  = { r: 0, g: 240, b: 255 };
    const RED   = { r: 255, g: 42, b: 42 };
    const WHITE = { r: 255, g: 255, b: 255 };
    const GOLD  = { r: 255, g: 200, b: 60 };

    // 1. Skirt Base (wide horizontal oval in XZ plane)
    const skirtStart = holoVertices.length;
    const skirtPts = 24;
    const sW = 0.55; 
    const sL = 0.85; 
    const sH = -0.32; 
    for (let i = 0; i < skirtPts; i++) {
        const theta = (i * 2 * Math.PI) / skirtPts;
        holoVertices.push({
            x: sW * Math.cos(theta),
            y: sH + Math.sin(theta * 3) * 0.02, 
            z: sL * Math.sin(theta),
            color: CYAN
        });
        holoEdges.push([skirtStart + i, skirtStart + (i + 1) % skirtPts]);
    }
    
    // 2. Sleek Cockpit Cabin
    const cabinStart = holoVertices.length;
    const cabinSections = [
        [0.65, 0.15, 0.14, sH],     
        [0.35, 0.28, 0.22, sH + 0.05], 
        [0.0,  0.30, 0.28, sH + 0.08], 
        [-0.35, 0.26, 0.25, sH + 0.08], 
        [-0.68, 0.18, 0.15, sH]      
    ];
    for (let s = 0; s < cabinSections.length; s++) {
        const [z, hw, fy, ry] = cabinSections[s];
        const si = holoVertices.length;
        holoVertices.push({ x: -hw, y: fy, z, color: RED });
        holoVertices.push({ x:  hw, y: fy, z, color: RED });
        holoVertices.push({ x:  hw, y: ry, z, color: RED });
        holoVertices.push({ x: -hw, y: ry, z, color: RED });
        
        holoEdges.push([si, si+1]); holoEdges.push([si+1, si+2]);
        holoEdges.push([si+2, si+3]); holoEdges.push([si+3, si]);
        
        if (s > 0) {
            const prev = si - 4;
            for (let c = 0; c < 4; c++) holoEdges.push([prev+c, si+c]);
        }
    }

    // 3. Two Large Thruster Fans at the back
    function addThruster(cx, cy, cz, rad) {
        const tStart = holoVertices.length;
        const pts = 12;
        for (let i = 0; i < pts; i++) {
            const theta = (i * 2 * Math.PI) / pts;
            holoVertices.push({
                x: cx + rad * Math.cos(theta),
                y: cy + rad * Math.sin(theta),
                z: cz,
                color: GOLD
            });
            holoEdges.push([tStart + i, tStart + (i + 1) % pts]);
        }
        const center = holoVertices.length;
        holoVertices.push({ x: cx, y: cy, z: cz, color: WHITE });
        for (let i = 0; i < pts; i += 3) {
            holoEdges.push([center, tStart + i]);
        }
    }
    addThruster(-0.25, sH + 0.18, -0.72, 0.18);
    addThruster( 0.25, sH + 0.18, -0.72, 0.18);

    // 4. Side Wing Flaps
    const wingStart = holoVertices.length;
    holoVertices.push({ x: -sW, y: sH, z: 0.15, color: CYAN });
    holoVertices.push({ x: -sW - 0.35, y: sH + 0.05, z: -0.32, color: CYAN });
    holoVertices.push({ x: -sW, y: sH, z: -0.45, color: CYAN });
    holoEdges.push([wingStart, wingStart + 1]);
    holoEdges.push([wingStart + 1, wingStart + 2]);
    holoEdges.push([wingStart + 2, wingStart]);

    holoVertices.push({ x: sW, y: sH, z: 0.15, color: CYAN });
    holoVertices.push({ x: sW + 0.35, y: sH + 0.05, z: -0.32, color: CYAN });
    holoVertices.push({ x: sW, y: sH, z: -0.45, color: CYAN });
    holoEdges.push([wingStart + 3, wingStart + 4]);
    holoEdges.push([wingStart + 4, wingStart + 5]);
    holoEdges.push([wingStart + 5, wingStart + 3]);
}

function generateDynamicSuperformulaShape(query) {
    let charSum = 0;
    for (let i = 0; i < query.length; i++) {
        charSum += query.charCodeAt(i);
    }
    
    const m1 = (charSum % 6) + 3;  
    const m2 = ((charSum >> 2) % 4) + 2; 
    
    const n1 = 1.0;
    const n2 = 1.0;
    const n3 = 1.0;
    
    const stepsTheta = 20;
    const stepsPhi = 10;
    const a = 1.0, b = 1.0;
    
    for (let j = 0; j <= stepsPhi; j++) {
        const phi = -Math.PI / 2 + (j / stepsPhi) * Math.PI; 
        
        const term2_1 = Math.pow(Math.abs(Math.cos(m2 * phi / 4) / a), n2);
        const term2_2 = Math.pow(Math.abs(Math.sin(m2 * phi / 4) / b), n3);
        const r2 = Math.pow(term2_1 + term2_2, -1 / n1);
        
        for (let i = 0; i < stepsTheta; i++) {
            const theta = -Math.PI + (i / stepsTheta) * 2 * Math.PI; 
            
            const term1_1 = Math.pow(Math.abs(Math.cos(m1 * theta / 4) / a), n2);
            const term1_2 = Math.pow(Math.abs(Math.sin(m1 * theta / 4) / b), n3);
            const r1 = Math.pow(term1_1 + term1_2, -1 / n1);
            
            const x = r1 * Math.cos(theta) * r2 * Math.cos(phi) * 0.65;
            const y = r1 * Math.sin(theta) * r2 * Math.cos(phi) * 0.65;
            const z = r2 * Math.sin(phi) * 0.65;
            
            const isRed = (i + j) % 2 === 0;
            const color = isRed ? { r: 255, g: 42, b: 42 } : { r: 0, g: 240, b: 255 };
            
            holoVertices.push({ x, y, z, color });
        }
    }
    
    for (let j = 0; j <= stepsPhi; j++) {
        for (let i = 0; i < stepsTheta; i++) {
            const current = j * stepsTheta + i;
            const nextTheta = j * stepsTheta + ((i + 1) % stepsTheta);
            
            holoEdges.push([current, nextTheta]);
            
            if (j < stepsPhi) {
                const nextPhi = (j + 1) * stepsTheta + i;
                holoEdges.push([current, nextPhi]);
            }
        }
    }
}

function generateSecurityShieldDome() {
    const R = 1.0;
    const rings = 6;
    const sectors = 12;
    
    // Hemispherical dome mesh (phi from 0 to pi/2)
    for (let r = 0; r <= rings; r++) {
        const phi = (r * Math.PI) / (2 * rings); 
        for (let s = 0; s < sectors; s++) {
            const theta = (s * 2 * Math.PI) / sectors;
            
            const x = R * Math.sin(phi) * Math.cos(theta);
            const y = R * Math.cos(phi) - 0.4; 
            const z = R * Math.sin(phi) * Math.sin(theta);
            
            holoVertices.push({
                x, y, z,
                color: { r: 255, g: 42, b: 42 } // Stark protective red
            });
        }
    }
    
    for (let r = 0; r < rings; r++) {
        for (let s = 0; s < sectors; s++) {
            const current = r * sectors + s;
            const nextSector = r * sectors + ((s + 1) % sectors);
            const nextRing = (r + 1) * sectors + s;
            
            holoEdges.push([current, nextSector]);
            holoEdges.push([current, nextRing]);
        }
    }
    
    // Add central core database node (bright white core)
    const coreIdx = holoVertices.length;
    holoVertices.push({
        x: 0, y: -0.4, z: 0,
        color: { r: 255, g: 255, b: 255 }
    });
    
    // Glowing inner concentric defense ring
    const ringPts = 16;
    const rOffset = holoVertices.length;
    for (let i = 0; i < ringPts; i++) {
        const theta = (i * 2 * Math.PI) / ringPts;
        const rx = 0.45 * Math.cos(theta);
        const rz = 0.45 * Math.sin(theta);
        
        holoVertices.push({
            x: rx, y: -0.4, z: rz,
            color: { r: 0, g: 240, b: 255 } // Secure cyan orbits
        });
        
        const cur = rOffset + i;
        const nxt = rOffset + ((i + 1) % ringPts);
        holoEdges.push([cur, nxt]);
        
        if (i % 4 === 0) {
            holoEdges.push([cur, coreIdx]);
        }
    }
}

function generateUrbanGridMatrix() {
    const size = 0.9;
    const steps = 4;
    const spacing = (size * 2) / (steps - 1);
    
    // Grid nodes in Y plane
    const gridStartIdx = holoVertices.length;
    for (let i = 0; i < steps; i++) {
        const x = -size + i * spacing;
        for (let j = 0; j < steps; j++) {
            const z = -size + j * spacing;
            const y = -0.3 + (Math.sin(i * 1.5) * Math.cos(j * 1.5)) * 0.08;
            
            holoVertices.push({
                x, y, z,
                color: { r: 0, g: 240, b: 255 } // street grid nodes
            });
        }
    }
    
    // Street links
    for (let i = 0; i < steps; i++) {
        for (let j = 0; j < steps; j++) {
            const cur = gridStartIdx + i * steps + j;
            if (i < steps - 1) {
                const nextX = gridStartIdx + (i + 1) * steps + j;
                holoEdges.push([cur, nextX]);
            }
            if (j < steps - 1) {
                const nextZ = gridStartIdx + i * steps + (j + 1);
                holoEdges.push([cur, nextZ]);
            }
        }
    }
    
    // Skyscrapers vertical beacons rising from street corners
    const skyscraperJunctions = [0, 3, 5, 10, 12, 15];
    skyscraperJunctions.forEach(jIdx => {
        const basePt = holoVertices[gridStartIdx + jIdx];
        const height = 0.5 + Math.random() * 0.4;
        const towerPts = 3;
        
        let prevIdx = gridStartIdx + jIdx;
        for (let t = 1; t <= towerPts; t++) {
            const ty = basePt.y + (t / towerPts) * height;
            holoVertices.push({
                x: basePt.x, y: ty, z: basePt.z,
                color: { r: 255, g: 42, b: 42 } 
            });
            const curIdx = holoVertices.length - 1;
            holoEdges.push([prevIdx, curIdx]);
            prevIdx = curIdx;
        }
    });
}

function generateOrbitalSystem() {
    const sphereRadius = 0.45;
    const spRings = 6;
    const spSectors = 10;
    const baseOffset = holoVertices.length;
    
    // Planet sphere
    for (let r = 0; r <= spRings; r++) {
        const phi = (r * Math.PI) / spRings;
        for (let s = 0; s < spSectors; s++) {
            const theta = (s * 2 * Math.PI) / spSectors;
            
            const x = sphereRadius * Math.sin(phi) * Math.cos(theta);
            const y = sphereRadius * Math.cos(phi);
            const z = sphereRadius * Math.sin(phi) * Math.sin(theta);
            
            holoVertices.push({
                x, y, z,
                color: { r: 0, g: 240, b: 255 }
            });
        }
    }
    
    for (let r = 0; r < spRings; r++) {
        for (let s = 0; s < spSectors; s++) {
            const current = baseOffset + r * spSectors + s;
            const nextSector = baseOffset + r * spSectors + ((s + 1) % spSectors);
            const nextRing = baseOffset + (r + 1) * spSectors + s;
            
            holoEdges.push([current, nextSector]);
            if (r < spRings) {
                holoEdges.push([current, nextRing]);
            }
        }
    }
    
    // Tilted Orbital satellite path
    const ringPts = 24;
    const ringRadius = 1.15;
    const tilt = 0.45; 
    const ringOffset = holoVertices.length;
    
    for (let i = 0; i < ringPts; i++) {
        const theta = (i * 2 * Math.PI) / ringPts;
        
        const rx = ringRadius * Math.cos(theta);
        const ry = ringRadius * Math.sin(theta) * Math.sin(tilt);
        const rz = ringRadius * Math.sin(theta) * Math.cos(tilt);
        
        holoVertices.push({
            x: rx, y: ry, z: rz,
            color: { r: 255, g: 42, b: 42 } 
        });
        
        const cur = ringOffset + i;
        const nxt = ringOffset + ((i + 1) % ringPts);
        holoEdges.push([cur, nxt]);
    }
    
    // Interactive orbiting sat nodes
    const satelliteCount = 2;
    for (let s = 0; s < satelliteCount; s++) {
        const satAngle = (s * Math.PI) + 0.5;
        const sx = 1.25 * Math.cos(satAngle);
        const sy = 1.25 * Math.sin(satAngle) * Math.sin(-tilt * 0.8);
        const sz = 1.25 * Math.sin(satAngle) * Math.cos(-tilt * 0.8);
        
        holoVertices.push({
            x: sx, y: sy, z: sz,
            color: { r: 255, g: 255, b: 255 } 
        });
    }
}

function generateQuantumSpiralGalaxy(seedText) {
    const seed = seedText.length || 10;
    const numArms = 2;
    const particlesPerArm = 50;
    const maxRadius = 1.2;
    
    let charSum = 0;
    for (let i = 0; i < seedText.length; i++) {
        charSum += seedText.charCodeAt(i);
    }
    const twistFactor = 1.8 + (charSum % 5) * 0.45;
    
    for (let a = 0; a < numArms; a++) {
        const armOffset = (a * 2 * Math.PI) / numArms;
        
        for (let p = 0; p < particlesPerArm; p++) {
            const progress = p / (particlesPerArm - 1);
            const radius = progress * maxRadius;
            const theta = progress * twistFactor + armOffset;
            
            const x = radius * Math.cos(theta);
            const y = Math.sin(progress * Math.PI * 2) * 0.08;
            const z = radius * Math.sin(theta);
            
            const color = progress < 0.45 ? { r: 255, g: 255, b: 255 } : 
                          (a % 2 === 0 ? { r: 255, g: 42, b: 42 } : { r: 0, g: 240, b: 255 });
            
            holoVertices.push({ x, y, z, color });
            
            const curIdx = holoVertices.length - 1;
            if (p > 0) {
                holoEdges.push([curIdx - 1, curIdx]);
            }
        }
    }
}

function generateHoloDefenseWorkshopScene() {
    activeHoloShape = "hologram scenario";
    holoVertices = [];
    holoEdges = [];
    
    if (holoMetaShape) {
        holoMetaShape.textContent = `MATRIX ACTIVE: WORKSHOP SCENARIO`;
    }

    // 1. Outer Spherical Protective Dome Grid (R = 1.3)
    const outDomeR = 1.3;
    const outDomeRings = 6;
    const outDomeSectors = 12;
    const outDomeOffset = holoVertices.length;
    
    for (let r = 0; r <= outDomeRings; r++) {
        const phi = (r * Math.PI) / (2 * outDomeRings); 
        for (let s = 0; s < outDomeSectors; s++) {
            const theta = (s * 2 * Math.PI) / outDomeSectors;
            
            const x = outDomeR * Math.sin(phi) * Math.cos(theta);
            const y = outDomeR * Math.cos(phi) - 0.6; 
            const z = outDomeR * Math.sin(phi) * Math.sin(theta);
            
            holoVertices.push({
                x, y, z,
                color: { r: 0, g: 240, b: 255 } 
            });
        }
    }
    
    for (let r = 0; r < outDomeRings; r++) {
        for (let s = 0; s < outDomeSectors; s++) {
            const current = outDomeOffset + r * outDomeSectors + s;
            const nextSector = outDomeOffset + r * outDomeSectors + ((s + 1) % outDomeSectors);
            const nextRing = outDomeOffset + (r + 1) * outDomeSectors + s;
            
            holoEdges.push([current, nextSector]);
            holoEdges.push([current, nextRing]);
        }
    }

    // 2. Inner Spherical Concentric Shield Dome (R = 0.95)
    const inDomeR = 0.95;
    const inDomeRings = 4;
    const inDomeSectors = 10;
    const inDomeOffset = holoVertices.length;
    
    for (let r = 0; r <= inDomeRings; r++) {
        const phi = (r * Math.PI) / (2 * inDomeRings); 
        for (let s = 0; s < inDomeSectors; s++) {
            const theta = (s * 2 * Math.PI) / inDomeSectors;
            
            const x = inDomeR * Math.sin(phi) * Math.cos(theta);
            const y = inDomeR * Math.cos(phi) - 0.6; 
            const z = inDomeR * Math.sin(phi) * Math.sin(theta);
            
            const color = r % 2 === 0 ? { r: 255, g: 42, b: 42 } : { r: 0, g: 240, b: 255 };
            
            holoVertices.push({ x, y, z, color });
        }
    }
    
    for (let r = 0; r < inDomeRings; r++) {
        for (let s = 0; s < inDomeSectors; s++) {
            const current = inDomeOffset + r * inDomeSectors + s;
            const nextSector = inDomeOffset + r * inDomeSectors + ((s + 1) % inDomeSectors);
            const nextRing = inDomeOffset + (r + 1) * inDomeSectors + s;
            
            holoEdges.push([current, nextSector]);
            holoEdges.push([current, nextRing]);
        }
    }

    // 3. Flat Concentric Pedestal Base Rings (Y = -0.6)
    const baseRings = [0.6, 1.15];
    baseRings.forEach(br => {
        const brOffset = holoVertices.length;
        const brPts = 16;
        for (let i = 0; i < brPts; i++) {
            const theta = (i * 2 * Math.PI) / brPts;
            const x = br * Math.cos(theta);
            const y = -0.6;
            const z = br * Math.sin(theta);
            
            holoVertices.push({
                x, y, z,
                color: { r: 0, g: 240, b: 255 }
            });
            
            const cur = brOffset + i;
            const nxt = brOffset + ((i + 1) % brPts);
            holoEdges.push([cur, nxt]);
        }
    });

    // 4. Three 3D Humanoid Dotted Figures standing inside the Dome (glowing white)
    const figureOffsets = [
        { dx: -0.4, dz: 0.1, color: { r: 255, g: 255, b: 255 } }, 
        { dx: 0.0, dz: -0.25, color: { r: 255, g: 255, b: 255 } },
        { dx: 0.4, dz: 0.1, color: { r: 255, g: 255, b: 255 } }
    ];
    
    figureOffsets.forEach(fig => {
        const fOffset = holoVertices.length;
        
        // Head
        const headR = 0.07;
        const headY = 0.25;
        for (let i = 0; i < 8; i++) {
            const theta = (i * 2 * Math.PI) / 8;
            const x = fig.dx + headR * Math.cos(theta);
            const y = headY + headR * Math.sin(theta);
            const z = fig.dz;
            holoVertices.push({ x, y, z, color: fig.color });
            
            const cur = fOffset + i;
            const nxt = fOffset + ((i + 1) % 8);
            holoEdges.push([cur, nxt]);
        }
        
        // Torso
        const torsoStart = holoVertices.length;
        holoVertices.push({ x: fig.dx, y: 0.18, z: fig.dz, color: fig.color }); 
        holoVertices.push({ x: fig.dx, y: -0.05, z: fig.dz, color: fig.color }); 
        holoVertices.push({ x: fig.dx, y: -0.22, z: fig.dz, color: fig.color }); 
        holoEdges.push([torsoStart, torsoStart + 1]);
        holoEdges.push([torsoStart + 1, torsoStart + 2]);
        holoEdges.push([fOffset + 6, torsoStart]); 
        
        // Raised Left Arm
        const armL = holoVertices.length;
        holoVertices.push({ x: fig.dx - 0.14, y: 0.1, z: fig.dz + 0.05, color: fig.color }); 
        holoVertices.push({ x: fig.dx - 0.22, y: 0.22, z: fig.dz + 0.1, color: fig.color }); 
        holoEdges.push([torsoStart, armL]); 
        holoEdges.push([armL, armL + 1]);  
        
        // Raised Right Arm
        const armR = holoVertices.length;
        holoVertices.push({ x: fig.dx + 0.14, y: 0.1, z: fig.dz - 0.05, color: fig.color }); 
        holoVertices.push({ x: fig.dx + 0.22, y: 0.22, z: fig.dz - 0.1, color: fig.color }); 
        holoEdges.push([torsoStart, armR]); 
        holoEdges.push([armR, armR + 1]);  
        
        // Left Leg
        const legL = holoVertices.length;
        holoVertices.push({ x: fig.dx - 0.1, y: -0.4, z: fig.dz + 0.05, color: fig.color }); 
        holoVertices.push({ x: fig.dx - 0.15, y: -0.6, z: fig.dz + 0.08, color: fig.color }); 
        holoEdges.push([torsoStart + 2, legL]); 
        holoEdges.push([legL, legL + 1]); 
        
        // Right Leg
        const legR = holoVertices.length;
        holoVertices.push({ x: fig.dx + 0.1, y: -0.4, z: fig.dz - 0.05, color: fig.color }); 
        holoVertices.push({ x: fig.dx + 0.15, y: -0.6, z: fig.dz - 0.08, color: fig.color }); 
        holoEdges.push([torsoStart + 2, legR]); 
        holoEdges.push([legR, legR + 1]); 
    });

    // 5. One Simplified 3D Blueprint Car (Audi R8 style) sitting on the side
    const carOffset = holoVertices.length;
    const cx = 0.75;
    const cz = 0.45;
    
    // Bottom chassis
    holoVertices.push({ x: cx - 0.35, y: -0.55, z: cz - 0.15, color: { r: 0, g: 240, b: 255 } }); 
    holoVertices.push({ x: cx + 0.35, y: -0.55, z: cz - 0.15, color: { r: 0, g: 240, b: 255 } }); 
    holoVertices.push({ x: cx + 0.35, y: -0.55, z: cz + 0.15, color: { r: 0, g: 240, b: 255 } }); 
    holoVertices.push({ x: cx - 0.35, y: -0.55, z: cz + 0.15, color: { r: 0, g: 240, b: 255 } }); 
    
    holoEdges.push([carOffset + 0, carOffset + 1]);
    holoEdges.push([carOffset + 1, carOffset + 2]);
    holoEdges.push([carOffset + 2, carOffset + 3]);
    holoEdges.push([carOffset + 3, carOffset + 0]);
    
    // Upper Cabin
    holoVertices.push({ x: cx - 0.18, y: -0.4, z: cz - 0.12, color: { r: 0, g: 240, b: 255 } });  
    holoVertices.push({ x: cx + 0.12, y: -0.4, z: cz - 0.12, color: { r: 0, g: 240, b: 255 } });  
    holoVertices.push({ x: cx + 0.12, y: -0.4, z: cz + 0.12, color: { r: 0, g: 240, b: 255 } });  
    holoVertices.push({ x: cx - 0.18, y: -0.4, z: cz + 0.12, color: { r: 0, g: 240, b: 255 } });  
    
    holoEdges.push([carOffset + 4, carOffset + 5]);
    holoEdges.push([carOffset + 5, carOffset + 6]);
    holoEdges.push([carOffset + 6, carOffset + 7]);
    holoEdges.push([carOffset + 7, carOffset + 4]);
    
    // Windshield & Pillar links
    holoEdges.push([carOffset + 0, carOffset + 4]); 
    holoEdges.push([carOffset + 3, carOffset + 7]);
    holoEdges.push([carOffset + 1, carOffset + 5]); 
    holoEdges.push([carOffset + 2, carOffset + 6]);
}

// ========================================================================
// PROCEDURAL HUMAN FIGURES — Wireframe Holographic People
// Coordinate convention: +Y = UP (head), -Y = DOWN (feet/ground)
// Same as vehicles where wheels are at y≈-0.30 and roof is at y≈+0.14
// ========================================================================

function generateProceduralHumanMale() {
    const CYAN = { r: 0, g: 240, b: 255 };
    const RED  = { r: 255, g: 42, b: 42 };
    const WHITE = { r: 255, g: 255, b: 255 };
    const b = holoVertices.length;
    
    // --- HEAD (octagonal wireframe sphere at top) ---
    const headCY = 0.28; // head center Y (top)
    const headR = 0.055;
    // Equator ring (8 vertices)
    for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI * 2) / 8;
        holoVertices.push({ x: headR * Math.cos(a), y: headCY, z: headR * Math.sin(a), color: CYAN });
    }
    holoVertices.push({ x: 0, y: headCY + headR * 0.85, z: 0, color: WHITE }); // 8 = crown
    holoVertices.push({ x: 0, y: headCY - headR * 0.6, z: 0, color: CYAN });   // 9 = chin
    for (let i = 0; i < 8; i++) { holoEdges.push([b + i, b + (i + 1) % 8]); }
    for (let i = 0; i < 8; i++) { holoEdges.push([b + i, b + 8]); holoEdges.push([b + i, b + 9]); }
    
    // --- NECK ---
    holoVertices.push({ x: 0, y: headCY - headR * 1.3, z: 0, color: CYAN }); // 10 = neck base
    holoEdges.push([b + 9, b + 10]);
    
    // --- SHOULDERS ---
    const shoulderY = 0.12;
    holoVertices.push({ x: -0.12, y: shoulderY, z: 0, color: CYAN }); // 11 = left shoulder
    holoVertices.push({ x:  0.12, y: shoulderY, z: 0, color: CYAN }); // 12 = right shoulder
    holoEdges.push([b + 10, b + 11]); holoEdges.push([b + 10, b + 12]);
    holoEdges.push([b + 11, b + 12]);
    
    // --- TORSO (broader for male) ---
    const chestY = 0.04;
    const waistY = -0.06;
    const hipY = -0.12;
    holoVertices.push({ x: -0.11, y: chestY, z: 0.02, color: CYAN }); // 13 left chest
    holoVertices.push({ x:  0.11, y: chestY, z: 0.02, color: CYAN }); // 14 right chest
    holoVertices.push({ x: -0.10, y: waistY, z: 0, color: CYAN });    // 15 left waist
    holoVertices.push({ x:  0.10, y: waistY, z: 0, color: CYAN });    // 16 right waist
    holoVertices.push({ x: -0.09, y: hipY, z: 0, color: RED });       // 17 left hip
    holoVertices.push({ x:  0.09, y: hipY, z: 0, color: RED });       // 18 right hip
    holoEdges.push([b + 11, b + 13]); holoEdges.push([b + 12, b + 14]);
    holoEdges.push([b + 13, b + 14]);
    holoEdges.push([b + 13, b + 15]); holoEdges.push([b + 14, b + 16]);
    holoEdges.push([b + 15, b + 16]);
    holoEdges.push([b + 15, b + 17]); holoEdges.push([b + 16, b + 18]);
    holoEdges.push([b + 17, b + 18]);
    // Cross-struts (rib cage)
    holoEdges.push([b + 11, b + 14]); holoEdges.push([b + 12, b + 13]);
    // Spine
    holoVertices.push({ x: 0, y: chestY, z: 0, color: CYAN }); // 19 spine mid
    holoVertices.push({ x: 0, y: hipY, z: 0, color: CYAN });   // 20 pelvis
    holoEdges.push([b + 10, b + 19]); holoEdges.push([b + 19, b + 20]);
    
    // --- LEFT ARM (limb-animated) ---
    const elbowY = 0.01;
    const handY = -0.10;
    holoVertices.push({ x: -0.19, y: elbowY, z: 0, color: CYAN,
        isLimb: true, limbSide: 'left', limbType: 'arm', pivotX: -0.12, pivotY: shoulderY, pivotZ: 0 }); // 21
    holoVertices.push({ x: -0.21, y: handY, z: 0, color: RED,
        isLimb: true, limbSide: 'left', limbType: 'arm', pivotX: -0.12, pivotY: shoulderY, pivotZ: 0 }); // 22
    holoEdges.push([b + 11, b + 21]); holoEdges.push([b + 21, b + 22]);
    
    // --- RIGHT ARM (limb-animated) ---
    holoVertices.push({ x: 0.19, y: elbowY, z: 0, color: CYAN,
        isLimb: true, limbSide: 'right', limbType: 'arm', pivotX: 0.12, pivotY: shoulderY, pivotZ: 0 }); // 23
    holoVertices.push({ x: 0.21, y: handY, z: 0, color: RED,
        isLimb: true, limbSide: 'right', limbType: 'arm', pivotX: 0.12, pivotY: shoulderY, pivotZ: 0 }); // 24
    holoEdges.push([b + 12, b + 23]); holoEdges.push([b + 23, b + 24]);
    
    // --- LEFT LEG (limb-animated) ---
    const kneeY = -0.24;
    const footY = -0.35;
    holoVertices.push({ x: -0.06, y: kneeY, z: 0, color: CYAN,
        isLimb: true, limbSide: 'left', limbType: 'leg', pivotX: -0.09, pivotY: hipY, pivotZ: 0 }); // 25
    holoVertices.push({ x: -0.06, y: footY, z: 0, color: RED,
        isLimb: true, limbSide: 'left', limbType: 'leg', pivotX: -0.09, pivotY: hipY, pivotZ: 0 }); // 26
    holoEdges.push([b + 17, b + 25]); holoEdges.push([b + 25, b + 26]);
    // Foot
    holoVertices.push({ x: -0.06, y: footY, z: 0.04, color: CYAN,
        isLimb: true, limbSide: 'left', limbType: 'leg', pivotX: -0.09, pivotY: hipY, pivotZ: 0 }); // 27
    holoEdges.push([b + 26, b + 27]);
    
    // --- RIGHT LEG (limb-animated) ---
    holoVertices.push({ x: 0.06, y: kneeY, z: 0, color: CYAN,
        isLimb: true, limbSide: 'right', limbType: 'leg', pivotX: 0.09, pivotY: hipY, pivotZ: 0 }); // 28
    holoVertices.push({ x: 0.06, y: footY, z: 0, color: RED,
        isLimb: true, limbSide: 'right', limbType: 'leg', pivotX: 0.09, pivotY: hipY, pivotZ: 0 }); // 29
    holoEdges.push([b + 18, b + 28]); holoEdges.push([b + 28, b + 29]);
    // Foot
    holoVertices.push({ x: 0.06, y: footY, z: 0.04, color: CYAN,
        isLimb: true, limbSide: 'right', limbType: 'leg', pivotX: 0.09, pivotY: hipY, pivotZ: 0 }); // 30
    holoEdges.push([b + 29, b + 30]);
}

function generateProceduralHumanFemale() {
    const PINK   = { r: 255, g: 100, b: 200 };
    const MAGENTA = { r: 255, g: 42, b: 120 };
    const WHITE  = { r: 255, g: 255, b: 255 };
    const b = holoVertices.length;
    
    // --- HEAD (rounder, 10-sided) ---
    const headCY = 0.26;
    const headR = 0.05;
    for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI * 2) / 10;
        holoVertices.push({ x: headR * Math.cos(a), y: headCY, z: headR * Math.sin(a), color: PINK });
    }
    holoVertices.push({ x: 0, y: headCY + headR * 0.9, z: 0, color: WHITE }); // 10 = crown
    holoVertices.push({ x: 0, y: headCY - headR * 0.55, z: 0, color: PINK }); // 11 = chin
    for (let i = 0; i < 10; i++) { holoEdges.push([b + i, b + (i + 1) % 10]); }
    for (let i = 0; i < 10; i++) { holoEdges.push([b + i, b + 10]); holoEdges.push([b + i, b + 11]); }
    
    // --- HAIR (flowing strands down the back, 4 strands) ---
    holoVertices.push({ x: -0.04, y: 0.10, z: -0.04, color: MAGENTA }); // 12
    holoVertices.push({ x:  0.04, y: 0.10, z: -0.04, color: MAGENTA }); // 13
    holoVertices.push({ x: -0.06, y: 0.02, z: -0.05, color: MAGENTA }); // 14
    holoVertices.push({ x:  0.06, y: 0.02, z: -0.05, color: MAGENTA }); // 15
    holoEdges.push([b + 7, b + 12]); holoEdges.push([b + 3, b + 13]);
    holoEdges.push([b + 12, b + 14]); holoEdges.push([b + 13, b + 15]);
    
    // --- NECK ---
    holoVertices.push({ x: 0, y: headCY - headR * 1.2, z: 0, color: PINK }); // 16
    holoEdges.push([b + 11, b + 16]);
    
    // --- SHOULDERS (narrower) ---
    const shoulderY = 0.11;
    holoVertices.push({ x: -0.10, y: shoulderY, z: 0, color: PINK }); // 17
    holoVertices.push({ x:  0.10, y: shoulderY, z: 0, color: PINK }); // 18
    holoEdges.push([b + 16, b + 17]); holoEdges.push([b + 16, b + 18]);
    holoEdges.push([b + 17, b + 18]);
    
    // --- TORSO (hourglass waist) ---
    const bustY = 0.04;
    const waistY = -0.04;
    const hipY = -0.11;
    holoVertices.push({ x: -0.10, y: bustY, z: 0.02, color: PINK });    // 19
    holoVertices.push({ x:  0.10, y: bustY, z: 0.02, color: PINK });    // 20
    holoVertices.push({ x: -0.07, y: waistY, z: 0, color: MAGENTA });   // 21
    holoVertices.push({ x:  0.07, y: waistY, z: 0, color: MAGENTA });   // 22
    holoVertices.push({ x: -0.10, y: hipY, z: 0, color: PINK });        // 23
    holoVertices.push({ x:  0.10, y: hipY, z: 0, color: PINK });        // 24
    holoEdges.push([b + 17, b + 19]); holoEdges.push([b + 18, b + 20]);
    holoEdges.push([b + 19, b + 20]);
    holoEdges.push([b + 19, b + 21]); holoEdges.push([b + 20, b + 22]);
    holoEdges.push([b + 21, b + 22]);
    holoEdges.push([b + 21, b + 23]); holoEdges.push([b + 22, b + 24]);
    holoEdges.push([b + 23, b + 24]);
    // Spine
    holoVertices.push({ x: 0, y: waistY, z: 0, color: PINK }); // 25
    holoVertices.push({ x: 0, y: hipY, z: 0, color: PINK });   // 26
    holoEdges.push([b + 16, b + 25]); holoEdges.push([b + 25, b + 26]);
    
    // --- SKIRT / DRESS (flared ring below hips, 10-sided) ---
    const skirtTopY = hipY - 0.02;
    const skirtBotY = hipY - 0.12;
    const skirtTopR = 0.12;
    const skirtBotR = 0.18;
    const skTop = holoVertices.length; // 27+
    for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI * 2) / 10;
        holoVertices.push({ x: skirtTopR * Math.cos(a), y: skirtTopY, z: skirtTopR * Math.sin(a), color: MAGENTA });
    }
    const skBot = holoVertices.length; // 37+
    for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI * 2) / 10;
        holoVertices.push({ x: skirtBotR * Math.cos(a), y: skirtBotY, z: skirtBotR * Math.sin(a), color: MAGENTA });
    }
    for (let i = 0; i < 10; i++) {
        holoEdges.push([skTop + i, skTop + (i + 1) % 10]); // top ring
        holoEdges.push([skBot + i, skBot + (i + 1) % 10]); // bottom ring
        holoEdges.push([skTop + i, skBot + i]);             // vertical struts
    }
    holoEdges.push([b + 23, skTop + 5]); holoEdges.push([b + 24, skTop + 0]); // connect hips to skirt
    
    // --- LEFT ARM ---
    const elbowY = 0.01;
    const handY = -0.08;
    holoVertices.push({ x: -0.17, y: elbowY, z: 0, color: PINK,
        isLimb: true, limbSide: 'left', limbType: 'arm', pivotX: -0.10, pivotY: shoulderY, pivotZ: 0 }); // skBot+10
    holoVertices.push({ x: -0.19, y: handY, z: 0, color: MAGENTA,
        isLimb: true, limbSide: 'left', limbType: 'arm', pivotX: -0.10, pivotY: shoulderY, pivotZ: 0 }); // skBot+11
    const lElbow = skBot + 10;
    const lHand = skBot + 11;
    holoEdges.push([b + 17, lElbow]); holoEdges.push([lElbow, lHand]);
    
    // --- RIGHT ARM ---
    holoVertices.push({ x: 0.17, y: elbowY, z: 0, color: PINK,
        isLimb: true, limbSide: 'right', limbType: 'arm', pivotX: 0.10, pivotY: shoulderY, pivotZ: 0 });
    holoVertices.push({ x: 0.19, y: handY, z: 0, color: MAGENTA,
        isLimb: true, limbSide: 'right', limbType: 'arm', pivotX: 0.10, pivotY: shoulderY, pivotZ: 0 });
    const rElbow = skBot + 12;
    const rHand = skBot + 13;
    holoEdges.push([b + 18, rElbow]); holoEdges.push([rElbow, rHand]);
    
    // --- LEFT LEG (below skirt) ---
    const kneeY = -0.24;
    const footY = -0.33;
    holoVertices.push({ x: -0.05, y: kneeY, z: 0, color: PINK,
        isLimb: true, limbSide: 'left', limbType: 'leg', pivotX: -0.10, pivotY: hipY, pivotZ: 0 });
    holoVertices.push({ x: -0.05, y: footY, z: 0, color: MAGENTA,
        isLimb: true, limbSide: 'left', limbType: 'leg', pivotX: -0.10, pivotY: hipY, pivotZ: 0 });
    const lKnee = skBot + 14;
    const lFoot = skBot + 15;
    holoEdges.push([b + 23, lKnee]); holoEdges.push([lKnee, lFoot]);
    holoVertices.push({ x: -0.05, y: footY, z: 0.035, color: PINK,
        isLimb: true, limbSide: 'left', limbType: 'leg', pivotX: -0.10, pivotY: hipY, pivotZ: 0 });
    holoEdges.push([lFoot, skBot + 16]);
    
    // --- RIGHT LEG ---
    holoVertices.push({ x: 0.05, y: kneeY, z: 0, color: PINK,
        isLimb: true, limbSide: 'right', limbType: 'leg', pivotX: 0.10, pivotY: hipY, pivotZ: 0 });
    holoVertices.push({ x: 0.05, y: footY, z: 0, color: MAGENTA,
        isLimb: true, limbSide: 'right', limbType: 'leg', pivotX: 0.10, pivotY: hipY, pivotZ: 0 });
    const rKnee = skBot + 17;
    const rFoot = skBot + 18;
    holoEdges.push([b + 24, rKnee]); holoEdges.push([rKnee, rFoot]);
    holoVertices.push({ x: 0.05, y: footY, z: 0.035, color: PINK,
        isLimb: true, limbSide: 'right', limbType: 'leg', pivotX: 0.10, pivotY: hipY, pivotZ: 0 });
    holoEdges.push([rFoot, skBot + 19]);
}

function generateProceduralHumanChild(isFemale) {
    // Girl: pink/magenta with a small skirt ring, Boy: blue/gold with shorts detail
    const cMain = isFemale ? { r: 255, g: 150, b: 220 } : { r: 60, g: 200, b: 255 };
    const cAcc  = isFemale ? { r: 255, g: 60, b: 160 }  : { r: 255, g: 200, b: 60 };
    const WHITE = { r: 255, g: 255, b: 255 };
    const b = holoVertices.length;
    const sc = 0.65; // children are smaller
    
    // --- HEAD (proportionally larger for child) ---
    const headCY = 0.22;
    const headR = 0.055; // bigger relative to body
    for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI * 2) / 8;
        holoVertices.push({ x: headR * Math.cos(a), y: headCY, z: headR * Math.sin(a), color: cMain });
    }
    holoVertices.push({ x: 0, y: headCY + headR * 0.85, z: 0, color: WHITE }); // 8 = crown
    holoVertices.push({ x: 0, y: headCY - headR * 0.55, z: 0, color: cMain }); // 9 = chin
    for (let i = 0; i < 8; i++) { holoEdges.push([b + i, b + (i + 1) % 8]); }
    for (let i = 0; i < 8; i++) { holoEdges.push([b + i, b + 8]); holoEdges.push([b + i, b + 9]); }
    
    // Girl: add pigtail / hair bow markers
    if (isFemale) {
        holoVertices.push({ x: -0.06, y: headCY + headR * 0.7, z: 0, color: cAcc }); // 10
        holoVertices.push({ x:  0.06, y: headCY + headR * 0.7, z: 0, color: cAcc }); // 11
        holoVertices.push({ x: -0.08, y: headCY + headR * 0.3, z: -0.03, color: cAcc }); // 12
        holoVertices.push({ x:  0.08, y: headCY + headR * 0.3, z: -0.03, color: cAcc }); // 13
        holoEdges.push([b + 8, b + 10]); holoEdges.push([b + 8, b + 11]);
        holoEdges.push([b + 10, b + 12]); holoEdges.push([b + 11, b + 13]);
    } else {
        // Boy: short spiky hair (small upward struts)
        holoVertices.push({ x: -0.03, y: headCY + headR * 1.1, z: 0.02, color: cAcc }); // 10
        holoVertices.push({ x:  0.03, y: headCY + headR * 1.1, z: -0.02, color: cAcc }); // 11
        holoVertices.push({ x: 0, y: headCY + headR * 1.2, z: 0, color: cAcc }); // 12
        holoVertices.push({ x: 0, y: headCY, z: 0, color: cMain }); // 13 dummy for index alignment
        holoEdges.push([b + 8, b + 10]); holoEdges.push([b + 8, b + 11]); holoEdges.push([b + 8, b + 12]);
    }
    
    // --- NECK ---
    holoVertices.push({ x: 0, y: headCY - headR * 1.3, z: 0, color: cMain }); // 14
    holoEdges.push([b + 9, b + 14]);
    
    // --- SHOULDERS ---
    const shoulderY = 0.08 * sc + 0.04;
    holoVertices.push({ x: -0.08 * sc, y: shoulderY, z: 0, color: cMain }); // 15
    holoVertices.push({ x:  0.08 * sc, y: shoulderY, z: 0, color: cMain }); // 16
    holoEdges.push([b + 14, b + 15]); holoEdges.push([b + 14, b + 16]);
    holoEdges.push([b + 15, b + 16]);
    
    // --- TORSO ---
    const hipY = shoulderY - 0.16;
    holoVertices.push({ x: -0.07 * sc, y: hipY, z: 0, color: cAcc }); // 17
    holoVertices.push({ x:  0.07 * sc, y: hipY, z: 0, color: cAcc }); // 18
    holoEdges.push([b + 15, b + 17]); holoEdges.push([b + 16, b + 18]);
    holoEdges.push([b + 17, b + 18]);
    // Spine
    holoVertices.push({ x: 0, y: hipY, z: 0, color: cMain }); // 19
    holoEdges.push([b + 14, b + 19]);
    
    // Girl: small skirt ring
    let limbBase = b + 20;
    if (isFemale) {
        const skY = hipY - 0.03;
        const skR = 0.09;
        for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI * 2) / 8;
            holoVertices.push({ x: skR * Math.cos(a), y: skY, z: skR * Math.sin(a), color: cAcc });
        }
        for (let i = 0; i < 8; i++) { holoEdges.push([b + 20 + i, b + 20 + (i + 1) % 8]); }
        holoEdges.push([b + 17, b + 24]); holoEdges.push([b + 18, b + 20]);
        limbBase = b + 28;
    } else {
        // Boy: shorts horizontal bar
        holoVertices.push({ x: -0.06 * sc, y: hipY - 0.04, z: 0, color: cAcc }); // 20
        holoVertices.push({ x:  0.06 * sc, y: hipY - 0.04, z: 0, color: cAcc }); // 21
        holoEdges.push([b + 17, b + 20]); holoEdges.push([b + 18, b + 21]);
        holoEdges.push([b + 20, b + 21]);
        
        // Padding
        holoVertices.push({ x: 0, y: 0, z: 0, color: cMain }); // 22 dummy
        holoVertices.push({ x: 0, y: 0, z: 0, color: cMain }); // 23 dummy
        holoVertices.push({ x: 0, y: 0, z: 0, color: cMain }); // 24 dummy
        holoVertices.push({ x: 0, y: 0, z: 0, color: cMain }); // 25 dummy
        holoVertices.push({ x: 0, y: 0, z: 0, color: cMain }); // 26 dummy
        holoVertices.push({ x: 0, y: 0, z: 0, color: cMain }); // 27 dummy
        limbBase = b + 28;
    }
    
    // --- LEFT ARM ---
    const eY = shoulderY - 0.10;
    const hY = shoulderY - 0.18;
    holoVertices.push({ x: -0.13 * sc, y: eY, z: 0, color: cMain,
        isLimb: true, limbSide: 'left', limbType: 'arm', pivotX: -0.08 * sc, pivotY: shoulderY, pivotZ: 0 });
    holoVertices.push({ x: -0.14 * sc, y: hY, z: 0, color: cAcc,
        isLimb: true, limbSide: 'left', limbType: 'arm', pivotX: -0.08 * sc, pivotY: shoulderY, pivotZ: 0 });
    holoEdges.push([b + 15, limbBase]); holoEdges.push([limbBase, limbBase + 1]);
    
    // --- RIGHT ARM ---
    holoVertices.push({ x: 0.13 * sc, y: eY, z: 0, color: cMain,
        isLimb: true, limbSide: 'right', limbType: 'arm', pivotX: 0.08 * sc, pivotY: shoulderY, pivotZ: 0 });
    holoVertices.push({ x: 0.14 * sc, y: hY, z: 0, color: cAcc,
        isLimb: true, limbSide: 'right', limbType: 'arm', pivotX: 0.08 * sc, pivotY: shoulderY, pivotZ: 0 });
    holoEdges.push([b + 16, limbBase + 2]); holoEdges.push([limbBase + 2, limbBase + 3]);
    
    // --- LEFT LEG ---
    const kY = hipY - 0.10;
    const fY = hipY - 0.20;
    holoVertices.push({ x: -0.04 * sc, y: kY, z: 0, color: cMain,
        isLimb: true, limbSide: 'left', limbType: 'leg', pivotX: -0.07 * sc, pivotY: hipY, pivotZ: 0 });
    holoVertices.push({ x: -0.04 * sc, y: fY, z: 0, color: cAcc,
        isLimb: true, limbSide: 'left', limbType: 'leg', pivotX: -0.07 * sc, pivotY: hipY, pivotZ: 0 });
    holoEdges.push([b + 17, limbBase + 4]); holoEdges.push([limbBase + 4, limbBase + 5]);
    // Foot
    holoVertices.push({ x: -0.04 * sc, y: fY, z: 0.03, color: cMain,
        isLimb: true, limbSide: 'left', limbType: 'leg', pivotX: -0.07 * sc, pivotY: hipY, pivotZ: 0 });
    holoEdges.push([limbBase + 5, limbBase + 6]);
    
    // --- RIGHT LEG ---
    holoVertices.push({ x: 0.04 * sc, y: kY, z: 0, color: cMain,
        isLimb: true, limbSide: 'right', limbType: 'leg', pivotX: 0.07 * sc, pivotY: hipY, pivotZ: 0 });
    holoVertices.push({ x: 0.04 * sc, y: fY, z: 0, color: cAcc,
        isLimb: true, limbSide: 'right', limbType: 'leg', pivotX: 0.07 * sc, pivotY: hipY, pivotZ: 0 });
    holoEdges.push([b + 18, limbBase + 7]); holoEdges.push([limbBase + 7, limbBase + 8]);
    // Foot
    holoVertices.push({ x: 0.04 * sc, y: fY, z: 0.03, color: cMain,
        isLimb: true, limbSide: 'right', limbType: 'leg', pivotX: 0.07 * sc, pivotY: hipY, pivotZ: 0 });
    holoEdges.push([limbBase + 8, limbBase + 9]);
}

function generateProceduralSkyscraper() {
    const CYAN = { r: 0, g: 240, b: 255 };
    const b = holoVertices.length;
    const w = 0.16;
    const d = 0.16;
    const h = 0.72;
    const ground = -0.48;
    for (let f = 0; f <= 5; f++) {
        const y = ground + (f / 5) * h;
        holoVertices.push({ x: -w, y: y, z: -d, color: CYAN });
        holoVertices.push({ x:  w, y: y, z: -d, color: CYAN });
        holoVertices.push({ x:  w, y: y, z:  d, color: CYAN });
        holoVertices.push({ x: -w, y: y, z:  d, color: CYAN });
        const fi = b + f * 4;
        holoEdges.push([fi, fi + 1]);
        holoEdges.push([fi + 1, fi + 2]);
        holoEdges.push([fi + 2, fi + 3]);
        holoEdges.push([fi + 3, fi]);
    }
    for (let c = 0; c < 4; c++) {
        for (let f = 0; f < 5; f++) {
            holoEdges.push([b + f * 4 + c, b + (f + 1) * 4 + c]);
        }
    }
    const topCenter = holoVertices.length;
    holoVertices.push({ x: 0, y: ground + h + 0.15, z: 0, color: { r: 255, g: 42, b: 42 } });
    holoEdges.push([b + 20, topCenter]);
    holoEdges.push([b + 21, topCenter]);
    holoEdges.push([b + 22, topCenter]);
    holoEdges.push([b + 23, topCenter]);
}

function generateProceduralTower() {
    const GOLD = { r: 255, g: 200, b: 60 };
    const WHITE = { r: 255, g: 255, b: 255 };
    const b = holoVertices.length;
    const ground = -0.48;
    const h = 0.68;
    const radii = [0.22, 0.15, 0.10, 0.05, 0.02];
    for (let f = 0; f <= 4; f++) {
        const r = radii[f];
        const y = ground + (f / 4) * h;
        holoVertices.push({ x: -r, y: y, z: -r, color: GOLD });
        holoVertices.push({ x:  r, y: y, z: -r, color: GOLD });
        holoVertices.push({ x:  r, y: y, z:  r, color: GOLD });
        holoVertices.push({ x: -r, y: y, z:  r, color: GOLD });
        const fi = b + f * 4;
        holoEdges.push([fi, fi + 1]);
        holoEdges.push([fi + 1, fi + 2]);
        holoEdges.push([fi + 2, fi + 3]);
        holoEdges.push([fi + 3, fi]);
    }
    for (let f = 0; f < 4; f++) {
        const fi = b + f * 4;
        const nfi = b + (f + 1) * 4;
        for (let c = 0; c < 4; c++) {
            const nextC = (c + 1) % 4;
            holoEdges.push([fi + c, nfi + c]);
            holoEdges.push([fi + c, nfi + nextC]);
            holoEdges.push([fi + nextC, nfi + c]);
        }
    }
    const topAntennaTip = holoVertices.length;
    holoVertices.push({ x: 0, y: ground + h + 0.18, z: 0, color: WHITE });
    holoEdges.push([b + 16, topAntennaTip]);
    holoEdges.push([b + 17, topAntennaTip]);
    holoEdges.push([b + 18, topAntennaTip]);
    holoEdges.push([b + 19, topAntennaTip]);
}

function generateProceduralPyramid() {
    const PURPLE = { r: 180, g: 100, b: 255 };
    const b = holoVertices.length;
    const ground = -0.48;
    const h = 0.45;
    const sizes = [0.35, 0.26, 0.17, 0.08];
    for (let f = 0; f < 4; f++) {
        const s = sizes[f];
        const y = ground + (f / 3) * h;
        holoVertices.push({ x: -s, y: y, z: -s, color: PURPLE });
        holoVertices.push({ x:  s, y: y, z: -s, color: PURPLE });
        holoVertices.push({ x:  s, y: y, z:  s, color: PURPLE });
        holoVertices.push({ x: -s, y: y, z:  s, color: PURPLE });
        const fi = b + f * 4;
        holoEdges.push([fi, fi + 1]);
        holoEdges.push([fi + 1, fi + 2]);
        holoEdges.push([fi + 2, fi + 3]);
        holoEdges.push([fi + 3, fi]);
    }
    for (let f = 0; f < 3; f++) {
        const fi = b + f * 4;
        const nfi = b + (f + 1) * 4;
        for (let c = 0; c < 4; c++) {
            holoEdges.push([fi + c, nfi + c]);
        }
    }
    for (let f = 0; f < 3; f++) {
        const sCurr = sizes[f];
        const sNext = sizes[f + 1];
        const yCurr = ground + (f / 3) * h;
        const yNext = ground + ((f + 1) / 3) * h;
        const stairL1 = holoVertices.length;
        holoVertices.push({ x: -0.04, y: yCurr, z: sCurr, color: PURPLE });
        holoVertices.push({ x:  0.04, y: yCurr, z: sCurr, color: PURPLE });
        holoVertices.push({ x: -0.04, y: yNext, z: sNext, color: PURPLE });
        holoVertices.push({ x:  0.04, y: yNext, z: sNext, color: PURPLE });
        holoEdges.push([stairL1, stairL1 + 1]);
        holoEdges.push([stairL1 + 2, stairL1 + 3]);
        holoEdges.push([stairL1, stairL1 + 2]);
        holoEdges.push([stairL1 + 1, stairL1 + 3]);
    }
}

function generateProceduralCastle() {
    const RED = { r: 255, g: 42, b: 42 };
    const ORANGE = { r: 255, g: 140, b: 0 };
    const b = holoVertices.length;
    const ground = -0.48;
    const w = 0.24;
    const hWall = 0.20;
    const hTower = 0.38;
    const offsets = [
        [-w, -w], [w, -w], [w, w], [-w, w]
    ];
    offsets.forEach((offset, tIdx) => {
        const tb = holoVertices.length;
        const [tx, tz] = offset;
        const r = 0.055;
        holoVertices.push({ x: tx - r, y: ground, z: tz - r, color: RED });
        holoVertices.push({ x: tx + r, y: ground, z: tz - r, color: RED });
        holoVertices.push({ x: tx + r, y: ground, z: tz + r, color: RED });
        holoVertices.push({ x: tx - r, y: ground, z: tz + r, color: RED });
        holoVertices.push({ x: tx - r, y: ground + hTower, z: tz - r, color: RED });
        holoVertices.push({ x: tx + r, y: ground + hTower, z: tz - r, color: RED });
        holoVertices.push({ x: tx + r, y: ground + hTower, z: tz + r, color: RED });
        holoVertices.push({ x: tx - r, y: ground + hTower, z: tz + r, color: RED });
        holoVertices.push({ x: tx, y: ground + hTower + 0.12, z: tz, color: ORANGE });
        for (let i = 0; i < 4; i++) {
            holoEdges.push([tb + i, tb + (i + 1) % 4]);
            holoEdges.push([tb + 4 + i, tb + 4 + (i + 1) % 4]);
            holoEdges.push([tb + i, tb + 4 + i]);
            holoEdges.push([tb + 4 + i, tb + 8]);
        }
    });
    holoEdges.push([b + 4, b + 9 + 7]);
    holoEdges.push([b + 9 + 5, b + 18 + 4]);
    holoEdges.push([b + 18 + 6, b + 27 + 5]);
    holoEdges.push([b + 27 + 7, b + 4]);
    const gateBase = holoVertices.length;
    holoVertices.push({ x: -0.06, y: ground, z: w, color: ORANGE });
    holoVertices.push({ x:  0.06, y: ground, z: w, color: ORANGE });
    holoVertices.push({ x: -0.06, y: ground + 0.14, z: w, color: ORANGE });
    holoVertices.push({ x:  0.06, y: ground + 0.14, z: w, color: ORANGE });
    holoVertices.push({ x: 0, y: ground + 0.18, z: w, color: ORANGE });
    holoEdges.push([gateBase, gateBase + 2]);
    holoEdges.push([gateBase + 1, gateBase + 3]);
    holoEdges.push([gateBase + 2, gateBase + 4]);
    holoEdges.push([gateBase + 3, gateBase + 4]);
}

function generateProceduralHouse() {
    const GREEN = { r: 0, g: 255, b: 80 };
    const GOLD = { r: 255, g: 200, b: 60 };
    const b = holoVertices.length;
    const ground = -0.48;
    const w = 0.20;
    const d = 0.20;
    const hBase = 0.26;
    const hRoof = 0.44;
    holoVertices.push({ x: -w, y: ground, z: -d, color: GREEN });
    holoVertices.push({ x:  w, y: ground, z: -d, color: GREEN });
    holoVertices.push({ x:  w, y: ground, z:  d, color: GREEN });
    holoVertices.push({ x: -w, y: ground, z:  d, color: GREEN });
    holoVertices.push({ x: -w, y: ground + hBase, z: -d, color: GREEN });
    holoVertices.push({ x:  w, y: ground + hBase, z: -d, color: GREEN });
    holoVertices.push({ x:  w, y: ground + hBase, z:  d, color: GREEN });
    holoVertices.push({ x: -w, y: ground + hBase, z:  d, color: GREEN });
    for (let i = 0; i < 4; i++) {
        holoEdges.push([b + i, b + (i + 1) % 4]);
        holoEdges.push([b + 4 + i, b + 4 + (i + 1) % 4]);
        holoEdges.push([b + i, b + 4 + i]);
    }
    holoVertices.push({ x: 0, y: ground + hRoof, z: -d, color: GOLD });
    holoVertices.push({ x: 0, y: ground + hRoof, z:  d, color: GOLD });
    holoEdges.push([b + 8, b + 9]);
    holoEdges.push([b + 4, b + 8]); holoEdges.push([b + 5, b + 8]);
    holoEdges.push([b + 7, b + 9]); holoEdges.push([b + 6, b + 9]);
    const doorBase = holoVertices.length;
    holoVertices.push({ x: -0.05, y: ground, z: d, color: GOLD });
    holoVertices.push({ x:  0.05, y: ground, z: d, color: GOLD });
    holoVertices.push({ x: -0.05, y: ground + 0.14, z: d, color: GOLD });
    holoVertices.push({ x:  0.05, y: ground + 0.14, z: d, color: GOLD });
    holoEdges.push([doorBase, doorBase + 2]);
    holoEdges.push([doorBase + 1, doorBase + 3]);
    holoEdges.push([doorBase + 2, doorBase + 3]);
}

function generateProceduralWindmill() {
    const CYAN = { r: 0, g: 240, b: 255 };
    const GOLD = { r: 255, g: 200, b: 60 };
    const b = holoVertices.length;
    const ground = -0.48;
    const h = 0.48;
    const rBase = 0.15;
    const rTop = 0.08;
    for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI * 2) / 8;
        holoVertices.push({ x: rBase * Math.cos(a), y: ground, z: rBase * Math.sin(a), color: CYAN });
    }
    for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI * 2) / 8;
        holoVertices.push({ x: rTop * Math.cos(a), y: ground + h, z: rTop * Math.sin(a), color: CYAN });
    }
    for (let i = 0; i < 8; i++) {
        holoEdges.push([b + i, b + (i + 1) % 8]);
        holoEdges.push([b + 8 + i, b + 8 + (i + 1) % 8]);
        holoEdges.push([b + i, b + 8 + i]);
    }
    const domeCenter = b + 16;
    holoVertices.push({ x: 0, y: ground + h + 0.08, z: 0, color: GOLD });
    for (let i = 0; i < 8; i++) {
        holoEdges.push([b + 8 + i, domeCenter]);
    }
    const rotorHub = b + 17;
    holoVertices.push({ x: 0, y: ground + h - 0.05, z: rTop + 0.015, color: { r: 255, g: 42, b: 42 } });
    holoEdges.push([domeCenter, rotorHub]);
    const pY = ground + h - 0.05;
    const pZ = rTop + 0.015;
    const b1Start = holoVertices.length;
    holoVertices.push({ x: 0, y: pY + 0.28, z: pZ, color: GOLD, isWindmillBlade: true, pivotX: 0, pivotY: pY, pivotZ: pZ });
    holoVertices.push({ x: -0.03, y: pY + 0.18, z: pZ, color: GOLD, isWindmillBlade: true, pivotX: 0, pivotY: pY, pivotZ: pZ });
    holoVertices.push({ x:  0.03, y: pY + 0.18, z: pZ, color: GOLD, isWindmillBlade: true, pivotX: 0, pivotY: pY, pivotZ: pZ });
    holoVertices.push({ x: 0.28, y: pY, z: pZ, color: GOLD, isWindmillBlade: true, pivotX: 0, pivotY: pY, pivotZ: pZ });
    holoVertices.push({ x: 0.18, y: pY + 0.03, z: pZ, color: GOLD, isWindmillBlade: true, pivotX: 0, pivotY: pY, pivotZ: pZ });
    holoVertices.push({ x: 0.18, y: pY - 0.03, z: pZ, color: GOLD, isWindmillBlade: true, pivotX: 0, pivotY: pY, pivotZ: pZ });
    holoVertices.push({ x: 0, y: pY - 0.28, z: pZ, color: GOLD, isWindmillBlade: true, pivotX: 0, pivotY: pY, pivotZ: pZ });
    holoVertices.push({ x:  0.03, y: pY - 0.18, z: pZ, color: GOLD, isWindmillBlade: true, pivotX: 0, pivotY: pY, pivotZ: pZ });
    holoVertices.push({ x: -0.03, y: pY - 0.18, z: pZ, color: GOLD, isWindmillBlade: true, pivotX: 0, pivotY: pY, pivotZ: pZ });
    holoVertices.push({ x: -0.28, y: pY, z: pZ, color: GOLD, isWindmillBlade: true, pivotX: 0, pivotY: pY, pivotZ: pZ });
    holoVertices.push({ x: -0.18, y: pY - 0.03, z: pZ, color: GOLD, isWindmillBlade: true, pivotX: 0, pivotY: pY, pivotZ: pZ });
    holoVertices.push({ x: -0.18, y: pY + 0.03, z: pZ, color: GOLD, isWindmillBlade: true, pivotX: 0, pivotY: pY, pivotZ: pZ });
    for (let k = 0; k < 4; k++) {
        const bi = b1Start + k * 3;
        holoEdges.push([rotorHub, bi]);
        holoEdges.push([bi, bi + 1]);
        holoEdges.push([bi, bi + 2]);
        holoEdges.push([bi + 1, bi + 2]);
    }
}

function generateProceduralBoat() {
    const CYAN = { r: 0, g: 240, b: 255 };
    const GOLD = { r: 255, g: 200, b: 60 };
    const WHITE = { r: 255, g: 255, b: 255 };
    const RED = { r: 255, g: 42, b: 42 };
    const b = holoVertices.length;
    const sections = [
        [-0.7, -0.32, 0.25, -0.22, 0.25, -0.10],
        [-0.3, -0.34, 0.28, -0.22, 0.28, -0.08],
        [ 0.1, -0.34, 0.28, -0.22, 0.28, -0.08],
        [ 0.4, -0.30, 0.20, -0.18, 0.20, -0.08],
        [ 0.6, -0.24, 0.12, -0.14, 0.12, -0.08]
    ];
    sections.forEach((sec, idx) => {
        const [z, keelY, bw, bottomY, dw, deckY] = sec;
        const color = CYAN;
        holoVertices.push({ x: 0, y: keelY, z: z, color: color });
        holoVertices.push({ x: -bw, y: bottomY, z: z, color: color });
        holoVertices.push({ x: bw, y: bottomY, z: z, color: color });
        holoVertices.push({ x: -dw, y: deckY, z: z, color: color });
        holoVertices.push({ x: dw, y: deckY, z: z, color: color });
        const si = b + idx * 5;
        holoEdges.push([si, si + 1]);
        holoEdges.push([si, si + 2]);
        holoEdges.push([si + 1, si + 3]);
        holoEdges.push([si + 2, si + 4]);
        holoEdges.push([si + 3, si + 4]);
    });
    for (let idx = 0; idx < 4; idx++) {
        const si = b + idx * 5;
        const nsi = b + (idx + 1) * 5;
        for (let c = 0; c < 5; c++) {
            holoEdges.push([si + c, nsi + c]);
        }
    }
    const bowTip = holoVertices.length;
    holoVertices.push({ x: 0, y: -0.05, z: 0.82, color: GOLD });
    holoVertices.push({ x: 0, y: -0.20, z: 0.82, color: GOLD });
    holoEdges.push([bowTip, bowTip + 1]);
    const s4 = b + 4 * 5;
    holoEdges.push([s4, bowTip + 1]);
    holoEdges.push([s4 + 1, bowTip + 1]);
    holoEdges.push([s4 + 2, bowTip + 1]);
    holoEdges.push([s4 + 3, bowTip]);
    holoEdges.push([s4 + 4, bowTip]);
    const wsBase = holoVertices.length;
    const s1 = b + 1 * 5;
    const s2 = b + 2 * 5;
    holoVertices.push({ x: -0.22, y: 0.05, z: -0.1, color: WHITE });
    holoVertices.push({ x:  0.22, y: 0.05, z: -0.1, color: WHITE });
    holoVertices.push({ x: 0, y: 0.08, z: 0.1, color: WHITE });
    holoEdges.push([s1 + 3, wsBase]);
    holoEdges.push([s1 + 4, wsBase + 1]);
    holoEdges.push([wsBase, wsBase + 1]);
    holoEdges.push([wsBase, wsBase + 2]);
    holoEdges.push([wsBase + 1, wsBase + 2]);
    holoEdges.push([wsBase + 2, s2 + 3]);
    holoEdges.push([wsBase + 2, s2 + 4]);
    const mot = holoVertices.length;
    const s0 = b + 0 * 5;
    holoVertices.push({ x: -0.06, y: -0.22, z: -0.78, color: RED });
    holoVertices.push({ x:  0.06, y: -0.22, z: -0.78, color: RED });
    holoVertices.push({ x: -0.04, y: -0.34, z: -0.78, color: RED });
    holoVertices.push({ x:  0.04, y: -0.34, z: -0.78, color: RED });
    holoEdges.push([mot, mot + 1]);
    holoEdges.push([mot + 1, mot + 3]);
    holoEdges.push([mot + 3, mot + 2]);
    holoEdges.push([mot + 2, mot]);
    holoEdges.push([s0, mot + 2]);
    holoEdges.push([s0, mot + 3]);
    holoEdges.push([s0 + 1, mot]);
    holoEdges.push([s0 + 2, mot + 1]);
}


// SMART TAB VISIBILITY SUSPEND SENTINEL
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        // Suspend all computationally heavy canvas animation threads immediately!
        if (holoAnimationId) {
            cancelAnimationFrame(holoAnimationId);
            holoAnimationId = null;
        }
        if (prismAnimationId) {
            cancelAnimationFrame(prismAnimationId);
            prismAnimationId = null;
        }
        if (holoLoadingAnimationId) {
            cancelAnimationFrame(holoLoadingAnimationId);
            holoLoadingAnimationId = null;
        }
    } else {
        // Resume active visualizer thread cleanly when user returns to active tab!
        if (isHoloActive) {
            if (!holoAnimationId) {
                const holoLoop = (timestamp) => {
                    if (!isHoloActive) return;
                    if (!lastHoloFrameTime) lastHoloFrameTime = timestamp;
                    const elapsed = timestamp - lastHoloFrameTime;
                    if (elapsed >= holoFrameDelay) {
                        if (!document.hidden) {
                            drawHoloSimulation();
                        }
                        lastHoloFrameTime = timestamp - (elapsed % holoFrameDelay);
                    }
                    holoAnimationId = requestAnimationFrame(holoLoop);
                };
                holoAnimationId = requestAnimationFrame(holoLoop);
            }
        } else {
            if (!prismAnimationId && prismCanvas) {
                init3DPrism();
            }
        }
    }
});

// --- HAND GESTURE CONTROL PROTOCOLS ---

function findClickedVehicleAtCoords(mouseX, mouseY) {
    if (!holoCanvas) return null;
    const w = holoWidth;
    const h = holoHeight;
    if (w === 0 || h === 0) return null;
    let clickedVehicle = null;
    let minDistance = isHandControlMode ? 55 : 35; // Expand comfortable selection radius in hand mode
    
    const cosX = Math.cos(holoRotX), sinX = Math.sin(holoRotX);
    const cosY = Math.cos(holoRotY), sinY = Math.sin(holoRotY);
    const cosZ = Math.cos(holoRotZ), sinZ = Math.sin(holoRotZ);
    const distance = 4.0;
    const scale = 320;
    
    activeVehicles.forEach(vehicle => {
        if (!vehicle || !vehicle.vertices || vehicle.vertices.length === 0) return;
        const numVerts = vehicle.vertices.length;
        const dynamicY = (Math.sin((holoSimState ? holoSimState.time : 0) * 25.0 + vehicle.bobbingOffset) * 0.003) + 
                         (Math.sin((holoSimState ? holoSimState.time : 0) * 3.5 + vehicle.bobbingOffset) * 0.006);
                         
        for (let i = 0; i < numVerts; i++) {
            const v = vehicle.vertices[i];
            let vx = v.x;
            let vy = v.y;
            let vz = v.z;
            
            // Wheel axle rotation
            if (v.isWheel) {
                const theta = (vehicle.isAnimated !== false) ? (vehicle.wheelSpinTime || 0) : 0;
                const dy = v.y - v.axleY;
                const dz = v.z - v.axleZ;
                const rDist = Math.sqrt(dy * dy + dz * dz);
                const currentAngle = Math.atan2(dy, dz);
                const newAngle = currentAngle + theta;
                vy = v.axleY + rDist * Math.sin(newAngle);
                vz = v.axleZ + rDist * Math.cos(newAngle);
            }
            
            // Windmill blade rotation
            if (v.isWindmillBlade) {
                const rotSpeed = 1.8;
                const theta = (isAnimBuildingActive && vehicle.isAnimated !== false) ? ((holoSimState ? holoSimState.time : 0) * rotSpeed) : 0;
                const bDx = v.x - v.pivotX;
                const bDy = v.y - v.pivotY;
                const rDist = Math.sqrt(bDx * bDx + bDy * bDy);
                const baseAngle = Math.atan2(bDy, bDx);
                const newAngle = baseAngle + theta;
                vx = v.pivotX + rDist * Math.cos(newAngle);
                vy = v.pivotY + rDist * Math.sin(newAngle);
            }
            
            // Project to 3D Space
            let rx = (vx + (vehicle.x || 0)) * holoZoom;
            let ry = (vy + (vehicle.y || 0) + dynamicY) * holoZoom;
            let rz = (vz + (vehicle.z || 0)) * holoZoom;
            
            let x1 = rx * cosY + rz * sinY;
            let z1 = -rx * sinY + rz * cosY;
            let y2 = ry * cosX - z1 * sinX;
            let z2 = ry * sinX + z1 * cosX;
            let x3 = x1 * cosZ - y2 * sinZ;
            let y3 = x1 * sinZ + y2 * cosZ;
            
            if (z2 >= distance - 0.15) continue;
            
            const perspective = 1 / (distance - z2);
            const sx = x3 * perspective * scale + w / 2;
            const sy = -y3 * perspective * scale + h / 2;
            
            const dist = Math.sqrt((mouseX - sx) * (mouseX - sx) + (mouseY - sy) * (mouseY - sy));
            if (dist < minDistance) {
                minDistance = dist;
                clickedVehicle = vehicle;
            }
        }
    });
    return clickedVehicle;
}

function loadMediaPipeScripts() {
    return new Promise((resolve, reject) => {
        if (mediaPipeLoaded) return resolve();
        
        printSystemMessage("[HOLO-SYSTEM]: Loading MediaPipe hand tracking libraries...");
        
        const script1 = document.createElement("script");
        script1.src = "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
        script1.crossOrigin = "anonymous";
        
        const script2 = document.createElement("script");
        script2.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
        script2.crossOrigin = "anonymous";
        
        let loadedCount = 0;
        const checkLoad = () => {
            loadedCount++;
            if (loadedCount === 2) {
                mediaPipeLoaded = true;
                printSystemMessage("[HOLO-SYSTEM]: MediaPipe cores successfully loaded.");
                resolve();
            }
        };
        
        script1.onload = checkLoad;
        script1.onerror = () => reject(new Error("Failed to load MediaPipe Camera Utilities."));
        script2.onload = checkLoad;
        script2.onerror = () => reject(new Error("Failed to load MediaPipe Hands Core."));
        
        document.head.appendChild(script1);
        document.head.appendChild(script2);
    });
}

function drawHandSkeletonsOnOverlay(canvas, ctx, multiHandLandmarks, multiHandedness, image) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw mirrored video stream if available!
    if (image) {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1); // Flip horizontally to mirror naturally
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        
        // Superimpose a very subtle semi-transparent Stark blue grid overlay
        ctx.fillStyle = "rgba(0, 240, 255, 0.12)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        // Semi-transparent high-tech backdrop fallback
        ctx.fillStyle = "rgba(14, 2, 4, 0.55)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8], // Index
        [5, 9], [9, 10], [10, 11], [11, 12], // Middle
        [9, 13], [13, 14], [14, 15], [15, 16], // Ring
        [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
        [0, 17] // Palm Base
    ];
    
    for (let hIdx = 0; hIdx < multiHandLandmarks.length; hIdx++) {
        const landmarks = multiHandLandmarks[hIdx];
        
        let isRightHand = true;
        if (multiHandLandmarks.length === 2) {
            // Spatial sorting for mirrored webcam feed:
            // Smallest raw X is user's Right Hand (mirrored left side of screen)
            // Largest raw X is user's Left Hand (mirrored right side of screen)
            const sorted = [...multiHandLandmarks].sort((a, b) => a[0].x - b[0].x);
            isRightHand = (landmarks === sorted[0]); // Smallest raw X is user's Right Hand in mirrored view
        } else {
            const handednessInfo = multiHandedness[hIdx];
            const label = handednessInfo ? handednessInfo.label : "Right";
            isRightHand = (label === "Right");
        }
        
        // Draw mirrored joint linkages connections
        ctx.strokeStyle = isRightHand ? "rgba(0, 240, 255, 0.85)" : "rgba(255, 200, 60, 0.85)";
        ctx.lineWidth = 1.8;
        
        connections.forEach(conn => {
            const pt1 = landmarks[conn[0]];
            const pt2 = landmarks[conn[1]];
            if (pt1 && pt2) {
                ctx.beginPath();
                ctx.moveTo((1 - pt1.x) * canvas.width, pt1.y * canvas.height);
                ctx.lineTo((1 - pt2.x) * canvas.width, pt2.y * canvas.height);
                ctx.stroke();
            }
        });
        
        // Draw landmarks joints
        for (let i = 0; i < landmarks.length; i++) {
            const pt = landmarks[i];
            const isTip = (i === 4 || i === 8 || i === 12 || i === 16 || i === 20);
            
            ctx.beginPath();
            ctx.arc((1 - pt.x) * canvas.width, pt.y * canvas.height, isTip ? 2.5 : 1.5, 0, 2 * Math.PI);
            ctx.fillStyle = isTip ? "rgba(0, 240, 255, 0.95)" : (isRightHand ? "rgba(255, 42, 42, 0.9)" : "rgba(255, 200, 60, 0.9)");
            ctx.fill();
        }
        
        // Render Floating High-Tech HUD Role Tag near the wrist node (landmark 0)
        const wrist = landmarks[0];
        if (wrist) {
            ctx.save();
            ctx.font = "bold 8px Share Tech Mono";
            let labelText = isRightHand ? "R-CORE: CAMERA" : "L-CORE: OBJECTS";
            if (leftHandSpecialMode) {
                labelText = isRightHand ? "R-CORE: NAVIGATION" : "L-CORE: TACTICAL";
            }
            ctx.fillStyle = isRightHand ? "rgba(0, 240, 255, 0.95)" : (leftHandSpecialMode ? "rgba(255, 170, 0, 0.95)" : "rgba(255, 200, 60, 0.95)");
            
            const txtX = (1 - wrist.x) * canvas.width + 8;
            const txtY = wrist.y * canvas.height + 3;
            ctx.fillText(labelText, txtX, txtY);
            ctx.restore();
        }
    }
}

function checkIsFist(landmarks) {
    const getDist = (pt1, pt2) => {
        const dx = pt1.x - pt2.x;
        const dy = pt1.y - pt2.y;
        return Math.sqrt(dx*dx + dy*dy);
    };
    
    const isFingerCurled = (mcp, pip, dip, tip) => {
        const segmentSum = getDist(landmarks[mcp], landmarks[pip]) + 
                           getDist(landmarks[pip], landmarks[dip]) + 
                           getDist(landmarks[dip], landmarks[tip]);
        const straightDist = getDist(landmarks[mcp], landmarks[tip]);
        const ratio = straightDist / (segmentSum || 1.0);
        return ratio < 0.58; // Tightened threshold for intentional fist curls
    };
    
    const indexCurled = isFingerCurled(5, 6, 7, 8);
    const middleCurled = isFingerCurled(9, 10, 11, 12);
    const ringCurled = isFingerCurled(13, 14, 15, 16);
    const pinkyCurled = isFingerCurled(17, 18, 19, 20);
    
    const curledCount = (indexCurled ? 1 : 0) + (middleCurled ? 1 : 0) + (ringCurled ? 1 : 0) + (pinkyCurled ? 1 : 0);
    return curledCount >= 3;
}

function getExtendedFingerCount(landmarks) {
    const getDist = (pt1, pt2) => {
        const dx = pt1.x - pt2.x;
        const dy = pt1.y - pt2.y;
        return Math.sqrt(dx*dx + dy*dy);
    };
    
    let count = 0;
    
    // 1. Thumb: MCP 2, IP 3, Tip 4
    const thumbSegmentSum = getDist(landmarks[2], landmarks[3]) + getDist(landmarks[3], landmarks[4]);
    const thumbStraightDist = getDist(landmarks[2], landmarks[4]);
    const thumbRatio = thumbStraightDist / (thumbSegmentSum || 1.0);
    // Also thumb must be extended relative to wrist
    if (thumbRatio > 0.88 && getDist(landmarks[0], landmarks[4]) > getDist(landmarks[0], landmarks[2]) * 1.1) {
        count++;
    }
    
    // Helper to evaluate primary finger extension
    const isFingerExtended = (mcp, pip, dip, tip) => {
        const segmentSum = getDist(landmarks[mcp], landmarks[pip]) + 
                           getDist(landmarks[pip], landmarks[dip]) + 
                           getDist(landmarks[dip], landmarks[tip]);
        const straightDist = getDist(landmarks[mcp], landmarks[tip]);
        const ratio = straightDist / (segmentSum || 1.0);
        return ratio > 0.84; // extremely stable threshold for straight fingers
    };
    
    // 2. Index: 5, 6, 7, 8
    if (isFingerExtended(5, 6, 7, 8)) count++;
    
    // 3. Middle: 9, 10, 11, 12
    if (isFingerExtended(9, 10, 11, 12)) count++;
    
    // 4. Ring: 13, 14, 15, 16
    if (isFingerExtended(13, 14, 15, 16)) count++;
    
    // 5. Pinky: 17, 18, 19, 20
    if (isFingerExtended(17, 18, 19, 20)) count++;
    
    return count;
}

function processTwoHandGestureDirectives(multiHandLandmarks, multiHandedness) {
    if (!holoCanvas) return;
    const canvasWidth = holoWidth;
    const canvasHeight = holoHeight;
    if (canvasWidth === 0 || canvasHeight === 0) return;
    
    let rightHandLandmarks = null;
    let leftHandLandmarks = null;
    
    // Sort landmarks spatially for absolute side-locked accuracy when 2 hands are present
    if (multiHandLandmarks.length === 2) {
        // Spatial sorting for mirrored webcam feed:
        // - Smallest raw X is user's Right Hand (mirrored left side of screen).
        // - Largest raw X is user's Left Hand (mirrored right side of screen).
        const sorted = [...multiHandLandmarks].sort((a, b) => a[0].x - b[0].x);
        leftHandLandmarks = sorted[1];  // Largest raw X (User's Left Hand in mirrored view)
        rightHandLandmarks = sorted[0]; // Smallest raw X (User's Right Hand in mirrored view)
    } else {
        // Single hand fallback: map single hand to BOTH left and right hands
        // This grants single-hand user full gesture capabilities (manipulate objects + zoom/navigate) seamlessly!
        if (multiHandLandmarks.length === 1) {
            leftHandLandmarks = multiHandLandmarks[0];
            rightHandLandmarks = multiHandLandmarks[0];
        } else {
            // Fallback for safety/multi-hand parsing
            for (let i = 0; i < multiHandLandmarks.length; i++) {
                const landmarks = multiHandLandmarks[i];
                const handednessInfo = multiHandedness[i];
                const label = handednessInfo ? handednessInfo.label : "Right";
                
                if (label === "Right") {
                    rightHandLandmarks = landmarks;
                } else if (label === "Left") {
                    leftHandLandmarks = landmarks;
                }
            }
        }
    }
    
    // Helper to compute mode (most frequent value) of a rolling buffer
    const getBufferMode = (arr) => {
        if (arr.length === 0) return "NONE";
        const counts = {};
        let maxCount = 0;
        let modeVal = arr[0];
        for (const val of arr) {
            counts[val] = (counts[val] || 0) + 1;
            if (counts[val] > maxCount) {
                maxCount = counts[val];
                modeVal = val;
            }
        }
        return modeVal;
    };
    
    // --- DEBOUNCE RIGHT HAND GESTURE ---
    let rightExtCount = -1;
    let rawRightGesture = "NONE";
    if (rightHandLandmarks) {
        rightExtCount = getExtendedFingerCount(rightHandLandmarks);
        if (checkIsFist(rightHandLandmarks)) {
            rawRightGesture = "FIST";
        } else if (rightExtCount === 3) {
            rawRightGesture = "LOCK";
        } else if (rightExtCount === 4) {
            rawRightGesture = "NAV";
        } else if (rightExtCount === 5) {
            rawRightGesture = "ZOOM_IN";
        }
        
        rightGestureHistory.push(rawRightGesture);
        if (rightGestureHistory.length > 5) rightGestureHistory.shift();
    } else {
        rightGestureHistory = [];
    }
    const stableRightGesture = getBufferMode(rightGestureHistory);
    
    // --- DEBOUNCE LEFT HAND GESTURE ---
    let rawLeftGesture = "NONE";
    if (leftHandLandmarks) {
        if (checkIsFist(leftHandLandmarks)) {
            rawLeftGesture = "FIST";
        }
        
        leftGestureHistory.push(rawLeftGesture);
        if (leftGestureHistory.length > 5) leftGestureHistory.shift();
    } else {
        leftGestureHistory = [];
    }
    const stableLeftGesture = getBufferMode(leftGestureHistory);
    
    // 1. LEFT HAND SPECIAL MODE TOGGLE (Left Hand Closed Palm / Fist held for 10 frames, debounced resiliently)
    if (leftHandLandmarks && !isHandPinching) {
        if (stableLeftGesture === "FIST") {
            if (!leftFistLockout) {
                leftFistHoldFrames++;
                if (leftFistHoldFrames >= 10) { // Require ~400ms of sustained fist for robust activation
                    leftHandSpecialMode = !leftHandSpecialMode;
                    leftFistLockout = true; // Lockout to prevent rapid accidental toggling
                    playSFX(sfxBeep);
                    speak(leftHandSpecialMode ? "Left hand special control mode activated." : "Left hand special control mode deactivated.");
                    printSystemMessage(leftHandSpecialMode ? 
                        "[HOLO-SYSTEM]: Special Left Hand mode ACTIVE. Auto screen rotation paused, Right Hand zooming disabled." : 
                        "[HOLO-SYSTEM]: Special Left Hand mode INACTIVE. Normal controls and gestures restored."
                    );
                }
            }
        } else {
            // Decay instead of instant reset to tolerate brief landmark tracking drops/jitters
            leftFistHoldFrames = Math.max(0, leftFistHoldFrames - 1);
            if (leftFistHoldFrames === 0) {
                leftFistLockout = false;
            }
        }
    } else {
        leftFistHoldFrames = Math.max(0, leftFistHoldFrames - 1);
        if (leftFistHoldFrames === 0) {
            leftFistLockout = false;
        }
    }
    
    // 2. GESTURE LOCK CHECK (Right Hand 3 Fingers - Only if not in leftHandSpecialMode)
    if (rightHandLandmarks) {
        if (stableRightGesture === "LOCK" && !leftHandSpecialMode) {
            isGestureLocked = true;
        } else {
            isGestureLocked = false;
        }
    } else {
        isGestureLocked = false;
    }
    
    // --- 3. PROCESS RIGHT HAND (CAMERA VIEW CONTROLLER) ---
    if (rightHandLandmarks) {
        const rightIndexTip = rightHandLandmarks[8];
        const rightThumbTip = rightHandLandmarks[4];
        
        if (rightIndexTip && rightThumbTip) {
            if (leftHandSpecialMode) {
                // Tactical Sandbox Mode: Right Hand ONLY controls camera view movement (rotations)
                // NO zoom functionality!
                // While in control mode, closing the right hand should immediately stop/freeze the hologram view movement
                if (stableRightGesture === "FIST") {
                    lastRightHandX = null;
                    lastRightHandY = null;
                } else {
                    const handX = 1 - rightIndexTip.x;
                    const handY = rightIndexTip.y;
                    
                    if (lastRightHandX !== null && lastRightHandY !== null) {
                        const dx = handX - lastRightHandX;
                        const dy = handY - lastRightHandY;
                        holoRotY += dx * 3.5;
                        holoRotX += dy * 3.5;
                    }
                    lastRightHandX = handX;
                    lastRightHandY = handY;
                }
            } else {
                // Normal Mode Viewport controls
                // Gradual Zoom In (Open Palm / 5 Fingers)
                if (stableRightGesture === "ZOOM_IN") {
                    if (!isGestureLocked) {
                        holoZoom = Math.min(18.0, holoZoom + 0.015);
                        updateHoloZoomUI();
                    }
                }
                // Gradual Zoom Out (Closed Palm / Fist - Curled Count >= 3)
                else if (stableRightGesture === "FIST") {
                    if (!isGestureLocked) {
                        holoZoom = Math.max(0.2, holoZoom - 0.015);
                        updateHoloZoomUI();
                    }
                }
                // Screen View Navigation (4 Fingers)
                else if (stableRightGesture === "NAV") {
                    const handX = 1 - rightIndexTip.x;
                    const handY = rightIndexTip.y;
                    
                    if (lastRightHandX !== null && lastRightHandY !== null) {
                        const dx = handX - lastRightHandX;
                        const dy = handY - lastRightHandY;
                        
                        if (!isGestureLocked) {
                            holoRotY += dx * 3.5;
                            holoRotX += dy * 3.5;
                        }
                    }
                    lastRightHandX = handX;
                    lastRightHandY = handY;
                }
                
                // Reset right hand movement tracking if not navigating
                if (stableRightGesture !== "NAV") {
                    lastRightHandX = null;
                    lastRightHandY = null;
                }
            }
        }
    } else {
        lastRightHandX = null;
        lastRightHandY = null;
        gestureZoomStart = null;
    }
    
    // --- 4. PROCESS LEFT HAND (EXCLUSIVE OBJECT MANIPULATOR) ---
    if (leftHandLandmarks) {
        const leftIndexTip = leftHandLandmarks[8];
        const leftThumbTip = leftHandLandmarks[4];
        
        if (leftIndexTip && leftThumbTip) {
            // Position Virtual Cursor tracking Left Hand Index Tip
            const rawX = (1 - leftIndexTip.x) * canvasWidth;
            const rawY = leftIndexTip.y * canvasHeight;
            
            if (!handCursorPos) {
                handCursorPos = { x: rawX, y: rawY };
            } else {
                const cursorShift = Math.sqrt((rawX - handCursorPos.x)*(rawX - handCursorPos.x) + (rawY - handCursorPos.y)*(rawY - handCursorPos.y));
                const alpha = cursorShift > 45 ? 0.82 : (cursorShift > 15 ? 0.50 : 0.22);
                handCursorPos.x = handCursorPos.x * (1 - alpha) + rawX * alpha;
                handCursorPos.y = handCursorPos.y * (1 - alpha) + rawY * alpha;
            }
            
            // Left Hand Scale calculation (middle knuckle 9 to wrist 0)
            const scaleDx = leftHandLandmarks[9].x - leftHandLandmarks[0].x;
            const scaleDy = leftHandLandmarks[9].y - leftHandLandmarks[0].y;
            const scaleDz = leftHandLandmarks[9].z - leftHandLandmarks[0].z;
            const leftHandScale = Math.sqrt(scaleDx*scaleDx + scaleDy*scaleDy + scaleDz*scaleDz);
            
            // Invariant pinch calculation using min distance to index tip or middle tip for maximum reliability
            const idxDx = leftIndexTip.x - leftThumbTip.x;
            const idxDy = leftIndexTip.y - leftThumbTip.y;
            const idxDz = leftIndexTip.z - leftThumbTip.z;
            const indexRawDist = Math.sqrt(idxDx*idxDx + idxDy*idxDy + idxDz*idxDz);
            
            const midDx = leftHandLandmarks[12].x - leftThumbTip.x;
            const midDy = leftHandLandmarks[12].y - leftThumbTip.y;
            const midDz = leftHandLandmarks[12].z - leftThumbTip.z;
            const middleRawDist = Math.sqrt(midDx*midDx + midDy*midDy + midDz*midDz);
            
            const minRawPinchDist = Math.min(indexRawDist, middleRawDist);
            const normalizedPinchDist = minRawPinchDist / (leftHandScale || 1.0);
            
            const isFistNow = checkIsFist(leftHandLandmarks);
            const isPinchingNow = !isFistNow && (normalizedPinchDist < 0.45); // Do NOT pinch if it is a closed fist!
            
            if (isPinchingNow) {
                leftPinchFrameCounter = Math.min(5, leftPinchFrameCounter + 1);
            } else {
                leftPinchFrameCounter = Math.max(0, leftPinchFrameCounter - 1);
            }
            
            const isStablePinch = leftPinchFrameCounter >= 2;
            
            if (isStablePinch) {
                if (!isHandPinching) {
                    isHandPinching = true;
                    
                    const clicked = findClickedVehicleAtCoords(handCursorPos.x, handCursorPos.y);
                    if (clicked) {
                        selectedVehicle = clicked;
                        selectedVehicle.manualLocation = true;
                        selectedVehicle.manualHeight = true;
                        isDraggingVehicle = true;
                        playSFX(sfxBeep);
                        printSystemMessage(`[HOLO-GESTURE]: Grabbed ${selectedVehicle.type.toUpperCase()} for hand relocation.`);
                        
                        if (selectedEntityPanel) selectedEntityPanel.style.display = "flex";
                        if (selectedEntityNameLabel) selectedEntityNameLabel.textContent = `SELECTED: ${selectedVehicle.type.toUpperCase()}`;
                        if (btnAnimSelected) {
                            if (selectedVehicle.isAnimated !== false) {
                                btnAnimSelected.classList.remove("paused");
                                btnAnimSelected.textContent = "ANIMATE: ON";
                            } else {
                                btnAnimSelected.classList.add("paused");
                                btnAnimSelected.textContent = "ANIMATE: OFF";
                            }
                        }
                    } else {
                        isDraggingVehicle = false;
                    }
                } else if (!selectedVehicle || !isDraggingVehicle) {
                    // Continuously scan for vehicle under cursor while pinched to allow instant grabbing!
                    const clicked = findClickedVehicleAtCoords(handCursorPos.x, handCursorPos.y);
                    if (clicked) {
                        selectedVehicle = clicked;
                        selectedVehicle.manualLocation = true;
                        selectedVehicle.manualHeight = true;
                        isDraggingVehicle = true;
                        playSFX(sfxBeep);
                        printSystemMessage(`[HOLO-GESTURE]: Grabbed ${selectedVehicle.type.toUpperCase()} for hand relocation.`);
                        
                        if (selectedEntityPanel) selectedEntityPanel.style.display = "flex";
                        if (selectedEntityNameLabel) selectedEntityNameLabel.textContent = `SELECTED: ${selectedVehicle.type.toUpperCase()}`;
                        if (btnAnimSelected) {
                            if (selectedVehicle.isAnimated !== false) {
                                btnAnimSelected.classList.remove("paused");
                                btnAnimSelected.textContent = "ANIMATE: ON";
                            } else {
                                btnAnimSelected.classList.add("paused");
                                btnAnimSelected.textContent = "ANIMATE: OFF";
                            }
                        }
                    }
                }
            } else if (!isStablePinch && isHandPinching) {
                isHandPinching = false;
                isDraggingVehicle = false;
            }
            
            // Translate object based on smoothed Left Hand virtual cursor coordinates
            const handX = handCursorPos.x / canvasWidth;
            const handY = handCursorPos.y / canvasHeight;
            
            if (lastLeftHandX !== null && lastLeftHandY !== null) {
                const dx = handX - lastLeftHandX;
                const dy = handY - lastLeftHandY;
                
                if (isHandPinching && selectedVehicle && isDraggingVehicle) {
                    // Dynamic tactile scale factor to translate hand movement directly into the 3D hologram world coordinates
                    const scaleFactor = 3.5 / (holoZoom || 1.0);
                    
                    // Positional deadband threshold to filter minor hand tremors & stabilize placement
                    const distanceShift = Math.sqrt(dx * dx + dy * dy);
                    if (distanceShift > 0.001) {
                        selectedVehicle.x += dx * scaleFactor * Math.cos(holoRotY);
                        selectedVehicle.z += dx * scaleFactor * Math.sin(holoRotY);
                        selectedVehicle.y -= dy * scaleFactor;
                        selectedVehicle.manualHeight = true;
                        selectedVehicle.manualLocation = true;
                    }
                }
            }
            
            lastLeftHandX = handX;
            lastLeftHandY = handY;
        }
    } else {
        lastLeftHandX = null;
        lastLeftHandY = null;
        isHandPinching = false;
        isDraggingVehicle = false;
        
        // Fallback: If Left Hand is absent but Right Hand is present, track Right Hand index tip for cursor drawing
        if (rightHandLandmarks) {
            const rightIndexTip = rightHandLandmarks[8];
            if (rightIndexTip) {
                const rawX = (1 - rightIndexTip.x) * canvasWidth;
                const rawY = rightIndexTip.y * canvasHeight;
                if (!handCursorPos) {
                    handCursorPos = { x: rawX, y: rawY };
                } else {
                    const cursorShift = Math.sqrt((rawX - handCursorPos.x)*(rawX - handCursorPos.x) + (rawY - handCursorPos.y)*(rawY - handCursorPos.y));
                    const alpha = cursorShift > 45 ? 0.82 : (cursorShift > 15 ? 0.50 : 0.22);
                    handCursorPos.x = handCursorPos.x * (1 - alpha) + rawX * alpha;
                    handCursorPos.y = handCursorPos.y * (1 - alpha) + rawY * alpha;
                }
            }
        } else {
            handCursorPos = null;
        }
    }
}

async function reconnectHandGestureSystem() {
    if (!isHandControlMode) return;
    
    console.log("[HOLO-SYSTEM]: Reconnecting/Verifying hand gesture interface...");
    
    // 1. Ensure DOM elements are properly present and styled
    let videoEl = document.getElementById("holo-webcam-feed");
    if (!videoEl) {
        videoEl = document.createElement("video");
        videoEl.id = "holo-webcam-feed";
        videoEl.autoplay = true;
        videoEl.playsInline = true;
        videoEl.style.display = "none";
        document.body.appendChild(videoEl);
    }
    
    let overlayContainer = document.getElementById("holo-gesture-feed-container");
    if (!overlayContainer) {
        overlayContainer = document.createElement("div");
        overlayContainer.id = "holo-gesture-feed-container";
        overlayContainer.style.cssText = `
            position: absolute; 
            top: 20px; 
            right: 330px; 
            width: 155px; 
            height: 135px; 
            border: 1px solid rgba(0, 240, 255, 0.45); 
            background: rgba(14, 2, 4, 0.9); 
            border-radius: 4px; 
            box-shadow: 0 0 15px rgba(0, 240, 255, 0.25); 
            display: none; 
            flex-direction: column; 
            overflow: hidden; 
            z-index: 100; 
            font-family: var(--font-mono);
        `;
        
        overlayContainer.innerHTML = `
            <div style="height: 18px; background: rgba(0, 240, 255, 0.15); border-bottom: 1px solid rgba(0, 240, 255, 0.3); font-size: 8px; color: var(--neon-blue); display: flex; align-items: center; justify-content: space-between; padding: 0 6px;">
                <span>GESTURE FEED</span>
                <span class="pulse-dot" style="width: 4px; height: 4px; background: var(--neon-green); border-radius: 50%;"></span>
            </div>
            <canvas id="holo-hand-canvas" width="155" height="117" style="width: 100%; height: 100%; display: block; background: #000; filter: hue-rotate(140deg) brightness(1.2);"></canvas>
        `;
        
        const panel = document.querySelector(".holo-visualizer-panel");
        if (panel) panel.appendChild(overlayContainer);
    }
    
    if (overlayContainer.style.display !== "flex") {
        overlayContainer.style.display = "flex";
    }
    
    // 2. Load MediaPipe if needed
    if (!mediaPipeLoaded) {
        await loadMediaPipeScripts();
    }
    
    // 3. Initialize mpHands if not present
    if (!mpHands) {
        mpHands = new window.Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });
        
        mpHands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        mpHands.onResults((results) => {
            const canvas = document.getElementById("holo-hand-canvas");
            if (canvas) {
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                        drawHandSkeletonsOnOverlay(canvas, ctx, results.multiHandLandmarks, results.multiHandedness, results.image);
                        processTwoHandGestureDirectives(results.multiHandLandmarks, results.multiHandedness);
                    } else {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.fillStyle = "rgba(14, 2, 4, 0.65)";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.font = "8px Share Tech Mono";
                        ctx.fillStyle = "rgba(0, 240, 255, 0.5)";
                        ctx.textAlign = "center";
                        ctx.fillText("SCANNING FOR HANDS...", canvas.width / 2, canvas.height / 2);
                        
                        lastHandX = null;
                        lastHandY = null;
                        gestureZoomStart = null;
                        leftGestureZoomStart = null;
                        handCursorPos = null;
                    }
                }
            }
        });
    }
    
    // 4. Verify/Restart video stream
    let hasValidStream = false;
    if (videoEl.srcObject) {
        const tracks = videoEl.srcObject.getTracks();
        if (tracks.length > 0 && tracks.every(t => t.readyState === "live")) {
            hasValidStream = true;
        }
    }
    
    if (!hasValidStream) {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: "user" }
        });
        videoEl.srcObject = stream;
    }
    
    // 5. Ensure MediaPipe Camera is running
    if (!mpCamera) {
        mpCamera = new window.Camera(videoEl, {
            onFrame: async () => {
                if (isHandControlMode && videoEl.srcObject) {
                    const now = Date.now();
                    if (now - lastWebcamFrameTime >= 40 && !isProcessingFrame) {
                        lastWebcamFrameTime = now;
                        isProcessingFrame = true;
                        try {
                            await mpHands.send({ image: videoEl });
                        } catch (e) {
                            console.warn("MediaPipe inference error:", e);
                        } finally {
                            isProcessingFrame = false;
                        }
                    }
                }
            },
            width: 640,
            height: 480
        });
    }
    
    await mpCamera.start();
    console.log("[HOLO-SYSTEM]: Hand gesture system successfully verified and reconnected.");
}

async function toggleHandControlMode() {
    const btn = document.getElementById("holo-hand-toggle");
    if (!btn) return;
    
    if (!isHandControlMode) {
        try {
            btn.textContent = "INITIALIZING...";
            btn.style.borderColor = "var(--neon-blue)";
            btn.style.color = "var(--neon-blue)";
            
            isHandControlMode = true;
            await reconnectHandGestureSystem();
            
            btn.classList.remove("paused");
            btn.style.borderColor = "var(--neon-green)";
            btn.style.color = "var(--neon-green)";
            btn.textContent = "GESTURE MODE: ACTIVE";
            
            speak("Volumetric two hand gesture interface linked. Sir.");
            printSystemMessage("[HOLO-SYSTEM]: Dual-Hand controls successfully deployed. Right Hand: Open palm to zoom in, closed palm to zoom out, 4 fingers to navigate camera, 3 fingers to lock. Left Hand: select & move objects only.");
            
        } catch (err) {
            console.error("Failed to boot gesture matrix:", err);
            isHandControlMode = false;
            btn.classList.add("paused");
            btn.style.borderColor = "var(--neon-red)";
            btn.style.color = "var(--neon-red)";
            btn.textContent = "INACTIVE";
            
            const overlay = document.getElementById("holo-gesture-feed-container");
            if (overlay) overlay.style.display = "none";
            
            speak("Apologies Sir, I encountered a telemetry error coupling the camera array.");
            printSystemMessage(`[HOLO-SYSTEM ERROR]: Camera connection rejected or MediaPipe scripts unavailable: ${err.message || err}`);
        }
    } else {
        isHandControlMode = false;
        
        // Stop Camera Feed Tracks (shuts down webcam light)
        let videoEl = document.getElementById("holo-webcam-feed");
        if (videoEl && videoEl.srcObject) {
            const stream = videoEl.srcObject;
            stream.getTracks().forEach(track => track.stop());
            videoEl.srcObject = null;
        }
        
        // Stop and destroy MediaPipe Camera instance for clean re-initialization
        if (mpCamera) {
            try { mpCamera.stop(); } catch (e) { /* ignore */ }
            mpCamera = null;
        }
        
        let overlayContainer = document.getElementById("holo-gesture-feed-container");
        if (overlayContainer) overlayContainer.style.display = "none";
        
        btn.classList.add("paused");
        btn.style.borderColor = "var(--neon-red)";
        btn.style.color = "var(--neon-red)";
        btn.textContent = "INACTIVE";
        
        // Reset states
        handCursorPos = null;
        isHandPinching = false;
        pinchFrameCounter = 0;
        lastHandX = null;
        lastHandY = null;
        gestureZoomStart = null;
        leftGestureZoomStart = null;
        
        // Reset gesture lock and special mode flags to restore mouse/zoom controls
        isGestureLocked = false;
        leftHandSpecialMode = false;
        leftFistHoldFrames = 0;
        leftFistReleaseFrames = 0;
        leftFistLockout = false;
        leftPinchFrameCounter = 0;
        rightGestureHistory = [];
        leftGestureHistory = [];
        lastRightHandX = null;
        lastRightHandY = null;
        lastLeftHandX = null;
        lastLeftHandY = null;
        isDraggingVehicle = false;
        
        speak("Disengaging gesture interface.");
        printSystemMessage("[HOLO-SYSTEM]: Volumetric dual-hand controls deactivated.");
    }
}

// Visual Screenshot Handlers for BUG BRO
async function handleScreenshotSelection(e) {
    const file = e.target.files[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    if (uploadPreviewImg) uploadPreviewImg.src = objectUrl;
    if (uploadPreviewContainer) uploadPreviewContainer.classList.remove("hidden");
    playSFX(sfxBeep);

    const mode = connectionModeSelect ? connectionModeSelect.value : "online";
    if (mode === "offline") {
        printSystemMessage("[SYSTEM]: Deploying native offline macOS Vision OCR core to parse screenshot...");
        speak("Processing screenshot offline, Sir.");
    }

    printSystemMessage("[SYSTEM]: Transmitting screenshot payload to ALEX core...");
    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch("/api/upload", {
            method: "POST",
            body: formData
        });
        const result = await response.json();
        if (result.success) {
            activeUploadedImagePath = result.filepath;
            printSystemMessage("[SYSTEM]: Screenshot secured and indexed inside Stark core repository.");
        } else {
            printErrorMessage("[SYSTEM ERROR]: Failed to upload screenshot to Stark core.");
        }
    } catch (error) {
        console.error("Upload error:", error);
        printErrorMessage("[SYSTEM ERROR]: Core transmission connection timeout.");
    }
}

function clearScreenshotPreview() {
    activeUploadedImagePath = null;
    if (screenshotUploadInput) {
        screenshotUploadInput.value = "";
    }
    if (uploadPreviewContainer) {
        uploadPreviewContainer.classList.add("hidden");
    }
    if (uploadPreviewImg) {
        uploadPreviewImg.src = "";
    }
}
