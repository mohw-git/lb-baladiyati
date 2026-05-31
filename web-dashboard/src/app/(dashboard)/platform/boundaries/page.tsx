'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2,
  Upload,
  Download,
  Map as MapIcon,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { ApiError, platformApi } from '@/lib/api';
import { formatBoundaryApiError } from '@/lib/api/boundary-errors';
import {
  Admin3ParseError,
  filterAdmin3Features,
  parseAdmin3GeoJsonFile,
  type Admin3Dataset,
  type Admin3SearchQuery,
} from '@/lib/geo/admin3-geojson-import';
import {
  admin3DatasetFromFeatureCollection,
  BoundarySourceUploadError,
  cancelBoundarySourceImport,
  uploadAdmin3SourceImport,
} from '@/lib/geo/boundary-source-upload';
import {
  boundsForFeatureIds,
  buildAssignmentsFromWorkspace,
  featureIdsForMunicipality,
  resolveMunicipalityColor,
  applyAssignOptimistic,
  applyUnassignOptimistic,
  applyClearMunicipalityOptimistic,
  type FeatureAssignment,
} from '@/lib/geo/boundary-assignment';
import { MunicipalitySearchCombobox } from '@/components/platform/municipality-search-combobox';
import type { BoundaryAssignmentWorkspace } from '@/lib/api/endpoints/platform';
import { useLocale, useTranslate, pickName } from '@/lib/i18n/index';

const BoundaryAssignmentMap = dynamic(
  () => import('@/components/platform/boundary-assignment-map'),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-[32rem] animate-pulse rounded border bg-gray-100" />
    ),
  },
);

const PAGE_SIZE = 50;

