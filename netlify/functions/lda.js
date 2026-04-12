export const handler = async (event) => {
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
      return { statusCode: res.status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: `LDA returned ${res.status}`, detail: text.slice(0,300) }) };
    }
    const data = await res.json();
    return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: err.message }) };
  }
};
