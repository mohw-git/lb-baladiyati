import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

/**
 * Load Inter for Latin scripts. Arabic text uses the system font stack
 * (Tahoma / Arial) which is specified via the `arabic` font family in
 * tailwind.config.ts and applied via :lang(ar) in globals.css.
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Baladi — Municipal Services Portal',
  description: 'Official municipal complaint management and citizen services portal.',
  other: {
    // Government-standard meta
    'application-name': 'Baladi Municipal Portal',
    'theme-color': '#0f2555',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /**
     * dir and lang are set at runtime by useLocaleSync() in providers.tsx
     * so the HTML element updates immediately on language change.
     * The default lang="ar" is intentionally NOT set here to avoid
     * hydration mismatches; useLocaleSync sets it after hydration.
     */
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Ensure proper rendering on all mobile devices */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
