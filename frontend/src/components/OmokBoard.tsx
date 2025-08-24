'use client';
import React, { useMemo, useState } from 'react';

type Player = 0 | 1 | 2; // 0 empty, 1 black, 2 white
type Coord = { x: number; y: number };
type Move = { x: number; y: number; player: Player };

const SIZE = 15;
const DIRS: Coord[] = [
  { x: 1, y: 0 },  // →
  { x: 0, y: 1 },  // ↓
  { x: 1, y: 1 },  // ↘
  { x: 1, y: -1 }, // ↗
];

// % position for index inside [0..SIZE-1] within the inset-6 region
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
  const re = /01110|010110|011010/g;
  let cnt = 0, m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    cnt += 1;
    re.lastIndex = m.index + 1; // allow overlaps
  }
  return cnt;
}

/** Total number of open-three patterns created by playing (x,y) as 'player'. */
function countOpenThrees(board: Player[][], x: number, y: number, player: Player): number {
  let total = 0;
  for (const d of DIRS) {
    const line = lineStringWithCandidate(board, x, y, d.x, d.y, player);
    total += countOpenThreesInLine(line);
  }
  return total;
}

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

/** Rebuild board and state from a move list prefix [0..k). */
function buildPositionFromMoves(moves: Move[]): {
  board: Player[][];
  current: Player;
  winner: Player;
  lastMove: Coord | null;
  winLine: Coord[] | null;
} {
  const b = makeEmptyBoard();
  let last: Coord | null = null;
  let winner: Player = 0;
  let winLine: Coord[] | null = null;

  for (const mv of moves) {
    b[mv.y][mv.x] = mv.player;
    last = { x: mv.x, y: mv.y };
    if (!winner) {
      const line = getWinningLine(b, last, mv.player);
      if (line) { winner = mv.player; winLine = line; }
    }
  }
  const current: Player = moves.length === 0 ? 1 : (moves[moves.length - 1].player === 1 ? 2 : 1);
  return { board: b, current, winner, lastMove: last, winLine };
}

export default function OmokBoard() {
  const [board, setBoard] = useState<Player[][]>(() => makeEmptyBoard());
  const [current, setCurrent] = useState<Player>(1);  // black starts
  const [winner, setWinner] = useState<Player>(0);
  const [lastMove, setLastMove] = useState<Coord | null>(null);
  const [winLine, setWinLine] = useState<Coord[] | null>(null);
  const [illegalAt, setIllegalAt] = useState<Coord | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);     // 👈 history

  const statusText = useMemo(() => {
    if (winner === 1) return 'Black wins!';
    if (winner === 2) return 'White wins!';
    if (illegalAt) return 'Illegal: 3×3 (double-three) for Black';
    return current === 1 ? "Black's turn" : "White's turn";
  }, [current, winner, illegalAt]);

  const place = (x: number, y: number) => {
    if (winner || board[y][x] !== 0) return;

    // 3×3 rule: only restrict Black
    if (current === 1) {
      const threes = countOpenThrees(board, x, y, 1);
      if (threes >= 2) {
        setIllegalAt({ x, y });
        setTimeout(() => setIllegalAt(null), 900);
        return;
      }
    }

    const next = board.map(r => r.slice());
    next[y][x] = current;

    const move: Move = { x, y, player: current };
    const newMoves = [...moves, move];
    setMoves(newMoves); // 👈 push into history
    setBoard(next);
    setLastMove({ x, y });

    const line = getWinningLine(next, { x, y }, current);
    if (line) { setWinner(current); setWinLine(line); return; }

    setCurrent(current === 1 ? 2 : 1);
  };

  /** Undo last move */
  const undo = () => {
    if (moves.length === 0) return;
    const newMoves = moves.slice(0, -1);
    const rebuilt = buildPositionFromMoves(newMoves);
    setMoves(newMoves);
    setBoard(rebuilt.board);
    setCurrent(rebuilt.current);
    setWinner(rebuilt.winner);
    setLastMove(rebuilt.lastMove);
    setWinLine(rebuilt.winLine);
    setIllegalAt(null);
  };

  /** Jump to any move index (time travel) */
  const jumpTo = (idx: number) => {
    const newMoves = moves.slice(0, idx);
    const rebuilt = buildPositionFromMoves(newMoves);
    setMoves(newMoves);
    setBoard(rebuilt.board);
    setCurrent(rebuilt.current);
    setWinner(rebuilt.winner);
    setLastMove(rebuilt.lastMove);
    setWinLine(rebuilt.winLine);
    setIllegalAt(null);
  };

  const reset = () => {
    setMoves([]);
    setBoard(makeEmptyBoard());
    setCurrent(1);
    setWinner(0);
    setLastMove(null);
    setWinLine(null);
    setIllegalAt(null);
  };

  const isOnWinLine = (x: number, y: number) =>
    !!winLine?.some(c => c.x === x && c.y === y);

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-lg font-medium">{statusText}</span>
        <button onClick={undo} className="rounded-lg px-3 py-1.5 border shadow-sm hover:shadow transition disabled:opacity-50"
          disabled={moves.length === 0}>
          Undo
        </button>
        <button onClick={reset} className="rounded-lg px-3 py-1.5 border shadow-sm hover:shadow transition">
          Reset
        </button>
      </div>

      <div className="flex gap-6 flex-col lg:flex-row items-center">
        {/* Board */}
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

          {/* Grid lines */}
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

            {/* Intersections */}
            {Array.from({ length: SIZE }).map((_, y) =>
              Array.from({ length: SIZE }).map((__, x) => {
                const cell = board[y][x];
                const isLast = lastMove && lastMove.x === x && lastMove.y === y;
                const onWin = isOnWinLine(x, y);
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

        {/* Move history panel */}
        <div className="w-full max-w-xs rounded-xl border bg-white/70 backdrop-blur p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Moves ({moves.length})</h3>
            <button
              onClick={() => jumpTo(0)}
              className="text-sm px-2 py-1 rounded border hover:bg-gray-50"
              disabled={moves.length === 0}
              title="Back to start"
            >
              ⟲ Reset to start
            </button>
          </div>
          <ol className="max-h-80 overflow-auto text-sm space-y-1 pr-1">
            {moves.length === 0 && (
              <li className="text-gray-500">No moves yet.</li>
            )}
            {moves.map((m, i) => (
              <li key={i} className="flex items-center justify-between">
                <button
                  onClick={() => jumpTo(i + 1)}
                  className="px-2 py-1 rounded hover:bg-gray-50 text-left w-full"
                  title="Jump to this move"
                >
                  <span className="font-mono mr-2">#{i + 1}</span>
                  <span className={m.player === 1 ? 'text-black' : 'text-gray-500'}>
                    {m.player === 1 ? 'Black' : 'White'}
                  </span>
                  <span className="ml-2 text-gray-700">({m.x + 1}, {m.y + 1})</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex justify-end">
            <button
              onClick={undo}
              className="text-sm px-3 py-1 rounded border hover:bg-gray-50 disabled:opacity-50"
              disabled={moves.length === 0}
            >
              Undo last
            </button>
          </div>
        </div>
      </div>

      <div className="text-sm text-neutral-600">
        3×3 rule active • Click a history item to jump • “Undo” reverts one move
      </div>
    </div>
  );
}
