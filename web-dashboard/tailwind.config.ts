import type { Config } from 'tailwindcss';

/**
 * Government / municipality colour palette.
 *
 * "brand" = the primary action colour (navy blue) used for buttons,
 * active nav items, and interactive elements.
 *
 * "gov" = extended palette for the institutional tone:
 *   - navy   : deep authority blue for headings and sidebar
 *   - slate  : neutral working surface
 *   - muted  : muted-blue for secondary accents
 *   - alert  : serious red for SLA breaches and critical alerts
 *   - success: muted green for resolved / OK states
 *   - warn   : amber for caution / pending states
 */
const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary action blue (navy-leaning, replaces the generic bright blue)
        brand: {
          50:  '#eef2f8',
          100: '#d5dff0',
          200: '#aabee0',
          300: '#7899cc',
          400: '#4d77b8',
          500: '#2b5aa3',
          600: '#1e4488',
          700: '#163470',
          800: '#0f2555',
          900: '#091a3d',
          950: '#050e24',
        },
        // Deep government navy (for sidebar bg, section headers in dark variant)
        navy: {
          50:  '#f0f3f8',
          100: '#d8deec',
          200: '#b2bedd',
          300: '#8196c9',
          400: '#5572b3',
          500: '#3455a0',
          600: '#244089',
          700: '#1a2f6a',
          800: '#122050',
          900: '#0c1639',
          950: '#070d25',
        },
        // Alert / overdue red — serious, not playful
        alert: {
          50:  '#fff1f1',
          100: '#ffd9d9',
          200: '#ffb3b3',
          300: '#ff7a7a',
          400: '#f54040',
          500: '#e01a1a',
          600: '#c01010',
          700: '#9e0d0d',
          800: '#7d0d0d',
          900: '#5c0909',
          950: '#3a0606',
        },
        // Operational success green — muted, professional
        success: {
          50:  '#f0f9f1',
          100: '#d4eed7',
          200: '#a8ddb0',
          300: '#72c37e',
          400: '#44a854',
          500: '#288e39',
          600: '#1d722e',
          700: '#155726',
          800: '#103d1c',
          900: '#0a2812',
        },
        // Warning amber — pending / at-risk
        warn: {
          50:  '#fffaeb',
          100: '#fef0c7',
          200: '#fcd98a',
          300: '#fabb4c',
          400: '#f99d1c',
          500: '#e07c0a',
          600: '#b85f07',
          700: '#8f440a',
          800: '#6b330d',
          900: '#4a230d',
        },
      },
      fontFamily: {
        // Use a system-level Arabic font for RTL content
        arabic: ['Tahoma', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
