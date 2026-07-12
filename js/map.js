/**
 * SBM Interactive Map — Southern California Locations
 * Built with Leaflet.js + MarkerCluster
 */

// --- Configuration ---
const ZONE_COLORS = {
    'Apple Valley':      '#4a9eff',
    'Victorville':       '#e0556a',
    'San Bernardino':    '#50c878',
    'Fontana':           '#ffa500',
    'Hesperia':          '#9b59b6',
    'Redlands':          '#1abc9c',
    'Rialto':            '#e67e22',
    'Yucaipa':           '#3498db',
    'Yucca Valley':      '#2ecc71',
    'Palm Desert':       '#f39c12',
    'Senior Missionaries':'#e74c3c',
    'Mission Home':      '#00bcd4',
    // Shorthand codes
    'AV': '#4a9eff', 'VV': '#e0556a', 'SB': '#50c878',
    'FN': '#ffa500', 'HE': '#9b59b6', 'RD': '#1abc9c',
    'RI': '#e67e22', 'YP': '#3498db', 'YV': '#2ecc71',
    'PD': '#f39c12',
};

const MAP_CENTER = [34.25, -117.25]; // Apple Valley / Victorville area
const MAP_ZOOM = 9;

// --- State ---
let locations = [];
let markers = [];
let markerCluster;
let activeZones = new Set();
let map;

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
    map = initMap();
    markerCluster = L.markerClusterGroup({
        maxClusterRadius: 50,
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
});

function initMap() {
    const m = L.map('map', {
        center: MAP_CENTER,
        zoom: MAP_ZOOM,
        zoomControl: true,
        preferCanvas: true, // Better performance with many markers
    });

    // Dark-themed tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
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
            document.getElementById('location-count').textContent = 'Error loading data';
        }
    }
}

// --- Zone Helpers ---
function normalizeZone(zone) {
    if (!zone) return 'Unknown';
    // Map shorthand codes to full names
    const codeMap = {
        'AV': 'Apple Valley', 'VV': 'Victorville', 'SB': 'San Bernardino',
        'FN': 'Fontana', 'HE': 'Hesperia', 'RD': 'Redlands',
        'RI': 'Rialto', 'YP': 'Yucaipa', 'YV': 'Yucca Valley',
        'PD': 'Palm Desert',
    };
    const upper = zone.trim().toUpperCase();
    if (codeMap[upper]) return codeMap[upper];
    // Title case
    return zone.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function getZoneColor(zone) {
    const normalized = normalizeZone(zone);
    // Try full name, then shorthand
    for (const [key, color] of Object.entries(ZONE_COLORS)) {
        if (normalizeZone(key) === normalized) return color;
    }
    // Generate deterministic color from zone name
    let hash = 0;
    for (let i = 0; i < zone.length; i++) hash = zone.charCodeAt(i) + ((hash << 5) - hash);
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 55%, 55%)`;
}

// --- Zone Filters ---
function buildZoneFilters() {
    const zoneCounts = {};
    locations.forEach(loc => {
        const zone = normalizeZone(loc.zone);
        zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
    });

    // Sort by count descending
    const sorted = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1]);

    const zoneList = document.getElementById('zone-list');
    zoneList.innerHTML = '';

    sorted.forEach(([zone, count]) => {
        activeZones.add(zone); // All active by default

        const chip = document.createElement('span');
        chip.className = 'zone-chip active';
        chip.dataset.zone = zone;
        chip.innerHTML = `
            <span class="zone-dot" style="background:${getZoneColor(zone)}"></span>
            ${zone} (${count})
        `;
        chip.addEventListener('click', () => toggleZone(zone, chip));
        zoneList.appendChild(chip);
    });

    document.getElementById('zone-count').textContent = `${sorted.length} zones`;
}

function toggleZone(zone, chip) {
    if (activeZones.has(zone)) {
        activeZones.delete(zone);
        chip.classList.remove('active');
        chip.classList.add('inactive');
    } else {
        activeZones.add(zone);
        chip.classList.add('active');
        chip.classList.remove('inactive');
    }
    renderAllMarkers();
}

// --- Markers ---
function createMarkerIcon(loc) {
    const zone = normalizeZone(loc.zone);
    const color = getZoneColor(zone);
    const size = loc.lat ? 12 : 0; // Skip ungeocoded

    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            width:${size}px;height:${size}px;
            background:${color};
            border:2px solid #fff;
            border-radius:50%;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [size + 4, size + 4],
        iconAnchor: [(size + 4) / 2, (size + 4) / 2],
    });
}

function createPopupContent(loc) {
    const zone = normalizeZone(loc.zone);
    const color = getZoneColor(zone);

    let html = `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;min-width:200px;">`;
    html += `<strong style="font-size:15px;">${escapeHtml(loc.name)}</strong>`;

    if (zone !== 'Unknown') {
        html += `<span style="display:inline-block;margin-left:8px;padding:1px 8px;border-radius:10px;
            font-size:11px;font-weight:600;color:#fff;background:${color};">${zone}</span>`;
    }

    html += `<hr style="border:none;border-top:1px solid #3a3d46;margin:8px 0;">`;

    if (loc.street) {
        html += `<div style="font-size:13px;margin-bottom:3px;">📍 ${escapeHtml(loc.street)}</div>`;
    }
    if (loc.city) {
        html += `<div style="font-size:12px;color:#8b8fa3;">${escapeHtml(loc.city)}</div>`;
    }

    if (loc.lat && loc.lng) {
        html += `<div style="font-size:10px;color:#5a5e6e;margin-top:4px;">
            ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}
        </div>`;
        html += `<a href="https://www.google.com/maps?q=${loc.lat},${loc.lng}"
            target="_blank" style="display:inline-block;margin-top:6px;font-size:11px;
            color:#4a9eff;text-decoration:none;">
            <i class="fas fa-external-link-alt"></i> Open in Google Maps
        </a>`;
    } else {
        html += `<div style="font-size:11px;color:#e0556a;margin-top:4px;">⚠ No coordinates</div>`;
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

        const marker = L.marker([loc.lat, loc.lng], {
            icon: createMarkerIcon(loc),
        });

        marker.bindPopup(createPopupContent(loc), {
            maxWidth: 300,
            className: 'sbm-popup',
        });

        marker._sbmData = loc;
        markers.push(marker);
    });

    markerCluster.addLayers(markers);

    // Update stats
    document.getElementById('location-count').textContent =
        `${markers.length} visible / ${locations.length} total`;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// --- Search ---
