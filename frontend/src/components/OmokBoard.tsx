'use client';
import React, { useMemo, useState } from 'react';

type Player = 0 | 1 | 2; // 0 empty, 1 black, 2 white
type Coord = { x: number; y: number };

const SIZE = 15;
const DIRS: Coord[] = [
  { x: 1, y: 0 },  // →
  { x: 0, y: 1 },  // ↓
  { x: 1, y: 1 },  // ↘
  { x: 1, y: -1 }, // ↗
];

function makeEmptyBoard(): Player[][] {
  return Array.from({ length: SIZE }, () => Array<Player>(SIZE).fill(0));
}
const inBounds = (x: number, y: number) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;

function getWinningLine(board: Player[][], last: Coord, player: Player): Coord[] | null {
  for (const d of DIRS) {
    const line: Coord[] = [{ ...last }];

    // forward
    let x = last.x + d.x, y = last.y + d.y;
    while (inBounds(x, y) && board[y][x] === player) {
      line.push({ x, y }); x += d.x; y += d.y;
    }
    // backward
    x = last.x - d.x; y = last.y - d.y;
    while (inBounds(x, y) && board[y][x] === player) {
      line.unshift({ x, y }); x -= d.x; y -= d.y;
    }
    if (line.length >= 5) return line.slice(0, 5);
  }
  return null;
}

// % position for index inside [0..SIZE-1]
const posPct = (i: number) => `${(i / (SIZE - 1)) * 100}%`;

export default function OmokBoard() {
  const [board, setBoard] = useState<Player[][]>(() => makeEmptyBoard());
  const [current, setCurrent] = useState<Player>(1);
  const [winner, setWinner] = useState<Player>(0);
  const [lastMove, setLastMove] = useState<Coord | null>(null);
  const [winLine, setWinLine] = useState<Coord[] | null>(null);

  const place = (x: number, y: number) => {
    if (winner || board[y][x] !== 0) return;
    const next = board.map(r => r.slice());
    next[y][x] = current;
    setBoard(next);
    setLastMove({ x, y });

    const line = getWinningLine(next, { x, y }, current);
    if (line) { setWinner(current); setWinLine(line); return; }

    setCurrent(current === 1 ? 2 : 1);
  };

  const reset = () => {
    setBoard(makeEmptyBoard());
    setCurrent(1);
    setWinner(0);
    setLastMove(null);
    setWinLine(null);
  };

  const statusText = useMemo(() => {
    if (winner === 1) return 'Black wins!';
    if (winner === 2) return 'White wins!';
    return current === 1 ? "Black's turn" : "White's turn";
  }, [current, winner]);

  const isOnWinLine = (x: number, y: number) =>
    !!winLine?.some(c => c.x === x && c.y === y);

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
          w-[80vmin] h-[80vmin] max-w-[900px] max-h-[900px]
          rounded-2xl p-6
          bg-amber-100
          shadow
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

        {/* Positioning layer for hoshi + stones (same inset as lines) */}
        <div className="absolute inset-6">
          {/* Hoshi at (3,7,11) 0-indexed */}
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

          {/* Intersections (click targets + stones) */}
          {Array.from({ length: SIZE }).map((_, y) =>
            Array.from({ length: SIZE }).map((__, x) => {
              const cell = board[y][x];
              const isLast = lastMove && lastMove.x === x && lastMove.y === y;
              const onWin = isOnWinLine(x, y);

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
        Tip: Stones sit on line intersections (click crossings).
      </div>
    </div>
  );
}
