/*
  Front-end logic for FPL mini-league points (client-only, Vercel static).
  - No hardcoded entry IDs. We fetch league standings and resolve IDs by manager names.
  - Uses /api/fpl?path=... proxy (serverless) to bypass CORS.
  - Persists captains per GW in localStorage.
  - If captain not set, auto-picks the lower-scoring member for that GW.

  Edit this if needed: LEAGUE_ID (default 498513).
*/
// ---- LIVE points cache + helper ----
const LIVE_POINTS_CACHE = new Map(); // gw -> { elementId: live_total_points }

async function getLivePointsMap(gw) {
  if (LIVE_POINTS_CACHE.has(gw)) return LIVE_POINTS_CACHE.get(gw);

  const r = await fetch(`/api/fpl?path=event/${gw}/live/`);
  if (!r.ok) { LIVE_POINTS_CACHE.set(gw, null); return null; }

  const data = await r.json();
  const els = Array.isArray(data?.elements) ? data.elements : [];
  const map = {};
  for (const e of els) map[e.id] = Number(e?.stats?.total_points ?? 0);

  LIVE_POINTS_CACHE.set(gw, map);
  return map;
}

document.addEventListener('DOMContentLoaded', () => {
  // League you track
  const LEAGUE_ID = 498513; // change if needed

// Global overrides: short name -> exact FPL manager name (from standings dump)
const NAME_OVERRIDES = {
  "Aadi": "Aditya Halwe",
  "Aniket": "Aniket Sainani",
  "Arun": "Arun Raghavan Guru",
  "Chirag": "Chirag Chawla",
  "Nachiket": "Nachiket Chawla",
  "Abdul": "Abdul Salam Kamal",
  "Anosh": "Anosh Daji",
  "Anurag": "Anurag Toshniwal",
  "Samarth": "Samarth Mundra",
  "Ayush": "Ayush Nagar",
  "Saket": "Saket Halway",
  "Ramen": "𝔻𝔼-𝕃𝕀𝔾𝕋 - 𝔼𝔻",
  "Rishabh S": "Rishab Saini TvT",
  "Yash G": "Smita Gokani",
  "Avirup": "A.R.N. Mukherjee",
  "Devraj": "Devraj Banerjee",
  "Ashwin": "Ashwin N",
  "Chintan": "Chintan shah",
  "Abrar": "Abrar Mughal",
  "Dharm": "Dharm Shah",
  "Manik": "M Malhotra",
  "Angad": "Angy S B",
  "Harsh": "Harsh Bharvada",
  "Parag": "Parag Gaikwd",
  "Yash C": "Yash C",
  "Shubham": "Shivani Chavan",
  "Subhajit": "Subhajit Das",
  "Bhairab": "Bhairab Gogoi",
  "Pulakesh": "Pulakesh Das",
  "Sankalp": "Sankalp Outlaws",
  "Suvendu": "Suvendu Subhrajyoti",
  "Naman": "Nam Man",
  "Sachin": "Sachin Mittaal",
  "Anshuman": "Anshuman Gaonsindhe",
  "Rishabh M": "Rishabh Mehta",
  "Deepesh": "DIPESH GAGGAR",
  "Saahil": "SAAHIL JAVKAR",
  "Gaurav": "Gaurav G",
  "Paritosh": "Paritosh Mishra",
  "Ujjwal": "Ujjwal Agrawal",
  "Kartik": "Kartik Patil",
  "Shaibaz": "Shaibaz Khan",
  "Yashasva": "Yashasva Tungare",
  "Aakash": "Aakash Shukla",
  "Kush": "Kush Shukla",
  "Jeetesh": "Jeetesh Assudani",
  "Gautam": "Gautam Mohanty",
  "Shivam": "Shivam Hargunani",
  "Ketan": "Ketan B",
  "Raunak": "Raunak Gupta",
  "Ankur": "Ankur Srivastava",
  "Apurv": "Akshay Kulkarni",   // per standings dump
  "Sushank": "Suhani Pimple",   // per standings dump
  "Subham": "Subham Sushobhit",
  "Swagat": "Swagat Das"
};

// Per-team overrides to disambiguate duplicates (Akshay, Pankaj, Aditya, Kapil)
const TEAM_SPECIFIC_OVERRIDES = {
  "Bianconeri Blues": { "Akshay": "Akshay Hariharan" },
  "Royal Reds":       { "Akshay": "akshay joharle" },

  "Footballing Gods": { "Pankaj": "Pankaj Shende" },
  "JoBros":           { "Pankaj": "Pankaj Bhatia" },

  "Stretford Kops":   { "Aditya": "A S" },
  "The Anfield Devils": { "Aditya": "Aditya Rao" },

  "Scouse Force":     { "Kapil": "Kapil Ingale" },
  "Thunderbolts":     { "Kapil C": "Kapil Chaudhary" }
};


  // Your 2-person teams (manager display names as seen in FPL)
  const TEAMS = [
    { teamName: 'Banter Bros',               members: [{ manager: 'Aadi' },      { manager: 'Aniket' }] },
    { teamName: 'Bianconeri Blues',          members: [{ manager: 'Akshay' },    { manager: 'Arun' }] },
    { teamName: 'Blaugrana Cules',           members: [{ manager: 'Chirag' },    { manager: 'Nachiket' }] },
    { teamName: 'Dark Knights',              members: [{ manager: 'Abdul' },     { manager: 'Anosh' }] },
    { teamName: 'Despicable Memelennials',   members: [{ manager: 'Anurag' },    { manager: 'Samarth' }] },
    { teamName: 'Filthy Foxes',              members: [{ manager: 'Ayush' },     { manager: 'Saket' }] },
    { teamName: 'Footballing Gods',          members: [{ manager: 'Pankaj' },    { manager: 'Ramen' }] },
    { teamName: 'Goal Diggers',              members: [{ manager: 'Rishabh S' }, { manager: 'Yash G' }] },
    { teamName: 'Highbury Citizens',         members: [{ manager: 'Avirup' },    { manager: 'Devraj' }] },
    { teamName: 'Invisible Royals',          members: [{ manager: 'Ashwin' },    { manager: 'Chintan' }] },
    { teamName: 'Jama Juggernauts',          members: [{ manager: 'Abrar' },     { manager: 'Dharm' }] },
    { teamName: 'JoBros',                    members: [{ manager: 'Manik' },     { manager: 'Pankaj' }] },
    { teamName: 'Jota Ke Chhorey',           members: [{ manager: 'Angad' },     { manager: 'Harsh' }] },
    { teamName: "Maresca's Villagers",       members: [{ manager: 'Parag' },     { manager: 'Yash C' }] },
    { teamName: 'Merseyside Mancunians',     members: [{ manager: 'Shubham' },   { manager: 'Subhajit' }] },
    { teamName: 'North Eastern Hillibilies', members: [{ manager: 'Bhairab' },   { manager: 'Pulakesh' }] },
    { teamName: 'Odia Outlaws',              members: [{ manager: 'Sankalp' },   { manager: 'Suvendu' }] },
    { teamName: 'Peaky Blinders',            members: [{ manager: 'Naman' },     { manager: 'Sachin' }] },
    { teamName: 'Reds of Winterfell',        members: [{ manager: 'Anshuman' },  { manager: 'Rishabh M' }] },
    { teamName: 'Royal Indians',             members: [{ manager: 'Deepesh' },   { manager: 'Saahil' }] },
    { teamName: 'Royal Reds',                members: [{ manager: 'Akshay' },    { manager: 'Gaurav' }] },
    { teamName: 'Scarlet Reds',              members: [{ manager: 'Paritosh' },  { manager: 'Ujjwal' }] },
    { teamName: 'Scouse Force',              members: [{ manager: 'Kapil' },     { manager: 'Kartik' }] },
    { teamName: 'Sharingan Warriors',        members: [{ manager: 'Shaibaz' },   { manager: 'Yashasva' }] },
    { teamName: 'Slippery Legends',          members: [{ manager: 'Aakash' },    { manager: 'Kush' }] },
    { teamName: 'Stretford Kops',            members: [{ manager: 'Aditya' },    { manager: 'Jeetesh' }] },
    { teamName: 'Super Saiyans',             members: [{ manager: 'Gautam' },    { manager: 'Shivam' }] },
    { teamName: 'Team Rocket',               members: [{ manager: 'Ketan' },     { manager: 'Raunak' }] },
    { teamName: 'The Anfield Devils',        members: [{ manager: 'Aditya' },    { manager: 'Ankur' }] },
    { teamName: 'The Invincibles',           members: [{ manager: 'Apurv' },     { manager: 'Sushank' }] },
    { teamName: 'Thunderbolts',              members: [{ manager: 'Kapil C' },   { manager: 'Prashant' }] },
    { teamName: 'xG Xorcists',               members: [{ manager: 'Subham' },    { manager: 'Swagat' }] }
  ];

  // Captain persistence per GW
  const CAP_KEY = 'fpl_mlp_captains_v1'; // shape: { [gw]: { [teamName]: entryId } }

  function loadCaptainMap() {
    try { return JSON.parse(localStorage.getItem(CAP_KEY) || '{}'); } catch { return {}; }
  }
  function saveCaptainMap(map) { localStorage.setItem(CAP_KEY, JSON.stringify(map)); }
  function getCaptainFor(gw, teamName) {
    const all = loadCaptainMap();
    return (all[String(gw)] || {})[teamName] || null;
  }
  function setCaptainFor(gw, teamName, entryId) {
    const all = loadCaptainMap();
    const g = all[String(gw)] || {};
    g[teamName] = entryId;
    all[String(gw)] = g;
    saveCaptainMap(all);
  }
  function getAllCaptainsForGw(gw) {
    const all = loadCaptainMap();
    return all[String(gw)] || {};
  }

  // DOM
  const gwInput = document.getElementById('gw');
  const fetchBtn = document.getElementById('fetch-btn');
  const messageEl = document.getElementById('message');
  const resultsBody = document.querySelector('#results-table tbody');
  const captainEditor = document.getElementById('captain-editor');
  const captainGwDisplay = document.getElementById('captain-gw-display');
  const captainTableBody = document.getElementById('captain-table-body');
  const captainForm = document.getElementById('captain-form');
  const captainSaveMsg = document.getElementById('captain-save-msg');

  let currentGw = null;

  // Name normalization + tolerant matching
  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[\s\-\._]+/g, '')
      .replace(/[^\p{L}\p{N}]/gu, '');
  }
  function similar(a, b) {
    const A = norm(a), B = norm(b);
    if (!A || !B) return false;
    if (A === B) return true;
    return A.includes(B) || B.includes(A);
  }

