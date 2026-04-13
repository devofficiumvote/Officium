#!/usr/bin/env node
/**
 * Fetches congressional trade data from multiple sources:
 * 1. QuiverQuant (free, no key) — combined trades + Senate deep history
 * 2. Financial Modeling Prep (free key) — Senate latest + House latest
 *
 * Saves to public/data/congress-trades.json
 * Run: node scripts/fetch-trades.mjs
 * Scheduled via GitHub Actions (daily)
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "public", "data");
const FMP_KEY = process.env.FMP_API_KEY || "LIgQiZNG9D9CUgsEMwVhWHxvLuunz6JF";
const delay = ms => new Promise(r => setTimeout(r, ms));

async function fetchJSON(url, label) {
  console.log(`  Fetching ${label}...`);
  try {
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) { console.log(`    HTTP ${res.status}`); return []; }
    const data = await res.json();
    if (data?.["Error Message"]) { console.log(`    API Error: ${data["Error Message"]}`); return []; }
    console.log(`    ${Array.isArray(data) ? data.length : 0} records`);
    return Array.isArray(data) ? data : [];
  } catch (e) { console.log(`    Failed: ${e.message}`); return []; }
}

async function main() {
  console.log("=== Congressional Trade Data Fetch ===");
  console.log(`Date: ${new Date().toISOString()}\n`);

  // --- Source 1: QuiverQuant (no key needed) ---
  console.log("QuiverQuant:");
  const [qvCombined, qvSenate] = await Promise.all([
    fetchJSON("https://api.quiverquant.com/beta/live/congresstrading", "Combined trades"),
    fetchJSON("https://api.quiverquant.com/beta/live/senatetrading", "Senate deep history"),
  ]);
  await delay(500);

  // --- Source 2: FMP (free API key, 250 calls/day) ---
  console.log("\nFinancial Modeling Prep:");
  const [fmpSenate, fmpHouse] = await Promise.all([
    fetchJSON(`https://financialmodelingprep.com/stable/senate-latest?apikey=${FMP_KEY}`, "Senate latest"),
    fetchJSON(`https://financialmodelingprep.com/stable/house-latest?apikey=${FMP_KEY}`, "House latest"),
  ]);

  // --- Normalize all sources ---
  const trades = [];

  // QuiverQuant combined (has ExcessReturn, party, both chambers)
  qvCombined.forEach(t => trades.push({
    name: t.Representative || "", bioguideId: t.BioGuideID || "",
    ticker: t.Ticker || "", action: (t.Transaction || "").includes("Sale") ? "SELL" : "BUY",
    amount: t.Range || "", tradeDate: t.TransactionDate || "", filedDate: t.ReportDate || "",
    chamber: t.House === "Senate" ? "Senate" : "House", party: t.Party || "",
    description: t.Description || "", assetType: t.TickerType || "Stock", owner: "",
    excessReturn: t.ExcessReturn || null, source: "QuiverQuant",
  }));

  // QuiverQuant Senate deep (historical back to 2018)
  qvSenate.forEach(t => trades.push({
    name: t.Senator || "", bioguideId: t.BioGuideID || "",
    ticker: t.Ticker || "", action: (t.Transaction || "").includes("Sale") ? "SELL" : "BUY",
    amount: t.Range || "", tradeDate: t.Date || "", filedDate: t.last_modified || "",
    chamber: "Senate", party: "", description: "", assetType: "Stock", owner: "",
    excessReturn: null, source: "QuiverQuant-Senate",
  }));

  // FMP Senate latest (has owner, link to eFD filing)
  fmpSenate.forEach(t => trades.push({
    name: `${t.firstName || ""} ${t.lastName || ""}`.trim(),
    bioguideId: "", ticker: t.symbol || "",
    action: (t.type || "").includes("Sale") ? "SELL" : "BUY",
    amount: t.amount || "", tradeDate: t.transactionDate || "", filedDate: t.disclosureDate || "",
    chamber: "Senate", party: "", description: t.assetDescription || "",
    assetType: t.assetType || "Stock", owner: t.owner || "",
    excessReturn: null, source: "FMP-Senate", link: t.link || "",
  }));

  // FMP House latest (has owner, district, capital gains, link to PDF)
  fmpHouse.forEach(t => trades.push({
    name: `${t.firstName || ""} ${t.lastName || ""}`.trim(),
    bioguideId: "", ticker: t.symbol || "",
    action: (t.type || "").includes("Sale") || (t.type || "").includes("sale") ? "SELL" : "BUY",
    amount: t.amount || "", tradeDate: t.transactionDate || "", filedDate: t.disclosureDate || "",
    chamber: "House", party: "", description: t.assetDescription || "",
    assetType: t.assetType || "Stock", owner: t.owner || "",
    district: t.district || "",
    excessReturn: null, source: "FMP-House", link: t.link || "",
  }));

  // Deduplicate by last-name+ticker+date+action (catches name format variations)
  const seen = new Set();
  const deduped = trades.filter(t => {
    const lastName = (t.name || "").toLowerCase().trim().split(/\s+/).pop() || "";
    const k = `${lastName}_${t.ticker}_${t.tradeDate}_${t.action}`;
    if (seen.has(k)) return false; seen.add(k); return true;
  });

  // Compute filing gap
  deduped.forEach(t => {
    if (t.tradeDate && t.filedDate) {
      const td = new Date(t.tradeDate), fd = new Date(t.filedDate);
      if (!isNaN(td) && !isNaN(fd)) t.gap = Math.max(0, Math.round((fd - td) / 86400000));
      else t.gap = 0;
    } else t.gap = 0;
  });

  deduped.sort((a, b) => (b.tradeDate || "").localeCompare(a.tradeDate || ""));

  // Stats
  const officials = [...new Set(deduped.map(t => t.name))].filter(Boolean);
  const violations = deduped.filter(t => t.gap > 45);
  const houseTrades = deduped.filter(t => t.chamber === "House");
  const senateTrades = deduped.filter(t => t.chamber === "Senate");

  const output = {
    trades: deduped, count: deduped.length,
    sources: ["QuiverQuant", "Financial Modeling Prep"],
    dateRange: {
      from: deduped.map(t => t.tradeDate).filter(Boolean).sort()[0],
      to: deduped.map(t => t.tradeDate).filter(Boolean).sort().pop(),
    },
    uniqueOfficials: officials.length, violations: violations.length,
    houseTrades: houseTrades.length, senateTrades: senateTrades.length,
    fetchedAt: new Date().toISOString(),
  };

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, "congress-trades.json"), JSON.stringify(output));

  console.log(`\n=== Summary ===`);
  console.log(`Total: ${deduped.length} trades (deduplicated from ${trades.length})`);
  console.log(`Senate: ${senateTrades.length} | House: ${houseTrades.length}`);
  console.log(`Date range: ${output.dateRange.from} to ${output.dateRange.to}`);
  console.log(`Officials: ${officials.length}`);
  console.log(`Violations (>45d gap): ${violations.length}`);
  console.log(`Sources: QuiverQuant (${qvCombined.length}+${qvSenate.length}), FMP (${fmpSenate.length}+${fmpHouse.length})`);
  console.log(`File: ${Math.round(JSON.stringify(output).length / 1024)}KB`);
  console.log("Done!");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
