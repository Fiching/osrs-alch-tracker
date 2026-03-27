'use strict';

const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

const OSRS_UA      = 'OSRS-High-Alch-Tracker - self-hosted server, github.com/yourname/osrs-alch-tracker';
const MAPPING_URL  = 'https://prices.runescape.wiki/api/v1/osrs/mapping';
const LATEST_URL   = 'https://prices.runescape.wiki/api/v1/osrs/latest';
const FIVEMIN_URL  = 'https://prices.runescape.wiki/api/v1/osrs/5m';
const POLL_MS      = 15 * 60 * 1000; // 15 minutes

let cache = {
  data:        null,   // the fully merged payload sent to clients
  lastUpdated: null,   // ISO timestamp of last successful fetch
  nextUpdate:  null,   // ISO timestamp of next scheduled fetch
  error:       null,   // last error message, if any
};

// ---------------------------------------------------------------------------
// Fetch & merge all three OSRS endpoints into one payload
// ---------------------------------------------------------------------------
async function fetchFromOSRS() {
  const headers = { 'User-Agent': OSRS_UA };

  const [mappingRes, latestRes, fiveminRes] = await Promise.all([
    fetch(MAPPING_URL, { headers }),
    fetch(LATEST_URL,  { headers }),
    fetch(FIVEMIN_URL, { headers }),
  ]);

  if (!mappingRes.ok) throw new Error(`mapping ${mappingRes.status}`);
  if (!latestRes.ok)  throw new Error(`latest ${latestRes.status}`);
  if (!fiveminRes.ok) throw new Error(`5m ${fiveminRes.status}`);

  const mapping = await mappingRes.json();
  const latest  = await latestRes.json();
  const fivemin = await fiveminRes.json();

  const prices  = latest.data  || latest;
  const volumes = fivemin.data || fivemin;

  const NATURE_RUNE_ID = 561;
  const natureRune = prices[NATURE_RUNE_ID];
  const natureCost = natureRune
    ? (natureRune.high || natureRune.low || 202)
    : 202;

  const items = mapping
    .filter(item => item.highalch && item.highalch > 0)
    .map(item => {
      const p   = prices[item.id];
      const v   = volumes[item.id];
      const gePrice = p ? (p.high || p.low || null) : null;
      const volume  = v ? (v.highVolume || 0) + (v.lowVolume || 0) : null;
      const iconSlug = item.icon
        ? item.icon.replace(/ /g, '_').replace(/'/g, '%27')
        : null;
      return {
        id:        item.id,
        name:      item.name,
        members:   item.members,
        highalch:  item.highalch,
        lowalch:   item.lowalch,
        limit:     item.limit,
        iconSlug,
        gePrice,
        volume,
      };
    });

  return { items, natureCost };
}

// ---------------------------------------------------------------------------
// Polling loop — runs immediately on start, then every 15 minutes
// ---------------------------------------------------------------------------
async function refresh() {
  console.log('[cache] fetching OSRS prices…');
  const nextUpdate = new Date(Date.now() + POLL_MS).toISOString();
  try {
    const payload    = await fetchFromOSRS();
    cache.data        = payload;
    cache.lastUpdated = new Date().toISOString();
    cache.nextUpdate  = nextUpdate;
    cache.error       = null;
    console.log(`[cache] updated — ${payload.items.length} items, nature rune ${payload.natureCost} gp`);
  } catch (err) {
    cache.error      = err.message;
    cache.nextUpdate = nextUpdate;
    console.error('[cache] fetch failed:', err.message);
  }
}

refresh();
setInterval(refresh, POLL_MS);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Serve the frontend
app.use(express.static(path.join(__dirname, 'public')));

// JSON API — all clients hit this instead of the OSRS API directly
app.get('/api/prices', (req, res) => {
  if (!cache.data) {
    const status = cache.error ? 503 : 202;
    return res.status(status).json({
      error: cache.error || 'Cache is warming up, please retry shortly.',
      lastUpdated: cache.lastUpdated,
      nextUpdate:  cache.nextUpdate,
    });
  }
  res.json({
    ...cache.data,
    lastUpdated: cache.lastUpdated,
    nextUpdate:  cache.nextUpdate,
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status:      cache.error ? 'degraded' : 'ok',
    lastUpdated: cache.lastUpdated,
    nextUpdate:  cache.nextUpdate,
    itemCount:   cache.data?.items?.length ?? 0,
    error:       cache.error ?? null,
  });
});

app.listen(PORT, () => {
  console.log(`OSRS Alch Tracker running on http://localhost:${PORT}`);
});
