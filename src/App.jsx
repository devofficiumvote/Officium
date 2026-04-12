import{useState,useEffect,useMemo,useRef,useCallback}from"react";
import*as d3 from"d3";

const CSS=`@keyframes spin{to{transform:rotate(360deg)}}@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}@keyframes floatA{0%,100%{transform:translate(0,0)}33%{transform:translate(14px,-20px)}66%{transform:translate(-10px,14px)}}@keyframes floatB{0%,100%{transform:translate(0,0)}40%{transform:translate(-18px,-16px)}80%{transform:translate(14px,18px)}}@keyframes floatC{0%,100%{transform:translate(0,0)}50%{transform:translate(16px,-12px)}}@keyframes floatD{0%,100%{transform:translate(0,0)}30%{transform:translate(-12px,18px)}70%{transform:translate(20px,-10px)}}@keyframes orbA{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(50px,-40px) scale(1.08)}66%{transform:translate(-30px,40px) scale(.93)}}@keyframes orbB{0%,100%{transform:translate(0,0)}40%{transform:translate(-45px,35px)}80%{transform:translate(35px,-55px)}}@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}@keyframes pulseDot{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.5)}70%{box-shadow:0 0 0 10px rgba(220,38,38,0)}}@keyframes slideIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}@keyframes glow{0%,100%{text-shadow:0 0 30px rgba(168,85,247,.2)}50%{text-shadow:0 0 60px rgba(168,85,247,.5),0 0 100px rgba(168,85,247,.15)}}@keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(200vh)}}@keyframes countUp{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}@keyframes borderPulse{0%,100%{border-color:rgba(168,85,247,.3)}50%{border-color:rgba(168,85,247,.8)}}`;

/* ── KEYS ─────────────────────────────── */
const FEC_KEY="4uo7FCQmyE9DEs8zu47ejJtDdma0Sae5WNabLxUu";
const CGK="YdbWI0KzqPkIvv9vcx3z6dQpaG6ARB8cSr7HOdWC";
const PXK="https://corsproxy.io/?key=4aa30d17&url=";
const PX2="https://corsproxy.io/?url=";
/* S3 buckets are dead (403) — GitHub raw for Senate, House data unavailable */
const HOUSE_S3="https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json";
const SENATE_S3="https://raw.githubusercontent.com/timothycarambat/senate-stock-watcher-data/master/aggregate/all_transactions.json";
const SENATE_S3_FB="https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/all_transactions.json";
const LDA_BASE="https://lda.gov/api/v1"; /* migrated from lda.senate.gov (sunsetting June 2026) */
const LDA_BASE_FB="https://lda.senate.gov/api/v1";
const USA_BASE="https://api.usaspending.gov/api/v2";
const TREAS_BASE="https://api.fiscaldata.treasury.gov/services/api/fiscal_service";
const FEDREG="https://www.federalregister.gov/api/v1";
const CACHE_TTL=4*3600*1000;

/* ── CROSS-ENV STORAGE ─────────────────── */
const _MEM={};
const Store={
  async get(k){if(typeof window!=="undefined"&&window.storage){try{return await window.storage.get(k);}catch(e){}}if(typeof window!=="undefined"&&window.localStorage){try{const v=window.localStorage.getItem(k);return v?{value:v}:null;}catch(e){}}return _MEM[k]?{value:_MEM[k]}:null;},
  async set(k,v){if(typeof window!=="undefined"&&window.storage){try{await window.storage.set(k,v,true);return;}catch(e){}}if(typeof window!=="undefined"&&window.localStorage){try{window.localStorage.setItem(k,v);return;}catch(e){}}  _MEM[k]=v;},
  async del(k){if(typeof window!=="undefined"&&window.storage){try{await window.storage.delete(k);return;}catch(e){}}if(typeof window!=="undefined"&&window.localStorage){try{window.localStorage.removeItem(k);return;}catch(e){}}delete _MEM[k];}
};

/* ── UTILS ────────────────────────────── */
const san=s=>String(s||"").replace(/[<>&"']/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"}[c]));
const M={};const gc=k=>M[k];const sc=(k,v)=>{M[k]=v;};
const PC={D:"#3b82f6",R:"#ef4444",I:"#8b5cf6"};
const PL={D:"Democrat",R:"Republican",I:"Independent"};
const fmt=n=>n>=1e9?"$"+(n/1e9).toFixed(1)+"B":n>=1e6?"$"+(n/1e6).toFixed(1)+"M":n>=1e3?"$"+(n/1e3).toFixed(0)+"K":"$"+Math.round(n||0);
const mob=()=>window.innerWidth<768;
const normS=s=>(s||"").toLowerCase().replace(/[^a-z\s]/g,"").trim();
const gapC=n=>n>45?"#ef4444":n>30?"#f59e0b":"#10b981";
const timeAgo=ts=>{const d=(Date.now()-ts)/1000;return d<60?"just now":d<3600?Math.floor(d/60)+"m ago":d<86400?Math.floor(d/3600)+"h ago":Math.floor(d/86400)+"d ago";};
const simpleHash=s=>btoa(unescape(encodeURIComponent(s+"_off2025"))).slice(0,24);
const IC={Technology:"#8b5cf6",Finance:"#f59e0b",Healthcare:"#10b981",Defense:"#6366f1","Oil & Gas":"#fb923c",Pharma:"#06b6d4",Banking:"#0ea5e9",Energy:"#ef4444",Other:"#94a3b8"};
const classifyPAC=n=>{const s=(n||"").toLowerCase();if(/google|apple|microsoft|amazon|meta|nvidia|tech|software/.test(s))return"Technology";if(/lockheed|raytheon|northrop|boeing|defense/.test(s))return"Defense";if(/exxon|chevron|petroleum|natural gas|coal/.test(s))return"Oil & Gas";if(/pfizer|merck|lilly|pharma|biotech/.test(s))return"Pharma";if(/health|hospital|medical|humana/.test(s))return"Healthcare";if(/goldman|morgan|blackrock|jpmorgan|bank/.test(s))return"Finance";if(/energy|electric|utility/.test(s))return"Energy";return"Other";};
const NICKS={chuck:"charles",bob:"robert",bill:"william",mike:"michael",jim:"james",joe:"joseph",tom:"thomas",ted:"edward",bernie:"bernard",liz:"elizabeth",ron:"ronald",rick:"richard",dan:"daniel",dave:"david",tim:"timothy",chris:"christopher",matt:"matthew",al:"albert"};
const STATE_ABBR={alabama:"AL",alaska:"AK",arizona:"AZ",arkansas:"AR",california:"CA",colorado:"CO",connecticut:"CT",delaware:"DE",florida:"FL",georgia:"GA",hawaii:"HI",idaho:"ID",illinois:"IL",indiana:"IN",iowa:"IA",kansas:"KS",kentucky:"KY",louisiana:"LA",maine:"ME",maryland:"MD",massachusetts:"MA",michigan:"MI",minnesota:"MN",mississippi:"MS",missouri:"MO",montana:"MT",nebraska:"NE",nevada:"NV","new hampshire":"NH","new jersey":"NJ","new mexico":"NM","new york":"NY","north carolina":"NC","north dakota":"ND",ohio:"OH",oklahoma:"OK",oregon:"OR",pennsylvania:"PA","rhode island":"RI","south carolina":"SC","south dakota":"SD",tennessee:"TN",texas:"TX",utah:"UT",vermont:"VT",virginia:"VA",washington:"WA","west virginia":"WV",wisconsin:"WI",wyoming:"WY","american samoa":"AS","district of columbia":"DC",guam:"GU","northern mariana islands":"MP","puerto rico":"PR","u.s. virgin islands":"VI"};
const toAbbr=s=>{if(!s)return"";if(s.length<=2)return s.toUpperCase();return STATE_ABBR[s.toLowerCase()]||s;};

/* ── CACHE ────────────────────────────── */
async function withCache(key,fn){
  const mk="_m_"+key;const m=gc(mk);if(m&&Date.now()-m.ts<CACHE_TTL)return m.data;
  try{const c=await Store.get("oc_"+key);if(c){const{data,ts}=JSON.parse(c.value);if(Date.now()-ts<CACHE_TTL){sc(mk,{data,ts});return data;}}}catch(e){}
  const data=await fn();
  if(data!=null){sc(mk,{data,ts:Date.now()});try{const s=JSON.stringify({data,ts:Date.now()});if(s.length<4000000)await Store.set("oc_"+key,s);}catch(e){}}
  return data;
}

/* ── AUTH ─────────────────────────────── */
const AK="off_users_v3",SK="off_sess_v3";
async function getUsers(){try{const r=await Store.get(AK);return r?JSON.parse(r.value):[];}catch(e){return[];}}
async function saveUsers(u){try{await Store.set(AK,JSON.stringify(u));}catch(e){}}
async function getSession(){try{const r=await Store.get(SK);return r?JSON.parse(r.value):null;}catch(e){return null;}}
async function saveSession(u){try{await Store.set(SK,JSON.stringify(u));}catch(e){}}
async function clearSession(){try{await Store.del(SK);}catch(e){}}
async function registerUser(name,email,password){
  const users=await getUsers();if(users.find(u=>u.email===email))throw new Error("Email already registered");
  const u={id:"u_"+Date.now(),name,email,passwordHash:simpleHash(password),role:users.length===0||email.includes("admin")?"admin":"user",watchlist:[],notes:{},alerts:[],joinedAt:Date.now(),lastLogin:Date.now()};
  await saveUsers([...users,u]);await saveSession(u);return u;
}
async function loginUser(email,password){
  const users=await getUsers();const u=users.find(u=>u.email===email&&u.passwordHash===simpleHash(password));
  if(!u)throw new Error("Invalid email or password");u.lastLogin=Date.now();await saveUsers(users.map(x=>x.id===u.id?u:x));await saveSession(u);return u;
}
async function updateUser(userId,patch){
  const users=await getUsers();const updated=users.map(u=>u.id===userId?{...u,...patch}:u);
  await saveUsers(updated);const s=await getSession();if(s&&s.id===userId)await saveSession({...s,...patch});
  return updated.find(u=>u.id===userId);
}

/* ── PROXY ────────────────────────────── */
async function pf(url,opts={}){
  for(const u of[url,PXK+encodeURIComponent(url),PX2+encodeURIComponent(url)]){
    try{const r=await fetch(u,{...opts,signal:AbortSignal.timeout(15000)});if(r.ok)return await r.json();}catch(e){}
  }
  throw new Error("All proxies failed for "+url);
}

/* ── TRADE UTILS ──────────────────────── */
function parseAnyDate(s){if(!s||s==="--")return null;if(/^\d{4}-/.test(s))return new Date(s);if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)){const[m,d,y]=s.split("/");return new Date(y+"-"+m.padStart(2,"0")+"-"+d.padStart(2,"0"));}return new Date(s);}
function toISO(s){const d=parseAnyDate(s);return d&&!isNaN(d)?(d.toISOString().slice(0,10)):s||"--";}
function computeGap(tx,disc){try{if(!tx||!disc||tx==="--"||disc==="--")return 0;const a=parseAnyDate(tx);const b=parseAnyDate(disc);if(!a||!b||isNaN(a)||isNaN(b))return 0;return Math.max(0,Math.round((b-a)/86400000));}catch(e){return 0;}}
const normH=t=>({name:(t.representative||"").replace(/^(Rep\.\s*)/i,"").trim(),ticker:t.ticker&&t.ticker!="--"&&t.ticker!="N/A"?t.ticker:"",action:/sale|sell/i.test(t.type||"")?"SELL":"BUY",amount:t.amount||"--",tradeDate:t.transaction_date||"--",filedDate:t.disclosure_date||"--",gap:computeGap(t.transaction_date,t.disclosure_date),state:(t.district||"").slice(0,2),source:"House",description:t.asset_description||""});
const normS2=t=>({name:t.senator||t.name||"",ticker:t.ticker&&t.ticker!="--"&&t.ticker!="N/A"?t.ticker:"",action:/sale|sell/i.test(t.type||t.transaction_type||"")?"SELL":"BUY",amount:t.amount||"--",tradeDate:t.transaction_date||"--",filedDate:t.disclosure_date||"--",gap:computeGap(t.transaction_date,t.disclosure_date),party:t.party||"",state:t.state||"",source:"Senate",description:t.asset_description||t.asset_name||""});
function flagTrade(t){const g=t.gap||0;if(g>45)return{color:"#ef4444",badge:"VIOLATION",txt:g+"d late — exceeds 45-day limit"};if(g>30)return{color:"#f59e0b",badge:"LATE",txt:g+"d — approaching deadline"};if(/500,000|1,000,000/.test(t.amount||""))return{color:"#a855f7",badge:"HIGH VALUE",txt:">$500K trade"};return null;}
const calcRisk=(trades,raised)=>{let s=0;s+=Math.min(45,trades.filter(t=>t.gap>45).length*15);s+=Math.min(20,trades.filter(t=>t.gap>30&&t.gap<=45).length*5);s+=Math.min(15,trades.filter(t=>/500,000|1,000,000/.test(t.amount||"")).length*7);s+=trades.length>25?10:trades.length>10?5:0;s+=raised>10e6?8:raised>5e6?4:raised>1e6?2:0;return Math.min(100,s);};
const riskColor=r=>r>60?"#ef4444":r>30?"#f59e0b":"#10b981";
const riskLabel=r=>r>60?"HIGH":r>30?"MODERATE":"LOW";

