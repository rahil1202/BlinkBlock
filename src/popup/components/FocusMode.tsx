import { useEffect, useMemo, useState, useRef } from 'react';
import { Timer as TimerIcon, Globe, ListPlus, Shield, Check, X, ArrowLeftRight, Upload, Copy, SquarePen } from 'lucide-react';

interface FocusModeState {
  isActive: boolean;
  endTime: number; // ms epoch
  queuedSites: string[];
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

type Props = {
  focusMode: FocusModeState;
  settings: Settings;
  onModeChange: () => void;
};

const FocusMode = ({ focusMode, settings, onModeChange }: Props) => {
  const [currentDomain, setCurrentDomain] = useState<string>("");
  const [customDuration, setCustomDuration] = useState<number>(settings.focusDuration || 25);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [addValue, setAddValue] = useState<string>("");
  const [addError, setAddError] = useState<string>("");
  const [editError, setEditError] = useState<string>("");
  const [undo, setUndo] = useState<{ list: 'allowlist'|'blocklist'; domain: string } | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const [noteEditingFor, setNoteEditingFor] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState<string>("");
  const [showImportExport, setShowImportExport] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>("");
  const [importError, setImportError] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  
  const remaining = useMemo(() => {
    if (!focusMode.isActive) return 0;
    return Math.max(0, focusMode.endTime - Date.now());
  }, [focusMode.isActive, focusMode.endTime]);

  useEffect(() => {
    const loadCurrent = async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = tabs[0]?.url;
      if (url) setCurrentDomain(extractDomain(url));
    };
    loadCurrent();
  }, []);

  const startFocus = async (duration: number) => {
    await chrome.runtime.sendMessage({ type: 'START_FOCUS_MODE', duration });
    onModeChange();
  };

  const endFocus = async () => {
    await chrome.runtime.sendMessage({ type: 'END_FOCUS_MODE' });
    onModeChange();
  };

