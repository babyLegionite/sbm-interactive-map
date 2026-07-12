/**
 * California Victorville Mission Map
 * Light theme + custom building icons + boundary support
 */

// --- Configuration ---
const ZONE_COLORS = {
    'Apple Valley':      '#2c5282',
    'Victorville':       '#c53030',
    'San Bernardino':    '#2f855a',
    'Fontana':           '#c05621',
    'Hesperia':          '#6b46c1',
    'Redlands':          '#0987a0',
    'Rialto':            '#b7791f',
    'Yucaipa':           '#2b6cb0',
    'Yucca Valley':      '#276749',
    'Palm Desert':       '#c05621',
    'Senior Missionaries':'#9b2c2c',
    'Mission Home':      '#285e61',
    'AV': '#2c5282', 'VV': '#c53030', 'SB': '#2f855a',
    'FN': '#c05621', 'HE': '#6b46c1', 'RD': '#0987a0',
    'RI': '#b7791f', 'YP': '#2b6cb0', 'YV': '#276749', 'PD': '#c05621',
};

const MAP_CENTER = [34.25, -117.25];
const MAP_ZOOM = 9;

// --- Custom SVG Icons ---
const ICONS = {
    chapel: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
        <rect x="4" y="8" width="16" height="14" rx="1" fill="COLOR" stroke="#fff" stroke-width="1.5"/>
        <polygon points="12,2 4,10 20,10" fill="COLOR" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
        <line x1="12" y1="14" x2="12" y2="20" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
        <circle cx="12" cy="12" r="1.5" fill="#fff"/>
    </svg>`,
    stake_center: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">
        <rect x="4" y="8" width="20" height="17" rx="1.5" fill="COLOR" stroke="#fff" stroke-width="1.5"/>
        <polygon points="14,1 3,10 25,10" fill="COLOR" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
        <polygon points="14,4 17,8 11,8" fill="#FFD700" stroke="#fff" stroke-width="1"/>
        <line x1="14" y1="13" x2="14" y2="22" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="14" cy="11" r="2" fill="#fff"/>
    </svg>`,
    housing: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20">
        <rect x="3" y="8" width="14" height="10" rx="1" fill="COLOR" stroke="#fff" stroke-width="1.5"/>
        <polygon points="10,1 2,9 18,9" fill="COLOR" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
        <rect x="7" y="12" width="6" height="6" rx="0.5" fill="#fff" opacity="0.5"/>
    </svg>`,
};

function svgIcon(svg, color) {
    return 'data:image/svg+xml,' + encodeURIComponent(svg.replace('COLOR', color));
}

// --- State ---
let locations = [];
let markers = [];
let markerCluster;
let activeZones = new Set();
let map;
let boundaries = {}; // GeoJSON layers by stake name

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
    map = initMap();
    markerCluster = L.markerClusterGroup({
        maxClusterRadius: 45,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        disableClusteringAtZoom: 15,
    });
    map.addLayer(markerCluster);

    await loadData();
    buildZoneFilters();
    buildStats();
    setupSearch();
    setupButtons();
    renderAllMarkers();
    loadBoundaries(); // Try loading boundaries if available
});

function initMap() {
    const m = L.map('map', {
        center: MAP_CENTER, zoom: MAP_ZOOM,
        zoomControl: true, preferCanvas: true,
    });

    // Light theme tiles (CartoDB Positron)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd', maxZoom: 19,
    }).addTo(m);

    return m;
}

// --- Data Loading ---
async function loadData() {
    try {
        const resp = await fetch('data/locations_geocoded.json');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        locations = await resp.json();
        document.getElementById('location-count').textContent = `${locations.length} Locations`;
        console.log(`Loaded ${locations.length} locations`);
    } catch (err) {
        console.error('Failed to load geocoded data, trying raw...', err);
        try {
            const resp = await fetch('data/locations_raw.json');
            locations = await resp.json();
            document.getElementById('location-count').textContent = `${locations.length} Locations (some unplaced)`;
        } catch (err2) {
            console.error('Failed to load any data', err2);
        }
    }
}

// --- Boundary Loading ---
async function loadBoundaries() {
    // Try to load stake and ward boundary GeoJSON if available
    try {
        const resp = await fetch('data/boundaries.json');
        if (resp.ok) {
            const data = await resp.json();
            renderBoundaries(data);
        }
    } catch (e) {
        // Boundaries not yet available — that's OK
        console.log('No boundary data yet — will render when available');
    }
}

function renderBoundaries(data) {
    // Clear existing boundary layers
    Object.values(boundaries).forEach(layer => map.removeLayer(layer));
    boundaries = {};

    Object.entries(data).forEach(([stakeName, geoJson]) => {
        const layer = L.geoJSON(geoJson, {
            style: {
                color: '#2c5282', weight: 2, opacity: 0.7,
                fillColor: '#2c5282', fillOpacity: 0.05,
            },
        }).addTo(map);
        boundaries[stakeName] = layer;
    });
}

// --- Zone Helpers ---
function normalizeZone(zone) {
    if (!zone) return 'Unknown';
    const codeMap = {
        'AV': 'Apple Valley', 'VV': 'Victorville', 'SB': 'San Bernardino',
        'FN': 'Fontana', 'HE': 'Hesperia', 'RD': 'Redlands',
        'RI': 'Rialto', 'YP': 'Yucaipa', 'YV': 'Yucca Valley', 'PD': 'Palm Desert',
    };
    const upper = zone.trim().toUpperCase();
    if (codeMap[upper]) return codeMap[upper];
    return zone.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function getZoneColor(zone) {
    const normalized = normalizeZone(zone);
    for (const [key, color] of Object.entries(ZONE_COLORS)) {
        if (normalizeZone(key) === normalized) return color;
    }
    let hash = 0;
    for (let i = 0; i < zone.length; i++) hash = zone.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 45%, 40%)`;
}

