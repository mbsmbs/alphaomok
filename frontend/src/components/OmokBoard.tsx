'use client';
import React, { useMemo, useState } from 'react';

type Player = 0 | 1 | 2; // 0 = empty, 1 = black, 2 = white
type Coord = { x: number; y: number };

const SIZE = 15;
const DIRS: Coord[] = [
  { x: 1, y: 0 },  // →
  { x: 0, y: 1 },  // ↓
  { x: 1, y: 1 },  // ↘
  { x: 1, y: -1 }, // ↗
];

// % position helper (inside the inset-6 region)
const posPct = (i: number) => `${(i / (SIZE - 1)) * 100}%`;

function makeEmptyBoard(): Player[][] {
  return Array.from({ length: SIZE }, () => Array<Player>(SIZE).fill(0));
}
const inBounds = (x: number, y: number) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;

/** Build the full line string through (cx,cy) along (dx,dy),
 * treating the candidate position as 'player' even if board is empty there.
 * Encoding: '1' = player, '2' = opponent, '0' = empty. */
function lineStringWithCandidate(
  board: Player[][],
  cx: number, cy: number,
  dx: number, dy: number,
  player: Player
): string {
  // move to the far start of the line within bounds
  let x = cx, y = cy;
  while (inBounds(x - dx, y - dy)) { x -= dx; y -= dy; }

  let s = '';
  while (inBounds(x, y)) {
    const v = (x === cx && y === cy) ? player : board[y][x];
    s += v === 0 ? '0' : (v === player ? '1' : '2');
    x += dx; y += dy;
  }
  return s;
}

/** Count "open three" patterns in a single line string. */
function countOpenThreesInLine(s: string): number {
  // Only count patterns that represent a free-three (two open ends).
  // These classic patterns are sufficient for Omok 3x3 detection:
  // 01110, 010110, 011010
  const re = /01110|010110|011010/g;
  let cnt = 0;
  // use look-ahead style counting by manual exec loop
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    cnt += 1;
    // allow overlapping matches: move regex one char forward
    re.lastIndex = m.index + 1;
  }
  return cnt;
}

/** Total number of open-three patterns created by playing (x,y) as 'player'. */
function countOpenThrees(
  board: Player[][], x: number, y: number, player: Player
): number {
  let total = 0;
  for (const d of DIRS) {
    const line = lineStringWithCandidate(board, x, y, d.x, d.y, player);
    total += countOpenThreesInLine(line);
  }
  return total;
}

