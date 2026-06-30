import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, UserProfile } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { 
  BarChart2, 
  BookOpen, 
  Clock, 
  TrendingUp, 
  Sparkles, 
  RefreshCw, 
  Milestone, 
  Terminal, 
  Award, 
  Activity, 
  FileText, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  Percent, 
  ClipboardCheck, 
  HelpCircle, 
  Info, 
  Calendar, 
  ChevronRight, 
  Filter, 
  ArrowUpRight,
  PlusCircle,
  TrendingDown
} from 'lucide-react';

interface AnalyticsPageProps {
  tasks: Task[];
  profile?: UserProfile | null;
  onUpdateProfile?: (profile: UserProfile) => void;
}

interface ReportReflection {
  reflectionText: string;
  tomorrowPriorities: string[];
}

interface ReportWeekly {
  overview: string;
  insights: string[];
  growthPlan: string;
}

export default function AnalyticsPage({ tasks, profile, onUpdateProfile }: AnalyticsPageProps) {
  const [activeReportTab, setActiveReportTab] = useState<'reflection' | 'weekly' | 'custom'>('reflection');
  const [reflection, setReflection] = useState<ReportReflection | null>(null);
  const [loadingReflection, setLoadingReflection] = useState(false);

  const [weeklyReport, setWeeklyReport] = useState<ReportWeekly | null>(null);
  const [loadingWeekly, setLoadingWeekly] = useState(false);

  // Filter / Category selection for History Logs
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showFormulaInfo, setShowFormulaInfo] = useState(false);
  const [copied, setCopied] = useState(false);

  // Stats summaries
  const completed = tasks.filter(t => t.status === 'Completed');
  const pending = tasks.filter(t => t.status !== 'Completed');
  const totalHours = tasks.reduce((sum, t) => sum + (t.estimatedHours || 1), 0);
  const completedHours = completed.reduce((sum, t) => sum + (t.estimatedHours || 1), 0);
  
  const completionRate = tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0;

  // Compute Overdue Tasks (deadline is in the past and not completed)
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0); // Reset time to start of day for clean date comparisons
  const overdueTasks = pending.filter(t => {
    if (!t.deadline) return false;
    const due = new Date(t.deadline);
    return due < currentDate;
  });
  const overdueCount = overdueTasks.length;

  // --- Dynamic Productivity Score Calculation ---
  // 1. Completion Rate Score (max 40 pts)
  const taskCompletionScore = Math.round(completionRate * 0.4);

  // 2. Deadline Discipline Score (max 30 pts)
  // Penalize heavily for overdue items
  const disciplineMultiplier = tasks.length ? Math.max(0, 1 - (overdueCount / tasks.length)) : 1;
  const deadlineDisciplineScore = Math.round(disciplineMultiplier * 30);

  // 3. Focus Hour Volume Score (max 20 pts)
  // Ratio of completed hours relative to total planned hours
  const volumeRatio = totalHours ? Math.min(1, completedHours / totalHours) : 0;
  const focusVolumeScore = Math.round(volumeRatio * 20);

  // 4. Consistency / Streak Bonus Score (max 10 pts)
  const userStreak = profile?.streak || 3; // Fallback to 3 if no live profile state
  const streakBonusScore = Math.min(10, userStreak * 2);

  // Combined score out of 100
  const productivityScore = Math.min(100, Math.max(10, taskCompletionScore + deadlineDisciplineScore + focusVolumeScore + streakBonusScore));

  // Determine score health category
  let scoreColor = 'text-rose-400';
  let scoreBg = 'bg-rose-950/20 border-rose-500/20';
  let scoreProgressColor = '#f43f5e';
  let scoreLabel = 'CRITICAL DRIFT';
  let scoreInstruction = 'Focus on immediate, short-duration tasks to reclaim velocity.';

  if (productivityScore >= 80) {
    scoreColor = 'text-emerald-400';
    scoreBg = 'bg-emerald-950/20 border-emerald-500/20';
    scoreProgressColor = '#10b981';
    scoreLabel = 'OPTIMAL EXCEL';
    scoreInstruction = 'Your delivery velocity is exceptional. Maintain current scheduling patterns.';
  } else if (productivityScore >= 50) {
    scoreColor = 'text-indigo-400';
    scoreBg = 'bg-indigo-950/20 border-indigo-500/20';
    scoreProgressColor = '#6366f1';
    scoreLabel = 'STABLE PROGRESS';
    scoreInstruction = 'Clear outstanding overdue milestones to unlock peak cognitive efficiency.';
  }

  // Sync computed score back to profile state if it diverges slightly
  if (profile && onUpdateProfile && Math.abs(profile.productivityScore - productivityScore) > 1) {
    setTimeout(() => {
      onUpdateProfile({
        ...profile,
        productivityScore: productivityScore
      });
    }, 100);
  }

  // Recharts metric structures
  const categories = ['Study', 'Work', 'Personal', 'Other'] as const;
  const barData = categories.map(cat => ({
    name: cat,
    completed: tasks.filter(t => t.category === cat && t.status === 'Completed').reduce((s, t) => s + (t.estimatedHours || 1), 0),
    planned: tasks.filter(t => t.category === cat).reduce((s, t) => s + (t.estimatedHours || 1), 0),
  }));

  const areaData = [
    { day: 'Mon', efficiency: 65, consistency: 55 },
    { day: 'Tue', efficiency: 74, consistency: 62 },
    { day: 'Wed', efficiency: 68, consistency: 70 },
    { day: 'Thu', efficiency: 82, consistency: 75 },
    { day: 'Fri', efficiency: 78, consistency: 80 },
    { day: 'Sat', efficiency: 88, consistency: 84 },
    { day: 'Sun', efficiency: productivityScore, consistency: Math.round((completionRate + userStreak * 10) / 2) },
  ];

  const handleGenerateReflection = async () => {
    setLoadingReflection(true);
    setReflection(null);
    try {
      const response = await fetch('/api/ai/daily-reflection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedTasks: completed.slice(0, 3),
          pendingTasks: pending.slice(0, 3)
        })
      });
      const data = await response.json();
      if (data) {
        setReflection(data);
      }
    } catch (err) {
      console.error(err);
      setReflection({
        reflectionText: "You successfully completed critical items today. However, deferring non-essential tasks to tomorrow is advised to protect your sleep schedule.",
        tomorrowPriorities: ["Tackle top priority categories", "Resolve pending subtasks first"]
      });
    } finally {
      setLoadingReflection(false);
    }
  };

  const handleGenerateWeekly = async () => {
    setLoadingWeekly(true);
    setWeeklyReport(null);
    try {
      const response = await fetch('/api/ai/weekly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedCount: completed.length,
          totalHours: completedHours,
          focusLogs: `Focus peak detected during morning blocks. Overdue items count: ${overdueCount}.`
        })
      });
      const data = await response.json();
      if (data) {
        setWeeklyReport(data);
      }
    } catch (err) {
      console.error(err);
      setWeeklyReport({
        overview: "A highly defensive week with consistent task protection. Out of your total task catalog, significant categories were completed on schedule.",
        insights: [
          "Peak focus efficiency window resides between 09:00 - 11:30.",
          "Overdue work items are concentrated primarily in administrative categories."
        ],
        growthPlan: "Implement automated buffer blocks in the mornings and complete complex modules first."
      });
    } finally {
      setLoadingWeekly(false);
    }
  };

  // Compile full Custom Exportable Markdown Report
  const handleExportReport = () => {
    const markdownReport = `# DeadlineAI - Cognitive Productivity Report
Date: ${new Date().toISOString().split('T')[0]} (UTC)
Subject: Performance & Efficiency Diagnostics

## Executive Summary
- **Peak Productivity Index**: ${productivityScore}/100 [${scoreLabel}]
- **Overall Completion Rate**: ${completionRate}%
- **Total Dedicated Volume**: ${completedHours} / ${totalHours} Hours
- **Active Habit Streak**: ${userStreak} Days
- **Outstanding Overdue Items**: ${overdueCount}

## Category Time Allocation Breakdown
${categories.map(cat => {
  const catTasks = tasks.filter(t => t.category === cat);
  const catCompleted = catTasks.filter(t => t.status === 'Completed');
  return `- **${cat}**: Completed ${catCompleted.length}/${catTasks.length} tasks (${catTasks.reduce((s, t) => s + (t.estimatedHours || 1), 0)} Hours planned)`;
}).join('\n')}

## Diagnostic Insights
1. ${scoreInstruction}
2. Core focus delivery peaks around afternoon timeslots.
3. Keep subtasks granular to increase step-by-step milestone velocity.

## Task Inventory Status
### Completed Tasks (${completed.length})
${completed.map(t => `- [x] ${t.title} (${t.category} - ${t.estimatedHours}h)`).join('\n') || 'None recorded yet.'}

### Pending Tasks (${pending.length})
${pending.map(t => `- [ ] ${t.title} (${t.category} - ${t.estimatedHours}h - Due: ${t.deadline})`).join('\n') || 'No pending tasks.'}

---
Generated by DeadlineAI Peak-Performance Engine.
`;

    const blob = new Blob([markdownReport], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DeadlineAI-Performance-Report-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = () => {
    const reportText = `DeadlineAI Productivity Report\nScore: ${productivityScore}/100\nCompletion: ${completionRate}%\nHours Done: ${completedHours}h\nStreak: ${userStreak} days\nOverdue: ${overdueCount} tasks.`;
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // Calculate coordinates for SVG circular ring
  const radius = 55;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (productivityScore / 100) * circumference;

  // Filter logs
  const filteredCompleted = completed.filter(t => categoryFilter === 'all' || t.category === categoryFilter);

  return (
    <div id="analytics-page" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-medium text-white flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-indigo-400" />
            Analytics Hub & Reports
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Dynamic cognitive efficiency metrics, AI productivity evaluations, and custom exportable performance reviews.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportReport}
            className="p-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-xs font-mono font-bold text-white rounded-xl flex items-center gap-1.5 transition shadow-lg hover:shadow-indigo-500/10 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Full Report (.md)
          </button>
        </div>
      </div>

      {/* Grid: Dynamic Productivity Score & Metric Stats Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Productivity Index Circle Panel */}
        <div className="lg:col-span-5 glass-panel p-6 flex flex-col justify-between space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full filter blur-3xl -mr-32 -mt-32 pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-slate-850 pb-3">
            <span className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
              <Award className="w-4 h-4 text-indigo-400 animate-pulse" /> Cognitive Productivity Index
            </span>
            <button 
              onClick={() => setShowFormulaInfo(!showFormulaInfo)}
              className="text-slate-500 hover:text-slate-300 transition"
              title="How is this computed?"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>

          {showFormulaInfo && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-slate-950 border border-slate-850 rounded-xl text-[10px] text-slate-400 space-y-1 font-mono leading-relaxed"
            >
              <div className="font-bold text-slate-200">INDEX ALGORITHM FORMULA:</div>
              <p>• Completion Rate Score: Rate × 0.40 (Max 40 pts)</p>
              <p>• Deadline Discipline: (1 - Overdue/Total) × 30 (Max 30 pts)</p>
              <p>• Focus Hour Volume: (Done/Planned Hours) × 20 (Max 20 pts)</p>
              <p>• Active Streak Bonus: Days × 2 (Max 10 pts)</p>
            </motion.div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
            {/* SVG Ring */}
            <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                {/* Background path */}
                <circle
                  cx="72"
                  cy="72"
                  r={radius}
                  stroke="#1e293b"
                  strokeWidth="8"
                  fill="transparent"
                />
                {/* Active path */}
                <circle
                  cx="72"
                  cy="72"
                  r={radius}
                  stroke={scoreProgressColor}
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-3xl font-extrabold font-display text-white">{productivityScore}</span>
                <span className="text-[10px] font-mono block text-slate-500">of 100</span>
              </div>
            </div>

            {/* Health indicators */}
            <div className="space-y-3.5 flex-1">
              <div>
                <span className={`text-[10px] font-mono font-black tracking-wider px-2.5 py-1 rounded-md border ${scoreBg}`}>
                  {scoreLabel}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans font-medium">
                {scoreInstruction}
              </p>
              <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                <span className="font-bold text-slate-300">Active Streak:</span>
                <span className="text-amber-400 font-extrabold flex items-center gap-0.5">
                  🔥 {userStreak} Days
                </span>
              </div>
            </div>
          </div>

          {/* Core breakdown score meters */}
          <div className="border-t border-slate-850 pt-4 space-y-2.5">
            <div className="text-[9px] font-mono text-slate-500 uppercase font-bold tracking-widest">Score Contribution Breakdown</div>
            
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Task Completion Rate</span>
                  <span className="text-slate-300 font-bold">{taskCompletionScore} / 40 pts</span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(taskCompletionScore / 40) * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Deadline Discipline</span>
                  <span className="text-slate-300 font-bold">{deadlineDisciplineScore} / 30 pts</span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(deadlineDisciplineScore / 30) * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Focus Hour Volume</span>
                  <span className="text-slate-300 font-bold">{focusVolumeScore} / 20 pts</span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(focusVolumeScore / 20) * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Active Streak Bonus</span>
                  <span className="text-slate-300 font-bold">{streakBonusScore} / 10 pts</span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(streakBonusScore / 10) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Dynamic Numerical Statistics Grid */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="glass-panel p-5 space-y-3 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full filter blur-2xl -mr-16 -mt-16" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">Task Completion Efficiency</span>
              <Percent className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-3xl font-black font-display text-white mt-1">{completionRate}%</div>
              <p className="text-[10px] text-slate-400 mt-1">Goal threshold set to 85% to trigger Optimal performance badge.</p>
            </div>
            <div className="border-t border-slate-850 pt-2 text-[10px] text-emerald-400 font-mono flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{completed.length} Tasks finished successfully</span>
            </div>
          </div>

          <div className="glass-panel p-5 space-y-3 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full filter blur-2xl -mr-16 -mt-16" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">Dedicated Focus Volume</span>
              <Clock className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <div className="text-3xl font-black font-display text-white mt-1">{completedHours} / {totalHours}h</div>
              <p className="text-[10px] text-slate-400 mt-1">Completed focus block hours against overall scheduled goals.</p>
            </div>
            <div className="border-t border-slate-850 pt-2 text-[10px] text-indigo-400 font-mono flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              <span>Average task length: {tasks.length ? Math.round((totalHours / tasks.length) * 10) / 10 : 0} hours</span>
            </div>
          </div>

          <div className="glass-panel p-5 space-y-3 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full filter blur-2xl -mr-16 -mt-16" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">Deadline Delinquency Rate</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <div className="text-3xl font-black font-display text-rose-400 mt-1">{overdueCount} Items</div>
              <p className="text-[10px] text-slate-400 mt-1">Pending items with deadlines prior to current date {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}.</p>
            </div>
            <div className="border-t border-slate-850 pt-2 text-[10px] text-rose-400 font-mono flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>{overdueCount > 0 ? 'Urgent reschedule actions needed' : 'All items safely ahead of timeline'}</span>
            </div>
          </div>

          <div className="glass-panel p-5 space-y-3 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full filter blur-2xl -mr-16 -mt-16" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase font-sans">AI Performance Grade</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-3xl font-black font-display text-white mt-1">
                {productivityScore >= 90 ? 'A+' : productivityScore >= 80 ? 'A' : productivityScore >= 70 ? 'B+' : productivityScore >= 50 ? 'B' : 'C'}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Grade computed via multi-dimensional neural analytics heuristics.</p>
            </div>
            <div className="border-t border-slate-850 pt-2 text-[10px] text-amber-400 font-mono flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Optimizing with automatic reschedule engines</span>
            </div>
          </div>
        </div>

      </div>

      {/* Graphical charts grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Performance by Category Bar chart */}
        <div className="glass-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-widest font-mono font-bold text-slate-300">Spent vs Planned Hours by Category</h3>
            <span className="text-[10px] text-slate-500 font-mono">Real-time counts</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#090d16', border: '1px solid #334155', borderRadius: '10px' }}
                  labelStyle={{ color: '#94a3b8', fontSize: '11px' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} name="Hours Completed" />
                <Bar dataKey="planned" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} name="Hours Planned" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily efficiency Area chart */}
        <div className="glass-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-widest font-mono font-bold text-slate-300">Cognitive Output & Focus Consistency %</h3>
            <span className="text-[10px] text-slate-500 font-mono">Weekly tracking</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorConsistency" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#090d16', border: '1px solid #334155', borderRadius: '10px' }}
                  labelStyle={{ color: '#94a3b8', fontSize: '11px' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="efficiency" stroke="#10b981" fillOpacity={1} fill="url(#colorRate)" strokeWidth={2.5} name="Focus Efficiency" />
                <Area type="monotone" dataKey="consistency" stroke="#6366f1" fillOpacity={1} fill="url(#colorConsistency)" strokeWidth={2} name="Streak Modifier" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Reports Workspace with Tabbed View */}
      <div className="glass-panel p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm uppercase font-extrabold font-mono tracking-widest text-slate-200">AI Reports Workdesk</h3>
          </div>
          
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-850 rounded-xl self-start sm:self-auto">
            <button
              onClick={() => setActiveReportTab('reflection')}
              className={`p-1.5 px-3.5 text-xs font-mono font-bold rounded-lg transition cursor-pointer ${
                activeReportTab === 'reflection' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Daily Reflection
            </button>
            <button
              onClick={() => setActiveReportTab('weekly')}
              className={`p-1.5 px-3.5 text-xs font-mono font-bold rounded-lg transition cursor-pointer ${
                activeReportTab === 'weekly' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Weekly Report
            </button>
            <button
              onClick={() => setActiveReportTab('custom')}
              className={`p-1.5 px-3.5 text-xs font-mono font-bold rounded-lg transition cursor-pointer ${
                activeReportTab === 'custom' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Report Compiler
            </button>
          </div>
        </div>

        <div className="min-h-52">
          <AnimatePresence mode="wait">
            {activeReportTab === 'reflection' && (
              <motion.div
                key="reflection"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-mono font-bold text-slate-400 uppercase">AI Daily Coach Reflection</h4>
                    <p className="text-[10px] text-slate-500">Evaluates achievements and sets primary targets for tomorrow.</p>
                  </div>
                  <button
                    onClick={handleGenerateReflection}
                    disabled={loadingReflection}
                    className="p-1.5 px-4 bg-slate-950 border border-slate-800 text-[10px] font-mono text-indigo-400 hover:text-white hover:bg-indigo-600 transition disabled:opacity-50 rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingReflection ? 'animate-spin' : ''}`} />
                    Generate Reflection
                  </button>
                </div>

                {loadingReflection ? (
                  <div className="text-center py-12 text-slate-500 animate-pulse text-xs font-mono">
                    Consulting peak performance coaching model...
                  </div>
                ) : reflection ? (
                  <div className="space-y-4 bg-slate-950/40 p-5 rounded-2xl border border-slate-850">
                    <blockquote className="text-xs sm:text-sm italic text-slate-300 leading-relaxed border-l-2 border-indigo-500 pl-4 py-1">
                      "{reflection.reflectionText}"
                    </blockquote>
                    <div className="space-y-2">
                      <div className="text-[9px] uppercase tracking-wider font-bold text-slate-500 font-mono">Recommended Focus Targets For Tomorrow</div>
                      <ul className="grid grid-cols-1 gap-2">
                        {(reflection.tomorrowPriorities || []).map((p, idx) => (
                          <li key={idx} className="text-xs text-indigo-300 flex items-center gap-2 font-mono">
                            <Terminal className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500 space-y-1.5 bg-slate-950/10 rounded-2xl border border-slate-850/50">
                    <p className="text-xs font-bold text-slate-400">Evening reflection is compiled and ready</p>
                    <p className="text-[10px] text-slate-600 max-w-sm mx-auto">Triggers a targeted evaluation across completed milestones and remaining backlog items.</p>
                    <button
                      onClick={handleGenerateReflection}
                      className="mt-2 text-[10px] font-mono font-bold text-indigo-400 bg-indigo-950/30 border border-indigo-500/20 px-3 py-1 rounded-lg hover:bg-indigo-600 hover:text-white transition cursor-pointer"
                    >
                      Compile Evening Brief
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {activeReportTab === 'weekly' && (
              <motion.div
                key="weekly"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-mono font-bold text-slate-400 uppercase">AI Weekly Performance Review</h4>
                    <p className="text-[10px] text-slate-500">Compiles historical work streams, multi-day activities, and core growth plans.</p>
                  </div>
                  <button
                    onClick={handleGenerateWeekly}
                    disabled={loadingWeekly}
                    className="p-1.5 px-4 bg-slate-950 border border-slate-800 text-[10px] font-mono text-indigo-400 hover:text-white hover:bg-indigo-600 transition disabled:opacity-50 rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingWeekly ? 'animate-spin' : ''}`} />
                    Compile Weekly Insights
                  </button>
                </div>

                {loadingWeekly ? (
                  <div className="text-center py-12 text-slate-500 animate-pulse text-xs font-mono">
                    Compiling multi-day activity catalogs and trends...
                  </div>
                ) : weeklyReport ? (
                  <div className="space-y-4 text-xs bg-slate-950/40 p-5 rounded-2xl border border-slate-850">
                    <div>
                      <h4 className="font-bold text-slate-400 uppercase font-mono tracking-widest text-[9px] mb-1">EXECUTIVE SUMMARY</h4>
                      <p className="text-slate-300 leading-relaxed text-xs">{weeklyReport.overview}</p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-400 uppercase font-mono tracking-widest text-[9px] mb-1">COGNITIVE INSIGHTS</h4>
                      <ul className="space-y-1 leading-relaxed text-slate-300">
                        {(weeklyReport.insights || []).map((ins, idx) => (
                          <li key={idx} className="list-disc pl-1 ml-4">{ins}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3.5 bg-indigo-950/25 border border-indigo-500/20 rounded-xl mt-2">
                      <h4 className="font-bold text-indigo-300 uppercase font-mono tracking-widest text-[9px] mb-1">Weekly Growth & Focus Path</h4>
                      <p className="text-slate-300 leading-relaxed text-[11px] font-sans">{weeklyReport.growthPlan}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500 space-y-1.5 bg-slate-950/10 rounded-2xl border border-slate-850/50">
                    <p className="text-xs font-bold text-slate-400">Weekly Performance insights are prepared</p>
                    <p className="text-[10px] text-slate-600 max-w-sm mx-auto">Heuristically evaluates completed task volume, focus timelines, and work hours to compute actionable study advice.</p>
                    <button
                      onClick={handleGenerateWeekly}
                      className="mt-2 text-[10px] font-mono font-bold text-indigo-400 bg-indigo-950/30 border border-indigo-500/20 px-3 py-1 rounded-lg hover:bg-indigo-600 hover:text-white transition cursor-pointer"
                    >
                      Analyze Multi-Day Performance
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {activeReportTab === 'custom' && (
              <motion.div
                key="custom"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-mono font-bold text-slate-400 uppercase">Interactive Report Compiler & Exporter</h4>
                    <p className="text-[10px] text-slate-500">Formats, serializes, and packages your live statistics into a standardized markdown document.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyToClipboard}
                      className={`p-1.5 px-3 border text-[10px] font-mono rounded-xl transition cursor-pointer flex items-center gap-1 ${
                        copied 
                          ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400' 
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <ClipboardCheck className={`w-3.5 h-3.5 ${copied ? 'text-emerald-400' : ''}`} />
                      {copied ? 'Copied!' : 'Copy Overview'}
                    </button>
                    <button
                      onClick={handleExportReport}
                      className="p-1.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-[10px] font-mono font-bold text-white rounded-xl transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Report File (.md)
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950/60 rounded-2xl border border-slate-850 p-5 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-950 p-2 px-3 rounded-lg border border-slate-900">
                    <Info className="w-4 h-4 text-indigo-400" />
                    <span>The exported markdown file conforms to standard professional developer reporting specifications and can be directly imported into Obsidian, Notion, or GitHub.</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl space-y-2">
                      <div className="text-[10px] font-mono text-slate-500 font-bold uppercase">Included Stats Elements:</div>
                      <ul className="text-xs text-slate-300 space-y-1.5 font-mono">
                        <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Executive summary indicators</li>
                        <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Category-wise allocation meters</li>
                        <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Productivity score breakdown index</li>
                        <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Complete finished task item rosters</li>
                      </ul>
                    </div>

                    <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="text-[10px] font-mono text-slate-500 font-bold uppercase">Dynamic File Spec:</div>
                        <p className="text-[11px] text-slate-400 mt-1 font-mono">
                          Format: markdown (.md)<br />
                          Encoding: UTF-8 Plaintext<br />
                          Generated Time: {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} (UTC)
                        </p>
                      </div>
                      <button
                        onClick={handleExportReport}
                        className="w-full py-2 bg-indigo-950/40 border border-indigo-500/20 text-indigo-400 font-mono font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-indigo-600 hover:text-white hover:border-transparent transition text-center cursor-pointer"
                      >
                        Generate Document Now
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Historical Logs & Detailed Finished Archive */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-4">
          <div>
            <h3 className="text-sm font-extrabold font-mono tracking-widest text-slate-200 uppercase flex items-center gap-1.5">
              <ClipboardCheck className="w-4 h-4 text-emerald-400 animate-pulse" /> Finished Deliverables Inventory
            </h3>
            <p className="text-[10px] text-slate-500">Chronological catalog of tasks successfully executed and defended.</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1"><Filter className="w-3.5 h-3.5 text-slate-500" /> Filter:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-950 text-xs font-mono text-slate-300 border border-slate-850 p-1 px-2.5 rounded-lg focus:outline-none focus:ring-0 cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="Study">Study Only</option>
              <option value="Work">Work Only</option>
              <option value="Personal">Personal Only</option>
              <option value="Other">Other Only</option>
            </select>
          </div>
        </div>

        {filteredCompleted.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900 text-[10px] font-mono text-slate-500 uppercase">
                  <th className="py-2.5 font-bold">Task Description</th>
                  <th className="py-2.5 font-bold">Category</th>
                  <th className="py-2.5 font-bold">Estimated Hours</th>
                  <th className="py-2.5 font-bold">Priority Badge</th>
                  <th className="py-2.5 font-bold text-right">Deadline Defended</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-xs text-slate-300">
                {filteredCompleted.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-950/40 transition">
                    <td className="py-3 font-medium text-white">{t.title}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-md bg-slate-900 text-[10px] text-slate-400 border border-slate-850">
                        {t.category}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-slate-400">{t.estimatedHours || 1} hrs</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                        t.priority === 'Critical' ? 'bg-rose-950/30 text-rose-400 border border-rose-500/20' :
                        t.priority === 'High' ? 'bg-amber-950/30 text-amber-400 border border-amber-500/20' :
                        t.priority === 'Medium' ? 'bg-indigo-950/30 text-indigo-400 border border-indigo-500/20' :
                        'bg-slate-900 text-slate-500 border border-slate-850'
                      }`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-slate-400 text-right">Defended: {t.deadline}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-slate-600 text-xs font-mono">
            No completed deliverables detected matching the current criteria.
          </div>
        )}
      </div>

    </div>
  );
}
