Got it ✅
Here’s the **full `README.md` file** content, exactly as you can save it into your project root.

---

````markdown
# ♟️ Alpha Omok – AI-Powered Gomoku on the Web

**Alpha Omok** is a modern web-based version of **Omok** (Gomoku), powered by **AI opponents** of different strengths.  
Inspired by **DeepMind’s AlphaGo**, the project combines a **FastAPI backend** (game rules, AI logic, training) with a **Next.js frontend** (interactive 15×15 board).

---

## 🌐 Live Demo (coming soon)

- 🎮 Play online against an AI opponent or another human.
- 🧠 Challenge **AI levels**: Beginner → Intermediate → Hard → Insane.
- 📈 Watch the **win probability** update in real time.

---

## 🧱 Tech Stack

- ⚙️ **Backend**: FastAPI (Python), with full Omok rules:

  - **Forbidden moves**: double-three (3×3) and overline.
  - Match persistence (JSONL store).
  - Training pipeline for continuous model improvement.

- 🖥️ **Frontend**: Next.js (React + TypeScript)

  - Interactive **15×15 board**, hoshi points, and move history.
  - Undo & reset options.
  - Scoreboard with **black vs white wins**.

- 🧠 **AI Engine**:

  - Beginner → heuristic/random moves.
  - Hard → smarter evaluation.
  - Insane → continuously improving **neural model** trained on played games.

- 🐳 **Docker**: Optional containerized setup for development & deployment.

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/your-username/alpha-omok.git
cd alpha-omok
```
````

### 2. Run with Docker (recommended)

```bash
docker-compose up --build
```

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:8000](http://localhost:8000)

### 3. Manual Setup (without Docker)

**Backend**:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend**:

```bash
cd frontend
npm install
export NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
npm run dev
```

---

## 📂 Project Structure

```
alpha-omok/
├── backend/                # FastAPI server
│   ├── app/
│   │   ├── omok.py         # Game logic & API
│   │   ├── ai/             # AI agents (heuristic, model-based)
│   │   ├── rules.py        # Omok rules (3×3, overline, etc.)
│   │   ├── train.py        # Training loop (continuous learning)
│   │   └── store.py        # Game storage
│   └── data/               # Stored games, models
│
├── frontend/               # Next.js UI
│   ├── src/
│   │   ├── app/page.tsx    # Main page
│   │   └── components/OmokBoard.tsx
│   └── public/             # Assets (logos, icons)
│
├── docker-compose.yml      # Multi-service setup
└── README.md
```

---

## 🎮 Gameplay

- **15×15 board** with stones placed on intersections.

- **Black moves first**.

- **Forbidden rules**:

  - Double three (3×3) not allowed.
  - Overline (6+ stones) not allowed.

- **Game ends** when:

  - A player connects exactly **5 stones in a row**.
  - A player resigns.

- **Extra features**:

  - Undo / Reset buttons.
  - Move history (jump to previous state).
  - Win counters (black vs white).
  - Real-time **win probability estimates**.

---

## 🔥 AI Levels

- **Beginner** → Random/naïve moves.
- **Intermediate** → Heuristic scoring.
- **Hard** → 1-ply lookahead & stronger heuristics.
- **Insane** → Uses a continuously trained **neural model** updated with every finished game.

---

## 📡 API Endpoints

- `POST /new` → Start a new game.
- `POST /play` → Place a stone (server validates rules & AI may respond).
- `POST /finish` → End game, store data, trigger training.
- `GET /state/{game_id}` → Retrieve full game state.
- `POST /eval` → Get win probabilities for current board.

---

## 🛠️ Roadmap

- [x] Interactive 15×15 board with rules.
- [x] Multi-level AI opponents.
- [x] Forbidden move enforcement (3×3, overline).
- [x] Persistent training from played games.
- [ ] Add Monte Carlo Tree Search (MCTS).
- [ ] Integrate policy/value neural nets for Insane AI.
- [ ] Deploy live demo (Vercel + Fly.io/Docker).

---

## 🤝 Contributing

Contributions are welcome!

- Fork the repo
- Create a new branch
- Submit a PR 🚀

---

## 📜 License

MIT License © 2025 – Your Name

```

---

✅ This is ready to drop as your `README.md`.
Would you also like me to **add a section with screenshots (using placeholders)** so that when you upload to GitHub, your repo looks more attractive visually?
```
