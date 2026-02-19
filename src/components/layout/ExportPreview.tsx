import { useState } from "react";
import type { PrintPage } from "@/utils/printExport";

type Props = {
  pages: PrintPage[];
  t: (k: string) => string;
};

export function ExportPreview({ pages, t }: Props) {
  const [currentPage, setCurrentPage] = useState(0);


  if (pages.length === 0) {
    return <div style={{ padding: 16, color: "#222" }}>{t("previewNoPages")}</div>;
  }

  const page = pages[currentPage];
  const canPrev = currentPage > 0;
  const canNext = currentPage < pages.length - 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Preview-Styles für bessere Lesbarkeit */}
      <style>{`
        .export-preview-content {
          color: #222 !important;
        }
        .export-preview-content h1, .export-preview-content h2, .export-preview-content h3, .export-preview-content h4, .export-preview-content h5, .export-preview-content h6 {
          color: #111 !important;
        }
        .export-preview-content table {
          color: #222 !important;
        }
        .export-preview-content th {
          background: #e5e7eb !important;
          color: #111 !important;
        }
        .export-preview-content td {
          color: #222 !important;
        }
        .export-preview-content .infoCol {
          color: #222 !important;
        }
        .export-preview-content div, .export-preview-content span, .export-preview-content li {
          color: #222 !important;
        }
        .export-preview-content [style*="color:#999"],
        .export-preview-content [style*="color: #999"],
        .export-preview-content [style*="color:#666"],
        .export-preview-content [style*="color: #666"],
        .export-preview-content [style*="color:#b4b4b4"],
        .export-preview-content [style*="color: #b4b4b4"] {
          color: #222 !important;
        }
        .export-preview-content [style*="background:#fafafa"],
        .export-preview-content [style*="background: #fafafa"],
        .export-preview-content [style*="background:#f5f5f5"],
        .export-preview-content [style*="background: #f5f5f5"] {
          background: #fff !important;
        }
      `}</style>
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
        className="export-preview-content"
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
