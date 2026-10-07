/**
 * Baladiyati mobile design tokens — government/municipal visual language.
 * Extend carefully; most screens still import Colors/Spacing directly.
 */
export const Colors = {
  /** Deep navy — primary government base (aligned with notification icon #0c1a2e) */
  navy: {
    50: '#f0f4f8',
    100: '#d9e2ec',
    200: '#bcccdc',
    300: '#9fb3c8',
    400: '#829ab1',
    500: '#627d98',
    600: '#486581',
    700: '#334e68',
    800: '#243b53',
    900: '#0c1a2e',
  },
  /** Primary brand maps to navy for consistency with web Baladiyati */
  brand: {
    50: '#f0f4f8',
    100: '#d9e2ec',
    200: '#bcccdc',
    300: '#9fb3c8',
    400: '#829ab1',
    500: '#627d98',
    600: '#334e68',
    700: '#243b53',
    800: '#1a2f45',
    900: '#0c1a2e',
  },
  /** Subtle Lebanese cedar accent — use sparingly */
  cedar: {
    50: '#f0fdf4',
    100: '#dcfce7',
    500: '#16a34a',
    600: '#15803d',
    700: '#166534',
  },
  gray: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  green: { 50: '#f0fdf4', 100: '#dcfce7', 500: '#22c55e', 600: '#16a34a', 700: '#15803d' },
  red: { 50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c' },
  orange: { 50: '#fff7ed', 100: '#ffedd5', 500: '#f97316', 600: '#ea580c', 700: '#c2410c' },
  yellow: { 50: '#fefce8', 100: '#fef9c3', 500: '#eab308', 600: '#ca8a04', 700: '#a16207' },
  purple: { 50: '#faf5ff', 100: '#f3e8ff', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce' },
  blue: { 50: '#eff6ff', 100: '#dbeafe', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' },
  white: '#ffffff',
  black: '#000000',
  /** Screen backgrounds */
  surface: '#f4f6f9',
  surfaceMuted: '#eef2f6',
  surfaceElevated: '#ffffff',
  /** Official alert — errors/rejections only */
  officialRed: {
    50: '#fef2f2',
    600: '#b91c1c',
    700: '#991b1b',
  },
};

/** Navy overlay strengths for hero photography */
export const Overlay = {
  auth: 'rgba(12, 26, 46, 0.82)',
  citizenHero: 'rgba(12, 26, 46, 0.72)',
  workerHero: 'rgba(12, 26, 46, 0.78)',
  subtle: 'rgba(12, 26, 46, 0.55)',
};

export const Typography = {
  lineHeight: {
    tight: 20,
    body: 22,
    relaxed: 26,
  },
  letterSpacing: {
    label: 0.4,
    reference: 1.2,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 36,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 24,
  full: 999,
};

/** Minimum touch target (WCAG-friendly) */
export const TouchTarget = {
  minHeight: 48,
  minWidth: 48,
};

export const Shadow = {
  sm: {
    shadowColor: Colors.navy[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: Colors.navy[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: Colors.navy[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
};
