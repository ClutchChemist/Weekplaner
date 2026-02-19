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
      {/* Preview-Styles: alles auf dunklem Hintergrund gut lesbar machen */}
      <style>{`
        .export-preview-content {
          color: #111 !important;
        }
        .export-preview-content h1,
        .export-preview-content h2,
        .export-preview-content h3,
        .export-preview-content h4,
        .export-preview-content h5,
        .export-preview-content h6 {
          color: #111 !important;
        }
        .export-preview-content table {
          color: #111 !important;
        }
        .export-preview-content th {
          background: #dde1e7 !important;
          color: #111 !important;
        }
        .export-preview-content td {
          color: #111 !important;
        }
        .export-preview-content div,
        .export-preview-content span,
        .export-preview-content li,
        .export-preview-content p,
        .export-preview-content strong {
          color: #111 !important;
        }
        /* Alle hellen Grautöne die im PDF-HTML als inline-style vorkommen überschreiben */
        .export-preview-content [style*="color:#999"],
        .export-preview-content [style*="color: #999"],
        .export-preview-content [style*="color:#666"],
        .export-preview-content [style*="color: #666"],
        .export-preview-content [style*="color:#555"],
        .export-preview-content [style*="color: #555"],
        .export-preview-content [style*="color:#b4b4b4"],
        .export-preview-content [style*="color: #b4b4b4"],
        .export-preview-content [style*="color:#374151"],
        .export-preview-content [style*="color: #374151"] {
          color: #1a1a1a !important;
        }
        .export-preview-content [style*="background:#fafafa"],
        .export-preview-content [style*="background: #fafafa"],
        .export-preview-content [style*="background:#f5f5f5"],
        .export-preview-content [style*="background: #f5f5f5"] {
          background: #e8eaed !important;
        }
      `}</style>
      {/* Navigationsleiste */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          borderBottom: "1px solid #333",
          backgroundColor: "#1e1e1e",
          flexShrink: 0,
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
        <span style={{ color: "#e8e8e8", fontSize: 14, fontWeight: 600 }}>
          {t("previewPageLabel")} {currentPage + 1} {t("previewOfLabel")} {pages.length}
          {page.title ? <> · <span style={{ color: "#bbb", fontWeight: 400 }}>{page.title}</span></> : null}
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

      {/* Seiteninhalt */}
      <div
        className="export-preview-content"
        style={{
          flex: 1,
          overflow: "auto",
          backgroundColor: "#fff",
          padding: 16,
          color: "#111",
        }}
        dangerouslySetInnerHTML={{ __html: page.html }}
      />
    </div>
  );
}
