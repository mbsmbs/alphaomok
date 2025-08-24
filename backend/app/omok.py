from fastapi import FastAPI, HTTPException
from .schemas import *
from .store import GameStore
from .ai import make_ai, AIAgent
import time, uuid

app = FastAPI()
STORE = GameStore(path="data/games.jsonl")
SESS = {}  # game_id -> session state in memory

def gid(): return f"{time.strftime('%Y%m%d-%H%M%S')}_{uuid.uuid4().hex[:4]}"

@app.post("/new", response_model=NewGameResponse)
def new_game(req: NewGameRequest):
    game_id = gid()
    ai_color = req.ai_color  # None, 1 or 2
    if req.ai_enabled and ai_color not in (1,2):
        # by default let the human pick color on client; or assign AI=2
        ai_color = 2
    SESS[game_id] = {
        "size": req.size,
        "board": [[0]*req.size for _ in range(req.size)],
        "moves": [],
        "winner": 0,
        "current": 1,
        "ai": make_ai(level=req.ai_level, size=req.size),
        "ai_color": ai_color,
        "model_version": "v0-mcts"  # update when you deploy new nets
    }
    return NewGameResponse(game_id=game_id, ai_color=ai_color, model_version="v0-mcts")

def in_bounds(size,x,y): return 0<=x<size and 0<=y<size

@app.post("/play", response_model=StateResponse)
def play(req: PlayRequest):
    s = SESS.get(req.game_id)
    if not s: raise HTTPException(404, "game not found")
    size = s["size"]
    if s["winner"]: return _state(req.game_id)
    if not in_bounds(size, req.x, req.y): raise HTTPException(400, "oob")
    if s["board"][req.y][req.x] != 0: raise HTTPException(400, "occupied")
    if req.p != s["current"]: raise HTTPException(400, "wrong turn")

    # server-side 3x3 rule (reuse your TS logic ported to py)
    from .rules import is_double_three_illegal
    if is_double_three_illegal(s["board"], req.x, req.y, req.p):
        raise HTTPException(400, "illegal double-three")

    # apply human move
    s["board"][req.y][req.x] = req.p
    s["moves"].append({"x":req.x,"y":req.y,"p":req.p})
    if _check_win(s["board"], req.x, req.y, req.p): s["winner"] = req.p
    else: s["current"] = 1 if s["current"]==2 else 2

    # AI move if it's AI's turn
    if not s["winner"] and s["ai_color"] == s["current"]:
        ax, ay, info = s["ai"].move(s["board"], s["current"])
        if is_double_three_illegal(s["board"], ax, ay, s["current"]):
            # fallback: select next best legal move from AI
            ax, ay, info = s["ai"].move(s["board"], s["current"], ensure_legal=True)
        s["board"][ay][ax] = s["current"]
        s["moves"].append({"x":ax,"y":ay,"p":s["current"]})
        if _check_win(s["board"], ax, ay, s["current"]): s["winner"] = s["current"]
        else: s["current"] = 1 if s["current"]==2 else 2

    return _state(req.game_id)

@app.post("/finish")
def finish(req: FinishRequest):
    s = SESS.get(req.game_id)
    if not s: raise HTTPException(404, "game not found")
    s["winner"] = req.winner
    # persist game
    STORE.append_game(
      game_id=req.game_id, size=s["size"], moves=s["moves"],
      winner=s["winner"], resign=req.resign,
      meta={"model_version": s["model_version"]}
    )
    return {"ok": True}

@app.get("/state/{game_id}", response_model=StateResponse)
def state(game_id: str): return _state(game_id)

def _state(game_id):
    s = SESS.get(game_id)
    if not s: raise HTTPException(404, "game not found")
    return StateResponse(game_id=game_id, board=s["board"], moves=s["moves"],
                         winner=s["winner"], current=s["current"])

# --- helpers ---
def _check_win(board, x, y, p):
    # 5-in-a-row; same logic as TS
    DIRS=[(1,0),(0,1),(1,1),(1,-1)]
    n=len(board)
    def cnt(dx,dy):
        c=1
        for sign in (1,-1):
            i=1
            while True:
                xx=x+dx*i*sign; yy=y+dy*i*sign
                if 0<=xx<n and 0<=yy<n and board[yy][xx]==p: c+=1; i+=1
                else: break
        return c
    return any(cnt(dx,dy)>=5 for dx,dy in DIRS)
