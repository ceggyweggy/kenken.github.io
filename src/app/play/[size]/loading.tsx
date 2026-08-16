import styles from "./page.module.css";

export default function Loading() {
  const n = 7;
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
