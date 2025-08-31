/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// Background service worker for EyeCare Focus extension

interface StorageData {
  settings: {
    reminderInterval: number;
    trackingEnabled: boolean;
    focusModeEnabled: boolean;
    focusDuration: number;
    blocklist: string[];
    allowlist: string[];
    useAllowlistMode: boolean;
    soundEnabled: boolean;
  };
  stats: {
    [date: string]: {
      totalFocusTime: number;
      breaksTaken: number;
      domains: { [domain: string]: number };
      focusSessions: number;
    };
  };
  focusMode: {
    isActive: boolean;
    endTime: number;
    queuedSites: string[];
  };
}

interface Settings {
  reminderInterval: number;
  trackingEnabled: boolean;
  focusModeEnabled: boolean;
  focusDuration: number;
  blocklist: string[];
  allowlist: string[];
  useAllowlistMode: boolean;
  soundEnabled: boolean;
  notes?: Record<string, string>;
}

type IdleState = 'active' | 'idle' | 'locked';

let trackingInterval: NodeJS.Timeout | null = null;
let currentDomain: string | null = null;
let sessionStartTime: number = Date.now();
let isUserActive = true;

// Default settings
const DEFAULT_SETTINGS = {
  reminderInterval: 20, // minutes
  trackingEnabled: true,
  focusModeEnabled: false,
  focusDuration: 25, // minutes
  blocklist: ['instagram.com', 'youtube.com', 'twitter.com', 'x.com', 'linkedin.com', 'facebook.com', 'tiktok.com'],
  allowlist: ['github.com', 'stackoverflow.com', 'docs.google.com'],
  useAllowlistMode: false,
  soundEnabled: true
};

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  setupReminders();
  setupTracking();
});

// Setup 20-20-20 reminders
async function setupReminders() {
  const { settings } = await chrome.storage.local.get('settings');
  const interval = settings?.reminderInterval || DEFAULT_SETTINGS.reminderInterval;
  chrome.alarms.clear('eyeCareReminder');
  chrome.alarms.create('eyeCareReminder', {
    delayInMinutes: interval,
    periodInMinutes: interval
  });
}

// Handle alarm triggers
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'eyeCareReminder') {
    const { settings } = await chrome.storage.local.get('settings');
    if (settings?.trackingEnabled) {
      await showEyeCareNotification();
    }
  } else if (alarm.name === 'focusModeEnd') {
    await endFocusMode();
  }
});

// Show eye care notification
async function showEyeCareNotification() {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon.jpeg',
    title: 'EyeCare Focus Reminder',
    message: 'Look 20 feet away for 20 seconds to rest your eyes.'
  });

  const today = new Date().toDateString();
  const { stats = {} } = await chrome.storage.local.get('stats');
  if (!stats[today]) {
    stats[today] = { totalFocusTime: 0, breaksTaken: 0, domains: {}, focusSessions: 0 };
  }
  stats[today].breaksTaken++;
  await chrome.storage.local.set({ stats });
}

// Setup focus time tracking
function setupTracking() {
  chrome.tabs.onActivated.addListener(handleTabChange);
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
      handleTabChange({ tabId });
    }
  });
  chrome.windows.onFocusChanged.addListener(handleWindowFocus);
  chrome.idle.onStateChanged.addListener(handleIdleStateChange);
  startTrackingInterval();
}

async function handleTabChange(activeInfo: { tabId: number }) {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      const domain = extractDomain(tab.url);
      await updateCurrentDomain(domain);
    }
  } catch (err) {
    // Ignore errors
  }
}

function handleWindowFocus(windowId: number) {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    updateCurrentDomain(null);
  } else {
    chrome.tabs.query({ active: true, windowId }, (tabs) => {
      if (tabs[0]?.url) {
        const domain = extractDomain(tabs[0].url);
        updateCurrentDomain(domain);
      }
    });
  }
}

function handleIdleStateChange(state: IdleState) {
  isUserActive = state === 'active';
  if (!isUserActive) {
    updateCurrentDomain(null);
  }
}