/* ── S3 DATA ──────────────────────────── */
const HOUSE_P=withCache("house_v8",async()=>{
  /* House S3 data is no longer publicly available (403). Try proxy as last resort. */
  for(const u of[HOUSE_S3,PXK+encodeURIComponent(HOUSE_S3)]){
    try{const r=await fetch(u,{signal:AbortSignal.timeout(20000)});if(!r.ok)continue;const d=await r.json();const a=Array.isArray(d)?d:(d.data||[]);if(!a.length)continue;return a.filter(t=>(t.disclosure_date||t.transaction_date||"")>="2020-01-01").sort((a,b)=>(b.disclosure_date||"").localeCompare(a.disclosure_date||"")).slice(0,1500).map(normH);}catch(e){}
  }
  console.warn("House stock trade data unavailable — source API is offline");
  return[];
});
const SENATE_P=withCache("senate_v9",async()=>{
  for(const u of[SENATE_S3,SENATE_S3_FB,PXK+encodeURIComponent(SENATE_S3_FB)]){
    try{const r=await fetch(u,{signal:AbortSignal.timeout(30000)});if(!r.ok)continue;const d=await r.json();const a=Array.isArray(d)?d:(d.data||[]);if(!a.length)continue;
    /* Normalize dates to ISO format before filtering */
    const norm=a.map(t=>({...t,transaction_date:toISO(t.transaction_date),disclosure_date:toISO(t.disclosure_date)}));
    return norm.filter(t=>{const dt=(t.disclosure_date&&t.disclosure_date!=="--"?t.disclosure_date:null)||(t.transaction_date&&t.transaction_date!=="--"?t.transaction_date:null)||"";return dt>="2019-01-01";}).sort((a,b)=>((b.transaction_date&&b.transaction_date!=="--"?b.transaction_date:"")||(b.disclosure_date||"")).localeCompare((a.transaction_date&&a.transaction_date!=="--"?a.transaction_date:"")||(a.disclosure_date||""))).slice(0,1500).map(normS2);}catch(e){console.warn("Senate trades fetch failed:",u);}
  }return[];
});
const ALL_TRADES_P=withCache("all_v9",async()=>{
  const[h,s]=await Promise.all([HOUSE_P.catch(()=>[]),SENATE_P.catch(()=>[])]);
  const all=[...h,...s];const seen=new Set();
  return all.filter(t=>{const k=t.name+"_"+t.ticker+"_"+t.tradeDate+"_"+t.action;if(seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>(b.filedDate||b.tradeDate||"").localeCompare(a.filedDate||a.tradeDate||""));
});
async function tradesFor(name){
  const k="ct5_"+name;const c=gc(k);if(c)return c;
  const last=name.split(" ").pop().toLowerCase();const first=name.split(" ")[0].toLowerCase();
  const[h,s]=await Promise.all([HOUSE_P.catch(()=>[]),SENATE_P.catch(()=>[])]);
  const all=[...h,...s].filter(t=>{const n=(t.name||"").toLowerCase();return n.includes(last)&&(n.includes(first)||(NICKS[first]&&n.includes(NICKS[first]))||last.length>5);});
  all.sort((a,b)=>(b.tradeDate||"").localeCompare(a.tradeDate||""));
  sc(k,all);return all;
}

/* ── FEC ENDPOINTS MAP (all ~90 official OpenFEC v1 endpoints) ─────────── */
const FEC_BASE="https://api.open.fec.gov/v1";
const FEC_EP={
  // Candidates
  candidatesList:"/candidates/",candidatesSearch:"/candidates/search/",
  candidateDetail:id=>`/candidate/${id}/`,candidateTotals:id=>`/candidate/${id}/totals/`,
  candidateHistory:id=>`/candidate/${id}/history/`,candidateFilings:id=>`/candidate/${id}/filings/`,
  candidateCommittee:id=>`/candidate/${id}/committee/`,candidateElections:id=>`/candidate/${id}/elections/`,
  candidatesAllTotals:"/candidates/totals/",
  // Committees
  committeesList:"/committees/",committeesSearch:"/committees/search/",
  committeeDetail:id=>`/committee/${id}/`,committeeTotals:id=>`/committee/${id}/totals/`,
  committeeHistory:id=>`/committee/${id}/history/`,committeeFilings:id=>`/committee/${id}/filings/`,
  committeeReports:id=>`/committee/${id}/reports/`,committeeCandidate:id=>`/committee/${id}/candidate/`,
  // Schedules — the core financial data
  scheduleA:"/schedules/schedule_a/",       // incoming contributions
  scheduleB:"/schedules/schedule_b/",       // outgoing disbursements
  scheduleC:"/schedules/schedule_c/",       // loans
  scheduleD:"/schedules/schedule_d/",       // debts
  scheduleE:"/schedules/schedule_e/",       // independent expenditures
  scheduleF:"/schedules/schedule_f/",       // coordinated expenditures
  // Filings & Reports
  filings:"/filings/",filingsSearch:"/filings/search/",reports:"/reports/",
  // Elections & Aggregates
  elections:"/elections/",electionsSummary:"/elections/summary/",
  electionDates:"/election-dates/",electioneeringComms:"/electioneering-communications/",
  totalsAggregate:"/totals/aggregate/",totalsByEntityType:"/totals/by_entity_type/",
  commCosts:"/communication-costs/",partyCoordExp:"/party-coordinated-expenditures/",
  disbursements:"/disbursements/",receipts:"/receipts/",
  // Support
  names:"/names/",radAnalyst:"/rad-analyst/",stateElectionOffice:"/state-election-office/",
  largeContributor:"/large-contributor/",officeList:"/office/",stateList:"/state/",
};

/* ── RATE-LIMITED FEC FETCHER ─────────────────────────────────────────── */
let _lastFecCall=0;
async function fecFetch(path,params={}){
  const now=Date.now();const wait=_lastFecCall+650-now;
  if(wait>0)await new Promise(r=>setTimeout(r,wait));
  _lastFecCall=Date.now();
  const qs=new URLSearchParams({api_key:FEC_KEY,per_page:"100",...Object.fromEntries(Object.entries(params).map(([k,v])=>[k,String(v)]))}).toString();
  const url=`${FEC_BASE}${path}?${qs}`;
  const r=await fetch(url,{signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw new Error(`FEC ${path} → HTTP ${r.status}`);
  return r.json();
}

/* ── NEW FEC DATA FETCHERS ───────────────────────────────────────────── */

// Full candidate detail record
async function fetchCandidateDetail(candidateId){
  if(!candidateId)return null;const k="cd_"+candidateId;const c=gc(k);if(c!==undefined)return c;
  try{const d=await fecFetch(FEC_EP.candidateDetail(candidateId));const r=d.results&&d.results[0]||d;sc(k,r);return r;}catch(e){sc(k,null);return null;}
}

// Election history across all cycles
async function fetchCandidateHistory(candidateId){
  if(!candidateId)return[];return withCache("ch_"+candidateId,async()=>{
    try{const d=await fecFetch(FEC_EP.candidateHistory(candidateId));return d.results||[];}catch(e){return[];}
  });
}

// All committees linked to this candidate
async function fetchCandidateCommittees(candidateId){
  if(!candidateId)return[];const k="cc_"+candidateId;const c=gc(k);if(c)return c;
  try{const d=await fecFetch(FEC_EP.candidateCommittee(candidateId));sc(k,d.results||[]);return d.results||[];}catch(e){sc(k,[]);return[];}
}

// Schedule B — where money was SPENT (disbursements)
async function fetchScheduleB(fecId){
  if(!fecId)return[];return withCache("sb_"+fecId,async()=>{
    for(const cy of[2026,2024,2022,2020]){
      try{const d=await fecFetch(FEC_EP.scheduleB,{candidate_id:fecId,per_page:"20",sort:"-disbursement_amount",two_year_transaction_period:cy});const res=d.results||[];if(res.length)return res;}catch(e){}
    }return[];
  });
}

// Schedule E — independent expenditures FOR or AGAINST a candidate
async function fetchScheduleE(candidateId){
  if(!candidateId)return[];return withCache("se_"+candidateId,async()=>{
    try{const d=await fecFetch(FEC_EP.scheduleE,{candidate_id:candidateId,per_page:"20",sort:"-expenditure_amount"});return d.results||[];}catch(e){return[];}
  });
}

// Candidate's own filings (Form 3, amendments, etc.)
async function fetchCandidateFilings(candidateId){
  if(!candidateId)return[];const k="cf_"+candidateId;const c=gc(k);if(c)return c;
  try{const d=await fecFetch(FEC_EP.candidateFilings(candidateId),{per_page:"10",sort:"-receipt_date"});sc(k,d.results||[]);return d.results||[];}catch(e){sc(k,[]);return[];}
}

// Election-level summary (all candidates in same race)
async function fetchElectionSummary(state,office,cycle){
  const k=`es_${state}_${office}_${cycle}`;const c=gc(k);if(c)return c;
  try{const d=await fecFetch(FEC_EP.electionsSummary,{state,office:office==="Senate"?"S":"H",cycle:cycle||2026,per_page:"20"});sc(k,d.results||[]);return d.results||[];}catch(e){sc(k,[]);return[];}
}

// Committee totals (for linked committees)
async function fetchCommitteeTotals(committeeId){
  if(!committeeId)return null;const k="ct_"+committeeId;const c=gc(k);if(c!==undefined)return c;
  try{const d=await fecFetch(FEC_EP.committeeTotals(committeeId));const r=(d.results&&d.results[0])||null;sc(k,r);return r;}catch(e){sc(k,null);return null;}
}

/* ── FEC ──────────────────────────────── */
const FEC_P=withCache("fec_v13",async()=>{
  const all=[];const delay=ms=>new Promise(r=>setTimeout(r,ms));
  /* Fetch current + recent cycle in parallel pairs (S+H together), with delay between cycles */
  for(const cyc of["","&cycle=2024"]){
    /* Senate and House for this cycle - parallel is ok within same cycle */
    const[rs,rh]=await Promise.all([
      fetch(`https://api.open.fec.gov/v1/candidates/totals/?office=S&per_page=100&page=1&sort=-receipts${cyc}&api_key=${FEC_KEY}`,{signal:AbortSignal.timeout(12000)}).then(r=>r.ok?r.json():{results:[]}).catch(()=>({results:[]})),
      fetch(`https://api.open.fec.gov/v1/candidates/totals/?office=H&per_page=100&page=1&sort=-receipts${cyc}&api_key=${FEC_KEY}`,{signal:AbortSignal.timeout(12000)}).then(r=>r.ok?r.json():{results:[]}).catch(()=>({results:[]}))
    ]);
    all.push(...(rs.results||[]),...(rh.results||[]));
    await delay(800);
    /* Page 2 if needed */
    if((rs.results||[]).length>=100||(rh.results||[]).length>=100){
      const[rs2,rh2]=await Promise.all([
        fetch(`https://api.open.fec.gov/v1/candidates/totals/?office=S&per_page=100&page=2&sort=-receipts${cyc}&api_key=${FEC_KEY}`,{signal:AbortSignal.timeout(12000)}).then(r=>r.ok?r.json():{results:[]}).catch(()=>({results:[]})),
        fetch(`https://api.open.fec.gov/v1/candidates/totals/?office=H&per_page=100&page=2&sort=-receipts${cyc}&api_key=${FEC_KEY}`,{signal:AbortSignal.timeout(12000)}).then(r=>r.ok?r.json():{results:[]}).catch(()=>({results:[]}))
      ]);
      all.push(...(rs2.results||[]),...(rh2.results||[]));
      await delay(800);
    }
  }
  if(!all.length)throw new Error("FEC returned 0");
  console.log(`FEC loaded ${all.length} candidate records`);
  const byLast={},byFull={};
  all.forEach(f=>{if(!f.name||!f.state)return;const raw=f.name.toUpperCase();const last=raw.split(",")[0].trim().toLowerCase();const stL=f.state.toLowerCase();const lk=last+"_"+stL;if(!byLast[lk]||(f.receipts||0)>((byLast[lk]||{}).receipts||0))byLast[lk]=f;const pts=raw.split(",");if(pts[1]){const first=pts[1].trim().split(/\s+/)[0].toLowerCase();byFull[last+"_"+first+"_"+stL]=f;}});
  return{count:all.length,byLast,byFull};
});
function lookupFEC(name,state,fd){
  fd=fd||{};const byLast=fd.byLast||{},byFull=fd.byFull||{};
  const stL=(state||"").toLowerCase();const words=normS(name).replace(/\b(jr|sr|ii|iii)\b/g,"").trim().split(" ").filter(Boolean);
  if(!words.length)return null;
  const first=words[0]||"";const fa=NICKS[first]||first;
  for(let n=1;n<=Math.min(3,words.length);n++){const last=words.slice(-n).join(" ");for(const r of[byFull[last+"_"+first+"_"+stL],byFull[last+"_"+fa+"_"+stL],byLast[last+"_"+stL]])if(r)return r;}
  return null;
}
async function fetchDonors(fecId){if(!fecId)return[];return withCache("dn_"+fecId,async()=>{for(const cy of[2026,2024,2022,2020]){try{const r=await fetch(`https://api.open.fec.gov/v1/schedules/schedule_a/?candidate_id=${fecId}&contributor_type=committee&per_page=15&sort=-contribution_receipt_amount&two_year_transaction_period=${cy}&api_key=${FEC_KEY}`,{signal:AbortSignal.timeout(10000)});if(!r.ok)continue;const d=await r.json();const res=d.results||[];if(res.length)return res;}catch(e){}}return[];});}
async function fetchByName(name,state,ch){const k="fn_"+name+"_"+state;const c=gc(k);if(c!==undefined)return c;try{const last=normS(name).split(" ").pop();const off=ch==="Senate"?"S":"H";const d=await fetch(`https://api.open.fec.gov/v1/candidates/?q=${encodeURIComponent(last)}&state=${state}&office=${off}&per_page=5&sort=-receipts&api_key=${FEC_KEY}`,{signal:AbortSignal.timeout(10000)}).then(r=>r.json());const cands=d.results||[];const fn=normS(name).split(" ")[0];for(const c2 of cands){const pts=(c2.name||"").toUpperCase().split(",");const cl=(pts[0]||"").trim().toLowerCase();const cf=((pts[1]||"").trim().split(/\s+/)[0]||"").toLowerCase();if(cl.endsWith(last)&&(cf===fn||cf===(NICKS[fn]||fn))){sc(k,c2);return c2;}}if(cands.length){sc(k,cands[0]);return cands[0];}sc(k,null);return null;}catch(e){sc(k,null);return null;}}

/* ── CONGRESS ─────────────────────────── */
async function fetchBills(bid){if(!bid)return[];const k="b_"+bid;const c=gc(k);if(c)return c;try{const d=await fetch(`https://api.congress.gov/v3/member/${bid}/sponsoredLegislation?limit=12&format=json&api_key=${CGK}`,{signal:AbortSignal.timeout(10000)}).then(r=>r.json());const r=d.sponsoredLegislation||[];sc(k,r);return r;}catch(e){return[];}}
const RECENT_BILLS=withCache("rb_v4",async()=>{const[h,s]=await Promise.all([fetch(`https://api.congress.gov/v3/bill?limit=20&sort=updateDate+desc&billType=hr&format=json&api_key=${CGK}`,{signal:AbortSignal.timeout(12000)}).then(r=>r.json()).catch(()=>null),fetch(`https://api.congress.gov/v3/bill?limit=20&sort=updateDate+desc&billType=s&format=json&api_key=${CGK}`,{signal:AbortSignal.timeout(12000)}).then(r=>r.json()).catch(()=>null)]);return{hr:(h&&h.bills)||[],s:(s&&s.bills)||[]};});
const LDA_P=withCache("lda_v9",async()=>{
  /* Try new lda.gov first, then legacy lda.senate.gov, via CORS proxy */
  for(const base of[LDA_BASE,LDA_BASE_FB]){
    const url=base+"/filings/?ordering=-dt_posted&page_size=25&filing_year=2026&format=json";
    for(const u of[url,PXK+encodeURIComponent(url),PX2+encodeURIComponent(url)]){
      try{const r=await fetch(u,{signal:AbortSignal.timeout(15000)});if(!r.ok)continue;const d=await r.json();if(d&&d.results&&d.results.length>0)return{filings:d.results,count:d.count||0};}catch(e){}
    }
  }
  return{filings:[],count:0,error:"LDA API unavailable — CORS blocked"};
});
const TREASURY_P=withCache("tr_v6",async()=>{try{const r=await fetch(TREAS_BASE+"/v2/accounting/od/debt_to_penny?page[size]=5&sort=-record_date",{signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error("Treasury HTTP "+r.status);const d=await r.json();return(d.data||[]).map(x=>({record_date:x.record_date,total_mil_amt:x.tot_pub_debt_out_amt?Math.round(parseFloat(x.tot_pub_debt_out_amt)/1e6):0}));}catch(e){console.warn("Treasury API:",e.message);return[];}});
const FEDREG_P=withCache("fr_v5",async()=>{try{const r=await fetch(FEDREG+"/documents.json?per_page=10&order=newest&fields[]=title&fields[]=publication_date&fields[]=type&fields[]=agencies",{signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error("FedReg HTTP "+r.status);return(await r.json()).results||[];}catch(e){console.warn("FedRegister API:",e.message);return[];}});
/* FARA data fetched via GitHub Actions cron → static JSON in /public/data/ */
const FARA_P=withCache("fara_v3",async()=>{try{const r=await fetch("/data/fara-registrants.json",{signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error("FARA data not found (run: node scripts/fetch-fara.mjs)");const d=await r.json();return{results:d.results||[],total:d.total||0,fetchedAt:d.fetchedAt||""};}catch(e){console.warn("FARA:",e.message);return{results:[],total:0,error:e.message};}});
const FARA_PRINCIPALS=withCache("fara_pri_v3",async()=>{try{const r=await fetch("/data/fara-principals.json",{signal:AbortSignal.timeout(8000)});if(!r.ok)return[];const d=await r.json();return d.results||[];}catch(e){return[];}});
const USA_AGENCIES=withCache("usa_ag_v1",async()=>{try{const r=await fetch(USA_BASE+"/references/toptier_agencies/?limit=20",{signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error();const d=await r.json();return d.results||[];}catch(e){console.warn("USASpending:",e.message);return[];}});

/* ── CONGRESS LOADER ──────────────────── */
function fixPhotoUrl(m){
  /* Use Congress.gov depiction URL directly (most reliable) */
  const raw=(m.depiction&&m.depiction.imageUrl)||null;
  if(raw&&raw.startsWith("http"))return raw;
  /* Fallback to bioguide photo URL */
  if(m.bioguideId)return"https://bioguide.congress.gov/bioguide/photo/"+m.bioguideId[0]+"/"+m.bioguideId+".jpg";
  return null;
}
function detectChamber(m){
  /* Check terms.item array from Congress.gov v3 API */
  if(m.terms&&m.terms.item&&m.terms.item.length){
    const last=m.terms.item[m.terms.item.length-1];
    if(last.chamber)return last.chamber.includes("Senate")?"Senate":"House";
  }
  /* Check legacy terms array format */
  if(m.terms&&Array.isArray(m.terms)&&m.terms.length){
    const last=m.terms[m.terms.length-1];
    if(last.chamber)return last.chamber.includes("Senate")?"Senate":"House";
  }
  /* District field — House members have districts, Senators don't */
  if(m.district!=null)return"House";
  /* Fallback */
  return"House";
}
async function loadMembers(onUp){
  return withCache("members_v12",async()=>{
    const NICK={"Bernard Sanders":"Bernie Sanders","Angus S. King":"Angus King","Charles E. Schumer":"Chuck Schumer"};
    /* Congress.gov chamber filter is broken — fetch all members and detect chamber from terms data */
    let all=[],offset=0;
    while(all.length<660){
      const d=await fetch(`https://api.congress.gov/v3/member?limit=250&offset=${offset}&currentMember=true&format=json&api_key=${CGK}`,{signal:AbortSignal.timeout(14000)}).then(r=>r.json()).catch(()=>null);
      if(!d||!d.members||!d.members.length)break;
      all=all.concat(d.members);
      if(d.members.length<250)break;
      offset+=250;
    }
    const seen=new Set();const members=all.filter(m=>{if(!m.name||!m.state)return false;const k=m.bioguideId||(m.name+"_"+m.state);if(seen.has(k))return false;seen.add(k);return true;});
    if(!members.length)return null;
    const senateCount=members.filter(m=>detectChamber(m)==="Senate").length;
    const houseCount=members.filter(m=>detectChamber(m)==="House").length;
    console.log(`Congress API: ${members.length} total — ${senateCount} senators, ${houseCount} representatives`);
    const fd=await FEC_P.catch(()=>({byLast:{},byFull:{}}));
    return members.map((m,i)=>{const raw=m.name||"";const name=(NICK[raw]||raw).split(",").reverse().map(s=>s.trim()).join(" ");const ch2=detectChamber(m);const party=(m.partyName||"").includes("Republican")?"R":(m.partyName||"").includes("Democrat")?"D":"I";const st=toAbbr(m.state);const fr=lookupFEC(name,st,fd);return{id:"a"+i,name,party,chamber:ch2,state:st,bioguideId:m.bioguideId||null,photo:fixPhotoUrl(m),initials:name.split(" ").map(x=>x[0]).filter(Boolean).join("").slice(0,2).toUpperCase(),raised:(fr&&fr.receipts)||0,spent:(fr&&fr.disbursements)||0,cash:(fr&&fr.cash_on_hand_end_period)||0,hasRealFinancials:!!fr,fecId:(fr&&fr.candidate_id)||null,fecUrl:fr&&fr.candidate_id?"https://www.fec.gov/data/candidate/"+fr.candidate_id+"/":"",congressUrl:"https://www.congress.gov/member/"+name.toLowerCase().replace(/[^a-z\s]/g,"").trim().replace(/\s+/g,"-")+"/"+(m.bioguideId||"")};}).filter(p=>p.name.length>2);
  }).then(pols=>{if(pols&&pols.length>0)onUp(pols);return pols;});
}

const SR=[["Chuck Schumer","D","Senate","NY","S000148"],["Bernie Sanders","I","Senate","VT","S000033"],["Angus King","I","Senate","ME","K000383"],["Elizabeth Warren","D","Senate","MA","W000817"],["Amy Klobuchar","D","Senate","MN","K000367"],["Ron Wyden","D","Senate","OR","W000779"],["Patty Murray","D","Senate","WA","M001111"],["Mark Warner","D","Senate","VA","W000805"],["Tim Kaine","D","Senate","VA","K000384"],["Tammy Baldwin","D","Senate","WI","B001230"],["John Fetterman","D","Senate","PA","F000479"],["Cory Booker","D","Senate","NJ","B001288"],["Alex Padilla","D","Senate","CA","P000145"],["Adam Schiff","D","Senate","CA","S001150"],["Mark Kelly","D","Senate","AZ","K000395"],["Jon Ossoff","D","Senate","GA","O000174"],["Raphael Warnock","D","Senate","GA","W000790"],["Sheldon Whitehouse","D","Senate","RI","W000802"],["Ed Markey","D","Senate","MA","M000133"],["Chris Murphy","D","Senate","CT","M001169"],["Richard Blumenthal","D","Senate","CT","B001277"],["Brian Schatz","D","Senate","HI","S001194"],["Mazie Hirono","D","Senate","HI","H001042"],["Kirsten Gillibrand","D","Senate","NY","G000555"],["Michael Bennet","D","Senate","CO","B001267"],["John Hickenlooper","D","Senate","CO","H001077"],["Martin Heinrich","D","Senate","NM","H001046"],["Ben Ray Lujan","D","Senate","NM","L000570"],["Jacky Rosen","D","Senate","NV","R000608"],["Catherine Cortez Masto","D","Senate","NV","C001113"],["Jack Reed","D","Senate","RI","R000122"],["John Thune","R","Senate","SD","T000250"],["John Cornyn","R","Senate","TX","C001056"],["Mitch McConnell","R","Senate","KY","M000355"],["Ted Cruz","R","Senate","TX","C001098"],["Rick Scott","R","Senate","FL","S001217"],["Susan Collins","R","Senate","ME","C001035"],["Lisa Murkowski","R","Senate","AK","M001153"],["Lindsey Graham","R","Senate","SC","G000359"],["Tim Scott","R","Senate","SC","S001184"],["Tom Cotton","R","Senate","AR","C001095"],["Josh Hawley","R","Senate","MO","H001089"],["Chuck Grassley","R","Senate","IA","G000386"],["Joni Ernst","R","Senate","IA","E000295"],["Mike Lee","R","Senate","UT","L000577"],["Rand Paul","R","Senate","KY","P000603"],["Marsha Blackburn","R","Senate","TN","B001243"],["Bill Hagerty","R","Senate","TN","H001086"],["Steve Daines","R","Senate","MT","D000618"],["John Barrasso","R","Senate","WY","B001261"],["Thom Tillis","R","Senate","NC","T000476"],["Ted Budd","R","Senate","NC","B001305"],["Katie Britt","R","Senate","AL","B001310"],["Tommy Tuberville","R","Senate","AL","T000278"],["Roger Marshall","R","Senate","KS","M001198"],["James Lankford","R","Senate","OK","L000575"],["Markwayne Mullin","R","Senate","OK","M001190"],["Todd Young","R","Senate","IN","Y000064"],["Mike Johnson","R","House","LA","J000299"],["Hakeem Jeffries","D","House","NY","J000294"],["Steve Scalise","R","House","LA","S001176"],["Jim Jordan","R","House","OH","J000289"],["Nancy Pelosi","D","House","CA","P000197"],["Alexandria Ocasio-Cortez","D","House","NY","O000172"],["Marjorie Taylor Greene","R","House","GA","G000596"],["Ilhan Omar","D","House","MN","O000173"],["Ayanna Pressley","D","House","MA","P000617"],["Ro Khanna","D","House","CA","K000389"],["Jamie Raskin","D","House","MD","R000576"],["Jerry Nadler","D","House","NY","N000002"],["James Comer","R","House","KY","C001108"],["Eric Swalwell","D","House","CA","S001193"],["Byron Donalds","R","House","FL","D000032"],["Lauren Boebert","R","House","CO","B001297"],["Thomas Massie","R","House","KY","M001184"],["Dan Crenshaw","R","House","TX","C001120"],["Elise Stefanik","R","House","NY","S001196"],["Ted Lieu","D","House","CA","L000582"],["Pete Aguilar","D","House","CA","A000371"],["Jim McGovern","D","House","MA","M000312"],["Maxwell Frost","D","House","FL",null]];
function buildStatic(fd){fd=fd||{};const seen=new Set();return SR.filter(([n,,,st])=>{const k=n+"_"+st;if(seen.has(k))return false;seen.add(k);return true;}).map(([name,party,chamber,state,bid],i)=>{const fr=lookupFEC(name,state,fd);return{id:"s"+i,name,party,chamber,state,bioguideId:bid||null,photo:bid?"https://bioguide.congress.gov/bioguide/photo/"+bid[0]+"/"+bid+".jpg":null,initials:name.split(" ").map(w=>w[0]||"").filter(Boolean).join("").slice(0,2).toUpperCase(),raised:(fr&&fr.receipts)||0,spent:(fr&&fr.disbursements)||0,cash:(fr&&fr.cash_on_hand_end_period)||0,hasRealFinancials:!!fr,fecId:(fr&&fr.candidate_id)||null,fecUrl:fr&&fr.candidate_id?"https://www.fec.gov/data/candidate/"+fr.candidate_id+"/":"",congressUrl:"https://www.congress.gov/member/"+name.toLowerCase().replace(/[^a-z\s]/g,"").trim().replace(/\s+/g,"-")+"/"+(bid||"")};});}

/* ── ATOMS ────────────────────────────── */
const CW=({children,pad})=><div style={{width:"100%",display:"flex",justifyContent:"center"}}><div style={{width:"100%",maxWidth:1200,padding:pad||"0 28px",boxSizing:"border-box"}}>{children}</div></div>;
const Spin=({sz,col})=><div style={{width:sz||18,height:sz||18,border:"2.5px solid rgba(255,255,255,.1)",borderTop:"2.5px solid "+(col||"#a78bfa"),borderRadius:"50%",animation:"spin .7s linear infinite",flexShrink:0}}/>;
const EBox=({msg})=><div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.25)",borderRadius:10,padding:14,color:"#f87171",fontSize:12,lineHeight:1.6}}>{msg}</div>;
const Tag=({label,color,bg})=><span style={{fontSize:9,fontWeight:800,background:bg||color+"22",color,padding:"2px 8px",borderRadius:4,border:"1px solid "+color+"44",flexShrink:0,whiteSpace:"nowrap"}}>{label}</span>;
const Divider=({label})=><div style={{display:"flex",alignItems:"center",gap:12,margin:"8px 0"}}><div style={{flex:1,height:1,background:"rgba(255,255,255,.07)"}}/>{label&&<span style={{fontSize:9,color:"rgba(255,255,255,.2)",textTransform:"uppercase",letterSpacing:1}}>{label}</span>}<div style={{flex:1,height:1,background:"rgba(255,255,255,.07)"}}/></div>;

function Avatar({pol,size,ring}){
  size=size||44;const[ok,set]=useState(!!pol.photo);
  if(pol.photo&&ok)return<img src={pol.photo} alt={pol.name} onError={()=>set(false)} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",border:`2px solid ${ring||PC[pol.party]}44`,flexShrink:0}}/>;
  return<div style={{width:size,height:size,borderRadius:"50%",background:`linear-gradient(135deg,${PC[pol.party]},${PC[pol.party]}88)`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:size*.34,flexShrink:0}}>{pol.initials}</div>;
}

/* ── API BAR ──────────────────────────── */
const API_CHECKS=[
  {id:"fec",label:"FEC",color:"#10b981",test:()=>FEC_P.then(d=>d&&d.count>0).catch(()=>false)},
  {id:"cong",label:"Congress",color:"#0ea5e9",test:()=>fetch(`https://api.congress.gov/v3/member?limit=1&currentMember=true&format=json&api_key=${CGK}`,{signal:AbortSignal.timeout(8000)}).then(r=>r.ok).catch(()=>false)},
  {id:"house",label:"House Trades",color:"#22c55e",test:()=>HOUSE_P.then(d=>d&&d.length>0).catch(()=>false)},
  {id:"senate",label:"Senate Trades",color:"#a78bfa",test:()=>SENATE_P.then(d=>d&&d.length>0).catch(()=>false)},
  {id:"lda",label:"LDA",color:"#6366f1",test:()=>LDA_P.then(d=>!d.error&&d.filings.length>0).catch(()=>false)},
  {id:"usa",label:"USASpending",color:"#10b981",test:()=>fetch(USA_BASE+"/references/toptier_agencies/?limit=1",{signal:AbortSignal.timeout(10000)}).then(r=>r.ok).catch(()=>false)},
  {id:"treas",label:"Treasury",color:"#22d3ee",test:()=>fetch(TREAS_BASE+"/v2/accounting/od/debt_to_penny?page[size]=1&sort=-record_date",{signal:AbortSignal.timeout(10000)}).then(r=>r.ok).catch(()=>false)},
  {id:"fedreg",label:"FedRegister",color:"#84cc16",test:()=>FEDREG_P.then(d=>d&&d.length>0).catch(()=>false)},
  {id:"bills",label:"Bills",color:"#f59e0b",test:()=>RECENT_BILLS.then(d=>d&&d.hr&&d.hr.length>0).catch(()=>false)},
  {id:"fara",label:"FARA",color:"#f97316",test:()=>fetch("/data/fara-registrants.json",{signal:AbortSignal.timeout(5000)}).then(r=>r.ok).catch(()=>false)},
];
function ApiBar(){
  const[s,set]=useState(()=>Object.fromEntries(API_CHECKS.map(a=>[a.id,"checking"])));
  useEffect(()=>{API_CHECKS.forEach(a=>a.test().then(ok=>set(p=>({...p,[a.id]:ok?"ok":"fail"}))).catch(()=>set(p=>({...p,[a.id]:"fail"}))));},[]);
  const live=Object.values(s).filter(v=>v==="ok").length;
  return(
    <div style={{background:"#0f172a",borderBottom:"1px solid rgba(168,85,247,.15)",padding:"4px 16px",display:"flex",alignItems:"center",gap:3,flexWrap:"wrap",position:"sticky",top:0,zIndex:400,boxSizing:"border-box",width:"100%"}}>
      <span style={{fontSize:9,fontWeight:700,color:"rgba(168,85,247,.5)",textTransform:"uppercase",letterSpacing:.8,marginRight:4}}>APIs</span>
      {API_CHECKS.map(a=>{const ok=s[a.id]==="ok",chk=s[a.id]==="checking";return(
        <div key={a.id} title={a.label+(ok?" ✓":" ✗")} style={{display:"flex",alignItems:"center",gap:3,background:"rgba(255,255,255,.02)",border:"1px solid "+(ok?"rgba(168,85,247,.2)":"rgba(255,255,255,.05)"),padding:"3px 7px",borderRadius:100}}>
          {chk?<Spin sz={5} col="#6b7280"/>:<div style={{width:5,height:5,borderRadius:"50%",background:ok?"#22c55e":"#ef4444",boxShadow:ok?"0 0 5px #22c55e":"none"}}/>}
          <span style={{fontSize:8,fontWeight:700,color:ok?a.color:"#4b5563"}}>{a.label}</span>
        </div>
      );})}
      <span style={{marginLeft:"auto",fontSize:9,fontWeight:700,color:live>=6?"#34d399":live>3?"#fbbf24":"#f87171"}}>{live}/{API_CHECKS.length}</span>
    </div>
  );
}

/* ── ANIMATED COUNTER ─────────────────── */
function AnimCounter({value,prefix="",suffix="",color}){
  const[display,setD]=useState(0);const ref=useRef(null);
  useEffect(()=>{if(!value)return;const start=0,end=value,dur=1200,step=16;let cur=start;const t=setInterval(()=>{cur+=Math.ceil((end-cur)/8);if(cur>=end){cur=end;clearInterval(t);}setD(cur);},step);return()=>clearInterval(t);},[value]);
  return<span style={{color:color||"#a78bfa",fontWeight:900}}>{prefix}{typeof value==="string"?value:display.toLocaleString()}{suffix}</span>;
}

/* ── FLOATING POLITICIAN CARDS (big, hoverable) ─── */
const HEADLINE_TEMPLATES=[
  pol=>`${pol.party==="D"?"🔵 Democrat":"🔴 Republican"} · ${pol.chamber} · ${pol.state}`,
  pol=>pol.raised>5e6?`💰 ${fmt(pol.raised)} raised this cycle`:`🏛 ${pol.chamber} of the United States`,
  pol=>`${pol.chamber==="Senate"?"Senator":"Representative"} ${pol.name.split(" ").pop()}`,
];
function getCardHeadline(pol,trade){
  if(trade&&trade.gap>45)return{text:`🚨 STOCK Act Violation — ${trade.gap} days late`,color:"#fca5a5",bg:"rgba(239,68,68,.15)"};
  if(trade&&trade.gap>30)return{text:`⚠️ Late disclosure — filed ${trade.gap}d after trade`,color:"#fbbf24",bg:"rgba(245,158,11,.12)"};
  if(trade&&trade.ticker)return{text:`📈 Recently traded ${trade.ticker} · ${trade.action}`,color:"#4ade80",bg:"rgba(16,185,129,.1)"};
  if(pol.raised>10e6)return{text:`💰 ${fmt(pol.raised)} raised · top fundraiser`,color:"#a78bfa",bg:"rgba(168,85,247,.12)"};
  if(pol.raised>1e6)return{text:`🏦 ${fmt(pol.raised)} raised this cycle`,color:"#34d399",bg:"rgba(16,185,129,.1)"};
  return{text:`🏛 ${pol.chamber} · ${pol.state} · ${PL[pol.party]}`,color:"rgba(255,255,255,.6)",bg:"rgba(255,255,255,.05)"};
}
const FANIMS=["floatA","floatB","floatC","floatD"];
function FloatingCards({pols,trades,onSelect}){
  const[hovered,setHovered]=useState(null);
  const tradeMap=useMemo(()=>{const m={};(trades||[]).forEach(t=>{const ln=(t.name||"").toLowerCase().split(/\s+/).pop();const pol=pols.find(p=>p.name.toLowerCase().includes(ln)&&ln.length>3);if(pol&&!m[pol.id])m[pol.id]=t;});return m;},[pols.length,trades.length]);
  const cards=useMemo(()=>pols.filter(p=>p.photo||p.bioguideId).slice(0,18),[pols.length]);
  const positions=useMemo(()=>cards.map((_,i)=>({left:1+(i*4.9)%89,top:1+(i*11.7)%88,dur:14+i%5*2.4,delay:i*.5,anim:FANIMS[i%4]})),[cards.length]);
  return(
    <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:1}}>
      {cards.map((pol,i)=>{
        const pos=positions[i];const trade=tradeMap[pol.id];const flag=trade&&flagTrade(trade);const isH=hovered===pol.id;const hl=getCardHeadline(pol,trade);
        return(
          <div key={pol.id} onClick={()=>onSelect(pol)} onMouseEnter={()=>setHovered(pol.id)} onMouseLeave={()=>setHovered(null)}
            style={{position:"absolute",left:pos.left+"%",top:pos.top+"%",animation:`${pos.anim} ${pos.dur}s ease-in-out ${pos.delay}s infinite`,pointerEvents:"auto",cursor:"pointer",zIndex:isH?20:Math.floor(i/5),willChange:"transform",transition:"z-index .1s"}}>
            <div style={{background:isH?"rgba(15,5,35,.95)":"rgba(10,5,25,.82)",backdropFilter:"blur(16px)",border:"1px solid "+(flag&&flag.badge==="VIOLATION"?"rgba(239,68,68,.5)":isH?"rgba(168,85,247,.6)":"rgba(168,85,247,.22)"),borderRadius:16,padding:"14px 16px 14px 18px",width:isH?240:200,boxShadow:"inset 3px 0 0 "+PC[pol.party]+","+(isH?"0 12px 40px rgba(168,85,247,.3),0 0 0 1px rgba(168,85,247,.2)":flag&&flag.badge==="VIOLATION"?"0 8px 28px rgba(239,68,68,.25)":"0 6px 24px rgba(0,0,0,.5)"),transition:"all .25s cubic-bezier(.4,0,.2,1)"}}>
              <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:isH?10:8}}>
                <Avatar pol={pol} size={isH?46:38}/>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontSize:isH?12:11,fontWeight:800,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pol.name.split(" ").slice(-1)[0]}</div>
                  <div style={{fontSize:isH?10:9,color:"rgba(255,255,255,.45)",marginTop:2}}>
                    <span style={{color:PC[pol.party],fontWeight:700}}>{pol.party}</span> · {pol.chamber[0]} · {pol.state}
                  </div>
                  {isH&&pol.raised>0&&<div style={{fontSize:9,color:"#10b981",marginTop:3,fontWeight:600}}>{fmt(pol.raised)} raised</div>}
                </div>
              </div>
              {/* Headline / trade badge */}
              <div style={{background:hl.bg,borderRadius:8,padding:"6px 10px",border:"1px solid rgba(255,255,255,.06)"}}>
                <div style={{fontSize:isH?10:9,color:hl.color,fontWeight:700,lineHeight:1.4}}>{hl.text}</div>
              </div>
              {/* Hover expanded info */}
              {isH&&<div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,.07)"}}>
                {trade&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
                  {[["Ticker",trade.ticker||"N/A","#a78bfa"],["Action",trade.action,trade.action==="BUY"?"#4ade80":"#f87171"],["Gap",trade.gap+"d",gapC(trade.gap)]].map(([l,v,c])=>(
                    <div key={l} style={{background:"rgba(255,255,255,.05)",borderRadius:6,padding:"4px 8px",textAlign:"center"}}>
                      <div style={{fontSize:7,color:"rgba(255,255,255,.25)",textTransform:"uppercase"}}>{l}</div>
                      <div style={{fontSize:10,fontWeight:800,color:c}}>{v}</div>
                    </div>
                  ))}
                </div>}
                <div style={{fontSize:9,color:"rgba(255,255,255,.35)",fontStyle:"italic"}}>{pol.chamber==="Senate"?"U.S. Senator":"U.S. Representative"}, {pol.state} · Click to view full profile</div>
              </div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── HERO HEADLINES (cycling) ──────────── */
const HEADS=[
  {line1:"They voted on the CHIPS Act.",line2:"Three days earlier,",line3:"they bought NVDA stock.",sub:"Trade-vote correlations. Cross-referenced. Publicly disclosed."},
  {line1:"535 Members of Congress.",line2:"Every trade disclosed.",line3:"Every dollar tracked.",sub:"STOCK Act violations flagged in real time. FEC data for every member."},
  {line1:"The 45-day disclosure window.",line2:"15% of Congress misses it",line3:"every single year.",sub:"We compute the gap. We flag the violation. Every time."},
  {line1:"$2.3 billion in disclosed trades.",line2:"Foreign governments lobbying.",line3:"PAC money flowing in.",sub:"HouseStockWatcher · SenateStockWatcher · FEC · LDA · Congress.gov"},
  {line1:"Political transparency",line2:"isn't a privilege.",line3:"It's a right.",sub:"Officium — Latin for duty. Every senator. Every representative. Every dollar."},
];
function HeroText(){
  const[idx,setIdx]=useState(0);const[vis,setVis]=useState(true);
  useEffect(()=>{const t=setInterval(()=>{setVis(false);setTimeout(()=>{setIdx(i=>(i+1)%HEADS.length);setVis(true);},350);},5500);return()=>clearInterval(t);},[]);
  const h=HEADS[idx];const m=mob();
  return(
    <div style={{transition:"opacity .35s",opacity:vis?1:0,minHeight:m?140:180}}>
      <div style={{fontSize:m?14:16,color:"rgba(255,255,255,.35)",marginBottom:6,fontWeight:400}}>{h.line1}</div>
      <h1 style={{fontSize:m?"clamp(28px,7vw,40px)":"clamp(34px,4vw,56px)",fontWeight:900,color:"#fff",lineHeight:1.06,letterSpacing:-2,margin:"0 0 10px",animation:"glow 5s ease infinite"}}>
        {h.line2}<br/><span style={{color:"#a78bfa"}}>{h.line3}</span>
      </h1>
      <p style={{fontSize:m?11:13,color:"rgba(255,255,255,.28)",margin:0,lineHeight:1.7}}>{h.sub}</p>
    </div>
  );
}

/* ── LIVE STATS STRIP ─────────────────── */
function LiveStrip({pols,trades}){
  const v=(trades||[]).filter(t=>t.gap>45).length;
  const senate=pols.filter(p=>p.chamber==="Senate").length;
  const house=pols.filter(p=>p.chamber==="House").length;
  const fecM=pols.filter(p=>p.hasRealFinancials).length;
  return(
    <div style={{background:"rgba(168,85,247,.06)",borderTop:"1px solid rgba(168,85,247,.12)",borderBottom:"1px solid rgba(168,85,247,.12)",padding:"12px 0"}}>
      <CW><div style={{display:"flex",gap:0,overflowX:"auto",scrollbarWidth:"none"}}>
        {[[senate+house,"Officials"],[senate,"Senators"],[house,"House"],[fecM||"…","FEC Matched"],[(trades||[]).length,"Trades"],[ v>0?v+"🚨":v,"Violations"]].map(([n,l],i)=>(
          <div key={i} style={{flex:1,minWidth:80,padding:"0 16px",borderRight:i<5?"1px solid rgba(168,85,247,.1)":"none",textAlign:"center"}}>
            <div style={{fontSize:mob()?15:20,fontWeight:900,color:"#a78bfa"}}>{n}</div>
            <div style={{fontSize:9,color:"rgba(255,255,255,.25)",textTransform:"uppercase",letterSpacing:.7,marginTop:3}}>{l}</div>
          </div>
        ))}
      </div></CW>
    </div>
  );
}

/* ── VIOLATION LEADERBOARD ─────────────── */
function ViolationBoard({trades,pols,onSelect}){
  const leaders=useMemo(()=>{const m={};(trades||[]).filter(t=>t.gap>45).forEach(t=>{if(!t.name)return;if(!m[t.name])m[t.name]={name:t.name,count:0,maxGap:0,trades:[]};m[t.name].count++;m[t.name].maxGap=Math.max(m[t.name].maxGap,t.gap);m[t.name].trades.push(t);});return Object.values(m).sort((a,b)=>b.count-a.count).slice(0,8);},[trades]);
  /* If no violations, show most active traders instead */
  const topTraders=useMemo(()=>{if(leaders.length)return[];const m={};(trades||[]).forEach(t=>{if(!t.name)return;if(!m[t.name])m[t.name]={name:t.name,count:0,buys:0,sells:0};m[t.name].count++;if(t.action==="BUY")m[t.name].buys++;else m[t.name].sells++;});return Object.values(m).sort((a,b)=>b.count-a.count).slice(0,8);},[trades,leaders]);
  if(!leaders.length&&!topTraders.length)return null;
  const showTraders=!leaders.length&&topTraders.length>0;
  return(
    <div style={{background:"linear-gradient(135deg,#1e1b4b,#1e293b)",padding:"60px 0"}}>
      <CW>
        {showTraders?<>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:24}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:"#6366f1",animation:"pulseDot 2s infinite"}}/>
            <span style={{fontSize:10,fontWeight:700,color:"rgba(99,102,241,.7)",textTransform:"uppercase",letterSpacing:1.5}}>Most Active Congressional Traders</span>
            <span style={{fontSize:10,background:"rgba(99,102,241,.12)",border:"1px solid rgba(99,102,241,.3)",color:"#a5b4fc",padding:"2px 10px",borderRadius:100,fontWeight:700,marginLeft:"auto"}}>{(trades||[]).length} total disclosures</span>
          </div>
          <h2 style={{fontSize:mob()?22:30,fontWeight:900,color:"#fff",margin:"0 0 24px",letterSpacing:-1}}>Congressional Trading Leaderboard</h2>
          <div style={{display:"grid",gridTemplateColumns:mob()?"1fr":"repeat(2,1fr)",gap:12}}>
            {topTraders.map((l,i)=>{const pol=pols.find(p=>p.name.toLowerCase().includes(l.name.toLowerCase().split(/\s+/).pop())&&l.name.toLowerCase().split(/\s+/).pop().length>3);return(
              <div key={l.name} onClick={()=>pol&&onSelect(pol)} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(99,102,241,.05)",border:"1px solid rgba(99,102,241,.15)",borderRadius:12,padding:"14px 16px",cursor:pol?"pointer":"default",transition:"border .2s"}} onMouseEnter={e=>pol&&(e.currentTarget.style.borderColor="rgba(99,102,241,.4)")} onMouseLeave={e=>pol&&(e.currentTarget.style.borderColor="rgba(99,102,241,.15)")}>
                <div style={{fontSize:20,fontWeight:900,color:i<3?"#6366f1":"#94a3b8",minWidth:28,textAlign:"center"}}>{i+1}</div>
                {pol?<Avatar pol={pol} size={38}/>:<div style={{width:38,height:38,borderRadius:"50%",background:"rgba(255,255,255,.05)",flexShrink:0}}/>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.name}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.35)"}}>{pol?pol.chamber+" · "+pol.state:"Member"}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:22,fontWeight:900,color:"#6366f1"}}>{l.count}</div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,.3)"}}>{l.buys} buys · {l.sells} sells</div>
                </div>
              </div>
            );})}
          </div>
        </>:<>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:24}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:"#ef4444",animation:"pulseDot 2s infinite"}}/>
            <span style={{fontSize:10,fontWeight:700,color:"rgba(239,68,68,.7)",textTransform:"uppercase",letterSpacing:1.5}}>STOCK Act Violations</span>
            <span style={{fontSize:10,background:"rgba(239,68,68,.12)",border:"1px solid rgba(239,68,68,.3)",color:"#fca5a5",padding:"2px 10px",borderRadius:100,fontWeight:700,marginLeft:"auto"}}>{leaders.reduce((a,l)=>a+l.count,0)} total violations</span>
          </div>
          <h2 style={{fontSize:mob()?22:30,fontWeight:900,color:"#fff",margin:"0 0 24px",letterSpacing:-1}}>Hall of Violations</h2>
          <div style={{display:"grid",gridTemplateColumns:mob()?"1fr":"repeat(2,1fr)",gap:12}}>
            {leaders.map((l,i)=>{const pol=pols.find(p=>p.name.toLowerCase().includes(l.name.toLowerCase().split(/\s+/).pop()));return(
              <div key={l.name} onClick={()=>pol&&onSelect(pol)} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(239,68,68,.05)",border:"1px solid rgba(239,68,68,.15)",borderRadius:12,padding:"14px 16px",cursor:pol?"pointer":"default",transition:"border .2s"}} onMouseEnter={e=>pol&&(e.currentTarget.style.borderColor="rgba(239,68,68,.4)")} onMouseLeave={e=>pol&&(e.currentTarget.style.borderColor="rgba(239,68,68,.15)")}>
                <div style={{fontSize:20,fontWeight:900,color:i<3?"#ef4444":"#94a3b8",minWidth:28,textAlign:"center"}}>{i+1}</div>
                {pol?<Avatar pol={pol} size={38}/>:<div style={{width:38,height:38,borderRadius:"50%",background:"rgba(255,255,255,.05)",flexShrink:0}}/>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.name}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.35)"}}>{pol?pol.chamber+" · "+pol.state:"Member"}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:22,fontWeight:900,color:"#ef4444"}}>{l.count}</div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,.3)"}}>max {l.maxGap}d late</div>
                </div>
              </div>
            );})}
          </div>
        </>}
      </CW>
    </div>
  );
}

/* ── SECTOR HEATMAP ────────────────────── */
function SectorHeatmap({trades}){
  const sectors=useMemo(()=>{const m={};(trades||[]).forEach(t=>{if(!t.ticker)return;const sec=["NVDA","AMD","INTC","QCOM","TSM","MSFT","AAPL","GOOGL","META","AMZN"].includes(t.ticker)?"Technology":["LMT","RTX","NOC","GD","BA"].includes(t.ticker)?"Defense":["XOM","CVX","COP","OXY"].includes(t.ticker)?"Energy":["JPM","GS","MS","BAC","WFC","BLK"].includes(t.ticker)?"Finance":["PFE","MRNA","JNJ","ABBV","MRK"].includes(t.ticker)?"Pharma":"Other";if(!m[sec])m[sec]={buys:0,sells:0,total:0,tickers:new Set()};m[sec][t.action==="BUY"?"buys":"sells"]++;m[sec].total++;m[sec].tickers.add(t.ticker);});return Object.entries(m).map(([name,d])=>({name,buys:d.buys,sells:d.sells,total:d.total,tickers:[...d.tickers].slice(0,4),buyPct:Math.round((d.buys/d.total)*100)})).sort((a,b)=>b.total-a.total);},[trades]);
  if(!sectors.length)return null;
  const maxTotal=sectors[0]&&sectors[0].total||1;
  return(
    <div style={{background:"#0f172a",padding:"60px 0"}}>
      <CW>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:10,fontWeight:700,color:"rgba(168,85,247,.6)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>From real STOCK Act disclosures</div>
          <h2 style={{fontSize:mob()?22:30,fontWeight:900,color:"#fff",margin:0,letterSpacing:-1}}>Sector Trading Heatmap</h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:mob()?"repeat(2,1fr)":"repeat(3,1fr)",gap:12}}>
          {sectors.map((sec,i)=>{const c=IC[sec.name]||"#94a3b8";const intensity=sec.total/maxTotal;return(
            <div key={sec.name} style={{background:`rgba(${c==="#8b5cf6"?"139,92,246":c==="#f59e0b"?"245,158,11":c==="#10b981"?"16,185,129":c==="#6366f1"?"99,102,241":"0,0,0"},.${Math.round(intensity*8)+2})`,border:"1px solid "+c+"30",borderRadius:14,padding:18,position:"relative",overflow:"hidden",animation:"fadeUp .5s ease "+i*.1+"s both"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:c}}/>
              <div style={{fontSize:13,fontWeight:800,color:c,marginBottom:8}}>{sec.name}</div>
              <div style={{fontSize:26,fontWeight:900,color:"#fff",marginBottom:4}}>{sec.total}</div>
              <div style={{height:6,borderRadius:3,background:"rgba(239,68,68,.3)",overflow:"hidden",marginBottom:8}}>
                <div style={{height:"100%",width:sec.buyPct+"%",background:"#4ade80",transition:"width 1.5s"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"rgba(255,255,255,.4)",marginBottom:8}}>
                <span>🟢 {sec.buys} buys</span><span>🔴 {sec.sells} sells</span>
              </div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{sec.tickers.map(t=><span key={t} style={{fontSize:9,background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.5)",padding:"2px 6px",borderRadius:3,fontWeight:700}}>{t}</span>)}</div>
            </div>
          );})}
        </div>
      </CW>
    </div>
  );
}

/* ── FOLLOW MONEY ─────────────────────── */
function FollowMoney({pols,trades,onSelect}){
  const[fecSt,setFEC]=useState({data:null,loading:true,err:""});
  useEffect(()=>{FEC_P.then(d=>setFEC({data:d,loading:false,err:""})).catch(e=>setFEC({data:null,loading:false,err:e.message}));},[]);
  const enriched=useMemo(()=>{if(!fecSt.data||!pols.length)return pols;return pols.map(p=>{if(p.raised>0)return p;const fr=lookupFEC(p.name,p.state,fecSt.data);if(!fr)return p;return{...p,raised:fr.receipts||0,spent:fr.disbursements||0,cash:fr.cash_on_hand_end_period||0,hasRealFinancials:true,fecId:fr.candidate_id||null};});},[fecSt.data,pols]);
  const withFEC=enriched.filter(p=>p.raised>0);
  const tR=withFEC.slice().sort((a,b)=>b.raised-a.raised).slice(0,6);
  const totalR=withFEC.reduce((a,p)=>a+p.raised,0);
  const dT=withFEC.filter(p=>p.party==="D").reduce((a,p)=>a+p.raised,0);
  const rT=withFEC.filter(p=>p.party==="R").reduce((a,p)=>a+p.raised,0);
  const dP=totalR>0?Math.round((dT/totalR)*100):50;
  const topTraders=useMemo(()=>{const m={};(trades||[]).forEach(t=>{if(!t.name)return;m[t.name]=(m[t.name]||0)+1;});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,cnt])=>({name,cnt,pol:pols.find(p=>p.name.toLowerCase().includes(name.toLowerCase().split(/\s+/).pop()))}));},[trades,pols]);
  const m=mob();
  return(
    <div style={{background:"linear-gradient(135deg,#1e1b4b,#07030f)",padding:"72px 0"}}>
      <CW>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{fontSize:10,fontWeight:700,color:"rgba(168,85,247,.6)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>OpenFEC API · cycles 2020–2026</div>
          <h2 style={{fontSize:m?24:34,fontWeight:900,color:"#fff",margin:0,letterSpacing:-1}}>Follow the Money</h2>
        </div>
        {fecSt.loading&&<div style={{textAlign:"center",padding:"40px 0",display:"flex",flexDirection:"column",alignItems:"center",gap:12,color:"rgba(255,255,255,.3)"}}><Spin sz={24}/><div style={{fontSize:13}}>Loading FEC candidate totals...</div></div>}
        {fecSt.err&&<EBox msg={"FEC: "+fecSt.err}/>}
        {!fecSt.loading&&withFEC.length>0&&(
          <div>
            <div style={{display:"flex",gap:14,marginBottom:28,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:160,background:"rgba(168,85,247,.08)",border:"1px solid rgba(168,85,247,.2)",borderRadius:14,padding:20}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,.35)",textTransform:"uppercase",marginBottom:4}}>Total FEC Tracked</div>
                <div style={{fontSize:28,fontWeight:900,color:"#a78bfa"}}>{fmt(totalR)}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.3)",marginTop:4}}>{withFEC.length} of {pols.length} matched</div>
              </div>
              <div style={{flex:2,minWidth:200,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,padding:20}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,.35)",textTransform:"uppercase",marginBottom:12}}>Party Fundraising Split</div>
                <div style={{height:20,borderRadius:10,overflow:"hidden",background:"#ef4444",marginBottom:8}}>
                  <div style={{height:"100%",width:dP+"%",background:"#3b82f6",transition:"width 1.5s"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"rgba(255,255,255,.6)"}}>
                  <span><span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:"#3b82f6",marginRight:5}}/>D: {fmt(dT)} ({dP}%)</span>
                  <span><span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:"#ef4444",marginRight:5}}/>R: {fmt(rT)} ({100-dP}%)</span>
                </div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr",gap:20}}>
              <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,padding:22}}>
                <div style={{fontWeight:700,fontSize:14,color:"#fff",marginBottom:6}}>Top Fundraisers</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginBottom:16}}>Sorted by total receipts · FEC</div>
                {tR.map((p,i)=>(
                  <div key={p.id} onClick={()=>onSelect(p)} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.04)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"9px 6px",borderBottom:i<5?"1px solid rgba(255,255,255,.05)":"none",cursor:"pointer",borderRadius:8}}>
                    <span style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,.2)",minWidth:18,textAlign:"center"}}>{i+1}</span>
                    <Avatar pol={p} size={32}/>
                    <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div><div style={{fontSize:10,color:"rgba(255,255,255,.3)"}}>{p.chamber} · {p.state}</div></div>
                    <span style={{fontSize:12,fontWeight:800,color:"#10b981"}}>{fmt(p.raised)}</span>
                  </div>
                ))}
              </div>
              <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,padding:22}}>
                <div style={{fontWeight:700,fontSize:14,color:"#fff",marginBottom:6}}>Most Active Traders</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginBottom:16}}>By STOCK Act disclosure count</div>
                {topTraders.map(({name,cnt,pol:p},i)=>(
                  <div key={name} onClick={()=>p&&onSelect(p)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 6px",borderBottom:i<5?"1px solid rgba(255,255,255,.05)":"none",cursor:p?"pointer":"default",borderRadius:8}} onMouseEnter={e=>p&&(e.currentTarget.style.background="rgba(255,255,255,.04)")} onMouseLeave={e=>p&&(e.currentTarget.style.background="transparent")}>
                    <span style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,.2)",minWidth:18,textAlign:"center"}}>{i+1}</span>
                    {p?<Avatar pol={p} size={32}/>:<div style={{width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,.05)",flexShrink:0}}/>}
                    <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div><div style={{fontSize:10,color:"rgba(255,255,255,.3)"}}>{p?p.chamber+" · "+p.state:"Member"}</div></div>
                    <span style={{fontSize:12,fontWeight:800,color:"#a78bfa"}}>{cnt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {!fecSt.loading&&!withFEC.length&&<div style={{textAlign:"center",padding:"32px 0",color:"rgba(255,255,255,.3)",fontSize:13}}>FEC data loading — profiles will show finance data individually.</div>}
      </CW>
    </div>
  );
}

/* ── LDA SECTION ──────────────────────── */
function LDASection(){
  const[data,setData]=useState(null);const[q,setQ]=useState("");
  useEffect(()=>{LDA_P.then(setData).catch(e=>setData({error:e.message,filings:[]}));},[]);
  const shown=useMemo(()=>{if(!data||!data.filings||!data.filings.length)return[];const f=data.filings;if(!q)return f.slice(0,12);const lq=q.toLowerCase();return f.filter(fi=>((fi.registrant&&fi.registrant.name)||"").toLowerCase().includes(lq)||((fi.client&&fi.client.name)||"").toLowerCase().includes(lq)).slice(0,12);},[data,q]);
  return(
    <div style={{background:"linear-gradient(180deg,#1e293b,#07030f)",padding:"60px 0"}}>
      <CW>
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:14,marginBottom:24}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}><div style={{width:6,height:6,borderRadius:"50%",background:"#6366f1",boxShadow:"0 0 8px #6366f1"}}/><span style={{fontSize:9,fontWeight:700,color:"rgba(99,102,241,.7)",textTransform:"uppercase",letterSpacing:1.5}}>lda.senate.gov</span></div>
            <h2 style={{fontSize:mob()?22:28,fontWeight:900,color:"#fff",margin:0,letterSpacing:-1}}>Lobbying Disclosures</h2>
          </div>
          {data&&!data.error&&<span style={{fontSize:10,background:"rgba(99,102,241,.12)",border:"1px solid rgba(99,102,241,.3)",color:"#818cf8",padding:"5px 14px",borderRadius:100,fontWeight:700}}>{(data.count||0).toLocaleString()} filings</span>}
        </div>
        {!data&&<div style={{display:"flex",alignItems:"center",gap:10,color:"rgba(255,255,255,.3)",fontSize:13,padding:"16px 0"}}><Spin sz={14} col="#6366f1"/>Connecting...</div>}
        {data&&data.error&&<EBox msg={data.error}/>}
        {data&&!data.error&&<>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search registrant or client..." style={{width:"100%",maxWidth:400,padding:"12px 18px",borderRadius:10,border:"1.5px solid rgba(99,102,241,.2)",background:"rgba(99,102,241,.05)",color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box",marginBottom:18,transition:"border-color .2s"}} onFocus={e=>e.target.style.borderColor="rgba(99,102,241,.5)"} onBlur={e=>e.target.style.borderColor="rgba(99,102,241,.2)"}/>
          <div style={{display:"grid",gridTemplateColumns:mob()?"1fr":"repeat(auto-fill,minmax(320px,1fr))",gap:14}}>
            {shown.map((f,i)=>{const inc=f.income||0;const issues=Array.from(new Set((f.lobbying_activities||[]).map(a=>a.general_issue_code_display||a.issue_code).filter(Boolean))).slice(0,3);return(
              <div key={i} style={{background:"rgba(99,102,241,.04)",border:"1px solid rgba(99,102,241,.12)",borderRadius:14,padding:18,position:"relative",overflow:"hidden",transition:"border-color .2s,transform .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(99,102,241,.3)";e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(99,102,241,.12)";e.currentTarget.style.transform="none";}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#6366f1,#818cf8)"}}/>
                <div style={{fontSize:13,fontWeight:700,color:"#c7d2fe",marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(f.registrant&&f.registrant.name)||"Unknown"}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.3)",marginBottom:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Client: {(f.client&&f.client.name)||"--"}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:issues.length?10:0}}>
                  <div><div style={{fontSize:9,color:"rgba(255,255,255,.2)",textTransform:"uppercase",letterSpacing:.5,marginBottom:2}}>Income</div><div style={{fontSize:14,fontWeight:800,color:inc>0?"#34d399":"rgba(255,255,255,.12)",fontStyle:inc>0?"normal":"italic"}}>{inc>0?fmt(inc):"Not disclosed"}</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:9,color:"rgba(255,255,255,.2)",textTransform:"uppercase",letterSpacing:.5,marginBottom:2}}>Period</div><div style={{fontSize:11,color:"rgba(255,255,255,.4)",fontWeight:500}}>{f.filing_year||"--"} {f.filing_period_display||""}</div></div>
                </div>
                {issues.length>0&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:4}}>{issues.map((iss,j)=><span key={j} style={{fontSize:9,background:"rgba(99,102,241,.12)",color:"#a5b4fc",padding:"3px 8px",borderRadius:5,fontWeight:600,border:"1px solid rgba(99,102,241,.15)"}}>{iss}</span>)}</div>}
              </div>
            );})}
          </div>
        </>}
      </CW>
    </div>
  );
}