export default function OmokBoard() {
  const [board, setBoard] = useState<Player[][]>(() => makeEmptyBoard());
  const [current, setCurrent] = useState<Player>(1);  // black starts
  const [winner, setWinner] = useState<Player>(0);
  const [lastMove, setLastMove] = useState<Coord | null>(null);
  const [winLine, setWinLine] = useState<Coord[] | null>(null);
  const [illegalAt, setIllegalAt] = useState<Coord | null>(null); // where a 3x3 was attempted

  const isOnWinLine = (x: number, y: number) =>
    !!winLine?.some(c => c.x === x && c.y === y);

  const statusText = useMemo(() => {
    if (winner === 1) return 'Black wins!';
    if (winner === 2) return 'White wins!';
    if (illegalAt) return 'Illegal: 3×3 (double-three) for Black';
    return current === 1 ? "Black's turn" : "White's turn";
  }, [current, winner, illegalAt]);

  const getWinningLine = (b: Player[][], last: Coord, player: Player): Coord[] | null => {
    for (const d of DIRS) {
      const line: Coord[] = [{ ...last }];

      // forward
      let x = last.x + d.x, y = last.y + d.y;
      while (inBounds(x, y) && b[y][x] === player) {
        line.push({ x, y }); x += d.x; y += d.y;
      }
      // backward
      x = last.x - d.x; y = last.y - d.y;
      while (inBounds(x, y) && b[y][x] === player) {
        line.unshift({ x, y }); x -= d.x; y -= d.y;
      }
      if (line.length >= 5) return line.slice(0, 5);
    }
    return null;
  };

  const place = (x: number, y: number) => {
    if (winner || board[y][x] !== 0) return;

    // 3×3 rule: only restrict Black (player 1).
    if (current === 1) {
      const threes = countOpenThrees(board, x, y, 1);
      if (threes >= 2) {
        // Illegal move → show a quick red pulse at that spot
        setIllegalAt({ x, y });
        setTimeout(() => setIllegalAt(null), 900);
        return;
      }
    }

    // Apply the move
    const next = board.map(r => r.slice());
    next[y][x] = current;
    setBoard(next);
    setLastMove({ x, y });

    // Win detection
    const line = getWinningLine(next, { x, y }, current);
    if (line) { setWinner(current); setWinLine(line); return; }

    // Next turn
    setCurrent(current === 1 ? 2 : 1);
  };

  const reset = () => {
    setBoard(makeEmptyBoard());
    setCurrent(1);
    setWinner(0);
    setLastMove(null);
    setWinLine(null);
    setIllegalAt(null);
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="flex items-center gap-3">
        <span className="text-lg font-medium">{statusText}</span>
        <button
          onClick={reset}
          className="rounded-xl px-3 py-1.5 border shadow-sm hover:shadow transition"
        >
          Reset
        </button>
      </div>

      {/* Outer board */}
      <div
        className="
          relative
          w-[90vmin] h-[90vmin] max-w-[900px] max-h-[900px]
          rounded-2xl p-6 bg-amber-100 shadow
        "
        aria-label="Omok board"
        role="application"
      >
        {/* Inner wooden area (grid region) */}
        <div className="absolute inset-6 rounded-xl bg-[#f6e1b5] shadow-inner" />

        {/* Grid lines exactly inside the grid region */}
        <div
          className="absolute inset-6 rounded-xl pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#9a6b2f 1px, transparent 1px), linear-gradient(90deg, #9a6b2f 1px, transparent 1px)',
            backgroundSize: `calc(100% / ${SIZE - 1}) calc(100% / ${SIZE - 1})`,
            backgroundPosition: '0 0',
            backgroundRepeat: 'repeat',
          }}
          aria-hidden
        />

        {/* Positioning layer for hoshi + stones */}
        <div className="absolute inset-6">
          {/* Hoshi at 3/7/11 (0-index) */}
          {[3, 7, 11].flatMap(ix =>
            [3, 7, 11].map(iy => (
              <span
                key={`hoshi-${ix}-${iy}`}
                className="absolute w-2 h-2 bg-amber-900/80 rounded-full pointer-events-none"
                style={{
                  left: posPct(ix),
                  top: posPct(iy),
                  transform: 'translate(-50%, -50%)',
                }}
                aria-hidden
              />
            ))
          )}

          {/* Intersections (click targets + stones + illegal pulse) */}
          {Array.from({ length: SIZE }).map((_, y) =>
            Array.from({ length: SIZE }).map((__, x) => {
              const cell = board[y][x];
              const isLast = lastMove && lastMove.x === x && lastMove.y === y;
              const onWin = !!winLine?.some(c => c.x === x && c.y === y);
              const illegalHere = illegalAt && illegalAt.x === x && illegalAt.y === y;

              return (
                <button
                  key={`${x}-${y}`}
                  onClick={() => place(x, y)}
                  aria-label={`Place at ${x + 1},${y + 1}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: posPct(x),
                    top: posPct(y),
                    width: '36px',
                    height: '36px',
                    background: 'transparent',
                  }}
                >
                  {/* Illegal pulse */}
                  {illegalHere && (
                    <span
                      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full animate-ping"
                      style={{
                        width: '30px',
                        height: '30px',
                        left: '50%',
                        top: '50%',
                        background: 'rgba(239, 68, 68, 0.5)', // red-500/50
                      }}
                      aria-hidden
                    />
                  )}

                  {/* Stone */}
                  {cell !== 0 && (
                    <span
                      className={[
                        'absolute rounded-full shadow',
                        cell === 1
                          ? 'bg-neutral-900'
                          : 'bg-neutral-100 ring-1 ring-neutral-500/40',
                        onWin ? 'outline outline-2 outline-emerald-400' : '',
                      ].join(' ')}
                      style={{
                        width: '26px',
                        height: '26px',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                      }}
                      aria-hidden
                    />
                  )}

                  {/* Last move marker */}
                  {isLast && (
                    <span
                      className="absolute w-2 h-2 rounded-full bg-red-500"
                      style={{
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                      }}
                      aria-label="Last move"
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="text-sm text-neutral-600">
        3×3 rule: Black cannot play a move that creates two open threes.
      </div>
    </div>
  );
}
