#!/usr/bin/env node
/**
 * Fetches FARA (Foreign Agents Registration Act) data from OpenSanctions
 * (which mirrors DOJ/efile.fara.gov data weekly) and saves parsed JSON
 * to public/data/fara-registrants.json
 *
 * Primary source: OpenSanctions (reliable, JSON, updated weekly)
 * Fallback: efile.fara.gov bulk CSV (often blocks serverless/CI requests)
 *
 * Run: node scripts/fetch-fara.mjs
 * Scheduled via GitHub Actions cron (weekly)
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "public", "data");

// OpenSanctions mirrors FARA data weekly in structured formats
const OPENSANCTIONS_BASE = "https://data.opensanctions.org/datasets/latest/us_fara_filings";
const FARA_CSV_URL = "https://efile.fara.gov/bulk/download/ActiveRegistrantsList.csv";

async function fetchOpenSanctions() {
  console.log("Fetching from OpenSanctions (primary source)...");
  const url = `${OPENSANCTIONS_BASE}/entities.ftm.json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const text = await res.text();
  // FTM JSON is newline-delimited JSON (one entity per line)
  const entities = text.trim().split("\n").map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);

  console.log(`  Raw entities: ${entities.length}`);

  // Extract registrants (schema: LegalEntity or Organization with FARA properties)
  const registrants = [];
  const principals = [];

  for (const e of entities) {
    const schema = e.schema || "";
    const props = e.properties || {};
    const name = (props.name || [])[0] || "";
    const country = (props.country || props.jurisdiction || [])[0] || "";
    const address = (props.address || [])[0] || "";
    const regNumber = (props.registrationNumber || props.sourceUrl || [])[0] || "";
    const status = (props.status || [])[0] || "";
    const dates = props.modifiedAt || props.createdAt || [];
    const topics = props.topics || [];

    if (!name) continue;

    const record = {
      name,
      country,
      address,
      registrationNumber: regNumber,
      status,
      lastModified: dates[0] || "",
      schema,
      topics,
    };

    // Classify: if it has a country and looks like a foreign principal, add to principals
    if (topics.includes("role.fprn") || schema === "LegalEntity") {
      principals.push(record);
    }
    // Registrants are typically organizations/law firms
    if (topics.includes("role.regt") || schema === "Organization" || !topics.length) {
      registrants.push(record);
    }
  }

  console.log(`  Registrants: ${registrants.length}, Principals: ${principals.length}`);
  return { registrants, principals };
}

async function fetchFaraCSV() {
  console.log("Trying efile.fara.gov CSV (fallback)...");
  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    Accept: "text/csv,text/plain,*/*",
    Referer: "https://efile.fara.gov/",
  };

  const res = await fetch(FARA_CSV_URL, { headers, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const text = await res.text();
  if (text.trim().startsWith("<!")) throw new Error("Got HTML instead of CSV");

  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length);
  if (lines.length < 2) throw new Error("Empty CSV");

  const parseCSVLine = (line) => {
    const result = []; let current = ""; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuotes = !inQuotes; continue; }
      if (line[i] === "," && !inQuotes) { result.push(current.trim()); current = ""; continue; }
      current += line[i];
    }
    result.push(current.trim());
    return result;
  };

  const hdrs = parseCSVLine(lines[0]);
  const registrants = lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const obj = {};
    hdrs.forEach((h, i) => { obj[h] = vals[i] || ""; });
    return {
      name: obj["Name"] || obj["Registrant Name"] || "",
      country: obj["Country/Location Represented"] || "",
      address: obj["Address"] || "",
      registrationNumber: obj["Registration #"] || "",
      status: obj["Registration Status"] || "",
    };
  }).filter(r => r.name);

  console.log(`  CSV registrants: ${registrants.length}`);
  return { registrants, principals: [] };
}

async function main() {
  console.log("=== FARA Data Fetch ===");
  console.log(`Date: ${new Date().toISOString()}\n`);

  let data = null;

  // Try OpenSanctions first (most reliable)
  try {
    data = await fetchOpenSanctions();
  } catch (err) {
    console.error(`  OpenSanctions failed: ${err.message}`);
  }

  // Fallback to efile.fara.gov CSV
  if (!data || (!data.registrants.length && !data.principals.length)) {
    try {
      data = await fetchFaraCSV();
    } catch (err) {
      console.error(`  FARA CSV failed: ${err.message}`);
    }
  }

  if (!data || (!data.registrants.length && !data.principals.length)) {
    console.error("\nAll sources failed. FARA data not updated.");
    process.exit(1);
  }

  // Save to public/data/
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  const regOutput = {
    results: data.registrants,
    total: data.registrants.length,
    source: "OpenSanctions / DOJ FARA",
    fetchedAt: new Date().toISOString(),
  };
  writeFileSync(join(DATA_DIR, "fara-registrants.json"), JSON.stringify(regOutput));
  console.log(`\nSaved ${data.registrants.length} registrants (${(JSON.stringify(regOutput).length / 1024).toFixed(0)}KB)`);

  if (data.principals.length) {
    const priOutput = {
      results: data.principals,
      total: data.principals.length,
      source: "OpenSanctions / DOJ FARA",
      fetchedAt: new Date().toISOString(),
    };
    writeFileSync(join(DATA_DIR, "fara-principals.json"), JSON.stringify(priOutput));
    console.log(`Saved ${data.principals.length} principals (${(JSON.stringify(priOutput).length / 1024).toFixed(0)}KB)`);
  }

  console.log("\nDone!");
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
