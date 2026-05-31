'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';

/** Default map view: Lebanon (Beirut area) when no boundary is loaded. */
const DEFAULT_CENTER: [number, number] = [33.8938, 35.5018];
const DEFAULT_ZOOM = 10;

type BoundaryGeometry = {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: unknown;
};

interface BoundaryMapPreviewProps {
  geojson: BoundaryGeometry | null;
  bounds: [number, number, number, number] | null;
  className?: string;
}

/** Leaflet often renders at 0×0 in cards unless size is invalidated after mount. */
function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const id = window.setTimeout(() => {
      map.invalidateSize();
    }, 0);
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('resize', onResize);
    };
  }, [map]);
  return null;
}

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
    const id = window.setTimeout(() => map.invalidateSize(), 50);
    return () => window.clearTimeout(id);
  }, [map, bounds]);
  return null;
}

export default function BoundaryMapPreview({
  geojson,
  bounds,
  className = '',
}: BoundaryMapPreviewProps) {
  const mapBounds: LatLngBoundsExpression | undefined = bounds
    ? [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ]
    : undefined;

  const center: [number, number] = bounds
    ? [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2]
    : DEFAULT_CENTER;

  return (
    <div
      className={`boundary-map-root relative z-0 w-full overflow-hidden rounded border border-gray-200 ${className}`}
      style={{ height: '18rem', minHeight: '288px' }}
    >
      <MapContainer
        center={center}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        className="h-full w-full"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapResizeFix />
        {mapBounds ? <FitBounds bounds={mapBounds} /> : null}
        {geojson ? (
          <GeoJSON
            key={JSON.stringify(geojson)}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data={geojson as any}
            pathOptions={{
              color: '#0f2555',
              weight: 2,
              fillColor: '#3b82f6',
              fillOpacity: 0.2,
            }}
          />
        ) : null}
      </MapContainer>
    </div>
  );
}
