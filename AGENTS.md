# Repository Guidelines

## Project Structure & Module Organization

This repository is a Manifest V3 extension for NotebookLM. `manifest.json` defines permissions, locale defaults, content scripts, the side panel, and the service worker. Core runtime code lives in `background/service-worker.js`, `content/content-script.js`, and `sidepanel/sidepanel.js`; markup is in `sidepanel/sidepanel.html`. Tailwind source CSS starts at `src/app.css`; generated CSS and bundled CDN assets are under `assets/css/` and `assets/js/`. Icons live in `assets/icons/`. Localized strings are in `_locales/<locale>/messages.json`; keep keys aligned across locale folders.

* * *

## Build, Test, and Development Commands

- `npm install`: installs dependencies and runs the `postinstall` build.
- `npm run build`: refreshes `assets/js/tailwindcdn.min.js` and rebuilds development and minified Tailwind CSS.
- `npm run build-css`: builds `assets/css/tailwind.css` from `src/app.css`.
- `npm run build-css-prod`: builds the minified `assets/css/tailwind.min.css`.
- `npm run build-css-watch`: watches Tailwind input during UI work.
- `npm test`: currently exits with an error because no automated test suite is configured.

For local validation, run `npm run build`, open `chrome://extensions`, enable Developer mode, and load the repository as an unpacked extension.

* * *

## Coding Style & Naming Conventions

Use plain JavaScript and Chrome Extension APIs; do not add a bundler unless the project adopts one. Preserve surrounding indentation and semicolon style. Prefer `const` and `let`, small helpers, and defensive checks around dynamic NotebookLM DOM selectors. Use Tailwind utilities for UI changes; keep custom CSS minimal and scoped. All user-visible text should use `chrome.i18n.getMessage()` and matching `_locales` entries.

* * *

## Testing Guidelines

There is no formal coverage target yet. Manually test changes in Chrome or another Chromium browser against `https://notebooklm.google.com/*`. Verify service worker logs, side panel behavior, storage reads/writes, clipboard actions, and content-script DOM injection. For locale changes, confirm every `_locales/*/messages.json` file is valid JSON and contains the same keys.

* * *

## Commit & Pull Request Guidelines

Recent history favors Conventional Commit-style prefixes such as `feat:`, `fix:`, and `chore:`. Use concise, present-tense summaries, for example `feat(sidepanel): add prompt apply button`. Pull requests should describe the change, list manual validation steps, link issues, and include screenshots or recordings for UI updates. For releases, keep `package.json`, `package-lock.json`, `manifest.json`, `CHANGELOG.md`, and assets in sync.

* * *

## Security & Configuration Tips

Keep Chrome Web Store credentials in GitHub Secrets only. Do not commit extension IDs, OAuth secrets, refresh tokens, or local browser data. Preserve the existing Content Security Policy and avoid `eval`, inline scripts, or unnecessary host permissions.
