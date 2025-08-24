from typing import List, Tuple

SIZE = 15
DIRS: List[Tuple[int,int]] = [(1,0),(0,1),(1,1),(1,-1)]

def in_bounds(x:int,y:int)->bool: return 0<=x<SIZE and 0<=y<SIZE

def build_line_with_candidate(board, cx, cy, dx, dy, player):
    x,y=cx,cy
    while in_bounds(x-dx,y-dy): x-=dx; y-=dy
    arr=[]; cidx=-1
    while in_bounds(x,y):
        if x==cx and y==cy:
            arr.append(1); cidx=len(arr)-1
        else:
            v=board[y][x]
            arr.append(0 if v==0 else (1 if v==player else 2))
        x+=dx; y+=dy
    return arr,cidx

def count_open_threes_in_line(arr:list[int], cidx:int)->int:
    cnt=0
    # len-5 "01110"
    for i in range(0, len(arr)-4):
        if i<=cidx<i+5 and arr[i:i+5]==[0,1,1,1,0]:
            cnt+=1
    # len-6 "010110"/"011010"
    for i in range(0, len(arr)-5):
        if i<=cidx<i+6:
            w=arr[i:i+6]
            if w==[0,1,0,1,1,0] or w==[0,1,1,0,1,0]:
                cnt+=1
    # generalized: any 3-consecutive with two open ends inside a 7-window
    for i in range(0, len(arr)-6):
        if not (i<=cidx<i+7): continue
        win=arr[i:i+7]
        for j in range(1,5):
            if win[j:j+3]==[1,1,1] and win[j-1]==0 and win[j+3]==0:
                cnt+=1
    return cnt

def count_open_threes(board, x, y, player)->int:
    total=0
    for dx,dy in DIRS:
        arr,cidx = build_line_with_candidate(board, x, y, dx, dy, player)
        total += count_open_threes_in_line(arr, cidx)
    return total

def is_double_three_illegal(board, x, y, player)->bool:
    if board[y][x]!=0: return False
    threes = count_open_threes(board, x, y, player)
    return threes >= 2
