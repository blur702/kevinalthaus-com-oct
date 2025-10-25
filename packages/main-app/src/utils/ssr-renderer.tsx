import React from 'react';
import { renderToString } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
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
  // Wrap component with Material-UI providers
  const app = (
    <ThemeProvider theme={backendTheme}>
      <CssBaseline />
      {component}
    </ThemeProvider>
  );

  // Render to string
  const html = renderToString(app);

  // Create full HTML document with Material-UI styling
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
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
<body>
  ${html}
  ${options.additionalBody || ''}
</body>
</html>`;
}

// escapeHtml provided by @monorepo/shared/utils/html







