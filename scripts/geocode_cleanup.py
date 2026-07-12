#!/usr/bin/env python3
"""Fix and re-geocode failed addresses from the first pass.
Many addresses have the location name prepended (e.g., 'SB-8 Rim Forest House 26600 Valley View').
This strips the name prefix and tries again with just the street address."""
import json, time, urllib.request, urllib.parse, sys, os, re

INPUT = os.path.expanduser('~/projects/sbm-interactive-map/data/locations_geocoded.json')
OUTPUT = INPUT  # Update in place

def geocode(address):
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
        pass
    return None, None

def clean_address(addr):
    """Strip location name prefix from address if present.
    e.g., 'SB-8 Rim Forest House 26600 Valley View Drive' -> '26600 Valley View Drive'
    Also handles: 'VV-4 Wimbledon Apts, #10 16950 Jasmine Street' -> '16950 Jasmine Street'
    """
    # Pattern: optional code prefix, then name, then a street number
    # Match: optional word chars/hyphens/spaces then a street number
    m = re.match(r'^(?:[A-Z]{2,3}[- ]\d+\s+)?[A-Za-z\s\']+(?:Apts?|#\d+)?,?\s*(?:#\d+\s+)?(\d+\s+.+)$', addr.strip())
    if m:
        return m.group(1)
    
    # Simpler: find where the street number starts
    m2 = re.search(r'(\d+\s+[A-Z].+)$', addr.strip())
    if m2:
        return m2.group(1)
    
    return addr

def build_fallback_address(loc):
    """Build address from structured fields if the full address is messy"""
    street = loc.get('street', '')
    city = loc.get('city', '')
    
    # Clean street - remove the location name
    street = re.sub(r'^[A-Z]{2,3}[- ]\d+\s+[A-Za-z\s]+\s+(?=\d)', '', street).strip()
    
    if street and city:
        return f"{street}, {city}"
    return ''

def main():
    with open(INPUT) as f:
        locations = json.load(f)
    
    # Find failed ones
    failed = [loc for loc in locations if loc.get('lat') is None]
    print(f"Found {len(failed)} ungeocoded locations")
    
    fixed = 0
    for i, loc in enumerate(failed):
        # Try cleaned address first
        raw_addr = loc.get('address', '')
        cleaned = clean_address(raw_addr)
        
        if cleaned != raw_addr and len(cleaned) > 10:
            print(f"  [{i+1}/{len(failed)}] Cleaned: '{raw_addr[:60]}...' -> '{cleaned[:60]}'")
            lat, lon = geocode(cleaned)
            if lat:
                loc['lat'] = lat
                loc['lng'] = lon
                fixed += 1
                print(f"    ✓ Got {lat}, {lon}")
                time.sleep(1.1)
                continue
        
        # Try structured address
        fallback = build_fallback_address(loc)
        if fallback:
            print(f"  [{i+1}/{len(failed)}] Fallback: {fallback[:80]}")
            lat, lon = geocode(fallback)
            if lat:
                loc['lat'] = lat
                loc['lng'] = lon
                fixed += 1
                print(f"    ✓ Got {lat}, {lon}")
                time.sleep(1.1)
                continue
        
        # Try Google-style full address
        full = f"{loc.get('street','')}, {loc.get('city','')}" if loc.get('street') else ''
        if full and full != fallback:
            lat, lon = geocode(full)
            if lat:
                loc['lat'] = lat
                loc['lng'] = lon
                fixed += 1
                print(f"    ✓ Got {lat}, {lon}")
        
        time.sleep(1.1)
    
    print(f"\nFixed: {fixed}/{len(failed)}")
    total = sum(1 for loc in locations if loc.get('lat') is not None)
    print(f"Total geocoded: {total}/{len(locations)}")
    
    with open(OUTPUT, 'w') as f:
        json.dump(locations, f, indent=2)
    print(f"Saved to {OUTPUT}")

if __name__ == '__main__':
    main()
