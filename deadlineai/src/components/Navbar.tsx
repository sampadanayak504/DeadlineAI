import { Home, Calendar, Hourglass, LogOut, RefreshCw } from 'lucide-react';
import { UserProfile } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  profile: UserProfile | null;
  onLogout: () => void;
  syncing: boolean;
  onManualSync: () => void;
}

export default function Navbar({ activeTab, setActiveTab, profile, onLogout, syncing, onManualSync }: NavbarProps) {
  const tabs = [
    { id: 'home', label: 'Home', icon: <Home className="w-4 h-4" /> },
    { id: 'planner', label: 'Planner', icon: <Calendar className="w-4 h-4" /> },
    { id: 'assistant', label: 'AI Assistant', icon: <Hourglass className="w-4 h-4" /> },
  ];

  return (
    <nav className="border-b border-slate-800 bg-[#16191F] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between h-16 items-center">
          {/* Logo Brand */}
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white shadow-lg shadow-indigo-500/20">
              <Hourglass className="w-5 h-5 shrink-0" />
            </div>
            <span className="font-display font-bold text-base tracking-wide bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
              DeadlineAI
            </span>
          </div>

          {/* Center Tabs Links */}
          <div className="hidden lg:flex items-center gap-1 bg-[#0F1115] p-1 rounded-xl border border-slate-800">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-tight transition ${
                    active
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Right Profile & Syncer */}
          <div className="flex items-center gap-3">
            {/* Syncing Indicator */}
            <button
              onClick={onManualSync}
              className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 transition flex items-center gap-1.5 group font-mono text-[10px]"
              title="Sync Schedule Blocks is Live"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-emerald-400' : 'group-hover:rotate-45'}`} />
              <span className="hidden sm:inline">Replan</span>
            </button>

            {/* Profile Frame */}
            {profile && (
              <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
                <img
                  referrerPolicy="no-referrer"
                  src={profile.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.name}`}
                  alt={profile.name}
                  className="w-8 h-8 rounded-full border border-slate-700 object-cover"
                />
                <div className="hidden md:block">
                  <div className="text-xs font-semibold text-slate-200">{profile.name}</div>
                  <div className="text-[9px] font-mono text-emerald-400">Streak: {profile.streak}d</div>
                </div>
              </div>
            )}

            {/* Sign Out */}
            <button
              onClick={onLogout}
              className="p-2 text-slate-500 hover:text-rose-400 rounded-lg transition hover:bg-slate-900/60"
              title="Log Out From Space"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Small Navigation bar bottom header slider */}
        <div className="lg:hidden flex items-center justify-around py-2 border-t border-slate-800">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center p-1.5 rounded-lg text-[9px] font-medium transition ${
                  active ? 'text-indigo-400' : 'text-slate-400'
                }`}
              >
                {tab.icon}
                <span className="mt-0.5">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
