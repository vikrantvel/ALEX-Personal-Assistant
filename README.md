

```markdown
# ALEX — AI Personal Assistant HUD

> *"An Iron Man-style JARVIS interface for your desktop."*

ALEX is a full-stack AI assistant with a holographic HUD frontend, real-time streaming backend, dual online/offline AI modes, a 3D hologram simulation engine, and full hand gesture control — all running in the browser.

---

## Features

### Core HUD Interface
- Rotating 3D Octagonal Glass Prism centerpiece (pure Canvas 2D — no WebGL)
- Real-time WebSocket streaming responses from AI
- STOP button to interrupt AI mid-response with instant TTS cancellation
- Throttled to 18 FPS for near-zero CPU usage (~0.1% active, 0% minimized)
- UK male Text-to-Speech voice output

### AI Modes
| Mode | Engine | Model |
|---|---|---|
| Online | Gemini API | Gemini 1.5 / 2.0 |
| Offline | Ollama (local) | deepseek-r1:8b (or any Ollama model) |

- Structured reasoning protocol: Request Deconstruction → Scenario Analysis → Simulation → Answer
- Sliding **"COMPILING LOGIC PATTERNS"** thought stream panel
- **CORE ALEX TACTICAL PROTOCOL** — direct, crisp output mode

### Holo-Simulation Module
Full-screen 3D holographic visualizer workspace, activated via `HOLO-SIMULATION` directive.

**6 base shape visualizers:**
- Torus, DNA Helix, Arc Reactor Core, Quantum Tesseract, Cyber Network Map, Holographic Sphere

**150+ keyword-driven 3D scenario generator:**
- **Vehicles** — Car, Truck, Bus, Motorcycle, SUV (with wheel spin physics, suspension bobbing, exhaust sparks, lane-changing AI)
- **Humans** — Male, Female, Child (with walking gait animation)
- **Buildings** — Skyscraper, Tower, Pyramid, Castle, House, Windmill (spinning blades)
- **Environments** — Valley, Neon Highway, Ocean Waves, Storm, Volcano, Forest, Desert, Space, City Skyline

**Interactive controls:**
- Mouse drag to reposition any entity in 3D space
- Scroll wheel for Z-depth control
- Auto-rotate toggle
- Per-entity Animate / Freeze / Delete controls
- Spatial parser: handles `"bike left car right man front"` without punctuation

**Holo Console:** Right-side sidebar streams AI analysis of typed directives in real time.

### Hand Gesture Control (MediaPipe)
Full two-hand webcam control — no hardware required.

| Hand | Role | Gesture → Action |
|---|---|---|
| Right | Camera Core | Open palm → zoom in · Fist → zoom out · 3 fingers → lock screen · 4 fingers → rotate view |
| Left | Object Core | Pinch → grab & move objects · Fist (hold 15 frames) → toggle Tactical Mode |

**Tactical Mode:** Freezes auto-rotation; right hand controls view, left hand controls objects exclusively.

**Technical highlights:**
- 2D-only joint math (ignores noisy monocular Z depth)
- Geometric segment-sum finger extension detection
- 5-frame majority-vote debouncer (eliminates jitter)
- 25 FPS webcam throttle + semaphore concurrency lock
- Camera-safe spatial L/R hand sorting

**Visual overlays:**
- Skeletal hand drawing on GESTURE FEED webcam overlay
- Floating wrist HUD role tags (`R-CORE: CAMERA`, `L-CORE: OBJECTS`)
- EMA-smoothed holographic cursor with cyan hover ring and red grab alert
- 3D laser link line + concentric focus rings on grabbed objects
- Pulsing gold Tactical Mode banner

### BUG BRO — Cybersecurity Copilot
Triggered via `/bugbro` or the **SYSTEM INTRUSION DIRECTIVES** panel.
- Patient cybersecurity mentor guiding through legal, sandboxed environments (OWASP Juice Shop, DVWA)
- Scoped strictly to ethical, educational use — will not assist with real-world target recon

### Screenshot / Vision Analysis
- **Online:** Gemini native multimodal vision
- **Offline:** Custom Swift binary using Apple Vision Framework — extracts screen text in <50ms, injected as system context into the local model (bypasses text-only model limitations)
- Upload button with glassmorphic thumbnail preview in terminal UI

### Security
- XSS vulnerability patched — `escapeHTML()` sanitizer on all console `innerHTML` rendering

---

## Performance
| Metric | Value |
|---|---|
| Active CPU | ~0.1–0.2% |
| Minimized CPU | 0% (render loop pauses) |
| Render target | 18–20 FPS (throttled) |
| Memory strategy | Pre-allocated vertex cache, O(1) trig caching |

---

## Tech Stack
| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, Uvicorn, WebSockets |
| Frontend | Vanilla JS, HTML5 Canvas 2D, CSS |
| AI (Online) | Google Gemini API |
| AI (Offline) | Ollama + deepseek-r1:8b |
| Gesture Control | MediaPipe Hands (CDN lazy-loaded) |
| OCR (Offline) | Swift + Apple Vision Framework |

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js (optional, for any build tooling)
- [Ollama](https://ollama.com) installed and running (for offline mode)
- A Gemini API key (for online mode)
- macOS (for offline OCR via Swift binary) — online mode works cross-platform

### Installation

```bash
# Clone the repo
git clone https://github.com/vikrantvel/alex.git
cd alex

# Install Python dependencies
pip install fastapi uvicorn google-generativeai ollama

# Pull the local model (offline mode)
ollama pull deepseek-r1:8b
```

### Configuration
Create a `.env` file in the root:
```env
GEMINI_API_KEY=your_api_key_here
```

### Run
```bash
uvicorn server:app --reload
```
Then open `http://localhost:8000` in your browser.

---

## Usage

| Directive | Action |
|---|---|
| Type any query | ALEX responds with streamed AI output + TTS |
| `HOLO-SIMULATION` | Opens the 3D hologram workspace |
| Type scene description | Auto-generates matching 3D wireframe entities |
| `/bugbro` | Activates BUG BRO cybersecurity copilot |
| Upload screenshot | Vision analysis (online) or OCR injection (offline) |
| Enable webcam | Activates two-hand gesture control |

---

## Project Structure
```
alex/
├── server.py          # FastAPI backend, WebSocket handler, AI routing
├── app.py             # App entry point
├── static/
│   ├── index.html     # HUD layout
│   ├── style.css      # Glassmorphism UI styles
│   └── app.js         # Canvas engine, gesture control, holo-sim, all frontend logic
└── ocr               # Compiled Swift binary for offline OCR (macOS)
```


---

## License
MIT License — see [LICENSE](LICENSE) for details.

---

> Built by [Vikrantvel S P](https://github.com/vikrantvel)
```