// --- Zone Filters ---
function buildZoneFilters() {
    const zoneCounts = {};
    locations.forEach(loc => {
        const zone = normalizeZone(loc.zone);
        zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
    });
    const sorted = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1]);
    const zoneList = document.getElementById('zone-list');
    zoneList.innerHTML = '';
    sorted.forEach(([zone, count]) => {
        activeZones.add(zone);
        const chip = document.createElement('span');
        chip.className = 'zone-chip active';
        chip.dataset.zone = zone;
        chip.innerHTML = `<span class="zone-dot" style="background:${getZoneColor(zone)}"></span>${zone} (${count})`;
        chip.addEventListener('click', () => toggleZone(zone, chip));
        zoneList.appendChild(chip);
    });
    document.getElementById('zone-count').textContent = `${sorted.length} zones`;
}

function toggleZone(zone, chip) {
    if (activeZones.has(zone)) { activeZones.delete(zone); chip.classList.remove('active'); chip.classList.add('inactive'); }
    else { activeZones.add(zone); chip.classList.add('active'); chip.classList.remove('inactive'); }
    renderAllMarkers();
}

// --- Marker Type Detection ---
function getMarkerType(loc) {
    const name = (loc.name || '').toLowerCase();
    const street = (loc.street || '').toLowerCase();
    // Detect stake centers
    if (name.includes('stake') || name.includes('mission home') || name.includes('mission office')) return 'stake_center';
    // Detect chapels/ward buildings
    if (name.includes('ward') || street.includes('chapel') || name.match(/^(sb|vv|av|fn|he|rd|ri|yp|yv|pd)-\d+\s+.*ward/i)) return 'chapel';
    // Everything else is housing
    return 'housing';
}

// --- Markers ---
function createMarkerIcon(loc) {
    const zone = normalizeZone(loc.zone);
    const color = getZoneColor(zone);
    const type = getMarkerType(loc);
    const size = loc.lat ? 1 : 0;

    const iconSvg = ICONS[type] || ICONS.housing;
    const iconUrl = svgIcon(iconSvg, color);

    const sizes = { chapel: [22, 22], stake_center: [28, 28], housing: [18, 18] };
    const [w, h] = sizes[type] || [18, 18];

    return L.icon({
        iconUrl: iconUrl,
        iconSize: [w, h],
        iconAnchor: [w/2, h],
        popupAnchor: [0, -h],
    });
}

function createPopupContent(loc) {
    const zone = normalizeZone(loc.zone);
    const color = getZoneColor(zone);
    const type = getMarkerType(loc);
    const typeLabel = type === 'stake_center' ? 'Stake Center' : type === 'chapel' ? 'Ward Building' : 'Housing';

    let html = `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;min-width:200px;">`;
    html += `<strong style="font-size:14px;">${escapeHtml(loc.name)}</strong>`;
    html += `<span style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:8px;
        font-size:10px;font-weight:600;color:#fff;background:${color};">${zone}</span>`;
    html += `<span style="display:inline-block;margin-left:4px;padding:1px 6px;border-radius:8px;
        font-size:9px;font-weight:500;color:${color};background:${color}18;border:1px solid ${color}40;">${typeLabel}</span>`;
    html += `<hr style="border:none;border-top:1px solid #e8e4dc;margin:6px 0;">`;
    if (loc.street) html += `<div style="font-size:12px;margin-bottom:2px;">📍 ${escapeHtml(loc.street)}</div>`;
    if (loc.city) html += `<div style="font-size:11px;color:#736b5c;">${escapeHtml(loc.city)}</div>`;
    if (loc.lat && loc.lng) {
        html += `<a href="https://www.google.com/maps?q=${loc.lat},${loc.lng}" target="_blank"
            style="display:inline-block;margin-top:4px;font-size:11px;color:#2c5282;text-decoration:none;">
            ↗ Open in Google Maps</a>`;
    }
    html += `</div>`;
    return html;
}

