'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  Map,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Download,
  Save,
  Trash2,
  ChevronDown,
  ChevronUp,
  Pencil,
  Eraser,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import {
  platformApi,
  type BoundaryOverlapInfo,
  type MunicipalityBoundaryMapItem,
} from '@/lib/api';
import { formatBoundaryApiError } from '@/lib/api/boundary-errors';
import {
  normalizeBoundaryGeometry,
  parseStoredBoundaryGeometry,
  type BoundaryGeometry,
} from '@/lib/geo/boundary-geojson-export';
import { useTranslate, useLocale, pickName } from '@/lib/i18n/index';
import type { BasemapId } from '@/components/platform/boundary-map-editor';

const BoundaryMapEditor = dynamic(
  () => import('@/components/platform/boundary-map-editor'),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full animate-pulse rounded border border-gray-200 bg-gray-100"
        style={{ height: '36rem', minHeight: '576px' }}
      />
    ),
  },
);

const SAMPLE_GEOJSON = `{
  "type": "Polygon",
  "coordinates": [
    [
      [35.4, 33.8],
      [35.6, 33.8],
      [35.6, 34.0],
      [35.4, 34.0],
      [35.4, 33.8]
    ]
  ]
}`;

type ValidationStatus = 'idle' | 'stale' | 'valid' | 'valid_overlap' | 'invalid';