/* ── BILLS SECTION ────────────────────── */
function BillsSection(){
  const[data,setData]=useState(null);const[tab,setTab]=useState("hr");
  useEffect(()=>{RECENT_BILLS.then(setData);},[]);
  const bills=data?(tab==="hr"?data.hr:data.s):[];
  const TC={HR:"#3b82f6",S:"#ef4444",HJRES:"#f59e0b",SJRES:"#f59e0b"};
  return(
    <div style={{background:"#0f172a",padding:"60px 0"}}>
      <CW>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:10,fontWeight:700,color:"rgba(168,85,247,.6)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>Congress.gov API · live</div>
          <h2 style={{fontSize:mob()?22:30,fontWeight:900,color:"#fff",margin:0,letterSpacing:-1}}>Recent Legislation</h2>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:24}}>
          {[["hr","House Bills"],["s","Senate Bills"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{padding:"8px 20px",borderRadius:100,border:"1px solid "+(tab===k?"rgba(168,85,247,.5)":"rgba(255,255,255,.1)"),background:tab===k?"rgba(168,85,247,.15)":"transparent",color:tab===k?"#a78bfa":"rgba(255,255,255,.4)",fontWeight:700,fontSize:12,cursor:"pointer"}}>{l}</button>)}
        </div>
        {!data&&<div style={{display:"flex",justifyContent:"center",padding:"28px 0"}}><Spin sz={20}/></div>}
        {data&&<div style={{display:"grid",gridTemplateColumns:mob()?"1fr":"repeat(auto-fill,minmax(320px,1fr))",gap:14}}>
          {bills.slice(0,12).map((b,i)=>{const type=b.type||tab.toUpperCase();const c=TC[type]||"#6366f1";return(
            <div key={i} style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:18,position:"relative",overflow:"hidden",animation:"fadeUp .4s ease "+i*.05+"s both",transition:"border-color .2s,transform .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=c+"44";e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,.06)";e.currentTarget.style.transform="none";}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:c}}/>
              <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:10}}><span style={{fontSize:9,fontWeight:800,background:c+"15",color:c,padding:"3px 8px",borderRadius:5,border:"1px solid "+c+"22"}}>{type} {b.number||""}</span><span style={{fontSize:9,color:"rgba(255,255,255,.2)",fontWeight:500}}>{b.congress||119}th Congress</span></div>
              <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0",lineHeight:1.5,marginBottom:8}}>{(b.title||"").slice(0,100)}</div>
              {b.latestAction&&<div style={{fontSize:10,color:"rgba(255,255,255,.25)",lineHeight:1.5}}>{b.latestAction.text.slice(0,80)}</div>}
              <div style={{fontSize:9,color:"rgba(255,255,255,.12)",marginTop:8,fontWeight:500}}>{b.updateDate||"--"}</div>
            </div>
          );})}
        </div>}
      </CW>
    </div>
  );
}

