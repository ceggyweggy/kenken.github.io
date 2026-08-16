import Link from "next/link";
import { notFound } from "next/navigation";
import { generatePuzzle, type Difficulty } from "@/lib/kenken";
import PuzzleBoard from "@/components/PuzzleBoard";
import NewPuzzleButton from "@/components/NewPuzzleButton";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const VALID_SIZES = [6, 9];
const VALID_DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

export default async function PlayPage({ params, searchParams }: PageProps<"/play/[size]">) {
  const { size } = await params;
  const n = Number(size);
  if (!VALID_SIZES.includes(n)) notFound();

  const { difficulty: rawDifficulty } = await searchParams;
  const difficultyParam = Array.isArray(rawDifficulty) ? rawDifficulty[0] : rawDifficulty;
  const difficulty: Difficulty = VALID_DIFFICULTIES.includes(difficultyParam as Difficulty)
    ? (difficultyParam as Difficulty)
    : "medium";

  const puzzle = generatePuzzle(n, difficulty);

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
          <span>
            {DIFFICULTY_LABEL[difficulty]} &middot; {puzzle.clues.length} cages
          </span>
        </div>
        <NewPuzzleButton className={styles.newPuzzle} />
      </div>

      <div className={styles.boardWrap}>
        <PuzzleBoard puzzle={puzzle} key={JSON.stringify(puzzle.solution)} />
      </div>
    </main>
  );
}