export default function MunicipalityBoundaryPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslate();
  const locale = useLocale();
  const qc = useQueryClient();

  const [geojsonText, setGeojsonText] = useState('');
  const [bufferMeters, setBufferMeters] = useState(0);
  const [workingGeometry, setWorkingGeometry] = useState<BoundaryGeometry | null>(null);
  const [previewBounds, setPreviewBounds] = useState<[number, number, number, number] | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle');
  const [overlaps, setOverlaps] = useState<BoundaryOverlapInfo[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showNeighbors, setShowNeighbors] = useState(true);
  const [basemap, setBasemap] = useState<BasemapId>('street');
  const [fullscreen, setFullscreen] = useState(false);
  const [resizeToken, setResizeToken] = useState(0);

  const { data: muni } = useQuery({
    queryKey: ['platform', 'municipality', id],
    queryFn: () => platformApi.getMunicipality(id),
  });

  const { data: boundary, isLoading } = useQuery({
    queryKey: ['platform', 'municipality', id, 'boundary'],
    queryFn: () => platformApi.getMunicipalityBoundary(id),
  });

  const { data: allBoundariesRaw } = useQuery({
    queryKey: ['platform', 'municipality-boundaries-map'],
    queryFn: () => platformApi.listMunicipalityBoundaries(false),
  });

  const neighbors: MunicipalityBoundaryMapItem[] = useMemo(() => {
    if (!allBoundariesRaw) return [];
    return Array.isArray(allBoundariesRaw) ? allBoundariesRaw : [];
  }, [allBoundariesRaw]);

  const neighborLayers = useMemo(
    () =>
      neighbors.map((n) => ({
        municipalityId: n.municipalityId,
        name: pickName(
          n as { name: string; nameAr?: string | null; nameFr?: string | null },
          locale,
        ),
        code: n.code,
        isActive: n.isActive,
        geojson: n.geojson as BoundaryGeometry,
      })),
    [neighbors, locale],
  );

  const savedGeometry = useMemo(
    () =>
      boundary?.configured && boundary.geojson
        ? parseStoredBoundaryGeometry(boundary.geojson)
        : null,
    [boundary?.configured, boundary?.geojson, boundary?.updatedAt],
  );

  const mapReloadToken = `${id}:${boundary?.updatedAt ?? 'none'}`;

  const mapGeometry = workingGeometry ?? savedGeometry;

  useEffect(() => {
    if (!boundary) return;
    if (savedGeometry) {
      setWorkingGeometry(savedGeometry);
      setGeojsonText(JSON.stringify(savedGeometry, null, 2));
      setBufferMeters(boundary.bufferMeters ?? 0);
      setPreviewBounds(boundary.bounds);
      setValidationStatus(boundary.isActive ? 'valid' : 'idle');
      setOverlaps([]);
      setValidationError(null);
    } else if (!boundary.configured) {
      setWorkingGeometry(null);
      setGeojsonText('');
      setPreviewBounds(null);
      setValidationStatus('idle');
    }
  }, [
    savedGeometry,
    boundary?.updatedAt,
    boundary?.configured,
    boundary?.bufferMeters,
    boundary?.bounds,
    boundary?.isActive,
  ]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullscreen(false);
        setResizeToken((n) => n + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const toggleFullscreen = () => {
    setFullscreen((v) => !v);
    setResizeToken((n) => n + 1);
  };

  const statusLabel = useMemo(() => {
    if (!boundary?.configured) return t('platform.boundary.status.missing');
    if (boundary.isActive) return t('platform.boundary.status.active');
    return t('platform.boundary.status.inactive');
  }, [boundary, t]);

  const parseInput = useCallback(() => {
    try {
      return JSON.parse(geojsonText) as unknown;
    } catch {
      return null;
    }
  }, [geojsonText]);

  const bufferForApi = useMemo(
    () => Math.round(Math.min(1000, Math.max(0, bufferMeters))),
    [bufferMeters],
  );

  const resolveGeojsonPayload = useCallback((): unknown => {
    if (workingGeometry) {
      return normalizeBoundaryGeometry(workingGeometry);
    }
    const parsed = parseInput();
    if (parsed === null) return null;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'type' in parsed &&
      ((parsed as { type: string }).type === 'Polygon' ||
        (parsed as { type: string }).type === 'MultiPolygon')
    ) {
      return normalizeBoundaryGeometry(parsed as BoundaryGeometry);
    }
    return parsed;
  }, [workingGeometry, parseInput]);

  const hasGeometry = Boolean(workingGeometry || geojsonText.trim());

  const handleGeometryFromMap = useCallback((geom: BoundaryGeometry | null) => {
    setWorkingGeometry(geom);
    setValidationError(null);
    setValidationStatus(geom ? 'stale' : 'idle');
    setOverlaps([]);
    if (geom) {
      setGeojsonText(JSON.stringify(geom, null, 2));
    } else {
      setGeojsonText('');
      setPreviewBounds(null);
    }
  }, []);

  const handleClearMap = useCallback(() => {
    if (savedGeometry) {
      if (!window.confirm(t('platform.boundary.clearDraftConfirm'))) return;
      setWorkingGeometry(savedGeometry);
      setGeojsonText(JSON.stringify(savedGeometry, null, 2));
      setPreviewBounds(boundary?.bounds ?? null);
      setValidationStatus(boundary?.isActive ? 'valid' : 'idle');
      setOverlaps([]);
      setValidationError(null);
      return;
    }
    handleGeometryFromMap(null);
  }, [savedGeometry, boundary?.bounds, boundary?.isActive, handleGeometryFromMap, t]);

  const applyTextareaToMap = useCallback(() => {
    const parsed = parseInput();
    if (parsed === null) {
      toast.error(t('platform.boundary.error.invalidJson'));
      return;
    }
    setWorkingGeometry(parsed as BoundaryGeometry);
    setValidationError(null);
    setValidationStatus('stale');
    setOverlaps([]);
  }, [parseInput, t]);

  const validateMutation = useMutation({
    mutationFn: () => {
      const geojson = resolveGeojsonPayload();
      if (geojson === null) {
        throw new Error(t('platform.boundary.error.noGeometry'));
      }
      return platformApi.validateMunicipalityBoundary(id, {
        geojson,
        bufferMeters: bufferForApi,
      });
    },
    onSuccess: (res) => {
      setValidationError(null);
      const geom = res.geojson as BoundaryGeometry;
      setWorkingGeometry(geom);
      setGeojsonText(JSON.stringify(res.geojson, null, 2));
      setPreviewBounds(res.bounds);
      setOverlaps(res.overlaps ?? []);
      if (res.overlaps?.length) {
        setValidationStatus('valid_overlap');
        toast.warning(t('platform.boundary.toast.overlapWarning'));
      } else {
        setValidationStatus('valid');
        toast.success(t('platform.boundary.toast.valid'));
      }
    },
    onError: (err: unknown) => {
      const msg = formatBoundaryApiError(err, t('common.error'));
      setValidationError(msg);
      setValidationStatus('invalid');
      toast.error(msg);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const geojson = resolveGeojsonPayload();
      if (geojson === null) {
        throw new Error(t('platform.boundary.error.noGeometry'));
      }
      if (overlaps.length > 0) {
        const ok = window.confirm(t('platform.boundary.saveOverlapConfirm'));
        if (!ok) {
          throw new Error('SAVE_CANCELLED');
        }
      }
      return platformApi.upsertMunicipalityBoundary(id, {
        geojson,
        bufferMeters: bufferForApi,
        isActive: true,
      });
    },
    onSuccess: (res) => {
      const geom = res.geojson ? parseStoredBoundaryGeometry(res.geojson) : null;
      if (geom) {
        setWorkingGeometry(geom);
        setGeojsonText(JSON.stringify(geom, null, 2));
        setPreviewBounds(res.bounds);
      }
      if ((res as { overlaps?: BoundaryOverlapInfo[] }).overlaps?.length) {
        setOverlaps((res as { overlaps: BoundaryOverlapInfo[] }).overlaps);
        setValidationStatus('valid_overlap');
      } else {
        setValidationStatus('valid');
      }
      toast.success(t('platform.boundary.toast.saved'));
      qc.invalidateQueries({ queryKey: ['platform', 'municipality', id, 'boundary'] });
      qc.invalidateQueries({ queryKey: ['platform', 'municipality-boundaries-map'] });
    },
    onError: (err: unknown) => {
      if (err instanceof Error && err.message === 'SAVE_CANCELLED') return;
      const msg = formatBoundaryApiError(err, t('common.error'));
      setValidationError(msg);
      setValidationStatus('invalid');
      toast.error(msg);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => platformApi.deactivateMunicipalityBoundary(id),
    onSuccess: () => {
      toast.success(t('platform.boundary.toast.deactivated'));
      setWorkingGeometry(null);
      setGeojsonText('');
      setPreviewBounds(null);
      setOverlaps([]);
      setValidationStatus('idle');
      setValidationError(null);
      qc.invalidateQueries({ queryKey: ['platform', 'municipality', id, 'boundary'] });
      qc.invalidateQueries({ queryKey: ['platform', 'municipality-boundaries-map'] });
    },
    onError: (err: unknown) => {
      toast.error(formatBoundaryApiError(err, t('common.error')));
    },
  });

  useEffect(() => {
    if (!workingGeometry || validationStatus !== 'stale') return;
    const timer = window.setTimeout(() => {
      validateMutation.mutate();
    }, 1500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounced validate on draw/edit only
  }, [workingGeometry, bufferForApi, validationStatus]);

  const copyGeojson = () => {
    void navigator.clipboard.writeText(geojsonText || JSON.stringify(workingGeometry, null, 2));
    toast.success(t('platform.boundary.toast.copied'));
  };

  const downloadGeojson = () => {
    const text = geojsonText || JSON.stringify(workingGeometry, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `municipality-${id}-boundary.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fitBoundsExpr = previewBounds
    ? ([
        [previewBounds[0], previewBounds[1]],
        [previewBounds[2], previewBounds[3]],
      ] as [[number, number], [number, number]])
    : undefined;

  const canSave =
    hasGeometry &&
    (validationStatus === 'valid' || validationStatus === 'valid_overlap') &&
    !saveMutation.isPending;

  const validationBanner = useMemo(() => {
    if (validationStatus === 'valid') {
      return (
        <div className="flex items-start gap-2 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t('platform.boundary.validation.valid')}</span>
        </div>
      );
    }
    if (validationStatus === 'valid_overlap') {
      return (
        <div className="flex items-start gap-2 rounded border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t('platform.boundary.validation.overlap')}</span>
        </div>
      );
    }
    if (validationStatus === 'invalid' && validationError) {
      return (
        <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">{t('platform.boundary.validation.invalid')}</p>
            <p className="mt-1 whitespace-pre-wrap text-xs">{validationError}</p>
          </div>
        </div>
      );
    }
    if (validationStatus === 'stale' && hasGeometry) {
      return (
        <div className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          {validateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          )}
          <span>{t('platform.boundary.validation.checking')}</span>
        </div>
      );
    }
    return null;
  }, [validationStatus, validationError, hasGeometry, validateMutation.isPending, t]);

  const mapEditorBlock = (mapHeight: string) => (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-gray-900">{t('platform.boundary.mapEditor')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={showNeighbors}
              onChange={(e) => setShowNeighbors(e.target.checked)}
              className="rounded border-gray-300"
            />
            {t('platform.boundary.showNeighbors')}
          </label>
          <select
            value={basemap}
            onChange={(e) => setBasemap(e.target.value as BasemapId)}
            className="select-gov py-1 text-xs"
          >
            <option value="street">{t('platform.boundary.basemap.osm')}</option>
            <option value="satellite">{t('platform.boundary.basemap.satellite')}</option>
            <option value="satellite-labels">{t('platform.boundary.basemap.satelliteLabels')}</option>
          </select>
          <button
            type="button"
            className="btn-gov-secondary inline-flex items-center gap-1 py-1 text-xs"
            onClick={toggleFullscreen}
          >
            {fullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" />
                {t('platform.boundary.exitFullscreen')}
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5" />
                {t('platform.boundary.fullscreen')}
              </>
            )}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500">{t('platform.boundary.toolbarHint')}</p>

      <BoundaryMapEditor
        municipalityId={id}
        geometry={mapGeometry}
        onGeometryChange={handleGeometryFromMap}
        neighbors={neighborLayers}
        showNeighbors={showNeighbors}
        basemap={basemap}
        fitBounds={fitBoundsExpr}
        resizeToken={resizeToken}
        reloadToken={mapReloadToken}
        mapHeight={mapHeight}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-gov-secondary inline-flex items-center gap-1 text-xs"
          onClick={handleClearMap}
        >
          <Eraser className="h-3.5 w-3.5" />
          {t('platform.boundary.clear')}
        </button>
        <button
          type="button"
          className="btn-gov-secondary inline-flex items-center gap-1 text-xs"
          onClick={() => {
            setGeojsonText(SAMPLE_GEOJSON);
            const sample = JSON.parse(SAMPLE_GEOJSON) as BoundaryGeometry;
            setWorkingGeometry(sample);
            setValidationStatus('stale');
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
          {t('platform.boundary.loadSample')}
        </button>
      </div>

      {validationBanner}

      {overlaps.length > 0 && (
        <div className="rounded border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
          <p className="font-semibold">{t('platform.boundary.overlapTitle')}</p>
          <ul className="mt-1 list-inside list-disc text-xs">
            {overlaps.map((o) => (
              <li key={o.municipalityId}>
                {t('platform.boundary.overlapItem', { name: o.name })}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={() => validateMutation.mutate()}
          disabled={validateMutation.isPending || !hasGeometry}
          className="btn-gov-secondary inline-flex items-center gap-1"
        >
          {validateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          {t('platform.boundary.validate')}
        </button>
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={!canSave}
          title={
            !canSave && hasGeometry ? t('platform.boundary.saveRequiresValidation') : undefined
          }
          className="btn-gov-primary inline-flex items-center gap-1 disabled:opacity-50"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {t('platform.boundary.save')}
        </button>
        <button type="button" onClick={downloadGeojson} className="btn-gov-secondary inline-flex items-center gap-1">
          <Download className="h-4 w-4" />
          {t('platform.boundary.download')}
        </button>
        {boundary?.configured && boundary.isActive && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t('platform.boundary.deactivateConfirm'))) {
                deactivateMutation.mutate();
              }
            }}
            disabled={deactivateMutation.isPending}
            className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
          >
            {deactivateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {t('platform.boundary.deactivate')}
          </button>
        )}
      </div>
    </>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const muniName = muni ? pickName(muni as { name: string; nameAr?: string; nameFr?: string }, locale) : id;

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="border-b border-gray-200 pb-4">
          <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
            <Link
              href="/platform/municipalities"
              className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" /> {t('platform.boundary.back')}
            </Link>
            <Link
              href="/platform/boundaries"
              className="inline-flex items-center gap-1 text-blue-700 hover:underline"
            >
              {t('platform.boundary.globalAssignmentLink')}
            </Link>
          </div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Map className="h-6 w-6 text-amber-700" />
            {t('platform.boundary.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-600">{muniName}</p>
          <p className="mt-2 text-xs text-gray-500">{t('platform.boundary.advancedEditorHint')}</p>
        </div>

        <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
          <p className="font-semibold">{t('platform.boundary.secondaryEditorTitle')}</p>
          <p className="mt-1 text-xs">{t('platform.boundary.secondaryEditorBody')}</p>
          <Link
            href="/platform/boundaries"
            className="mt-2 inline-block text-xs font-medium text-blue-800 hover:underline"
          >
            {t('platform.boundary.globalAssignmentLink')} →
          </Link>
        </div>

        <div className="flex flex-col gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p>{t('platform.boundary.routingWarning')}</p>
          <p className="text-xs">{t('platform.boundary.overlapHint')}</p>
        </div>

        <div className="gov-card grid gap-3 p-4 sm:grid-cols-3">
          <div>
            <span className="text-xs font-medium uppercase text-gray-500">
              {t('platform.boundary.status.label')}
            </span>
            <p className="text-sm font-semibold text-gray-900">{statusLabel}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase text-gray-500">
              {t('platform.boundary.sourceType.label')}
            </span>
            <p className="text-sm font-semibold text-gray-900">
              {!boundary?.configured
                ? t('platform.boundary.sourceType.missing')
                : boundary.sourceType === 'AUTO_FROM_SOURCE'
                  ? t('platform.boundary.sourceType.auto')
                  : t('platform.boundary.sourceType.manual')}
            </p>
            {boundary?.sourceType === 'AUTO_FROM_SOURCE' &&
              boundary.assignedFeatureCount != null &&
              boundary.assignedFeatureCount > 0 && (
                <p className="mt-0.5 text-xs text-gray-500">
                  {t('platform.boundary.assignedFeatures', {
                    count: String(boundary.assignedFeatureCount),
                  })}
                </p>
              )}
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-gray-500">
              {t('platform.boundary.bufferMeters')}
            </label>
            <input
              type="number"
              min={0}
              max={1000}
              step={1}
              value={bufferMeters}
              onChange={(e) => {
                setBufferMeters(Number(e.target.value) || 0);
                if (workingGeometry) setValidationStatus('stale');
              }}
              className="input-gov mt-1"
            />
            <p className="mt-0.5 text-xs text-gray-500">{t('platform.boundary.bufferHint')}</p>
          </div>
          {boundary?.updatedAt && (
            <div>
              <span className="text-xs font-medium uppercase text-gray-500">
                {t('platform.boundary.updatedAt')}
              </span>
              <p className="text-sm text-gray-700">
                {new Date(boundary.updatedAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {!fullscreen && (
          <div className="gov-card space-y-3 p-4">{mapEditorBlock('36rem')}</div>
        )}

        <div className="gov-card overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {t('platform.boundary.advancedGeojson')}
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showAdvanced && (
            <div className="space-y-3 border-t border-gray-100 p-4">
              <p className="text-xs text-gray-500">{t('platform.boundary.formatHint')}</p>
              <textarea
                value={geojsonText}
                onChange={(e) => {
                  setGeojsonText(e.target.value);
                  setValidationError(null);
                  setValidationStatus('stale');
                  setOverlaps([]);
                }}
                onBlur={applyTextareaToMap}
                rows={12}
                className="input-gov font-mono text-xs"
                spellCheck={false}
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-gov-secondary text-xs" onClick={applyTextareaToMap}>
                  {t('platform.boundary.applyTextToMap')}
                </button>
                <button type="button" className="btn-gov-secondary text-xs" onClick={copyGeojson}>
                  <Copy className="mr-1 inline h-3.5 w-3.5" />
                  {t('platform.boundary.copy')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {fullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">
                {t('platform.boundary.fullscreen')}
              </p>
              <p className="text-sm font-semibold text-gray-900">{muniName}</p>
            </div>
            <button
              type="button"
              className="btn-gov-secondary inline-flex items-center gap-1"
              onClick={toggleFullscreen}
            >
              <X className="h-4 w-4" />
              {t('platform.boundary.exitFullscreen')}
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto p-4">
            {mapEditorBlock('calc(100vh - 11rem)')}
          </div>
        </div>
      )}
    </>
  );
}
