import Link from "next/link";
import styles from "./page.module.css";

const SIZES = [
  {
    n: 6,
    desc: "A shorter solve — good for a coffee break. Cages of 1 to 4 cells.",
  },
  {
    n: 9,
    desc: "The full challenge — more cages, longer chains, bigger products.",
  },
];

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
          <Link key={n} href={`/play/${n}`} className={styles.sizeCard}>
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
            <span className={styles.cta}>Solve a puzzle &rarr;</span>
          </Link>
        ))}
      </div>

      <p className={styles.multiplayer}>
        <span className={styles.badge}>Coming soon</span>
        <span>
          <b>Multiplayer</b> &mdash; race a friend to solve the same grid.
        </span>
      </p>
    </main>
  );
}
