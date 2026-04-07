"use client";

import { Component, ErrorInfo, ReactNode } from "react";

type Props = {
  children: ReactNode;
  sectionName: string;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary: ${this.props.sectionName}]`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="card stack" style={{ gap: "0.5rem" }}>
          <p style={{ color: "var(--danger)", margin: 0, fontSize: "0.9rem" }}>
            Something went wrong in {this.props.sectionName}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              alignSelf: "flex-start",
              fontSize: "0.82rem",
              padding: "0.3rem 0.75rem",
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--muted)",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
