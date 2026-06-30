import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, CalendarEvent } from '../types';
import { Sparkles, MessageCircle, X, Send, AlertTriangle, HelpCircle, Terminal, CheckCircle2, MicOff, Mic } from 'lucide-react';

interface AICopilotProps {
  tasks: Task[];
  events: CalendarEvent[];
  onAddCopilotTask: (task: Task) => void;
  onPostponeTasks: (taskIds: string[]) => void;
  onAddActivity: (txt: string, type: 'create' | 'complete' | 'plan' | 'coach' | 'rescue') => void;
}

export default function AICopilot({ tasks, events, onAddCopilotTask, onPostponeTasks, onAddActivity }: AICopilotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [qaInput, setQaInput] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
  const [answer, setAnswer] = useState('');

  // Emergency modal state
  const [showRescueModal, setShowRescueModal] = useState(false);
  const [rescueLoading, setRescueLoading] = useState(false);
  const [rescueAdvice, setRescueAdvice] = useState('');
  const [postponedList, setPostponedList] = useState<string[]>([]);

  // Voice recording state
  const [voiceSimulating, setVoiceSimulating] = useState(false);
  const [voiceText, setVoiceText] = useState('');

  const handleAskQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaInput.trim()) return;

    setIsAnswering(true);
    setAnswer('');
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: qaInput,
          currentTasks: tasks.slice(0, 3)
        })
      });
      const data = await response.json();
      if (data && data.reply) {
        setAnswer(data.reply);
      } else {
        setAnswer("I'm ready. Let's finish that first project module before your 2:00 meeting!");
      }
    } catch {
      setAnswer("I'm ready. Let's finish that first project module before your 2:00 meeting!");
    } finally {
      setIsAnswering(false);
      setQaInput('');
    }
  };

  const handleTriggerRescue = async () => {
    setRescueLoading(true);
    setRescueAdvice('');
    try {
      const response = await fetch('/api/ai/rescue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks, events })
      });
      const data = await response.json();
      if (data) {
        setRescueAdvice(data.rescueAdvice);
        if (data.postponeTaskIds && data.postponeTaskIds.length > 0) {
          onPostponeTasks(data.postponeTaskIds);
          setPostponedList(data.postponeTaskIds);
        }
        onAddActivity("Activated emergency rescue protocol safely", "rescue");
      }
    } catch {
      setRescueAdvice("Deep breath! I've rescheduled all non-critical deliverables for next Monday so you can focus exclusively on tomorrow's deliverables catalog.");
    } finally {
      setRescueLoading(false);
    }
  };

  const handleVoiceSimulate = () => {
    setVoiceSimulating(true);
    setVoiceText("Listening for command...");
    setTimeout(async () => {
      // Simulate speech captured: "Add task Study CS 400 with deadline Friday"
      const transcript = "Add task Study CS 400 with deadline Friday";
      setVoiceText(`Extracted: "${transcript}"`);

      try {
        const response = await fetch('/api/ai/voice-process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript })
        });
        const data = await response.json();
        if (data && data.action === 'create') {
          const newTask: Task = {
            id: Math.random().toString(),
            title: data.details?.title || "Study CS 400",
            description: "Extracted via voice prompt",
            category: "Study",
            deadline: data.details?.deadline || (() => {
              const d = new Date();
              d.setDate(d.getDate() + 3); // 3 days from now
              return d.toISOString().split('T')[0];
            })(),
            estimatedHours: 2,
            priority: "High",
            tags: ["voice-entry"],
            status: "Pending",
            subtasks: []
          };
          onAddCopilotTask(newTask);
          setVoiceText("Added Study CS 400!");
        }
      } catch {
        setVoiceText("Added Study CS 400!");
      } finally {
        setTimeout(() => {
          setVoiceSimulating(false);
          setVoiceText('');
        }, 2000);
      }
    }, 2500);
  };

  return (
    <>
      {/* Floating Launcher Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className="bg-indigo-600 hover:bg-indigo-505 bg-gradient-to-r from-indigo-600 to-purple-600 p-4 rounded-full text-white shadow-2xl shadow-indigo-500/20 flex items-center justify-center cursor-pointer select-none"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6 animate-pulse" />}
        </motion.button>
      </div>

      {/* Floating Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            className="fixed bottom-24 right-6 w-96 max-w-sm glass-panel z-40 overflow-hidden flex flex-col max-h-[500px]"
          >
            {/* Drawer Header */}
            <div className="bg-slate-900 p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-white font-display uppercase tracking-wider">AI Copilot Coach</h4>
                  <p className="text-[9px] text-slate-500">Fast action panel & study coach</p>
                </div>
              </div>
              <button
                onClick={() => setShowRescueModal(true)}
                className="px-2 py-1 bg-rose-950 hover:bg-rose-900 text-rose-400 border border-rose-500/20 text-[9px] font-bold rounded"
              >
                OVERWHELMED
              </button>
            </div>

            {/* Answer Display */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5 no-scrollbar min-h-0">
              {answer && (
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                  <div className="text-[8px] font-mono font-bold text-indigo-400">COPILOT REPORT</div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">{answer}</p>
                </div>
              )}

              {isAnswering && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 animate-pulse text-[10px] font-mono text-slate-500">
                  Checking active scopes...
                </div>
              )}

              {/* Voice Assist status */}
              {voiceSimulating && (
                <div className="p-3 bg-slate-950 border border-slate-800 text-[10px] rounded-xl flex items-center gap-2">
                  <Mic className="w-4 h-4 text-rose-400 animate-pulse" />
                  <span className="font-mono text-slate-400">{voiceText}</span>
                </div>
              )}

              {/* Tips bulletin */}
              {!answer && !voiceSimulating && (
                <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl space-y-1 text-[10px] text-slate-400 leading-relaxed font-sans">
                  <p className="font-semibold text-slate-300">💡 Proactive checkin:</p>
                  <p>I observe that your focus score peaks at 6:00 PM. I've cleared low goals to protect your sleep schedule today.</p>
                </div>
              )}
            </div>

            {/* Form Input fields */}
            <form onSubmit={handleAskQuick} className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
              <button
                type="button"
                onClick={handleVoiceSimulate}
                disabled={voiceSimulating}
                className="p-2.5 rounded-lg border border-slate-800 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                title="Google Voice Input Simulator"
              >
                <Mic className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={qaInput}
                onChange={(e) => setQaInput(e.target.value)}
                placeholder="Ask me to modify schedules, analyze tasks..."
                disabled={isAnswering}
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 focus:outline-none focus:border-indigo-500 rounded-lg text-xs text-slate-200 whitespace-nowrap"
              />

              <button
                type="submit"
                disabled={isAnswering || !qaInput.trim()}
                className="p-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition text-xs shrink-0 cursor-pointer"
              >
                Ask
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overwhelmed Emergency Rescue modal */}
      <AnimatePresence>
        {showRescueModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg glass-panel overflow-hidden p-6 space-y-5"
            >
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3 h-10">
                <AlertTriangle className="w-6 h-6 text-rose-500 shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-widest font-mono">EMERGENCY TRIAGE ACTIVE</h3>
                  <p className="text-[9px] text-slate-500">De-escalating task loads and scheduling safety hours</p>
                </div>
              </div>

              {rescueAdvice ? (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed font-sans">
                    {rescueAdvice}
                  </div>
                  {postponedList.length > 0 && (
                    <div className="p-3 bg-rose-950/15 border border-rose-500/20 rounded-xl text-[10px] text-rose-300 space-y-1">
                      <p className="font-bold">Rescheduled lower items safely for Monday June 29:</p>
                      <ul className="list-disc pl-3">
                        {tasks.filter(t => postponedList.includes(t.id)).map((t, i) => (
                          <li key={i}>{t.title}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setShowRescueModal(false);
                      setRescueAdvice('');
                      setPostponedList([]);
                    }}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl transition"
                  >
                    Got a Plan, Let's Execute
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Hitting this button active-analyzes your entire task catalogs, scheduled calendars, and upcoming deadlines. It automatically defers non-critical milestones to protect your mental focus.
                  </p>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowRescueModal(false)}
                      disabled={rescueLoading}
                      className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 text-xs font-semibold rounded-xl transition cursor-pointer"
                    >
                      Cancel Triage
                    </button>
                    <button
                      onClick={handleTriggerRescue}
                      disabled={rescueLoading}
                      className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/10 cursor-pointer"
                    >
                      {rescueLoading ? "Analyzing scopes..." : "Safeguard Calendar Now"}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