function setupSearch() {
    const input = document.getElementById('search-input');
    const btn = document.getElementById('btn-search');

    const doSearch = () => {
        const query = input.value.trim().toLowerCase();
        if (!query) {
            document.getElementById('results-list').innerHTML = '';
            document.getElementById('results-count').textContent = '';
            return;
        }

        const results = locations.filter(loc => {
            const searchStr = `${loc.name} ${loc.street} ${loc.city} ${loc.zone} ${loc.address}`.toLowerCase();
            return searchStr.includes(query);
        });

        const resultsList = document.getElementById('results-list');
        document.getElementById('results-count').textContent = `${results.length} found`;

        resultsList.innerHTML = results.slice(0, 50).map(loc => {
            const zone = normalizeZone(loc.zone);
            const color = getZoneColor(zone);
            return `
                <div class="result-item" onclick="focusLocation(${loc.lat}, ${loc.lng}, '${escapeHtml(loc.name)}')">
                    <div class="result-name">${escapeHtml(loc.name)}</div>
                    <div class="result-address">${escapeHtml(loc.street || '')} — ${escapeHtml(loc.city || '')}</div>
                    <span class="result-zone" style="background:${color};color:#fff;">${zone}</span>
                </div>
            `;
        }).join('');

        if (results.length > 50) {
            resultsList.innerHTML += `<div style="padding:8px;font-size:12px;color:var(--text-secondary);">
                Showing 50 of ${results.length} — refine your search
            </div>`;
        }
    };

    input.addEventListener('input', doSearch);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
    btn.addEventListener('click', doSearch);
}

function focusLocation(lat, lng, name) {
    if (!lat || !lng) return;
    map.setView([lat, lng], 16);
    // Find and open popup
    markers.forEach(m => {
        const ll = m.getLatLng();
        if (Math.abs(ll.lat - lat) < 0.0001 && Math.abs(ll.lng - lng) < 0.0001) {
            m.openPopup();
        }
    });
}

// --- Buttons ---
function setupButtons() {
    document.getElementById('btn-fit').addEventListener('click', () => {
        if (markers.length === 0) return;
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.05));
    });

    document.getElementById('btn-print').addEventListener('click', () => {
        // Build print legend
        const legendContent = document.getElementById('print-legend-content');
        const zones = [...activeZones].sort();
        legendContent.innerHTML = zones.map(zone => `
            <div class="legend-item">
                <div class="legend-dot" style="background:${getZoneColor(zone)}"></div>
                ${zone}
            </div>
        `).join('');

        // Fit all visible markers for print
        if (markers.length > 0) {
            const group = L.featureGroup(markers);
            map.fitBounds(group.getBounds().pad(0.05));
        }

        setTimeout(() => window.print(), 300);
    });
}

// --- Stats ---
function buildStats() {
    const zoneCounts = {};
    let withCoords = 0;
    let withoutCoords = 0;

    locations.forEach(loc => {
        const zone = normalizeZone(loc.zone);
        zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
        if (loc.lat) withCoords++;
        else withoutCoords++;
    });

    const sorted = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1]);
    const topZones = sorted.slice(0, 5);

    document.getElementById('stats-content').innerHTML = `
        <div><strong>${locations.length}</strong> total locations</div>
        <div><strong>${withCoords}</strong> mapped</div>
        ${withoutCoords > 0 ? `<div><strong>${withoutCoords}</strong> unplaced</div>` : ''}
        <div><strong>${sorted.length}</strong> zones</div>
        <hr style="border:none;border-top:1px solid var(--border);margin:6px 0;">
        <div style="font-size:11px;color:var(--text-secondary);">Top Zones:</div>
        ${topZones.map(([z, c]) => `
            <div style="display:flex;align-items:center;gap:6px;margin:2px 0;">
                <span style="width:8px;height:8px;border-radius:50%;background:${getZoneColor(z)};flex-shrink:0;"></span>
                <span>${z}: <strong>${c}</strong></span>
            </div>
        `).join('')}
    `;
}
