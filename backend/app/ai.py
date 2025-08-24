from typing import Tuple, Dict, Any, Optional
import random

LEVEL_CONF = {
  "beginner":     {"sims": 40,  "explore": 1.2, "noise": 0.30},
  "intermediate": {"sims": 120, "explore": 1.1, "noise": 0.15},
  "hard":         {"sims": 400, "explore": 1.0, "noise": 0.05},
  "insane":       {"sims": 1200,"explore": 1.0, "noise": 0.00},
}

class AIAgent:
  def __init__(self, size: int, sims: int, explore: float, noise: float):
    self.size=size; self.sims=sims; self.c_puct=explore; self.noise=noise
    # TODO: load NN policy/value here in Phase 2

  def move(self, board, player, ensure_legal=False) -> Tuple[int,int,Dict[str,Any]]:
    # Minimal placeholder: pick from top-k heuristic / random with noise.
    cand = self._heuristic_candidates(board, player)
    if self.noise>0 and random.random()<self.noise: random.shuffle(cand)
    x,y = cand[0]
    return x,y,{"policy":"heuristic","picked_from":len(cand)}

  def _heuristic_candidates(self, board, p):
    n=self.size
    empties=[]
    for y in range(n):
      for x in range(n):
        if board[y][x]==0: empties.append((x,y))
    # simple center bias
    cx=cy=(n-1)/2
    empties.sort(key=lambda xy: (xy[0]-cx)**2 + (xy[1]-cy)**2)
    return empties

def make_ai(level: str, size: int) -> AIAgent:
  cfg=LEVEL_CONF[level]
  return AIAgent(size=size, sims=cfg["sims"], explore=cfg["explore"], noise=cfg["noise"])
