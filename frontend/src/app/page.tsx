'use client';

import { useState } from 'react';
import OmokBoard from '@/components/OmokBoard';

type Level = 'beginner' | 'intermediate' | 'hard' | 'insane';
type AIColor = 'black' | 'white' | 'auto';

export default function Home() {
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiLevel, setAiLevel] = useState<Level>('beginner');
  const [aiColor, setAiColor] = useState<AIColor>('white'); // or 'auto'
  const [gameKey, setGameKey] = useState(1);

  const startNewGame = () => setGameKey(k => k + 1);

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-start p-6 gap-4">
      <div className="w-full max-w-5xl flex flex-wrap items-center justify-center gap-3">
        <label className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-white/70 shadow-sm">
          <input type="checkbox" checked={aiEnabled} onChange={e => setAiEnabled(e.target.checked)} />
          <span className="text-sm">Play vs AI</span>
        </label>

        <label className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-white/70 shadow-sm">
          <span className="text-sm">Level</span>
          <select
            value={aiLevel}
            onChange={e => setAiLevel(e.target.value as Level)}
            className="px-2 py-1 rounded border bg-white text-sm"
            disabled={!aiEnabled}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="hard">Hard</option>
            <option value="insane">Insane</option>
          </select>
        </label>

        <label className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-white/70 shadow-sm">
          <span className="text-sm">AI Color</span>
          <select
            value={aiColor}
            onChange={e => setAiColor(e.target.value as AIColor)}
            className="px-2 py-1 rounded border bg-white text-sm"
            disabled={!aiEnabled}
          >
            <option value="auto">Auto</option>
            <option value="black">Black</option>
            <option value="white">White</option>
          </select>
        </label>

        <button onClick={startNewGame} className="px-4 py-2 rounded-xl border bg-black text-white text-sm shadow hover:opacity-90">
          New Game
        </button>
      </div>

      <div className="w-full max-w-6xl flex items-center justify-center">
        <OmokBoard key={gameKey} aiEnabled={aiEnabled} aiLevel={aiLevel} aiColor={aiColor} />
      </div>
    </main>
  );
}
