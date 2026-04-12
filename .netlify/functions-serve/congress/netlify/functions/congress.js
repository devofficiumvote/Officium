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

// netlify/functions/congress.js
var congress_exports = {};
__export(congress_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(congress_exports);
var handler = async (event) => {
  const params = event.queryStringParameters || {};
  const type = params.type || "member";
  const key = process.env.CONGRESS_API_KEY;
  const limit = params.limit || "250";
  const offset = params.offset || "0";
  if (!key) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "CONGRESS_API_KEY not set in Netlify environment variables" })
    };
  }
  let url = "";
  if (type === "member") {
    url = `https://api.congress.gov/v3/member?limit=${limit}&offset=${offset}&currentMember=true&format=json&api_key=${key}`;
    if (params.chamber && params.chamber !== "all" && params.chamber !== "") {
      url += `&chamber=${params.chamber}`;
    }
    if (params.state) url += `&state=${params.state}`;
  } else if (type === "bill") {
    url = `https://api.congress.gov/v3/bill?limit=${limit}&sort=updateDate+desc&format=json&api_key=${key}`;
    if (params.congress) url += `&congress=${params.congress}`;
  } else if (type === "votes") {
    url = `https://api.congress.gov/v3/member/${params.bioguideId}/votes?limit=20&format=json&api_key=${key}`;
  }
  try {
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    const text = await res.text();
    if (!res.ok) {
      return {
        statusCode: res.status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: `Congress.gov returned HTTP ${res.status}`, detail: text.slice(0, 300) })
      };
    }
    const data = JSON.parse(text);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=congress.js.map
