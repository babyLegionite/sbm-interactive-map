#!/usr/bin/env python3
"""Geocode SBM locations using Nominatim (rate-limited: 1 req/sec)"""
import json, time, urllib.request, urllib.parse, sys, os

INPUT = os.path.expanduser('~/projects/sbm-interactive-map/data/locations_raw.json')
OUTPUT = os.path.expanduser('~/projects/sbm-interactive-map/data/locations_geocoded.json')

def geocode(address):
    """Geocode single address via Nominatim"""
    url = 'https://nominatim.openstreetmap.org/search'
    params = urllib.parse.urlencode({'q': address, 'format': 'json', 'limit': 1})
    req = urllib.request.Request(
        f"{url}?{params}",
        headers={'User-Agent': 'SBM-Map-Project/1.0 (dane@view.ai)'}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            if data:
                return float(data[0]['lat']), float(data[0]['lon'])
    except Exception as e:
        print(f"    Error: {e}", file=sys.stderr)
    return None, None

def main():
    with open(INPUT) as f:
        locations = json.load(f)

    need_geo = [loc for loc in locations if 'lat' not in loc]
    print(f"Total: {len(locations)}, Need geocoding: {len(need_geo)}")

    success = 0
    failed = 0

    for i, loc in enumerate(need_geo):
        address = loc.get('address', '') or f"{loc.get('street', '')}, {loc.get('city', '')}"
        if not address.strip():
            print(f"  [{i+1}/{len(need_geo)}] {loc['name']}: SKIP (no address)")
            failed += 1
            continue

        lat, lon = geocode(address)
        if lat:
            loc['lat'] = lat
            loc['lng'] = lon
            success += 1
        else:
            failed += 1

        status = "✓" if lat else "✗"
        print(f"  [{i+1}/{len(need_geo)}] {status} {loc['name']}: {address[:70]}")

        if i < len(need_geo) - 1:
            time.sleep(1.1)  # Nominatim requires max 1 req/sec

    print(f"\nDone! Success: {success}, Failed: {failed}")

    # Save all locations (both originally-geocoded and newly-geocoded)
    total_geocoded = sum(1 for loc in locations if loc.get('lat') is not None)
    print(f"Total geocoded: {total_geocoded}/{len(locations)}")

    with open(OUTPUT, 'w') as f:
        json.dump(locations, f, indent=2)
    print(f"Saved to {OUTPUT}")

if __name__ == '__main__':
    main()
