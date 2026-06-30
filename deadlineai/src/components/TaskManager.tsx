import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, Subtask } from '../types';
import { ListTodo, Plus, Sparkles, Trash2, Edit3, Calendar, CheckSquare, Clock, Tag, Brain, ChevronDown, ChevronUp, AlertCircle, RefreshCw, Check, X } from 'lucide-react';

interface TaskManagerProps {
  tasks: Task[];
  onAddTask: (task: Omit<Task, 'id' | 'subtasks'> & { subtasks?: Omit<Subtask, 'id' | 'taskId'>[] }) => void;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onMarkComplete: (taskId: string) => void;
}

export default function TaskManager({ tasks, onAddTask, onUpdateTask, onDeleteTask, onMarkComplete }: TaskManagerProps) {
  const [activeFormTab, setActiveFormTab] = useState<'standard' | 'ai'>('ai');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Manual States
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'Study' | 'Work' | 'Personal' | 'Other'>('Study');
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2); // 2 days from now by default
    return d.toISOString().split('T')[0];
  });
  const [estimatedHours, setEstimatedHours] = useState(2);
  const [priority, setPriority] = useState<'Critical' | 'High' | 'Medium' | 'Low'>('Medium');
  const [tagsInput, setTagsInput] = useState('');
  const [dueTime, setDueTime] = useState('12:00');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTiming, setReminderTiming] = useState<string>('15 min');

  // AI Planner States
  const [aiPrompt, setAiPrompt] = useState('');
  const [planningWithAI, setPlanningWithAI] = useState(false);
  const [aiMessage, setAiMessage] = useState('');

  // AI Phase 3 States: Priority Engine & Subtask Generation
  const [loadingTasksAI, setLoadingTasksAI] = useState<Record<string, boolean>>({});
  const [priorityAdvisories, setPriorityAdvisories] = useState<Record<string, { priority: 'Critical' | 'High' | 'Medium' | 'Low', reasoning: string }>>({});
  const [advisoryError, setAdvisoryError] = useState<Record<string, string>>({});

  // Subtask Edit States
  const [editingSubtaskKey, setEditingSubtaskKey] = useState<string | null>(null); // "taskId_subId"
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");
  const [editingSubtaskHours, setEditingSubtaskHours] = useState(1);

  const handleGenerateSubtasks = async (task: Task) => {
    setLoadingTasksAI(prev => ({ ...prev, [task.id]: true }));
    try {
      const response = await fetch('/api/ai/plan-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: task.title,
          description: task.description,
          deadline: task.deadline
        })
      });
      const data = await response.json();
      if (data && data.subtasks) {
        const taskId = task.id;
        const createdSubtasks = data.subtasks.map((sub: any, idx: number) => ({
          id: `${taskId}-${idx}-${Date.now()}`,
          taskId,
          title: sub.title,
          completed: false,
          estimatedHours: sub.estimatedHours || 0.5
        }));

        onUpdateTask({
          ...task,
          subtasks: createdSubtasks,
          estimatedHours: data.estimatedHours || task.estimatedHours,
          priority: data.priority || task.priority,
          category: data.category || task.category,
          tags: Array.from(new Set([...(task.tags || []), ...(data.tags || [])]))
        });
        setExpandedTaskId(task.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTasksAI(prev => ({ ...prev, [task.id]: false }));
    }
  };

  const handleCalculatePriority = async (task: Task) => {
    setLoadingTasksAI(prev => ({ ...prev, [task.id]: true }));
    setAdvisoryError(prev => ({ ...prev, [task.id]: '' }));
    try {
      const response = await fetch('/api/ai/calculate-priority', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task })
      });
      const data = await response.json();
      if (data && data.priority) {
        setPriorityAdvisories(prev => ({
          ...prev,
          [task.id]: {
            priority: data.priority,
            reasoning: data.reasoning || "Analyzed by Priority Engine."
          }
        }));
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      console.error(err);
      setAdvisoryError(prev => ({ ...prev, [task.id]: 'Priority Engine connection failed.' }));
    } finally {
      setLoadingTasksAI(prev => ({ ...prev, [task.id]: false }));
    }
  };

  const handleApplyPriorityAdvisory = (task: Task) => {
    const advisory = priorityAdvisories[task.id];
    if (!advisory) return;

    onUpdateTask({
      ...task,
      priority: advisory.priority
    });

    setPriorityAdvisories(prev => {
      const copy = { ...prev };
      delete copy[task.id];
      return copy;
    });
  };

  // Handler for custom creation
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    onAddTask({
      title,
      description,
      category,
      deadline,
      estimatedHours: Number(estimatedHours),
      priority,
      tags,
      status: 'Pending',
      subtasks: [],
      dueTime,
      reminderSettings: {
        enabled: reminderEnabled,
        timing: reminderTiming as any
      }
    });

    // Reset Form
    setTitle('');
    setDescription('');
    setTagsInput('');
    setEstimatedHours(2);
    setDueTime('12:00');
    setReminderEnabled(true);
    setReminderTiming('15 min');
  };

  // Handler for Magic AI plan breaking
  const handleAISubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt) return;

    setPlanningWithAI(true);
    setAiMessage("Analyzing goals & requesting Gemini breakdown...");

    try {
      const response = await fetch('/api/ai/plan-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: aiPrompt,
          description: "Decomposed automatically by AI core planner."
        })
      });
      const data = await response.json();

      if (data) {
        onAddTask({
          title: data.title || aiPrompt,
          description: data.description || "Decomposed automatically by AI core planner.",
          category: data.category || 'Study',
          deadline: data.deadline || new Date().toISOString().split('T')[0],
          estimatedHours: data.estimatedHours || 3,
          priority: data.priority || 'High',
          tags: data.tags || ['ai-breakdown'],
          status: 'Pending',
          // convert subtasks
          subtasks: (data.subtasks || []).map((sub: any) => ({
            title: sub.title,
            completed: false,
            estimatedHours: sub.estimatedHours || 0.5
          }))
        });

        setAiMessage("🚀 Successfully parsed! Complete breakdown and schedule mapped.");
        setAiPrompt('');
        setTimeout(() => setAiMessage(''), 3000);
      }
    } catch (err) {
      console.error(err);
      setAiMessage("Failed connecting core agent. Falling back to default baseline blocks.");
    } finally {
      setPlanningWithAI(false);
    }
  };

  const toggleSubtask = (task: Task, subId: string) => {
    const updatedSubtasks = task.subtasks.map(s => {
      if (s.id === subId) {
        return { ...s, completed: !s.completed };
      }
      return s;
    });

    // Check if subtasks are completed, if all completed we could suggest parent complete
    onUpdateTask({
      ...task,
      subtasks: updatedSubtasks
    });
  };

  const handleDeleteSubtask = (task: Task, subId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedSubtasks = task.subtasks.filter(s => s.id !== subId);
    onUpdateTask({
      ...task,
      subtasks: updatedSubtasks
    });
  };

  const handleStartEditSubtask = (task: Task, sub: Subtask, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSubtaskKey(`${task.id}_${sub.id}`);
    setEditingSubtaskTitle(sub.title);
    setEditingSubtaskHours(sub.estimatedHours || 1);
  };

  const handleSaveSubtask = (task: Task, subId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedSubtasks = task.subtasks.map(s => {
      if (s.id === subId) {
        return { ...s, title: editingSubtaskTitle, estimatedHours: Number(editingSubtaskHours) };
      }
      return s;
    });
    onUpdateTask({
      ...task,
      subtasks: updatedSubtasks
    });
    setEditingSubtaskKey(null);
  };

  const handleCancelEditSubtask = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSubtaskKey(null);
  };

  return (
    <div id="task-manager" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left side Creator Panel */}
      <div className="space-y-6">
        <div className="glass-panel p-6 space-y-6">
          <div className="flex border-b border-slate-900 pb-1">
            <button
              onClick={() => setActiveFormTab('ai')}
              className={`flex-1 pb-3 text-xs font-semibold uppercase tracking-widest font-mono border-b-2 transition ${
                activeFormTab === 'ai' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500'
              }`}
            >
              ✨ Magic AI Planner
            </button>
            <button
              onClick={() => setActiveFormTab('standard')}
              className={`flex-1 pb-3 text-xs font-semibold uppercase tracking-widest font-mono border-b-2 transition ${
                activeFormTab === 'standard' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500'
              }`}
            >
              Manual Custom
            </button>
          </div>

          {/* AI breakdown input */}
          {activeFormTab === 'ai' ? (
            <form onSubmit={handleAISubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                  Task description (Natural Language)
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Finish the design API and mock databases for the main project by Friday at midnight"
                  rows={4}
                  required
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-xs text-slate-200 resize-none whitespace-nowrap"
                />
              </div>

              {aiMessage && (
                <div className="flex items-center gap-2 p-3 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-mono text-slate-300">
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                  <span>{aiMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={planningWithAI}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-medium text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-lg hover:shadow-indigo-500/25 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 animate-bounce" />
                {planningWithAI ? "AI Generating..." : "Break Down & Multi-Schedule"}
              </button>
            </form>
          ) : (
            // Standard Manual input form
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Task title"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-xs text-slate-100 placeholder-slate-600 leading-none whitespace-nowrap"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Task objectives"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-xs text-slate-100 placeholder-slate-600 leading-none whitespace-nowrap"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Category</label>
                  <select
                    value={category}
                    onChange={(e: any) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-xs text-slate-300"
                  >
                    <option value="Study">Study</option>
                    <option value="Work">Work</option>
                    <option value="Personal">Personal</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Priority</label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-xs text-slate-300"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Deadline</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-xs text-slate-300 pointer-events-auto cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Due Time</label>
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-xs text-slate-300 pointer-events-auto cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Estimated Hours</label>
                  <input
                    type="number"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-xs text-slate-300 leading-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Reminder Settings</label>
                  <div className="flex items-center gap-2 mt-1.5">
                    <input
                      type="checkbox"
                      id="reminderEnabledTask"
                      checked={reminderEnabled}
                      onChange={(e) => setReminderEnabled(e.target.checked)}
                      className="rounded text-indigo-500 focus:ring-0 focus:ring-offset-0 bg-slate-950 border-slate-800 cursor-pointer w-4 h-4"
                    />
                    <label htmlFor="reminderEnabledTask" className="text-xs text-slate-300 cursor-pointer select-none">
                      Enable Alert
                    </label>
                  </div>
                </div>
              </div>

              {reminderEnabled && (
                <div className="space-y-1 animate-fade-in">
                  <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Reminder Timing</label>
                  <select
                    value={reminderTiming}
                    onChange={(e) => setReminderTiming(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-xs text-slate-300 cursor-pointer"
                  >
                    <option value="At due time">At due time</option>
                    <option value="5 min">5 minutes before</option>
                    <option value="10 min">10 minutes before</option>
                    <option value="15 min">15 minutes before</option>
                    <option value="30 min">30 minutes before</option>
                    <option value="1 hour">1 hour before</option>
                    <option value="2 hours">2 hours before</option>
                    <option value="1 day">1 day before</option>
                  </select>
                </div>
              )}

               <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Tags (Comma-divided)</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g. design, backend, code"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-xs text-slate-300 placeholder-slate-600 leading-none whitespace-nowrap"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl flex items-center justify-center gap-2 transition"
              >
                <Plus className="w-4 h-4" /> Save Task Block
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Right side Task List Dashboard */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-indigo-400" />
            <h2 className="font-display font-medium text-base text-white">Focus Targets Desk</h2>
          </div>
          <span className="text-[10px] font-mono text-slate-500">{tasks.length} Active Items</span>
        </div>

        {tasks.length === 0 ? (
          <div className="glass-panel p-12 text-center text-slate-500 space-y-3">
            <ListTodo className="w-12 h-12 text-slate-700 mx-auto" />
            <p className="text-xs">No active goals found in your current desk workspace.</p>
            <p className="text-[10px] text-slate-600">Use the Left Planner panel to pop your first deliverables catalog!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const completedCount = task.subtasks.filter(s => s.completed).length;
              const hasSubtasks = task.subtasks.length > 0;
              const percent = hasSubtasks ? Math.round((completedCount / task.subtasks.length) * 100) : 0;
              const isExpanded = expandedTaskId === task.id;

              return (
                <div
                  key={task.id}
                  className={`glass-panel border transition-all duration-300 ${
                    task.status === 'Completed' ? 'border-emerald-500/20 bg-slate-900/20' : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Task Head Frame */}
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Status Checkbox */}
                        <button
                          onClick={() => onMarkComplete(task.id)}
                          className={`p-1 rounded-md border text-xs font-mono transition ${
                            task.status === 'Completed'
                              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-indigo-500'
                          }`}
                        >
                          {task.status === 'Completed' ? 'Completed' : 'Pending'}
                        </button>
                        <span className="text-xs font-bold text-white font-display">{task.title}</span>
                      </div>

                      <p className="text-[11px] text-slate-400 max-w-xl">{task.description}</p>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-[8px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 uppercase">
                          {task.category}
                        </span>
                        <span className={`text-[8px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${
                          task.priority === 'Critical' ? 'bg-rose-950/40 border-rose-500/40 text-rose-400 animate-pulse' :
                          task.priority === 'High' ? 'bg-orange-950/40 border-orange-500/40 text-orange-400' :
                          task.priority === 'Medium' ? 'bg-amber-950/40 border-amber-500/40 text-amber-300' :
                          'bg-slate-950 border-slate-800 text-slate-400'
                        }`}>
                          {task.priority || 'Medium'}
                        </span>
                        <span className="text-[8px] font-mono text-indigo-300 bg-indigo-950 border border-indigo-500/25 px-2 py-0.5 rounded flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" /> Due: {task.deadline}
                        </span>
                        <span className="text-[8px] font-mono text-emerald-400 bg-emerald-950 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> {task.estimatedHours} Hours
                        </span>
                      </div>

                      {/* Display tags */}
                      {task.tags && task.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                          {task.tags.map((tag, idx) => (
                            <span key={idx} className="text-[8px] font-mono text-slate-500 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.2">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Priority Engine Advisory Box */}
                      {priorityAdvisories[task.id] && (
                        <div className="mt-3 p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-amber-400 flex items-center gap-1">
                              <Brain className="w-3.5 h-3.5 animate-pulse" /> Priority Engine Recommendation
                            </span>
                            <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-500/30 uppercase">
                              Suggested: {priorityAdvisories[task.id].priority}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-300 leading-relaxed">
                            {priorityAdvisories[task.id].reasoning}
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApplyPriorityAdvisory(task)}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-[9px] uppercase rounded transition cursor-pointer"
                            >
                              Apply Change
                            </button>
                            <button
                              onClick={() => {
                                setPriorityAdvisories(prev => {
                                  const copy = { ...prev };
                                  delete copy[task.id];
                                  return copy;
                                });
                              }}
                              className="px-2.5 py-1 bg-slate-950 hover:bg-slate-900 text-slate-400 font-mono text-[9px] border border-slate-800 rounded transition cursor-pointer"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      )}

                      {advisoryError[task.id] && (
                        <div className="mt-2 text-[10px] text-rose-400 bg-rose-950/25 border border-rose-500/20 p-2.5 rounded-lg">
                          {advisoryError[task.id]}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                      {loadingTasksAI[task.id] && (
                        <div className="flex items-center gap-1 text-[10px] text-indigo-400 font-mono">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>AI Engine...</span>
                        </div>
                      )}

                      {!loadingTasksAI[task.id] && (
                        <>
                          {/* Priority Engine Trigger */}
                          <button
                            onClick={() => handleCalculatePriority(task)}
                            className="p-1 px-2.5 bg-slate-950 hover:bg-slate-900 text-[10px] text-amber-400 border border-amber-500/20 rounded-lg transition flex items-center gap-1 shrink-0 cursor-pointer"
                            title="Consult DeadlineAI Priority Engine"
                          >
                            <Brain className="w-3.5 h-3.5 text-amber-400" />
                            Verify Priority
                          </button>

                          {/* Subtask generation trigger */}
                          <button
                            onClick={() => handleGenerateSubtasks(task)}
                            className="p-1 px-2.5 bg-slate-950 hover:bg-slate-900 text-[10px] text-purple-400 border border-purple-500/20 rounded-lg transition flex items-center gap-1 shrink-0 cursor-pointer"
                            title="Generate AI Planned Subtasks"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                            {hasSubtasks ? 'Regen Plan' : 'Generate Plan'}
                          </button>
                        </>
                      )}

                      {hasSubtasks && (
                        <button
                          onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                          className="p-1 px-2.5 bg-slate-950 hover:bg-slate-900 text-[10px] text-indigo-400 border border-indigo-500/25 rounded-lg transition flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          Subtasks {completedCount}/{task.subtasks.length}
                        </button>
                      )}

                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="p-1.5 border border-slate-850 hover:border-rose-500/30 text-slate-500 hover:text-rose-400 bg-slate-950 rounded-lg hover:bg-rose-950/20 transition shrink-0 cursor-pointer"
                        title="Delete Goal Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progressive Subtasks bar */}
                  {hasSubtasks && !isExpanded && (
                    <div className="px-5 pb-4">
                      <div className="flex justify-between items-center text-[8px] font-mono text-slate-500 mb-1">
                        <span>Milestone Progress</span>
                        <span>{percent}%</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
                        <div className="bg-indigo-500 h-1 rounded-full" style={{ width: `${percent}%` }}></div>
                      </div>
                    </div>
                  )}

                  {/* Expanded Subtask List Grid */}
                  <AnimatePresence>
                    {isExpanded && hasSubtasks && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-slate-800 bg-slate-950/50 overflow-hidden"
                      >
                        <div className="p-4 sm:p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-slate-500">
                              Planned Milestones & Durations
                            </span>
                            <span className="text-[9px] text-slate-500">
                              Total: {task.subtasks.length} tasks
                            </span>
                          </div>

                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {task.subtasks.map((sub) => {
                              const isEditing = editingSubtaskKey === `${task.id}_${sub.id}`;
                              if (isEditing) {
                                return (
                                  <div
                                    key={sub.id}
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-2 border border-indigo-500 bg-slate-900 rounded-lg flex items-center justify-between gap-2"
                                  >
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                      <input
                                        type="text"
                                        value={editingSubtaskTitle}
                                        onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                                        className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-[11px] text-white focus:outline-none"
                                      />
                                      <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        value={editingSubtaskHours}
                                        onChange={(e) => setEditingSubtaskHours(Number(e.target.value))}
                                        className="w-12 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-[11px] text-white text-center focus:outline-none font-mono"
                                      />
                                      <span className="text-[10px] text-slate-500 font-mono">h</span>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      <button
                                        onClick={(e) => handleSaveSubtask(task, sub.id, e)}
                                        className="p-1 bg-indigo-600 hover:bg-indigo-500 rounded text-white cursor-pointer"
                                      >
                                        <Check className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={handleCancelEditSubtask}
                                        className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 cursor-pointer"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={sub.id}
                                  onClick={() => toggleSubtask(task, sub.id)}
                                  className={`group p-2.5 border rounded-lg flex items-center justify-between cursor-pointer transition select-none ${
                                    sub.completed
                                      ? 'border-emerald-500/20 bg-emerald-950/15 text-slate-400'
                                      : 'border-slate-800 hover:border-slate-700 bg-slate-950'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 max-w-[70%]">
                                    <input
                                      type="checkbox"
                                      checked={sub.completed}
                                      readOnly
                                      className="rounded text-indigo-500 focus:ring-0 focus:ring-offset-0 shrink-0 pointer-events-none cursor-pointer"
                                    />
                                    <span className="text-[11px] font-medium leading-none truncate">{sub.title}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[9px] font-mono text-slate-500">⏳ {sub.estimatedHours}h</span>
                                    
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={(e) => handleStartEditSubtask(task, sub, e)}
                                        className="p-0.5 text-slate-400 hover:text-white rounded transition cursor-pointer"
                                        title="Edit milestone"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={(e) => handleDeleteSubtask(task, sub.id, e)}
                                        className="p-0.5 text-slate-400 hover:text-rose-400 rounded transition cursor-pointer"
                                        title="Delete milestone"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Manual inline milestone planner */}
                          <div className="flex gap-2 items-center bg-slate-950 p-2 rounded-lg border border-slate-800">
                            <input
                              type="text"
                              id={`new-subtask-${task.id}`}
                              placeholder="Add custom milestone..."
                              className="flex-1 bg-transparent text-[11px] text-slate-300 focus:outline-none focus:ring-0 placeholder-slate-700 leading-none h-6 whitespace-nowrap"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const target = e.currentTarget;
                                  const subTitle = target.value.trim();
                                  if (subTitle) {
                                    const nextSub = {
                                      id: `${task.id}-sub-${Date.now()}`,
                                      taskId: task.id,
                                      title: subTitle,
                                      completed: false,
                                      estimatedHours: 1
                                    };
                                    onUpdateTask({
                                      ...task,
                                      subtasks: [...task.subtasks, nextSub]
                                    });
                                    target.value = '';
                                  }
                                }
                              }}
                            />
                            <button
                              onClick={() => {
                                const inputEl = document.getElementById(`new-subtask-${task.id}`) as HTMLInputElement;
                                const subTitle = inputEl?.value.trim();
                                if (subTitle) {
                                  const nextSub = {
                                    id: `${task.id}-sub-${Date.now()}`,
                                    taskId: task.id,
                                    title: subTitle,
                                    completed: false,
                                    estimatedHours: 1
                                  };
                                  onUpdateTask({
                                    ...task,
                                    subtasks: [...task.subtasks, nextSub]
                                  });
                                  inputEl.value = '';
                                }
                              }}
                              className="p-1 px-2.5 bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-500/20 rounded-md text-[10px] text-indigo-400 font-mono font-bold uppercase tracking-wider cursor-pointer"
                            >
                              Add Milestone
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
