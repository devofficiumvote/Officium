#!/usr/bin/env node
/**
 * Fetches GovTrack.us data: current members with contact info + recent votes
 * Saves to public/data/govtrack-members.json and govtrack-votes.json
 *
 * Run: node scripts/fetch-govtrack.mjs
 * Scheduled via GitHub Actions (weekly)
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "public", "data");
const delay = ms => new Promise(r => setTimeout(r, ms));

async function fetchMembers() {
  console.log("Fetching GovTrack members...");
  const all = [];
  let offset = 0;
  while (true) {
    const url = `https://www.govtrack.us/api/v2/role?current=true&limit=100&offset=${offset}&fields=person__bioguideid,person__name,person__firstname,person__lastname,person__birthday,person__gender_label,person__twitterid,person__link,party,state,role_type_label,district,senator_rank_label,leadership_title,phone,website,extra__address,extra__contact_form,extra__office,title_long,description,startdate`;
    const res = await fetch(url);
    if (!res.ok) { console.error(`HTTP ${res.status}`); break; }
    const d = await res.json();
    all.push(...(d.objects || []));
    console.log(`  ${all.length}/${d.meta.total_count} members`);
    if (all.length >= d.meta.total_count) break;
    offset += 100;
    await delay(500);
  }
  return all;
}

async function fetchVotes() {
  console.log("Fetching recent votes...");
  const votes = [];
  for (const chamber of ["house", "senate"]) {
    const url = `https://www.govtrack.us/api/v2/vote?congress=119&chamber=${chamber}&limit=50&order_by=-created&fields=number,question,result,created,chamber_label,total_plus,total_minus,total_other,category_label,percent_plus,margin,related_bill__display_number,related_bill__title_without_number`;
    const res = await fetch(url);
    if (!res.ok) { console.error(`${chamber} votes HTTP ${res.status}`); continue; }
    const d = await res.json();
    votes.push(...(d.objects || []).map(v => ({ ...v, chamber })));
    console.log(`  ${chamber}: ${(d.objects || []).length} votes (${d.meta.total_count} total in 119th)`);
    await delay(500);
  }
  return votes;
}

async function main() {
  console.log("=== GovTrack Data Fetch ===");
  console.log(`Date: ${new Date().toISOString()}\n`);

  const members = await fetchMembers();
  const votes = await fetchVotes();

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  // Save members with contact info
  const memberMap = {};
  members.forEach(m => {
    const bid = m.person?.bioguideid;
    if (!bid) return;
    memberMap[bid] = {
      bioguideId: bid,
      name: m.person?.name || "",
      firstName: m.person?.firstname || "",
      lastName: m.person?.lastname || "",
      party: m.party || "",
      state: m.state || "",
      role: m.role_type_label || "",
      district: m.district || null,
      senatorRank: m.senator_rank_label || null,
      leadership: m.leadership_title || null,
      phone: m.phone || null,
      website: m.website || null,
      office: m.extra?.office || m.extra?.address || null,
      contactForm: m.extra?.contact_form || null,
      twitter: m.person?.twitterid || null,
      birthday: m.person?.birthday || null,
      gender: m.person?.gender_label || null,
      govtrackLink: m.person?.link || null,
      description: m.description || "",
      startDate: m.startdate || "",
    };
  });

  const membersOutput = {
    members: memberMap,
    count: Object.keys(memberMap).length,
    fetchedAt: new Date().toISOString(),
  };
  writeFileSync(join(DATA_DIR, "govtrack-members.json"), JSON.stringify(membersOutput));
  console.log(`\nSaved ${membersOutput.count} members (${Math.round(JSON.stringify(membersOutput).length / 1024)}KB)`);

  // Save votes
  const votesOutput = {
    votes,
    count: votes.length,
    fetchedAt: new Date().toISOString(),
  };
  writeFileSync(join(DATA_DIR, "govtrack-votes.json"), JSON.stringify(votesOutput));
  console.log(`Saved ${votesOutput.count} votes (${Math.round(JSON.stringify(votesOutput).length / 1024)}KB)`);

  console.log("\nDone!");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
