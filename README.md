# StrideMate

StrideMate is a lightweight workout route tracker with live local weather and time. It runs on Node.js and Express with a plain HTML/CSS/JavaScript frontend and Leaflet for mapping.

## What it does

- **Home screen:** Shows your current city, weather (click the temperature to switch between °C and °F), and local time over a looping background video (`frontend/assets/bg.mp4`). Hit **START WORKOUT** to open the map, or open the top-right menu for **Saved Runs**.
- **Workout map:** Opens a dark OpenStreetMap view centered on your location. Click on the map to plot waypoints and measure distance, pace, and elapsed time for runs, walks, or rides. Supports undo, pause/resume, stop, and city search.
- **Saved runs:** Stores completed workouts in `localStorage` with search, activity filters, sorting, and delete.

## Running locally

```bash
cd backend
npm install
npm start
```

Then open `http://127.0.0.1:8082`.

## Server setup (`7348-*`)

- `7348-web-01` (`35.178.14.237`) and `7348-web-02` (`18.130.237.6`) run `node backend/server.js` via `systemd` bound to `127.0.0.1:8082`, behind Nginx on port `80` so `8082` stays internal.
- `7348-lb-01` (`18.132.9.132`) runs HAProxy in round-robin mode across both web servers, checking `/api/health`.

## APIs & credits

- Weather and city search: [Open-Meteo](https://open-meteo.com/)
- IP geolocation: [ipwho.is](https://ipwho.is/)
- Timezone lookup: [timeapi.io](https://timeapi.io/)
- Map tiles and rendering: [OpenStreetMap](https://www.openstreetmap.org/) and [Leaflet](https://leafletjs.com/)
