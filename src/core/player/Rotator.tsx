import { useEffect, useState, type ReactNode } from "react";
import { targetKey, type Target } from "../targets";

/** One timer, one index. Pauses while paused is true (e.g. badge offline). */
export function useRotation(targets: Target[], rotateSeconds: number, paused: boolean): Target {
  const [index, setIndex] = useState(0);
  const count = targets.length;

  useEffect(() => {
    if (rotateSeconds <= 0 || count < 2 || paused) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % count), rotateSeconds * 1000);
    return () => clearTimeout(timer);
  }, [index, rotateSeconds, count, paused]);

  return targets[Math.min(index, count - 1)];
}

export function Rotator({
  targets,
  rotateSeconds,
  paused,
  children,
}: {
  targets: Target[];
  rotateSeconds: number;
  paused: boolean;
  children: (target: Target) => ReactNode;
}) {
  const current = useRotation(targets, rotateSeconds, paused);
  return <div key={targetKey(current)} style={{ display: "contents" }}>{children(current)}</div>;
}
