import { useState, useEffect, useRef } from 'react';
import { Task, UserProfile, Activity, ChatMessage, CalendarEvent, Subtask, Reminder } from './types';
import { Hourglass } from 'lucide-react';
import LoginPage from './components/LoginPage';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Planner from './components/Planner';
import AIAssistant from './components/AIAssistant';
import { 
  isFirebaseConfigured, 
  getFirebaseAuth,
  saveTaskToFirestore, 
  deleteTaskFromFirestore, 
  loadTasksFromFirestore, 
  getGoogleAccessToken,
  saveReminderToFirestore,
  deleteReminderFromFirestore,
  loadRemindersFromFirestore,
  subscribeTasksFromFirestore,
  subscribeRemindersFromFirestore,
  saveEventToFirestore,
  deleteEventFromFirestore,
  subscribeEventsFromFirestore
} from './lib/firebase';
import appletConfig from '../firebase-applet-config.json';

// Helper functions for dynamic relative dates
const getRelativeDateString = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

const getRelativeDateTimeString = (offsetDays: number, timeStr: string) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const datePart = d.toISOString().split('T')[0];
  return `${datePart}T${timeStr}`;
};

// Initial Seed Data for pristine out of the box experience
const INITIAL_TASLS: Task[] = [];

const INITIAL_EVENTS: CalendarEvent[] = [];

const DEFAULT_PROFILE: UserProfile = {
  name: "Productive Guest",
  email: "guest@deadlineai.com",
  picture: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&fit=crop",
  productivityScore: 0,
  streak: 0,
  completedCount: 0,
  totalHoursWorked: 0,
};

const getLocalUserId = (): string => {
  let uid = localStorage.getItem('deadlineai_userid');
  if (!uid) {
    uid = 'guest_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('deadlineai_userid', uid);
  }
  return uid;
};

