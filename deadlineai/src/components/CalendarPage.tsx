import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Task, CalendarEvent } from '../types';
import { Calendar, RefreshCw, Clock, Sparkles, Check, CheckSquare, CalendarPlus, ShieldCheck } from 'lucide-react';

interface CalendarPageProps {
  tasks: Task[];
  events: CalendarEvent[];
  onSyncCalendar: () => void;
  syncing: boolean;
  isGoogleConnected: boolean;
  onPublishSchedule: () => void;
}

export default function CalendarPage({ 
  tasks, 
  events, 
  onSyncCalendar, 
  syncing, 
  isGoogleConnected, 
  onPublishSchedule 
}: CalendarPageProps) {
  // Generate days dynamically starting from today
  const weekDays = useMemo(() => {
    const days = [];
    const today = new Date();
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 0; i < 4; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dateVal = String(d.getDate()).padStart(2, '0');
      days.push({
        name: weekdayNames[d.getDay()],
        date: `${year}-${month}-${dateVal}`,
        num: String(d.getDate())
      });
    }
    return days;
  }, []);

  const [activeDate, setActiveDate] = useState(weekDays[0]?.date || new Date().toISOString().split('T')[0]);

  // Filter events of the selected activeDate
  const filteredEvents = events.filter(e => e.start.startsWith(activeDate));

  // Sort events by starting time
  const sortedEvents = [...filteredEvents].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div id="calendar-page" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-medium text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-400" />
            AI Scheduled Calendar
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-400 text-xs">
              Coordinates focus work blocks around standard Google Calendar busy hours.
            </p>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-500 font-mono">
              Status: {isGoogleConnected ? (
                <span className="text-emerald-400 font-bold flex items-center gap-0.5 inline-flex">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> LIVE SYNC
                </span>
              ) : (
                <span className="text-amber-400">SIMULATED</span>
              )}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {isGoogleConnected && events.some(e => e.type === 'task-block') && (
            <button
              onClick={onPublishSchedule}
              disabled={syncing}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium text-xs rounded-xl flex items-center gap-2 transition shrink-0 cursor-pointer shadow-lg hover:shadow-emerald-500/10"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              Publish to Google Calendar
            </button>
          )}
          <button
            onClick={onSyncCalendar}
            disabled={syncing}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium text-xs rounded-xl flex items-center gap-2 transition shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Google Calendar'}
          </button>
        </div>
      </div>

      {/* Date Slide Row Selection slider */}
      <div className="grid grid-cols-4 gap-2 text-center max-w-md">
        {weekDays.map((day) => {
          const selected = activeDate === day.date;
          return (
            <button
              key={day.date}
              onClick={() => setActiveDate(day.date)}
              className={`p-3 rounded-xl border transition flex flex-col items-center justify-center cursor-pointer ${
                selected
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg'
                  : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <span className="text-[10px] uppercase font-mono tracking-wider">{day.name}</span>
              <span className="text-base font-extrabold mt-0.5">{day.num}</span>
            </button>
          );
        })}
      </div>

      {/* Calendar layout content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Core Daily Time Table Agenda */}
        <div className="lg:col-span-2 glass-panel p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-[11px] font-mono tracking-wider uppercase font-bold text-slate-400">Time-Table Blocks</span>
            <span className="text-[10px] text-slate-500">
              {(() => {
                try {
                  return new Date(activeDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                } catch {
                  return activeDate;
                }
              })()}
            </span>
          </div>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {sortedEvents.length === 0 ? (
              <div className="text-center py-16 text-slate-500 space-y-2">
                <p className="text-xs">No entries scheduled for this day yet.</p>
                <button
                  onClick={onSyncCalendar}
                  className="text-[10px] text-indigo-400 hover:underline"
                >
                  Regenerate schedule matrices
                </button>
              </div>
            ) : (
              sortedEvents.map((ev) => {
                const isTaskBlock = ev.type === 'task-block';
                const isSuggested = ev.type === 'suggested';
                
                // Format times e.g. "09:00" from "2026-06-23T09:00:00"
                const startTime = ev.start.split('T')[1]?.slice(0, 5) || '08:00';
                const endTime = ev.end.split('T')[1]?.slice(0, 5) || '09:00';

                return (
                  <div
                    key={ev.id}
                    className={`p-3.5 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isTaskBlock 
                        ? 'border-indigo-500/25 bg-indigo-900/10 hover:border-indigo-500/45' 
                        : isSuggested 
                        ? 'border-emerald-500/20 bg-emerald-950/10 hover:border-emerald-500/40' 
                        : 'border-slate-800 bg-slate-950 text-slate-400'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                          isTaskBlock 
                            ? 'bg-indigo-950 text-indigo-300' 
                            : isSuggested 
                            ? 'bg-emerald-950 text-emerald-400' 
                            : 'bg-slate-900 text-slate-400'
                        }`}>
                          {isTaskBlock ? '📝 FOCUS WORK' : isSuggested ? '⚡ AI SUGGESTION' : '🔒 BUSY EVENT'}
                        </span>
                        <h4 className="text-xs font-semibold text-slate-200">{ev.title}</h4>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Designed around calendar commitments to secure work before milestones.
                      </p>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{startTime} - {endTime}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Side panel: suggested work-block highlights */}
        <div className="glass-panel p-5 space-y-4">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-xs uppercase font-bold font-mono tracking-widest text-slate-100 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" /> Suggested focus areas
            </h3>
          </div>

          <div className="space-y-3.5">
            <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-1.5 hover:border-indigo-500/20 transition">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5 leading-none">
                <Check className="w-3.5 h-3.5 text-emerald-400" /> Prepare for Technical Interview Block
              </h4>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Suggested block: Wednesday at 14:00. You have 2 continuous free hours. High probability of uninterrupted focus!
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-1.5 hover:border-indigo-500/20 transition">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5 leading-none">
                <Check className="w-3.5 h-3.5 text-emerald-400" /> REST / RESET early
              </h4>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Wednesday after 21:00. Clearing tasks before dinnertime secures peaceful hours. Highly recommended!
              </p>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 bg-slate-950/40 p-3 rounded-lg border border-slate-800 leading-relaxed">
            *Google Calendar busy blocks are mapped automatically. Real-time changes in third-party calendar accounts trigger swift reschedules instantly.
          </div>
        </div>

      </div>
    </div>
  );
}