// Fetch all standings via our serverless helper (handles pagination reliably)
async function fetchLeagueDirectory(leagueId) {
  const nameToEntry = new Map();

  const res = await fetch(`/api/dumpLeague?leagueId=${leagueId}`);
  if (!res.ok) throw new Error('Failed to load league standings');
  const data = await res.json();

  const rows = Array.isArray(data?.managers) ? data.managers : [];
  for (const r of rows) {
    if (r?.manager && r?.entryId) {
      nameToEntry.set(r.manager, {
        entryId: r.entryId,
        entryName: r.fplTeam || '',
        playerName: r.manager
      });
    }
  }

  // helpful log while we debug
  console.log('Standings loaded:', nameToEntry.size, 'managers');
  return nameToEntry;
}

  // Resolve an entryId from a manager display name, using tolerant matching
  function resolveEntryId(nameToEntry, targetManagerName, teamName) {
  // 0) team-specific override?
  const teamMap = TEAM_SPECIFIC_OVERRIDES[teamName];
  const teamOverride = teamMap?.[targetManagerName];
  if (teamOverride && nameToEntry.has(teamOverride)) {
    return nameToEntry.get(teamOverride).entryId;
  }

  // 1) global override?
  const override = NAME_OVERRIDES[targetManagerName];
  if (override && nameToEntry.has(override)) {
    return nameToEntry.get(override).entryId;
  }

  // 2) exact
  if (nameToEntry.has(targetManagerName)) {
    return nameToEntry.get(targetManagerName).entryId;
  }

  // 3) normalized/partial
  const keys = Array.from(nameToEntry.keys());
  const exact = keys.find(k => norm(k) === norm(targetManagerName));
  if (exact) return nameToEntry.get(exact).entryId;

  const partial = keys.find(k => similar(k, targetManagerName));
  if (partial) return nameToEntry.get(partial).entryId;

  return null;
}


