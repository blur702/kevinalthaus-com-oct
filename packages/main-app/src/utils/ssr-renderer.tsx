import React from 'react';
import { renderToString } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { extractCriticalToChunks } from '@emotion/server';
import { backendTheme } from '../theme/backend-theme';
import { escapeHtml } from '@monorepo/shared';

export interface SSRRenderOptions {
  title: string;
  csrfToken?: string;
  /**
   * Additional HTML to inject in <head> section
   * WARNING: This HTML is injected unsanitized. Only use with trusted, server-generated content.
   * Never pass user-supplied or untrusted content here as it could lead to XSS vulnerabilities.
   */
  additionalHead?: string;
  /**
   * Additional HTML to inject in <body> section
   * WARNING: This HTML is injected unsanitized. Only use with trusted, server-generated content.
   * Never pass user-supplied or untrusted content here as it could lead to XSS vulnerabilities.
   */
  additionalBody?: string;
}

export function renderReactSSR(component: React.ReactElement, options: SSRRenderOptions): string {
  // Create Emotion cache for SSR and extract critical CSS
  const cache = createCache({ key: 'css', prepend: true });

  const app = (
    <CacheProvider value={cache}>
      <ThemeProvider theme={backendTheme}>
        <CssBaseline />
        {component}
      </ThemeProvider>
    </CacheProvider>
  );

  // Render to string and extract critical Emotion CSS chunks
  const html = renderToString(app);
  const chunks = extractCriticalToChunks(html, { cache });
  const styleTags = chunks.styles
    .map((style) => {
      const dataAttr = `${style.key} ${style.ids.join(' ')}`.trim();
      return `<style data-emotion="${dataAttr}">${style.css}</style>`;
    })
    .join('');

  // Create full HTML document with Material-UI + Emotion SSR styling
  const bodyAttrs = options.csrfToken ? ` data-csrf-token="${escapeHtml(options.csrfToken)}"` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.title)}</title>
  <!-- Self-hosted fonts for better security and performance -->
  <!-- To use self-hosted fonts:
       1. Download Roboto (300/400/500/700) and Material Icons from Google Fonts
       2. Place font files in packages/main-app/public/fonts/
       3. Create @font-face CSS in packages/main-app/public/fonts/fonts.css
       4. Add <link rel="stylesheet" href="/fonts/fonts.css"> below
       5. Add <link rel="preload" as="font" href="/fonts/roboto-v30-latin-regular.woff2" type="font/woff2" crossorigin> for critical fonts
       6. Remove the Google Fonts links below
       7. Ensure static server serves fonts with cache headers: Cache-Control: public, max-age=31536000, immutable
  -->
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet" crossorigin="anonymous">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" crossorigin="anonymous">
  ${styleTags}
  <style>
    /* Material-UI CSS Reset and Base Styles */
    * {
      box-sizing: border-box;
    }
    html {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    body {
      margin: 0;
      font-family: "Roboto", "Helvetica", "Arial", sans-serif;
      font-size: 14px;
      line-height: 1.43;
      letter-spacing: 0.01071em;
      color: rgba(0, 0, 0, 0.87);
      background-color: #fafafa;
    }
  </style>
  ${options.additionalHead || ''}
</head>
<body${bodyAttrs}>
  ${html}
  ${options.additionalBody || ''}
</body>
</html>`;
}

// escapeHtml provided by @monorepo/shared/utils/html







