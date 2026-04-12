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

// netlify/functions/fec.js
var fec_exports = {};
__export(fec_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(fec_exports);
var handler = async (event) => {
  const params = event.queryStringParameters || {};
  const type = params.type || "candidates";
  const key = process.env.FEC_API_KEY;
  const office = params.office || "S";
  const page = params.page || "1";
  if (!key) {
    return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "FEC_API_KEY not set" }) };
  }
  let url = "";
  if (type === "candidates") {
    url = `https://api.open.fec.gov/v1/candidates/totals/?office=${office}&is_active_candidate=true&per_page=100&page=${page}&sort=-receipts&api_key=${key}`;
  } else if (type === "search") {
    url = `https://api.open.fec.gov/v1/candidates/search/?q=${encodeURIComponent(params.q || "")}&office=${params.office || "S"}&state=${params.state || ""}&per_page=1&api_key=${key}`;
  } else if (type === "schedule_a") {
    url = `https://api.open.fec.gov/v1/schedules/schedule_a/?candidate_id=${params.candidate_id}&per_page=100&page=${page}&api_key=${key}`;
  }
  try {
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    const data = await res.json();
    return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: err.message }) };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=fec.js.map
