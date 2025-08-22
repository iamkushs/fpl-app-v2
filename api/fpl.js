// api/fpl.js
export default async function handler(req, res) {
  try {
    const path = req.query.path || ""; // e.g. "entry/123/history/"
    if (!path) return res.status(400).json({ error: "Missing ?path=" });

    // Normalize: avoid duplicate leading slashes
    const clean = String(path).replace(/^\/+/, "");
    const url = `https://fantasy.premierleague.com/api/${clean}`;

    const r = await fetch(url, {
      headers: {
        "User-Agent": "FPL-App (vercel-proxy)",
        "Accept": "application/json",
      },
      redirect: "follow",
    });

    // Pass through the status and body
    const text = await r.text();
    // Try to return JSON if possible, else raw text
    try {
      const json = JSON.parse(text);
      return res.status(r.status).json(json);
    } catch {
      return res.status(r.status).send(text);
    }
  } catch (e) {
    res.status(500).json({ error: "Proxy fetch failed", details: String(e) });
  }
}
