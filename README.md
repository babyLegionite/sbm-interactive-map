# SBM Interactive Map

High-quality interactive map of 350+ locations across Southern California's Inland Empire region. Built with Leaflet.js and OpenStreetMap.

## Quick Start

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

Or just open `index.html` in any browser.

## Features

- 356 locations across 12 zones
- Cluster markers for high-density areas
- Zone-based color coding and filtering
- Search by name, address, or zone
- Print-optimized layout with borders
- Mobile responsive
- No API keys required

## Zone Map

| Code | Zone | Count |
|------|------|-------|
| AV | Apple Valley | ~48 |
| VV | Victorville | ~56 |
| SB | San Bernardino | ~96 |
| FN | Fontana | ~48 |
| HE | Hesperia | ~48 |
| RD | Redlands | ~42 |
| RI | Rialto | ~46 |
| YP | Yucaipa | ~42 |
| YV | Yucca Valley | ~48 |
| PD | Palm Desert | ~24 |

## Data Source

Exported from Google My Maps: "Greg's imported SBM map"
Coordinates geocoded via OpenStreetMap Nominatim.

## Project Structure

```
sbm-interactive-map/
├── index.html          # Main interactive map
├── css/
│   └── map.css         # Map styles + print layout
├── js/
│   └── map.js          # Map initialization + logic
├── data/
│   ├── locations_raw.json      # Raw extracted data
│   └── locations_geocoded.json # With coordinates
├── scripts/
│   └── geocode.py      # Nominatim geocoding script
└── README.md
```
