import { Hono } from "hono";

/**
 * Generates themed Scalar API documentation HTML
 * Matches aibtc.com branding: black background, orange accents
 */
export function getScalarHTML(specUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>STX402 API</title>
  <meta name="description" content="X402 micropayment-gated API endpoints on Stacks">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>">
  <style>
    /* aibtc.com branding: black + orange theme */
    .dark-mode,
    .light-mode {
      --scalar-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

      /* Orange accent - Bitcoin/aibtc orange */
      --scalar-color-accent: #f7931a;

      /* Dark backgrounds */
      --scalar-background-1: #0a0a0f;
      --scalar-background-2: #18181b;
      --scalar-background-3: #27272a;
      --scalar-background-accent: rgba(247, 147, 26, 0.1);

      /* Text colors */
      --scalar-color-1: #e4e4e7;
      --scalar-color-2: #a1a1aa;
      --scalar-color-3: #71717a;

      /* Border */
      --scalar-border-color: #27272a;

      /* Buttons */
      --scalar-button-1: #f7931a;
      --scalar-button-1-hover: #fbbf24;
      --scalar-button-1-color: #000000;

      /* Code blocks */
      --scalar-color-code-keyword: #f7931a;
      --scalar-color-code-string: #22d3ee;
      --scalar-color-code-number: #a855f7;
      --scalar-color-code-comment: #52525b;
    }

    /* Force dark mode only */
    .light-mode {
      color-scheme: dark;
    }

    /* Custom scrollbar */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    ::-webkit-scrollbar-track {
      background: #18181b;
    }
    ::-webkit-scrollbar-thumb {
      background: #3f3f46;
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #52525b;
    }

    /* Header branding */
    .scalar-app .sidebar-header {
      border-bottom: 1px solid #27272a;
    }

    /* Tag colors - match category colors from guide.ts */
    .scalar-app [data-tag="Stacks"] { --scalar-color-accent: #f7931a; }
    .scalar-app [data-tag="AI"] { --scalar-color-accent: #a855f7; }
    .scalar-app [data-tag="Text"] { --scalar-color-accent: #06b6d4; }
    .scalar-app [data-tag="Data"] { --scalar-color-accent: #3b82f6; }
    .scalar-app [data-tag="Crypto"] { --scalar-color-accent: #fb923c; }
    .scalar-app [data-tag="Random"] { --scalar-color-accent: #0ea5e9; }
    .scalar-app [data-tag="Math"] { --scalar-color-accent: #6366f1; }
    .scalar-app [data-tag="Utility"] { --scalar-color-accent: #22d3ee; }
    .scalar-app [data-tag="Network"] { --scalar-color-accent: #10b981; }
    .scalar-app [data-tag="Registry"] { --scalar-color-accent: #f59e0b; }
    .scalar-app [data-tag="Storage"] { --scalar-color-accent: #8b5cf6; }
    .scalar-app [data-tag="Agent"] { --scalar-color-accent: #34d399; }
    .scalar-app [data-tag="System"] { --scalar-color-accent: #71717a; }
  </style>
</head>
<body>
  <script id="api-reference" data-url="${specUrl}"></script>
  <script>
    var configuration = {
      theme: 'none',
      darkMode: true,
      hideDarkModeToggle: true,
      layout: 'modern',
      showSidebar: true,
      hideModels: false,
      defaultOpenAllTags: false,
      metaData: {
        title: 'STX402 API',
        description: 'X402 micropayment-gated API endpoints on Stacks',
      },
      servers: [
        { url: 'https://stx402.com', description: 'Production' },
        { url: 'http://localhost:8787', description: 'Local Development' },
      ],
    }
    document.getElementById('api-reference').dataset.configuration = JSON.stringify(configuration)
  </script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
}

/**
 * Register the Scalar docs route on a Hono app
 */
export function registerScalarDocs(app: Hono<{ Bindings: Env }>, path: string = "/", specUrl: string = "/openapi.json") {
  app.get(path, (c) => {
    return c.html(getScalarHTML(specUrl));
  });
}
