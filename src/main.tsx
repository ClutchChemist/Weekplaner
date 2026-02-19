import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  state = { hasError: false, errorMessage: "" };

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0f0f10",
          color: "#ececec",
          padding: 24,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Runtime error in app</h2>
        <p style={{ opacity: 0.9 }}>
          The app crashed during render. Open Developer Tools to see the full stack trace.
        </p>
        <pre
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            background: "#171717",
            border: "1px solid #333",
            whiteSpace: "pre-wrap",
          }}
        >
          {this.state.errorMessage}
        </pre>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
