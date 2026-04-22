'use client'

import React from "react";

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Caught Error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 24,
            background:
              "radial-gradient(circle at top, rgba(159, 21, 21, 0.16), transparent 18%), linear-gradient(180deg, #051015 0%, #03080a 38%, #020405 100%)",
            color: "#dce4e2",
            fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
          }}
        >
          <div
            style={{
              width: "min(720px, 100%)",
              border: "1px solid rgba(161, 196, 196, 0.14)",
              background: "rgba(5, 17, 21, 0.9)",
              boxShadow: "0 28px 70px rgba(0, 0, 0, 0.34)",
              padding: 24,
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.34em",
                textTransform: "uppercase",
                color: "#d98c86",
              }}
            >
              containment failure / client runtime
            </div>
            <h2
              style={{
                margin: "12px 0 0",
                fontSize: 24,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#eff7f4",
              }}
            >
              Operator Interface Collapsed
            </h2>
            <pre
              style={{
                margin: "16px 0 0",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: 13,
                lineHeight: 1.6,
                color: "#99ada9",
                fontFamily: '"IBM Plex Mono", Consolas, monospace',
              }}
            >
              {String(this.state.error)}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
