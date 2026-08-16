import Link from "next/link";
import { notFound } from "next/navigation";
import { generatePuzzle } from "@/lib/kenken";
import PuzzleBoard from "@/components/PuzzleBoard";
import NewPuzzleButton from "@/components/NewPuzzleButton";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const VALID_SIZES = [6, 9];

export default async function PlayPage({ params }: PageProps<"/play/[size]">) {
  const { size } = await params;
  const n = Number(size);
  if (!VALID_SIZES.includes(n)) notFound();

  const puzzle = generatePuzzle(n);

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
        <NewPuzzleButton className={styles.newPuzzle} />
      </div>

      <div className={styles.boardWrap}>
        <PuzzleBoard puzzle={puzzle} key={JSON.stringify(puzzle.solution)} />
      </div>
    </main>
  );
}