function extractDomain(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

async function updateCurrentDomain(domain: string | null) {
  if (currentDomain && currentDomain !== domain) {
    await saveTimeForDomain(currentDomain, Date.now() - sessionStartTime);
  }
  currentDomain = domain;
  sessionStartTime = Date.now();
}

async function saveTimeForDomain(domain: string, timeSpent: number) {
  if (!domain || timeSpent < 1000) return;
  const { settings, stats = {} } = await chrome.storage.local.get(['settings', 'stats']);
  if (!settings?.trackingEnabled) return;
  const today = new Date().toDateString();
  if (!stats[today]) {
    stats[today] = { totalFocusTime: 0, breaksTaken: 0, domains: {}, focusSessions: 0 };
  }
  const timeInSeconds = Math.round(timeSpent / 1000);
  stats[today].totalFocusTime += timeInSeconds;
  stats[today].domains[domain] = (stats[today].domains[domain] || 0) + timeInSeconds;
  await chrome.storage.local.set({ stats });
}

function startTrackingInterval() {
  if (trackingInterval) clearInterval(trackingInterval);
  trackingInterval = setInterval(async () => {
    if (currentDomain && isUserActive) {
      await saveTimeForDomain(currentDomain, Date.now() - sessionStartTime);
      sessionStartTime = Date.now();
    }
  }, 30000);
}

// Focus Mode functionality
async function startFocusMode(duration: number) {
  const { settings } = await chrome.storage.local.get('settings');
  const endTime = Date.now() + (duration * 60 * 1000);
  await chrome.storage.local.set({
    focusMode: {
      isActive: true,
      endTime,
      queuedSites: []
    }
  });
  chrome.alarms.create('focusModeEnd', {
    when: endTime
  });
  await applyBlockingRules(settings);
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon.jpeg',
    title: 'Focus Mode Started',
    message: `Focus mode active for ${duration} minutes. Stay focused!`
  });
}

async function endFocusMode() {
  await chrome.storage.local.set({ focusMode: { isActive: false, endTime: 0, queuedSites: [] } });

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const toRemove = existing
    .filter(r => r.id >= RULE_ID_BASE && r.id < RULE_ID_BASE + 5000)
    .map(r => r.id);
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: toRemove });
  const today = new Date().toDateString();
  const { stats = {} } = await chrome.storage.local.get('stats');
  if (!stats[today]) {
    stats[today] = { totalFocusTime: 0, breaksTaken: 0, domains: {}, focusSessions: 0 };
  }
  stats[today].focusSessions++;
  await chrome.storage.local.set({ stats });
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon.jpeg',
    title: 'Focus Mode Complete',
    message: 'Great job! Focus session completed.'
  });
}

const RULE_ID_BASE = 10000; // reserve a high range for focus rules

async function applyBlockingRules(settings: any) {
  const domains = settings.useAllowlistMode
    ? getAllDomainsExcept(settings.allowlist)
    : settings.blocklist;

  // Build DNR rules that hit apex + subdomains
  const rules: chrome.declarativeNetRequest.Rule[] = domains.map((raw: string, i: number) => {
    const domain = raw.replace(/^www\./, '');
    return {
      id: RULE_ID_BASE + i,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          // use an extension page; no query string with extensionPath
          extensionPath: '/focus-mode.html'
        }
      },
      condition: {
        requestDomains: [domain],
        resourceTypes: ['main_frame']
      }
    };
  });

  // Remove any existing focus rules in our range, then add current
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const toRemove = existing
    .filter(r => r.id >= RULE_ID_BASE && r.id < RULE_ID_BASE + 5000)
    .map(r => r.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: toRemove,
    addRules: rules
  });
}

async function hydrateFocusRules() {
  const { focusMode, settings } = await chrome.storage.local.get(['focusMode', 'settings']);
  if (focusMode?.isActive) {
    await applyBlockingRules(settings);
  } else {
    // clean any leftover rules from our range
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const toRemove = existing
      .filter(r => r.id >= RULE_ID_BASE && r.id < RULE_ID_BASE + 5000)
      .map(r => r.id);
    if (toRemove.length) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: toRemove });
    }
  }
}

chrome.runtime.onInstalled.addListener(hydrateFocusRules);
chrome.runtime.onStartup.addListener(hydrateFocusRules);


function getAllDomainsExcept(allowlist: string[]): string[] {
  const commonDomains = [
    'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'youtube.com',
    'tiktok.com', 'linkedin.com', 'reddit.com', 'netflix.com', 'twitch.tv'
  ];
  return commonDomains.filter(domain => !allowlist.includes(domain));
}

// Message handling from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_FOCUS_MODE':
      startFocusMode(message.duration);
      sendResponse({ success: true });
      break;
    case 'END_FOCUS_MODE':
      endFocusMode();
      sendResponse({ success: true });
      break;
    case 'UPDATE_SETTINGS':
      (async () => {
        await setupReminders();
        const { settings, focusMode } = await chrome.storage.local.get(['settings', 'focusMode']);
        if (focusMode?.isActive) {
          await applyBlockingRules(settings);
        }
        sendResponse({ success: true });
      })();
      return true;
    case 'QUEUE_SITE':
      queueSiteForLater(message.url);
      sendResponse({ success: true });
      break;
    default:
      sendResponse({ success: false });
      break;
  }
});

async function queueSiteForLater(url: string) {
  const { focusMode } = await chrome.storage.local.get('focusMode');
  if (focusMode?.isActive) {
    focusMode.queuedSites.push(url);
    await chrome.storage.local.set({ focusMode });
  }
}

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  setupReminders();
  setupTracking();
});