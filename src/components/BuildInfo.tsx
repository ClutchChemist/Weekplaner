export default function BuildInfo() {
  const buildSha = import.meta.env.VITE_BUILD_SHA?.slice(0, 7) ?? "local";
  const version = "0.1.0"; // From package.json

  return (
    <div
      style={{
        position: "fixed",
        bottom: "8px",
        right: "8px",
        fontSize: "11px",
        color: "#666",
        backgroundColor: "rgba(255, 255, 255, 0.8)",
        padding: "4px 8px",
        borderRadius: "4px",
        fontFamily: "monospace",
        zIndex: 9999,
      }}
    >
      v{version} • {buildSha}
    </div>
  );
}
