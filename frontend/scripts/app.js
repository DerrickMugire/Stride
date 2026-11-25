const STORAGE_KEY = 'stridemate_saved_runs';

const state = {
  city: 'Nairobi',
  countryCode: 'KE',
  lat: -1.2864,
  lon: 36.8172,
  timezone: 'Africa/Nairobi',
  tempC: null,
  weatherCondition: 'Loading',
  tempUnit: 'C',
  map: null,
  meMarker: null,
  routeLine: null,
  waypoints: [],
  distanceKm: 0,
  elapsedSec: 0,
  isPaused: false,
  workoutInterval: null,
  clockInterval: null,
  locationLocked: false,
  filter: 'All',
  search: '',
  sort: 'newest'
};

const screenHome = document.getElementById('screen-home');
const screenMap = document.getElementById('screen-map');
const homeWeather = document.getElementById('home-weather');
const homeCity = document.getElementById('home-city');
const homeTime = document.getElementById('home-time');
const homeStatus = document.getElementById('home-status');
const workoutMapEl = document.getElementById('workout-map');
const workoutTimerEl = document.getElementById('workout-timer');
const workoutDistanceEl = document.getElementById('workout-distance');
const workoutPaceEl = document.getElementById('workout-pace');
const activitySelect = document.getElementById('activity-select');
const undoWaypointBtn = document.getElementById('btn-undo-waypoint');
const pauseWorkoutBtn = document.getElementById('btn-pause-workout');
const citySearchInput = document.getElementById('city-search-input');
const citySearchResults = document.getElementById('city-search-results');
const runsDrawer = document.getElementById('runs-drawer');
const runsList = document.getElementById('runs-list');
const runsSearch = document.getElementById('runs-search');
const runsSort = document.getElementById('runs-sort');

function padTwo(value) {
  return String(value).padStart(2, '0');
}

function createEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${padTwo(hours)}:${padTwo(minutes)}:${padTwo(seconds)}`;
}

function formatPace(seconds, distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0.01 || !Number.isFinite(seconds) || seconds <= 0) {
    return '--:-- /km';
  }
  if (seconds / distanceKm >= 6000) {
    return '--:-- /km';
  }

  let mins = Math.floor(seconds / distanceKm / 60);
  let secs = Math.round((seconds / distanceKm) % 60);
  if (secs === 60) {
    mins += 1;
    secs = 0;
  }
  return `${padTwo(mins)}:${padTwo(secs)} /km`;
}

function renderWeather() {
  let tempText = `--°${state.tempUnit}`;
  if (Number.isFinite(state.tempC)) {
    const temp = state.tempUnit === 'F' ? (state.tempC * 9) / 5 + 32 : state.tempC;
    tempText = `${Math.round(temp)}°${state.tempUnit}`;
  }
  homeWeather.textContent = `${tempText} · ${state.weatherCondition}`;
}

function updateWorkoutMetrics() {
  workoutDistanceEl.textContent = `${state.distanceKm.toFixed(2)} km`;
  workoutPaceEl.textContent = formatPace(state.elapsedSec, state.distanceKm);
  undoWaypointBtn.disabled = state.waypoints.length < 2;
}

function haversineKm(pointA, pointB) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(pointB[0] - pointA[0]);
  const dLon = toRad(pointB[1] - pointA[1]);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(pointA[0])) * Math.cos(toRad(pointB[0])) * Math.sin(dLon / 2) ** 2;

  return 2 * 6371 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function showStatus(message) {
  homeStatus.textContent = message || '';
  homeStatus.hidden = !message;
}

function startHomeClock() {
  if (state.clockInterval) {
    clearInterval(state.clockInterval);
  }

  function updateClock() {
    try {
      homeTime.textContent = new Intl.DateTimeFormat('en-GB', {
        timeZone: state.timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(new Date());
    } catch {
      homeTime.textContent = new Date().toTimeString().slice(0, 8);
    }
  }

  updateClock();
  state.clockInterval = setInterval(updateClock, 1000);
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

async function refreshWeatherAndTime() {
  homeCity.textContent = state.countryCode ? `${state.city}, ${state.countryCode}` : state.city;

  try {
    const weather = await fetchJson(`/api/weather?lat=${state.lat}&lon=${state.lon}`);
    state.tempC = Number.isFinite(weather.tempC) ? weather.tempC : null;
    state.weatherCondition = weather.condition || 'Clear';
    if (weather.timezone) {
      state.timezone = weather.timezone;
    }
    renderWeather();
    showStatus('');
  } catch {
    state.tempC = null;
    state.weatherCondition = 'Unavailable';
    renderWeather();
    showStatus('Weather service unavailable');
  }

  try {
    const timeData = await fetchJson(`/api/time?zone=${encodeURIComponent(state.timezone)}`);
    if (timeData.time) {
      homeTime.textContent = timeData.time;
    }
  } catch {
    // Local Intl clock continues running as fallback
  }

  startHomeClock();
}

async function initHome() {
  startHomeClock();

  try {
    const location = await fetchJson('/api/locate');
    state.city = location.city || state.city;
    state.countryCode = location.countryCode || state.countryCode;
    if (Number.isFinite(location.lat)) state.lat = location.lat;
    if (Number.isFinite(location.lon)) state.lon = location.lon;
    state.timezone = location.timezone || state.timezone;
  } catch {
    showStatus('Using default location (auto-locate unavailable)');
  }

  await refreshWeatherAndTime();
}

function resetRoute() {
  state.waypoints = [];
  state.distanceKm = 0;
  if (state.routeLine) {
    state.routeLine.setLatLngs([]);
  }
  updateWorkoutMetrics();
}

function undoLastWaypoint() {
  if (state.waypoints.length < 2) return;
  if (state.waypoints.length === 2) {
    resetRoute();
    return;
  }

  state.waypoints.pop();
  let total = 0;
  for (let i = 1; i < state.waypoints.length; i += 1) {
    total += haversineKm(state.waypoints[i - 1], state.waypoints[i]);
  }
  state.distanceKm = total;

  if (state.routeLine) {
    state.routeLine.setLatLngs(state.waypoints);
  }
  updateWorkoutMetrics();
}

function ensureMap() {
  if (state.map) {
    state.map.setView([state.lat, state.lon], 14);
    state.meMarker.setLatLng([state.lat, state.lon]);
    setTimeout(() => state.map.invalidateSize(), 50);
    return;
  }

  workoutMapEl.classList.add('is-dark-map');
  state.map = L.map('workout-map', { zoomControl: false }).setView([state.lat, state.lon], 14);
  L.control.zoom({ position: 'bottomleft' }).addTo(state.map);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(state.map);

  state.meMarker = L.marker([state.lat, state.lon], {
    icon: L.divIcon({
      className: '',
      html: '<div class="me-marker"><span class="me-dot"></span><span class="me-tag">ME</span></div>',
      iconSize: [36, 40],
      iconAnchor: [18, 7]
    })
  }).addTo(state.map);

  state.routeLine = L.polyline([], {
    color: '#e4e4e7',
    weight: 4,
    opacity: 0.92
  }).addTo(state.map);

  state.map.on('click', (event) => {
    const point = [event.latlng.lat, event.latlng.lng];
    if (state.waypoints.length === 0) {
      state.waypoints.push([state.lat, state.lon]);
    }
    const previous = state.waypoints[state.waypoints.length - 1];
    state.distanceKm += haversineKm(previous, point);
    state.waypoints.push(point);
    state.routeLine.setLatLngs(state.waypoints);
    updateWorkoutMetrics();
  });
}

function setPaused(paused) {
  state.isPaused = paused;
  pauseWorkoutBtn.textContent = paused ? 'Resume' : 'Pause';
  pauseWorkoutBtn.classList.toggle('is-paused', paused);
}

function openMapScreen() {
  screenHome.hidden = true;
  screenMap.hidden = false;
  state.locationLocked = false;
  resetRoute();
  ensureMap();

  if (state.workoutInterval) {
    clearInterval(state.workoutInterval);
  }

  state.elapsedSec = 0;
  setPaused(false);
  workoutTimerEl.textContent = '00:00:00';
  updateWorkoutMetrics();

  state.workoutInterval = setInterval(() => {
    if (state.isPaused) return;
    state.elapsedSec += 1;
    workoutTimerEl.textContent = formatDuration(state.elapsedSec);
    updateWorkoutMetrics();
  }, 1000);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      if (state.locationLocked || state.waypoints.length > 0) return;
      state.lat = position.coords.latitude;
      state.lon = position.coords.longitude;
      state.map.setView([state.lat, state.lon], 15);
      state.meMarker.setLatLng([state.lat, state.lon]);
    }, () => {});
  }
}

function returnHome() {
  if (state.workoutInterval) {
    clearInterval(state.workoutInterval);
    state.workoutInterval = null;
  }

  setPaused(false);
  resetRoute();
  citySearchResults.hidden = true;
  screenMap.hidden = true;
  screenHome.hidden = false;
}

function loadRuns() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRuns(runs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
}

function renderRuns() {
  const query = state.search.trim().toLowerCase();
  const runs = loadRuns().filter((run) => {
    const matchesType = state.filter === 'All' || run.activity === state.filter;
    const matchesText =
      !query ||
      run.location.toLowerCase().includes(query) ||
      run.activity.toLowerCase().includes(query);
    return matchesType && matchesText;
  });

  if (state.sort === 'longest-time') {
    runs.sort((a, b) => b.durationSec - a.durationSec);
  } else if (state.sort === 'longest-distance') {
    runs.sort((a, b) => b.distanceKm - a.distanceKm);
  } else {
    runs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  runsList.textContent = '';
  if (runs.length === 0) {
    runsList.appendChild(createEl('li', 'runs-empty', 'No saved runs match your filter.'));
    return;
  }

  runs.forEach((run) => {
    const item = createEl('li', 'run-item');
    const meta = createEl('div', 'run-meta');
    const dateLabel = new Date(run.createdAt).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const paceLabel = run.pace || formatPace(run.durationSec, run.distanceKm);

    meta.append(
      createEl('span', 'run-title', `${run.activity} - ${run.location}`),
      createEl('span', 'run-sub', `${formatDuration(run.durationSec)} · ${run.distanceKm.toFixed(2)} km · ${paceLabel} · ${dateLabel}`)
    );

    const deleteBtn = createEl('button', 'run-delete-btn', 'Delete');
    deleteBtn.type = 'button';
    deleteBtn.addEventListener('click', () => {
      saveRuns(loadRuns().filter((entry) => entry.id !== run.id));
      renderRuns();
    });

    item.append(meta, deleteBtn);
    runsList.appendChild(item);
  });
}

let searchTimeout = null;
let searchSeq = 0;

citySearchInput.addEventListener('input', () => {
  const query = citySearchInput.value.trim();
  const requestId = ++searchSeq;

  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  if (query.length < 2) {
    citySearchResults.hidden = true;
    citySearchResults.textContent = '';
    return;
  }

  searchTimeout = setTimeout(async () => {
    try {
      const data = await fetchJson(`/api/cities?q=${encodeURIComponent(query)}`);
      if (requestId !== searchSeq) return;

      citySearchResults.textContent = '';
      if (!data.results || data.results.length === 0) {
        citySearchResults.hidden = true;
        return;
      }

      data.results.forEach((city) => {
        const li = createEl('li');
        const region = [city.admin1, city.country].filter(Boolean).join(', ');
        const btn = createEl('button', 'search-result-btn', region ? `${city.name}, ${region}` : city.name);
        btn.type = 'button';

        btn.addEventListener('click', () => {
          state.locationLocked = true;
          state.city = city.name;
          state.countryCode = city.countryCode || '';
          state.lat = city.lat;
          state.lon = city.lon;
          if (city.timezone) {
            state.timezone = city.timezone;
          }

          citySearchInput.value = city.name;
          citySearchResults.hidden = true;
          resetRoute();

          if (state.map) {
            state.map.setView([state.lat, state.lon], 13);
            state.meMarker.setLatLng([state.lat, state.lon]);
          }
          refreshWeatherAndTime();
        });

        li.appendChild(btn);
        citySearchResults.appendChild(li);
      });

      citySearchResults.hidden = false;
    } catch {
      if (requestId === searchSeq) {
        citySearchResults.hidden = true;
      }
    }
  }, 300);
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.search-box')) {
    citySearchResults.hidden = true;
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    citySearchResults.hidden = true;
    runsDrawer.hidden = true;
  }
});

homeWeather.addEventListener('click', () => {
  state.tempUnit = state.tempUnit === 'C' ? 'F' : 'C';
  renderWeather();
});

document.getElementById('btn-start-workout').addEventListener('click', openMapScreen);
document.getElementById('btn-back-home').addEventListener('click', returnHome);
undoWaypointBtn.addEventListener('click', undoLastWaypoint);
pauseWorkoutBtn.addEventListener('click', () => setPaused(!state.isPaused));
activitySelect.addEventListener('change', updateWorkoutMetrics);

document.getElementById('btn-stop-workout').addEventListener('click', () => {
  const runs = loadRuns();
  runs.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    activity: activitySelect.value,
    location: state.countryCode ? `${state.city}, ${state.countryCode}` : state.city,
    durationSec: state.elapsedSec,
    distanceKm: Number(state.distanceKm.toFixed(2)),
    pace: formatPace(state.elapsedSec, state.distanceKm),
    createdAt: new Date().toISOString()
  });
  saveRuns(runs);
  returnHome();
});

document.getElementById('btn-open-runs').addEventListener('click', () => {
  renderRuns();
  runsDrawer.hidden = false;
});
document.getElementById('btn-close-runs').addEventListener('click', () => {
  runsDrawer.hidden = true;
});
document.getElementById('drawer-backdrop').addEventListener('click', () => {
  runsDrawer.hidden = true;
});
runsSearch.addEventListener('input', () => {
  state.search = runsSearch.value;
  renderRuns();
});
runsSort.addEventListener('change', () => {
  state.sort = runsSort.value;
  renderRuns();
});

const filterPills = document.querySelectorAll('.filter-pill');
filterPills.forEach((pill) => {
  pill.addEventListener('click', () => {
    filterPills.forEach((btn) => btn.classList.remove('is-selected'));
    pill.classList.add('is-selected');
    state.filter = pill.dataset.filter;
    renderRuns();
  });
});

initHome();
