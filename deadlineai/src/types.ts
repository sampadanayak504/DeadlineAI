export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  estimatedHours: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  category: 'Study' | 'Work' | 'Personal' | 'Other';
  deadline: string; // ISO date string or YYYY-MM-DD
  estimatedHours: number;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  tags: string[];
  status: 'Pending' | 'In Progress' | 'Completed';
  subtasks: Subtask[];
  scheduledStart?: string; // ISO Date of auto-scheduler block
  scheduledEnd?: string;
  milestones?: string[];
  postponeCount?: number;
  dueTime?: string;
  createdAt?: string;
  updatedAt?: string;
  reminderSettings?: {
    enabled: boolean;
    timing: '5 min' | '15 min' | '1 hour' | '1 day';
  };
}

export interface Goal {
  id: string;
  title: string;
  category: 'Academic' | 'Career' | 'Personal' | 'Fitness' | 'Learning';
  targetDate: string;
  milestones: {
    id: string;
    title: string;
    completed: boolean;
  }[];
}

export interface Habit {
  id: string;
  type: 'procrastination' | 'optimal-hours' | 'focus-pattern';
  title: string;
  description: string;
  observation: string;
}

export interface Activity {
  id: string;
  text: string;
  timestamp: string; // ISO String
  type: 'create' | 'complete' | 'plan' | 'coach' | 'rescue';
}

export interface UserProfile {
  name: string;
  email: string;
  picture?: string;
  productivityScore: number;
  streak: number;
  completedCount: number;
  totalHoursWorked: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO Date String
  end: string;   // ISO Date String
  type: 'event' | 'task-block' | 'suggested';
  taskId?: string;
}

export interface Reminder {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  priority: 'Low' | 'Medium' | 'High';
  category: string;
  reminderTiming: 'At due time' | '5 min' | '10 min' | '15 min' | '30 min' | '1 hour' | '2 hours' | '1 day' | 'Custom';
  repeat: 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Custom';
  completed: boolean;
  isManual?: boolean;
}

