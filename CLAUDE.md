# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome/Firefox extension boilerplate built with React, TypeScript, Vite, and Turborepo. It provides a modern development experience with hot module reload (HMR) for extension development.

## Essential Commands

### Development
- `pnpm dev` - Start development mode for Chrome (run as administrator on Windows)
- `pnpm dev:firefox` - Start development mode for Firefox
- `pnpm build` - Build production version for Chrome
- `pnpm build:firefox` - Build production version for Firefox

### Testing & Quality
- `pnpm lint` - Run ESLint on all packages
- `pnpm lint:fix` - Fix linting issues automatically
- `pnpm format` - Format code with Prettier
- `pnpm type-check` - Run TypeScript type checking
- `pnpm e2e` - Run end-to-end tests (Chrome)
- `pnpm e2e:firefox` - Run end-to-end tests (Firefox)

### Package Management
- `pnpm zip` - Build and package extension as zip file
- `pnpm update-version <version>` - Update extension version across all packages
- `pnpm module-manager` - Interactive tool to enable/disable extension pages/features
- `pnpm i <package> -w` - Install dependency at workspace root
- `pnpm i <package> -F <module-name>` - Install dependency for specific module (e.g., `pnpm i axios -F popup`)

### Utility
- `pnpm clean` - Clean all build artifacts and node_modules
- `pnpm clean:bundle` - Clean only dist folders
- `pnpm set-global-env` - Set global environment variables (used internally by build scripts)

## Architecture

### Monorepo Structure
This is a Turborepo monorepo with three main sections:

1. **chrome-extension/** - Extension configuration and entry point
   - `manifest.ts` - Generates manifest.json (supports both Chrome MV3 and Firefox)
   - `src/background/` - Service worker implementation
   - `public/` - Static assets (icons, content.css)

2. **pages/** - Extension UI pages (each is a separate package)
   - `popup/` - Extension toolbar popup
   - `options/` - Extension options page
   - `new-tab/` - Custom new tab page
   - `side-panel/` - Chrome side panel (Chrome 114+)
   - `devtools/` & `devtools-panel/` - DevTools integration
   - `content/` - Content scripts injected into pages
   - `content-ui/` - React components injected into pages
   - `content-runtime/` - Dynamically injectable content scripts

3. **packages/** - Shared utilities and tools
   - `@extension/shared` - Shared React components, hooks (useStorage), HOCs (withErrorBoundary, withSuspense), and utilities
   - `@extension/storage` - Chrome storage API helpers
   - `@extension/i18n` - Type-safe internationalization (validates all locales have same keys)
   - `@extension/env` - Environment variable management (requires `CEB_` prefix in .env)
   - `@extension/hmr` - Custom HMR implementation for live reload during development
   - `@extension/ui` - Tailwind config merger and UI utilities
   - `@extension/tailwind-config` - Shared Tailwind configuration
   - `@extension/vite-config` - Shared Vite configuration
   - `@extension/tsconfig` - Shared TypeScript configuration
   - `@extension/dev-utils` - Development utilities (manifest parser, file streaming)
   - `@extension/module-manager` - CLI tool to enable/disable features
   - `@extension/zipper` - Build artifact packaging

### Key Design Patterns

**Module Management**: Pages can be disabled/removed using `pnpm module-manager`. Deleted modules are compressed and stored in `/archive` for recovery. Always edit MODULE_CONFIG when modifying content script matches.

**Environment Variables**:
- Static vars in `.env` must use `CEB_` prefix
- CLI vars use `CLI_CEB_` prefix (e.g., `CLI_CEB_DEV`, `CLI_CEB_FIREFOX`)
- Dynamic vars configured in `packages/env/lib/index.ts`
- Access via `process.env.CEB_EXAMPLE` or import constants from `@extension/env`

**Internationalization**:
- Translations in `packages/i18n/locales/{locale}/messages.json`
- Type-safe: TypeScript errors if keys missing in any locale
- Use `t('key')` or `t('key', 'placeholder')` for translations
- Dev locale override: set `CEB_DEV_LOCALE` in .env

**Storage**:
- Use `@extension/shared` hooks like `useStorage()` to share state across all extension contexts (popup, content scripts, background, etc.)
- Storage helpers abstract chrome.storage.local/session APIs

**Content Scripts**:
- `content/` - Plain JS injected scripts (no UI)
- `content-ui/` - React components with Shadow DOM injection
- `content-runtime/` - Scripts that can be injected programmatically from other pages
- Configured via matches in `chrome-extension/manifest.ts`

**Build System**:
- Turborepo orchestrates builds with task dependencies
- Each page/package has its own Vite config extending shared `@extension/vite-config`
- `ready` task runs before `dev`/`build` to prepare dependencies
- HMR server runs during development for live reload
- Manifest is generated from TypeScript and adapted for target browser (Firefox doesn't support sidePanel)

## Important Notes

- Node version must be >= 22.15.1 (see package.json engines)
- Uses pnpm@10.11.0 as package manager
- Extension has `<all_urls>` permissions - limit this in production
- On Windows, WSL is required for development
- Module names in package.json use `@extension/` prefix but can be referenced without it in CLI (e.g., `content-script` instead of `@extension/content-script`)
- E2E tests use WebdriverIO with Mocha
- Always save files from `/archive` folder - required for module recovery
