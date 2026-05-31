'use client';

import { useCallback, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet-draw';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import {
  type BoundaryGeometry,
  geometryFromFeatureGroup,
  normalizeBoundaryGeometry,
} from '@/lib/geo/boundary-geojson-export';

export type { BoundaryGeometry };

export type NeighborBoundary = {
  municipalityId: string;
  name: string;
  code: string;
  isActive: boolean;
  geojson: BoundaryGeometry;
};

export type BasemapId = 'street' | 'satellite' | 'satellite-labels';

const DEFAULT_CENTER: [number, number] = [33.8938, 35.5018];
const DEFAULT_ZOOM = 10;

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const SATELLITE_URL =
  process.env.NEXT_PUBLIC_SATELLITE_TILE_URL ||
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_LABELS_URL =
  process.env.NEXT_PUBLIC_SATELLITE_LABELS_TILE_URL ||
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

const SELECTED_STYLE: L.PathOptions = {
  color: '#1d4ed8',
  weight: 4,
  fillColor: '#3b82f6',
  fillOpacity: 0.28,
};

const NEIGHBOR_STYLE: L.PathOptions = {
  color: '#64748b',
  weight: 2,
  dashArray: '6 4',
  fillColor: '#94a3b8',
  fillOpacity: 0.06,
};

function MapResizeFix({ resizeToken }: { resizeToken: number }) {
  const map = useMap();
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 0);
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('resize', onResize);
    };
  }, [map, resizeToken]);
  return null;
}

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    const id = window.setTimeout(() => map.invalidateSize(), 50);
    return () => window.clearTimeout(id);
  }, [map, bounds]);
  return null;
}

function BasemapLayers({ basemap }: { basemap: BasemapId }) {
  if (basemap === 'street') {
    return (
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url={OSM_URL}
      />
    );
  }
  return (
    <>
      <TileLayer attribution="Tiles &copy; Esri" url={SATELLITE_URL} />
      {basemap === 'satellite-labels' ? (
        <TileLayer attribution="Labels &copy; Esri" url={SATELLITE_LABELS_URL} />
      ) : null}
    </>
  );
}

function NeighborBoundariesLayer({
  neighbors,
  selectedMunicipalityId,
  show,
}: {
  neighbors: NeighborBoundary[];
  selectedMunicipalityId: string;
  show: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!show) return;
    const group = L.layerGroup();
    for (const n of neighbors) {
      if (n.municipalityId === selectedMunicipalityId) continue;
      if (!n.isActive) continue;
      L.geoJSON(n.geojson as GeoJSON.GeoJsonObject, { style: NEIGHBOR_STYLE })
        .bindTooltip(`${n.name} (${n.code})`, { sticky: true, direction: 'top' })
        .addTo(group);
    }
    group.addTo(map);
    return () => {
      map.removeLayer(group);
    };
  }, [map, neighbors, selectedMunicipalityId, show]);

  return null;
}

