'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

export type ActionMenuItem = {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  separatorBefore?: boolean;
  disabled?: boolean;
};

const MENU_WIDTH = 224; // matches w-56
const VIEWPORT_MARGIN = 8;

/**
 * Row/card action menu rendered through a portal to <body> with fixed
 * positioning. This escapes any ancestor `overflow-hidden` / stacking context
 * (e.g. `.gov-card overflow-hidden` wrapping tables) so the menu is never
 * clipped behind the table, cards, banners, or the map.
 */
export function ActionMenu({
  items,
  triggerClassName,
  trigger,
  ariaLabel,
}: {
  items: ActionMenuItem[];
  triggerClassName?: string;
  trigger?: ReactNode;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const updatePosition = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN),
    );
    // Flip above the trigger when there isn't room below.
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      menuHeight > 0 && spaceBelow < menuHeight + VIEWPORT_MARGIN
        ? Math.max(VIEWPORT_MARGIN, rect.top - menuHeight - 4)
        : rect.bottom + 4;
    setCoords({ top, left });
  };

  useLayoutEffect(() => {
    if (open) updatePosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => updatePosition();
    const onDocPointer = (e: MouseEvent) => {
      if (
        menuRef.current?.contains(e.target as Node) ||
        btnRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    document.addEventListener('mousedown', onDocPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('mousedown', onDocPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel ?? 'Actions'}
        onClick={() => setOpen((v) => !v)}
        className={
          triggerClassName ??
          'inline-flex items-center rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200'
        }
      >
        {trigger ?? <MoreVertical className="h-4 w-4" />}
      </button>

      {mounted &&
        open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 1000 }}
            className="w-56 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
          >
            {items.map((item) => (
              <div key={item.key}>
                {item.separatorBefore && <hr className="my-1 border-gray-100" />}
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs disabled:cursor-not-allowed disabled:opacity-50 ${
                    item.danger
                      ? 'text-red-700 hover:bg-red-50'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
