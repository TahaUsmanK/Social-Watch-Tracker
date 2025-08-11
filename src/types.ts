export type Platform = 'youtube' | 'tiktok' | 'instagram';
export type Category = 'shorts' | 'regular' | 'reel' | 'tiktok';

export interface TrackerEvent {
  eventId?: string;
  timestamp: number;
  platform: Platform;
  category: Category;
  type: 'start' | 'pause' | 'time_update' | 'end' | 'navigation';
  currentTime?: number;
  duration?: number;
  meta?: { videoId?: string; title?: string; url?: string };
}

export interface SessionState {
  videoId: string;
  platform: Platform;
  category: Category;
  startTime: number;
  lastUpdateTime: number;
  totalWatchMs: number;
  counted: boolean;
}

export interface DailyAggregate {
  key: string;
  date: string;
  platform: Platform;
  category: Category;
  watchMs: number;
  count: number;
}

export interface TabStats {
  shortsCount: number;
  shortsMs: number;
  regularCount: number;
  regularMs: number;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface RuntimeMessage {
  type: string;
  payload?: any;
}

export interface GlobalSummary {
  today: TabStats;
  yesterday: TabStats;
  last7Days: TabStats;
  last30Days: TabStats;
  platforms: Record<Platform, TabStats>;
  trends: Array<{
    date: string;
    shorts: { count: number; watchMs: number };
    regular: { count: number; watchMs: number };
  }>;
}