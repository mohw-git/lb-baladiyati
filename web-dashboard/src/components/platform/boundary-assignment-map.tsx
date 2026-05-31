'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import type { Admin3Dataset } from '@/lib/geo/admin3-geojson-import';
import {
  buildAdmin3FeatureCollection,
  resolveMunicipalityColor,
  type FeatureAssignment,
} from '@/lib/geo/boundary-assignment';
import { filterAdmin3Features, type Admin3SearchQuery } from '@/lib/geo/admin3-geojson-import';

const UNASSIGNED: L.PathOptions = {
  color: '#d97706',
  weight: 1,
  fillColor: '#fbbf24',
  fillOpacity: 0.22,
};

const CONFLICT: L.PathOptions = {
  color: '#b91c1c',
  weight: 2,
  fillColor: '#ef4444',
  fillOpacity: 0.35,
};

const SELECTED: L.PathOptions = {
  color: '#1e3a8a',
  weight: 3,
  fillColor: '#3b82f6',
  fillOpacity: 0.45,
};

const DIMMED: L.PathOptions = {
  color: '#e2e8f0',
  weight: 0.5,
  fillColor: '#f1f5f9',
  fillOpacity: 0.05,
};

function styleForFeature(
  id: string | undefined,
  assignments: Map<string, FeatureAssignment | null>,
  municipalityColors: Map<string, string | null | undefined> | undefined,
  selectedIds: Set<string>,
  searchOnly: boolean,
  hasFilter: boolean,
  filteredIds: Set<string>,
): L.PathOptions {
  if (!id) return UNASSIGNED;

  if (searchOnly && hasFilter && !filteredIds.has(id)) return DIMMED;
  if (hasFilter && !searchOnly && !filteredIds.has(id)) {
    return { ...UNASSIGNED, fillOpacity: 0.04, opacity: 0.35 };
  }

  const assignment = assignments.get(id);
  const isSelected = selectedIds.has(id);

  if (assignment?.conflict) return CONFLICT;

  if (assignment) {
    const c = resolveMunicipalityColor(assignment.municipalityId, municipalityColors);
    const base: L.PathOptions = {
      color: c,
      weight: 2,
      fillColor: c,
      fillOpacity: 0.28,
    };
    if (isSelected) {
      return { ...base, color: '#1e3a8a', weight: 3, fillOpacity: 0.38 };
    }
    return base;
  }

  if (isSelected) return SELECTED;
  return UNASSIGNED;
}

function Admin3GeoJsonLayer({
  dataset,
  assignments,
  municipalityColors,
  selectedIds,
  search,
  searchOnly,
  onFeatureClick,
}: {
  dataset: Admin3Dataset;
  assignments: Map<string, FeatureAssignment | null>;
  municipalityColors?: Map<string, string | null | undefined>;
  selectedIds: Set<string>;
  search: Admin3SearchQuery;
  searchOnly: boolean;
  onFeatureClick: (featureId: string) => void;
}) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);
  const onClickRef = useRef(onFeatureClick);
  onClickRef.current = onFeatureClick;

  const filteredIds = useRef<Set<string>>(new Set());
  const hasFilter = Boolean(
    search.text.trim() || search.adm1.trim() || search.adm2.trim() || search.pcode.trim(),
  );

  useEffect(() => {
    filteredIds.current = new Set(
      filterAdmin3Features(dataset.features, search).map((f) => f.id),
    );
  }, [dataset, search]);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    const fc = buildAdmin3FeatureCollection(dataset);
    const canvas = L.canvas({ padding: 0.5 });

    const layer = L.geoJSON(fc, {
      // Canvas renderer improves performance for ~1.6k polygons.
      ...( { renderer: canvas } as L.GeoJSONOptions),
      style: (feature) => {
        const id = feature?.properties?.id as string | undefined;
        return styleForFeature(
          id,
          assignments,
          municipalityColors,
          selectedIds,
          searchOnly,
          hasFilter,
          filteredIds.current,
        );
      },
      onEachFeature: (feature, featureLayer) => {
        const id = feature.properties?.id as string;
        const p = feature.properties as Record<string, unknown>;
        const assignment = assignments.get(id);
        const lines = [
          String(p.adm3_name ?? ''),
          p.adm3_name_ar ? String(p.adm3_name_ar) : null,
          `${p.adm2_name} · ${p.adm1_name}`,
          `P-code: ${p.adm3_pcode}`,
          assignment?.conflict
            ? `Conflict: ${assignment.conflictMunicipalityIds?.length ?? 0} municipalities`
            : assignment
              ? `Assigned: ${assignment.municipalityName}`
              : 'Unassigned',
        ].filter(Boolean);
        featureLayer.bindTooltip(lines.join('<br/>'), { sticky: true });
        featureLayer.on('click', () => onClickRef.current(id));
      },
    });

    layer.addTo(map);
    layerRef.current = layer;

    try {
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 });
      }
    } catch {
      /* empty */
    }

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, dataset]);

  useEffect(() => {
    layerRef.current?.setStyle((feature) => {
      const id = feature?.properties?.id as string | undefined;
      return styleForFeature(
        id,
        assignments,
        municipalityColors,
        selectedIds,
        searchOnly,
        hasFilter,
        filteredIds.current,
      );
    });
  }, [assignments, selectedIds, search, searchOnly, hasFilter, municipalityColors]);

  return null;
}

export function FitBoundsTrigger({
  bounds,
}: {
  bounds: [[number, number], [number, number]] | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
  }, [map, bounds]);
  return null;
}

export interface BoundaryAssignmentMapProps {
  dataset: Admin3Dataset;
  assignments: Map<string, FeatureAssignment | null>;
  municipalityColors?: Map<string, string | null | undefined>;
  selectedIds: Set<string>;
  search: Admin3SearchQuery;
  searchOnly: boolean;
  onFeatureClick: (featureId: string) => void;
  fitBounds: [[number, number], [number, number]] | null;
}

export default function BoundaryAssignmentMap({
  dataset,
  assignments,
  municipalityColors,
  selectedIds,
  search,
  searchOnly,
  onFeatureClick,
  fitBounds,
}: BoundaryAssignmentMapProps) {
  return (
    <div className="relative h-full min-h-[32rem] w-full overflow-hidden rounded border border-gray-300">
      <MapContainer
        center={[33.9, 35.5]}
        zoom={8}
        scrollWheelZoom
        className="h-full w-full"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Admin3GeoJsonLayer
          dataset={dataset}
          assignments={assignments}
          municipalityColors={municipalityColors}
          selectedIds={selectedIds}
          search={search}
          searchOnly={searchOnly}
          onFeatureClick={onFeatureClick}
        />
        <FitBoundsTrigger bounds={fitBounds} />
      </MapContainer>
    </div>
  );
}
