var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// netlify/functions/fara.js
var fara_exports = {};
__export(fara_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(fara_exports);
var handler = async (event) => {
  const params = event.queryStringParameters || {};
  const type = params.type || "registrants";
  const search = (params.search || "").toLowerCase();
  const BULK_URLS = {
    registrants: "https://efile.fara.gov/bulk/download/ActiveRegistrantsList.csv",
    principals: "https://efile.fara.gov/bulk/download/ForeignPrincipalsList.csv",
    documents: "https://efile.fara.gov/bulk/download/LatestDailyFormsList.csv",
    all: "https://efile.fara.gov/bulk/download/AllRegistrantsList.csv"
  };
  const url = BULK_URLS[type] || BULK_URLS.registrants;
  const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/csv,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Referer": "https://efile.fara.gov/"
  };
  try {
    const res = await fetch(url, { headers: HEADERS });
    const text = await res.text();
    if (!res.ok || text.trim().startsWith("<!") || text.trim().startsWith("<html")) {
      const alt = url.replace("/bulk/download/", "/ords/fara/f?p=171:BULKDATA:::::FILENAME:");
      const res2 = await fetch(alt, { headers: HEADERS });
      const text2 = await res2.text();
      if (text2.trim().startsWith("<!")) {
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ results: [], error: "FARA bulk download blocked", blocked: true })
        };
      }
    }
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length < 2) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ results: [], error: "Empty CSV", raw: text.slice(0, 200) })
      };
    }
    const parseCSVLine = (line) => {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
          inQuotes = !inQuotes;
          continue;
        }
        if (line[i] === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
          continue;
        }
        current += line[i];
      }
      result.push(current.trim());
      return result;
    };
    const headers = parseCSVLine(lines[0]);
    let results = lines.slice(1).map((line) => {
      const vals = parseCSVLine(line);
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = vals[i] || "";
      });
      return obj;
    }).filter((r) => Object.values(r).some((v) => v.length > 0));
    if (search) {
      results = results.filter(
        (r) => Object.values(r).some((v) => v.toLowerCase().includes(search))
      );
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ results, total: results.length, headers, source: "FARA bulk CSV" })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message, results: [] })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=fara.js.map
