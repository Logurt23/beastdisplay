import { useEffect, useState } from "react";
import { BlockedState } from "./BlockedState";
import styles from "./player.module.css";

export const FRAME_WATCHDOG_MS = 15_000;

/**
 * frame: true  - operator confirmed the origin allows framing; render in an iframe
 *                inside the kiosk frame, with a load watchdog.
 * frame: false - top-level navigation. Leaves BeastDisplay; cannot rotate back.
 * Frameability is never auto-detected: cross-origin frame headers are unreadable
 * and a cancelled embed can still fire "load" (Fable report 2.1).
 */
export function ExternalTarget({
  url,
  frame,
  navigate = (u: string) => window.location.replace(u),
}: {
  url: string;
  frame: boolean;
  navigate?: (url: string) => void;
}) {
  if (!frame) return <TopLevel url={url} navigate={navigate} />;
  return <Framed url={url} />;
}

function TopLevel({ url, navigate }: { url: string; navigate: (url: string) => void }) {
  useEffect(() => {
    navigate(url);
  }, [url, navigate]);
  return <BlockedState title="Opening" url={url} />;
}

function Framed({ url }: { url: string }) {
  const [state, setState] = useState<"loading" | "loaded" | "blocked">("loading");

  useEffect(() => {
    setState("loading");
    const timer = setTimeout(() => setState((s) => (s === "loading" ? "blocked" : s)), FRAME_WATCHDOG_MS);
    return () => clearTimeout(timer);
  }, [url]);

  if (state === "blocked") {
    return (
      <BlockedState
        title="Open blocked"
        url={url}
        detail="The page did not load in the display frame. Check that this origin allows framing, or set frame: false."
      />
    );
  }
  return (
    <iframe
      key={url}
      className={styles.iframe}
      src={url}
      title={url}
      referrerPolicy="no-referrer"
      sandbox="allow-scripts allow-same-origin allow-forms"
      onLoad={() => setState("loaded")}
    />
  );
}