function renderAllMarkers() {
    markerCluster.clearLayers();
    markers = [];
    locations.forEach(loc => {
        const zone = normalizeZone(loc.zone);
        if (!activeZones.has(zone)) return;
        if (!loc.lat || !loc.lng) return;
        const marker = L.marker([loc.lat, loc.lng], { icon: createMarkerIcon(loc) });
        marker.bindPopup(createPopupContent(loc), { maxWidth: 300, className: 'sbm-popup' });
        marker._sbmData = loc;
        markers.push(marker);
    });
    markerCluster.addLayers(markers);
    document.getElementById('location-count').textContent = `${markers.length} visible / ${locations.length} total`;
}

function escapeHtml(str) {
    const div = document.createElement('div'); div.textContent = str; return div.innerHTML;
}

// --- Search ---
function setupSearch() {
    const input = document.getElementById('search-input');
    const btn = document.getElementById('btn-search');
    const doSearch = () => {
        const query = input.value.trim().toLowerCase();
        if (!query) { document.getElementById('results-list').innerHTML = ''; document.getElementById('results-count').textContent = ''; return; }
        const results = locations.filter(loc => {
            return `${loc.name} ${loc.street} ${loc.city} ${loc.zone} ${loc.address}`.toLowerCase().includes(query);
        });
        const resultsList = document.getElementById('results-list');
        document.getElementById('results-count').textContent = `${results.length} found`;
        resultsList.innerHTML = results.slice(0, 50).map(loc => {
            const zone = normalizeZone(loc.zone), color = getZoneColor(zone);
            return `<div class="result-item" onclick="focusLocation(${loc.lat}, ${loc.lng}, '${escapeHtml(loc.name)}')">
                <div class="result-name">${escapeHtml(loc.name)}</div>
                <div class="result-address">${escapeHtml(loc.street || '')} — ${escapeHtml(loc.city || '')}</div>
                <span class="result-zone" style="background:${color};color:#fff;">${zone}</span>
            </div>`;
        }).join('');
    };
    input.addEventListener('input', doSearch);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
    btn.addEventListener('click', doSearch);
}

function focusLocation(lat, lng, name) {
    if (!lat || !lng) return;
    map.setView([lat, lng], 16);
    markers.forEach(m => {
        const ll = m.getLatLng();
        if (Math.abs(ll.lat - lat) < 0.0001 && Math.abs(ll.lng - lng) < 0.0001) m.openPopup();
    });
}

// --- Buttons ---
function setupButtons() {
    document.getElementById('btn-fit').addEventListener('click', () => {
        if (markers.length === 0) return;
        map.fitBounds(L.featureGroup(markers).getBounds().pad(0.05));
    });
    document.getElementById('btn-print').addEventListener('click', () => {
        const legendContent = document.getElementById('print-legend-content');
        const zones = [...activeZones].sort();
        legendContent.innerHTML = zones.map(zone => `
            <div style="display:flex;align-items:center;gap:4px;font-size:9px;">
                <div style="width:8px;height:8px;border-radius:50%;background:${getZoneColor(zone)};border:1px solid #999;"></div>${zone}
            </div>`).join('');
        if (markers.length > 0) map.fitBounds(L.featureGroup(markers).getBounds().pad(0.05));
        setTimeout(() => window.print(), 300);
    });
}

// --- Stats ---
function buildStats() {
    const zoneCounts = {}; let withCoords = 0, withoutCoords = 0;
    locations.forEach(loc => {
        const zone = normalizeZone(loc.zone);
        zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
        if (loc.lat) withCoords++; else withoutCoords++;
    });
    const sorted = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1]);
    document.getElementById('stats-content').innerHTML = `
        <div><strong>${locations.length}</strong> total</div>
        <div><strong>${withCoords}</strong> mapped</div>
        ${withoutCoords > 0 ? `<div><strong>${withoutCoords}</strong> unplaced</div>` : ''}
        <hr>
        ${sorted.slice(0, 5).map(([z, c]) => `
            <div style="display:flex;align-items:center;gap:6px;margin:2px 0;">
                <span style="width:7px;height:7px;border-radius:50%;background:${getZoneColor(z)};"></span>
                ${z}: <strong>${c}</strong>
            </div>`).join('')}
    `;
}