'use client';
import React, { useMemo, useState } from 'react';

type Player = 0 | 1 | 2; // 0: empty, 1: black, 2: white
type Coord = {x: number, y: number};

const SIZE = 15;
const DIRS: Coord[] = [
  { x: 1, y: 0 },  // →
  { x: 0, y: 1 },  // ↓
  { x: 1, y: 1 },  // ↘
  { x: 1, y: -1 }, // ↗
];

function makeEmptyBoard(): Player[][] {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function isBounds(x: number, y: number): boolean {
  return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

