import 'webextension-polyfill';
import { dillyStorage } from '@extension/storage';

const ALARM_NAME = 'dilly-check-work-tab';
const CHECK_INTERVAL_MINUTES = 10;

// Focus timer constants
const FOCUS_CHECK_ALARM = 'dilly-focus-check';
const AWAY_THRESHOLD_MS = 1 * 60 * 1000; // 1 minute

// Track previous state to avoid redundant operations
let previousSnoozed = false;
let previousNaggerActive = false;

// Helper to get root domain
const getRootDomain = (hostname: string): string => {
  const parts = hostname.replace(/^www\./, '').split('.');
  if (parts.length <= 2) return hostname.replace(/^www\./, '');
  return parts.slice(-2).join('.');
};

// Check if any tab has the target domain
const checkForWorkTab = async (): Promise<boolean> => {
  const state = await dillyStorage.get();

  if (!state.targetUrl) return true; // No target set

  try {
    const targetHostname = new URL(state.targetUrl).hostname;
    const targetDomain = getRootDomain(targetHostname);

    const tabs = await chrome.tabs.query({});

    return tabs.some(tab => {
      if (!tab.url) return false;
      try {
        const tabHostname = new URL(tab.url).hostname;
        return getRootDomain(tabHostname) === targetDomain;
      } catch {
        return false;
      }
    });
  } catch {
    return true; // Invalid URL, don't open tab
  }
};

// Open the target URL in a new tab
const openWorkTab = async (): Promise<void> => {
  const state = await dillyStorage.get();

  if (!state.targetUrl) return;

  // Check if snoozed
  if (state.isSnoozed && state.snoozeUntil && Date.now() < state.snoozeUntil) {
    console.log('[Dilly] Snoozed, not opening work tab');
    return;
  }

  // Clear expired snooze
  await dillyStorage.checkSnoozeExpired();

  await chrome.tabs.create({ url: state.targetUrl });
  console.log('[Dilly] Opened work tab:', state.targetUrl);
};

// Check if URL is a work URL
const isWorkUrl = (url: string, targetUrl: string): boolean => {
  try {
    const urlHostname = new URL(url).hostname;
    const targetHostname = new URL(targetUrl).hostname;
    return getRootDomain(urlHostname) === getRootDomain(targetHostname);
  } catch {
    return false;
  }
};

// Find existing work tab and focus it, or create new one
const focusOrCreateWorkTab = async (targetUrl: string): Promise<void> => {
  const tabs = await chrome.tabs.query({});
  const workTab = tabs.find(tab => tab.url && isWorkUrl(tab.url, targetUrl));

  if (workTab && workTab.id) {
    // Focus existing work tab
    await chrome.tabs.update(workTab.id, { active: true });
    if (workTab.windowId) {
      await chrome.windows.update(workTab.windowId, { focused: true });
    }
    console.log('[Dilly] Focused existing work tab');
  } else {
    // Create new work tab
    await chrome.tabs.create({ url: targetUrl, active: true });
    console.log('[Dilly] Created new work tab');
  }
};

// Handle tab focus change
const handleTabFocusChange = async (url: string | undefined): Promise<void> => {
  const state = await dillyStorage.get();

  if (!state.isNaggerActive || !state.targetUrl) {
    await dillyStorage.resetAwayTimer();
    await chrome.alarms.clear(FOCUS_CHECK_ALARM);
    return;
  }

  // Check if snoozed - pause timer
  if (state.isSnoozed && state.snoozeUntil && Date.now() < state.snoozeUntil) {
    await dillyStorage.pauseAwayTimer();
    await chrome.alarms.clear(FOCUS_CHECK_ALARM);
    return;
  }

  const isOnWork = url ? isWorkUrl(url, state.targetUrl) : false;

  if (isOnWork) {
    // User returned to work - reset timer
    await dillyStorage.resetAwayTimer();
    await chrome.alarms.clear(FOCUS_CHECK_ALARM);
    console.log('[Dilly] On work site, timer reset');
  } else {
    // User is on non-work tab - start/continue timer
    const currentState = await dillyStorage.get();
    if (!currentState.lastNonWorkFocusStart) {
      // Check if we have accumulated time (was paused) or starting fresh
      if (currentState.awayFromWorkDuration > 0) {
        await dillyStorage.resumeAwayTimer();
        console.log('[Dilly] Resumed away timer with accumulated:', currentState.awayFromWorkDuration, 'ms');
      } else {
        await dillyStorage.startAwayTimer();
        console.log('[Dilly] Started away timer');
      }
    }

    // Always ensure alarm exists when on non-work tab
    const existingAlarm = await chrome.alarms.get(FOCUS_CHECK_ALARM);
    if (!existingAlarm) {
      chrome.alarms.create(FOCUS_CHECK_ALARM, {
        delayInMinutes: 1,
        periodInMinutes: 1,
      });
      console.log('[Dilly] Created focus check alarm');
    }
  }
};

