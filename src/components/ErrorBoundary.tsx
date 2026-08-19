import { Component, type ErrorInfo, type ReactNode } from "react";
import { Card } from "./ui";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** A render error anywhere in the page content must not take the whole app down with it -- this
 * indexer serves arbitrary, evolving on-chain data through dozens of narrow type assertions
 * (`as`), and an unexpected shape in any one of them would otherwise unmount the entire React tree,
 * including the header, search bar, and nav that would let someone navigate away from the problem.
 * React only supports catching render errors via a class component's static lifecycle method --
 * there's no hook equivalent. The caller resets this by remounting on route change (`key={pathname}`
 * at the call site) rather than this component tracking that itself. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Render error caught by ErrorBoundary:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <Card className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-danger">Something went wrong rendering this page</p>
          <p className="mt-2 font-mono text-xs text-ink-faint">{this.state.error.message}</p>
          <p className="mt-4 text-xs text-ink-dim">
            This is usually an unexpected shape in the raw data this page received, not something wrong with the underlying transaction or
            substate itself. Try navigating elsewhere and back, or search for it again.
          </p>
        </Card>
      );
    }
    return this.props.children;
  }
}
