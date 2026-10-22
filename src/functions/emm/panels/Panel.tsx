import type { ReactNode } from "react";
import styles from "../styles/emm.module.css";

export function Panel({
  title,
  meta,
  page,
  pages,
  className,
  children,
}: {
  title: string;
  meta?: ReactNode;
  page?: number;
  pages?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${styles.panel} ${className ?? ""}`} aria-label={title}>
      <header className={styles.panelHead}>
        <h2 className={styles.panelTitle}>{title}</h2>
        {meta !== undefined ? <div className={styles.panelMeta}>{meta}</div> : null}
        {pages && pages > 1 ? (
          <div className={styles.dots} aria-label={`Page ${(page ?? 0) + 1} of ${pages}`}>
            {Array.from({ length: pages }, (_, i) => (
              <span key={i} className={i === page ? styles.dotOn : styles.dot} />
            ))}
          </div>
        ) : null}
      </header>
      <div className={styles.panelBody}>{children}</div>
    </section>
  );
}

export function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyTitle}>{title}</div>
      {detail ? <div className={styles.emptyDetail}>{detail}</div> : null}
    </div>
  );
}
