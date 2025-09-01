/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { Save, Plus, Eye, Shield, Globe, Clock, CheckCircle, Settings, ArrowLeftRight, Upload, Copy } from 'lucide-react';

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

function OptionsApp() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [newBlocklistItem, setNewBlocklistItem] = useState('');
  const [newAllowlistItem, setNewAllowlistItem] = useState('');
  const [saved, setSaved] = useState(false);
  const [blockError, setBlockError] = useState('');
  const [allowError, setAllowError] = useState('');
  const [noteEditingFor, setNoteEditingFor] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if ((settings as any)?.theme) {
      import('../theme').then(({ applyTheme }) => applyTheme(((settings as any).theme)));
    }
  }, [(settings as any)?.theme]);

  const loadSettings = async () => {
    const result = await chrome.storage.local.get('settings');
    const loaded: Settings = result.settings || {
      reminderInterval: 20,
      trackingEnabled: true,
      focusModeEnabled: true,
      focusDuration: 25,
      blocklist: ['instagram.com', 'youtube.com', 'twitter.com', 'x.com', 'linkedin.com', 'facebook.com', 'tiktok.com'],
      allowlist: ['github.com', 'stackoverflow.com', 'docs.google.com'],
      useAllowlistMode: false,
      soundEnabled: true,
      notes: {},
    };
    if (!loaded.notes) loaded.notes = {};
    if (!loaded.theme) (loaded as any).theme = 'system';
    setSettings(loaded);
  };

  const saveSettings = async () => {
    if (settings) {
      if (!settings.notes) settings.notes = {};
      await chrome.storage.local.set({ settings });
      chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS' });
      
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const normalizeDomain = (input: string): string | null => {
    const raw = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
    if (!raw) return null;
    if (raw.includes('/') || raw.includes(' ')) return null;
    if (!raw.includes('.')) return null;
    return raw;
  };

  const addToBlocklist = () => {
    if (!settings) return;
    const domain = normalizeDomain(newBlocklistItem);
    if (!domain) {
      setBlockError('Enter a valid domain like example.com');
      return;
    }
    const block = new Set(settings.blocklist);
    block.add(domain);
    const allow = settings.allowlist.filter((d) => d !== domain);
    setSettings({ ...settings, blocklist: Array.from(block), allowlist: allow });
    setNewBlocklistItem('');
    setBlockError('');
  };

  const removeFromBlocklist = (domain: string) => {
    if (settings) {
      setSettings({
        ...settings,
        blocklist: settings.blocklist.filter(item => item !== domain)
      });
    }
  };

  const addToAllowlist = () => {
    if (!settings) return;
    const domain = normalizeDomain(newAllowlistItem);
    if (!domain) {
      setAllowError('Enter a valid domain like example.com');
      return;
    }
    const allow = new Set(settings.allowlist);
    allow.add(domain);
    const block = settings.blocklist.filter((d) => d !== domain);
    setSettings({ ...settings, allowlist: Array.from(allow), blocklist: block });
    setNewAllowlistItem('');
    setAllowError('');
  };

  const removeFromAllowlist = (domain: string) => {
    if (settings) {
      setSettings({
        ...settings,
        allowlist: settings.allowlist.filter(item => item !== domain)
      });
    }
  };

  const moveBetweenLists = (domain: string, from: 'blocklist'|'allowlist') => {
    if (!settings) return;
    const to = from === 'blocklist' ? 'allowlist' : 'blocklist';
    const next = { ...settings } as any;
    next[from] = next[from].filter((d: string) => d !== domain);
    next[to] = Array.from(new Set([...(next[to] as string[]), domain]));
    setSettings(next);
  };

  const editNote = (domain: string) => {
    setNoteEditingFor(domain);
    setNoteValue(settings?.notes?.[domain] || '');
  };

  const saveNote = (domain: string) => {
    if (!settings) return;
    const next: Settings = { ...settings, notes: { ...(settings.notes || {}) } };
    const val = noteValue.trim();
    if (val) next.notes![domain] = val; else delete next.notes![domain];
    setSettings(next);
    setNoteEditingFor(null);
    setNoteValue('');
  };

  const deleteNote = (domain: string) => {
    if (!settings?.notes?.[domain]) return;
    const next: Settings = { ...settings, notes: { ...(settings.notes || {}) } };
    delete next.notes![domain];
    setSettings(next);
  };

  const exportData = async () => {
    if (!settings) return;
    const payload = {
      blocklist: settings.blocklist,
      allowlist: settings.allowlist,
      notes: settings.notes || {},
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'eyecare-focus-lists.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  };

  const importData = () => {
    if (!settings) return;
    setImportError('');
    const raw = importText.trim();
    if (!raw) return;
    const next: Settings = { ...settings, notes: { ...(settings.notes || {}) } };
    try {
      const obj = JSON.parse(raw);
      if (Array.isArray(obj.blocklist)) {
        next.blocklist = Array.from(new Set([...next.blocklist, ...obj.blocklist.map((d: string) => normalizeDomain(d)).filter(Boolean) as string[]]));
      }
      if (Array.isArray(obj.allowlist)) {
        next.allowlist = Array.from(new Set([...next.allowlist, ...obj.allowlist.map((d: string) => normalizeDomain(d)).filter(Boolean) as string[]]));
      }
      if (obj.notes && typeof obj.notes === 'object') {
        next.notes = { ...next.notes, ...obj.notes };
      }
    } catch {
      const targets = raw.split(/\r?\n/).map((l) => normalizeDomain(l)).filter(Boolean) as string[];
      if (!targets.length) {
        setImportError('Nothing to import. Provide JSON or newline domains.');
        return;
      }
      const listKey = settings.useAllowlistMode ? 'allowlist' : 'blocklist';
      next[listKey] = Array.from(new Set([...(next[listKey] as string[]), ...targets]));
    }
    setSettings(next);
    setImportText('');
    setImportOpen(false);
  };

  if (!settings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-3 border-purple-200 dark:border-purple-700 border-t-purple-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-300 font-medium">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-indigo-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 dark:text-slate-100">
      <div className="max-w-5xl mx-auto py-8 px-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700 p-8 mb-8 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center space-x-4 mb-2">
                <div className="p-3 bg-gradient-to-br from-purple-600 to-indigo-700 dark:from-purple-500 dark:to-indigo-600 rounded-xl shadow-lg">
                  <Eye className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 tracking-tight">EyeCare Focus</h1>
                  <p className="text-slate-600 dark:text-slate-400 font-medium">Extension Settings</p>
                </div>
              </div>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">Configure your eye care reminders, focus sessions, and website blocking preferences</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-xl">
                <Settings className="h-6 w-6 text-slate-600 dark:text-slate-400" />
              </div>
              <select
                value={(settings as any).theme || 'system'}
                onChange={(e) => setSettings({ ...settings!, theme: e.target.value as any })}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                title="Theme"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>
          
          {saved && (
            <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-200 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 px-4 py-3 rounded-xl flex items-center space-x-2 shadow-sm">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold">Settings saved successfully!</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Eye Care Settings */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700 p-6 backdrop-blur-sm">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2.5 bg-purple-600 dark:bg-purple-500 rounded-xl">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Eye Care Reminders</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">20-20-20 rule notifications</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                  Reminder Interval (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={settings.reminderInterval}
                  onChange={(e) => setSettings({
                    ...settings,
                    reminderInterval: parseInt(e.target.value) || 20
                  })}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium bg-slate-50 dark:bg-slate-700 focus:bg-white dark:focus:bg-slate-600 text-slate-800 dark:text-slate-200"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  Recommended: 20 minutes (follows the 20-20-20 rule for eye health)
                </p>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
                <div>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Enable Tracking</label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Monitor focus time and website usage</p>
                </div>
                <button
                  onClick={() => setSettings({
                    ...settings,
                    trackingEnabled: !settings.trackingEnabled
                  })}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-200 ${
                    settings.trackingEnabled ? 'bg-purple-600 shadow-lg shadow-purple-600/25' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 shadow-sm ${
                      settings.trackingEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
                <div>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Sound Notifications</label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Play audio with eye care reminders</p>
                </div>
                <button
                  onClick={() => setSettings({
                    ...settings,
                    soundEnabled: !settings.soundEnabled
                  })}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-200 ${
                    settings.soundEnabled ? 'bg-purple-600 shadow-lg shadow-purple-600/25' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 shadow-sm ${
                      settings.soundEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Focus Mode Settings */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700 p-6 backdrop-blur-sm">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2.5 bg-violet-600 dark:bg-violet-500 rounded-xl">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Focus Mode</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Website blocking preferences</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                  Default Focus Duration (minutes)
                </label>
                <input
                  type="number"
                  min="5"
                  max="180"
                  value={settings.focusDuration}
                  onChange={(e) => setSettings({
                    ...settings,
                    focusDuration: parseInt(e.target.value) || 25
                  })}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all duration-200 font-medium bg-slate-50 dark:bg-slate-700 focus:bg-white dark:focus:bg-slate-600 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                  Blocking Mode
                </label>
                <div className="space-y-3">
                  <label className="flex items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-200">
                    <input
                      type="radio"
                      checked={!settings.useAllowlistMode}
                      onChange={() => setSettings({
                        ...settings,
                        useAllowlistMode: false
                      })}
                      className="mr-3 text-violet-600 w-4 h-4"
                    />
                    <div>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Blocklist Mode</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Block only specific distracting sites</p>
                    </div>
                  </label>
                  <label className="flex items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-200">
                    <input
                      type="radio"
                      checked={settings.useAllowlistMode}
                      onChange={() => setSettings({
                        ...settings,
                        useAllowlistMode: true
                      })}
                      className="mr-3 text-violet-600 w-4 h-4"
                    />
                    <div>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Allowlist Mode</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Allow only specific work/study sites</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Website Lists Management */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700 p-6 backdrop-blur-sm mb-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className={`p-2.5 rounded-xl ${settings.useAllowlistMode ? 'bg-emerald-600' : 'bg-rose-600'}`}>
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                Website Lists Management
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Manage your blocked and allowed domains
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Blocklist */}
            <div>
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center space-x-2">
                <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
                <span>Blocked Domains ({settings.blocklist.length})</span>
              </h3>
              
              <div className="flex space-x-2 mb-4">
                <input
                  type="text"
                  placeholder="instagram.com"
                  value={newBlocklistItem}
                  onChange={(e) => { setNewBlocklistItem(e.target.value); setBlockError(''); }}
                  onKeyPress={(e) => e.key === 'Enter' && addToBlocklist()}
                  className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-sm font-medium bg-slate-50 dark:bg-slate-700 focus:bg-white dark:focus:bg-slate-600 text-slate-800 dark:text-slate-200 transition-all duration-200"
                />
                <button
                  onClick={addToBlocklist}
                  className="px-4 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {blockError && <div className="text-xs text-rose-600 dark:text-rose-400 mb-2">{blockError}</div>}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {settings.blocklist.map((domain) => (
                  <div key={domain} className="bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 px-4 py-3 rounded-xl border border-rose-200 dark:border-rose-800 transition-colors duration-200">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-rose-800 dark:text-rose-200 flex-1 truncate">{domain}</span>
                      {settings.notes?.[domain] && (
                        <div className="w-2 h-2 rounded-full bg-amber-400" title="Has note"></div>
                      )}
                      <div className="flex gap-1">
                        <button 
                          onClick={() => editNote(domain)} 
                          className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition-colors"
                          title="Add/edit note"
                        >
                          📝
                        </button>
                        <button 
                          onClick={() => moveBetweenLists(domain, 'blocklist')} 
                          className="px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition-colors inline-flex items-center gap-1"
                          title="Move to allowlist"
                        >
                          <ArrowLeftRight className="h-3 w-3" />
                        </button>
                        <button 
                          onClick={() => removeFromBlocklist(domain)} 
                          className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-colors"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    {noteEditingFor === domain && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={noteValue}
                          onChange={(e) => setNoteValue(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 resize-none"
                          placeholder="Why is this domain blocked?"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={() => saveNote(domain)} 
                            className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors"
                          >
                            Save Note
                          </button>
                          <button 
                            onClick={() => setNoteEditingFor(null)} 
                            className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors"
                          >
                            Cancel
                          </button>
                          {settings.notes?.[domain] && (
                            <button 
                              onClick={() => deleteNote(domain)} 
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {settings.notes?.[domain] && noteEditingFor !== domain && (
                      <div className="mt-2 text-xs text-rose-700 dark:text-rose-300 bg-rose-100/50 dark:bg-rose-900/20 rounded-lg p-2">
                        {settings.notes[domain]}
                      </div>
                    )}
                  </div>
                ))}
                {settings.blocklist.length === 0 && (
                  <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                    <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No blocked domains yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Allowlist */}
            <div>
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center space-x-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                <span>Allowed Domains ({settings.allowlist.length})</span>
              </h3>
              
              <div className="flex space-x-2 mb-4">
                <input
                  type="text"
                  placeholder="github.com"
                  value={newAllowlistItem}
                  onChange={(e) => { setNewAllowlistItem(e.target.value); setAllowError(''); }}
                  onKeyPress={(e) => e.key === 'Enter' && addToAllowlist()}
                  className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-medium bg-slate-50 dark:bg-slate-700 focus:bg-white dark:focus:bg-slate-600 text-slate-800 dark:text-slate-200 transition-all duration-200"
                />
                <button
                  onClick={addToAllowlist}
                  className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {allowError && <div className="text-xs text-emerald-700 dark:text-emerald-400 mb-2">{allowError}</div>}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {settings.allowlist.map((domain) => (
                  <div key={domain} className="bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 px-4 py-3 rounded-xl border border-emerald-200 dark:border-emerald-800 transition-colors duration-200">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200 flex-1 truncate">{domain}</span>
                      {settings.notes?.[domain] && (
                        <div className="w-2 h-2 rounded-full bg-amber-400" title="Has note"></div>
                      )}
                      <div className="flex gap-1">
                        <button 
                          onClick={() => editNote(domain)} 
                          className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition-colors"
                          title="Add/edit note"
                        >
                          📝
                        </button>
                        <button 
                          onClick={() => moveBetweenLists(domain, 'allowlist')} 
                          className="px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition-colors inline-flex items-center gap-1"
                          title="Move to blocklist"
                        >
                          <ArrowLeftRight className="h-3 w-3" />
                        </button>
                        <button 
                          onClick={() => removeFromAllowlist(domain)} 
                          className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    {noteEditingFor === domain && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={noteValue}
                          onChange={(e) => setNoteValue(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 resize-none"
                          placeholder="Why is this domain allowed?"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={() => saveNote(domain)} 
                            className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors"
                          >
                            Save Note
                          </button>
                          <button 
                            onClick={() => setNoteEditingFor(null)} 
                            className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors"
                          >
                            Cancel
                          </button>
                          {settings.notes?.[domain] && (
                            <button 
                              onClick={() => deleteNote(domain)} 
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {settings.notes?.[domain] && noteEditingFor !== domain && (
                      <div className="mt-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-100/50 dark:bg-emerald-900/20 rounded-lg p-2">
                        {settings.notes[domain]}
                      </div>
                    )}
                  </div>
                ))}
                {settings.allowlist.length === 0 && (
                  <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                    <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No allowed domains yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Usage Tips */}
          <div className="mt-8 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-6 rounded-xl border border-purple-200 dark:border-purple-800 shadow-sm">
            <h3 className="text-sm font-bold text-purple-800 dark:text-purple-200 mb-4 flex items-center space-x-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>💡 Usage Tips</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-2">
                <li className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Enter domains without "www" or "https://"</span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Blocklist mode: blocks only listed sites</span>
                </li>
              </ul>
              <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-2">
                <li className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Allowlist mode: blocks everything except listed sites</span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Changes apply immediately during active sessions</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Import / Export */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Import / Export</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Backup and restore your lists</p>
            </div>
            <button 
              onClick={() => setImportOpen(!importOpen)} 
              className="px-4 py-2 text-sm font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
            >
              {importOpen ? 'Hide' : 'Show'}
            </button>
          </div>
          
          {importOpen && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <button 
                  onClick={exportData} 
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-slate-700 dark:bg-slate-600 hover:bg-slate-800 dark:hover:bg-slate-500 text-white transition-colors"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? 'Copied!' : 'Export JSON'}
                </button>
                <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center">
                  Export your lists and notes as JSON
                </span>
              </div>
              
              <div>
                <textarea
                  value={importText}
                  onChange={(e) => { setImportText(e.target.value); setImportError(''); }}
                  placeholder='Paste JSON {"blocklist":[],"allowlist":[],"notes":{}} or newline-separated domains'
                  className="w-full h-32 text-sm p-4 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 resize-none"
                />
                {importError && (
                  <div className="text-sm text-rose-600 dark:text-rose-400 mt-2">{importError}</div>
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Plain text domains will be added to the currently active list
                </div>
                <button 
                  onClick={importData} 
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  Import Data
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="text-center">
          <button
            onClick={saveSettings}
            className={`px-8 py-4 rounded-xl font-bold transition-all duration-200 flex items-center space-x-3 mx-auto shadow-xl hover:shadow-2xl transform hover:scale-105 ${
              saved 
                ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white' 
                : 'bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 hover:from-purple-700 hover:via-purple-800 hover:to-indigo-800 text-white'
            }`} 
          >
            <div className="p-1 bg-white/20 rounded-lg">
              {saved ? <CheckCircle className="h-5 w-5" /> : <Save className="h-5 w-5" />}
            </div>
            <span className="text-lg">{saved ? 'Settings Saved!' : 'Save All Settings'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default OptionsApp;
