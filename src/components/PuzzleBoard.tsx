"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Puzzle } from "@/lib/kenken";
import styles from "./PuzzleBoard.module.css";

const OP_SYMBOL: Record<string, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface CellStyle {
  borderTop: string;
  borderLeft: string;
  borderRight?: string;
  borderBottom?: string;
}

export default function PuzzleBoard({ puzzle }: { puzzle: Puzzle }) {
  const n = puzzle.size;
  const [values, setValues] = useState<string[][]>(() => Array.from({ length: n }, () => Array(n).fill("")));
  const [marks, setMarks] = useState<("" | "correct" | "incorrect")[][]>(() =>
    Array.from({ length: n }, () => Array(n).fill(""))
  );
  const [status, setStatus] = useState<{ text: string; kind: "" | "ok" | "bad" }>({ text: "", kind: "" });
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const solved = status.kind === "ok";

  useEffect(() => {
    if (paused || solved) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [paused, solved]);

  const { labelAt, cellStyle } = useMemo(() => {
    const cageOf = new Map<string, number>();
    const labels = new Map<string, string>();

    puzzle.clues.forEach((clue, gi) => {
      let top = clue.cells[0];
      for (const cell of clue.cells) {
        cageOf.set(cell.join(","), gi);
        if (cell[0] < top[0] || (cell[0] === top[0] && cell[1] < top[1])) top = cell;
      }
      const label = clue.op ? `${clue.target}${OP_SYMBOL[clue.op]}` : `${clue.target}`;
      labels.set(top.join(","), label);
    });

    const styleAt = new Map<string, CellStyle>();
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const key = `${r},${c}`;
        const mine = cageOf.get(key);
        const topOuter = r === 0;
        const leftOuter = c === 0;
        const topThick = topOuter || cageOf.get(`${r - 1},${c}`) !== mine;
        const leftThick = leftOuter || cageOf.get(`${r},${c - 1}`) !== mine;

        const cell: CellStyle = {
          borderTop: `${topOuter ? 2.5 : topThick ? 2 : 1}px solid ${topThick ? "var(--cage-line)" : "var(--grid-line)"}`,
          borderLeft: `${leftOuter ? 2.5 : leftThick ? 2 : 1}px solid ${leftThick ? "var(--cage-line)" : "var(--grid-line)"}`,
        };
        if (c === n - 1) cell.borderRight = "2.5px solid var(--cage-line)";
        if (r === n - 1) cell.borderBottom = "2.5px solid var(--cage-line)";
        styleAt.set(key, cell);
      }
    }

    return { labelAt: labels, cellStyle: styleAt };
  }, [puzzle, n]);

  const cells = useMemo(
    () => Array.from({ length: n * n }, (_, i): [number, number] => [Math.floor(i / n), i % n]),
    [n]
  );

  function updateCell(r: number, c: number, raw: string) {
    const digits = raw.replace(/[^1-9]/g, "");
    const v = digits && Number(digits) <= n ? digits.slice(-1) : "";
    setValues((prev) => {
      const next = prev.map((row) => row.slice());
      next[r][c] = v;
      return next;
    });
    setMarks((prev) => {
      const next = prev.map((row) => row.slice());
      next[r][c] = "";
      return next;
    });
    setStatus({ text: "", kind: "" });
  }

  function handleKeyDown(r: number, c: number, e: React.KeyboardEvent<HTMLInputElement>) {
    const dirs: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const dir = dirs[e.key];
    if (!dir) return;
    e.preventDefault();
    const nr = r + dir[0];
    const nc = c + dir[1];
    if (nr < 0 || nr >= n || nc < 0 || nc >= n) return;
    gridRef.current?.querySelector<HTMLInputElement>(`input[data-r="${nr}"][data-c="${nc}"]`)?.focus();
  }

  function check() {
    let filled = 0;
    let wrong = 0;
    const nextMarks: ("" | "correct" | "incorrect")[][] = values.map((row, r) =>
      row.map((val, c) => {
        if (!val) return "";
        filled += 1;
        const ok = Number(val) === puzzle.solution[r][c];
        if (!ok) wrong += 1;
        return ok ? "correct" : "incorrect";
      })
    );
    setMarks(nextMarks);

    if (filled < n * n) {
      setStatus({ text: `${n * n - filled} cell${n * n - filled === 1 ? "" : "s"} left to fill.`, kind: "" });
    } else if (wrong === 0) {
      setStatus({ text: "Solved — every cage and every row checks out.", kind: "ok" });
    } else {
      setStatus({ text: `${wrong} cell${wrong === 1 ? "" : "s"} off. Keep going.`, kind: "bad" });
    }
  }

  function reveal() {
    setValues(puzzle.solution.map((row) => row.map((v) => String(v))));
    setMarks(Array.from({ length: n }, () => Array(n).fill("")));
    setStatus({ text: "Solution revealed.", kind: "" });
  }

  function reset() {
    setValues(Array.from({ length: n }, () => Array(n).fill("")));
    setMarks(Array.from({ length: n }, () => Array(n).fill("")));
    setStatus({ text: "", kind: "" });
    setElapsed(0);
    setPaused(false);
  }

  return (
    <div className={`${styles.board} ${n === 6 ? styles.size6 : styles.size9}`}>
      <div className={styles.timerRow}>
        <span className={styles.timer}>{formatTime(elapsed)}</span>
        <button onClick={() => setPaused((p) => !p)} disabled={solved}>
          {paused ? "Resume" : "Pause"}
        </button>
      </div>

      {paused ? (
        <div className={styles.pausedOverlay}>
          <p>Timer paused. Board hidden.</p>
          <button className={styles.primary} onClick={() => setPaused(false)}>
            Resume
          </button>
        </div>
      ) : (
        <div className={styles.gridWrap}>
          <div
            ref={gridRef}
            className={styles.grid}
            style={{ gridTemplateColumns: `repeat(${n}, minmax(2.6rem, 3.4rem))`, maxWidth: `${n * 3.4}rem` }}
          >
            {cells.map(([r, c]) => {
              const key = `${r},${c}`;
              const label = labelAt.get(key);
              const mark = marks[r][c];
              return (
                <div
                  key={key}
                  className={`${styles.cell} ${mark === "correct" ? styles.correct : ""} ${mark === "incorrect" ? styles.incorrect : ""}`}
                  style={cellStyle.get(key)}
                >
                  {label && <span className={styles.clueLabel}>{label}</span>}
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    data-r={r}
                    data-c={c}
                    aria-label={`Row ${r + 1}, column ${c + 1}`}
                    value={values[r][c]}
                    onChange={(e) => updateCell(r, c, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(r, c, e)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={styles.controls}>
        <button className={styles.primary} onClick={check} disabled={paused}>
          Check
        </button>
        <button onClick={reveal} disabled={paused}>Reveal</button>
        <button onClick={reset}>Reset</button>
      </div>

      <div className={`${styles.status} ${status.kind === "ok" ? styles.statusOk : status.kind === "bad" ? styles.statusBad : ""}`}>
        {status.text}
      </div>
    </div>
  );
}
