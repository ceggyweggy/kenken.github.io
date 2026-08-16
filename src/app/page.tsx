import Link from "next/link";
import styles from "./page.module.css";

const SIZES = [
  {
    n: 6,
    desc: "A shorter solve — good for a coffee break.",
  },
  {
    n: 9,
    desc: "The full challenge — more cages, longer chains, bigger products.",
  },
];

const DIFFICULTIES = [
  { key: "easy", label: "Easy", desc: "More singles, cages capped at 3–4 cells." },
  { key: "medium", label: "Medium", desc: "A balanced mix of cage sizes." },
  { key: "hard", label: "Hard", desc: "Few singles, cages up to 7–8 cells." },
] as const;

export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.masthead}>
        <span className={styles.eyebrow}>Latin squares &amp; arithmetic</span>
        <h1>Wisdom Squared</h1>
        <p className={styles.rules}>
          Fill each row and column with <b>1&ndash;N</b>, no repeats. The heavy borders mark{" "}
          <b>cages</b>: the number and symbol in a cage&rsquo;s corner cell is the target its
          cells must reach together, in any order, using that operation. A lone number with no
          symbol is simply that cell&rsquo;s value.
        </p>
      </header>

      <div className={styles.sizes}>
        {SIZES.map(({ n, desc }) => (
          <div key={n} className={styles.sizeCard}>
            <div className={styles.swatch}>
              {Array.from({ length: n }).map((_, r) => (
                <div key={r} className={styles.swatchRow} style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
                  {Array.from({ length: n }).map((_, c) => (
                    <div key={c} className={styles.swatchCell} />
                  ))}
                </div>
              ))}
            </div>
            <h2>
              {n} &times; {n}
            </h2>
            <p className={styles.sizeDesc}>{desc}</p>
            <div className={styles.difficulties}>
              {DIFFICULTIES.map(({ key, label, desc: diffDesc }) => (
                <Link key={key} href={`/play/${n}?difficulty=${key}`} className={styles.diffLink} title={diffDesc}>
                  {label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Link href="/multiplayer" className={styles.multiplayer}>
        <span className={styles.badge}>New</span>
        <span>
          <b>Multiplayer</b> &mdash; race a friend to solve the same grid.
        </span>
      </Link>
    </main>
  );
}
