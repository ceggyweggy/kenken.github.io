"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { generatePuzzle, type Puzzle } from "@/lib/kenken";
import PuzzleBoard from "@/components/PuzzleBoard";
import NewPuzzleButton from "@/components/NewPuzzleButton";
import styles from "./page.module.css";

export default function PuzzleClient({ n }: { n: number }) {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [pending, setPending] = useState(true);

  const shuffle = useCallback(() => {
    setPending(true);
    setTimeout(() => {
      setPuzzle(generatePuzzle(n));
      setPending(false);
    }, 0);
  }, [n]);

  useEffect(() => {
    shuffle();
  }, [shuffle]);

  if (!puzzle) {
    return (
      <main className={styles.page}>
        <div className={styles.boardWrap}>
          <div className={styles.skeleton}>
            <div className={styles.skeletonGrid} style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
              {Array.from({ length: n * n }).map((_, i) => (
                <div key={i} className={styles.skeletonCell} />
              ))}
            </div>
            <p className={styles.skeletonNote}>Shuffling a fresh grid and checking it solves uniquely…</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.top}>
        <Link href="/" className={styles.back}>
          &larr; Choose a size
        </Link>
        <div className={styles.title}>
          <h1>
            {n} &times; {n}
          </h1>
          <span>{puzzle.clues.length} cages</span>
        </div>
        <NewPuzzleButton className={styles.newPuzzle} pending={pending} onClick={shuffle} />
      </div>

      <div className={styles.boardWrap}>
        <PuzzleBoard puzzle={puzzle} key={JSON.stringify(puzzle.solution)} />
      </div>
    </main>
  );
}