// ---- Real-time points for a manager ----
// Order: LIVE (picks × live totals) → HISTORY (finished GWs) → PICKS (fallback)
async function fetchManagerGwPoints(entryId, gw, liveMapMaybe) {
  // 1) LIVE calc
  try {
    const liveMap = liveMapMaybe ?? await getLivePointsMap(gw);
    if (liveMap) {
      const rPicks = await fetch(`/api/fpl?path=entry/${entryId}/event/${gw}/picks/`);
      if (rPicks.ok) {
        const picksJson = await rPicks.json();
        const picks = Array.isArray(picksJson?.picks) ? picksJson.picks : [];
        const liveTotal = picks.reduce((sum, p) => {
          const pts = liveMap[p.element] ?? 0;
          return sum + pts * Number(p.multiplier || 0); // bench=0, C=2, TC=3
        }, 0);
        if (Number.isFinite(liveTotal)) return liveTotal;
      }
    }
  } catch {}

  // 2) HISTORY (finished weeks)
  try {
    const rHist = await fetch(`/api/fpl?path=entry/${entryId}/history/`);
    if (rHist.ok) {
      const hist = await rHist.json();
      const events = Array.isArray(hist?.current) ? hist.current : (hist?.past_events || hist?.past || []);
      const row = events.find(e => Number(e?.event) === Number(gw));
      if (row && typeof row.points === 'number') return row.points;
    }
  } catch {}

  // 3) PICKS fallback
  try {
    const rPicks = await fetch(`/api/fpl?path=entry/${entryId}/event/${gw}/picks/`);
    if (rPicks.ok) {
      const data = await rPicks.json();
      if (data?.entry_history && typeof data.entry_history.points === 'number') {
        return data.entry_history.points;
      }
    }
  } catch {}

  return 0;
}