function DrawEditableLayer({
  geometry,
  onGeometryChange,
  reloadToken,
}: {
  geometry: BoundaryGeometry | null;
  onGeometryChange: (geometry: BoundaryGeometry | null) => void;
  /** Bumps when saved boundary is loaded from API (forces layer refresh). */
  reloadToken: string;
}) {
  const map = useMap();
  const fgRef = useRef<L.FeatureGroup | null>(null);
  const onChangeRef = useRef(onGeometryChange);
  onChangeRef.current = onGeometryChange;
  const syncingRef = useRef(false);
  const loadedFingerprintRef = useRef('');
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;

  const emitFromFg = useCallback(() => {
    if (syncingRef.current || !fgRef.current) return;
    const geom = geometryFromFeatureGroup(fgRef.current);
    loadedFingerprintRef.current = geom ? JSON.stringify(geom) : '';
    onChangeRef.current(geom);
  }, []);

  const paintGeometry = useCallback(
    (geom: BoundaryGeometry | null, force = false) => {
      const fg = fgRef.current;
      if (!fg) return false;

      const normalized = geom ? normalizeBoundaryGeometry(geom) : null;
      const fingerprint = `${reloadToken}|${normalized ? JSON.stringify(normalized) : ''}`;
      if (!force && fingerprint === loadedFingerprintRef.current) {
        return true;
      }
      loadedFingerprintRef.current = fingerprint;

      syncingRef.current = true;
      fg.clearLayers();

      if (normalized) {
        L.geoJSON(normalized as GeoJSON.GeoJsonObject, {
          style: SELECTED_STYLE,
          pane: 'selectedBoundary',
        }).eachLayer((layer) => {
          fg.addLayer(layer);
        });
        fg.bringToFront();
        try {
          const bounds = fg.getBounds();
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
          }
        } catch {
          /* empty */
        }
      }

      syncingRef.current = false;
      return true;
    },
    [map, reloadToken],
  );

  useEffect(() => {
    if (!map.getPane('selectedBoundary')) {
      map.createPane('selectedBoundary');
      const pane = map.getPane('selectedBoundary');
      if (pane) pane.style.zIndex = '450';
    }

    const fg = L.featureGroup().addTo(map);
    fgRef.current = fg;
    loadedFingerprintRef.current = '';

    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
        },
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false,
      },
      edit: {
        featureGroup: fg,
        remove: true,
      },
    });
    map.addControl(drawControl);

    const onCreated = (e: L.LeafletEvent) => {
      const evt = e as L.DrawEvents.Created;
      fg.clearLayers();
      fg.addLayer(evt.layer);
      emitFromFg();
    };
    const onEdited = () => emitFromFg();
    const onDeleted = () => emitFromFg();

    map.on(L.Draw.Event.CREATED, onCreated);
    map.on(L.Draw.Event.EDITED, onEdited);
    map.on(L.Draw.Event.DELETED, onDeleted);

    paintGeometry(geometryRef.current, true);

    return () => {
      map.off(L.Draw.Event.CREATED, onCreated);
      map.off(L.Draw.Event.EDITED, onEdited);
      map.off(L.Draw.Event.DELETED, onDeleted);
      map.removeControl(drawControl);
      map.removeLayer(fg);
      fgRef.current = null;
      loadedFingerprintRef.current = '';
    };
  }, [map, emitFromFg, paintGeometry]);

  useEffect(() => {
    paintGeometry(geometry, true);
  }, [geometry, reloadToken, paintGeometry]);

  return null;
}

export interface BoundaryMapEditorProps {
  municipalityId: string;
  geometry: BoundaryGeometry | null;
  onGeometryChange: (geometry: BoundaryGeometry | null) => void;
  neighbors: NeighborBoundary[];
  showNeighbors: boolean;
  basemap: BasemapId;
  fitBounds?: LatLngBoundsExpression;
  resizeToken?: number;
  /** Changes when saved boundary is fetched (ensures map layers refresh). */
  reloadToken?: string;
  className?: string;
  mapHeight?: string;
}

export default function BoundaryMapEditor({
  municipalityId,
  geometry,
  onGeometryChange,
  neighbors,
  showNeighbors,
  basemap,
  fitBounds,
  resizeToken = 0,
  reloadToken = 'initial',
  className = '',
  mapHeight = '36rem',
}: BoundaryMapEditorProps) {
  return (
    <div
      className={`boundary-map-root relative z-0 w-full overflow-hidden rounded border border-gray-300 ${className}`}
      style={{ height: mapHeight, minHeight: mapHeight }}
    >
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        className="h-full w-full"
        style={{ height: '100%', width: '100%' }}
      >
        <BasemapLayers basemap={basemap} />
        <MapResizeFix resizeToken={resizeToken} />
        <NeighborBoundariesLayer
          neighbors={neighbors}
          selectedMunicipalityId={municipalityId}
          show={showNeighbors}
        />
        {fitBounds ? <FitBounds bounds={fitBounds} /> : null}
        <DrawEditableLayer
          geometry={geometry}
          onGeometryChange={onGeometryChange}
          reloadToken={reloadToken}
        />
      </MapContainer>
    </div>
  );
}
