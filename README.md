# Dilly

A productivity Chrome extension that keeps you focused on work by blocking entertainment sites and redirecting new tabs to your work URL.

## Features

- **Work URL Redirect** - New tabs automatically redirect to your work URL when the nagger is active
- **Entertainment Site Blocker** - Full-page red overlay on blocked sites with "GO BACK TO WORK" message
- **Corner Widget** - Gentle reminder widget on non-blocked sites
- **Snooze** - Take a 5, 10, or 15 minute break when needed
- **Customizable Block List** - Default list includes YouTube, Reddit, Twitter, etc. Add or remove sites as needed
- **OAuth Protection** - Google login and other OAuth flows work without interruption
- **10-Minute Check** - Opens work tab automatically if none exists

## Installation

1. Clone this repository
2. Install dependencies: `pnpm install`
3. Build: `pnpm dev` (development) or `pnpm build` (production)
4. Open `chrome://extensions` in Chrome
5. Enable "Developer mode"
6. Click "Load unpacked" and select the `dist` folder

## Usage

1. Click the Dilly extension icon in your toolbar
2. Enter your work URL (e.g., `https://github.com`)
3. Click "Start Nagger"

Now:
- New tabs will redirect to your work URL
- Entertainment sites will show a blocking overlay
- Other sites will show a corner reminder widget

### Snooze

Need a break? Click one of the snooze buttons (5m, 10m, 15m) to temporarily disable blocking.

### Managing Blocked Sites

Add sites to block by typing the domain (e.g., `linkedin.com`) and clicking the + button. Remove sites by clicking the X next to them.

**Default blocked sites:**
- youtube.com
- reddit.com
- twitter.com / x.com
- instagram.com
- facebook.com
- tiktok.com
- twitch.tv
- netflix.com
- bilibili.com
- pornhub.com

## Tech Stack

- React + TypeScript
- Vite + Turborepo
- Tailwind CSS
- Chrome Extension Manifest V3

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Lint
pnpm lint
```

## License

MIT
