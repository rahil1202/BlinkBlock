/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { Eye, Target, Play, Square, Settings, BarChart3, Sun, Moon, Monitor } from 'lucide-react';
import Dashboard from './components/Dashboard';
import FocusMode from './components/FocusMode';
  
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
  theme?: 'light' | 'dark' | 'system';
}

interface DayStats {
  totalFocusTime: number;
  breaksTaken: number;
  domains: { [domain: string]: number };
  focusSessions: number;
}

interface FocusModeState {
  isActive: boolean;
  endTime: number;
  queuedSites: string[];
}

const defaultSettings: Settings = {
  reminderInterval: 20,
  trackingEnabled: true,
  focusModeEnabled: false,
  focusDuration: 25,
  blocklist: [],
  allowlist: [],
  useAllowlistMode: false,
  soundEnabled: true,
  notes: {},
  theme: 'system',
};

const defaultStats: DayStats = {
  totalFocusTime: 0,
  breaksTaken: 0,
  domains: {},
  focusSessions: 0,
};

const defaultFocusMode: FocusModeState = {
  isActive: false,
  endTime: 0,
  queuedSites: [],
};

function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [todayStats, setTodayStats] = useState<DayStats | null>(null);
  const [focusMode, setFocusMode] = useState<FocusModeState | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'focus'>('dashboard');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (settings?.theme) {
      import('../theme').then(({ applyTheme }) => applyTheme(settings.theme!));
    }
  }, [settings?.theme]);

  const loadData = async () => {
    const result = await chrome.storage.local.get(['settings', 'stats', 'focusMode']);
    const today = new Date().toDateString();
    
    const loaded = (result.settings as Settings) || defaultSettings;
    if (!loaded.notes) loaded.notes = {};
    if (!loaded.theme) loaded.theme = 'system';
    setSettings(loaded);
    setTodayStats((result.stats?.[today] as DayStats) || defaultStats);
    setFocusMode((result.focusMode as FocusModeState) || defaultFocusMode);
  };

  const toggleTracking = async () => {
    if (!settings) return;
    
    const newSettings = { ...settings, trackingEnabled: !settings.trackingEnabled };
    await chrome.storage.local.set({ settings: newSettings });
    setSettings(newSettings);
    
    chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS' });
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const setTheme = async (next: 'light' | 'dark' | 'system') => {
    if (!settings) return;
    const newSettings = { ...settings, theme: next };
    await chrome.storage.local.set({ settings: newSettings });
    setSettings(newSettings);
    chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS' });
  };

  const cycleTheme = () => {
    const order: Array<'system' | 'light' | 'dark'> = ['system', 'light', 'dark'];
    const current = settings?.theme ?? 'system';
    const idx = order.indexOf(current);
    const next = order[(idx + 1) % order.length];
    void setTheme(next);
  };

  const renderThemeIcon = (t?: 'light' | 'dark' | 'system') => {
    const theme = t ?? 'system';
    if (theme === 'light') return <Sun className="h-4 w-4" />;
    if (theme === 'dark') return <Moon className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  if (!settings || !todayStats || !focusMode) {
    return (
      <div className="w-96 h-[500px] flex items-center justify-center bg-gradient-to-br from-slate-50 to-purple-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-3 border-purple-200 dark:border-purple-700 border-t-purple-600 mx-auto mb-4"></div>
          <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">Loading EyeCare Focus...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 bg-white dark:bg-slate-900 dark:text-slate-100 shadow-2xl border border-slate-200/50 dark:border-slate-700">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 dark:from-purple-800 dark:via-purple-900 dark:to-indigo-900 text-white p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl border border-white/10">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">EyeCare Focus</h1>
              <p className="text-purple-100 text-xs font-medium">Protect your vision, boost productivity</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={cycleTheme}
              title={`Theme: ${settings.theme ?? 'system'}`}
              className="p-2.5 hover:bg-white/20 rounded-xl transition-all duration-200 backdrop-blur-sm border border-white/10"
            >
              {renderThemeIcon(settings.theme)}
            </button>
            <button
              onClick={openOptions}
              className="p-2.5 hover:bg-white/20 rounded-xl transition-all duration-200 backdrop-blur-sm border border-white/10"
              title="Open Options"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {/* Tracking Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-2.5 h-2.5 rounded-full ${settings.trackingEnabled ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50' : 'bg-rose-400 shadow-lg shadow-rose-400/50'}`}></div>
            <span className="text-purple-100 text-sm font-medium">
              {settings.trackingEnabled ? 'Tracking Active' : 'Tracking Paused'}
            </span>
          </div>
          <button
            onClick={toggleTracking}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 shadow-lg ${
              settings.trackingEnabled 
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/25' 
                : 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm border border-white/10'
            }`}
          >
            {settings.trackingEnabled ? (
              <>
                <Square className="h-3 w-3" />
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                <span>START</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 px-5 py-4 text-sm font-semibold border-b-2 transition-all duration-200 ${
            activeTab === 'dashboard'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-white dark:bg-slate-700 shadow-sm'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'
          }`}
        >
          <BarChart3 className="h-4 w-4 inline mr-2" />
          Analytics
        </button>
        <button
          onClick={() => setActiveTab('focus')}
          className={`flex-1 px-5 py-4 text-sm font-semibold border-b-2 transition-all duration-200 ${
            activeTab === 'focus'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-white dark:bg-slate-700 shadow-sm'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'
          }`}
        >
          <Target className="h-4 w-4 inline mr-2" />
          Focus Mode
        </button>
      </div>

      {/* Content */}
      <div className="h-96 overflow-hidden bg-slate-50/30 dark:bg-slate-800/30">
        {activeTab === 'dashboard' ? (
          <Dashboard stats={todayStats} settings={settings} />
        ) : (
          <FocusMode 
            focusMode={focusMode} 
            settings={settings} 
            onModeChange={loadData}
          />
        )}
      </div>
    </div>
  );
}

export default App;
