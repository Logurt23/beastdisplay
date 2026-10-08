import { Component, type ReactNode } from "react";

interface Props {
  /** Shown in place of the crashed subtree. Keep it quiet; never blank the screen. */
  fallback: ReactNode;
  /** Changing this resets the boundary (e.g. on the next payload). */
  resetKey?: unknown;
  children: ReactNode;
}

export class ErrorBoundary extends Component<Props, { failed: boolean; key: unknown }> {
  state = { failed: false, key: this.props.resetKey };

  static getDerivedStateFromProps(props: Props, state: { failed: boolean; key: unknown }) {
    if (props.resetKey !== state.key) return { failed: false, key: props.resetKey };
    return null;
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[BeastDisplay] panel failed to render", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
