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
├── diedie              # One-command startup script (CV + FE together)
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
# Start both the CV bridge and frontend dev server
npm run dev
```

This command runs the `./diedie` script:
1. Create the CV virtual environment and install dependencies (first run only)
2. Install FE `node_modules` (first run only)
3. Start the CV bridge (`ws://127.0.0.1:8765`)
4. Start the Vite dev server (`http://localhost:5173`)

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `https://api.ghostdiedie.club` | Backend API URL |
| `VITE_API_KEY` | (none) | API auth key |
| `CV_BRIDGE_HOST` | `127.0.0.1` | CV bridge host |
| `CV_BRIDGE_PORT` | `8765` | CV bridge port |
| `CV_SHOW_WINDOW` | `0` | Show the CV debug window when set to `1` |
| `FE_DEV_PORT` | `5173` | Frontend dev server port |

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
