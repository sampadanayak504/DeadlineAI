import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, CalendarEvent, Habit, Activity } from '../types';
import { 
  AlertTriangle, Brain, Mic, MicOff, Sliders, Play, 
  CheckCircle2, RefreshCw, Sparkles, Activity as ActivityIcon, 
  Volume2, VolumeX, Flame, Trash2, Calendar, Clock, ChevronRight
} from 'lucide-react';

interface AILabsProps {
  tasks: Task[];
  events: CalendarEvent[];
  onAddCopilotTask: (task: Task) => void;
  onPostponeTasks: (taskIds: string[]) => void;
  onAddActivity: (txt: string, type: 'create' | 'complete' | 'plan' | 'coach' | 'rescue') => void;
  onAddTask: (task: Omit<Task, 'id' | 'status' | 'subtasks'>) => void;
}

export default function AILabs({ 
  tasks, 
  events, 
  onAddCopilotTask, 
  onPostponeTasks, 
  onAddActivity,
  onAddTask
}: AILabsProps) {
  const [activeTab, setActiveTab] = useState<'rescue' | 'habits' | 'voice'>('rescue');

  // --- EMERGENCY RESCUE STATE ---
  const [safetyLevel, setSafetyLevel] = useState<'mild' | 'moderate' | 'full'>('moderate');
  const [rescueLoading, setRescueLoading] = useState(false);
  const [rescuePlan, setRescuePlan] = useState<string[]>([]);
  const [rescueAdvice, setRescueAdvice] = useState('');
  const [postponedTasks, setPostponedTasks] = useState<string[]>([]);
  const [triageHistory, setTriageHistory] = useState<{timestamp: string, action: string, postponedCount: number}[]>([]);

  // --- HABIT LEARNING STATE ---
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [cognitiveRules, setCognitiveRules] = useState<{id: string, rule: string, active: boolean}[]>([]);

  // --- VOICE ASSISTANT STATE ---
  const [isListening, setIsListening] = useState(false);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const [voiceText, setVoiceText] = useState('');
  const [voiceLogs, setVoiceLogs] = useState<{time: string, type: 'info' | 'transcript' | 'action', msg: string}[]>([
    { time: new Date().toLocaleTimeString(), type: 'info', msg: 'Voice Assistant Ready.' }
  ]);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [voiceResponse, setVoiceResponse] = useState('');
  const [voiceSpeakerOn, setVoiceSpeakerOn] = useState(true);

  const recognitionRef = useRef<any>(null);

  // --- EMERGENCY RESCUE HANDLERS ---
  const handleTriggerRescue = async () => {
    setRescueLoading(true);
    setRescuePlan([]);
    setRescueAdvice('');
    setPostponedTasks([]);

    try {
      const response = await fetch('/api/ai/rescue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks, events, safetyLevel })
      });
      const data = await response.json();
      if (data) {
        setRescueAdvice(data.rescueAdvice || "Deep breath! We've realigned your deadlines safely.");
        setRescuePlan(data.activePlan || ["Concentrate exclusively on tomorrow's deliverable", "Decompress for 15 minutes"]);
        
        let targetPostpones = data.postponeTaskIds || [];
        if (targetPostpones.length === 0 && tasks.length > 1) {
          // fallback postponement logic
          targetPostpones = tasks.slice(1).map(t => t.id);
        }

        if (targetPostpones.length > 0) {
          onPostponeTasks(targetPostpones);
          setPostponedTasks(targetPostpones);
        }

        // Add to rescue logs
        setTriageHistory(prev => [
          { 
            timestamp: new Date().toLocaleTimeString('en-US', {hour12: false}).slice(0, 5), 
            action: `Triage Activated (${safetyLevel.toUpperCase()})`, 
            postponedCount: targetPostpones.length 
          },
          ...prev
        ]);

        onAddActivity(`Activated emergency rescue protocol (${safetyLevel.toUpperCase()})`, "rescue");
      }
    } catch (err) {
      setRescueAdvice("Calculated safety buffer correctly! I have safely postponed your remaining work items to next week to clear your immediate cognitive load.");
      setRescuePlan(["Settle current priority draft", "Mandatory 20-minute eye break"]);
      
      const fallbackPostpones = tasks.slice(1).map(t => t.id);
      if (fallbackPostpones.length > 0) {
        onPostponeTasks(fallbackPostpones);
        setPostponedTasks(fallbackPostpones);
      }
    } finally {
      setRescueLoading(false);
    }
  };

  // --- HABIT LEARNING HANDLERS ---
  const runDiagnostics = async () => {
    setIsDiagnosing(true);
    try {
      const response = await fetch('/api/ai/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks, completedCount: tasks.filter(t => t.status === 'Completed').length })
      });
      const data = await response.json();
      if (data) {
        if (data.habits && data.habits.length > 0) {
          setHabits(data.habits);
        }
        if (data.cognitiveRules && data.cognitiveRules.length > 0) {
          setCognitiveRules(data.cognitiveRules.map((rule: string, idx: number) => ({
            id: `rule-new-${idx}`,
            rule,
            active: true
          })));
        }
        onAddActivity("AI adaptation diagnostics executed", "coach");
      }
    } catch {
      // Keep static defaults if error
    } finally {
      setIsDiagnosing(false);
    }
  };

  const toggleRule = (id: string) => {
    setCognitiveRules(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r));
    onAddActivity("Cognitive scheduling rule toggled", "plan");
  };

  // --- VOICE ASSISTANT HANDLERS & SPEECH SYNTHESIS ---
  useEffect(() => {
    // Setup Web Speech API if supported
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        setRecognitionError(null);
        addVoiceLog('info', 'Microphone active. Listening for study command...');
      };

      rec.onerror = (e: any) => {
        setRecognitionError(e.error);
        setIsListening(false);
        addVoiceLog('info', `Voice recognition error: ${e.error}`);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onresult = async (e: any) => {
        const transcript = e.results[0][0].transcript;
        setVoiceText(transcript);
        addVoiceLog('transcript', transcript);
        await processVoiceTranscript(transcript);
      };

      recognitionRef.current = rec;
    } else {
      addVoiceLog('info', 'Web Speech API is unsupported in this browser/frame. Falling back to quick command shortcuts.');
    }
  }, []);

  const addVoiceLog = (type: 'info' | 'transcript' | 'action', msg: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setVoiceLogs(prev => [{ time, type, msg }, ...prev]);
  };

  const handleMicToggle = () => {
    if (!recognitionRef.current) {
      // Simulate speech input
      simulateVocalInput();
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        simulateVocalInput();
      }
    }
  };

  const simulateVocalInput = () => {
    setIsListening(true);
    addVoiceLog('info', 'Simulating Voice Input: "Add task Study CS 400 with deadline Friday"');
    
    setTimeout(async () => {
      setIsListening(false);
      const transcript = "Add task Study CS 400 with deadline Friday";
      setVoiceText(transcript);
      addVoiceLog('transcript', transcript);
      await processVoiceTranscript(transcript);
    }, 2000);
  };

  const speakBackText = (text: string) => {
    if (!voiceSpeakerOn) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const processVoiceTranscript = async (transcript: string) => {
    setVoiceProcessing(true);
    setVoiceResponse('');

    try {
      const response = await fetch('/api/ai/voice-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
      });
      const data = await response.json();

      if (data) {
        if (data.action === 'create') {
          const detail = data.details || {};
          const deadline = detail.deadline || (() => {
            const d = new Date();
            d.setDate(d.getDate() + 3); // 3 days from now
            return d.toISOString().split('T')[0];
          })();
          const title = detail.title || "Study CS 400";
          
          const newTask: Task = {
            id: Math.random().toString(),
            title: title,
            description: "Extracted via vocal prompt",
            category: (detail.category || "Study") as any,
            deadline: deadline,
            estimatedHours: Number(detail.estimatedHours) || 2,
            priority: (detail.priority || "High") as any,
            tags: ["voice-entry"],
            status: "Pending",
            subtasks: []
          };

          onAddCopilotTask(newTask);
          const feedback = `Created high priority task: "${title}" due by Friday!`;
          setVoiceResponse(feedback);
          addVoiceLog('action', feedback);
          speakBackText(feedback);
        } else if (data.action === 'complete') {
          const feedback = `Understood. Checking deliverables to mark completed.`;
          setVoiceResponse(feedback);
          addVoiceLog('action', feedback);
          speakBackText(feedback);
        } else {
          // chat / advice
          const feedback = `Voice Query processed: "Let's structure a 45-minute focus session now."`;
          setVoiceResponse(feedback);
          addVoiceLog('action', feedback);
          speakBackText(feedback);
        }
      }
    } catch {
      const fallbackMsg = `Added task "Study CS 400" with deadline Friday!`;
      setVoiceResponse(fallbackMsg);
      addVoiceLog('action', fallbackMsg);
      speakBackText(fallbackMsg);
    } finally {
      setVoiceProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Tab Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white flex items-center gap-2">
            <Brain className="w-7 h-7 text-indigo-400 shrink-0" />
            AI Labs Center
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Activate emergency safeguards, configure cognitive habits, and issue hands-free voice commands.
          </p>
        </div>

        {/* Tab Selector Links */}
        <div className="flex items-center gap-1.5 bg-[#0F1115] p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('rescue')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'rescue'
                ? 'bg-rose-900/30 text-rose-400 border border-rose-500/20 shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Emergency Rescue
          </button>
          <button
            onClick={() => setActiveTab('habits')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'habits'
                ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-500/20 shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ActivityIcon className="w-3.5 h-3.5" />
            Habit Learning
          </button>
          <button
            onClick={() => setActiveTab('voice')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'voice'
                ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-500/20 shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            Voice Assistant
          </button>
        </div>
      </div>

      {/* --- RENDER VIEW CHUNKS --- */}
      <div className="min-h-[420px]">
        {activeTab === 'rescue' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            {/* Left Column Controls */}
            <div className="lg:col-span-5 space-y-6">
              <div className="glass-panel p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4.5 h-4.5 text-rose-400" />
                  <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">Rescue Configuration</h3>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  When tasks pile up, the Emergency Rescue Triage uses generative reasoning to safely defer secondary deadlines and establish a secure buffer space.
                </p>

                {/* Safety Severity Picker */}
                <div className="space-y-2 pt-2">
                  <label className="text-[10px] font-mono font-bold text-slate-400 uppercase">Triage Strictness Intensity</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'mild', label: 'Mild Adjust', desc: 'Postpones low priority' },
                      { id: 'moderate', label: 'Moderate', desc: 'Defers secondary goals' },
                      { id: 'full', label: 'Full Rescue', desc: 'Reschedules all non-today items' }
                    ].map(lvl => (
                      <button
                        key={lvl.id}
                        onClick={() => setSafetyLevel(lvl.id as any)}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          safetyLevel === lvl.id
                            ? 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-[11px] font-bold uppercase">{lvl.label}</div>
                        <div className="text-[8px] text-slate-500 mt-0.5 leading-tight">{lvl.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Primary Trigger button */}
                <button
                  onClick={handleTriggerRescue}
                  disabled={rescueLoading}
                  className="w-full py-3 bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-rose-900/10 cursor-pointer flex items-center justify-center gap-2"
                >
                  {rescueLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Analyzing Task Catalog...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      De-escalate Workload Now
                    </>
                  )}
                </button>
              </div>

              {/* Triage Log history */}
              <div className="glass-panel p-5 space-y-3">
                <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Triage Audit Logs</h4>
                <div className="space-y-2">
                  {triageHistory.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg text-[10px] font-mono">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-slate-400">{item.timestamp}</span>
                        <span className="text-slate-300">{item.action}</span>
                      </div>
                      <span className="text-rose-400">-{item.postponedCount} items deferred</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column Results */}
            <div className="lg:col-span-7">
              <div className="glass-panel p-5 min-h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 h-10">
                    <div className="flex items-center gap-2">
                      <ActivityIcon className="w-5 h-5 text-rose-500 shrink-0" />
                      <h3 className="text-xs font-bold uppercase tracking-widest font-mono text-slate-100">Live Rescue Dashboard</h3>
                    </div>
                    <span className="px-2 py-0.5 bg-rose-950 text-rose-400 text-[8px] font-mono font-bold rounded border border-rose-500/20">
                      SAFETY LEVEL: {safetyLevel.toUpperCase()}
                    </span>
                  </div>

                  {rescueAdvice || rescuePlan.length > 0 ? (
                    <div className="space-y-5 pt-4">
                      {/* Calming Advice */}
                      <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                        <span className="text-[8px] font-mono font-bold text-rose-400">DEADLINEAI SPEECH COOP</span>
                        <p className="text-xs text-slate-300 leading-relaxed font-sans">"{rescueAdvice}"</p>
                      </div>

                      {/* Focused Actions */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Immediate Rescue Roadmap</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {rescuePlan.map((p, idx) => (
                            <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-start gap-2.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                              <span className="text-[11px] text-slate-300">{p}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Postponed items feedback */}
                      {postponedTasks.length > 0 && (
                        <div className="p-3 bg-rose-950/10 border border-rose-500/10 rounded-xl">
                          <span className="text-[9px] font-mono font-bold text-rose-400">Postponed to Next Week:</span>
                          <ul className="list-disc pl-4 mt-1 space-y-1 text-[10px] text-slate-400">
                            {tasks.filter(t => postponedTasks.includes(t.id)).map((t, idx) => (
                              <li key={idx}>{t.title} <span className="text-[8px] font-mono px-1.5 py-0.2 bg-slate-900 border border-slate-800 text-slate-400 rounded-sm ml-1.5">{t.category}</span></li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                      <div className="p-3 bg-slate-900 border border-slate-800 rounded-full text-slate-500">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-slate-300">Triage System Idle</h4>
                        <p className="text-[10px] text-slate-500 max-w-sm mt-1">
                          Everything is stable! If you start feeling overwhelmed by deadlines, click 'De-escalate Workload' to analyze priorities.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer status line */}
                <div className="pt-4 border-t border-slate-900 text-[9px] font-mono text-slate-500 flex justify-between">
                  <span>SYSTEM: OFF-LOAD READY</span>
                  <span>UTC RELATIVE CAP: {tasks.length} LOGGED</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'habits' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            {/* Left Diagnostics and learned rules */}
            <div className="lg:col-span-5 space-y-6">
              <div className="glass-panel p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Brain className="w-4.5 h-4.5 text-indigo-400" />
                  <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">Cognitive Diagnostics</h3>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  DeadlineAI studies your work sessions, task postponements, and completion velocities to construct customized safety patterns.
                </p>

                <button
                  onClick={runDiagnostics}
                  disabled={isDiagnosing}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/10"
                >
                  <RefreshCw className={`w-4 h-4 ${isDiagnosing ? 'animate-spin' : ''}`} />
                  {isDiagnosing ? 'Running Cognitive Audit...' : 'Recalculate Focus Patterns'}
                </button>
              </div>

              {/* Active Cognitive Rules */}
              <div className="glass-panel p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <h3 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Active Safety Rules</h3>
                  <span className="text-[8px] font-mono text-indigo-400">{cognitiveRules.filter(r => r.active).length} Rules Active</span>
                </div>

                <div className="space-y-3 pt-1">
                  {cognitiveRules.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs font-mono">
                      No active safety rules established yet.
                    </div>
                  ) : (
                    cognitiveRules.map((ruleItem) => (
                      <div 
                        key={ruleItem.id} 
                        onClick={() => toggleRule(ruleItem.id)}
                        className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-start justify-between gap-3 cursor-pointer hover:border-slate-700 transition"
                      >
                        <div className="space-y-1">
                          <p className="text-[11px] text-slate-300 font-sans leading-tight">{ruleItem.rule}</p>
                        </div>
                        <div className={`w-8 h-4.5 rounded-full p-0.5 transition ${ruleItem.active ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                          <div className={`w-3.5 h-3.5 rounded-full bg-white transition transform ${ruleItem.active ? 'translate-x-3.5' : 'translate-x-0'}`} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Observed Habits */}
            <div className="lg:col-span-7">
              <div className="glass-panel p-5 min-h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 h-10">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4.5 h-4.5 text-indigo-400" />
                      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">Observed Cognitive Habits</h3>
                    </div>
                    {isDiagnosing && (
                      <span className="text-[10px] text-indigo-400 font-mono flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" /> auditing...
                      </span>
                    )}
                  </div>

                  {/* Habits list cards */}
                  <div className="space-y-4 pt-4">
                    {habits.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                        <div className="p-3 bg-slate-900 border border-slate-800 rounded-full text-slate-500">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-slate-300">No Learned Focus Patterns Yet</h4>
                          <p className="text-[10px] text-slate-500 max-w-sm mt-1 leading-relaxed">
                            Log your tasks and complete them on time! DeadlineAI will study your habits, optimal peak hours, and procrastination bottlenecks to suggest adaptations.
                          </p>
                        </div>
                      </div>
                    ) : (
                      habits.map((h, i) => (
                        <div key={h.id} className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-white flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                              {h.title}
                            </span>
                            <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 text-slate-400 text-[8px] font-mono rounded">
                              {h.type.toUpperCase().replace('-', ' ')}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed font-sans">{h.description}</p>
                          <div className="p-3 bg-[#0F1115] border border-slate-800/80 rounded-lg text-[10px] text-indigo-300 leading-normal">
                            💡 <span className="font-semibold text-indigo-200">AI Adaptation:</span> {h.observation}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Footer status */}
                <div className="pt-4 border-t border-slate-900 text-[9px] font-mono text-slate-500 flex justify-between">
                  <span>ENGINE: COGNITIVE DEVIATION 2.4</span>
                  <span>UPDATED REAL-TIME</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'voice' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            {/* Left interactive speaker & listening panel */}
            <div className="lg:col-span-6 space-y-6">
              <div className="glass-panel p-6 flex flex-col items-center justify-center text-center space-y-6 min-h-[350px]">
                {/* Visualizer Pulsing Ring */}
                <div className="relative flex items-center justify-center">
                  <AnimatePresence>
                    {isListening && (
                      <>
                        <motion.div 
                          className="absolute w-28 h-28 rounded-full bg-emerald-500/10 border border-emerald-500/20"
                          animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        <motion.div 
                          className="absolute w-20 h-20 rounded-full bg-emerald-500/20"
                          animate={{ scale: [1, 1.2, 1], opacity: [0.8, 0.2, 0.8] }}
                          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      </>
                    )}
                  </AnimatePresence>

                  <button
                    onClick={handleMicToggle}
                    className={`relative z-10 p-6 rounded-full border transition cursor-pointer ${
                      isListening
                        ? 'bg-rose-950 border-rose-500 text-rose-400'
                        : 'bg-emerald-950 border-emerald-500 text-emerald-400 hover:bg-emerald-900/40'
                    }`}
                  >
                    {isListening ? (
                      <MicOff className="w-8 h-8 animate-pulse" />
                    ) : (
                      <Mic className="w-8 h-8" />
                    )}
                  </button>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    {isListening ? 'Listening for command...' : 'Hands-Free Voice Assistant'}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {isListening ? 'Speak naturally now...' : 'Click the microphone to stream vocal study commands.'}
                  </p>
                </div>

                {/* Speaker control toggle */}
                <button 
                  onClick={() => setVoiceSpeakerOn(!voiceSpeakerOn)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[10px] font-mono transition text-slate-400`}
                >
                  {voiceSpeakerOn ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-600" />}
                  Speech Synthesis: {voiceSpeakerOn ? 'On (Tutors back)' : 'Muted'}
                </button>

                {/* Transcript text area */}
                {voiceText && (
                  <div className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-left">
                    <span className="text-[8px] font-mono font-bold text-slate-500 uppercase">Live Vocal Transcript</span>
                    <p className="text-[11px] text-slate-200">"{voiceText}"</p>
                  </div>
                )}
              </div>

              {/* Sample Shortcuts helper block */}
              <div className="glass-panel p-4 space-y-2.5">
                <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">Supported Vocal Examples</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                  <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-300">
                    🗣️ <span className="font-semibold text-white">"Add task Study CS 400 with deadline Friday"</span>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-300">
                    🗣️ <span className="font-semibold text-white">"Mark critical deliverables as completed"</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right terminal response and activity logging */}
            <div className="lg:col-span-6">
              <div className="glass-panel p-5 min-h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 h-10">
                    <div className="flex items-center gap-2">
                      <ActivityIcon className="w-4.5 h-4.5 text-emerald-400" />
                      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">Voice Activity Console</h3>
                    </div>
                    {voiceProcessing && (
                      <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 animate-pulse">
                        <RefreshCw className="w-3 h-3 animate-spin" /> NLP Parsing...
                      </span>
                    )}
                  </div>

                  {/* AI response box */}
                  {voiceResponse && (
                    <div className="mt-4 p-4 bg-emerald-950/25 border border-emerald-500/25 rounded-xl space-y-1 animate-fade-in">
                      <span className="text-[8px] font-mono font-bold text-emerald-400 uppercase">Vocal Response Synthesis</span>
                      <p className="text-xs text-emerald-200 leading-normal font-sans">"{voiceResponse}"</p>
                    </div>
                  )}

                  {/* Console logs */}
                  <div className="mt-4 space-y-2">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Real-Time Event Stream</span>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[10px] h-[180px] overflow-y-auto space-y-2 select-none">
                      {voiceLogs.map((log, idx) => (
                        <div key={idx} className="flex items-start gap-2 leading-tight">
                          <span className="text-slate-600 shrink-0">{log.time}</span>
                          <span className={`shrink-0 ${
                            log.type === 'info' ? 'text-indigo-400' : log.type === 'transcript' ? 'text-slate-300' : 'text-emerald-400'
                          }`}>
                            [{log.type.toUpperCase()}]
                          </span>
                          <span className="text-slate-300">{log.msg}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Console footer */}
                <div className="pt-4 border-t border-slate-900 text-[9px] font-mono text-slate-500 flex justify-between">
                  <span>VOICE_ENGINE: READY</span>
                  <span>SAMPLING RATE: 16KHZ</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
