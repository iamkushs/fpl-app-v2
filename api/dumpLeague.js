// api/dumpLeague.js
export default async function handler(req, res) {
  const leagueId = Number(req.query.leagueId) || 498513; // allow ?leagueId=...
  const names = [];

  // FPL returns ~50 per page. Paginate until has_next = false (hard cap 20 pages).
  try {
    for (let page = 1; page <= 20; page++) {
      const url = `https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/?page_standings=${page}`;
      const r = await fetch(url, { headers: { 'User-Agent': 'FPL-App' } });
      if (!r.ok) break;
      const data = await r.json();

      const results = data?.standings?.results || [];
      for (const row of results) {
        names.push({
          manager: row.player_name,   // exact display name in standings
          entryId: row.entry,         // numeric entry ID
          fplTeam: row.entry_name     // their FPL team name
        });
      }

      const hasNext = !!data?.standings?.has_next;
      if (!hasNext) break;
    }

    res.status(200).json({ leagueId, count: names.length, managers: names });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch league standings', details: String(e) });
  }
}
