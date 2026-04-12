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

// netlify/functions/lda.js
var lda_exports = {};
__export(lda_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(lda_exports);
var handler = async (event) => {
  const params = event.queryStringParameters || {};
  const endpoint = params.endpoint || "filings";
  const search = params.search || "";
  const limit = params.limit || "25";
  const offset = params.offset || "0";
  const key = process.env.LDA_API_KEY;
  const isConst = endpoint.startsWith("constants/");
  let url = `https://lda.senate.gov/api/v1/${endpoint}/?format=json`;
  if (!isConst) {
    url += `&limit=${limit}&offset=${offset}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
  }
  try {
    const headers = { "Accept": "application/json" };
    if (key) headers["Authorization"] = `Token ${key}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const text = await res.text();
      return { statusCode: res.status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: `LDA returned ${res.status}`, detail: text.slice(0, 300) }) };
    }
    const data = await res.json();
    return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: err.message }) };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=lda.js.map
