const http = require('http');
const fs = require('fs');
const path = require('path');

/*
  Fantasy Premier League mini‑league server (v2)

  This server is designed to compute scores for a custom FPL mini‑league
  where players compete in pairs. Each pair is represented by a team name
  and an abbreviation. For every gameweek (GW), the two members of each
  team accumulate their official FPL points; the team captain’s points
  (selected per GW) are doubled. If no captain has been selected for a
  team for a given GW, the member with the lower score is automatically
  treated as captain. All scores are fetched directly from the official
  FPL API when the client requests them so that the data reflects the
  current state on FPL, whether a gameweek is live or finished.

  The server caches league standings to minimise repeated API calls but
  never caches individual gameweek scores. You can update captains for
  any GW via the POST /api/captains/:gw endpoint. Captains are stored
  in `captains.json` alongside this script. The list of team names and
  their abbreviations is hardcoded in ABBREVIATIONS below. See README
  for full usage instructions.
*/

// Configuration: league ID and team abbreviations
const LEAGUE_ID = 498513;
// Map of canonical team names to their squad name prefixes. These are
// used to identify which entry belongs to which team in the league
// standings. Squad names in FPL must start with "<prefix>-", e.g. a
// squad for "Banter Bros" must be named "BAB-...". Update this map
// if you change team names or abbreviations.
const ABBREVIATIONS = {
  'Banter Bros': 'BAB',
  'Bianconeri Blues': 'BIB',
  'Dark Knights': 'DK',
  'Despicable Memelennials': 'DM',
  'Footballing Gods': 'FG',
  'Highbury Citizens': 'HC',
  'Invisible Royals': 'IR',
  'JoBros': 'JB',
  'Jota Ke Chhorey': 'JKC',
  'Merseyside Mancunians': 'MM',
  'Odia Outlaws': 'OO',
  'Royal Indians': 'RI',
  'Team Rocket': 'TR',
  'Scouse Force': 'SF',
  'Slippery Legends': 'SL',
  'The Anfield Devils': 'TAD',
  'Blaugrana Cules': 'BC',
  'Filthy Foxes': 'FF',
  'Goal Diggers': 'GD',
  'Jama Juggernauts': 'JJ',
  "Maresca's Villagers": 'MV',
  'NorthEastern Hillibillies': 'NEH',
  'Peaky Blinders': 'PB',
  'Reds Of Winterfell': 'RW',
  'Scarlet Reds': 'SR',
  'Sharingan Warriors': 'SW',
  'Stretford Kops': 'SK',
  'Super Saiyan': 'SS',
  'Royal Reds': 'RR',
  'The Invincibles': 'INV',
  'Thunderbolts': 'TB',
  'xG Xorcists': 'XGX'
};

// Base URL for the FPL API
const FPL_API = 'https://fantasy.premierleague.com/api';

// Cache for league standings and derived pairs. Standings are cached
// for STANDINGS_CACHE_TTL milliseconds. Pairs are rebuilt whenever
// standings expire or on demand. Scores are never cached.
let standingsCache = null;
let standingsCacheTimestamp = 0;
const STANDINGS_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
let pairsCache = null;

// Load captains from disk. If no file exists, initialise an empty
// structure. The structure is { byGw: { [gw]: { [teamName]: entryId } } }.
function loadCaptains() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'captains.json'), 'utf8');
    const json = JSON.parse(data);
    if (json && typeof json === 'object' && json.byGw) {
      return json;
    }
  } catch (err) {
    // ignore and fall through to create new file
  }
  return { byGw: {} };
}

// Persist captains to disk
function saveCaptains(captains) {
  fs.writeFileSync(path.join(__dirname, 'captains.json'), JSON.stringify(captains, null, 2));
}

// Fetch a single page of standings for the league. The FPL API returns
// pages of 50 entries. We request successive pages until has_next
// indicates there are no more entries.
async function fetchStandingsPage(page) {
  const url = `${FPL_API}/leagues-classic/${LEAGUE_ID}/standings/?page_standings=${page}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error fetching standings page ${page}: ${res.status}`);
  return res.json();
}

async function fetchAllStandings() {
  const results = [];
  let page = 1;
  while (true) {
    const data = await fetchStandingsPage(page);
    if (data && data.standings && data.standings.results) {
      results.push(...data.standings.results);
      if (!data.standings.has_next) break;
      page++;
    } else {
      break;
    }
  }
  return results;
}