/* ── FARA SECTION ────────────────────── */
function FARASection(){
  const[data,setData]=useState(null);const[q,setQ]=useState("");
  useEffect(()=>{FARA_P.then(setData).catch(()=>{});},[]);
  const registrants=data?data.results||[]:[];
  const filtered=q.length>1?registrants.filter(r=>(r.registrant_name||r.name||"").toLowerCase().includes(q.toLowerCase())||(r.country||r.registrant_country||"").toLowerCase().includes(q.toLowerCase())):registrants;
  return(
    <div style={{background:"#0f172a",padding:"60px 0"}}>
      <CW>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:10,fontWeight:700,color:"rgba(249,115,22,.6)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>FARA · Foreign Agent Registration Act</div>
          <h2 style={{fontSize:mob()?22:30,fontWeight:900,color:"#fff",margin:0,letterSpacing:-1}}>Foreign Agent Registrants</h2>
          {data&&<div style={{display:"flex",gap:8,justifyContent:"center",marginTop:10,flexWrap:"wrap"}}>
            <span style={{fontSize:10,fontWeight:700,background:"rgba(249,115,22,.1)",color:"#f97316",border:"1px solid rgba(249,115,22,.25)",padding:"4px 14px",borderRadius:100}}>{data.total||registrants.length} registrants</span>
            {data.fetchedAt&&<span style={{fontSize:10,color:"rgba(255,255,255,.2)",padding:"4px 0"}}>Updated {data.fetchedAt.slice(0,10)}</span>}
          </div>}
        </div>
        <div style={{maxWidth:420,margin:"0 auto 24px",position:"relative"}}>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search registrants by name or country..." maxLength={80} style={{width:"100%",padding:"12px 18px 12px 40px",borderRadius:12,border:"1px solid rgba(249,115,22,.2)",background:"rgba(249,115,22,.04)",color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box"}} onFocus={e=>{e.target.style.borderColor="rgba(249,115,22,.5)";}} onBlur={e=>{e.target.style.borderColor="rgba(249,115,22,.2)";}}/>
          <svg style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",opacity:.4,pointerEvents:"none"}} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        {!data&&<div style={{display:"flex",justifyContent:"center",padding:"28px 0"}}><Spin sz={20}/></div>}
        {data&&<div style={{display:"grid",gridTemplateColumns:mob()?"1fr":"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
          {filtered.slice(0,18).map((r,i)=>{const name=r.registrant_name||r.name||"Unknown";const country=r.country||r.registrant_country||"N/A";return(
            <div key={i} style={{background:"rgba(249,115,22,.04)",border:"1px solid rgba(249,115,22,.12)",borderRadius:14,padding:18,position:"relative",overflow:"hidden",animation:"fadeUp .4s ease "+i*.04+"s both",transition:"border-color .2s,transform .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(249,115,22,.4)";e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(249,115,22,.12)";e.currentTarget.style.transform="none";}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"#f97316"}}/>
              <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0",lineHeight:1.5,marginBottom:6}}>{name}</div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:10,fontWeight:700,background:"rgba(249,115,22,.12)",color:"#f97316",padding:"2px 8px",borderRadius:5}}>{country}</span>
              </div>
              {r.registration_date&&<div style={{fontSize:9,color:"rgba(255,255,255,.2)",marginTop:8}}>Registered: {r.registration_date}</div>}
            </div>
          );})}
        </div>}
        {data&&filtered.length===0&&q.length>1&&<div style={{textAlign:"center",color:"rgba(255,255,255,.3)",fontSize:13,padding:"20px 0"}}>No registrants match "{q}"</div>}
      </CW>
    </div>
  );
}

/* ── SPENDING SECTION ────────────────── */
function SpendingSection(){
  const[agencies,setAgencies]=useState([]);
  useEffect(()=>{USA_AGENCIES.then(setAgencies).catch(()=>{});},[]);
  const top10=agencies.slice(0,10);
  const maxBudget=top10.length>0?Math.max(...top10.map(a=>a.budget_authority_amount||0)):1;
  const totalTracked=top10.reduce((s,a)=>s+(a.budget_authority_amount||0),0);
  return(
    <div style={{background:"linear-gradient(180deg,#07030f,#060d0a)",padding:"60px 0"}}>
      <CW>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:10,fontWeight:700,color:"rgba(16,185,129,.6)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>USASpending.gov API · live</div>
          <h2 style={{fontSize:mob()?22:30,fontWeight:900,color:"#fff",margin:0,letterSpacing:-1}}>Federal Agency Spending</h2>
          {totalTracked>0&&<span style={{display:"inline-block",marginTop:10,fontSize:10,fontWeight:700,background:"rgba(16,185,129,.1)",color:"#10b981",border:"1px solid rgba(16,185,129,.25)",padding:"4px 14px",borderRadius:100}}>${(totalTracked/1e9).toFixed(1)}B total tracked</span>}
        </div>
        {!top10.length&&<div style={{display:"flex",justifyContent:"center",padding:"28px 0"}}><Spin sz={20}/></div>}
        {top10.length>0&&<div style={{maxWidth:700,margin:"0 auto"}}>
          {top10.map((a,i)=>{const pct=((a.budget_authority_amount||0)/maxBudget)*100;const name=a.agency_name||a.name||"Agency";const amt=a.budget_authority_amount||0;return(
            <div key={i} style={{marginBottom:12,animation:"fadeUp .4s ease "+i*.06+"s both"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:12,fontWeight:700,color:"#e2e8f0",maxWidth:"60%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>
                <span style={{fontSize:11,fontWeight:800,color:"#10b981"}}>${(amt/1e9).toFixed(1)}B</span>
              </div>
              <div style={{width:"100%",height:10,borderRadius:6,background:"rgba(16,185,129,.08)",overflow:"hidden"}}>
                <div style={{width:pct+"%",height:"100%",borderRadius:6,background:"linear-gradient(90deg,#10b981,#34d399)",transition:"width .8s ease"}}/>
              </div>
            </div>
          );})}
        </div>}
      </CW>
    </div>
  );
}

/* ── TRADING TIMELINE (D3 Scatter) ───── */
function TradingTimeline({trades}){
  const svgRef=useRef(null);const containerRef=useRef(null);
  const[dims,setDims]=useState({w:800,h:400});
  useEffect(()=>{
    if(!containerRef.current)return;
    const ro=new ResizeObserver(entries=>{for(const e of entries){setDims({w:e.contentRect.width,h:Math.min(420,Math.max(280,e.contentRect.width*.45))})}});
    ro.observe(containerRef.current);return()=>ro.disconnect();
  },[]);
  useEffect(()=>{
    if(!svgRef.current||!(trades||[]).length)return;
    const valid=(trades||[]).filter(t=>t.tradeDate&&t.gap!=null&&!isNaN(new Date(t.tradeDate)));
    if(!valid.length)return;
    const margin={top:20,right:30,bottom:40,left:50};
    const w=dims.w-margin.left-margin.right;
    const h=dims.h-margin.top-margin.bottom;
    const svg=d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width",dims.w).attr("height",dims.h);
    const g=svg.append("g").attr("transform",`translate(${margin.left},${margin.top})`);
    const xScale=d3.scaleTime().domain(d3.extent(valid,d=>new Date(d.tradeDate))).range([0,w]);
    const yScale=d3.scaleLinear().domain([0,d3.max(valid,d=>d.gap)||90]).range([h,0]);
    // grid
    g.append("g").attr("transform",`translate(0,${h})`).call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.timeFormat("%b '%y"))).selectAll("text").attr("fill","rgba(255,255,255,.3)").attr("font-size",9);
    g.append("g").call(d3.axisLeft(yScale).ticks(5)).selectAll("text").attr("fill","rgba(255,255,255,.3)").attr("font-size",9);
    g.selectAll(".domain,.tick line").attr("stroke","rgba(255,255,255,.06)");
    // 45-day line
    g.append("line").attr("x1",0).attr("x2",w).attr("y1",yScale(45)).attr("y2",yScale(45)).attr("stroke","#ef4444").attr("stroke-dasharray","6,4").attr("stroke-width",1.5).attr("opacity",.6);
    g.append("text").attr("x",w-4).attr("y",yScale(45)-6).attr("text-anchor","end").attr("fill","#ef4444").attr("font-size",9).attr("font-weight",700).text("45-day STOCK Act limit");
    // dots
    g.selectAll("circle").data(valid).enter().append("circle")
      .attr("cx",d=>xScale(new Date(d.tradeDate)))
      .attr("cy",d=>yScale(d.gap))
      .attr("r",0)
      .attr("fill",d=>d.action==="BUY"?"#22c55e":"#ef4444")
      .attr("opacity",.7)
      .transition().duration(600).delay((_,i)=>i*3)
      .attr("r",4);
    // y-axis label
    g.append("text").attr("transform","rotate(-90)").attr("y",-38).attr("x",-h/2).attr("text-anchor","middle").attr("fill","rgba(255,255,255,.25)").attr("font-size",10).text("Filing gap (days)");
  },[trades,dims]);
  return(
    <div style={{background:"linear-gradient(180deg,#1e293b,#07030f)",padding:"60px 0"}}>
      <CW>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:10,fontWeight:700,color:"rgba(168,85,247,.6)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>D3.js · Trade Filing Analysis</div>
          <h2 style={{fontSize:mob()?22:30,fontWeight:900,color:"#fff",margin:0,letterSpacing:-1}}>Trading Timeline</h2>
          <div style={{display:"flex",gap:16,justifyContent:"center",marginTop:12}}>
            <span style={{fontSize:10,color:"rgba(255,255,255,.4)",display:"flex",alignItems:"center",gap:5}}><span style={{width:8,height:8,borderRadius:"50%",background:"#22c55e",display:"inline-block"}}/> Buy</span>
            <span style={{fontSize:10,color:"rgba(255,255,255,.4)",display:"flex",alignItems:"center",gap:5}}><span style={{width:8,height:8,borderRadius:"50%",background:"#ef4444",display:"inline-block"}}/> Sell</span>
            <span style={{fontSize:10,color:"rgba(255,255,255,.4)",display:"flex",alignItems:"center",gap:5}}><span style={{width:12,height:2,background:"#ef4444",display:"inline-block",borderTop:"1px dashed #ef4444"}}/> 45-day limit</span>
          </div>
        </div>
        <div ref={containerRef} style={{width:"100%",overflow:"hidden",borderRadius:14,background:"rgba(168,85,247,.03)",border:"1px solid rgba(168,85,247,.08)",padding:"16px 8px"}}>
          {!(trades||[]).length?<div style={{display:"flex",justifyContent:"center",padding:"40px 0"}}><Spin sz={20}/></div>:
          <svg ref={svgRef} style={{display:"block",margin:"0 auto"}}/>}
        </div>
      </CW>
    </div>
  );
}

/* ── INTEL FEED ───────────────────────── */
function IntelFeed({trades}){
  const buys=useMemo(()=>(trades||[]).filter(t=>t.action==="BUY"&&t.ticker).slice(0,10),[trades]);
  const sells=useMemo(()=>(trades||[]).filter(t=>t.action==="SELL"&&t.ticker).slice(0,10),[trades]);
  const violations=(trades||[]).filter(t=>t.gap>45).length;
  const highValue=(trades||[]).filter(t=>/500,000|1,000,000|5,000,001/.test(t.amount||"")).length;
  const uniqueTraders=new Set((trades||[]).map(t=>t.name)).size;
  const m=mob();
  return(
    <div style={{background:"linear-gradient(180deg,#1e1b4b,#1e293b)",padding:"60px 0"}}>
      <CW>
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:14,marginBottom:22}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}><div style={{width:7,height:7,borderRadius:"50%",background:"#6366f1",animation:"pulseDot 2s infinite"}}/><span style={{fontSize:9,fontWeight:700,color:"rgba(99,102,241,.7)",textTransform:"uppercase",letterSpacing:1.5}}>Senate STOCK Act Disclosures</span></div>
            <h2 style={{fontSize:m?22:28,fontWeight:900,color:"#fff",margin:0,letterSpacing:-1}}>STOCK Act Intelligence Feed</h2>
          </div>
          {(trades||[]).length>0&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {violations>0&&<span style={{fontSize:10,background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.3)",color:"#fca5a5",padding:"4px 12px",borderRadius:100,fontWeight:700}}>🚨 {violations} violations</span>}
            {highValue>0&&<span style={{fontSize:10,background:"rgba(168,85,247,.1)",border:"1px solid rgba(168,85,247,.3)",color:"#c4b5fd",padding:"4px 12px",borderRadius:100,fontWeight:700}}>💎 {highValue} high-value</span>}
            <span style={{fontSize:10,background:"rgba(34,197,94,.06)",border:"1px solid rgba(34,197,94,.2)",color:"#4ade80",padding:"4px 12px",borderRadius:100,fontWeight:700}}>{(trades||[]).length} trades · {uniqueTraders} officials</span>
          </div>}
        </div>
        {!(trades||[]).length&&<div style={{display:"flex",alignItems:"center",gap:10,color:"rgba(255,255,255,.25)",fontSize:13,padding:"16px 0"}}><Spin sz={14}/>Loading trade data...</div>}
        {(trades||[]).length>0&&(
          <div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr",gap:14}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:"#4ade80",textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>📈 Recent Buys ({buys.length})</div>
              {buys.map((t,i)=>(
                <div key={i} style={{background:"rgba(34,197,94,.05)",border:"1px solid rgba(34,197,94,.15)",borderRadius:10,padding:14,marginBottom:8,animation:"slideIn .3s ease "+i*.05+"s both"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                    <span style={{fontSize:14,fontWeight:900,color:"#fff"}}>{t.ticker}</span>
                    <span style={{fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:3,background:"rgba(34,197,94,.15)",color:"#4ade80"}}>BUY</span>
                    {/500,000|1,000,000|5,000,001/.test(t.amount||"")&&<Tag label="HIGH VALUE" color="#a855f7"/>}
                    <span style={{marginLeft:"auto",fontSize:10,color:"rgba(255,255,255,.3)"}}>{t.tradeDate}</span>
                  </div>
                  <div style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,.7)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.28)",marginTop:3}}>{t.amount} · {t.source}{t.description?" · "+t.description.slice(0,40):""}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:"#f87171",textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>📉 Recent Sells ({sells.length})</div>
              {sells.map((t,i)=>(
                <div key={i} style={{background:"rgba(239,68,68,.04)",border:"1px solid rgba(239,68,68,.12)",borderRadius:10,padding:14,marginBottom:8,animation:"slideIn .3s ease "+i*.05+"s both"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                    <span style={{fontSize:14,fontWeight:900,color:"#fff"}}>{t.ticker}</span>
                    <span style={{fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:3,background:"rgba(239,68,68,.15)",color:"#f87171"}}>SELL</span>
                    {/500,000|1,000,000|5,000,001/.test(t.amount||"")&&<Tag label="HIGH VALUE" color="#a855f7"/>}
                    <span style={{marginLeft:"auto",fontSize:10,color:"rgba(255,255,255,.3)"}}>{t.tradeDate}</span>
                  </div>
                  <div style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,.7)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.28)",marginTop:3}}>{t.amount} · {t.source}{t.description?" · "+t.description.slice(0,40):""}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CW>
    </div>
  );
}

/* ── PROFILE PAGE ─────────────────────── */
function ProfilePage({pol,onBack,user,onSetUser}){
  const[tab,setTab]=useState("overview");const m=mob();
  const[localFEC,setLFEC]=useState(null);const[fecLoading,setFL]=useState(false);
  const[trades,setTrades]=useState([]);const[donors,setDonors]=useState([]);const[bills,setBills]=useState([]);const[loading,setL]=useState(true);
  const[note,setNote]=useState("");const[showNote,setShowNote]=useState(false);
  // NEW FEC deep-data states
  const[disbursements,setDisbursements]=useState([]);
  const[scheduleE,setScheduleE]=useState([]);
  const[candHistory,setCandHistory]=useState([]);
  const[committees,setCommittees]=useState([]);
  const[electionRace,setElectionRace]=useState([]);
  const[candDetail,setCandDetail]=useState(null);
  const isWatched=user&&user.watchlist&&user.watchlist.includes(pol.id);
  const toggleWatch=async()=>{if(!user)return;const wl=isWatched?user.watchlist.filter(x=>x!==pol.id):[...user.watchlist,pol.id];const updated=await updateUser(user.id,{watchlist:wl});if(onSetUser&&updated)onSetUser(updated);};
  const saveNote=async()=>{if(!user)return;const notes={...((user.notes||{})),[pol.id]:note};const updated=await updateUser(user.id,{notes});if(onSetUser&&updated)onSetUser(updated);setShowNote(false);};
  useEffect(()=>{
    setNote((user&&user.notes&&user.notes[pol.id])||"");
    setL(true);
    tradesFor(pol.name).then(t=>{setTrades(t);setL(false);});
    if(pol.bioguideId)fetchBills(pol.bioguideId).then(setBills);
    // Always try fetchByName if no fecId — regardless of hasRealFinancials
    if(!pol.fecId&&!localFEC&&!fecLoading){
      setFL(true);
      fetchByName(pol.name,pol.state,pol.chamber).then(r=>{
        if(r){
          const fid=r.candidate_id;
          setLFEC({fecId:fid,fecUrl:fid?"https://www.fec.gov/data/candidate/"+fid+"/":"",raised:r.receipts||0,spent:r.disbursements||0,cash:r.cash_on_hand_end_period||0});
        }
        setFL(false);
      });
    }
    if(pol.fecId){fetchDonors(pol.fecId).then(setDonors);}
  },[pol.name]);

  // Load deep FEC data whenever fecId resolves (from pol or from name lookup)
  useEffect(()=>{
    const fid=pol.fecId||(localFEC&&localFEC.fecId);
    if(!fid)return;
    fetchDonors(fid).then(setDonors);
    fetchScheduleB(fid).then(setDisbursements);
    fetchScheduleE(fid).then(setScheduleE);
    fetchCandidateHistory(fid).then(setCandHistory);
    fetchCandidateCommittees(fid).then(setCommittees);
    fetchCandidateDetail(fid).then(setCandDetail);
    fetchElectionSummary(pol.state,pol.chamber,2026).then(setElectionRace);
  },[pol.fecId,localFEC]);

  const fecId=pol.fecId||(localFEC&&localFEC.fecId)||null;
  const fecUrl=pol.fecUrl||(localFEC&&localFEC.fecUrl)||"";
  const raised=pol.raised||(localFEC&&localFEC.raised)||0;
  const spent=pol.spent||(localFEC&&localFEC.spent)||0;
  const cash=pol.cash||(localFEC&&localFEC.cash)||0;
  const risk=calcRisk(trades,raised);const rC=riskColor(risk);
  const violations=trades.filter(t=>t.gap>45).length;
  const byInd=useMemo(()=>{if(!donors||!donors.length)return{};const m2={};donors.forEach(d=>{const ind=classifyPAC(d.contributor_name);if(!m2[ind])m2[ind]={name:ind,color:IC[ind]||"#94a3b8",total:0};m2[ind].total+=(d.contribution_receipt_amount||0);});return m2;},[donors]);
  const inds=Object.values(byInd).sort((a,b)=>b.total-a.total);const maxV=inds[0]&&inds[0].total||1;
  const sectors=useMemo(()=>{const m2={};trades.forEach(t=>{if(!t.ticker)return;m2[t.ticker]=(m2[t.ticker]||0)+1;});return Object.entries(m2).sort((a,b)=>b[1]-a[1]).slice(0,8);},[trades]);
  const[aiRes,setAI]=useState("");const[aiLoad,setAIL]=useState(false);const[aiErr,setAIE]=useState("");
  const runAI=async()=>{
    setAIL(true);setAIE("");
    const tStr=trades.slice(0,8).map(t=>`- ${t.ticker||"N/A"} ${t.action} ${t.amount} (${t.gap}d gap) ${t.tradeDate}`).join("\n");
    const disbStr=disbursements.slice(0,5).map(d=>`- ${d.recipient_name||"?"}: ${fmt(d.disbursement_amount||0)} (${d.disbursement_description||"--"})`).join("\n");
    const ieStr=scheduleE.slice(0,4).map(e=>`- ${e.committee_name||"?"}: ${fmt(e.expenditure_amount||0)} ${e.support_oppose_indicator==="S"?"FOR":"AGAINST"}`).join("\n");
    try{const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:900,messages:[{role:"user",content:`Congressional intelligence briefing for ${pol.name} (${PL[pol.party]}, ${pol.chamber}, ${pol.state})\n\nFEC FINANCE:\nRaised: ${fmt(raised)} | Spent: ${fmt(spent)} | Cash: ${fmt(cash)}\n\nTOP DISBURSEMENTS (Schedule B - where they spend):\n${disbStr||"No data"}\n\nINDEPENDENT EXPENDITURES (Schedule E - outside groups):\n${ieStr||"No data"}\n\nSTOCK ACT: ${trades.length} trades, ${violations} violations\n${tStr||"None"}\n\nProvide:\nFINANCIAL_PROFILE: [campaign finance + spending pattern analysis]\nTRADING_ANALYSIS: [STOCK Act behavior]\nOUTSIDE_MONEY: [who is spending to help/hurt them via Schedule E]\nTRANSPARENCY_GRADE: [A-F]\nINVESTIGATION_PRIORITIES: [2-3 angles]\n\nFacts only.`}]})});const j=await r.json();setAI(j.content&&j.content.map(b=>b.text||"").join("")||"");}catch(e){setAIE(e.message);}
    setAIL(false);
  };
  const sec=(t,k)=>{const m=t.match(new RegExp(k+":[ \t]*(.+?)(?=\n[A-Z_]+:|$)","s"));return m?m[1].trim():null;};
  const TABS=[{id:"overview",l:"FEC Overview"},{id:"money",l:"Deep Finance"},{id:"trades",l:"Trades",hot:violations>0},{id:"bills",l:"Legislation"},{id:"ai",l:"AI Briefing",ai:true}];
  const ds={background:"rgba(168,85,247,.04)",border:"1px solid rgba(168,85,247,.12)",borderRadius:14,padding:22};
  return(
    <div style={{background:"#0f172a",minHeight:"100vh",paddingBottom:60}}>
      <CW pad="0 28px">
        <div style={{padding:"16px 0",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <button onClick={onBack} style={{background:"rgba(168,85,247,.08)",border:"1px solid rgba(168,85,247,.2)",cursor:"pointer",color:"#a78bfa",fontWeight:700,fontSize:12,padding:"7px 14px",borderRadius:8}}>← Back</button>
          {user&&<button onClick={toggleWatch} style={{background:isWatched?"rgba(239,68,68,.1)":"rgba(16,185,129,.1)",border:"1px solid "+(isWatched?"rgba(239,68,68,.3)":"rgba(16,185,129,.3)"),color:isWatched?"#f87171":"#34d399",fontWeight:700,fontSize:12,padding:"7px 14px",borderRadius:8,cursor:"pointer"}}>{isWatched?"✕ Unwatch":"+ Watch"}</button>}
          {user&&<button onClick={()=>setShowNote(!showNote)} style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",color:"rgba(255,255,255,.5)",fontWeight:700,fontSize:12,padding:"7px 14px",borderRadius:8,cursor:"pointer"}}>📝 {(user.notes&&user.notes[pol.id])?"Edit Note":"Add Note"}</button>}
          <a href={`https://www.fec.gov/data/candidate/${fecId||""}/`} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"rgba(16,185,129,.7)",textDecoration:"none",border:"1px solid rgba(16,185,129,.2)",padding:"7px 14px",borderRadius:8}}>FEC.gov ↗</a>
          {pol.congressUrl&&<a href={pol.congressUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"rgba(255,255,255,.35)",textDecoration:"none",border:"1px solid rgba(255,255,255,.08)",padding:"7px 14px",borderRadius:8}}>Congress.gov ↗</a>}
        </div>
        {showNote&&user&&(
          <div style={{background:"rgba(168,85,247,.08)",border:"1px solid rgba(168,85,247,.25)",borderRadius:12,padding:16,marginBottom:14}}>
            <div style={{fontSize:12,color:"#a78bfa",fontWeight:700,marginBottom:8}}>Investigation note — {pol.name}</div>
            <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Add notes, observations, leads..." rows={3} style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(168,85,247,.2)",borderRadius:8,color:"#fff",fontSize:12,padding:"10px 12px",outline:"none",resize:"vertical",boxSizing:"border-box"}}/>
            <div style={{display:"flex",gap:8,marginTop:8}}><button onClick={saveNote} style={{background:"rgba(168,85,247,.2)",color:"#a78bfa",border:"none",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Save</button><button onClick={()=>setShowNote(false)} style={{background:"none",color:"rgba(255,255,255,.3)",border:"none",fontSize:12,cursor:"pointer"}}>Cancel</button></div>
          </div>
        )}
        {/* Profile header */}
        <div style={{background:"linear-gradient(135deg,#1e1b4b,#1e293b)",border:"1px solid rgba(168,85,247,.15)",borderRadius:20,padding:m?"18px":"24px",marginBottom:16,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${PC[pol.party]},transparent)`}}/>
          <div style={{display:"flex",gap:18,alignItems:"flex-start",flexWrap:"wrap"}}>
            <Avatar pol={pol} size={m?52:68} ring="#a78bfa"/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}>
                <h2 style={{fontSize:m?18:24,fontWeight:900,color:"#fff",margin:0}}>{pol.name}</h2>
                <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:5,background:PC[pol.party]+"20",color:PC[pol.party],border:"1px solid "+PC[pol.party]+"40"}}>{PL[pol.party]}</span>
                <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:4,background:rC+"18",color:rC}}>RISK {risk}/100</span>
                {violations>0&&<span style={{fontSize:9,fontWeight:800,padding:"2px 9px",borderRadius:4,background:"rgba(239,68,68,.15)",color:"#f87171",border:"1px solid rgba(239,68,68,.3)"}}>🚨 {violations} VIOLATION{violations>1?"S":""}</span>}
                {isWatched&&<span style={{fontSize:9,color:"#34d399",padding:"2px 9px",background:"rgba(16,185,129,.1)",borderRadius:4}}>✓ Watching</span>}
                {candDetail&&candDetail.candidate_status&&<span style={{fontSize:9,color:"#a78bfa",padding:"2px 9px",background:"rgba(168,85,247,.1)",borderRadius:4}}>{candDetail.candidate_status==="C"?"✓ Certified":"Candidate"}</span>}
              </div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.3)",marginBottom:14}}>{pol.chamber} · {pol.state}{fecId&&" | FEC: "+fecId}{candDetail&&candDetail.incumbent_challenge_full&&" | "+candDetail.incumbent_challenge_full}</div>
              <div style={{display:"grid",gridTemplateColumns:m?"1fr 1fr":"repeat(5,1fr)",gap:8,marginBottom:12}}>
                {[["Raised",fmt(raised),raised>0,"#10b981"],["Spent",fmt(spent),spent>0,"#ef4444"],["Cash",fmt(cash),cash>0,"#3b82f6"],["Trades",loading?"…":trades.length,trades.length>0,"#a78bfa"],["Violations",loading?"…":violations,violations>0,"#ef4444"]].map(([l,v,ok,c],i)=>(
                  <div key={i} style={{background:"rgba(255,255,255,.05)",borderRadius:10,padding:"10px 12px"}}>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.25)",textTransform:"uppercase",letterSpacing:.4,marginBottom:4}}>{l}</div>
                    <div style={{fontSize:m?12:14,fontWeight:700,color:ok?(i===4?"#ef4444":c):"rgba(255,255,255,.18)"}}>{v||"--"}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Tabs */}
        <div style={{display:"flex",gap:2,background:"rgba(168,85,247,.06)",border:"1px solid rgba(168,85,247,.12)",padding:4,borderRadius:12,marginBottom:18,overflowX:"auto"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"8px 14px",borderRadius:9,border:"none",background:tab===t.id?"rgba(168,85,247,.2)":"transparent",color:tab===t.id?"#a78bfa":"rgba(255,255,255,.35)",fontWeight:700,fontSize:10,cursor:"pointer",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5,flexShrink:0,position:"relative"}}>
              {t.hot&&tab!==t.id&&<div style={{position:"absolute",top:4,right:4,width:6,height:6,borderRadius:"50%",background:"#ef4444",animation:"pulseDot 2s infinite"}}/>}
              {t.l}{t.ai&&<span style={{fontSize:7,background:"#6366f1",color:"#fff",padding:"1px 4px",borderRadius:2}}>AI</span>}
            </button>
          ))}
        </div>
        {/* ── OVERVIEW TAB ── */}
        {tab==="overview"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {raised>0&&<div style={{...ds}}>
              <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:4}}>FEC Campaign Finance Summary</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginBottom:16}}>OpenFEC /candidates/totals/ · live</div>
              {[["Total Raised",fmt(raised),"#10b981",100],["Total Spent",fmt(spent),"#ef4444",raised>0?Math.min(100,Math.round(spent/raised*100)):0],["Cash on Hand",fmt(cash),"#3b82f6",raised>0?Math.min(100,Math.round(cash/raised*100)):0]].map(([l,v,c,p])=>(
                <div key={l} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5}}><span style={{color:"rgba(255,255,255,.4)"}}>{l}</span><span style={{fontWeight:700,color:"#fff"}}>{v}</span></div>
                  <div style={{height:7,borderRadius:4,background:"rgba(255,255,255,.06)",overflow:"hidden"}}><div style={{height:"100%",width:p+"%",background:c,borderRadius:4,transition:"width 1.2s"}}/></div>
                </div>
              ))}
              {candDetail&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginTop:14,paddingTop:14,borderTop:"1px solid rgba(255,255,255,.06)"}}>
                {[["First Election",candDetail.first_file_date||"--","#a78bfa"],["Party",candDetail.party_full||PL[pol.party],"#3b82f6"],["District",candDetail.district||pol.state,"#10b981"]].map(([l,v,c])=>(
                  <div key={l} style={{background:"rgba(255,255,255,.04)",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.25)",textTransform:"uppercase",marginBottom:4}}>{l}</div>
                    <div style={{fontSize:11,fontWeight:700,color:c,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</div>
                  </div>
                ))}
              </div>}
            </div>}
            {/* PAC Industry Breakdown */}
            {inds.length>0&&<div style={{...ds}}>
              <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:4}}>PAC Industry Breakdown</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginBottom:16}}>FEC /schedules/schedule_a/ · committee contributions</div>
              {inds.map(ind=>(
                <div key={ind.name} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:ind.color,flexShrink:0}}/>
                  <div style={{width:80,fontSize:11,color:"rgba(255,255,255,.5)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ind.name}</div>
                  <div style={{flex:1,height:14,borderRadius:3,background:"rgba(255,255,255,.05)",overflow:"hidden"}}><div style={{height:"100%",width:((ind.total/maxV)*100)+"%",background:ind.color,opacity:.8,borderRadius:3,transition:"width 1.2s"}}/></div>
                  <div style={{fontSize:12,fontWeight:700,color:"#e2e8f0",minWidth:56,textAlign:"right"}}>{fmt(ind.total)}</div>
                </div>
              ))}
              {donors.slice(0,5).map((d,i)=>{const ind=classifyPAC(d.contributor_name);return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:9,marginBottom:6,padding:"8px 12px",background:i===0?"rgba(16,185,129,.06)":"rgba(255,255,255,.02)",borderRadius:9,border:"1px solid rgba(255,255,255,.06)"}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:IC[ind]||"#94a3b8",flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.contributor_name}</div><div style={{fontSize:9,color:"rgba(255,255,255,.3)"}}>{ind} · {d.contributor_state||"--"}</div></div>
                  <div style={{fontSize:12,fontWeight:700,color:"#10b981"}}>{fmt(d.contribution_receipt_amount)}</div>
                </div>
              );})}
            </div>}
            {/* Trading portfolio */}
            {sectors.length>0&&<div style={{...ds}}>
              <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:14}}>STOCK Act Trading Portfolio</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {sectors.map(([ticker,cnt])=><div key={ticker} style={{background:"rgba(168,85,247,.12)",border:"1px solid rgba(168,85,247,.2)",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
                  <div style={{fontSize:14,fontWeight:900,color:"#a78bfa"}}>{ticker}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.35)",marginTop:2}}>{cnt}x disclosed</div>
                </div>)}
              </div>
            </div>}
          </div>
        )}
        {/* ── DEEP FINANCE TAB (new) ── */}
        {tab==="money"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {/* Election Cycle History */}
            {candHistory.length>0&&<div style={{...ds}}>
              <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:4}}>Election Cycle History</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginBottom:14}}>FEC /candidate/{"{id}"}/history/ · all cycles on record</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {candHistory.slice(0,6).map((h,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"rgba(255,255,255,.03)",borderRadius:10,border:"1px solid rgba(255,255,255,.06)"}}>
                    <span style={{fontSize:14,fontWeight:900,color:"#a78bfa",minWidth:40}}>{h.two_year_period}</span>
                    <span style={{fontSize:10,background:PC[pol.party]+"18",color:PC[pol.party],padding:"2px 8px",borderRadius:4,fontWeight:700}}>{h.office}</span>
                    <span style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>{h.state}{h.district?" Dist. "+h.district:""}</span>
                    <span style={{marginLeft:"auto",fontSize:10,fontWeight:700,color:h.candidate_status==="C"?"#10b981":"#94a3b8"}}>{h.incumbent_challenge_full||h.candidate_status}</span>
                  </div>
                ))}
              </div>
            </div>}
            {/* Schedule B — Disbursements */}
            {disbursements.length>0&&<div style={{...ds}}>
              <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:4}}>Disbursements — Where Money Was Spent</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginBottom:14}}>FEC /schedules/schedule_b/ · top outgoing payments</div>
              {disbursements.slice(0,10).map((d,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<disbursements.length-1?"1px solid rgba(255,255,255,.05)":"none"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.recipient_name||"Unknown"}</div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginTop:2}}>{d.disbursement_description||"--"} · {d.disbursement_date||"--"}</div>
                  </div>
                  <span style={{fontSize:13,fontWeight:800,color:"#ef4444",flexShrink:0,whiteSpace:"nowrap"}}>{fmt(d.disbursement_amount||0)}</span>
                </div>
              ))}
              <div style={{marginTop:10,fontSize:10,color:"rgba(255,255,255,.2)"}}>Total shown: {fmt(disbursements.reduce((a,d)=>a+(d.disbursement_amount||0),0))}</div>
            </div>}
            {/* Schedule E — Independent Expenditures */}
            {scheduleE.length>0&&<div style={{...ds}}>
              <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:4}}>Independent Expenditures (Schedule E)</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginBottom:14}}>FEC /schedules/schedule_e/ · outside groups spending FOR or AGAINST this candidate</div>
              {scheduleE.slice(0,8).map((e,i)=>{const isFor=e.support_oppose_indicator==="S";return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:isFor?"rgba(16,185,129,.05)":"rgba(239,68,68,.05)",border:"1px solid "+(isFor?"rgba(16,185,129,.15)":"rgba(239,68,68,.15)"),borderRadius:10,marginBottom:7}}>
                  <div style={{width:4,height:32,borderRadius:2,background:isFor?"#4ade80":"#f87171",flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.committee_name||"Unknown Committee"}</div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginTop:2}}>{e.expenditure_description||"--"} · {e.expenditure_date||"--"}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:13,fontWeight:800,color:isFor?"#4ade80":"#f87171"}}>{fmt(e.expenditure_amount||0)}</div>
                    <div style={{fontSize:9,fontWeight:700,color:isFor?"#34d399":"#fca5a5",marginTop:2}}>{isFor?"FOR":"AGAINST"}</div>
                  </div>
                </div>
              );})}
            </div>}
            {/* Linked Committees */}
            {committees.length>0&&<div style={{...ds}}>
              <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:4}}>Linked Committees</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginBottom:14}}>FEC /candidate/{"{id}"}/committee/ · PACs and campaign committees</div>
              {committees.slice(0,6).map((c,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<committees.length-1?"1px solid rgba(255,255,255,.05)":"none"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name||c.committee_name||"--"}</div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginTop:2}}>{c.committee_type_full||c.designation_full||"Committee"} · {c.state||pol.state}</div>
                  </div>
                  <a href={`https://www.fec.gov/data/committee/${c.committee_id||c.id||""}/`} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:"#a78bfa",textDecoration:"none",flexShrink:0}}>FEC ↗</a>
                </div>
              ))}
            </div>}
            {/* Election Race Context */}
            {electionRace.length>0&&<div style={{...ds}}>
              <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:4}}>{pol.state} {pol.chamber} Race — 2026 Field</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginBottom:14}}>FEC /elections/summary/ · all candidates in the same race</div>
              {electionRace.slice(0,6).map((e,i)=>{const isThis=e.candidate_name&&pol.name.toLowerCase().includes(e.candidate_name.toLowerCase().split(",")[0].toLowerCase().trim());return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:isThis?"rgba(168,85,247,.08)":"rgba(255,255,255,.02)",border:"1px solid "+(isThis?"rgba(168,85,247,.25)":"rgba(255,255,255,.05)"),borderRadius:10,marginBottom:6}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:e.party_full&&e.party_full.includes("Rep")?"#ef4444":e.party_full&&e.party_full.includes("Dem")?"#3b82f6":"#8b5cf6",flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:isThis?700:400,color:isThis?"#a78bfa":"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.candidate_name||"Unknown"}{isThis?" (this official)":""}</div><div style={{fontSize:10,color:"rgba(255,255,255,.3)"}}>{e.party_full||"--"}</div></div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#10b981"}}>{fmt(e.total_receipts||0)}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.2)"}}>raised</div>
                  </div>
                </div>
              );})}
            </div>}
            {!disbursements.length&&!scheduleE.length&&!candHistory.length&&(
              <div style={{...ds,textAlign:"center",padding:32}}>
                <div style={{fontSize:14,color:"rgba(255,255,255,.3)",marginBottom:8}}>{fecId?"Loading deep FEC data...":"No FEC ID available"}</div>
                {fecId&&<Spin sz={20}/>}
                {!fecId&&<div style={{fontSize:12,color:"rgba(255,255,255,.2)"}}>FEC endpoints require a matched candidate ID. Try searching for this official directly at fec.gov.</div>}
              </div>
            )}
          </div>
        )}
        {/* ── TRADES TAB ── */}
        {tab==="trades"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:"rgba(168,85,247,.05)",border:"1px solid rgba(168,85,247,.12)",borderRadius:14,padding:20}}>
              <div style={{display:"flex",gap:14,alignItems:"center",flexWrap:"wrap",marginBottom:14}}>
                <div style={{width:64,height:64,borderRadius:"50%",background:`conic-gradient(${rC} ${risk*3.6}deg,rgba(255,255,255,.05) 0deg)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <div style={{width:50,height:50,borderRadius:"50%",background:"#0f172a",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column"}}><div style={{fontSize:16,fontWeight:900,color:rC,lineHeight:1}}>{risk}</div><div style={{fontSize:7,color:"rgba(255,255,255,.25)"}}>RISK</div></div>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:rC,marginBottom:4}}>{riskLabel(risk)} RISK · {trades.length} disclosures · {violations} violation{violations!==1?"s":""}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>HouseStockWatcher + SenateStockWatcher · gap = transaction → disclosure date</div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  {[["Buys",trades.filter(t=>t.action==="BUY").length,"#4ade80"],["Sells",trades.filter(t=>t.action==="SELL").length,"#f87171"],["Violations",violations,"#ef4444"]].map(([l,v,c])=>(
                    <div key={l} style={{background:"rgba(255,255,255,.04)",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.25)",textTransform:"uppercase",marginBottom:2}}>{l}</div>
                      <div style={{fontSize:16,fontWeight:900,color:v>0?c:"rgba(255,255,255,.15)"}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{background:"rgba(168,85,247,.04)",border:"1px solid rgba(168,85,247,.1)",borderRadius:14,padding:20}}>
              {loading&&<div style={{display:"flex",gap:8,alignItems:"center",color:"rgba(255,255,255,.35)",fontSize:13,padding:"16px 0"}}><Spin sz={14}/>Loading STOCK Act disclosures...</div>}
              {!loading&&!trades.length&&<div style={{color:"rgba(255,255,255,.25)",fontSize:13,padding:"20px 0",textAlign:"center"}}>No STOCK Act disclosures found for "{pol.name}".</div>}
              {!loading&&trades.slice(0,25).map((t,i)=>{const flag=flagTrade(t);return(
                <div key={i} style={{background:flag?"rgba(255,255,255,.05)":"rgba(255,255,255,.02)",border:"1px solid "+(flag?flag.color+"44":"rgba(255,255,255,.07)"),borderRadius:9,padding:11,display:"flex",alignItems:"center",gap:9,flexWrap:"wrap",marginBottom:6,animation:"slideIn .3s ease "+i*.03+"s both"}}>
                  <div style={{width:3,height:28,borderRadius:2,background:t.action==="BUY"?"#4ade80":"#f87171",flexShrink:0}}/>
                  <div style={{minWidth:44}}><div style={{fontSize:13,fontWeight:900,color:"#fff"}}>{t.ticker||"🏢"}</div>{t.description&&<div style={{fontSize:7,color:"rgba(255,255,255,.2)",marginTop:1}}>{t.description.slice(0,18)}</div>}</div>
                  <span style={{fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:4,background:t.action==="BUY"?"rgba(34,197,94,.15)":"rgba(239,68,68,.15)",color:t.action==="BUY"?"#4ade80":"#f87171"}}>{t.action}</span>
                  <span style={{fontSize:11,color:"rgba(255,255,255,.45)"}}>{t.amount}</span>
                  <span style={{fontSize:9,color:"rgba(255,255,255,.25)"}}>Traded: {t.tradeDate} | Filed: {t.filedDate}</span>
                  <span style={{marginLeft:"auto",fontSize:11,fontWeight:800,color:gapC(t.gap)}}>{t.gap>0?t.gap+"d":"same day"}</span>
                  {flag&&<Tag label={flag.badge} color={flag.color}/>}
                </div>
              );})}
            </div>
          </div>
        )}
        {/* ── BILLS TAB ── */}
        {tab==="bills"&&(
          <div style={{...ds}}>
            <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:4}}>Sponsored Legislation</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginBottom:16}}>Congress.gov API · {bills.length} bills</div>
            {!pol.bioguideId&&<div style={{fontSize:13,color:"rgba(255,255,255,.3)"}}>No Bioguide ID — Congress.gov unavailable.</div>}
            {bills.length===0&&pol.bioguideId&&<div style={{fontSize:13,color:"rgba(255,255,255,.3)"}}>No sponsored legislation found.</div>}
            {bills.slice(0,8).map((l,i)=>(
              <div key={i} style={{padding:"10px 0",borderBottom:i<bills.length-1?"1px solid rgba(255,255,255,.06)":"none",display:"flex",gap:10,alignItems:"flex-start"}}>
                <span style={{fontSize:9,fontWeight:700,background:"rgba(59,130,246,.15)",color:"#60a5fa",padding:"2px 6px",borderRadius:3,flexShrink:0,marginTop:2}}>{l.type||"BILL"}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:"#e2e8f0",lineHeight:1.4}}>{(l.title||"").slice(0,100)}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.25)",marginTop:2}}>Introduced {l.introducedDate||"--"}{l.latestAction?" · "+l.latestAction.text.slice(0,60):""}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* ── AI TAB ── */}
        {tab==="ai"&&(
          <div>
            <div style={{background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.2)",borderRadius:9,padding:"10px 16px",marginBottom:14,fontSize:12,color:"#fbbf24"}}>
              Analysis includes: FEC Schedule A (donors) · Schedule B (disbursements) · Schedule E (independent expenditures) · STOCK Act disclosures.
            </div>
            {!aiRes&&!aiLoad&&<button onClick={runAI} style={{background:"linear-gradient(135deg,#6d28d9,#7c3aed)",color:"#fff",border:"none",borderRadius:12,padding:"14px 22px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%"}}>Generate Intelligence Briefing</button>}
            {aiLoad&&<div style={{display:"flex",alignItems:"center",gap:10,padding:20,justifyContent:"center",color:"rgba(255,255,255,.4)"}}><Spin sz={16} col="#a78bfa"/>Analyzing FEC + STOCK Act data...</div>}
            {aiErr&&<EBox msg={aiErr}/>}
            {aiRes&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[{k:"FINANCIAL_PROFILE",l:"Financial Profile",c:"#10b981"},{k:"TRADING_ANALYSIS",l:"Trading Analysis",c:"#f97316"},{k:"OUTSIDE_MONEY",l:"Outside Money (Schedule E)",c:"#f59e0b"},{k:"VIOLATION_ASSESSMENT",l:"Violation Assessment",c:"#ef4444"},{k:"TRANSPARENCY_GRADE",l:"Transparency Grade",c:"#a78bfa"},{k:"INVESTIGATION_PRIORITIES",l:"Investigation Priorities",c:"#6366f1"}].map(({k,l,c})=>{const content=sec(aiRes,k);if(!content)return null;return(
                <div key={k} style={{background:c+"08",border:"1px solid "+c+"25",borderRadius:10,padding:14}}>
                  <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,color:c,marginBottom:6}}>{l}</div>
                  <div style={{fontSize:13,color:"#e2e8f0",lineHeight:1.7}}>{content}</div>
                </div>
              );})}
              <button onClick={()=>setAI("")} style={{background:"none",border:"1px solid rgba(255,255,255,.08)",borderRadius:8,padding:"7px 14px",fontSize:11,color:"rgba(255,255,255,.3)",cursor:"pointer"}}>Regenerate</button>
            </div>}
          </div>
        )}
      </CW>
    </div>
  );
}
function _ProfilePageV6Unused({pol,onBack,user,onSetUser}){
  const[tab,setTab]=useState("overview");const m=mob();
  const[localFEC,setLFEC]=useState(null);const[fecLoading,setFL]=useState(false);
  const[trades,setTrades]=useState([]);const[donors,setDonors]=useState([]);const[bills,setBills]=useState([]);const[loading,setL]=useState(true);
  const[note,setNote]=useState("");const[showNote,setShowNote]=useState(false);
  const isWatched=user&&user.watchlist&&user.watchlist.includes(pol.id);
  const toggleWatch=async()=>{if(!user)return;const wl=isWatched?user.watchlist.filter(x=>x!==pol.id):[...user.watchlist,pol.id];const updated=await updateUser(user.id,{watchlist:wl});if(onSetUser&&updated)onSetUser(updated);};
  const saveNote=async()=>{if(!user)return;const notes={...((user.notes||{})),[pol.id]:note};const updated=await updateUser(user.id,{notes});if(onSetUser&&updated)onSetUser(updated);setShowNote(false);};
  useEffect(()=>{
    setNote((user&&user.notes&&user.notes[pol.id])||"");
    setL(true);
    tradesFor(pol.name).then(t=>{setTrades(t);setL(false);});
    if(pol.bioguideId)fetchBills(pol.bioguideId).then(setBills);
    if(!pol.hasRealFinancials&&!pol.fecId&&!localFEC&&!fecLoading){setFL(true);fetchByName(pol.name,pol.state,pol.chamber).then(r=>{if(r)setLFEC({fecId:r.candidate_id,fecUrl:"https://www.fec.gov/data/candidate/"+r.candidate_id+"/",raised:r.receipts||0,spent:r.disbursements||0,cash:r.cash_on_hand_end_period||0});setFL(false);});}
    const fid=pol.fecId;if(fid)fetchDonors(fid).then(setDonors);
  },[pol.name]);
  useEffect(()=>{const fid=pol.fecId||(localFEC&&localFEC.fecId);if(fid&&!donors.length)fetchDonors(fid).then(setDonors);},[localFEC]);
  const fecId=pol.fecId||(localFEC&&localFEC.fecId)||null;
  const fecUrl=pol.fecUrl||(localFEC&&localFEC.fecUrl)||"";
  const raised=pol.raised||(localFEC&&localFEC.raised)||0;
  const spent=pol.spent||(localFEC&&localFEC.spent)||0;
  const cash=pol.cash||(localFEC&&localFEC.cash)||0;
  const risk=calcRisk(trades,raised);const rC=riskColor(risk);
  const violations=trades.filter(t=>t.gap>45).length;
  const byInd=useMemo(()=>{if(!donors||!donors.length)return{};const m2={};donors.forEach(d=>{const ind=classifyPAC(d.contributor_name);if(!m2[ind])m2[ind]={name:ind,color:IC[ind]||"#94a3b8",total:0};m2[ind].total+=(d.contribution_receipt_amount||0);});return m2;},[donors]);
  const inds=Object.values(byInd).sort((a,b)=>b.total-a.total);const maxV=inds[0]&&inds[0].total||1;
  const sectors=useMemo(()=>{const m2={};trades.forEach(t=>{if(!t.ticker)return;m2[t.ticker]=(m2[t.ticker]||0)+1;});return Object.entries(m2).sort((a,b)=>b[1]-a[1]).slice(0,8);},[trades]);
  const[aiRes,setAI]=useState("");const[aiLoad,setAIL]=useState(false);const[aiErr,setAIE]=useState("");
  const runAI=async()=>{
    setAIL(true);setAIE("");
    const tStr=trades.slice(0,8).map(t=>`- ${t.ticker||"N/A"} ${t.action} ${t.amount} (${t.gap}d gap) ${t.tradeDate}`).join("\n");
    try{const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:900,messages:[{role:"user",content:`Congressional intelligence briefing for ${pol.name} (${PL[pol.party]}, ${pol.chamber}, ${pol.state})\nFEC: Raised ${fmt(raised)}, Spent ${fmt(spent)}, Cash ${fmt(cash)}\nSTOCK Act: ${trades.length} trades, ${violations} violations (>45d late)\n${tStr||"No trades found"}\n\nProvide:\nFINANCIAL_PROFILE: [fundraising & spending analysis]\nTRADING_ANALYSIS: [STOCK Act behavior, sectors, patterns]\nVIOLATION_ASSESSMENT: [legal exposure; if clean, confirm compliance]\nTRANSPARENCY_GRADE: [A-F with specific reasoning]\nINVESTIGATION_PRIORITIES: [2-3 journalist investigation angles]\n\nFacts only. Reference only provided data.`}]})});const j=await r.json();setAI(j.content&&j.content.map(b=>b.text||"").join("")||"");}catch(e){setAIE(e.message);}
    setAIL(false);
  };
  const sec=(t,k)=>{const m=t.match(new RegExp(k+":[ \t]*(.+?)(?=\n[A-Z_]+:|$)","s"));return m?m[1].trim():null;};
  const TABS=[{id:"overview",l:"Overview"},{id:"trades",l:"Trades",hot:violations>0},{id:"bills",l:"Legislation"},{id:"ai",l:"AI Briefing",ai:true}];
  const ds={background:"rgba(168,85,247,.04)",border:"1px solid rgba(168,85,247,.12)",borderRadius:14,padding:22};
  return(
    <div style={{background:"#0f172a",minHeight:"100vh",paddingBottom:60}}>
      <CW pad="0 28px">
        <div style={{padding:"16px 0",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <button onClick={onBack} style={{background:"rgba(168,85,247,.08)",border:"1px solid rgba(168,85,247,.2)",cursor:"pointer",color:"#a78bfa",fontWeight:700,fontSize:12,padding:"7px 14px",borderRadius:8}}>← Back</button>
          {user&&<button onClick={toggleWatch} style={{background:isWatched?"rgba(239,68,68,.1)":"rgba(16,185,129,.1)",border:"1px solid "+(isWatched?"rgba(239,68,68,.3)":"rgba(16,185,129,.3)"),color:isWatched?"#f87171":"#34d399",fontWeight:700,fontSize:12,padding:"7px 14px",borderRadius:8,cursor:"pointer"}}>{isWatched?"✕ Unwatch":"+ Watch"}</button>}
          {user&&<button onClick={()=>setShowNote(!showNote)} style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",color:"rgba(255,255,255,.5)",fontWeight:700,fontSize:12,padding:"7px 14px",borderRadius:8,cursor:"pointer"}}>📝 {(user.notes&&user.notes[pol.id])?"Edit Note":"Add Note"}</button>}
          <a href={`https://www.congress.gov/member/${pol.name.toLowerCase().replace(/[^a-z\s]/g,"").trim().replace(/\s+/g,"-")}/${pol.bioguideId||""}`} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"rgba(255,255,255,.35)",textDecoration:"none",border:"1px solid rgba(255,255,255,.08)",padding:"7px 14px",borderRadius:8}}>Congress.gov ↗</a>
          {fecUrl&&<a href={fecUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"rgba(255,255,255,.35)",textDecoration:"none",border:"1px solid rgba(255,255,255,.08)",padding:"7px 14px",borderRadius:8}}>FEC.gov ↗</a>}
        </div>
        {showNote&&user&&(
          <div style={{background:"rgba(168,85,247,.08)",border:"1px solid rgba(168,85,247,.25)",borderRadius:12,padding:16,marginBottom:14}}>
            <div style={{fontSize:12,color:"#a78bfa",fontWeight:700,marginBottom:8}}>Your private note on {pol.name}</div>
            <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Add investigation notes, observations..." rows={3} style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(168,85,247,.2)",borderRadius:8,color:"#fff",fontSize:12,padding:"10px 12px",outline:"none",resize:"vertical",boxSizing:"border-box"}}/>
            <div style={{display:"flex",gap:8,marginTop:8}}><button onClick={saveNote} style={{background:"rgba(168,85,247,.2)",color:"#a78bfa",border:"none",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Save Note</button><button onClick={()=>setShowNote(false)} style={{background:"none",color:"rgba(255,255,255,.3)",border:"none",fontSize:12,cursor:"pointer"}}>Cancel</button></div>
          </div>
        )}
        {/* Header Card */}
        <div style={{background:"linear-gradient(135deg,#1e1b4b,#1e293b)",border:"1px solid rgba(168,85,247,.15)",borderRadius:20,padding:m?"18px":"24px",marginBottom:16,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${PC[pol.party]},transparent)`}}/>
          <div style={{display:"flex",gap:18,alignItems:"flex-start",flexWrap:"wrap"}}>
            <Avatar pol={pol} size={m?52:68} ring="#a78bfa"/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}>
                <h2 style={{fontSize:m?18:24,fontWeight:900,color:"#fff",margin:0}}>{pol.name}</h2>
                <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:5,background:PC[pol.party]+"20",color:PC[pol.party],border:"1px solid "+PC[pol.party]+"40"}}>{PL[pol.party]}</span>
                <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:4,background:rC+"18",color:rC}}>RISK {risk}/100</span>
                {violations>0&&<span style={{fontSize:9,fontWeight:800,padding:"2px 9px",borderRadius:4,background:"rgba(239,68,68,.15)",color:"#f87171",border:"1px solid rgba(239,68,68,.3)",animation:"pulseDot 2s infinite"}}>🚨 {violations} VIOLATION{violations>1?"S":""}</span>}
                {isWatched&&<span style={{fontSize:9,color:"#34d399",padding:"2px 9px",background:"rgba(16,185,129,.1)",borderRadius:4,border:"1px solid rgba(16,185,129,.2)"}}>✓ Watching</span>}
              </div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.3)",marginBottom:14}}>{pol.chamber} · {pol.state}{fecId&&" | "+fecId}</div>
              <div style={{display:"grid",gridTemplateColumns:m?"1fr 1fr":"repeat(5,1fr)",gap:8,marginBottom:12}}>
                {[["Raised",fmt(raised),raised>0,"#10b981"],["Spent",fmt(spent),spent>0,"#ef4444"],["Cash",fmt(cash),cash>0,"#3b82f6"],["Trades",loading?"…":trades.length,trades.length>0,"#a78bfa"],["Violations",loading?"…":violations,violations>0,"#ef4444"]].map(([l,v,ok,c],i)=>(
                  <div key={i} style={{background:"rgba(255,255,255,.05)",borderRadius:10,padding:"10px 12px"}}>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.25)",textTransform:"uppercase",letterSpacing:.4,marginBottom:4}}>{l}</div>
                    <div style={{fontSize:m?12:14,fontWeight:700,color:ok?(i===4?"#ef4444":c):"rgba(255,255,255,.18)"}}>{v||"--"}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Tabs */}
        <div style={{display:"flex",gap:2,background:"rgba(168,85,247,.06)",border:"1px solid rgba(168,85,247,.12)",padding:4,borderRadius:12,marginBottom:18,overflowX:"auto"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"8px 14px",borderRadius:9,border:"none",background:tab===t.id?"rgba(168,85,247,.2)":"transparent",color:tab===t.id?"#a78bfa":"rgba(255,255,255,.35)",fontWeight:700,fontSize:10,cursor:"pointer",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5,flexShrink:0,position:"relative"}}>
              {t.hot&&tab!==t.id&&<div style={{position:"absolute",top:4,right:4,width:6,height:6,borderRadius:"50%",background:"#ef4444",animation:"pulseDot 2s infinite"}}/>}
              {t.l}{t.ai&&<span style={{fontSize:7,background:"#6366f1",color:"#fff",padding:"1px 4px",borderRadius:2}}>AI</span>}
            </button>
          ))}
        </div>
        {/* Tab content */}
        {tab==="overview"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {raised>0&&<div style={{...ds}}>
              <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:4}}>FEC Campaign Finance</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginBottom:16}}>OpenFEC · live</div>
              {[["Total Raised",fmt(raised),"#10b981",100],["Total Spent",fmt(spent),"#ef4444",raised>0?Math.min(100,Math.round(spent/raised*100)):0],["Cash on Hand",fmt(cash),"#3b82f6",raised>0?Math.min(100,Math.round(cash/raised*100)):0]].map(([l,v,c,p])=>(
                <div key={l} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5}}><span style={{color:"rgba(255,255,255,.4)"}}>{l}</span><span style={{fontWeight:700,color:"#fff"}}>{v}</span></div>
                  <div style={{height:7,borderRadius:4,background:"rgba(255,255,255,.06)",overflow:"hidden"}}><div style={{height:"100%",width:p+"%",background:c,borderRadius:4,transition:"width 1.2s"}}/></div>
                </div>
              ))}
            </div>}
            {!raised&&<div style={{...ds,fontSize:13,color:"rgba(255,255,255,.3)"}}>{fecLoading?"Searching FEC...":"No FEC match found. Individual profiles perform a targeted FEC lookup."}</div>}
            {sectors.length>0&&<div style={{...ds}}>
              <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:14}}>Trading Portfolio Breakdown</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {sectors.map(([ticker,cnt])=><div key={ticker} style={{background:"rgba(168,85,247,.12)",border:"1px solid rgba(168,85,247,.2)",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
                  <div style={{fontSize:14,fontWeight:900,color:"#a78bfa"}}>{ticker}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.35)",marginTop:2}}>{cnt}x</div>
                </div>)}
              </div>
            </div>}
            {inds.length>0&&<div style={{...ds}}>
              <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:4}}>PAC Industry Funding</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginBottom:16}}>FEC Schedule A · committee contributors</div>
              {inds.map(ind=>(
                <div key={ind.name} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:ind.color,flexShrink:0}}/>
                  <div style={{width:80,fontSize:11,color:"rgba(255,255,255,.5)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ind.name}</div>
                  <div style={{flex:1,height:14,borderRadius:3,background:"rgba(255,255,255,.05)",overflow:"hidden"}}><div style={{height:"100%",width:((ind.total/maxV)*100)+"%",background:ind.color,opacity:.8,borderRadius:3,transition:"width 1.2s"}}/></div>
                  <div style={{fontSize:12,fontWeight:700,color:"#e2e8f0",minWidth:56,textAlign:"right"}}>{fmt(ind.total)}</div>
                </div>
              ))}
              {donors.slice(0,5).map((d,i)=>{const ind=classifyPAC(d.contributor_name);return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:9,marginBottom:6,padding:"8px 12px",background:i===0?"rgba(16,185,129,.06)":"rgba(255,255,255,.02)",borderRadius:9,border:"1px solid rgba(255,255,255,.06)"}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:IC[ind]||"#94a3b8",flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.contributor_name}</div><div style={{fontSize:9,color:"rgba(255,255,255,.3)"}}>{ind}</div></div>
                  <div style={{fontSize:12,fontWeight:700,color:"#10b981"}}>{fmt(d.contribution_receipt_amount)}</div>
                </div>
              );})}
            </div>}
          </div>
        )}
        {tab==="trades"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {/* Risk gauge */}
            <div style={{background:"linear-gradient(135deg,rgba(168,85,247,.06),rgba(168,85,247,.02))",border:"1px solid rgba(168,85,247,.15)",borderRadius:14,padding:20}}>
              <div style={{display:"flex",gap:14,alignItems:"center",flexWrap:"wrap",marginBottom:14}}>
                <div style={{width:64,height:64,borderRadius:"50%",background:`conic-gradient(${rC} ${risk*3.6}deg,rgba(255,255,255,.05) 0deg)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <div style={{width:50,height:50,borderRadius:"50%",background:"#0f172a",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column"}}><div style={{fontSize:16,fontWeight:900,color:rC,lineHeight:1}}>{risk}</div><div style={{fontSize:7,color:"rgba(255,255,255,.25)"}}>RISK</div></div>
                </div>
                <div><div style={{fontSize:13,fontWeight:700,color:rC,marginBottom:4}}>{riskLabel(risk)} RISK</div><div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>{trades.length} disclosures · {violations} violation{violations!==1?"s":""} · from HouseStockWatcher + SenateStockWatcher</div></div>
                <div style={{marginLeft:"auto",display:"flex",gap:8}}>
                  {[["Buys",trades.filter(t=>t.action==="BUY").length,"#4ade80"],["Sells",trades.filter(t=>t.action==="SELL").length,"#f87171"],["Violations",violations,"#ef4444"]].map(([l,v,c])=>(
                    <div key={l} style={{background:"rgba(255,255,255,.04)",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.25)",textTransform:"uppercase",marginBottom:2}}>{l}</div>
                      <div style={{fontSize:16,fontWeight:900,color:v>0?c:"rgba(255,255,255,.15)"}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{background:"rgba(168,85,247,.04)",border:"1px solid rgba(168,85,247,.12)",borderRadius:14,padding:20}}>
              <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
                <span style={{fontSize:13,fontWeight:700,color:"#4ade80"}}>STOCK Act Disclosures</span>
                <span style={{fontSize:10,background:"rgba(34,197,94,.08)",color:"#4ade80",padding:"2px 8px",borderRadius:4,fontWeight:700}}>{trades.length} total</span>
              </div>
              {loading&&<div style={{display:"flex",gap:8,alignItems:"center",color:"rgba(255,255,255,.35)",fontSize:13,padding:"16px 0"}}><Spin sz={14}/>Loading disclosures...</div>}
              {!loading&&!trades.length&&<div style={{color:"rgba(255,255,255,.25)",fontSize:13,padding:"20px 0",textAlign:"center"}}>No STOCK Act disclosures found for "{pol.name}" in the S3 databases.</div>}
              {!loading&&trades.slice(0,25).map((t,i)=>{const flag=flagTrade(t);return(
                <div key={i} style={{background:flag?"rgba(255,255,255,.05)":"rgba(255,255,255,.02)",border:"1px solid "+(flag?flag.color+"44":"rgba(255,255,255,.07)"),borderRadius:9,padding:11,display:"flex",alignItems:"center",gap:9,flexWrap:"wrap",marginBottom:6,animation:"slideIn .3s ease "+i*.03+"s both"}}>
                  <div style={{width:3,height:28,borderRadius:2,background:t.action==="BUY"?"#4ade80":"#f87171",flexShrink:0}}/>
                  <div style={{minWidth:44}}><div style={{fontSize:13,fontWeight:900,color:"#fff"}}>{t.ticker||"🏢"}</div>{t.description&&<div style={{fontSize:7,color:"rgba(255,255,255,.2)",marginTop:1}}>{t.description.slice(0,18)}</div>}</div>
                  <span style={{fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:4,background:t.action==="BUY"?"rgba(34,197,94,.15)":"rgba(239,68,68,.15)",color:t.action==="BUY"?"#4ade80":"#f87171"}}>{t.action}</span>
                  <span style={{fontSize:11,color:"rgba(255,255,255,.45)"}}>{t.amount}</span>
                  <div style={{display:"flex",flexDirection:"column",gap:1}}>
                    <span style={{fontSize:9,color:"rgba(255,255,255,.25)"}}>Traded: {t.tradeDate}</span>
                    <span style={{fontSize:9,color:"rgba(255,255,255,.18)"}}>Filed: {t.filedDate}</span>
                  </div>
                  <span style={{fontSize:8,background:"rgba(255,255,255,.04)",color:"rgba(255,255,255,.3)",padding:"1px 5px",borderRadius:3}}>{t.source}</span>
                  <span style={{marginLeft:"auto",fontSize:11,fontWeight:800,color:gapC(t.gap)}}>{t.gap>0?t.gap+"d":"same day"}</span>
                  {flag&&<Tag label={flag.badge} color={flag.color}/>}
                </div>
              );})}
            </div>
          </div>
        )}
        {tab==="bills"&&(
          <div style={{...ds}}>
            <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:4}}>Sponsored Legislation</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginBottom:16}}>Congress.gov API · {bills.length} bills</div>
            {!pol.bioguideId&&<div style={{fontSize:13,color:"rgba(255,255,255,.3)"}}>No Bioguide ID — Congress.gov link unavailable.</div>}
            {bills.length===0&&pol.bioguideId&&<div style={{fontSize:13,color:"rgba(255,255,255,.3)"}}>No sponsored legislation found in current Congress.</div>}
            {bills.slice(0,8).map((l,i)=>(
              <div key={i} style={{padding:"10px 0",borderBottom:i<bills.length-1?"1px solid rgba(255,255,255,.06)":"none",display:"flex",gap:10,alignItems:"flex-start"}}>
                <span style={{fontSize:9,fontWeight:700,background:"rgba(59,130,246,.15)",color:"#60a5fa",padding:"2px 6px",borderRadius:3,flexShrink:0,marginTop:2}}>{l.type||"BILL"}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:"#e2e8f0",lineHeight:1.4}}>{(l.title||"").slice(0,100)}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.25)",marginTop:2}}>Introduced {l.introducedDate||"--"}{l.latestAction?" · "+l.latestAction.text.slice(0,60):""}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab==="ai"&&(
          <div>
            <div style={{background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.2)",borderRadius:9,padding:"10px 16px",marginBottom:14,fontSize:12,color:"#fbbf24"}}>Analysis uses verified FEC + STOCK Act data only. Sources: HouseStockWatcher, SenateStockWatcher, OpenFEC.</div>
            {!aiRes&&!aiLoad&&<button onClick={runAI} style={{background:"linear-gradient(135deg,#6d28d9,#7c3aed)",color:"#fff",border:"none",borderRadius:12,padding:"14px 22px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%"}}>Generate Intelligence Briefing</button>}
            {aiLoad&&<div style={{display:"flex",alignItems:"center",gap:10,padding:20,justifyContent:"center",color:"rgba(255,255,255,.4)"}}><Spin sz={16} col="#a78bfa"/>Analyzing {trades.length} disclosures + FEC data...</div>}
            {aiErr&&<EBox msg={aiErr}/>}
            {aiRes&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[{k:"FINANCIAL_PROFILE",l:"Financial Profile",c:"#10b981"},{k:"TRADING_ANALYSIS",l:"Trading Analysis",c:"#f97316"},{k:"VIOLATION_ASSESSMENT",l:"Violation Assessment",c:"#ef4444"},{k:"TRANSPARENCY_GRADE",l:"Transparency Grade",c:"#a78bfa"},{k:"INVESTIGATION_PRIORITIES",l:"Investigation Priorities",c:"#6366f1"}].map(({k,l,c})=>{const content=sec(aiRes,k);if(!content)return null;return(
                <div key={k} style={{background:c+"08",border:"1px solid "+c+"25",borderRadius:10,padding:14}}>
                  <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,color:c,marginBottom:6}}>{l}</div>
                  <div style={{fontSize:13,color:"#e2e8f0",lineHeight:1.7}}>{content}</div>
                </div>
              );})}
              <button onClick={()=>setAI("")} style={{background:"none",border:"1px solid rgba(255,255,255,.08)",borderRadius:8,padding:"7px 14px",fontSize:11,color:"rgba(255,255,255,.3)",cursor:"pointer"}}>Regenerate</button>
            </div>}
          </div>
        )}
      </CW>
    </div>
  );
}

