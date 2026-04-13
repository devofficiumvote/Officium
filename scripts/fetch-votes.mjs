#!/usr/bin/env node
/**
 * Fetches per-member congressional voting data from Voteview.com
 * Includes how each member voted on every roll call (119th Congress)
 * Saves to public/data/voting-records.json
 *
 * Run: node scripts/fetch-votes.mjs
 * Scheduled via GitHub Actions (weekly)
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "public", "data");

function parseCSV(text) {
  const lines = text.split("\n").filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h] = (vals[i] || "").trim());
    return obj;
  });
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuotes = !inQuotes; continue; }
    if (line[i] === "," && !inQuotes) { result.push(current.trim()); current = ""; continue; }
    current += line[i];
  }
  result.push(current.trim());
  return result;
}

async function main() {
  console.log("=== Voting Records Fetch (Voteview.com) ===");
  console.log(`Date: ${new Date().toISOString()}\n`);

  // Fetch roll calls (vote metadata)
  console.log("Fetching House roll calls...");
  const houseRollcalls = await fetch("https://voteview.com/static/data/out/rollcalls/H119_rollcalls.csv").then(r => r.text());
  const hRolls = parseCSV(houseRollcalls);
  console.log(`  ${hRolls.length} House roll calls`);

  console.log("Fetching Senate roll calls...");
  const senateRollcalls = await fetch("https://voteview.com/static/data/out/rollcalls/S119_rollcalls.csv").then(r => r.text());
  const sRolls = parseCSV(senateRollcalls);
  console.log(`  ${sRolls.length} Senate roll calls`);

  // Fetch member info (has bioguide_id for cross-referencing)
  console.log("Fetching House members...");
  const houseMembers = await fetch("https://voteview.com/static/data/out/members/H119_members.csv").then(r => r.text());
  const hMembers = parseCSV(houseMembers);
  console.log(`  ${hMembers.length} House members`);

  console.log("Fetching Senate members...");
  const senateMembers = await fetch("https://voteview.com/static/data/out/members/S119_members.csv").then(r => r.text());
  const sMembers = parseCSV(senateMembers);
  console.log(`  ${sMembers.length} Senate members`);

  // Fetch individual votes (how each member voted)
  console.log("Fetching House votes (per-member)...");
  const houseVotes = await fetch("https://voteview.com/static/data/out/votes/H119_votes.csv").then(r => r.text());
  const hVotes = parseCSV(houseVotes);
  console.log(`  ${hVotes.length} House individual votes`);

  console.log("Fetching Senate votes (per-member)...");
  const senateVotes = await fetch("https://voteview.com/static/data/out/votes/S119_votes.csv").then(r => r.text());
  const sVotes = parseCSV(senateVotes);
  console.log(`  ${sVotes.length} Senate individual votes`);

  // Build member lookup by ICPSR ID → bioguide_id
  const icpsrToBio = {};
  [...hMembers, ...sMembers].forEach(m => {
    if (m.icpsr && m.bioguide_id) icpsrToBio[m.icpsr] = {
      bioguideId: m.bioguide_id,
      name: m.bioname || "",
      party: m.party_code === "100" ? "D" : m.party_code === "200" ? "R" : "I",
      state: m.state_abbrev || "",
      chamber: m.chamber || "",
      nominate1: parseFloat(m.nominate_dim1) || 0, // ideology score
      nominate2: parseFloat(m.nominate_dim2) || 0,
    };
  });

  // Build roll call lookup
  const rollcallMap = {};
  [...hRolls, ...sRolls].forEach(r => {
    const key = `${r.chamber}_${r.rollnumber}`;
    rollcallMap[key] = {
      date: r.date || "",
      billNumber: r.bill_number || "",
      result: r.vote_result || "",
      question: r.vote_question || "",
      description: r.vote_desc || "",
      yeaCount: parseInt(r.yea_count) || 0,
      nayCount: parseInt(r.nay_count) || 0,
    };
  });

  // Build per-member voting records
  // cast_code: 1=Yea, 2=Paired Yea, 3=Announced Yea, 4=Announced Nay, 5=Paired Nay, 6=Nay, 7=Present, 8=Absent, 9=Not a member
  const voteLabels = { "1": "Yea", "2": "Yea", "3": "Yea", "4": "Nay", "5": "Nay", "6": "Nay", "7": "Present", "8": "Absent", "9": "N/A" };

  const memberVotes = {}; // bioguideId → [{rollcall, vote, date, bill, result}]
  [...hVotes, ...sVotes].forEach(v => {
    const member = icpsrToBio[v.icpsr];
    if (!member) return;
    const bio = member.bioguideId;
    if (!memberVotes[bio]) memberVotes[bio] = { info: member, votes: [] };
    const rc = rollcallMap[`${v.chamber}_${v.rollnumber}`];
    memberVotes[bio].votes.push({
      rollNumber: parseInt(v.rollnumber) || 0,
      chamber: v.chamber || "",
      vote: voteLabels[v.cast_code] || "Unknown",
      castCode: parseInt(v.cast_code) || 0,
      ...(rc || {}),
    });
  });

  // Compute party loyalty for each member
  Object.values(memberVotes).forEach(m => {
    const party = m.info.party;
    let aligned = 0, total = 0;
    m.votes.forEach(v => {
      if (v.vote === "Yea" || v.vote === "Nay") {
        total++;
        // Simple party loyalty: did they vote with the majority of their party?
        // We'd need full party breakdown per vote for this — skip for now
      }
    });
    m.totalVotes = m.votes.length;
    m.yeaCount = m.votes.filter(v => v.vote === "Yea").length;
    m.nayCount = m.votes.filter(v => v.vote === "Nay").length;
    m.absentCount = m.votes.filter(v => v.vote === "Absent").length;
    m.yeaPct = total > 0 ? Math.round((m.yeaCount / (m.yeaCount + m.nayCount)) * 100) : 0;
  });

  // Sort each member's votes by roll number descending
  Object.values(memberVotes).forEach(m => {
    m.votes.sort((a, b) => b.rollNumber - a.rollNumber);
    m.votes = m.votes.slice(0, 50); // Keep last 50 votes per member
  });

  const output = {
    memberVotes,
    rollcalls: Object.values(rollcallMap).length,
    members: Object.keys(memberVotes).length,
    totalIndividualVotes: hVotes.length + sVotes.length,
    fetchedAt: new Date().toISOString(),
    source: "Voteview.com (UCLA)",
  };

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const path = join(DATA_DIR, "voting-records.json");
  writeFileSync(path, JSON.stringify(output));

  console.log(`\n=== Summary ===`);
  console.log(`Members with votes: ${Object.keys(memberVotes).length}`);
  console.log(`Roll calls: House ${hRolls.length} + Senate ${sRolls.length}`);
  console.log(`Individual votes: ${hVotes.length + sVotes.length}`);
  console.log(`File: ${Math.round(JSON.stringify(output).length / 1024)}KB`);
  console.log("Done!");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
