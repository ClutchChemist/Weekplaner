import { useEffect, useRef, useState } from "react";
import type { PrintPage } from "@/utils/printExport";

type Props = {
  pages: PrintPage[];
  t: (k: string) => string;
};

// DIN A4 Maße in px bei 96dpi: 794 x 1123
const A4_W = 794;
const A4_H = 1123;

export function ExportPreview({ pages, t }: Props) {
  const [currentPage, setCurrentPage] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const page = pages[currentPage] ?? null;
  const canPrev = currentPage > 0;
  const canNext = currentPage < pages.length - 1;

  // Seite in iframe schreiben (kein Cross-Origin, alles lokal)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !page) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
          background: white;
          color: #111;
          padding: 10mm;
          width: ${A4_W}px;
        }
        table { border-collapse: collapse; width: 100%; table-layout: auto; }
        th, td {
          border: 1px solid #ccc;
          padding: 3px 5px;
          font-size: 9px;
          vertical-align: middle;
          white-space: nowrap;
        }
        th { background: #f3f4f6; font-weight: 700; text-align: center; }
        td { text-align: center; }
        td:last-child {
          white-space: normal;
          word-break: break-word;
          text-align: left;
        }
        img { max-width: 100%; }
      </style>
    </head><body>${page.html}</body></html>`;
    doc.open();
    doc.write(html);
    doc.close();
    // iframe Höhe dynamisch an Inhalt anpassen
    const resize = () => {
      const body = iframe.contentDocument?.body;
      if (body) {
        const h = Math.max(A4_H, body.scrollHeight + 20);
        iframe.style.height = `${h}px`;
      }
    };
    iframe.onload = resize;
    setTimeout(resize, 150);
  }, [page, currentPage]);

  if (pages.length === 0) {
    return <div style={{ padding: 16, color: "#aaa", fontSize: 13 }}>{t("previewNoPages")}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#1e1e1e" }}>
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
        <span style={{ color: "#e8e8e8", fontSize: 13, fontWeight: 600 }}>
          {t("previewPageLabel")} {currentPage + 1} / {pages.length}
          {page?.title ? <> · <span style={{ color: "#bbb", fontWeight: 400 }}>{page.title}</span></> : null}
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

      {/* A4-Seitenrahmen auf grauem Hintergrund, vertikal scrollbar */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: "auto",
          background: "#666",
          display: "flex",
          justifyContent: "center",
          padding: "16px 8px",
        }}
      >
        <div
          style={{
            width: A4_W,
            minHeight: A4_H,
            background: "white",
            boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
            flexShrink: 0,
          }}
        >
          <iframe
            ref={iframeRef}
            title="PDF Vorschau"
            scrolling="no"
            style={{
              border: "none",
              width: A4_W,
              height: A4_H,
              display: "block",
            }}
          />
        </div>
      </div>
    </div>
  );
}
