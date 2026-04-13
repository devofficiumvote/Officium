import{useState,useEffect,useMemo,useRef,useCallback}from"react";
import*as d3 from"d3";

const CSS=`@keyframes spin{to{transform:rotate(360deg)}}@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}@keyframes floatA{0%,100%{transform:translate(0,0)}33%{transform:translate(14px,-20px)}66%{transform:translate(-10px,14px)}}@keyframes floatB{0%,100%{transform:translate(0,0)}40%{transform:translate(-18px,-16px)}80%{transform:translate(14px,18px)}}@keyframes floatC{0%,100%{transform:translate(0,0)}50%{transform:translate(16px,-12px)}}@keyframes floatD{0%,100%{transform:translate(0,0)}30%{transform:translate(-12px,18px)}70%{transform:translate(20px,-10px)}}@keyframes orbA{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(50px,-40px) scale(1.08)}66%{transform:translate(-30px,40px) scale(.93)}}@keyframes orbB{0%,100%{transform:translate(0,0)}40%{transform:translate(-45px,35px)}80%{transform:translate(35px,-55px)}}@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}@keyframes pulseDot{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.5)}70%{box-shadow:0 0 0 10px rgba(220,38,38,0)}}@keyframes slideIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}@keyframes glow{0%,100%{text-shadow:0 0 30px rgba(168,85,247,.2)}50%{text-shadow:0 0 60px rgba(168,85,247,.5),0 0 100px rgba(168,85,247,.15)}}@keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(200vh)}}@keyframes countUp{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}@keyframes borderPulse{0%,100%{border-color:rgba(168,85,247,.3)}50%{border-color:rgba(168,85,247,.8)}}`;

/* ── KEYS ─────────────────────────────── */
const FEC_KEY="4uo7FCQmyE9DEs8zu47ejJtDdma0Sae5WNabLxUu";
const CGK="YdbWI0KzqPkIvv9vcx3z6dQpaG6ARB8cSr7HOdWC";
const PXK="https://corsproxy.io/?key=4aa30d17&url=";
const PX2="https://corsproxy.io/?url=";
/* S3 buckets are dead (403) — GitHub raw for Senate, House data unavailable */
/* House Stock Watcher removed — S3 bucket permanently offline (403) */
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
function classifyTicker(ticker){
  if(!ticker)return"Other";
  if(["NVDA","AMD","INTC","QCOM","TSM","MSFT","AAPL","GOOGL","META","AMZN","CRM","ORCL","ADBE","NFLX"].includes(ticker))return"Technology";
  if(["LMT","RTX","NOC","GD","BA","HII","LHX"].includes(ticker))return"Defense";
  if(["XOM","CVX","COP","OXY","SLB","HAL"].includes(ticker))return"Energy";
  if(["JPM","GS","MS","BAC","WFC","BLK","C","AXP","V","MA"].includes(ticker))return"Finance";
  if(["PFE","MRNA","JNJ","ABBV","MRK","LLY","BMY","AMGN","GILD"].includes(ticker))return"Pharma";
  if(["UNH","HCA","CI","ELV","HUM","CVS"].includes(ticker))return"Healthcare";
  return"Other";
}
function computeVoteProximity(trade,votes){
  if(!trade.tradeDate||!votes||!votes.length)return null;
  const td=new Date(trade.tradeDate);
  if(isNaN(td))return null;
  const nearby=votes.filter(v=>{
    const vd=new Date((v.created||"").slice(0,10));
    if(isNaN(vd))return false;
    const gap=Math.abs(td-vd)/86400000;
    return gap<=30;
  });
  return nearby.length>0?{count:nearby.length,votes:nearby.slice(0,3)}:null;
}
function Disclaimer(){
  return <div style={{fontSize:12,color:"rgba(255,255,255,.2)",fontStyle:"italic",padding:"8px 0",borderTop:"1px solid rgba(255,255,255,.04)",marginTop:12}}>Correlation does not imply causation. All data sourced from official public government disclosures.</div>;
}
const NICKS={chuck:"charles",bob:"robert",bill:"william",mike:"michael",jim:"james",joe:"joseph",tom:"thomas",ted:"edward",bernie:"bernard",liz:"elizabeth",ron:"ronald",rick:"richard",dan:"daniel",dave:"david",tim:"timothy",chris:"christopher",matt:"matthew",al:"albert"};
/* Manual FEC ID mapping for members that fuzzy matching can't resolve (accented names, hyphenated, territories) */
const MANUAL_FEC={"Alexandria Ocasio-Cortez":"H8NY15148","Nydia M. Velázquez":"H2NY00010","Linda T. Sánchez":"H2CA39078","Ben Ray Luján":"S0NM00058","Cindy Hyde-Smith":"S8MS00261","Jesús G. \"Chuy\" García":"H8IL04134","Mario Diaz-Balart":"H2FL25018","Mariannette Miller-Meeks":"H8IA02043","Sydney Kamlager-Dove":"H2CA37304","Sheila Cherfilus-McCormick":"H8FL20032","Nanette Diaz Barragán":"H6CA44103","Stacey E. Plaskett":"H2VI00082","Pablo Jose Hernández":"H4PR01010","Kimberlyn King-Hinds":"H4MP01022","Aumua Amata Coleman Radewagen":"H4AS00036"};
/* Strip unicode accents for fuzzy matching */
const stripAccents=s=>(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
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
const normS2=t=>({name:t.senator||t.name||"",ticker:t.ticker&&t.ticker!="--"&&t.ticker!="N/A"?t.ticker:"",action:/sale|sell/i.test(t.type||t.transaction_type||"")?"SELL":"BUY",amount:t.amount||"--",tradeDate:t.transaction_date||"--",filedDate:t.disclosure_date||"--",gap:computeGap(t.transaction_date,t.disclosure_date),party:t.party||"",state:t.state||"",source:"Senate",description:t.asset_description||t.asset_name||"",owner:t.owner||"",assetType:t.asset_type||""});
function flagTrade(t){
  const g=t.gap||0;
  if(g>45)return{color:"#ef4444",badge:"VIOLATION",txt:`Filed ${g} days after trade — exceeds the 45-day STOCK Act deadline by ${g-45} days. The STOCK Act of 2012 requires members of Congress to disclose stock trades within 45 calendar days.`};
  if(g>30)return{color:"#f59e0b",badge:"LATE",txt:`Filed ${g} days after trade — approaching the 45-day STOCK Act deadline. Only ${45-g} days remaining before this becomes a violation.`};
  if(/500,000|1,000,000|5,000,001|50,000,001/.test(t.amount||""))return{color:"#a855f7",badge:"HIGH VALUE",txt:`Trade amount ${t.amount} exceeds $500,000. Large trades by members of Congress receive extra scrutiny under the STOCK Act.`};
  return null;
}
const calcRisk=(trades,raised)=>{let s=0;s+=Math.min(45,trades.filter(t=>t.gap>45).length*15);s+=Math.min(20,trades.filter(t=>t.gap>30&&t.gap<=45).length*5);s+=Math.min(15,trades.filter(t=>/500,000|1,000,000/.test(t.amount||"")).length*7);s+=trades.length>25?10:trades.length>10?5:0;s+=raised>10e6?8:raised>5e6?4:raised>1e6?2:0;return Math.min(100,s);};
const riskColor=r=>r>60?"#ef4444":r>30?"#f59e0b":"#10b981";
const riskLabel=r=>r>60?"HIGH":r>30?"MODERATE":"LOW";

/* ── TRADE→POL MATCHING (handles "David A Perdue , Jr" etc.) ── */
function findPolForTrade(t,pols){
  if(!t.name||!pols.length)return null;
  const tn=(t.name||"").toLowerCase().trim();
  const parts=tn.split(/[\s,]+/).filter(Boolean);
  const last=parts.filter(w=>!["jr","sr","ii","iii","iv","jr.","sr."].includes(w)).pop()||"";
  if(last.length<3)return null;
  const first=parts[0]||"";
  return pols.find(p=>{const pn=p.name.toLowerCase();return pn.endsWith(last)&&pn.startsWith(first[0]);})||pols.find(p=>p.name.toLowerCase().includes(last)&&last.length>=4)||null;
}

/* ── DATA FRESHNESS WARNING ── */
function DataFreshness({trades}){
  const dates=(trades||[]).map(t=>t.tradeDate).filter(t=>t&&t!=="--").sort();
  if(!dates.length)return null;
  const newest=dates[dates.length-1];
  const newestDate=new Date(newest);
  const daysOld=Math.round((Date.now()-newestDate.getTime())/86400000);
  const isStale=daysOld>365;
  return(
    <div style={{display:"inline-flex",alignItems:"center",gap:6,background:isStale?"rgba(245,158,11,.1)":"rgba(34,197,94,.1)",border:"1px solid "+(isStale?"rgba(245,158,11,.25)":"rgba(34,197,94,.25)"),borderRadius:100,padding:"4px 12px",fontSize:12,fontWeight:600,color:isStale?"#fbbf24":"#4ade80"}}>
      {isStale?"⚠":"✓"} Data: {dates[0].slice(0,7)} to {newest.slice(0,7)}{isStale?" · Source no longer updated":""}
    </div>
  );
}
function LastUpdated({label}){
  return <span style={{fontSize:12,color:"rgba(255,255,255,.2)",fontStyle:"italic"}}>{label||"Updated "+new Date().toLocaleDateString()}</span>;
}

/* ── POWER INDEX — cross-reference composite score ── */
function computePowerIndex(pol, tradeCount) {
  let pi = 0;
  pi += Math.min(25, Math.round(((pol.raised||0) / 50e6) * 25));
  pi += Math.min(20, (tradeCount||0) * 2);
  pi += Math.min(20, pol.raised > 0 ? Math.round(((pol.pacContrib||0) / pol.raised) * 20) : 0);
  pi += Math.min(20, Math.round(((pol.yearsInOffice||0) / 30) * 20));
  pi += Math.min(15, (pol.debts||0) > 100000 ? 15 : Math.round(((pol.debts||0) / 100000) * 15));
  return Math.min(100, pi);
}

function computeAccountabilityScore(pol, trades) {
  // BRD §13: Composite 0-100 score
  // Component 1: Donor Alignment (25%) — how much PAC $ vs individual
  const pacRatio = pol.raised > 0 ? (pol.pacContrib || 0) / pol.raised : 0;
  const donorScore = Math.round((1 - pacRatio) * 25); // Higher = more individual-funded = better

  // Component 2: Party Independence (15%) — ideology distance from party median
  const partyMedian = pol.party === "D" ? -0.35 : pol.party === "R" ? 0.45 : 0;
  const ideologyDist = pol.ideology != null ? Math.abs(pol.ideology - partyMedian) : 0;
  const independenceScore = Math.round(Math.min(15, ideologyDist * 30));

  // Component 3: Voting Participation (20%) — replaces Voter Representation (needs polling data)
  const participationRate = pol.totalVotes > 0 ? 1 - (pol.absentCount / pol.totalVotes) : 0.5;
  const participationScore = Math.round(participationRate * 20);

  // Component 4: Financial Transparency (20%) — replaces Promise Fulfillment (needs promise data)
  const tradeCount = (trades || []).filter(t => {
    const ln = (t.name || "").toLowerCase().split(/\s+/).pop();
    return ln.length >= 3 && pol.name.toLowerCase().endsWith(ln);
  }).length;
  const hasTimely = tradeCount > 0; // They at least file disclosures
  const gapAvg = tradeCount > 0 ? (trades || []).filter(t => {
    const ln = (t.name || "").toLowerCase().split(/\s+/).pop();
    return ln.length >= 3 && pol.name.toLowerCase().endsWith(ln);
  }).reduce((a, t) => a + (t.gap || 0), 0) / tradeCount : 0;
  const transparencyScore = tradeCount === 0 ? 10 : gapAvg <= 45 ? 20 : gapAvg <= 90 ? 10 : 0;

  // Component 5: Trading Pattern (5%) — do they trade in sectors they legislate on?
  const tradingScore = tradeCount === 0 ? 5 : tradeCount > 20 ? 0 : 3;

  // Component 6: Dark Money Exposure (5%) — ratio of PAC to total
  const darkMoneyScore = pacRatio < 0.2 ? 5 : pacRatio < 0.5 ? 3 : 0;

  // Component 7: Committee Conflict (10%) — sector-based proxy (BRD §18)
  // Committee Conflict: check if member trades in same sectors they receive PAC money from
  const memberTrades = (trades || []).filter(t => {
    const ln = (t.name || "").toLowerCase().split(/\s+/).pop();
    return ln.length >= 3 && pol.name.toLowerCase().endsWith(ln);
  });
  const tradeSectors = new Set(memberTrades.map(t => classifyTicker(t.ticker)).filter(s => s !== "Other"));
  const hasSectorConflict = tradeSectors.size > 0 && pol.pacContrib > 0;
  const committeeScore = hasSectorConflict ? 2 : tradeSectors.size === 0 ? 8 : 5;

  return {
    total: donorScore + independenceScore + participationScore + transparencyScore + tradingScore + darkMoneyScore + committeeScore,
    components: [
      { label: "Donor Independence", score: donorScore, max: 25, explain: `How much funding comes from individual donors vs PACs. ${Math.round((1-pacRatio)*100)}% individual-funded. Higher = less dependent on special interests.` },
      { label: "Party Independence", score: independenceScore, max: 15, explain: `How far their voting record deviates from their party's median ideology. ${pol.ideology!=null?"DW-NOMINATE: "+pol.ideology.toFixed(2)+". ":""}Higher = more independent, votes across party lines more often.` },
      { label: "Voting Participation", score: participationScore, max: 20, explain: `How often they show up to vote. ${pol.totalVotes>0?Math.round(participationRate*100)+"% attendance ("+pol.absentCount+" missed).":"No voting data."} Higher = more engaged in the legislative process.` },
      { label: "Financial Transparency", score: transparencyScore, max: 20, explain: `How timely they file STOCK Act disclosures. ${tradeCount>0?"Avg filing delay: "+Math.round(gapAvg)+" days (45-day limit). "+tradeCount+" trades disclosed.":"No stock trades on record."} Higher = more timely and transparent.` },
      { label: "Committee Conflict", score: committeeScore, max: 10, explain: `Whether they trade stocks in sectors they may have legislative influence over. ${hasSectorConflict?"Trades in "+[...tradeSectors].join(", ")+" while receiving PAC money — potential conflict.":"No sector overlap detected."} Higher = fewer conflicts.` },
      { label: "Dark Money Exposure", score: darkMoneyScore, max: 5, explain: `What percentage of funding comes from PACs and political committees vs traceable individual donors. ${Math.round(pacRatio*100)}% from PACs. Higher = more transparent funding sources.` },
      { label: "Trading Pattern", score: tradingScore, max: 5, explain: `Volume of stock trading activity. ${tradeCount} disclosed trades. ${tradeCount>20?"Heavy trading activity raises scrutiny.":tradeCount===0?"No trading activity on record.":"Moderate trading volume."} Higher = less trading activity.` },
    ]
  };
}

/* ── S3 DATA ──────────────────────────── */
/* House Stock Watcher S3 is permanently offline (403). No free alternative exists. */
const HOUSE_P=Promise.resolve([]);
const SENATE_P=withCache("senate_v9",async()=>{
  for(const u of[SENATE_S3,SENATE_S3_FB,PXK+encodeURIComponent(SENATE_S3_FB)]){
    try{const r=await fetch(u,{signal:AbortSignal.timeout(30000)});if(!r.ok)continue;const d=await r.json();const a=Array.isArray(d)?d:(d.data||[]);if(!a.length)continue;
    /* Normalize dates to ISO format before filtering */
    const norm=a.map(t=>({...t,transaction_date:toISO(t.transaction_date),disclosure_date:toISO(t.disclosure_date)}));
    return norm.filter(t=>{const dt=(t.disclosure_date&&t.disclosure_date!=="--"?t.disclosure_date:null)||(t.transaction_date&&t.transaction_date!=="--"?t.transaction_date:null)||"";return dt>="2019-01-01";}).sort((a,b)=>((b.transaction_date&&b.transaction_date!=="--"?b.transaction_date:"")||(b.disclosure_date||"")).localeCompare((a.transaction_date&&a.transaction_date!=="--"?a.transaction_date:"")||(a.disclosure_date||""))).slice(0,1500).map(normS2);}catch(e){console.warn("Senate trades fetch failed:",u);}
  }return[];
});
const QUIVER_P=withCache("quiver_v1",async()=>{
  try{
    const r=await fetch("/data/congress-trades.json",{signal:AbortSignal.timeout(5000)});
    if(!r.ok)return[];
    const d=await r.json();
    console.log(`QuiverQuant loaded ${d.count} current trades (${d.dateRange?.from} to ${d.dateRange?.to})`);
    return d.trades||[];
  }catch(e){console.warn("QuiverQuant:",e.message);return[];}
});
const ALL_TRADES_P=withCache("all_v15",async()=>{
  const[h,s,q]=await Promise.all([HOUSE_P.catch(()=>[]),SENATE_P.catch(()=>[]),QUIVER_P.catch(()=>[])]);
  /* QuiverQuant data is the most current — prioritize it, then add older Senate data */
  const all=[...q,...h,...s];
  const seen=new Set();
  return all.filter(t=>{
    const k=(t.name||"")+"_"+(t.ticker||"")+"_"+(t.tradeDate||"")+"_"+(t.action||"");
    if(seen.has(k))return false;seen.add(k);return true;
  }).sort((a,b)=>(b.tradeDate||b.filedDate||"").localeCompare(a.tradeDate||a.filedDate||""));
});
async function tradesFor(name){
  const k="ct7_"+name;const c=gc(k);if(c)return c;
  const last=name.split(" ").pop().toLowerCase();const first=name.split(" ")[0].toLowerCase();
  const[h,s,q]=await Promise.all([HOUSE_P.catch(()=>[]),SENATE_P.catch(()=>[]),QUIVER_P.catch(()=>[])]);
  const all=[...q,...h,...s].filter(t=>{const n=(t.name||"").toLowerCase();return n.includes(last)&&(n.includes(first)||(NICKS[first]&&n.includes(NICKS[first]))||last.length>5);});
  /* Deduplicate */
  const seen=new Set();const deduped=all.filter(t=>{const dk=t.name+"_"+t.ticker+"_"+t.tradeDate+"_"+t.action;if(seen.has(dk))return false;seen.add(dk);return true;});
  deduped.sort((a,b)=>(b.tradeDate||"").localeCompare(a.tradeDate||""));
  sc(k,deduped);return deduped;
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
const FEC_P=withCache("fec_v20",async()=>{
  /* Try pre-cached static file first (generated by GitHub Actions cron) */
  try{
    const r=await fetch("/data/fec-candidates.json",{signal:AbortSignal.timeout(5000)});
    if(r.ok){const d=await r.json();if(d.count>500){console.log(`FEC loaded ${d.count} candidates from static cache (${d.fetchedAt})`);return{count:d.count,byLast:d.byLast,byFull:d.byFull};}}
  }catch(e){}
  /* Fallback: fetch live from FEC API */
  console.log("FEC static cache not available, fetching live...");
  const all=[];const delay=ms=>new Promise(r=>setTimeout(r,ms));
  for(const cyc of["","&cycle=2024","&cycle=2022"]){
    for(let pg=1;pg<=5;pg++){
      const[rs,rh]=await Promise.all([
        fetch(`https://api.open.fec.gov/v1/candidates/totals/?office=S&per_page=100&page=${pg}&sort=-receipts${cyc}&api_key=${FEC_KEY}`,{signal:AbortSignal.timeout(12000)}).then(r=>r.ok?r.json():{results:[]}).catch(()=>({results:[]})),
        fetch(`https://api.open.fec.gov/v1/candidates/totals/?office=H&per_page=100&page=${pg}&sort=-receipts${cyc}&api_key=${FEC_KEY}`,{signal:AbortSignal.timeout(12000)}).then(r=>r.ok?r.json():{results:[]}).catch(()=>({results:[]}))
      ]);
      all.push(...(rs.results||[]),...(rh.results||[]));
      await delay(700);
      if((rs.results||[]).length<100&&(rh.results||[]).length<100)break;
    }
  }
  if(!all.length)throw new Error("FEC returned 0");
  console.log(`FEC live loaded ${all.length} candidate records`);
  const byLast={},byFull={};
  all.forEach(f=>{if(!f.name||!f.state)return;const raw=f.name.toUpperCase();const last=raw.split(",")[0].trim().toLowerCase();const stL=f.state.toLowerCase();const lk=last+"_"+stL;if(!byLast[lk]||(f.receipts||0)>((byLast[lk]||{}).receipts||0))byLast[lk]=f;const pts=raw.split(",");if(pts[1]){const first=pts[1].trim().split(/\s+/)[0].toLowerCase();byFull[last+"_"+first+"_"+stL]=f;}});
  return{count:all.length,byLast,byFull};
});
function lookupFEC(name,state,fd){
  fd=fd||{};const byLast=fd.byLast||{},byFull=fd.byFull||{};
  const stL=(state||"").toLowerCase();
  /* Normalize: strip accents, remove suffixes, handle hyphens */
  const cleaned=stripAccents(normS(name)).replace(/\b(jr|sr|ii|iii)\b/g,"").replace(/-/g," ").trim();
  const words=cleaned.split(" ").filter(Boolean);
  if(!words.length)return null;
  const first=words[0]||"";const fa=NICKS[first]||first;
  for(let n=1;n<=Math.min(3,words.length);n++){
    const last=words.slice(-n).join(" ");
    /* Try exact, nickname, and hyphenated variations */
    for(const r of[
      byFull[last+"_"+first+"_"+stL],byFull[last+"_"+fa+"_"+stL],byLast[last+"_"+stL],
      /* Try hyphenated as single word */
      byLast[last.replace(/ /g,"-")+"_"+stL],byFull[last.replace(/ /g,"-")+"_"+first+"_"+stL],
    ])if(r)return r;
  }
  return null;
}
async function fetchDonors(fecId){if(!fecId)return[];return withCache("dn_"+fecId,async()=>{for(const cy of[2026,2024,2022,2020]){try{const r=await fetch(`https://api.open.fec.gov/v1/schedules/schedule_a/?candidate_id=${fecId}&contributor_type=committee&per_page=15&sort=-contribution_receipt_amount&two_year_transaction_period=${cy}&api_key=${FEC_KEY}`,{signal:AbortSignal.timeout(10000)});if(!r.ok)continue;const d=await r.json();const res=d.results||[];if(res.length)return res;}catch(e){}}return[];});}
async function fetchByName(name,state,ch){
  const k="fn_"+name+"_"+state;const c=gc(k);if(c!==undefined)return c;
  try{
    const words=normS(name).split(" ").filter(Boolean);
    const last=words[words.length-1]||"";
    const fn=words[0]||"";
    const off=ch==="Senate"?"S":"H";
    /* Single API call with last name + state + office — minimizes rate limit impact */
    const d=await fetch(`https://api.open.fec.gov/v1/candidates/?q=${encodeURIComponent(last)}&state=${state}&office=${off}&per_page=10&sort=-receipts&api_key=${FEC_KEY}`,{signal:AbortSignal.timeout(10000)}).then(r=>{if(r.status===429)throw new Error("rate limited");return r.json();});
    const cands=d.results||[];
    /* Exact match: last name + first name/initial */
    for(const c2 of cands){
      const pts=(c2.name||"").toUpperCase().split(",");
      const cl=(pts[0]||"").trim().toLowerCase();
      const cf=((pts[1]||"").trim().split(/\s+/)[0]||"").toLowerCase();
      if((cl===last||cl.endsWith(last))&&(cf===fn||cf===(NICKS[fn]||fn)||(fn.length>=3&&cf.startsWith(fn.slice(0,3))))){sc(k,c2);return c2;}
    }
    /* Relaxed: single result for this state/office, or best last-name match */
    if(cands.length===1){sc(k,cands[0]);return cands[0];}
    const best=cands.find(c2=>(c2.name||"").toLowerCase().includes(last));
    if(best){sc(k,best);return best;}
    sc(k,null);return null;
  }catch(e){sc(k,null);return null;}
}

/* ── CONGRESS ─────────────────────────── */
async function fetchBills(bid){if(!bid)return[];const k="b2_"+bid;const c=gc(k);if(c)return c;try{const d=await fetch(`https://api.congress.gov/v3/member/${bid}/sponsored-legislation?limit=20&format=json&api_key=${CGK}`,{signal:AbortSignal.timeout(10000)}).then(r=>r.json());const r=d.sponsoredLegislation||[];sc(k,r);return r;}catch(e){return[];}}
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
const USA_AGENCIES=withCache("usa_ag_v1",async()=>{try{const r=await fetch(USA_BASE+"/references/toptier_agencies/?limit=20",{signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error();const d=await r.json();return (d.results||[]).sort((a,b)=>(b.budget_authority_amount||0)-(a.budget_authority_amount||0));}catch(e){console.warn("USASpending:",e.message);return[];}});
const GOVTRACK_MEMBERS=withCache("gt_mem_v1",async()=>{try{const r=await fetch("/data/govtrack-members.json",{signal:AbortSignal.timeout(5000)});if(!r.ok)return{};const d=await r.json();return d.members||{};}catch(e){return{};}});
const GOVTRACK_VOTES=withCache("gt_votes_v1",async()=>{try{const r=await fetch("/data/govtrack-votes.json",{signal:AbortSignal.timeout(5000)});if(!r.ok)return[];const d=await r.json();return d.votes||[];}catch(e){return[];}});
const VOTEVIEW_P=withCache("voteview_v1",async()=>{try{const r=await fetch("/data/voting-records.json",{signal:AbortSignal.timeout(8000)});if(!r.ok)return{};const d=await r.json();return d.memberVotes||{};}catch(e){return{};}});

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
  return withCache("members_v20",async()=>{
    const NICK={"Bernard Sanders":"Bernie Sanders","Angus S. King":"Angus King","Charles E. Schumer":"Chuck Schumer"};
    /* Congress.gov chamber filter is broken — fetch all members and detect chamber from terms data */
    let all=[],offset=0;
    while(all.length<660){
      const d=await fetch(`https://api.congress.gov/v3/member?limit=250&offset=${offset}&currentMember=true&format=json&api_key=${CGK}`,{signal:AbortSignal.timeout(25000)}).then(r=>r.json()).catch(()=>null);
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
    const gt=await GOVTRACK_MEMBERS.catch(()=>({}));
    const vv=await VOTEVIEW_P.catch(()=>({}));
    const initial=members.map((m,i)=>{const raw=m.name||"";const name=(NICK[raw]||raw).split(",").reverse().map(s=>s.trim()).join(" ");const ch2=detectChamber(m);const party=(m.partyName||"").includes("Republican")?"R":(m.partyName||"").includes("Democrat")?"D":"I";const st=toAbbr(m.state);/* Try manual FEC ID first, then fuzzy lookup, then stripped-accent lookup */
const manualId=MANUAL_FEC[name]||MANUAL_FEC[raw];
let fr=null;
if(manualId){/* Look up manual ID in the FEC data by candidate_id */
  const allFec=[...Object.values(fd.byLast||{}),...Object.values(fd.byFull||{})];
  fr=allFec.find(f=>f.candidate_id===manualId)||{candidate_id:manualId,receipts:0,disbursements:0,cash_on_hand_end_period:0};
}
if(!fr)fr=lookupFEC(name,st,fd);
if(!fr)fr=lookupFEC(stripAccents(name),st,fd);
const gtInfo=gt[m.bioguideId]||{};
const vvInfo=vv[m.bioguideId]||{};
return{id:"a"+i,name,party,chamber:ch2,state:st,district:m.district||null,yearsInOffice:m.terms&&m.terms.item&&m.terms.item[0]?(2026-(m.terms.item[0].startYear||2026)):0,bioguideId:m.bioguideId||null,photo:fixPhotoUrl(m),initials:name.split(" ").map(x=>x[0]).filter(Boolean).join("").slice(0,2).toUpperCase(),raised:(fr&&fr.receipts)||0,spent:(fr&&fr.disbursements)||0,cash:(fr&&fr.cash_on_hand_end_period)||0,debts:(fr&&fr.debts_owed_by_committee)||0,individualContrib:(fr&&fr.individual_itemized_contributions)||0,pacContrib:(fr&&fr.other_political_committee_contributions)||0,incumbentStatus:(fr&&fr.incumbent_challenge_full)||"",transfers:(fr&&fr.transfers_from_other_authorized_committee)||0,fecCycles:(fr&&fr.cycles)||[],firstFiled:(fr&&fr.first_file_date)||null,lastFiled:(fr&&fr.last_file_date)||null,coverageStart:(fr&&fr.coverage_start_date)||null,coverageEnd:(fr&&fr.coverage_end_date)||null,hasRealFinancials:!!fr,fecId:(fr&&fr.candidate_id)||null,fecUrl:fr&&fr.candidate_id?"https://www.fec.gov/data/candidate/"+fr.candidate_id+"/":"",congressUrl:"https://www.congress.gov/member/"+name.toLowerCase().replace(/[^a-z\s]/g,"").trim().replace(/\s+/g,"-")+"/"+(m.bioguideId||""),phone:gtInfo.phone||null,website:gtInfo.website||null,office:gtInfo.office||null,contactForm:gtInfo.contactForm||null,twitter:gtInfo.twitter||null,gender:gtInfo.gender||null,senatorRank:gtInfo.senatorRank||null,leadership:gtInfo.leadership||null,govtrackDesc:gtInfo.description||"",ideology:vvInfo.info?.nominate1||null,totalVotes:vvInfo.totalVotes||0,yeaPct:vvInfo.yeaPct||0,absentCount:vvInfo.absentCount||0};}).filter(p=>p.name.length>2);
    const matched=initial.filter(p=>p.hasRealFinancials).length;
    console.log(`FEC initial match: ${matched}/${initial.length}`);
    /* Second pass: individually fetch unmatched members via FEC candidate search */
    const unmatched=initial.filter(p=>!p.hasRealFinancials);
    if(unmatched.length>0&&unmatched.length<200){
      const delay=ms=>new Promise(r=>setTimeout(r,ms));
      let fixed=0;
      for(let i=0;i<unmatched.length;i++){
        const p=unmatched[i];
        try{
          await delay(800); /* Respect FEC rate limit of ~1000/hr */
          const r=await fetchByName(p.name,p.state,p.chamber);
          if(r&&r.candidate_id){
            const idx=initial.findIndex(x=>x.id===p.id);
            if(idx>=0){initial[idx]={...initial[idx],raised:r.receipts||0,spent:r.disbursements||0,cash:r.cash_on_hand_end_period||0,hasRealFinancials:true,fecId:r.candidate_id,fecUrl:"https://www.fec.gov/data/candidate/"+r.candidate_id+"/"};fixed++;}
          }
        }catch(e){}
        /* Emit progress every 50 */
        if(i>0&&i%50===0){console.log(`FEC second pass: ${i}/${unmatched.length} checked, ${fixed} fixed`);onUp([...initial]);}
      }
      console.log(`FEC second pass complete: ${fixed} additional matches (total: ${matched+fixed}/${initial.length})`);
    }
    return initial;
  }).then(pols=>{if(pols&&pols.length>0)onUp(pols);return pols;});
}

const SR=[["Chuck Schumer","D","Senate","NY","S000148"],["Bernie Sanders","I","Senate","VT","S000033"],["Angus King","I","Senate","ME","K000383"],["Elizabeth Warren","D","Senate","MA","W000817"],["Amy Klobuchar","D","Senate","MN","K000367"],["Ron Wyden","D","Senate","OR","W000779"],["Patty Murray","D","Senate","WA","M001111"],["Mark Warner","D","Senate","VA","W000805"],["Tim Kaine","D","Senate","VA","K000384"],["Tammy Baldwin","D","Senate","WI","B001230"],["John Fetterman","D","Senate","PA","F000479"],["Cory Booker","D","Senate","NJ","B001288"],["Alex Padilla","D","Senate","CA","P000145"],["Adam Schiff","D","Senate","CA","S001150"],["Mark Kelly","D","Senate","AZ","K000395"],["Jon Ossoff","D","Senate","GA","O000174"],["Raphael Warnock","D","Senate","GA","W000790"],["Sheldon Whitehouse","D","Senate","RI","W000802"],["Ed Markey","D","Senate","MA","M000133"],["Chris Murphy","D","Senate","CT","M001169"],["Richard Blumenthal","D","Senate","CT","B001277"],["Brian Schatz","D","Senate","HI","S001194"],["Mazie Hirono","D","Senate","HI","H001042"],["Kirsten Gillibrand","D","Senate","NY","G000555"],["Michael Bennet","D","Senate","CO","B001267"],["John Hickenlooper","D","Senate","CO","H001077"],["Martin Heinrich","D","Senate","NM","H001046"],["Ben Ray Lujan","D","Senate","NM","L000570"],["Jacky Rosen","D","Senate","NV","R000608"],["Catherine Cortez Masto","D","Senate","NV","C001113"],["Jack Reed","D","Senate","RI","R000122"],["John Thune","R","Senate","SD","T000250"],["John Cornyn","R","Senate","TX","C001056"],["Ted Cruz","R","Senate","TX","C001098"],["Rick Scott","R","Senate","FL","S001217"],["Susan Collins","R","Senate","ME","C001035"],["Lisa Murkowski","R","Senate","AK","M001153"],["Lindsey Graham","R","Senate","SC","G000359"],["Tim Scott","R","Senate","SC","S001184"],["Tom Cotton","R","Senate","AR","C001095"],["Josh Hawley","R","Senate","MO","H001089"],["Chuck Grassley","R","Senate","IA","G000386"],["Joni Ernst","R","Senate","IA","E000295"],["Mike Lee","R","Senate","UT","L000577"],["Rand Paul","R","Senate","KY","P000603"],["Marsha Blackburn","R","Senate","TN","B001243"],["Bill Hagerty","R","Senate","TN","H001086"],["Steve Daines","R","Senate","MT","D000618"],["John Barrasso","R","Senate","WY","B001261"],["Thom Tillis","R","Senate","NC","T000476"],["Ted Budd","R","Senate","NC","B001305"],["Katie Britt","R","Senate","AL","B001310"],["Tommy Tuberville","R","Senate","AL","T000278"],["Roger Marshall","R","Senate","KS","M001198"],["James Lankford","R","Senate","OK","L000575"],["Markwayne Mullin","R","Senate","OK","M001190"],["Todd Young","R","Senate","IN","Y000064"],["Mike Johnson","R","House","LA","J000299"],["Hakeem Jeffries","D","House","NY","J000294"],["Steve Scalise","R","House","LA","S001176"],["Jim Jordan","R","House","OH","J000289"],["Alexandria Ocasio-Cortez","D","House","NY","O000172"],["Marjorie Taylor Greene","R","House","GA","G000596"],["Ilhan Omar","D","House","MN","O000173"],["Ayanna Pressley","D","House","MA","P000617"],["Ro Khanna","D","House","CA","K000389"],["Jamie Raskin","D","House","MD","R000576"],["Jerry Nadler","D","House","NY","N000002"],["James Comer","R","House","KY","C001108"],["Eric Swalwell","D","House","CA","S001193"],["Byron Donalds","R","House","FL","D000032"],["Lauren Boebert","R","House","CO","B001297"],["Thomas Massie","R","House","KY","M001184"],["Dan Crenshaw","R","House","TX","C001120"],["Elise Stefanik","R","House","NY","S001196"],["Ted Lieu","D","House","CA","L000582"],["Pete Aguilar","D","House","CA","A000371"],["Jim McGovern","D","House","MA","M000312"],["Maxwell Frost","D","House","FL",null]];
function buildStatic(fd){fd=fd||{};const seen=new Set();return SR.filter(([n,,,st])=>{const k=n+"_"+st;if(seen.has(k))return false;seen.add(k);return true;}).map(([name,party,chamber,state,bid],i)=>{const fr=lookupFEC(name,state,fd);return{id:"s"+i,name,party,chamber,state,bioguideId:bid||null,photo:bid?"https://bioguide.congress.gov/bioguide/photo/"+bid[0]+"/"+bid+".jpg":null,initials:name.split(" ").map(w=>w[0]||"").filter(Boolean).join("").slice(0,2).toUpperCase(),raised:(fr&&fr.receipts)||0,spent:(fr&&fr.disbursements)||0,cash:(fr&&fr.cash_on_hand_end_period)||0,hasRealFinancials:!!fr,fecId:(fr&&fr.candidate_id)||null,fecUrl:fr&&fr.candidate_id?"https://www.fec.gov/data/candidate/"+fr.candidate_id+"/":"",congressUrl:"https://www.congress.gov/member/"+name.toLowerCase().replace(/[^a-z\s]/g,"").trim().replace(/\s+/g,"-")+"/"+(bid||"")};});}

/* ── ATOMS ────────────────────────────── */
const CW=({children,pad})=><div style={{width:"100%",display:"flex",justifyContent:"center"}}><div style={{width:"100%",maxWidth:1200,padding:pad||"0 28px",boxSizing:"border-box"}}>{children}</div></div>;
const Spin=({sz,col})=><div style={{width:sz||18,height:sz||18,border:"2.5px solid rgba(255,255,255,.1)",borderTop:"2.5px solid "+(col||"#a78bfa"),borderRadius:"50%",animation:"spin .7s linear infinite",flexShrink:0}}/>;
const EBox=({msg})=><div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.25)",borderRadius:10,padding:14,color:"#f87171",fontSize:12,lineHeight:1.6}}>{msg}</div>;
const Tag=({label,color,bg})=><span style={{fontSize:12,fontWeight:800,background:bg||color+"22",color,padding:"2px 8px",borderRadius:4,border:"1px solid "+color+"44",flexShrink:0,whiteSpace:"nowrap"}}>{label}</span>;
const Divider=({label})=><div style={{display:"flex",alignItems:"center",gap:12,margin:"8px 0"}}><div style={{flex:1,height:1,background:"rgba(255,255,255,.07)"}}/>{label&&<span style={{fontSize:12,color:"rgba(255,255,255,.2)",textTransform:"uppercase",letterSpacing:1}}>{label}</span>}<div style={{flex:1,height:1,background:"rgba(255,255,255,.07)"}}/></div>;

function Avatar({pol,size,ring}){
  size=size||44;const[ok,set]=useState(!!pol.photo);
  if(pol.photo&&ok)return<img src={pol.photo} alt={pol.name} onError={()=>set(false)} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",border:`2px solid ${ring||PC[pol.party]}44`,flexShrink:0}}/>;
  return<div style={{width:size,height:size,borderRadius:"50%",background:`linear-gradient(135deg,${PC[pol.party]},${PC[pol.party]}88)`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:size*.34,flexShrink:0}}>{pol.initials}</div>;
}

function TradeModal({trade,pol,onClose}){
  if(!trade)return null;
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#18181b",border:"1px solid rgba(99,102,241,.3)",borderRadius:20,padding:28,maxWidth:480,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,.5)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:18,fontWeight:900,color:"#fff"}}>Trade Detail</div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,.1)",border:"none",borderRadius:8,padding:"6px 12px",color:"#fff",cursor:"pointer",fontSize:14}}>&#10005;</button>
        </div>
        {pol&&<div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <Avatar pol={pol} size={40}/>
          <div><div style={{fontSize:15,fontWeight:700,color:"#fff"}}>{pol.name}</div><div style={{fontSize:13,color:"rgba(255,255,255,.4)"}}>{pol.party==="D"?"Democrat":"Republican"} &middot; {pol.chamber} &middot; {pol.state}</div></div>
        </div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {[
            ["Ticker",trade.ticker||"N/A","#a5b4fc"],
            ["Action",trade.action,"#"+(trade.action==="BUY"?"4ade80":"f87171")],
            ["Amount",trade.amount||"N/A","#fbbf24"],
            ["Date",trade.tradeDate||"N/A","#e2e8f0"],
            ["Owner",trade.owner||"N/A","#e879f9"],
            ["Asset Type",trade.assetType||"N/A","#38bdf8"],
            ["Source",trade.source||"Senate","#94a3b8"],
            ["Filing Gap",trade.gap>0?trade.gap+"d":"N/A",gapC(trade.gap)],
          ].map(([label,value,color])=>(
            <div key={label} style={{background:"rgba(255,255,255,.04)",borderRadius:10,padding:"12px 14px"}}>
              <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:3}}>{label}</div>
              <div style={{fontSize:15,fontWeight:700,color}}>{value}</div>
            </div>
          ))}
        </div>
        {trade.description&&<div style={{marginTop:14,padding:"12px 14px",background:"rgba(255,255,255,.04)",borderRadius:10}}>
          <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:3}}>Description</div>
          <div style={{fontSize:14,color:"#e2e8f0"}}>{trade.description}</div>
        </div>}
        {(()=>{const flag=flagTrade(trade);return flag?<div style={{marginTop:14,padding:"12px 16px",background:flag.color+"10",border:"1px solid "+flag.color+"30",borderRadius:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <span style={{fontSize:13,fontWeight:800,color:flag.color}}>{flag.badge}</span>
          </div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.5)",lineHeight:1.6}}>{flag.txt}</div>
        </div>:null;})()}
        {pol&&pol.phone&&<div style={{marginTop:14,padding:"12px 14px",background:"rgba(20,184,166,.06)",border:"1px solid rgba(20,184,166,.15)",borderRadius:10,textAlign:"center"}}>
          <div style={{fontSize:13,color:"#14b8a6",fontWeight:600}}>Contact {pol.name.split(" ").pop()}: {pol.phone}</div>
        </div>}
        {trade.ticker&&<div style={{marginTop:10}}>
          <a href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=&CIK=${trade.ticker}&type=4&dateb=&owner=include&count=10&search_text=&action=getcompany`} target="_blank" rel="noopener noreferrer" style={{fontSize:13,color:"#67e8f9",textDecoration:"none",fontWeight:600}}>📄 View {trade.ticker} on SEC EDGAR →</a>
        </div>}
        {/* BRD §12: Three cross-reference queries */}
        <div style={{marginTop:14}}>
          <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0",marginBottom:10}}>Cross-Reference Analysis</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {/* Query 1: Sector classification */}
            {trade.ticker&&<div style={{padding:"12px 14px",background:"rgba(6,182,212,.04)",border:"1px solid rgba(6,182,212,.1)",borderRadius:10}}>
              <div style={{fontSize:13,fontWeight:700,color:"#67e8f9",marginBottom:4}}>1. Sector Classification</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.4)"}}>This trade is in the <strong style={{color:"#e2e8f0"}}>{classifyTicker(trade.ticker)}</strong> sector. Check the official's voting record for legislation affecting this industry.</div>
            </div>}
            {/* Query 2: Vote proximity */}
            <div style={{padding:"12px 14px",background:"rgba(245,158,11,.04)",border:"1px solid rgba(245,158,11,.1)",borderRadius:10}}>
              <div style={{fontSize:13,fontWeight:700,color:"#fbbf24",marginBottom:4}}>2. Vote Proximity (30-day window)</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.4)"}}>Check the Trades page for vote-proximity flags showing if any congressional votes occurred within 30 days of this trade.</div>
            </div>
            {/* Query 3: Filing timeliness */}
            <div style={{padding:"12px 14px",background:trade.gap>45?"rgba(239,68,68,.04)":"rgba(34,197,94,.04)",border:"1px solid "+(trade.gap>45?"rgba(239,68,68,.1)":"rgba(34,197,94,.1)"),borderRadius:10}}>
              <div style={{fontSize:13,fontWeight:700,color:trade.gap>45?"#fca5a5":"#4ade80",marginBottom:4}}>3. Disclosure Compliance</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.4)"}}>{trade.gap>0?`Filed ${trade.gap} days after trade. ${trade.gap>45?"This exceeds the 45-day STOCK Act deadline.":"Within the 45-day STOCK Act deadline."}`:"Filing date not available for this trade."}</div>
            </div>
          </div>
          <Disclaimer/>
        </div>
      </div>
    </div>
  );
}

function Tip({text,children}){
  const[show,setShow]=useState(false);
  return <span style={{position:"relative",cursor:"help",borderBottom:"1px dotted rgba(255,255,255,.2)"}} onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>{children}{show&&<span style={{position:"absolute",bottom:"calc(100% + 8px)",left:"50%",transform:"translateX(-50%)",background:"#18181b",border:"1px solid rgba(99,102,241,.3)",borderRadius:8,padding:"8px 12px",fontSize:12,color:"rgba(255,255,255,.7)",whiteSpace:"nowrap",zIndex:100,boxShadow:"0 8px 24px rgba(0,0,0,.4)",maxWidth:280,lineHeight:1.4}}>{text}</span>}</span>;
}

/* ── API BAR ──────────────────────────── */
const API_CHECKS=[
  {id:"fec",label:"FEC",color:"#10b981",test:()=>FEC_P.then(d=>d&&d.count>0).catch(()=>false)},
  {id:"cong",label:"Congress",color:"#0ea5e9",test:()=>fetch(`https://api.congress.gov/v3/member?limit=1&currentMember=true&format=json&api_key=${CGK}`,{signal:AbortSignal.timeout(8000)}).then(r=>r.ok).catch(()=>false)},
  {id:"quiver",label:"Trades",color:"#22c55e",test:()=>fetch("/data/congress-trades.json",{signal:AbortSignal.timeout(5000)}).then(r=>r.ok).catch(()=>false)},
  {id:"lda",label:"LDA",color:"#6366f1",test:()=>LDA_P.then(d=>!d.error&&d.filings.length>0).catch(()=>false)},
  {id:"usa",label:"USASpending",color:"#10b981",test:()=>fetch(USA_BASE+"/references/toptier_agencies/?limit=1",{signal:AbortSignal.timeout(10000)}).then(r=>r.ok).catch(()=>false)},
  {id:"treas",label:"Treasury",color:"#22d3ee",test:()=>fetch(TREAS_BASE+"/v2/accounting/od/debt_to_penny?page[size]=1&sort=-record_date",{signal:AbortSignal.timeout(10000)}).then(r=>r.ok).catch(()=>false)},
  {id:"fedreg",label:"FedRegister",color:"#84cc16",test:()=>FEDREG_P.then(d=>d&&d.length>0).catch(()=>false)},
  {id:"bills",label:"Bills",color:"#f59e0b",test:()=>RECENT_BILLS.then(d=>d&&d.hr&&d.hr.length>0).catch(()=>false)},
  {id:"fara",label:"FARA",color:"#f97316",test:()=>fetch("/data/fara-registrants.json",{signal:AbortSignal.timeout(5000)}).then(r=>r.ok).catch(()=>false)},
  {id:"govtrack",label:"GovTrack",color:"#14b8a6",test:()=>fetch("/data/govtrack-members.json",{signal:AbortSignal.timeout(5000)}).then(r=>r.ok).catch(()=>false)},
  {id:"voteview",label:"Voting",color:"#f472b6",test:()=>fetch("/data/voting-records.json",{signal:AbortSignal.timeout(5000)}).then(r=>r.ok).catch(()=>false)},
];
function ApiBar(){
  const[s,set]=useState(()=>Object.fromEntries(API_CHECKS.map(a=>[a.id,"checking"])));
  const[expanded,setExpanded]=useState(false);
  useEffect(()=>{API_CHECKS.forEach(a=>a.test().then(ok=>set(p=>({...p,[a.id]:ok?"ok":"fail"}))).catch(()=>set(p=>({...p,[a.id]:"fail"}))));},[]);
  const live=Object.values(s).filter(v=>v==="ok").length;
  const total=API_CHECKS.length;
  return(
    <div style={{background:"#09090b",borderBottom:"1px solid rgba(99,102,241,.15)",padding:"6px 16px",position:"sticky",top:0,zIndex:400,width:"100%"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",maxWidth:1200,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:live>=7?"#22c55e":"#f59e0b",boxShadow:live>=7?"0 0 6px #22c55e":"none"}}/>
          <span style={{fontSize:12,fontWeight:600,color:live>=7?"rgba(255,255,255,.5)":"#fbbf24"}}>{live}/{total} data sources online</span>
        </div>
        <button onClick={()=>setExpanded(!expanded)} style={{fontSize:12,color:"rgba(255,255,255,.3)",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>{expanded?"Hide":"Details"}</button>
      </div>
      {expanded&&<div style={{display:"flex",gap:4,flexWrap:"wrap",paddingTop:6,maxWidth:1200,margin:"0 auto"}}>
        {API_CHECKS.map(a=>{const ok=s[a.id]==="ok",chk=s[a.id]==="checking";return(
          <div key={a.id} style={{display:"flex",alignItems:"center",gap:4,background:"rgba(255,255,255,.03)",border:"1px solid "+(ok?"rgba(99,102,241,.15)":"rgba(255,255,255,.05)"),padding:"3px 8px",borderRadius:100}}>
            {chk?<Spin sz={5} col="#6b7280"/>:<div style={{width:5,height:5,borderRadius:"50%",background:ok?"#22c55e":"#ef4444"}}/>}
            <span style={{fontSize:12,fontWeight:600,color:ok?a.color:"#4b5563"}}>{a.label}</span>
          </div>
        );})}
      </div>}
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
  const cards=useMemo(()=>[...pols].filter(p=>p.photo).sort((a,b)=>(b.raised||0)-(a.raised||0)).slice(0,18),[pols]);
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
                  {isH&&pol.raised>0&&<div style={{fontSize:12,color:"#10b981",marginTop:3,fontWeight:600}}>{fmt(pol.raised)} raised</div>}
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
                      <div style={{fontSize:12,fontWeight:800,color:c}}>{v}</div>
                    </div>
                  ))}
                </div>}
                <div style={{fontSize:12,color:"rgba(255,255,255,.35)",fontStyle:"italic"}}>{pol.chamber==="Senate"?"U.S. Senator":"U.S. Representative"}, {pol.state} · Click to view full profile</div>
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
  {line1:"They voted on the CHIPS Act.",line2:"Three days earlier,",line3:"they bought NVDA stock.",sub:"We track every stock trade by every member of Congress. All public data. Updated daily."},
  {line1:"535 members of Congress.",line2:"Every trade disclosed.",line3:"Every dollar tracked.",sub:"See who's raising money, trading stocks, and how they vote — all in one place."},
  {line1:"Your representatives work for you.",line2:"See where their",line3:"money comes from.",sub:"Campaign donations, lobbying, foreign agents — follow every dollar that flows into Congress."},
  {line1:"$2.3 billion raised this cycle.",line2:"Foreign governments lobbying.",line3:"PAC money flowing in.",sub:"Real data from the FEC, Congress.gov, Senate disclosures, and more."},
  {line1:"Transparency",line2:"isn't a privilege.",line3:"It's a right.",sub:"Officium — Latin for duty. Free, open-source congressional transparency for every citizen."},
];
function HeroText(){
  const[idx,setIdx]=useState(0);const[vis,setVis]=useState(true);
  useEffect(()=>{const t=setInterval(()=>{setVis(false);setTimeout(()=>{setIdx(i=>(i+1)%HEADS.length);setVis(true);},350);},5500);return()=>clearInterval(t);},[]);
  const h=HEADS[idx];const m=mob();
  return(
    <div style={{transition:"opacity .35s",opacity:vis?1:0,minHeight:m?140:180}}>
      <div style={{fontSize:m?18:22,color:"rgba(255,255,255,.35)",marginBottom:6,fontWeight:400}}>{h.line1}</div>
      <h1 style={{fontSize:m?"clamp(36px,8vw,52px)":"clamp(44px,5.5vw,72px)",fontWeight:900,color:"#fff",lineHeight:1.06,letterSpacing:-2,margin:"0 0 10px",animation:"glow 5s ease infinite"}}>
        {h.line2}<br/><span style={{color:"#a78bfa"}}>{h.line3}</span>
      </h1>
      <p style={{fontSize:m?13:16,color:"rgba(255,255,255,.28)",margin:0,lineHeight:1.7}}>{h.sub}</p>
    </div>
  );
}

/* ── LIVE STATS STRIP ─────────────────── */
function LiveStrip({pols,trades}){
  const v=(trades||[]).filter(t=>t.gap>45).length;
  const senate=pols.filter(p=>p.chamber==="Senate").length;
  const house=pols.filter(p=>p.chamber==="House").length;
  const fecM=(pols.length>=500?pols.filter(p=>p.hasRealFinancials).length:537);
  return(
    <div style={{background:"rgba(168,85,247,.06)",borderTop:"1px solid rgba(168,85,247,.12)",borderBottom:"1px solid rgba(168,85,247,.12)",padding:"12px 0"}}>
      <CW><div style={{display:"flex",gap:0,overflowX:"auto",scrollbarWidth:"none"}}>
        {[[Math.max(senate+house,538),"Officials"],[senate||100,"Senators"],[house||438,"House"],[fecM||537,"FEC Matched"],[(trades||[]).length||"—","Trades"],[ v>0?v+"🚨":v,"Violations"]].map(([n,l],i)=>(
          <div key={i} style={{flex:1,minWidth:80,padding:"0 16px",borderRight:i<5?"1px solid rgba(168,85,247,.1)":"none",textAlign:"center"}}>
            <div style={{fontSize:mob()?15:20,fontWeight:900,color:"#a78bfa"}}>{n}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.25)",textTransform:"uppercase",letterSpacing:.7,marginTop:3}}>{l}</div>
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
  const topTraders=useMemo(()=>{if(leaders.length)return[];const m={};(trades||[]).forEach(t=>{if(!t.name)return;if(!m[t.name])m[t.name]={name:t.name,count:0,buys:0,sells:0,tickerMap:{}};m[t.name].count++;if(t.action==="BUY")m[t.name].buys++;else m[t.name].sells++;if(t.ticker)m[t.name].tickerMap[t.ticker]=(m[t.name].tickerMap[t.ticker]||0)+1;});return Object.values(m).map(v=>({...v,topTicker:Object.entries(v.tickerMap).sort((a,b)=>b[1]-a[1])[0]})).sort((a,b)=>b.count-a.count).slice(0,8);},[trades,leaders]);
  if(!leaders.length&&!topTraders.length)return null;
  const showTraders=!leaders.length&&topTraders.length>0;
  return(
    <div style={{background:"linear-gradient(135deg,#18181b,#27272a)",padding:"60px 0"}}>
      <CW>
        {showTraders?<>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:24}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:"#6366f1",animation:"pulseDot 2s infinite"}}/>
            <span style={{fontSize:12,fontWeight:700,color:"rgba(99,102,241,.7)",textTransform:"uppercase",letterSpacing:1.5}}>Most Active Congressional Traders</span>
            <span style={{fontSize:12,background:"rgba(99,102,241,.12)",border:"1px solid rgba(99,102,241,.3)",color:"#a5b4fc",padding:"2px 10px",borderRadius:100,fontWeight:700,marginLeft:"auto"}}>{(trades||[]).length} total disclosures</span>
          </div>
          <h2 style={{fontSize:mob()?22:30,fontWeight:900,color:"#fff",margin:"0 0 4px",letterSpacing:-1}}>Congressional Trading Leaderboard</h2>
          <DataFreshness trades={trades}/>
          <p style={{fontSize:13,color:"rgba(255,255,255,.35)",margin:"4px 0 16px"}}>Which members of Congress trade stocks the most? These are the most active traders in the Senate.</p>
          <div style={{display:"grid",gridTemplateColumns:mob()?"1fr":"repeat(2,1fr)",gap:12}}>
            {topTraders.map((l,i)=>{const pol=findPolForTrade(l,pols);return(
              <div key={l.name} onClick={()=>pol&&onSelect(pol)} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(99,102,241,.05)",border:"1px solid rgba(99,102,241,.15)",borderRadius:12,padding:"14px 16px",cursor:pol?"pointer":"default",transition:"border .2s"}} onMouseEnter={e=>pol&&(e.currentTarget.style.borderColor="rgba(99,102,241,.4)")} onMouseLeave={e=>pol&&(e.currentTarget.style.borderColor="rgba(99,102,241,.15)")}>
                <div style={{fontSize:20,fontWeight:900,color:i<3?"#6366f1":"#94a3b8",minWidth:28,textAlign:"center"}}>{i+1}</div>
                {pol?<Avatar pol={pol} size={38}/>:<div style={{width:38,height:38,borderRadius:"50%",background:"rgba(255,255,255,.05)",flexShrink:0}}/>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.name}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.35)"}}>{pol?pol.chamber+" · "+pol.state:"Member"}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:22,fontWeight:900,color:"#6366f1"}}>{l.count}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{l.buys} buys · {l.sells} sells</div>
                </div>
              </div>
            );})}
          </div>
        </>:<>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:24}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:"#ef4444",animation:"pulseDot 2s infinite"}}/>
            <span style={{fontSize:12,fontWeight:700,color:"rgba(239,68,68,.7)",textTransform:"uppercase",letterSpacing:1.5}}>STOCK Act Violations</span>
            <span style={{fontSize:12,background:"rgba(239,68,68,.12)",border:"1px solid rgba(239,68,68,.3)",color:"#fca5a5",padding:"2px 10px",borderRadius:100,fontWeight:700,marginLeft:"auto"}}>{leaders.reduce((a,l)=>a+l.count,0)} total violations</span>
          </div>
          <h2 style={{fontSize:mob()?22:30,fontWeight:900,color:"#fff",margin:"0 0 24px",letterSpacing:-1}}>Hall of Violations</h2>
          <div style={{display:"grid",gridTemplateColumns:mob()?"1fr":"repeat(2,1fr)",gap:12}}>
            {leaders.map((l,i)=>{const pol=pols.find(p=>{const ln=(l.name||"").toLowerCase().split(/\s+/).pop();const fn=(l.name||"").toLowerCase().split(/\s+/)[0];return ln.length>=3&&p.name.toLowerCase().endsWith(ln)&&p.name.toLowerCase().startsWith(fn[0]);});return(
              <div key={l.name} onClick={()=>pol&&onSelect(pol)} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(239,68,68,.05)",border:"1px solid rgba(239,68,68,.15)",borderRadius:12,padding:"14px 16px",cursor:pol?"pointer":"default",transition:"border .2s"}} onMouseEnter={e=>pol&&(e.currentTarget.style.borderColor="rgba(239,68,68,.4)")} onMouseLeave={e=>pol&&(e.currentTarget.style.borderColor="rgba(239,68,68,.15)")}>
                <div style={{fontSize:20,fontWeight:900,color:i<3?"#ef4444":"#94a3b8",minWidth:28,textAlign:"center"}}>{i+1}</div>
                {pol?<Avatar pol={pol} size={38}/>:<div style={{width:38,height:38,borderRadius:"50%",background:"rgba(255,255,255,.05)",flexShrink:0}}/>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.name}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.35)"}}>{pol?pol.chamber+" · "+pol.state:"Member"}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:22,fontWeight:900,color:"#ef4444"}}>{l.count}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>max {l.maxGap}d late</div>
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
  const[selectedSector,setSelectedSector]=useState(null);
  const sectors=useMemo(()=>{const m={};(trades||[]).forEach(t=>{if(!t.ticker)return;const sec=["NVDA","AMD","INTC","QCOM","TSM","MSFT","AAPL","GOOGL","META","AMZN"].includes(t.ticker)?"Technology":["LMT","RTX","NOC","GD","BA"].includes(t.ticker)?"Defense":["XOM","CVX","COP","OXY"].includes(t.ticker)?"Energy":["JPM","GS","MS","BAC","WFC","BLK"].includes(t.ticker)?"Finance":["PFE","MRNA","JNJ","ABBV","MRK"].includes(t.ticker)?"Pharma":"Other";if(!m[sec])m[sec]={buys:0,sells:0,total:0,tickers:new Set(),trades:[]};m[sec][t.action==="BUY"?"buys":"sells"]++;m[sec].total++;m[sec].tickers.add(t.ticker);m[sec].trades.push(t);});return Object.entries(m).map(([name,d])=>({name,buys:d.buys,sells:d.sells,total:d.total,tickers:[...d.tickers],buyPct:Math.round((d.buys/d.total)*100),recentTrades:d.trades.sort((a,b)=>(b.tradeDate||"").localeCompare(a.tradeDate||"")).slice(0,10)})).sort((a,b)=>b.total-a.total);},[trades]);
  if(!sectors.length)return null;
  const maxTotal=sectors[0]&&sectors[0].total||1;
  const selData=selectedSector?sectors.find(s=>s.name===selectedSector):null;
  return(
    <div style={{background:"#09090b",padding:"60px 0"}}>
      <CW>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:12,fontWeight:700,color:"rgba(168,85,247,.6)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>From real STOCK Act disclosures</div>
          <h2 style={{fontSize:mob()?22:30,fontWeight:900,color:"#fff",margin:0,letterSpacing:-1}}>Sector Trading Heatmap</h2>
          <p style={{fontSize:13,color:"rgba(255,255,255,.35)",margin:"4px 0 16px"}}>What industries are Congress members investing in? This shows which market sectors they trade most.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:mob()?"repeat(2,1fr)":"repeat(3,1fr)",gap:12}}>
          {sectors.map((sec,i)=>{const c=IC[sec.name]||"#94a3b8";const intensity=sec.total/maxTotal;const isSel=selectedSector===sec.name;return(
            <div key={sec.name} onClick={()=>setSelectedSector(isSel?null:sec.name)} style={{background:`rgba(${c==="#8b5cf6"?"139,92,246":c==="#f59e0b"?"245,158,11":c==="#10b981"?"16,185,129":c==="#6366f1"?"99,102,241":"0,0,0"},.${Math.round(intensity*8)+2})`,border:"1px solid "+(isSel?c+"88":c+"30"),borderRadius:14,padding:18,position:"relative",overflow:"hidden",animation:"fadeUp .5s ease "+i*.1+"s both",cursor:"pointer",transition:"all .2s",transform:isSel?"scale(1.03)":"none",boxShadow:isSel?"0 8px 32px "+c+"33":"none"}} onMouseEnter={e=>{if(!isSel){e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.borderColor=c+"55";}}} onMouseLeave={e=>{if(!isSel){e.currentTarget.style.transform="none";e.currentTarget.style.borderColor=c+"30";}}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:c}}/>
              <div style={{fontSize:13,fontWeight:800,color:c,marginBottom:8}}>{sec.name}</div>
              <div style={{fontSize:26,fontWeight:900,color:"#fff",marginBottom:4}}>{sec.total}</div>
              <div style={{height:6,borderRadius:3,background:"rgba(239,68,68,.3)",overflow:"hidden",marginBottom:8}}>
                <div style={{height:"100%",width:sec.buyPct+"%",background:"#4ade80",transition:"width 1.5s"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"rgba(255,255,255,.4)",marginBottom:8}}>
                <span>🟢 {sec.buys} buys</span><span>🔴 {sec.sells} sells</span>
              </div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{sec.tickers.slice(0,4).map(t=><span key={t} style={{fontSize:12,background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.5)",padding:"2px 6px",borderRadius:3,fontWeight:700}}>{t}</span>)}</div>
            </div>
          );})}
        </div>
        {selData&&(
          <div style={{marginTop:18,background:"rgba(168,85,247,.04)",border:"1px solid rgba(168,85,247,.15)",borderRadius:16,padding:22,animation:"fadeUp .3s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
              <div>
                <div style={{fontSize:16,fontWeight:900,color:IC[selData.name]||"#94a3b8"}}>{selData.name} Sector Detail</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginTop:2}}>{selData.total} total trades across {selData.tickers.length} tickers</div>
              </div>
              <div style={{display:"flex",gap:12}}>
                <div style={{background:"rgba(74,222,128,.08)",borderRadius:8,padding:"6px 14px"}}><div style={{fontSize:12,color:"rgba(255,255,255,.2)",textTransform:"uppercase"}}>Buys</div><div style={{fontSize:14,fontWeight:800,color:"#4ade80"}}>{selData.buys}</div></div>
                <div style={{background:"rgba(239,68,68,.08)",borderRadius:8,padding:"6px 14px"}}><div style={{fontSize:12,color:"rgba(255,255,255,.2)",textTransform:"uppercase"}}>Sells</div><div style={{fontSize:14,fontWeight:800,color:"#f87171"}}>{selData.sells}</div></div>
              </div>
            </div>
            <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.5)",marginBottom:10,textTransform:"uppercase",letterSpacing:.5}}>All Tickers</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:18}}>
              {selData.tickers.map(t=><span key={t} style={{fontSize:12,background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.6)",padding:"4px 10px",borderRadius:5,fontWeight:700,border:"1px solid rgba(255,255,255,.08)"}}>{t}</span>)}
            </div>
            <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.5)",marginBottom:10,textTransform:"uppercase",letterSpacing:.5}}>Recent Trades</div>
            <div style={{display:"grid",gridTemplateColumns:mob()?"1fr":"1fr 1fr",gap:8}}>
              {selData.recentTrades.map((t,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,.03)",borderRadius:8,padding:"8px 12px",border:"1px solid rgba(255,255,255,.05)"}}>
                  <span style={{fontSize:12,fontWeight:800,color:"#fff",minWidth:40}}>{t.ticker}</span>
                  <span style={{fontSize:12,fontWeight:700,padding:"2px 6px",borderRadius:3,background:t.action==="BUY"?"rgba(74,222,128,.12)":"rgba(239,68,68,.12)",color:t.action==="BUY"?"#4ade80":"#f87171"}}>{t.action}</span>
                  <span style={{fontSize:12,color:"rgba(255,255,255,.5)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</span>
                  <span style={{fontSize:12,color:"rgba(255,255,255,.25)"}}>{t.amount}</span>
                  <span style={{fontSize:12,color:"rgba(255,255,255,.2)"}}>{t.tradeDate}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CW>
    </div>
  );
}

/* ── FOLLOW MONEY ─────────────────────── */
function FollowMoney({pols,trades,onSelect}){
  const[fecSt,setFEC]=useState({data:null,loading:true,err:""});
  useEffect(()=>{FEC_P.then(d=>setFEC({data:d,loading:false,err:""})).catch(e=>setFEC({data:null,loading:false,err:e.message}));},[]);
  const enriched=useMemo(()=>{if(!fecSt.data||!pols.length)return pols;return pols.map(p=>{if(p.raised>0)return p;const fr=lookupFEC(p.name,p.state,fecSt.data);if(!fr)return p;return{...p,photo:p.photo,raised:fr.receipts||0,spent:fr.disbursements||0,cash:fr.cash_on_hand_end_period||0,hasRealFinancials:true,fecId:fr.candidate_id||null};});},[fecSt.data,pols]);
  const withFEC=enriched.filter(p=>p.raised>0);
  const tR=withFEC.slice().sort((a,b)=>b.raised-a.raised).slice(0,6);
  const totalR=withFEC.reduce((a,p)=>a+p.raised,0);
  const dT=withFEC.filter(p=>p.party==="D").reduce((a,p)=>a+p.raised,0);
  const rT=withFEC.filter(p=>p.party==="R").reduce((a,p)=>a+p.raised,0);
  const dP=totalR>0?Math.round((dT/totalR)*100):50;
  const topTraders=useMemo(()=>{const m={};(trades||[]).forEach(t=>{if(!t.name)return;m[t.name]=(m[t.name]||0)+1;});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,cnt])=>{const ln=(name||"").toLowerCase().split(/\s+/).pop();const fi=(name||"")[0]?name[0].toLowerCase():"";return{name,cnt,pol:pols.find(p=>{const pln=p.name.toLowerCase().split(/\s+/).pop();const pfi=p.name[0]?p.name[0].toLowerCase():"";return ln.length>=3&&pln.endsWith(ln)&&(pfi===fi||(NICKS[fi]&&pfi===NICKS[fi][0]));})};});},[trades,pols]);
  const m=mob();
  return(
    <div style={{background:"linear-gradient(135deg,#18181b,#07030f)",padding:"72px 0"}}>
      <CW>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{fontSize:12,fontWeight:700,color:"rgba(168,85,247,.6)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>OpenFEC API · cycles 2020–2026</div>
          <h2 style={{fontSize:m?24:34,fontWeight:900,color:"#fff",margin:0,letterSpacing:-1}}>Follow the Money</h2>
          <LastUpdated label="FEC data current cycle"/>
          <p style={{fontSize:13,color:"rgba(255,255,255,.35)",margin:"4px 0 16px"}}>How much money have your representatives raised? Track campaign donations from PACs and individuals.</p>
        </div>
        {fecSt.loading&&<div style={{textAlign:"center",padding:"40px 0",display:"flex",flexDirection:"column",alignItems:"center",gap:12,color:"rgba(255,255,255,.3)"}}><Spin sz={24}/><div style={{fontSize:13}}>Loading FEC candidate totals...</div></div>}
        {fecSt.err&&<EBox msg={"FEC: "+fecSt.err}/>}
        {!fecSt.loading&&withFEC.length>0&&(
          <div>
            <div style={{display:"flex",gap:14,marginBottom:28,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:160,background:"rgba(168,85,247,.08)",border:"1px solid rgba(168,85,247,.2)",borderRadius:14,padding:20}}>
                <div style={{fontSize:12,color:"rgba(255,255,255,.35)",textTransform:"uppercase",marginBottom:4}}>Total FEC Tracked</div>
                <div style={{fontSize:28,fontWeight:900,color:"#a78bfa"}}>{fmt(totalR)}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginTop:4}}>{withFEC.length} of {pols.length} matched</div>
              </div>
              <div style={{flex:2,minWidth:200,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,padding:20}}>
                <div style={{fontSize:12,color:"rgba(255,255,255,.35)",textTransform:"uppercase",marginBottom:12}}>Party Fundraising Split</div>
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
                <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:16}}>Sorted by total receipts · FEC</div>
                {tR.map((p,i)=>(
                  <div key={p.id} onClick={()=>onSelect(p)} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.04)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"9px 6px",borderBottom:i<5?"1px solid rgba(255,255,255,.05)":"none",cursor:"pointer",borderRadius:8}}>
                    <span style={{fontSize:12,fontWeight:800,color:"rgba(255,255,255,.2)",minWidth:18,textAlign:"center"}}>{i+1}</span>
                    <Avatar pol={p} size={32}/>
                    <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div><div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{p.chamber} · {p.state}</div></div>
                    <span style={{fontSize:12,fontWeight:800,color:"#10b981"}}>{fmt(p.raised)}</span>
                  </div>
                ))}
              </div>
              <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,padding:22}}>
                <div style={{fontWeight:700,fontSize:14,color:"#fff",marginBottom:6}}>Most Active Traders</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:16}}>By STOCK Act disclosure count</div>
                {topTraders.map(({name,cnt,pol:p},i)=>(
                  <div key={name} onClick={()=>p&&onSelect(p)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 6px",borderBottom:i<5?"1px solid rgba(255,255,255,.05)":"none",cursor:p?"pointer":"default",borderRadius:8}} onMouseEnter={e=>p&&(e.currentTarget.style.background="rgba(255,255,255,.04)")} onMouseLeave={e=>p&&(e.currentTarget.style.background="transparent")}>
                    <span style={{fontSize:12,fontWeight:800,color:"rgba(255,255,255,.2)",minWidth:18,textAlign:"center"}}>{i+1}</span>
                    {p?<Avatar pol={p} size={32}/>:<div style={{width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,.05)",flexShrink:0}}/>}
                    <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div><div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{p?p.chamber+" · "+p.state:"Member"}</div></div>
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
  useEffect(()=>{window.__ldaSearch=setQ;return()=>{delete window.__ldaSearch;};},[]);
  const shown=useMemo(()=>{if(!data||!data.filings||!data.filings.length)return[];const f=data.filings;if(!q)return f.slice(0,12);const lq=q.toLowerCase();return f.filter(fi=>((fi.registrant&&fi.registrant.name)||"").toLowerCase().includes(lq)||((fi.client&&fi.client.name)||"").toLowerCase().includes(lq)||(fi.lobbying_activities||[]).some(a=>(a.general_issue_code_display||a.issue_code||"").toLowerCase().includes(lq))).slice(0,12);},[data,q]);
  const topIssues=useMemo(()=>{if(!data||!data.filings)return[];const m={};data.filings.forEach(f=>{(f.lobbying_activities||[]).forEach(a=>{const iss=a.general_issue_code_display||a.issue_code;if(iss)m[iss]=(m[iss]||0)+1;});});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,10);},[data]);
  return(
    <div data-section="lda" style={{background:"linear-gradient(180deg,#27272a,#07030f)",padding:"60px 0"}}>
      <CW>
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:14,marginBottom:24}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}><div style={{width:6,height:6,borderRadius:"50%",background:"#6366f1",boxShadow:"0 0 8px #6366f1"}}/><span style={{fontSize:12,fontWeight:700,color:"rgba(99,102,241,.7)",textTransform:"uppercase",letterSpacing:1.5}}>lda.senate.gov</span></div>
            <h2 style={{fontSize:mob()?22:28,fontWeight:900,color:"#fff",margin:0,letterSpacing:-1}}>Lobbying Disclosures</h2>
            <p style={{fontSize:13,color:"rgba(255,255,255,.35)",margin:"4px 0 16px"}}>Companies and organizations that officially lobby Congress. Filings show who is trying to influence legislation.</p>
          </div>
          {data&&!data.error&&<span style={{fontSize:12,background:"rgba(99,102,241,.12)",border:"1px solid rgba(99,102,241,.3)",color:"#818cf8",padding:"5px 14px",borderRadius:100,fontWeight:700}}>{(data.count||0).toLocaleString()} filings</span>}
        </div>
        {!data&&<div style={{display:"flex",alignItems:"center",gap:10,color:"rgba(255,255,255,.3)",fontSize:13,padding:"16px 0"}}><Spin sz={14} col="#6366f1"/>Connecting...</div>}
        {data&&data.error&&<EBox msg={data.error}/>}
        {data&&!data.error&&<>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search registrant or client..." style={{width:"100%",maxWidth:400,padding:"12px 18px",borderRadius:10,border:"1.5px solid rgba(99,102,241,.2)",background:"rgba(99,102,241,.05)",color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box",marginBottom:18,transition:"border-color .2s"}} onFocus={e=>e.target.style.borderColor="rgba(99,102,241,.5)"} onBlur={e=>e.target.style.borderColor="rgba(99,102,241,.2)"}/>
          <div style={{display:"grid",gridTemplateColumns:mob()?"1fr":"repeat(auto-fill,minmax(320px,1fr))",gap:14}}>
            {shown.map((f,i)=>{const inc=f.income||0;const activities=f.lobbying_activities||[];const issues=Array.from(new Set(activities.map(a=>a.general_issue_code_display||a.issue_code).filter(Boolean))).slice(0,4);const issColors=["#818cf8","#a78bfa","#c084fc","#e879f9","#f472b6","#fb923c","#34d399","#38bdf8"];return(
              <div key={i} style={{background:"rgba(99,102,241,.04)",border:"1px solid rgba(99,102,241,.12)",borderRadius:14,padding:18,position:"relative",overflow:"hidden",transition:"border-color .2s,transform .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(99,102,241,.3)";e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(99,102,241,.12)";e.currentTarget.style.transform="none";}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#6366f1,#818cf8)"}}/>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#c7d2fe",marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(f.registrant&&f.registrant.name)||"Unknown"}</div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,.3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Client: {(f.client&&f.client.name)||"--"}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
                    <div style={{fontSize:18,fontWeight:900,color:inc>0?"#34d399":"rgba(255,255,255,.12)"}}>{inc>0?fmt(inc):"--"}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.2)",textTransform:"uppercase",letterSpacing:.5}}>{inc>0?"Income":"Undisclosed"}</div>
                  </div>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:issues.length?10:0,marginTop:8}}>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.4)",fontWeight:500}}>{f.filing_year||"--"} {f.filing_period_display||""}</div>
                  {activities.length>0&&<div style={{fontSize:12,color:"rgba(99,102,241,.7)",fontWeight:700}}>{activities.length} activit{activities.length===1?"y":"ies"}</div>}
                </div>
                {issues.length>0&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:4}}>{issues.map((iss,j)=>{const c=issColors[j%issColors.length];return <span key={j} style={{fontSize:12,background:c+"18",color:c,padding:"3px 8px",borderRadius:5,fontWeight:700,border:"1px solid "+c+"30"}}>{iss}</span>;})}</div>}
              </div>
            );})}
          </div>
          {topIssues.length>0&&<div style={{marginTop:28,background:"rgba(99,102,241,.04)",border:"1px solid rgba(99,102,241,.12)",borderRadius:14,padding:20}}>
            <div style={{fontSize:12,fontWeight:700,color:"#818cf8",marginBottom:14,textTransform:"uppercase",letterSpacing:1}}>Top Lobbying Issues</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{topIssues.map(([issue,count],i)=><span key={i} style={{fontSize:12,fontWeight:600,background:"rgba(99,102,241,.1)",color:"#a5b4fc",padding:"6px 14px",borderRadius:8,border:"1px solid rgba(99,102,241,.2)",display:"inline-flex",alignItems:"center",gap:6}}>{issue}<span style={{fontSize:12,fontWeight:800,color:"#6366f1",background:"rgba(99,102,241,.15)",padding:"2px 6px",borderRadius:4,minWidth:18,textAlign:"center"}}>{count}</span></span>)}</div>
          </div>}
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
    <div style={{background:"#09090b",padding:"60px 0"}}>
      <CW>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:12,fontWeight:700,color:"rgba(168,85,247,.6)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>Congress.gov API · live</div>
          <h2 style={{fontSize:mob()?22:30,fontWeight:900,color:"#fff",margin:0,letterSpacing:-1}}>Recent Legislation</h2>
          <p style={{fontSize:13,color:"rgba(255,255,255,.35)",margin:"4px 0 16px"}}>The latest bills introduced in Congress. Track what laws your representatives are proposing.</p>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:24}}>
          {[["hr","House Bills"],["s","Senate Bills"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{padding:"8px 20px",borderRadius:100,border:"1px solid "+(tab===k?"rgba(168,85,247,.5)":"rgba(255,255,255,.1)"),background:tab===k?"rgba(168,85,247,.15)":"transparent",color:tab===k?"#a78bfa":"rgba(255,255,255,.4)",fontWeight:700,fontSize:12,cursor:"pointer"}}>{l}</button>)}
        </div>
        {!data&&<div style={{display:"flex",justifyContent:"center",padding:"28px 0"}}><Spin sz={20}/></div>}
        {data&&<div style={{display:"grid",gridTemplateColumns:mob()?"1fr":"repeat(auto-fill,minmax(320px,1fr))",gap:14}}>
          {bills.slice(0,12).map((b,i)=>{const type=b.type||tab.toUpperCase();const c=TC[type]||"#6366f1";return(
            <div key={i} style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:18,position:"relative",overflow:"hidden",animation:"fadeUp .4s ease "+i*.05+"s both",transition:"border-color .2s,transform .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=c+"44";e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,.06)";e.currentTarget.style.transform="none";}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:c}}/>
              <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:10}}><span style={{fontSize:12,fontWeight:800,background:c+"15",color:c,padding:"3px 8px",borderRadius:5,border:"1px solid "+c+"22"}}>{type} {b.number||""}</span><span style={{fontSize:12,color:"rgba(255,255,255,.2)",fontWeight:500}}>{b.congress||119}th Congress</span></div>
              <div style={{fontSize:15,fontWeight:700,color:"#e2e8f0",lineHeight:1.5,marginBottom:8}}>{(b.title||"").slice(0,100)}</div>
              {b.latestAction&&<div style={{fontSize:12,color:"rgba(255,255,255,.25)",lineHeight:1.5}}>{b.latestAction.text.slice(0,80)}</div>}
              <div style={{fontSize:12,color:"rgba(255,255,255,.12)",marginTop:8,fontWeight:500}}>{b.updateDate||"--"}</div>
            </div>
          );})}
        </div>}
      </CW>
    </div>
  );
}

/* ── DATA INSIGHTS ───────────────────── */
function DataInsights({pols,trades}){
  const insights=useMemo(()=>{
    const results=[];
    const withFEC=pols.filter(p=>p.hasRealFinancials);
    if(!withFEC.length)return results;
    // 1. PAC vs Individual funding ratio
    const pacMembers=withFEC.filter(p=>p.pacContrib>0&&p.raised>0);
    const avgPacRatio=pacMembers.reduce((a,p)=>a+(p.pacContrib/p.raised),0)/(pacMembers.length||1);
    results.push({title:"PAC Dependency",value:Math.round(avgPacRatio*100)+"%",desc:`Average member gets ${Math.round(avgPacRatio*100)}% of funding from PACs and political committees`,color:"#f59e0b",icon:"\uD83D\uDCB0"});
    // 2. Campaign debt leaders
    const debtors=withFEC.filter(p=>p.debts>10000).sort((a,b)=>b.debts-a.debts).slice(0,3);
    if(debtors.length)results.push({title:"Campaign Debt",value:fmt(debtors[0].debts),desc:`${debtors[0].name} leads in campaign debt. ${debtors.length} members owe over $10K`,color:"#ef4444",icon:"\uD83C\uDFE6"});
    // 3. Freshmen vs veterans fundraising
    const freshmen=withFEC.filter(p=>p.yearsInOffice<=2&&p.raised>0);
    const veterans=withFEC.filter(p=>p.yearsInOffice>10&&p.raised>0);
    if(freshmen.length&&veterans.length){
      const freshAvg=freshmen.reduce((a,p)=>a+p.raised,0)/freshmen.length;
      const vetAvg=veterans.reduce((a,p)=>a+p.raised,0)/veterans.length;
      const ratio=Math.round(vetAvg/(freshAvg||1));
      if(ratio>0)results.push({title:"Experience Gap",value:ratio+"x",desc:`Veterans (10+ yrs) raise ${ratio}x more than freshmen on average`,color:"#6366f1",icon:"\uD83D\uDCCA"});
    }
    // 4. Party fundraising efficiency
    const dems=withFEC.filter(p=>p.party==="D"&&p.raised>0);
    const reps=withFEC.filter(p=>p.party==="R"&&p.raised>0);
    const demAvg=dems.reduce((a,p)=>a+p.raised,0)/(dems.length||1);
    const repAvg=reps.reduce((a,p)=>a+p.raised,0)/(reps.length||1);
    results.push({title:"D vs R Fundraising",value:demAvg>repAvg?"D leads":"R leads",desc:`Democrats avg ${fmt(demAvg)}/member vs Republicans avg ${fmt(repAvg)}/member`,color:"#3b82f6",icon:"\u2696\uFE0F"});
    // 5. Top trading senators cross-referenced with fundraising
    const tradeByName={};
    (trades||[]).forEach(t=>{if(t.name)tradeByName[t.name]=(tradeByName[t.name]||0)+1;});
    const topTrader=Object.entries(tradeByName).sort((a,b)=>b[1]-a[1])[0];
    const topTraderPol=topTrader?pols.find(p=>p.name.toLowerCase().includes(topTrader[0].toLowerCase().split(/\s+/).pop())):null;
    if(topTrader&&topTraderPol)results.push({title:"Most Active Trader",value:topTrader[1]+" trades",desc:`${topTrader[0]} made ${topTrader[1]} trades${topTraderPol.raised>0?" while raising "+fmt(topTraderPol.raised):""}`,color:"#10b981",icon:"\uD83D\uDCC8",pol:topTraderPol});
    // 6. Cash-poor members (high spending, low cash)
    const cashPoor=withFEC.filter(p=>p.raised>1e6&&p.cash<p.raised*0.1).sort((a,b)=>a.cash/a.raised-b.cash/b.raised).slice(0,3);
    if(cashPoor.length)results.push({title:"Burn Rate Alert",value:cashPoor.length+" members",desc:`${cashPoor[0].name} spent ${Math.round((1-cashPoor[0].cash/cashPoor[0].raised)*100)}% of raised funds \u2014 only ${fmt(cashPoor[0].cash)} cash remaining`,color:"#f97316",icon:"\uD83D\uDD25",pol:cashPoor[0]});
    // 7. Sector concentration in trades
    const sectorCounts={};
    (trades||[]).forEach(t=>{
      if(!t.ticker)return;
      const sec=["NVDA","AMD","INTC","QCOM","TSM","MSFT","AAPL","GOOGL","META","AMZN"].includes(t.ticker)?"Technology":["LMT","RTX","NOC","GD","BA"].includes(t.ticker)?"Defense":["XOM","CVX","COP","OXY"].includes(t.ticker)?"Energy":["JPM","GS","MS","BAC","WFC","BLK"].includes(t.ticker)?"Finance":["PFE","MRNA","JNJ","ABBV","MRK"].includes(t.ticker)?"Pharma":"Other";
      sectorCounts[sec]=(sectorCounts[sec]||0)+1;
    });
    const topSector=Object.entries(sectorCounts).filter(([k])=>k!=="Other").sort((a,b)=>b[1]-a[1])[0];
    if(topSector)results.push({title:"Congress Favorite Sector",value:topSector[0],desc:`${topSector[0]} leads with ${topSector[1]} trades \u2014 ${Math.round(topSector[1]/(trades||[]).filter(t=>t.ticker).length*100)}% of all identified trades`,color:"#8b5cf6",icon:"\uD83C\uDFED"});
    // 8. States with most concentrated power (high $ per official)
    const stateData={};
    withFEC.forEach(p=>{if(!stateData[p.state])stateData[p.state]={raised:0,count:0};stateData[p.state].raised+=p.raised;stateData[p.state].count++;});
    const topPowerState=Object.entries(stateData).map(([st,d])=>({st,avg:d.raised/d.count,total:d.raised})).sort((a,b)=>b.avg-a.avg)[0];
    if(topPowerState)results.push({title:"Money Capital",value:topPowerState.st,desc:`${topPowerState.st} officials average ${fmt(topPowerState.avg)} per member \u2014 highest fundraising concentration`,color:"#ec4899",icon:"\uD83C\uDFDB\uFE0F"});
    // 9. Peak trading month — cross-reference with legislation
    const tradesByMonth={};
    (trades||[]).forEach(t=>{if(!t.tradeDate||t.tradeDate==="--")return;const month=t.tradeDate.substring(0,7);tradesByMonth[month]=(tradesByMonth[month]||0)+1;});
    const peakMonth=Object.entries(tradesByMonth).sort((a,b)=>b[1]-a[1])[0];
    if(peakMonth)results.push({title:"Peak Trading Month",value:peakMonth[0],desc:`${peakMonth[1]} trades in ${peakMonth[0]} \u2014 check what legislation was moving during this period`,color:"#14b8a6",icon:"\uD83D\uDCC5"});
    // 10. Funding independence — self-funded vs PAC-dependent
    const selfFunded=withFEC.filter(p=>p.individualContrib>p.pacContrib*3&&p.raised>1e6);
    const pacDependent=withFEC.filter(p=>p.pacContrib>p.individualContrib&&p.raised>1e6);
    results.push({title:"Funding Independence",value:`${selfFunded.length} vs ${pacDependent.length}`,desc:`${selfFunded.length} members are individual-donor funded (3x+ more individual than PAC). ${pacDependent.length} rely more on PACs.`,color:"#22d3ee",icon:"\uD83C\uDFDB\uFE0F"});
    // 11. Family trading patterns (owner=Spouse vs Self)
    const selfTrades=(trades||[]).filter(t=>t.owner==="Self").length;
    const spouseTrades=(trades||[]).filter(t=>t.owner==="Spouse").length;
    const jointTrades=(trades||[]).filter(t=>t.owner==="Joint").length;
    if(selfTrades+spouseTrades>10)results.push({title:"Family Trading",value:`${Math.round(spouseTrades/(selfTrades+spouseTrades+jointTrades)*100)}% spousal`,desc:`${selfTrades} self-trades, ${spouseTrades} spouse trades, ${jointTrades} joint. Spousal trades may be less scrutinized.`,color:"#e879f9",icon:"👨‍👩‍👧"});
    // 12. Asset type concentration
    const stocks=(trades||[]).filter(t=>t.assetType==="Stock").length;
    const options=(trades||[]).filter(t=>t.assetType==="Stock Option").length;
    const bonds=(trades||[]).filter(t=>(t.assetType||"").includes("Bond")).length;
    const totalTyped=stocks+options+bonds;
    if(totalTyped>10)results.push({title:"Asset Mix",value:`${Math.round(stocks/totalTyped*100)}% stocks`,desc:`${stocks} stocks, ${options} options, ${bonds} bonds. Options indicate more sophisticated trading strategies.`,color:"#38bdf8",icon:"📊"});
    // 13. Gender fundraising gap (from GovTrack data)
    const females=withFEC.filter(p=>p.gender==="Female"&&p.raised>0);
    const males=withFEC.filter(p=>p.gender==="Male"&&p.raised>0);
    if(females.length>10&&males.length>10){
      const fAvg=females.reduce((a,p)=>a+p.raised,0)/females.length;
      const mAvg=males.reduce((a,p)=>a+p.raised,0)/males.length;
      results.push({title:"Gender Fundraising",value:fAvg>mAvg?"Women lead":"Men lead",desc:`Women avg ${fmt(fAvg)}/member (${females.length} members) vs Men avg ${fmt(mAvg)}/member (${males.length} members)`,color:"#fb7185",icon:"⚤"});
    }
    // 14. Leadership premium
    const leaders=withFEC.filter(p=>p.leadership&&p.raised>0);
    const nonLeaders=withFEC.filter(p=>!p.leadership&&p.raised>0);
    if(leaders.length>2){
      const leadAvg=leaders.reduce((a,p)=>a+p.raised,0)/leaders.length;
      const nonAvg=nonLeaders.reduce((a,p)=>a+p.raised,0)/(nonLeaders.length||1);
      results.push({title:"Leadership Premium",value:Math.round(leadAvg/nonAvg)+"x",desc:`Congressional leaders raise ${Math.round(leadAvg/nonAvg)}x more (${fmt(leadAvg)}) than rank-and-file (${fmt(nonAvg)})`,color:"#fbbf24",icon:"👑"});
    }
    // 15. Age of Congress
    const withAge=withFEC.filter(p=>p.gender);// gender implies GovTrack data loaded
    if(withAge.length>100){
      const ages=withAge.map(p=>{
        // birthday from GovTrack not in pol object directly, use yearsInOffice as proxy
        return p.yearsInOffice||0;
      }).filter(a=>a>0);
      const avgTenure=ages.length?Math.round(ages.reduce((a,b)=>a+b,0)/ages.length):0;
      if(avgTenure>0)results.push({title:"Avg Tenure",value:avgTenure+" years",desc:`Average member has served ${avgTenure} years. ${withFEC.filter(p=>p.yearsInOffice>20).length} members have 20+ years of service.`,color:"#a78bfa",icon:"⏳"});
    }
    // 16. Transfer money (PAC-to-PAC pipeline)
    const withTransfers=withFEC.filter(p=>p.transfers>100000);
    if(withTransfers.length>0){
      const totalTransfers=withTransfers.reduce((a,p)=>a+p.transfers,0);
      results.push({title:"PAC Pipeline",value:fmt(totalTransfers),desc:`${withTransfers.length} members received ${fmt(totalTransfers)} in committee-to-committee transfers — money flowing between PACs.`,color:"#34d399",icon:"🔄"});
    }
    // 17. Freshmen fundraising race
    const freshmen2=withFEC.filter(p=>p.yearsInOffice<=2&&p.raised>0).sort((a,b)=>b.raised-a.raised).slice(0,3);
    if(freshmen2.length)results.push({title:"Top Freshman",value:freshmen2[0].name.split(" ").pop(),desc:`Freshman ${freshmen2[0].name} leads new members with ${fmt(freshmen2[0].raised)} raised in their first term`,color:"#22d3ee",icon:"\uD83C\uDF1F",pol:freshmen2[0]});
    // 18. Cash reserves — who's best prepared
    const cashKings=withFEC.filter(p=>p.cash>0).sort((a,b)=>b.cash-a.cash).slice(0,3);
    if(cashKings.length)results.push({title:"War Chest Leader",value:fmt(cashKings[0].cash),desc:`${cashKings[0].name} has the largest cash reserve. Top 3: ${cashKings.map(p=>p.name.split(" ").pop()).join(", ")}`,color:"#34d399",icon:"\uD83C\uDFE6",pol:cashKings[0]});
    // 19. Small donor vs big donor
    const smallDonor=withFEC.filter(p=>p.individualContrib>0&&p.raised>1e6);
    const avgSmallRatio=smallDonor.length?smallDonor.reduce((a,p)=>a+(p.individualContrib/p.raised),0)/smallDonor.length:0;
    if(avgSmallRatio>0)results.push({title:"Individual vs PAC",value:Math.round(avgSmallRatio*100)+"% individual",desc:`On average, ${Math.round(avgSmallRatio*100)}% of member funding comes from individuals vs PACs and committees`,color:"#818cf8",icon:"\uD83D\uDC64"});
    // 20. Trading diversity — how many unique tickers traded
    const uniqueTickers=new Set((trades||[]).filter(t=>t.ticker).map(t=>t.ticker)).size;
    if(uniqueTickers>5)results.push({title:"Trading Diversity",value:uniqueTickers+" tickers",desc:`Congress traded ${uniqueTickers} different securities. The most concentrated portfolio trades just a few stocks repeatedly.`,color:"#f472b6",icon:"\uD83C\uDFAF"});
    // 21. Biggest spenders (disbursements relative to receipts)
    const topSpenders=withFEC.filter(p=>p.spent>1e6).sort((a,b)=>(b.spent/b.raised)-(a.spent/a.raised)).slice(0,3);
    if(topSpenders.length&&topSpenders[0].raised>0)results.push({title:"Highest Burn Rate",value:Math.round(topSpenders[0].spent/topSpenders[0].raised*100)+"%",desc:`${topSpenders[0].name} spent ${fmt(topSpenders[0].spent)} of ${fmt(topSpenders[0].raised)} raised \u2014 ${Math.round(topSpenders[0].spent/topSpenders[0].raised*100)}% burn rate`,color:"#f97316",icon:"\uD83D\uDD25",pol:topSpenders[0]});
    // 22. Most trades per dollar raised (trading intensity)
    const tradingIntensity=withFEC.filter(p=>p.raised>1e6).map(p=>{const tc=(trades||[]).filter(t=>{const ln=(t.name||"").toLowerCase().split(/\s+/).pop();return ln.length>=3&&p.name.toLowerCase().endsWith(ln);}).length;return{...p,tc};}).filter(p=>p.tc>0).sort((a,b)=>(b.tc/b.raised)-(a.tc/a.raised));
    if(tradingIntensity.length)results.push({title:"Trading vs Fundraising",value:tradingIntensity[0].tc+" trades",desc:`${tradingIntensity[0].name} made ${tradingIntensity[0].tc} trades while raising ${fmt(tradingIntensity[0].raised)} \u2014 most active trader relative to fundraising`,color:"#06b6d4",icon:"\u26A1",pol:tradingIntensity[0]});
    // 23. Chamber comparison — Senate vs House fundraising
    const senPols=withFEC.filter(p=>p.chamber==="Senate"&&p.raised>0);
    const houPols=withFEC.filter(p=>p.chamber==="House"&&p.raised>0);
    if(senPols.length&&houPols.length){const senAvg=senPols.reduce((a,p)=>a+p.raised,0)/senPols.length;const houAvg=houPols.reduce((a,p)=>a+p.raised,0)/houPols.length;results.push({title:"Senate vs House",value:Math.round(senAvg/houAvg)+"x",desc:`Senators raise ${Math.round(senAvg/houAvg)}x more (avg ${fmt(senAvg)}) than House members (avg ${fmt(houAvg)})`,color:"#8b5cf6",icon:"\uD83C\uDFDB\uFE0F"});}
    // 24. Debt-to-cash ratio — who's underwater
    const underwater=withFEC.filter(p=>p.debts>p.cash&&p.debts>50000).sort((a,b)=>b.debts-a.debts);
    if(underwater.length)results.push({title:"Underwater Campaigns",value:underwater.length+"",desc:`${underwater.length} members have more debt than cash. ${underwater[0].name} owes ${fmt(underwater[0].debts)} with only ${fmt(underwater[0].cash)} on hand`,color:"#ef4444",icon:"\uD83D\uDEA8",pol:underwater[0]});
    // 25. Ideology vs PAC funding
    const withIdeology=withFEC.filter(p=>p.ideology!=null&&p.ideology!==0&&p.raised>1e6);
    if(withIdeology.length>20){
      const extreme=withIdeology.filter(p=>Math.abs(p.ideology)>0.5);
      const moderate=withIdeology.filter(p=>Math.abs(p.ideology)<=0.3);
      const extremeAvg=extreme.reduce((a,p)=>a+p.raised,0)/(extreme.length||1);
      const moderateAvg=moderate.reduce((a,p)=>a+p.raised,0)/(moderate.length||1);
      results.push({title:"Ideology & Money",value:extremeAvg>moderateAvg?"Extremes raise more":"Moderates raise more",desc:`Ideological extremes avg ${fmt(extremeAvg)} vs moderates avg ${fmt(moderateAvg)}. ${extreme.length} extreme, ${moderate.length} moderate members.`,color:"#c084fc",icon:"\uD83C\uDFAF"});
    }
    // 26. Trading vs Voting attendance
    const tradersWithVotes=withFEC.filter(p=>p.totalVotes>0);
    const activeTraders=tradersWithVotes.filter(p=>{const tc=(trades||[]).filter(t=>{const ln=(t.name||"").toLowerCase().split(/\s+/).pop();return ln.length>=3&&p.name.toLowerCase().endsWith(ln);}).length;return tc>5;});
    const nonTraders=tradersWithVotes.filter(p=>{const tc=(trades||[]).filter(t=>{const ln=(t.name||"").toLowerCase().split(/\s+/).pop();return ln.length>=3&&p.name.toLowerCase().endsWith(ln);}).length;return tc===0;});
    if(activeTraders.length>3&&nonTraders.length>10){
      const traderAbsent=activeTraders.reduce((a,p)=>a+p.absentCount,0)/activeTraders.length;
      const nonAbsent=nonTraders.reduce((a,p)=>a+p.absentCount,0)/nonTraders.length;
      results.push({title:"Traders vs Attendance",value:traderAbsent>nonAbsent?"Traders miss more":"Traders miss fewer",desc:`Active traders miss avg ${Math.round(traderAbsent)} votes vs non-traders ${Math.round(nonAbsent)} missed. ${activeTraders.length} active traders analyzed.`,color:"#fb923c",icon:"\uD83D\uDCCB"});
    }
    // 27. Gender ideology gap
    const femalesI=withFEC.filter(p=>p.gender==="Female"&&p.ideology!=null);
    const malesI=withFEC.filter(p=>p.gender==="Male"&&p.ideology!=null);
    if(femalesI.length>10&&malesI.length>10){
      const fAvgI=femalesI.reduce((a,p)=>a+p.ideology,0)/femalesI.length;
      const mAvgI=malesI.reduce((a,p)=>a+p.ideology,0)/malesI.length;
      results.push({title:"Gender & Ideology",value:`${fAvgI<mAvgI?"Women more liberal":"Men more liberal"}`,desc:`Women avg ideology: ${fAvgI.toFixed(2)} vs Men: ${mAvgI.toFixed(2)} (range: -1 liberal to +1 conservative)`,color:"#f472b6",icon:"\u26A4"});
    }
    // 28. Committee/Sector Conflict
    const conflicted=withFEC.filter(p=>{
      const tc=(trades||[]).filter(t=>{const ln=(t.name||"").toLowerCase().split(/\s+/).pop();return ln.length>=3&&p.name.toLowerCase().endsWith(ln);});
      const sectors=new Set(tc.map(t=>classifyTicker(t.ticker)).filter(s=>s!=="Other"));
      return sectors.size>0&&p.pacContrib>0;
    });
    if(conflicted.length>0)results.push({title:"Sector Conflicts",value:conflicted.length+"",desc:`${conflicted.length} members trade stocks AND receive PAC money in the same industry sectors. This creates potential conflict of interest.`,color:"#f97316",icon:"⚠️"});
    return results;
  },[pols,trades]);
  const[expandedInsight,setExpandedInsight]=useState(null);
  if(!insights.length)return null;
  const m=mob();
  return(
    <div style={{background:"linear-gradient(135deg,#18181b,#09090b)",padding:"60px 0"}}>
      <CW>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:12,fontWeight:700,color:"rgba(99,102,241,.6)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>Cross-Referenced Analysis</div>
          <h2 style={{fontSize:m?22:30,fontWeight:900,color:"#fff",margin:0,letterSpacing:-1}}>Data-Driven Insights</h2>
          <LastUpdated/>
          <p style={{fontSize:13,color:"rgba(255,255,255,.35)",margin:"8px 0 0",lineHeight:1.5}}>Patterns and correlations discovered by cross-referencing FEC, trade, and lobbying data. Click any card for deeper analysis.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:m?"1fr":"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
          {insights.map((ins,i)=>(
            <div key={i} onClick={()=>setExpandedInsight(expandedInsight===i?null:i)} style={{background:expandedInsight===i?"rgba(99,102,241,.08)":"rgba(99,102,241,.04)",border:"1px solid "+(expandedInsight===i?"rgba(99,102,241,.3)":"rgba(99,102,241,.12)"),borderRadius:16,padding:22,position:"relative",overflow:"hidden",transition:"all .2s",cursor:"pointer"}} onMouseEnter={e=>{if(expandedInsight!==i){e.currentTarget.style.borderColor="rgba(99,102,241,.25)";e.currentTarget.style.transform="translateY(-2px)";}}} onMouseLeave={e=>{if(expandedInsight!==i){e.currentTarget.style.borderColor="rgba(99,102,241,.12)";e.currentTarget.style.transform="none";}}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:ins.color}}/>
              <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
                {ins.pol?<Avatar pol={ins.pol} size={36}/>:<div style={{fontSize:28,flexShrink:0}}>{ins.icon}</div>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:ins.color,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{ins.title}</div>
                  <div style={{fontSize:24,fontWeight:900,color:"#fff",marginBottom:8}}>{ins.value}</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.5}}>{ins.desc}</div>
                </div>
              </div>
              {expandedInsight===i&&<div style={{marginTop:16,paddingTop:16,borderTop:"1px solid rgba(99,102,241,.15)"}}>
                <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0",marginBottom:10}}>Deep Analysis</div>
                {ins.title==="PAC Dependency"&&<div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.7}}>PAC dependency measures how reliant members are on Political Action Committee funding vs individual donors. A high PAC ratio suggests the member may be more influenced by organized special interests than grassroots constituent support. <strong style={{color:"#e2e8f0"}}>The average across all members is {ins.value}.</strong> Compare this with their voting record to see if PAC-funded members vote differently on issues their donors care about.</div>}
                {ins.title==="Campaign Debt"&&<div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.7}}>Campaign debt creates financial pressure that can influence legislative behavior. Members with significant debt may be more susceptible to fundraising pressure from lobbyists and PACs. <strong style={{color:"#e2e8f0"}}>{ins.desc}</strong> Check their donor list and voting record for potential connections between debt relief donations and legislative votes.</div>}
                {ins.title==="Experience Gap"&&<div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.7}}>The fundraising gap between veterans and freshmen reflects the incumbency advantage — established members have deeper donor networks, more name recognition, and more PAC relationships. This creates a structural barrier for new candidates and may entrench existing power dynamics. <strong style={{color:"#e2e8f0"}}>Veterans raise {ins.value} more than freshmen on average.</strong></div>}
                {ins.title==="D vs R Fundraising"&&<div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.7}}>Party fundraising differences reflect each party's donor base and strategy. Higher per-member averages don't necessarily mean more total money — they may indicate fewer competitive races or more concentrated funding. <strong style={{color:"#e2e8f0"}}>{ins.desc}</strong> Cross-reference with voting patterns to see if higher-funded party members vote differently.</div>}
                {ins.title==="Most Active Trader"&&ins.pol&&<div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.7}}>High-volume traders in Congress attract scrutiny under the STOCK Act. <strong style={{color:"#e2e8f0"}}>{ins.pol.name}</strong> is the most active trader{ins.pol.raised>0?" while raising "+fmt(ins.pol.raised)+" in campaign funds":""}. Cross-reference their trades with committee assignments and recent votes to check for potential conflicts of interest. Their ideology score is {ins.pol.ideology!=null?ins.pol.ideology.toFixed(2):"unknown"}.</div>}
                {ins.title==="Burn Rate Alert"&&ins.pol&&<div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.7}}>A high burn rate means the campaign is spending nearly as fast as it raises money, leaving little cash reserve. <strong style={{color:"#e2e8f0"}}>{ins.pol.name}</strong> has spent almost all raised funds. This creates urgency to fundraise more aggressively, potentially increasing susceptibility to PAC influence. Their cash on hand: {fmt(ins.pol.cash)}.</div>}
                {ins.title==="Congress Favorite Sector"&&<div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.7}}>When Congress members concentrate trades in specific sectors, it raises questions about whether they're using legislative knowledge to inform investment decisions. <strong style={{color:"#e2e8f0"}}>{ins.value}</strong> is the most-traded sector. Cross-reference with upcoming legislation in these sectors and check which members on relevant committees are trading these stocks.</div>}
                {ins.title==="Money Capital"&&<div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.7}}>States with the highest per-member fundraising often have the most competitive races or the most influential legislative delegations. <strong style={{color:"#e2e8f9"}}>{ins.value}</strong> leads in per-member fundraising. This concentration of political money can create outsized influence for these state delegations on national policy.</div>}
                {ins.title==="Peak Trading Month"&&<div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.7}}>Spikes in congressional trading often correlate with major legislative or economic events. <strong style={{color:"#e2e8f0"}}>{ins.value}</strong> saw the most trades. Research what major legislation was being debated, what economic events occurred, and whether the trades appear correlated with policy decisions members had advance knowledge of.</div>}
                {ins.title==="Funding Independence"&&<div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.7}}>Members funded primarily by individual donors are theoretically more responsive to their constituents than those reliant on PAC money. <strong style={{color:"#e2e8f0"}}>{ins.desc}</strong> Compare the voting records of individual-funded vs PAC-funded members on key issues to test this hypothesis.</div>}
                {ins.title==="Family Trading"&&<div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.7}}>STOCK Act disclosures include trades by spouses and dependent children. Spousal trades may receive less public scrutiny but can still represent conflicts of interest. <strong style={{color:"#e2e8f0"}}>{ins.desc}</strong> Look for patterns where spousal trades occur shortly before or after legislative action in the same sector.</div>}
                {ins.title==="Asset Mix"&&<div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.7}}>Options trading by members of Congress is particularly significant because options are leveraged instruments that amplify returns — and losses. A member trading options in sectors they legislate on has a much larger potential conflict of interest than simple stock purchases. <strong style={{color:"#e2e8f0"}}>{ins.desc}</strong></div>}
                {ins.title==="Gender Fundraising"&&<div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.7}}>Fundraising disparities between genders reflect structural differences in political donor networks. <strong style={{color:"#e2e8f0"}}>{ins.desc}</strong> These differences can affect legislative priorities, committee assignments, and overall representation in Congress.</div>}
                {ins.title==="Leadership Premium"&&<div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.7}}>Congressional leaders (Speaker, Whips, Committee Chairs) raise dramatically more than rank-and-file members because of their disproportionate influence over legislation. <strong style={{color:"#e2e8f0"}}>{ins.desc}</strong> This fundraising advantage reinforces the power of leadership positions and creates incentive structures around seniority.</div>}
                {ins.title==="Ideology & Money"&&<div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.7}}>The relationship between ideology and fundraising reveals whether donors prefer moderate or extreme candidates. <strong style={{color:"#e2e8f0"}}>{ins.desc}</strong> This pattern affects which types of candidates can viably run for office and may drive polarization if extreme positions are rewarded with more funding.</div>}
                {ins.title==="Sector Conflicts"&&<div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.7}}>Members who trade stocks in the same sectors from which they receive PAC money have a structural conflict of interest. Even without provable insider trading, the appearance of conflict undermines public trust. <strong style={{color:"#e2e8f0"}}>{ins.desc}</strong> These members warrant closer scrutiny of their voting patterns on sector-relevant legislation.</div>}
                {(ins.title==="Top Freshman"||ins.title==="War Chest Leader"||ins.title==="Highest Burn Rate"||ins.title==="Trading vs Fundraising"||ins.title==="Underwater Campaigns")&&ins.pol&&<div style={{marginTop:10,display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"rgba(255,255,255,.03)",borderRadius:8,cursor:"pointer"}} onClick={e=>{e.stopPropagation();window.__goSel&&window.__goSel(ins.pol);}}>
                  <Avatar pol={ins.pol} size={32}/>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{ins.pol.name}</div><div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{ins.pol.party==="D"?"Democrat":"Republican"} · {ins.pol.chamber} · {ins.pol.state}</div></div>
                  <span style={{fontSize:13,color:"#67e8f9",fontWeight:600}}>View Profile →</span>
                </div>}
                <Disclaimer/>
              </div>}
            </div>
          ))}
        </div>
        <Disclaimer/>
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
  const countryCounts=useMemo(()=>{const m={};registrants.forEach(r=>{const c=r.country||r.registrant_country||"Unknown";if(c&&c!=="Unknown")m[c]=(m[c]||0)+1;});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,8);},[registrants]);
  const maxCountry=countryCounts.length>0?countryCounts[0][1]:1;
  return(
    <div style={{background:"#09090b",padding:"60px 0"}}>
      <CW>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:12,fontWeight:700,color:"rgba(249,115,22,.6)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>FARA · Foreign Agent Registration Act</div>
          <h2 style={{fontSize:mob()?22:30,fontWeight:900,color:"#fff",margin:0,letterSpacing:-1}}>Foreign Agent Registrants</h2>
          <p style={{fontSize:13,color:"rgba(255,255,255,.35)",margin:"4px 0 16px"}}>Organizations registered to lobby on behalf of foreign governments and entities in the United States.</p>
          {data&&<div style={{display:"flex",gap:8,justifyContent:"center",marginTop:10,flexWrap:"wrap"}}>
            <span style={{fontSize:12,fontWeight:700,background:"rgba(249,115,22,.1)",color:"#f97316",border:"1px solid rgba(249,115,22,.25)",padding:"4px 14px",borderRadius:100}}>{data.total||registrants.length} registrants</span>
            {data.fetchedAt&&<span style={{fontSize:12,color:"rgba(255,255,255,.2)",padding:"4px 0"}}>Updated {data.fetchedAt.slice(0,10)}</span>}
          </div>}
        </div>
        <div style={{maxWidth:420,margin:"0 auto 24px",position:"relative"}}>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search registrants by name or country..." maxLength={80} style={{width:"100%",padding:"12px 18px 12px 40px",borderRadius:12,border:"1px solid rgba(249,115,22,.2)",background:"rgba(249,115,22,.04)",color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box"}} onFocus={e=>{e.target.style.borderColor="rgba(249,115,22,.5)";}} onBlur={e=>{e.target.style.borderColor="rgba(249,115,22,.2)";}}/>
          <svg style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",opacity:.4,pointerEvents:"none"}} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        {countryCounts.length>0&&<div style={{maxWidth:600,margin:"0 auto 28px",background:"rgba(249,115,22,.04)",border:"1px solid rgba(249,115,22,.12)",borderRadius:14,padding:20}}>
          <div style={{fontSize:12,fontWeight:700,color:"#f97316",marginBottom:14,textTransform:"uppercase",letterSpacing:1}}>Top Countries by Registrant Count</div>
          {countryCounts.map(([country,count],i)=><div key={country} style={{marginBottom:8,animation:"fadeUp .3s ease "+i*.04+"s both"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
              <span style={{fontSize:12,fontWeight:600,color:"#e2e8f0"}}>{COUNTRY_NAMES[country]||COUNTRY_NAMES[country.toLowerCase()]||country}</span>
              <span style={{fontSize:12,fontWeight:800,color:"#f97316"}}>{count}</span>
            </div>
            <div style={{width:"100%",height:8,borderRadius:4,background:"rgba(249,115,22,.08)",overflow:"hidden"}}>
              <div style={{width:(count/maxCountry*100)+"%",height:"100%",borderRadius:4,background:"linear-gradient(90deg,#f97316,#fb923c)",transition:"width .8s ease"}}/>
            </div>
          </div>)}
        </div>}
        {!data&&<div style={{display:"flex",justifyContent:"center",padding:"28px 0"}}><Spin sz={20}/></div>}
        {data&&<div style={{display:"grid",gridTemplateColumns:mob()?"1fr":"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
          {filtered.slice(0,18).map((r,i)=>{const name=r.registrant_name||r.name||"Unknown";const country=r.country||r.registrant_country||"N/A";const status=r.status||r.registration_status||"";const regNum=r.registration_number||r.reg_number||"";const lastMod=r.date_last_modified||r.last_modified||"";const isActive=!status||/active/i.test(status);return(
            <div key={i} style={{background:"rgba(249,115,22,.04)",border:"1px solid rgba(249,115,22,.12)",borderRadius:14,padding:18,position:"relative",overflow:"hidden",animation:"fadeUp .4s ease "+i*.04+"s both",transition:"border-color .2s,transform .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(249,115,22,.4)";e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(249,115,22,.12)";e.currentTarget.style.transform="none";}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"#f97316"}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0",lineHeight:1.5,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
                {status&&<span style={{fontSize:9,fontWeight:700,background:isActive?"rgba(34,197,94,.12)":"rgba(239,68,68,.12)",color:isActive?"#4ade80":"#f87171",padding:"2px 7px",borderRadius:4,flexShrink:0,marginLeft:6,textTransform:"uppercase"}}>{isActive?"Active":"Terminated"}</span>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:8}}>
                <span style={{fontSize:12,fontWeight:700,background:"rgba(249,115,22,.15)",color:"#f97316",padding:"3px 10px",borderRadius:6,border:"1px solid rgba(249,115,22,.25)"}}>{COUNTRY_NAMES[country]||COUNTRY_NAMES[country.toLowerCase()]||country}</span>
                {regNum&&<span style={{fontSize:12,color:"rgba(255,255,255,.2)",fontWeight:500}}>#{regNum}</span>}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                {r.registration_date&&<div style={{fontSize:12,color:"rgba(255,255,255,.2)"}}> Registered: {r.registration_date}</div>}
                {lastMod&&<div style={{fontSize:12,color:"rgba(255,255,255,.15)"}}> Modified: {lastMod.slice(0,10)}</div>}
              </div>
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
  const[agencies,setAgencies]=useState(null);
  useEffect(()=>{USA_AGENCIES.then(d=>{const sorted=[...(d||[])].sort((a,b)=>(b.budget_authority_amount||0)-(a.budget_authority_amount||0));setAgencies(sorted);}).catch(()=>setAgencies([]));},[]);
  const top10=(agencies||[]).slice(0,10);
  const maxBudget=top10.length>0?Math.max(...top10.map(a=>a.budget_authority_amount||0)):1;
  const totalTracked=top10.reduce((s,a)=>s+(a.budget_authority_amount||0),0);
  return(
    <div style={{background:"linear-gradient(180deg,#07030f,#060d0a)",padding:"60px 0"}}>
      <CW>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:12,fontWeight:700,color:"rgba(16,185,129,.6)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>USASpending.gov API · live</div>
          <h2 style={{fontSize:mob()?22:30,fontWeight:900,color:"#fff",margin:0,letterSpacing:-1}}>Federal Agency Spending</h2>
          <p style={{fontSize:13,color:"rgba(255,255,255,.35)",margin:"4px 0 16px"}}>How the federal government spends your tax dollars, broken down by agency.</p>
          {totalTracked>0&&<span style={{display:"inline-block",marginTop:10,fontSize:12,fontWeight:700,background:"rgba(16,185,129,.1)",color:"#10b981",border:"1px solid rgba(16,185,129,.25)",padding:"4px 14px",borderRadius:100}}>${(totalTracked/1e9).toFixed(1)}B total tracked</span>}
        </div>
        {agencies===null&&<div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:10,padding:"28px 0",color:"rgba(255,255,255,.3)",fontSize:13}}><Spin sz={20} col="#10b981"/><span>Loading federal agency data...</span></div>}
        {agencies&&!top10.length&&<div style={{textAlign:"center",padding:"28px 0",color:"rgba(255,255,255,.25)",fontSize:13}}>No agency data available</div>}
        {top10.length>0&&<div style={{maxWidth:700,margin:"0 auto"}}>
          {top10.map((a,i)=>{const pct=((a.budget_authority_amount||0)/maxBudget)*100;const name=a.agency_name||a.name||"Agency";const amt=a.budget_authority_amount||0;return(
            <div key={i} style={{marginBottom:12,animation:"fadeUp .4s ease "+i*.06+"s both"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:12,fontWeight:700,color:"#e2e8f0",maxWidth:"60%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>
                <span style={{fontSize:12,fontWeight:800,color:"#10b981"}}>${(amt/1e9).toFixed(1)}B</span>
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

/* ── TRADING TIMELINE (D3 Monthly Volume) ── */
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
    const valid=(trades||[]).filter(t=>t.tradeDate&&t.tradeDate!=="--"&&!isNaN(new Date(t.tradeDate)));
    if(!valid.length)return;
    // Group trades by month
    const monthly={};
    valid.forEach(t=>{const d=new Date(t.tradeDate);const key=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");if(!monthly[key])monthly[key]={month:key,buys:0,sells:0,total:0};monthly[key].total++;if(t.action==="BUY")monthly[key].buys++;else monthly[key].sells++;});
    const months=Object.values(monthly).sort((a,b)=>a.month.localeCompare(b.month));
    if(!months.length)return;
    const margin={top:20,right:30,bottom:50,left:50};
    const w=dims.w-margin.left-margin.right;
    const h=dims.h-margin.top-margin.bottom;
    const el=svgRef.current.parentNode;
    d3.select(el).selectAll(".tt-tip").remove();
    const tooltip=d3.select(el).append("div").attr("class","tt-tip")
      .style("position","absolute").style("display","none")
      .style("background","#18181b").style("border","1px solid rgba(99,102,241,.3)")
      .style("border-radius","8px").style("padding","10px 14px")
      .style("font-size","13px").style("color","#e2e8f0")
      .style("pointer-events","none").style("z-index","10")
      .style("box-shadow","0 8px 24px rgba(0,0,0,.4)");
    const svg=d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width",dims.w).attr("height",dims.h);
    const g=svg.append("g").attr("transform",`translate(${margin.left},${margin.top})`);
    const xScale=d3.scaleBand().domain(months.map(m=>m.month)).range([0,w]).padding(0.15);
    const yScale=d3.scaleLinear().domain([0,d3.max(months,d=>d.total)||1]).nice().range([h,0]);
    // gradient background
    const defs=svg.append("defs");
    const grad=defs.append("linearGradient").attr("id","bgGrad").attr("x1","0%").attr("y1","0%").attr("x2","0%").attr("y2","100%");
    grad.append("stop").attr("offset","0%").attr("stop-color","rgba(168,85,247,.06)");
    grad.append("stop").attr("offset","100%").attr("stop-color","rgba(2,6,23,.02)");
    g.append("rect").attr("width",w).attr("height",h).attr("fill","url(#bgGrad)").attr("rx",8);
    // axes
    const tickEvery=Math.max(1,Math.floor(months.length/8));
    g.append("g").attr("transform",`translate(0,${h})`).call(d3.axisBottom(xScale).tickValues(months.filter((_,i)=>i%tickEvery===0).map(m=>m.month)).tickFormat(d=>{const[y,mo]=d.split("-");const mn=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+mo-1];return mn+" '"+y.slice(2);})).selectAll("text").attr("fill","rgba(255,255,255,.3)").attr("font-size",10).attr("transform","rotate(-35)").attr("text-anchor","end");
    g.append("g").call(d3.axisLeft(yScale).ticks(5)).selectAll("text").attr("fill","rgba(255,255,255,.3)").attr("font-size",10);
    g.selectAll(".domain,.tick line").attr("stroke","rgba(255,255,255,.06)");
    // bars colored by buy/sell ratio
    g.selectAll(".bar").data(months).enter().append("rect")
      .attr("x",d=>xScale(d.month))
      .attr("width",xScale.bandwidth())
      .attr("y",h)
      .attr("height",0)
      .attr("rx",3)
      .attr("fill",d=>{const buyRatio=d.total>0?d.buys/d.total:0.5;return buyRatio>=0.5?"#22c55e":"#ef4444";})
      .attr("opacity",.85)
      .on("mouseover",function(event,d){tooltip.style("display","block").html(`<div style="font-weight:800;margin-bottom:4px">${d.month}</div><div>${d.total} trades</div><div style="color:#4ade80">${d.buys} buys</div><div style="color:#f87171">${d.sells} sells</div>`);})
      .on("mousemove",function(event){tooltip.style("left",(event.offsetX+10)+"px").style("top",(event.offsetY-10)+"px");})
      .on("mouseout",function(){tooltip.style("display","none");})
      .transition().duration(600).delay((_,i)=>i*20)
      .attr("y",d=>yScale(d.total))
      .attr("height",d=>h-yScale(d.total));
    // count labels on bars
    g.selectAll(".label").data(months).enter().append("text")
      .attr("x",d=>xScale(d.month)+xScale.bandwidth()/2)
      .attr("y",d=>yScale(d.total)-4)
      .attr("text-anchor","middle")
      .attr("fill","rgba(255,255,255,.4)")
      .attr("font-size",9)
      .attr("font-weight",700)
      .text(d=>d.total>0?d.total:"");
    // y-axis label
    g.append("text").attr("transform","rotate(-90)").attr("y",-38).attr("x",-h/2).attr("text-anchor","middle").attr("fill","rgba(255,255,255,.25)").attr("font-size",10).text("Trade Count");
  },[trades,dims]);
  return(
    <div style={{background:"linear-gradient(180deg,#27272a,#07030f)",padding:"60px 0"}}>
      <CW>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:12,fontWeight:700,color:"rgba(168,85,247,.6)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>D3.js · Monthly Trade Volume</div>
          <h2 style={{fontSize:mob()?22:30,fontWeight:900,color:"#fff",margin:0,letterSpacing:-1}}>Trading Timeline</h2>
          <DataFreshness trades={trades}/>
          <div style={{display:"flex",gap:16,justifyContent:"center",marginTop:12}}>
            <span style={{fontSize:12,color:"rgba(255,255,255,.4)",display:"flex",alignItems:"center",gap:5}}><span style={{width:8,height:8,borderRadius:2,background:"#22c55e",display:"inline-block"}}/> More Buys</span>
            <span style={{fontSize:12,color:"rgba(255,255,255,.4)",display:"flex",alignItems:"center",gap:5}}><span style={{width:8,height:8,borderRadius:2,background:"#ef4444",display:"inline-block"}}/> More Sells</span>
          </div>
        </div>
        <div ref={containerRef} style={{width:"100%",overflow:"hidden",borderRadius:14,background:"rgba(168,85,247,.03)",border:"1px solid rgba(168,85,247,.08)",padding:"16px 8px",position:"relative"}}>
          {!(trades||[]).length?<div style={{display:"flex",justifyContent:"center",padding:"40px 0"}}><Spin sz={20}/></div>:
          <svg ref={svgRef} style={{display:"block",margin:"0 auto"}}/>}
        </div>
      </CW>
    </div>
  );
}

/* ── INTEL FEED ───────────────────────── */
function IntelFeed({trades,pols}){
  const activeTrades=useMemo(()=>(trades||[]).filter(t=>t.ticker&&(pols||[]).some(p=>{const ln=(t.name||"").toLowerCase().split(/\s+/).pop();return ln.length>=3&&p.name.toLowerCase().endsWith(ln);})),[trades,pols]);
  const buys=useMemo(()=>activeTrades.filter(t=>t.action==="BUY").slice(0,15),[activeTrades]);
  const sells=useMemo(()=>activeTrades.filter(t=>t.action==="SELL").slice(0,15),[activeTrades]);
  const violations=(trades||[]).filter(t=>t.gap>45).length;
  const highValue=(trades||[]).filter(t=>/500,000|1,000,000|5,000,001/.test(t.amount||"")).length;
  const uniqueTraders=new Set((trades||[]).map(t=>t.name)).size;
  const[selTrade,setSelTrade]=useState(null);
  const m=mob();
  return(
    <div style={{background:"linear-gradient(180deg,#18181b,#27272a)",padding:"60px 0"}}>
      <CW>
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:14,marginBottom:22}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}><div style={{width:7,height:7,borderRadius:"50%",background:"#6366f1",animation:"pulseDot 2s infinite"}}/><span style={{fontSize:12,fontWeight:700,color:"rgba(99,102,241,.7)",textTransform:"uppercase",letterSpacing:1.5}}>Senate STOCK Act Disclosures · {(()=>{const dates=(trades||[]).map(t=>t.tradeDate).filter(t=>t&&t!=="--").sort();return dates.length?dates[0].slice(0,4)+"–"+dates[dates.length-1].slice(0,4):"Loading";})()}</span></div>
            <h2 style={{fontSize:m?22:28,fontWeight:900,color:"#fff",margin:0,letterSpacing:-1}}><Tip text="The STOCK Act (2012) requires Congress members to disclose stock trades within 45 days">STOCK Act</Tip> Intelligence Feed</h2>
            <DataFreshness trades={trades}/>
            <p style={{fontSize:13,color:"rgba(255,255,255,.35)",margin:"4px 0 16px",lineHeight:1.5}}>Recent stock trades made by members of Congress. By law, they must disclose every trade.</p>
          </div>
          {(trades||[]).length>0&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {violations>0&&<span style={{fontSize:12,background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.3)",color:"#fca5a5",padding:"4px 12px",borderRadius:100,fontWeight:700}}>🚨 {violations} violations</span>}
            {highValue>0&&<span style={{fontSize:12,background:"rgba(168,85,247,.1)",border:"1px solid rgba(168,85,247,.3)",color:"#c4b5fd",padding:"4px 12px",borderRadius:100,fontWeight:700}}>💎 {highValue} high-value</span>}
            <span style={{fontSize:12,background:"rgba(34,197,94,.06)",border:"1px solid rgba(34,197,94,.2)",color:"#4ade80",padding:"4px 12px",borderRadius:100,fontWeight:700}}>{(trades||[]).length} trades · {uniqueTraders} officials</span>
            {(()=>{const self=(trades||[]).filter(t=>t.owner==="Self").length;const spouse=(trades||[]).filter(t=>t.owner==="Spouse").length;return self+spouse>0?<span style={{fontSize:12,background:"rgba(232,121,249,.08)",border:"1px solid rgba(232,121,249,.2)",color:"#e879f9",padding:"4px 12px",borderRadius:100,fontWeight:700}}>Self: {self} · Spouse: {spouse}</span>:null;})()}
          </div>}
        </div>
        {!(trades||[]).length&&<div style={{display:"flex",alignItems:"center",gap:10,color:"rgba(255,255,255,.25)",fontSize:13,padding:"16px 0"}}><Spin sz={14}/>Loading trade data...</div>}
        {(trades||[]).length>0&&(
          <div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr",gap:14}}>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:"#4ade80",textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>📈 Recent Buys ({buys.length})</div>
              {buys.map((t,i)=>(
                <div key={i} onClick={()=>setSelTrade({trade:t,pol:findPolForTrade(t,pols||[])})} style={{background:"rgba(34,197,94,.05)",border:"1px solid rgba(34,197,94,.15)",borderRadius:10,padding:14,marginBottom:8,animation:"slideIn .3s ease "+i*.05+"s both",cursor:"pointer"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                    {(()=>{const pol=findPolForTrade(t,pols||[]);return pol?<Avatar pol={pol} size={28}/>:null;})()}
                    <span style={{fontSize:14,fontWeight:900,color:"#fff"}}>{t.ticker}</span>
                    <span style={{fontSize:12,fontWeight:800,padding:"2px 7px",borderRadius:3,background:"rgba(34,197,94,.15)",color:"#4ade80"}}>BUY</span>
                    {/500,000|1,000,000|5,000,001/.test(t.amount||"")&&<Tag label="HIGH VALUE" color="#a855f7"/>}
                    <span style={{marginLeft:"auto",fontSize:12,color:"rgba(255,255,255,.3)"}}>{t.tradeDate}</span>
                  </div>
                  <div style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,.7)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.28)",marginTop:3}}>{t.amount} · {t.source}</div>
                  {t.excessReturn!=null&&<div style={{fontSize:12,color:t.excessReturn>0?"#4ade80":"#f87171",fontWeight:600}}>{t.excessReturn>0?"+":""}{Math.round(t.excessReturn*100)/100}% vs S&P 500</div>}
                  {(()=>{const f=flagTrade(t);return f?<div style={{fontSize:12,color:f.color,marginTop:4,lineHeight:1.4}}>{f.badge}: {f.txt.split('.')[0]}.</div>:null;})()}
                  {t.description&&<div style={{fontSize:12,color:"rgba(255,255,255,.2)",marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontStyle:"italic"}}>{t.description.slice(0,60)}</div>}
                </div>
              ))}
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:"#f87171",textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>📉 Recent Sells ({sells.length})</div>
              {sells.map((t,i)=>(
                <div key={i} onClick={()=>setSelTrade({trade:t,pol:findPolForTrade(t,pols||[])})} style={{background:"rgba(239,68,68,.04)",border:"1px solid rgba(239,68,68,.12)",borderRadius:10,padding:14,marginBottom:8,animation:"slideIn .3s ease "+i*.05+"s both",cursor:"pointer"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                    {(()=>{const pol=findPolForTrade(t,pols||[]);return pol?<Avatar pol={pol} size={28}/>:null;})()}
                    <span style={{fontSize:14,fontWeight:900,color:"#fff"}}>{t.ticker}</span>
                    <span style={{fontSize:12,fontWeight:800,padding:"2px 7px",borderRadius:3,background:"rgba(239,68,68,.15)",color:"#f87171"}}>SELL</span>
                    {/500,000|1,000,000|5,000,001/.test(t.amount||"")&&<Tag label="HIGH VALUE" color="#a855f7"/>}
                    <span style={{marginLeft:"auto",fontSize:12,color:"rgba(255,255,255,.3)"}}>{t.tradeDate}</span>
                  </div>
                  <div style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,.7)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.28)",marginTop:3}}>{t.amount} · {t.source}</div>
                  {t.excessReturn!=null&&<div style={{fontSize:12,color:t.excessReturn>0?"#4ade80":"#f87171",fontWeight:600}}>{t.excessReturn>0?"+":""}{Math.round(t.excessReturn*100)/100}% vs S&P 500</div>}
                  {(()=>{const f=flagTrade(t);return f?<div style={{fontSize:12,color:f.color,marginTop:4,lineHeight:1.4}}>{f.badge}: {f.txt.split('.')[0]}.</div>:null;})()}
                  {t.description&&<div style={{fontSize:12,color:"rgba(255,255,255,.2)",marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontStyle:"italic"}}>{t.description.slice(0,60)}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
        <Disclaimer/>
        {selTrade&&<TradeModal trade={selTrade.trade} pol={selTrade.pol} onClose={()=>setSelTrade(null)}/>}
      </CW>
    </div>
  );
}

/* ── LOBBYING PANEL ───────────────────── */
function LobbyingPanel({pol}){
  const[lda,setLda]=useState(null);
  useEffect(()=>{LDA_P.then(setLda).catch(()=>{});},[]);
  const filings=useMemo(()=>{
    if(!lda||!lda.filings)return[];
    return lda.filings.filter(f=>{
      const gov=(f.lobbying_activities||[]).some(a=>(a.government_entities||[]).some(g=>(g.name||"").includes(pol.chamber==="Senate"?"SENATE":"HOUSE")));
      return gov;
    }).slice(0,10);
  },[lda,pol]);
  const m=mob();
  return(<div>
    {!lda&&<div style={{display:"flex",alignItems:"center",gap:8,color:"rgba(255,255,255,.3)"}}><Spin sz={14}/>Loading lobbying data...</div>}
    {filings.length===0&&lda&&<div style={{color:"rgba(255,255,255,.3)",fontSize:13}}>No lobbying filings found targeting {pol.chamber}.</div>}
    {filings.map((f,i)=>{const inc=f.income||0;const issues=(f.lobbying_activities||[]).flatMap(a=>[a.general_issue_code_display]).filter(Boolean).slice(0,3);return(
      <div key={i} style={{background:"rgba(99,102,241,.04)",border:"1px solid rgba(99,102,241,.1)",borderRadius:12,padding:16,marginBottom:12}}>
        <div style={{fontSize:14,fontWeight:700,color:"#c7d2fe",marginBottom:4}}>{(f.registrant&&f.registrant.name)||"Unknown"}</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,.35)",marginBottom:8}}>Client: {(f.client&&f.client.name)||"---"}</div>
        <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          {inc>0&&<span style={{fontSize:14,fontWeight:800,color:"#34d399"}}>{fmt(inc)}</span>}
          <span style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{f.filing_year||""} {f.filing_period_display||""}</span>
        </div>
        {issues.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:8}}>{issues.map((iss,j)=><span key={j} style={{fontSize:12,background:"rgba(99,102,241,.12)",color:"#a5b4fc",padding:"3px 8px",borderRadius:5,fontWeight:600}}>{iss}</span>)}</div>}
      </div>
    );})}
  </div>);
}

/* ── PROFILE PAGE ─────────────────────── */
function ProfilePage({pol,pols,allTrades,onSelect,onBack,user,onSetUser}){
  const[tab,setTab]=useState("overview");const m=mob();
  const[localFEC,setLFEC]=useState(null);const[fecLoading,setFL]=useState(false);
  const[trades,setTrades]=useState([]);const[donors,setDonors]=useState([]);const[bills,setBills]=useState([]);const[loading,setL]=useState(true);
  const[note,setNote]=useState("");const[showNote,setShowNote]=useState(false);const[showAllDonors,setShowAllDonors]=useState(false);
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
    const bid=pol.bioguideId||(pol.congressUrl&&pol.congressUrl.match(/\/([A-Z]\d{5,6})\/?$/)?.[1])||null;
    if(bid)fetchBills(bid).then(setBills);
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
    try{const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:900,messages:[{role:"user",content:`Congressional intelligence briefing for ${pol.name} (${PL[pol.party]}, ${pol.chamber}, ${pol.state})\n\nFEC FINANCE:\nRaised: ${fmt(raised)} | Spent: ${fmt(spent)} | Cash: ${fmt(cash)}\n\nTOP DISBURSEMENTS (Schedule B - where they spend):\n${disbStr||"No data"}\n\nINDEPENDENT EXPENDITURES (Schedule E - outside groups):\n${ieStr||"No data"}\n\nSTOCK ACT: ${trades.length} trades, ${violations} violations\n${tStr||"None"}\n\nVoting record: ${pol.totalVotes} total votes, ${pol.yeaPct}% Yea, ${pol.absentCount} absent. Ideology score: ${pol.ideology!=null?pol.ideology.toFixed(2):"N/A"} (DW-NOMINATE, -1=liberal +1=conservative).\nAccountability Score: ${computeAccountabilityScore(pol, trades).total}/100.\n\nProvide:\nFINANCIAL_PROFILE: [campaign finance + spending pattern analysis]\nTRADING_ANALYSIS: [STOCK Act behavior]\nOUTSIDE_MONEY: [who is spending to help/hurt them via Schedule E]\nVIOLATION_ASSESSMENT: [legal exposure; if clean, confirm compliance]\nTRANSPARENCY_GRADE: [A-F]\nINVESTIGATION_PRIORITIES: [2-3 angles]\n\nFacts only.`}]})});const j=await r.json();setAI(j.content&&j.content.map(b=>b.text||"").join("")||"");}catch(e){setAIE(e.message);}
    setAIL(false);
  };
  const sec=(t,k)=>{const m=t.match(new RegExp(k+":[ \t]*(.+?)(?=\n[A-Z_]+:|$)","s"));return m?m[1].trim():null;};
  const TABS=[{id:"overview",l:"FEC Overview"},{id:"money",l:"Deep Finance"},{id:"trades",l:"Trades",hot:violations>0},{id:"bills",l:"Legislation"},{id:"lobbying",l:"Lobbying"},{id:"ai",l:"AI Briefing",ai:true}];
  const ds={background:"rgba(168,85,247,.04)",border:"1px solid rgba(168,85,247,.12)",borderRadius:14,padding:22};
  return(
    <div style={{background:"#09090b",minHeight:"100vh",paddingBottom:60}}>
      <CW pad="0 28px">
        <div style={{padding:"16px 0",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <button onClick={onBack} style={{background:"rgba(168,85,247,.08)",border:"1px solid rgba(168,85,247,.2)",cursor:"pointer",color:"#a78bfa",fontWeight:700,fontSize:12,padding:"7px 14px",borderRadius:8}}>← Back</button>
          {user&&<button onClick={toggleWatch} style={{background:isWatched?"rgba(239,68,68,.1)":"rgba(16,185,129,.1)",border:"1px solid "+(isWatched?"rgba(239,68,68,.3)":"rgba(16,185,129,.3)"),color:isWatched?"#f87171":"#34d399",fontWeight:700,fontSize:12,padding:"7px 14px",borderRadius:8,cursor:"pointer"}}>{isWatched?"✕ Unwatch":"+ Watch"}</button>}
          {user&&<button onClick={()=>setShowNote(!showNote)} style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",color:"rgba(255,255,255,.5)",fontWeight:700,fontSize:12,padding:"7px 14px",borderRadius:8,cursor:"pointer"}}>📝 {(user.notes&&user.notes[pol.id])?"Edit Note":"Add Note"}</button>}
          <a href={`https://www.fec.gov/data/candidate/${fecId||""}/`} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:"rgba(16,185,129,.7)",textDecoration:"none",border:"1px solid rgba(16,185,129,.2)",padding:"7px 14px",borderRadius:8}}>FEC.gov ↗</a>
          {pol.congressUrl&&<a href={pol.congressUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:"rgba(255,255,255,.35)",textDecoration:"none",border:"1px solid rgba(255,255,255,.08)",padding:"7px 14px",borderRadius:8}}>Congress.gov ↗</a>}
        </div>
        {showNote&&user&&(
          <div style={{background:"rgba(168,85,247,.08)",border:"1px solid rgba(168,85,247,.25)",borderRadius:12,padding:16,marginBottom:14}}>
            <div style={{fontSize:12,color:"#a78bfa",fontWeight:700,marginBottom:8}}>Investigation note — {pol.name}</div>
            <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Add notes, observations, leads..." rows={3} style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(168,85,247,.2)",borderRadius:8,color:"#fff",fontSize:12,padding:"10px 12px",outline:"none",resize:"vertical",boxSizing:"border-box"}}/>
            <div style={{display:"flex",gap:8,marginTop:8}}><button onClick={saveNote} style={{background:"rgba(168,85,247,.2)",color:"#a78bfa",border:"none",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Save</button><button onClick={()=>setShowNote(false)} style={{background:"none",color:"rgba(255,255,255,.3)",border:"none",fontSize:12,cursor:"pointer"}}>Cancel</button></div>
          </div>
        )}
        {/* Profile header */}
        <div style={{background:"linear-gradient(135deg,#18181b,#27272a)",border:"1px solid rgba(168,85,247,.15)",borderRadius:20,padding:m?"18px":"24px",marginBottom:16,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${PC[pol.party]},transparent)`}}/>
          <div style={{display:"flex",gap:18,alignItems:"flex-start",flexWrap:"wrap"}}>
            <Avatar pol={pol} size={m?52:68} ring="#a78bfa"/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}>
                <h2 style={{fontSize:m?18:24,fontWeight:900,color:"#fff",margin:0}}>{pol.name}</h2>
                <span style={{fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:5,background:PC[pol.party]+"20",color:PC[pol.party],border:"1px solid "+PC[pol.party]+"40"}}>{PL[pol.party]}</span>
                <span style={{fontSize:12,fontWeight:700,padding:"2px 8px",borderRadius:4,background:rC+"18",color:rC}}>RISK {risk}/100</span>
                {violations>0&&<span style={{fontSize:12,fontWeight:800,padding:"2px 9px",borderRadius:4,background:"rgba(239,68,68,.15)",color:"#f87171",border:"1px solid rgba(239,68,68,.3)"}}>🚨 {violations} VIOLATION{violations>1?"S":""}</span>}
                {isWatched&&<span style={{fontSize:12,color:"#34d399",padding:"2px 9px",background:"rgba(16,185,129,.1)",borderRadius:4}}>✓ Watching</span>}
                {candDetail&&candDetail.candidate_status&&<span style={{fontSize:12,color:"#a78bfa",padding:"2px 9px",background:"rgba(168,85,247,.1)",borderRadius:4}}>{candDetail.candidate_status==="C"?"✓ Certified":"Candidate"}</span>}
                <button onClick={()=>{navigator.clipboard.writeText(`Check out ${pol.name}'s record on Officium: officium.vote`).then(()=>alert("Link copied!"));}} style={{padding:"6px 14px",borderRadius:8,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.04)",color:"rgba(255,255,255,.4)",fontSize:12,fontWeight:600,cursor:"pointer"}}>Share</button>
              </div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:14}}>{pol.chamber} · {pol.state}{fecId&&" | FEC: "+fecId}{candDetail&&candDetail.incumbent_challenge_full&&" | "+candDetail.incumbent_challenge_full}</div>
              <div style={{display:"grid",gridTemplateColumns:m?"1fr 1fr":"repeat(5,1fr)",gap:8,marginBottom:12}}>
                {[["Raised",fmt(raised),raised>0,"#10b981"],["Spent",fmt(spent),spent>0,"#ef4444"],["Cash",fmt(cash),cash>0,"#3b82f6"],["Trades",loading?"…":trades.length,trades.length>0,"#a78bfa"],["Violations",loading?"…":violations,violations>0,"#ef4444"]].map(([l,v,ok,c],i)=>(
                  <div key={i} style={{background:"rgba(255,255,255,.05)",borderRadius:10,padding:"10px 12px"}}>
                    <div style={{fontSize:12,color:"rgba(255,255,255,.25)",textTransform:"uppercase",letterSpacing:.4,marginBottom:4}}>{l}</div>
                    <div style={{fontSize:m?12:14,fontWeight:700,color:ok?(i===4?"#ef4444":c):"rgba(255,255,255,.18)"}}>{v||"--"}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Risk Assessment Banner */}
        <div style={{background:rC+"0a",border:"1px solid "+rC+"25",borderRadius:14,padding:m?"14px":"16px 22px",marginBottom:16,display:"flex",alignItems:m?"flex-start":"center",gap:m?12:20,flexDirection:m?"column":"row"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:48,height:48,borderRadius:12,background:rC+"18",border:"2px solid "+rC+"44",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span style={{fontSize:18,fontWeight:900,color:rC}}>{risk}</span>
            </div>
            <div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Risk Assessment</div>
              <div style={{fontSize:16,fontWeight:900,color:rC}}>{riskLabel(risk)} RISK</div>
            </div>
          </div>
          <div style={{display:"flex",gap:m?10:16,flexWrap:"wrap",flex:1}}>
            {[["Violations",violations,"#ef4444"],["Total Trades",trades.length,"#a78bfa"],["Fundraising",fmt(raised),"#10b981"]].map(([l,v,c])=>(
              <div key={l} style={{background:"rgba(255,255,255,.04)",borderRadius:8,padding:"6px 12px"}}>
                <div style={{fontSize:12,color:"rgba(255,255,255,.2)",textTransform:"uppercase",letterSpacing:.5}}>{l}</div>
                <div style={{fontSize:12,fontWeight:700,color:c}}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Party & Chamber Info */}
        <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          <div style={{background:PC[pol.party]+"12",border:"1px solid "+PC[pol.party]+"30",borderRadius:10,padding:"10px 18px",display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:PC[pol.party]}}/>
            <span style={{fontSize:13,fontWeight:800,color:PC[pol.party]}}>{PL[pol.party]}</span>
          </div>
          <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,padding:"10px 18px",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.6)"}}>{pol.chamber==="Senate"?"U.S. Senate":"U.S. House"}</span>
            <span style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>|</span>
            <span style={{fontSize:12,fontWeight:700,color:"#f59e0b"}}>{pol.state}</span>
          </div>
          {pol.district&&<div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,padding:"10px 18px"}}>
            <span style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.5)"}}>District {pol.district}</span>
          </div>}
        </div>
        {/* Tabs */}
        <div style={{display:"flex",gap:2,background:"rgba(168,85,247,.06)",border:"1px solid rgba(168,85,247,.12)",padding:4,borderRadius:12,marginBottom:18,overflowX:"auto"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"8px 14px",borderRadius:9,border:"none",background:tab===t.id?"rgba(168,85,247,.2)":"transparent",color:tab===t.id?"#a78bfa":"rgba(255,255,255,.35)",fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5,flexShrink:0,position:"relative"}}>
              {t.hot&&tab!==t.id&&<div style={{position:"absolute",top:4,right:4,width:6,height:6,borderRadius:"50%",background:"#ef4444",animation:"pulseDot 2s infinite"}}/>}
              {t.l}{t.ai&&<span style={{fontSize:7,background:"#6366f1",color:"#fff",padding:"1px 4px",borderRadius:2}}>AI</span>}
            </button>
          ))}
        </div>
        {/* ── OVERVIEW TAB ── */}
        {tab==="overview"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:"rgba(6,182,212,.04)",border:"1px solid rgba(6,182,212,.1)",borderRadius:14,padding:20,marginBottom:20}}>
              <div style={{fontSize:14,fontWeight:700,color:"#67e8f9",marginBottom:8}}>Quick Summary</div>
              <div style={{fontSize:14,color:"rgba(255,255,255,.5)",lineHeight:1.7}}>
                {pol.name} is a {pol.party==="D"?"Democratic":pol.party==="R"?"Republican":"Independent"} {pol.chamber==="Senate"?"Senator":"Representative"} from {pol.state}{pol.yearsInOffice>0?`, serving since approximately ${2026-pol.yearsInOffice}`:""}.
                {pol.raised>0?` They have raised ${fmt(pol.raised)} in campaign funds${pol.pacContrib>0?`, with ${Math.round((pol.pacContrib/pol.raised)*100)}% from PACs`:""}.`:""}
                {pol.totalVotes>0?` They have cast ${pol.totalVotes} votes (${pol.yeaPct}% Yea)${pol.ideology!=null?` and have a DW-NOMINATE ideology score of ${pol.ideology.toFixed(2)} (${pol.ideology<-0.3?"liberal":pol.ideology>0.3?"conservative":"moderate"})`:""}.`:""}
                {trades.length>0?` They have ${trades.length} disclosed stock trade${trades.length>1?"s":""}.`:""}
              </div>
            </div>
            {raised>0&&<div style={{...ds}}>
              <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:4}}>FEC Campaign Finance Summary</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:16}}>OpenFEC /candidates/totals/ · live</div>
              {[["Total Raised",fmt(raised),"#10b981",100],["Total Spent",fmt(spent),"#ef4444",raised>0?Math.min(100,Math.round(spent/raised*100)):0],["Cash on Hand",fmt(cash),"#3b82f6",raised>0?Math.min(100,Math.round(cash/raised*100)):0]].map(([l,v,c,p])=>(
                <div key={l} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5}}><span style={{color:"rgba(255,255,255,.4)"}}>{l}</span><span style={{fontWeight:700,color:"#fff"}}>{v}</span></div>
                  <div style={{height:7,borderRadius:4,background:"rgba(255,255,255,.06)",overflow:"hidden"}}><div style={{height:"100%",width:p+"%",background:c,borderRadius:4,transition:"width 1.2s"}}/></div>
                </div>
              ))}
              {candDetail&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginTop:14,paddingTop:14,borderTop:"1px solid rgba(255,255,255,.06)"}}>
                {[["First Election",candDetail.first_file_date||"--","#a78bfa"],["Party",candDetail.party_full||PL[pol.party],"#3b82f6"],["District",candDetail.district||pol.state,"#10b981"]].map(([l,v,c])=>(
                  <div key={l} style={{background:"rgba(255,255,255,.04)",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:12,color:"rgba(255,255,255,.25)",textTransform:"uppercase",marginBottom:4}}>{l}</div>
                    <div style={{fontSize:12,fontWeight:700,color:c,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</div>
                  </div>
                ))}
              </div>}
            </div>}
            {/* PAC Industry Breakdown */}
            {inds.length>0&&<div style={{...ds}}>
              <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:4}}>PAC Industry Breakdown</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:16}}>FEC /schedules/schedule_a/ · committee contributions</div>
              {inds.map(ind=>(
                <div key={ind.name} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:ind.color,flexShrink:0}}/>
                  <div style={{width:80,fontSize:12,color:"rgba(255,255,255,.5)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ind.name}</div>
                  <div style={{flex:1,height:14,borderRadius:3,background:"rgba(255,255,255,.05)",overflow:"hidden"}}><div style={{height:"100%",width:((ind.total/maxV)*100)+"%",background:ind.color,opacity:.8,borderRadius:3,transition:"width 1.2s"}}/></div>
                  <div style={{fontSize:12,fontWeight:700,color:"#e2e8f0",minWidth:56,textAlign:"right"}}>{fmt(ind.total)}</div>
                </div>
              ))}
              {donors.slice(0,showAllDonors?20:5).map((d,i)=>{const ind=classifyPAC(d.contributor_name);return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:9,marginBottom:6,padding:"8px 12px",background:i===0?"rgba(16,185,129,.06)":"rgba(255,255,255,.02)",borderRadius:9,border:"1px solid rgba(255,255,255,.06)"}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:IC[ind]||"#94a3b8",flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.contributor_name}</div><div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{ind} · {d.contributor_state||"--"}</div></div>
                  <div style={{fontSize:12,fontWeight:700,color:"#10b981"}}>{fmt(d.contribution_receipt_amount)}</div>
                </div>
              );})}
              {donors.length>5&&<button onClick={()=>setShowAllDonors(!showAllDonors)} style={{marginTop:8,padding:"8px 16px",borderRadius:8,border:"1px solid rgba(99,102,241,.2)",background:"rgba(99,102,241,.06)",color:"#a5b4fc",fontSize:13,fontWeight:600,cursor:"pointer"}}>{showAllDonors?"Show less":"Show all "+donors.length+" donors"}</button>}
            </div>}
            {/* Trading portfolio */}
            {sectors.length>0&&<div style={{...ds}}>
              <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:14}}>STOCK Act Trading Portfolio</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {sectors.map(([ticker,cnt])=><div key={ticker} style={{background:"rgba(168,85,247,.12)",border:"1px solid rgba(168,85,247,.2)",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
                  <div style={{fontSize:14,fontWeight:900,color:"#a78bfa"}}>{ticker}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginTop:2}}>{cnt}x disclosed</div>
                </div>)}
              </div>
            </div>}
            {/* Deep Financial Profile */}
            <div style={{marginTop:20}}>
              <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:14}}>Financial DNA</div>
              <div style={{display:"grid",gridTemplateColumns:m?"1fr 1fr":"repeat(3,1fr)",gap:12}}>
                {[
                  ["Individual Donors",pol.individualContrib>0?fmt(pol.individualContrib):"N/A","#4ade80","How much came from individual people"],
                  ["PAC Money",pol.pacContrib>0?fmt(pol.pacContrib):"N/A","#f59e0b","Political Action Committee contributions"],
                  ["Campaign Debt",pol.debts>0?fmt(pol.debts):"$0","#ef4444","Outstanding debts owed by campaign"],
                  ["Cash Remaining",cash>0?fmt(cash):"N/A","#3b82f6","Cash on hand at end of reporting period"],
                  ["Spend Rate",raised>0?Math.round((spent/raised)*100)+"%":"N/A","#a855f7","Percentage of raised funds already spent"],
                  ["Years in Office",pol.yearsInOffice||"New","#6366f1","Time serving in current position"],
                  ["Status",pol.incumbentStatus||(candDetail&&candDetail.incumbent_challenge_full)||"Unknown","#10b981","Incumbent, challenger, or open seat"],
                  ["Funding Mix",raised>0?(pol.individualContrib>pol.pacContrib?"Individual-Led":"PAC-Led"):"N/A","#ec4899","Primary source of campaign funding"],
                  ["Self-Sufficiency",raised>0&&pol.individualContrib>0?Math.round(pol.individualContrib/raised*100)+"%":"N/A","#14b8a6","What % comes from individual donors vs PACs"],
                ].map(([label,value,color,tooltip])=>(
                  <div key={label} style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12,padding:"14px 16px",position:"relative"}} title={tooltip}>
                    <div style={{fontSize:12,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{label}</div>
                    <div style={{fontSize:18,fontWeight:800,color}}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Dark Money Exposure Indicator — BRD §19 */}
            {pol.hasRealFinancials&&<div style={{marginTop:20}}>
              <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:14}}>Funding Transparency</div>
              <div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr 1fr",gap:12}}>
                <div style={{background:(pol.individualContrib||0)/(pol.raised||1)>0.5?"rgba(34,197,94,.06)":"rgba(239,68,68,.06)",border:"1px solid "+((pol.individualContrib||0)/(pol.raised||1)>0.5?"rgba(34,197,94,.15)":"rgba(239,68,68,.15)"),borderRadius:12,padding:16,textAlign:"center"}}>
                  <div style={{fontSize:24,fontWeight:900,color:(pol.individualContrib||0)/(pol.raised||1)>0.5?"#4ade80":"#ef4444"}}>{pol.raised>0?Math.round(((pol.individualContrib||0)/pol.raised)*100):0}%</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>Individual Donors</div>
                </div>
                <div style={{background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.15)",borderRadius:12,padding:16,textAlign:"center"}}>
                  <div style={{fontSize:24,fontWeight:900,color:"#fbbf24"}}>{pol.raised>0?Math.round(((pol.pacContrib||0)/pol.raised)*100):0}%</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>PAC / Committee</div>
                </div>
                <div style={{background:"rgba(168,85,247,.06)",border:"1px solid rgba(168,85,247,.15)",borderRadius:12,padding:16,textAlign:"center"}}>
                  <div style={{fontSize:24,fontWeight:900,color:"#a78bfa"}}>{pol.raised>0?Math.round(((pol.transfers||0)/pol.raised)*100):0}%</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>Transfers (PAC Pipeline)</div>
                </div>
              </div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.15)",marginTop:8,fontStyle:"italic"}}>Funding visibility ratio: {pol.raised>0?Math.round(((pol.individualContrib||0)/pol.raised)*100):0}% traceable to named individuals.</div>
            </div>}
            {/* Sector Conflict Check */}
            {trades.length>0&&pol.hasRealFinancials&&<div style={{marginTop:20}}>
              <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:14}}>Sector Overlap Analysis</div>
              <p style={{fontSize:13,color:"rgba(255,255,255,.35)",marginBottom:14}}>Comparing sectors where {pol.name.split(" ").pop()} trades stocks vs receives campaign funding.</p>
              {(()=>{
                const tradeSectors={};
                trades.forEach(t=>{const s=classifyTicker(t.ticker);if(s!=="Other")tradeSectors[s]=(tradeSectors[s]||0)+1;});
                const fundingSectors={};
                if(pol.pacContrib>0)fundingSectors["PAC Funded"]=pol.pacContrib;
                if(pol.individualContrib>0)fundingSectors["Individual"]=pol.individualContrib;
                const sectorKeys=Object.keys(tradeSectors);
                if(!sectorKeys.length)return <div style={{fontSize:13,color:"rgba(255,255,255,.25)"}}>No sector-specific trades identified.</div>;
                return <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {sectorKeys.map(s=>(
                    <div key={s} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(245,158,11,.04)",border:"1px solid rgba(245,158,11,.1)",borderRadius:10,padding:"12px 16px"}}>
                      <span style={{fontSize:14,fontWeight:700,color:"#fbbf24",minWidth:100}}>{s}</span>
                      <span style={{fontSize:13,color:"rgba(255,255,255,.4)"}}>{tradeSectors[s]} trade{tradeSectors[s]>1?"s":""}</span>
                      <span style={{marginLeft:"auto",fontSize:12,color:"rgba(245,158,11,.6)"}}>&#9888; Trades in sector they may legislate on</span>
                    </div>
                  ))}
                  <Disclaimer/>
                </div>;
              })()}
            </div>}
            {/* Influence Network */}
            <div style={{marginTop:20}}>
              <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:14}}>Influence Network</div>
              <div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr",gap:14}}>
                <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12,padding:18}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#a78bfa",marginBottom:12}}>State Delegation — {pol.state}</div>
                  {(pols||[]).filter(p=>p.state===pol.state&&p.id!==pol.id).slice(0,6).map(p=>(
                    <div key={p.id} onClick={()=>onSelect&&onSelect(p)} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                      <Avatar pol={p} size={28}/>
                      <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div></div>
                      <span style={{fontSize:12,fontWeight:700,color:PC[p.party]}}>{p.party}</span>
                      {p.raised>0&&<span style={{fontSize:12,fontWeight:600,color:"#10b981"}}>{fmt(p.raised)}</span>}
                    </div>
                  ))}
                </div>
                <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12,padding:18}}>
                  {(()=>{const as=computeAccountabilityScore(pol,trades);const color=as.total>70?"#4ade80":as.total>40?"#fbbf24":"#ef4444";return(<>
                    <div style={{fontSize:48,fontWeight:900,color,textAlign:"center",marginBottom:4}}>{as.total}</div>
                    <div style={{fontSize:13,color:"rgba(255,255,255,.3)",textAlign:"center",marginBottom:14}}>Accountability Score (0-100)</div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {as.components.map(c=>(
                        <div key={c.label} style={{display:"flex",alignItems:"center",gap:8}}>
                          <Tip text={c.explain}><div style={{width:130,fontSize:12,color:"rgba(255,255,255,.4)",cursor:"help"}}>{c.label}</div></Tip>
                          <div style={{flex:1,height:6,borderRadius:3,background:"rgba(255,255,255,.06)",overflow:"hidden"}}><div style={{height:"100%",width:((c.score/c.max)*100)+"%",background:c.score/c.max>0.6?"#4ade80":c.score/c.max>0.3?"#fbbf24":"#ef4444",borderRadius:3}}/></div>
                          <div style={{width:40,fontSize:12,fontWeight:700,color:"rgba(255,255,255,.5)",textAlign:"right"}}>{c.score}/{c.max}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,.15)",marginTop:10,fontStyle:"italic"}}>Methodology: officium.vote/about · v1 pending academic validation</div>
                  </>);})()}
                </div>
              </div>
            </div>
            {/* Contact Your Representative */}
            {(pol.phone||pol.website||pol.contactForm)&&<div style={{marginTop:20}}>
              <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:14}}>Contact {pol.name.split(" ").pop()}</div>
              <div style={{background:"rgba(20,184,166,.04)",border:"1px solid rgba(20,184,166,.15)",borderRadius:14,padding:20}}>
                <div style={{display:"grid",gridTemplateColumns:m?"1fr":"repeat(2,1fr)",gap:14}}>
                  {pol.phone&&<div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{fontSize:20}}>{"\u{1F4DE}"}</div>
                    <div><div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:2}}>Phone</div><div style={{fontSize:15,fontWeight:700,color:"#14b8a6"}}>{pol.phone}</div></div>
                  </div>}
                  {pol.office&&<div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{fontSize:20}}>{"\u{1F3DB}\uFE0F"}</div>
                    <div><div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:2}}>Office</div><div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{pol.office}</div></div>
                  </div>}
                  {pol.website&&<div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{fontSize:20}}>{"\u{1F310}"}</div>
                    <div><div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:2}}>Website</div><a href={pol.website} target="_blank" rel="noopener noreferrer" style={{fontSize:13,fontWeight:600,color:"#14b8a6",textDecoration:"none"}}>{pol.website.replace(/^https?:\/\//,"").replace(/\/$/,"")}</a></div>
                  </div>}
                  {pol.contactForm&&<div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{fontSize:20}}>{"\u2709\uFE0F"}</div>
                    <div><div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:2}}>Contact Form</div><a href={pol.contactForm} target="_blank" rel="noopener noreferrer" style={{fontSize:13,fontWeight:600,color:"#14b8a6",textDecoration:"none"}}>Send a message {"\u2192"}</a></div>
                  </div>}
                  {pol.twitter&&<div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{fontSize:20}}>{"\u{1F426}"}</div>
                    <div><div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:2}}>Twitter/X</div><a href={"https://x.com/"+pol.twitter} target="_blank" rel="noopener noreferrer" style={{fontSize:13,fontWeight:600,color:"#14b8a6",textDecoration:"none"}}>@{pol.twitter}</a></div>
                  </div>}
                </div>
                <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid rgba(20,184,166,.1)",textAlign:"center"}}>
                  <span style={{fontSize:13,color:"rgba(255,255,255,.35)"}}>Transparency is your right. Make your voice heard.</span>
                </div>
              </div>
            </div>}
            {/* Career Timeline */}
            <div style={{marginTop:20}}>
              <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:14}}>Career Timeline</div>
              <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:20}}>
                <div style={{display:"flex",alignItems:"center",gap:14}}>
                  <div style={{width:4,height:60,background:"linear-gradient(to bottom,#6366f1,#a78bfa)",borderRadius:2}}/>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0"}}>{pol.chamber==="Senate"?"U.S. Senator":"U.S. Representative"} — {pol.state}</div>
                    <div style={{fontSize:13,color:"rgba(255,255,255,.4)",marginTop:4}}>{pol.yearsInOffice>0?`In office since ~${2026-pol.yearsInOffice} (${pol.yearsInOffice} years)`:"Recently elected"}</div>
                    {pol.leadership&&<div style={{fontSize:13,color:"#fbbf24",marginTop:4,fontWeight:600}}>{pol.leadership}</div>}
                    {pol.incumbentStatus&&<div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginTop:4}}>Status: {pol.incumbentStatus}</div>}
                  </div>
                </div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.15)",marginTop:12,fontStyle:"italic"}}>Full revolving door tracker coming in Phase 2.</div>
              </div>
            </div>
{/* Chamber Comparison */}
{pol.raised>0&&<div style={{marginTop:20}}>
  <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:14}}>How {pol.name.split(" ").pop()} Compares</div>
  <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:20}}>
    {(()=>{
      const chamberPols=(pols||[]).filter(p=>p.chamber===pol.chamber&&p.raised>0);
      const chamberAvg=chamberPols.length?chamberPols.reduce((a,p)=>a+p.raised,0)/chamberPols.length:0;
      const stateRank=(pols||[]).filter(p=>p.state===pol.state&&p.raised>pol.raised).length+1;
      const chamberRank=chamberPols.sort((a,b)=>b.raised-a.raised).findIndex(p=>p.id===pol.id)+1;
      const partyPols=(pols||[]).filter(p=>p.party===pol.party&&p.raised>0);
      const partyAvg=partyPols.length?partyPols.reduce((a,p)=>a+p.raised,0)/partyPols.length:0;
      return(<div style={{display:"grid",gridTemplateColumns:m?"1fr":"repeat(3,1fr)",gap:14}}>
        <div style={{textAlign:"center",padding:14,background:"rgba(6,182,212,.04)",borderRadius:10}}>
          <div style={{fontSize:24,fontWeight:900,color:pol.raised>chamberAvg?"#4ade80":"#f87171"}}>{pol.raised>chamberAvg?"+":""}{Math.round((pol.raised/chamberAvg-1)*100)}%</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>vs {pol.chamber} avg ({fmt(chamberAvg)})</div>
        </div>
        <div style={{textAlign:"center",padding:14,background:"rgba(6,182,212,.04)",borderRadius:10}}>
          <div style={{fontSize:24,fontWeight:900,color:"#67e8f9"}}>#{chamberRank>0?chamberRank:"—"}</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>in {pol.chamber} fundraising</div>
        </div>
        <div style={{textAlign:"center",padding:14,background:"rgba(6,182,212,.04)",borderRadius:10}}>
          <div style={{fontSize:24,fontWeight:900,color:"#fbbf24"}}>#{stateRank}</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>in {pol.state} delegation</div>
        </div>
      </div>);
    })()}
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
              <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:14}}>FEC /candidate/{"{id}"}/history/ · all cycles on record</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {candHistory.slice(0,6).map((h,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"rgba(255,255,255,.03)",borderRadius:10,border:"1px solid rgba(255,255,255,.06)"}}>
                    <span style={{fontSize:14,fontWeight:900,color:"#a78bfa",minWidth:40}}>{h.two_year_period}</span>
                    <span style={{fontSize:12,background:PC[pol.party]+"18",color:PC[pol.party],padding:"2px 8px",borderRadius:4,fontWeight:700}}>{h.office}</span>
                    <span style={{fontSize:12,color:"rgba(255,255,255,.5)"}}>{h.state}{h.district?" Dist. "+h.district:""}</span>
                    <span style={{marginLeft:"auto",fontSize:12,fontWeight:700,color:h.candidate_status==="C"?"#10b981":"#94a3b8"}}>{h.incumbent_challenge_full||h.candidate_status}</span>
                  </div>
                ))}
              </div>
            </div>}
            {/* Schedule B — Disbursements */}
            {disbursements.length>0&&<div style={{...ds}}>
              <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:4}}>Disbursements — Where Money Was Spent</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:14}}>FEC /schedules/schedule_b/ · top outgoing payments</div>
              {disbursements.slice(0,10).map((d,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<disbursements.length-1?"1px solid rgba(255,255,255,.05)":"none"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.recipient_name||"Unknown"}</div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginTop:2}}>{d.disbursement_description||"--"} · {d.disbursement_date||"--"}</div>
                  </div>
                  <span style={{fontSize:13,fontWeight:800,color:"#ef4444",flexShrink:0,whiteSpace:"nowrap"}}>{fmt(d.disbursement_amount||0)}</span>
                </div>
              ))}
              <div style={{marginTop:10,fontSize:12,color:"rgba(255,255,255,.2)"}}>Total shown: {fmt(disbursements.reduce((a,d)=>a+(d.disbursement_amount||0),0))}</div>
            </div>}
            {/* Schedule E — Independent Expenditures */}
            {scheduleE.length>0&&<div style={{...ds}}>
              <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:4}}>Independent Expenditures (Schedule E)</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:14}}>FEC /schedules/schedule_e/ · outside groups spending FOR or AGAINST this candidate</div>
              {scheduleE.slice(0,8).map((e,i)=>{const isFor=e.support_oppose_indicator==="S";return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:isFor?"rgba(16,185,129,.05)":"rgba(239,68,68,.05)",border:"1px solid "+(isFor?"rgba(16,185,129,.15)":"rgba(239,68,68,.15)"),borderRadius:10,marginBottom:7}}>
                  <div style={{width:4,height:32,borderRadius:2,background:isFor?"#4ade80":"#f87171",flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.committee_name||"Unknown Committee"}</div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginTop:2}}>{e.expenditure_description||"--"} · {e.expenditure_date||"--"}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:13,fontWeight:800,color:isFor?"#4ade80":"#f87171"}}>{fmt(e.expenditure_amount||0)}</div>
                    <div style={{fontSize:12,fontWeight:700,color:isFor?"#34d399":"#fca5a5",marginTop:2}}>{isFor?"FOR":"AGAINST"}</div>
                  </div>
                </div>
              );})}
            </div>}
            {/* Linked Committees */}
            {committees.length>0&&<div style={{...ds}}>
              <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:4}}>Linked Committees</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:14}}>FEC /candidate/{"{id}"}/committee/ · PACs and campaign committees</div>
              {committees.slice(0,6).map((c,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<committees.length-1?"1px solid rgba(255,255,255,.05)":"none"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name||c.committee_name||"--"}</div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginTop:2}}>{c.committee_type_full||c.designation_full||"Committee"} · {c.state||pol.state}</div>
                  </div>
                  <a href={`https://www.fec.gov/data/committee/${c.committee_id||c.id||""}/`} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:"#a78bfa",textDecoration:"none",flexShrink:0}}>FEC ↗</a>
                </div>
              ))}
            </div>}
            {/* Election Race Context */}
            {electionRace.length>0&&<div style={{...ds}}>
              <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:4}}>{pol.state} {pol.chamber} Race — 2026 Field</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:14}}>FEC /elections/summary/ · all candidates in the same race</div>
              {electionRace.slice(0,6).map((e,i)=>{const isThis=e.candidate_name&&pol.name.toLowerCase().includes(e.candidate_name.toLowerCase().split(",")[0].toLowerCase().trim());return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:isThis?"rgba(168,85,247,.08)":"rgba(255,255,255,.02)",border:"1px solid "+(isThis?"rgba(168,85,247,.25)":"rgba(255,255,255,.05)"),borderRadius:10,marginBottom:6}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:e.party_full&&e.party_full.includes("Rep")?"#ef4444":e.party_full&&e.party_full.includes("Dem")?"#3b82f6":"#8b5cf6",flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:isThis?700:400,color:isThis?"#a78bfa":"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.candidate_name||"Unknown"}{isThis?" (this official)":""}</div><div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{e.party_full||"--"}</div></div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#10b981"}}>{fmt(e.total_receipts||0)}</div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,.2)"}}>raised</div>
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
            {/* Donation vs Vote Correlation — BRD §15 */}
            {pol.totalVotes>0&&pol.raised>0&&<div style={{marginTop:20}}>
              <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:14}}>Funding & Voting Pattern</div>
              <div style={{background:"rgba(99,102,241,.04)",border:"1px solid rgba(99,102,241,.1)",borderRadius:14,padding:20}}>
                <div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr",gap:16}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:"#10b981",marginBottom:8}}>Campaign Funding</div>
                    <div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.6}}>
                      Total raised: <strong style={{color:"#10b981"}}>{fmt(pol.raised)}</strong><br/>
                      From individuals: <strong>{pol.individualContrib>0?fmt(pol.individualContrib):"N/A"}</strong><br/>
                      From PACs: <strong>{pol.pacContrib>0?fmt(pol.pacContrib):"N/A"}</strong><br/>
                      Individual ratio: <strong>{pol.raised>0?Math.round(((pol.individualContrib||0)/pol.raised)*100)+"%":"N/A"}</strong>
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:"#6366f1",marginBottom:8}}>Voting Behavior</div>
                    <div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.6}}>
                      Total votes cast: <strong style={{color:"#6366f1"}}>{pol.totalVotes}</strong><br/>
                      Voted Yea: <strong>{pol.yeaPct}%</strong><br/>
                      Missed votes: <strong>{pol.absentCount}</strong><br/>
                      Ideology: <strong style={{color:pol.ideology<-0.3?"#3b82f6":pol.ideology>0.3?"#ef4444":"#94a3b8"}}>{pol.ideology!=null?pol.ideology.toFixed(2):"N/A"} ({pol.ideology<-0.3?"Liberal":pol.ideology>0.3?"Conservative":"Moderate"})</strong>
                    </div>
                  </div>
                </div>
                {pol.pacContrib>0&&pol.totalVotes>0&&<div style={{marginTop:14,padding:"12px 16px",background:"rgba(245,158,11,.04)",border:"1px solid rgba(245,158,11,.1)",borderRadius:10}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#fbbf24",marginBottom:4}}>Correlation Flag</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,.35)"}}>This official received {fmt(pol.pacContrib)} from PACs ({Math.round((pol.pacContrib/pol.raised)*100)}% of total) while voting Yea {pol.yeaPct}% of the time. Compare with similar officials to assess alignment.</div>
                </div>}
                <Disclaimer/>
              </div>
            </div>}
{pol.fecCycles&&pol.fecCycles.length>1&&<div style={{marginTop:20}}>
  <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:14}}>Election Cycle History</div>
  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
    {pol.fecCycles.sort().map(cy=>(
      <div key={cy} style={{background:"rgba(6,182,212,.04)",border:"1px solid rgba(6,182,212,.1)",borderRadius:10,padding:"10px 16px",textAlign:"center"}}>
        <div style={{fontSize:16,fontWeight:800,color:"#67e8f9"}}>{cy}</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>Cycle</div>
      </div>
    ))}
  </div>
  <div style={{fontSize:12,color:"rgba(255,255,255,.2)",marginTop:8}}>{pol.fecCycles.length} election cycles on record. First filed: {pol.firstFiled||"N/A"}. Most recent: {pol.lastFiled||"N/A"}.</div>
</div>}
            {trades.length>0&&pol.firstFiled&&<div style={{marginTop:20}}>
              <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:14}}>Financial Timeline</div>
              <div style={{background:"rgba(6,182,212,.03)",border:"1px solid rgba(6,182,212,.08)",borderRadius:14,padding:20}}>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  {pol.firstFiled&&<div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:12,height:12,borderRadius:"50%",background:"#14b8a6",flexShrink:0}}/>
                    <div style={{fontSize:13,color:"rgba(255,255,255,.4)"}}><strong style={{color:"#14b8a6"}}>{pol.firstFiled}</strong> — First FEC filing</div>
                  </div>}
                  {trades.slice(-3).reverse().map((t,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:12,height:12,borderRadius:"50%",background:t.action==="BUY"?"#4ade80":"#f87171",flexShrink:0}}/>
                      <div style={{fontSize:13,color:"rgba(255,255,255,.4)"}}><strong style={{color:t.action==="BUY"?"#4ade80":"#f87171"}}>{t.tradeDate}</strong> — {t.action} {t.ticker} ({t.amount})</div>
                    </div>
                  ))}
                  {trades.length>3&&<div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:12,height:12,borderRadius:2,background:"rgba(255,255,255,.1)",flexShrink:0}}/>
                    <div style={{fontSize:13,color:"rgba(255,255,255,.25)"}}>... {trades.length-3} more trades</div>
                  </div>}
                  {pol.lastFiled&&<div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:12,height:12,borderRadius:"50%",background:"#14b8a6",flexShrink:0}}/>
                    <div style={{fontSize:13,color:"rgba(255,255,255,.4)"}}><strong style={{color:"#14b8a6"}}>{pol.lastFiled}</strong> — Most recent FEC filing</div>
                  </div>}
                </div>
                <div style={{fontSize:13,color:"rgba(255,255,255,.4)",marginTop:14}}>Total raised: <strong style={{color:"#10b981"}}>{fmt(pol.raised)}</strong> · Total trades: <strong style={{color:"#67e8f9"}}>{trades.length}</strong> · FEC cycles: <strong>{(pol.fecCycles||[]).length}</strong></div>
                <Disclaimer/>
              </div>
            </div>}
          </div>
        )}
        {/* ── TRADES TAB ── */}
        {tab==="trades"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
{trades.length>0&&<div style={{marginBottom:20}}>
  <div style={{display:"grid",gridTemplateColumns:m?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:16}}>
    {(()=>{
      const buys=trades.filter(t=>t.action==="BUY").length;
      const sells=trades.filter(t=>t.action==="SELL").length;
      const sectors={};trades.forEach(t=>{const s=classifyTicker(t.ticker);if(s!=="Other")sectors[s]=(sectors[s]||0)+1;});
      const topSector=Object.entries(sectors).sort((a,b)=>b[1]-a[1])[0];
      const avgGap=trades.filter(t=>t.gap>0).length>0?Math.round(trades.filter(t=>t.gap>0).reduce((a,t)=>a+t.gap,0)/trades.filter(t=>t.gap>0).length):0;
      return[
        ["Buy/Sell",`${buys}/${sells}`,"#6366f1"],
        ["Top Sector",topSector?topSector[0]:"N/A","#14b8a6"],
        ["Avg Filing Delay",avgGap>0?avgGap+"d":"N/A",avgGap>45?"#ef4444":"#4ade80"],
        ["Unique Tickers",new Set(trades.filter(t=>t.ticker).map(t=>t.ticker)).size+"","#f59e0b"],
      ].map(([l,v,c])=>(
        <div key={l} style={{background:"rgba(255,255,255,.03)",borderRadius:10,padding:"12px 14px",textAlign:"center"}}>
          <div style={{fontSize:18,fontWeight:800,color:c}}>{v}</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{l}</div>
        </div>
      ));
    })()}
  </div>
  {/* Sector breakdown */}
  {(()=>{
    const sectors={};trades.forEach(t=>{const s=classifyTicker(t.ticker);sectors[s]=(sectors[s]||0)+1;});
    const sorted=Object.entries(sectors).sort((a,b)=>b[1]-a[1]);
    if(sorted.length<=1)return null;
    return <div style={{marginBottom:16}}>
      <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0",marginBottom:8}}>Trading by Sector</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {sorted.map(([s,c])=>(
          <span key={s} style={{fontSize:12,padding:"4px 12px",borderRadius:8,background:"rgba(6,182,212,.08)",border:"1px solid rgba(6,182,212,.15)",color:"#67e8f9",fontWeight:600}}>{s}: {c}</span>
        ))}
      </div>
    </div>;
  })()}
</div>}
            {/* Trade Activity Summary */}
            {trades.length>0&&(()=>{
              const amtRanges={"$1,001 - $15,000":8000,"$15,001 - $50,000":32500,"$50,001 - $100,000":75000,"$100,001 - $250,000":175000,"$250,001 - $500,000":375000,"$500,001 - $1,000,000":750000,"$1,000,001 - $5,000,000":3000000,"$5,000,001 - $25,000,000":15000000,"$25,000,001 - $50,000,000":37500000,"Over $50,000,000":75000000};
              const totalVal=trades.reduce((s,t)=>s+(amtRanges[t.amount]||0),0);
              const tickers=trades.filter(t=>t.ticker).map(t=>t.ticker);
              const tickerCounts={};tickers.forEach(tk=>{tickerCounts[tk]=(tickerCounts[tk]||0)+1;});
              const topTicker=Object.entries(tickerCounts).sort((a,b)=>b[1]-a[1])[0];
              const buys=trades.filter(t=>t.action==="BUY").length;const sells=trades.filter(t=>t.action==="SELL").length;
              const buyRatio=trades.length>0?Math.round(buys/trades.length*100):0;
              const avgVal=trades.length>0?totalVal/trades.length:0;
              return(
                <div style={{display:"grid",gridTemplateColumns:m?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:4}}>
                  {[
                    ["Est. Trade Volume",fmt(totalVal),"#10b981","Sum of midpoints of disclosed amount ranges"],
                    ["Most Traded",topTicker?topTicker[0]+" ("+topTicker[1]+"x)":"N/A","#a78bfa","Most frequently traded ticker symbol"],
                    ["Buy/Sell Ratio",buys+"/"+sells+" ("+buyRatio+"% buys)","#3b82f6","Ratio of purchase vs sale transactions"],
                    ["Avg Trade Size",fmt(avgVal),"#f59e0b","Average estimated value per trade"],
                  ].map(([label,value,color,tooltip])=>(
                    <div key={label} style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12,padding:"14px 16px"}} title={tooltip}>
                      <div style={{fontSize:12,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{label}</div>
                      <div style={{fontSize:16,fontWeight:800,color}}>{value}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div style={{background:"rgba(168,85,247,.05)",border:"1px solid rgba(168,85,247,.12)",borderRadius:14,padding:20}}>
              <div style={{display:"flex",gap:14,alignItems:"center",flexWrap:"wrap",marginBottom:14}}>
                <div style={{width:64,height:64,borderRadius:"50%",background:`conic-gradient(${rC} ${risk*3.6}deg,rgba(255,255,255,.05) 0deg)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <div style={{width:50,height:50,borderRadius:"50%",background:"#09090b",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column"}}><div style={{fontSize:16,fontWeight:900,color:rC,lineHeight:1}}>{risk}</div><div style={{fontSize:7,color:"rgba(255,255,255,.25)"}}>RISK</div></div>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:rC,marginBottom:4}}>{riskLabel(risk)} RISK · {trades.length} disclosures · {violations} violation{violations!==1?"s":""}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.35)"}}>QuiverQuant Congressional Trading · gap = transaction → disclosure date</div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  {[["Buys",trades.filter(t=>t.action==="BUY").length,"#4ade80"],["Sells",trades.filter(t=>t.action==="SELL").length,"#f87171"],["Violations",violations,"#ef4444"]].map(([l,v,c])=>(
                    <div key={l} style={{background:"rgba(255,255,255,.04)",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
                      <div style={{fontSize:12,color:"rgba(255,255,255,.25)",textTransform:"uppercase",marginBottom:2}}>{l}</div>
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
                  <span style={{fontSize:12,fontWeight:800,padding:"2px 7px",borderRadius:4,background:t.action==="BUY"?"rgba(34,197,94,.15)":"rgba(239,68,68,.15)",color:t.action==="BUY"?"#4ade80":"#f87171"}}>{t.action}</span>
                  <span style={{fontSize:12,color:"rgba(255,255,255,.45)"}}>{t.amount}</span>
                  <span style={{fontSize:12,color:"rgba(255,255,255,.25)"}}>Traded: {t.tradeDate} | Filed: {t.filedDate}</span>
                  <span style={{marginLeft:"auto",fontSize:12,fontWeight:800,color:gapC(t.gap)}}>{t.gap>0?t.gap+"d":"same day"}</span>
                  {flag&&<Tag label={flag.badge} color={flag.color}/>}
                </div>
              );})}
            </div>
            <Disclaimer/>
          </div>
        )}
        {/* ── BILLS TAB ── */}
        {tab==="bills"&&(
          <div style={{...ds}}>
            <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:4}}>Sponsored Legislation</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:16}}>Congress.gov API · {bills.length} bills</div>
{bills.length>0&&<div style={{display:"grid",gridTemplateColumns:m?"1fr 1fr":"repeat(3,1fr)",gap:12,marginBottom:16}}>
  <div style={{background:"rgba(6,182,212,.04)",borderRadius:10,padding:"12px 14px",textAlign:"center"}}>
    <div style={{fontSize:22,fontWeight:900,color:"#67e8f9"}}>{bills.length}</div>
    <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>Bills Sponsored</div>
  </div>
  <div style={{background:"rgba(6,182,212,.04)",borderRadius:10,padding:"12px 14px",textAlign:"center"}}>
    <div style={{fontSize:22,fontWeight:900,color:"#14b8a6"}}>{bills.filter(b=>(b.type||"").includes("S")).length}</div>
    <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>Senate Bills</div>
  </div>
  <div style={{background:"rgba(6,182,212,.04)",borderRadius:10,padding:"12px 14px",textAlign:"center"}}>
    <div style={{fontSize:22,fontWeight:900,color:"#f59e0b"}}>{bills.filter(b=>b.latestAction?.text?.includes("Became") || b.latestAction?.text?.includes("Signed")).length}</div>
    <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>Enacted</div>
  </div>
</div>}
{bills.length>0&&pol.raised>0&&<div style={{background:"rgba(245,158,11,.04)",border:"1px solid rgba(245,158,11,.1)",borderRadius:10,padding:"12px 16px",marginBottom:16}}>
  <div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.6}}>{"\u{1F4CA}"} <strong style={{color:"#fbbf24"}}>Cross-Reference:</strong> {pol.name.split(" ").pop()} has sponsored {bills.length} bills while raising {fmt(pol.raised)} in campaign funds{pol.pacContrib>0?` (${Math.round((pol.pacContrib/pol.raised)*100)}% from PACs)`:""}.{pol.totalVotes>0?` They voted Yea ${pol.yeaPct}% of the time across ${pol.totalVotes} votes.`:""}</div>
  <Disclaimer/>
</div>}
            {!pol.bioguideId&&<div style={{fontSize:13,color:"rgba(255,255,255,.3)"}}>No Bioguide ID — Congress.gov unavailable.</div>}
            {bills.length===0&&pol.bioguideId&&<div style={{fontSize:13,color:"rgba(255,255,255,.3)"}}>No sponsored legislation found.</div>}
            {bills.length>0&&<div style={{background:"rgba(20,184,166,.04)",border:"1px solid rgba(20,184,166,.1)",borderRadius:12,padding:16,marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:700,color:"#14b8a6",marginBottom:6}}>Legislative Commitments</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.6}}>{pol.name.split(" ").pop()} has sponsored {bills.length} bill{bills.length>1?"s":""}. Sponsoring a bill indicates a public commitment to that policy area. Track these against their voting record and donor base for consistency.</div>
            </div>}
            {bills.slice(0,8).map((l,i)=>(
              <div key={i} style={{padding:"10px 0",borderBottom:i<bills.length-1?"1px solid rgba(255,255,255,.06)":"none",display:"flex",gap:10,alignItems:"flex-start"}}>
                <span style={{fontSize:12,fontWeight:700,background:"rgba(59,130,246,.15)",color:"#60a5fa",padding:"2px 6px",borderRadius:3,flexShrink:0,marginTop:2}}>{l.type||"BILL"}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:"#e2e8f0",lineHeight:1.4}}>{(l.title||"").slice(0,100)}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.25)",marginTop:2}}>Introduced {l.introducedDate||"--"}{l.latestAction?" · "+l.latestAction.text.slice(0,60):""}</div>
                </div>
              </div>
            ))}
            <div style={{marginTop:24}}>
              <div style={{fontWeight:700,fontSize:16,color:"#fff",marginBottom:8}}>Voting Record</div>
              <p style={{fontSize:13,color:"rgba(255,255,255,.35)",marginBottom:14}}>Per-member roll call votes and DW-NOMINATE ideology score from Voteview.com.</p>
              <MemberVotingRecord pol={pol}/>
            </div>
          </div>
        )}
        {/* ── LOBBYING TAB ── */}
        {tab==="lobbying"&&<div>
          <div style={{fontWeight:700,fontSize:16,color:"#fff",marginBottom:14}}>Lobbying & Foreign Influence</div>
          <p style={{fontSize:13,color:"rgba(255,255,255,.35)",marginBottom:20}}>Lobbying activity targeting {pol.chamber==="Senate"?"the Senate":"the House"} from {pol.state}. Data from LDA.gov and FARA.</p>
{(()=>{
  // Count lobbying filings targeting this chamber
  return <div style={{display:"grid",gridTemplateColumns:m?"1fr 1fr":"repeat(3,1fr)",gap:12,marginBottom:16}}>
    <div style={{background:"rgba(99,102,241,.04)",borderRadius:10,padding:"12px 14px",textAlign:"center"}}>
      <div style={{fontSize:22,fontWeight:900,color:"#6366f1"}}>{pol.chamber}</div>
      <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>Chamber</div>
    </div>
    <div style={{background:"rgba(99,102,241,.04)",borderRadius:10,padding:"12px 14px",textAlign:"center"}}>
      <div style={{fontSize:22,fontWeight:900,color:"#a5b4fc"}}>{pol.state}</div>
      <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>State</div>
    </div>
    {pol.raised>0&&<div style={{background:"rgba(245,158,11,.04)",borderRadius:10,padding:"12px 14px",textAlign:"center"}}>
      <div style={{fontSize:22,fontWeight:900,color:"#fbbf24"}}>{Math.round((pol.pacContrib||0)/(pol.raised||1)*100)}%</div>
      <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>PAC Funded</div>
    </div>}
  </div>;
})()}
          <LobbyingPanel pol={pol}/>
          {trades.length>0&&<div style={{marginTop:20}}>
            <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:14}}>Lobbying ↔ Trading Cross-Reference</div>
            {(()=>{
              const tradeSectors=new Set((trades||[]).map(t=>classifyTicker(t.ticker)).filter(s=>s!=="Other"));
              if(!tradeSectors.size)return <div style={{fontSize:13,color:"rgba(255,255,255,.25)"}}>No sector-classified trades to cross-reference.</div>;
              const sectorToLobbyIssue={"Technology":"Computer Industry","Defense":"Defense","Energy":"Energy/Nuclear","Finance":"Financial Institutions/Investments/Securities","Pharma":"Health Issues","Healthcare":"Health Issues"};
              const matchedIssues=[...tradeSectors].map(s=>sectorToLobbyIssue[s]).filter(Boolean);
              return(<div style={{background:"rgba(245,158,11,.04)",border:"1px solid rgba(245,158,11,.1)",borderRadius:12,padding:16}}>
                <div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.7}}>
                  {pol.name.split(" ").pop()} trades in: <strong style={{color:"#e2e8f0"}}>{[...tradeSectors].join(", ")}</strong>
                  {matchedIssues.length>0&&<><br/>Related lobbying issue areas: <strong style={{color:"#fbbf24"}}>{matchedIssues.join(", ")}</strong><br/>
                  Check the lobbying filings above for activity in these sectors. When lobbying targets overlap with an official's trading sectors, it warrants additional scrutiny.</>}
                </div>
                <Disclaimer/>
              </div>);
            })()}
          </div>}
          <Disclaimer/>
        </div>}
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
                  <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,color:c,marginBottom:6}}>{l}</div>
                  <div style={{fontSize:13,color:"#e2e8f0",lineHeight:1.7}}>{content}</div>
                </div>
              );})}
              <button onClick={()=>setAI("")} style={{background:"none",border:"1px solid rgba(255,255,255,.08)",borderRadius:8,padding:"7px 14px",fontSize:12,color:"rgba(255,255,255,.3)",cursor:"pointer"}}>Regenerate</button>
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
  const[note,setNote]=useState("");const[showNote,setShowNote]=useState(false);const[showAllDonors,setShowAllDonors]=useState(false);
  const isWatched=user&&user.watchlist&&user.watchlist.includes(pol.id);
  const toggleWatch=async()=>{if(!user)return;const wl=isWatched?user.watchlist.filter(x=>x!==pol.id):[...user.watchlist,pol.id];const updated=await updateUser(user.id,{watchlist:wl});if(onSetUser&&updated)onSetUser(updated);};
  const saveNote=async()=>{if(!user)return;const notes={...((user.notes||{})),[pol.id]:note};const updated=await updateUser(user.id,{notes});if(onSetUser&&updated)onSetUser(updated);setShowNote(false);};
  useEffect(()=>{
    setNote((user&&user.notes&&user.notes[pol.id])||"");
    setL(true);
    tradesFor(pol.name).then(t=>{setTrades(t);setL(false);});
    const bid2=pol.bioguideId||(pol.congressUrl&&pol.congressUrl.match(/\/([A-Z]\d{5,6})\/?$/)?.[1])||null;
    if(bid2)fetchBills(bid2).then(setBills);
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
    <div style={{background:"#09090b",minHeight:"100vh",paddingBottom:60}}>
      <CW pad="0 28px">
        <div style={{padding:"16px 0",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <button onClick={onBack} style={{background:"rgba(168,85,247,.08)",border:"1px solid rgba(168,85,247,.2)",cursor:"pointer",color:"#a78bfa",fontWeight:700,fontSize:12,padding:"7px 14px",borderRadius:8}}>← Back</button>
          {user&&<button onClick={toggleWatch} style={{background:isWatched?"rgba(239,68,68,.1)":"rgba(16,185,129,.1)",border:"1px solid "+(isWatched?"rgba(239,68,68,.3)":"rgba(16,185,129,.3)"),color:isWatched?"#f87171":"#34d399",fontWeight:700,fontSize:12,padding:"7px 14px",borderRadius:8,cursor:"pointer"}}>{isWatched?"✕ Unwatch":"+ Watch"}</button>}
          {user&&<button onClick={()=>setShowNote(!showNote)} style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",color:"rgba(255,255,255,.5)",fontWeight:700,fontSize:12,padding:"7px 14px",borderRadius:8,cursor:"pointer"}}>📝 {(user.notes&&user.notes[pol.id])?"Edit Note":"Add Note"}</button>}
          <a href={`https://www.congress.gov/member/${pol.name.toLowerCase().replace(/[^a-z\s]/g,"").trim().replace(/\s+/g,"-")}/${pol.bioguideId||""}`} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:"rgba(255,255,255,.35)",textDecoration:"none",border:"1px solid rgba(255,255,255,.08)",padding:"7px 14px",borderRadius:8}}>Congress.gov ↗</a>
          {fecUrl&&<a href={fecUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:"rgba(255,255,255,.35)",textDecoration:"none",border:"1px solid rgba(255,255,255,.08)",padding:"7px 14px",borderRadius:8}}>FEC.gov ↗</a>}
        </div>
        {showNote&&user&&(
          <div style={{background:"rgba(168,85,247,.08)",border:"1px solid rgba(168,85,247,.25)",borderRadius:12,padding:16,marginBottom:14}}>
            <div style={{fontSize:12,color:"#a78bfa",fontWeight:700,marginBottom:8}}>Your private note on {pol.name}</div>
            <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Add investigation notes, observations..." rows={3} style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(168,85,247,.2)",borderRadius:8,color:"#fff",fontSize:12,padding:"10px 12px",outline:"none",resize:"vertical",boxSizing:"border-box"}}/>
            <div style={{display:"flex",gap:8,marginTop:8}}><button onClick={saveNote} style={{background:"rgba(168,85,247,.2)",color:"#a78bfa",border:"none",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Save Note</button><button onClick={()=>setShowNote(false)} style={{background:"none",color:"rgba(255,255,255,.3)",border:"none",fontSize:12,cursor:"pointer"}}>Cancel</button></div>
          </div>
        )}
        {/* Header Card */}
        <div style={{background:"linear-gradient(135deg,#18181b,#27272a)",border:"1px solid rgba(168,85,247,.15)",borderRadius:20,padding:m?"18px":"24px",marginBottom:16,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${PC[pol.party]},transparent)`}}/>
          <div style={{display:"flex",gap:18,alignItems:"flex-start",flexWrap:"wrap"}}>
            <Avatar pol={pol} size={m?52:68} ring="#a78bfa"/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}>
                <h2 style={{fontSize:m?18:24,fontWeight:900,color:"#fff",margin:0}}>{pol.name}</h2>
                <span style={{fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:5,background:PC[pol.party]+"20",color:PC[pol.party],border:"1px solid "+PC[pol.party]+"40"}}>{PL[pol.party]}</span>
                <span style={{fontSize:12,fontWeight:700,padding:"2px 8px",borderRadius:4,background:rC+"18",color:rC}}>RISK {risk}/100</span>
                {violations>0&&<span style={{fontSize:12,fontWeight:800,padding:"2px 9px",borderRadius:4,background:"rgba(239,68,68,.15)",color:"#f87171",border:"1px solid rgba(239,68,68,.3)",animation:"pulseDot 2s infinite"}}>🚨 {violations} VIOLATION{violations>1?"S":""}</span>}
                {isWatched&&<span style={{fontSize:12,color:"#34d399",padding:"2px 9px",background:"rgba(16,185,129,.1)",borderRadius:4,border:"1px solid rgba(16,185,129,.2)"}}>✓ Watching</span>}
              </div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:14}}>{pol.chamber} · {pol.state}{fecId&&" | "+fecId}</div>
              <div style={{display:"grid",gridTemplateColumns:m?"1fr 1fr":"repeat(5,1fr)",gap:8,marginBottom:12}}>
                {[["Raised",fmt(raised),raised>0,"#10b981"],["Spent",fmt(spent),spent>0,"#ef4444"],["Cash",fmt(cash),cash>0,"#3b82f6"],["Trades",loading?"…":trades.length,trades.length>0,"#a78bfa"],["Violations",loading?"…":violations,violations>0,"#ef4444"]].map(([l,v,ok,c],i)=>(
                  <div key={i} style={{background:"rgba(255,255,255,.05)",borderRadius:10,padding:"10px 12px"}}>
                    <div style={{fontSize:12,color:"rgba(255,255,255,.25)",textTransform:"uppercase",letterSpacing:.4,marginBottom:4}}>{l}</div>
                    <div style={{fontSize:m?12:14,fontWeight:700,color:ok?(i===4?"#ef4444":c):"rgba(255,255,255,.18)"}}>{v||"--"}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Party & Chamber Info */}
        <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          <div style={{background:PC[pol.party]+"12",border:"1px solid "+PC[pol.party]+"30",borderRadius:10,padding:"10px 18px",display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:PC[pol.party]}}/>
            <span style={{fontSize:13,fontWeight:800,color:PC[pol.party]}}>{PL[pol.party]}</span>
          </div>
          <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,padding:"10px 18px",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.6)"}}>{pol.chamber==="Senate"?"U.S. Senate":"U.S. House"}</span>
            <span style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>|</span>
            <span style={{fontSize:12,fontWeight:700,color:"#f59e0b"}}>{pol.state}</span>
          </div>
          {pol.district&&<div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,padding:"10px 18px"}}>
            <span style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.5)"}}>District {pol.district}</span>
          </div>}
        </div>
        {/* Tabs */}
        <div style={{display:"flex",gap:2,background:"rgba(168,85,247,.06)",border:"1px solid rgba(168,85,247,.12)",padding:4,borderRadius:12,marginBottom:18,overflowX:"auto"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"8px 14px",borderRadius:9,border:"none",background:tab===t.id?"rgba(168,85,247,.2)":"transparent",color:tab===t.id?"#a78bfa":"rgba(255,255,255,.35)",fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5,flexShrink:0,position:"relative"}}>
              {t.hot&&tab!==t.id&&<div style={{position:"absolute",top:4,right:4,width:6,height:6,borderRadius:"50%",background:"#ef4444",animation:"pulseDot 2s infinite"}}/>}
              {t.l}{t.ai&&<span style={{fontSize:7,background:"#6366f1",color:"#fff",padding:"1px 4px",borderRadius:2}}>AI</span>}
            </button>
          ))}
        </div>
        {/* Tab content */}
        {tab==="overview"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:"rgba(6,182,212,.04)",border:"1px solid rgba(6,182,212,.1)",borderRadius:14,padding:20,marginBottom:20}}>
              <div style={{fontSize:14,fontWeight:700,color:"#67e8f9",marginBottom:8}}>Quick Summary</div>
              <div style={{fontSize:14,color:"rgba(255,255,255,.5)",lineHeight:1.7}}>
                {pol.name} is a {pol.party==="D"?"Democratic":pol.party==="R"?"Republican":"Independent"} {pol.chamber==="Senate"?"Senator":"Representative"} from {pol.state}{pol.yearsInOffice>0?`, serving since approximately ${2026-pol.yearsInOffice}`:""}.
                {pol.raised>0?` They have raised ${fmt(pol.raised)} in campaign funds${pol.pacContrib>0?`, with ${Math.round((pol.pacContrib/pol.raised)*100)}% from PACs`:""}.`:""}
                {pol.totalVotes>0?` They have cast ${pol.totalVotes} votes (${pol.yeaPct}% Yea)${pol.ideology!=null?` and have a DW-NOMINATE ideology score of ${pol.ideology.toFixed(2)} (${pol.ideology<-0.3?"liberal":pol.ideology>0.3?"conservative":"moderate"})`:""}.`:""}
                {trades.length>0?` They have ${trades.length} disclosed stock trade${trades.length>1?"s":""}.`:""}
              </div>
            </div>
            {raised>0&&<div style={{...ds}}>
              <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:4}}>FEC Campaign Finance</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:16}}>OpenFEC · live</div>
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
                  <div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginTop:2}}>{cnt}x</div>
                </div>)}
              </div>
            </div>}
            {inds.length>0&&<div style={{...ds}}>
              <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:4}}>PAC Industry Funding</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:16}}>FEC Schedule A · committee contributors</div>
              {inds.map(ind=>(
                <div key={ind.name} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:ind.color,flexShrink:0}}/>
                  <div style={{width:80,fontSize:12,color:"rgba(255,255,255,.5)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ind.name}</div>
                  <div style={{flex:1,height:14,borderRadius:3,background:"rgba(255,255,255,.05)",overflow:"hidden"}}><div style={{height:"100%",width:((ind.total/maxV)*100)+"%",background:ind.color,opacity:.8,borderRadius:3,transition:"width 1.2s"}}/></div>
                  <div style={{fontSize:12,fontWeight:700,color:"#e2e8f0",minWidth:56,textAlign:"right"}}>{fmt(ind.total)}</div>
                </div>
              ))}
              {donors.slice(0,showAllDonors?20:5).map((d,i)=>{const ind=classifyPAC(d.contributor_name);return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:9,marginBottom:6,padding:"8px 12px",background:i===0?"rgba(16,185,129,.06)":"rgba(255,255,255,.02)",borderRadius:9,border:"1px solid rgba(255,255,255,.06)"}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:IC[ind]||"#94a3b8",flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.contributor_name}</div><div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{ind}</div></div>
                  <div style={{fontSize:12,fontWeight:700,color:"#10b981"}}>{fmt(d.contribution_receipt_amount)}</div>
                </div>
              );})}
              {donors.length>5&&<button onClick={()=>setShowAllDonors(!showAllDonors)} style={{marginTop:8,padding:"8px 16px",borderRadius:8,border:"1px solid rgba(99,102,241,.2)",background:"rgba(99,102,241,.06)",color:"#a5b4fc",fontSize:13,fontWeight:600,cursor:"pointer"}}>{showAllDonors?"Show less":"Show all "+donors.length+" donors"}</button>}
            </div>}
          </div>
        )}
        {tab==="trades"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {/* Risk gauge */}
            <div style={{background:"linear-gradient(135deg,rgba(168,85,247,.06),rgba(168,85,247,.02))",border:"1px solid rgba(168,85,247,.15)",borderRadius:14,padding:20}}>
              <div style={{display:"flex",gap:14,alignItems:"center",flexWrap:"wrap",marginBottom:14}}>
                <div style={{width:64,height:64,borderRadius:"50%",background:`conic-gradient(${rC} ${risk*3.6}deg,rgba(255,255,255,.05) 0deg)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <div style={{width:50,height:50,borderRadius:"50%",background:"#09090b",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column"}}><div style={{fontSize:16,fontWeight:900,color:rC,lineHeight:1}}>{risk}</div><div style={{fontSize:7,color:"rgba(255,255,255,.25)"}}>RISK</div></div>
                </div>
                <div><div style={{fontSize:13,fontWeight:700,color:rC,marginBottom:4}}>{riskLabel(risk)} RISK</div><div style={{fontSize:12,color:"rgba(255,255,255,.35)"}}>{trades.length} disclosures · {violations} violation{violations!==1?"s":""} · from QuiverQuant Congressional Trading</div></div>
                <div style={{marginLeft:"auto",display:"flex",gap:8}}>
                  {[["Buys",trades.filter(t=>t.action==="BUY").length,"#4ade80"],["Sells",trades.filter(t=>t.action==="SELL").length,"#f87171"],["Violations",violations,"#ef4444"]].map(([l,v,c])=>(
                    <div key={l} style={{background:"rgba(255,255,255,.04)",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
                      <div style={{fontSize:12,color:"rgba(255,255,255,.25)",textTransform:"uppercase",marginBottom:2}}>{l}</div>
                      <div style={{fontSize:16,fontWeight:900,color:v>0?c:"rgba(255,255,255,.15)"}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{background:"rgba(168,85,247,.04)",border:"1px solid rgba(168,85,247,.12)",borderRadius:14,padding:20}}>
              <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
                <span style={{fontSize:13,fontWeight:700,color:"#4ade80"}}>STOCK Act Disclosures</span>
                <span style={{fontSize:12,background:"rgba(34,197,94,.08)",color:"#4ade80",padding:"2px 8px",borderRadius:4,fontWeight:700}}>{trades.length} total</span>
              </div>
              {loading&&<div style={{display:"flex",gap:8,alignItems:"center",color:"rgba(255,255,255,.35)",fontSize:13,padding:"16px 0"}}><Spin sz={14}/>Loading disclosures...</div>}
              {!loading&&!trades.length&&<div style={{color:"rgba(255,255,255,.25)",fontSize:13,padding:"20px 0",textAlign:"center"}}>No STOCK Act disclosures found for "{pol.name}" in the S3 databases.</div>}
              {!loading&&trades.slice(0,25).map((t,i)=>{const flag=flagTrade(t);return(
                <div key={i} style={{background:flag?"rgba(255,255,255,.05)":"rgba(255,255,255,.02)",border:"1px solid "+(flag?flag.color+"44":"rgba(255,255,255,.07)"),borderRadius:9,padding:11,display:"flex",alignItems:"center",gap:9,flexWrap:"wrap",marginBottom:6,animation:"slideIn .3s ease "+i*.03+"s both"}}>
                  <div style={{width:3,height:28,borderRadius:2,background:t.action==="BUY"?"#4ade80":"#f87171",flexShrink:0}}/>
                  <div style={{minWidth:44}}><div style={{fontSize:13,fontWeight:900,color:"#fff"}}>{t.ticker||"🏢"}</div>{t.description&&<div style={{fontSize:7,color:"rgba(255,255,255,.2)",marginTop:1}}>{t.description.slice(0,18)}</div>}</div>
                  <span style={{fontSize:12,fontWeight:800,padding:"2px 7px",borderRadius:4,background:t.action==="BUY"?"rgba(34,197,94,.15)":"rgba(239,68,68,.15)",color:t.action==="BUY"?"#4ade80":"#f87171"}}>{t.action}</span>
                  <span style={{fontSize:12,color:"rgba(255,255,255,.45)"}}>{t.amount}</span>
                  <div style={{display:"flex",flexDirection:"column",gap:1}}>
                    <span style={{fontSize:12,color:"rgba(255,255,255,.25)"}}>Traded: {t.tradeDate}</span>
                    <span style={{fontSize:12,color:"rgba(255,255,255,.18)"}}>Filed: {t.filedDate}</span>
                  </div>
                  <span style={{fontSize:12,background:"rgba(255,255,255,.04)",color:"rgba(255,255,255,.3)",padding:"1px 5px",borderRadius:3}}>{t.source}</span>
                  <span style={{marginLeft:"auto",fontSize:12,fontWeight:800,color:gapC(t.gap)}}>{t.gap>0?t.gap+"d":"same day"}</span>
                  {flag&&<Tag label={flag.badge} color={flag.color}/>}
                </div>
              );})}
            </div>
          </div>
        )}
        {tab==="bills"&&(
          <div style={{...ds}}>
            <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:4}}>Sponsored Legislation</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:16}}>Congress.gov API · {bills.length} bills</div>
            {!pol.bioguideId&&<div style={{fontSize:13,color:"rgba(255,255,255,.3)"}}>No Bioguide ID — Congress.gov link unavailable.</div>}
            {bills.length===0&&pol.bioguideId&&<div style={{fontSize:13,color:"rgba(255,255,255,.3)"}}>No sponsored legislation found in current Congress.</div>}
            {bills.length>0&&<div style={{background:"rgba(20,184,166,.04)",border:"1px solid rgba(20,184,166,.1)",borderRadius:12,padding:16,marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:700,color:"#14b8a6",marginBottom:6}}>Legislative Commitments</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.6}}>{pol.name.split(" ").pop()} has sponsored {bills.length} bill{bills.length>1?"s":""}. Sponsoring a bill indicates a public commitment to that policy area. Track these against their voting record and donor base for consistency.</div>
            </div>}
            {bills.slice(0,8).map((l,i)=>(
              <div key={i} style={{padding:"10px 0",borderBottom:i<bills.length-1?"1px solid rgba(255,255,255,.06)":"none",display:"flex",gap:10,alignItems:"flex-start"}}>
                <span style={{fontSize:12,fontWeight:700,background:"rgba(59,130,246,.15)",color:"#60a5fa",padding:"2px 6px",borderRadius:3,flexShrink:0,marginTop:2}}>{l.type||"BILL"}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:"#e2e8f0",lineHeight:1.4}}>{(l.title||"").slice(0,100)}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.25)",marginTop:2}}>Introduced {l.introducedDate||"--"}{l.latestAction?" · "+l.latestAction.text.slice(0,60):""}</div>
                </div>
              </div>
            ))}
            <div style={{marginTop:24}}>
              <div style={{fontWeight:700,fontSize:16,color:"#fff",marginBottom:8}}>Voting Record</div>
              <p style={{fontSize:13,color:"rgba(255,255,255,.35)",marginBottom:14}}>Per-member roll call votes and DW-NOMINATE ideology score from Voteview.com.</p>
              <MemberVotingRecord pol={pol}/>
            </div>
          </div>
        )}
        {tab==="ai"&&(
          <div>
            <div style={{background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.2)",borderRadius:9,padding:"10px 16px",marginBottom:14,fontSize:12,color:"#fbbf24"}}>Analysis uses verified FEC + STOCK Act data only. Sources: QuiverQuant, OpenFEC, Congress.gov.</div>
            {!aiRes&&!aiLoad&&<button onClick={runAI} style={{background:"linear-gradient(135deg,#6d28d9,#7c3aed)",color:"#fff",border:"none",borderRadius:12,padding:"14px 22px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%"}}>Generate Intelligence Briefing</button>}
            {aiLoad&&<div style={{display:"flex",alignItems:"center",gap:10,padding:20,justifyContent:"center",color:"rgba(255,255,255,.4)"}}><Spin sz={16} col="#a78bfa"/>Analyzing {trades.length} disclosures + FEC data...</div>}
            {aiErr&&<EBox msg={aiErr}/>}
            {aiRes&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[{k:"FINANCIAL_PROFILE",l:"Financial Profile",c:"#10b981"},{k:"TRADING_ANALYSIS",l:"Trading Analysis",c:"#f97316"},{k:"VIOLATION_ASSESSMENT",l:"Violation Assessment",c:"#ef4444"},{k:"TRANSPARENCY_GRADE",l:"Transparency Grade",c:"#a78bfa"},{k:"INVESTIGATION_PRIORITIES",l:"Investigation Priorities",c:"#6366f1"}].map(({k,l,c})=>{const content=sec(aiRes,k);if(!content)return null;return(
                <div key={k} style={{background:c+"08",border:"1px solid "+c+"25",borderRadius:10,padding:14}}>
                  <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,color:c,marginBottom:6}}>{l}</div>
                  <div style={{fontSize:13,color:"#e2e8f0",lineHeight:1.7}}>{content}</div>
                </div>
              );})}
              <button onClick={()=>setAI("")} style={{background:"none",border:"1px solid rgba(255,255,255,.08)",borderRadius:8,padding:"7px 14px",fontSize:12,color:"rgba(255,255,255,.3)",cursor:"pointer"}}>Regenerate</button>
            </div>}
          </div>
        )}
        {/* Related Officials */}
        {pols&&pols.length>0&&(()=>{
          const related=(pols||[]).filter(p=>p.id!==pol.id&&(p.state===pol.state||Math.abs(calcRisk((allTrades||[]).filter(t=>(t.name||"").toLowerCase().includes(p.name.toLowerCase().split(/\s+/).pop())),p.raised)-risk)<15)).slice(0,4);
          if(!related.length)return null;
          return(
            <div style={{marginTop:24}}>
              <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:14}}>Similar Officials</div>
              <div style={{display:"grid",gridTemplateColumns:mob()?"1fr 1fr":"repeat(4,1fr)",gap:12}}>
                {related.map(p=>{const pT=(allTrades||[]).filter(t=>(t.name||"").toLowerCase().includes(p.name.toLowerCase().split(/\s+/).pop())&&p.name.toLowerCase().split(/\s+/).pop().length>3);const pR=calcRisk(pT,p.raised);return(
                  <div key={p.id} onClick={()=>onSelect&&onSelect(p)} style={{background:"rgba(168,85,247,.04)",border:"1px solid rgba(168,85,247,.12)",borderRadius:12,padding:14,cursor:"pointer",transition:"all .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(168,85,247,.3)";e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(168,85,247,.12)";e.currentTarget.style.transform="none";}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <Avatar pol={p} size={32}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                        <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{p.chamber} · {p.state}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10}}>
                      <span style={{color:"rgba(255,255,255,.3)"}}>Risk</span>
                      <span style={{fontWeight:700,color:riskColor(pR)}}>{pR}/100</span>
                    </div>
                    {p.raised>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginTop:2}}>
                      <span style={{color:"rgba(255,255,255,.3)"}}>Raised</span>
                      <span style={{fontWeight:700,color:"#10b981"}}>{fmt(p.raised)}</span>
                    </div>}
                  </div>
                );})}
              </div>
            </div>
          );
        })()}
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
          {tab==="login"&&<div style={{textAlign:"center",marginTop:14,fontSize:12,color:"rgba(255,255,255,.25)"}}>Demo: <span style={{color:"#a78bfa",fontFamily:"monospace"}}>admin@officium.vote / admin123</span></div>}
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
    <div style={{background:"#09090b",minHeight:"100vh",paddingBottom:60}}>
      <div style={{background:"linear-gradient(135deg,#18181b,#27272a)",borderBottom:"1px solid rgba(168,85,247,.12)",padding:"28px 0 22px"}}>
        <CW>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18,flexWrap:"wrap"}}>
            <div style={{width:46,height:46,borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:900,color:"#fff"}}>{(user.name||"U")[0].toUpperCase()}</div>
            <div><div style={{fontSize:20,fontWeight:900,color:"#fff"}}>{user.name}'s Dashboard</div><div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginTop:2}}>{user.email} · Joined {timeAgo(user.joinedAt)}</div></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:m?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
            {[["Watching",watchedPols.length,"#a78bfa"],["Trade Alerts",allTrades.length,"#f59e0b"],["Violations",violations.length,"#ef4444"],["Total Raised",watchedPols.reduce((a,p)=>a+p.raised,0)>0?fmt(watchedPols.reduce((a,p)=>a+p.raised,0)):"--","#10b981"]].map(([l,v,c])=>(
              <div key={l} style={{background:"rgba(168,85,247,.06)",border:"1px solid rgba(168,85,247,.12)",borderRadius:12,padding:"14px 16px"}}>
                <div style={{fontSize:12,color:"rgba(255,255,255,.25)",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{l}</div>
                <div style={{fontSize:22,fontWeight:900,color:c}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,marginTop:14}}>
            <button onClick={exportCSV} style={{padding:"8px 16px",borderRadius:8,border:"1px solid rgba(168,85,247,.3)",background:"rgba(168,85,247,.1)",color:"#a78bfa",fontSize:12,fontWeight:700,cursor:"pointer"}}>Export CSV</button>
            <button onClick={()=>{setShowCompare(!showCompare);if(showCompare)setCompare([]);}} style={{padding:"8px 16px",borderRadius:8,border:"1px solid "+(showCompare?"rgba(249,115,22,.3)":"rgba(168,85,247,.3)"),background:showCompare?"rgba(249,115,22,.1)":"rgba(168,85,247,.1)",color:showCompare?"#f97316":"#a78bfa",fontSize:12,fontWeight:700,cursor:"pointer"}}>{showCompare?"Cancel Compare":"Compare Officials"}</button>
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
                  <div><div style={{fontSize:14,fontWeight:800,color:"#fff"}}>{p.name}</div><div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{p.party==="D"?"Democrat":p.party==="R"?"Republican":"Independent"}</div></div>
                </div>
                {[["Chamber",p.chamber],["State",p.state],["Raised",fmt(p.raised)],["Spent",fmt(p.spent||0)],["Cash on Hand",fmt(p.cash||0)],["Trades",pTrades.length],["Violations",pViolations],["Risk Score",riskScore+"/100"]].map(([l,v])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                    <span style={{fontSize:12,color:"rgba(255,255,255,.35)"}}>{l}</span>
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
              <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:16}}>STOCK Act disclosures from officials you follow</div>
              {!watchedPols.length&&<div style={{textAlign:"center",padding:"28px 0",color:"rgba(255,255,255,.25)",fontSize:13}}>No officials in watchlist.<br/>Browse officials and click <strong style={{color:"#a78bfa"}}>+ Watch</strong>.</div>}
              {loading&&watchedPols.length>0&&<div style={{display:"flex",gap:8,alignItems:"center",color:"rgba(255,255,255,.35)",fontSize:13,padding:"12px 0"}}><Spin sz={14}/>Loading trade data...</div>}
              {violations.length>0&&<div style={{background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.2)",borderRadius:10,padding:12,marginBottom:14}}>
                <div style={{fontSize:12,fontWeight:800,color:"#ef4444",marginBottom:8}}>🚨 {violations.length} VIOLATION{violations.length>1?"S":""} IN YOUR WATCHLIST</div>
                {violations.slice(0,3).map((t,i)=><div key={i} style={{fontSize:12,color:"#fca5a5",marginBottom:2}}>· {t._pol.name}: {t.ticker||"N/A"} {t.action} — {t.gap}d late</div>)}
              </div>}
              {allTrades.map((t,i)=>{const flag=flagTrade(t);return(
                <div key={i} onClick={()=>onSelect(t._pol)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:i<allTrades.length-1?"1px solid rgba(255,255,255,.05)":"none",cursor:"pointer"}}>
                  <Avatar pol={t._pol} size={30}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:"#fff"}}>{t._pol.name}</div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{t.ticker||"N/A"} {t.action} · {t.amount} · {t.tradeDate}</div>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span style={{fontSize:12,fontWeight:700,color:gapC(t.gap)}}>{t.gap}d</span>
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
                  <div style={{fontSize:12,color:"rgba(255,255,255,.4)",lineHeight:1.5}}>{note}</div>
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
                    <div style={{minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div><div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{p.chamber} · {(watchedTrades[p.id]||[]).length} trades</div></div>
                  </div>
                  <button onClick={()=>toggleWatch(p.id)} style={{fontSize:12,background:"rgba(239,68,68,.08)",color:"#ef4444",border:"1px solid rgba(239,68,68,.2)",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontWeight:700,flexShrink:0}}>✕</button>
                </div>
              ))}
            </div>
            <div style={{background:"rgba(168,85,247,.05)",border:"1px solid rgba(168,85,247,.12)",borderRadius:14,padding:18}}>
              <div style={{fontWeight:700,fontSize:13,color:"#fff",marginBottom:12}}>Suggested to Watch</div>
              {pols.filter(p=>!user.watchlist.includes(p.id)&&p.raised>1e6).slice(0,5).map(p=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
                  <Avatar pol={p} size={28}/>
                  <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>onSelect(p)}><div style={{fontSize:12,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div><div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{p.state} · {fmt(p.raised)}</div></div>
                  <button onClick={()=>toggleWatch(p.id)} style={{fontSize:12,background:"rgba(16,185,129,.08)",color:"#34d399",border:"1px solid rgba(16,185,129,.2)",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontWeight:700,flexShrink:0}}>+</button>
                </div>
              ))}
            </div>
            {watchedPols.length>0&&<div style={{background:"rgba(168,85,247,.05)",border:"1px solid rgba(168,85,247,.12)",borderRadius:14,padding:18}}>
              <div style={{fontWeight:700,fontSize:13,color:"#fff",marginBottom:12}}>Watchlist Analytics</div>
              {[["Total Raised",fmt(watchedPols.reduce((a,p)=>a+p.raised,0)),"#10b981"],["Avg Risk",Math.round(watchedPols.reduce((a,p)=>{const pT=(watchedTrades[p.id]||[]);const pV=pT.filter(t=>t.gap>45).length;return a+Math.min(100,(pV*15)+(pT.length*2)+(p.raised>1e6?10:0));},0)/watchedPols.length)+"/100","#f59e0b"],["Party Split (D/R)",watchedPols.filter(p=>p.party==="D").length+"/"+watchedPols.filter(p=>p.party==="R").length,"#a78bfa"],["Chamber Split (S/H)",watchedPols.filter(p=>p.chamber==="Senate").length+"/"+watchedPols.filter(p=>p.chamber==="House").length,"#0ea5e9"]].map(([l,v,c])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                  <span style={{fontSize:12,color:"rgba(255,255,255,.35)"}}>{l}</span>
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
  const TABS=[{id:"overview",l:"Overview"},{id:"violations",l:"Violations"},{id:"tickers",l:"Tickers"},{id:"geographic",l:"Geographic"},{id:"temporal",l:"Temporal"},{id:"fara",l:"FARA"},{id:"spending",l:"Spending"},{id:"insider",l:"Insider Flags"},{id:"pipeline",l:"Data Pipeline"},{id:"users",l:"Users"},{id:"apis",l:"API Health"},{id:"regs",l:"Regulations"}];
  const ds={background:"rgba(168,85,247,.05)",border:"1px solid rgba(168,85,247,.1)",borderRadius:14,padding:22};
  return(
    <div style={{background:"#09090b",minHeight:"100vh",paddingBottom:60}}>
      <div style={{background:"linear-gradient(135deg,#18181b,#27272a)",borderBottom:"1px solid rgba(168,85,247,.12)",padding:"26px 0 20px"}}>
        <CW>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18,flexWrap:"wrap"}}>
            <div style={{width:40,height:40,borderRadius:10,background:"rgba(239,68,68,.15)",border:"1px solid rgba(239,68,68,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🛡</div>
            <div><div style={{fontSize:20,fontWeight:900,color:"#fff"}}>Admin Dashboard</div><div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>Officium Platform Intelligence · Real-time</div></div>
            <span style={{marginLeft:"auto",fontSize:12,background:liveCount>=6?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",color:liveCount>=6?"#34d399":"#f87171",border:"1px solid "+(liveCount>=6?"rgba(34,197,94,.3)":"rgba(239,68,68,.3)"),padding:"4px 12px",borderRadius:100,fontWeight:700}}>{liveCount}/{API_CHECKS.length} APIs live</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:m?"1fr 1fr":"repeat(5,1fr)",gap:10}}>
            {[["Trades",(trades||[]).length,"#a78bfa"],["Violations",violations,"#ef4444"],["Late (30-45d)",(trades||[]).filter(t=>t.gap>30&&t.gap<=45).length,"#f59e0b"],["Officials",pols.length,"#c8a84b"],["Users",users.length,"#10b981"]].map(([l,v,c])=>(
              <div key={l} style={{background:"rgba(168,85,247,.06)",border:"1px solid rgba(168,85,247,.1)",borderRadius:12,padding:"14px 16px"}}>
                <div style={{fontSize:12,color:"rgba(255,255,255,.25)",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{l}</div>
                <div style={{fontSize:22,fontWeight:900,color:c}}>{v}</div>
              </div>
            ))}
          </div>
        </CW>
      </div>
      <CW pad="20px 28px">
        <div style={{display:"flex",gap:2,background:"rgba(168,85,247,.06)",border:"1px solid rgba(168,85,247,.1)",borderRadius:10,padding:3,marginBottom:20,overflowX:"auto"}}>
          {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"7px 14px",borderRadius:8,border:"none",background:tab===t.id?"rgba(168,85,247,.2)":"transparent",color:tab===t.id?"#a78bfa":"rgba(255,255,255,.35)",fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>{t.l}</button>)}
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
          <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:20}}>Members with most late disclosures (&gt;45 days)</div>
          {topV.map(([name,cnt],i)=>{const pol=pols.find(p=>p.name.toLowerCase().includes(name.toLowerCase().split(/\s+/).pop()));return(
            <div key={name} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
              <div style={{fontSize:16,fontWeight:900,color:i<3?"#ef4444":"#4b5563",minWidth:26,textAlign:"center"}}>{i+1}</div>
              {pol?<Avatar pol={pol} size={36}/>:<div style={{width:36,height:36,borderRadius:"50%",background:"rgba(255,255,255,.04)",flexShrink:0}}/>}
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{name}</div>{pol&&<div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{pol.chamber} · {pol.state}</div>}</div>
              <div style={{textAlign:"right"}}><div style={{fontSize:20,fontWeight:900,color:"#ef4444"}}>{cnt}</div><div style={{fontSize:12,color:"rgba(255,255,255,.25)"}}>violation{cnt>1?"s":""}</div></div>
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
                <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginBottom:6}}>{cnt} disclosures</div>
                <div style={{height:4,borderRadius:2,background:"rgba(248,113,113,.3)",overflow:"hidden"}}><div style={{height:"100%",width:(buys/cnt*100)+"%",background:"#4ade80"}}/></div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"rgba(255,255,255,.3)",marginTop:4}}><span>🟢{buys}</span><span>🔴{sells}</span></div>
              </div>
            ))}
          </div>
        </div>}
        {tab==="pipeline"&&<div style={{...ds}}>
          <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:4}}>Data Pipeline Status</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.3)",marginBottom:20}}>Automated data ingestion agents running via GitHub Actions</div>
          {[
            {name:"Trade Monitor",desc:"Congressional stock trades from QuiverQuant + FMP",schedule:"Daily at noon UTC",file:"congress-trades.json",color:"#4ade80"},
            {name:"FEC Ingestion",desc:"Campaign finance candidate totals from OpenFEC",schedule:"Wednesdays at 7am UTC",file:"fec-candidates.json",color:"#14b8a6"},
            {name:"GovTrack Sync",desc:"Member contact info and recent votes",schedule:"Tuesdays at 8am UTC",file:"govtrack-members.json",color:"#6366f1"},
            {name:"Voting Records",desc:"Per-member roll call votes from Voteview (UCLA)",schedule:"Thursdays at 9am UTC",file:"voting-records.json",color:"#f472b6"},
            {name:"FARA Monitor",desc:"Foreign agent registrations from OpenSanctions",schedule:"Mondays at 6am UTC",file:"fara-registrants.json",color:"#f97316"},
          ].map((agent,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 0",borderBottom:i<4?"1px solid rgba(255,255,255,.04)":"none"}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:agent.color,boxShadow:"0 0 8px "+agent.color}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0"}}>{agent.name}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.35)"}}>{agent.desc}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:12,fontWeight:600,color:agent.color}}>{agent.schedule}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.2)"}}>{agent.file}</div>
              </div>
            </div>
          ))}
        </div>}
        {tab==="users"&&<div style={{...ds}}>
          <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:20}}>Registered Users ({users.length})</div>
          {!users.length&&<div style={{color:"rgba(255,255,255,.3)",fontSize:13}}>No registered users yet.</div>}
          {users.map((u,i)=>(
            <div key={u.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:i<users.length-1?"1px solid rgba(255,255,255,.05)":"none"}}>
              <div style={{width:38,height:38,borderRadius:"50%",background:u.role==="admin"?"linear-gradient(135deg,#7c3aed,#a78bfa)":"rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:"#fff"}}>{(u.name||"U")[0].toUpperCase()}</div>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{u.name}</div><div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{u.email} · Watch: {(u.watchlist||[]).length} · Last: {timeAgo(u.lastLogin)}</div></div>
              <span style={{fontSize:12,fontWeight:700,background:u.role==="admin"?"rgba(168,85,247,.2)":"rgba(255,255,255,.06)",color:u.role==="admin"?"#a78bfa":"rgba(255,255,255,.4)",padding:"3px 10px",borderRadius:100,border:"1px solid "+(u.role==="admin"?"rgba(168,85,247,.3)":"rgba(255,255,255,.08)")}}>{u.role.toUpperCase()}</span>
            </div>
          ))}
        </div>}
        {tab==="apis"&&<div style={{display:"grid",gridTemplateColumns:m?"1fr":"repeat(3,1fr)",gap:12}}>
          {API_CHECKS.map(a=>{const ok=apiSts[a.id];const cacheKey="_m_"+a.id.replace(/[^a-z0-9]/gi,"")+"_v";const cached=gc("_m_"+({house:"house_v8",quiver:"quiver_v1",fec:"fec_test",congress:"rb_v4",lda:"lda_v9",treasury:"tr_v6",fedreg:"fr_v5",fara:"fara_v3",usaspending:"usa_ag_v1"}[a.id]||a.id));const lastFetch=cached&&cached.ts?timeAgo(cached.ts):null;return(
            <div key={a.id} style={{background:ok?"rgba(34,197,94,.04)":"rgba(239,68,68,.04)",border:"1px solid "+(ok?"rgba(34,197,94,.2)":"rgba(239,68,68,.15)"),borderRadius:12,padding:18}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:ok?"#22c55e":"#ef4444",boxShadow:ok?"0 0 8px #22c55e":"none"}}/>
                <div style={{fontWeight:700,fontSize:12,color:"#fff"}}>{a.label}</div>
                <span style={{marginLeft:"auto",fontSize:12,fontWeight:700,color:ok?"#10b981":"#ef4444"}}>{ok?"ONLINE":"OFFLINE"}</span>
              </div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{ok?"✓ Responding normally":"✗ Unavailable or rate limited"}</div>
              {lastFetch&&<div style={{fontSize:12,color:"rgba(255,255,255,.2)",marginTop:6,borderTop:"1px solid rgba(255,255,255,.05)",paddingTop:6}}>Last fetched: {lastFetch}</div>}
            </div>
          );})}
        </div>}
        {tab==="regs"&&<div style={{...ds}}>
          <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:20}}>Federal Register — Latest Documents</div>
          {!regs.length&&<div style={{color:"rgba(255,255,255,.3)",fontSize:13}}>Loading Federal Register...</div>}
          {regs.map((r,i)=>{const agency=(r.agencies&&r.agencies[0]&&(r.agencies[0].name||r.agencies[0]))||"Federal Agency";const TC={"Rule":"#ef4444","Proposed Rule":"#f59e0b","Notice":"#0ea5e9"};const c=TC[r.type]||"#94a3b8";return(
            <div key={i} style={{padding:"11px 0",borderBottom:i<regs.length-1?"1px solid rgba(255,255,255,.05)":"none",display:"flex",gap:12,alignItems:"flex-start"}}>
              <span style={{fontSize:12,fontWeight:700,background:c+"18",color:c,padding:"2px 8px",borderRadius:4,flexShrink:0,marginTop:2}}>{(r.type||"DOC").slice(0,10)}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:"#e2e8f0",lineHeight:1.4}}>{(r.title||"").slice(0,100)}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.25)",marginTop:2}}>{agency} · {r.publication_date||"--"}</div>
              </div>
            </div>
          );})}
        </div>}
        {tab==="geographic"&&<div style={{...ds}}>
          <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:4}}>Trades by State</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:20}}>Geographic distribution of congressional stock trades</div>
          {(()=>{const byState={};(trades||[]).forEach(t=>{const st=t.state||"--";byState[st]=(byState[st]||0)+1;});const sorted=Object.entries(byState).sort((a,b)=>b[1]-a[1]).slice(0,25);const mx=sorted[0]?sorted[0][1]:1;return sorted.map(([st,cnt],i)=>(
            <div key={st} style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
              <div style={{width:30,fontSize:13,fontWeight:800,color:"#a78bfa",textAlign:"center"}}>{st}</div>
              <div style={{flex:1,height:22,borderRadius:5,background:"rgba(168,85,247,.06)",overflow:"hidden"}}>
                <div style={{height:"100%",width:((cnt/mx)*100)+"%",background:"linear-gradient(90deg,#7c3aed,#a78bfa)",borderRadius:5,transition:"width 1s"}}/>
              </div>
              <div style={{width:50,fontSize:12,fontWeight:700,color:"#c4b5fd",textAlign:"right"}}>{cnt}</div>
            </div>
          ));})()}
        </div>}
        {tab==="temporal"&&<div style={{...ds}}>
          <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:4}}>Trade Volume by Month</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:20}}>Temporal distribution of disclosed trades</div>
          {(()=>{const byMonth={};(trades||[]).forEach(t=>{const d=t.tradeDate||t.filedDate||"";if(d.length>=7){const mo=d.slice(0,7);byMonth[mo]=(byMonth[mo]||0)+1;}});const sorted=Object.entries(byMonth).sort((a,b)=>a[0].localeCompare(b[0])).slice(-18);const mx=Math.max(...sorted.map(x=>x[1]),1);return sorted.map(([mo,cnt],i)=>(
            <div key={mo} style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
              <div style={{width:70,fontSize:12,fontWeight:600,color:"rgba(255,255,255,.4)",textAlign:"right"}}>{mo}</div>
              <div style={{flex:1,height:20,borderRadius:5,background:"rgba(59,130,246,.06)",overflow:"hidden"}}>
                <div style={{height:"100%",width:((cnt/mx)*100)+"%",background:"linear-gradient(90deg,#3b82f6,#60a5fa)",borderRadius:5,transition:"width 1s"}}/>
              </div>
              <div style={{width:40,fontSize:12,fontWeight:700,color:"#60a5fa",textAlign:"right"}}>{cnt}</div>
            </div>
          ));})()}
        </div>}
        {tab==="fara"&&<div style={{...ds}}>
          <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:4}}>FARA — Foreign Agent Registrants</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:20}}>Foreign Agents Registration Act database</div>
          {!fara&&<div style={{color:"rgba(255,255,255,.3)",fontSize:13}}>Loading FARA data...</div>}
          {fara&&<>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
              {[["Total Registrants",fara.total||((fara.results||[]).length),"#f97316"],["Active",(fara.results||[]).length,"#10b981"],["Countries",[...new Set((fara.results||[]).map(r=>r.country||r.registrant_country||"Unknown"))].length,"#a78bfa"]].map(([l,v,c])=>(
                <div key={l} style={{background:c+"0a",border:"1px solid "+c+"22",borderRadius:12,padding:"14px 16px",textAlign:"center"}}>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.25)",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{l}</div>
                  <div style={{fontSize:22,fontWeight:900,color:c}}>{v}</div>
                </div>
              ))}
            </div>
            {(fara.results||[]).slice(0,15).map((r,i)=>{const name=r.registrant_name||r.name||"Unknown";const country=r.country||r.registrant_country||"N/A";return(
              <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:i<14?"1px solid rgba(255,255,255,.05)":"none"}}>
                <div style={{width:32,height:32,borderRadius:8,background:"rgba(249,115,22,.1)",border:"1px solid rgba(249,115,22,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>🌐</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{country}</div>
                </div>
              </div>
            );})}
          </>}
        </div>}
        {tab==="spending"&&<div style={{...ds}}>
          <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:4}}>Federal Agency Spending</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:20}}>USASpending.gov — Top agencies by budget authority</div>
          {!agencies.length&&<div style={{color:"rgba(255,255,255,.3)",fontSize:13}}>Loading spending data...</div>}
          {agencies.length>0&&<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
              {[["Total Tracked","$"+(agencies.slice(0,15).reduce((s,a)=>s+(a.budget_authority_amount||0),0)/1e9).toFixed(1)+"B","#10b981"],["Agencies",agencies.length,"#a78bfa"]].map(([l,v,c])=>(
                <div key={l} style={{background:c+"0a",border:"1px solid "+c+"22",borderRadius:12,padding:"14px 16px",textAlign:"center"}}>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.25)",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{l}</div>
                  <div style={{fontSize:22,fontWeight:900,color:c}}>{v}</div>
                </div>
              ))}
            </div>
            {(()=>{const top15=agencies.slice(0,15);const maxB=Math.max(...top15.map(a=>a.budget_authority_amount||0),1);return top15.map((a,i)=>{const name=a.agency_name||a.name||"Agency";const amt=a.budget_authority_amount||0;const pct=(amt/maxB)*100;return(
              <div key={i} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontSize:12,fontWeight:700,color:"#e2e8f0",maxWidth:"60%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>
                  <span style={{fontSize:12,fontWeight:800,color:"#10b981"}}>${(amt/1e9).toFixed(1)}B</span>
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
          <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:20}}>Cross-referencing trades for high-risk patterns</div>
          {(()=>{const flagged=(trades||[]).filter(t=>t.gap>45||/1,000,000|5,000,001/.test(t.amount||"")).map(t=>{const late=t.gap>45;const highVal=/1,000,000|5,000,001/.test(t.amount||"");const severity=late&&highVal?"CRITICAL":late?"HIGH":"MODERATE";const sevColor=severity==="CRITICAL"?"#ef4444":severity==="HIGH"?"#f59e0b":"#a855f7";const pol=pols.find(p=>p.name.toLowerCase().includes((t.name||"").toLowerCase().split(/\s+/).pop())&&(t.name||"").toLowerCase().split(/\s+/).pop().length>3);return{...t,_pol:pol,late,highVal,severity,sevColor};});return(<>
            <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginBottom:16}}>{flagged.length} flagged trade{flagged.length!==1?"s":""}</div>
            {flagged.slice(0,20).map((t,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 0",borderBottom:i<Math.min(flagged.length,20)-1?"1px solid rgba(255,255,255,.05)":"none"}}>
                <span style={{fontSize:12,fontWeight:800,background:t.sevColor+"18",color:t.sevColor,padding:"3px 8px",borderRadius:5,flexShrink:0}}>{t.severity}</span>
                {t._pol?<Avatar pol={t._pol} size={30}/>:<div style={{width:30,height:30,borderRadius:"50%",background:"rgba(255,255,255,.04)",flexShrink:0}}/>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#fff"}}>{t.name||"Unknown"}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{t.ticker||"N/A"} {t.action} · {t.amount} · {t.tradeDate||"--"}</div>
                </div>
                <div style={{display:"flex",gap:4,flexShrink:0}}>
                  {t.late&&<span style={{fontSize:12,fontWeight:700,background:"rgba(239,68,68,.1)",color:"#ef4444",padding:"2px 6px",borderRadius:4,border:"1px solid rgba(239,68,68,.2)"}}>{t.gap}d LATE</span>}
                  {t.highVal&&<span style={{fontSize:12,fontWeight:700,background:"rgba(168,85,247,.1)",color:"#a855f7",padding:"2px 6px",borderRadius:4,border:"1px solid rgba(168,85,247,.2)"}}>HIGH VALUE</span>}
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
  const scoreMap=useMemo(()=>{const m={};pols.forEach(p=>{m[p.id]=computeAccountabilityScore(p,trades).total;});return m;},[pols,trades]);
  const toggleWatch=async(polId,e)=>{e.stopPropagation();if(!user)return;const wl=user.watchlist.includes(polId)?user.watchlist.filter(x=>x!==polId):[...user.watchlist,polId];const updated=await updateUser(user.id,{watchlist:wl});if(onSetUser)onSetUser(updated);};
  const filtered=useMemo(()=>{let f=pols;if(filters.search)f=f.filter(p=>p.name.toLowerCase().includes(filters.search.toLowerCase())||(p.state||"").toUpperCase()===filters.search.toUpperCase());if(filters.chamber!=="All")f=f.filter(p=>p.chamber===filters.chamber);if(filters.party!=="All")f=f.filter(p=>p.party===filters.party);if(filters.state)f=f.filter(p=>p.state===filters.state);if(filters.fecOnly)f=f.filter(p=>p.hasRealFinancials);if(filters.hasViolations)f=f.filter(p=>(tradeMap[p.id]&&tradeMap[p.id].violations>0));if(filters.sort==="raised")f=[...f].sort((a,b)=>b.raised-a.raised);else if(filters.sort==="cash")f=[...f].sort((a,b)=>b.cash-a.cash);else if(filters.sort==="trades")f=[...f].sort((a,b)=>((tradeMap[b.id]||{}).count||0)-((tradeMap[a.id]||{}).count||0));else if(filters.sort==="violations")f=[...f].sort((a,b)=>((tradeMap[b.id]||{}).violations||0)-((tradeMap[a.id]||{}).violations||0));else if(filters.sort==="risk")f=[...f].sort((a,b)=>{const aT=(trades||[]).filter(t=>(t.name||"").toLowerCase().includes(a.name.toLowerCase().split(/\s+/).pop()));const bT=(trades||[]).filter(t=>(t.name||"").toLowerCase().includes(b.name.toLowerCase().split(/\s+/).pop()));return calcRisk(bT,b.raised)-calcRisk(aT,a.raised);});else f=[...f].sort((a,b)=>a.name.localeCompare(b.name));return f;},[pols,filters,tradeMap]);
  const shown=filtered.slice((pg-1)*PER,pg*PER);const totalPgs=Math.ceil(filtered.length/PER);
  const upd=(k,v)=>{setF(f=>({...f,[k]:v}));setPg(1);};
  const ss={padding:"9px 13px",borderRadius:9,border:"1px solid rgba(168,85,247,.2)",background:"rgba(168,85,247,.06)",color:"#fff",fontSize:12,cursor:"pointer",outline:"none"};
  return(
    <div style={{background:"#09090b",minHeight:"100vh",paddingBottom:60}}>
      <div style={{background:"linear-gradient(135deg,#18181b,#27272a)",borderBottom:"1px solid rgba(168,85,247,.12)",padding:"28px 0 24px"}}>
        <CW>
          <div style={{display:"flex",alignItems:"baseline",gap:14,flexWrap:"wrap",marginBottom:20}}>
            <h1 style={{fontSize:m?24:32,fontWeight:900,color:"#fff",margin:0,letterSpacing:-1}}>Browse Officials</h1>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:12,color:"rgba(255,255,255,.25)",fontWeight:500}}>{filtered.length} of {pols.length}</span>
              {(pols.length>=500?pols.filter(p=>p.hasRealFinancials).length:537)>0&&<span style={{fontSize:12,background:"rgba(16,185,129,.1)",color:"#34d399",padding:"3px 8px",borderRadius:100,fontWeight:700}}>{(pols.length>=500?pols.filter(p=>p.hasRealFinancials).length:537)}/{pols.length>=500?pols.length:538} FEC</span>}
            </div>
          </div>
          <p style={{fontSize:13,color:"rgba(255,255,255,.3)",margin:"0 0 16px"}}>Search and filter every member of Congress. See their campaign finances, stock trades, and voting record.</p>
          {(()=>{const totalRaised=pols.reduce((s,p)=>s+p.raised,0);const avgPer=pols.length>0?totalRaised/pols.length:0;const highRisk=pols.reduce((best,p)=>{const pT=(trades||[]).filter(t=>(t.name||"").toLowerCase().includes(p.name.toLowerCase().split(/\s+/).pop()));const r=calcRisk(pT,p.raised);return r>(best.r||0)?{name:p.name,r}:best;},{name:"--",r:0});const mostTrades=Object.entries(tradeMap).sort((a,b)=>(b[1].count||0)-(a[1].count||0))[0];const mtPol=mostTrades?pols.find(p=>p.id===mostTrades[0]):null;return(
            <div style={{display:"grid",gridTemplateColumns:m?"1fr 1fr":"repeat(3,1fr)",gap:10,marginBottom:18}}>
              {[["Total Raised",pols.some(p=>p.raised>0)?fmt(totalRaised):"Loading...","#10b981"],["Avg / Member",pols.some(p=>p.raised>0)?fmt(avgPer):"Loading...","#3b82f6"],["Highest Risk",highRisk.name.split(" ").pop()+" ("+highRisk.r+")","#ef4444"],["Most Trades",(mtPol?mtPol.name.split(" ").pop():"--")+" ("+(mostTrades?mostTrades[1].count:0)+")","#a78bfa"],["PAC Funded",pols.some(p=>p.pacContrib>0)?fmt(pols.filter(p=>p.pacContrib>0).reduce((a,p)=>a+p.pacContrib,0)):"Loading...","#f59e0b"],["Total Debt",pols.some(p=>p.debts>0)?fmt(pols.reduce((a,p)=>a+p.debts,0)):"Loading...","#f97316"],["Women",pols.filter(p=>p.gender==="Female").length||"—","#fb7185"],["Avg Tenure",pols.filter(p=>p.yearsInOffice>0).length>0?Math.round(pols.filter(p=>p.yearsInOffice>0).reduce((a,p)=>a+p.yearsInOffice,0)/pols.filter(p=>p.yearsInOffice>0).length)+"yr":"—","#a78bfa"],["Avg Yea%",pols.filter(p=>p.yeaPct>0).length>0?Math.round(pols.filter(p=>p.yeaPct>0).reduce((a,p)=>a+p.yeaPct,0)/pols.filter(p=>p.yeaPct>0).length)+"%":"—","#6366f1"]].map(([l,v,c])=>(
                <div key={l} style={{background:c+"0a",border:"1px solid "+c+"22",borderRadius:10,padding:"10px 14px"}}>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.25)",textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>{l}</div>
                  <div style={{fontSize:12,fontWeight:800,color:c,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</div>
                </div>
              ))}
            </div>
          );})()}
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <input value={filters.search} onChange={e=>upd("search",e.target.value)} placeholder="Search by name or state..." style={{flex:1,minWidth:180,...ss}}/>
            <select value={filters.chamber} onChange={e=>upd("chamber",e.target.value)} style={ss}><option value="All">All Chambers</option><option value="Senate">Senate</option><option value="House">House</option></select>
            <select value={filters.party} onChange={e=>upd("party",e.target.value)} style={ss}><option value="All">All Parties</option><option value="D">Democrat</option><option value="R">Republican</option><option value="I">Independent</option></select>
            <select value={filters.state} onChange={e=>upd("state",e.target.value)} style={ss}><option value="">All States</option>{STATES_ALL.map(s=><option key={s} value={s}>{s}</option>)}</select>
            <select value={filters.sort} onChange={e=>upd("sort",e.target.value)} style={ss}><option value="raised">Sort: Raised</option><option value="cash">Sort: Cash</option><option value="trades">Sort: Trades</option><option value="violations">Sort: Violations</option><option value="risk">Sort: Risk</option><option value="az">Sort: A–Z</option></select>
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
              {user&&<button onClick={e=>toggleWatch(p.id,e)} style={{position:"absolute",top:14,right:14,fontSize:12,fontWeight:700,background:isW?"rgba(16,185,129,.12)":"rgba(255,255,255,.06)",color:isW?"#34d399":"rgba(255,255,255,.35)",border:"1px solid "+(isW?"rgba(16,185,129,.3)":"rgba(255,255,255,.08)"),borderRadius:100,padding:"4px 10px",cursor:"pointer",zIndex:2,transition:"all .15s"}}>{isW?"✓ Watching":"+"}</button>}
              <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:14}}>
                <Avatar pol={p} size={44}/>
                <div style={{flex:1,minWidth:0,paddingRight:user?60:0}}>
                  <div style={{fontWeight:800,fontSize:14,color:"#fff",marginBottom:5,lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                  <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{fontSize:12,fontWeight:700,padding:"2px 8px",borderRadius:4,background:PC[p.party]+"15",color:PC[p.party],border:"1px solid "+PC[p.party]+"22"}}>{PL[p.party]}</span>
                    <span style={{fontSize:12,color:"rgba(255,255,255,.3)",fontWeight:600}}>{p.chamber} · {p.state}</span>
                  </div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.25)",marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.raised>10e6?`Top fundraiser \u00b7 ${fmt(p.raised)}`:p.raised>1e6?`${fmt(p.raised)} raised this cycle`:(td.count||0)>5?`${td.count} stock trades disclosed`:`${p.chamber} \u00b7 ${p.state}`}</div>
                </div>
              </div>
              {(()=>{const pTrades=(trades||[]).filter(t=>(t.name||"").toLowerCase().includes(p.name.toLowerCase().split(/\s+/).pop())&&p.name.toLowerCase().split(/\s+/).pop().length>3);const risk=calcRisk(pTrades,p.raised);return(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:12}}>
                <div style={{background:"rgba(255,255,255,.03)",borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:12,color:"rgba(255,255,255,.2)",textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>Raised</div><div style={{fontSize:12,fontWeight:700,color:p.raised>0?"#10b981":"rgba(255,255,255,.12)"}}>{p.raised>0?fmt(p.raised):<span style={{fontSize:12,color:"rgba(255,255,255,.15)",fontStyle:"italic"}}>No FEC</span>}</div></div>
                <div style={{background:"rgba(255,255,255,.03)",borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:12,color:"rgba(255,255,255,.2)",textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>Cash</div><div style={{fontSize:12,fontWeight:700,color:p.cash>0?"#3b82f6":"rgba(255,255,255,.12)"}}>{p.cash>0?fmt(p.cash):<span style={{fontSize:12,color:"rgba(255,255,255,.15)",fontStyle:"italic"}}>No FEC</span>}</div></div>
                <div style={{background:td.violations>0?"rgba(239,68,68,.06)":"rgba(255,255,255,.03)",borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:12,color:"rgba(255,255,255,.2)",textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>Trades</div><div style={{fontSize:12,fontWeight:700,color:td.count>0?"#a78bfa":"rgba(255,255,255,.12)"}}>{td.count>0?td.count:<span style={{fontSize:12,color:"rgba(255,255,255,.15)",fontStyle:"italic"}}>--</span>}{td.violations>0&&<span style={{color:"#ef4444",marginLeft:4,fontSize:10}}>⚠ {td.violations}</span>}</div></div>
                <div style={{background:risk>60?"rgba(239,68,68,.06)":risk>30?"rgba(245,158,11,.06)":"rgba(255,255,255,.03)",borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:12,color:"rgba(255,255,255,.2)",textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>Risk</div><div style={{fontSize:12,fontWeight:700,color:riskColor(risk)}}>{risk}/100</div></div>
                {p.ideology!=null&&<div style={{background:"rgba(255,255,255,.03)",borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:12,color:"rgba(255,255,255,.2)",textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>Ideology</div><div style={{fontSize:12,fontWeight:700,color:p.ideology<-0.3?"#3b82f6":p.ideology>0.3?"#ef4444":"#94a3b8"}}>{p.ideology<-0.3?"Liberal":p.ideology>0.3?"Conservative":"Moderate"}</div></div>}
              </div>);})()}
              <div style={{paddingTop:10,borderTop:"1px solid rgba(255,255,255,.04)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,color:"#a78bfa",fontWeight:700}}>View profile →</span>
                <div style={{display:"flex",gap:5,alignItems:"center"}}>
                  {scoreMap[p.id]!=null&&<span style={{fontSize:12,fontWeight:700,background:scoreMap[p.id]>60?"rgba(74,222,128,.1)":"rgba(251,191,36,.1)",color:scoreMap[p.id]>60?"#4ade80":"#fbbf24",padding:"2px 8px",borderRadius:6,border:"1px solid "+(scoreMap[p.id]>60?"rgba(74,222,128,.2)":"rgba(251,191,36,.2)")}} title="Accountability Score">{scoreMap[p.id]}/100</span>}
                  {p.hasRealFinancials&&<span style={{fontSize:12,background:"rgba(16,185,129,.08)",color:"#10b981",padding:"2px 6px",borderRadius:4,fontWeight:700,border:"1px solid rgba(16,185,129,.15)"}}>FEC</span>}
                  {td.violations>0&&<span style={{fontSize:12,background:"rgba(239,68,68,.1)",color:"#f87171",padding:"2px 6px",borderRadius:4,fontWeight:800,border:"1px solid rgba(239,68,68,.2)"}}>VIOLATION</span>}
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
function Nav({page,onNav,user,onLogout,pols,violations,onSelect}){
  const m=mob();const[open,setOpen]=useState(false);const[searchQ,setSearchQ]=useState("");
  return(
    <div style={{background:"rgba(2,6,23,.97)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(168,85,247,.12)",padding:"11px 0",position:"sticky",top:32,zIndex:200,width:"100%"}}>
      <CW>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div onClick={()=>onNav("home")} style={{cursor:"pointer",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <div style={{width:30,height:30,borderRadius:9,background:"linear-gradient(135deg,#7c3aed,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:"#fff"}}>O</div>
            <div><div style={{fontSize:15,fontWeight:900,color:"#fff",letterSpacing:-.3}}>Officium</div>{!m&&<div style={{fontSize:12,color:"rgba(99,102,241,.6)",letterSpacing:.5,textTransform:"uppercase"}}>Track Your Representatives</div>}</div>
          </div>
          {!m&&<div style={{position:"relative",flex:1,maxWidth:280,margin:"0 16px"}}>
            <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search officials, tickers..." style={{width:"100%",padding:"8px 14px 8px 34px",borderRadius:10,border:"1px solid rgba(99,102,241,.15)",background:"rgba(99,102,241,.05)",color:"#fff",fontSize:13,outline:"none"}} onFocus={e=>e.target.style.borderColor="rgba(99,102,241,.4)"} onBlur={e=>{setTimeout(()=>{setSearchQ("");e.target.style.borderColor="rgba(99,102,241,.15)";},200);}}/>
            <svg style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",opacity:.3,pointerEvents:"none"}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            {searchQ.length>1&&<div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"#18181b",borderRadius:12,boxShadow:"0 12px 40px rgba(0,0,0,.6)",zIndex:100,overflow:"hidden",border:"1px solid rgba(99,102,241,.2)",maxHeight:300,overflowY:"auto"}}>
              {pols.filter(p=>p.name.toLowerCase().includes(searchQ.toLowerCase())||(p.state||"").toLowerCase()===searchQ.toLowerCase()).slice(0,6).map(p=>(
                <div key={p.id} onClick={()=>{setSearchQ("");onSelect(p);}} onMouseEnter={e=>e.currentTarget.style.background="rgba(99,102,241,.1)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid rgba(99,102,241,.06)"}}>
                  <Avatar pol={p} size={26}/>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"#fff"}}>{p.name}</div><div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{p.chamber} · {p.state}</div></div>
                </div>
              ))}
              {pols.filter(p=>p.name.toLowerCase().includes(searchQ.toLowerCase())).length===0&&<div style={{padding:"12px 14px",fontSize:13,color:"rgba(255,255,255,.3)"}}>No results</div>}
            </div>}
          </div>}
          <div style={{flex:1}}/>
          {!m&&<div style={{display:"flex",gap:2,alignItems:"center"}}>
            {[["home","Home"],["browse","Officials"],["trades","Trades"],["violations","Violations"],["explorer","Explorer"],["about","About"],["api","API"],["pricing","Pricing"],user&&["dashboard","Dashboard"],user&&user.role==="admin"&&["admin","Admin"]].filter(Boolean).map(([p,l])=>(
              <button key={p} onClick={()=>onNav(p)} style={{padding:"6px 12px",borderRadius:8,border:"none",background:page===p?"rgba(168,85,247,.15)":"transparent",color:page===p?"#a78bfa":"rgba(255,255,255,.35)",fontWeight:600,fontSize:12,cursor:"pointer"}}>{l}</button>
            ))}
            {violations>0&&<span style={{fontSize:12,background:"rgba(239,68,68,.1)",color:"#fca5a5",border:"1px solid rgba(239,68,68,.25)",padding:"3px 9px",borderRadius:100,fontWeight:700,animation:"pulseDot 2s infinite",marginLeft:4}}>🚨 {violations}</span>}
            {user?<div style={{display:"flex",alignItems:"center",gap:8,marginLeft:6}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff"}}>{(user.name||"U")[0].toUpperCase()}</div>
              <button onClick={onLogout} style={{padding:"5px 10px",borderRadius:8,border:"1px solid rgba(255,255,255,.08)",background:"transparent",color:"rgba(255,255,255,.3)",fontSize:12,cursor:"pointer",fontWeight:600}}>Sign out</button>
            </div>:<button onClick={()=>onNav("auth")} style={{padding:"7px 14px",borderRadius:8,border:"1px solid rgba(168,85,247,.3)",background:"rgba(168,85,247,.1)",color:"#a78bfa",fontWeight:700,fontSize:12,cursor:"pointer"}}>Sign In</button>}
          </div>}
          {m&&<button onClick={()=>setOpen(!open)} style={{background:"none",border:"1px solid rgba(168,85,247,.2)",borderRadius:8,color:"#a78bfa",padding:"6px 10px",fontSize:12,cursor:"pointer"}}>{open?"✕":"☰"}</button>}
        </div>
        {m&&open&&<div style={{marginTop:12,paddingTop:12,borderTop:"1px solid rgba(168,85,247,.1)",display:"flex",flexDirection:"column",gap:3}}>
          {[["home","Home"],["browse","Officials"],["trades","Trades"],["violations","Violations"],["explorer","Explorer"],["about","About"],["api","API"],["pricing","Pricing"],user&&["dashboard","Dashboard"],user&&user.role==="admin"&&["admin","Admin"]].filter(Boolean).map(([p,l])=>(
            <button key={p} onClick={()=>{onNav(p);setOpen(false);}} style={{padding:"10px 12px",borderRadius:8,border:"none",background:page===p?"rgba(168,85,247,.12)":"transparent",color:page===p?"#a78bfa":"rgba(255,255,255,.4)",fontWeight:600,fontSize:13,cursor:"pointer",textAlign:"left"}}>{l}</button>
          ))}
          {user?<button onClick={()=>{onLogout();setOpen(false);}} style={{padding:"10px 12px",borderRadius:8,border:"none",background:"transparent",color:"rgba(255,255,255,.3)",fontSize:13,cursor:"pointer",textAlign:"left"}}>Sign out</button>:<button onClick={()=>{onNav("auth");setOpen(false);}} style={{padding:"10px 12px",borderRadius:8,border:"1px solid rgba(168,85,247,.2)",background:"rgba(168,85,247,.08)",color:"#a78bfa",fontSize:13,cursor:"pointer",textAlign:"left",fontWeight:700}}>Sign In / Create Account</button>}
        </div>}
      </CW>
    </div>
  );
}

/* ── TOP STATES BY FUNDRAISING ────────── */
function TopStates({pols}){
  const byState=useMemo(()=>{
    const m={};(pols||[]).filter(p=>p.raised>0).forEach(p=>{m[p.state]=(m[p.state]||0)+p.raised;});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,12);
  },[pols]);
  const topPolByState=useMemo(()=>{const m={};byState.forEach(([st])=>{const topPol=(pols||[]).filter(p=>p.state===st&&p.raised>0).sort((a,b)=>b.raised-a.raised)[0];if(topPol)m[st]=topPol.name.split(' ').pop();});return m;},[pols,byState]);
  if(!byState.length)return null;
  const max=byState[0][1];
  return(
    <div style={{background:"#09090b",padding:"60px 0"}}>
      <CW>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:12,fontWeight:700,color:"rgba(245,158,11,.6)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>FEC Data by State</div>
          <h2 style={{fontSize:mob()?22:30,fontWeight:900,color:"#fff",margin:0,letterSpacing:-1}}>Top States by Fundraising</h2>
          <LastUpdated/>
        </div>
        <div style={{maxWidth:700,margin:"0 auto",display:"flex",flexDirection:"column",gap:8}}>
          {byState.map(([st,amt],i)=>(
            <div key={st} style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:90,display:"flex",alignItems:"baseline",gap:5}}><span style={{fontSize:13,fontWeight:800,color:"#f59e0b"}}>{st}</span>{topPolByState[st]&&<span style={{fontSize:12,color:"rgba(255,255,255,.25)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{topPolByState[st]}</span>}</div>
              <div style={{flex:1,height:28,borderRadius:6,background:"rgba(245,158,11,.06)",overflow:"hidden"}}>
                <div style={{height:"100%",width:((amt/max)*100)+"%",background:"linear-gradient(90deg,#f59e0b,#fbbf24)",borderRadius:6,transition:"width 1.5s"}}/>
              </div>
              <div style={{width:70,fontSize:12,fontWeight:700,color:"#fbbf24",textAlign:"right"}}>{fmt(amt)}</div>
            </div>
          ))}
        </div>
      </CW>
    </div>
  );
}

/* ── FOREIGN INFLUENCE MAP ───────────── */
const COUNTRY_NAMES={jp:"Japan",ca:"Canada",gb:"United Kingdom",de:"Germany",mx:"Mexico",fr:"France",kr:"South Korea",cn:"China",il:"Israel",ru:"Russia",us:"United States",au:"Australia",in:"India",br:"Brazil",ch:"Switzerland",nl:"Netherlands",se:"Sweden",no:"Norway",dk:"Denmark",sg:"Singapore",ae:"UAE",sa:"Saudi Arabia",tw:"Taiwan",hk:"Hong Kong",za:"South Africa",ng:"Nigeria",ua:"Ukraine",ph:"Philippines",hu:"Hungary",dz:"Algeria",ao:"Angola",uz:"Uzbekistan",ie:"Ireland",it:"Italy",es:"Spain",at:"Austria",be:"Belgium",fi:"Finland",pl:"Poland",cz:"Czech Republic",pt:"Portugal",gr:"Greece",ro:"Romania",bg:"Bulgaria",hr:"Croatia",th:"Thailand",my:"Malaysia",id:"Indonesia",pk:"Pakistan",tr:"Turkey",eg:"Egypt",ke:"Kenya",gh:"Ghana",et:"Ethiopia",co:"Colombia",ar:"Argentina",cl:"Chile",pe:"Peru",ve:"Venezuela",ec:"Ecuador",pa:"Panama",jm:"Jamaica",tt:"Trinidad and Tobago"};
function ForeignInfluenceMap(){
  const[data,setData]=useState(null);const[principals,setPrincipals]=useState([]);
  useEffect(()=>{FARA_P.then(setData).catch(()=>{});FARA_PRINCIPALS.then(setPrincipals).catch(()=>{});},[]);
  const byCountry=useMemo(()=>{
    const src=(data&&data.results)||[];
    const m={};src.forEach(r=>{const c=r.country||r.registrant_country||"Unknown";if(c==="Unknown")return;m[c]=(m[c]||0)+1;});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,15);
  },[data]);
  if(!data||!byCountry.length)return null;
  const max=byCountry[0][1];
  return(
    <div style={{background:"linear-gradient(180deg,#09090b,#1a0a20)",padding:"60px 0"}}>
      <CW>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:12,fontWeight:700,color:"rgba(249,115,22,.6)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>FARA Foreign Principals</div>
          <h2 style={{fontSize:mob()?22:30,fontWeight:900,color:"#fff",margin:0,letterSpacing:-1}}>Foreign Influence by Country</h2>
          {principals.length>0&&<div style={{fontSize:12,color:"rgba(255,255,255,.25)",marginTop:8}}>{principals.length} foreign principals tracked</div>}
        </div>
        <div style={{maxWidth:700,margin:"0 auto",display:"flex",flexDirection:"column",gap:8}}>
          {byCountry.map(([country,cnt],i)=>{const displayName=COUNTRY_NAMES[country]||COUNTRY_NAMES[country.toLowerCase()]||country.toUpperCase();return(
            <div key={country} style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:120,fontSize:12,fontWeight:700,color:"#fb923c",textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{displayName}</div>
              <div style={{flex:1,height:26,borderRadius:6,background:"rgba(249,115,22,.06)",overflow:"hidden"}}>
                <div style={{height:"100%",width:((cnt/max)*100)+"%",background:"linear-gradient(90deg,#f97316,#fb923c)",borderRadius:6,transition:"width 1.5s"}}/>
              </div>
              <div style={{width:50,fontSize:12,fontWeight:700,color:"#fdba74",textAlign:"right"}}>{cnt}</div>
            </div>
          );})}
        </div>
      </CW>
    </div>
  );
}

/* ── BIG TRADES HIGHLIGHT ────────────── */
function BigTrades({trades,pols}){
  const big=useMemo(()=>(trades||[]).filter(t=>/1,000,000|5,000,001|50,000,001/.test(t.amount||"")&&t.ticker&&t.ticker!=="N/A"&&findPolForTrade(t,pols||[])).slice(0,12),[trades,pols]);
  if(!big.length)return null;
  return(
    <div style={{background:"linear-gradient(180deg,#1a0520,#09090b)",padding:"60px 0"}}>
      <CW>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:12,fontWeight:700,color:"rgba(168,85,247,.6)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>High-Value Disclosures</div>
          <h2 style={{fontSize:mob()?22:30,fontWeight:900,color:"#fff",margin:0,letterSpacing:-1}}>Big Trades</h2>
          <DataFreshness trades={trades}/>
          <div style={{fontSize:12,color:"rgba(255,255,255,.25)",marginTop:8}}>{big.length} trade{big.length!==1?"s":""} over $1M detected</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:mob()?"1fr":"repeat(auto-fill,minmax(300px,1fr))",gap:14,maxWidth:900,margin:"0 auto"}}>
          {big.map((t,i)=>{const f=flagTrade(t);return(
            <div key={i} style={{background:"rgba(168,85,247,.06)",border:"1px solid rgba(168,85,247,.15)",borderRadius:14,padding:18,position:"relative",overflow:"hidden",animation:"fadeUp .4s ease "+i*.05+"s both"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#a855f7,#7c3aed)"}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  {(()=>{const pol=findPolForTrade(t,pols||[]);return pol?<Avatar pol={pol} size={32}/>:null;})()}
                  <div>
                    <div style={{fontSize:14,fontWeight:800,color:"#fff"}}>{t.name||"Unknown"}</div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginTop:2}}>{t.source} · {t.state||"--"}</div>
                  </div>
                </div>
                <span style={{fontSize:12,fontWeight:800,background:"rgba(168,85,247,.15)",color:"#c4b5fd",padding:"3px 10px",borderRadius:5,border:"1px solid rgba(168,85,247,.3)"}}>{t.action}</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                <div style={{background:"rgba(255,255,255,.04)",borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:12,color:"rgba(255,255,255,.2)",textTransform:"uppercase"}}>Ticker</div><div style={{fontSize:12,fontWeight:700,color:"#a78bfa"}}>{t.ticker||"N/A"}</div>{!t.ticker&&t.description&&<div style={{fontSize:9,color:"rgba(255,255,255,.25)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.description.slice(0,40)}</div>}</div>
                <div style={{background:"rgba(255,255,255,.04)",borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:12,color:"rgba(255,255,255,.2)",textTransform:"uppercase"}}>Amount</div><div style={{fontSize:12,fontWeight:700,color:"#fbbf24"}}>{t.amount}</div></div>
                <div style={{background:"rgba(255,255,255,.04)",borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:12,color:"rgba(255,255,255,.2)",textTransform:"uppercase"}}>Gap</div><div style={{fontSize:12,fontWeight:700,color:gapC(t.gap)}}>{t.gap}d</div></div>
              </div>
              {f&&<div style={{marginTop:8,fontSize:12,fontWeight:700,color:f.color}}>{f.badge}: {f.txt}</div>}
            </div>
          );})}
        </div>
      </CW>
    </div>
  );
}

/* ── LOBBYING HOT ISSUES ─────────────── */
function LobbyingHotIssues(){
  const[data,setData]=useState(null);
  useEffect(()=>{LDA_P.then(setData).catch(()=>{});},[]);
  const tags=useMemo(()=>{
    if(!data||!data.filings)return[];
    const m={};
    data.filings.forEach(f=>{
      (f.lobbying_activities||[]).forEach(a=>{
        const code=a.general_issue_code_display||a.issue_code||a.general_issue_code;
        if(code){m[code]=(m[code]||0)+1;}
      });
    });
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,20);
  },[data]);
  if(!tags.length)return null;
  const max=tags[0][1];const min=tags[tags.length-1][1];
  const sz=(cnt)=>12+Math.round(((cnt-min)/(max-min||1))*18);
  return(
    <div style={{background:"linear-gradient(180deg,#09090b,#0d1425)",padding:"60px 0"}}>
      <CW>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:12,fontWeight:700,color:"rgba(99,102,241,.6)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>LDA Lobbying Data</div>
          <h2 style={{fontSize:mob()?22:30,fontWeight:900,color:"#fff",margin:0,letterSpacing:-1}}>Lobbying Hot Issues</h2>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:10,justifyContent:"center",maxWidth:800,margin:"0 auto"}}>
          {tags.map(([code,cnt])=>(
            <span key={code} onClick={()=>{window.__ldaSearch&&window.__ldaSearch(code);const ldaEl=document.querySelector('[data-section="lda"]');ldaEl&&ldaEl.scrollIntoView({behavior:'smooth'});}} style={{fontSize:sz(cnt),fontWeight:700,color:"rgba(165,180,252,"+(0.5+((cnt-min)/(max-min||1))*0.5)+")",background:"rgba(99,102,241,"+(0.04+((cnt-min)/(max-min||1))*0.1)+")",border:"1px solid rgba(99,102,241,"+(0.1+((cnt-min)/(max-min||1))*0.2)+")",padding:"6px 14px",borderRadius:8,whiteSpace:"nowrap",transition:"all .2s",cursor:"pointer"}} onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.08)";e.currentTarget.style.boxShadow="0 4px 16px rgba(99,102,241,.3)";}} onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>{code} <span style={{fontSize:12,opacity:.6}}>({cnt})</span></span>
          ))}
        </div>
      </CW>
    </div>
  );
}


/* ── ABOUT THE DATA ──────────────────── */
function AboutTheData(){
  const[open,setOpen]=useState(false);
  const sources=[
    {name:"FEC",desc:"Campaign finance data from the Federal Election Commission",live:true},
    {name:"Congress.gov",desc:"Member data, bills, and voting records",live:true},
    {name:"Senate Stock Watcher",desc:"STOCK Act trade disclosures by Senators",live:true},
    {name:"LDA",desc:"Lobbying disclosure filings from lda.senate.gov",live:true},
    {name:"FARA",desc:"Foreign agent registrations via OpenSanctions",live:true},
    {name:"USASpending",desc:"Federal agency budgets and spending",live:true},
    {name:"Treasury",desc:"National debt data from Treasury Department",live:true},
    {name:"Federal Register",desc:"Latest regulatory documents and rules",live:true},
  ];
  return(
    <div style={{marginBottom:28}}>
      <button onClick={()=>setOpen(!open)} style={{background:"rgba(168,85,247,.06)",border:"1px solid rgba(168,85,247,.15)",borderRadius:10,padding:"10px 18px",cursor:"pointer",color:"#a78bfa",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:8,width:"100%",justifyContent:"center",transition:"all .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(168,85,247,.35)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(168,85,247,.15)";}}>
        <span>{open?"\u25B4":"\u25BE"} About the Data Sources</span>
      </button>
      {open&&(
        <div style={{marginTop:12,background:"rgba(168,85,247,.04)",border:"1px solid rgba(168,85,247,.12)",borderRadius:14,padding:20,animation:"fadeUp .3s ease"}}>
          <div style={{display:"grid",gridTemplateColumns:mob()?"1fr":"1fr 1fr",gap:10}}>
            {sources.map(src=>(
              <div key={src.name} style={{display:"flex",gap:10,alignItems:"center",padding:"8px 10px",background:"rgba(255,255,255,.02)",borderRadius:8}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:src.live?"#22c55e":"#ef4444",flexShrink:0}}/>
                <span style={{fontSize:12,fontWeight:800,color:"#a78bfa",background:"rgba(168,85,247,.12)",padding:"3px 8px",borderRadius:4,whiteSpace:"nowrap",flexShrink:0}}>{src.name}</span>
                <span style={{fontSize:12,color:"rgba(255,255,255,.35)",lineHeight:1.5}}>{src.desc}</span>
              </div>
            ))}
          </div>
          <div style={{textAlign:"center",marginTop:12,fontSize:12,color:"rgba(255,255,255,.15)"}}>All data sourced from publicly available U.S. government APIs</div>
        </div>
      )}
    </div>
  );
}

/* ── RECENT VOTES ────────────────────── */
function RecentVotes(){
  const[votes,setVotes]=useState([]);
  useEffect(()=>{GOVTRACK_VOTES.then(setVotes).catch(()=>{});},[]);
  const m=mob();
  if(!votes.length)return <div style={{display:"flex",alignItems:"center",gap:12,padding:"24px 0",color:"rgba(255,255,255,.3)"}}><Spin sz={16}/>Loading votes...</div>;
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <div style={{fontSize:12,fontWeight:700,color:"rgba(20,184,166,.6)",textTransform:"uppercase",letterSpacing:1.5}}>GovTrack.us {"\u00B7"} 119th Congress</div>
        <span style={{fontSize:12,background:"rgba(20,184,166,.1)",color:"#14b8a6",border:"1px solid rgba(20,184,166,.25)",padding:"3px 12px",borderRadius:100,fontWeight:700}}>{votes.length} recent votes</span>
      </div>
      <h2 style={{fontSize:m?22:28,fontWeight:900,color:"#fff",margin:"0 0 8px",letterSpacing:-1}}>Congressional Votes</h2>
      <p style={{fontSize:13,color:"rgba(255,255,255,.35)",margin:"0 0 20px"}}>How your representatives voted on recent bills and resolutions.</p>
      {votes.length>0&&<div style={{display:"grid",gridTemplateColumns:m?"1fr":"repeat(4,1fr)",gap:12,marginBottom:24}}>
        <div style={{background:"rgba(20,184,166,.06)",borderRadius:12,padding:16,textAlign:"center"}}><div style={{fontSize:24,fontWeight:900,color:"#14b8a6"}}>{votes.filter(v=>v.result==="Passed"||v.result?.includes("Agreed")).length}</div><div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>Passed</div></div>
        <div style={{background:"rgba(239,68,68,.06)",borderRadius:12,padding:16,textAlign:"center"}}><div style={{fontSize:24,fontWeight:900,color:"#ef4444"}}>{votes.filter(v=>v.result?.includes("Rejected")||v.result?.includes("Failed")).length}</div><div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>Rejected</div></div>
        <div style={{background:"rgba(245,158,11,.06)",borderRadius:12,padding:16,textAlign:"center"}}><div style={{fontSize:24,fontWeight:900,color:"#f59e0b"}}>{votes.length>0?Math.round(votes.reduce((a,v)=>a+(v.margin||0),0)/votes.length):0}</div><div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>Avg Margin</div></div>
        <div style={{background:"rgba(99,102,241,.06)",borderRadius:12,padding:16,textAlign:"center"}}><div style={{fontSize:24,fontWeight:900,color:"#6366f1"}}>{votes.filter(v=>Math.abs((v.total_plus||0)-(v.total_minus||0))<20).length}</div><div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>Close Votes (&lt;20)</div></div>
      </div>}
      {(()=>{
        const divisive=[...votes].filter(v=>v.total_plus&&v.total_minus).sort((a,b)=>Math.abs(a.total_plus-a.total_minus)-Math.abs(b.total_plus-b.total_minus)).slice(0,3);
        if(!divisive.length)return null;
        return <div style={{marginBottom:24}}>
          <div style={{fontSize:14,fontWeight:700,color:"#f59e0b",marginBottom:12}}>Most Divisive Votes</div>
          {divisive.map((v,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
              <div style={{fontSize:14,fontWeight:800,color:"#f59e0b",minWidth:24}}>{i+1}</div>
              <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:"#e2e8f0"}}>{(v.related_bill__title_without_number||v.question||"").slice(0,80)}</div></div>
              <div style={{textAlign:"right"}}><span style={{color:"#4ade80",fontWeight:700}}>{v.total_plus}</span><span style={{color:"rgba(255,255,255,.3)"}}> - </span><span style={{color:"#f87171",fontWeight:700}}>{v.total_minus}</span></div>
            </div>
          ))}
        </div>;
      })()}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {votes.map((v,i)=>(
          <div key={i} style={{background:"rgba(20,184,166,.04)",border:"1px solid rgba(20,184,166,.1)",borderRadius:14,padding:18,transition:"border-color .2s"}} onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(20,184,166,.3)"} onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(20,184,166,.1)"}>
            <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:8}}>
              <span style={{fontSize:12,fontWeight:700,background:v.chamber==="house"?"rgba(59,130,246,.1)":"rgba(239,68,68,.1)",color:v.chamber==="house"?"#3b82f6":"#ef4444",padding:"3px 10px",borderRadius:6,border:"1px solid "+(v.chamber==="house"?"rgba(59,130,246,.2)":"rgba(239,68,68,.2)")}}>{v.chamber_label}</span>
              {v.related_bill__display_number&&<span style={{fontSize:12,fontWeight:600,color:"#a5b4fc"}}>{v.related_bill__display_number}</span>}
              <span style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{(v.created||"").slice(0,10)}</span>
              <span style={{marginLeft:"auto",fontSize:13,fontWeight:800,color:v.result==="Passed"||v.result?.includes("Agreed")?"#4ade80":"#f87171"}}>{v.result}</span>
            </div>
            <div style={{fontSize:14,fontWeight:600,color:"#e2e8f0",lineHeight:1.5,marginBottom:8}}>{(v.related_bill__title_without_number||v.question||"").slice(0,150)}</div>
            <div style={{display:"flex",gap:16,fontSize:13}}>
              <span style={{color:"#4ade80",fontWeight:700}}>{"\u2713"} {v.total_plus} Yes</span>
              <span style={{color:"#f87171",fontWeight:700}}>{"\u2717"} {v.total_minus} No</span>
              {v.total_other>0&&<span style={{color:"rgba(255,255,255,.3)"}}>{"○"} {v.total_other} Other</span>}
              <span style={{color:"rgba(255,255,255,.2)",marginLeft:"auto"}}>{v.category_label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── DATA EXPLORER (tabbed) ────────────── */
function DataExplorer(){
  const[tab,setTab]=useState("fara");const m=mob();
  return(
    <div style={{background:"#09090b",padding:"60px 0"}}>
      <CW>
        <div style={{textAlign:"center",marginBottom:24}}>
          <h2 style={{fontSize:m?22:30,fontWeight:900,color:"#fff",margin:"0 0 8px",letterSpacing:-1}}>Government Data Explorer</h2>
          <p style={{fontSize:14,color:"rgba(255,255,255,.35)"}}>Deep-dive into foreign influence, lobbying, federal spending, and legislation.</p>
        </div>
        <div style={{display:"flex",gap:4,justifyContent:"center",flexWrap:"wrap",marginBottom:28}}>
          {[["fara","Foreign Agents"],["lda","Lobbying"],["spending","Spending"],["bills","Legislation"],["votes","Votes"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{padding:"10px 20px",borderRadius:100,border:"1px solid "+(tab===id?"rgba(99,102,241,.5)":"rgba(255,255,255,.08)"),background:tab===id?"rgba(99,102,241,.15)":"transparent",color:tab===id?"#a5b4fc":"rgba(255,255,255,.4)",fontWeight:700,fontSize:13,cursor:"pointer",transition:"all .15s"}}>{label}</button>
          ))}
        </div>
        {tab==="fara"&&<><FARASection/><ForeignInfluenceMap/></>}
        {tab==="lda"&&<><LDASection/><LobbyingHotIssues/></>}
        {tab==="spending"&&<SpendingSection/>}
        {tab==="bills"&&<BillsSection/>}
        {tab==="votes"&&<RecentVotes/>}
      </CW>
    </div>
  );
}

/* ── HOME TABS ─────────────────────────── */
function HomeTabs({trades,pols,onSelect}){
  const[tab,setTab]=useState("feed");const m=mob();
  const[htParty,setHTParty]=useState("All");const[htChamber,setHTChamber]=useState("All");
  const filteredTrades=useMemo(()=>{
    let t=(trades||[]).filter(tr=>findPolForTrade(tr,pols||[]));
    if(htParty!=="All"){const partyPols=(pols||[]).filter(p=>p.party===htParty).map(p=>p.name.toLowerCase().split(" ").pop());t=t.filter(tr=>partyPols.some(ln=>tr.name.toLowerCase().includes(ln)));}
    return t;
  },[trades,htParty,pols]);
  const filteredPols=useMemo(()=>{
    let p=pols||[];
    if(htParty!=="All")p=p.filter(x=>x.party===htParty);
    if(htChamber!=="All")p=p.filter(x=>x.chamber===htChamber);
    return p;
  },[pols,htParty,htChamber]);
  return(<>
    <div style={{background:"#09090b",padding:"20px 0 0",position:"sticky",top:80,zIndex:50}}>
      <CW>
        <div style={{display:"flex",gap:4,flexWrap:"wrap",paddingBottom:16,overflowX:"auto",borderBottom:"1px solid rgba(99,102,241,.1)"}}>
          {[["feed","Trade Feed"],["big","High-Value"],["leaders","Leaderboard"],["sectors","Sectors"],["money","Follow Money"],["states","States"],["timeline","Timeline"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{padding:"8px 16px",borderRadius:100,border:"1px solid "+(tab===id?"rgba(99,102,241,.5)":"rgba(255,255,255,.06)"),background:tab===id?"rgba(99,102,241,.15)":"transparent",color:tab===id?"#a5b4fc":"rgba(255,255,255,.35)",fontWeight:600,fontSize:13,cursor:"pointer",whiteSpace:"nowrap",transition:"all .15s"}}>{label}</button>
          ))}
        </div>
        {(tab==="feed"||tab==="leaders"||tab==="money")&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16,paddingTop:12}}>
          <select value={htParty} onChange={e=>setHTParty(e.target.value)} style={{padding:"8px 14px",borderRadius:10,border:"1px solid rgba(99,102,241,.15)",background:"rgba(99,102,241,.05)",color:"#fff",fontSize:13}}>
            <option value="All">All Parties</option><option value="D">Democrat</option><option value="R">Republican</option><option value="I">Independent</option>
          </select>
          <select value={htChamber} onChange={e=>setHTChamber(e.target.value)} style={{padding:"8px 14px",borderRadius:10,border:"1px solid rgba(99,102,241,.15)",background:"rgba(99,102,241,.05)",color:"#fff",fontSize:13}}>
            <option value="All">All Chambers</option><option value="Senate">Senate</option><option value="House">House</option>
          </select>
        </div>}
      </CW>
    </div>
    {tab==="feed"&&<IntelFeed trades={filteredTrades} pols={filteredPols}/>}
    {tab==="big"&&<BigTrades trades={filteredTrades} pols={filteredPols}/>}
    {tab==="leaders"&&<ViolationBoard trades={filteredTrades} pols={filteredPols} onSelect={onSelect}/>}
    {tab==="sectors"&&<SectorHeatmap trades={trades}/>}
    {tab==="money"&&<FollowMoney pols={filteredPols} trades={filteredTrades} onSelect={p=>{window.__goSel&&window.__goSel(p);}}/>}
    {tab==="states"&&<TopStates pols={pols}/>}
    {tab==="timeline"&&<TradingTimeline trades={trades}/>}
  </>);
}

/* ── HOME PAGE ──────────────────────────── */
function HomePage({pols,trades,onBrowse,onSelect,onLogin,user}){
  const[q,setQ]=useState("");const m=mob();
  const res=q.length>1?pols.filter(p=>p.name.toLowerCase().includes(q.toLowerCase())||(p.state||"").toUpperCase()===q.toUpperCase()).slice(0,7):[];
  return(
    <div style={{width:"100%"}}>
      {/* HERO — centered, deep purple */}
      <div style={{position:"relative",minHeight:"100svh",background:"linear-gradient(135deg,#18181b 0%,#09090b 40%,#0c4a6e 70%,#09090b 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
        {/* Orbs — vibrant gradient blobs */}
        <div style={{position:"absolute",width:900,height:900,borderRadius:"50%",background:"radial-gradient(circle,rgba(14,165,233,.15) 0%,rgba(79,70,229,.1) 40%,transparent 70%)",top:"-300px",left:"20%",animation:"orbA 32s ease-in-out infinite",pointerEvents:"none"}}/>
        <div style={{position:"absolute",width:700,height:700,borderRadius:"50%",background:"radial-gradient(circle,rgba(20,184,166,.12) 0%,rgba(139,92,246,.08) 40%,transparent 70%)",bottom:"-200px",right:"-50px",animation:"orbB 24s ease-in-out infinite",pointerEvents:"none"}}/>
        <div style={{position:"absolute",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(14,165,233,.15) 0%,transparent 65%)",top:"40%",left:"-120px",animation:"orbA 20s ease-in-out infinite",animationDelay:"-10s",pointerEvents:"none"}}/>
        <div style={{position:"absolute",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(6,182,212,.08) 0%,transparent 60%)",top:"10%",right:"5%",animation:"orbB 28s ease-in-out infinite",animationDelay:"-5s",pointerEvents:"none"}}/>
        <div style={{position:"absolute",inset:0,opacity:.45,pointerEvents:"none"}}><FloatingCards pols={pols} trades={trades} onSelect={onSelect}/></div>
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:.02,pointerEvents:"none"}}><defs><pattern id="grd" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="#6366f1" strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#grd)"/></svg>
        <div style={{position:"absolute",left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(99,102,241,.12),transparent)",animation:"scanline 12s linear infinite",pointerEvents:"none"}}/>
        {/* Vignette overlay for text readability */}
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 50%,rgba(2,6,23,.5) 0%,transparent 65%)",pointerEvents:"none",zIndex:1}}/>
        {/* Centered hero content */}
        <div style={{position:"relative",zIndex:2,textAlign:"center",padding:m?"80px 24px 40px":"100px 40px 60px",maxWidth:680,width:"100%"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:7,background:"rgba(168,85,247,.12)",border:"1px solid rgba(168,85,247,.3)",borderRadius:100,padding:"7px 20px",marginBottom:32,backdropFilter:"blur(12px)"}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 8px #22c55e",animation:"pulse 2s ease infinite"}}/>
            <span style={{fontSize:12,fontWeight:700,color:"#c4b5fd",letterSpacing:1.2,textTransform:"uppercase"}}><Tip text="All 538 members of the 119th Congress: 100 Senators + 435 Representatives + 3 Delegates">{pols.length>=500?pols.length:538} Members</Tip> · {(trades||[]).filter(t=>t.gap>45).length} Violations Detected · Live</span>
          </div>
          <HeroText/>
          <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:32,marginBottom:44,justifyContent:"center"}}>
            <button onClick={onBrowse} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 36px rgba(124,58,237,.5)";}} onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 6px 28px rgba(124,58,237,.35)";}} style={{background:"linear-gradient(135deg,#7c3aed,#a78bfa)",color:"#fff",border:"none",borderRadius:12,padding:m?"14px 28px":"16px 40px",fontSize:m?13:15,fontWeight:800,cursor:"pointer",boxShadow:"0 6px 28px rgba(124,58,237,.35)",whiteSpace:"nowrap",transition:"all .2s ease"}}>Browse {pols.length>=500?pols.length:538} Officials →</button>
            {!user?<button onClick={onLogin} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(168,85,247,.5)";e.currentTarget.style.background="rgba(168,85,247,.12)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(168,85,247,.25)";e.currentTarget.style.background="rgba(168,85,247,.06)";}} style={{background:"rgba(168,85,247,.06)",color:"rgba(255,255,255,.75)",border:"1.5px solid rgba(168,85,247,.25)",borderRadius:12,padding:m?"14px 28px":"16px 32px",fontSize:m?13:15,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",backdropFilter:"blur(8px)",transition:"all .2s ease"}}>Create Account</button>:<button onClick={()=>window.__goSel&&window.__goSel(pols[Math.floor(Math.random()*pols.length)])} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(168,85,247,.5)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(168,85,247,.25)";}} style={{background:"rgba(168,85,247,.06)",color:"rgba(255,255,255,.75)",border:"1.5px solid rgba(168,85,247,.25)",borderRadius:12,padding:m?"14px 28px":"16px 32px",fontSize:m?13:15,fontWeight:600,cursor:"pointer",backdropFilter:"blur(8px)",transition:"all .2s ease"}}>Random Official</button>}
          </div>
          {/* Search */}
          <div style={{position:"relative",maxWidth:520,margin:"0 auto"}}>
            <input value={q} onChange={e=>setQ(san(e.target.value))} placeholder={`Search ${pols.length>=500?pols.length:538} officials by name or state...`} maxLength={80}
              style={{width:"100%",padding:"16px 20px 16px 48px",borderRadius:14,border:"1.5px solid rgba(168,85,247,.2)",background:"rgba(10,5,25,.7)",backdropFilter:"blur(16px)",color:"#fff",fontSize:14,outline:"none",boxSizing:"border-box",transition:"border-color .2s,box-shadow .2s"}}
              onFocus={e=>{e.target.style.borderColor="rgba(168,85,247,.6)";e.target.style.boxShadow="0 0 0 3px rgba(168,85,247,.1)";}} onBlur={e=>{e.target.style.borderColor="rgba(168,85,247,.2)";e.target.style.boxShadow="none";}}/>
            <svg style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",opacity:.4,pointerEvents:"none"}} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            {res.length>0&&(
              <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"#18181b",borderRadius:13,boxShadow:"0 20px 60px rgba(0,0,0,.7)",zIndex:50,overflow:"hidden",border:"1px solid rgba(168,85,247,.25)"}}>
                {res.map(p=>(
                  <div key={p.id} onClick={()=>{setQ("");onSelect(p);}} onMouseEnter={e=>e.currentTarget.style.background="rgba(168,85,247,.08)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                    style={{display:"flex",alignItems:"center",gap:11,padding:"11px 18px",cursor:"pointer",borderBottom:"1px solid rgba(168,85,247,.06)"}}>
                    <Avatar pol={p} size={30}/>
                    <div style={{flex:1,textAlign:"left"}}><div style={{fontWeight:600,fontSize:13,color:"#fff"}}>{p.name}</div><div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{p.chamber} · {p.state}{p.raised>0?" · "+fmt(p.raised)+" raised":""}</div></div>
                    {p.hasRealFinancials&&<span style={{fontSize:12,background:"rgba(16,185,129,.1)",color:"#34d399",padding:"1px 5px",borderRadius:3,fontWeight:700}}>FEC</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{display:"flex",gap:24,justifyContent:"center",marginTop:20,flexWrap:"wrap"}}>
            {[
              [fmt(pols.filter(p=>p.raised>0).reduce((a,p)=>a+p.raised,0)),"Total Raised","#10b981"],
              [(trades||[]).length,"Senate Trades","#a78bfa"],
              [(pols.length>=500?pols.filter(p=>p.hasRealFinancials).length:537)+"/538","FEC Matched","#f59e0b"],
              ["9","Data Sources","#6366f1"]
            ].map(([v,l,c],i)=>(
              <div key={i} style={{textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:900,color:c}}>{v}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:16,flexWrap:"wrap"}}>
            {pols.filter(p=>p.photo&&p.raised>50e6).sort((a,b)=>b.raised-a.raised).slice(0,6).map(p=>(
              <div key={p.id} onClick={()=>onSelect(p)} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(99,102,241,.1)",border:"1px solid rgba(99,102,241,.2)",borderRadius:100,padding:"6px 14px 6px 6px",cursor:"pointer",transition:"all .15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(99,102,241,.5)"} onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(99,102,241,.2)"}>
                <img src={p.photo} alt={p.name} style={{width:28,height:28,borderRadius:"50%",objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>
                <span style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{p.name.split(" ").pop()}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{position:"absolute",bottom:20,left:"50%",transform:"translateX(-50%)",display:"flex",flexDirection:"column",alignItems:"center",gap:5,zIndex:2}}>
          <span style={{fontSize:12,color:"rgba(255,255,255,.12)",fontWeight:600,textTransform:"uppercase",letterSpacing:1.5}}>Scroll to explore</span>
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
            <span key={i} style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,.9)",padding:"0 40px",whiteSpace:"nowrap"}}>
              {i%5===0?"🚨 VIOLATION":i%5===1?"🏛 SENATE":i%5===2?"💰 FEC":i%5===3?"📋 LOBBYING":"🏠 HOUSE"} · {p.name} · {p.state}{p.raised>0?" · "+fmt(p.raised):""}
            </span>
          ))}
        </div>
      </div>
      <HomeTabs trades={trades} pols={pols} onSelect={onSelect}/>
      <DataInsights pols={pols} trades={trades}/>
      <DataExplorer/>
      {/* Footer */}
      <div style={{background:"linear-gradient(180deg,#07030f,#18181b)",borderTop:"1px solid rgba(168,85,247,.08)",padding:"48px 0 36px"}}>
        <CW>
          <AboutTheData/>
          <div style={{display:"flex",flexDirection:m?"column":"row",gap:m?24:48,alignItems:m?"center":"flex-start",marginBottom:28}}>
            <div style={{textAlign:m?"center":"left"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,justifyContent:m?"center":"flex-start"}}>
                <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#7c3aed,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:"#fff"}}>O</div>
                <span style={{fontSize:16,fontWeight:900,color:"#fff",letterSpacing:-.3}}>Officium</span>
              </div>
              <p style={{fontSize:12,color:"rgba(255,255,255,.2)",margin:0,lineHeight:1.6,maxWidth:280}}>Latin for duty. Tracking congressional finances, trades, and lobbying with full transparency.</p>
            </div>
            <div style={{flex:1}}/>
            <div style={{textAlign:m?"center":"right"}}>
              <div style={{fontSize:12,color:"rgba(255,255,255,.15)",textTransform:"uppercase",letterSpacing:1,marginBottom:8,fontWeight:600}}>Data Sources</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:m?"center":"flex-end"}}>
                {["FEC","Congress.gov","QuiverQuant","GovTrack","LDA","FARA","USASpending","Treasury","FedRegister"].map(s=>(
                  <span key={s} style={{fontSize:12,color:"rgba(255,255,255,.15)",background:"rgba(255,255,255,.03)",padding:"3px 8px",borderRadius:4,fontWeight:500}}>{s}</span>
                ))}
              </div>
            </div>
          </div>
          <div style={{maxWidth:400,margin:"0 auto 20px",textAlign:"center"}}>
            <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0",marginBottom:8}}>Stay Informed</div>
            <div style={{display:"flex",gap:8}}>
              <input placeholder="your@email.com" style={{flex:1,padding:"10px 14px",borderRadius:10,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.04)",color:"#fff",fontSize:13,outline:"none"}}/>
              <button style={{padding:"10px 18px",borderRadius:10,background:"linear-gradient(135deg,#0891b2,#14b8a6)",color:"#fff",fontSize:13,fontWeight:700,border:"none",cursor:"pointer",whiteSpace:"nowrap"}}>Subscribe</button>
            </div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.15)",marginTop:6}}>Weekly digest of top trades and violations. No spam.</div>
          </div>
          <div style={{borderTop:"1px solid rgba(255,255,255,.04)",paddingTop:16,display:"flex",justifyContent:"center"}}>
            <span style={{fontSize:12,color:"rgba(255,255,255,.1)"}}>{pols.length>=500?pols.length:538} officials tracked · All data from public government APIs</span>
          </div>
        </CW>
      </div>
    </div>
  );
}

/* ── TRADES PAGE ────────────────────────── */
function TradesPage({trades,pols,onSelect}){
  const[q,setQ]=useState("");const[sortBy,setSortBy]=useState("date");const[filterAction,setFA]=useState("All");const[selTrade,setSelTrade]=useState(null);const m=mob();
  const[votes,setVotes]=useState([]);
  useEffect(()=>{GOVTRACK_VOTES.then(setVotes).catch(()=>{});},[]);
  const filtered=useMemo(()=>{
    let f=(trades||[]).filter(t=>findPolForTrade(t,pols||[]));
    if(q)f=f.filter(t=>(t.name||"").toLowerCase().includes(q.toLowerCase())||(t.ticker||"").toLowerCase().includes(q.toLowerCase()));
    if(filterAction!=="All")f=f.filter(t=>t.action===filterAction);
    if(sortBy==="date")f=[...f].sort((a,b)=>(b.tradeDate||"").localeCompare(a.tradeDate||""));
    else if(sortBy==="name")f=[...f].sort((a,b)=>(a.name||"").localeCompare(b.name||""));
    else if(sortBy==="ticker")f=[...f].sort((a,b)=>(a.ticker||"").localeCompare(b.ticker||""));
    return f;
  },[trades,q,sortBy,filterAction]);
  return(
    <div style={{background:"#09090b",minHeight:"100vh",paddingBottom:60}}>
      <div style={{background:"linear-gradient(135deg,#18181b,#27272a)",borderBottom:"1px solid rgba(99,102,241,.12)",padding:"28px 0 24px"}}>
        <CW>
          <h1 style={{fontSize:m?24:32,fontWeight:900,color:"#fff",margin:"0 0 8px",letterSpacing:-1}}>Trade Feed</h1>
          <DataFreshness trades={trades}/>
          <p style={{fontSize:14,color:"rgba(255,255,255,.35)",margin:"0 0 20px"}}>Every stock trade disclosed by members of Congress under the STOCK Act.</p>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name or ticker..." style={{flex:1,minWidth:200,padding:"12px 16px",borderRadius:12,border:"1px solid rgba(99,102,241,.2)",background:"rgba(99,102,241,.06)",color:"#fff",fontSize:14,outline:"none"}}/>
            <select value={filterAction} onChange={e=>setFA(e.target.value)} style={{padding:"12px 16px",borderRadius:12,border:"1px solid rgba(99,102,241,.2)",background:"rgba(99,102,241,.06)",color:"#fff",fontSize:14,cursor:"pointer"}}><option value="All">All Actions</option><option value="BUY">Buys Only</option><option value="SELL">Sells Only</option></select>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{padding:"12px 16px",borderRadius:12,border:"1px solid rgba(99,102,241,.2)",background:"rgba(99,102,241,.06)",color:"#fff",fontSize:14,cursor:"pointer"}}><option value="date">Sort: Date</option><option value="name">Sort: Name</option><option value="ticker">Sort: Ticker</option></select>
            <button onClick={()=>{const rows=[["Ticker","Official","Action","Amount","Date","Owner","Asset Type","Gap"]];filtered.forEach(t=>rows.push([t.ticker,t.name,t.action,t.amount,t.tradeDate,t.owner||"",t.assetType||"",t.gap]));const csv=rows.map(r=>r.join(",")).join("\n");const blob=new Blob([csv],{type:"text/csv"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="officium-trades-"+new Date().toISOString().slice(0,10)+".csv";a.click();URL.revokeObjectURL(url);}} style={{padding:"12px 16px",borderRadius:12,border:"1px solid rgba(99,102,241,.2)",background:"rgba(99,102,241,.06)",color:"#a5b4fc",fontSize:14,cursor:"pointer",fontWeight:600}}>Export CSV</button>
          </div>
        </CW>
      </div>
      <CW pad="20px 28px">
        <div style={{fontSize:13,color:"rgba(255,255,255,.3)",marginBottom:16}}>{filtered.length} trades found</div>
        <div style={{borderRadius:16,overflow:"hidden",border:"1px solid rgba(99,102,241,.1)"}}>
          <div style={{display:"grid",gridTemplateColumns:m?"1fr":"60px 1fr 80px 80px 140px 100px",padding:"12px 16px",background:"rgba(99,102,241,.08)",gap:12}}>
            {!m&&<><span style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.4)"}}>Ticker</span><span style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.4)"}}>Official</span><span style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.4)"}}>Action</span><span style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.4)"}}>Gap</span><span style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.4)"}}>Amount</span><span style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.4)"}}>Date</span></>}
          </div>
          {filtered.slice(0,100).map((t,i)=>{const pol=pols.find(p=>p.name.toLowerCase().includes((t.name||"").toLowerCase().split(/\s+/).pop())&&(t.name||"").toLowerCase().split(/\s+/).pop().length>=3);const proximity=computeVoteProximity(t,votes);return(
            <div key={i} onClick={()=>setSelTrade({trade:t,pol})} style={{display:"grid",gridTemplateColumns:m?"1fr":"60px 1fr 80px 80px 140px 100px",padding:"12px 16px",gap:12,borderBottom:"1px solid rgba(255,255,255,.04)",cursor:"pointer",background:i%2===0?"transparent":"rgba(255,255,255,.02)"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(99,102,241,.06)"} onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"transparent":"rgba(255,255,255,.02)"}>
              <span style={{fontSize:14,fontWeight:800,color:"#fff"}}>{t.ticker||"N/A"}</span>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>{pol&&<Avatar pol={pol} size={24}/>}<span style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{t.name}</span>{proximity&&<span style={{fontSize:12,fontWeight:700,background:"rgba(245,158,11,.1)",color:"#fbbf24",padding:"3px 8px",borderRadius:6,border:"1px solid rgba(245,158,11,.2)"}}>&#9888; {proximity.count} vote{proximity.count>1?"s":""} within 30d</span>}</div>
              <span style={{fontSize:12,fontWeight:700,color:t.action==="BUY"?"#4ade80":"#f87171",background:t.action==="BUY"?"rgba(74,222,128,.1)":"rgba(248,113,113,.1)",padding:"2px 8px",borderRadius:6,textAlign:"center"}}>{t.action}</span>
              <span style={{fontSize:12,fontWeight:700,color:gapC(t.gap)}}>{t.gap>0?t.gap+"d":"---"}</span>
              <span style={{fontSize:12,color:"rgba(255,255,255,.5)"}}>{t.amount}</span>
              <span style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>{t.tradeDate}</span>
            </div>
          );})}
        </div>
        <Disclaimer/>
        {selTrade&&<TradeModal trade={selTrade.trade} pol={selTrade.pol} onClose={()=>setSelTrade(null)}/>}
      </CW>
    </div>
  );
}

/* ── VIOLATIONS PAGE ───────────────────── */
function ViolationsPage({trades,pols,onSelect}){
  const active=useMemo(()=>(trades||[]).filter(t=>findPolForTrade(t,pols||[])),[trades,pols]);
  const violations=useMemo(()=>active.filter(t=>t.gap>45).sort((a,b)=>b.gap-a.gap),[active]);
  const late=useMemo(()=>active.filter(t=>t.gap>30&&t.gap<=45).sort((a,b)=>b.gap-a.gap),[active]);
  const highValue=useMemo(()=>active.filter(t=>/500,000|1,000,000|5,000,001/.test(t.amount||"")),[active]);
  const m=mob();
  return(
    <div style={{background:"#09090b",minHeight:"100vh",paddingBottom:60}}>
      <div style={{background:"linear-gradient(135deg,#18181b,#27272a)",borderBottom:"1px solid rgba(239,68,68,.12)",padding:"28px 0 24px"}}>
        <CW>
          <h1 style={{fontSize:m?24:32,fontWeight:900,color:"#fff",margin:"0 0 8px",letterSpacing:-1}}>Violations & Flags</h1>
          <p style={{fontSize:14,color:"rgba(255,255,255,.35)",margin:"0 0 20px"}}>STOCK Act requires disclosure within 45 days. These trades were filed late or flagged for high value.</p>
          <div style={{display:"grid",gridTemplateColumns:m?"1fr":"repeat(3,1fr)",gap:12}}>
            <div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:12,padding:"16px 20px"}}><div style={{fontSize:12,color:"rgba(239,68,68,.6)",textTransform:"uppercase",marginBottom:4}}>STOCK Act Violations (&gt;45 days)</div><div style={{fontSize:28,fontWeight:900,color:"#ef4444"}}>{violations.length}</div></div>
            <div style={{background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.2)",borderRadius:12,padding:"16px 20px"}}><div style={{fontSize:12,color:"rgba(245,158,11,.6)",textTransform:"uppercase",marginBottom:4}}>Late Filings (30-45 days)</div><div style={{fontSize:28,fontWeight:900,color:"#f59e0b"}}>{late.length}</div></div>
            <div style={{background:"rgba(168,85,247,.08)",border:"1px solid rgba(168,85,247,.2)",borderRadius:12,padding:"16px 20px"}}><div style={{fontSize:12,color:"rgba(168,85,247,.6)",textTransform:"uppercase",marginBottom:4}}>High-Value Trades (&gt;$500K)</div><div style={{fontSize:28,fontWeight:900,color:"#a855f7"}}>{highValue.length}</div></div>
          </div>
          <div style={{background:"rgba(239,68,68,.04)",border:"1px solid rgba(239,68,68,.1)",borderRadius:12,padding:18,marginBottom:20,marginTop:20}}>
            <div style={{fontSize:14,fontWeight:700,color:"#fca5a5",marginBottom:8}}>What is a STOCK Act violation?</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.7}}>The <strong style={{color:"#e2e8f0"}}>STOCK Act of 2012</strong> requires all members of Congress to publicly disclose any stock trade within <strong style={{color:"#fbbf24"}}>45 calendar days</strong> of the transaction. When a member files their disclosure more than 45 days after the trade, it is flagged as a violation. Trades filed 30-45 days after are flagged as "late" (approaching the deadline). High-value trades over $500,000 receive additional scrutiny regardless of filing timeliness.</div>
          </div>
          <button onClick={()=>{const all=[...violations,...late,...highValue];const seen=new Set();const unique=all.filter(t=>{const k=t.name+"_"+t.ticker+"_"+t.tradeDate;if(seen.has(k))return false;seen.add(k);return true;});const rows=[["Official","Ticker","Action","Amount","Date","Gap (days)","Flag"]];unique.forEach(t=>rows.push([t.name,t.ticker||"N/A",t.action,t.amount,t.tradeDate,t.gap,t.gap>45?"VIOLATION":t.gap>30?"LATE":"HIGH VALUE"]));const csv=rows.map(r=>r.join(",")).join("\n");const blob=new Blob([csv],{type:"text/csv"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="officium-violations-"+new Date().toISOString().slice(0,10)+".csv";a.click();URL.revokeObjectURL(url);}} style={{marginTop:16,padding:"12px 16px",borderRadius:12,border:"1px solid rgba(239,68,68,.2)",background:"rgba(239,68,68,.06)",color:"#fca5a5",fontSize:14,cursor:"pointer",fontWeight:600}}>Export CSV</button>
        </CW>
      </div>
      <CW pad="20px 28px">
        {violations.length===0&&late.length===0&&highValue.length===0&&<div style={{textAlign:"center",padding:"60px 20px"}}><div style={{fontSize:36,marginBottom:12,opacity:.3}}>✓</div><div style={{fontSize:16,fontWeight:600,color:"rgba(255,255,255,.4)"}}>No violations detected in current dataset</div><div style={{fontSize:13,color:"rgba(255,255,255,.2)",marginTop:8}}>Senate trade data covers 2019-2020. Disclosure dates are not available for this period, so gap-based violations cannot be computed.</div></div>}
        {highValue.length>0&&<div style={{marginBottom:24}}>
          <div style={{fontSize:15,fontWeight:700,color:"#a855f7",marginBottom:14}}>High-Value Trades ({highValue.length})</div>
          {highValue.slice(0,20).map((t,i)=>{const pol=pols.find(p=>p.name.toLowerCase().includes((t.name||"").toLowerCase().split(/\s+/).pop())&&(t.name||"").toLowerCase().split(/\s+/).pop().length>=3);return(
            <div key={i} onClick={()=>pol&&onSelect(pol)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,.04)",cursor:pol?"pointer":"default"}}>
              {pol?<Avatar pol={pol} size={32}/>:<div style={{width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,.05)",flexShrink:0}}/>}
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:600,color:"#fff"}}>{t.name}</div><div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{t.ticker||"N/A"} · {t.action} · {t.tradeDate}</div></div>
              <div style={{fontSize:14,fontWeight:800,color:"#a855f7"}}>{t.amount}</div>
            </div>
          );})}
        </div>}
      </CW>
    </div>
  );
}

/* ── API DOCS PAGE ─────────────────────── */
function ApiDocsPage(){
  const m=mob();
  const endpoints=[
    {path:"/data/congress-trades.json",desc:"5,040 congressional stock trades (2018-2026) from Senate and House",fields:"name, bioguideId, ticker, action, amount, tradeDate, filedDate, chamber, party, excessReturn, gap, source",refresh:"Daily",size:"~1.5MB"},
    {path:"/data/fec-candidates.json",desc:"3,327 FEC candidate records with campaign finance totals",fields:"receipts, disbursements, cash_on_hand, individual_contributions, PAC_contributions, debts, candidate_id, name, state, party, cycles",refresh:"Weekly",size:"~11MB"},
    {path:"/data/govtrack-members.json",desc:"539 current Congress members with contact info",fields:"bioguideId, name, party, state, phone, website, office, contactForm, twitter, birthday, gender, leadership",refresh:"Weekly",size:"~300KB"},
    {path:"/data/govtrack-votes.json",desc:"100 recent congressional votes from GovTrack",fields:"number, question, result, created, chamber, total_plus, total_minus, category_label",refresh:"Weekly",size:"~50KB"},
    {path:"/data/voting-records.json",desc:"244,446 per-member voting records with ideology scores",fields:"bioguideId, totalVotes, yeaCount, nayCount, absentCount, yeaPct, nominate_dim1 (ideology), per-vote: rollNumber, vote, date, billNumber, result",refresh:"Weekly",size:"~10MB"},
    {path:"/data/fara-registrants.json",desc:"15,106 FARA foreign agent registrants",fields:"name, country, address, status, registrationNumber",refresh:"Weekly",size:"~2.7MB"},
    {path:"/data/fara-principals.json",desc:"22,147 FARA foreign principals",fields:"name, country, topics",refresh:"Weekly",size:"~4.2MB"},
  ];
  return(
    <div style={{background:"#09090b",minHeight:"100vh",paddingBottom:60}}>
      <div style={{background:"linear-gradient(135deg,#18181b,#27272a)",borderBottom:"1px solid rgba(6,182,212,.12)",padding:"40px 0"}}>
        <CW>
          <h1 style={{fontSize:m?28:36,fontWeight:900,color:"#fff",margin:"0 0 12px",letterSpacing:-1}}>Public Data API</h1>
          <p style={{fontSize:16,color:"rgba(255,255,255,.5)",lineHeight:1.7,maxWidth:700}}>All Officium data is available as static JSON endpoints. No API key required. Free for non-commercial use.</p>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(6,182,212,.1)",border:"1px solid rgba(6,182,212,.25)",borderRadius:100,padding:"8px 18px",marginTop:16}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"#14b8a6"}}/>
            <span style={{fontSize:13,fontWeight:600,color:"#14b8a6"}}>All endpoints live · Updated by GitHub Actions</span>
          </div>
        </CW>
      </div>
      <CW pad="32px 28px">
        <div style={{maxWidth:900}}>
          <div style={{fontSize:14,color:"rgba(255,255,255,.4)",marginBottom:28,lineHeight:1.7}}>
            <strong style={{color:"#e2e8f0"}}>Base URL:</strong> <code style={{background:"rgba(255,255,255,.06)",padding:"2px 8px",borderRadius:4,color:"#67e8f9"}}>https://officium.vote</code> (or your Netlify deployment URL)<br/>
            <strong style={{color:"#e2e8f0"}}>Format:</strong> JSON<br/>
            <strong style={{color:"#e2e8f0"}}>Authentication:</strong> None required<br/>
            <strong style={{color:"#e2e8f0"}}>Rate limit:</strong> None (static files served by CDN)<br/>
            <strong style={{color:"#e2e8f0"}}>License:</strong> Free for non-commercial use. Attribution required.
          </div>
          {endpoints.map((ep,i)=>(
            <div key={i} style={{background:"rgba(6,182,212,.03)",border:"1px solid rgba(6,182,212,.1)",borderRadius:14,padding:22,marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:10}}>
                <code style={{fontSize:15,fontWeight:700,color:"#67e8f9",background:"rgba(6,182,212,.1)",padding:"4px 12px",borderRadius:6}}>GET {ep.path}</code>
                <span style={{fontSize:12,background:"rgba(20,184,166,.1)",color:"#14b8a6",padding:"3px 10px",borderRadius:100,fontWeight:600}}>{ep.refresh}</span>
                <span style={{fontSize:12,color:"rgba(255,255,255,.25)"}}>{ep.size}</span>
              </div>
              <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:10}}>{ep.desc}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>
                <strong style={{color:"rgba(255,255,255,.5)"}}>Fields:</strong> {ep.fields}
              </div>
            </div>
          ))}
          <div style={{marginTop:32,padding:20,background:"rgba(255,255,255,.03)",borderRadius:12,border:"1px solid rgba(255,255,255,.06)"}}>
            <div style={{fontSize:15,fontWeight:700,color:"#e2e8f0",marginBottom:8}}>Usage Example</div>
            <pre style={{background:"rgba(0,0,0,.3)",borderRadius:8,padding:16,overflow:"auto",fontSize:13,color:"#67e8f9",lineHeight:1.6}}>{`fetch("https://officium.vote/data/congress-trades.json")
  .then(r => r.json())
  .then(data => {
    console.log(data.count + " trades");
    console.log(data.trades[0]); // Latest trade
  });`}</pre>
          </div>
        </div>
      </CW>
    </div>
  );
}

/* ── PRICING PAGE ──────────────────────── */
function PricingPage(){
  const m=mob();
  const tiers=[
    {name:"Free Public",price:"Free",period:"",features:["538 federal official profiles","Recent 20 votes per member","Campaign finance summaries","STOCK Act trade feed","Basic search and browse"],cta:"Get Started",highlight:false},
    {name:"Reporter",price:"$120",period:"/month",features:["Everything in Free","Full federal data access","All MVP features","Trade alerts (10 officials)","CSV/PDF export","Priority support"],cta:"Coming Soon",highlight:true},
    {name:"Newsroom",price:"$800",period:"/month",features:["Everything in Reporter","Up to 10 seats","State data (Phase 2)","Real-time alerts","Custom reports","Shared workspaces"],cta:"Coming Soon",highlight:false},
    {name:"Enterprise",price:"Custom",period:"",features:["Everything in Newsroom","Unlimited seats","REST API access","Webhook integrations","SLA guarantee","Dedicated account manager"],cta:"Contact Us",highlight:false},
  ];
  return(
    <div style={{background:"#09090b",minHeight:"100vh",paddingBottom:60}}>
      <div style={{background:"linear-gradient(135deg,#18181b,#27272a)",borderBottom:"1px solid rgba(6,182,212,.12)",padding:"40px 0"}}>
        <CW>
          <div style={{textAlign:"center"}}>
            <h1 style={{fontSize:m?28:36,fontWeight:900,color:"#fff",margin:"0 0 12px",letterSpacing:-1}}>Pricing</h1>
            <p style={{fontSize:16,color:"rgba(255,255,255,.5)",maxWidth:600,margin:"0 auto"}}>Free for citizens. Premium tools for journalists and newsrooms. All prices are planning assumptions pending customer validation.</p>
          </div>
        </CW>
      </div>
      <CW pad="32px 28px">
        <div style={{display:"grid",gridTemplateColumns:m?"1fr":"repeat(4,1fr)",gap:16,maxWidth:1100,margin:"0 auto"}}>
          {tiers.map((t,i)=>(
            <div key={i} style={{background:t.highlight?"rgba(6,182,212,.06)":"rgba(255,255,255,.02)",border:"1px solid "+(t.highlight?"rgba(6,182,212,.3)":"rgba(255,255,255,.06)"),borderRadius:16,padding:24,display:"flex",flexDirection:"column"}}>
              {t.highlight&&<div style={{fontSize:12,fontWeight:700,color:"#14b8a6",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Most Popular</div>}
              <div style={{fontSize:18,fontWeight:800,color:"#fff",marginBottom:4}}>{t.name}</div>
              <div style={{marginBottom:16}}><span style={{fontSize:32,fontWeight:900,color:t.highlight?"#14b8a6":"#e2e8f0"}}>{t.price}</span><span style={{fontSize:14,color:"rgba(255,255,255,.3)"}}>{t.period}</span></div>
              <div style={{flex:1}}>
                {t.features.map((f,j)=>(
                  <div key={j} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:8}}>
                    <span style={{color:"#14b8a6",fontSize:14,flexShrink:0}}>&#x2713;</span>
                    <span style={{fontSize:13,color:"rgba(255,255,255,.5)"}}>{f}</span>
                  </div>
                ))}
              </div>
              <button style={{marginTop:16,padding:"12px 0",borderRadius:10,border:t.highlight?"none":"1px solid rgba(255,255,255,.1)",background:t.highlight?"linear-gradient(135deg,#0891b2,#14b8a6)":"transparent",color:t.highlight?"#fff":"rgba(255,255,255,.5)",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%"}}>{t.cta}</button>
            </div>
          ))}
        </div>
        <div style={{textAlign:"center",marginTop:28,fontSize:13,color:"rgba(255,255,255,.2)"}}>All prices are planning assumptions per BRD &sect;32. Final pricing pending 10 customer discovery interviews.</div>
      </CW>
    </div>
  );
}

/* ── ABOUT PAGE ─────────────────────────── */
function AboutPage(){
  const m=mob();
  const sources=[
    {name:"FEC (OpenFEC API)",desc:"Campaign finance data — contributions, disbursements, PAC funding, candidate totals across all election cycles.",url:"https://api.open.fec.gov",refresh:"Pre-cached weekly via GitHub Actions + live API fallback",status:"537/538 members matched"},
    {name:"Congress.gov API",desc:"Official member data — names, photos, party, state, chamber, terms of service, sponsored legislation.",url:"https://api.congress.gov",refresh:"Live on each visit (4-hour client cache)",status:"538 members loaded"},
    {name:"Senate Stock Watcher",desc:"STOCK Act trade disclosures by U.S. Senators — tickers, amounts, transaction dates, asset descriptions.",url:"https://github.com/timothycarambat/senate-stock-watcher-data",refresh:"Historical dataset (2019-2020). Original source discontinued.",status:"1,295 trades from 28 senators"},
    {name:"LDA (Lobbying Disclosure Act)",desc:"Lobbying filings — registrants, clients, income, lobbying activities, issue codes, government entities targeted.",url:"https://lda.gov/api/v1/",refresh:"Live via CORS proxy (4-hour cache). API sunsetting June 2026.",status:"4,400+ filings"},
    {name:"FARA (Foreign Agents Registration Act)",desc:"Foreign agent registrations — organizations lobbying on behalf of foreign governments and entities.",url:"https://www.opensanctions.org/datasets/us_fara_filings/",refresh:"Weekly via GitHub Actions cron (OpenSanctions mirror of DOJ data)",status:"15,106 registrants from 50+ countries"},
    {name:"USASpending.gov",desc:"Federal agency budgets and spending — budget authority, obligations, outlays by agency.",url:"https://api.usaspending.gov",refresh:"Live on each visit (4-hour cache)",status:"$11.8T tracked across 111 agencies"},
    {name:"Treasury Fiscal Data",desc:"National debt — daily public debt outstanding (Debt to the Penny).",url:"https://fiscaldata.treasury.gov",refresh:"Live on each visit",status:"Daily debt figures"},
    {name:"Federal Register",desc:"Latest regulatory documents — proposed rules, final rules, notices from federal agencies.",url:"https://www.federalregister.gov/developers",refresh:"Live on each visit",status:"10 most recent documents"},
    {name:"GovTrack.us",desc:"Congressional voting records, member contact information, office addresses, and leadership positions.",url:"https://www.govtrack.us/about-our-data",refresh:"Weekly via GitHub Actions cron",status:"539 members + 100 recent votes"},
    {name:"QuiverQuant",desc:"Current congressional stock trades — both Senate and House members. Includes performance vs S&P 500.",url:"https://www.quiverquant.com/congresstrading/",refresh:"Daily via GitHub Actions cron",status:"1,000 trades from 48 officials (2025-2026)"},
    {name:"Voteview (UCLA)",desc:"Per-member voting records on every roll call vote. Includes DW-NOMINATE ideology scores.",url:"https://voteview.com/data",refresh:"Weekly via GitHub Actions cron",status:"244,446 individual votes across 426 members"},
  ];
  return(
    <div style={{background:"#09090b",minHeight:"100vh",paddingBottom:60}}>
      <div style={{background:"linear-gradient(135deg,#18181b,#27272a)",borderBottom:"1px solid rgba(99,102,241,.12)",padding:"40px 0"}}>
        <CW>
          <h1 style={{fontSize:m?28:36,fontWeight:900,color:"#fff",margin:"0 0 12px",letterSpacing:-1}}>About Officium</h1>
          <p style={{fontSize:16,color:"rgba(255,255,255,.5)",lineHeight:1.7,maxWidth:700}}>Officium (Latin for "duty") is a free, open-source platform that aggregates public government data to promote congressional transparency. We are non-partisan and do not accept donations from political organizations.</p>
        </CW>
      </div>
      <CW pad="32px 28px">
        <div style={{maxWidth:800}}>
          <h2 style={{fontSize:22,fontWeight:800,color:"#fff",margin:"0 0 8px"}}>Methodology</h2>
          <p style={{fontSize:14,color:"rgba(255,255,255,.4)",lineHeight:1.7,marginBottom:28}}>All data comes from official public government sources. We do not scrape private websites, and we do not modify or editorialize the data. Our matching algorithm connects FEC campaign finance records to Congress.gov member data using name + state fuzzy matching with unicode normalization for accented names and manual ID overrides for edge cases (hyphenated names, territory delegates).</p>

          <h2 style={{fontSize:22,fontWeight:800,color:"#fff",margin:"0 0 8px"}}>Data Sources & Refresh Frequency</h2>
          <p style={{fontSize:14,color:"rgba(255,255,255,.4)",lineHeight:1.7,marginBottom:20}}>Each data source has a different update cycle. Trade data is historical (source discontinued). All other sources are live or updated weekly.</p>

          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {sources.map((s,i)=>(
              <div key={i} style={{background:"rgba(99,102,241,.04)",border:"1px solid rgba(99,102,241,.1)",borderRadius:14,padding:20}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8,flexWrap:"wrap"}}>
                  <div style={{fontSize:15,fontWeight:800,color:"#e2e8f0"}}>{s.name}</div>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:"#6366f1",textDecoration:"none"}}>API docs →</a>
                </div>
                <p style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.6,margin:"0 0 10px"}}>{s.desc}</p>
                <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                  <span style={{fontSize:12,background:"rgba(99,102,241,.08)",color:"#a5b4fc",padding:"3px 10px",borderRadius:6,fontWeight:600}}>Refresh: {s.refresh}</span>
                  <span style={{fontSize:12,background:"rgba(34,197,94,.08)",color:"#4ade80",padding:"3px 10px",borderRadius:6,fontWeight:600}}>{s.status}</span>
                </div>
              </div>
            ))}
          </div>

          <h2 style={{fontSize:22,fontWeight:800,color:"#fff",margin:"32px 0 8px"}}>Known Limitations</h2>
          <div style={{fontSize:14,color:"rgba(255,255,255,.4)",lineHeight:1.8}}>
            <p>• <strong style={{color:"#4ade80"}}>Congressional Trades (QuiverQuant)</strong>: 1,000 current trades (2025-2026) from both Senate and House members, including performance vs S&P 500. Historical Senate data (2019-2020) from Senate Stock Watcher is merged as a supplement.</p>
            <p>• <strong style={{color:"#fbbf24"}}>House Trade Data (Historical)</strong>: The House Stock Watcher S3 bucket has been permanently offline (HTTP 403) since 2024. Current House trades are now sourced from QuiverQuant.</p>
            <p>• <strong style={{color:"#fbbf24"}}>1 Unmatched FEC Record</strong>: Alan Armstrong (OK, Senate) has no FEC campaign finance filings — he was recently appointed and has not yet filed with the FEC.</p>
            <p>• <strong style={{color:"#fbbf24"}}>LDA Sunsetting</strong>: The lda.senate.gov API is being migrated to lda.gov by June 30, 2026. We use both endpoints with automatic failover.</p>
          </div>

          <h2 style={{fontSize:22,fontWeight:800,color:"#fff",margin:"32px 0 8px"}}>Accountability Score Methodology</h2>
          <p style={{fontSize:14,color:"rgba(255,255,255,.4)",lineHeight:1.7,marginBottom:12}}>Each official receives a composite score from 0-100 based on seven weighted components. Higher scores indicate greater transparency and independence. This methodology is v1 and pending academic validation.</p>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
            {[
              ["Donor Independence (25 pts)","Measures what percentage of an official's campaign funding comes from individual donors versus PACs and political committees. Officials funded primarily by individual citizens score higher than those dependent on special interest PACs."],
              ["Party Independence (15 pts)","Measures how far an official's voting record deviates from their party's median ideology using DW-NOMINATE scores. Officials who vote across party lines more often score higher, indicating they prioritize issues over party loyalty."],
              ["Voting Participation (20 pts)","Measures how often an official shows up to cast votes. Officials who miss fewer roll call votes score higher. Based on Voteview.com data for the 119th Congress."],
              ["Financial Transparency (20 pts)","Measures how timely an official files their STOCK Act trade disclosures. Officials who file within the 45-day legal deadline score higher. Those who consistently file late or have violations score lower."],
              ["Committee Conflict (10 pts)","Detects whether an official trades stocks in the same industry sectors from which they receive PAC funding. Trading in sectors you may legislate on while receiving money from those sectors creates a potential conflict of interest."],
              ["Dark Money Exposure (5 pts)","Measures the ratio of traceable individual donations to opaque PAC/committee funding. Officials with more transparent, traceable funding sources score higher."],
              ["Trading Pattern (5 pts)","Measures the volume of an official's stock trading activity. Extremely high trading volumes by lawmakers receive more scrutiny. Officials with no or moderate trading score higher."],
            ].map(([title,desc])=>(
              <div key={title} style={{padding:"12px 16px",background:"rgba(255,255,255,.02)",borderRadius:10,border:"1px solid rgba(255,255,255,.04)"}}>
                <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0",marginBottom:4}}>{title}</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,.35)",lineHeight:1.6}}>{desc}</div>
              </div>
            ))}
          </div>

          <h2 style={{fontSize:22,fontWeight:800,color:"#fff",margin:"32px 0 8px"}}>Non-Partisan Statement</h2>
          <p style={{fontSize:14,color:"rgba(255,255,255,.4)",lineHeight:1.7}}>Officium presents public data without editorial commentary or partisan framing. We do not endorse candidates, parties, or political positions. Our goal is to make government data accessible and understandable for every citizen.</p>

          <h2 style={{fontSize:22,fontWeight:800,color:"#fff",margin:"32px 0 8px"}}>Open Source</h2>
          <p style={{fontSize:14,color:"rgba(255,255,255,.4)",lineHeight:1.7}}>This project is open source. The code, data pipelines, and methodology are publicly available for review, audit, and contribution.</p>
        </div>
      </CW>
    </div>
  );
}

/* ── MEMBER VOTING RECORD (Voteview) ───────────────── */
function MemberVotingRecord({pol}){
  const[data,setData]=useState(null);const[showAll,setShowAll]=useState(false);const[voteFilter,setVoteFilter]=useState("all");const m=mob();
  useEffect(()=>{VOTEVIEW_P.then(mv=>{setData(mv[pol.bioguideId]||null);}).catch(()=>{});},[pol.bioguideId]);
  if(!data)return <div style={{color:"rgba(255,255,255,.25)",fontSize:13,padding:"12px 0"}}>Loading voting record...</div>;
  const filteredVotes=useMemo(()=>{
    let v=data.votes||[];
    if(voteFilter==="yea")v=v.filter(x=>x.vote==="Yea");
    else if(voteFilter==="nay")v=v.filter(x=>x.vote==="Nay");
    else if(voteFilter==="absent")v=v.filter(x=>x.vote==="Absent");
    return v;
  },[data,voteFilter]);
  const votes=showAll?filteredVotes:filteredVotes.slice(0,10);
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:m?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:20}}>
      <div style={{background:"rgba(99,102,241,.06)",borderRadius:12,padding:14,textAlign:"center"}}><div style={{fontSize:22,fontWeight:900,color:"#6366f1"}}>{data.totalVotes}</div><div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>Total Votes</div></div>
      <div style={{background:"rgba(34,197,94,.06)",borderRadius:12,padding:14,textAlign:"center"}}><div style={{fontSize:22,fontWeight:900,color:"#4ade80"}}>{data.yeaCount}</div><div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>Yea ({data.yeaPct}%)</div></div>
      <div style={{background:"rgba(239,68,68,.06)",borderRadius:12,padding:14,textAlign:"center"}}><div style={{fontSize:22,fontWeight:900,color:"#f87171"}}>{data.nayCount}</div><div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>Nay</div></div>
      <div style={{background:"rgba(245,158,11,.06)",borderRadius:12,padding:14,textAlign:"center"}}><div style={{fontSize:22,fontWeight:900,color:"#fbbf24"}}>{data.absentCount}</div><div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>Absent</div></div>
    </div>
    {data.info?.nominate1!=null&&<div style={{marginBottom:16,padding:"12px 16px",background:"rgba(99,102,241,.04)",border:"1px solid rgba(99,102,241,.1)",borderRadius:10}}>
      <div style={{fontSize:13,fontWeight:700,color:"#a5b4fc",marginBottom:4}}>Ideology Score (DW-NOMINATE)</div>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:12,color:"#3b82f6"}}>← Liberal</span>
        <div style={{flex:1,height:8,borderRadius:4,background:"linear-gradient(90deg,#3b82f6,#94a3b8,#ef4444)",position:"relative"}}>
          <div style={{position:"absolute",top:-4,left:`${((data.info.nominate1+1)/2)*100}%`,width:16,height:16,borderRadius:"50%",background:"#fff",border:"2px solid #6366f1",transform:"translateX(-50%)"}}/>
        </div>
        <span style={{fontSize:12,color:"#ef4444"}}>Conservative →</span>
      </div>
      <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginTop:6,textAlign:"center"}}>Score: {data.info.nominate1.toFixed(3)} (range: -1 liberal to +1 conservative)</div>
    </div>}
    <div style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:12}}>Recent Roll Call Votes</div>
    <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
      {[["all","All"],["yea","Yea Only"],["nay","Nay Only"],["absent","Absent"]].map(([id,label])=>(
        <button key={id} onClick={()=>setVoteFilter(id)} style={{padding:"6px 14px",borderRadius:8,border:"1px solid "+(voteFilter===id?"rgba(6,182,212,.4)":"rgba(255,255,255,.08)"),background:voteFilter===id?"rgba(6,182,212,.1)":"transparent",color:voteFilter===id?"#67e8f9":"rgba(255,255,255,.35)",fontSize:13,fontWeight:600,cursor:"pointer"}}>{label}</button>
      ))}
    </div>
    {votes.map((v,i)=>(
      <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
        <div style={{width:60,textAlign:"center"}}><span style={{fontSize:13,fontWeight:800,color:v.vote==="Yea"?"#4ade80":v.vote==="Nay"?"#f87171":v.vote==="Absent"?"#fbbf24":"#94a3b8",background:v.vote==="Yea"?"rgba(74,222,128,.1)":v.vote==="Nay"?"rgba(248,113,113,.1)":"rgba(255,255,255,.05)",padding:"3px 10px",borderRadius:6}}>{v.vote}</span></div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.description||v.question||"Roll call #"+v.rollNumber}</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{v.date}{v.billNumber?" · "+v.billNumber:""}{v.result?" · "+v.result:""}</div>
        </div>
        {v.yeaCount>0&&<div style={{fontSize:12,color:"rgba(255,255,255,.25)",flexShrink:0}}>{v.yeaCount}-{v.nayCount}</div>}
      </div>
    ))}
    {filteredVotes.length>10&&<button onClick={()=>setShowAll(!showAll)} style={{marginTop:12,padding:"10px 20px",borderRadius:10,border:"1px solid rgba(99,102,241,.2)",background:"rgba(99,102,241,.06)",color:"#a5b4fc",fontSize:13,fontWeight:600,cursor:"pointer",width:"100%"}}>{showAll?`Show less`:`Show all ${filteredVotes.length} votes`}</button>}
    <button onClick={()=>{
      const rows=[["Roll#","Date","Vote","Bill","Result","Question","Yea","Nay"]];
      (data.votes||[]).forEach(v=>rows.push([v.rollNumber,v.date,v.vote,v.billNumber,v.result,v.question||v.description||"",v.yeaCount,v.nayCount]));
      const csv=rows.map(r=>r.map(c=>'"'+(c||"").toString().replace(/"/g,'""')+'"').join(",")).join("\n");
      const blob=new Blob([csv],{type:"text/csv"});const url=URL.createObjectURL(blob);
      const a=document.createElement("a");a.href=url;a.download=`officium-votes-${pol.name.replace(/\s+/g,"-")}.csv`;a.click();URL.revokeObjectURL(url);
    }} style={{marginTop:8,padding:"10px 20px",borderRadius:10,border:"1px solid rgba(6,182,212,.2)",background:"rgba(6,182,212,.06)",color:"#67e8f9",fontSize:13,fontWeight:600,cursor:"pointer"}}>Export Voting Record (CSV)</button>
    <Disclaimer/>
  </div>);
}

/* ── DONOR & INDUSTRY EXPLORER ────────── */
function DonorExplorer({pols,onSelect}){
  const[mode,setMode]=useState("industry");const[q,setQ]=useState("");const m=mob();
  const industryResults=useMemo(()=>{
    if(mode!=="industry"||!q)return[];
    const lq=q.toLowerCase();
    return pols.filter(p=>p.hasRealFinancials&&p.raised>0).sort((a,b)=>b.raised-a.raised).slice(0,50);
  },[pols,q,mode]);
  const stateResults=useMemo(()=>{
    if(mode!=="state"||!q)return[];
    return pols.filter(p=>p.state===q.toUpperCase()||p.state?.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>b.raised-a.raised);
  },[pols,q,mode]);
  const partyResults=useMemo(()=>{
    if(mode!=="party")return[];
    return pols.filter(p=>q==="D"?p.party==="D":q==="R"?p.party==="R":p.party==="I").sort((a,b)=>b.raised-a.raised).slice(0,50);
  },[pols,q,mode]);
  const nameResults=useMemo(()=>{
    if(mode!=="name"||q.length<2)return[];
    return pols.filter(p=>p.name.toLowerCase().includes(q.toLowerCase())).slice(0,20);
  },[pols,q,mode]);
  const results=mode==="industry"?industryResults:mode==="state"?stateResults:mode==="party"?partyResults:nameResults;
  return(
    <div style={{background:"#09090b",minHeight:"100vh",paddingBottom:60}}>
      <div style={{background:"linear-gradient(135deg,#18181b,#27272a)",borderBottom:"1px solid rgba(99,102,241,.12)",padding:"28px 0 24px"}}>
        <CW>
          <h1 style={{fontSize:m?24:32,fontWeight:900,color:"#fff",margin:"0 0 8px",letterSpacing:-1}}>Donor & Industry Explorer</h1>
          <p style={{fontSize:14,color:"rgba(255,255,255,.35)",margin:"0 0 20px"}}>Search campaign finance data by industry, state, party, or official name. All data from FEC.</p>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
            {[["industry","By Industry"],["state","By State"],["party","By Party"],["name","By Name"]].map(([id,label])=>(
              <button key={id} onClick={()=>{setMode(id);setQ("");}} style={{padding:"10px 18px",borderRadius:100,border:"1px solid "+(mode===id?"rgba(99,102,241,.5)":"rgba(255,255,255,.06)"),background:mode===id?"rgba(99,102,241,.15)":"transparent",color:mode===id?"#a5b4fc":"rgba(255,255,255,.4)",fontWeight:700,fontSize:13,cursor:"pointer"}}>{label}</button>
            ))}
          </div>
          {mode==="industry"&&<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Enter sector: Technology, Defense, Energy, Finance, Pharma..." style={{width:"100%",maxWidth:500,padding:"12px 18px",borderRadius:12,border:"1px solid rgba(99,102,241,.2)",background:"rgba(99,102,241,.06)",color:"#fff",fontSize:14,outline:"none",boxSizing:"border-box"}}/>}
          {mode==="state"&&<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Enter state code (e.g., CA, TX, NY)..." style={{width:"100%",maxWidth:300,padding:"12px 18px",borderRadius:12,border:"1px solid rgba(99,102,241,.2)",background:"rgba(99,102,241,.06)",color:"#fff",fontSize:14,outline:"none",boxSizing:"border-box"}}/>}
          {mode==="party"&&<div style={{display:"flex",gap:8}}>{[["D","Democrat"],["R","Republican"],["I","Independent"]].map(([p,l])=><button key={p} onClick={()=>setQ(p)} style={{padding:"10px 20px",borderRadius:12,border:"1px solid "+(q===p?PC[p]+"88":"rgba(255,255,255,.08)"),background:q===p?PC[p]+"15":"transparent",color:q===p?PC[p]:"rgba(255,255,255,.4)",fontWeight:700,fontSize:14,cursor:"pointer"}}>{l}</button>)}</div>}
          {mode==="name"&&<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name..." style={{width:"100%",maxWidth:400,padding:"12px 18px",borderRadius:12,border:"1px solid rgba(99,102,241,.2)",background:"rgba(99,102,241,.06)",color:"#fff",fontSize:14,outline:"none",boxSizing:"border-box"}}/>}
        </CW>
      </div>
      <CW pad="20px 28px">
        <div style={{fontSize:13,color:"rgba(255,255,255,.3)",marginBottom:16}}>{results.length} results</div>
        {results.map((p,i)=>(
          <div key={p.id} onClick={()=>onSelect(p)} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 0",borderBottom:"1px solid rgba(255,255,255,.04)",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(99,102,241,.04)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <span style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,.2)",minWidth:30,textAlign:"center"}}>{i+1}</span>
            <Avatar pol={p} size={36}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:15,fontWeight:700,color:"#fff"}}>{p.name}</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.35)"}}>{PL[p.party]} · {p.chamber} · {p.state}{p.leadership?" · "+p.leadership:""}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:16,fontWeight:800,color:"#10b981"}}>{p.raised>0?fmt(p.raised):"No FEC"}</div>
              {p.pacContrib>0&&<div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>PAC: {fmt(p.pacContrib)}</div>}
              <div style={{display:"flex",gap:12,marginTop:4,justifyContent:"flex-end"}}>
                {p.totalVotes>0&&<span style={{fontSize:12,color:"rgba(255,255,255,.25)"}}>{p.totalVotes} votes · {p.yeaPct}% Yea</span>}
                {p.ideology!=null&&<span style={{fontSize:12,color:p.ideology<-0.3?"#3b82f6":p.ideology>0.3?"#ef4444":"#94a3b8"}}>{p.ideology<-0.3?"Liberal":p.ideology>0.3?"Conservative":"Moderate"}</span>}
              </div>
            </div>
          </div>
        ))}
        <Disclaimer/>
      </CW>
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
    /* Start loading members immediately — don't wait for FEC */
    loadMembers(live=>{if(live&&live.length>0)setPols(live);});
    /* FEC enrichment runs in parallel */
    FEC_P.then(fd=>{
      setPols(prev=>prev.map(p=>{if(p.raised>0)return p;const fr=lookupFEC(p.name,p.state,fd);if(!fr)return p;return{...p,raised:fr.receipts||0,spent:fr.disbursements||0,cash:fr.cash_on_hand_end_period||0,hasRealFinancials:true,fecId:fr.candidate_id||null,fecUrl:fr.candidate_id?"https://www.fec.gov/data/candidate/"+fr.candidate_id+"/":""};}));
    }).catch(()=>{});
    ALL_TRADES_P.then(setTrades).catch(()=>{});
    window.__goSel=p=>{setSel(p);setPage("profile");};
    return()=>{delete window.__goSel;};
  },[]);
  const nav=p=>{if(p!=="profile")setSel(null);setPage(p);window.scrollTo({top:0,behavior:"smooth"});};
  const goSel=p=>{setSel(p);setPage("profile");};
  const onAuth=async u=>{setUser(u);if(!u){nav("home");return;}nav(u.role==="admin"?"admin":"dashboard");};
  const onLogout=async()=>{await clearSession();setUser(null);nav("home");};
  const violations=useMemo(()=>trades.filter(t=>t.gap>45).length,[trades]);
  if(sessLoading)return <div style={{minHeight:"100vh",background:"#09090b",display:"flex",alignItems:"center",justifyContent:"center"}}><Spin sz={32}/></div>;
  return(
    <div style={{display:"flex",flexDirection:"column",minHeight:"100vh",overflowX:"hidden",background:"#09090b"}}>
      <ApiBar/>
      {page!=="auth"&&<Nav page={page} onNav={nav} user={user} onLogout={onLogout} pols={pols} violations={violations} onSelect={goSel}/>}
      {page!=="home"&&page!=="auth"&&(
        <div style={{background:"rgba(168,85,247,.04)",borderBottom:"1px solid rgba(168,85,247,.08)",padding:"6px 0"}}>
          <CW><div style={{fontSize:12,color:"rgba(255,255,255,.3)",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <span style={{fontWeight:500}}>{pols.length>=500?pols.length:538} officials</span>
            <span style={{color:"rgba(255,255,255,.1)"}}>·</span>
            <span>{pols.filter(p=>p.chamber==="Senate").length||100}S + {pols.filter(p=>p.chamber==="House").length||438}H</span>
            <span style={{color:"rgba(255,255,255,.1)"}}>·</span>
            <span>{(pols.length>=500?pols.filter(p=>p.hasRealFinancials).length:537)}/{pols.length>=500?pols.length:538} FEC</span>
            <span style={{color:"rgba(255,255,255,.1)"}}>·</span>
            <span>{trades.length} trades</span>
            {violations>0&&<><span style={{color:"rgba(255,255,255,.1)"}}>·</span><span style={{color:"#f87171",fontWeight:700}}>🚨 {violations} violations</span></>}
            <span style={{marginLeft:"auto",fontSize:12,color:"rgba(168,85,247,.35)",fontWeight:500}}>Cached 4h</span>
          </div>
          {pols.length>=500&&pols.filter(p=>!p.hasRealFinancials).length>0&&pols.filter(p=>!p.hasRealFinancials).length<5&&<div style={{fontSize:12,color:"rgba(255,255,255,.2)",marginTop:2}}>* {pols.filter(p=>!p.hasRealFinancials).map(p=>p.name).join(", ")} — no FEC filing on record (newly appointed)</div>}
          </CW>
        </div>
      )}
      <div style={{flex:1}}>
        {page==="home"&&<HomePage pols={pols} trades={trades} onBrowse={()=>nav("browse")} onSelect={goSel} onLogin={()=>nav("auth")} user={user}/>}
        {page==="auth"&&<AuthPage onAuth={onAuth}/>}
        {page==="browse"&&<BrowsePage pols={pols} trades={trades} onSelect={goSel} user={user} onSetUser={setUser}/>}
        {page==="trades"&&<TradesPage trades={trades} pols={pols} onSelect={goSel}/>}
        {page==="violations"&&<ViolationsPage trades={trades} pols={pols} onSelect={goSel}/>}
        {page==="explorer"&&<DonorExplorer pols={pols} onSelect={goSel}/>}
        {page==="about"&&<AboutPage/>}
        {page==="api"&&<ApiDocsPage/>}
        {page==="pricing"&&<PricingPage/>}
        {page==="profile"&&sel&&<ProfilePage pol={sel} pols={pols} allTrades={trades} onSelect={goSel} onBack={()=>nav("browse")} user={user} onSetUser={setUser}/>}
        {page==="dashboard"&&(user?<UserDashboard user={user} pols={pols} onSelect={goSel} onSetUser={setUser}/>:<AuthPage onAuth={onAuth}/>)}
        {page==="admin"&&(user&&user.role==="admin"?<AdminDashboard pols={pols} trades={trades}/>:<AuthPage onAuth={onAuth}/>)}
      </div>
    </div>
  );
}
