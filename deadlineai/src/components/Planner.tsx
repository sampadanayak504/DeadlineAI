import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, Clock, Plus, Search, Trash2, Edit3, 
  CheckCircle2, Circle, ChevronLeft, ChevronRight, Bell, RotateCcw, Sparkles 
} from 'lucide-react';
import { Task, Reminder } from '../types';

interface PlannerProps {
  tasks: Task[];
  reminders: Reminder[];
  onAddReminder: (reminder: Omit<Reminder, 'id' | 'completed'>) => Promise<void>;
  onUpdateReminder: (reminder: Reminder) => Promise<void>;
  onDeleteReminder: (id: string) => Promise<void>;
}

export default function Planner({
  tasks,
  reminders = [],
  onAddReminder,
  onUpdateReminder,
  onDeleteReminder
}: PlannerProps) {
  // Navigation / Date States
  const [activeDate, setActiveDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [currentMonthDate, setCurrentMonthDate] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [category, setCategory] = useState('Work');
  const [reminderTiming, setReminderTiming] = useState<any>('15 min');
  const [repeat, setRepeat] = useState<any>('None');

  // Open modal for fresh creation
  const handleOpenCreateModal = () => {
    setEditingReminder(null);
    setTitle('');
    setDescription('');
    setReminderDate(activeDate);
    setStartTime('09:00');
    setEndTime('10:00');
    setPriority('Medium');
    setCategory('Work');
    setReminderTiming('15 min');
    setRepeat('None');
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEditModal = (rem: Reminder) => {
    setEditingReminder(rem);
    setTitle(rem.title);
    setDescription(rem.description);
    setReminderDate(rem.date);
    setStartTime(rem.startTime);
    setEndTime(rem.endTime);
    setPriority(rem.priority);
    setCategory(rem.category);
    setReminderTiming(rem.reminderTiming);
    setRepeat(rem.repeat);
    setIsModalOpen(true);
  };

  // Save / Update logic
  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !reminderDate) return;

    if (editingReminder) {
      const updated: Reminder = {
        ...editingReminder,
        title: title.trim(),
        description: description.trim(),
        date: reminderDate,
        startTime,
        endTime,
        priority,
        category,
        reminderTiming,
        repeat
      };
      await onUpdateReminder(updated);
    } else {
      const created: Omit<Reminder, 'id' | 'completed'> = {
        title: title.trim(),
        description: description.trim(),
        date: reminderDate,
        startTime,
        endTime,
        priority,
        category,
        reminderTiming,
        repeat,
        isManual: true
      };
      await onAddReminder(created);
    }

    setIsModalOpen(false);
  };

  // Drag & Drop event handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetDateStr: string) => {
    e.preventDefault();
    const reminderId = e.dataTransfer.getData('text/plain');
    if (!reminderId) return;

    const matched = reminders.find(r => r.id === reminderId);
    if (matched && matched.date !== targetDateStr) {
      await onUpdateReminder({
        ...matched,
        date: targetDateStr
      });
    }
  };

  // Month Math
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  const getMonthName = () => {
    return currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  // Grid Builder
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const calendarDays: { dateStr: string; dayNum: number; isPadding: boolean }[] = [];

  // Padding from previous month
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const prevM = month === 0 ? 11 : month - 1;
    const prevY = month === 0 ? year - 1 : year;
    const dateStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarDays.push({ dateStr, dayNum: d, isPadding: true });
  }

  // Days of current month
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    calendarDays.push({ dateStr, dayNum: i, isPadding: false });
  }

  // Padding for next month to complete 42-day grid
  const remainingSlots = 42 - calendarDays.length;
  for (let i = 1; i <= remainingSlots; i++) {
    const nextM = month === 11 ? 0 : month + 1;
    const nextY = month === 11 ? year + 1 : year;
    const dateStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    calendarDays.push({ dateStr, dayNum: i, isPadding: true });
  }

  // Helper: Format readable date
  const getFormattedActiveDate = () => {
    const d = new Date(activeDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Filter & Search Logic
  const todayStr = new Date().toISOString().split('T')[0];
  const activeReminders = reminders.filter(r => {
    const matchesDate = r.date === activeDate;
    const matchesSearch = searchQuery 
      ? r.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        r.description.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchesDate && matchesSearch;
  });

  const sortedReminders = [...activeReminders].sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6 relative pb-24">
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-white flex items-center gap-2">
            <Calendar className="w-5.5 h-5.5 text-indigo-400" />
            Interactive Cognitive Planner
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Schedule dynamic reminders, edit timelines, and easily reschedule tasks with real-time Firestore persistence.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-indigo-600/10"
        >
          <Plus className="w-4 h-4" />
          Add Reminder
        </button>
      </div>

      {/* Control Actions Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        {/* Month Picker / Switcher */}
        <div className="flex items-center justify-between bg-[#111317] border border-slate-800 rounded-xl p-2.5 md:col-span-1">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-slate-200 font-mono tracking-wide">{getMonthName()}</span>
          <button
            onClick={handleNextMonth}
            className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative md:col-span-2">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search reminders by keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#111317] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
      </div>

      {/* Interactive Month Grid & Daily Schedule Grid split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Interactive Month Calendar Grid */}
        <div className="lg:col-span-7 bg-[#111317]/40 border border-slate-800/80 rounded-2xl p-4.5 space-y-4">
          <div className="grid grid-cols-7 text-center text-[10px] font-mono uppercase tracking-wider text-slate-500 font-extrabold pb-2 border-b border-slate-800/50">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((day, idx) => {
              const isActive = activeDate === day.dateStr;
              const isToday = todayStr === day.dateStr;
              
              // Count pending reminders for this day
              const dayRems = reminders.filter(r => r.date === day.dateStr);
              const pendingRems = dayRems.filter(r => !r.completed);

              return (
                <div
                  key={`${day.dateStr}-${idx}`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, day.dateStr)}
                  onClick={() => setActiveDate(day.dateStr)}
                  className={`aspect-square relative p-1.5 rounded-xl border flex flex-col justify-between cursor-pointer transition select-none group ${
                    day.isPadding 
                      ? 'bg-transparent border-transparent text-slate-750' 
                      : 'bg-[#111317]/80 hover:bg-slate-900/60'
                  } ${
                    isActive 
                      ? 'border-indigo-500 text-white bg-indigo-950/20 ring-1 ring-indigo-500/35' 
                      : isToday
                      ? 'border-indigo-500/40 text-indigo-400 font-extrabold bg-indigo-950/10'
                      : 'border-slate-850/60 text-slate-300'
                  }`}
                >
                  {/* Day Number */}
                  <span className={`text-xs font-mono font-bold ${day.isPadding ? 'text-slate-600' : ''}`}>
                    {day.dayNum}
                  </span>

                  {/* Indicators */}
                  <div className="flex gap-1 flex-wrap justify-end self-end">
                    {pendingRems.length > 0 ? (
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-md shadow-indigo-500/25 animate-pulse" />
                    ) : dayRems.length > 0 ? (
                      <span className="w-2 h-2 rounded-full bg-slate-600" />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily Schedule Agenda Timeline / List */}
        <div className="lg:col-span-5 bg-[#111317]/40 border border-slate-800/80 rounded-2xl p-5 space-y-4 min-h-[380px] flex flex-col">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/50">
            <span className="text-[10px] font-mono tracking-wider uppercase font-bold text-slate-400">Scheduled Agenda</span>
            <span className="text-xs font-semibold text-slate-300 font-mono text-right truncate ml-2">{getFormattedActiveDate()}</span>
          </div>

          <div className="space-y-3.5 flex-grow overflow-y-auto">
            {sortedReminders.length === 0 ? (
              <div className="text-center py-20 text-slate-500 space-y-3 max-w-xs mx-auto my-auto">
                <Clock className="w-10 h-10 text-slate-700 mx-auto" />
                <div>
                  <h4 className="text-xs font-semibold text-slate-300">No tasks scheduled.</h4>
                  <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                    Add a task manually, click "+ New Reminder", or ask the AI Assistant to schedule your plan.
                  </p>
                </div>
              </div>
            ) : (
              sortedReminders.map((rem) => {
                const isHigh = rem.priority === 'High';
                const isMed = rem.priority === 'Medium';
                
                return (
                  <div
                    key={rem.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, rem.id)}
                    className={`p-3.5 border rounded-xl space-y-3 transition cursor-grab active:cursor-grabbing hover:shadow-lg hover:shadow-slate-950/20 ${
                      rem.completed
                        ? 'border-slate-850/40 bg-[#111317]/20 opacity-55'
                        : isHigh
                        ? 'border-rose-500/20 bg-rose-950/5 hover:border-rose-500/35'
                        : isMed
                        ? 'border-amber-500/15 bg-amber-950/5 hover:border-amber-500/30'
                        : 'border-[#111317] bg-slate-950/40 hover:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <button
                          onClick={() => onUpdateReminder({ ...rem, completed: !rem.completed })}
                          className="mt-0.5 text-slate-600 hover:text-indigo-400 transition cursor-pointer"
                        >
                          {rem.completed ? (
                            <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 shrink-0" />
                          )}
                        </button>
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className={`text-xs font-semibold truncate ${rem.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                              {rem.title}
                            </h4>
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
                          </div>
                          {rem.description && (
                            <p className={`text-[11px] leading-relaxed ${rem.completed ? 'text-slate-600' : 'text-slate-400'}`}>
                              {rem.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2.5 text-[10px] text-slate-500 font-mono">
                            <Clock className="w-3.5 h-3.5 text-slate-600" />
                            <span>{rem.startTime} - {rem.endTime}</span>
                            {rem.repeat !== 'None' && (
                              <span className="bg-indigo-950/60 text-indigo-400 px-1.5 py-0.2 rounded text-[8px] font-mono font-bold">
                                🔁 {rem.repeat}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Item Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenEditModal(rem)}
                          className="p-1.5 hover:bg-[#111317] text-slate-500 hover:text-slate-300 rounded-lg transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteReminder(rem.id)}
                          className="p-1.5 hover:bg-[#111317] text-slate-500 hover:text-rose-400 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Floating "+ New Reminder" Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={handleOpenCreateModal}
          className="p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition shadow-xl shadow-indigo-600/25 hover:shadow-indigo-600/45 cursor-pointer flex items-center justify-center border border-indigo-400/20"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Elegant Modal backdrop & content */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0b0c10] border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-850 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Bell className="w-4.5 h-4.5 text-indigo-400 animate-bounce" />
                  {editingReminder ? 'Modify Scheduled Reminder' : 'Schedule New Reminder'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white transition cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSaveReminder} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-extrabold text-slate-400 tracking-wider">Title</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter reminder title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-extrabold text-slate-400 tracking-wider">Description</label>
                  <textarea
                    placeholder="Enter short description..."
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                {/* Date Picker */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase font-extrabold text-slate-400 tracking-wider">Date</label>
                    <input
                      type="date"
                      required
                      value={reminderDate}
                      onChange={(e) => setReminderDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono scheme-dark"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase font-extrabold text-slate-400 tracking-wider">Start Time</label>
                    <input
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase font-extrabold text-slate-400 tracking-wider">End Time</label>
                    <input
                      type="time"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                {/* Priority Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase font-extrabold text-slate-400 tracking-wider block">Priority</label>
                    <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-850">
                      {(['Low', 'Medium', 'High'] as const).map((p) => {
                        const isSel = priority === p;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPriority(p)}
                            className={`py-1 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer ${
                              isSel 
                                ? p === 'High' 
                                  ? 'bg-rose-500 text-white' 
                                  : p === 'Medium' 
                                  ? 'bg-amber-500 text-slate-950' 
                                  : 'bg-indigo-500 text-white'
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase font-extrabold text-slate-400 tracking-wider">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 scheme-dark cursor-pointer"
                    >
                      <option value="Work">💼 Work</option>
                      <option value="Study">📚 Study</option>
                      <option value="Personal">🏡 Personal</option>
                      <option value="Other">⚡ Other</option>
                    </select>
                  </div>
                </div>

                {/* Reminder Timing & Repeat */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase font-extrabold text-slate-400 tracking-wider">Reminder Alert</label>
                    <select
                      value={reminderTiming}
                      onChange={(e) => setReminderTiming(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 scheme-dark cursor-pointer"
                    >
                      <option value="At due time">At due time</option>
                      <option value="5 min">5 minutes before</option>
                      <option value="10 min">10 minutes before</option>
                      <option value="15 min">15 minutes before</option>
                      <option value="30 min">30 minutes before</option>
                      <option value="1 hour">1 hour before</option>
                      <option value="2 hours">2 hours before</option>
                      <option value="1 day">1 day before</option>
                      <option value="Custom">Custom</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase font-extrabold text-slate-400 tracking-wider">Repeat Interval</label>
                    <select
                      value={repeat}
                      onChange={(e) => setRepeat(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 scheme-dark cursor-pointer"
                    >
                      <option value="None">Does not repeat</option>
                      <option value="Daily">🔁 Daily</option>
                      <option value="Weekly">🔁 Weekly</option>
                      <option value="Monthly">🔁 Monthly</option>
                      <option value="Custom">🔁 Custom Interval</option>
                    </select>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-850">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-transparent hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-lg shadow-indigo-600/10"
                  >
                    {editingReminder ? 'Save Changes' : 'Schedule Reminder'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
