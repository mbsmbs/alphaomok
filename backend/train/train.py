# backend/train/train.py
import json, torch, random
from torch import nn, optim
from pathlib import Path

class PVNet(nn.Module):
    def __init__(self, size=15, channels=64, blocks=12):
        super().__init__()
        C=channels
        self.conv_in = nn.Conv2d(3, C, 3, padding=1)  # planes: current stones, opp stones, ones
        self.res = nn.Sequential(*[Residual(C) for _ in range(blocks)])
        self.policy = nn.Sequential(nn.Conv2d(C, 2, 1), nn.ReLU(),
                                    nn.Flatten(), nn.Linear(2*size*size, size*size))
        self.value  = nn.Sequential(nn.Conv2d(C, 1, 1), nn.ReLU(),
                                    nn.Flatten(), nn.Linear(size*size, 256),
                                    nn.ReLU(), nn.Linear(256,1), nn.Tanh())
    def forward(self, x):
        h = torch.relu(self.conv_in(x))
        h = self.res(h)
        p = self.policy(h)
        v = self.value(h)
        return p, v

class Residual(nn.Module):
    def __init__(self, C):
        super().__init__()
        self.c1 = nn.Conv2d(C,C,3,padding=1); self.b1=nn.BatchNorm2d(C)
        self.c2 = nn.Conv2d(C,C,3,padding=1); self.b2=nn.BatchNorm2d(C)
    def forward(self,x):
        y=torch.relu(self.b1(self.c1(x)))
        y=self.b2(self.c2(y))
        return torch.relu(x+y)

def encode_position(size, moves, to_play):
    # returns 3×H×W tensor: current, opp, ones
    import numpy as np
    b=np.zeros((3,size,size), dtype=np.float32)
    cur, opp = (1,2) if to_play==1 else (2,1)
    board=np.zeros((size,size), dtype=int)
    for m in moves: board[m["y"]][m["x"]]=m["p"]
    b[0] = (board==cur).astype(np.float32)
    b[1] = (board==opp).astype(np.float32)
    b[2] = 1.0
    return torch.from_numpy(b)

def load_games(path):
    for line in Path(path).read_text().splitlines():
        yield json.loads(line)

def train_step(net, batch, opt):
    x, targ_p, targ_v = batch  # shapes: [B,3,H,W], [B,A], [B,1]
    p, v = net(x)
    loss = nn.CrossEntropyLoss()(p, targ_p.argmax(dim=1)) + nn.MSELoss()(v, targ_v)
    opt.zero_grad(); loss.backward(); opt.step()
    return float(loss)

def main():
    net = PVNet()
    opt = optim.AdamW(net.parameters(), lr=1e-3, weight_decay=1e-4)
    # TODO: build mini-batches from games.jsonl (with MCTS targets if available)
    # save to models/alphaomok_v01.pt
    Path("models").mkdir(exist_ok=True)
    torch.save(net.state_dict(), "models/alphaomok_v01.pt")

if __name__ == "__main__":
    main()
