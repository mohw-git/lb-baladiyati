'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { useLocale, useTranslate, pickName, type Locale } from '@/lib/i18n/index';

export type MunicipalityPickerItem = {
  id: string;
  name: string;
  nameAr?: string | null;
  nameFr?: string | null;
  code: string;
  configured?: boolean;
  sourceType?: string | null;
};

function matchesSearch(m: MunicipalityPickerItem, query: string, locale: Locale): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const parts = [m.name, m.code, m.nameAr ?? '', m.nameFr ?? '', pickName(m, locale)];
  return parts.some((p) => p.toLowerCase().includes(needle));
}

function sourceSuffix(m: MunicipalityPickerItem): string {
  if (!m.configured) return '';
  return m.sourceType === 'AUTO_FROM_SOURCE' ? ' · source' : ' · manual';
}

export function MunicipalitySearchCombobox({
  municipalities,
  value,
  onChange,
  disabled,
}: {
  municipalities: MunicipalityPickerItem[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslate();
  const locale = useLocale();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  const selected = municipalities.find((m) => m.id === value);

  const filtered = useMemo(
    () => municipalities.filter((m) => matchesSearch(m, query, locale)),
    [municipalities, query, locale],
  );

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const select = useCallback(
    (id: string) => {
      onChange(id);
      setOpen(false);
      setQuery('');
    },
    [onChange],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filtered.length) setHighlight((h) => Math.min(h + 1, filtered.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filtered.length) setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === 'Enter' && filtered[highlight]) {
      e.preventDefault();
      select(filtered[highlight]!.id);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="select-gov flex w-full items-center justify-between gap-2 text-start text-sm"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          setOpen((o) => !o);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <span className={selected ? 'truncate text-gray-900' : 'text-gray-500'}>
          {selected
            ? `${pickName(selected, locale)} (${selected.code})${sourceSuffix(selected)}`
            : t('platform.boundaryAssignment.selectMunicipality')}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-gray-100 px-2 py-1.5">
            <Search className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              ref={inputRef}
              type="search"
              className="input-gov min-h-0 border-0 py-1 text-sm shadow-none focus:ring-0"
              placeholder={t('platform.boundaryAssignment.searchMunicipality')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              aria-controls={listId}
              aria-autocomplete="list"
              autoComplete="off"
            />
          </div>
          <ul id={listId} role="listbox" className="max-h-56 overflow-y-auto py-1 text-sm">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-gray-500">{t('common.noResults')}</li>
            ) : (
              filtered.map((m, i) => (
                <li key={m.id} role="option" aria-selected={m.id === value}>
                  <button
                    type="button"
                    className={`w-full px-3 py-2 text-start hover:bg-gray-50 ${
                      i === highlight
                        ? 'bg-blue-50'
                        : m.id === value
                          ? 'bg-gray-50 font-medium'
                          : ''
                    }`}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => select(m.id)}
                  >
                    <span className="block">{pickName(m, locale)}</span>
                    <span className="block text-xs text-gray-500">
                      {m.code}
                      {sourceSuffix(m)}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
