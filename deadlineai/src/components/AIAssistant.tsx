import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatMessage, Task } from '../types';
import { 
  Sparkles, Send, Mic, MicOff, Clock, HelpCircle, 
  ArrowRight, MessageSquare, Terminal, HelpCircle as HelpIcon, CheckCircle2 
} from 'lucide-react';

interface AIAssistantProps {
  tasks: Task[];
  chatHistory: ChatMessage[];
  onSendMessage: (msg: string) => Promise<void>;
  sendingMessage: boolean;
  onAddTask: (task: Task) => void;
  onUpdateTask: (task: Task) => void;
  onAddActivity: (text: string, type: 'create' | 'complete' | 'plan' | 'coach' | 'rescue') => void;
}

export default function AIAssistant({
  tasks,
  chatHistory,
  onSendMessage,
  sendingMessage,
  onAddTask,
  onUpdateTask,
  onAddActivity
}: AIAssistantProps) {
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Mic simulation states
  const [isRecording, setIsRecording] = useState(false);

  const quickPrompts = [
    { title: "What should I focus on first?", prompt: "Analyze my current list of tasks. Based on deadlines and effort, what is my absolute primary target to start now?" },
    { title: "How are my deadlines looking?", prompt: "Give me an honest overview of my approaching deadlines and suggest focus intervals to keep me from falling behind." },
    { title: "Add a task using AI", prompt: "Add a high priority Study task 'Draft OS Chapter 4 paper' with estimated 3 hours due this Friday" },
    { title: "Explain scheduler algorithms", prompt: "How does the DeadlineAI scheduler select the best times to block task slots?" }
  ];

  const handleSend = async (text: string) => {
    if (!text.trim() || sendingMessage) return;
    setInput('');

    // Check if the user is typing an agent command like "add task"
    const lower = text.toLowerCase().trim();
    if (lower.startsWith('add task ') || lower.startsWith('create task ')) {
      // Simulate/Trigger agentic natural language extraction
      onAddActivity(`Parsing natural language task prompt...`, "plan");
      try {
        const response = await fetch('/api/ai/nl-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        const data = await response.json();
        if (data && data.tasks && data.tasks.length > 0) {
          const t = data.tasks[0];
          const newTaskId = Math.random().toString();
          const newTask: Task = {
            id: newTaskId,
            title: t.title || "Extracted Task",
            description: t.description || "Auto-extracted with AI Assistant Core",
            category: t.category || "Study",
            deadline: t.deadline || new Date().toISOString().split('T')[0],
            estimatedHours: t.estimatedHours || 2,
            priority: t.priority || "High",
            tags: t.tags || ["voice-command"],
            status: "Pending",
            subtasks: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            reminderSettings: { enabled: true, timing: '15 min' }
          };
          onAddTask(newTask);
          onAddActivity(`Agent successfully created task: ${newTask.title}`, "create");
          
          // Add system response in chat
          await onSendMessage(text);
          return;
        }
      } catch (err) {
        console.error("Local NL task creation failed, proceeding to chat fallback:", err);
      }
    }

    await onSendMessage(text);
  };

  const handleVoiceSimulate = () => {
    if (isRecording) {
      setIsRecording(false);
    } else {
      setIsRecording(true);
      setTimeout(() => {
        setIsRecording(false);
        const voiceOptions = [
          "What is my absolute primary target to start now?",
          "How are my deadlines looking?",
          "Add task Draft OS Chapter 4 paper due Friday"
        ];
        const randomTxt = voiceOptions[Math.floor(Math.random() * voiceOptions.length)];
        setInput(randomTxt);
      }, 2500);
    }
  };

  // Scroll to bottom on chats
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, sendingMessage]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 h-[calc(100vh-130px)] flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3 shrink-0">
        <div className="p-2 bg-indigo-950 border border-indigo-500/10 text-indigo-400 rounded-xl">
          <Terminal className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-slate-100 uppercase tracking-widest font-mono flex items-center gap-1.5">
            Agentic Assistant Core <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
          </h1>
          <p className="text-slate-500 text-[10px]">Context-aware execution. Type answers, ask questions, or issue scheduling updates.</p>
        </div>
      </div>

      {/* Primary chat matrix */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Chats body */}
        <div className="lg:col-span-3 glass-panel flex flex-col min-h-0 bg-slate-950/40">
          <div className="flex-grow overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
            {chatHistory.length === 0 ? (
              <div className="text-center py-16 text-slate-505 space-y-4 max-w-md mx-auto">
                <Sparkles className="w-10 h-10 text-indigo-500/30 mx-auto animate-pulse" />
                <h3 className="text-sm font-bold text-slate-300">How can I assist your workflow today?</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  I monitor your tasks, subtasks, and calendar events in real-time. You can ask me to analyze load factors, suggest study slots, or deconstruct heavy tasks.
                </p>

                {/* Quick prompts block */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left pt-2">
                  {quickPrompts.map((qp, idx) => (
                    <button
                      key={idx}
                      disabled={sendingMessage}
                      onClick={() => handleSend(qp.prompt)}
                      className="p-3 bg-[#111317] border border-slate-800 hover:border-indigo-500/30 disabled:hover:border-slate-800 disabled:opacity-50 rounded-xl text-[10px] text-slate-400 font-medium transition text-left space-y-0.5 cursor-pointer"
                    >
                      <div className="font-semibold text-slate-300 flex items-center gap-1">
                        <ArrowRight className="w-3 h-3 text-indigo-400" /> {qp.title}
                      </div>
                      <p className="text-[9px] text-slate-500 truncate">{qp.prompt}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chatHistory.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
                  >
                    <div className={`w-7.5 h-7.5 rounded-xl flex items-center justify-center shrink-0 border text-[10px] font-mono font-bold ${
                      isUser 
                        ? 'bg-slate-900 border-slate-850 text-indigo-400' 
                        : 'bg-indigo-950 border-indigo-500/10 text-indigo-300'
                    }`}>
                      {isUser ? 'ME' : 'AI'}
                    </div>
                    <div className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                      isUser 
                        ? 'bg-indigo-600 border border-indigo-500/15 text-white' 
                        : 'bg-[#111317] border border-slate-850 text-slate-300 whitespace-pre-line'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                );
              })
            )}

            {sendingMessage && (
              <div className="flex gap-3">
                <div className="w-7.5 h-7.5 shrink-0 rounded-xl bg-indigo-950 border border-indigo-500/10 text-indigo-300 flex items-center justify-center text-[10px] font-mono font-bold animate-pulse">
                  AI
                </div>
                <div className="p-3.5 rounded-2xl bg-[#111317]/40 border border-slate-850 text-xs text-slate-500 animate-pulse">
                  Evaluating priorities & adjusting schedule buffers...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input form block */}
          <div className="p-4 border-t border-slate-850 bg-slate-950/80">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleVoiceSimulate}
                className={`p-3 rounded-xl border transition cursor-pointer ${
                  isRecording 
                    ? 'bg-rose-950 border-rose-500/40 text-rose-400 animate-pulse' 
                    : 'bg-slate-950 border-slate-850 hover:border-slate-700 text-slate-400 hover:text-white'
                }`}
                title="Vocal Voice Parser Simulator"
              >
                {isRecording ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
              </button>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
                disabled={sendingMessage}
                placeholder="Type dynamic request... e.g. What should I work on today?"
                className="flex-1 px-3.5 py-3 bg-slate-950 border border-slate-850 rounded-xl focus:outline-none focus:border-indigo-500 text-xs text-slate-200"
              />

              <button
                type="button"
                disabled={sendingMessage || !input.trim()}
                onClick={() => handleSend(input)}
                className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 text-white rounded-xl transition shrink-0 cursor-pointer flex items-center gap-1.5 min-w-[44px] justify-center"
              >
                {sendingMessage ? (
                  <span className="text-[10px] font-semibold animate-pulse tracking-wide uppercase px-1">Generating...</span>
                ) : (
                  <Send className="w-4.5 h-4.5" />
                )}
              </button>
            </div>
            {isRecording && (
              <p className="text-[10px] text-rose-400 font-mono mt-1 px-1 animate-pulse">
                🎙️ Listening... Simulating natural language vocal parsing.
              </p>
            )}
          </div>
        </div>

        {/* Info Right Sidebar */}
        <div className="hidden lg:block glass-panel p-4 space-y-4 overflow-y-auto">
          <div className="border-b border-slate-850 pb-2">
            <h3 className="text-[10px] uppercase font-bold tracking-widest font-mono text-slate-400">Context Monitor</h3>
          </div>

          <div className="space-y-3 pt-1">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 space-y-1">
              <span className="text-[9px] font-mono font-bold text-slate-500">SYSTEM TIME</span>
              <div className="text-[11px] text-slate-300 font-semibold font-mono">
                {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} - {new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 space-y-1">
              <span className="text-[9px] font-mono font-bold text-slate-500">ACTIVE TASKS</span>
              <div className="text-[11px] text-slate-300 font-semibold">{tasks.length} Tracked</div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 space-y-1.5">
              <span className="text-[9px] font-mono font-bold text-slate-500">SCHEDULING LOGS</span>
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 no-scrollbar">
                {tasks.slice(0, 3).map((t, idx) => (
                  <div key={idx} className="text-[10px] text-slate-400 flex items-center justify-between bg-slate-950 p-1.5 rounded border border-slate-850">
                    <span className="truncate max-w-28 font-sans">{t.title}</span>
                    <span className="text-[8px] font-mono font-bold text-rose-400">#{t.priority}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
