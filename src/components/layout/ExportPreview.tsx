import { useState } from "react";
import type { PrintPage } from "@/utils/printExport";

type Props = {
  pages: PrintPage[];
  t: (k: string) => string;
};

export function ExportPreview({ pages, t }: Props) {
  const [currentPage, setCurrentPage] = useState(0);

  if (pages.length === 0) {
    return <div style={{ padding: 16, color: "#999" }}>{t("previewNoPages")}</div>;
  }

  const page = pages[currentPage];
  const canPrev = currentPage > 0;
  const canNext = currentPage < pages.length - 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          borderBottom: "1px solid #444",
          backgroundColor: "#2a2a2a",
        }}
      >
        <button
          onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
          disabled={!canPrev}
          style={{
            padding: "6px 12px",
            backgroundColor: canPrev ? "#3f3f3f" : "#2a2a2a",
            border: "1px solid #555",
            color: canPrev ? "#fff" : "#666",
            cursor: canPrev ? "pointer" : "not-allowed",
            borderRadius: 4,
          }}
        >
          ◀
        </button>
        <span style={{ color: "#ddd", fontSize: 14 }}>
          {t("previewPageLabel")} {currentPage + 1} {t("previewOfLabel")} {pages.length}
        </span>
        <button
          onClick={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
          disabled={!canNext}
          style={{
            padding: "6px 12px",
            backgroundColor: canNext ? "#3f3f3f" : "#2a2a2a",
            border: "1px solid #555",
            color: canNext ? "#fff" : "#666",
            cursor: canNext ? "pointer" : "not-allowed",
            borderRadius: 4,
          }}
        >
          ▶
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          backgroundColor: "#fff",
          padding: 16,
        }}
        dangerouslySetInnerHTML={{ __html: page.html }}
      />
    </div>
  );
}
