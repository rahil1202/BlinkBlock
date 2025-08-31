/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Shield, Timer, AlertCircle } from 'lucide-react';

function FocusModeApp() {
  const [blockedDomain, setBlockedDomain] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    // Get blocked domain from URL params
    const params = new URLSearchParams(window.location.search);
    const domain = params.get('blocked');
    if (domain) {
      setBlockedDomain(decodeURIComponent(domain));
    }

    // Get focus mode status
    loadFocusMode();
    const interval = setInterval(loadFocusMode, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const apply = async () => {
      const { settings } = await chrome.storage.local.get('settings');
      const theme = settings?.theme || 'system';
      const mod = await import('../theme');
      mod.applyTheme(theme);
    };
    apply();

    const listener = (changes: any, area: string) => {
      if (area === 'local' && changes.settings) {
        const theme = changes.settings.newValue?.theme || 'system';
        import('../theme').then(({ applyTheme }) => applyTheme(theme));
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const loadFocusMode = async () => {
    const result = await chrome.storage.local.get('focusMode');
    const focusMode = result.focusMode;
    
    if (focusMode?.isActive && focusMode.endTime) {
      const remaining = Math.max(0, focusMode.endTime - Date.now());
      setTimeRemaining(remaining);
    }
  };

  const goBack = () => {
    window.history.back();
  };

  const queueForLater = async () => {
    await chrome.runtime.sendMessage({
      type: 'QUEUE_SITE',
      url: blockedDomain
    });
    
    // Show confirmation
    const button = document.getElementById('queue-button');
    if (button) {
      button.textContent = 'Queued!';
      setTimeout(() => {
        button.textContent = 'Queue for Later';
      }, 2000);
    }
  };

  const formatTimeRemaining = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 dark:bg-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white dark:bg-slate-800 dark:border-slate-700 rounded-3xl shadow-2xl border border-slate-200/50 overflow-hidden backdrop-blur-sm">
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 text-white p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-white/5 backdrop-blur-3xl"></div>
          <div className="relative z-10">
            <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm shadow-lg">
              <Shield className="h-10 w-10" />
            </div>
            <h1 className="text-2xl font-bold mb-2 tracking-tight">Focus Mode Active</h1>
            <p className="text-blue-100 text-sm font-medium">Protecting your productivity</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          {/* Blocked Site Info */}
          <div className="text-center">
            <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-5 mb-6 shadow-sm">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <h2 className="font-bold text-red-800">Site Blocked</h2>
              </div>
              <p className="text-red-700 font-semibold text-lg">{blockedDomain}</p>
              <p className="text-red-600 text-xs mt-1">This site is blocked during your focus session</p>
            </div>
            
            {timeRemaining > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <Timer className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-bold text-blue-800">Time Remaining</span>
                </div>
                <div className="text-3xl font-mono font-bold text-blue-700 mb-1 tracking-wider">
                  {formatTimeRemaining(timeRemaining)}
                </div>
                <p className="text-blue-600 text-xs font-medium">Stay focused, you're doing great!</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <button
              onClick={goBack}
              className="w-full bg-slate-600 hover:bg-slate-700 text-white px-4 py-4 rounded-xl font-bold transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
            >
              <div className="p-1 bg-white/20 rounded-lg">
                <ArrowLeft className="h-4 w-4" />
              </div>
              <span>Back to Work</span>
            </button>
            
            <button
              id="queue-button"
              onClick={queueForLater}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-4 py-4 rounded-xl font-bold transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
            >
              <div className="p-1 bg-white/20 rounded-lg">
                <Plus className="h-4 w-4" />
              </div>
              <span>Queue for Later</span>
            </button>
          </div>

          {/* Motivation */}
          <div className="text-center bg-gradient-to-r from-indigo-50 to-purple-50 p-5 rounded-2xl border border-indigo-200">
            <p className="text-slate-700 text-sm leading-relaxed font-medium">
              <span className="font-bold text-indigo-700">Stay strong!</span> Great things happen when you maintain focus. Your future self will thank you for this dedication.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FocusModeApp;
