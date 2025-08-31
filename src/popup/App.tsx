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
    // Ensure new fields exist
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
      <div className="w-96 h-[500px] flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-200 border-t-blue-600 mx-auto mb-3"></div>
          <p className="text-sm text-slate-600 font-medium">Loading EyeCare Focus...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 bg-white dark:bg-slate-900 dark:text-slate-100 shadow-xl border border-slate-200/50 dark:border-slate-700">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 dark:from-slate-800 dark:via-slate-900 dark:to-black text-white p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">EyeCare Focus</h1>
              <p className="text-blue-100 text-xs font-medium">Protect your vision, boost productivity</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={cycleTheme}
              title={`Theme: ${settings.theme ?? 'system'}`}
              className="p-2 hover:bg-white/20 rounded-lg transition-all duration-200 backdrop-blur-sm"
            >
              {renderThemeIcon(settings.theme)}
            </button>
            <button
              onClick={openOptions}
              className="p-2 hover:bg-white/20 rounded-lg transition-all duration-200 backdrop-blur-sm"
              title="Open Options"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {/* Tracking Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${settings.trackingEnabled ? 'bg-green-400' : 'bg-red-400'}`}></div>
            <span className="text-blue-100 text-sm font-medium">
              {settings.trackingEnabled ? 'Tracking Active' : 'Tracking Paused'}
            </span>
          </div>
          <button
            onClick={toggleTracking}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
              settings.trackingEnabled 
                ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg' 
                : 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm'
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
              ? 'border-blue-600 text-blue-600 bg-white shadow-sm'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/50'
          }`}
        >
          <BarChart3 className="h-4 w-4 inline mr-2" />
          Analytics
        </button>
        <button
          onClick={() => setActiveTab('focus')}
          className={`flex-1 px-5 py-4 text-sm font-semibold border-b-2 transition-all duration-200 ${
            activeTab === 'focus'
              ? 'border-blue-600 text-blue-600 bg-white shadow-sm'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/50'
          }`}
        >
          <Target className="h-4 w-4 inline mr-2" />
          Focus Mode
        </button>
      </div>

      {/* Content */}
      <div className="h-96 overflow-y-auto bg-slate-50/30 dark:bg-slate-800/30">
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
