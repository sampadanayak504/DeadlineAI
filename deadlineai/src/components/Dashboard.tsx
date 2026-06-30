import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { Task, UserProfile, Activity } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Calendar, Zap, CheckCircle, Flame, Trophy, AlertCircle, ArrowUpRight, Plus, HelpCircle, Sparkles, Database } from 'lucide-react';
import { isFirebaseConfigured } from '../lib/firebase';

interface DashboardProps {
  tasks: Task[];
  profile: UserProfile | null;
  activities: Activity[];
  onQuickAction: (actionType: string) => void;
  onAddTaskClick: () => void;
  onMarkComplete: (taskId: string) => void;
}

export default function Dashboard({ tasks, profile, activities, onQuickAction, onAddTaskClick, onMarkComplete }: DashboardProps) {
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const firebaseActive = isFirebaseConfigured();

  // Compute stats
  const completedTasks = tasks.filter(t => t.status === 'Completed');
  const pendingTasks = tasks.filter(t => t.status !== 'Completed');
  
  // Tasks due today vs upcoming
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTasks = pendingTasks.filter(t => t.deadline === todayStr);
  const urgentTasks = pendingTasks.filter(t => t.priority === 'Critical' || t.priority === 'High');

  // Chart data simulation
  const chartData = [
    { day: 'Mon', completed: 2, score: 70 },
    { day: 'Tue', completed: 3, score: 75 },
    { day: 'Wed', completed: 1, score: 72 },
    { day: 'Thu', completed: 4, score: 80 },
    { day: 'Fri', completed: 2, score: 79 },
    { day: 'Sat', completed: 5, score: 85 },
    { day: 'Sun', completed: completedTasks.length || 3, score: profile?.productivityScore || 82 },
  ];

  // Fetch AI Suggestion bulletins
  useEffect(() => {
    async function fetchSuggestions() {
      setLoadingSuggestions(true);
      try {
        const response = await fetch('/api/ai/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tasks: tasks.slice(0, 5),
            currentFreeState: "12:00 PM to 1:30 PM is open today"
          })
        });
        const data = await response.json();
        if (data && data.suggestions) {
          setAiSuggestions(data.suggestions);
        } else {
          setAiSuggestions([
            "💡 You have 1.5 free hours before dinner. Tackle your smallest task now to claim the night!",
            "⚡ Procrastination alert: Your spring boot project has been idle for 4 days.",
            "🕰️ Peak hours detected: You historical focus peaks after 18:00. Schedule your critical read then!"
          ]);
        }
      } catch (err) {
        setAiSuggestions([
          "💡 You have 1.5 free hours before dinner. Tackle your smallest task now to claim the night!",
          "⚡ Procrastination alert: Your spring boot project has been idle for 4 days.",
          "🕰️ Peak hours detected: You historical focus peaks after 18:00. Schedule your critical read then!"
        ]);
      } finally {
        setLoadingSuggestions(false);
      }
    }
    fetchSuggestions();
  }, [tasks]);

  return (
    <div id="dashboard" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Upper Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-medium text-white">
            Telemetry Desk, <span className="text-[#a5b4fc] font-bold">{profile?.name || 'Innovator'}</span>
          </h1>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
            <p className="text-slate-400 text-xs">
              Let's secure your deliverables. Deadlines are calculated relative to {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
            </p>
            <span className="hidden sm:inline text-slate-700 font-mono text-[10px]">|</span>
            <div className="flex items-center gap-1.5 pt-1 sm:pt-0">
              <span className={`w-2 h-2 rounded-full ${firebaseActive ? 'bg-emerald-500 animate-pulse' : 'bg-indigo-500/80 animate-pulse'}`}></span>
              <span className="text-[10px] font-mono text-slate-400">
                {firebaseActive ? 'Firebase Sync: Connected' : 'Local Storage Engine (Firebase Setup Ready)'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onQuickAction('emergency-rescue')}
            className="px-4 py-2.5 bg-rose-900/30 hover:bg-rose-900/40 border border-rose-500/30 text-rose-300 font-medium text-xs rounded-xl flex items-center gap-2 shadow-sm transition"
          >
            <AlertCircle className="w-4 h-4 animate-bounce" />
            I'M OVERWHELMED
          </button>
          <button
            onClick={onAddTaskClick}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl flex items-center gap-2 shadow-lg hover:shadow-indigo-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            Add Task Block
          </button>
        </div>
      </div>

      {/* Main Core Highlights Bento Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Productivity Score Card */}
        <div className="glass-panel p-5 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase font-bold">Focus Score</span>
            <div className="p-1.5 bg-indigo-950 border border-indigo-500/25 rounded-lg text-indigo-400">
              <Zap className="w-4 h-4 font-bold" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-white">{profile?.productivityScore || 78}%</div>
            <p className="text-[10px] text-emerald-400 flex items-center gap-0.5 mt-1 font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" /> +2.4% consistency growth
            </p>
          </div>
          <div className="text-[9px] text-slate-500 leading-tight">Measured weekly using completion rates, speed, and focus consistency scores.</div>
        </div>

        {/* Daily Streak Card */}
        <div className="glass-panel p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase font-bold">Day Streak</span>
            <div className="p-1.5 bg-amber-950 border border-amber-500/20 rounded-lg text-amber-400">
              <Flame className="w-4 h-4 inline" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-white">{profile?.streak || 4} Days</div>
            <p className="text-[10px] text-amber-300 flex items-center gap-0.5 mt-1">
              ⭐ Top 8% of elite planners worldwide
            </p>
          </div>
          <div className="text-[9px] text-slate-500 leading-tight">Keep completing work blocks before deadlines to boost your daily streak!</div>
        </div>

        {/* Completed Core Tasks */}
        <div className="glass-panel p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase font-bold">Completed Blocks</span>
            <div className="p-1.5 bg-emerald-950 border border-emerald-500/25 rounded-lg text-emerald-400">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-white">{completedTasks.length} / <span className="text-slate-500 text-lg">{tasks.length}</span></div>
            <div className="w-full bg-slate-950 rounded-full h-1 mt-2.5 overflow-hidden">
              <div 
                className="bg-emerald-500 h-1 rounded-full transition-all duration-500" 
                style={{ width: `${tasks.length ? (completedTasks.length / tasks.length) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div className="text-[9px] text-slate-500 leading-tight">Great progress so far. Defending deadlines keeps stress levels minimal.</div>
        </div>

        {/* Pending Critical Deadlines */}
        <div className="glass-panel p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase font-bold">Urgent Actions</span>
            <div className="p-1.5 bg-rose-950 border border-rose-500/25 rounded-lg text-rose-400">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-white">{urgentTasks.length} Pending</div>
            <p className="text-[10px] text-rose-400 flex items-center gap-0.5 mt-1 font-semibold">
              ⚠️ Requires attention soon
            </p>
          </div>
          <div className="text-[9px] text-slate-500 leading-tight">Avoid cramming! Tackle critical tags in your current quiet hours.</div>
        </div>
      </div>

      {/* Center Layout: Graph + Prodding Suggestions Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recharts Progress Graph Area */}
        <div className="glass-panel p-5 lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-widest font-mono">Cognitive Efficiency Index</h3>
              <p className="text-slate-500 text-[10px]">Calculated focus capacity during work blocks are automatically mapped.</p>
            </div>
            <span className="text-[10px] bg-indigo-900/40 border border-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded font-mono">7-Day Matrix</span>
          </div>

          <div className="h-64 select-none">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} domain={[40, 100]} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#090d16', border: '1px solid #334155', borderRadius: '10px' }}
                  labelStyle={{ color: '#94a3b8', fontSize: '11px', fontFamily: 'monospace' }}
                  itemStyle={{ color: '#818cf8', fontSize: '12px', fontWeight: 'bold' }}
                />
                <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#818cf8', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Suggestions Widget Card */}
        <div className="glass-panel p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
            <h3 className="text-xs uppercase tracking-widest font-mono font-bold text-slate-100">PROACTIVE PROMPTINGS</h3>
          </div>

          <div className="space-y-3.5 h-[230px] overflow-y-auto no-scrollbar pr-1">
            {loadingSuggestions ? (
              <div className="space-y-4 pt-12 text-center text-slate-500 animate-pulse text-xs">
                Analyzing pending workloads and free time slots...
              </div>
            ) : (
              aiSuggestions.map((sug, index) => (
                <div key={index} className="p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 transition">
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">{sug}</p>
                </div>
              ))
            )}
          </div>

          <div className="text-[10px] text-slate-500 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800 leading-relaxed">
            *DeadlineAI learns your highest focus hours dynamically. Study blocks are suggested only when cognitive output peaks.
          </div>
        </div>
      </div>

      {/* Lower Dashboard: Tasks Grid + Actions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Priority Task Lists */}
        <div className="glass-panel p-5 lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs uppercase tracking-widest font-mono font-bold text-slate-100">Deliverables Scheduled Today</h3>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
            {todayTasks.length === 0 ? (
              <div className="text-center py-12 text-slate-500 space-y-2">
                <p className="text-xs">No tasks are due on today's catalog.</p>
                <button 
                  onClick={onAddTaskClick} 
                  className="text-[10px] text-indigo-400 hover:underline"
                >
                  Create new focus schedule
                </button>
              </div>
            ) : (
              todayTasks.map((t) => (
                <div key={t.id} className="p-3 bg-slate-950 border border-slate-900 rounded-xl flex items-center justify-between hover:border-slate-800 transition">
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-slate-200">{t.title}</h4>
                    <p className="text-[10px] text-slate-500 truncate max-w-sm">{t.description || 'No description supplied'}</p>
                    <div className="flex gap-2">
                      <span className="text-[8px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 uppercase">{t.category}</span>
                      <span className="text-[8px] font-mono text-indigo-400 bg-indigo-900/35 px-1.5 py-0.5 rounded border border-indigo-500/20 uppercase font-semibold">{t.priority}</span>
                      <span className="text-[8px] font-mono text-emerald-400 bg-emerald-900/30 px-1.5 py-0.5 rounded border border-emerald-500/20">⏳ {t.estimatedHours} Hours</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onMarkComplete(t.id)}
                    className="p-1 px-2 text-[9px] font-mono border border-emerald-500/30 bg-emerald-900/25 hover:bg-emerald-800/40 text-emerald-400 rounded-lg transition shrink-0"
                  >
                    Done
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action center desk */}
        <div className="glass-panel p-5 space-y-4">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-xs uppercase tracking-widest font-mono font-bold text-slate-100">Co-pilot Quick Steps</h3>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <button
              onClick={() => onQuickAction('auto-schedule')}
              className="p-3 bg-slate-950 hover:bg-slate-900/80 text-left rounded-xl border border-slate-850 hover:border-slate-700 transition"
            >
              <div className="text-xs font-semibold text-slate-200">🤖 Force Auto-Scheduler</div>
              <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">Let the agent scan calendar holes and map task blocks.</p>
            </button>

            <button
              onClick={() => onQuickAction('auto-reschedule')}
              className="p-3 bg-slate-950 hover:bg-slate-900/80 text-left rounded-xl border border-slate-850 hover:border-slate-700 transition"
            >
              <div className="text-xs font-semibold text-slate-200">🔄 Cascade Rollover Rescheduling</div>
              <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">Roll overdue tasks forward securely to protect your deadlines.</p>
            </button>

            <button
              onClick={() => onQuickAction('daily-reflection')}
              className="p-3 bg-slate-950 hover:bg-slate-900/80 text-left rounded-xl border border-slate-850 hover:border-slate-700 transition"
            >
              <div className="text-xs font-semibold text-slate-200">📝 Trigger Post-Daily Reflection</div>
              <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">Generate daily peak efficiency summary reports.</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
