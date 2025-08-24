# backend/app/rules.py
from typing import List, Tuple

SIZE = 15
DIRS: List[Tuple[int, int]] = [(1,0), (0,1), (1,1), (1,-1)]

def in_bounds(x: int, y: int) -> bool:
    return 0 <= x < SIZE and 0 <= y < SIZE

# ---------- 3×3 (double-three) helpers ----------
def build_line_with_candidate(board, cx, cy, dx, dy, player):
    # Walk to the start of this line segment
    x, y = cx, cy
    while in_bounds(x - dx, y - dy):
        x -= dx; y -= dy
    arr = []
    cidx = -1
    while in_bounds(x, y):
        if x == cx and y == cy:
            arr.append(1)        # candidate stone for 'player'
            cidx = len(arr) - 1
        else:
            v = board[y][x]
            arr.append(0 if v == 0 else (1 if v == player else 2))
        x += dx; y += dy
    return arr, cidx

def count_open_threes_in_line(arr: list[int], cidx: int) -> int:
    """Counts open-threes in a 1D line that include the candidate index."""
    cnt = 0
    # classic length-5 pattern: 0 1 1 1 0
    for i in range(0, len(arr) - 4):
        if i <= cidx < i + 5 and arr[i:i+5] == [0,1,1,1,0]:
            cnt += 1
    # length-6 patterns: 0 1 0 1 1 0  OR  0 1 1 0 1 0
    for i in range(0, len(arr) - 5):
        if i <= cidx < i + 6:
            w = arr[i:i+6]
            if w == [0,1,0,1,1,0] or w == [0,1,1,0,1,0]:
                cnt += 1
    # generalized: any 3-consecutive with two open ends in a length-7 window
    for i in range(0, len(arr) - 6):
        if not (i <= cidx < i + 7): 
            continue
        w = arr[i:i+7]
        for j in range(1, 5):
            if w[j:j+3] == [1,1,1] and w[j-1] == 0 and w[j+3] == 0:
                cnt += 1
    return cnt

def count_open_threes(board, x, y, player) -> int:
    total = 0
    for dx, dy in DIRS:
        arr, cidx = build_line_with_candidate(board, x, y, dx, dy, player)
        total += count_open_threes_in_line(arr, cidx)
    return total

def is_double_three_illegal(board, x, y, player) -> bool:
    if board[y][x] != 0:
        return False
    return count_open_threes(board, x, y, player) >= 2

# ---------- Overline (6+) helpers ----------
def _run_len(board, x, y, dx, dy, p) -> int:
    """Consecutive stones for player p moving from (x,y) outward (exclusive)."""
    n = 0
    xx, yy = x + dx, y + dy
    while 0 <= xx < SIZE and 0 <= yy < SIZE and board[yy][xx] == p:
        n += 1
        xx += dx; yy += dy
    return n

def is_overline_illegal(board, x, y, p) -> bool:
    """True iff placing p at (x,y) makes >5 in a row in ANY direction."""
    if board[y][x] != 0: 
        return False
    for dx, dy in DIRS:
        total = 1 + _run_len(board, x, y, dx, dy, p) + _run_len(board, x, y, -dx, -dy, p)
        if total > 5:
            return True
    return False
