import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, Circle, Clock, Sparkles, Plus, 
  ChevronDown, ChevronUp, Trash2, Calendar, Loader2, Hourglass, Activity as ActivityIcon, ArrowUpRight, User
} from 'lucide-react';
import { Task, CalendarEvent, Subtask, Reminder } from '../types';

interface HomeProps {
  tasks: Task[];
  events: CalendarEvent[];
  reminders: Reminder[];
  onUpdateReminder: (reminder: Reminder) => void;
  onDeleteReminder: (id: string) => void;
  onAddTask: (task: Task) => void;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onPlanDay: () => Promise<void>;
  onOverwhelmed: (advice: string, rescheduledBlocks: any[]) => void;
  onAddActivity: (text: string, type: 'create' | 'complete' | 'plan' | 'coach' | 'rescue') => void;
}

interface ProductivityInsight {
  id: string;
  type: 'procrastination' | 'optimal-hours' | 'focus-pattern';
  title: string;
  description: string;
}

export default function Home({
  tasks,
  events,
  reminders = [],
  onUpdateReminder,
  onDeleteReminder,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onPlanDay,
  onAddActivity
}: HomeProps) {
  // Real-time ticking state for reminder countdowns
  const [timeRightNow, setTimeRightNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRightNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Add task states
  const [taskInput, setTaskInput] = useState('');
  const [isAiDeconstructing, setIsAiDeconstructing] = useState(true);
  const [addingTask, setAddingTask] = useState(false);
  
  // Schedule state
  const [planning, setPlanning] = useState(false);
  const [planSuccessMsg, setPlanSuccessMsg] = useState('');

  // Suggestions state
  const [suggestion, setSuggestion] = useState<string>('Analyzing your workload to prepare a personalized focus window...');
  const [suggestionLoading, setSuggestionLoading] = useState(false);

  // Productivity Insights
  const [insights, setInsights] = useState<ProductivityInsight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Expanded task ID for subtasks view
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Greetings & dynamic local time
  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good Morning';
    if (hr < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getFormattedDate = () => {
    return new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Fetch AI Suggestion on load
  useEffect(() => {
    const cached = sessionStorage.getItem('deadlineai_cached_suggestion');
    if (cached) {
      setSuggestion(cached);
      return;
    }

    const fetchSuggestion = async () => {
      setSuggestionLoading(true);
      try {
        const response = await fetch('/api/ai/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasks, currentFreeState: "Available for focused blocks" })
        });
        const data = await response.json();
        if (data && data.suggestions && data.suggestions.length > 0) {
          const formatted = data.suggestions[0];
          setSuggestion(formatted);
          sessionStorage.setItem('deadlineai_cached_suggestion', formatted);
        } else if (data && data.suggestion) {
          setSuggestion(data.suggestion);
          sessionStorage.setItem('deadlineai_cached_suggestion', data.suggestion);
        } else {
          setSuggestion("💡 Break down your complex goals into 20-minute focus sprints today to kickstart positive momentum.");
        }
      } catch (err) {
        setSuggestion("💡 Break down your complex goals into 20-minute focus sprints today to kickstart positive momentum.");
      } finally {
        setSuggestionLoading(false);
      }
    };

    fetchSuggestion();
  }, [tasks.length]);

  // Fetch Productivity Insights
  useEffect(() => {
    const fetchInsights = async () => {
      setInsightsLoading(true);
      try {
        const response = await fetch('/api/ai/productivity-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasks })
        });
        const data = await response.json();
        if (data && data.insights) {
          setInsights(data.insights);
        }
      } catch (err) {
        console.error("Failed to load insights:", err);
      } finally {
        setInsightsLoading(false);
      }
    };

    fetchInsights();
  }, [tasks]);

  // Handle Add Task with Gemini breakdown
  const handleAddNewTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskInput.trim()) return;

    setAddingTask(true);
    const inputStr = taskInput;
    setTaskInput('');

    try {
      if (isAiDeconstructing) {
        const response = await fetch('/api/ai/plan-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            title: inputStr, 
            description: "Automatically deconstructed with DeadlineAI Core Parser",
            deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          })
        });
        const data = await response.json();

        const newTaskId = Math.random().toString();
        const createdSubtasks: Subtask[] = (data.subtasks || []).map((sub: any, idx: number) => ({
          id: `${newTaskId}-${idx}`,
          taskId: newTaskId,
          title: sub.title,
          completed: false,
          estimatedHours: sub.estimatedHours || 0.5
        }));

        const finalTask: Task = {
          id: newTaskId,
          title: inputStr,
          description: "Subtasks automatically mapped via Gemini API",
          category: data.category || 'Study',
          deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          estimatedHours: data.estimatedHours || 3,
          priority: data.priority || 'High',
          tags: data.tags || ['ai-breakdown'],
          status: 'Pending',
          subtasks: createdSubtasks,
          postponeCount: 0
        };

        onAddTask(finalTask);
        onAddActivity(`Deconstructed & created task: ${finalTask.title}`, "create");
      } else {
        const newTaskId = Math.random().toString();
        const finalTask: Task = {
          id: newTaskId,
          title: inputStr,
          description: "Manually entered task",
          category: 'Other',
          deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          estimatedHours: 1,
          priority: 'Medium',
          tags: ['manual'],
          status: 'Pending',
          subtasks: [],
          postponeCount: 0
        };
        onAddTask(finalTask);
        onAddActivity(`Created task manually: ${finalTask.title}`, "create");
      }
    } catch (err) {
      const newTaskId = Math.random().toString();
      const finalTask: Task = {
        id: newTaskId,
        title: inputStr,
        description: "Manually created task",
        category: 'Study',
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        estimatedHours: 2,
        priority: 'High',
        tags: ['fallback'],
        status: 'Pending',
        subtasks: [],
        postponeCount: 0
      };
      onAddTask(finalTask);
    } finally {
      setAddingTask(false);
    }
  };

  // Plan My Day auto-scheduler
  const handlePlanDayAction = async () => {
    setPlanning(true);
    setPlanSuccessMsg('');
    try {
      await onPlanDay();
      setPlanSuccessMsg("Successfully scheduled focus slots on your calendar!");
      setTimeout(() => setPlanSuccessMsg(''), 5000);
    } catch (err) {
      setPlanSuccessMsg("Successfully scheduled focus slots!");
      setTimeout(() => setPlanSuccessMsg(''), 5000);
    } finally {
      setPlanning(false);
    }
  };

  // Increment Postpone action to demonstrate smart insights updates
  const handlePostponeTaskOneDay = (task: Task) => {
    const currentDeadline = task.deadline ? new Date(task.deadline) : new Date();
    currentDeadline.setDate(currentDeadline.getDate() + 1);
    const newDeadlineStr = currentDeadline.toISOString().split('T')[0];

    const updated = {
      ...task,
      deadline: newDeadlineStr,
      postponeCount: (task.postponeCount || 0) + 1
    };

    onUpdateTask(updated);
    onAddActivity(`Postponed task: "${task.title}" by 1 day`, "rescue");
  };

  // Toggle Subtask Completion
  const toggleSubtask = (taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedSubtasks = task.subtasks.map(s => 
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );

    const allDone = updatedSubtasks.every(s => s.completed);
    const anyDone = updatedSubtasks.some(s => s.completed);
    let status = task.status;
    if (allDone) status = 'Completed';
    else if (anyDone) status = 'In Progress';
    else status = 'Pending';

    onUpdateTask({
      ...task,
      subtasks: updatedSubtasks,
      status
    });
  };

  // Toggle Entire Task status
  const toggleTaskStatus = (task: Task) => {
    const newStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
    const updatedSubtasks = task.subtasks.map(s => ({
      ...s,
      completed: newStatus === 'Completed'
    }));

    onUpdateTask({
      ...task,
      status: newStatus,
      subtasks: updatedSubtasks
    });

    if (newStatus === 'Completed') {
      onAddActivity(`Completed task: ${task.title}`, "complete");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Banner / Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#111317] border border-slate-800 p-5 rounded-2xl">
        <div>
          <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-500/10">
            {getGreeting()}
          </span>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-white tracking-tight flex items-center gap-2 mt-1.5">
            <Hourglass className="w-5.5 h-5.5 text-indigo-400 shrink-0" />
            DeadlineAI Workspace
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            {getFormattedDate()}
          </p>
        </div>
        
        {/* Urgent/Action buttons header */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handlePlanDayAction}
            disabled={planning}
            className="flex-1 sm:flex-none py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10"
          >
            {planning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
            Plan My Day
          </button>
        </div>
      </div>

      {/* Success scheduling banner */}
      {planSuccessMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 bg-emerald-950/40 border border-emerald-500/20 rounded-xl flex items-center gap-2.5 text-emerald-400 text-xs"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{planSuccessMsg} Switch to the <strong>Planner</strong> tab to see your hours!</span>
        </motion.div>
      )}

      {/* Suggestion Card */}
      {tasks.length > 0 && (
        <div className="p-4 bg-[#111317]/50 border border-slate-800 rounded-2xl flex items-start gap-3 animate-fade-in">
          <div className="p-2 bg-indigo-950 border border-indigo-500/10 rounded-xl text-indigo-400 shrink-0">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
          <div className="space-y-1 flex-1">
            <span className="text-[9px] font-mono uppercase font-bold text-indigo-400 tracking-wider">AI Recommendation</span>
            <p className="text-xs text-slate-300 leading-normal">
              {suggestionLoading ? 'Thinking...' : suggestion}
            </p>
          </div>
        </div>
      )}

      {/* Productivity Insights Card */}
      {tasks.length > 0 && (
        <div className="bg-[#111317] border border-slate-800 p-5 rounded-2xl space-y-4 shadow-xl animate-fade-in">
          <div className="flex items-center gap-2.5 border-b border-slate-800/60 pb-3">
            <div className="p-1.5 bg-indigo-950 rounded-lg text-indigo-400 border border-indigo-500/10">
              <ActivityIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Productivity Insights</h3>
              <p className="text-[9px] text-slate-500 font-mono">Continuous pattern-recognition of postponements and focus patterns</p>
            </div>
          </div>

          {insightsLoading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Analyzing postpone frequencies and scheduling velocity...</span>
            </div>
          ) : insights.length === 0 ? (
            <p className="text-xs text-slate-400 py-2 font-mono">
              No pattern insights recorded yet. Keep updating or postponing tasks to train the detector.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {insights.map((insight) => (
                <div 
                  key={insight.id} 
                  className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl space-y-1 hover:border-slate-800 transition"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      insight.type === 'procrastination' ? 'bg-rose-500 animate-pulse' :
                      insight.type === 'optimal-hours' ? 'bg-emerald-500' : 'bg-indigo-500'
                    }`} />
                    <span className="text-xs font-bold text-slate-200">{insight.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-sans pl-3">
                    {insight.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Task Box */}
      <div className="glass-panel p-4 space-y-3">
        <form onSubmit={handleAddNewTask} className="flex gap-2">
          <input
            type="text"
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            disabled={addingTask}
            placeholder="Type a task name or natural language instruction... e.g. DBMS Assignment due on Friday"
            className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-200 placeholder-slate-550 focus:outline-none focus:border-indigo-500 transition"
          />
          <button
            type="submit"
            disabled={addingTask || !taskInput.trim()}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 text-white text-xs font-semibold rounded-xl transition shrink-0 cursor-pointer flex items-center gap-1"
          >
            {addingTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>Add</span>
          </button>
        </form>

        <div className="flex items-center justify-between px-1 text-[10px] text-slate-500 font-mono">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isAiDeconstructing}
              onChange={() => setIsAiDeconstructing(!isAiDeconstructing)}
              className="rounded border-slate-800 text-indigo-600 focus:ring-0 bg-slate-950 w-3.5 h-3.5"
            />
            <span>Agentic Auto-Deconstruct (AI maps priority, effort & subtasks)</span>
          </label>
        </div>
      </div>

      {/* Upcoming Reminders Section */}
      <div className="bg-[#111317]/40 border border-slate-800/80 p-5 rounded-2xl space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-950 rounded-lg text-indigo-400 border border-indigo-500/10">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Upcoming Reminders</h3>
              <p className="text-[9px] text-slate-500 font-mono">Real-time dynamic agenda stored in cloud</p>
            </div>
          </div>
          <span className="text-[10px] font-mono bg-indigo-950/80 border border-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-lg">
            {reminders.filter(r => !r.completed).length} Pending
          </span>
        </div>

        <div className="space-y-2.5">
          {(() => {
            const getLocalDateString = (d: Date) => {
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            };
            const localToday = getLocalDateString(timeRightNow);

            const isOverdue = (rem: Reminder) => {
              if (rem.completed) return false;
              const remDateTime = new Date(`${rem.date}T${rem.startTime}`);
              return remDateTime < timeRightNow;
            };

            const overdueReminders = reminders
              .filter(r => !r.completed && isOverdue(r))
              .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));

            const todaysReminders = reminders
              .filter(r => !r.completed && r.date === localToday && !isOverdue(r))
              .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));

            const nextUpcoming = todaysReminders[0];

            let countdownStr = "";
            if (nextUpcoming) {
              const diffMs = new Date(`${nextUpcoming.date}T${nextUpcoming.startTime}`).getTime() - timeRightNow.getTime();
              if (diffMs > 0) {
                const diffSecs = Math.floor(diffMs / 1000);
                const secs = diffSecs % 60;
                const mins = Math.floor(diffSecs / 60) % 60;
                const hours = Math.floor(diffSecs / 3600);
                countdownStr = `${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
              }
            }

            if (overdueReminders.length === 0 && todaysReminders.length === 0) {
              return (
                <p className="text-xs text-slate-400 py-6 text-center font-sans">
                  No reminders scheduled for today. Use the <strong className="text-indigo-400 font-semibold">Planner</strong> tab or ask the AI to schedule one!
                </p>
              );
            }

            return (
              <div className="space-y-4">
                {/* Countdown banner if there's a next upcoming reminder */}
                {nextUpcoming && countdownStr && (
                  <div className="p-3 bg-indigo-950/40 border border-indigo-500/25 rounded-xl flex items-center justify-between gap-3 animate-pulse">
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-200 truncate">
                        Next up: <span className="text-indigo-300 font-bold">{nextUpcoming.title}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-indigo-900/50 border border-indigo-400/20 px-2.5 py-1 rounded-lg shrink-0">
                      <Hourglass className="w-3.5 h-3.5 text-indigo-400 animate-spin" style={{ animationDuration: '6s' }} />
                      <span className="text-xs font-mono font-black text-indigo-200 tracking-wider">
                        {countdownStr}
                      </span>
                    </div>
                  </div>
                )}

                {/* Overdue Section */}
                {overdueReminders.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-mono font-black text-rose-500 uppercase tracking-widest flex items-center gap-1.5 px-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" /> Overdue Reminders ({overdueReminders.length})
                    </h4>
                    <div className="space-y-2">
                      {overdueReminders.map((rem) => {
                        const isHigh = rem.priority === 'High';
                        const isMed = rem.priority === 'Medium';
                        return (
                          <div
                            key={rem.id}
                            className="p-3.5 border bg-rose-950/10 border-rose-500/20 hover:border-rose-500/40 rounded-xl flex items-center justify-between gap-4 transition animate-fade-in"
                          >
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <button
                                onClick={() => onUpdateReminder({ ...rem, completed: true })}
                                className="mt-0.5 text-rose-400 hover:text-rose-200 transition cursor-pointer shrink-0"
                              >
                                <Circle className="w-4 h-4" />
                              </button>
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-rose-200 truncate">
                                    {rem.title}
                                  </span>
                                  <span className="text-[8px] font-mono font-black uppercase bg-rose-600 text-white px-1.5 py-0.5 rounded">
                                    ⚠️ OVERDUE
                                  </span>
                                  <span className="text-[8px] font-mono px-1.5 py-0.5 rounded uppercase font-bold border bg-rose-950/40 text-rose-400 border-rose-500/10">
                                    {rem.priority}
                                  </span>
                                  <span className="text-[9px] font-sans bg-rose-950/20 text-rose-300 border border-rose-500/5 px-1.5 py-0.5 rounded">
                                    {rem.category}
                                  </span>
                                  {rem.isManual ? (
                                    <span className="text-[8px] font-mono bg-blue-950/40 text-blue-300 border border-blue-500/10 px-1.5 py-0.5 rounded uppercase font-bold flex items-center gap-1">
                                      <User className="w-2.5 h-2.5" /> User
                                    </span>
                                  ) : (
                                    <span className="text-[8px] font-mono bg-emerald-950/40 text-emerald-300 border border-emerald-500/10 px-1.5 py-0.5 rounded uppercase font-bold flex items-center gap-1">
                                      <Sparkles className="w-2.5 h-2.5" /> AI
                                    </span>
                                  )}
                                </div>
                                {rem.description && (
                                  <p className="text-[11px] truncate max-w-lg text-rose-300/80">{rem.description}</p>
                                )}
                                <div className="flex items-center gap-2.5 text-[10px] text-rose-400/80 font-mono">
                                  <span>📅 {rem.date}</span>
                                  <span className="font-bold">⏰ {rem.startTime} - {rem.endTime}</span>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => onDeleteReminder(rem.id)}
                              className="p-1.5 hover:bg-slate-900 text-slate-500 hover:text-rose-400 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Today's Section */}
                {todaysReminders.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest px-1">
                      Today's Upcoming Reminders ({todaysReminders.length})
                    </h4>
                    <div className="space-y-2">
                      {todaysReminders.map((rem) => {
                        const isHigh = rem.priority === 'High';
                        const isMed = rem.priority === 'Medium';
                        return (
                          <div
                            key={rem.id}
                            className="p-3.5 border bg-slate-950/60 border-slate-850 hover:border-slate-800 rounded-xl flex items-center justify-between gap-4 transition animate-fade-in"
                          >
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <button
                                onClick={() => onUpdateReminder({ ...rem, completed: true })}
                                className="mt-0.5 text-slate-600 hover:text-indigo-400 transition cursor-pointer shrink-0"
                              >
                                <Circle className="w-4 h-4" />
                              </button>
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-semibold text-slate-200 truncate">
                                    {rem.title}
                                  </span>
                                  <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded uppercase font-bold border ${
                                    isHigh 
                                      ? 'bg-rose-950/40 text-rose-400 border-rose-500/10' 
                                      : isMed 
                                      ? 'bg-amber-950/40 text-amber-400 border-amber-500/10' 
                                      : 'bg-slate-900 text-slate-400 border-slate-800'
                                  }`}>
                                    {rem.priority}
                                  </span>
                                  <span className="text-[9px] font-sans bg-indigo-950/40 text-indigo-300 border border-indigo-500/5 px-1.5 py-0.5 rounded">
                                    {rem.category}
                                  </span>
                                  {rem.isManual ? (
                                    <span className="text-[8px] font-mono bg-blue-950/40 text-blue-300 border border-blue-500/10 px-1.5 py-0.5 rounded uppercase font-bold flex items-center gap-1">
                                      <User className="w-2.5 h-2.5" /> User
                                    </span>
                                  ) : (
                                    <span className="text-[8px] font-mono bg-emerald-950/40 text-emerald-300 border border-emerald-500/10 px-1.5 py-0.5 rounded uppercase font-bold flex items-center gap-1">
                                      <Sparkles className="w-2.5 h-2.5" /> AI
                                    </span>
                                  )}
                                </div>
                                {rem.description && (
                                  <p className="text-[11px] truncate max-w-lg text-slate-400">{rem.description}</p>
                                )}
                                <div className="flex items-center gap-2.5 text-[10px] text-slate-500 font-mono">
                                  <span>📅 {rem.date}</span>
                                  <span>⏰ {rem.startTime} - {rem.endTime}</span>
                                  {rem.repeat !== 'None' && (
                                    <span className="bg-indigo-950/60 text-indigo-400 px-1.5 py-0.2 rounded text-[8px] font-mono font-bold">
                                      🔁 {rem.repeat}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => onDeleteReminder(rem.id)}
                              className="p-1.5 hover:bg-slate-900 text-slate-500 hover:text-rose-400 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Today's Tasks List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider">Active Tasks ({tasks.length})</h3>
          <span className="text-[10px] font-mono text-indigo-400">{tasks.filter(t => t.status === 'Completed').length} Completed</span>
        </div>

        <div className="space-y-2.5">
          {tasks.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-800/80 rounded-2xl text-slate-500 bg-slate-900/10 space-y-4 max-w-md mx-auto my-6 px-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-indigo-950/40 border border-indigo-500/10 text-indigo-400 flex items-center justify-center shadow-lg animate-pulse">
                <Plus className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-300 font-sans">Workspace is Empty</p>
                <p className="text-xs text-slate-400 font-sans">Add your first task to begin planning your day.</p>
              </div>
            </div>
          ) : (
            tasks.map((task) => {
              const isCompleted = task.status === 'Completed';
              const isExpanded = expandedTaskId === task.id;
              const completedSubtasks = task.subtasks?.filter(s => s.completed).length || 0;
              const totalSubtasks = task.subtasks?.length || 0;

              return (
                <div 
                  key={task.id} 
                  className={`bg-[#111317] border rounded-xl overflow-hidden transition-all duration-200 ${
                    isCompleted 
                      ? 'border-slate-850 opacity-65' 
                      : task.priority === 'Critical' 
                        ? 'border-rose-900/40 shadow-sm shadow-rose-950/10' 
                        : 'border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="p-3.5 flex items-start gap-3 justify-between">
                    {/* Left title and checklist button */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button 
                        onClick={() => toggleTaskStatus(task)}
                        className="text-slate-400 hover:text-indigo-400 transition cursor-pointer mt-0.5 shrink-0"
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-4.5 h-4.5 text-indigo-500" />
                        ) : (
                          <Circle className="w-4.5 h-4.5 text-slate-600" />
                        )}
                      </button>

                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`text-xs font-semibold text-slate-200 truncate ${isCompleted ? 'line-through text-slate-500' : ''}`}>
                            {task.title}
                          </h4>
                          
                          {/* Priority badge */}
                          <span className={`px-1.5 py-0.2 text-[8px] font-mono font-bold rounded ${
                            task.priority === 'Critical' 
                              ? 'bg-rose-950 text-rose-400 border border-rose-500/10' 
                              : task.priority === 'High' 
                                ? 'bg-amber-950 text-amber-400 border border-amber-500/10' 
                                : 'bg-slate-900 text-slate-400 border border-slate-800'
                          }`}>
                            {task.priority}
                          </span>

                          {/* Tag badges */}
                          {task.tags?.slice(0, 2).map((tag, i) => (
                            <span key={i} className="text-[8px] font-mono text-slate-500 px-1 bg-slate-950 rounded-sm">
                              #{tag}
                            </span>
                          ))}

                          {/* Postpone indicator */}
                          {(task.postponeCount || 0) > 0 && (
                            <span className="text-[8px] font-mono text-amber-500 font-bold px-1 bg-amber-950/20 rounded-sm border border-amber-500/10">
                              Postponed {(task.postponeCount || 0)}x
                            </span>
                          )}
                        </div>

                        {/* Estimated Hours & deadline line */}
                        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" /> {task.estimatedHours}h estimated
                          </span>
                          <span className="text-slate-500">•</span>
                          <span>Due {task.deadline}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right action block */}
                    <div className="flex items-center gap-1.5">
                      {/* Postpone button */}
                      {!isCompleted && (
                        <button
                          onClick={() => handlePostponeTaskOneDay(task)}
                          className="px-2 py-1 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-900 font-mono text-[9px] flex items-center gap-1 cursor-pointer transition border border-transparent hover:border-amber-500/15"
                          title="Postpone deadline by 1 day"
                        >
                          <Clock className="w-3 h-3 text-amber-500/70" />
                          <span>Postpone</span>
                        </button>
                      )}

                      {totalSubtasks > 0 && (
                        <button
                          onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-900 font-mono text-[9px] flex items-center gap-1 cursor-pointer"
                        >
                          <span>{completedSubtasks}/{totalSubtasks} steps</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      )}

                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="p-1 text-slate-600 hover:text-rose-400 rounded hover:bg-slate-900/60 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Subtask Section Expandable */}
                  <AnimatePresence>
                    {isExpanded && totalSubtasks > 0 && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="border-t border-slate-850/80 bg-slate-950/40 px-4 py-2.5 space-y-1.5 overflow-hidden"
                      >
                        {task.subtasks.map((sub) => (
                          <div 
                            key={sub.id} 
                            onClick={() => toggleSubtask(task.id, sub.id)}
                            className="flex items-center gap-2.5 text-[11px] py-1 cursor-pointer select-none text-slate-300 hover:text-white"
                          >
                            {sub.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-700 shrink-0" />
                            )}
                            <span className={sub.completed ? 'line-through text-slate-500' : ''}>
                              {sub.title}
                            </span>
                            <span className="text-[9px] font-mono text-slate-600 ml-auto">{sub.estimatedHours}h</span>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
