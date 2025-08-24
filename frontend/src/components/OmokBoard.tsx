'use client';
import React, { useEffect, useMemo, useState } from 'react';

type Player = 0 | 1 | 2; // 0 empty, 1 black, 2 white
type Coord = { x: number; y: number };
type Move  = { x: number; y: number; player: Player };

type Level  = 'beginner' | 'intermediate' | 'hard' | 'insane';
type AIColor = 'black' | 'white' | 'auto';

export default function OmokBoard(props: {
  aiEnabled?: boolean;
  aiLevel?: Level;
  aiColor?: AIColor;   // 'black' | 'white' | 'auto'
}) {
  const aiEnabled = props.aiEnabled ?? false;
  const aiLevel: Level = props.aiLevel ?? 'beginner';
  const aiColor: AIColor = props.aiColor ?? 'auto';

  /* ---------- constants & helpers ---------- */
  const SIZE = 15;
  const DIRS: Coord[] = [
    { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 },
  ];
  const posPct = (i: number) => `${(i / (SIZE - 1)) * 100}%`;
  const inBounds = (x: number, y: number) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;
  const makeEmptyBoard = () =>
    Array.from({ length: SIZE }, () => Array<Player>(SIZE).fill(0));
  const other = (p: Player) => (p === 1 ? 2 : 1);
  const cloneBoard = (b: Player[][]) => b.map(r => r.slice());

  /* ---------- state ---------- */
  const [board, setBoard] = useState<Player[][]>(() => makeEmptyBoard());
  const [current, setCurrent] = useState<Player>(1);  // black starts
  const [winner, setWinner] = useState<Player>(0);
  const [lastMove, setLastMove] = useState<Coord | null>(null);
  const [winLine, setWinLine] = useState<Coord[] | null>(null);
  const [illegalAt, setIllegalAt] = useState<Coord | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);

  // Match win counters (persist across Reset)
  const [blackWins, setBlackWins] = useState(0);
  const [whiteWins, setWhiteWins] = useState(0);

  const aiPlayer: Player = useMemo(() => {
    if (!aiEnabled) return 0;
    if (aiColor === 'black') return 1;
    if (aiColor === 'white') return 2;
    return 2; // 'auto' -> AI plays White by default
  }, [aiEnabled, aiColor]);

  /* ---------- 3×3 detection (fixed & robust) ---------- */
  // Build a 1D line for a given direction, with the candidate cell marked as 1,
  // empties as 0, and opponent stones as 2. Returns the array and the index of the candidate.
  function buildLineWithCandidate(cx: number, cy: number, dx: number, dy: number, player: Player) {
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

  // Same but on an arbitrary board (used for simulation/lookahead).
  function buildLineWithCandidateOn(b: Player[][], cx: number, cy: number, dx: number, dy: number, player: Player) {
    let x = cx, y = cy;
    while (inBounds(x - dx, y - dy)) { x -= dx; y -= dy; }
    const arr: number[] = [];
    let cidx = -1;
    while (inBounds(x, y)) {
      if (x === cx && y === cy) { arr.push(1); cidx = arr.length - 1; }
      else {
        const v = b[y][x];
        arr.push(v === 0 ? 0 : (v === player ? 1 : 2));
      }
      x += dx; y += dy;
    }
    return { arr, cidx };
  }

  // NEW: sliding-window per-line detector. Counts open-threes in this line
  // that *include the candidate index*. We match three canonical shapes:
  //   01110  (length 5)
  //   010110 (length 6)
  //   011010 (length 6)
  function countOpenThreesInThisLine(arr: number[], cidx: number): number {
    let count = 0;
    // length-5 windows
    for (let i = 0; i <= arr.length - 5; i++) {
      if (cidx < i || cidx >= i + 5) continue;
      const win = arr.slice(i, i + 5).join('');
      if (win === '01110') count++;
    }
    // length-6 windows
    for (let i = 0; i <= arr.length - 6; i++) {
      if (cidx < i || cidx >= i + 6) continue;
      const win = arr.slice(i, i + 6).join('');
      if (win === '010110' || win === '011010') count++;
    }
    return count;
  }

  // Sum across all four directions — if total ≥ 2 → double-three (illegal).
  function countOpenThrees(x: number, y: number, player: Player): number {
    let total = 0;
    for (const d of DIRS) {
      const { arr, cidx } = buildLineWithCandidate(x, y, d.x, d.y, player);
      total += countOpenThreesInThisLine(arr, cidx);
    }
    return total;
  }
  function countOpenThreesOn(b: Player[][], x: number, y: number, player: Player): number {
    let total = 0;
    for (const d of DIRS) {
      const { arr, cidx } = buildLineWithCandidateOn(b, x, y, d.x, d.y, player);
      total += countOpenThreesInThisLine(arr, cidx);
    }
    return total;
  }

  /* ---------- win detection ---------- */
  function getWinningLine(last: Coord, player: Player, b: Player[][] = board): Coord[] | null {
    for (const d of DIRS) {
      const line: Coord[] = [{ ...last }];
      let x = last.x + d.x, y = last.y + d.y;
      while (inBounds(x, y) && b[y][x] === player) { line.push({ x, y }); x += d.x; y += d.y; }
      x = last.x - d.x; y = last.y - d.y;
      while (inBounds(x, y) && b[y][x] === player) { line.unshift({ x, y }); x -= d.x; y -= d.y; }
      if (line.length >= 5) return line.slice(0, 5);
    }
    return null;
  }
  const hasFive = (b: Player[][], x: number, y: number, p: Player) =>
    !!getWinningLine({ x, y }, p, b);

  /* ---------- status ---------- */
  const statusText = useMemo(() => {
    if (winner === 1) return 'Black wins!';
    if (winner === 2) return 'White wins!';
    if (illegalAt)  return 'Illegal: 3×3 (double-three)';
    return current === 1 ? "Black's turn" : "White's turn";
  }, [current, winner, illegalAt]);

  /* ---------- apply move (shared by human & AI) ---------- */
  const place = (x: number, y: number) => {
    if (winner || board[y][x] !== 0) return;

    // 3×3 (both colors)
    const threes = countOpenThrees(x, y, current);
    if (threes >= 2) { setIllegalAt({ x, y }); setTimeout(() => setIllegalAt(null), 900); return; }

    const next = board.map(r => r.slice());
    next[y][x] = current;

    const newMoves = [...moves, { x, y, player: current } as Move];
    setMoves(newMoves);
    setBoard(next);
    setLastMove({ x, y });

    const line = getWinningLine({ x, y }, current, next);
    if (line) {
      setWinner(current);
      setWinLine(line);
      if (current === 1) setBlackWins(w => w + 1);
      else if (current === 2) setWhiteWins(w => w + 1);
      return;
    }

    setCurrent(current === 1 ? 2 : 1);
  };

  /* ---------- AI evaluation helpers ---------- */
  const scorePlacement = (b: Player[][], x: number, y: number, p: Player): number => {
    const inB = (xx: number, yy: number) => xx >= 0 && xx < SIZE && yy >= 0 && yy < SIZE;
    const countDir = (dx: number, dy: number) => {
      let c = 1;
      let openL = false, openR = false;

      // forward
      let xx = x + dx, yy = y + dy;
      while (inB(xx, yy) && b[yy][xx] === p) { c++; xx += dx; yy += dy; }
      if (inB(xx, yy) && b[yy][xx] === 0) openR = true;

      // backward
      xx = x - dx; yy = y - dy;
      while (inB(xx, yy) && b[yy][xx] === p) { c++; xx -= dx; yy -= dy; }
      if (inB(xx, yy) && b[yy][xx] === 0) openL = true;

      return { len: c, openEnds: (openL ? 1 : 0) + (openR ? 1 : 0) };
    };

    let score = 0;
    for (const d of DIRS) {
      const { len, openEnds } = countDir(d.x, d.y);
      if (len >= 5) score += 1e6;                    // immediate win
      else if (len === 4 && openEnds >= 1) score += 8000;
      else if (len === 3 && openEnds === 2) score += 1500;
      else if (len === 3 && openEnds === 1) score += 500;
      else if (len === 2 && openEnds === 2) score += 200;
      else score += 5 * len;
    }

    const cx = (SIZE - 1) / 2, cy = cx;
    const dist = (x - cx) ** 2 + (y - cy) ** 2;
    return score - 0.3 * dist;                        // mild center bias
  };

  const isImmediateWin = (b: Player[][], x: number, y: number, p: Player) => {
    const bb = cloneBoard(b);
    bb[y][x] = p;
    return hasFive(bb, x, y, p);
  };

  /* ---------- AI move picker (levels differ clearly) ---------- */
  function pickAIMove(level: Level, p: Player): Coord | null {
    // 1) legal empties (respect 3×3 on current board)
    const legal: Coord[] = [];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      if (board[y][x] !== 0) continue;
      if (countOpenThrees(x, y, p) >= 2) continue; // illegal double-three
      legal.push({ x, y });
    }
    if (legal.length === 0) return null;

    const opp = other(p);

    // 2) immediate win
    for (const c of legal) if (isImmediateWin(board, c.x, c.y, p)) return c;

    // 3) must-block (opponent immediate win)
    for (const c of legal) if (isImmediateWin(board, c.x, c.y, opp)) return c;

    // 4) score each legal move for p, plus small defensive bonus
    const scored = legal.map(c => {
      const sSelf = scorePlacement(board, c.x, c.y, p);
      const sOpp  = scorePlacement(board, c.x, c.y, opp);
      return { c, score: sSelf + 0.35 * sOpp };
    }).sort((a, b) => b.score - a.score);

    // 5) level settings: breadth + noise + 1-ply lookahead for high levels
    const cfg = {
      beginner:     { K: 24, noise: 0.45, lookahead: 0 },
      intermediate: { K: 12, noise: 0.20, lookahead: 0 },
      hard:         { K:  6, noise: 0.05, lookahead: 1 },
      insane:       { K:  3, noise: 0.00, lookahead: 1 },
    }[level];

    const top = scored.slice(0, Math.min(cfg.K, scored.length));

    // optional 1-ply lookahead for hard/insane
    if (cfg.lookahead > 0) {
      let best = top[0]; let bestEval = -Infinity;

      for (const t of top) {
        // simulate our move
        const b1 = cloneBoard(board);
        b1[t.c.y][t.c.x] = p;
        if (hasFive(b1, t.c.x, t.c.y, p)) return t.c;  // direct win

        // opponent best reply (greedy), respecting 3×3 on b1
        let worstReply = 0;
        for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
          if (b1[y][x] !== 0) continue;
          if (countOpenThreesOn(b1, x, y, opp) >= 2) continue;
          if (hasFive(cloneBoard(b1), x, y, opp)) { worstReply = 1e5; y = SIZE; break; }
          const replyScore = scorePlacement(b1, x, y, opp);
          if (replyScore > worstReply) worstReply = replyScore;
        }
        const evalScore = t.score - 0.5 * worstReply;     // penalize moves allowing big replies
        if (evalScore > bestEval) { bestEval = evalScore; best = t; }
      }
      return best.c;
    }

    // add randomness by level (among top-K)
    if (cfg.noise > 0 && top.length > 1) {
      // exponential-ish pick; higher noise -> more likely to pick deeper in top-K
      const j = Math.min(top.length - 1, Math.floor(-Math.log(1 - Math.random()) * cfg.noise * top.length));
      return top[j].c;
    }
    return top[0].c;
  }

  // AI plays automatically when it's AI's turn
  useEffect(() => {
    if (!aiEnabled || !aiPlayer) return;
    if (winner) return;
    if (current !== aiPlayer) return;

    const mm = pickAIMove(aiLevel, aiPlayer);
    if (mm) {
      const id = setTimeout(() => place(mm.x, mm.y), 250);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, current, aiEnabled, aiPlayer, aiLevel, winner]);

  /* ---------- undo/jump/reset ---------- */
  function buildPositionFromMoves(ms: Move[]) {
    const b = makeEmptyBoard();
    let last: Coord | null = null;
    let win: Player = 0; let wline: Coord[] | null = null;
    for (const mv of ms) {
      b[mv.y][mv.x] = mv.player;
      last = { x: mv.x, y: mv.y };
      if (!win) {
        const temp = getWinningLine(last, mv.player, b);
        if (temp) { win = mv.player; wline = temp; }
      }
    }
    const cur: Player = ms.length === 0 ? 1 : (ms[ms.length - 1].player === 1 ? 2 : 1);
    return { board: b, current: cur, winner: win, lastMove: last, winLine: wline };
  }

  const undo = () => {
    if (moves.length === 0 || winner) return; // disable after game ends
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
    if (winner) return; // keep counters consistent
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
    // Clear board only; keep blackWins/whiteWins
    setMoves([]); setBoard(makeEmptyBoard()); setCurrent(1);
    setWinner(0); setLastMove(null); setWinLine(null); setIllegalAt(null);
  };

  const isOnWinLine = (x: number, y: number) =>
    !!winLine?.some(c => c.x === x && c.y === y);

  /* ---------------- UI (scorebar inline with buttons) ---------------- */
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      {/* Score bar: scores (left) • status (center) • buttons (right) */}
      <div className="flex justify-center mb-3">
        <div className="flex items-center justify-between gap-4 w-full max-w-2xl rounded-xl border bg-white/70 backdrop-blur px-4 py-2 shadow-sm">
          {/* Left: scores */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded-full bg-neutral-900 shadow" />
              <span className="font-medium">Black wins:</span>
              <span className="tabular-nums">{blackWins}</span>
            </div>
            <div className="w-px h-5 bg-gray-300/80" />
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded-full bg-neutral-100 ring-1 ring-neutral-500/40 shadow" />
              <span className="font-medium">White wins:</span>
              <span className="tabular-nums">{whiteWins}</span>
            </div>
          </div>

          {/* Center: status */}
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
            {winner ? (winner === 1 ? 'Black wins!' : 'White wins!') : (current === 1 ? "Black's turn" : "White's turn")}
          </div>

          {/* Right: buttons */}
          <div className="flex gap-2">
            <button
              onClick={undo}
              className="rounded-lg px-3 py-1.5 border shadow-sm hover:shadow transition disabled:opacity-50"
              disabled={moves.length === 0 || !!winner}
              title={winner ? 'Undo disabled after game over' : 'Undo last move'}
            >
              Undo
            </button>
            <button
              onClick={reset}
              className="rounded-lg px-3 py-1.5 border shadow-sm hover:shadow transition"
              title="Start a new game (wins stay)"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Main area: board center, sidebar on desktop */}
      <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6">
        {/* Board */}
        <div
          className="relative w-[90vmin] h-[90vmin] max-w-[900px] max-h-[900px] rounded-2xl p-6 bg-amber-100 shadow"
          aria-label="Omok board" role="application"
        >
          <div className="absolute inset-6 rounded-xl bg-[#f6e1b5] shadow-inner" />
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
          <div className="absolute inset-6">
            {[3, 7, 11].flatMap(ix =>
              [3, 7, 11].map(iy => (
                <span key={`hoshi-${ix}-${iy}`} className="absolute w-2 h-2 bg-amber-900/80 rounded-full pointer-events-none"
                  style={{ left: posPct(ix), top: posPct(iy), transform: 'translate(-50%, -50%)' }} />
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
                      <span className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full animate-ping"
                        style={{ width: '30px', height: '30px', left: '50%', top: '50%', background: 'rgba(239, 68, 68, 0.5)' }} />
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
                      <span className="absolute w-2 h-2 rounded-full bg-red-500"
                        style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Sidebar (desktop) */}
        <div className="hidden lg:block w-[300px]">
          <div className="sticky top-6 rounded-xl border bg-white/70 backdrop-blur p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Moves ({moves.length})</h3>
              <button onClick={() => jumpTo(0)} className="text-sm px-2 py-1 rounded border hover:bg-gray-50" disabled={moves.length === 0 || !!winner} title={winner ? 'Disabled after game over' : 'Back to start'}>
                ⟲ Reset to start
              </button>
            </div>
            <ol className="max-h-[60vh] overflow-auto text-sm space-y-1 pr-1">
              {moves.length === 0 && <li className="text-gray-500">No moves yet.</li>}
              {moves.map((m, i) => (
                <li key={i}>
                  <button onClick={() => jumpTo(i + 1)} className="px-2 py-1 rounded hover:bg-gray-50 w-full text-left" disabled={!!winner}>
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
              <button onClick={undo} className="text-sm px-3 py-1 rounded border hover:bg-gray-50 disabled:opacity-50" disabled={moves.length === 0 || !!winner}>
                Undo last
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile history */}
      <div className="mt-6 lg:hidden w-full max-w-xl mx-auto">
        <div className="rounded-xl border bg-white/70 backdrop-blur p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Moves ({moves.length})</h3>
            <button onClick={() => jumpTo(0)} className="text-sm px-2 py-1 rounded border hover:bg-gray-50" disabled={moves.length === 0 || !!winner}>
              ⟲ Reset to start
            </button>
          </div>
          <ol className="max-h-72 overflow-auto text-sm space-y-1 pr-1">
            {moves.length === 0 && <li className="text-gray-500">No moves yet.</li>}
            {moves.map((m, i) => (
              <li key={i}>
                <button onClick={() => jumpTo(i + 1)} className="px-2 py-1 rounded hover:bg-gray-50 w-full text-left" disabled={!!winner}>
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
            <button onClick={undo} className="text-sm px-3 py-1 rounded border hover:bg-gray-50 disabled:opacity-50" disabled={moves.length === 0 || !!winner}>
              Undo last
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