// Check away duration and trigger notification if threshold reached
const checkAwayDuration = async (): Promise<void> => {
  const state = await dillyStorage.get();

  if (!state.isNaggerActive || !state.targetUrl) return;

  // Check snooze
  if (state.isSnoozed && state.snoozeUntil && Date.now() < state.snoozeUntil) {
    return;
  }

  const awayDuration = await dillyStorage.getAwayDuration();
  const awayMinutes = Math.floor(awayDuration / 60000);
  const awaySeconds = Math.floor((awayDuration % 60000) / 1000);
  console.log(`[Dilly] Away duration: ${awayMinutes}m ${awaySeconds}s`);

  if (awayDuration >= AWAY_THRESHOLD_MS) {
    console.log('[Dilly] Away for 1 minute, showing reminder');
    await showWorkReminder();
    // Timer reset is now handled in OPEN_WORK_TAB message handler
    // after the countdown completes
  }
};

// Show countdown overlay and then redirect to work
const showWorkReminder = async (): Promise<void> => {
  const state = await dillyStorage.get();
  const targetUrl = state.targetUrl;

  // Get current active tab
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!activeTab?.id) {
    // Fallback: focus existing or create new work tab
    await focusOrCreateWorkTab(targetUrl);
    await dillyStorage.resetAwayTimer();
    await chrome.alarms.clear(FOCUS_CHECK_ALARM);
    return;
  }

  // Skip injection for chrome:// URLs (can't inject there)
  if (activeTab.url?.startsWith('chrome://') || activeTab.url?.startsWith('chrome-extension://')) {
    // Focus existing or create new work tab
    await focusOrCreateWorkTab(targetUrl);
    await dillyStorage.resetAwayTimer();
    await chrome.alarms.clear(FOCUS_CHECK_ALARM);
    return;
  }

  // Inject countdown overlay
  try {
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => {
        // Remove any existing overlay first
        const existingOverlay = document.getElementById('dilly-countdown-overlay');
        if (existingOverlay) {
          existingOverlay.remove();
        }

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'dilly-countdown-overlay';
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(220, 38, 38, 0.85);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 2147483647;
          font-family: system-ui, -apple-system, sans-serif;
          backdrop-filter: blur(4px);
        `;

        overlay.innerHTML = `
          <div style="text-align: center; color: white;">
            <div style="font-size: 80px; margin-bottom: 16px;">
              😠
            </div>
            <div style="font-size: 48px; font-weight: bold; margin-bottom: 24px;">
              Bringing you back to work...
            </div>
            <div style="font-size: 64px; font-weight: bold; margin-bottom: 24px;" id="dilly-countdown">
              3
            </div>
          </div>
        `;

        document.body.appendChild(overlay);

        // Countdown
        let count = 3;
        const countdownEl = document.getElementById('dilly-countdown');

        const interval = setInterval(() => {
          count--;
          if (countdownEl) {
            countdownEl.textContent = count.toString();
          }

          if (count <= 0) {
            clearInterval(interval);
            // Send message to background to create new tab
            chrome.runtime.sendMessage({ type: 'OPEN_WORK_TAB' });
            // Remove overlay
            overlay.remove();
          }
        }, 1000);
      },
      args: [],
    });

    console.log('[Dilly] Injected countdown overlay');
  } catch (error) {
    console.error('[Dilly] Failed to inject overlay:', error);
    // Fallback: focus existing or create new work tab
    await focusOrCreateWorkTab(targetUrl);
    await dillyStorage.resetAwayTimer();
    await chrome.alarms.clear(FOCUS_CHECK_ALARM);
    console.log('[Dilly] Timer reset after fallback');
  }
};

// Handle alarm
chrome.alarms.onAlarm.addListener(async alarm => {
  // Handle focus check alarm
  if (alarm.name === FOCUS_CHECK_ALARM) {
    await checkAwayDuration();
    return;
  }

  if (alarm.name !== ALARM_NAME) return;

  console.log('[Dilly] Alarm triggered, checking for work tab');

  const state = await dillyStorage.get();

  // Don't check if nagger is not active
  if (!state.isNaggerActive) {
    console.log('[Dilly] Nagger not active, skipping check');
    return;
  }

  // Check if snoozed
  if (state.isSnoozed && state.snoozeUntil && Date.now() < state.snoozeUntil) {
    console.log('[Dilly] Snoozed, skipping check');
    return;
  }

  // Clear expired snooze
  await dillyStorage.checkSnoozeExpired();

  const hasWorkTab = await checkForWorkTab();

  if (!hasWorkTab) {
    console.log('[Dilly] No work tab found, opening one');
    await openWorkTab();
  } else {
    console.log('[Dilly] Work tab exists, no action needed');
  }
});

// Start or stop alarm based on nagger state
const updateAlarm = async (): Promise<void> => {
  const state = await dillyStorage.get();

  if (state.isNaggerActive && state.targetUrl) {
    // Create alarm if it doesn't exist
    const existingAlarm = await chrome.alarms.get(ALARM_NAME);
    if (!existingAlarm) {
      chrome.alarms.create(ALARM_NAME, {
        periodInMinutes: CHECK_INTERVAL_MINUTES,
      });
      console.log('[Dilly] Alarm created, will check every', CHECK_INTERVAL_MINUTES, 'minutes');
    }
  } else {
    // Clear alarm
    await chrome.alarms.clear(ALARM_NAME);
    console.log('[Dilly] Alarm cleared');
  }
};

// Listen for storage changes
dillyStorage.subscribe(async () => {
  const state = await dillyStorage.get();

  // Only update alarm if nagger state changed
  if (state.isNaggerActive !== previousNaggerActive) {
    previousNaggerActive = state.isNaggerActive;
    await updateAlarm();

    // When nagger is activated, check current tab state and start timer if needed
    if (state.isNaggerActive) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        await handleTabFocusChange(tab.url);
      }
    } else {
      // When nagger is deactivated, reset the away timer
      await dillyStorage.resetAwayTimer();
      await chrome.alarms.clear(FOCUS_CHECK_ALARM);
    }
  }

  // Handle snooze state changes for focus timer
  const currentSnoozed = !!(state.isSnoozed && state.snoozeUntil && Date.now() < state.snoozeUntil);

  if (currentSnoozed !== previousSnoozed) {
    previousSnoozed = currentSnoozed;

    if (currentSnoozed) {
      await dillyStorage.pauseAwayTimer();
      await chrome.alarms.clear(FOCUS_CHECK_ALARM);
      console.log('[Dilly] Snoozed, pausing focus timer');
    } else {
      // Snooze ended - check current focus state
      console.log('[Dilly] Snooze ended, resuming focus timer');
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        await handleTabFocusChange(tab.url);
      }
    }
  }
});

// Track tab focus changes
chrome.tabs.onActivated.addListener(async activeInfo => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    await handleTabFocusChange(tab.url);
  } catch {
    // Tab might have been closed
  }
});

// Track window focus changes
chrome.windows.onFocusChanged.addListener(async windowId => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // All windows lost focus (user switched to another app) - pause timer
    await dillyStorage.pauseAwayTimer();
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab?.url) {
      await handleTabFocusChange(tab.url);
    }
  } catch {
    // Window might have been closed
  }
});

// Track URL changes in existing tabs
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (!changeInfo.url) return;

  // Check if this tab is the active tab
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.active) {
      console.log('[Dilly] URL changed to:', changeInfo.url);
      await handleTabFocusChange(tab.url);
    }
  } catch {
    // Tab might have been closed
  }
});

// Initialize on load
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Dilly] Extension installed');
  updateAlarm();

  // Set side panel to open on action click
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(error => {
    console.error('[Dilly] Side panel setup error:', error);
  });
});

// Also initialize on startup (for when browser restarts)
chrome.runtime.onStartup.addListener(() => {
  console.log('[Dilly] Browser started');
  updateAlarm();
});

// OAuth and authentication URLs to skip
const OAUTH_DOMAINS = [
  'accounts.google.com',
  'login.microsoftonline.com',
  'github.com/login',
  'auth0.com',
  'appleid.apple.com',
  'facebook.com/login',
  'twitter.com/oauth',
  'api.twitter.com',
];

// Check if URL is an entertainment site
const isEntertainmentUrl = (url: string, entertainmentSites: string[]): boolean => {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const isBlocked = entertainmentSites.some(site => {
      const normalizedSite = site.toLowerCase().replace(/^www\./, '');
      return hostname === normalizedSite || hostname.endsWith('.' + normalizedSite);
    });
    if (isBlocked) {
      console.log('[Dilly] Blocked site detected:', hostname);
    }
    return isBlocked;
  } catch {
    return false;
  }
};

// Handle tab URL changes - redirect new tabs and block entertainment sites
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Check on URL change OR when page finishes loading (for refreshes)
  const url = changeInfo.url || (changeInfo.status === 'complete' ? tab.url : null);
  if (!url) return;

  console.log('[Dilly] Tab URL updated:', url, changeInfo.status ? `(${changeInfo.status})` : '');

  // Skip OAuth/authentication URLs
  const isOAuthUrl = OAUTH_DOMAINS.some(domain => url.includes(domain));
  if (isOAuthUrl) {
    console.log('[Dilly] Skipping OAuth URL');
    return;
  }

  const state = await dillyStorage.get();

  // Only act if nagger is active and we have a target URL
  if (!state.isNaggerActive || !state.targetUrl) {
    console.log('[Dilly] Nagger not active or no target URL');
    return;
  }

  // Check if snoozed
  if (state.isSnoozed && state.snoozeUntil && Date.now() < state.snoozeUntil) {
    console.log('[Dilly] Snoozed, skipping block check');
    return;
  }

  // Redirect new tab pages to work
  if (url === 'chrome://newtab/' || url === 'about:newtab') {
    await chrome.tabs.update(tabId, { url: state.targetUrl });
    return;
  }

  // Block entertainment sites - inject overlay
  if (isEntertainmentUrl(url, state.entertainmentSites)) {
    // Wait a bit for the page to load
    setTimeout(async () => {
      try {
        const hostname = new URL(url).hostname;
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (blockedSite: string, workUrl: string) => {
            // Remove existing overlay if any
            const existing = document.getElementById('dilly-blocked-overlay');
            if (existing) existing.remove();

            // Create overlay
            const overlay = document.createElement('div');
            overlay.id = 'dilly-blocked-overlay';
            overlay.style.cssText = `
              position: fixed;
              top: 0;
              left: 0;
              width: 100vw;
              height: 100vh;
              background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              z-index: 2147483647;
              font-family: system-ui, -apple-system, sans-serif;
            `;

            overlay.innerHTML = `
              <div style="text-align: center; color: white; max-width: 400px; padding: 20px;">
                <div style="font-size: 80px; margin-bottom: 16px;">
                  😠
                </div>
                <div style="font-size: 48px; font-weight: bold; margin-bottom: 16px;">
                  GO BACK TO WORK!!!
                </div>
                <div style="font-size: 16px; opacity: 0.8; margin-bottom: 8px;">
                  <span style="font-weight: 500;">${blockedSite}</span> is blocked
                </div>
                <div style="font-size: 14px; opacity: 0.7; margin-bottom: 32px;">
                  You should be working right now
                </div>
                <button id="dilly-go-to-work" style="
                  background: white;
                  color: #dc2626;
                  border: none;
                  padding: 16px 32px;
                  border-radius: 12px;
                  font-size: 18px;
                  font-weight: 600;
                  cursor: pointer;
                  margin-bottom: 24px;
                  transition: transform 0.2s;
                ">
                  Go back to work!
                </button>
                <div style="font-size: 12px; opacity: 0.6; margin-bottom: 12px;">
                  Need a break?
                </div>
                <div style="display: flex; gap: 8px; justify-content: center;">
                  <button class="dilly-snooze" data-mins="5" style="
                    background: rgba(255,255,255,0.1);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 14px;
                    cursor: pointer;
                  ">5m</button>
                  <button class="dilly-snooze" data-mins="10" style="
                    background: rgba(255,255,255,0.1);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 14px;
                    cursor: pointer;
                  ">10m</button>
                  <button class="dilly-snooze" data-mins="15" style="
                    background: rgba(255,255,255,0.1);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 14px;
                    cursor: pointer;
                  ">15m</button>
                </div>
              </div>
            `;

            document.body.appendChild(overlay);

            // Add event listeners
            document.getElementById('dilly-go-to-work')?.addEventListener('click', () => {
              window.location.href = workUrl;
            });

            document.querySelectorAll('.dilly-snooze').forEach(btn => {
              btn.addEventListener('click', e => {
                const mins = (e.target as HTMLElement).getAttribute('data-mins');
                // Send message to background to snooze
                chrome.runtime.sendMessage({ type: 'SNOOZE', minutes: parseInt(mins || '5') });
                overlay.remove();
              });
            });
          },
          args: [hostname, state.targetUrl],
        });
      } catch (error) {
        console.error('[Dilly] Failed to inject blocked overlay:', error);
      }
    }, 500);
  }
});

// Listen for messages from injected scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SNOOZE') {
    dillyStorage.snooze(message.minutes).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'OPEN_WORK_TAB') {
    dillyStorage.get().then(async state => {
      if (state.targetUrl) {
        await focusOrCreateWorkTab(state.targetUrl);
      }
      // Reset timer and alarm after focusing/creating work tab
      await dillyStorage.resetAwayTimer();
      await chrome.alarms.clear(FOCUS_CHECK_ALARM);
      console.log('[Dilly] Timer reset after opening work tab');
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'SHOW_CELEBRATION') {
    // Get the current active tab to show celebration on
    chrome.tabs.query({ active: true, currentWindow: true }).then(async ([activeTab]) => {
      if (
        !activeTab?.id ||
        activeTab.url?.startsWith('chrome://') ||
        activeTab.url?.startsWith('chrome-extension://')
      ) {
        sendResponse({ success: false });
        return;
      }

      try {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: (goalMinutes: number) => {
            // Remove existing overlay if any
            const existing = document.getElementById('dilly-celebration-overlay');
            if (existing) existing.remove();

            // Create celebration overlay
            const overlay = document.createElement('div');
            overlay.id = 'dilly-celebration-overlay';
            overlay.style.cssText = `
              position: fixed;
              top: 0;
              left: 0;
              width: 100vw;
              height: 100vh;
              background: linear-gradient(135deg, #f6d365 0%, #fda085 50%, #f093fb 100%);
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              z-index: 2147483647;
              font-family: system-ui, -apple-system, sans-serif;
              overflow: hidden;
            `;

            // Create confetti particles
            let confettiHTML = '';
            const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9', '#fd79a8', '#a29bfe'];
            for (let i = 0; i < 50; i++) {
              const color = colors[Math.floor(Math.random() * colors.length)];
              const size = 8 + Math.random() * 8;
              const left = Math.random() * 100;
              const delay = Math.random() * 3;
              const duration = 3 + Math.random() * 2;
              const rotation = Math.random() * 360;
              const isCircle = Math.random() > 0.5;

              confettiHTML += `
                <div style="
                  position: absolute;
                  left: ${left}%;
                  top: -10%;
                  width: ${size}px;
                  height: ${size}px;
                  background: ${color};
                  border-radius: ${isCircle ? '50%' : '0'};
                  transform: rotate(${rotation}deg);
                  animation: confetti-fall ${duration}s ${delay}s linear forwards;
                "></div>
              `;
            }

            overlay.innerHTML = `
              <style>
                @keyframes confetti-fall {
                  0% {
                    transform: translateY(0) rotate(0deg);
                    opacity: 1;
                  }
                  100% {
                    transform: translateY(100vh) rotate(720deg);
                    opacity: 0;
                  }
                }
              </style>
              <div style="pointer-events: none; position: absolute; inset: 0;">
                ${confettiHTML}
              </div>
              <div style="text-align: center; color: white; z-index: 1;">
                <div style="font-size: 80px; margin-bottom: 16px;">🎉</div>
                <div style="font-size: 48px; font-weight: bold; margin-bottom: 16px;">
                  Goal Reached!
                </div>
                <div style="font-size: 20px; opacity: 0.9; margin-bottom: 8px;">
                  You worked for ${Math.floor(goalMinutes / 60)}:${(goalMinutes % 60).toString().padStart(2, '0')}
                </div>
                <div style="font-size: 16px; opacity: 0.7;">
                  Great job staying focused!
                </div>
              </div>
              <button id="dilly-dismiss-celebration" style="
                margin-top: 32px;
                background: rgba(255,255,255,0.2);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 16px;
                cursor: pointer;
                z-index: 1;
              ">
                Dismiss
              </button>
            `;

            document.body.appendChild(overlay);

            // Add dismiss handler
            document.getElementById('dilly-dismiss-celebration')?.addEventListener('click', () => {
              overlay.remove();
            });

            // Auto-dismiss after 5 seconds
            setTimeout(() => {
              overlay.remove();
            }, 5000);
          },
          args: [message.goalMinutes || 60],
        });
        console.log('[Dilly] Celebration overlay injected');
        sendResponse({ success: true });
      } catch (error) {
        console.error('[Dilly] Failed to inject celebration overlay:', error);
        sendResponse({ success: false });
      }
    });
    return true;
  }

  return false;
});

// Initial setup
updateAlarm();
console.log('[Dilly] Background loaded');
