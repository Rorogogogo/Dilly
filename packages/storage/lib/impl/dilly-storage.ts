/* eslint-disable import-x/exports-last */
import { createStorage, StorageEnum } from '../base/index.js';

// Default entertainment sites
const DEFAULT_ENTERTAINMENT_SITES = [
  'youtube.com',
  'bilibili.com',
  'pornhub.com',
  'reddit.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'facebook.com',
  'tiktok.com',
  'twitch.tv',
  'netflix.com',
];

export type DillyStateType = {
  targetUrl: string;
  isNaggerActive: boolean;
  isSnoozed: boolean;
  snoozeUntil: number | null;
  entertainmentSites: string[];
  // Focus timer fields
  lastNonWorkFocusStart: number | null;
  awayFromWorkDuration: number;
  // Goal and accumulated focus
  goalTimeMinutes: number;
  accumulatedFocusTime: number;
  lastWorkFocusStart: number | null;
};

export type DillyStorageType = {
  get: () => Promise<DillyStateType>;
  set: (value: DillyStateType | ((prev: DillyStateType) => DillyStateType)) => Promise<void>;
  subscribe: (callback: () => void) => () => void;
  setTargetUrl: (url: string) => Promise<void>;
  toggleNagger: () => Promise<void>;
  startNagger: () => Promise<void>;
  stopNagger: () => Promise<void>;
  snooze: (minutes: number) => Promise<void>;
  clearSnooze: () => Promise<void>;
  addEntertainmentSite: (site: string) => Promise<void>;
  removeEntertainmentSite: (site: string) => Promise<void>;
  isOnTargetDomain: (hostname: string) => Promise<boolean>;
  isEntertainmentSite: (hostname: string) => Promise<boolean>;
  checkSnoozeExpired: () => Promise<boolean>;
  // Focus timer methods
  startAwayTimer: () => Promise<void>;
  resumeAwayTimer: () => Promise<void>;
  pauseAwayTimer: () => Promise<void>;
  resetAwayTimer: () => Promise<void>;
  getAwayDuration: () => Promise<number>;
  // Goal and work focus methods
  setGoalTime: (minutes: number) => Promise<void>;
  startWorkFocusTimer: () => Promise<void>;
  pauseWorkFocusTimer: () => Promise<void>;
  resetWorkFocusTime: () => Promise<void>;
  getWorkFocusDuration: () => Promise<number>;
};

