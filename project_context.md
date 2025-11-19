# Project Context: Dilly

## Overview
**Dilly** is a productivity Chrome extension designed to keep users focused on work. It features distraction blocking, focus time tracking, goal setting, and positive reinforcement mechanisms.

## Architecture
The project is a **monorepo** managed with **Turborepo** and **pnpm**.

### Directory Structure
- **`chrome-extension/`**: Contains the manifest and background service worker.
- **`pages/`**: Individual extension pages, each as a separate package.
  - `popup/`: Extension toolbar popup.
  - `options/`: Options page.
  - `new-tab/`: Custom new tab page.
  - `side-panel/`: Main side panel UI.
  - `content/`: Content scripts.
  - `content-ui/`: React components injected into pages.
- **`packages/`**: Shared utilities and libraries.
  - `@extension/shared`: Shared React components, hooks, and utilities.
  - `@extension/storage`: Chrome storage wrappers.
  - `@extension/ui`: UI utilities and Tailwind config.
  - `@extension/i18n`: Internationalization support.

## Tech Stack
- **Core**: React 18, TypeScript
- **Build System**: Vite, Turborepo
- **Styling**: Tailwind CSS
- **Package Manager**: pnpm (v10.11.0)
- **Runtime**: Node.js (>=22.15.1)
- **Extension Platform**: Manifest V3 (Chrome & Firefox support)

## Key Features
1.  **Focus Management**: Tracks time on work URLs, blocks distraction sites.
2.  **Goal Setting**: Daily work goal in minutes.
3.  **UI Modes**:
    - **Focus Mode**: Green UI when working.
    - **Nagging Mode**: Red UI when distracted.
    - **Snooze Mode**: Blue UI for breaks.
    - **Celebration Mode**: Confetti when goals are reached.
4.  **Distraction Blocking**: Overlays on blocked sites, redirects to work URL.

## Development Workflow
### Essential Commands
- **Install Dependencies**: `pnpm install`
- **Start Development**: `pnpm dev` (Chrome), `pnpm dev:firefox` (Firefox)
- **Build Production**: `pnpm build`
- **Linting**: `pnpm lint`
- **Type Check**: `pnpm type-check`
- **Package**: `pnpm zip`

### Environment Variables
- Static variables in `.env` must use `CEB_` prefix.
- CLI variables use `CLI_CEB_` prefix.

## Configuration
- **`package.json`**: Root dependencies and scripts.
- **`pnpm-workspace.yaml`**: Workspace definitions.
- **`turbo.json`**: Build pipeline configuration.
- **`CLAUDE.md`**: AI assistant guidance and project details.
