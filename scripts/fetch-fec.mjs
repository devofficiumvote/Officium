#!/usr/bin/env node
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "public", "data");
const FEC_KEY = "4uo7FCQmyE9DEs8zu47ejJtDdma0Sae5WNabLxUu";
const delay = ms => new Promise(r => setTimeout(r, ms));

async function fetchAll() {
  console.log("=== FEC Data Fetch ===");
  const all = [];
  for (const cycle of ["", "&cycle=2024", "&cycle=2022"]) {
    for (const office of ["S", "H"]) {
      for (let page = 1; page <= 10; page++) {
        const url = `https://api.open.fec.gov/v1/candidates/totals/?office=${office}&per_page=100&page=${page}&sort=-receipts${cycle}&api_key=${FEC_KEY}`;
        console.log(`  Fetching office=${office} page=${page} ${cycle || 'current'}...`);
        const res = await fetch(url);
        if (!res.ok) { console.log(`  HTTP ${res.status}, stopping`); break; }
        const d = await res.json();
        const results = d.results || [];
        all.push(...results);
        if (results.length < 100) break;
        await delay(600);
      }
    }
  }
  console.log(`Total raw records: ${all.length}`);

  // Deduplicate by candidate_id, keeping highest receipts
  const byId = {};
  all.forEach(f => {
    if (!f.candidate_id || !f.name || !f.state) return;
    if (!byId[f.candidate_id] || (f.receipts || 0) > (byId[f.candidate_id].receipts || 0)) {
      byId[f.candidate_id] = f;
    }
  });

  const deduped = Object.values(byId);
  console.log(`Deduplicated: ${deduped.length} unique candidates`);

  // Build lookup maps
  const byLast = {}, byFull = {};
  deduped.forEach(f => {
    const raw = f.name.toUpperCase();
    const last = raw.split(",")[0].trim().toLowerCase();
    const stL = f.state.toLowerCase();
    const lk = last + "_" + stL;
    if (!byLast[lk] || (f.receipts || 0) > (byLast[lk].receipts || 0)) byLast[lk] = f;
    const pts = raw.split(",");
    if (pts[1]) {
      const first = pts[1].trim().split(/\s+/)[0].toLowerCase();
      byFull[last + "_" + first + "_" + stL] = f;
    }
  });

  const output = {
    candidates: deduped,
    byLast,
    byFull,
    count: deduped.length,
    fetchedAt: new Date().toISOString(),
  };

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const path = join(DATA_DIR, "fec-candidates.json");
  writeFileSync(path, JSON.stringify(output));
  console.log(`Saved to ${path} (${Math.round(JSON.stringify(output).length / 1024)}KB)`);
}

fetchAll().catch(e => { console.error("Fatal:", e); process.exit(1); });
