'use client';

import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import type { ComplaintMapPoint, ComplaintMapPointsResponse } from '@shared/types/complaint';
import { complaintStatusColor } from '@/lib/complaints/map-status-colors';
import { parseStoredBoundaryGeometry } from '@/lib/geo/boundary-geojson-export';
import { pickName, useLocale, useTranslate } from '@/lib/i18n';
import { formatDate } from '@/lib/utils';

const DEFAULT_CENTER: [number, number] = [33.8938, 35.5018];
const DEFAULT_ZOOM = 11;

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 0);
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('resize', onResize);
    };
  }, [map]);
  return null;
}

/** Prefer complaint locations over municipality boundary so sparse data does not zoom to empty sea. */
function fitMapToComplaintPoints(
  map: L.Map,
  points: ComplaintMapPoint[],
  center: { latitude: number; longitude: number },
) {
  if (points.length === 0) {
    map.setView([center.latitude, center.longitude], DEFAULT_ZOOM);
    return;
  }
  if (points.length === 1) {
    const p = points[0];
    map.setView([p.latitude, p.longitude], 15);
    return;
  }
  const bounds = L.latLngBounds(
    points.map((p) => [p.latitude, p.longitude] as [number, number]),
  );
  const span = Math.max(
    bounds.getNorth() - bounds.getSouth(),
    bounds.getEast() - bounds.getWest(),
  );
  const maxZoom = span < 0.02 ? 17 : span < 0.08 ? 16 : 15;
  map.fitBounds(bounds, { padding: [36, 36], maxZoom });
}

function FitInitialView({
  boundaryBounds,
  points,
  center,
}: {
  boundaryBounds: [number, number, number, number] | null;
  points: ComplaintMapPoint[];
  center: { latitude: number; longitude: number };
}) {
  const map = useMap();
  const lastFitKey = useRef('');

  const fitKey = points.length > 0 ? points.map((p) => p.id).join(',') : 'empty';

  useEffect(() => {
    if (lastFitKey.current === fitKey) return;
    lastFitKey.current = fitKey;

    if (points.length > 0) {
      fitMapToComplaintPoints(map, points, center);
      return;
    }
    if (boundaryBounds) {
      const [minLat, minLng, maxLat, maxLng] = boundaryBounds;
      map.fitBounds(
        [
          [minLat, minLng],
          [maxLat, maxLng],
        ],
        { padding: [28, 28], maxZoom: 14 },
      );
      return;
    }
    map.setView([center.latitude, center.longitude], DEFAULT_ZOOM);
  }, [map, boundaryBounds, points, center, fitKey]);

  return null;
}

function MarkerClusterLayer({ points }: { points: ComplaintMapPoint[] }) {
  const map = useMap();
  const locale = useLocale();
  const t = useTranslate();
  const popupRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!popupRootRef.current) {
      popupRootRef.current = document.createElement('div');
    }

    const group = (L as typeof L & { markerClusterGroup: typeof L.markerClusterGroup }).markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 56,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 17,
    });

    points.forEach((p) => {
      const color = complaintStatusColor(p.status);
      const marker = L.circleMarker([p.latitude, p.longitude], {
        radius: 8,
        color,
        fillColor: color,
        fillOpacity: 0.9,
        weight: 2,
      });

      const categoryLabel = pickName(p.category, locale);
      const deptLabel = p.department ? pickName(p.department, locale) : '—';

      const html = `
        <div class="min-w-[200px] max-w-[260px] space-y-2 text-sm text-gray-800">
          <p class="font-mono text-xs text-gray-500">${p.referenceCode ?? '—'}</p>
          <p class="font-semibold leading-snug">${escapeHtml(p.title)}</p>
          <p class="text-xs text-gray-600">${escapeHtml(categoryLabel)}${deptLabel !== '—' ? ` · ${escapeHtml(deptLabel)}` : ''}</p>
          ${p.address ? `<p class="text-xs text-gray-500">${escapeHtml(p.address)}</p>` : ''}
          <p class="text-xs text-gray-400">${formatDate(p.createdAt)}</p>
          <a href="/complaints/${p.id}" class="inline-flex text-xs font-semibold text-brand-700 hover:underline">
            ${escapeHtml(t('dashboard.map.openComplaint'))}
          </a>
        </div>
      `;

      marker.bindPopup(html, { maxWidth: 280 });
      group.addLayer(marker);
    });

    map.addLayer(group);

    return () => {
      map.removeLayer(group);
    };
  }, [map, points, locale, t]);

  return null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface ComplaintHotspotsMapProps {
  data: ComplaintMapPointsResponse;
  className?: string;
  height?: number;
}

export default function ComplaintHotspotsMap({
  data,
  className = '',
  height = 300,
}: ComplaintHotspotsMapProps) {
  const t = useTranslate();

  const boundaryGeom = useMemo(
    () => (data.boundary?.geojson ? parseStoredBoundaryGeometry(data.boundary.geojson) : null),
    [data.boundary],
  );

  const center: [number, number] = [
    data.center.latitude,
    data.center.longitude,
  ];

  return (
    <div
      className={`complaint-hotspots-map relative z-0 overflow-hidden rounded-lg border border-gray-200 bg-white ${className}`}
      style={{ height, minHeight: 280, maxHeight: 320 }}
      dir="ltr"
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
        <FitInitialView
          boundaryBounds={data.boundary?.bounds ?? null}
          points={data.points}
          center={data.center}
        />
        {boundaryGeom && (
          <GeoJSON
            data={boundaryGeom as GeoJSON.GeoJsonObject}
            pathOptions={{
              color: '#1e40af',
              weight: 2,
              fillColor: '#3b82f6',
              fillOpacity: 0.06,
            }}
          />
        )}
        <MarkerClusterLayer points={data.points} />
      </MapContainer>

      <div className="pointer-events-none absolute bottom-1.5 start-1.5 z-[1000] flex flex-wrap gap-1.5 rounded bg-white/95 px-1.5 py-1 text-[9px] shadow-sm">
        <LegendSwatch color="#d97706" label={t('dashboard.map.legend.pending')} />
        <LegendSwatch color="#2563eb" label={t('dashboard.map.legend.active')} />
        <LegendSwatch color="#16a34a" label={t('dashboard.map.legend.resolved')} />
        <LegendSwatch color="#dc2626" label={t('dashboard.map.legend.rejected')} />
      </div>
      <div className="pointer-events-none absolute end-2 top-2 z-[1000] rounded bg-white/95 px-2 py-1 text-[10px] font-medium text-gray-600 shadow-sm">
        {t('dashboard.map.pointCount', { count: String(data.total) })}
      </div>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-gray-600">
      <span className="inline-block h-2.5 w-2.5 rounded-full border border-white shadow" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
