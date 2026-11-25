# StrideMate

StrideMate is a monochrome weather, live time, and workout route-mapping web application built with Node.js, Express, vanilla HTML/CSS/JavaScript, and Leaflet + OpenStreetMap.

**Live URL:** https://derickmugire.duckdns.org/  
**Repository:** https://github.com/DerrickMugire/Stride

## Features

- **Cloud Home:** Displays your detected city, live weather (click the temperature to toggle between `°C` and `°F`), and a live ticking local clock inside a frosted-glass cloud card over a looping background video (`frontend/assets/bg.mp4`).
- **Workout Map:** Full-bleed dark OpenStreetMap view via Leaflet centered on your `ME` marker. Click anywhere on the map to trace a route polyline and track live Haversine distance (`km`), elapsed `TIME` (`HH:MM:SS`), and live pace (`min/km`). Includes `Undo` waypoint, `Pause` / `Resume`, `Stop`, activity selector (`Run` / `Walk` / `Cycle`), and city search autocomplete.
- **Saved Runs Drawer:** Stores completed workouts in browser `localStorage` (`stridemate_saved_runs`) with search, activity filter (`All` / `Run` / `Walk` / `Cycle`), sorting (`Newest` / `Longest Time` / `Longest Distance`), and delete.

## Project Structure

```text
stridemate/
├── backend/
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── assets/
│   │   └── bg.mp4
│   ├── scripts/
│   │   └── app.js
│   ├── styles/
│   │   └── main.css
│   └── index.html
├── .gitignore
└── README.md
```

## Backend Endpoints

| Endpoint | Description | Upstream Source |
| :--- | :--- | :--- |
| `GET /api/health` | Health check used by HAProxy | Express |
| `GET /api/locate` | Detects visitor city, coordinates, and timezone from client IP | `ipwho.is` |
| `GET /api/cities?q=...` | Autocomplete city search | Open-Meteo Geocoding |
| `GET /api/weather?lat=...&lon=...` | Current temperature, condition, and wind speed | Open-Meteo Forecast |
| `GET /api/time?zone=...` | Current local time for an IANA timezone | `timeapi.io` (with `Intl` fallback) |

## Running Locally

**Prerequisites:** Node.js `18+` (for built-in `fetch`) and `npm`.

```bash
git clone https://github.com/DerrickMugire/Stride.git
cd Stride/backend
npm install
npm start
```

Open `http://127.0.0.1:8082` in your browser.

## Server & Load Balancer Deployment (`7348-*`)

The application is deployed across two web servers behind an HAProxy load balancer:

- **`7348-web-01` (`35.178.14.237`) & `7348-web-02` (`18.130.237.6`):**
  - Run `node /opt/stridemate/backend/server.js` under `systemd` (`stridemate.service`), bound strictly to `127.0.0.1:8082` so port `8082` is not exposed publicly.
  - Nginx listens on port `80`, proxies requests to `http://127.0.0.1:8082`, and adds the `X-Served-By` response header.
- **`7348-lb-01` (`18.132.9.132`):**
  - HAProxy balances traffic in `roundrobin` mode across `7348-web-01:80` and `7348-web-02:80` with `option httpchk GET /api/health` and `option forwardfor` so visitor IPs reach `/api/locate`.
  - Terminates Let's Encrypt TLS on `:443` for `derickmugire.duckdns.org` and redirects HTTP `:80` to HTTPS `:443`.

### Verifying Load Balancing & Endpoints

```bash
curl -sI https://derickmugire.duckdns.org/api/health | grep -iE "HTTP/|x-served-by"
curl -sI https://derickmugire.duckdns.org/api/health | grep -iE "HTTP/|x-served-by"
curl -s https://derickmugire.duckdns.org/api/locate
```

## APIs & Attribution

- **Weather & City Geocoding:** [Open-Meteo](https://open-meteo.com/)
- **IP Geolocation:** [ipwho.is](https://ipwho.is/)
- **Timezone & Current Time:** [timeapi.io](https://timeapi.io/)
- **Map Tiles & Rendering:** [OpenStreetMap](https://www.openstreetmap.org/) contributors via [Leaflet](https://leafletjs.com/)
- **Dynamic DNS & TLS:** [DuckDNS](https://www.duckdns.org/) and [Let's Encrypt](https://letsencrypt.org/)
