import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { buildCallTarget, describeCallTarget } from "../call";
import { buildCallLogCsv, buildWorkingCsv, EXTRA_COLUMNS, mergeHeaderNames } from "../export";
import { expandScientific, formatPhone, getOpenState, normalizePhone, telHref } from "../format";
import { buildLeads, parseFile, type ParsedTable } from "../parse";
import { buildQueue, flagsFor, isDueCallback, sessionStats } from "../queue";
import { createSampleCsv } from "../sample";
import { DEFAULT_QUEUE, type Lead } from "../types";

async function sampleTable(): Promise<ParsedTable> {
  const file = new File([createSampleCsv()], "sample.csv", { type: "text/csv" });
  return parseFile(file);
}

async function sampleResult(importNoPhone = false, importClosed = false) {
  const table = await sampleTable();
  const result = buildLeads(table, { importNoPhone, importClosed }, new Set(), "US");
  return { table, ...result };
}

function makeLead(overrides: Partial<Lead> = {}): Lead {
  const now = new Date().toISOString();
  return {
    placeId: "ChIJtest",
    title: "Test Plumbing",
    categoryName: "Plumber",
    phone: "+15125550199",
    phoneRaw: "(512) 555-0199",
    phoneUnformatted: "15125550199",
    totalScore: 4.4,
    reviewsCount: 120,
    reviewsDistribution: { "1": 2, "2": 3, "3": 10, "4": 25, "5": 80 },
    street: "1 Main St",
    city: "Austin",
    state: "TX",
    postalCode: "78704",
    neighborhood: "South Lamar",
    countryCode: "US",
    formattedAddress: "1 Main St, Austin, TX 78704",
    url: "https://maps.google.com/?cid=1",
    website: "test.example",
    claimThisBusiness: true,
    price: "$$",
    permanentlyClosed: false,
    temporarilyClosed: false,
    description: "",
    ownerDescription: "",
    hours: { monday: "7 AM–9 PM" },
    rank: 1,
    lat: 30,
    lng: -97,
    raw: { placeId: "ChIJtest", title: "Test Plumbing" },
    status: "new",
    attempts: 0,
    lastCalledAt: null,
    nextCallbackAt: null,
    snoozeUntil: null,
    notes: "",
    history: [],
    importedAt: now,
    searchString: "test plumbing plumber austin tx 78704 south lamar",
    ...overrides,
  };
}

describe("sample import", () => {
  it("maps all 73 expected headers and skips the duplicate placeId", async () => {
    const { table } = await sampleResult();
    expect(table.headers.length).toBe(73);
    expect(table.matchedHeaders.length).toBe(73);
    expect(table.rows.length).toBe(21);

    const { summary, leads } = await sampleResult();
    expect(leads.length).toBe(17);
    expect(summary.imported).toBe(17);
    expect(summary.duplicates).toBe(1);
    expect(summary.noPhone).toBe(2);
    expect(summary.permanentlyClosed).toBe(1);
    expect(summary.temporarilyClosed).toBe(0);
    expect(summary.emptyCategory).toBe(0);
  });

  it("imports flagged rows when asked to", async () => {
    const { leads } = await sampleResult(true, true);
    expect(leads.length).toBe(20);
    const flagged = leads.filter((lead) => flagsFor(lead).flagged);
    expect(flagged).toHaveLength(3);
    expect(flagged.map((lead) => lead.title).sort()).toEqual([
      "East Austin",
      "Eastside Potters",
      "Vintage Cinema Grill",
    ]);
  });

  it("normalizes phone numbers to E.164", async () => {
    const { leads } = await sampleResult(true, true);
    const radio = leads.find((lead) => lead.title === "Radio Coffee & Beer");
    expect(radio?.phone).toBe("+15125550161");
    expect(radio?.raw.phone).toBe("(512) 555-0161");
    expect(formatPhone(radio!.phone)).toBe("+1 (512) 555-0161");
  });

  it("computes open/closed state in America/Chicago", async () => {
    const hours = { monday: "7 AM–9 PM" };
    const at6am = new Date("2026-10-19T11:00:00Z"); // 6:00 AM CDT Monday
    const at7am = new Date("2026-10-19T12:00:00Z"); // 7:00 AM CDT
    const at10pm = new Date("2026-10-20T03:00:00Z"); // 10:00 PM CDT Monday
    expect(getOpenState(hours, at6am)).toMatchObject({ open: false, detail: "Opens at 7 AM" });
    expect(getOpenState(hours, at7am)).toMatchObject({ open: true, label: "Open now" });
    expect(getOpenState({ monday: "Closed" }, at7am)).toMatchObject({ open: false, label: "Closed" });
    expect(getOpenState({}, at7am)).toMatchObject({ label: "Hours unavailable" });
    expect(getOpenState(hours, at10pm).open).toBe(false);
  });
});

