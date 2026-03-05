export type ImportedMmbRow = {
  name: string;
  taNumber?: string;
  birthDate?: string;
  lpStatus?: string;
};

const HEADER_KEYS = {
  name: ["name", "spieler", "spielername", "nachnamevorname", "vornamenachname"],
  firstName: ["vorname", "firstname"],
  lastName: ["nachname", "lastname"],
  ta: ["ta", "tna", "tanummer", "dbbta", "dbbtna", "teilnehmerausweis"],
  birthDate: ["geburtsdatum", "geburt", "birthdate", "dob", "jahrgang"],
  lp: [
    "lp",
    "lpstatus",
    "localplayer",
    "lp-status",
    "stammspieler",
    "moglicheaushilfen",
    "möglicheaushilfen",
  ],
};

function normalizeHeader(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[\s_/\-\\().:]/g, "")
    .trim();
}

function normalizeWhitespace(input: string): string {
  return String(input ?? "").replace(/\s+/g, " ").trim();
}

function normalizeTa(input: string): string | undefined {
  const digits = String(input ?? "").replace(/[^\d]/g, "");
  return digits.length >= 6 ? digits : undefined;
}

function deriveBirthDateFromTa(ta?: string): string | undefined {
  const digits = normalizeTa(ta ?? "");
  if (!digits) return undefined;
  const dd = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const yy = Number(digits.slice(4, 6));
  return toIsoFromDateParts(dd, mm, yy);
}

