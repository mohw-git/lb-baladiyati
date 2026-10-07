'use client';

import { useCallback, useMemo, useState } from 'react';
import { Loader2, Upload, MapPin, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslate } from '@/lib/i18n/index';
import {
  Admin3ParseError,
  filterAdmin3Features,
  mergeAdmin3Selection,
  parseAdmin3GeoJsonFile,
  type Admin3Dataset,
  type Admin3FeatureRow,
  type Admin3ImportMeta,
  type Admin3SearchQuery,
} from '@/lib/geo/admin3-geojson-import';
import type { BoundaryGeometry } from '@/lib/geo/boundary-geojson-export';

const PAGE_SIZE = 50;

export type Admin3BoundaryImportProps = {
  onApplyToEditor: (geometry: BoundaryGeometry, meta: Admin3ImportMeta) => void;
};

export default function Admin3BoundaryImport({ onApplyToEditor }: Admin3BoundaryImportProps) {
  const t = useTranslate();
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dataset, setDataset] = useState<Admin3Dataset | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState<Admin3SearchQuery>({
    text: '',
    adm1: '',
    adm2: '',
    pcode: '',
  });
  const [page, setPage] = useState(1);
  const [lastMeta, setLastMeta] = useState<Admin3ImportMeta | null>(null);

  const filtered = useMemo(() => {
    if (!dataset) return [];
    return filterAdmin3Features(dataset.features, search);
  }, [dataset, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setParsing(true);
      setParseError(null);
      setDataset(null);
      setSelectedIds(new Set());
      setLastMeta(null);
      setPage(1);
      try {
        const parsed = await parseAdmin3GeoJsonFile(file);
        setDataset(parsed);
        toast.success(
          t('platform.boundary.admin3.toast.parsed', {
            count: String(parsed.featureCount),
          }),
        );
      } catch (err) {
        const msg =
          err instanceof Admin3ParseError
            ? err.message
            : err instanceof Error
              ? err.message
              : t('common.error');
        setParseError(msg);
        toast.error(msg);
      } finally {
        setParsing(false);
      }
    },
    [t],
  );

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePage = () => {
    const pageIds = pageRows.map((r) => r.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const applySelection = () => {
    if (!dataset || selectedIds.size === 0) {
      toast.error(t('platform.boundary.admin3.error.noSelection'));
      return;
    }
    const result = mergeAdmin3Selection(dataset, Array.from(selectedIds));
    if (!result) {
      toast.error(t('platform.boundary.admin3.error.mergeFailed'));
      return;
    }
    setLastMeta(result.meta);
    onApplyToEditor(result.geometry, result.meta);
    toast.success(
      t('platform.boundary.admin3.toast.applied', { count: String(selectedIds.size) }),
    );
  };

  const updateSearch = (patch: Partial<Admin3SearchQuery>) => {
    setSearch((s) => ({ ...s, ...patch }));
    setPage(1);
  };

  return (
    <div className="space-y-4 border-t border-gray-100 p-4">
      <p className="text-xs text-gray-600">{t('platform.boundary.admin3.hint')}</p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="btn-gov-secondary inline-flex cursor-pointer items-center gap-2 text-sm">
          {parsing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {t('platform.boundary.admin3.chooseFile')}
          <input
            type="file"
            accept=".geojson,.json,application/geo+json,application/json"
            className="hidden"
            disabled={parsing}
            onChange={(e) => {
              const f = e.target.files?.[0];
              void handleFile(f ?? null);
              e.target.value = '';
            }}
          />
        </label>
        {dataset && (
          <span className="text-xs text-gray-600">
            {t('platform.boundary.admin3.loaded', {
              file: dataset.fileName,
              count: String(dataset.featureCount),
              skipped: String(dataset.skippedCount),
            })}
          </span>
        )}
      </div>

      {parseError && (
        <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800">{parseError}</p>
      )}

      {dataset && (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input
              type="search"
              placeholder={t('platform.boundary.admin3.searchPlaceholder')}
              value={search.text}
              onChange={(e) => updateSearch({ text: e.target.value })}
              className="input-gov text-sm"
            />
            <input
              type="text"
              placeholder={t('platform.boundary.admin3.filterAdm1')}
              value={search.adm1}
              onChange={(e) => updateSearch({ adm1: e.target.value })}
              className="input-gov text-sm"
            />
            <input
              type="text"
              placeholder={t('platform.boundary.admin3.filterAdm2')}
              value={search.adm2}
              onChange={(e) => updateSearch({ adm2: e.target.value })}
              className="input-gov text-sm"
            />
            <input
              type="text"
              placeholder={t('platform.boundary.admin3.filterPcode')}
              value={search.pcode}
              onChange={(e) => updateSearch({ pcode: e.target.value })}
              className="input-gov text-sm"
            />
          </div>

          <p className="text-xs text-gray-500">
            {t('platform.boundary.admin3.filterResults', {
              shown: String(filtered.length),
              total: String(dataset.featureCount),
            })}
            {dataset.validOn || dataset.version ? (
              <>
                {' '}
                · {t('platform.boundary.admin3.sourceMeta', {
                  validOn: dataset.validOn ?? '—',
                  version: dataset.version ?? '—',
                })}
              </>
            ) : null}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-gov-primary inline-flex items-center gap-1 text-sm"
              disabled={selectedIds.size === 0}
              onClick={applySelection}
            >
              <MapPin className="h-4 w-4" />
              {t('platform.boundary.admin3.applyToMap', { count: String(selectedIds.size) })}
            </button>
            <button type="button" className="btn-gov-secondary text-xs" onClick={() => setSelectedIds(new Set())}>
              {t('platform.boundary.admin3.clearSelection')}
            </button>
          </div>

          {lastMeta && (
            <div className="rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
              <p className="font-semibold">{t('platform.boundary.admin3.lastImport')}</p>
              <p>
                {lastMeta.sourceFileName} · {lastMeta.featureCount}{' '}
                {t('platform.boundary.admin3.features')}
              </p>
              <p className="mt-1 truncate" title={lastMeta.selectedNames.join(', ')}>
                {lastMeta.selectedNames.join(', ')}
              </p>
              <p className="text-blue-700">PCodes: {lastMeta.selectedPcodes.join(', ')}</p>
            </div>
          )}

          <div className="overflow-hidden rounded border border-gray-200">
            <div className="max-h-96 overflow-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                <thead className="sticky top-0 bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-2 py-2">
                      <button type="button" onClick={togglePage} className="text-gray-700" title="Toggle page">
                        {pageRows.length > 0 &&
                        pageRows.every((r) => selectedIds.has(r.id)) ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-2 py-2 font-medium">{t('platform.boundary.admin3.col.name')}</th>
                    <th className="px-2 py-2 font-medium">{t('platform.boundary.admin3.col.nameAr')}</th>
                    <th className="px-2 py-2 font-medium">{t('platform.boundary.admin3.col.pcode')}</th>
                    <th className="px-2 py-2 font-medium">{t('platform.boundary.admin3.col.adm2')}</th>
                    <th className="px-2 py-2 font-medium">{t('platform.boundary.admin3.col.adm1')}</th>
                    <th className="px-2 py-2 font-medium">{t('platform.boundary.admin3.col.area')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {pageRows.map((row) => (
                    <Admin3TableRow
                      key={row.id}
                      row={row}
                      selected={selectedIds.has(row.id)}
                      onToggle={() => toggleRow(row.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>
              {t('platform.boundary.admin3.page', {
                page: String(page),
                total: String(totalPages),
              })}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-gov-secondary px-2 py-1"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t('platform.boundary.admin3.prev')}
              </button>
              <button
                type="button"
                className="btn-gov-secondary px-2 py-1"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t('platform.boundary.admin3.next')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Admin3TableRow({
  row,
  selected,
  onToggle,
}: {
  row: Admin3FeatureRow;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <tr className={selected ? 'bg-blue-50' : 'hover:bg-gray-50'}>
      <td className="px-2 py-1.5">
        <input type="checkbox" checked={selected} onChange={onToggle} className="rounded border-gray-300" />
      </td>
      <td className="max-w-[10rem] truncate px-2 py-1.5 font-medium text-gray-900" title={row.adm3_name}>
        {row.adm3_name}
      </td>
      <td className="max-w-[8rem] truncate px-2 py-1.5 text-gray-700" dir="rtl" title={row.adm3_name_ar ?? ''}>
        {row.adm3_name_ar ?? '—'}
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 text-gray-600">{row.adm3_pcode}</td>
      <td className="max-w-[8rem] truncate px-2 py-1.5 text-gray-600" title={row.adm2_name}>
        {row.adm2_name}
      </td>
      <td className="max-w-[8rem] truncate px-2 py-1.5 text-gray-600" title={row.adm1_name}>
        {row.adm1_name}
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 text-gray-500">
        {row.area_sqkm != null ? row.area_sqkm.toFixed(2) : '—'}
      </td>
    </tr>
  );
}
