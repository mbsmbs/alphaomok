from __future__ import annotations
from typing import Tuple, Dict, Any, List
import torch, numpy as np
from ..rules import is_double_three_illegal, is_overline_illegal

SIZE = 15
MODEL_PATH = "data/model.pth"

class _PolicyNet(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.net = torch.nn.Sequential(
            torch.nn.Conv2d(3, 32, 3, padding=1), torch.nn.ReLU(),
            torch.nn.Conv2d(32, 64, 3, padding=1), torch.nn.ReLU(),
            torch.nn.Conv2d(64, 64, 3, padding=1), torch.nn.ReLU(),
            torch.nn.Conv2d(64, 1, 1),
        )
    def forward(self, x):  # (B,3,15,15) -> (B,225)
        return self.net(x).flatten(1)

def _board_to_tensor(board: List[List[int]], player: int, device="cpu"):
    b = np.array(board, dtype=np.int64)
    black = (b == 1).astype("float32")
    white = (b == 2).astype("float32")
    cur   = (1.0 if player == 1 else -1.0) * np.ones_like(black, dtype="float32")
    return torch.tensor([black, white, cur]).unsqueeze(0).to(device)

class ModelAgent:
    """Model-backed AI used only for 'Insane' level."""
    def __init__(self, size: int = 15, device: str = "cpu"):
        self.size = size
        self.device = device
        self.model = _PolicyNet().to(device)
        self.model_version = "policy-cnn-v1"
        try:
            self.model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
        except Exception:
            pass
        self.model.eval()

    def move(self, board, player, ensure_legal: bool = True) -> Tuple[int, int, Dict[str, Any]]:
        x = _board_to_tensor(board, player, self.device)
        with torch.no_grad():
            logits = self.model(x)[0]  # (225,)

        # Mask illegal (occupied, 3×3, overline)
        mask = torch.full_like(logits, float("-inf"))
        for y in range(self.size):
            for x_ in range(self.size):
                if board[y][x_] != 0:
                    continue
                if ensure_legal and is_double_three_illegal(board, x_, y, player):
                    continue
                if ensure_legal and is_overline_illegal(board, x_, y, player):
                    continue
                mask[y * self.size + x_] = logits[y * self.size + x_]

        if torch.isneginf(mask).all():
            # fallback: first available legal
            for y in range(self.size):
                for x_ in range(self.size):
                    if board[y][x_] == 0 and \
                       not is_double_three_illegal(board, x_, y, player) and \
                       not is_overline_illegal(board, x_, y, player):
                        return x_, y, {"policy": "fallback"}
            raise RuntimeError("no legal moves")

        idx = int(torch.argmax(mask).item())
        ax, ay = idx % self.size, idx // self.size
        return ax, ay, {"policy": "greedy", "model_version": self.model_version}
