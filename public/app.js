// ===== Port Steamer — App Logic =====

(function () {
  'use strict';

  // --- State ---
  let steamGames = [];
  let portmasterPorts = {};
  let matchedGames = [];
  let activeFilter = 'all';

  let serverHasApiKey = false;

  // --- DOM refs ---
  const setupSection = document.getElementById('setup-section');
  const loadingSection = document.getElementById('loading-section');
  const resultsSection = document.getElementById('results-section');
  const setupForm = document.getElementById('setup-form');
  const apiKeyGroup = document.getElementById('api-key-group');
  const apiKeyInput = document.getElementById('api-key');
  const btnScan = document.getElementById('btn-scan');
  const errorMessage = document.getElementById('error-message');
  const headerStats = document.getElementById('header-stats');
  const resultsGrid = document.getElementById('results-grid');
  const noResults = document.getElementById('no-results');
  const searchInput = document.getElementById('search-input');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalContent = document.getElementById('modal-content');
  const modalClose = document.getElementById('modal-close');
  const loadingTitle = document.getElementById('loading-title');
  const loadingSubtitle = document.getElementById('loading-subtitle');
  const progressFill = document.getElementById('progress-fill');
  const deviceFilter = document.getElementById('device-filter');

  // --- Init ---
  checkConfig();
  loadDevices();

  // --- Check server config ---
  async function checkConfig() {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      serverHasApiKey = data.hasApiKey;
      if (!serverHasApiKey) {
        apiKeyGroup.style.display = '';
        apiKeyInput.required = true;
      }
    } catch (e) {
      console.warn('Could not load config:', e);
    }
  }

  // --- Load device list ---
  async function loadDevices() {
    try {
      const res = await fetch('/api/devices');
      const data = await res.json();
      if (data.devices) {
        // Group devices by prefix for readability
        const deviceNames = {
          'rg-arc-d': 'Anbernic RG Arc-D',
          'rg-arc-s': 'Anbernic RG Arc-S',
          'rg353m': 'Anbernic RG353M',
          'rg353ps': 'Anbernic RG353PS',
          'rg351mp': 'Anbernic RG351MP',
          'rg503': 'Anbernic RG503',
          'rg552': 'Anbernic RG552',
          'rgcubexx': 'Anbernic RG Cube XX',
          'rg40xx-h': 'Anbernic RG40XX-H',
          'rg40xx-v': 'Anbernic RG40XX-V',
          'rg35xx-plus': 'Anbernic RG35XX Plus',
          'rg35xx-h': 'Anbernic RG35XX-H',
          'rg35xx-sp': 'Anbernic RG35XX-SP',
          'rg34xx-h': 'Anbernic RG34XX-H',
          'rg34xx-sp': 'Anbernic RG34XX-SP',
          'rg28xx': 'Anbernic RG28XX',
          'rg351p': 'Anbernic RG351P',
          'rg351v': 'Anbernic RG351V',
          'rgb10': 'Powkiddy RGB10',
          'rgb20s': 'Powkiddy RGB20S',
          'rgb30': 'Powkiddy RGB30',
          'rk2023': 'Powkiddy RK2023',
          'x55': 'Powkiddy X55',
          'rgb10max3': 'Powkiddy RGB10 Max 3',
          'rgb10max3pro': 'Powkiddy RGB10 Max 3 Pro',
          'oga': 'OGA',
          'ogs': 'OGS',
          'ogu': 'OGU',
          'ace': 'Ace',
          'chi': 'Chi',
          'trimui-smart-pro': 'TrimUI Smart Pro',
          'trimui-brick': 'TrimUI Brick',
          'rp5': 'Retroid Pocket 5',
          'rpmini': 'Retroid Pocket Mini',
          'gkd-bubble': 'GKD Bubble',
          'steamdeck': 'Steam Deck',
          'xu10': 'XU10',
          'r33s': 'R33S',
          'r35s': 'R35S',
          'r36s': 'R36S',
        };

        for (const device of data.devices) {
          const opt = document.createElement('option');
          opt.value = device;
          opt.textContent = deviceNames[device] || device;
          deviceFilter.appendChild(opt);
        }
      }
    } catch (e) {
      console.warn('Could not load device list:', e);
    }
  }

  // --- Form submit ---
  setupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const apiKey = document.getElementById('api-key').value.trim();
    const steamId = document.getElementById('steam-id').value.trim();

    if (!serverHasApiKey && !apiKey) return;
    if (!steamId) return;

    showError('');
    showSection('loading');
    btnScan.disabled = true;

    try {
      // Step 1: Fetch Steam Library
      setLoading('Fetching your Steam library...', 'Connecting to Steam API');
      setProgress(15);

      const steamRes = await fetch(`/api/steam-library?key=${encodeURIComponent(apiKey)}&steamid=${encodeURIComponent(steamId)}`);
      const steamData = await steamRes.json();

      if (steamData.error && (!steamData.games || steamData.games.length === 0)) {
        throw new Error(steamData.error);
      }

      steamGames = steamData.games || [];
      setProgress(40);

      if (steamGames.length === 0) {
        throw new Error('No games found in your Steam library. Make sure your profile game details are set to Public.');
      }

      // Step 2: Fetch PortMaster Ports
      setLoading('Loading PortMaster catalog...', `Found ${steamGames.length} Steam games`);
      setProgress(55);

      const portRes = await fetch('/api/portmaster-ports');
      const portData = await portRes.json();

      if (portData.error) {
        throw new Error(portData.error);
      }

      portmasterPorts = portData.ports || {};
      setProgress(75);

      // Step 3: Match games
      setLoading('Matching your games...', `Comparing against ${portData.port_count} ports`);
      setProgress(85);

      const selectedDevice = deviceFilter.value;
      matchedGames = matchGames(steamGames, portmasterPorts, selectedDevice);
      setProgress(100);

      // Step 4: Show results
      await new Promise(r => setTimeout(r, 400));
      showSection('results');
      updateStats(matchedGames.length, steamGames.length, Object.keys(portmasterPorts).length);
      renderResults(matchedGames);

    } catch (err) {
      showSection('setup');
      showError(err.message);
    } finally {
      btnScan.disabled = false;
      const btnText = btnScan.querySelector('.btn-text');
      const btnLoader = btnScan.querySelector('.btn-loader');
      btnText.style.display = '';
      btnLoader.style.display = 'none';
    }
  });

  // --- Matching Engine ---
  function matchGames(steamLibrary, ports, deviceFilter) {
    const matches = [];
    const steamByAppId = new Map();
    const steamByNormalizedTitle = new Map();

    // Index Steam games
    for (const game of steamLibrary) {
      steamByAppId.set(game.appid, game);
      const normalized = normalizeTitle(game.name);
      if (normalized) {
        // Use array for collisions
        if (!steamByNormalizedTitle.has(normalized)) {
          steamByNormalizedTitle.set(normalized, []);
        }
        steamByNormalizedTitle.get(normalized).push(game);
      }
    }

    const matchedSteamIds = new Set();

    for (const [zipName, port] of Object.entries(ports)) {
      // Device filter
      if (deviceFilter && port.avail && port.avail.length > 0) {
        const deviceCompatible = port.avail.some(a => a.startsWith(deviceFilter + ':'));
        if (!deviceCompatible) continue;
      }

      let matchedGame = null;
      let matchType = null;

      // Strategy 1: Exact App ID match
      if (port.steamAppIds && port.steamAppIds.length > 0) {
        for (const appId of port.steamAppIds) {
          if (steamByAppId.has(appId)) {
            matchedGame = steamByAppId.get(appId);
            matchType = 'exact';
            break;
          }
        }
      }

      // Strategy 2: Fuzzy title match (only if no exact match)
      if (!matchedGame) {
        const portNormalized = normalizeTitle(port.title);
        if (portNormalized && steamByNormalizedTitle.has(portNormalized)) {
          const candidates = steamByNormalizedTitle.get(portNormalized);
          matchedGame = candidates[0]; // Take first match
          matchType = 'fuzzy';
        }
      }

      if (matchedGame && !matchedSteamIds.has(matchedGame.appid)) {
        matchedSteamIds.add(matchedGame.appid);
        matches.push({
          steamGame: matchedGame,
          port: port,
          portZip: zipName,
          matchType: matchType,
        });
      }
    }

    // Sort: exact matches first, then alphabetically
    matches.sort((a, b) => {
      if (a.matchType !== b.matchType) {
        return a.matchType === 'exact' ? -1 : 1;
      }
      return a.steamGame.name.localeCompare(b.steamGame.name);
    });

    return matches;
  }

  function normalizeTitle(title) {
    if (!title) return '';
    return title
      .toLowerCase()
      .replace(/['']/g, "'")       // Normalize apostrophes
      .replace(/&/g, 'and')        // & → and
      .replace(/[^a-z0-9\s]/g, '') // Remove non-alphanumeric
      .replace(/\b(the|a|an)\b/g, '') // Remove articles
      .replace(/\b(hd|deluxe|remastered|classic|redux|definitive|edition|goty|game of the year|enhanced|ultimate|complete|collection)\b/g, '')
      .replace(/\s+/g, ' ')        // Collapse whitespace
      .trim();
  }

  // --- Rendering ---
  function renderResults(games) {
    const filtered = filterGames(games);
    resultsGrid.innerHTML = '';

    if (filtered.length === 0) {
      noResults.style.display = '';
      return;
    }

    noResults.style.display = 'none';

    filtered.forEach((match, index) => {
      const card = createGameCard(match, index);
      resultsGrid.appendChild(card);
    });
  }

  function filterGames(games) {
    let filtered = games;
    const query = searchInput.value.toLowerCase().trim();

    // Apply filter
    if (activeFilter === 'exact') {
      filtered = filtered.filter(m => m.matchType === 'exact');
    } else if (activeFilter === 'fuzzy') {
      filtered = filtered.filter(m => m.matchType === 'fuzzy');
    } else if (activeFilter === 'rtr') {
      filtered = filtered.filter(m => m.port.rtr);
    }

    // Apply search
    if (query) {
      filtered = filtered.filter(m =>
        m.steamGame.name.toLowerCase().includes(query) ||
        m.port.title.toLowerCase().includes(query)
      );
    }

    return filtered;
  }

  function createGameCard(match, index) {
    const { steamGame, port, matchType } = match;
    const card = document.createElement('div');
    card.className = 'game-card';
    card.style.animationDelay = `${Math.min(index * 0.04, 1)}s`;

    const steamImgUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${steamGame.appid}/header.jpg`;
    const placeholderBg = `linear-gradient(135deg, hsl(${(steamGame.appid % 360)}, 40%, 25%), hsl(${(steamGame.appid % 360 + 60) % 360}, 40%, 15%))`;

    card.innerHTML = `
      <div class="card-header" style="background: ${placeholderBg}">
        <img src="${steamImgUrl}" alt="${escapeHtml(steamGame.name)}" loading="lazy"
             onerror="this.style.display='none'">
        <span class="match-badge ${matchType}">${matchType === 'exact' ? '✓ Exact' : '~ Title'}</span>
        ${port.rtr ? '<span class="rtr-badge">Ready to Run</span>' : ''}
      </div>
      <div class="card-body">
        <div class="card-title" title="${escapeHtml(steamGame.name)}">${escapeHtml(steamGame.name)}</div>
        <div class="card-port-name">Port: ${escapeHtml(port.title)}</div>
        <div class="card-desc">${escapeHtml(port.desc || 'No description available.')}</div>
        <div class="card-tags">
          ${port.genres.map(g => `<span class="tag">${escapeHtml(g)}</span>`).join('')}
        </div>
      </div>
    `;

    card.addEventListener('click', () => showModal(match));
    return card;
  }

  // --- Modal ---
  function showModal(match) {
    const { steamGame, port, matchType } = match;

    const storeLinks = (port.store || []).map(s => {
      const url = s.gameurl || s.url || '';
      const name = s.name || 'Store';
      if (url) {
        return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="modal-link">${escapeHtml(name)}</a>`;
      }
      return '';
    }).filter(Boolean).join('');

    const steamLink = `<a href="https://store.steampowered.com/app/${steamGame.appid}/" target="_blank" rel="noopener" class="modal-link">Steam Store</a>`;

    const installText = port.inst_md || port.inst || 'No install instructions available.';

    modalContent.innerHTML = `
      <h2>${escapeHtml(steamGame.name)}</h2>
      <div class="modal-meta">
        <span class="match-badge ${matchType}" style="position:static">${matchType === 'exact' ? '✓ Exact Match' : '~ Title Match'}</span>
        ${port.rtr ? '<span class="rtr-badge" style="position:static">Ready to Run</span>' : ''}
        ${port.genres.map(g => `<span class="tag">${escapeHtml(g)}</span>`).join('')}
      </div>

      <div class="modal-section">
        <h3>Description</h3>
        <p>${escapeHtml(port.desc || 'No description available.')}</p>
      </div>

      <div class="modal-section">
        <h3>PortMaster Details</h3>
        <p>
          <strong>Port Name:</strong> ${escapeHtml(port.title)}<br>
          <strong>Ported by:</strong> ${escapeHtml(port.porter.join(', ') || 'Unknown')}<br>
          <strong>Architectures:</strong> ${escapeHtml(port.arch.join(', ') || 'Unknown')}<br>
          <strong>Added:</strong> ${escapeHtml(port.dateAdded || 'Unknown')}<br>
          <strong>Updated:</strong> ${escapeHtml(port.dateUpdated || 'Unknown')}
        </p>
      </div>

      <div class="modal-section">
        <h3>Install Instructions</h3>
        <div>${escapeHtml(installText)}</div>
      </div>

      <div class="modal-section">
        <h3>Links</h3>
        <div class="modal-links">
          ${steamLink}
          ${storeLinks}
        </div>
      </div>

      <div class="modal-section">
        <h3>Steam Playtime</h3>
        <p>${formatPlaytime(steamGame.playtime_forever || 0)} total</p>
      </div>
    `;

    modalOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modalOverlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // --- Search & Filters ---
  searchInput.addEventListener('input', () => renderResults(matchedGames));

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderResults(matchedGames);
    });
  });

  // --- Export ---
  const btnExport = document.getElementById('btn-export');
  const exportMenu = document.getElementById('export-menu');
  const exportCsv = document.getElementById('export-csv');
  const exportHtml = document.getElementById('export-html');

  btnExport.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu.style.display = exportMenu.style.display === 'none' ? 'block' : 'none';
  });

  document.addEventListener('click', () => {
    exportMenu.style.display = 'none';
  });

  exportCsv.addEventListener('click', () => {
    exportMenu.style.display = 'none';
    downloadCSV(matchedGames);
  });

  exportHtml.addEventListener('click', () => {
    exportMenu.style.display = 'none';
    downloadHTML(matchedGames);
  });

  function downloadCSV(matches) {
    const rows = [
      ['Steam Game', 'Steam App ID', 'PortMaster Port', 'Match Type', 'Genres', 'Ready to Run', 'Playtime (hours)', 'Install Notes'],
    ];

    for (const m of matches) {
      rows.push([
        m.steamGame.name,
        m.steamGame.appid,
        m.port.title,
        m.matchType,
        m.port.genres.join('; '),
        m.port.rtr ? 'Yes' : 'No',
        (m.steamGame.playtime_forever / 60).toFixed(1),
        (m.port.inst || '').replace(/\n/g, ' '),
      ]);
    }

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadFile('port-steamer-matches.csv', csv, 'text/csv');
  }

  function downloadHTML(matches) {
    const gameRows = matches.map(m => `
      <tr>
        <td>
          <img src="https://cdn.cloudflare.steamstatic.com/steam/apps/${m.steamGame.appid}/capsule_sm_120.jpg"
               alt="" style="width:120px;border-radius:4px;vertical-align:middle;margin-right:8px">
          <strong>${escapeHtml(m.steamGame.name)}</strong>
        </td>
        <td>${escapeHtml(m.port.title)}</td>
        <td><span style="background:${m.matchType === 'exact' ? '#16a34a20;color:#4ade80' : '#ca8a0420;color:#fbbf24'};padding:2px 8px;border-radius:12px;font-size:12px">${m.matchType === 'exact' ? '✓ Exact' : '~ Title'}</span></td>
        <td>${escapeHtml(m.port.genres.join(', '))}</td>
        <td>${m.port.rtr ? '✅' : '❌'}</td>
        <td>${(m.steamGame.playtime_forever / 60).toFixed(1)}h</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Port Steamer Report — ${matches.length} Matches</title>
<style>
  body { font-family: 'Segoe UI', -apple-system, sans-serif; background: #0a0e17; color: #e5e7eb; margin: 0; padding: 2rem; }
  h1 { color: #66c0f4; margin-bottom: 0.25rem; }
  .subtitle { color: #9ca3af; margin-bottom: 2rem; }
  table { width: 100%; border-collapse: collapse; background: #1b2838; border-radius: 12px; overflow: hidden; }
  th { background: #2a475e; color: #66c0f4; text-align: left; padding: 12px 16px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 14px; }
  tr:hover td { background: rgba(102,192,244,0.05); }
  tr:last-child td { border-bottom: none; }
  .footer { margin-top: 2rem; color: #6b7280; font-size: 12px; }
</style>
</head>
<body>
<h1>🎮 Port Steamer Report</h1>
<p class="subtitle">${matches.length} of your Steam games are available on PortMaster — Generated ${new Date().toLocaleDateString()}</p>
<table>
  <thead>
    <tr><th>Steam Game</th><th>PortMaster Port</th><th>Match</th><th>Genres</th><th>Ready to Run</th><th>Playtime</th></tr>
  </thead>
  <tbody>${gameRows}</tbody>
</table>
<p class="footer">Generated by Port Steamer</p>
</body>
</html>`;

    downloadFile('port-steamer-report.html', html, 'text/html');
  }

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Rescan ---
  document.getElementById('btn-rescan').addEventListener('click', () => {
    showSection('setup');
    matchedGames = [];
    headerStats.style.display = 'none';
  });

  // --- Helpers ---
  function showSection(section) {
    setupSection.style.display = section === 'setup' ? '' : 'none';
    loadingSection.style.display = section === 'loading' ? '' : 'none';
    resultsSection.style.display = section === 'results' ? '' : 'none';
  }

  function setLoading(title, subtitle) {
    loadingTitle.textContent = title;
    loadingSubtitle.textContent = subtitle;
  }

  function setProgress(pct) {
    progressFill.style.width = pct + '%';
  }

  function showError(msg) {
    if (msg) {
      errorMessage.textContent = msg;
      errorMessage.style.display = '';
    } else {
      errorMessage.style.display = 'none';
    }
  }

  function updateStats(matched, steam, ports) {
    document.getElementById('stat-matched').textContent = matched;
    document.getElementById('stat-steam').textContent = steam;
    document.getElementById('stat-ports').textContent = ports;
    headerStats.style.display = 'flex';
  }

  function formatPlaytime(minutes) {
    if (minutes < 60) return `${minutes} min`;
    const hrs = (minutes / 60).toFixed(1);
    return `${hrs} hrs`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