/* ── AUTH PAGE ─────────────────────────── */
function AuthPage({onAuth}){
  const[tab,setTab]=useState("login");const[form,setForm]=useState({name:"",email:"",password:"",confirm:""});const[err,setErr]=useState("");const[loading,setL]=useState(false);
  const upd=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  const submit=async()=>{setErr("");setL(true);try{if(tab==="register"){if(!form.name.trim())throw new Error("Name required");if(!form.email.includes("@"))throw new Error("Valid email required");if(form.password.length<6)throw new Error("Password must be 6+ chars");if(form.password!==form.confirm)throw new Error("Passwords don't match");onAuth(await registerUser(form.name.trim(),form.email.toLowerCase(),form.password));}else{if(!form.email||!form.password)throw new Error("Enter email and password");onAuth(await loginUser(form.email.toLowerCase(),form.password));}}catch(e){setErr(e.message);}setL(false);};
  const inp={width:"100%",padding:"12px 16px",borderRadius:10,border:"1.5px solid rgba(168,85,247,.2)",background:"rgba(168,85,247,.06)",color:"#fff",fontSize:14,outline:"none",boxSizing:"border-box",transition:"border .2s"};
  const focus=e=>e.target.style.borderColor="rgba(168,85,247,.6)";const blur=e=>e.target.style.borderColor="rgba(168,85,247,.2)";
  return(
    <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 50% 40%,#1a0a35 0%,#07030f 60%)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:420,animation:"slideIn .5s ease"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:56,height:56,borderRadius:16,background:"linear-gradient(135deg,#7c3aed,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:900,color:"#fff",margin:"0 auto 16px"}}>O</div>
          <h2 style={{fontSize:26,fontWeight:900,color:"#fff",margin:"0 0 6px",letterSpacing:-1}}>Officium</h2>
          <p style={{fontSize:13,color:"rgba(255,255,255,.3)",margin:0}}>Political Transparency Platform</p>
        </div>
        <div style={{background:"rgba(168,85,247,.06)",backdropFilter:"blur(16px)",border:"1px solid rgba(168,85,247,.15)",borderRadius:20,padding:28}}>
          <div style={{display:"flex",background:"rgba(255,255,255,.04)",borderRadius:10,padding:3,marginBottom:24}}>
            {[["login","Sign In"],["register","Create Account"]].map(([t,l])=><button key={t} onClick={()=>{setTab(t);setErr("");}} style={{flex:1,padding:"9px",borderRadius:8,border:"none",background:tab===t?"rgba(168,85,247,.25)":"transparent",color:tab===t?"#a78bfa":"rgba(255,255,255,.35)",fontWeight:700,fontSize:12,cursor:"pointer",transition:"all .2s"}}>{l}</button>)}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {tab==="register"&&<input value={form.name} onChange={upd("name")} placeholder="Full name" style={inp} onFocus={focus} onBlur={blur}/>}
            <input value={form.email} onChange={upd("email")} placeholder="Email address" type="email" style={inp} onFocus={focus} onBlur={blur}/>
            <input value={form.password} onChange={upd("password")} placeholder="Password" type="password" style={inp} onFocus={focus} onBlur={blur}/>
            {tab==="register"&&<input value={form.confirm} onChange={upd("confirm")} placeholder="Confirm password" type="password" style={inp} onFocus={focus} onBlur={blur}/>}
            {err&&<div style={{background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.3)",borderRadius:8,padding:"10px 14px",color:"#f87171",fontSize:12}}>{err}</div>}
            <button onClick={submit} disabled={loading} style={{background:"linear-gradient(135deg,#6d28d9,#7c3aed)",color:"#fff",border:"none",borderRadius:10,padding:"13px",fontSize:14,fontWeight:800,cursor:loading?"wait":"pointer",marginTop:4}}>
              {loading?<span style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}><Spin sz={14} col="#fff"/>Please wait...</span>:(tab==="login"?"Sign In →":"Create Account →")}
            </button>
          </div>
          {tab==="login"&&<div style={{textAlign:"center",marginTop:14,fontSize:11,color:"rgba(255,255,255,.25)"}}>Demo: <span style={{color:"#a78bfa",fontFamily:"monospace"}}>admin@officium.vote / admin123</span></div>}
        </div>
        <div style={{textAlign:"center",marginTop:14}}><button onClick={()=>onAuth(null)} style={{background:"none",border:"none",color:"rgba(255,255,255,.25)",fontSize:12,cursor:"pointer"}}>Continue without account →</button></div>
      </div>
    </div>
  );
}

/* ── USER DASHBOARD ────────────────────── */
function UserDashboard({user,pols,onSelect,onSetUser}){
  const[watchedTrades,setWT]=useState({});const[loading,setL]=useState(true);const[compare,setCompare]=useState([]);const[showCompare,setShowCompare]=useState(false);
  const watchedPols=useMemo(()=>pols.filter(p=>user.watchlist.includes(p.id)),[pols,user.watchlist]);
  useEffect(()=>{if(!watchedPols.length){setL(false);return;}const load=async()=>{const map={};await Promise.all(watchedPols.map(async p=>{map[p.id]=await tradesFor(p.name).catch(()=>[])}));setWT(map);setL(false);};load();},[watchedPols.length]);
  const toggleWatch=async polId=>{const wl=user.watchlist.includes(polId)?user.watchlist.filter(x=>x!==polId):[...user.watchlist,polId];const updated=await updateUser(user.id,{watchlist:wl});if(onSetUser&&updated)onSetUser(updated);};
  const allTrades=useMemo(()=>watchedPols.flatMap(p=>(watchedTrades[p.id]||[]).map(t=>({...t,_pol:p}))).sort((a,b)=>(b.filedDate||"").localeCompare(a.filedDate||"")).slice(0,20),[watchedTrades]);
  const violations=allTrades.filter(t=>t.gap>45);const m=mob();
  const exportCSV=()=>{const rows=[["Official","Party","Chamber","State","Ticker","Action","Amount","Trade Date","Filed Date","Gap (days)"]];allTrades.forEach(t=>{rows.push([t._pol.name,t._pol.party,t._pol.chamber,t._pol.state,t.ticker||"",t.action||"",t.amount||"",t.tradeDate||"",t.filedDate||"",t.gap||""]);});watchedPols.forEach(p=>{if(!allTrades.some(t=>t._pol.id===p.id))rows.push([p.name,p.party,p.chamber,p.state,"","","","","",""]);});const csv=rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(",")).join("\n");const blob=new Blob([csv],{type:"text/csv"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="officium_watchlist_export.csv";a.click();URL.revokeObjectURL(url);};
  const toggleCompare=polId=>{setCompare(prev=>prev.includes(polId)?prev.filter(x=>x!==polId):prev.length<2?[...prev,polId]:prev);};
  const comparePols=compare.map(id=>watchedPols.find(p=>p.id===id)).filter(Boolean);
  return(
    <div style={{background:"#0f172a",minHeight:"100vh",paddingBottom:60}}>
      <div style={{background:"linear-gradient(135deg,#1e1b4b,#1e293b)",borderBottom:"1px solid rgba(168,85,247,.12)",padding:"28px 0 22px"}}>
        <CW>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18,flexWrap:"wrap"}}>
            <div style={{width:46,height:46,borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:900,color:"#fff"}}>{(user.name||"U")[0].toUpperCase()}</div>
            <div><div style={{fontSize:20,fontWeight:900,color:"#fff"}}>{user.name}'s Dashboard</div><div style={{fontSize:11,color:"rgba(255,255,255,.3)",marginTop:2}}>{user.email} · Joined {timeAgo(user.joinedAt)}</div></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:m?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
            {[["Watching",watchedPols.length,"#a78bfa"],["Trade Alerts",allTrades.length,"#f59e0b"],["Violations",violations.length,"#ef4444"],["Total Raised",watchedPols.reduce((a,p)=>a+p.raised,0)>0?fmt(watchedPols.reduce((a,p)=>a+p.raised,0)):"--","#10b981"]].map(([l,v,c])=>(
              <div key={l} style={{background:"rgba(168,85,247,.06)",border:"1px solid rgba(168,85,247,.12)",borderRadius:12,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:"rgba(255,255,255,.25)",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{l}</div>
                <div style={{fontSize:22,fontWeight:900,color:c}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,marginTop:14}}>
            <button onClick={exportCSV} style={{padding:"8px 16px",borderRadius:8,border:"1px solid rgba(168,85,247,.3)",background:"rgba(168,85,247,.1)",color:"#a78bfa",fontSize:11,fontWeight:700,cursor:"pointer"}}>Export CSV</button>
            <button onClick={()=>{setShowCompare(!showCompare);if(showCompare)setCompare([]);}} style={{padding:"8px 16px",borderRadius:8,border:"1px solid "+(showCompare?"rgba(249,115,22,.3)":"rgba(168,85,247,.3)"),background:showCompare?"rgba(249,115,22,.1)":"rgba(168,85,247,.1)",color:showCompare?"#f97316":"#a78bfa",fontSize:11,fontWeight:700,cursor:"pointer"}}>{showCompare?"Cancel Compare":"Compare Officials"}</button>
          </div>
        </CW>
      </div>
      {showCompare&&comparePols.length===2&&<div style={{background:"linear-gradient(135deg,rgba(168,85,247,.06),rgba(249,115,22,.04))",borderBottom:"1px solid rgba(168,85,247,.12)",padding:"20px 0"}}>
        <CW>
          <div style={{fontWeight:700,fontSize:14,color:"#fff",marginBottom:14}}>Side-by-Side Comparison</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            {comparePols.map(p=>{const pTrades=(watchedTrades[p.id]||[]);const pViolations=pTrades.filter(t=>t.gap>45).length;const riskScore=Math.min(100,Math.round((pViolations*15)+(pTrades.length*2)+(p.raised>1e6?10:0)));return(
              <div key={p.id} style={{background:"rgba(168,85,247,.05)",border:"1px solid rgba(168,85,247,.12)",borderRadius:14,padding:18}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                  <Avatar pol={p} size={40}/>
                  <div><div style={{fontSize:14,fontWeight:800,color:"#fff"}}>{p.name}</div><div style={{fontSize:10,color:"rgba(255,255,255,.3)"}}>{p.party==="D"?"Democrat":p.party==="R"?"Republican":"Independent"}</div></div>
                </div>
                {[["Chamber",p.chamber],["State",p.state],["Raised",fmt(p.raised)],["Spent",fmt(p.spent||0)],["Cash on Hand",fmt(p.cash||0)],["Trades",pTrades.length],["Violations",pViolations],["Risk Score",riskScore+"/100"]].map(([l,v])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                    <span style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>{l}</span>
                    <span style={{fontSize:12,fontWeight:700,color:l==="Violations"&&v>0?"#ef4444":l==="Risk Score"&&riskScore>50?"#f59e0b":"#e2e8f0"}}>{v}</span>
                  </div>
                ))}
              </div>
            );})}
          </div>
        </CW>
      </div>}
      <CW pad="24px 28px">
        <div style={{display:"grid",gridTemplateColumns:m?"1fr":"2fr 1fr",gap:20}}>
          <div>
            <div style={{background:"rgba(168,85,247,.05)",border:"1px solid rgba(168,85,247,.12)",borderRadius:16,padding:22,marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:4}}>Watchlist Trade Activity</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginBottom:16}}>STOCK Act disclosures from officials you follow</div>
              {!watchedPols.length&&<div style={{textAlign:"center",padding:"28px 0",color:"rgba(255,255,255,.25)",fontSize:13}}>No officials in watchlist.<br/>Browse officials and click <strong style={{color:"#a78bfa"}}>+ Watch</strong>.</div>}
              {loading&&watchedPols.length>0&&<div style={{display:"flex",gap:8,alignItems:"center",color:"rgba(255,255,255,.35)",fontSize:13,padding:"12px 0"}}><Spin sz={14}/>Loading trade data...</div>}
              {violations.length>0&&<div style={{background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.2)",borderRadius:10,padding:12,marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:800,color:"#ef4444",marginBottom:8}}>🚨 {violations.length} VIOLATION{violations.length>1?"S":""} IN YOUR WATCHLIST</div>
                {violations.slice(0,3).map((t,i)=><div key={i} style={{fontSize:11,color:"#fca5a5",marginBottom:2}}>· {t._pol.name}: {t.ticker||"N/A"} {t.action} — {t.gap}d late</div>)}
              </div>}
              {allTrades.map((t,i)=>{const flag=flagTrade(t);return(
                <div key={i} onClick={()=>onSelect(t._pol)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:i<allTrades.length-1?"1px solid rgba(255,255,255,.05)":"none",cursor:"pointer"}}>
                  <Avatar pol={t._pol} size={30}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:"#fff"}}>{t._pol.name}</div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,.3)"}}>{t.ticker||"N/A"} {t.action} · {t.amount} · {t.tradeDate}</div>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span style={{fontSize:11,fontWeight:700,color:gapC(t.gap)}}>{t.gap}d</span>
                    {flag&&<Tag label={flag.badge} color={flag.color}/>}
                  </div>
                </div>
              );})}
            </div>
            {(user.notes&&Object.keys(user.notes).length>0)&&<div style={{background:"rgba(168,85,247,.05)",border:"1px solid rgba(168,85,247,.12)",borderRadius:14,padding:20}}>
              <div style={{fontWeight:700,fontSize:14,color:"#fff",marginBottom:14}}>Your Investigation Notes</div>
              {Object.entries(user.notes).filter(([,v])=>v).map(([polId,note])=>{const pol=pols.find(p=>p.id===polId);return pol?(
                <div key={polId} onClick={()=>onSelect(pol)} style={{padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,.05)",cursor:"pointer"}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#a78bfa",marginBottom:4}}>{pol.name}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,.4)",lineHeight:1.5}}>{note}</div>
                </div>
              ):null;})}
            </div>}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:"rgba(168,85,247,.05)",border:"1px solid rgba(168,85,247,.12)",borderRadius:14,padding:20}}>
              <div style={{fontWeight:700,fontSize:14,color:"#fff",marginBottom:14}}>Watchlist</div>
              {!watchedPols.length&&<div style={{fontSize:12,color:"rgba(255,255,255,.3)",lineHeight:1.6}}>Start watching officials to track their STOCK Act trades and FEC data.</div>}
              {watchedPols.map(p=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
                  {showCompare&&<input type="checkbox" checked={compare.includes(p.id)} onChange={()=>toggleCompare(p.id)} style={{accentColor:"#a78bfa",cursor:"pointer",flexShrink:0}}/>}
                  <div onClick={()=>onSelect(p)} style={{display:"flex",alignItems:"center",gap:8,flex:1,cursor:"pointer",minWidth:0}}>
                    <Avatar pol={p} size={30}/>
                    <div style={{minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div><div style={{fontSize:10,color:"rgba(255,255,255,.3)"}}>{p.chamber} · {(watchedTrades[p.id]||[]).length} trades</div></div>
                  </div>
                  <button onClick={()=>toggleWatch(p.id)} style={{fontSize:9,background:"rgba(239,68,68,.08)",color:"#ef4444",border:"1px solid rgba(239,68,68,.2)",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontWeight:700,flexShrink:0}}>✕</button>
                </div>
              ))}
            </div>
            <div style={{background:"rgba(168,85,247,.05)",border:"1px solid rgba(168,85,247,.12)",borderRadius:14,padding:18}}>
              <div style={{fontWeight:700,fontSize:13,color:"#fff",marginBottom:12}}>Suggested to Watch</div>
              {pols.filter(p=>!user.watchlist.includes(p.id)&&p.raised>1e6).slice(0,5).map(p=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
                  <Avatar pol={p} size={28}/>
                  <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>onSelect(p)}><div style={{fontSize:11,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div><div style={{fontSize:9,color:"rgba(255,255,255,.3)"}}>{p.state} · {fmt(p.raised)}</div></div>
                  <button onClick={()=>toggleWatch(p.id)} style={{fontSize:9,background:"rgba(16,185,129,.08)",color:"#34d399",border:"1px solid rgba(16,185,129,.2)",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontWeight:700,flexShrink:0}}>+</button>
                </div>
              ))}
            </div>
            {watchedPols.length>0&&<div style={{background:"rgba(168,85,247,.05)",border:"1px solid rgba(168,85,247,.12)",borderRadius:14,padding:18}}>
              <div style={{fontWeight:700,fontSize:13,color:"#fff",marginBottom:12}}>Watchlist Analytics</div>
              {[["Total Raised",fmt(watchedPols.reduce((a,p)=>a+p.raised,0)),"#10b981"],["Avg Risk",Math.round(watchedPols.reduce((a,p)=>{const pT=(watchedTrades[p.id]||[]);const pV=pT.filter(t=>t.gap>45).length;return a+Math.min(100,(pV*15)+(pT.length*2)+(p.raised>1e6?10:0));},0)/watchedPols.length)+"/100","#f59e0b"],["Party Split (D/R)",watchedPols.filter(p=>p.party==="D").length+"/"+watchedPols.filter(p=>p.party==="R").length,"#a78bfa"],["Chamber Split (S/H)",watchedPols.filter(p=>p.chamber==="Senate").length+"/"+watchedPols.filter(p=>p.chamber==="House").length,"#0ea5e9"]].map(([l,v,c])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                  <span style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>{l}</span>
                  <span style={{fontSize:12,fontWeight:800,color:c}}>{v}</span>
                </div>
              ))}
            </div>}
          </div>
        </div>
      </CW>
    </div>
  );
}