  const extractDomain = (url: string): string => {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');
      return host;
    } catch {
      return url;
    }
  };

  const saveSettings = async (next: Settings) => {
    if (!next.notes) next.notes = {};
    await chrome.storage.local.set({ settings: next });
    try {
      const response = await chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS' });
      if (!response.success) {
        console.error('Failed to update settings:', response.error);
      }
    } catch (error) {
      console.error('Error sending UPDATE_SETTINGS:', error);
    }
    onModeChange();
  };

  const addCurrentToList = async () => {
    if (!currentDomain) return;
    const next: Settings = { ...settings };
    const listKey = settings.useAllowlistMode ? 'allowlist' : 'blocklist';
    const otherKey = settings.useAllowlistMode ? 'blocklist' : 'allowlist';
    const setA = new Set(next[listKey]);
    setA.add(currentDomain);
    next[listKey] = Array.from(setA);
    next[otherKey] = next[otherKey].filter((d) => d !== currentDomain);
    await saveSettings(next);
  };

  const normalizeDomain = (input: string): string | null => {
    const raw = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
    if (!raw) return null;
    if (raw.includes('/') || raw.includes(' ')) return null;
    if (!raw.includes('.')) return null;
    return raw;
  };

  const addDomain = async (targetList: 'allowlist'|'blocklist') => {
    const norm = normalizeDomain(addValue);
    if (!norm) {
      setAddError('Enter a valid domain like example.com');
      return;
    }
    const next: Settings = { ...settings };
    const other = targetList === 'allowlist' ? 'blocklist' : 'allowlist';
    next[targetList] = Array.from(new Set([...next[targetList], norm]));
    next[other] = next[other].filter((d) => d !== norm);
    setAddValue("");
    setAddError("");
    await saveSettings(next);
  };

  const removeDomain = async (domain: string, listKey: 'allowlist'|'blocklist') => {
    const next: Settings = { ...settings };
    next[listKey] = next[listKey].filter((d) => d !== domain);
    await saveSettings(next);
    setUndo({ list: listKey, domain });
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = window.setTimeout(() => setUndo(null), 6000);
  };

  const beginEdit = (index: number, current: string) => {
    setEditingIndex(index);
    setEditValue(current);
  };

  const saveEdit = async (index: number, listKey: 'allowlist'|'blocklist') => {
    const norm = normalizeDomain(editValue);
    if (!norm) {
      setEditError('Enter a valid domain like example.com');
      return;
    }
    const next: Settings = { ...settings };
    const original = next[listKey][index];
    const setA = new Set(next[listKey]);
    setA.delete(original);
    setA.add(norm);
    next[listKey] = Array.from(setA);
    setEditingIndex(null);
    setEditError("");
    await saveSettings(next);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditValue("");
    setEditError("");
  };

  const toggleMode = async () => {
    const next: Settings = { ...settings, useAllowlistMode: !settings.useAllowlistMode };
    await saveSettings(next);
  };

  const queueCurrent = async () => {
    if (!currentDomain) return;
    await chrome.runtime.sendMessage({ type: 'QUEUE_SITE', url: currentDomain });
    onModeChange();
  };

  const editNote = (domain: string) => {
    setNoteEditingFor(domain);
    setNoteValue(settings.notes?.[domain] || '');
  };

  const saveNote = async (domain: string) => {
    const next: Settings = { ...settings, notes: { ...(settings.notes || {}) } };
    const val = noteValue.trim();
    if (val) next.notes![domain] = val; else delete next.notes![domain];
    setNoteEditingFor(null);
    setNoteValue('');
    await saveSettings(next);
  };

  const deleteNote = async (domain: string) => {
    if (!settings.notes || !settings.notes[domain]) return;
    const next: Settings = { ...settings, notes: { ...(settings.notes || {}) } };
    delete next.notes![domain];
    await saveSettings(next);
  };

  const exportData = async () => {
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

  const importData = async () => {
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
      next[listKey] = Array.from(new Set([...next[listKey], ...targets]));
    }
    await saveSettings(next);
    setImportText('');
    setShowImportExport(false);
  };

  async function handleUndo() {
    if (!undo) return;
    const next: Settings = { ...settings };
    next[undo.list] = Array.from(new Set([...next[undo.list], undo.domain]));
    setUndo(null);
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    await saveSettings(next);
  }

  async function moveDomain(domain: string, from: 'allowlist'|'blocklist') {
    const to: 'allowlist'|'blocklist' = from === 'allowlist' ? 'blocklist' : 'allowlist';
    const next: Settings = { ...settings };
    next[from] = next[from].filter((d) => d !== domain);
    next[to] = Array.from(new Set([...next[to], domain]));
    await saveSettings(next);
  }

  function formatMs(ms: number): string {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function renderList(listKey: 'allowlist'|'blocklist', items: string[]) {
    const isAllow = listKey === 'allowlist';
    return (
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-3 h-3 rounded-full ${isAllow ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {isAllow ? 'Allowlist' : 'Blocklist'}
          </div>
          <div className="ml-auto text-xs text-slate-500 dark:text-slate-400">
            {items.length} sites
          </div>
        </div>
        
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {items.map((d, i) => (
            <div key={`${listKey}-${d}-${i}`} className="group">
              {editingIndex === i ? (
                <div className="space-y-2">
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => { setEditValue(e.target.value); setEditError(''); }}
                    className={`w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 ${
                      editError ? 'border-rose-400' : 'border-slate-300 dark:border-slate-600'
                    } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                    placeholder="example.com"
                  />
                  {editError && <div className="text-xs text-rose-600 dark:text-rose-400">{editError}</div>}
                  <div className="flex gap-2">
                    <button 
                      onClick={() => saveEdit(i, listKey)} 
                      className="flex-1 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Check className="h-4 w-4" />
                      Save
                    </button>
                    <button 
                      onClick={cancelEdit} 
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate font-medium">
                    {d}
                  </div>
                  {settings.notes?.[d] && (
                    <div className="w-2 h-2 rounded-full bg-amber-400" title="Has note"></div>
                  )}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => beginEdit(i, d)} 
                      className="p-1.5 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-xs transition-colors"
                      title="Edit domain"
                    >
                      <SquarePen className="h-3 w-3" />
                    </button>
                    <button 
                      onClick={() => editNote(d)} 
                      className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs transition-colors"
                      title="Add/edit note"
                    >
                      📝
                    </button>
                    <button 
                      onClick={() => moveDomain(d, listKey)} 
                      className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs transition-colors"
                      title={`Move to ${listKey === 'allowlist' ? 'blocklist' : 'allowlist'}`}
                    >
                      <ArrowLeftRight className="h-3 w-3" />
                    </button>
                    <button 
                      onClick={() => removeDomain(d, listKey)} 
                      className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs transition-colors"
                      title="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!items.length && (
            <div className="text-sm text-slate-400 dark:text-slate-500 text-center py-4 italic">
              No sites added yet
            </div>
          )}
        </div>

        {noteEditingFor && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              Note for <span className="font-semibold text-slate-800 dark:text-slate-200">{noteEditingFor}</span>
            </div>
            <div className="space-y-2">
              <textarea
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                placeholder="Why is this site listed? Add context..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows={3}
              />
              <div className="flex gap-2">
                <button 
                  onClick={() => saveNote(noteEditingFor)} 
                  className="flex-1 px-3 py-2 text-sm font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors"
                >
                  Save Note
                </button>
                <button 
                  onClick={() => setNoteEditingFor(null)} 
                  className="flex-1 px-3 py-2 text-sm font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                {settings.notes?.[noteEditingFor] && (
                  <button 
                    onClick={() => deleteNote(noteEditingFor)} 
                    className="px-3 py-2 text-sm font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
        {/* Focus Mode Status */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-800">
                <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="text-base font-bold text-slate-800 dark:text-slate-200">Focus Mode</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {focusMode.isActive ? (
                    <span className="inline-flex items-center gap-2 text-purple-600 dark:text-purple-400 font-medium">
                      <TimerIcon className="h-4 w-4 animate-pulse" />
                      {formatMs(remaining)} remaining
                    </span>
                  ) : (
                    'Ready to start'
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {focusMode.isActive ? (
            <button 
              onClick={endFocus} 
              className="w-full px-4 py-3 text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors"
            >
              End Focus Session
            </button>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[settings.focusDuration, 15, 45].map((d) => (
                  <button 
                    key={d} 
                    onClick={() => startFocus(d)} 
                    className="px-3 py-2 text-sm font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors"
                  >
                    {d}m
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  value={customDuration}
                  min={1}
                  max={180}
                  onChange={(e) => setCustomDuration(Number(e.target.value))}
                  placeholder="Minutes"
                />
                <button 
                  onClick={() => startFocus(customDuration)} 
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-700 dark:bg-slate-600 hover:bg-slate-800 dark:hover:bg-slate-500 text-white transition-colors"
                >
                  Start
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Current Site Actions */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl">
                <Globe className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Current site</div>
                <div className="text-base font-semibold text-slate-800 dark:text-slate-200 truncate max-w-48">
                  {currentDomain || 'No active tab'}
                </div>
              </div>
            </div>
            <button 
              onClick={queueCurrent} 
              disabled={!currentDomain}
              className="px-3 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:text-slate-500 text-white transition-colors"
            >
              Queue
            </button>
          </div>
          
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Mode: {settings.useAllowlistMode ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <Check className="h-4 w-4" /> Allow only listed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                  <X className="h-4 w-4" /> Block listed
                </span>
              )}
            </div>
            <button 
              onClick={toggleMode} 
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-600 hover:bg-slate-700 text-white transition-colors"
            >
              Switch Mode
            </button>
          </div>
          
          <button 
            onClick={addCurrentToList} 
            disabled={!currentDomain}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 disabled:text-slate-500 text-white transition-colors"
          >
            <ListPlus className="h-4 w-4" />
            Add to {settings.useAllowlistMode ? 'Allowlist' : 'Blocklist'}
          </button>
          
          {focusMode.isActive && (
            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-lg p-2">
              💡 Changes apply immediately during active sessions
            </div>
          )}
        </div>

        {/* Quick Add Domain */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Quick Add Domain</div>
          
          <div className="space-y-3">
            <input
              type="text"
              placeholder="example.com"
              value={addValue}
              onChange={(e) => { setAddValue(e.target.value); setAddError(''); }}
              className={`w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 ${
                addError ? 'border-rose-400' : 'border-slate-300 dark:border-slate-600'
              } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
            />
            {addError && <div className="text-xs text-rose-600 dark:text-rose-400">{addError}</div>}
            
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => addDomain('blocklist')} 
                className="px-3 py-2 text-sm font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors"
              >
                Add to Blocklist
              </button>
              <button 
                onClick={() => addDomain('allowlist')} 
                className="px-3 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
              >
                Add to Allowlist
              </button>
            </div>
          </div>
        </div>

        {/* Lists Management */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-base font-bold text-slate-800 dark:text-slate-200">Manage Lists</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {settings.blocklist.length + settings.allowlist.length} total sites
            </div>
          </div>
          
          <div className="grid gap-4">
            {renderList('blocklist', settings.blocklist)}
            {renderList('allowlist', settings.allowlist)}
          </div>
        </div>

        {/* Undo Notification */}
        {undo && (
          <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-700 dark:text-slate-300">
                Removed <span className="font-semibold">{undo.domain}</span> from {undo.list}
              </span>
              <button 
                onClick={handleUndo} 
                className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-semibold"
              >
                Undo
              </button>
            </div>
          </div>
        )}

        {/* Queued Sites */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
            Queued Sites ({focusMode.queuedSites.length})
          </div>
          {focusMode.queuedSites.length ? (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {focusMode.queuedSites.map((u, i) => (
                <div key={`${u}-${i}`} className="text-sm text-slate-600 dark:text-slate-400 truncate px-2 py-1 bg-white dark:bg-slate-700 rounded-lg">
                  {u}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-400 dark:text-slate-500 text-center py-4 italic">
              No sites queued yet
            </div>
          )}
        </div>

        {/* Import / Export */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">Import / Export</div>
            <button 
              onClick={() => setShowImportExport(!showImportExport)} 
              className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-semibold"
            >
              {showImportExport ? 'Hide' : 'Show'}
            </button>
          </div>
          
          {showImportExport && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button 
                  onClick={exportData} 
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg bg-slate-700 dark:bg-slate-600 hover:bg-slate-800 dark:hover:bg-slate-500 text-white transition-colors"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Export'}
                </button>
              </div>
              
              <textarea
                value={importText}
                onChange={(e) => { setImportText(e.target.value); setImportError(''); }}
                placeholder='Paste JSON or newline-separated domains...'
                className="w-full h-24 text-sm p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
              
              {importError && <div className="text-xs text-rose-600 dark:text-rose-400">{importError}</div>}
              
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Plain text goes to current mode list
                </div>
                <button 
                  onClick={importData} 
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  Import
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FocusMode;
