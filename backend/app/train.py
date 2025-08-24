from __future__ import annotations
from pathlib import Path
from typing import List, Dict, Any
import json
import torch, torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import numpy as np

SIZE = 15
DATA = Path("data/games.jsonl")
MODEL_PATH = Path("data/model.pth")
DATA.parent.mkdir(parents=True, exist_ok=True)

class _PolicyNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(3, 32, 3, padding=1), nn.ReLU(),
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(),
            nn.Conv2d(64, 64, 3, padding=1), nn.ReLU(),
            nn.Conv2d(64, 1, 1),
        )
    def forward(self, x):  # (B,3,15,15) -> (B,225)
        return self.net(x).flatten(1)

def append_game_record(size: int, moves: List[Dict[str, int]], winner: int):
    rec = {"size": size, "moves": moves, "winner": int(winner)}
    with DATA.open("a") as f:
        f.write(json.dumps(rec) + "\n")

def _load_records():
    if not DATA.exists(): return []
    items=[]
    with DATA.open() as f:
        for line in f:
            try: items.append(json.loads(line))
            except: pass
    return items

class _Dataset(Dataset):
    def __init__(self, records: List[Dict[str, Any]]):
        self.samples=[]
        for g in records:
            if g.get("size") != SIZE:   # keep 15x15 for now
                continue
            board=[[0]*SIZE for _ in range(SIZE)]
            for mv in g["moves"]:
                x,y,p = mv["x"], mv["y"], mv["p"]
                # sample is BEFORE making this move
                self.samples.append(( [row[:] for row in board], p, y*SIZE+x, 1.5 if p==g["winner"] else 1.0 ))
                board[y][x]=p
    def __len__(self): return len(self.samples)
    def __getitem__(self, i):
        board, p, tgt, w = self.samples[i]
        b = np.array(board, dtype=np.int64)
        black=(b==1).astype("float32")
        white=(b==2).astype("float32")
        cur  = (1.0 if p==1 else -1.0) * np.ones_like(black, dtype="float32")
        x = torch.tensor([black,white,cur])
        y = torch.tensor(tgt, dtype=torch.long)
        w = torch.tensor(w, dtype=torch.float32)
        return x, y, w

def train_step(device="cpu", epochs=2, batch=256):
    recs=_load_records()
    ds=_Dataset(recs)
    if len(ds)==0: return {"trained":0,"samples":0}

    dl=DataLoader(ds,batch_size=batch,shuffle=True,drop_last=False)
    model=_PolicyNet().to(device)
    if MODEL_PATH.exists():
        model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
    model.train()

    opt=torch.optim.Adam(model.parameters(), lr=2e-3)
    loss_fn=nn.CrossEntropyLoss(reduction="none")

    total=0.0; steps=0
    for _ in range(epochs):
        for xb,yb,wb in dl:
            xb=xb.to(device); yb=yb.to(device); wb=wb.to(device)
            opt.zero_grad()
            logits=model(xb)
            loss=(loss_fn(logits,yb)*wb).mean()
            loss.backward(); opt.step()
            total+=loss.item(); steps+=1

    model.eval()
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), MODEL_PATH)
    return {"trained": steps, "samples": len(ds), "loss": total/max(1,steps)}
