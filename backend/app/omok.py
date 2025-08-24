from fastapi import FastAPI, HTTPException
from .schemas import *  # NewGameRequest, NewGameResponse, PlayRequest, FinishRequest, StateResponse
from .store import GameStore
from .ai.ai import make_ai, AIAgent
from .rules import is_double_three_illegal, is_overline_illegal
from .train import append_game_record, train_step
from .ai.model_agent import ModelAgent
import os, time, uuid

app = FastAPI()
STORE = GameStore(path="data/games.jsonl")
SESS = {}  # game_id -> session dict

def gid() -> str:
    return f"{time.strftime('%Y%m%d-%H%M%S')}_{uuid.uuid4().hex[:4]}"

@app.post("/new", response_model=NewGameResponse)
def new_game(req: NewGameRequest):
    game_id = gid()
    ai_color = req.ai_color if (req.ai_enabled and req.ai_color in (1, 2)) else (2 if req.ai_enabled else None)

    # Only Insane uses the model; others use heuristic AI
    if req.ai_enabled and str(req.ai_level).lower() == "insane":
        ai: AIAgent = ModelAgent(size=req.size)
        model_version = ai.model_version
    else:
        ai = make_ai(level=req.ai_level, size=req.size)
        model_version = "heuristic"

    SESS[game_id] = {
        "size": req.size,
        "board": [[0] * req.size for _ in range(req.size)],
        "moves": [],
        "winner": 0,
        "current": 1,               # Black starts
        "ai": ai,
        "ai_color": ai_color,       # 1=black, 2=white, or None
        "ai_level": req.ai_level,   # for metadata
        "model_version": model_version,
    }
    return NewGameResponse(game_id=game_id, ai_color=ai_color, model_version=model_version)

def in_bounds(size: int, x: int, y: int) -> bool:
    return 0 <= x < size and 0 <= y < size

@app.post("/play", response_model=StateResponse)
def play(req: PlayRequest):
    s = SESS.get(req.game_id)
    if not s:
        raise HTTPException(404, "game not found")
    size = s["size"]

    if s["winner"]:
        return _state(req.game_id)
    if not in_bounds(size, req.x, req.y):
        raise HTTPException(400, "oob")
    if s["board"][req.y][req.x] != 0:
        raise HTTPException(400, "occupied")
    if req.p != s["current"]:
        raise HTTPException(400, "wrong turn")

    # 3×3 + Overline checks on human move
    if is_double_three_illegal(s["board"], req.x, req.y, req.p):
        raise HTTPException(400, "illegal double-three")
    if is_overline_illegal(s["board"], req.x, req.y, req.p):
        raise HTTPException(400, "illegal overline")

    # Apply human move
    s["board"][req.y][req.x] = req.p
    s["moves"].append({"x": req.x, "y": req.y, "p": req.p})
    if _wins_exact_five(s["board"], req.x, req.y, req.p):
        s["winner"] = req.p
    else:
        s["current"] = 2 if s["current"] == 1 else 1

    # AI move if AI's turn
    if not s["winner"] and s["ai_color"] == s["current"]:
        ax, ay, info = s["ai"].move(s["board"], s["current"])  # both agents should avoid illegals
        # Final guard: avoid illegal (shouldn't trigger normally)
        if is_double_three_illegal(s["board"], ax, ay, s["current"]) or is_overline_illegal(s["board"], ax, ay, s["current"]):
            played = False
            for yy in range(size):
                for xx in range(size):
                    if s["board"][yy][xx] != 0: 
                        continue
                    if is_double_three_illegal(s["board"], xx, yy, s["current"]): 
                        continue
                    if is_overline_illegal(s["board"], xx, yy, s["current"]): 
                        continue
                    ax, ay = xx, yy
                    played = True
                    break
                if played: break
            if not played:
                return _state(req.game_id)

        s["board"][ay][ax] = s["current"]
        s["moves"].append({"x": ax, "y": ay, "p": s["current"]})
        if _wins_exact_five(s["board"], ax, ay, s["current"]):
            s["winner"] = s["current"]
        else:
            s["current"] = 2 if s["current"] == 1 else 1

    return _state(req.game_id)

@app.post("/finish")
def finish(req: FinishRequest):
    """
    Called at the end of a game (ALL levels). Saves and fine-tunes.
    """
    s = SESS.get(req.game_id)
    if not s:
        raise HTTPException(404, "game not found")

    s["winner"] = req.winner

    # Persist to your store
    STORE.append_game(
        game_id=req.game_id, size=s["size"], moves=s["moves"],
        winner=s["winner"], resign=req.resign,
        meta={"model_version": s["model_version"], "ai_level": s.get("ai_level")}
    )

    # Append to model training data (always, any level)
    append_game_record(size=s["size"], moves=s["moves"], winner=int(s["winner"]))

    # Lightweight auto-train
    auto = os.getenv("AUTO_TRAIN", "1") != "0"
    stats = train_step(epochs=2, batch=256) if auto else {"trained": 0, "samples": 0}
    return {"ok": True, "trained": stats}

@app.get("/state/{game_id}", response_model=StateResponse)
def state(game_id: str):
    return _state(game_id)

def _state(game_id: str) -> StateResponse:
    s = SESS.get(game_id)
    if not s:
        raise HTTPException(404, "game not found")
    return StateResponse(
        game_id=game_id, board=s["board"], moves=s["moves"],
        winner=s["winner"], current=s["current"]
    )

# ----- EXACT five (no overline wins) -----
def _wins_exact_five(board, x, y, p) -> bool:
    DIRS = [(1,0), (0,1), (1,1), (1,-1)]
    n = len(board)
    def count_dir(dx, dy):
        c = 1
        # forward
        i = 1
        while True:
            xx, yy = x + dx*i, y + dy*i
            if 0 <= xx < n and 0 <= yy < n and board[yy][xx] == p:
                c += 1; i += 1
            else: break
        # backward
        i = 1
        while True:
            xx, yy = x - dx*i, y - dy*i
            if 0 <= xx < n and 0 <= yy < n and board[yy][xx] == p:
                c += 1; i += 1
            else: break
        return c
    for dx, dy in DIRS:
        if count_dir(dx, dy) == 5:
            return True
    return False
