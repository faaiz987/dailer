import Papa from "papaparse";
import { BIG_ID_COLUMNS, EXPECTED_COLUMNS } from "./columns";
import {
  buildAddress,
  dayKey,
  expandScientific,
  normalizePhone,
  parseBool,
  parseNum,
} from "./format";
import type { ImportOptions, ImportSummary, Lead } from "./types";

export interface ParsedTable {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
  matchedHeaders: string[];
  missingHeaders: string[];
  extraHeaders: string[];
}

type Row = Record<string, string>;

const norm = (h: string) => h.replace(/^\uFEFF/, "").trim().toLowerCase();

function objectRows(headers: string[], rows: string[][]): Row[] {
  return rows
    .filter((cells) => cells.some((cell) => (cell ?? "").trim() !== ""))
    .map((cells) => {
      const row: Row = {};
      headers.forEach((header, index) => {
        if (!header) return;
        const value = cells[index];
        row[header] = value === undefined || value === null ? "" : String(value);
      });
      return row;
    });
}

export async function parseFile(file: File): Promise<ParsedTable> {
  const lower = file.name.toLowerCase();
  const isExcel = lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".xlsm");
  let headers: string[] = [];
  let rows: Row[] = [];

  if (isExcel) {
    // SheetJS is heavy and only needed for Excel imports.
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellText: true, cellDates: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("The workbook has no sheets.");
    const sheet = workbook.Sheets[sheetName];
    // raw:false keeps every cell as its displayed text, never a JS number.
    const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });
    if (!matrix.length) throw new Error("The first sheet is empty.");
    headers = (matrix[0] ?? []).map((h) => String(h ?? ""));
    rows = objectRows(
      headers,
      matrix.slice(1).map((row) => row.map((cell) => String(cell ?? ""))),
    );
  } else {
    const text = await file.text();
    const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
      header: false,
      dynamicTyping: false,
      skipEmptyLines: "greedy",
    });
    if (result.errors.length && result.data.length <= 1) {
      throw new Error(result.errors[0]?.message ?? "Could not parse the CSV file.");
    }
    const matrix = result.data.map((row) => row.map((cell) => (cell == null ? "" : String(cell))));
    if (!matrix.length) throw new Error("The file is empty.");
    headers = (matrix[0] ?? []).map((h) => String(h ?? ""));
    rows = objectRows(headers, matrix.slice(1));
  }

  if (!headers.some((h) => norm(h))) {
    throw new Error("No header row found. Export the sheet with column headers.");
  }

  const headerLookup = new Set(headers.map(norm));
  const matchedHeaders = EXPECTED_COLUMNS.filter((c) => headerLookup.has(norm(c)));
  const missingHeaders = EXPECTED_COLUMNS.filter((c) => !headerLookup.has(norm(c)));
  const expectedLookup = new Set(EXPECTED_COLUMNS.map(norm));
  const extraHeaders = headers.filter((h) => h.trim() && !expectedLookup.has(norm(h)));

  return {
    fileName: file.name,
    headers,
    rows,
    matchedHeaders,
    missingHeaders,
    extraHeaders,
  };
}

export function getCell(row: Row, column: string): string {
  const target = norm(column);
  const key = Object.keys(row).find((k) => norm(k) === target);
  return key ? (row[key] ?? "") : "";
}

function fallbackId(row: Row): string {
  const placeId = getCell(row, "placeId").trim();
  if (placeId) return placeId;
  const cid = getCell(row, "cid").trim();
  if (cid) return `cid:${cid}`;
  const fingerprint = [
    getCell(row, "title"),
    getCell(row, "street"),
    getCell(row, "city"),
    getCell(row, "phoneUnformatted") || getCell(row, "phone"),
  ]
    .join("|")
    .toLowerCase();
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    hash = (hash * 31 + fingerprint.charCodeAt(i)) >>> 0;
  }
  return `local:${hash.toString(36)}`;
}

function text(row: Row, column: string): string {
  const value = getCell(row, column);
  if (BIG_ID_COLUMNS.has(column.toLowerCase())) return expandScientific(value);
  return value;
}

export interface BuildResult {
  leads: Lead[];
  summary: ImportSummary;
}

