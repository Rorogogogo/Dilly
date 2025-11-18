import 'webextension-polyfill';
import { dillyStorage } from '@extension/storage';

const ALARM_NAME = 'dilly-check-work-tab';
const CHECK_INTERVAL_MINUTES = 10;

// Focus timer constants
const FOCUS_CHECK_ALARM = 'dilly-focus-check';
const AWAY_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

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
    console.log('[Dilly] Snoozed, pausing focus timer');
    return;
  }

  const isOnWork = url ? isWorkUrl(url, state.targetUrl) : false;

  if (isOnWork) {
    // User returned to work - reset timer
    await dillyStorage.resetAwayTimer();
    await chrome.alarms.clear(FOCUS_CHECK_ALARM);
    console.log('[Dilly] On work tab, timer reset');
  } else {
    // User is on non-work tab - start/continue timer
    const currentState = await dillyStorage.get();
    if (!currentState.lastNonWorkFocusStart) {
      await dillyStorage.startAwayTimer();
      console.log('[Dilly] Started away timer');
    }

    // Create alarm to check progress every minute
    const existingAlarm = await chrome.alarms.get(FOCUS_CHECK_ALARM);
    if (!existingAlarm) {
      chrome.alarms.create(FOCUS_CHECK_ALARM, {
        delayInMinutes: 1,
        periodInMinutes: 1,
      });
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

  if (awayDuration >= AWAY_THRESHOLD_MS) {
    console.log('[Dilly] Away for 5 minutes, showing reminder');
    await showWorkReminder();
    await dillyStorage.resetAwayTimer();
    await chrome.alarms.clear(FOCUS_CHECK_ALARM);
  }
};

// Show notification and open/focus work tab
const showWorkReminder = async (): Promise<void> => {
  const state = await dillyStorage.get();

  // Show notification
  try {
    const targetHostname = new URL(state.targetUrl).hostname;
    chrome.notifications.create('dilly-work-reminder', {
      type: 'basic',
      iconUrl: 'icon-128.png',
      title: 'Time to Work!',
      message: `You've been away from ${targetHostname} for 5 minutes`,
      priority: 2,
    });
  } catch {
    chrome.notifications.create('dilly-work-reminder', {
      type: 'basic',
      iconUrl: 'icon-128.png',
      title: 'Time to Work!',
      message: "You've been away from work for 5 minutes",
      priority: 2,
    });
  }

  // Find and focus existing work tab, or create new one
  const tabs = await chrome.tabs.query({});
  const workTab = tabs.find(tab => tab.url && isWorkUrl(tab.url, state.targetUrl));

  if (workTab && workTab.id) {
    // Focus existing work tab
    await chrome.tabs.update(workTab.id, { active: true });
    if (workTab.windowId) {
      await chrome.windows.update(workTab.windowId, { focused: true });
    }
    console.log('[Dilly] Focused existing work tab');
  } else {
    // Create new work tab
    await chrome.tabs.create({ url: state.targetUrl });
    console.log('[Dilly] Created new work tab');
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
  updateAlarm();

  // Handle snooze state changes for focus timer
  const state = await dillyStorage.get();
  if (state.isSnoozed) {
    await dillyStorage.pauseAwayTimer();
    await chrome.alarms.clear(FOCUS_CHECK_ALARM);
  } else {
    // Snooze ended - check current focus state
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      await handleTabFocusChange(tab.url);
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
    console.log('[Dilly] Browser lost focus, pausing timer');
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

// Handle tab URL changes - redirect new tabs to work URL if nagger is active
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  // Only check when URL changes
  if (!changeInfo.url) return;

  const url = changeInfo.url;

  // Skip OAuth/authentication URLs
  const isOAuthUrl = OAUTH_DOMAINS.some(domain => url.includes(domain));
  if (isOAuthUrl) {
    console.log('[Dilly] OAuth URL detected, skipping:', url);
    return;
  }

  // Only redirect new tab pages
  if (url !== 'chrome://newtab/' && url !== 'about:newtab') {
    return;
  }

  const state = await dillyStorage.get();

  // Only redirect if nagger is active and we have a target URL
  if (!state.isNaggerActive || !state.targetUrl) {
    return;
  }

  // Check if snoozed
  if (state.isSnoozed && state.snoozeUntil && Date.now() < state.snoozeUntil) {
    return;
  }

  console.log('[Dilly] New tab detected, redirecting to work');
  await chrome.tabs.update(tabId, { url: state.targetUrl });
});

// Initial setup
updateAlarm();
console.log('[Dilly] Background loaded');
