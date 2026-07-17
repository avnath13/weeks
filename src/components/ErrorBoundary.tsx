import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last-resort catch so a render throw shows a recovery screen instead of a
 * blank page. Data lives in localStorage, so a plain reload usually fixes a
 * transient failure; the wipe link covers the corrupt-state case.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <div className="max-w-md">
          <h1 className="font-display text-3xl font-extrabold">
            Something broke.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Not your data - everything you entered is still stored on this
            device. Reloading usually fixes it.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => {
                for (const k of Object.keys(window.localStorage)) {
                  if (k.startsWith("weeks.")) window.localStorage.removeItem(k);
                }
                window.location.reload();
              }}
              className="text-sm text-muted-foreground underline-offset-2 hover:underline"
            >
              Still stuck? Wipe data and start clean
            </button>
          </div>
          <pre className="mt-6 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs text-muted-foreground">
            {this.state.error.message}
          </pre>
        </div>
      </div>
    );
  }
}
