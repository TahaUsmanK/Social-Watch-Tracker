import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { TrackerEvent, DailyAggregate, DateRange, Platform, Category } from './types';
import { getDateString } from './utils';

interface TrackerDB extends DBSchema {
  events: {
    key: string;
    value: TrackerEvent;
    indexes: { 'by-date': string; 'by-platform': Platform };
  };
  dailyAggregates: {
    key: string;
    value: DailyAggregate;
    indexes: { 'by-date': string; 'by-platform': Platform };
  };
  settings: {
    key: string;
    value: any;
  };
}

class StorageManager {
  private db: IDBPDatabase<TrackerDB> | null = null;
  private readonly DB_NAME = 'SocialWatchTracker';
  private readonly DB_VERSION = 1;

  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<TrackerDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        // Events store
        const eventsStore = db.createObjectStore('events', { keyPath: 'eventId' });
        eventsStore.createIndex('by-date', 'timestamp');
        eventsStore.createIndex('by-platform', 'platform');

        // Daily aggregates store
        const aggregatesStore = db.createObjectStore('dailyAggregates', { keyPath: 'key' });
        aggregatesStore.createIndex('by-date', 'date');
        aggregatesStore.createIndex('by-platform', 'platform');

        // Settings store
        db.createObjectStore('settings', { keyPath: 'key' });
      },
    });

    // Clean up old events (older than 30 days)
    await this.cleanupOldEvents();
  }

  async addEvent(event: TrackerEvent): Promise<void> {
    if (!this.db) await this.init();
    
    const eventWithId = {
      ...event,
      eventId: event.eventId || `${event.timestamp}-${Math.random().toString(36).substr(2, 9)}`
    };

    await this.db!.add('events', eventWithId);
  }

  async updateAggregate(
    date: string,
    platform: Platform,
    category: Category,
    watchMsDelta: number,
    countDelta: number = 0
  ): Promise<void> {
    if (!this.db) await this.init();

    const key = `${date}::${platform}::${category}`;
    const existing = await this.db!.get('dailyAggregates', key);

    const aggregate: DailyAggregate = {
      key,
      date,
      platform,
      category,
      watchMs: (existing?.watchMs || 0) + watchMsDelta,
      count: (existing?.count || 0) + countDelta
    };

    await this.db!.put('dailyAggregates', aggregate);
  }

  async getAggregates(range: DateRange): Promise<DailyAggregate[]> {
    if (!this.db) await this.init();

    const tx = this.db!.transaction('dailyAggregates', 'readonly');
    const store = tx.objectStore('dailyAggregates');
    const index = store.index('by-date');

    const results: DailyAggregate[] = [];
    let cursor = await index.openCursor();

    while (cursor) {
      const aggregate = cursor.value;
      if (aggregate.date >= range.start && aggregate.date <= range.end) {
        results.push(aggregate);
      }
      cursor = await cursor.continue();
    }

    return results;
  }

  async getTodayAggregates(): Promise<DailyAggregate[]> {
    const today = getDateString();
    return this.getAggregates({ start: today, end: today });
  }

  async getYesterdayAggregates(): Promise<DailyAggregate[]> {
    const yesterday = getDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
    return this.getAggregates({ start: yesterday, end: yesterday });
  }

  async getLast7DaysAggregates(): Promise<DailyAggregate[]> {
    const end = getDateString();
    const start = getDateString(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    return this.getAggregates({ start, end });
  }

  async getLast30DaysAggregates(): Promise<DailyAggregate[]> {
    const end = getDateString();
    const start = getDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    return this.getAggregates({ start, end });
  }

  async exportCSV(range: DateRange): Promise<string> {
    const aggregates = await this.getAggregates(range);
    
    const headers = ['Date', 'Platform', 'Category', 'Watch Time (minutes)', 'Count'];
    const rows = aggregates.map(agg => [
      agg.date,
      agg.platform,
      agg.category,
      Math.round(agg.watchMs / 60000 * 100) / 100, // Convert to minutes with 2 decimal places
      agg.count
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  async exportJSON(range: DateRange): Promise<string> {
    const aggregates = await this.getAggregates(range);
    return JSON.stringify(aggregates, null, 2);
  }

  async getSetting(key: string, defaultValue: any = null): Promise<any> {
    if (!this.db) await this.init();
    
    const result = await this.db!.get('settings', key);
    return result?.value ?? defaultValue;
  }

  async setSetting(key: string, value: any): Promise<void> {
    if (!this.db) await this.init();
    
    await this.db!.put('settings', { key, value });
  }

  private async cleanupOldEvents(): Promise<void> {
    if (!this.db) return;

    const cutoffDate = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days ago
    const tx = this.db.transaction('events', 'readwrite');
    const store = tx.objectStore('events');
    const index = store.index('by-date');

    let cursor = await index.openCursor();
    while (cursor) {
      if (cursor.value.timestamp < cutoffDate) {
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }
  }
}

export const storage = new StorageManager();