function toIsoFromDateParts(day: number, month: number, year: number): string | undefined {
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return undefined;
  if (day < 1 || day > 31) return undefined;
  if (month < 1 || month > 12) return undefined;
  const normalizedYear = year < 100 ? (year >= 30 ? 1900 + year : 2000 + year) : year;
  if (normalizedYear < 1900 || normalizedYear > 2100) return undefined;
  return `${String(normalizedYear).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseBirthDate(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }

  const text = normalizeWhitespace(String(value ?? ""));
  if (!text) return undefined;

  const ymd = text.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (ymd) {
    return toIsoFromDateParts(Number(ymd[3]), Number(ymd[2]), Number(ymd[1]));
  }

  const dmy = text.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/);
  if (dmy) {
    return toIsoFromDateParts(Number(dmy[1]), Number(dmy[2]), Number(dmy[3]));
  }

  return undefined;
}

function splitName(rawName: string): { firstName: string; lastName: string; fullName: string } {
  const trimmed = normalizeWhitespace(rawName);
  if (!trimmed) return { firstName: "", lastName: "", fullName: "" };

  if (trimmed.includes(",")) {
    const [left, ...rest] = trimmed.split(",");
    const lastName = normalizeWhitespace(left);
    const firstName = normalizeWhitespace(rest.join(" "));
    const fullName = normalizeWhitespace(`${firstName} ${lastName}`);
    return { firstName, lastName, fullName };
  }

  const parts = trimmed.split(" ");
  if (parts.length <= 1) {
    return { firstName: trimmed, lastName: "", fullName: trimmed };
  }
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName, fullName: normalizeWhitespace(`${firstName} ${lastName}`) };
}

function normalizeLpStatus(value: unknown): string | undefined {
  const text = normalizeWhitespace(String(value ?? ""));
  return text || undefined;
}

function dedupeRows(rows: ImportedMmbRow[]): ImportedMmbRow[] {
  const seen = new Set<string>();
  const result: ImportedMmbRow[] = [];
  for (const row of rows) {
    const nameKey = normalizeWhitespace(row.name).toLowerCase();
    const key = `${row.taNumber ?? ""}|${row.birthDate ?? ""}|${nameKey}`;
    if (!nameKey) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  for (let i = 0; i < headers.length; i += 1) {
    const h = headers[i];
    if (candidates.includes(h)) return i;
  }
  return -1;
}

function parseRowsFromSheetRows(rows: unknown[][]): ImportedMmbRow[] {
  if (rows.length === 0) return [];
  let headerRowIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(rows.length, 40); i += 1) {
    const maybeHeader = (rows[i] ?? []).map((h) => normalizeHeader(String(h ?? "")));
    const hasTa = findColumnIndex(maybeHeader, HEADER_KEYS.ta) >= 0;
    const hasName =
      findColumnIndex(maybeHeader, HEADER_KEYS.name) >= 0 ||
      (findColumnIndex(maybeHeader, HEADER_KEYS.firstName) >= 0 &&
        findColumnIndex(maybeHeader, HEADER_KEYS.lastName) >= 0);
    if (hasTa && hasName) {
      headerRowIndex = i;
      headers = maybeHeader;
      break;
    }
  }

  if (headerRowIndex < 0) return [];

  const nameIdx = findColumnIndex(headers, HEADER_KEYS.name);
  const firstNameIdx = findColumnIndex(headers, HEADER_KEYS.firstName);
  const lastNameIdx = findColumnIndex(headers, HEADER_KEYS.lastName);
  const taIdx = findColumnIndex(headers, HEADER_KEYS.ta);
  const birthIdx = findColumnIndex(headers, HEADER_KEYS.birthDate);
  const lpIdx = findColumnIndex(headers, HEADER_KEYS.lp);

  const parsed: ImportedMmbRow[] = [];
  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const firstNameRaw = firstNameIdx >= 0 ? normalizeWhitespace(String(row[firstNameIdx] ?? "")) : "";
    const lastNameRaw = lastNameIdx >= 0 ? normalizeWhitespace(String(row[lastNameIdx] ?? "")) : "";
    const flatNameRaw = nameIdx >= 0 ? normalizeWhitespace(String(row[nameIdx] ?? "")) : "";
    const nameRaw = flatNameRaw || normalizeWhitespace(`${firstNameRaw} ${lastNameRaw}`);
    if (!nameRaw) continue;

    const taNumber = taIdx >= 0 ? normalizeTa(String(row[taIdx] ?? "")) : undefined;
    const birthDate = birthIdx >= 0 ? parseBirthDate(row[birthIdx]) : undefined;
    const lpStatus = lpIdx >= 0 ? normalizeLpStatus(row[lpIdx]) : undefined;

    parsed.push({
      name: normalizeWhitespace(nameRaw),
      taNumber,
      birthDate: birthDate ?? deriveBirthDateFromTa(taNumber),
      lpStatus,
    });
  }

  return parsed;
}

async function parseMmbExcel(file: File): Promise<ImportedMmbRow[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const collected: ImportedMmbRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" }) as unknown[][];
    collected.push(...parseRowsFromSheetRows(rows));
  }

  return dedupeRows(collected);
}

async function parseMmbPdf(file: File): Promise<ImportedMmbRow[]> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const rows: ImportedMmbRow[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const text = await page.getTextContent();
    const tokens = text.items
      .map((item) => ("str" in item ? normalizeWhitespace(String(item.str ?? "")) : ""))
      .filter(Boolean);

    for (let i = 0; i < tokens.length; i += 1) {
      const taNumber = normalizeTa(tokens[i]);
      if (!taNumber) continue;

      const firstName = normalizeWhitespace(tokens[i - 1] ?? "");
      const lastName = normalizeWhitespace(tokens[i - 2] ?? "");
      if (!firstName || !lastName) continue;
      if (firstName.length < 2 || lastName.length < 2) continue;

      const lpStatus = tokens.slice(i + 1, i + 6).find((token) => /\(lp\)|\blp\b/i.test(token));
      const nearbyDate = tokens
        .slice(i + 1, i + 8)
        .map((token) => parseBirthDate(token))
        .find(Boolean);

      rows.push({
        name: normalizeWhitespace(`${firstName} ${lastName}`),
        taNumber,
        birthDate: nearbyDate ?? deriveBirthDateFromTa(taNumber),
        lpStatus: normalizeLpStatus(lpStatus),
      });
    }
  }

  return dedupeRows(rows);
}

export function splitImportedName(row: ImportedMmbRow): { firstName: string; lastName: string; fullName: string } {
  return splitName(row.name);
}

export function lpStatusToFlags(lpStatus?: string): { isLocalPlayer?: boolean; lpCategory?: string } {
  const status = normalizeLpStatus(lpStatus);
  if (!status) return {};

  const normalized = status.toLowerCase();
  const yesValues = ["lp", "ja", "yes", "lokal", "local", "local player"];
  const noValues = ["kein lp", "nein", "no", "nicht lokal", "non-local", "non local", "nlp"];

  if (yesValues.includes(normalized)) {
    return { isLocalPlayer: true, lpCategory: status };
  }
  if (noValues.includes(normalized)) {
    return { isLocalPlayer: false, lpCategory: status };
  }
  return { lpCategory: status };
}

export function birthYearFromIso(birthDate?: string): number | undefined {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return undefined;
  const year = Number.parseInt(birthDate.slice(0, 4), 10);
  return Number.isFinite(year) ? year : undefined;
}

export async function parseMmbImportFile(file: File): Promise<ImportedMmbRow[]> {
  const lowerName = String(file.name ?? "").toLowerCase();
  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
    return parseMmbExcel(file);
  }
  if (lowerName.endsWith(".pdf")) {
    return parseMmbPdf(file);
  }
  throw new Error("unsupported_file_type");
}
