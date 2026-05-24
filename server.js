const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Load .env file manually (no dotenv dependency) ---
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.slice(0, eqIndex).trim();
          const val = trimmed.slice(eqIndex + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}
loadEnv();

const STEAM_API_KEY = process.env.STEAM_API_KEY || '';

// --- PortMaster Cache ---
let portmasterCache = null;
let portmasterCacheTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

async function fetchPortmasterPorts() {
  const now = Date.now();
  if (portmasterCache && (now - portmasterCacheTime) < CACHE_DURATION) {
    return portmasterCache;
  }

  console.log('[PortMaster] Fetching ports.json from GitHub...');
  const res = await fetch(
    'https://raw.githubusercontent.com/PortsMaster/PortMaster-Info/main/ports.json'
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch PortMaster data: ${res.status}`);
  }

  const data = await res.json();
  portmasterCache = data;
  portmasterCacheTime = now;
  console.log(`[PortMaster] Cached ${Object.keys(data.ports || {}).length} ports`);
  return data;
}

// --- Static files ---
app.use(express.static(path.join(__dirname, 'public')));

// --- API: Check if server has an API key configured ---
app.get('/api/config', (req, res) => {
  res.json({
    hasApiKey: !!STEAM_API_KEY,
  });
});

// --- API: Get Steam Library ---
app.get('/api/steam-library', async (req, res) => {
  const { steamid } = req.query;

  // Use server-side key, fall back to client-provided key for backwards compat
  const apiKey = STEAM_API_KEY || req.query.key;

  if (!apiKey) {
    return res.status(400).json({
      error: 'No Steam API key configured. Set STEAM_API_KEY in your .env file.'
    });
  }

  if (!steamid) {
    return res.status(400).json({ error: 'Missing required parameter: steamid' });
  }

  try {
    // If the steamid looks like a vanity URL (not all digits), resolve it first
    let resolvedSteamId = steamid;
    if (!/^\d+$/.test(steamid)) {
      const vanityRes = await fetch(
        `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${encodeURIComponent(apiKey)}&vanityurl=${encodeURIComponent(steamid)}`
      );
      const vanityData = await vanityRes.json();
      if (vanityData.response?.success === 1) {
        resolvedSteamId = vanityData.response.steamid;
      } else {
        return res.status(400).json({ error: 'Could not resolve Steam profile URL. Try using your 64-bit Steam ID instead.' });
      }
    }

    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${encodeURIComponent(apiKey)}&steamid=${resolvedSteamId}&include_appinfo=true&include_played_free_games=true&format=json`;
    const steamRes = await fetch(url);
    const steamData = await steamRes.json();

    if (!steamData.response || !steamData.response.games) {
      return res.status(200).json({
        error: 'No games found. Make sure your Steam profile game details are set to Public.',
        games: [],
        game_count: 0
      });
    }

    res.json({
      game_count: steamData.response.game_count,
      games: steamData.response.games
    });
  } catch (err) {
    console.error('[Steam API Error]', err.message);
    res.status(500).json({ error: 'Failed to fetch Steam library: ' + err.message });
  }
});

// --- API: Get PortMaster Ports ---
app.get('/api/portmaster-ports', async (req, res) => {
  try {
    const data = await fetchPortmasterPorts();

    // Process ports into a cleaner format
    const ports = {};
    for (const [zipName, port] of Object.entries(data.ports || {})) {
      const attr = port.attr || {};
      const storeLinks = attr.store || [];

      // Extract Steam App IDs from store URLs
      const steamAppIds = [];
      for (const store of storeLinks) {
        const url = store.gameurl || store.url || '';
        const match = url.match(/store\.steampowered\.com\/app\/(\d+)/);
        if (match) {
          steamAppIds.push(parseInt(match[1], 10));
        }
      }

      ports[zipName] = {
        title: attr.title || zipName.replace('.zip', ''),
        desc: attr.desc || '',
        genres: attr.genres || [],
        porter: attr.porter || [],
        rtr: attr.rtr || false,
        inst: attr.inst || '',
        inst_md: attr.inst_md || '',
        arch: attr.arch || [],
        avail: attr.avail || [],
        store: storeLinks,
        steamAppIds,
        runtime: attr.runtime || [],
        image: attr.image || {},
        dateAdded: port.source?.date_added || '',
        dateUpdated: port.source?.date_updated || '',
        downloadUrl: port.source?.url || '',
        name: port.name || zipName
      };
    }

    res.json({ port_count: Object.keys(ports).length, ports });
  } catch (err) {
    console.error('[PortMaster Error]', err.message);
    res.status(500).json({ error: 'Failed to fetch PortMaster data: ' + err.message });
  }
});

// --- API: Extract unique devices from PortMaster data ---
app.get('/api/devices', async (req, res) => {
  try {
    const data = await fetchPortmasterPorts();
    const deviceSet = new Set();

    for (const port of Object.values(data.ports || {})) {
      const avail = port.attr?.avail || [];
      for (const entry of avail) {
        const device = entry.split(':')[0];
        if (device) deviceSet.add(device);
      }
    }

    const devices = Array.from(deviceSet).sort();
    res.json({ devices });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get device list: ' + err.message });
  }
});

// --- Fallback to index.html ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🎮 Port Steamer running at http://localhost:${PORT}`);
  if (STEAM_API_KEY) {
    console.log('✅ Steam API key loaded from .env');
  } else {
    console.log('⚠️  No STEAM_API_KEY in .env — users will need to provide their own key');
  }
  console.log('');
});
