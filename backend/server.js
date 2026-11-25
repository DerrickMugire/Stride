const path = require('path');
const express = require('express');

const app = express();
const PORT = Number(process.env.PORT) || 8082;
const HOST = process.env.HOST || '127.0.0.1';
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const FETCH_TIMEOUT_MS = 6000;

const WEATHER_LABELS = {
  0: 'Clear Sky',
  1: 'Mainly Clear',
  2: 'Partly Cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime Fog',
  51: 'Light Drizzle',
  53: 'Drizzle',
  55: 'Dense Drizzle',
  61: 'Light Rain',
  63: 'Rain',
  65: 'Heavy Rain',
  71: 'Light Snow',
  73: 'Snow',
  75: 'Heavy Snow',
  80: 'Rain Showers',
  81: 'Heavy Showers',
  82: 'Violent Showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm Hail',
  99: 'Heavy Thunderstorm'
};

function padTwo(value) {
  return String(value).padStart(2, '0');
}

function isValidTimezone(zone) {
  try {
    Intl.DateTimeFormat('en-GB', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Upstream HTTP ${response.status}`);
  }

  return response.json();
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.socket.remoteAddress || '';
  const ip = rawIp.replace(/^::ffff:/, '');

  if (
    !ip ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.')
  ) {
    return '';
  }

  return ip;
}

function formatFallbackTime(zone) {
  const now = new Date();
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(now);

  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);

  return {
    time,
    date,
    datetime: `${date}T${time}`,
    unixMs: now.getTime()
  };
}

app.use(express.static(FRONTEND_DIR));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'stridemate', port: PORT });
});

app.get('/api/locate', async (req, res) => {
  const ip = getClientIp(req);
  const url = ip ? `https://ipwho.is/${encodeURIComponent(ip)}` : 'https://ipwho.is/';

  try {
    const data = await fetchJson(url);
    if (!data || data.success === false) {
      throw new Error(data?.message || 'IP lookup failed');
    }

    res.json({
      city: data.city || 'Unknown',
      country: data.country || '',
      countryCode: data.country_code || '',
      lat: Number(data.latitude),
      lon: Number(data.longitude),
      timezone: data.timezone?.id || 'UTC',
      source: 'ipwho.is'
    });
  } catch (err) {
    res.status(502).json({ error: 'Unable to detect location', detail: err.message });
  }
});

app.get('/api/cities', async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (query.length < 2) {
    return res.json({ results: [] });
  }

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`;
    const data = await fetchJson(url);

    const results = (data.results || []).map((item) => ({
      name: item.name,
      admin1: item.admin1 || '',
      country: item.country || '',
      countryCode: item.country_code || '',
      lat: Number(item.latitude),
      lon: Number(item.longitude),
      timezone: item.timezone || ''
    }));

    res.json({ results });
  } catch (err) {
    res.status(502).json({ error: 'City search failed', detail: err.message });
  }
});

app.get('/api/weather', async (req, res) => {
  const rawLat = String(req.query.lat ?? '').trim();
  const rawLon = String(req.query.lon ?? '').trim();
  const lat = Number(rawLat);
  const lon = Number(rawLon);

  const validCoords =
    rawLat &&
    rawLon &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180;

  if (!validCoords) {
    return res.status(400).json({ error: 'Valid lat and lon query parameters are required' });
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`;
    const data = await fetchJson(url);
    const current = data.current || {};

    res.json({
      tempC: Math.round(current.temperature_2m ?? 0),
      condition: WEATHER_LABELS[current.weather_code] || 'Clear Sky',
      windKmh: Math.round(current.wind_speed_10m ?? 0),
      timezone: data.timezone || '',
      source: 'open-meteo'
    });
  } catch (err) {
    res.status(502).json({ error: 'Weather lookup failed', detail: err.message });
  }
});

app.get('/api/time', async (req, res) => {
  const zone = String(req.query.zone || 'UTC').trim();
  if (!isValidTimezone(zone)) {
    return res.status(400).json({ error: 'Invalid IANA timezone' });
  }

  try {
    const url = `https://timeapi.io/api/time/current/zone?timeZone=${encodeURIComponent(zone)}`;
    const data = await fetchJson(url);
    if (!data || !data.dateTime) {
      throw new Error('Invalid timeapi response');
    }

    res.json({
      zone,
      datetime: data.dateTime,
      time: `${padTwo(data.hour)}:${padTwo(data.minute)}:${padTwo(data.seconds)}`,
      date: `${data.year}-${padTwo(data.month)}-${padTwo(data.day)}`,
      unixMs: Date.now(),
      source: 'timeapi.io'
    });
  } catch {
    res.json({ zone, ...formatFallbackTime(zone), source: 'intl-fallback' });
  }
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`StrideMate listening on http://${HOST}:${PORT}`);
});
