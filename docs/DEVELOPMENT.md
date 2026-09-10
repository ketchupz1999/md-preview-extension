# Development

## Setup

Use Node.js 22.12 or later. Dependency installation requires internet access; the built extension runs locally.

```sh
npm ci
npm run build
```

Load `dist/` as an unpacked extension in Chrome or Edge, then enable **Allow access to file URLs**. Keep this development directory stable and reload the extension after rebuilding.

## Source layout

| Module | Responsibility |
| --- | --- |
| `src/app.jsx`, `src/sidebar.jsx`, `src/style.css` | Reader, navigation, preferences, and layout |
| `src/content.js`, `src/background.js` | Automatic preview of top-level local Markdown pages |
| `src/files.js` | Read-only directory handles, filename search, and saved reading state |
| `src/file-url.js`, `src/file-url-policy.js` | Local file URL reads, directory listings, and reference validation |
| `src/markdown.js` | Markdown rendering, local images, and scrollable tables |
| `src/diagrams.js`, `src/diagram-policy.js`, `src/diagram-dialog.jsx` | Offline Mermaid rendering and enlarged views |
| `src/html-preview.js` | Sanitized static HTML and local CSS/image resources |
| `public/manifest.json` | Manifest V3 metadata and permissions |

## Local access and rendering

The extension requests only `file:///*` host access. Chrome separately requires the user to enable file URL access. Automatic preview validates the browser-supplied sender URL and replaces only top-level Markdown pages. Local directory index rows are parsed as data; directory scripts are never executed.

File URL mode resolves local references against the opened file's path. Manual directory selection uses read-only File System Access handles and confines relative references to the selected root. Neither mode writes to source files. HTTP/HTTPS hosts and remote file shares are rejected.

Markdown raw HTML stays inert. Mermaid uses strict mode, ignores document-supplied global configuration, and sanitizes its SVG output. HTML previews use DOMPurify, a sandbox without script permission, and their own restrictive CSP. Supported local styles and images are read by the parent reader and embedded into the static preview; scripts, navigation, forms, remote resources, and CSS imports are disabled.

The extension CSP allows local file reads and bundled rendering code. It blocks remote connections, WebSockets, remote fonts, and remote scripts. Inline styles are allowed for document and diagram rendering; inline scripts and eval are not.

Recent file/folder references, paths, and reading positions are stored in IndexedDB. Preferences use localStorage. Document bodies are not persistently cached and browser sync is not used. See [Privacy](PRIVACY.md).

## Limits

| Resource | Limit |
| --- | --- |
| Text file | 8 MB |
| Bitmap image | 20 MB |
| HTML local resources | 40 resources, 32 MB total, 2 MB per stylesheet |
| Mermaid | 40 diagrams per document, 60,000 characters and 500 edges per diagram |
| Filename search | 20,000 entries or 150 results; skips `.git`, `node_modules`, and virtual environments |

Visible reader tabs check for file changes every two seconds. The refresh control also refreshes the directory. Automatic directory browsing depends on Chromium's local directory index format; manual folder selection is available if the index cannot be read.

The interface is in Simplified Chinese. Firefox and Safari packages, math typesetting, standalone SVG previews, interactive HTML scripts, and full-text search are not provided.

## Verification

```sh
npm run check
npx playwright install chromium
npm run test:browser
npm run test:files
npm run test:html
```

`check` runs unit tests and builds the extension. Browser tests use isolated Chromium profiles and generated files, covering local access, rendering, navigation, real browser zoom, table scrolling, HTML isolation, and blocked outbound requests. They do not open personal documents. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing compatible Chromium executable. Temporary test output goes to the ignored `.test-output/` directory.

## Build artifacts

```sh
npm run assets:brand
npm run assets:screenshots
npm run package
```

`dist/` is the unpacked extension. `release/md-preview-1.0.0.zip` is the installable package, with `manifest.json` at its root. Packaging requires the `zip` command. All third-party license notices are included in the build.

Brand artwork is generated from repository SVG sources. Store screenshots use the files in `examples/`; their source, dimensions, and absence of outbound requests are checked by the screenshot script. [Store materials](chrome-store/README.md) list the upload assets and descriptions.

Keep the version in `package.json`, the root package-lock entries, and `public/manifest.json` synchronized. CI builds and uploads an artifact; it does not publish a GitHub Release or submit to the Chrome Web Store.
