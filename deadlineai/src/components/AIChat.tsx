import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChatMessage, Task } from '../types';
import { MessageSquare, Send, Sparkles, Mic, MicOff, Clock, HelpCircle, ArrowRight } from 'lucide-react';

interface AIChatProps {
  tasks: Task[];
  chatHistory: ChatMessage[];
  onSendMessage: (msg: string) => Promise<void>;
  sendingMessage: boolean;
}

export default function AIChat({ tasks, chatHistory, onSendMessage, sendingMessage }: AIChatProps) {
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Micro speech recognition simulator
  const [isRecording, setIsRecording] = useState(false);
  const [recognitionText, setRecognitionText] = useState('');

  const quickPrompts = [
    { title: "Plan My Week", prompt: "I have several deadlines. Plan this week out into optimized hourly slots around my schedule." },
    { title: "I Have Too Much Work", prompt: "I am starting to feel overwhelmed. Generate a critical checklist of what to do first." },
    { title: "What Should I Do First?", prompt: "Look at my current tasks. Based on deadlines and efforts, what is my absolute primary target?" },
    { title: "Explain My Deadlines", prompt: "Which of my tasks is closest to critical failure, and how much time do I need to clear it safely?" }
  ];

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    setInput('');
    await onSendMessage(text);
  };

  const handleVoiceSimulate = () => {
    if (isRecording) {
      setIsRecording(false);
      // simulate speech extraction
      const voiceOptions = [
        "Create study task for Advanced Algorithms due Friday",
        "Explain what I should focus on next",
        "Reschedule yesterday's missed tasks"
      ];
      const randomTxt = voiceOptions[Math.floor(Math.random() * voiceOptions.length)];
      setInput(randomTxt);
    } else {
      setIsRecording(true);
      setTimeout(() => {
        setIsRecording(false);
        setInput("Trigger emergency rescue mode.");
      }, 3000);
    }
  };

  // Scroll to bottom on updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, sendingMessage]);

  return (
    <div id="ai-chat" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 h-[calc(100vh-140px)] flex flex-col gap-6">
      {/* Upper header */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3 shrink-0">
        <div className="p-2 bg-indigo-900/40 border border-indigo-500/20 text-indigo-400 rounded-xl">
          <MessageSquare className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-slate-100 uppercase tracking-widest font-mono flex items-center gap-1.5">
            AI Assistant Core <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
          </h1>
          <p className="text-slate-500 text-[10px]">Real-time context-aware planning. Ask about priorities, scheduling gaps, and task loads.</p>
        </div>
      </div>

      {/* Main chat center pane */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Messages space */}
        <div className="lg:col-span-3 glass-panel flex flex-col min-h-0 bg-slate-950/40">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
            {chatHistory.length === 0 ? (
              <div className="text-center py-20 text-slate-500 space-y-4 max-w-md mx-auto">
                <Sparkles className="w-12 h-12 text-indigo-500/30 mx-auto animate-pulse" />
                <h3 className="text-sm font-bold text-slate-300">How can I assist you today?</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  I act as your executive life coach. I have absolute context over your current task list. Feel free to trigger reschedules or ask for priority optimization.
                </p>
                <div className="grid grid-cols-2 gap-2 text-left pt-2">
                  {quickPrompts.map((qp, index) => (
                    <button
                      key={index}
                      onClick={() => handleSend(qp.prompt)}
                      className="p-2.5 bg-slate-950 border border-slate-800 hover:border-indigo-500/30 rounded-xl text-[10px] text-slate-400 font-medium transition text-left"
                    >
                      {qp.title} <ArrowRight className="w-3 h-3 text-indigo-500 inline float-right mt-0.5" />
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
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                      isUser 
                        ? 'bg-slate-900 border-slate-800 text-indigo-400' 
                        : 'bg-indigo-950 border-indigo-500/20 text-indigo-300'
                    }`}>
                      {isUser ? 'ME' : 'AI'}
                    </div>
                    <div className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                      isUser 
                        ? 'bg-indigo-600 border border-indigo-500/20 text-white' 
                        : 'bg-slate-900/60 border border-slate-800/80 text-slate-300 whitespace-pre-line'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                );
              })
            )}

            {sendingMessage && (
              <div className="flex gap-3">
                <div className="w-8 h-8 shrink-0 rounded-xl bg-indigo-950 border border-indigo-500/20 text-indigo-300 flex items-center justify-center animate-pulse">
                  AI
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-xs text-slate-500 animate-pulse">
                  Thinking & coordinating calendar resources...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Form input bar */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/80">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleVoiceSimulate}
                className={`p-3 rounded-xl border transition ${
                  isRecording 
                    ? 'bg-rose-950 border-rose-500/40 text-rose-400 animate-pulse' 
                    : 'bg-slate-950 border-slate-850 hover:border-slate-700 text-slate-400 hover:text-white'
                }`}
                title="Google Voice Input Simulator"
              >
                {isRecording ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
              </button>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
                disabled={sendingMessage}
                placeholder="Ask DeadlineAI anything... e.g. I missed today's work, please reschedule!"
                className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-xs text-slate-200 leading-none whitespace-nowrap"
              />

              <button
                type="button"
                disabled={sendingMessage || !input.trim()}
                onClick={() => handleSend(input)}
                className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl transition shadow-lg shrink-0 cursor-pointer"
              >
                <Send className="w-4.5 h-4.5" />
              </button>
            </div>
            {isRecording && (
              <p className="text-[10px] text-rose-400 font-mono mt-1 px-1 animate-pulse">
                🎙️ Listening... Speak your request, or click again to simulate!
              </p>
            )}
          </div>
        </div>

        {/* Info Right Sidebar: Active Task summaries and details */}
        <div className="hidden lg:block glass-panel p-5 space-y-4 overflow-y-auto">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-[10px] uppercase font-bold tracking-widest font-mono text-slate-400">Context Workspace</h3>
          </div>

          <div className="space-y-3 pt-1">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[9px] font-mono font-bold text-slate-500">SYSTEM TIME</span>
              <div className="text-xs text-slate-300 font-semibold">Tue, Jun 23, 12:00 PM</div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[9px] font-mono font-bold text-slate-500">TASK VOLUME</span>
              <div className="text-xs text-slate-300 font-semibold">{tasks.length} Active, {tasks.filter(t => t.status === 'Completed').length} Cleared</div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1.5">
              <span className="text-[9px] font-mono font-bold text-slate-500">URGENT BULLETINS</span>
              <div className="space-y-1">
                {tasks.slice(0, 3).map((t, idx) => (
                  <div key={idx} className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span className="truncate max-w-32">{t.title}</span>
                    <span className="text-[9px] font-semibold text-rose-400">#{t.priority}</span>
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
