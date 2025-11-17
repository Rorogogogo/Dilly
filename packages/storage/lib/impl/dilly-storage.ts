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
};

const storage = createStorage<DillyStateType>(
  'dilly-state',
  {
    targetUrl: '',
    isNaggerActive: false,
    isSnoozed: false,
    snoozeUntil: null,
    entertainmentSites: DEFAULT_ENTERTAINMENT_SITES,
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
};
