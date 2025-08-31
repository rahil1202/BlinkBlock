import { useEffect, useMemo, useState, useRef } from 'react';
import { Timer as TimerIcon, Globe, ListPlus, Shield, Check, X, ArrowLeftRight } from 'lucide-react';

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
      // Optionally show a UI notification
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
    // Optionally remove from the opposite list to avoid conflicts
    next[otherKey] = next[otherKey].filter((d) => d !== currentDomain);
    await saveSettings(next);
  };

  const normalizeDomain = (input: string): string | null => {
    const raw = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
    if (!raw) return null;
    if (raw.includes('/') || raw.includes(' ')) return null;
    if (!raw.includes('.')) return null; // require a dot to avoid junk
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
      // fallback: download
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
      // fallback: newline list to current active list
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
  };

  return (
    <div className="p-5 space-y-4">
      {/* Status and controls */}
      <div className="bg-white dark:bg-slate-800 dark:border-slate-700 rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-slate-100">
              <Shield className="h-4 w-4 text-slate-700" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800">Focus Mode</div>
              <div className="text-xs text-slate-500">
                {focusMode.isActive ? (
                  <span className="inline-flex items-center gap-1">
                    <TimerIcon className="h-3.5 w-3.5" />
                    {formatMs(remaining)} left
                  </span>
                ) : (
                  'Not active'
                )}
              </div>
            </div>
          </div>
          {focusMode.isActive ? (
            <button onClick={endFocus} className="px-3 py-1.5 text-xs font-semibold rounded-full bg-red-600 text-white hover:bg-red-700">
              End Session
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {[settings.focusDuration, 15, 45].map((d) => (
                <button key={d} onClick={() => startFocus(d)} className="px-3 py-1.5 text-xs font-semibold rounded-full bg-blue-600 text-white hover:bg-blue-700">
                  {d}m
                </button>
              ))}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  className="w-14 px-2 py-1 rounded-lg border border-slate-300 text-xs"
                  value={customDuration}
                  min={5}
                  max={180}
                  onChange={(e) => setCustomDuration(Number(e.target.value))}
                />
                <button onClick={() => startFocus(customDuration)} className="px-2 py-1.5 text-xs font-semibold rounded-lg bg-slate-700 text-white hover:bg-slate-800">
                  Start
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Current site actions */}
      <div className="bg-white dark:bg-slate-800 dark:border-slate-700 rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-100 rounded-lg"><Globe className="h-4 w-4 text-slate-700" /></div>
            <div>
              <div className="text-xs text-slate-500">Current site</div>
              <div className="text-sm font-semibold text-slate-800">{currentDomain || '—'}</div>
            </div>
          </div>
          <button onClick={queueCurrent} className="px-3 py-1.5 text-xs font-semibold rounded-full bg-amber-500 text-white hover:bg-amber-600">Queue</button>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-600">
            Mode: {settings.useAllowlistMode ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><Check className="h-3 w-3" /> Allow only listed</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-rose-700 font-semibold"><X className="h-3 w-3" /> Block listed</span>
            )}
          </div>
          <button onClick={toggleMode} className="px-3 py-1.5 text-xs font-semibold rounded-full bg-slate-600 text-white hover:bg-slate-700">
            Switch to {settings.useAllowlistMode ? 'Blocklist' : 'Allowlist'}
          </button>
        </div>
        <div className="mt-3">
          <button onClick={addCurrentToList} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
            <ListPlus className="h-3.5 w-3.5" />
            Add current site to {settings.useAllowlistMode ? 'allowlist' : 'blocklist'}
          </button>
        </div>
        {focusMode.isActive && (
          <div className="mt-2 text-[11px] text-slate-500">Changes apply immediately during active sessions.</div>
        )}
      </div>

      {/* Lists management */}
      <div className="bg-white dark:bg-slate-800 dark:border-slate-700 rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-bold text-slate-800">Manage Lists</div>
          <div className="text-[11px] text-slate-500">Add, edit, move between lists</div>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="text"
            placeholder="example.com"
            value={addValue}
            onChange={(e) => { setAddValue(e.target.value); setAddError(''); }}
            className={`flex-1 px-2 py-1 rounded-lg border text-xs ${addError ? 'border-rose-400' : 'border-slate-300'}`}
          />
          <button onClick={() => addDomain('blocklist')} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700">
            Add to Blocklist
          </button>
          <button onClick={() => addDomain('allowlist')} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
            Add to Allowlist
          </button>
        </div>
        {addError && <div className="text-[11px] text-rose-600 mb-2">{addError}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {renderList('blocklist', settings.blocklist)}
          {renderList('allowlist', settings.allowlist)}
        </div>
        {undo && (
          <div className="mt-3 text-[12px] flex items-center justify-between bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
            <span>Removed {undo.domain} from {undo.list}. </span>
            <button onClick={handleUndo} className="underline text-blue-700 hover:text-blue-900">Undo</button>
          </div>
        )}
      </div>

      {/* Queued sites */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="text-sm font-bold text-slate-800 mb-2">Queued Sites</div>
        {focusMode.queuedSites.length ? (
          <ul className="space-y-1 max-h-32 overflow-auto">
            {focusMode.queuedSites.map((u, i) => (
              <li key={`${u}-${i}`} className="text-xs text-slate-600 truncate">{u}</li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-slate-400">No sites queued yet</div>
        )}
      </div>

      {/* Import / Export */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-bold text-slate-800">Import / Export</div>
          <button onClick={() => setShowImportExport((v) => !v)} className="text-xs underline text-blue-700 hover:text-blue-900">
            {showImportExport ? 'Hide' : 'Show'}
          </button>
        </div>
        {showImportExport && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button onClick={exportData} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-700 text-white hover:bg-slate-800">
                {copied ? 'Copied JSON!' : 'Copy JSON'}
              </button>
              <span className="text-[11px] text-slate-500">Copy or download JSON snapshot of lists + notes</span>
            </div>
            <textarea
              value={importText}
              onChange={(e) => { setImportText(e.target.value); setImportError(''); }}
              placeholder='Paste JSON {"blocklist":[],"allowlist":[],"notes":{}} or newline-separated domains'
              className="w-full h-24 text-xs p-2 border border-slate-300 rounded-lg"
            />
            {importError && <div className="text-[11px] text-rose-600">{importError}</div>}
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-slate-500">Newline import goes to current mode list</div>
              <button onClick={importData} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700">Import</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  function formatMs(ms: number): string {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function renderList(listKey: 'allowlist'|'blocklist', items: string[]) {
    const isAllow = listKey === 'allowlist';
    return (
      <div className="border rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-2 h-2 rounded-full ${isAllow ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
          <div className="text-xs font-semibold text-slate-700">{isAllow ? 'Allowlist' : 'Blocklist'}</div>
        </div>
        <ul className="space-y-2 max-h-40 overflow-auto">
          {items.map((d, i) => (
            <li key={`${listKey}-${d}-${i}`} className="flex items-center gap-2">
              {editingIndex === i && editError && (
                <div className="text-[11px] text-rose-600 mb-1">{editError}</div>
              )}
              {editingIndex === i ? (
                <>
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => { setEditValue(e.target.value); setEditError(''); }}
                    className={`flex-1 px-2 py-1 rounded-lg border text-xs ${editError ? 'border-rose-400' : 'border-slate-300'}`}
                  />
                  <button onClick={() => saveEdit(i, listKey)} className="px-2 py-1 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700"><Check className="h-3.5 w-3.5" /></button>
                  <button onClick={cancelEdit} className="px-2 py-1 rounded-lg bg-slate-200 text-slate-700 text-xs hover:bg-slate-300"><X className="h-3.5 w-3.5" /></button>
                </>
              ) : (
                <>
                  <div className="flex-1 text-xs text-slate-700 truncate">{d}</div>
                  <button onClick={() => beginEdit(i, d)} className="px-2 py-1 rounded-lg bg-slate-600 text-white text-[11px] hover:bg-slate-700">Edit</button>
                  <button onClick={() => editNote(d)} className="px-2 py-1 rounded-lg bg-amber-600 text-white text-[11px] hover:bg-amber-700">Note</button>
                  <button onClick={() => moveDomain(d, listKey)} className="px-2 py-1 rounded-lg bg-indigo-600 text-white text-[11px] hover:bg-indigo-700 inline-flex items-center gap-1"><ArrowLeftRight className="h-3.5 w-3.5" />Move</button>
                  <button onClick={() => removeDomain(d, listKey)} className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[11px] hover:bg-rose-700">Remove</button>
                </>
              )}
            </li>
          ))}
          {!items.length && (
            <li className="text-[11px] text-slate-400">No sites yet</li>
          )}
        </ul>
        {noteEditingFor && (
          <div className="mt-3 border-t pt-2">
            <div className="text-[11px] text-slate-500 mb-1">Note for {noteEditingFor}</div>
            <div className="flex items-center gap-2">
              <input
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                placeholder="Why is this listed?"
                className="flex-1 px-2 py-1 rounded-lg border border-slate-300 text-xs"
              />
              <button onClick={() => saveNote(noteEditingFor)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700">Save</button>
              <button onClick={() => setNoteEditingFor(null)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300">Cancel</button>
              <button onClick={() => deleteNote(noteEditingFor)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700">Delete</button>
            </div>
          </div>
        )}
      </div>
    );
  }

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
};

export default FocusMode;
