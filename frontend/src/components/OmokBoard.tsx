'use client';
import React, { useMemo, useState } from 'react';

type Player = 0 | 1 | 2; // 0 empty, 1 black, 2 white
type Coord = { x: number; y: number };
type Move = { x: number; y: number; player: Player };

const SIZE = 15;
const DIRS: Coord[] = [
  { x: 1, y: 0 },   // →
  { x: 0, y: 1 },   // ↓
  { x: 1, y: 1 },   // ↘
  { x: 1, y: -1 },  // ↗
];

// percentage for index inside [0..SIZE-1] within the inset-6 area
const posPct = (i: number) => `${(i / (SIZE - 1)) * 100}%`;

function makeEmptyBoard(): Player[][] {
  return Array.from({ length: SIZE }, () => Array<Player>(SIZE).fill(0));
}
const inBounds = (x: number, y: number) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;

/** Build line with candidate as current player; return array + candidate index */
function buildLineWithCandidate(
  board: Player[][], cx: number, cy: number, dx: number, dy: number, player: Player
): { arr: number[]; cidx: number } {
  let x = cx, y = cy;
  while (inBounds(x - dx, y - dy)) { x -= dx; y -= dy; }
  const arr: number[] = [];
  let cidx = -1;
  while (inBounds(x, y)) {
    if (x === cx && y === cy) { arr.push(1); cidx = arr.length - 1; }
    else {
      const v = board[y][x];
      arr.push(v === 0 ? 0 : (v === player ? 1 : 2));
    }
    x += dx; y += dy;
  }
  return { arr, cidx };
}

/** Count open-threes in this line ONLY if the candidate is one of the 1's */
function countOpenThreesInThisLine(arr: number[], cidx: number): number {
  let count = 0;
  const eq5 = (i: number, a: number, b: number, c: number, d: number, e: number) =>
    arr[i] === a && arr[i+1] === b && arr[i+2] === c && arr[i+3] === d && arr[i+4] === e;
  const eq6 = (i: number, a: number, b: number, c: number, d: number, e: number, f: number) =>
    arr[i] === a && arr[i+1] === b && arr[i+2] === c && arr[i+3] === d && arr[i+4] === e && arr[i+5] === f;

  for (let i = 0; i + 5 <= arr.length; i++) {
    if (eq5(i, 0, 1, 1, 1, 0)) {
      if (cidx === i + 1 || cidx === i + 2 || cidx === i + 3) count++;
    }
  }
  for (let i = 0; i + 6 <= arr.length; i++) {
    if (eq6(i, 0, 1, 0, 1, 1, 0)) {
      if (cidx === i + 1 || cidx === i + 3 || cidx === i + 4) count++;
    } else if (eq6(i, 0, 1, 1, 0, 1, 0)) {
      if (cidx === i + 1 || cidx === i + 2 || cidx === i + 4) count++;
    }
  }
  return count;
}

function countOpenThrees(board: Player[][], x: number, y: number, player: Player): number {
  let total = 0;
  for (const d of DIRS) {
    const { arr, cidx } = buildLineWithCandidate(board, x, y, d.x, d.y, player);
    total += countOpenThreesInThisLine(arr, cidx);
  }
  return total;
}

function getWinningLine(board: Player[][], last: Coord, player: Player): Coord[] | null {
  for (const d of DIRS) {
    const line: Coord[] = [{ ...last }];
    let x = last.x + d.x, y = last.y + d.y;
    while (inBounds(x, y) && board[y][x] === player) { line.push({ x, y }); x += d.x; y += d.y; }
    x = last.x - d.x; y = last.y - d.y;
    while (inBounds(x, y) && board[y][x] === player) { line.unshift({ x, y }); x -= d.x; y -= d.y; }
    if (line.length >= 5) return line.slice(0, 5);
  }
  return null;
}

