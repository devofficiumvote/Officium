export const handler = async (event) => {
  try {
    const { polData } = JSON.parse(event.body || "{}");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: "You are a data analyst for Officium. Present only verified public facts. Never allege causation or wrongdoing. Format with 4 sections: FUNDING OVERVIEW, LEGISLATIVE RECORD, FINANCIAL DISCLOSURES, DATA FLAGS.", messages: [{ role: "user", content: polData || "ping" }] })
    });
    const data = await res.json();
    return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