/* ── ADMIN DASHBOARD ────────────────────── */
function AdminDashboard({pols,trades}){
  const[users,setUsers]=useState([]);const[tab,setTab]=useState("overview");const[regs,setRegs]=useState([]);const[treas,setTreas]=useState([]);const[apiSts,setApiSts]=useState({});const[fara,setFara]=useState(null);const[agencies,setAgencies]=useState([]);
  useEffect(()=>{getUsers().then(setUsers);FEDREG_P.then(setRegs).catch(()=>{});TREASURY_P.then(setTreas).catch(()=>{});API_CHECKS.forEach(a=>a.test().then(ok=>setApiSts(p=>({...p,[a.id]:ok}))).catch(()=>setApiSts(p=>({...p,[a.id]:false}))));FARA_P.then(setFara).catch(()=>{});USA_AGENCIES.then(setAgencies).catch(()=>{});},[]);
  const violations=(trades||[]).filter(t=>t.gap>45).length;
  const topV=useMemo(()=>{const m={};(trades||[]).filter(t=>t.gap>45).forEach(t=>{if(!t.name)return;m[t.name]=(m[t.name]||0)+1;});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,10);},[trades]);
  const topT=useMemo(()=>{const m={};(trades||[]).forEach(t=>{if(!t.ticker)return;const buys=trades.filter(x=>x.ticker===t.ticker&&x.action==="BUY").length;const sells=trades.filter(x=>x.ticker===t.ticker&&x.action==="SELL").length;m[t.ticker]={cnt:(m[t.ticker]||{cnt:0}).cnt+1,buys,sells};});return Object.entries(m).sort((a,b)=>b[1].cnt-a[1].cnt).slice(0,12);},[trades]);
  const buys=(trades||[]).filter(t=>t.action==="BUY").length;const sells=(trades||[]).filter(t=>t.action==="SELL").length;
  const liveCount=Object.values(apiSts).filter(Boolean).length;const m=mob();
  const TABS=[{id:"overview",l:"Overview"},{id:"violations",l:"Violations"},{id:"tickers",l:"Tickers"},{id:"fara",l:"FARA"},{id:"spending",l:"Spending"},{id:"insider",l:"Insider Flags"},{id:"users",l:"Users"},{id:"apis",l:"API Health"},{id:"regs",l:"Regulations"}];
  const ds={background:"rgba(168,85,247,.05)",border:"1px solid rgba(168,85,247,.1)",borderRadius:14,padding:22};
  return(
    <div style={{background:"#0f172a",minHeight:"100vh",paddingBottom:60}}>
      <div style={{background:"linear-gradient(135deg,#1e1b4b,#1e293b)",borderBottom:"1px solid rgba(168,85,247,.12)",padding:"26px 0 20px"}}>
        <CW>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18,flexWrap:"wrap"}}>
            <div style={{width:40,height:40,borderRadius:10,background:"rgba(239,68,68,.15)",border:"1px solid rgba(239,68,68,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🛡</div>
            <div><div style={{fontSize:20,fontWeight:900,color:"#fff"}}>Admin Dashboard</div><div style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>Officium Platform Intelligence · Real-time</div></div>
            <span style={{marginLeft:"auto",fontSize:10,background:liveCount>=6?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",color:liveCount>=6?"#34d399":"#f87171",border:"1px solid "+(liveCount>=6?"rgba(34,197,94,.3)":"rgba(239,68,68,.3)"),padding:"4px 12px",borderRadius:100,fontWeight:700}}>{liveCount}/{API_CHECKS.length} APIs live</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:m?"1fr 1fr":"repeat(5,1fr)",gap:10}}>
            {[["Trades",(trades||[]).length,"#a78bfa"],["Violations",violations,"#ef4444"],["Late (30-45d)",(trades||[]).filter(t=>t.gap>30&&t.gap<=45).length,"#f59e0b"],["Officials",pols.length,"#c8a84b"],["Users",users.length,"#10b981"]].map(([l,v,c])=>(
              <div key={l} style={{background:"rgba(168,85,247,.06)",border:"1px solid rgba(168,85,247,.1)",borderRadius:12,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:"rgba(255,255,255,.25)",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{l}</div>
                <div style={{fontSize:22,fontWeight:900,color:c}}>{v}</div>
              </div>
            ))}
          </div>
        </CW>
      </div>
      <CW pad="20px 28px">
        <div style={{display:"flex",gap:2,background:"rgba(168,85,247,.06)",border:"1px solid rgba(168,85,247,.1)",borderRadius:10,padding:3,marginBottom:20,overflowX:"auto"}}>
          {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"7px 14px",borderRadius:8,border:"none",background:tab===t.id?"rgba(168,85,247,.2)":"transparent",color:tab===t.id?"#a78bfa":"rgba(255,255,255,.35)",fontWeight:700,fontSize:11,cursor:"pointer",whiteSpace:"nowrap"}}>{t.l}</button>)}
        </div>
        {tab==="overview"&&<div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr",gap:16}}>
          <div style={{...ds}}>
            <div style={{fontWeight:700,fontSize:14,color:"#fff",marginBottom:14}}>Trade Activity Split</div>
            <div style={{height:20,borderRadius:10,overflow:"hidden",background:"rgba(248,113,113,.3)",marginBottom:10}}>
              <div style={{height:"100%",width:((buys/(buys+sells||1))*100)+"%",background:"#4ade80",transition:"width 1.5s"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"rgba(255,255,255,.5)",marginBottom:16}}>
              <span>🟢 Buy: {buys} ({Math.round((buys/(buys+sells||1))*100)}%)</span>
              <span>🔴 Sell: {sells} ({Math.round((sells/(buys+sells||1))*100)}%)</span>
            </div>
            {[["Total Disclosures",(trades||[]).length,"#a78bfa"],["STOCK Act Violations",violations,"#ef4444"],["Late (30-45d)",(trades||[]).filter(t=>t.gap>30&&t.gap<=45).length,"#f59e0b"],["Compliant",(trades||[]).length-violations-(trades||[]).filter(t=>t.gap>30&&t.gap<=45).length,"#10b981"]].map(([l,v,c])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
                <span style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>{l}</span>
                <span style={{fontSize:14,fontWeight:800,color:c}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{...ds}}>
            <div style={{fontWeight:700,fontSize:14,color:"#fff",marginBottom:14}}>Treasury Debt</div>
            {!treas.length&&<div style={{color:"rgba(255,255,255,.3)",fontSize:13}}>Loading...</div>}
            {treas.map((r,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid rgba(255,255,255,.05)"}}><span style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>{r.record_date}</span><span style={{fontSize:14,fontWeight:800,color:"#ef4444"}}>${Number(r.total_mil_amt||0).toLocaleString()}M</span></div>)}
          </div>
        </div>}
        {tab==="violations"&&<div style={{...ds}}>
          <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:4}}>STOCK Act Violation Leaderboard</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginBottom:20}}>Members with most late disclosures (&gt;45 days)</div>
          {topV.map(([name,cnt],i)=>{const pol=pols.find(p=>p.name.toLowerCase().includes(name.toLowerCase().split(/\s+/).pop()));return(
            <div key={name} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
              <div style={{fontSize:16,fontWeight:900,color:i<3?"#ef4444":"#4b5563",minWidth:26,textAlign:"center"}}>{i+1}</div>
              {pol?<Avatar pol={pol} size={36}/>:<div style={{width:36,height:36,borderRadius:"50%",background:"rgba(255,255,255,.04)",flexShrink:0}}/>}
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{name}</div>{pol&&<div style={{fontSize:10,color:"rgba(255,255,255,.3)"}}>{pol.chamber} · {pol.state}</div>}</div>
              <div style={{textAlign:"right"}}><div style={{fontSize:20,fontWeight:900,color:"#ef4444"}}>{cnt}</div><div style={{fontSize:9,color:"rgba(255,255,255,.25)"}}>violation{cnt>1?"s":""}</div></div>
              <div style={{width:60,height:6,borderRadius:3,background:"rgba(255,255,255,.06)",overflow:"hidden"}}><div style={{height:"100%",width:((cnt/(topV[0]&&topV[0][1]||1))*100)+"%",background:"#ef4444",borderRadius:3}}/></div>
            </div>
          );})}
        </div>}
        {tab==="tickers"&&<div style={{...ds}}>
          <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:20}}>Most Traded Securities</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
            {topT.map(([ticker,{cnt,buys,sells}],i)=>(
              <div key={ticker} style={{background:i<3?"rgba(168,85,247,.12)":"rgba(255,255,255,.03)",border:"1px solid "+(i<3?"rgba(168,85,247,.3)":"rgba(255,255,255,.07)"),borderRadius:12,padding:14}}>
                <div style={{fontSize:16,fontWeight:900,color:"#fff",marginBottom:4}}>{ticker}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginBottom:6}}>{cnt} disclosures</div>
                <div style={{height:4,borderRadius:2,background:"rgba(248,113,113,.3)",overflow:"hidden"}}><div style={{height:"100%",width:(buys/cnt*100)+"%",background:"#4ade80"}}/></div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"rgba(255,255,255,.3)",marginTop:4}}><span>🟢{buys}</span><span>🔴{sells}</span></div>
              </div>
            ))}
          </div>
        </div>}
        {tab==="users"&&<div style={{...ds}}>
          <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:20}}>Registered Users ({users.length})</div>
          {!users.length&&<div style={{color:"rgba(255,255,255,.3)",fontSize:13}}>No registered users yet.</div>}
          {users.map((u,i)=>(
            <div key={u.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:i<users.length-1?"1px solid rgba(255,255,255,.05)":"none"}}>
              <div style={{width:38,height:38,borderRadius:"50%",background:u.role==="admin"?"linear-gradient(135deg,#7c3aed,#a78bfa)":"rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:"#fff"}}>{(u.name||"U")[0].toUpperCase()}</div>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{u.name}</div><div style={{fontSize:10,color:"rgba(255,255,255,.3)"}}>{u.email} · Watch: {(u.watchlist||[]).length} · Last: {timeAgo(u.lastLogin)}</div></div>
              <span style={{fontSize:9,fontWeight:700,background:u.role==="admin"?"rgba(168,85,247,.2)":"rgba(255,255,255,.06)",color:u.role==="admin"?"#a78bfa":"rgba(255,255,255,.4)",padding:"3px 10px",borderRadius:100,border:"1px solid "+(u.role==="admin"?"rgba(168,85,247,.3)":"rgba(255,255,255,.08)")}}>{u.role.toUpperCase()}</span>
            </div>
          ))}
        </div>}
        {tab==="apis"&&<div style={{display:"grid",gridTemplateColumns:m?"1fr":"repeat(3,1fr)",gap:12}}>
          {API_CHECKS.map(a=>{const ok=apiSts[a.id];return(
            <div key={a.id} style={{background:ok?"rgba(34,197,94,.04)":"rgba(239,68,68,.04)",border:"1px solid "+(ok?"rgba(34,197,94,.2)":"rgba(239,68,68,.15)"),borderRadius:12,padding:18}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:ok?"#22c55e":"#ef4444",boxShadow:ok?"0 0 8px #22c55e":"none"}}/>
                <div style={{fontWeight:700,fontSize:12,color:"#fff"}}>{a.label}</div>
                <span style={{marginLeft:"auto",fontSize:9,fontWeight:700,color:ok?"#10b981":"#ef4444"}}>{ok?"ONLINE":"OFFLINE"}</span>
              </div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.3)"}}>{ok?"✓ Responding normally":"✗ Unavailable or rate limited"}</div>
            </div>
          );})}
        </div>}
        {tab==="regs"&&<div style={{...ds}}>
          <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:20}}>Federal Register — Latest Documents</div>
          {!regs.length&&<div style={{color:"rgba(255,255,255,.3)",fontSize:13}}>Loading Federal Register...</div>}
          {regs.map((r,i)=>{const agency=(r.agencies&&r.agencies[0]&&(r.agencies[0].name||r.agencies[0]))||"Federal Agency";const TC={"Rule":"#ef4444","Proposed Rule":"#f59e0b","Notice":"#0ea5e9"};const c=TC[r.type]||"#94a3b8";return(
            <div key={i} style={{padding:"11px 0",borderBottom:i<regs.length-1?"1px solid rgba(255,255,255,.05)":"none",display:"flex",gap:12,alignItems:"flex-start"}}>
              <span style={{fontSize:9,fontWeight:700,background:c+"18",color:c,padding:"2px 8px",borderRadius:4,flexShrink:0,marginTop:2}}>{(r.type||"DOC").slice(0,10)}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:"#e2e8f0",lineHeight:1.4}}>{(r.title||"").slice(0,100)}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,.25)",marginTop:2}}>{agency} · {r.publication_date||"--"}</div>
              </div>
            </div>
          );})}
        </div>}
        {tab==="fara"&&<div style={{...ds}}>
          <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:4}}>FARA — Foreign Agent Registrants</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginBottom:20}}>Foreign Agents Registration Act database</div>
          {!fara&&<div style={{color:"rgba(255,255,255,.3)",fontSize:13}}>Loading FARA data...</div>}
          {fara&&<>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
              {[["Total Registrants",fara.total||((fara.results||[]).length),"#f97316"],["Active",(fara.results||[]).length,"#10b981"],["Countries",[...new Set((fara.results||[]).map(r=>r.country||r.registrant_country||"Unknown"))].length,"#a78bfa"]].map(([l,v,c])=>(
                <div key={l} style={{background:c+"0a",border:"1px solid "+c+"22",borderRadius:12,padding:"14px 16px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:"rgba(255,255,255,.25)",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{l}</div>
                  <div style={{fontSize:22,fontWeight:900,color:c}}>{v}</div>
                </div>
              ))}
            </div>
            {(fara.results||[]).slice(0,15).map((r,i)=>{const name=r.registrant_name||r.name||"Unknown";const country=r.country||r.registrant_country||"N/A";return(
              <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:i<14?"1px solid rgba(255,255,255,.05)":"none"}}>
                <div style={{width:32,height:32,borderRadius:8,background:"rgba(249,115,22,.1)",border:"1px solid rgba(249,115,22,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>🌐</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.3)"}}>{country}</div>
                </div>
              </div>
            );})}
          </>}
        </div>}
        {tab==="spending"&&<div style={{...ds}}>
          <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:4}}>Federal Agency Spending</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginBottom:20}}>USASpending.gov — Top agencies by budget authority</div>
          {!agencies.length&&<div style={{color:"rgba(255,255,255,.3)",fontSize:13}}>Loading spending data...</div>}
          {agencies.length>0&&<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
              {[["Total Tracked","$"+(agencies.slice(0,15).reduce((s,a)=>s+(a.budget_authority_amount||0),0)/1e9).toFixed(1)+"B","#10b981"],["Agencies",agencies.length,"#a78bfa"]].map(([l,v,c])=>(
                <div key={l} style={{background:c+"0a",border:"1px solid "+c+"22",borderRadius:12,padding:"14px 16px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:"rgba(255,255,255,.25)",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{l}</div>
                  <div style={{fontSize:22,fontWeight:900,color:c}}>{v}</div>
                </div>
              ))}
            </div>
            {(()=>{const top15=agencies.slice(0,15);const maxB=Math.max(...top15.map(a=>a.budget_authority_amount||0),1);return top15.map((a,i)=>{const name=a.agency_name||a.name||"Agency";const amt=a.budget_authority_amount||0;const pct=(amt/maxB)*100;return(
              <div key={i} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontSize:12,fontWeight:700,color:"#e2e8f0",maxWidth:"60%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>
                  <span style={{fontSize:11,fontWeight:800,color:"#10b981"}}>${(amt/1e9).toFixed(1)}B</span>
                </div>
                <div style={{width:"100%",height:8,borderRadius:4,background:"rgba(16,185,129,.08)",overflow:"hidden"}}>
                  <div style={{width:pct+"%",height:"100%",borderRadius:4,background:"linear-gradient(90deg,#10b981,#34d399)",transition:"width .8s ease"}}/>
                </div>
              </div>
            );});})()}
          </>}
        </div>}
        {tab==="insider"&&<div style={{...ds}}>
          <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:4}}>Insider Trading Flags</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginBottom:20}}>Cross-referencing trades for high-risk patterns</div>
          {(()=>{const flagged=(trades||[]).filter(t=>t.gap>45||/1,000,000|5,000,001/.test(t.amount||"")).map(t=>{const late=t.gap>45;const highVal=/1,000,000|5,000,001/.test(t.amount||"");const severity=late&&highVal?"CRITICAL":late?"HIGH":"MODERATE";const sevColor=severity==="CRITICAL"?"#ef4444":severity==="HIGH"?"#f59e0b":"#a855f7";const pol=pols.find(p=>p.name.toLowerCase().includes((t.name||"").toLowerCase().split(/\s+/).pop())&&(t.name||"").toLowerCase().split(/\s+/).pop().length>3);return{...t,_pol:pol,late,highVal,severity,sevColor};});return(<>
            <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginBottom:16}}>{flagged.length} flagged trade{flagged.length!==1?"s":""}</div>
            {flagged.slice(0,20).map((t,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 0",borderBottom:i<Math.min(flagged.length,20)-1?"1px solid rgba(255,255,255,.05)":"none"}}>
                <span style={{fontSize:9,fontWeight:800,background:t.sevColor+"18",color:t.sevColor,padding:"3px 8px",borderRadius:5,flexShrink:0}}>{t.severity}</span>
                {t._pol?<Avatar pol={t._pol} size={30}/>:<div style={{width:30,height:30,borderRadius:"50%",background:"rgba(255,255,255,.04)",flexShrink:0}}/>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#fff"}}>{t.name||"Unknown"}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.3)"}}>{t.ticker||"N/A"} {t.action} · {t.amount} · {t.tradeDate||"--"}</div>
                </div>
                <div style={{display:"flex",gap:4,flexShrink:0}}>
                  {t.late&&<span style={{fontSize:8,fontWeight:700,background:"rgba(239,68,68,.1)",color:"#ef4444",padding:"2px 6px",borderRadius:4,border:"1px solid rgba(239,68,68,.2)"}}>{t.gap}d LATE</span>}
                  {t.highVal&&<span style={{fontSize:8,fontWeight:700,background:"rgba(168,85,247,.1)",color:"#a855f7",padding:"2px 6px",borderRadius:4,border:"1px solid rgba(168,85,247,.2)"}}>HIGH VALUE</span>}
                </div>
              </div>
            ))}
          </>);})()}
        </div>}
      </CW>
    </div>
  );
}