// Ensure standings are loaded and up‑to‑date. Returns the cached
// standings if valid; otherwise fetches fresh data from FPL.
async function getStandings() {
  const now = Date.now();
  if (standingsCache && now - standingsCacheTimestamp < STANDINGS_CACHE_TTL) {
    return standingsCache;
  }
  const standings = await fetchAllStandings();
  standingsCache = standings;
  standingsCacheTimestamp = now;
  // Invalidate pairs cache because new standings may change entry names
  pairsCache = null;
  return standings;
}

// Build the pairs mapping from standings using the ABBREVIATIONS map.
// Each team is identified by its abbreviation prefix. Squad names must
// start with `<prefix>-`. Returns an array of objects:
// { name: teamName, members: [ { entryId, entryName, managerName, points: null } ] }
async function buildPairs() {
  const standings = await getStandings();
  const pairs = [];
  for (const [teamName, prefix] of Object.entries(ABBREVIATIONS)) {
 // Accept: "PREFIX-Name", "PREFIX - Name", "PREFIX–Name", "PREFIX—Name", "PREFIX: Name", or "PREFIX Name"
function escapeRegExp(s) {
  return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function hasPrefix(entryName, pref) {
  const s = (entryName || '').trim();
  const p = escapeRegExp((pref || '').trim());
  // Start of string, optional spaces, the prefix, optional spaces,
  // then either a separator (hyphen/en-dash/em-dash/colon) with optional spaces,
  // OR at least one space (to handle "RI DIPESH").
  const re = new RegExp(`^\\s*${p}(?:\\s*[-–—:]\\s*|\\s+)`, 'i');
  return re.test(s);
}

const matches = standings.filter(r => hasPrefix(r.entry_name, prefix));

    if (matches.length !== 2) {
      // If we cannot find exactly two matches for this team, flag an error entry
      pairs.push({ name: teamName, members: [], error: `Found ${matches.length} squads with prefix ${prefix}` });
    } else {
      pairs.push({
        name: teamName,
        members: matches.map(m => ({
          entryId: m.entry,
          entryName: m.entry_name,
          managerName: m.player_name,
          points: null
        }))
      });
    }
  }
  return pairs;
}

async function getPairs() {
  if (pairsCache) return pairsCache;
  const pairs = await buildPairs();
  pairsCache = pairs;
  return pairs;
}

// Fetch official points for a given entry and GW. Returns a number (0 if
// missing or not yet updated). Uses the picks endpoint to read
// entry_history.points【907722956203460†L279-L285】.
async function fetchOfficialPoints(entryId, gw) {
  const url = `${FPL_API}/entry/${entryId}/event/${gw}/picks/`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error fetching picks for entry ${entryId}, GW ${gw}: ${res.status}`);
  const json = await res.json();
  const pts = json?.entry_history?.points;
  return typeof pts === 'number' ? pts : 0;
}

// Compute scores for all teams for a given GW. Applies the captain rule.
async function computeScoresForGw(gw, pairs, captains) {
  // Fetch all official points
  // Flatten all entries
  const allEntries = [];
  for (const p of pairs) {
    if (!p.members || p.members.length !== 2) continue;
    for (const m of p.members) {
      allEntries.push(m.entryId);
    }
  }
  // Fetch points for each entry in series with basic concurrency control
  const entryPoints = {};
  const concurrency = 10;
  let idx = 0;
  async function worker() {
    while (idx < allEntries.length) {
      const current = idx++;
      const entryId = allEntries[current];
      try {
        const pts = await fetchOfficialPoints(entryId, gw);
        entryPoints[entryId] = pts;
      } catch (err) {
        entryPoints[entryId] = 0;
      }
    }
  }
  const workers = [];
  for (let i = 0; i < concurrency; i++) workers.push(worker());
  await Promise.all(workers);
  // Build results
  const results = [];
  for (const p of pairs) {
    if (!p.members || p.members.length !== 2) {
      results.push({ name: p.name, error: p.error || 'Invalid team definition' });
      continue;
    }
    const [m1, m2] = p.members;
    const pts1 = entryPoints[m1.entryId] || 0;
    const pts2 = entryPoints[m2.entryId] || 0;
    // Determine captain for this team and GW
    let captainsForGw = captains.byGw?.[gw] || {};
    let captainEntryId = captainsForGw[p.name];
    let autoLowest = false;
    if (!captainEntryId || (captainEntryId !== m1.entryId && captainEntryId !== m2.entryId)) {
      // Choose member with lower points; tie breaks by entry name alphabetical
      autoLowest = true;
      if (pts1 < pts2) {
        captainEntryId = m1.entryId;
      } else if (pts2 < pts1) {
        captainEntryId = m2.entryId;
      } else {
        // tie: choose lexicographically smaller squad name (case insensitive)
        const name1 = (m1.entryName || '').toLowerCase();
        const name2 = (m2.entryName || '').toLowerCase();
        captainEntryId = name1 <= name2 ? m1.entryId : m2.entryId;
      }
    }
    const captainPoints = captainEntryId === m1.entryId ? pts1 : pts2;
    const teamPoints = pts1 + pts2 + captainPoints;
    results.push({
      teamName: p.name,
      members: [
        { entryId: m1.entryId, squadName: m1.entryName, manager: m1.managerName, points: pts1 },
        { entryId: m2.entryId, squadName: m2.entryName, manager: m2.managerName, points: pts2 }
      ],
      captainEntryId,
      captainPoints,
      autoLowest,
      teamPoints
    });
  }
  // Sort by teamPoints desc
  results.sort((a, b) => b.teamPoints - a.teamPoints);
  return results;
}

// Helper to parse JSON body from request
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try {
        const json = JSON.parse(data || '{}');
        resolve(json);
      } catch (err) {
        reject(err);
      }
    });
  });
}

/*
  HTTP request handler

  Routes:
    GET  /api/gw/:gw            -> compute and return team scores for gw
    GET  /api/pairs             -> return current pairs mapping (names and members)
    GET  /api/captains/:gw      -> return captains for the gw
    POST /api/captains/:gw      -> set captains for the gw (JSON body mapping teamName->entryId)
    GET  /api/abbreviations     -> return the abbreviations map
    Static file serving from ./public
*/
async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  try {
    // API routes
    if (pathname.startsWith('/api/')) {
      const parts = pathname.split('/').filter(Boolean);
      // /api/gw/:gw
      if (parts[1] === 'gw' && req.method === 'GET' && parts.length === 3) {
        const gw = parseInt(parts[2], 10);
        if (!gw || gw < 1 || gw > 38) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid gameweek' }));
          return;
        }
        // Ensure pairs are built
        const pairs = await getPairs();
        // Load captains
        const captains = loadCaptains();
        const results = await computeScoresForGw(parts[2], pairs, captains);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ gw, results, timestamp: Date.now() }));
        return;
      }
      // /api/pairs
      if (parts[1] === 'pairs' && req.method === 'GET') {
        const pairs = await getPairs();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(pairs));
        return;
      }
      // /api/abbreviations
      if (parts[1] === 'abbreviations' && req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(ABBREVIATIONS));
        return;
      }
      // /api/captains/:gw
      if (parts[1] === 'captains' && parts.length === 3) {
        const gw = parts[2];
        const captains = loadCaptains();
        if (req.method === 'GET') {
          const captainsForGw = captains.byGw?.[gw] || {};
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(captainsForGw));
          return;
        }
        if (req.method === 'POST') {
          try {
            const body = await parseJsonBody(req);
            if (!captains.byGw) captains.byGw = {};
            captains.byGw[gw] = body || {};
            saveCaptains(captains);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'ok' }));
            // Invalidate pairs? no need
            return;
          } catch (err) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid JSON body' }));
            return;
          }
        }
      }
      // Unknown API route
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }
    // Static files
    const publicDir = path.join(__dirname, 'public');
    let filePath = path.join(publicDir, pathname === '/' ? 'index.html' : pathname);
    // Prevent directory traversal
    if (!filePath.startsWith(publicDir)) {
      res.statusCode = 403;
      res.end('Access denied');
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      let contentType = 'text/plain';
      if (ext === '.html') contentType = 'text/html';
      else if (ext === '.js') contentType = 'text/javascript';
      else if (ext === '.css') contentType = 'text/css';
      else if (ext === '.json') contentType = 'application/json';
      res.setHeader('Content-Type', contentType);
      res.end(data);
    });
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message }));
  }
}

// Create and start the HTTP server
const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(err => {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message }));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`FPL mini‑league server (v2) running on port ${PORT}`);
});