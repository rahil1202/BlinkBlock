import { Clock,  Globe, TrendingUp, Eye, Award, Timer } from 'lucide-react';

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
    <div className="p-5 space-y-5">
      {/* Quick Stats Header */}
      <div className="text-center pb-2">
        <h2 className="text-lg font-bold text-slate-800 mb-1">Today's Progress</h2>
        <p className="text-sm text-slate-500">Track your focus and eye health</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-slate-800 dark:to-slate-700 p-4 rounded-xl border border-blue-200/50 dark:border-slate-700 shadow-sm">
          <div className="flex items-center space-x-2 mb-2">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <Clock className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-xs font-semibold text-blue-900 uppercase tracking-wide">Focus Time</span>
          </div>
          <div className="text-xl font-bold text-blue-800 leading-tight">
            {formatTime(stats.totalFocusTime)}
          </div>
          <div className="text-xs text-blue-600 mt-1">Total today</div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-slate-800 dark:to-slate-700 p-4 rounded-xl border border-emerald-200/50 dark:border-slate-700 shadow-sm">
          <div className="flex items-center space-x-2 mb-2">
            <div className="p-1.5 bg-emerald-600 rounded-lg">
              <Eye className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-xs font-semibold text-emerald-900 uppercase tracking-wide">Eye Breaks</span>
          </div>
          <div className="text-xl font-bold text-emerald-800 leading-tight">
            {stats.breaksTaken}
          </div>
          <div className="text-xs text-emerald-600 mt-1">20-20-20 breaks</div>
        </div>

        <div className="bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-slate-800 dark:to-slate-700 p-4 rounded-xl border border-violet-200/50 dark:border-slate-700 shadow-sm">
          <div className="flex items-center space-x-2 mb-2">
            <div className="p-1.5 bg-violet-600 rounded-lg">
              <Award className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-xs font-semibold text-violet-900 uppercase tracking-wide">Sessions</span>
          </div>
          <div className="text-xl font-bold text-violet-800 leading-tight">
            {stats.focusSessions}
          </div>
          <div className="text-xs text-violet-600 mt-1">Completed</div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-slate-800 dark:to-slate-700 p-4 rounded-xl border border-amber-200/50 dark:border-slate-700 shadow-sm">
          <div className="flex items-center space-x-2 mb-2">
            <div className="p-1.5 bg-amber-600 rounded-lg">
              <Timer className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-xs font-semibold text-amber-900 uppercase tracking-wide">Interval</span>
          </div>
          <div className="text-xl font-bold text-amber-800 leading-tight">
            {settings.reminderInterval}m
          </div>
          <div className="text-xs text-amber-600 mt-1">Reminder</div>
        </div>
      </div>

      {/* Website Usage */}
      <div className="bg-white dark:bg-slate-800 dark:border-slate-700 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-600 rounded-lg">
              <Globe className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Website Activity</h3>
              <p className="text-xs text-slate-500">Your most visited sites today</p>
            </div>
          </div>
        </div>
        
        <div className="p-4">
          {topDomains.length > 0 ? (
            <div className="space-y-3">
              {topDomains.map(({ domain, time, percentage }) => (
                <div key={domain} className="group hover:bg-slate-50 p-2 rounded-lg transition-colors duration-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-slate-800 truncate flex-1">
                      {domain}
                    </div>
                    <div className="text-sm font-bold text-slate-700 ml-3">
                      {time}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-semibold text-slate-500 min-w-[35px] text-right">{percentage}%</span>
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
      <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-800 dark:via-slate-800 dark:to-slate-800 p-4 rounded-xl border border-indigo-200/50 dark:border-slate-700 shadow-sm">
        <div className="flex items-center space-x-2 mb-3">
          <TrendingUp className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-300">Daily Insights</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-white/60 dark:bg-white/10 p-3 rounded-lg backdrop-blur-sm">
            <div className="text-indigo-600 font-semibold mb-1">Next Reminder</div>
            <div className="text-indigo-800 dark:text-indigo-200 font-bold">{settings.reminderInterval} min</div>
          </div>
          <div className="bg-white/60 dark:bg-white/10 p-3 rounded-lg backdrop-blur-sm">
            <div className="text-indigo-600 font-semibold mb-1">Avg Session</div>
            <div className="text-indigo-800 dark:text-indigo-200 font-bold">
              {stats.focusSessions > 0 
                ? formatTime(Math.round(stats.totalFocusTime / stats.focusSessions))
                : '0m'
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
  