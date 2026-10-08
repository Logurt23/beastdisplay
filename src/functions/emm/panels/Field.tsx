import styles from "../styles/field.module.css";

/**
 * The room behind the board, ported from Nexus's FieldBackdrop (2026-10-05, at
 * Logan's request): three slowly drifting mint blooms and the ZEMM letterforms.
 * CSS transforms only, no per-frame JS; holds still under reduced motion.
 */
export function Field() {
  return (
    <div className={styles.field} aria-hidden="true">
      <div className={`${styles.bloom} ${styles.bloomA}`} />
      <div className={`${styles.bloom} ${styles.bloomB}`} />
      <div className={`${styles.bloom} ${styles.bloomC}`} />
      <div className={styles.letters}>ZEMM</div>
    </div>
  );
}
