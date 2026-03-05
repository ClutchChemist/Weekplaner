declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export interface PdfTextContent {
    items: unknown[];
  }

  export interface PdfPageProxy {
    getTextContent(): Promise<PdfTextContent>;
  }

  export interface PdfDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PdfPageProxy>;
  }

  export function getDocument(source: { data: Uint8Array }): {
    promise: Promise<PdfDocumentProxy>;
  };
}