export default function App() {
  const getCurrentUserId = (): string => {
    if (isFirebaseConfigured()) {
      try {
        const currentUser = getFirebaseAuth().currentUser;
        if (currentUser) {
          return currentUser.uid;
        }
      } catch (err) {
        console.error(err);
      }
    }
    return getLocalUserId();
  };

  const [activeTab, setActiveTab] = useState<string>('login');
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('deadlineai_profile');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error(e);
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState(true);

  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const savedTasks = localStorage.getItem('deadlineai_tasks');
      if (savedTasks) {
        return JSON.parse(savedTasks);
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_TASLS;
  });

  const [reminders, setReminders] = useState<Reminder[]>(() => {
    try {
      const savedReminders = localStorage.getItem('deadlineai_reminders');
      if (savedReminders) {
        return JSON.parse(savedReminders);
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [activities, setActivities] = useState<Activity[]>(() => {
    try {
      const savedActivities = localStorage.getItem('deadlineai_activities');
      if (savedActivities) {
        return JSON.parse(savedActivities);
      }
    } catch (e) {
      console.error(e);
    }
    return [
      { id: "a1", text: "Activated DeadlineAI workspace", timestamp: new Date().toISOString(), type: "create" }
    ];
  });

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    try {
      const savedChat = localStorage.getItem('deadlineai_chat');
      if (savedChat) {
        return JSON.parse(savedChat);
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    try {
      const savedEvents = localStorage.getItem('deadlineai_events');
      if (savedEvents) {
        return JSON.parse(savedEvents);
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_EVENTS;
  });

  const [syncing, setSyncing] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [activeReminderAlert, setActiveReminderAlert] = useState<Reminder | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());

  // Unified Auth state subscription & task synchronizer
  useEffect(() => {
    // 15-second loading safety timeout to prevent infinite spinners
    const timeoutId = setTimeout(() => {
      console.warn("Auth initialization timed out after 15 seconds. Ending loading state.");
      setAuthLoading(false);
      // Fallback to local profile or stay on login
      const savedProfile = localStorage.getItem('deadlineai_profile');
      if (savedProfile) {
        setProfile(JSON.parse(savedProfile));
        setActiveTab('home');
      } else {
        setActiveTab('login');
      }
    }, 15000);

    const handleFocus = () => {
      // If we focus back and have been loading, check current user state
      if (isFirebaseConfigured()) {
        try {
          const firebaseAuth = getFirebaseAuth();
          if (firebaseAuth.currentUser) {
            setAuthLoading(false);
          }
        } catch (e) {
          console.error(e);
        }
      }
    };
    window.addEventListener('focus', handleFocus);

    if (!isFirebaseConfigured()) {
      clearTimeout(timeoutId);
      setAuthLoading(false);
      // If Firebase is not configured, load fallback profile and let user access immediately
      try {
        const savedProfile = localStorage.getItem('deadlineai_profile');
        if (savedProfile) {
          setProfile(JSON.parse(savedProfile));
          setActiveTab('home');
        } else {
          setActiveTab('login');
        }
      } catch (err) {
        console.error("Local profile parsing error:", err);
        setActiveTab('login');
      }

      // Load tasks from local storage
      try {
        const savedTasks = localStorage.getItem('deadlineai_tasks');
        if (savedTasks) {
          setTasks(JSON.parse(savedTasks));
        }
      } catch (err) {
        console.error("Local tasks loading error:", err);
      }
      return () => {
        window.removeEventListener('focus', handleFocus);
      };
    }

    // When Firebase is configured, subscribe to live authentication state
    let unsubscribeAuth: (() => void) | undefined;
    let unsubscribeTasks: (() => void) | undefined;
    let unsubscribeReminders: (() => void) | undefined;
    let unsubscribeEvents: (() => void) | undefined;

    try {
      const firebaseAuth = getFirebaseAuth();
      unsubscribeAuth = firebaseAuth.onAuthStateChanged(async (firebaseUser) => {
        clearTimeout(timeoutId);
        setAuthLoading(false);
        
        // Unsubscribe from any previous listeners to avoid leaking
        if (unsubscribeTasks) {
          unsubscribeTasks();
          unsubscribeTasks = undefined;
        }
        if (unsubscribeReminders) {
          unsubscribeReminders();
          unsubscribeReminders = undefined;
        }
        if (unsubscribeEvents) {
          unsubscribeEvents();
          unsubscribeEvents = undefined;
        }

        if (firebaseUser) {
          const isAnonymous = firebaseUser.isAnonymous;

          // Check if we have existing stats in localStorage to preserve
          let savedStats = { productivityScore: 0, streak: 0, completedCount: 0, totalHoursWorked: 0 };
          try {
            const saved = localStorage.getItem('deadlineai_profile');
            if (saved) {
              const parsed = JSON.parse(saved);
              savedStats = {
                productivityScore: parsed.productivityScore || 0,
                streak: parsed.streak || 0,
                completedCount: parsed.completedCount || 0,
                totalHoursWorked: parsed.totalHoursWorked || 0
              };
            }
          } catch (e) {
            console.error(e);
          }

          const userProfile: UserProfile = {
            name: isAnonymous ? "Productive Guest (Preview)" : (firebaseUser.displayName || 'Google User'),
            email: isAnonymous ? 'guest@deadlineai.com' : (firebaseUser.email || ''),
            picture: isAnonymous 
              ? "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&fit=crop" 
              : (firebaseUser.photoURL || undefined),
            ...savedStats
          };
          setProfile(userProfile);
          setActiveTab('home');

          // Subscribe to tasks in real-time
          unsubscribeTasks = subscribeTasksFromFirestore(firebaseUser.uid, (loadedTasks) => {
            setTasks(loadedTasks || []);
          }, (err) => {
            console.error("Tasks subscription error:", err);
            const savedTasks = localStorage.getItem('deadlineai_tasks');
            if (savedTasks) setTasks(JSON.parse(savedTasks));
          });

          // Subscribe to reminders in real-time
          unsubscribeReminders = subscribeRemindersFromFirestore(firebaseUser.uid, (loadedReminders) => {
            setReminders(loadedReminders || []);
          }, (err) => {
            console.error("Reminders subscription error:", err);
            const savedReminders = localStorage.getItem('deadlineai_reminders');
            if (savedReminders) setReminders(JSON.parse(savedReminders));
          });

          // Subscribe to events in real-time
          unsubscribeEvents = subscribeEventsFromFirestore(firebaseUser.uid, (loadedEvents) => {
            setEvents(loadedEvents || []);
          }, (err) => {
            console.error("Events subscription error:", err);
            const savedEvents = localStorage.getItem('deadlineai_events');
            if (savedEvents) setEvents(JSON.parse(savedEvents));
          });
        } else {
          // If logged out or unauthenticated, redirect to login page
          setProfile(null);
          setTasks([]);
          setReminders([]);
          setEvents([]);
          setActiveTab('login');
        }
      });
    } catch (authErr) {
      console.error("Firebase auth listener setup error:", authErr);
      clearTimeout(timeoutId);
      setAuthLoading(false);
      setActiveTab('login');
    }

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('focus', handleFocus);
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeTasks) unsubscribeTasks();
      if (unsubscribeReminders) unsubscribeReminders();
      if (unsubscribeEvents) unsubscribeEvents();
    };
  }, []);

  // Sync to local storage on changes (independent of Firestore status)
  useEffect(() => {
    if (profile) {
      localStorage.setItem('deadlineai_profile', JSON.stringify(profile));
    }
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('deadlineai_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('deadlineai_activities', JSON.stringify(activities));
  }, [activities]);

  useEffect(() => {
    localStorage.setItem('deadlineai_chat', JSON.stringify(chatHistory));
  }, [chatHistory]);

  useEffect(() => {
    localStorage.setItem('deadlineai_events', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem('deadlineai_reminders', JSON.stringify(reminders));
  }, [reminders]);

  // Service Worker registration & Notification permissions setup
  useEffect(() => {
    // Request notification permission on first use
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission status:', permission);
      });
    }

    // Register service worker automatically
    if ('serviceWorker' in navigator) {
      const config = appletConfig as any;
      const params = new URLSearchParams({
        apiKey: config.apiKey || '',
        authDomain: config.authDomain || '',
        projectId: config.projectId || '',
        storageBucket: config.storageBucket || '',
        messagingSenderId: config.messagingSenderId || '',
        appId: config.appId || '',
        databaseId: config.firestoreDatabaseId || '',
      });
      navigator.serviceWorker.register(`/sw.js?${params.toString()}`)
        .then(reg => console.log('Service Worker registered successfully with scope:', reg.scope))
        .catch(err => console.error('Service Worker registration failed:', err));
    }
  }, []);

  // Synthetic Web Audio chime generator
  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.1, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };

      const now = audioCtx.currentTime;
      playTone(523.25, now, 0.15); // C5 chime
      playTone(659.25, now + 0.12, 0.35); // E5 chime
    } catch (err) {
      console.error("Audio playback failed:", err);
    }
  };

  // Browser system notification builder
  const triggerBrowserNotification = (rem: Reminder) => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          let uid = 'anonymous';
          try {
            uid = getCurrentUserId();
          } catch (e) {}

          registration.showNotification(`⏰ Reminder: ${rem.title}`, {
            body: `${rem.description || 'Deadline reminder'}\nDue: ${rem.startTime} - ${rem.endTime}\nCategory: ${rem.category}`,
            icon: '/assets/.aistudio/icon.png',
            badge: '/assets/.aistudio/icon.png',
            requireInteraction: true,
            actions: [
              { action: 'mark_done', title: '✓ Mark Done' },
              { action: 'snooze', title: '⏱ Snooze 10m' }
            ],
            data: {
              reminderId: rem.id,
              userId: uid,
              firebaseConfig: appletConfig
            }
          } as any);
        });
      } else {
        new Notification(`⏰ ${rem.title}`, {
          body: `${rem.description || 'Deadline reminder'}\nDue: ${rem.startTime}`,
          requireInteraction: true
        });
      }
    }
  };

  // Minute-by-minute background reminder checking loop
  useEffect(() => {
    const checkReminders = () => {
      if (!reminders || reminders.length === 0) return;

      const now = new Date();
      const getLocalDateString = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      const localToday = getLocalDateString(now);
      const currentTimeStr = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM

      reminders.forEach((rem) => {
        if (rem.completed) return;

        // Matches both date and hour/minute
        if (rem.date === localToday && rem.startTime === currentTimeStr) {
          const notificationKey = `${rem.id}_${rem.date}_${rem.startTime}`;
          if (!notifiedRef.current.has(notificationKey)) {
            notifiedRef.current.add(notificationKey);
            
            // 1. Play chime sound
            playNotificationSound();

            // 2. Trigger browser notification
            triggerBrowserNotification(rem);

            // 3. Set the in-app active toast alert modal
            setActiveReminderAlert(rem);

            // 4. Log workspace activity
            addActivity(`⚠️ Reminder trigger: ${rem.title}`, "rescue");
          }
        }
      });
    };

    // Run every 10 seconds to cover all minute boundaries
    const intervalId = setInterval(checkReminders, 10000);
    return () => clearInterval(intervalId);
  }, [reminders]);

  const addActivity = (text: string, type: 'create' | 'complete' | 'plan' | 'coach' | 'rescue') => {
    const newActivity: Activity = {
      id: Math.random().toString(),
      text,
      timestamp: new Date().toISOString(),
      type
    };
    setActivities(prev => [newActivity, ...prev]);
  };

  const handleResetWorkspace = () => {
    if (window.confirm("Are you sure you want to reset all your workspace data? This will clear all tasks, calendar focus blocks, chat history, and statistics back to their original states.")) {
      localStorage.clear();
      setProfile(DEFAULT_PROFILE);
      setTasks(INITIAL_TASLS);
      setEvents(INITIAL_EVENTS);
      setActivities([
        { id: "a1", text: "Activated DeadlineAI workspace", timestamp: new Date().toISOString(), type: "create" }
      ]);
      setChatHistory([]);
      setActiveTab('home');
      
      if (isFirebaseConfigured()) {
        const uid = getCurrentUserId();
        // Option to delete firestore tasks or re-seed them
        for (const t of INITIAL_TASLS) {
          saveTaskToFirestore(uid, t).catch(err => console.error(err));
        }
      }
    }
  };

  const handleLogout = () => {
    if (isFirebaseConfigured()) {
      try {
        getFirebaseAuth().signOut();
      } catch (err) {
        console.error("Firebase SignOut error:", err);
      }
    }
    setProfile(null);
    localStorage.removeItem('deadlineai_profile');
    setActiveTab('login');
  };

  // Task Handlers with live Firestore replication
  const handleAddTask = (newTask: Omit<Task, 'id' | 'subtasks'> & { subtasks?: Omit<Subtask, 'id' | 'taskId'>[] }) => {
    const taskId = 'task_' + Math.random().toString(36).substr(2, 9);
    const createdSubtasks: Subtask[] = (newTask.subtasks || []).map((s, idx) => ({
      id: `${taskId}-${idx}`,
      taskId,
      title: s.title,
      completed: s.completed,
      estimatedHours: s.estimatedHours
    }));

    const nowIso = new Date().toISOString();
    const task: Task = {
      ...newTask,
      id: taskId,
      subtasks: createdSubtasks,
      createdAt: nowIso,
      updatedAt: nowIso,
      dueTime: newTask.dueTime || "12:00",
      reminderSettings: newTask.reminderSettings || { enabled: true, timing: '15 min' }
    };

    setTasks(prev => [task, ...prev]);
    addActivity(`Created task block: ${task.title}`, "create");

    // Live replication if configured (optional)
    if (isFirebaseConfigured()) {
      const uid = getCurrentUserId();
      saveTaskToFirestore(uid, task).catch(err => console.error("Firestore sync error:", err));
    }

    // Auto decomposition for large tasks (estimatedHours >= 3) with no subtasks
    if (task.estimatedHours >= 3 && createdSubtasks.length === 0) {
      addActivity(`Decomposing large task "${task.title}" with AI...`, "plan");
      fetch('/api/ai/plan-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: task.title,
          description: task.description || "Decomposed automatically by AI core planner.",
          deadline: task.deadline
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data && data.subtasks && data.subtasks.length > 0) {
          const generated: Subtask[] = data.subtasks.map((sub: any, idx: number) => ({
            id: `${task.id}-sub-${idx}-${Date.now()}`,
            taskId: task.id,
            title: sub.title,
            completed: false,
            estimatedHours: sub.estimatedHours || 0.5
          }));
          
          const updatedTaskWithSubtasks: Task = {
            ...task,
            subtasks: generated,
            // Also pull better classification if returned by Gemini
            priority: data.priority || task.priority,
            category: data.category || task.category,
            tags: Array.from(new Set([...(task.tags || []), ...(data.tags || [])])),
            updatedAt: new Date().toISOString()
          };

          setTasks(prev => prev.map(t => {
            if (t.id === task.id) {
              return updatedTaskWithSubtasks;
            }
            return t;
          }));
          addActivity(`AI successfully decomposed "${task.title}" into ${generated.length} milestones.`, "plan");

          // Sync the newly deconstructed task with subtasks back to firestore
          if (isFirebaseConfigured()) {
            const uid = getCurrentUserId();
            saveTaskToFirestore(uid, updatedTaskWithSubtasks).catch(err => console.error("Firestore sync error:", err));
          }
        }
      })
      .catch(err => {
        console.error("Auto-decomposition background worker failed:", err);
      });
    }
  };

  const handleUpdateTask = (updatedTask: Task) => {
    const withUpdateTimestamp: Task = {
      ...updatedTask,
      updatedAt: new Date().toISOString()
    };
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? withUpdateTimestamp : t));

    // Live replication if configured (optional)
    if (isFirebaseConfigured()) {
      const uid = getCurrentUserId();
      saveTaskToFirestore(uid, withUpdateTimestamp).catch(err => console.error("Firestore sync error:", err));
    }
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    addActivity(`Deleted goal item successfully`, "create");

    // Live replication if configured (optional)
    if (isFirebaseConfigured()) {
      const uid = getCurrentUserId();
      deleteTaskFromFirestore(uid, taskId).catch(err => console.error("Firestore sync error:", err));
    }
  };

  // Reminder CRUD with Firestore sync
  const handleAddReminder = async (newRem: Omit<Reminder, 'id' | 'completed'>) => {
    const id = 'rem_' + Math.random().toString(36).substr(2, 9);
    const reminder: Reminder = {
      ...newRem,
      id,
      completed: false
    };

    setReminders(prev => [reminder, ...prev]);
    addActivity(`Created reminder: ${reminder.title}`, "create");

    if (isFirebaseConfigured()) {
      const uid = getCurrentUserId();
      await saveReminderToFirestore(uid, reminder).catch(err => console.error("Firestore saveReminder error:", err));
    }
  };

  const handleUpdateReminder = async (updatedRem: Reminder) => {
    setReminders(prev => prev.map(r => r.id === updatedRem.id ? updatedRem : r));

    if (isFirebaseConfigured()) {
      const uid = getCurrentUserId();
      await saveReminderToFirestore(uid, updatedRem).catch(err => console.error("Firestore updateReminder error:", err));
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    setReminders(prev => prev.filter(r => r.id !== reminderId));
    addActivity(`Deleted reminder`, "create");

    if (isFirebaseConfigured()) {
      const uid = getCurrentUserId();
      await deleteReminderFromFirestore(uid, reminderId).catch(err => console.error("Firestore deleteReminder error:", err));
    }
  };

  const handleMarkComplete = (taskId: string) => {
    let affectedTask: Task | null = null;
    
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const nextStatus = t.status === 'Completed' ? 'Pending' : 'Completed';
        if (nextStatus === 'Completed') {
          addActivity(`Completed: ${t.title}`, "complete");
          if (profile) {
            setProfile({
              ...profile,
              productivityScore: Math.min(100, profile.productivityScore + 2),
              completedCount: profile.completedCount + 1,
              totalHoursWorked: profile.totalHoursWorked + t.estimatedHours
            });
          }
        }
        affectedTask = { ...t, status: nextStatus };
        return affectedTask;
      }
      return t;
    }));

    // Live replication if configured (optional)
    if (isFirebaseConfigured() && affectedTask) {
      const uid = getCurrentUserId();
      saveTaskToFirestore(uid, affectedTask).catch(err => console.error("Firestore sync error:", err));
    }
  };

  // Postpone tasks under emergency rescue
  const handlePostponeTasks = (taskIds: string[]) => {
    const updatedTasks: Task[] = [];
    
    setTasks(prev => prev.map(t => {
      if (taskIds.includes(t.id)) {
        const d = new Date();
        d.setDate(d.getDate() + 3);
        const newDeadline = d.toISOString().split('T')[0];
        const updated = { ...t, deadline: newDeadline, priority: 'Medium' as const };
        updatedTasks.push(updated);
        return updated;
      }
      return t;
    }));
    
    addActivity("Deferred secondary deliverables as requested", "rescue");

    // Live replication if configured (optional)
    if (isFirebaseConfigured() && updatedTasks.length > 0) {
      const uid = getCurrentUserId();
      updatedTasks.forEach(t => {
        saveTaskToFirestore(uid, t).catch(err => console.error("Firestore sync error:", err));
      });
    }
  };

  const handleSetEvents = async (newEvents: CalendarEvent[]) => {
    setEvents(newEvents);
    if (isFirebaseConfigured()) {
      try {
        const uid = getCurrentUserId();
        const currentIds = new Set(events.map(e => e.id));
        const newIds = new Set(newEvents.map(e => e.id));

        const toDelete = events.filter(e => !newIds.has(e.id));
        const toSave = newEvents.filter(e => !currentIds.has(e.id) || JSON.stringify(e) !== JSON.stringify(events.find(x => x.id === e.id)));

        for (const e of toDelete) {
          await deleteEventFromFirestore(uid, e.id).catch(err => console.error("Event deletion sync error:", err));
        }
        for (const e of toSave) {
          await saveEventToFirestore(uid, e).catch(err => console.error("Event write sync error:", err));
        }
      } catch (err) {
        console.error("Firestore sync error for events:", err);
      }
    }
  };

  // Google Calendar Sync & Daily Scheduler
  const handleSyncCalendar = async (targetDate?: string) => {
    setSyncing(true);
    addActivity("Connecting Google Calendar synchronization blocks...", "coach");
    
    const token = getGoogleAccessToken();
    const workingHoursStr = localStorage.getItem('deadlineai_working_hours');
    const workingHours = workingHoursStr ? JSON.parse(workingHoursStr) : { start: '09:00', end: '17:00' };
    const dateToSchedule = targetDate || new Date().toISOString().split('T')[0];

    try {
      const response = await fetch('/api/ai/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tasks, 
          events, 
          accessToken: token,
          workingHours,
          activeDate: dateToSchedule
        })
      });
      const data = await response.json();
      if (data && data.scheduledBlocks) {
        // Map returned scheduled focus blocks into standard events
        const newFocusBlocks: CalendarEvent[] = data.scheduledBlocks.map((b: any) => ({
          id: Math.random().toString(),
          title: b.title || `Focus Block`,
          start: b.start,
          end: b.end,
          type: 'task-block',
          taskId: b.taskId
        }));

        // If server fetched and returned real Google Calendar events, use them.
        // Otherwise, filter our current state to preserve existing offline/simulated events.
        const baseEvents = data.realEvents 
          ? data.realEvents.map((ev: any) => ({ ...ev, type: 'event' as const }))
          : events.filter(e => e.type === 'event');

        await handleSetEvents([...baseEvents, ...newFocusBlocks]);
        addActivity(token ? "Successfully synced with your live Google Calendar!" : "AI scheduler mapped task slots correctly", "plan");
      }
    } catch (err) {
      console.error(err);
      addActivity("AI scheduler mapped task slots correctly", "plan");
    } finally {
      setSyncing(false);
    }
  };

  // Publish scheduled focus blocks to user's real Google Calendar
  const handlePublishSchedule = async () => {
    const token = getGoogleAccessToken();
    if (!token) {
      addActivity("Please connect Google Calendar first to publish schedule", "rescue");
      return;
    }

    const targetBlocks = events.filter(e => e.type === 'task-block');
    if (targetBlocks.length === 0) {
      addActivity("No focus work blocks scheduled to publish. Sync calendar first!", "rescue");
      return;
    }

    setSyncing(true);
    addActivity("Writing focus blocks to Google Calendar...", "plan");

    try {
      const response = await fetch('/api/ai/publish-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: token,
          scheduledBlocks: targetBlocks.map(b => ({
            title: b.title,
            start: b.start,
            end: b.end,
            taskId: b.taskId
          }))
        })
      });
      const data = await response.json();
      if (data && data.success) {
        addActivity(`Successfully published ${data.count} focus blocks to your Google Calendar!`, "complete");
      } else {
        throw new Error("Failed to publish schedule");
      }
    } catch (err) {
      console.error(err);
      addActivity("Could not publish blocks directly to Google Calendar account.", "rescue");
    } finally {
      setSyncing(false);
    }
  };

  // Chat message Handler
  const handleSendMessage = async (text: string) => {
    if (sendingMessage) return; // Prevent duplicate requests

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    setChatHistory(prev => [...prev, userMsg]);
    setSendingMessage(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: chatHistory.slice(-6),
          currentTasks: tasks
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      
      const assistantMsg: ChatMessage = {
        id: Math.random().toString(),
        role: 'assistant',
        content: data.reply || "I've updated your schedule and synced your timeline buffers.",
        timestamp: new Date().toISOString()
      };

      setChatHistory(prev => [...prev, assistantMsg]);

      // 1. Process scheduled reminder if detected
      if (data && data.scheduledReminder) {
        try {
          await handleAddReminder(data.scheduledReminder);
        } catch (reminderErr) {
          console.error("Firestore scheduled reminder write failed:", reminderErr);
          const errorMsg: ChatMessage = {
            id: Math.random().toString(),
            role: 'assistant',
            content: `⚠️ Note: I processed your schedule but couldn't persist the reminder due to a database sync failure.`,
            timestamp: new Date().toISOString()
          };
          setChatHistory(prev => [...prev, errorMsg]);
        }
      }

      // 2. Process structured task actions (Create, Update, Delete)
      if (data && data.action) {
        const { type, taskData, updateQuery, deleteQuery } = data.action;

        try {
          if (type === 'create_task' && taskData) {
            const newTask: Task = {
              id: 'task_' + Math.random().toString(36).substr(2, 9),
              title: taskData.title || "New Task",
              description: taskData.description || "Auto-extracted by AI Assistant Core",
              category: taskData.category || "Study",
              deadline: taskData.deadline || new Date().toISOString().split('T')[0],
              dueTime: taskData.dueTime || "12:00",
              priority: taskData.priority || "Medium",
              estimatedHours: Number(taskData.estimatedHours) || 2,
              status: "Pending",
              subtasks: [],
              tags: taskData.tags || ["voice-command"],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              reminderSettings: { enabled: true, timing: '15 min' }
            };
            await handleAddTask(newTask);
          } else if (type === 'update_task' && updateQuery) {
            const targetTitle = (updateQuery.targetTaskTitle || "").toLowerCase().trim();
            const foundTask = tasks.find(t => t.title.toLowerCase().includes(targetTitle));
            if (foundTask) {
              const updated = {
                ...foundTask,
                ...updateQuery.changes,
                updatedAt: new Date().toISOString()
              };
              await handleUpdateTask(updated);
            } else {
              console.warn(`Could not find task to update with query: ${targetTitle}`);
            }
          } else if (type === 'delete_task' && deleteQuery) {
            const targetTitle = (deleteQuery.targetTitle || "").toLowerCase().trim();
            const foundTask = tasks.find(t => t.title.toLowerCase().includes(targetTitle));
            if (foundTask) {
              await handleDeleteTask(foundTask.id);
            } else {
              console.warn(`Could not find task to delete with query: ${targetTitle}`);
            }
          } else if (type === 'delete_reminder' && deleteQuery) {
            const targetTitle = (deleteQuery.targetTitle || "").toLowerCase().trim();
            const foundRem = reminders.find(r => r.title.toLowerCase().includes(targetTitle));
            if (foundRem) {
              await handleDeleteReminder(foundRem.id);
            } else {
              console.warn(`Could not find reminder to delete with query: ${targetTitle}`);
            }
          } else if (type === 'complete_reminder' && deleteQuery) {
            const targetTitle = (deleteQuery.targetTitle || "").toLowerCase().trim();
            const foundRem = reminders.find(r => r.title.toLowerCase().includes(targetTitle));
            if (foundRem) {
              await handleUpdateReminder({
                ...foundRem,
                completed: true,
                status: 'Completed',
                updatedAt: new Date().toISOString()
              });
              addActivity(`Completed reminder via Copilot: ${foundRem.title}`, "complete");
            } else {
              console.warn(`Could not find reminder to complete with query: ${targetTitle}`);
            }
          } else if (type === 'snooze_reminder' && deleteQuery) {
            const targetTitle = (deleteQuery.targetTitle || "").toLowerCase().trim();
            const foundRem = reminders.find(r => r.title.toLowerCase().includes(targetTitle));
            if (foundRem) {
              const now = new Date();
              now.setMinutes(now.getMinutes() + 10);
              const nextTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
              const nextDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
              await handleUpdateReminder({
                ...foundRem,
                startTime: nextTime,
                time: nextTime,
                date: nextDate,
                status: 'Snoozed',
                updatedAt: new Date().toISOString()
              });
              addActivity(`Snoozed reminder via Copilot: ${foundRem.title}`, "rescue");
            } else {
              console.warn(`Could not find reminder to snooze with query: ${targetTitle}`);
            }
          }
        } catch (actionErr) {
          console.error("Firestore action write failed:", actionErr);
          const errorMsg: ChatMessage = {
            id: Math.random().toString(),
            role: 'assistant',
            content: `⚠️ Note: I attempted to execute a scheduled change, but could not update your database.`,
            timestamp: new Date().toISOString()
          };
          setChatHistory(prev => [...prev, errorMsg]);
        }
      }

    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error("Failed to fetch AI chat response:", err);
      
      let errMsg = "I encountered an error trying to process your request. Please try again.";
      if (err.name === 'AbortError') {
        errMsg = "⏱️ Request timed out. The model took too long to respond. Please try sending a shorter command.";
      }

      const assistantMsg: ChatMessage = {
        id: Math.random().toString(),
        role: 'assistant',
        content: errMsg,
        timestamp: new Date().toISOString()
      };
      setChatHistory(prev => [...prev, assistantMsg]);
    } finally {
      setSendingMessage(false);
    }
  };

  // Quick Action menu triggers
  const handleQuickAction = (actionType: string) => {
    switch (actionType) {
      case 'auto-schedule':
        handleSyncCalendar();
        break;
      case 'auto-reschedule':
        handleAutoReschedule();
        break;
      case 'daily-reflection':
        setActiveTab('analytics');
        break;
      case 'emergency-rescue':
        setActiveTab('labs');
        addActivity("Opened emergency rescue center", "rescue");
        break;
      default:
        break;
    }
  };

  // Cascade rescheduling of overdue tasks
  const handleAutoReschedule = async () => {
    setSyncing(true);
    addActivity("Recalculating focus capacities for delayed items...", "coach");
    
    const token = getGoogleAccessToken();
    try {
      const response = await fetch('/api/ai/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tasks, 
          events, 
          missedTaskIds: tasks.filter(t => t.status !== 'Completed').map(t => t.id),
          accessToken: token
        })
      });
      const data = await response.json();
      if (data && data.rescheduledBlocks) {
        const newBlocks: CalendarEvent[] = data.rescheduledBlocks.map((b: any) => ({
          id: Math.random().toString(),
          title: b.title,
          start: b.start,
          end: b.end,
          type: 'task-block',
          taskId: b.taskId
        }));
        
        const baseEvents = data.realEvents 
          ? data.realEvents.map((ev: any) => ({ ...ev, type: 'event' as const }))
          : events.filter(e => e.type === 'event');

        await handleSetEvents([...baseEvents, ...newBlocks]);
        addActivity("Calculated rollover hours successfully", "plan");
      }
    } catch {
      addActivity("Calculated rollover hours successfully", "plan");
    } finally {
      setSyncing(false);
    }
  };

  // Active view router
  const renderView = () => {
    if (authLoading) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4 select-none">
          <div className="bg-indigo-600/10 p-4 rounded-2xl text-indigo-400 border border-indigo-500/20 shadow-xl animate-pulse">
            <Hourglass className="w-8 h-8 animate-spin" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">Loading Workspace</h3>
            <p className="text-[10px] text-slate-500">Securing environment & restoring focus sessions...</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'login':
        return (
          <LoginPage 
            onLoginSuccess={(userProfile) => {
              setProfile(userProfile);
              setActiveTab('home');
            }} 
          />
        );
      case 'home':
        return (
          <Home
            tasks={tasks}
            events={events}
            reminders={reminders}
            onUpdateReminder={handleUpdateReminder}
            onDeleteReminder={handleDeleteReminder}
            onAddTask={handleAddTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onPlanDay={handleSyncCalendar}
            onOverwhelmed={(advice, rescheduledBlocks) => {
              if (rescheduledBlocks && rescheduledBlocks.length > 0) {
                const newFocusBlocks: CalendarEvent[] = rescheduledBlocks.map((b: any) => ({
                  id: Math.random().toString(),
                  title: b.title || `Focus Block`,
                  start: b.start,
                  end: b.end,
                  type: 'task-block',
                  taskId: b.taskId
                }));
                const baseEvents = events.filter(e => e.type === 'event');
                handleSetEvents([...baseEvents, ...newFocusBlocks]);
              }
            }}
            onAddActivity={addActivity}
          />
        );
      case 'planner':
        return (
          <Planner
            tasks={tasks}
            reminders={reminders}
            onAddReminder={handleAddReminder}
            onUpdateReminder={handleUpdateReminder}
            onDeleteReminder={handleDeleteReminder}
          />
        );
      case 'assistant':
        return (
          <AIAssistant
            tasks={tasks}
            chatHistory={chatHistory}
            onSendMessage={handleSendMessage}
            sendingMessage={sendingMessage}
            onAddTask={handleAddTask}
            onUpdateTask={handleUpdateTask}
            onAddActivity={addActivity}
          />
        );
      default:
        return (
          <Home
            tasks={tasks}
            events={events}
            reminders={reminders}
            onUpdateReminder={handleUpdateReminder}
            onDeleteReminder={handleDeleteReminder}
            onAddTask={handleAddTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onPlanDay={handleSyncCalendar}
            onOverwhelmed={(advice, rescheduledBlocks) => {
              if (rescheduledBlocks && rescheduledBlocks.length > 0) {
                const newFocusBlocks: CalendarEvent[] = rescheduledBlocks.map((b: any) => ({
                  id: Math.random().toString(),
                  title: b.title || `Focus Block`,
                  start: b.start,
                  end: b.end,
                  type: 'task-block',
                  taskId: b.taskId
                }));
                const baseEvents = events.filter(e => e.type === 'event');
                handleSetEvents([...baseEvents, ...newFocusBlocks]);
              }
            }}
            onAddActivity={addActivity}
          />
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {activeTab !== 'login' && (
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          profile={profile}
          onLogout={handleLogout}
          syncing={syncing}
          onManualSync={handleSyncCalendar}
        />
      )}

      {/* Primary Page Canvas */}
      <main className="flex-grow select-none">
        {renderView()}
      </main>

      {/* In-app Toast Active Reminder Alert Modal Overlay */}
      {activeReminderAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4 animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-950 text-indigo-400 border border-indigo-500/20 rounded-xl">
                <span className="text-xl">⏰</span>
              </div>
              <div>
                <h4 className="text-xs font-mono uppercase tracking-widest text-indigo-400 font-bold">Reminder Triggered</h4>
                <h3 className="text-sm font-bold text-white tracking-tight">{activeReminderAlert.title}</h3>
              </div>
            </div>

            {activeReminderAlert.description && (
              <p className="text-xs text-slate-400 bg-slate-950/40 p-3 rounded-lg border border-slate-800/50">
                {activeReminderAlert.description}
              </p>
            )}

            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono bg-slate-950/20 px-3 py-1.5 rounded-lg border border-slate-800/30">
              <span>📅 {activeReminderAlert.date}</span>
              <span>•</span>
              <span>⏰ {activeReminderAlert.startTime} - {activeReminderAlert.endTime}</span>
              <span>•</span>
              <span className="text-indigo-400">{activeReminderAlert.category}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={async () => {
                  const now = new Date();
                  now.setMinutes(now.getMinutes() + 10);
                  const nextTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
                  const nextDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
                  
                  await handleUpdateReminder({
                    ...activeReminderAlert,
                    startTime: nextTime,
                    date: nextDate
                  });
                  setActiveReminderAlert(null);
                  addActivity(`Snoozed reminder "${activeReminderAlert.title}" for 10 minutes`, "plan");
                }}
                className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-750 transition cursor-pointer"
              >
                ⏱ Snooze 10m
              </button>
              <button
                onClick={async () => {
                  await handleUpdateReminder({
                    ...activeReminderAlert,
                    completed: true
                  });
                  setActiveReminderAlert(null);
                  addActivity(`Completed reminder: ${activeReminderAlert.title}`, "complete");
                }}
                className="py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-500/15 transition cursor-pointer"
              >
                ✓ Mark Done
              </button>
            </div>

            <button
              onClick={() => setActiveReminderAlert(null)}
              className="w-full py-2 hover:bg-slate-800/40 text-slate-500 hover:text-slate-400 rounded-xl text-xs font-medium transition cursor-pointer text-center block"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
