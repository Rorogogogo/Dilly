import 'webextension-polyfill';
import { dillyStorage } from '@extension/storage';

const ALARM_NAME = 'dilly-check-work-tab';
const CHECK_INTERVAL_MINUTES = 10;

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

// Handle alarm
chrome.alarms.onAlarm.addListener(async alarm => {
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
dillyStorage.subscribe(() => {
  updateAlarm();
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
