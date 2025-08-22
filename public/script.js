/*
  Front‑end logic for FPL mini‑league points (v2).

  This script fetches official scores for a fixed league (ID 498513)
  and displays the aggregated team totals. Each team consists of two
  players; their points are summed and the captain’s points are
  doubled. Captains can be set on a per‑gameweek basis via a simple
  form. If a captain is not set for a team, the member with the
  lower score is automatically used and flagged as "auto".

  API endpoints provided by the server:
    GET  /api/gw/:gw           → returns team scores for the GW
    GET  /api/captains/:gw     → returns captain assignments for GW
    POST /api/captains/:gw     → updates captain assignments for GW

  The script shows a results table and a captain editor. It also
  displays a timestamp and warns if some official scores may still be
  updating (points of 0).
*/

document.addEventListener('DOMContentLoaded', () => {
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

  async function loadResults() {
    const gw = parseInt(gwInput.value.trim(), 10);
    if (!gw || gw < 1 || gw > 38) {
      messageEl.textContent = 'Please enter a valid gameweek between 1 and 38.';
      return;
    }
    // Reset UI
    messageEl.textContent = '';
    resultsBody.innerHTML = '';
    captainEditor.style.display = 'none';
    captainSaveMsg.textContent = '';

    try {
      // Fetch team results
      const gwRes = await fetch(`/api/gw/${gw}`);
      if (!gwRes.ok) {
        const errData = await gwRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to fetch results');
      }
      const { results, timestamp } = await gwRes.json();
      currentGw = gw;

      let anyPending = false;
      // Build results table
      results.forEach((team, idx) => {
        const tr = document.createElement('tr');
        if (team.error) {
          tr.innerHTML = `<td colspan="6">${team.teamName || team.name}: ${team.error}</td>`;
          resultsBody.appendChild(tr);
          return;
        }
        const m1 = team.members[0];
        const m2 = team.members[1];
        const isCaptain1 = team.captainEntryId === m1.entryId;
        const isCaptain2 = team.captainEntryId === m2.entryId;
        if (m1.points === 0 || m2.points === 0) {
          anyPending = true;
        }
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
      const ts = timestamp ? new Date(timestamp).toLocaleString() : '';
      let msg = ts ? `Last updated: ${ts}.` : '';
      if (anyPending) {
        msg += (msg ? ' ' : '') + 'Official points may still be updating.';
      }
      messageEl.textContent = msg;
      // Build captain editor
      const capRes = await fetch(`/api/captains/${gw}`);
      let capMap = {};
      if (capRes.ok) {
        capMap = await capRes.json().catch(() => ({}));
      }
      captainGwDisplay.textContent = gw;
      captainTableBody.innerHTML = '';
      results.forEach(team => {
        if (team.error) return;
        const row = document.createElement('tr');
        const m1 = team.members[0];
        const m2 = team.members[1];
        const radioName = `captain-${team.teamName.replace(/\s+/g, '-')}`;
        const selected = capMap[team.teamName];
        row.innerHTML = `
          <td>${team.teamName}</td>
          <td>
            <label><input type="radio" name="${radioName}" value="${m1.entryId}" ${selected === m1.entryId ? 'checked' : ''}> ${m1.manager}</label>
            <label><input type="radio" name="${radioName}" value="${m2.entryId}" ${selected === m2.entryId ? 'checked' : ''}> ${m2.manager}</label>
          </td>
        `;
        captainTableBody.appendChild(row);
      });
      captainEditor.style.display = 'block';
    } catch (err) {
      messageEl.textContent = err.message || 'Error fetching data.';
    }
  }

  fetchBtn.addEventListener('click', loadResults);

  captainForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentGw) return;
    const body = {};
    // Gather selected captains
    captainTableBody.querySelectorAll('tr').forEach(row => {
      const teamName = row.children[0].textContent;
      const radios = row.querySelectorAll('input[type="radio"]');
      radios.forEach(radio => {
        if (radio.checked) {
          body[teamName] = parseInt(radio.value, 10);
        }
      });
    });
    try {
      const res = await fetch(`/api/captains/${currentGw}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save captains');
      }
      captainSaveMsg.textContent = 'Captains saved.';
      // Refresh results to reflect new captain picks
      await loadResults();
    } catch (err) {
      captainSaveMsg.textContent = err.message || 'Error saving captains.';
    }
  });
});