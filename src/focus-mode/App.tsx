/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Plus, Shield, Timer, AlertCircle, Sparkles } from 'lucide-react';

function FocusModeApp() {
  const [blockedDomain, setBlockedDomain] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [currentMotivation, setCurrentMotivation] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [focusSession, setFocusSession] = useState<{
    isActive: boolean;
    startTime: number;
    endTime: number;
    duration: number;
  } | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const motivationTimerRef = useRef<NodeJS.Timeout | null>(null);

  const motivationalQuotes = [
    "Stay strong! Great things happen when you maintain focus. Your future self will thank you for this dedication.",
    "Every moment of focus is an investment in your dreams. Keep building your success story.",
    "Discipline is choosing between what you want now and what you want most. You're choosing wisely!",
    "Your willpower is like a muscle - every resistance makes it stronger. You're getting stronger right now!",
    "Focus is the bridge between goals and achievement. You're crossing that bridge with every focused minute.",
    "The magic happens outside your comfort zone. This focused work is where growth begins.",
    "Success isn't just about talent, it's about consistency. You're building that consistency right now.",
    "Every distraction you resist is a step closer to your goals. You're making progress!",
    "Champions are made in moments like these - when nobody is watching but you keep going anyway.",
    "Your dedication today creates the opportunities of tomorrow. Keep investing in yourself!",
    "Focus is your superpower. Use it wisely, and watch amazing things unfold in your life.",
    "The difference between ordinary and extraordinary is that little 'extra' focus you're showing right now.",
    "You're not just avoiding distractions - you're actively choosing your future. Choose greatness!",
    "Every focused session rewires your brain for success. You're literally upgrading yourself!",
    "The pain of discipline weighs ounces, but regret weighs tons. You're choosing the lighter path.",
    "Your focused work today is tomorrow's breakthrough. Keep planting seeds of success!",
    "Concentration is the secret of strength. You're building incredible mental strength right now."
  ];

  // Load focus mode data from Chrome storage
  const loadFocusMode = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await chrome.storage.local.get('focusMode');
      const focusMode = result.focusMode;
      
      if (focusMode?.isActive && focusMode.endTime) {
        const currentTime = Date.now();
        const remaining = Math.max(0, focusMode.endTime - currentTime);
        
        setFocusSession({
          isActive: focusMode.isActive,
          startTime: focusMode.startTime || (focusMode.endTime - (focusMode.duration || 1800000)),
          endTime: focusMode.endTime,
          duration: focusMode.duration || 1800000
        });
        
        setTimeRemaining(remaining);
        
        // If time has expired, update storage
        if (remaining <= 0) {
          await chrome.storage.local.set({
            focusMode: { ...focusMode, isActive: false }
          });
        }
      } else {
        setFocusSession(null);
        setTimeRemaining(0);
      }
    } catch (error) {
      console.error('Error loading focus mode:', error);
      // Fallback for demo/testing
      setTimeRemaining(1800000); // 30 minutes
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update timer every second
  const updateTimer = useCallback(() => {
    if (!focusSession?.isActive || !focusSession.endTime) return;
    
    const currentTime = Date.now();
    const remaining = Math.max(0, focusSession.endTime - currentTime);
    
    setTimeRemaining(remaining);
    
    // If timer reached zero, deactivate focus mode
    if (remaining <= 0) {
      chrome.storage.local.set({
        focusMode: { ...focusSession, isActive: false }
      }).catch(console.error);
      
      setFocusSession(prev => prev ? { ...prev, isActive: false } : null);
    }
  }, [focusSession]);

  // Get random motivation quote
  const getRandomMotivation = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * motivationalQuotes.length);
    return motivationalQuotes[randomIndex];
  }, [motivationalQuotes]);

  // Initialize motivation
  useEffect(() => {
    setCurrentMotivation(getRandomMotivation());
  }, [getRandomMotivation]);

  // Set up motivation rotation timer
  useEffect(() => {
    motivationTimerRef.current = setInterval(() => {
      setCurrentMotivation(getRandomMotivation());
    }, 60000); // Change every 60 seconds

    return () => {
      if (motivationTimerRef.current) {
        clearInterval(motivationTimerRef.current);
      }
    };
  }, [getRandomMotivation]);

  // Load initial data and set up URL parameters
  useEffect(() => {
    const initialize = async () => {
      // Get blocked domain from URL params
      const params = new URLSearchParams(window.location.search);
      const domain = params.get('blocked');
      if (domain) {
        setBlockedDomain(decodeURIComponent(domain));
      }
      
      // Load focus mode data
      await loadFocusMode();
    };
    
    initialize();
  }, [loadFocusMode]);

  // Set up live timer
  useEffect(() => {
    if (focusSession?.isActive && timeRemaining > 0) {
      timerRef.current = setInterval(updateTimer, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [focusSession?.isActive, timeRemaining, updateTimer]);

  // Listen for storage changes
  useEffect(() => {
    const handleStorageChange = (changes: any, area: string) => {
      if (area === 'local' && changes.focusMode) {
        loadFocusMode();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [loadFocusMode]);

  // Apply theme
  useEffect(() => {
    const applyTheme = async () => {
      try {
        const { settings } = await chrome.storage.local.get('settings');
        const theme = settings?.theme || 'system';
        const mod = await import('../theme');
        mod.applyTheme(theme);
      } catch (error) {
        console.error('Error applying theme:', error);
      }
    };

    applyTheme();

    const listener = (changes: any, area: string) => {
      if (area === 'local' && changes.settings) {
        const theme = changes.settings.newValue?.theme || 'system';
        import('../theme').then(({ applyTheme }) => applyTheme(theme));
      }
    };
    
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const goBack = () => {
    window.history.back();
  };

  const queueForLater = async () => {
    try {
      // Get existing queue
      const result = await chrome.storage.local.get('queuedSites');
      const queuedSites = result.queuedSites || [];
      
      // Add current site if not already queued
      if (blockedDomain && !queuedSites.includes(blockedDomain)) {
        queuedSites.push(blockedDomain);
        await chrome.storage.local.set({ queuedSites });
      }
      
      // Show confirmation
      const button = document.getElementById('queue-button');
      if (button) {
        const originalText = button.textContent;
        button.textContent = '✓ Queued!';
        button.classList.add('bg-green-600', 'hover:bg-green-700');
        button.classList.remove('bg-gradient-to-r', 'from-amber-500', 'to-orange-600', 'hover:from-amber-600', 'hover:to-orange-700');
        
        setTimeout(() => {
          button.textContent = originalText;
          button.classList.remove('bg-green-600', 'hover:bg-green-700');
          button.classList.add('bg-gradient-to-r', 'from-amber-500', 'to-orange-600', 'hover:from-amber-600', 'hover:to-orange-700');
        }, 2000);
      }
    } catch (error) {
      console.error('Error queueing site:', error);
    }
  };

  const formatTimeRemaining = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getNewMotivation = () => {
    setCurrentMotivation(getRandomMotivation());
  };

  // Calculate progress metrics
  const getProgressMetrics = () => {
    if (!focusSession) return { minutesFocused: 0, percentComplete: 0 };
    
    const totalDuration = focusSession.duration;
    const elapsed = totalDuration - timeRemaining;
    const minutesFocused = Math.floor(elapsed / 60000);
    const percentComplete = Math.floor((elapsed / totalDuration) * 100);
    
    return { minutesFocused: Math.max(0, minutesFocused), percentComplete: Math.max(0, percentComplete) };
  };

  const { minutesFocused, percentComplete } = getProgressMetrics();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p>Loading focus session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '4s'}}></div>
      </div>

      <div className="max-w-lg w-full bg-slate-800/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-700/50 overflow-hidden relative z-10">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent"></div>
          <div className="relative z-10">
            <div className="w-24 h-24 bg-white/15 backdrop-blur-sm rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl border border-white/20">
              <Shield className="h-12 w-12 text-white drop-shadow-lg" />
            </div>
            <h1 className="text-3xl font-bold mb-2 tracking-tight drop-shadow-sm">Focus Mode Active</h1>
            <p className="text-purple-100 text-sm font-medium opacity-90">Deep work session in progress</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Blocked Site Info */}
          <div className="text-center space-y-4">
            <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex items-center justify-center space-x-3 mb-3">
                <div className="p-2 bg-red-500/20 rounded-full">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <h2 className="font-bold text-red-300 text-lg">Site Blocked</h2>
              </div>
              <p className="text-red-200 font-semibold text-xl mb-1">{blockedDomain || 'Distracting Website'}</p>
              <p className="text-red-300/80 text-sm">Access restricted during focus session</p>
            </div>
            
            {focusSession?.isActive && timeRemaining > 0 && (
              <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-center justify-center space-x-3 mb-3">
                  <div className="p-2 bg-blue-500/20 rounded-full">
                    <Timer className="h-5 w-5 text-blue-400 animate-pulse" />
                  </div>
                  <span className="text-lg font-bold text-blue-300">Time Remaining</span>
                </div>
                <div className="text-4xl font-mono font-bold text-blue-200 mb-2 tracking-wider drop-shadow-sm">
                  {formatTimeRemaining(timeRemaining)}
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2 mb-3">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-1000"
                    style={{width: `${Math.max(5, (timeRemaining / (focusSession?.duration || 1800000)) * 100)}%`}}
                  ></div>
                </div>
                <p className="text-blue-300/80 text-sm font-medium">Stay focused, you're crushing it! 🎯</p>
              </div>
            )}

            {(!focusSession?.isActive || timeRemaining <= 0) && (
              <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-center justify-center space-x-3 mb-3">
                  <div className="p-2 bg-green-500/20 rounded-full">
                    <Shield className="h-5 w-5 text-green-400" />
                  </div>
                  <span className="text-lg font-bold text-green-300">Focus Session Complete!</span>
                </div>
                <p className="text-green-300/80 text-sm font-medium">Congratulations on your focused work! 🎉</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <button
              onClick={goBack}
              className="w-full bg-slate-700/80 hover:bg-slate-600/80 backdrop-blur-sm text-white px-6 py-4 rounded-2xl font-bold transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02] border border-slate-600/50"
            >
              <div className="p-2 bg-white/10 rounded-xl">
                <ArrowLeft className="h-5 w-5" />
              </div>
              <span className="text-lg">Back to Work</span>
            </button>
            
            <button
              id="queue-button"
              onClick={queueForLater}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white px-6 py-4 rounded-2xl font-bold transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
            >
              <div className="p-2 bg-white/20 rounded-xl">
                <Plus className="h-5 w-5" />
              </div>
              <span className="text-lg">Queue for Later</span>
            </button>
          </div>

          {/* Dynamic Motivation */}
          <div className="text-center bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-6 rounded-2xl border border-indigo-500/20 backdrop-blur-sm relative">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Sparkles className="h-5 w-5 text-yellow-400 animate-pulse" />
              <span className="text-sm font-bold text-indigo-300 uppercase tracking-wide">Daily Motivation</span>
              <Sparkles className="h-5 w-5 text-yellow-400 animate-pulse" />
            </div>
            <p className="text-slate-200 text-base leading-relaxed font-medium mb-4 min-h-[3rem]">
              {currentMotivation}
            </p>
            <button
              onClick={getNewMotivation}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors underline-offset-2 hover:underline"
            >
              Get New Inspiration →
            </button>
          </div>

          {/* Progress Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-700/50 p-4 rounded-xl text-center backdrop-blur-sm border border-slate-600/30">
              <div className="text-2xl font-bold text-emerald-400 mb-1">
                {minutesFocused}
              </div>
              <div className="text-xs text-slate-400 uppercase tracking-wide">Minutes Focused</div>
            </div>
            <div className="bg-slate-700/50 p-4 rounded-xl text-center backdrop-blur-sm border border-slate-600/30">
              <div className="text-2xl font-bold text-purple-400 mb-1">
                {percentComplete}%
              </div>
              <div className="text-xs text-slate-400 uppercase tracking-wide">Session Complete</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FocusModeApp;
