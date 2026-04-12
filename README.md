# Ghostdiedie FE

Frontend for the webcam-based motion fighting game **Ghostdiedie**.
It renders the 3D battle scene with React + Three.js and converts actions from the local Python CV bridge into game input.

---

## Tech Stack

| Area | Tech |
|---|---|
| UI framework | React 19 |
| 3D rendering | Three.js / React Three Fiber / Drei |
| Physics engine | Rapier (react-three/rapier) |
| Styling | Tailwind CSS 4 |
| Build tool | Vite 8 |
| CV integration | WebSocket (local Python bridge) |
| Multiplayer | WebSocket + WebRTC |
| Backend API | REST (`api.ghostdiedie.club`) |

---

## Project Structure

```text
Ghostdiedie-FE/
├── src/
│   ├── app/            # AppFlow (routing & state management)
│   ├── api/            # Backend REST/WebSocket client
│   ├── room/           # Lobby, room create/join, character select pages
│   ├── game/
│   │   ├── GameScene.jsx         # Main game canvas
│   │   ├── components/           # Arena, Fighter, HUD, Camera
│   │   ├── hooks/                # CV input, movement, combat, multiplayer
│   │   └── constants/            # Game balance and character settings
│   ├── components/     # Shared UI components
│   └── assets/         # Character GLB models, backgrounds, etc.
├── public/
└── package.json
```

---

## Quick Start

### Prerequisites

- Node.js (with npm)
- Python 3.8+ (for the CV bridge)
- Webcam
- The `Ghostdiedie-CV` folder must be in the same parent directory

### Run

```bash
npm run dev
```

This starts the Vite dev server at `http://localhost:5173`.
If you want webcam motion controls, run the local CV bridge separately from `Ghostdiedie-CV`.

```bash
cd ../Ghostdiedie-CV
source .venv/bin/activate
python main.py
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `https://api.ghostdiedie.club` | Backend API URL |
| `VITE_API_KEY` | (none) | API auth key |
| `VITE_CV_BRIDGE_URL` | `ws://127.0.0.1:8765` | Local CV bridge WebSocket URL |

---

## Game Flow

1. **Landing** -> Start button
2. **Lobby** -> Enter name + upload face (generate profile image)
3. **Create/Join Room** -> Match with a room code
4. **Character Select** -> Pick one of blue / red / black / white
5. **Battle** -> Real-time fighting in a 3D arena

---

## Controls

| Action | CV (webcam) | Keyboard |
|---|---|---|
| Move | Raise left/right knees | W / A / S / D |
| Left punch | Extend the left wrist forward | Q |
| Right punch | Extend the right wrist forward | E |
| Kick | Raise and lower a knee | F |
| Jump | Bounce the body upward | Space |

---

## Build

```bash
npm run build    # Create a production build in dist/
npm run preview  # Preview the build locally
```

---

## Related Repository

- **Ghostdiedie-CV** - Local Python CV bridge (motion detection + WebSocket delivery)
