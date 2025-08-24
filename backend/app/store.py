import json, os, time
from typing import List, Dict, Any

class GameStore:
  def __init__(self, path="data/games.jsonl"):
    self.path = path
    os.makedirs(os.path.dirname(path), exist_ok=True)

  def append_game(self, game_id: str, size: int, moves: List[Dict[str,int]],
                  winner: int, resign: bool, meta: Dict[str,Any]):
    rec = {
      "game_id": game_id,
      "size": size,
      "rules": {"double_three": True},
      "moves": moves,
      "winner": winner,
      "resign": resign,
      "duration_ms": None,
      "meta": meta
    }
    with open(self.path, "a") as f:
      f.write(json.dumps(rec) + "\n")
