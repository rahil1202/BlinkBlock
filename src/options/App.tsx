/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { Save, Plus, Eye, Shield, Globe, Clock, CheckCircle, Settings, ArrowLeftRight } from 'lucide-react';

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  };

  if (!settings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-3 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 dark:bg-slate-900 dark:text-slate-100">
      <div className="max-w-5xl mx-auto py-8 px-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 dark:border-slate-700 rounded-2xl shadow-lg border border-slate-200/50 p-8 mb-8 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center space-x-4 mb-2">
                <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg">
                  <Eye className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-slate-800 tracking-tight">EyeCare Focus</h1>
                  <p className="text-slate-600 font-medium">Extension Settings</p>
                </div>
              </div>
              <p className="text-slate-500 leading-relaxed">Configure your eye care reminders, focus sessions, and website blocking preferences</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-slate-100 rounded-xl">
                <Settings className="h-6 w-6 text-slate-600" />
              </div>
              <select
                value={(settings as any).theme || 'system'}
                onChange={(e) => setSettings({ ...settings!, theme: e.target.value as any })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold bg-white"
                title="Theme"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>
          
          {saved && (
            <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center space-x-2 shadow-sm">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <span className="font-semibold">Settings saved successfully!</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Eye Care Settings */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6 backdrop-blur-sm">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2.5 bg-blue-600 rounded-xl">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Eye Care Reminders</h2>
                <p className="text-sm text-slate-500">20-20-20 rule notifications</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3">
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
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium bg-slate-50 focus:bg-white"
                />
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Recommended: 20 minutes (follows the 20-20-20 rule for eye health)
                </p>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="text-sm font-bold text-slate-700">Enable Tracking</label>
                  <p className="text-xs text-slate-500 mt-0.5">Monitor focus time and website usage</p>
                </div>
                <button
                  onClick={() => setSettings({
                    ...settings,
                    trackingEnabled: !settings.trackingEnabled
                  })}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-200 ${
                    settings.trackingEnabled ? 'bg-blue-600 shadow-lg' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 shadow-sm ${
                      settings.trackingEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="text-sm font-bold text-slate-700">Sound Notifications</label>
                  <p className="text-xs text-slate-500 mt-0.5">Play audio with eye care reminders</p>
                </div>
                <button
                  onClick={() => setSettings({
                    ...settings,
                    soundEnabled: !settings.soundEnabled
                  })}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-200 ${
                    settings.soundEnabled ? 'bg-blue-600 shadow-lg' : 'bg-slate-300'
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
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6 backdrop-blur-sm">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2.5 bg-violet-600 rounded-xl">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Focus Mode</h2>
                <p className="text-sm text-slate-500">Website blocking preferences</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3">
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
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all duration-200 font-medium bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3">
                  Blocking Mode
                </label>
                <div className="space-y-3">
                  <label className="flex items-center p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors duration-200">
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
                      <span className="text-sm font-semibold text-slate-800">Blocklist Mode</span>
                      <p className="text-xs text-slate-500 mt-0.5">Block only specific distracting sites</p>
                    </div>
                  </label>
                  <label className="flex items-center p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors duration-200">
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
                      <span className="text-sm font-semibold text-slate-800">Allowlist Mode</span>
                      <p className="text-xs text-slate-500 mt-0.5">Allow only specific work/study sites</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Blocklist Management */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6 backdrop-blur-sm">
          <div className="flex items-center space-x-3 mb-6">
            <div className={`p-2.5 rounded-xl ${settings.useAllowlistMode ? 'bg-emerald-600' : 'bg-red-600'}`}>
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {settings.useAllowlistMode ? 'Allowed Sites' : 'Blocked Sites'}
              </h2>
              <p className="text-sm text-slate-500">
                {settings.useAllowlistMode ? 'Sites you can access during focus mode' : 'Sites blocked during focus mode'}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Blocklist */}
            {!settings.useAllowlistMode && (
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>Blocked Domains</span>
                </h3>
                
                <div className="flex space-x-2 mb-4">
                  <input
                    type="text"
                    placeholder="instagram.com"
                    value={newBlocklistItem}
                    onChange={(e) => { setNewBlocklistItem(e.target.value); setBlockError(''); }}
                    onKeyPress={(e) => e.key === 'Enter' && addToBlocklist()}
                    className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm font-medium bg-slate-50 focus:bg-white transition-all duration-200"
                  />
                  <button
                    onClick={addToBlocklist}
                    className="px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {blockError && <div className="text-xs text-rose-600 mb-2">{blockError}</div>}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {settings.blocklist.map((domain) => (
                    <div key={domain} className="bg-red-50 hover:bg-red-100 px-4 py-3 rounded-xl border border-red-200 transition-colors duration-200">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-red-800 flex-1 truncate">{domain}</span>
                        <button onClick={() => editNote(domain)} className="px-2 py-1 rounded-lg bg-amber-500 text-white text-[11px] hover:bg-amber-600">Note</button>
                        <button onClick={() => moveBetweenLists(domain, 'blocklist')} className="px-2 py-1 rounded-lg bg-indigo-600 text-white text-[11px] hover:bg-indigo-700 inline-flex items-center gap-1"><ArrowLeftRight className="h-3.5 w-3.5" />Move</button>
                        <button onClick={() => removeFromBlocklist(domain)} className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[11px] hover:bg-rose-700">Remove</button>
                      </div>
                      {noteEditingFor === domain ? (
                        <div className="mt-2 flex items-center gap-2">
                          <input value={noteValue} onChange={(e) => setNoteValue(e.target.value)} className="flex-1 px-2 py-1 rounded-lg border border-slate-300 text-xs" placeholder="Why blocked?" />
                          <button onClick={() => saveNote(domain)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700">Save</button>
                          <button onClick={() => setNoteEditingFor(null)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300">Cancel</button>
                          <button onClick={() => deleteNote(domain)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700">Delete</button>
                        </div>
                      ) : settings.notes?.[domain] ? (
                        <div className="mt-1 text-[11px] text-red-700/90">{settings.notes[domain]}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Allowlist */}
            {settings.useAllowlistMode && (
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center space-x-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span>Allowed Domains</span>
                </h3>
                
                <div className="flex space-x-2 mb-4">
                  <input
                    type="text"
                    placeholder="github.com"
                    value={newAllowlistItem}
                    onChange={(e) => { setNewAllowlistItem(e.target.value); setAllowError(''); }}
                    onKeyPress={(e) => e.key === 'Enter' && addToAllowlist()}
                    className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-medium bg-slate-50 focus:bg-white transition-all duration-200"
                  />
                  <button
                    onClick={addToAllowlist}
                    className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {allowError && <div className="text-xs text-emerald-700 mb-2">{allowError}</div>}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {settings.allowlist.map((domain) => (
                    <div key={domain} className="bg-emerald-50 hover:bg-emerald-100 px-4 py-3 rounded-xl border border-emerald-200 transition-colors duration-200">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-emerald-800 flex-1 truncate">{domain}</span>
                        <button onClick={() => editNote(domain)} className="px-2 py-1 rounded-lg bg-amber-500 text-white text-[11px] hover:bg-amber-600">Note</button>
                        <button onClick={() => moveBetweenLists(domain, 'allowlist')} className="px-2 py-1 rounded-lg bg-indigo-600 text-white text-[11px] hover:bg-indigo-700 inline-flex items-center gap-1"><ArrowLeftRight className="h-3.5 w-3.5" />Move</button>
                        <button onClick={() => removeFromAllowlist(domain)} className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[11px] hover:bg-emerald-700">Remove</button>
                      </div>
                      {noteEditingFor === domain ? (
                        <div className="mt-2 flex items-center gap-2">
                          <input value={noteValue} onChange={(e) => setNoteValue(e.target.value)} className="flex-1 px-2 py-1 rounded-lg border border-slate-300 text-xs" placeholder="Why allowed?" />
                          <button onClick={() => saveNote(domain)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700">Save</button>
                          <button onClick={() => setNoteEditingFor(null)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300">Cancel</button>
                          <button onClick={() => deleteNote(domain)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700">Delete</button>
                        </div>
                      ) : settings.notes?.[domain] ? (
                        <div className="mt-1 text-[11px] text-emerald-700/90">{settings.notes[domain]}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Usage Tips */}
            <div className="lg:col-span-1">
              <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Usage Tips</span>
              </h3>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-xl border border-blue-200 shadow-sm">
                <ul className="text-sm text-blue-800 space-y-3">
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span>Enter domains without "www" or "https://"</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span>Blocklist mode: blocks only listed sites</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span>Allowlist mode: blocks everything except listed sites</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span>Changes apply immediately during active sessions</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Import / Export */}
        <div className="bg-white dark:bg-slate-800 dark:border-slate-700 rounded-2xl shadow-lg border border-slate-200/50 p-6 mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-slate-800">Import / Export</div>
            <button onClick={() => setImportOpen((v) => !v)} className="text-xs underline text-blue-700 hover:text-blue-900">{importOpen ? 'Hide' : 'Show'}</button>
          </div>
          {importOpen && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button onClick={exportData} className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-700 text-white hover:bg-slate-800">{copied ? 'Copied JSON!' : 'Copy JSON'}</button>
                <span className="text-[11px] text-slate-500">Lists + notes snapshot</span>
              </div>
              <textarea
                value={importText}
                onChange={(e) => { setImportText(e.target.value); setImportError(''); }}
                placeholder='Paste JSON {"blocklist":[],"allowlist":[],"notes":{}} or newline-separated domains'
                className="w-full h-28 text-xs p-2 border border-slate-300 rounded-lg"
              />
              {importError && <div className="text-xs text-rose-600">{importError}</div>}
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-slate-500">Newline import goes to current mode list</div>
                <button onClick={importData} className="px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700">Import</button>
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="mt-8 text-center">
          <button
            onClick={saveSettings}
            className={`px-8 py-4 rounded-xl font-bold transition-all duration-200 flex items-center space-x-3 mx-auto shadow-lg hover:shadow-xl transform hover:scale-105 ${
              saved 
                ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white' 
                : 'bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-700 hover:via-blue-800 hover:to-indigo-800 text-white'
            }`}
          >
            <div className="p-1 bg-white/20 rounded-lg">
              {saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            </div>
            <span>{saved ? 'Settings Saved!' : 'Save All Settings'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default OptionsApp;