function buildPositionFromMoves(moves: Move[]): {
  board: Player[][]; current: Player; winner: Player; lastMove: Coord | null; winLine: Coord[] | null;
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
  const [current, setCurrent] = useState<Player>(1);
  const [winner, setWinner] = useState<Player>(0);
  const [lastMove, setLastMove] = useState<Coord | null>(null);
  const [winLine, setWinLine] = useState<Coord[] | null>(null);
  const [illegalAt, setIllegalAt] = useState<Coord | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);

  // counts for scoreboard
  const { blackCount, whiteCount } = useMemo(() => {
    let b = 0, w = 0;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      if (board[y][x] === 1) b++; else if (board[y][x] === 2) w++;
    }
    return { blackCount: b, whiteCount: w };
  }, [board]);

  const statusText = useMemo(() => {
    if (winner === 1) return 'Black wins!';
    if (winner === 2) return 'White wins!';
    if (illegalAt) return 'Illegal: 3×3 (double-three)';
    return current === 1 ? "Black's turn" : "White's turn";
  }, [current, winner, illegalAt]);

  const place = (x: number, y: number) => {
    if (winner || board[y][x] !== 0) return;
    // 3×3 for both players
    const threes = countOpenThrees(board, x, y, current);
    if (threes >= 2) { setIllegalAt({ x, y }); setTimeout(() => setIllegalAt(null), 900); return; }

    const next = board.map(r => r.slice());
    next[y][x] = current;
    const move: Move = { x, y, player: current };
    const newMoves = [...moves, move];
    setMoves(newMoves);
    setBoard(next);
    setLastMove({ x, y });

    const line = getWinningLine(next, { x, y }, current);
    if (line) { setWinner(current); setWinLine(line); return; }
    setCurrent(current === 1 ? 2 : 1);
  };

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

  /* ---------- LAYOUT: Centered board + desktop sidebar ---------- */
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      {/* Scoreboard centered */}
      <div className="flex justify-center mb-3">
        <div className="flex items-center gap-4 rounded-xl border bg-white/70 backdrop-blur px-4 py-2 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded-full bg-neutral-900 shadow" />
            <span className="font-medium">Black:</span>
            <span className="tabular-nums">{blackCount}</span>
          </div>
          <div className="w-px h-5 bg-gray-300/80" />
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded-full bg-neutral-100 ring-1 ring-neutral-500/40 shadow" />
            <span className="font-medium">White:</span>
            <span className="tabular-nums">{whiteCount}</span>
          </div>
          <div className="w-px h-5 bg-gray-300/80" />
          <div
            className={[
              'px-3 py-1 rounded-lg text-sm font-medium',
              winner
                ? 'bg-emerald-100 text-emerald-700'
                : current === 1
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-gray-800 ring-1 ring-neutral-500/40',
            ].join(' ')}
          >
            {statusText}
          </div>
        </div>
      </div>

      {/* Controls centered */}
      <div className="flex justify-center gap-2 mb-4">
        <button onClick={undo} className="rounded-lg px-3 py-1.5 border shadow-sm hover:shadow transition disabled:opacity-50" disabled={moves.length === 0}>Undo</button>
        <button onClick={reset} className="rounded-lg px-3 py-1.5 border shadow-sm hover:shadow transition">Reset</button>
      </div>

      {/* Main area: board center, sidebar on desktop */}
      <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6">
        {/* Board container stays centered */}
        <div
          className="
            relative
            w-[90vmin] h-[90vmin] max-w-[900px] max-h-[900px]
            rounded-2xl p-6 bg-amber-100 shadow
          "
          aria-label="Omok board"
          role="application"
        >
          {/* Inner wooden area */}
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
          {/* Hoshi + stones layer */}
          <div className="absolute inset-6">
            {[3, 7, 11].flatMap(ix =>
              [3, 7, 11].map(iy => (
                <span
                  key={`hoshi-${ix}-${iy}`}
                  className="absolute w-2 h-2 bg-amber-900/80 rounded-full pointer-events-none"
                  style={{ left: posPct(ix), top: posPct(iy), transform: 'translate(-50%, -50%)' }}
                  aria-hidden
                />
              ))
            )}
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
                    style={{ left: posPct(x), top: posPct(y), width: '36px', height: '36px', background: 'transparent' }}
                  >
                    {illegalHere && (
                      <span
                        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full animate-ping"
                        style={{ width: '30px', height: '30px', left: '50%', top: '50%', background: 'rgba(239, 68, 68, 0.5)' }}
                      />
                    )}
                    {cell !== 0 && (
                      <span
                        className={[
                          'absolute rounded-full shadow',
                          cell === 1 ? 'bg-neutral-900' : 'bg-neutral-100 ring-1 ring-neutral-500/40',
                          onWin ? 'outline outline-2 outline-emerald-400' : '',
                        ].join(' ')}
                        style={{ width: '26px', height: '26px', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                      />
                    )}
                    {isLast && (
                      <span
                        className="absolute w-2 h-2 rounded-full bg-red-500"
                        style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Sidebar: desktop only */}
        <div className="hidden lg:block w-[300px]">
          <div className="sticky top-6 rounded-xl border bg-white/70 backdrop-blur p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Moves ({moves.length})</h3>
              <button onClick={() => jumpTo(0)} className="text-sm px-2 py-1 rounded border hover:bg-gray-50" disabled={moves.length === 0} title="Back to start">
                ⟲ Reset to start
              </button>
            </div>
            <ol className="max-h-[60vh] overflow-auto text-sm space-y-1 pr-1">
              {moves.length === 0 && <li className="text-gray-500">No moves yet.</li>}
              {moves.map((m, i) => (
                <li key={i}>
                  <button onClick={() => jumpTo(i + 1)} className="px-2 py-1 rounded hover:bg-gray-50 w-full text-left">
                    <span className="font-mono mr-2">#{i + 1}</span>
                    <span className={m.player === 1 ? 'text-black' : 'text-gray-600'}>
                      {m.player === 1 ? 'Black' : 'White'}
                    </span>
                    <span className="ml-2 text-gray-700">({m.x + 1}, {m.y + 1})</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-2 flex justify-end">
              <button onClick={undo} className="text-sm px-3 py-1 rounded border hover:bg-gray-50 disabled:opacity-50" disabled={moves.length === 0}>
                Undo last
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile history below board */}
      <div className="mt-6 lg:hidden">
        <div className="rounded-xl border bg-white/70 backdrop-blur p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Moves ({moves.length})</h3>
            <button onClick={() => jumpTo(0)} className="text-sm px-2 py-1 rounded border hover:bg-gray-50" disabled={moves.length === 0}>
              ⟲ Reset to start
            </button>
          </div>
          <ol className="max-h-72 overflow-auto text-sm space-y-1 pr-1">
            {moves.length === 0 && <li className="text-gray-500">No moves yet.</li>}
            {moves.map((m, i) => (
              <li key={i}>
                <button onClick={() => jumpTo(i + 1)} className="px-2 py-1 rounded hover:bg-gray-50 w-full text-left">
                  <span className="font-mono mr-2">#{i + 1}</span>
                  <span className={m.player === 1 ? 'text-black' : 'text-gray-600'}>
                    {m.player === 1 ? 'Black' : 'White'}
                  </span>
                  <span className="ml-2 text-gray-700">({m.x + 1}, {m.y + 1})</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex justify-end">
            <button onClick={undo} className="text-sm px-3 py-1 rounded border hover:bg-gray-50 disabled:opacity-50" disabled={moves.length === 0}>
              Undo last
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
