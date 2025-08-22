// api/dumpLeague.js
export default async function handler(req, res) {
  const leagueId = 498513; // change if needed
  const url = `https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/`;

  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'FPL-App' } });
    const data = await response.json();

    const results = data?.standings?.results || [];
    const names = results.map(r => ({
      manager: r.player_name,
      entryId: r.entry,
      fplTeam: r.entry_name
    }));

    res.status(200).json(names);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch league standings' });
  }
}
