import { Clock, Globe, TrendingUp, Eye, Award, Timer } from 'lucide-react';

interface DayStats {
  totalFocusTime: number;
  breaksTaken: number;
  domains: { [domain: string]: number };
  focusSessions: number;
}

interface Settings {
  reminderInterval: number;
  trackingEnabled: boolean;
}

interface DashboardProps {
  stats: DayStats;
  settings: Settings;
}

function Dashboard({ stats, settings }: DashboardProps) {
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getTopDomains = () => {
    return Object.entries(stats.domains)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([domain, seconds]) => ({
        domain,
        time: formatTime(seconds),
        percentage: Math.round((seconds / stats.totalFocusTime) * 100) || 0
      }));
  };

  const topDomains = getTopDomains();

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-900">
      <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
        {/* Quick Stats Header */}
        <div className="text-center pb-2">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">Today's Progress</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track your focus and eye health</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-xl border border-purple-200/50 dark:border-purple-700/50 shadow-sm">
            <div className="flex items-center space-x-2 mb-2">
              <div className="p-1.5 bg-purple-600 dark:bg-purple-500 rounded-lg">
                <Clock className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-xs font-semibold text-purple-900 dark:text-purple-200 uppercase tracking-wide">Focus Time</span>
            </div>
            <div className="text-xl font-bold text-purple-800 dark:text-purple-200 leading-tight">
              {formatTime(stats.totalFocusTime)}
            </div>
            <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">Total today</div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-800/20 p-4 rounded-xl border border-emerald-200/50 dark:border-emerald-700/50 shadow-sm">
            <div className="flex items-center space-x-2 mb-2">
              <div className="p-1.5 bg-emerald-600 dark:bg-emerald-500 rounded-lg">
                <Eye className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 uppercase tracking-wide">Eye Breaks</span>
            </div>
            <div className="text-xl font-bold text-emerald-800 dark:text-emerald-200 leading-tight">
              {stats.breaksTaken}
            </div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">20-20-20 breaks</div>
          </div>

          <div className="bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-900/20 dark:to-violet-800/20 p-4 rounded-xl border border-violet-200/50 dark:border-violet-700/50 shadow-sm">
            <div className="flex items-center space-x-2 mb-2">
              <div className="p-1.5 bg-violet-600 dark:bg-violet-500 rounded-lg">
                <Award className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-xs font-semibold text-violet-900 dark:text-violet-200 uppercase tracking-wide">Sessions</span>
            </div>
            <div className="text-xl font-bold text-violet-800 dark:text-violet-200 leading-tight">
              {stats.focusSessions}
            </div>
            <div className="text-xs text-violet-600 dark:text-violet-400 mt-1">Completed</div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/20 p-4 rounded-xl border border-amber-200/50 dark:border-amber-700/50 shadow-sm">
            <div className="flex items-center space-x-2 mb-2">
              <div className="p-1.5 bg-amber-600 dark:bg-amber-500 rounded-lg">
                <Timer className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-xs font-semibold text-amber-900 dark:text-amber-200 uppercase tracking-wide">Interval</span>
            </div>
            <div className="text-xl font-bold text-amber-800 dark:text-amber-200 leading-tight">
              {settings.reminderInterval}m
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">Reminder</div>
          </div>
        </div>

        {/* Website Usage */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-600 dark:bg-purple-500 rounded-lg">
                <Globe className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Website Activity</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Your most visited sites today</p>
              </div>
            </div>
          </div>
          
          <div className="p-4">
            {topDomains.length > 0 ? (
              <div className="space-y-3">
                {topDomains.map(({ domain, time, percentage }) => (
                  <div key={domain} className="group hover:bg-slate-50 dark:hover:bg-slate-700/50 p-2 rounded-lg transition-colors duration-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate flex-1">
                        {domain}
                      </div>
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-3">
                        {time}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-slate-200 dark:bg-slate-600 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 min-w-[35px] text-right">{percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full w-fit mx-auto mb-3">
                  <Globe className="h-6 w-6 text-slate-400 dark:text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">No activity yet</p>
                <p className="text-xs text-slate-400 dark:text-slate-400">Start browsing to see your website statistics</p>
              </div>
            )}
          </div>
        </div>

        {/* Daily Progress */}
        <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 dark:from-purple-900/20 dark:via-indigo-900/20 dark:to-purple-900/20 p-4 rounded-xl border border-purple-200/50 dark:border-purple-700/50 shadow-sm">
          <div className="flex items-center space-x-2 mb-3">
            <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <h3 className="text-sm font-bold text-purple-900 dark:text-purple-200">Daily Insights</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-white/60 dark:bg-white/10 p-3 rounded-lg backdrop-blur-sm">
              <div className="text-purple-600 dark:text-purple-400 font-semibold mb-1">Next Reminder</div>
              <div className="text-purple-800 dark:text-purple-200 font-bold">{settings.reminderInterval} min</div>
            </div>
            <div className="bg-white/60 dark:bg-white/10 p-3 rounded-lg backdrop-blur-sm">
              <div className="text-purple-600 dark:text-purple-400 font-semibold mb-1">Avg Session</div>
              <div className="text-purple-800 dark:text-purple-200 font-bold">
                {stats.focusSessions > 0 
                  ? formatTime(Math.round(stats.totalFocusTime / stats.focusSessions))
                  : '0m'
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
