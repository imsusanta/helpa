import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { ThemeProvider } from '@/hooks/use-theme';
import { ThemedToaster } from '@/components/themed-toaster';
import {
  DEFAULT_MODE,
  DEFAULT_THEME,
  MODE_STORAGE_KEY,
  MODES,
  STORAGE_KEY,
  THEME_IDS,
} from '@/lib/themes';

export const metadata: Metadata = {
  metadataBase: new URL('https://helpa.studio'),
  title:
    'Helpa — WhatsApp AI Receptionist for Clinics, Salons & Coaching Institutes',
  description:
    'Answers WhatsApp enquiries in seconds, books appointments, and captures leads 24/7. Built on the official WhatsApp Cloud API for Indian businesses.',
  keywords: [
    'WhatsApp AI Receptionist',
    'WhatsApp CRM India',
    'Clinic Appointment Booking WhatsApp',
    'Salon Booking Automation',
    'Coaching Institute Lead Capture',
    'WhatsApp Cloud API India',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title:
      'Helpa — WhatsApp AI Receptionist for Clinics, Salons & Coaching Institutes',
    description:
      'Answers WhatsApp enquiries in seconds, books appointments, and captures leads 24/7. Built on the official WhatsApp Cloud API for Indian businesses.',
    url: 'https://helpa.studio',
    siteName: 'Helpa Studio',
    locale: 'en_IN',
    type: 'website',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Helpa WhatsApp AI Receptionist & CRM',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title:
      'Helpa — WhatsApp AI Receptionist for Clinics, Salons & Coaching Institutes',
    description:
      'Answers WhatsApp enquiries in seconds, books appointments, and captures leads 24/7. Built on the official WhatsApp Cloud API for Indian businesses.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: '/favicon.svg?v=2', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png?v=2', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.png?v=2', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico?v=2', '/favicon.png?v=2'],
    apple: [
      { url: '/apple-touch-icon.png?v=2', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#020617',
  colorScheme: 'dark light',
};

const THEME_BOOT_SCRIPT = `
(function(){
  var d = document.documentElement;
  try {
    var THEME_KEY = ${JSON.stringify(STORAGE_KEY)};
    var THEME_DEFAULT = ${JSON.stringify(DEFAULT_THEME)};
    var THEMES = ${JSON.stringify(THEME_IDS)};
    var savedTheme = localStorage.getItem(THEME_KEY);
    d.dataset.theme = THEMES.indexOf(savedTheme) !== -1 ? savedTheme : THEME_DEFAULT;

    var MODE_KEY = ${JSON.stringify(MODE_STORAGE_KEY)};
    var MODE_DEFAULT = ${JSON.stringify(DEFAULT_MODE)};
    var MODES = ${JSON.stringify(MODES)};
    var savedMode = localStorage.getItem(MODE_KEY);
    d.dataset.mode = MODES.indexOf(savedMode) !== -1 ? savedMode : MODE_DEFAULT;
  } catch (_e) {
    d.dataset.theme = ${JSON.stringify(DEFAULT_THEME)};
    d.dataset.mode = ${JSON.stringify(DEFAULT_MODE)};
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      data-mode={DEFAULT_MODE}
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <Script id="theme-boot" strategy="beforeInteractive">
          {THEME_BOOT_SCRIPT}
        </Script>
      </head>
      <body className="bg-background text-foreground min-h-full font-sans">
        <ThemeProvider>
          {children}
          <ThemedToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