export function buildLeads(
  table: ParsedTable,
  options: ImportOptions,
  existingIds: Set<string>,
  defaultCountry: string,
): BuildResult {
  const leads: Lead[] = [];
  const seen = new Set(existingIds);
  let duplicates = 0;
  let noPhone = 0;
  let permanentlyClosed = 0;
  let temporarilyClosed = 0;
  let emptyCategory = 0;
  let missingPlaceId = 0;

  for (const row of table.rows) {
    const placeId = fallbackId(row);
    if (!getCell(row, "placeId").trim()) missingPlaceId++;

    if (seen.has(placeId)) {
      duplicates++;
      continue;
    }
    seen.add(placeId);

    const closed = parseBool(text(row, "permanentlyClosed"));
    if (closed && !options.importClosed) {
      permanentlyClosed++;
      continue;
    }

    const rawPhone = text(row, "phoneUnformatted");
    const displayPhone = text(row, "phone");
    const countryCode = text(row, "countryCode").trim() || defaultCountry;
    const phone = normalizePhone(rawPhone, displayPhone, countryCode);

    if (!phone && !options.importNoPhone) {
      noPhone++;
      continue;
    }

    const categoryName = text(row, "categoryName").trim();
    if (!categoryName || /^area$/i.test(categoryName)) emptyCategory++;

    const tempClosed = parseBool(text(row, "temporarilyClosed"));
    if (tempClosed) temporarilyClosed++;

    const hours: Record<string, string> = {};
    for (let i = 0; i < 7; i++) {
      const day = text(row, `openingHours/${i}/day`);
      const value = text(row, `openingHours/${i}/hours`);
      if (day) hours[dayKey(day).toLowerCase()] = value;
    }

    const raw: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      raw[key] = BIG_ID_COLUMNS.has(norm(key)) ? expandScientific(value) : value;
    }

    const street = text(row, "street").trim();
    const city = text(row, "city").trim();
    const state = text(row, "state").trim();
    const postalCode = text(row, "postalCode").trim();
    const address = text(row, "address").trim();
    const formattedAddress = buildAddress({ street, city, state, postalCode }) || address;

    leads.push({
      placeId,
      title: text(row, "title").trim() || "Untitled business",
      categoryName,
      phone,
      phoneRaw: displayPhone,
      phoneUnformatted: rawPhone,
      totalScore: parseNum(text(row, "totalScore")),
      reviewsCount: parseNum(text(row, "reviewsCount")),
      reviewsDistribution: {
        "5": parseNum(text(row, "reviewsDistribution/fiveStar")) ?? 0,
        "4": parseNum(text(row, "reviewsDistribution/fourStar")) ?? 0,
        "3": parseNum(text(row, "reviewsDistribution/threeStar")) ?? 0,
        "2": parseNum(text(row, "reviewsDistribution/twoStar")) ?? 0,
        "1": parseNum(text(row, "reviewsDistribution/oneStar")) ?? 0,
      },
      street,
      city,
      state,
      postalCode,
      neighborhood: text(row, "neighborhood").trim(),
      countryCode,
      formattedAddress,
      url: text(row, "url").trim() || (text(row, "placeId") ? `https://www.google.com/maps/place/?q=place_id:${text(row, "placeId")}` : ""),
      website: text(row, "website").trim(),
      claimThisBusiness: parseBool(text(row, "claimThisBusiness")),
      price: text(row, "price").trim(),
      permanentlyClosed: closed,
      temporarilyClosed: tempClosed,
      description: text(row, "description").trim(),
      ownerDescription: text(row, "ownerDescription").trim(),
      hours,
      rank: parseNum(text(row, "rank")),
      lat: parseNum(text(row, "location/lat")),
      lng: parseNum(text(row, "location/lng")),
      raw,
      status: "new",
      attempts: 0,
      lastCalledAt: null,
      nextCallbackAt: null,
      snoozeUntil: null,
      notes: "",
      history: [],
      importedAt: new Date().toISOString(),
      searchString: [
        text(row, "title"),
        categoryName,
        street,
        city,
        state,
        postalCode,
        text(row, "neighborhood"),
        text(row, "phone"),
        rawPhone,
      ]
        .join(" ")
        .toLowerCase(),
    });
  }

  const summary: ImportSummary = {
    fileName: table.fileName,
    totalRows: table.rows.length,
    imported: leads.length,
    duplicates,
    noPhone,
    permanentlyClosed,
    temporarilyClosed,
    emptyCategory,
    missingPlaceId,
    headersMatched: table.matchedHeaders.length,
    headersTotal: EXPECTED_COLUMNS.length,
    at: new Date().toISOString(),
  };

  return { leads, summary };
}
