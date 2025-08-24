from pydantic import BaseModel
from typing import List, Optional, Literal

Player = Literal[1, 2]

class Move(BaseModel):
    x: int
    y: int
    p: Player

class NewGameRequest(BaseModel):
    ai_enabled: bool = True
    ai_level: Literal["beginner","intermediate","hard","insane"] = "beginner"
    ai_color: Optional[Player] = None        # None = auto-assign; 1 or 2 = fixed
    size: int = 15

class NewGameResponse(BaseModel):
    game_id: str
    ai_color: Optional[Player]
    model_version: str

class PlayRequest(BaseModel):
    game_id: str
    x: int
    y: int
    p: Player

class AIReply(BaseModel):
    x: int
    y: int
    p: Player
    info: dict

class StateResponse(BaseModel):
    game_id: str
    board: List[List[int]]
    moves: List[Move]
    winner: int
    current: Player

class FinishRequest(BaseModel):
    game_id: str
    winner: Player
    resign: bool = False
