/**
 * PALMLOCK — Touch Beyond Vision
 * Desktop Admin Interactive Leaflet Map Engine
 * Visualizes emergency incident GPS telemetry, accuracy circles,
 * and high-contrast dark CartoDB tile styling.
 */

let mapInstance = null;
let incidentMarker = null;
let accuracyCircle = null;
let multiMarkersLayer = null;

// Default reference: Chennai Central Metro Station, Tamil Nadu
export const DEFAULT_CHENNAI_COORDS = [13.0827, 80.2707];

/**
 * Robust Coordinate String Parser
 * Parses formats such as:
 * - "13.0827° N, 80.2707° E" -> [13.0827, 80.2707]
 * - "37.7749° N, 122.4194° W" -> [37.7749, -122.4194]
 * - "13.0827, 80.2707" -> [13.0827, 80.2707]
 */
export function parseCoordinateString(coordStr) {
  if (!coordStr || typeof coordStr !== 'string') return DEFAULT_CHENNAI_COORDS;

  try {
    const latMatch = coordStr.match(/([\d.]+)\s*°?\s*([NS])/i);
    const lngMatch = coordStr.match(/([\d.]+)\s*°?\s*([EW])/i);

    if (latMatch && lngMatch) {
      let lat = parseFloat(latMatch[1]);
      let lng = parseFloat(lngMatch[1]);
      if (latMatch[2].toUpperCase() === 'S') lat = -lat;
      if (lngMatch[2].toUpperCase() === 'W') lng = -lng;
      return [lat, lng];
    }

    // Direct decimal pair e.g. "13.0827, 80.2707"
    const directParts = coordStr.split(',').map(s => parseFloat(s.trim()));
    if (directParts.length >= 2 && !isNaN(directParts[0]) && !isNaN(directParts[1])) {
      return [directParts[0], directParts[1]];
    }
  } catch (err) {
    console.warn('Error parsing coordinates:', coordStr, err);
  }

  return DEFAULT_CHENNAI_COORDS;
}

/**
 * Initialize Leaflet Map Instance
 */
export function initIncidentMap(containerId = 'incident-map') {
  const container = document.getElementById(containerId);
  if (!container || typeof L === 'undefined') {
    showMapFallback(containerId);
    return null;
  }

  // If map already initialized, invalidate size and return instance
  if (mapInstance) {
    mapInstance.invalidateSize();
    return mapInstance;
  }
  if (container._leaflet_id) {
    return null;
  }

  try {
    mapInstance = L.map(containerId, {
      center: DEFAULT_CHENNAI_COORDS,
      zoom: 15,
      zoomControl: true,
      attributionControl: true
    });

    // Dark Matter CartoDB Tiles (SOC Cybersecurity Theme)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(mapInstance);

    return mapInstance;
  } catch (e) {
    console.warn('Leaflet map initialization failure:', e);
    showMapFallback(containerId);
    return null;
  }
}

/**
 * Update Map with Target Incident Coordinates and Accuracy Ring
 */
export function updateMapCoordinates(lat, lng, accuracy = 15, label = 'Incident Location') {
  if (!mapInstance) {
    mapInstance = initIncidentMap('incident-map');
  }
  if (!mapInstance) return;

  try {
    mapInstance.setView([lat, lng], 16);

    // Remove previous marker
    if (incidentMarker) {
      mapInstance.removeLayer(incidentMarker);
    }
    // Remove previous accuracy circle
    if (accuracyCircle) {
      mapInstance.removeLayer(accuracyCircle);
    }

    // Custom Glowing Red Pulsing Marker
    const icon = L.divIcon({
      className: 'custom-leaflet-alert-marker',
      html: `
        <div style="position: relative; width: 32px; height: 32px;">
          <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: rgba(244, 63, 94, 0.4); animation: mapPulse 1.8s infinite;"></div>
          <div style="position: absolute; top: 6px; left: 6px; width: 20px; height: 20px; border-radius: 50%; background: #f43f5e; border: 2px solid #ffffff; box-shadow: 0 0 10px #f43f5e;"></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    incidentMarker = L.marker([lat, lng], { icon: icon }).addTo(mapInstance);
    incidentMarker.bindPopup(`
      <div style="font-family: inherit; font-size: 13px; color: #0f172a; padding: 4px;">
        <strong style="color: #e11d48;">${label}</strong><br>
        <span style="font-size: 11px; color: #475569;">GPS Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}</span><br>
        <span style="font-size: 11px; color: #475569;">Estimated Precision: ±${accuracy}m</span>
      </div>
    `).openPopup();

    // Accuracy visualization ring
    accuracyCircle = L.circle([lat, lng], {
      radius: accuracy || 25,
      color: '#f43f5e',
      weight: 1.5,
      opacity: 0.8,
      fillColor: '#f43f5e',
      fillOpacity: 0.15
    }).addTo(mapInstance);

    mapInstance.invalidateSize();
  } catch (err) {
    console.warn('Map update failure:', err);
  }
}

/**
 * Display All Incidents on the Location Monitoring Dedicated Map
 */
export function renderAllIncidentMarkers(incidents, containerId = 'location-monitoring-map', onSelect = null) {
  const container = document.getElementById(containerId);
  if (!container || typeof L === 'undefined') return;

  let monitorMap = L.map(containerId, {
    center: DEFAULT_CHENNAI_COORDS,
    zoom: 13
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19
  }).addTo(monitorMap);

  const markerGroup = L.featureGroup();

  incidents.forEach(inc => {
    if (!inc.lat || !inc.lng) return;

    const isDuress = inc.type === 'DURESS';
    const markerColor = isDuress ? '#f43f5e' : (inc.severity === 'HIGH' ? '#f59e0b' : '#38bdf8');

    const icon = L.divIcon({
      className: 'incident-pin',
      html: `<div style="width: 18px; height: 18px; border-radius: 50%; background: ${markerColor}; border: 2px solid #fff; box-shadow: 0 0 8px ${markerColor};"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    const m = L.marker([inc.lat, inc.lng], { icon: icon });
    m.bindPopup(`
      <div style="font-size: 12px; color: #0f172a;">
        <strong>${inc.id} (${inc.type})</strong><br>
        <span>${inc.user}</span><br>
        <span style="font-size: 10px; color: #64748b;">${inc.location}</span><br>
        <button type="button" style="margin-top: 6px; padding: 2px 8px; font-size: 11px; background: #0f172a; color: #fff; border: none; border-radius: 4px; cursor: pointer;" onclick="window.viewIncidentFromMap('${inc.id}')">View Dossier</button>
      </div>
    `);

    markerGroup.addLayer(m);
  });

  markerGroup.addTo(monitorMap);
  if (markerGroup.getLayers().length > 0) {
    monitorMap.fitBounds(markerGroup.getBounds().pad(0.15));
  }
}

function showMapFallback(containerId) {
  const container = document.getElementById(containerId);
  const fallback = document.getElementById(`${containerId}-fallback`) || document.getElementById('incident-map-fallback');
  if (container) container.style.display = 'none';
  if (fallback) fallback.style.display = 'flex';
}