export default function PlatformBoundariesPage() {
  const t = useTranslate();
  const locale = useLocale();
  const qc = useQueryClient();

  const [dataset, setDataset] = useState<Admin3Dataset | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    done: number;
    total: number;
    chunkIndex: number;
    chunkCount: number;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [failedImportId, setFailedImportId] = useState<string | null>(null);
  const [loadingDefault, setLoadingDefault] = useState(false);
  const [showAdvancedUpload, setShowAdvancedUpload] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Map<string, FeatureAssignment | null>>(new Map());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState<Admin3SearchQuery>({
    text: '',
    adm1: '',
    adm2: '',
    pcode: '',
  });
  const [searchOnly, setSearchOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [targetMunicipalityId, setTargetMunicipalityId] = useState('');
  const [boundaryColor, setBoundaryColor] = useState('#2563eb');
  const [fitBounds, setFitBounds] = useState<[[number, number], [number, number]] | null>(null);

  const { data: workspace, isLoading: workspaceLoading, refetch: refetchWorkspace } = useQuery({
    queryKey: ['platform', 'boundary-assignment', 'workspace'],
    queryFn: () => platformApi.getBoundaryAssignmentWorkspace(),
  });

  const loadPersistedFeatures = useCallback(async () => {
    const res = await platformApi.getActiveBoundarySourceFeatures();
    if (!res?.featureCollection) return;
    const ds = admin3DatasetFromFeatureCollection(res.import.fileName, res.featureCollection, {
      validOn: res.import.validOn,
      version: res.import.version,
      collectionName: res.import.name,
    });
    setDataset(ds);
  }, []);

  useEffect(() => {
    if (workspace?.activeImport && !dataset && !parsing && !importing) {
      void loadPersistedFeatures();
    }
  }, [workspace?.activeImport, dataset, parsing, importing, loadPersistedFeatures]);

  const activeMunicipalities = useMemo(
    () => workspace?.municipalities ?? [],
    [workspace?.municipalities],
  );

  const muniRefs = useMemo(
    () =>
      activeMunicipalities.map((m) => ({
        id: m.id,
        name: pickName(m, locale),
        code: m.code,
      })),
    [activeMunicipalities, locale],
  );

  const municipalityColors = useMemo(() => {
    const map = new Map<string, string | null | undefined>();
    for (const m of activeMunicipalities) {
      map.set(m.id, m.boundaryColor);
    }
    return map;
  }, [activeMunicipalities]);

  useEffect(() => {
    if (!workspace || !dataset) return;
    const built = buildAssignmentsFromWorkspace(
      workspace.assignments.map((a) => ({
        featureId: a.featureId,
        municipalityId: a.municipalityId,
      })),
      new Map(muniRefs.map((m) => [m.id, m])),
    );
    setAssignments(built);
  }, [workspace, dataset, muniRefs]);

  useEffect(() => {
    if (!targetMunicipalityId) return;
    setBoundaryColor(resolveMunicipalityColor(targetMunicipalityId, municipalityColors));
  }, [targetMunicipalityId, municipalityColors]);

  const stats = workspace?.stats ?? {
    configured: 0,
    missing: 0,
    unassignedFeatureCount: 0,
    conflictCount: 0,
  };

  const filtered = useMemo(() => {
    if (!dataset) return [];
    return filterAdmin3Features(dataset.features, search);
  }, [dataset, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const targetMuni = activeMunicipalities.find((m) => m.id === targetMunicipalityId);
  const assignedCountForTarget = targetMuni?.assignedFeatureCount ?? 0;

  const cancelPendingImport = async (importId: string) => {
    try {
      await cancelBoundarySourceImport(importId);
      setFailedImportId(null);
      setImportError(null);
      await refetchWorkspace();
      toast.success(t('platform.boundaryAssignment.toast.importCancelled'));
    } catch (err) {
      toast.error(formatBoundaryApiError(err, t('common.error')));
    }
  };

  const loadDefaultSource = async (replace = false) => {
    if (replace && !window.confirm(t('platform.boundaryAssignment.replaceConfirm'))) {
      return;
    }
    setLoadingDefault(true);
    setImportError(null);
    setFailedImportId(null);
    try {
      const res = await platformApi.importDefaultBoundarySource(replace);
      toast.success(
        t('platform.boundaryAssignment.toast.defaultImported', {
          count: String(res.featureCount),
        }),
      );
      setDataset(null);
      await refetchWorkspace();
      await loadPersistedFeatures();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DEFAULT_IMPORT_FAILED') {
        const id = (err.meta?.importId as string) ?? null;
        if (id) setFailedImportId(id);
      }
      setImportError(formatBoundaryApiError(err, t('common.error')));
      toast.error(formatBoundaryApiError(err, t('common.error')));
    } finally {
      setLoadingDefault(false);
    }
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setParsing(true);
    setParseError(null);
    setImportError(null);
    setFailedImportId(null);
    setDataset(null);
    setSelectedIds(new Set());
    setPage(1);
    try {
      const parsed = await parseAdmin3GeoJsonFile(file);
      setImporting(true);
      setImportProgress({
        done: 0,
        total: parsed.featureCount,
        chunkIndex: 0,
        chunkCount: 0,
      });
      await uploadAdmin3SourceImport(parsed, (progress) => {
        setImportProgress(progress);
      });
      toast.success(t('platform.boundaryAssignment.toast.imported'));
      await refetchWorkspace();
      await loadPersistedFeatures();
    } catch (err) {
      if (err instanceof BoundarySourceUploadError) {
        setImportError(err.message);
        if (err.importId) setFailedImportId(err.importId);
        toast.error(err.message);
      } else {
        const msg =
          err instanceof Admin3ParseError
            ? err.message
            : err instanceof Error
              ? err.message
              : t('common.error');
        setParseError(msg);
        toast.error(msg);
      }
    } finally {
      setParsing(false);
      setImporting(false);
      setImportProgress(null);
    }
  };

  const toggleFeature = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const zoomToSelection = () => {
    if (!dataset || selectedIds.size === 0) return;
    setFitBounds(boundsForFeatureIds(dataset, Array.from(selectedIds)));
  };

  const zoomToFiltered = () => {
    if (!dataset || !filtered.length) return;
    setFitBounds(boundsForFeatureIds(dataset, filtered.map((f) => f.id)));
  };

  const loadMunicipalitySelection = (municipalityId: string) => {
    if (!municipalityId) return;
    const ids = featureIdsForMunicipality(assignments, municipalityId);
    setSelectedIds(new Set(ids));
    if (dataset && ids.length) {
      setFitBounds(boundsForFeatureIds(dataset, ids));
    }
  };

  useEffect(() => {
    if (!targetMunicipalityId) {
      setSelectedIds(new Set());
      return;
    }
    loadMunicipalitySelection(targetMunicipalityId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMunicipalityId]);

  const refreshAll = async () => {
    await refetchWorkspace();
    await loadPersistedFeatures();
    qc.invalidateQueries({ queryKey: ['platform', 'municipality-boundaries-map'] });
  };

  const targetMuniRef = useMemo(() => {
    if (!targetMuni) return null;
    return { id: targetMuni.id, name: pickName(targetMuni, locale), code: targetMuni.code };
  }, [targetMuni, locale]);

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!targetMunicipalityId || selectedIds.size === 0) {
        throw new Error(t('platform.boundaryAssignment.error.assignPreconditions'));
      }

      const reassignments: string[] = [];
      for (const fid of Array.from(selectedIds)) {
        const a = assignments.get(fid);
        if (a && a.municipalityId !== targetMunicipalityId) {
          reassignments.push(`${a.municipalityName} (${a.municipalityCode})`);
        }
      }
      const uniqueReassign = Array.from(new Set(reassignments));
      if (uniqueReassign.length > 0) {
        const ok = window.confirm(
          t('platform.boundaryAssignment.reassignConfirm', {
            list: uniqueReassign.join(', '),
          }),
        );
        if (!ok) throw new Error('ASSIGN_CANCELLED');
      }

      const needsSwitch =
        targetMuni?.sourceType === 'MANUAL_GEOJSON' && targetMuni.configured;
      if (needsSwitch) {
        const ok = window.confirm(t('platform.boundaryAssignment.switchToSourceConfirm'));
        if (!ok) throw new Error('ASSIGN_CANCELLED');
      }

      return platformApi.updateBoundaryAssignments({
        municipalityId: targetMunicipalityId,
        mode: 'assign',
        featureIds: Array.from(selectedIds),
        forceReassign: true,
        switchToSourceBased: needsSwitch || targetMuni?.sourceType === 'AUTO_FROM_SOURCE',
        confirmOverlap: true,
      });
    },
    onMutate: () => {
      if (!targetMuniRef) return;
      const featureIds = Array.from(selectedIds);
      setAssignments((prev) => applyAssignOptimistic(prev, featureIds, targetMuniRef));
    },
    onSuccess: async (data) => {
      setSelectedIds(new Set());
      toast.success(t('platform.boundaryAssignment.toast.assigned'));
      const regenerated = (data as { regenerated?: Array<{ overlaps?: unknown[] }> })?.regenerated;
      const overlapCount =
        regenerated?.reduce((n, r) => n + (r.overlaps?.length ?? 0), 0) ?? 0;
      if (overlapCount > 0) {
        toast.warning(
          t('platform.boundaryAssignment.toast.geometricOverlap', {
            count: String(overlapCount),
          }),
        );
      }
      await refreshAll();
    },
    onError: (err: unknown) => {
      if (err instanceof Error && err.message === 'ASSIGN_CANCELLED') return;
      if (err instanceof ApiError && err.code === 'FEATURE_ASSIGNMENT_CONFLICT') {
        toast.error(t('platform.boundaryAssignment.error.conflict'));
        void refetchWorkspace();
        return;
      }
      void refetchWorkspace();
      toast.error(formatBoundaryApiError(err, t('common.error')));
    },
  });

  const unassignMutation = useMutation({
    mutationFn: async () => {
      if (!targetMunicipalityId || selectedIds.size === 0) {
        throw new Error(t('platform.boundaryAssignment.error.assignPreconditions'));
      }
      return platformApi.updateBoundaryAssignments({
        municipalityId: targetMunicipalityId,
        mode: 'unassign',
        featureIds: Array.from(selectedIds),
      });
    },
    onMutate: () => {
      const featureIds = Array.from(selectedIds).filter((fid) => {
        const a = assignments.get(fid);
        return a?.municipalityId === targetMunicipalityId;
      });
      setAssignments((prev) => applyUnassignOptimistic(prev, featureIds));
    },
    onSuccess: async () => {
      setSelectedIds(new Set());
      toast.success(t('platform.boundaryAssignment.toast.unassigned'));
      await refreshAll();
    },
    onError: (err: unknown) => {
      void refetchWorkspace();
      toast.error(formatBoundaryApiError(err, t('common.error')));
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!targetMunicipalityId) throw new Error(t('platform.boundaryAssignment.error.assignPreconditions'));
      if (!window.confirm(t('platform.boundaryAssignment.clearMunicipalityConfirm'))) {
        throw new Error('ASSIGN_CANCELLED');
      }
      return platformApi.clearMunicipalityBoundaryAssignments(targetMunicipalityId);
    },
    onMutate: () => {
      setAssignments((prev) => applyClearMunicipalityOptimistic(prev, targetMunicipalityId));
      setSelectedIds(new Set());
    },
    onSuccess: async () => {
      toast.success(t('platform.boundaryAssignment.toast.cleared'));
      await refreshAll();
    },
    onError: (err: unknown) => {
      if (err instanceof Error && err.message === 'ASSIGN_CANCELLED') return;
      void refetchWorkspace();
      toast.error(formatBoundaryApiError(err, t('common.error')));
    },
  });

  const colorMutation = useMutation({
    mutationFn: async () => {
      if (!targetMunicipalityId) return;
      return platformApi.updateMunicipalityBoundaryColor(targetMunicipalityId, boundaryColor);
    },
    onMutate: async () => {
      if (!targetMunicipalityId) return;
      await qc.cancelQueries({ queryKey: ['platform', 'boundary-assignment', 'workspace'] });
      const prev = qc.getQueryData<BoundaryAssignmentWorkspace>([
        'platform',
        'boundary-assignment',
        'workspace',
      ]);
      if (prev) {
        qc.setQueryData<BoundaryAssignmentWorkspace>(
          ['platform', 'boundary-assignment', 'workspace'],
          {
            ...prev,
            municipalities: prev.municipalities.map((m) =>
              m.id === targetMunicipalityId ? { ...m, boundaryColor } : m,
            ),
          },
        );
      }
      return { prev };
    },
    onSuccess: async () => {
      toast.success(t('platform.boundaryAssignment.toast.colorSaved'));
      await refetchWorkspace();
    },
    onError: (err: unknown, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(['platform', 'boundary-assignment', 'workspace'], ctx.prev);
      }
      toast.error(formatBoundaryApiError(err, t('common.error')));
    },
  });

  const mapLoading = workspaceLoading || (Boolean(workspace?.activeImport) && !dataset);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-3 p-4 lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto lg:w-96">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <MapIcon className="h-5 w-5 text-amber-700" />
            {t('platform.boundaryAssignment.title')}
          </h1>
          <p className="mt-1 text-xs text-gray-600">{t('platform.boundaryAssignment.subtitle')}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div className="rounded border border-green-200 bg-green-50 p-2">
            <p className="font-bold text-green-900">{stats.configured}</p>
            <p className="text-green-700">{t('platform.boundaryAssignment.stat.configured')}</p>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 p-2">
            <p className="font-bold text-gray-900">{stats.missing}</p>
            <p className="text-gray-600">{t('platform.boundaryAssignment.stat.missing')}</p>
          </div>
          <div className="rounded border border-amber-200 bg-amber-50 p-2">
            <p className="font-bold text-amber-900">{stats.unassignedFeatureCount}</p>
            <p className="text-amber-800">{t('platform.boundaryAssignment.stat.unassigned')}</p>
          </div>
          <div className="rounded border border-red-200 bg-red-50 p-2">
            <p className="font-bold text-red-900">{stats.conflictCount}</p>
            <p className="text-red-700">{t('platform.boundaryAssignment.stat.conflicts')}</p>
          </div>
        </div>

        {/* Source state banner */}
        {(() => {
          const busy = loadingDefault || parsing || importing;
          let stateLabel = t('platform.boundaryAssignment.state.none');
          let stateClass = 'border-gray-200 bg-gray-50 text-gray-700';
          if (busy) {
            stateLabel = t('platform.boundaryAssignment.state.importing');
            stateClass = 'border-blue-200 bg-blue-50 text-blue-900';
          } else if (importError || failedImportId) {
            stateLabel = t('platform.boundaryAssignment.state.failed');
            stateClass = 'border-red-200 bg-red-50 text-red-900';
          } else if (workspace?.activeImport) {
            stateLabel = t('platform.boundaryAssignment.state.active');
            stateClass = 'border-green-200 bg-green-50 text-green-900';
          } else if (workspace?.pendingImport) {
            stateLabel = t('platform.boundaryAssignment.state.incomplete');
            stateClass = 'border-orange-200 bg-orange-50 text-orange-950';
          }
          return (
            <div className={`rounded border p-2 text-xs ${stateClass}`}>
              <span className="font-semibold">
                {t('platform.boundaryAssignment.state.label')}:
              </span>{' '}
              {stateLabel}
            </div>
          );
        })()}

        {/* Primary: server-side default import (no upload, no throttle) */}
        {!workspace?.activeImport && (
          <button
            type="button"
            className="btn-gov-primary inline-flex items-center justify-center gap-2 text-sm"
            disabled={loadingDefault || parsing || importing}
            onClick={() => void loadDefaultSource(false)}
          >
            {loadingDefault ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t('platform.boundaryAssignment.loadDefault')}
          </button>
        )}

        {workspace?.activeImport && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500">
              {t('platform.boundaryAssignment.loaded', {
                file: workspace.activeImport.fileName,
                count: String(workspace.activeImport.featureCount),
              })}
            </p>
            <button
              type="button"
              className="btn-gov-secondary inline-flex items-center justify-center gap-2 text-xs"
              disabled={loadingDefault}
              onClick={() => void loadDefaultSource(true)}
            >
              {loadingDefault ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {t('platform.boundaryAssignment.replaceDefault')}
            </button>
          </div>
        )}

        {(workspace?.pendingImport || failedImportId) && !importing && !loadingDefault && (
          <div className="rounded border border-orange-200 bg-orange-50 p-3 text-xs text-orange-950">
            {workspace?.pendingImport && (
              <p className="mt-1">
                {workspace.pendingImport.fileName} — {workspace.pendingImport.featureCount}{' '}
                {t('platform.boundaryAssignment.pendingImportFeatures')}
              </p>
            )}
            <button
              type="button"
              className="btn-gov-secondary mt-2 text-xs"
              onClick={() =>
                void cancelPendingImport(
                  workspace?.pendingImport?.id ?? failedImportId!,
                )
              }
            >
              {t('platform.boundaryAssignment.cancelPendingImport')}
            </button>
          </div>
        )}

        {importError && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-900">
            <p>{importError}</p>
          </div>
        )}

        {/* Advanced: legacy browser upload (hidden by default) */}
        {!workspace?.activeImport && (
          <div className="rounded border border-gray-200 bg-gray-50">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-gray-700"
              onClick={() => setShowAdvancedUpload((v) => !v)}
            >
              {t('platform.boundaryAssignment.advancedUploadTitle')}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showAdvancedUpload ? 'rotate-180' : ''}`}
              />
            </button>
            {showAdvancedUpload && (
              <div className="space-y-2 border-t border-gray-200 p-3">
                <p className="text-xs text-gray-500">
                  {t('platform.boundaryAssignment.advancedUploadHint')}
                </p>
                <label className="btn-gov-secondary inline-flex cursor-pointer items-center justify-center gap-2 text-xs">
                  {parsing || importing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {t('platform.boundaryAssignment.upload')}
                  <input
                    type="file"
                    accept=".geojson,.json"
                    className="hidden"
                    disabled={parsing || importing}
                    onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            )}
          </div>
        )}

        {importProgress && (
          <p className="text-xs text-gray-600">
            {t('platform.boundaryAssignment.importProgress', {
              done: String(importProgress.done),
              total: String(importProgress.total),
              chunk: String(importProgress.chunkIndex),
              chunks: String(importProgress.chunkCount || '…'),
            })}
          </p>
        )}

        {parseError && <p className="text-xs text-red-600">{parseError}</p>}

        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded border border-amber-600 bg-amber-300" />
            {t('platform.boundaryAssignment.legend.unassigned')}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-blue-500" />
            {t('platform.boundaryAssignment.legend.selected')}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-emerald-600" />
            {t('platform.boundaryAssignment.legend.assigned')}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-red-500" />
            {t('platform.boundaryAssignment.legend.conflict')}
          </span>
        </div>

        {dataset && (
          <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950">
            <p className="font-semibold">{t('platform.boundaryAssignment.overlapHelpTitle')}</p>
            <p className="mt-1 whitespace-pre-line text-amber-900">
              {t('platform.boundaryAssignment.overlapHelpBody')}
            </p>
          </div>
        )}

        {dataset && (
          <>
            <div className="space-y-2">
              <input
                type="search"
                className="input-gov text-sm"
                placeholder={t('platform.boundary.admin3.searchPlaceholder')}
                value={search.text}
                onChange={(e) => {
                  setSearch((s) => ({ ...s, text: e.target.value }));
                  setPage(1);
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="input-gov text-xs"
                  placeholder={t('platform.boundary.admin3.filterAdm2')}
                  value={search.adm2}
                  onChange={(e) => {
                    setSearch((s) => ({ ...s, adm2: e.target.value }));
                    setPage(1);
                  }}
                />
                <input
                  className="input-gov text-xs"
                  placeholder={t('platform.boundary.admin3.filterAdm1')}
                  value={search.adm1}
                  onChange={(e) => {
                    setSearch((s) => ({ ...s, adm1: e.target.value }));
                    setPage(1);
                  }}
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={searchOnly}
                  onChange={(e) => setSearchOnly(e.target.checked)}
                />
                {t('platform.boundaryAssignment.searchOnly')}
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-gov-secondary text-xs" onClick={zoomToFiltered}>
                  {t('platform.boundaryAssignment.zoomFiltered')}
                </button>
                <button
                  type="button"
                  className="btn-gov-secondary text-xs"
                  onClick={clearSelection}
                  disabled={!selectedIds.size}
                >
                  {t('platform.boundary.admin3.clearSelection')}
                </button>
              </div>
            </div>

            <div className="space-y-2 rounded border border-gray-200 bg-gray-50 p-3">
              <label className="text-xs font-medium text-gray-700">
                {t('platform.boundaryAssignment.targetMunicipality')}
              </label>
              <MunicipalitySearchCombobox
                municipalities={activeMunicipalities}
                value={targetMunicipalityId}
                onChange={setTargetMunicipalityId}
              />

              {targetMunicipalityId && (
                <>
                  <p className="text-xs text-gray-600">
                    {t('platform.boundaryAssignment.assignedCount', {
                      count: String(assignedCountForTarget),
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600">
                      {t('platform.boundaryAssignment.mapColor')}
                    </label>
                    <input
                      type="color"
                      value={boundaryColor}
                      onChange={(e) => setBoundaryColor(e.target.value)}
                      className="h-8 w-12 cursor-pointer rounded border"
                    />
                    <button
                      type="button"
                      className="btn-gov-secondary text-xs"
                      disabled={colorMutation.isPending}
                      onClick={() => colorMutation.mutate()}
                    >
                      {t('platform.boundaryAssignment.saveColor')}
                    </button>
                  </div>
                </>
              )}

              <p className="text-xs text-gray-500">
                {t('platform.boundaryAssignment.selectedCount', {
                  count: String(selectedIds.size),
                })}
              </p>

              <button
                type="button"
                className="btn-gov-primary w-full text-sm"
                disabled={
                  !targetMunicipalityId || !selectedIds.size || assignMutation.isPending
                }
                onClick={() => assignMutation.mutate()}
              >
                {assignMutation.isPending ? (
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 inline h-4 w-4" />
                )}
                {t('platform.boundaryAssignment.assign', { count: String(selectedIds.size) })}
              </button>

              <button
                type="button"
                className="btn-gov-secondary w-full text-xs"
                disabled={
                  !targetMunicipalityId || !selectedIds.size || unassignMutation.isPending
                }
                onClick={() => unassignMutation.mutate()}
              >
                {t('platform.boundaryAssignment.unassign', { count: String(selectedIds.size) })}
              </button>

              <button
                type="button"
                className="btn-gov-secondary w-full text-xs text-red-800"
                disabled={!targetMunicipalityId || clearMutation.isPending}
                onClick={() => clearMutation.mutate()}
              >
                <Trash2 className="mr-1 inline h-3 w-3" />
                {t('platform.boundaryAssignment.clearMunicipality')}
              </button>

              <button
                type="button"
                className="btn-gov-secondary w-full text-xs"
                onClick={zoomToSelection}
                disabled={!selectedIds.size}
              >
                {t('platform.boundaryAssignment.zoomSelection')}
              </button>
            </div>

            <p className="text-xs text-gray-500">
              {t('platform.boundary.admin3.filterResults', {
                shown: String(filtered.length),
                total: String(dataset.featureCount),
              })}
            </p>

            <div className="max-h-48 overflow-auto rounded border border-gray-200">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-gray-50">
                  <tr>
                    <th className="px-1 py-1" />
                    <th className="px-1 py-1">{t('platform.boundary.admin3.col.name')}</th>
                    <th className="px-1 py-1">{t('platform.boundaryAssignment.col.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {pageRows.map((row) => {
                    const a = assignments.get(row.id);
                    return (
                      <tr
                        key={row.id}
                        className={selectedIds.has(row.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}
                      >
                        <td className="px-1 py-1">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.id)}
                            onChange={() => toggleFeature(row.id)}
                          />
                        </td>
                        <td className="max-w-[8rem] truncate px-1 py-1" title={row.adm3_name}>
                          {row.adm3_name}
                        </td>
                        <td className="px-1 py-1">
                          {a?.conflict ? (
                            <span className="text-red-600">
                              {t('platform.boundaryAssignment.conflict')}
                            </span>
                          ) : a ? (
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{
                                backgroundColor: resolveMunicipalityColor(
                                  a.municipalityId,
                                  municipalityColors,
                                ),
                              }}
                              title={a.municipalityName}
                            />
                          ) : (
                            <span className="text-amber-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between text-xs">
              <span>
                {t('platform.boundary.admin3.page', {
                  page: String(page),
                  total: String(totalPages),
                })}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="btn-gov-secondary px-2 py-0.5"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t('platform.boundary.admin3.prev')}
                </button>
                <button
                  type="button"
                  className="btn-gov-secondary px-2 py-0.5"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('platform.boundary.admin3.next')}
                </button>
              </div>
            </div>
          </>
        )}
      </aside>

      <main className="min-h-[32rem] flex-1">
        {mapLoading ? (
          <div className="flex h-full items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : !dataset ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
            <p>{t('platform.boundaryAssignment.mapPlaceholder')}</p>
          </div>
        ) : (
          <BoundaryAssignmentMap
            dataset={dataset}
            assignments={assignments}
            municipalityColors={municipalityColors}
            selectedIds={selectedIds}
            search={search}
            searchOnly={searchOnly}
            onFeatureClick={toggleFeature}
            fitBounds={fitBounds}
          />
        )}
      </main>
    </div>
  );
}