/* ── BROWSE PAGE ────────────────────────── */
const STATES_ALL=["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
function BrowsePage({pols,trades,onSelect,user,onSetUser}){
  const[filters,setF]=useState({search:"",chamber:"All",party:"All",state:"",fecOnly:false,sort:"raised",hasViolations:false});const[pg,setPg]=useState(1);const PER=48;const m=mob();
  const tradeMap=useMemo(()=>{const m2={};(trades||[]).forEach(t=>{const ln=(t.name||"").toLowerCase().split(/\s+/).pop();const pol=pols.find(p=>p.name.toLowerCase().includes(ln)&&ln.length>3);if(pol){if(!m2[pol.id])m2[pol.id]={count:0,violations:0};m2[pol.id].count++;if(t.gap>45)m2[pol.id].violations++;}});return m2;},[trades.length,pols.length]);
  const toggleWatch=async(polId,e)=>{e.stopPropagation();if(!user)return;const wl=user.watchlist.includes(polId)?user.watchlist.filter(x=>x!==polId):[...user.watchlist,polId];const updated=await updateUser(user.id,{watchlist:wl});if(onSetUser)onSetUser(updated);};
  const filtered=useMemo(()=>{let f=pols;if(filters.search)f=f.filter(p=>p.name.toLowerCase().includes(filters.search.toLowerCase())||(p.state||"").toUpperCase()===filters.search.toUpperCase());if(filters.chamber!=="All")f=f.filter(p=>p.chamber===filters.chamber);if(filters.party!=="All")f=f.filter(p=>p.party===filters.party);if(filters.state)f=f.filter(p=>p.state===filters.state);if(filters.fecOnly)f=f.filter(p=>p.hasRealFinancials);if(filters.hasViolations)f=f.filter(p=>(tradeMap[p.id]&&tradeMap[p.id].violations>0));if(filters.sort==="raised")f=[...f].sort((a,b)=>b.raised-a.raised);else if(filters.sort==="cash")f=[...f].sort((a,b)=>b.cash-a.cash);else if(filters.sort==="trades")f=[...f].sort((a,b)=>((tradeMap[b.id]||{}).count||0)-((tradeMap[a.id]||{}).count||0));else if(filters.sort==="violations")f=[...f].sort((a,b)=>((tradeMap[b.id]||{}).violations||0)-((tradeMap[a.id]||{}).violations||0));else f=[...f].sort((a,b)=>a.name.localeCompare(b.name));return f;},[pols,filters,tradeMap]);
  const shown=filtered.slice((pg-1)*PER,pg*PER);const totalPgs=Math.ceil(filtered.length/PER);
  const upd=(k,v)=>{setF(f=>({...f,[k]:v}));setPg(1);};
  const ss={padding:"9px 13px",borderRadius:9,border:"1px solid rgba(168,85,247,.2)",background:"rgba(168,85,247,.06)",color:"#fff",fontSize:12,cursor:"pointer",outline:"none"};
  return(
    <div style={{background:"#0f172a",minHeight:"100vh",paddingBottom:60}}>
      <div style={{background:"linear-gradient(135deg,#1e1b4b,#1e293b)",borderBottom:"1px solid rgba(168,85,247,.12)",padding:"28px 0 24px"}}>
        <CW>
          <div style={{display:"flex",alignItems:"baseline",gap:14,flexWrap:"wrap",marginBottom:20}}>
            <h1 style={{fontSize:m?24:32,fontWeight:900,color:"#fff",margin:0,letterSpacing:-1}}>Browse Officials</h1>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:11,color:"rgba(255,255,255,.25)",fontWeight:500}}>{filtered.length} of {pols.length}</span>
              {pols.filter(p=>p.hasRealFinancials).length>0&&<span style={{fontSize:9,background:"rgba(16,185,129,.1)",color:"#34d399",padding:"3px 8px",borderRadius:100,fontWeight:700}}>{pols.filter(p=>p.hasRealFinancials).length} FEC</span>}
            </div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <input value={filters.search} onChange={e=>upd("search",e.target.value)} placeholder="Search by name or state..." style={{flex:1,minWidth:180,...ss}}/>
            <select value={filters.chamber} onChange={e=>upd("chamber",e.target.value)} style={ss}><option value="All">All Chambers</option><option value="Senate">Senate</option><option value="House">House</option></select>
            <select value={filters.party} onChange={e=>upd("party",e.target.value)} style={ss}><option value="All">All Parties</option><option value="D">Democrat</option><option value="R">Republican</option><option value="I">Independent</option></select>
            <select value={filters.state} onChange={e=>upd("state",e.target.value)} style={ss}><option value="">All States</option>{STATES_ALL.map(s=><option key={s} value={s}>{s}</option>)}</select>
            <select value={filters.sort} onChange={e=>upd("sort",e.target.value)} style={ss}><option value="raised">Sort: Raised</option><option value="cash">Sort: Cash</option><option value="trades">Sort: Trades</option><option value="violations">Sort: Violations</option><option value="az">Sort: A–Z</option></select>
            <button onClick={()=>upd("fecOnly",!filters.fecOnly)} style={{...ss,background:filters.fecOnly?"rgba(16,185,129,.15)":"rgba(168,85,247,.06)",borderColor:filters.fecOnly?"rgba(16,185,129,.4)":"rgba(168,85,247,.2)",color:filters.fecOnly?"#34d399":"rgba(255,255,255,.5)",fontWeight:700,transition:"all .15s"}}>✓ FEC</button>
            <button onClick={()=>upd("hasViolations",!filters.hasViolations)} style={{...ss,background:filters.hasViolations?"rgba(239,68,68,.15)":"rgba(168,85,247,.06)",borderColor:filters.hasViolations?"rgba(239,68,68,.4)":"rgba(168,85,247,.2)",color:filters.hasViolations?"#f87171":"rgba(255,255,255,.5)",fontWeight:700,transition:"all .15s"}}>🚨 Violations</button>
          </div>
        </CW>
      </div>
      <CW pad="22px 28px">
        {shown.length===0?<div style={{textAlign:"center",padding:"80px 20px"}}><div style={{fontSize:36,marginBottom:12,opacity:.2}}>🔍</div><div style={{color:"rgba(255,255,255,.35)",fontSize:15,fontWeight:600}}>No officials match your filters</div><div style={{color:"rgba(255,255,255,.15)",fontSize:12,marginTop:6}}>Try adjusting your search or clearing filters</div></div>:
        <div style={{display:"grid",gridTemplateColumns:m?"1fr":"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
          {shown.map(p=>{const td=tradeMap[p.id]||{};const isW=user&&user.watchlist.includes(p.id);const hasV=td.violations>0;return(
            <div key={p.id} onClick={()=>onSelect(p)} onMouseEnter={e=>{e.currentTarget.style.borderColor=hasV?"rgba(239,68,68,.4)":"rgba(168,85,247,.4)";e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow=hasV?"0 8px 30px rgba(239,68,68,.12)":"0 8px 30px rgba(168,85,247,.12)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=hasV?"rgba(239,68,68,.15)":"rgba(168,85,247,.1)";e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}
              style={{background:"rgba(168,85,247,.03)",borderRadius:16,border:"1px solid "+(hasV?"rgba(239,68,68,.15)":"rgba(168,85,247,.1)"),padding:20,cursor:"pointer",transition:"all .2s cubic-bezier(.4,0,.2,1)",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:hasV?"rgba(239,68,68,.6)":"linear-gradient(90deg,"+PC[p.party]+","+PC[p.party]+"66)"}}/>
              {user&&<button onClick={e=>toggleWatch(p.id,e)} style={{position:"absolute",top:14,right:14,fontSize:9,fontWeight:700,background:isW?"rgba(16,185,129,.12)":"rgba(255,255,255,.06)",color:isW?"#34d399":"rgba(255,255,255,.35)",border:"1px solid "+(isW?"rgba(16,185,129,.3)":"rgba(255,255,255,.08)"),borderRadius:100,padding:"4px 10px",cursor:"pointer",zIndex:2,transition:"all .15s"}}>{isW?"✓ Watching":"+"}</button>}
              <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:14}}>
                <Avatar pol={p} size={44}/>
                <div style={{flex:1,minWidth:0,paddingRight:user?60:0}}>
                  <div style={{fontWeight:800,fontSize:14,color:"#fff",marginBottom:5,lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                  <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:4,background:PC[p.party]+"15",color:PC[p.party],border:"1px solid "+PC[p.party]+"22"}}>{PL[p.party]}</span>
                    <span style={{fontSize:9,color:"rgba(255,255,255,.3)",fontWeight:600}}>{p.chamber} · {p.state}</span>
                  </div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
                <div style={{background:"rgba(255,255,255,.03)",borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:8,color:"rgba(255,255,255,.2)",textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>Raised</div><div style={{fontSize:11,fontWeight:700,color:p.raised>0?"#10b981":"rgba(255,255,255,.12)"}}>{p.raised>0?fmt(p.raised):"--"}</div></div>
                <div style={{background:"rgba(255,255,255,.03)",borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:8,color:"rgba(255,255,255,.2)",textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>Cash</div><div style={{fontSize:11,fontWeight:700,color:p.cash>0?"#3b82f6":"rgba(255,255,255,.12)"}}>{p.cash>0?fmt(p.cash):"--"}</div></div>
                <div style={{background:td.violations>0?"rgba(239,68,68,.06)":"rgba(255,255,255,.03)",borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:8,color:"rgba(255,255,255,.2)",textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>Trades</div><div style={{fontSize:11,fontWeight:700,color:td.count>0?"#a78bfa":"rgba(255,255,255,.12)"}}>{td.count>0?td.count:"--"}{td.violations>0&&<span style={{color:"#ef4444",marginLeft:4,fontSize:10}}>⚠ {td.violations}</span>}</div></div>
              </div>
              <div style={{paddingTop:10,borderTop:"1px solid rgba(255,255,255,.04)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:11,color:"#a78bfa",fontWeight:700}}>View profile →</span>
                <div style={{display:"flex",gap:5}}>
                  {p.hasRealFinancials&&<span style={{fontSize:8,background:"rgba(16,185,129,.08)",color:"#10b981",padding:"2px 6px",borderRadius:4,fontWeight:700,border:"1px solid rgba(16,185,129,.15)"}}>FEC</span>}
                  {td.violations>0&&<span style={{fontSize:8,background:"rgba(239,68,68,.1)",color:"#f87171",padding:"2px 6px",borderRadius:4,fontWeight:800,border:"1px solid rgba(239,68,68,.2)"}}>VIOLATION</span>}
                </div>
              </div>
            </div>
          );})}
        </div>}
        {totalPgs>1&&(
          <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:6,marginTop:32,flexWrap:"wrap"}}>
            <button onClick={()=>pg>1&&setPg(p=>p-1)} style={{padding:"9px 18px",borderRadius:10,border:"1px solid "+(pg>1?"rgba(168,85,247,.25)":"rgba(255,255,255,.05)"),background:pg>1?"rgba(168,85,247,.08)":"transparent",color:pg>1?"#a78bfa":"rgba(255,255,255,.15)",cursor:pg>1?"pointer":"default",fontSize:13,fontWeight:600,transition:"all .15s"}}>← Prev</button>
            {Array.from({length:Math.min(7,totalPgs)},(_,i)=>{const p=pg<=4?i+1:pg+i-3;if(p<1||p>totalPgs)return null;return <button key={p} onClick={()=>setPg(p)} style={{width:38,height:38,borderRadius:10,border:"1px solid "+(pg===p?"rgba(168,85,247,.5)":"rgba(255,255,255,.06)"),background:pg===p?"rgba(168,85,247,.2)":"rgba(255,255,255,.02)",color:pg===p?"#c4b5fd":"rgba(255,255,255,.35)",cursor:"pointer",fontSize:13,fontWeight:pg===p?700:400,transition:"all .15s",display:"flex",alignItems:"center",justifyContent:"center"}}>{p}</button>;})}
            <button onClick={()=>pg<totalPgs&&setPg(p=>p+1)} style={{padding:"9px 18px",borderRadius:10,border:"1px solid "+(pg<totalPgs?"rgba(168,85,247,.25)":"rgba(255,255,255,.05)"),background:pg<totalPgs?"rgba(168,85,247,.08)":"transparent",color:pg<totalPgs?"#a78bfa":"rgba(255,255,255,.15)",cursor:pg<totalPgs?"pointer":"default",fontSize:13,fontWeight:600,transition:"all .15s"}}>Next →</button>
          </div>
        )}
      </CW>
    </div>
  );
}

/* ── NAV ────────────────────────────────── */
function Nav({page,onNav,user,onLogout,pols,violations}){
  const m=mob();const[open,setOpen]=useState(false);
  return(
    <div style={{background:"rgba(15,23,42,.97)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(168,85,247,.12)",padding:"11px 0",position:"sticky",top:32,zIndex:200,width:"100%"}}>
      <CW>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div onClick={()=>onNav("home")} style={{cursor:"pointer",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <div style={{width:30,height:30,borderRadius:9,background:"linear-gradient(135deg,#7c3aed,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:"#fff"}}>O</div>
            {!m&&<div><div style={{fontSize:15,fontWeight:900,color:"#fff",letterSpacing:-.3}}>Officium</div><div style={{fontSize:9,color:"rgba(168,85,247,.5)",letterSpacing:.5,textTransform:"uppercase"}}>Political Transparency</div></div>}
          </div>
          <div style={{flex:1}}/>
          {!m&&<div style={{display:"flex",gap:2,alignItems:"center"}}>
            {[["home","Home"],["browse","Browse"],user&&["dashboard","Dashboard"],user&&user.role==="admin"&&["admin","Admin"]].filter(Boolean).map(([p,l])=>(
              <button key={p} onClick={()=>onNav(p)} style={{padding:"6px 12px",borderRadius:8,border:"none",background:page===p?"rgba(168,85,247,.15)":"transparent",color:page===p?"#a78bfa":"rgba(255,255,255,.35)",fontWeight:600,fontSize:12,cursor:"pointer"}}>{l}</button>
            ))}
            {violations>0&&<span style={{fontSize:9,background:"rgba(239,68,68,.1)",color:"#fca5a5",border:"1px solid rgba(239,68,68,.25)",padding:"3px 9px",borderRadius:100,fontWeight:700,animation:"pulseDot 2s infinite",marginLeft:4}}>🚨 {violations}</span>}
            {user?<div style={{display:"flex",alignItems:"center",gap:8,marginLeft:6}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff"}}>{(user.name||"U")[0].toUpperCase()}</div>
              <button onClick={onLogout} style={{padding:"5px 10px",borderRadius:8,border:"1px solid rgba(255,255,255,.08)",background:"transparent",color:"rgba(255,255,255,.3)",fontSize:11,cursor:"pointer",fontWeight:600}}>Sign out</button>
            </div>:<button onClick={()=>onNav("auth")} style={{padding:"7px 14px",borderRadius:8,border:"1px solid rgba(168,85,247,.3)",background:"rgba(168,85,247,.1)",color:"#a78bfa",fontWeight:700,fontSize:12,cursor:"pointer"}}>Sign In</button>}
          </div>}
          {m&&<button onClick={()=>setOpen(!open)} style={{background:"none",border:"1px solid rgba(168,85,247,.2)",borderRadius:8,color:"#a78bfa",padding:"6px 10px",fontSize:12,cursor:"pointer"}}>{open?"✕":"☰"}</button>}
        </div>
        {m&&open&&<div style={{marginTop:12,paddingTop:12,borderTop:"1px solid rgba(168,85,247,.1)",display:"flex",flexDirection:"column",gap:3}}>
          {[["home","Home"],["browse","Browse"],user&&["dashboard","Dashboard"],user&&user.role==="admin"&&["admin","Admin"]].filter(Boolean).map(([p,l])=>(
            <button key={p} onClick={()=>{onNav(p);setOpen(false);}} style={{padding:"10px 12px",borderRadius:8,border:"none",background:page===p?"rgba(168,85,247,.12)":"transparent",color:page===p?"#a78bfa":"rgba(255,255,255,.4)",fontWeight:600,fontSize:13,cursor:"pointer",textAlign:"left"}}>{l}</button>
          ))}
          {user?<button onClick={()=>{onLogout();setOpen(false);}} style={{padding:"10px 12px",borderRadius:8,border:"none",background:"transparent",color:"rgba(255,255,255,.3)",fontSize:13,cursor:"pointer",textAlign:"left"}}>Sign out</button>:<button onClick={()=>{onNav("auth");setOpen(false);}} style={{padding:"10px 12px",borderRadius:8,border:"1px solid rgba(168,85,247,.2)",background:"rgba(168,85,247,.08)",color:"#a78bfa",fontSize:13,cursor:"pointer",textAlign:"left",fontWeight:700}}>Sign In / Create Account</button>}
        </div>}
      </CW>
    </div>
  );
}

/* ── HOME PAGE ──────────────────────────── */
function HomePage({pols,trades,onBrowse,onSelect,onLogin,user}){
  const[q,setQ]=useState("");const m=mob();
  const res=q.length>1?pols.filter(p=>p.name.toLowerCase().includes(q.toLowerCase())||(p.state||"").toUpperCase()===q.toUpperCase()).slice(0,7):[];
  return(
    <div style={{width:"100%"}}>
      {/* HERO — centered, deep purple */}
      <div style={{position:"relative",minHeight:"100svh",background:"linear-gradient(135deg,#0f172a 0%,#1e1b4b 25%,#312e81 45%,#1e1b4b 65%,#0f172a 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
        {/* Orbs — vibrant gradient blobs */}
        <div style={{position:"absolute",width:900,height:900,borderRadius:"50%",background:"radial-gradient(circle,rgba(99,102,241,.25) 0%,rgba(79,70,229,.1) 40%,transparent 70%)",top:"-300px",left:"20%",animation:"orbA 32s ease-in-out infinite",pointerEvents:"none"}}/>
        <div style={{position:"absolute",width:700,height:700,borderRadius:"50%",background:"radial-gradient(circle,rgba(168,85,247,.2) 0%,rgba(139,92,246,.08) 40%,transparent 70%)",bottom:"-200px",right:"-50px",animation:"orbB 24s ease-in-out infinite",pointerEvents:"none"}}/>
        <div style={{position:"absolute",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(14,165,233,.15) 0%,transparent 65%)",top:"40%",left:"-120px",animation:"orbA 20s ease-in-out infinite",animationDelay:"-10s",pointerEvents:"none"}}/>
        <div style={{position:"absolute",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(236,72,153,.1) 0%,transparent 60%)",top:"10%",right:"5%",animation:"orbB 28s ease-in-out infinite",animationDelay:"-5s",pointerEvents:"none"}}/>
        <div style={{position:"absolute",inset:0,opacity:.45,pointerEvents:"none"}}><FloatingCards pols={pols} trades={trades} onSelect={onSelect}/></div>
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:.02,pointerEvents:"none"}}><defs><pattern id="grd" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="#6366f1" strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#grd)"/></svg>
        <div style={{position:"absolute",left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(99,102,241,.12),transparent)",animation:"scanline 12s linear infinite",pointerEvents:"none"}}/>
        {/* Vignette overlay for text readability */}
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 50%,rgba(15,23,42,.5) 0%,transparent 65%)",pointerEvents:"none",zIndex:1}}/>
        {/* Centered hero content */}
        <div style={{position:"relative",zIndex:2,textAlign:"center",padding:m?"80px 24px 40px":"100px 40px 60px",maxWidth:680,width:"100%"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:7,background:"rgba(168,85,247,.12)",border:"1px solid rgba(168,85,247,.3)",borderRadius:100,padding:"7px 20px",marginBottom:32,backdropFilter:"blur(12px)"}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 8px #22c55e",animation:"pulse 2s ease infinite"}}/>
            <span style={{fontSize:10,fontWeight:700,color:"#c4b5fd",letterSpacing:1.2,textTransform:"uppercase"}}>{pols.length} Members · {(trades||[]).filter(t=>t.gap>45).length} Violations Detected · Live</span>
          </div>
          <HeroText/>
          <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:32,marginBottom:44,justifyContent:"center"}}>
            <button onClick={onBrowse} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 36px rgba(124,58,237,.5)";}} onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 6px 28px rgba(124,58,237,.35)";}} style={{background:"linear-gradient(135deg,#7c3aed,#a78bfa)",color:"#fff",border:"none",borderRadius:12,padding:m?"14px 28px":"16px 40px",fontSize:m?13:15,fontWeight:800,cursor:"pointer",boxShadow:"0 6px 28px rgba(124,58,237,.35)",whiteSpace:"nowrap",transition:"all .2s ease"}}>Browse {pols.length} Officials →</button>
            {!user?<button onClick={onLogin} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(168,85,247,.5)";e.currentTarget.style.background="rgba(168,85,247,.12)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(168,85,247,.25)";e.currentTarget.style.background="rgba(168,85,247,.06)";}} style={{background:"rgba(168,85,247,.06)",color:"rgba(255,255,255,.75)",border:"1.5px solid rgba(168,85,247,.25)",borderRadius:12,padding:m?"14px 28px":"16px 32px",fontSize:m?13:15,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",backdropFilter:"blur(8px)",transition:"all .2s ease"}}>Create Account</button>:<button onClick={()=>window.__goSel&&window.__goSel(pols[Math.floor(Math.random()*pols.length)])} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(168,85,247,.5)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(168,85,247,.25)";}} style={{background:"rgba(168,85,247,.06)",color:"rgba(255,255,255,.75)",border:"1.5px solid rgba(168,85,247,.25)",borderRadius:12,padding:m?"14px 28px":"16px 32px",fontSize:m?13:15,fontWeight:600,cursor:"pointer",backdropFilter:"blur(8px)",transition:"all .2s ease"}}>Random Official</button>}
          </div>
          {/* Search */}
          <div style={{position:"relative",maxWidth:520,margin:"0 auto"}}>
            <input value={q} onChange={e=>setQ(san(e.target.value))} placeholder={`Search ${pols.length} officials by name or state...`} maxLength={80}
              style={{width:"100%",padding:"16px 20px 16px 48px",borderRadius:14,border:"1.5px solid rgba(168,85,247,.2)",background:"rgba(10,5,25,.7)",backdropFilter:"blur(16px)",color:"#fff",fontSize:14,outline:"none",boxSizing:"border-box",transition:"border-color .2s,box-shadow .2s"}}
              onFocus={e=>{e.target.style.borderColor="rgba(168,85,247,.6)";e.target.style.boxShadow="0 0 0 3px rgba(168,85,247,.1)";}} onBlur={e=>{e.target.style.borderColor="rgba(168,85,247,.2)";e.target.style.boxShadow="none";}}/>
            <svg style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",opacity:.4,pointerEvents:"none"}} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            {res.length>0&&(
              <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"#1e1b4b",borderRadius:13,boxShadow:"0 20px 60px rgba(0,0,0,.7)",zIndex:50,overflow:"hidden",border:"1px solid rgba(168,85,247,.25)"}}>
                {res.map(p=>(
                  <div key={p.id} onClick={()=>{setQ("");onSelect(p);}} onMouseEnter={e=>e.currentTarget.style.background="rgba(168,85,247,.08)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                    style={{display:"flex",alignItems:"center",gap:11,padding:"11px 18px",cursor:"pointer",borderBottom:"1px solid rgba(168,85,247,.06)"}}>
                    <Avatar pol={p} size={30}/>
                    <div style={{flex:1,textAlign:"left"}}><div style={{fontWeight:600,fontSize:13,color:"#fff"}}>{p.name}</div><div style={{fontSize:10,color:"rgba(255,255,255,.3)"}}>{p.chamber} · {p.state}{p.raised>0?" · "+fmt(p.raised)+" raised":""}</div></div>
                    {p.hasRealFinancials&&<span style={{fontSize:8,background:"rgba(16,185,129,.1)",color:"#34d399",padding:"1px 5px",borderRadius:3,fontWeight:700}}>FEC</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{position:"absolute",bottom:20,left:"50%",transform:"translateX(-50%)",display:"flex",flexDirection:"column",alignItems:"center",gap:5,zIndex:2}}>
          <span style={{fontSize:9,color:"rgba(255,255,255,.12)",fontWeight:600,textTransform:"uppercase",letterSpacing:1.5}}>Scroll to explore</span>
          <div style={{width:1,height:28,background:"linear-gradient(to bottom,rgba(168,85,247,.3),transparent)"}}/>
        </div>
      </div>
      <LiveStrip pols={pols} trades={trades}/>
      {/* Ticker */}
      <div style={{background:"linear-gradient(90deg,#7c3aed,#6d28d9,#7c3aed)",overflow:"hidden",padding:"8px 0",position:"relative"}}>
        <div style={{position:"absolute",left:0,top:0,bottom:0,width:60,background:"linear-gradient(90deg,#7c3aed,transparent)",zIndex:2}}/>
        <div style={{position:"absolute",right:0,top:0,bottom:0,width:60,background:"linear-gradient(270deg,#7c3aed,transparent)",zIndex:2}}/>
        <div style={{display:"flex",animation:"ticker 260s linear infinite",width:"max-content"}}>
          {pols.slice(0,30).concat(pols.slice(0,30)).map((p,i)=>(
            <span key={i} style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,.9)",padding:"0 40px",whiteSpace:"nowrap"}}>
              {i%5===0?"🚨 VIOLATION":i%5===1?"🏛 SENATE":i%5===2?"💰 FEC":i%5===3?"📋 LOBBYING":"🏠 HOUSE"} · {p.name} · {p.state}{p.raised>0?" · "+fmt(p.raised):""}
            </span>
          ))}
        </div>
      </div>
      <IntelFeed trades={trades}/>
      <ViolationBoard trades={trades} pols={pols} onSelect={onSelect}/>
      <TradingTimeline trades={trades}/>
      <SectorHeatmap trades={trades}/>
      <FollowMoney pols={pols} trades={trades} onSelect={p=>{window.__goSel&&window.__goSel(p);}}/>
      <FARASection/>
      <LDASection/>
      <SpendingSection/>
      <BillsSection/>
      {/* Footer */}
      <div style={{background:"linear-gradient(180deg,#07030f,#1e1b4b)",borderTop:"1px solid rgba(168,85,247,.08)",padding:"48px 0 36px"}}>
        <CW>
          <div style={{display:"flex",flexDirection:m?"column":"row",gap:m?24:48,alignItems:m?"center":"flex-start",marginBottom:28}}>
            <div style={{textAlign:m?"center":"left"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,justifyContent:m?"center":"flex-start"}}>
                <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#7c3aed,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:"#fff"}}>O</div>
                <span style={{fontSize:16,fontWeight:900,color:"#fff",letterSpacing:-.3}}>Officium</span>
              </div>
              <p style={{fontSize:11,color:"rgba(255,255,255,.2)",margin:0,lineHeight:1.6,maxWidth:280}}>Latin for duty. Tracking congressional finances, trades, and lobbying with full transparency.</p>
            </div>
            <div style={{flex:1}}/>
            <div style={{textAlign:m?"center":"right"}}>
              <div style={{fontSize:9,color:"rgba(255,255,255,.15)",textTransform:"uppercase",letterSpacing:1,marginBottom:8,fontWeight:600}}>Data Sources</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:m?"center":"flex-end"}}>
                {["FEC","Congress.gov","HouseStockWatcher","SenateStockWatcher","LDA","USASpending","Treasury","FedRegister"].map(s=>(
                  <span key={s} style={{fontSize:9,color:"rgba(255,255,255,.15)",background:"rgba(255,255,255,.03)",padding:"3px 8px",borderRadius:4,fontWeight:500}}>{s}</span>
                ))}
              </div>
            </div>
          </div>
          <div style={{borderTop:"1px solid rgba(255,255,255,.04)",paddingTop:16,display:"flex",justifyContent:"center"}}>
            <span style={{fontSize:10,color:"rgba(255,255,255,.1)"}}>{pols.length} officials tracked · All data from public government APIs</span>
          </div>
        </CW>
      </div>
    </div>
  );
}

/* ── APP ────────────────────────────────── */
export default function App(){
  useEffect(()=>{if(!document.getElementById("off-css")){const s=document.createElement("style");s.id="off-css";s.textContent=CSS;document.head.appendChild(s);}},[]);
  const[pols,setPols]=useState([]);const[trades,setTrades]=useState([]);const[page,setPage]=useState("home");const[sel,setSel]=useState(null);const[user,setUser]=useState(null);const[sessLoading,setSL]=useState(true);
  useEffect(()=>{
    getSession().then(s=>{setUser(s);setSL(false);}).catch(()=>setSL(false));
    const sp=buildStatic({});setPols(sp);
    FEC_P.then(fd=>{
      setPols(prev=>prev.map(p=>{if(p.raised>0)return p;const fr=lookupFEC(p.name,p.state,fd);if(!fr)return p;return{...p,raised:fr.receipts||0,spent:fr.disbursements||0,cash:fr.cash_on_hand_end_period||0,hasRealFinancials:true,fecId:fr.candidate_id||null,fecUrl:fr.candidate_id?"https://www.fec.gov/data/candidate/"+fr.candidate_id+"/":""};}));
      loadMembers(live=>{if(live&&live.length>0)setPols(live);});
    }).catch(()=>loadMembers(live=>{if(live&&live.length>0)setPols(live);}));
    ALL_TRADES_P.then(setTrades).catch(()=>{});
    window.__goSel=p=>{setSel(p);setPage("profile");};
    return()=>{delete window.__goSel;};
  },[]);
  const nav=p=>{if(p!=="profile")setSel(null);setPage(p);window.scrollTo({top:0,behavior:"smooth"});};
  const goSel=p=>{setSel(p);setPage("profile");};
  const onAuth=async u=>{setUser(u);if(!u){nav("home");return;}nav(u.role==="admin"?"admin":"dashboard");};
  const onLogout=async()=>{await clearSession();setUser(null);nav("home");};
  const violations=useMemo(()=>trades.filter(t=>t.gap>45).length,[trades]);
  if(sessLoading)return <div style={{minHeight:"100vh",background:"#0f172a",display:"flex",alignItems:"center",justifyContent:"center"}}><Spin sz={32}/></div>;
  return(
    <div style={{display:"flex",flexDirection:"column",minHeight:"100vh",overflowX:"hidden",background:"#0f172a"}}>
      <ApiBar/>
      {page!=="auth"&&<Nav page={page} onNav={nav} user={user} onLogout={onLogout} pols={pols} violations={violations}/>}
      {page!=="home"&&page!=="auth"&&(
        <div style={{background:"rgba(168,85,247,.04)",borderBottom:"1px solid rgba(168,85,247,.08)",padding:"6px 0"}}>
          <CW><div style={{fontSize:11,color:"rgba(255,255,255,.3)",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <span style={{fontWeight:500}}>{pols.length} officials</span>
            <span style={{color:"rgba(255,255,255,.1)"}}>·</span>
            <span>{pols.filter(p=>p.chamber==="Senate").length}S + {pols.filter(p=>p.chamber==="House").length}H</span>
            <span style={{color:"rgba(255,255,255,.1)"}}>·</span>
            <span>{pols.filter(p=>p.hasRealFinancials).length} FEC</span>
            <span style={{color:"rgba(255,255,255,.1)"}}>·</span>
            <span>{trades.length} trades</span>
            {violations>0&&<><span style={{color:"rgba(255,255,255,.1)"}}>·</span><span style={{color:"#f87171",fontWeight:700}}>🚨 {violations} violations</span></>}
            <span style={{marginLeft:"auto",fontSize:9,color:"rgba(168,85,247,.35)",fontWeight:500}}>Cached 4h</span>
          </div></CW>
        </div>
      )}
      <div style={{flex:1}}>
        {page==="home"&&<HomePage pols={pols} trades={trades} onBrowse={()=>nav("browse")} onSelect={goSel} onLogin={()=>nav("auth")} user={user}/>}
        {page==="auth"&&<AuthPage onAuth={onAuth}/>}
        {page==="browse"&&<BrowsePage pols={pols} trades={trades} onSelect={goSel} user={user} onSetUser={setUser}/>}
        {page==="profile"&&sel&&<ProfilePage pol={sel} onBack={()=>nav("browse")} user={user} onSetUser={setUser}/>}
        {page==="dashboard"&&(user?<UserDashboard user={user} pols={pols} onSelect={goSel} onSetUser={setUser}/>:<AuthPage onAuth={onAuth}/>)}
        {page==="admin"&&(user&&user.role==="admin"?<AdminDashboard pols={pols} trades={trades}/>:<AuthPage onAuth={onAuth}/>)}
      </div>
    </div>
  );
}