// Load static captain overrides from captains.json
async function fetchCaptainOverrides() {
  try {
    const res = await fetch('/captains.json');  // captains.json must be in /public folder
    if (!res.ok) return {};
    const data = await res.json();
    return data.byGw || {};
  } catch {
    return {};
  }
}

  async function loadResults() {
    const gw = parseInt(gwInput.value.trim(), 10);
    if (!gw || gw < 1 || gw > 38) {
      messageEl.textContent = 'Please enter a valid gameweek between 1 and 38.';
      return;
    }

    messageEl.textContent = '';
    resultsBody.innerHTML = '';
    captainEditor.style.display = 'none';
    captainSaveMsg.textContent = '';
    currentGw = gw;

const capOverrides = await fetchCaptainOverrides();
const gwCaptains = capOverrides[gw] || {};


    try {
      // 1) Build directory of manager names → entry IDs from league
      const directory = await fetchLeagueDirectory(LEAGUE_ID);
	const liveMap = await getLivePointsMap(gw);

      // 2) Compose results for your custom teams
      const results = [];
      let anyPending = false;

      for (const team of TEAMS) {
        const m1 = { ...team.members[0] };
        const m2 = { ...team.members[1] };

m1.entryId = resolveEntryId(directory, m1.manager, team.teamName);
m2.entryId = resolveEntryId(directory, m2.manager, team.teamName);

        if (!m1.entryId || !m2.entryId) {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td colspan="6">${team.teamName}: could not resolve ${
            !m1.entryId ? `"${m1.manager}"` : ''
          }${!m1.entryId && !m2.entryId ? ' and ' : ''}${!m2.entryId ? `"${m2.manager}"` : ''} in league ${LEAGUE_ID}.</td>`;
          resultsBody.appendChild(tr);
          continue;
        }
try { m1.points = await fetchManagerGwPoints(m1.entryId, gw, liveMap); } catch { m1.points = 0; anyPending = true; }
try { m2.points = await fetchManagerGwPoints(m2.entryId, gw, liveMap); } catch { m2.points = 0; anyPending = true; }


       // Check static overrides first (from captains.json), then localStorage, then fallback
let captainEntryId = gwCaptains[team.teamName] || getCaptainFor(gw, team.teamName);
let autoLowest = false;

if (!captainEntryId) {
  autoLowest = true;
  captainEntryId = (m1.points <= m2.points) ? m1.entryId : m2.entryId;
}


        const base = (m1.points || 0) + (m2.points || 0);
        const captainPoints = (captainEntryId === m1.entryId) ? m1.points : m2.points;
        const teamPoints = base + (captainPoints || 0);

        results.push({
  teamName: team.teamName,
  members: [m1, m2],
  captainEntryId,
  autoLowest,
  teamPoints
});

if (m1.points === 0 || m2.points === 0) anyPending = true;
} // <-- this closes the for (const team of TEAMS) loop

// Sort results by points desc, then alphabetically
results.sort((a, b) => {
  if (b.teamPoints !== a.teamPoints) return b.teamPoints - a.teamPoints;
  return a.teamName.localeCompare(b.teamName);
});

// 3) Render results table
results.forEach((team, idx) => {
  const tr = document.createElement('tr');
  const m1 = team.members[0];
  const m2 = team.members[1];
  const isCaptain1 = team.captainEntryId === m1.entryId;
  const isCaptain2 = team.captainEntryId === m2.entryId;
  …
});


        tr.innerHTML = `
          <td>${idx + 1}</td>
          <td>${team.teamName}</td>
          <td>${m1.manager} (${m1.points})</td>
          <td>${m2.manager} (${m2.points})</td>
          <td>${isCaptain1 ? m1.manager : (isCaptain2 ? m2.manager : '')}${team.autoLowest ? ' (auto)' : ''}</td>
          <td>${team.teamPoints}</td>
        `;
        resultsBody.appendChild(tr);
      });

      // 4) Status
      const ts = new Date().toLocaleString();
      let msg = `Last updated: ${ts}.`;
      if (anyPending) msg += ' Official points may still be updating.';
      messageEl.textContent = msg;

      // 5) Captain editor (localStorage)
      const capMap = getAllCaptainsForGw(gw);
      captainGwDisplay.textContent = gw;
      captainTableBody.innerHTML = '';
      results.forEach(team => {
        const m1 = team.members[0];
        const m2 = team.members[1];
        const radioName = `cap-${team.teamName.replace(/\s+/g, '-')}`;
       const selected = capMap[team.teamName] ?? gwCaptains[team.teamName] ?? null;

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${team.teamName}</td>
          <td>
            <label><input type="radio" name="${radioName}" value="${m1.entryId}" ${String(selected) === String(m1.entryId) ? 'checked' : ''}> ${m1.manager}</label>
            <label style="margin-left:12px;"><input type="radio" name="${radioName}" value="${m2.entryId}" ${String(selected) === String(m2.entryId) ? 'checked' : ''}> ${m2.manager}</label>
          </td>
        `;
        captainTableBody.appendChild(row);
      });
      captainEditor.style.display = 'block';
    } catch (err) {
      console.error(err);
      messageEl.textContent = err.message || 'Error fetching data.';
    }
  }

  // Events
  fetchBtn.addEventListener('click', loadResults);

  captainForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentGw) return;

    const chosen = {};
    captainTableBody.querySelectorAll('tr').forEach(row => {
      const teamName = row.children[0].textContent;
      const radios = row.querySelectorAll('input[type="radio"]');
      for (const r of radios) {
        if (r.checked) { chosen[teamName] = Number(r.value); break; }
      }
    });

    try {
      Object.entries(chosen).forEach(([teamName, entryId]) => {
        setCaptainFor(currentGw, teamName, entryId);
      });
      captainSaveMsg.textContent = 'Captains saved.';
      await loadResults();
    } catch (err) {
      captainSaveMsg.textContent = err.message || 'Error saving captains.';
    }
  });
});
