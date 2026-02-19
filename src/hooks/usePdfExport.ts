import type { PrintPage } from "@/utils/printExport";

export function usePdfExport({
  exportPages,
  clubName,
  weekId,
}: {
  exportPages: PrintPage[];
  clubName: string;
  weekId: string;
}) {
  async function createPlanPdf() {
    if (!exportPages || exportPages.length === 0) {
      console.warn("No export pages available for PDF export.");
      return;
    }

    const pagesHtml = exportPages
      .map(
        (p, i) => `
          <section class="print-page" data-page-index="${i + 1}">
            ${p.html}
          </section>
        `
      )
      .join("\n");

    const html = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${clubName} Weekplan PDF</title>
    <style>
      @page { size: A4 portrait; margin: 10mm; }
      html, body {
        margin: 0; padding: 0;
        background: #fff; color: #111;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .print-root { width: 100%; }
      .print-page { break-after: page; page-break-after: always; box-sizing: border-box; }
      .print-page:last-child { break-after: auto; page-break-after: auto; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 11px; }
      th { background: #f5f5f5; font-weight: bold; }
    </style>
  </head>
  <body>
    <main class="print-root">${pagesHtml}</main>
    <script>
      window.addEventListener('load', function() {
        setTimeout(function() { window.print(); }, 300);
      });
    </script>
  </body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, "_blank", "width=1100,height=900");
    if (!printWindow) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `${clubName.replace(/\s+/g, "_")}_Weekplan.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function createPlanPngPages() {
    const { toPng } = await import("html-to-image");
    const host = document.createElement("div");
    host.style.cssText =
      "position:fixed;left:-10000px;top:0;width:900px;background:#fff;padding:0;z-index:999999;";
    document.body.appendChild(host);
    try {
      const pages = exportPages ?? [];
      if (pages.length === 0) return;
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        const pageEl = document.createElement("div");
        pageEl.style.cssText =
          "width:820px;min-height:1060px;background:#fff;color:#111;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;box-sizing:border-box;padding:0;";
        pageEl.innerHTML = p.html;
        host.appendChild(pageEl);
        const dataUrl = await toPng(pageEl, {
          backgroundColor: "#ffffff",
          pixelRatio: 2,
        });
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `week_${weekId}_page_${String(i + 1).padStart(2, "0")}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        host.removeChild(pageEl);
      }
    } finally {
      host.remove();
    }
  }

  return { createPlanPdf, createPlanPngPages };
}