describe("text-safe parsing", () => {
  it("expands scientific notation without numeric rounding", () => {
    expect(expandScientific("4.09416862714352e+18")).toBe("4094168627143520000");
    expect(expandScientific("1.5e-3")).toBe("0.0015");
    expect(expandScientific("ChIJnormalPlaceId")).toBe("ChIJnormalPlaceId");
  });

  it("keeps id columns as text and applies phone fallback", async () => {
    const csv = [
      "placeId,title,cid,businessProfileId,phoneUnformatted,phone,countryCode,categoryName,temporarilyClosed,permanentlyClosed",
      'p1,Alpha Plumbing,4.09416862714352e+18,9.1E+17,15122801680,,US,Plumber,false,false',
      'p2,Beta Cafe,1.5e+18,,,512-555-0188,US,Cafe,true,false',
      'p2,Duplicate,1.5e+18,,15125550188,,US,Cafe,false,false',
    ].join("\n");
    const table = await parseFile(new File([csv], "leads.csv", { type: "text/csv" }));
    const result = buildLeads(table, { importNoPhone: false, importClosed: false }, new Set(), "US");
    expect(result.leads).toHaveLength(2);
    expect(result.summary.duplicates).toBe(1);
    const alpha = result.leads[0];
    expect(typeof alpha.raw.cid).toBe("string");
    expect(alpha.raw.cid).toBe("4094168627143520000");
    expect(alpha.raw.businessProfileId).toBe("910000000000000000");
    expect(alpha.phone).toBe("+15122801680");
    expect(result.leads[1].phone).toBe("+15125550188");
    expect(flagsFor(result.leads[1]).closed).toBe(true);
  });

  it("matches headers case-insensitively and detects extra columns", async () => {
    const csv = ["PLACEID,Title,Phone, CountryCode,extra_column", "p9,Nine,15125550100,US,keep me"].join("\n");
    const table = await parseFile(new File([csv], "case.csv", { type: "text/csv" }));
    expect(table.matchedHeaders).toContain("placeId");
    expect(table.matchedHeaders).toContain("phone");
    expect(table.extraHeaders).toEqual(["extra_column"]);
    const { leads } = buildLeads(table, { importNoPhone: false, importClosed: false }, new Set(), "US");
    expect(leads[0].phone).toBe("+15125550100");
    expect(leads[0].raw.extra_column).toBe("keep me");
  });

  it("parses XLSX cells as text", async () => {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.aoa_to_sheet([
      ["placeId", "title", "cid", "phoneUnformatted", "countryCode", "categoryName"],
      ["x1", "Excel Co", "4.09416862714352e+18", "15125550123", "US", "Contractor"],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Leads");
    const buffer = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const table = await parseFile(new File([buffer], "leads.xlsx"));
    expect(table.rows).toHaveLength(1);
    const { leads } = buildLeads(table, { importNoPhone: false, importClosed: false }, new Set(), "US");
    expect(leads[0].phone).toBe("+15125550123");
    expect(leads[0].raw.cid).toBe("4094168627143520000");
  });
});

describe("queue rules", () => {
  it("excludes flagged leads by default and always excludes DNC", async () => {
    const { leads } = await sampleResult(true, true);
    const base = buildQueue(leads, DEFAULT_QUEUE, Date.now());
    expect(base).toHaveLength(17);

    const dnc = leads[0];
    const withDnc = leads.map((lead) =>
      lead.placeId === dnc.placeId ? { ...lead, status: "dnc" as const } : lead,
    );
    expect(buildQueue(withDnc, DEFAULT_QUEUE, Date.now())).toHaveLength(16);

    const all = buildQueue(withDnc, { ...DEFAULT_QUEUE, includeFlagged: true }, Date.now());
    expect(all).toHaveLength(19);
    expect(all.some((lead) => lead.status === "dnc")).toBe(false);
  });

  it("filters by category, rating, reviews, claimed and location", async () => {
    const { leads } = await sampleResult(true, true);
    expect(buildQueue(leads, { ...DEFAULT_QUEUE, category: "Coffee shop" }).length).toBe(2);
    expect(buildQueue(leads, { ...DEFAULT_QUEUE, minRating: "4.7" }).length).toBeGreaterThan(0);
    expect(
      buildQueue(leads, { ...DEFAULT_QUEUE, minRating: "4.7" }).every((lead) => (lead.totalScore ?? 0) >= 4.7),
    ).toBe(true);
    expect(
      buildQueue(leads, { ...DEFAULT_QUEUE, claimed: "unclaimed" }).every((lead) => !lead.claimThisBusiness),
    ).toBe(true);
    expect(buildQueue(leads, { ...DEFAULT_QUEUE, location: "78702" }).every((lead) => lead.postalCode === "78702")).toBe(
      true,
    );
    expect(buildQueue(leads, { ...DEFAULT_QUEUE, search: "barbecue" }).length).toBeGreaterThan(0);
  });

  it("sorts by rank, rating, reviews and a stable random order", async () => {
    const { leads } = await sampleResult(true, true);
    const ranked = buildQueue(leads, DEFAULT_QUEUE);
    expect(ranked[0].rank).toBe(1);
    const rated = buildQueue(leads, { ...DEFAULT_QUEUE, sort: "rating" });
    expect((rated[0].totalScore ?? 0) >= (rated[1].totalScore ?? 0)).toBe(true);
    const reviewed = buildQueue(leads, { ...DEFAULT_QUEUE, sort: "reviews" });
    expect((reviewed[0].reviewsCount ?? 0) >= (reviewed[1].reviewsCount ?? 0)).toBe(true);
    const randomA = buildQueue(leads, { ...DEFAULT_QUEUE, sort: "random", randomSeed: 42 }).map((l) => l.placeId);
    const randomB = buildQueue(leads, { ...DEFAULT_QUEUE, sort: "random", randomSeed: 42 }).map((l) => l.placeId);
    expect(randomA).toEqual(randomB);
  });

  it("excludes snoozed leads and detects due callbacks", () => {
    const now = Date.now();
    const snoozed = makeLead({ snoozeUntil: new Date(now + 60_000).toISOString() });
    const callback = makeLead({
      placeId: "callback",
      status: "callback",
      nextCallbackAt: new Date(now - 60_000).toISOString(),
    });
    expect(buildQueue([snoozed], DEFAULT_QUEUE, now)).toHaveLength(0);
    expect(buildQueue([snoozed], { ...DEFAULT_QUEUE, includeSnoozed: true }, now)).toHaveLength(1);
    expect(isDueCallback(callback, now)).toBe(true);
    expect(isDueCallback({ ...callback, status: "interested" }, now)).toBe(false);
  });

  it("computes session stats from history since the session start", () => {
    const start = Date.now() - 10 * 60_000;
    const lead = makeLead({
      history: [
        { id: "1", at: new Date(start + 60_000).toISOString(), disposition: "no_answer" },
        { id: "2", at: new Date(start + 120_000).toISOString(), disposition: "interested" },
        { id: "3", at: new Date(start + 180_000).toISOString(), disposition: "callback" },
        { id: "4", at: new Date(start + 240_000).toISOString(), disposition: "dnc" },
        { id: "old", at: new Date(start - 60_000).toISOString(), disposition: "interested" },
      ],
    });
    const stats = sessionStats([lead], new Date(start).toISOString(), start + 300_000);
    expect(stats.calls).toBe(4);
    expect(stats.connects).toBe(3);
    expect(stats.interested).toBe(1);
    expect(stats.callbacks).toBe(1);
    expect(stats.dnc).toBe(1);
    expect(stats.avgMs).toBe(75_000);
  });
});

describe("exports", () => {
  it("exports original headers plus CRM fields and disposition history", async () => {
    const { table, leads } = await sampleResult(true, true);
    const lead = leads[0];
    lead.notes = "Ask for Marco";
    lead.status = "interested";
    lead.attempts = 2;
    lead.lastCalledAt = "2026-10-19T19:00:00.000Z";
    lead.nextCallbackAt = "2026-10-20T15:00:00.000Z";
    lead.history = [
      {
        id: "h1",
        at: "2026-10-19T18:55:00.000Z",
        disposition: "no_answer",
      },
      {
        id: "h2",
        at: "2026-10-19T19:00:00.000Z",
        disposition: "interested",
        note: "Wants a demo",
      },
    ];

    const csv = buildWorkingCsv(leads, table.headers);
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
    const fields = parsed.meta.fields ?? [];
    for (const extra of EXTRA_COLUMNS) expect(fields).toContain(extra);
    for (const header of table.headers) expect(fields).toContain(header);
    expect(parsed.data).toHaveLength(leads.length);

    const row = parsed.data.find((entry) => entry.placeId === lead.placeId)!;
    expect(row.title).toBe(lead.title);
    expect(row.status).toBe("interested");
    expect(row.attempts).toBe("2");
    expect(row.notes).toBe("Ask for Marco");
    expect(row.last_called_at).toBe(lead.lastCalledAt);
    expect(row.next_callback_at).toBe(lead.nextCallbackAt);
    const history = JSON.parse(row.disposition_history);
    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({ disposition: "interested", note: "Wants a demo" });
  });

  it("keeps raw columns from every import even when the saved header list is partial", async () => {
    const { leads } = await sampleResult(true, true);
    const csv = buildWorkingCsv(leads, ["placeId", "title"]);
    const fields = Papa.parse(csv, { header: true, preview: 1 }).meta.fields ?? [];
    expect(fields).toContain("address");
    expect(fields).toContain("businessProfileId");
    expect(fields).toContain("disposition_history");
    expect(mergeHeaderNames(["A", "b"], ["a", "C"])).toEqual(["A", "b", "C"]);
  });

  it("creates one call log row per attempt with readable dispositions", () => {
    const lead = makeLead({
      title: "Acme",
      history: [
        { id: "a", at: "2026-10-19T18:00:00.000Z", disposition: "no_answer" },
        { id: "b", at: "2026-10-19T19:00:00.000Z", disposition: "voicemail", note: "Left details" },
      ],
    });
    const parsed = Papa.parse<Record<string, string>>(buildCallLogCsv([lead]), { header: true });
    expect(parsed.data).toHaveLength(2);
    expect(parsed.data[0]).toMatchObject({ lead: "Acme", disposition: "Left voicemail", note: "Left details" });
    expect(parsed.data[1].disposition).toBe("No answer");
    expect(parsed.data[0].timestamp > parsed.data[1].timestamp).toBe(true);
  });
});

describe("call destinations", () => {
  const phone = "+15122801680";

  it("defaults to a tel: handoff for the phone app", () => {
    const target = buildCallTarget(phone, { callMethod: "tel", callUrlTemplate: "" });
    expect(target).toMatchObject({ href: "tel:+15122801680", newTab: false, copyNumber: false, label: "Phone app" });
  });

  it("prefills Google Voice's documented call URL", () => {
    const target = buildCallTarget(phone, { callMethod: "google-voice", callUrlTemplate: "" });
    expect(target.href).toBe("https://voice.google.com/u/0/calls?a=nc,%2B15122801680");
    expect(target.newTab).toBe(true);
    expect(target.prefilled).toBe(true);
    // The link carries only the destination — the caller ID is the signed-in Google account.
    expect(describeCallTarget(target)).toContain("signed in");
  });

  it("opens web dialers that have no dial link and copies the number instead", () => {
    for (const callMethod of ["mightycall", "rynga"] as const) {
      const target = buildCallTarget(phone, { callMethod, callUrlTemplate: "" });
      expect(target.href.startsWith("https://")).toBe(true);
      expect(target.newTab).toBe(true);
      expect(target.copyNumber).toBe(true);
      expect(describeCallTarget(target)).toContain("copied");
    }
  });

  it("builds custom dialer URLs from the {phone} template", () => {
    const templated = buildCallTarget(phone, { callMethod: "custom", callUrlTemplate: "https://dial.test/call?n={phone}" });
    expect(templated.href).toBe("https://dial.test/call?n=%2B15122801680");

    const appended = buildCallTarget(phone, { callMethod: "custom", callUrlTemplate: "https://dial.test/call" });
    expect(appended.href).toBe("https://dial.test/call?phone=%2B15122801680");

    // An empty template must never leave the call button dead.
    const empty = buildCallTarget(phone, { callMethod: "custom", callUrlTemplate: "" });
    expect(empty.href).toBe("tel:+15122801680");
  });

  it("offers a tel: fallback when a web dialer disappoints", () => {
    expect(telHref(phone)).toBe("tel:+15122801680");
  });
});

describe("phone normalization", () => {
  it("handles E.164, national US and UK formats", () => {
    expect(normalizePhone("15122801680", "", "US")).toBe("+15122801680");
    expect(normalizePhone("(512) 280-1680", "", "US")).toBe("+15122801680");
    expect(normalizePhone("+44 20 7946 0958", "", "US")).toBe("+442079460958");
    expect(normalizePhone("020 7946 0958", "", "GB")).toBe("+442079460958");
    expect(normalizePhone("", "", "US")).toBe("");
  });
});
