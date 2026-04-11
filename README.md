# Ghostdiedie FE

웹캠 기반 모션 인식 격투 게임 **Ghostdiedie**의 프론트엔드입니다.
React + Three.js로 3D 대전 씬을 렌더링하고, 로컬 Python CV 브리지에서 전달받은 동작을 게임 입력으로 변환합니다.

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| UI 프레임워크 | React 19 |
| 3D 렌더링 | Three.js / React Three Fiber / Drei |
| 물리 엔진 | Rapier (react-three/rapier) |
| 스타일링 | Tailwind CSS 4 |
| 빌드 도구 | Vite 8 |
| CV 연동 | WebSocket (로컬 Python 브리지) |
| 멀티플레이어 | WebSocket + WebRTC |
| 백엔드 API | REST (`api.ghostdiedie.club`) |

---

## 프로젝트 구조

```
Ghostdiedie-FE/
├── diedie              # 원커맨드 실행 스크립트 (CV + FE 동시 기동)
├── src/
│   ├── app/            # AppFlow (라우팅 & 상태 관리)
│   ├── api/            # 백엔드 REST/WebSocket 클라이언트
│   ├── room/           # 로비, 방 생성/참가, 캐릭터 선택 페이지
│   ├── game/
│   │   ├── GameScene.jsx         # 메인 게임 Canvas
│   │   ├── components/           # Arena, Fighter, HUD, Camera
│   │   ├── hooks/                # CV 입력, 이동, 전투, 멀티플레이어
│   │   └── constants/            # 게임 밸런스, 캐릭터 설정
│   ├── components/     # 공용 UI 컴포넌트
│   └── assets/         # 캐릭터 GLB 모델, 배경 등
├── public/
└── package.json
```

---

## 빠른 시작

### 사전 요구 사항

- Node.js (npm 포함)
- Python 3.8+ (CV 브리지 용)
- 웹캠
- `Ghostdiedie-CV` 폴더가 같은 상위 디렉토리에 위치

### 실행

```bash
# 한 번에 CV 브리지 + 프론트 개발 서버 모두 시작
npm run dev
```

이 명령은 `./diedie` 스크립트를 실행합니다:
1. CV 가상환경 생성 및 의존성 설치 (최초 1회)
2. FE `node_modules` 설치 (최초 1회)
3. CV 브리지 실행 (`ws://127.0.0.1:8765`)
4. Vite 개발 서버 실행 (`http://localhost:5173`)

### 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `VITE_API_BASE_URL` | `https://api.ghostdiedie.club` | 백엔드 API 주소 |
| `VITE_API_KEY` | (없음) | API 인증 키 |
| `CV_BRIDGE_HOST` | `127.0.0.1` | CV 브리지 호스트 |
| `CV_BRIDGE_PORT` | `8765` | CV 브리지 포트 |
| `CV_SHOW_WINDOW` | `0` | `1`로 설정 시 CV 디버그 창 표시 |
| `FE_DEV_PORT` | `5173` | 프론트 개발 서버 포트 |

---

## 게임 플로우

1. **랜딩** → 시작 버튼
2. **로비** → 이름 입력 + 얼굴 업로드 (프로필 이미지 생성)
3. **방 생성/참가** → 방 코드로 매칭
4. **캐릭터 선택** → blue / red / black / white 중 택 1
5. **대전** → 3D 아레나에서 실시간 격투

---

## 조작법

| 동작 | CV (웹캠) | 키보드 |
|---|---|---|
| 이동 | 좌우 무릎 들기 | W / A / S / D |
| 왼손 펀치 | 왼 손목을 앞으로 뻗기 | Q |
| 오른손 펀치 | 오른 손목을 앞으로 뻗기 | E |
| 킥 | 무릎을 들었다 내리기 | F |
| 점프 | 몸을 위로 튕기기 | Space |

---

## 빌드

```bash
npm run build    # dist/ 에 프로덕션 빌드 생성
npm run preview  # 빌드 결과물 로컬 미리보기
```

---

## 관련 저장소

- **Ghostdiedie-CV** — 로컬 Python CV 브리지 (동작 감지 + WebSocket 전송)