const storage = createStorage<DillyStateType>(
  'dilly-state',
  {
    targetUrl: '',
    isNaggerActive: false,
    isSnoozed: false,
    snoozeUntil: null,
    entertainmentSites: DEFAULT_ENTERTAINMENT_SITES,
    lastNonWorkFocusStart: null,
    awayFromWorkDuration: 0,
    goalTimeMinutes: 60,
    accumulatedFocusTime: 0,
    lastWorkFocusStart: null,
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

// Helper to extract root domain
const getRootDomain = (hostname: string): string => {
  const parts = hostname.replace(/^www\./, '').split('.');
  if (parts.length <= 2) return hostname.replace(/^www\./, '');
  return parts.slice(-2).join('.');
};

export const dillyStorage: DillyStorageType = {
  ...storage,

  setTargetUrl: async (url: string) => {
    await storage.set(prev => ({ ...prev, targetUrl: url }));
  },

  toggleNagger: async () => {
    await storage.set(prev => ({ ...prev, isNaggerActive: !prev.isNaggerActive }));
  },

  startNagger: async () => {
    await storage.set(prev => ({ ...prev, isNaggerActive: true }));
  },

  stopNagger: async () => {
    await storage.set(prev => ({ ...prev, isNaggerActive: false }));
  },

  snooze: async (minutes: number) => {
    const snoozeUntil = Date.now() + minutes * 60 * 1000;
    await storage.set(prev => ({ ...prev, isSnoozed: true, snoozeUntil }));
  },

  clearSnooze: async () => {
    await storage.set(prev => ({ ...prev, isSnoozed: false, snoozeUntil: null }));
  },

  addEntertainmentSite: async (site: string) => {
    const normalizedSite = site
      .toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .replace(/\/$/, '');
    await storage.set(prev => {
      if (prev.entertainmentSites.includes(normalizedSite)) {
        return prev;
      }
      return {
        ...prev,
        entertainmentSites: [...prev.entertainmentSites, normalizedSite],
      };
    });
  },

  removeEntertainmentSite: async (site: string) => {
    await storage.set(prev => ({
      ...prev,
      entertainmentSites: prev.entertainmentSites.filter(s => s !== site),
    }));
  },

  isOnTargetDomain: async (hostname: string) => {
    const state = await storage.get();
    if (!state.targetUrl) return false;

    try {
      const targetHostname = new URL(state.targetUrl).hostname;
      return getRootDomain(hostname) === getRootDomain(targetHostname);
    } catch {
      return false;
    }
  },

  isEntertainmentSite: async (hostname: string) => {
    const state = await storage.get();
    const normalizedHostname = hostname.toLowerCase().replace(/^www\./, '');

    return state.entertainmentSites.some(
      site => normalizedHostname === site || normalizedHostname.endsWith('.' + site),
    );
  },

  checkSnoozeExpired: async () => {
    const state = await storage.get();
    if (!state.isSnoozed || !state.snoozeUntil) return false;

    if (Date.now() >= state.snoozeUntil) {
      await storage.set(prev => ({ ...prev, isSnoozed: false, snoozeUntil: null }));
      return true;
    }
    return false;
  },

  // Start tracking away time (resets accumulated time)
  startAwayTimer: async () => {
    await storage.set(prev => ({
      ...prev,
      lastNonWorkFocusStart: Date.now(),
      awayFromWorkDuration: 0,
    }));
  },

  // Resume tracking away time (keeps accumulated time)
  resumeAwayTimer: async () => {
    await storage.set(prev => ({
      ...prev,
      lastNonWorkFocusStart: Date.now(),
    }));
  },

  // Pause timer (for snooze or when browser loses focus)
  pauseAwayTimer: async () => {
    const state = await storage.get();
    if (state.lastNonWorkFocusStart) {
      const elapsed = Date.now() - state.lastNonWorkFocusStart;
      await storage.set(prev => ({
        ...prev,
        awayFromWorkDuration: prev.awayFromWorkDuration + elapsed,
        lastNonWorkFocusStart: null,
      }));
    }
  },

  // Reset timer (when returning to work)
  resetAwayTimer: async () => {
    await storage.set(prev => ({
      ...prev,
      lastNonWorkFocusStart: null,
      awayFromWorkDuration: 0,
    }));
  },

  // Get current away duration in milliseconds
  getAwayDuration: async () => {
    const state = await storage.get();
    if (!state.lastNonWorkFocusStart) {
      return state.awayFromWorkDuration;
    }
    return state.awayFromWorkDuration + (Date.now() - state.lastNonWorkFocusStart);
  },

  // Set goal time in minutes
  setGoalTime: async (minutes: number) => {
    await storage.set(prev => ({
      ...prev,
      goalTimeMinutes: minutes,
    }));
  },

  // Start work focus timer
  startWorkFocusTimer: async () => {
    await storage.set(prev => ({
      ...prev,
      lastWorkFocusStart: Date.now(),
    }));
  },

  // Pause work focus timer (save accumulated time)
  pauseWorkFocusTimer: async () => {
    const state = await storage.get();
    if (state.lastWorkFocusStart) {
      const elapsed = Date.now() - state.lastWorkFocusStart;
      await storage.set(prev => ({
        ...prev,
        accumulatedFocusTime: prev.accumulatedFocusTime + elapsed,
        lastWorkFocusStart: null,
      }));
    }
  },

  // Reset work focus time
  resetWorkFocusTime: async () => {
    await storage.set(prev => ({
      ...prev,
      accumulatedFocusTime: 0,
      lastWorkFocusStart: null,
    }));
  },

  // Get current work focus duration in milliseconds
  getWorkFocusDuration: async () => {
    const state = await storage.get();
    if (!state.lastWorkFocusStart) {
      return state.accumulatedFocusTime;
    }
    return state.accumulatedFocusTime + (Date.now() - state.lastWorkFocusStart);
  },
};
