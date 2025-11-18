# Dilly

A productivity Chrome extension that keeps you focused on work by blocking distractions, tracking your focus time, and celebrating when you reach your goals.

## Features

### Core Functionality

- **Work URL Focus** - Set your work URL and Dilly will keep you on track
- **Goal Time Setting** - Set a daily work goal (in minutes) before starting
- **Focus Time Tracking** - Accumulated focus time that persists across page changes
- **Progress Bar** - Visual progress toward your goal
- **Auto-stop** - Automatically stops when you reach your goal

### Distraction Blocking

- **Entertainment Site Blocker** - Full-page overlay on blocked sites with angry face and "GO BACK TO WORK!!!"
- **1-Minute Nagger** - When you're off your work site, a countdown starts. After 1 minute, an overlay appears and redirects you back to work
- **Smart Tab Management** - Focuses existing work tabs instead of creating duplicates
- **New Tab Redirect** - New tabs automatically redirect to your work URL

### Break Management

- **Snooze Mode** - Take 5, 10, or 15 minute breaks
- **Blue Snooze UI** - Relaxing blue interface with sleeping emoji while on break
- **Countdown Timer** - Shows remaining snooze time

### Positive Reinforcement

- **Confetti Celebration** - When you reach your goal, colorful confetti animations appear
- **Dual Celebration** - Celebration shows on both the side panel AND the work page
- **Achievement Message** - "Goal Reached!" with your total work time

### UI Modes

The side panel has multiple contextual modes:

1. **Settings Mode** - Configure work URL, goal time, and blocked sites
2. **Focus Mode** - Green interface showing focus time and progress (when on work site)
3. **Nagging Mode** - Red interface with "GO BACK TO WORK!!!" and countdown (when off work site)
4. **Snooze Mode** - Blue interface with sleep emoji and remaining time
5. **Celebration Mode** - Colorful confetti when goal is reached

## Installation

### From Source

1. Clone this repository
2. Install dependencies: `pnpm install`
3. Build: `pnpm dev` (development) or `pnpm build` (production)
4. Open `chrome://extensions` in Chrome
5. Enable "Developer mode"
6. Click "Load unpacked" and select the `dist` folder

### From Zip

1. Download the extension zip file
2. Open `chrome://extensions` in Chrome
3. Enable "Developer mode"
4. Drag and drop the zip file, or extract and "Load unpacked"

## Usage

### Getting Started

1. Click the Dilly extension icon in your toolbar to open the side panel
2. Enter your work URL (e.g., `https://github.com`)
3. Set your work goal (e.g., 60 minutes)
4. Click "Start Working"

### During Work

- **On work site**: See your accumulated focus time and progress bar
- **Off work site**: See countdown to next nag (1 minute)
- **After 1 minute away**: Overlay appears → 3-second countdown → Returns you to work

### Taking Breaks

Click one of the snooze buttons (5m, 10m, 15m) to pause tracking. The UI turns blue and shows remaining break time. Click "End break early" to resume.

### Reaching Your Goal

When your focus time reaches your goal:
1. Nagger automatically stops
2. Confetti celebration appears on side panel
3. Celebration overlay appears on your work page
4. Both auto-dismiss after 5 seconds (or click Dismiss)

### Managing Blocked Sites

Add sites to block by typing the domain (e.g., `linkedin.com`) and clicking the + button. Remove sites by clicking the X next to them.

**Default blocked sites:**
- youtube.com
- bilibili.com
- pornhub.com
- reddit.com
- twitter.com / x.com
- instagram.com
- facebook.com
- tiktok.com
- twitch.tv
- netflix.com

### OAuth Protection

Google login, GitHub OAuth, and other authentication flows work without interruption. Dilly automatically skips these URLs.

## How It Works

### Timer Logic

1. **Away Timer** - Starts when you leave your work site
2. **Focus Timer** - Accumulates time spent on work site
3. **Snooze Timer** - Pauses both timers during breaks

### Overlay System

- **Countdown Overlay** - Semi-transparent with 3-second countdown before redirect
- **Blocked Site Overlay** - Full-page block with snooze options
- **Celebration Overlay** - Confetti animation with goal achievement message

### Storage

All state is persisted in Chrome's local storage:
- Work URL
- Goal time
- Accumulated focus time
- Blocked sites list
- Timer states

## Tech Stack

- React 18 + TypeScript
- Vite + Turborepo
- Tailwind CSS
- Chrome Extension Manifest V3
- Chrome APIs: storage, tabs, alarms, scripting, sidePanel

## Development

```bash
# Install dependencies
pnpm install

# Start development server (with hot reload)
pnpm dev

# Build for production
pnpm build

# Create distribution zip
pnpm zip

# Lint
pnpm lint

# Type check
pnpm type-check
```

### Project Structure

```
├── chrome-extension/     # Background service worker & manifest
├── packages/
│   ├── storage/         # Chrome storage wrapper & state management
│   ├── shared/          # Shared utilities & hooks
│   └── ui/              # Shared UI components
├── pages/
│   ├── side-panel/      # Main side panel UI
│   ├── new-tab/         # Blocked page redirect
│   ├── content-ui/      # Page overlays & widgets
│   └── options/         # Extension options page
└── dist/                # Built extension files
```

## Permissions

- `storage` - Save settings and state
- `tabs` - Monitor tab changes and focus
- `alarms` - Timer checks
- `scripting` - Inject overlays on pages
- `sidePanel` - Side panel UI
- `<all_urls>` - Check any URL against work/blocked lists

## License

MIT
