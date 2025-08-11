import { TrackerEvent, SessionState, TabStats, GlobalSummary, RuntimeMessage } from './types';
import { storage } from './storage';
import { getDateString, isValidTimeDelta } from './utils';

class BackgroundEngine {
  private sessions: Map<string, SessionState> = new Map();
  private tabStats: Map<number, TabStats> = new Map();

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    // Initialize storage
    await storage.init();

    // Set up message listeners
    chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Clean up sessions when tabs are closed
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.cleanupTabSessions(tabId);
    });

    // Update tab stats periodically
    setInterval(() => {
      this.updateAllTabStats();
    }, 1000);
  }

  private async handleMessage(
    message: RuntimeMessage, 
    sender: chrome.runtime.MessageSender, 
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      switch (message.type) {
        case 'TRACK_EVENT':
          await this.handleTrackEvent(message.payload, sender.tab?.id);
          sendResponse({ success: true });
          break;

        case 'GET_TAB_STATS':
          const tabStats = await this.getTabStats(sender.tab?.id);
          sendResponse(tabStats);
          break;

        case 'GET_GLOBAL_SUMMARY':
          const summary = await this.getGlobalSummary();
          sendResponse(summary);
          break;

        case 'EXPORT_DATA':
          const exportData = await this.exportData(message.payload);
          sendResponse(exportData);
          break;

        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Background message handler error:', error);
      sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async handleTrackEvent(event: TrackerEvent, tabId?: number): Promise<void> {
    if (!tabId || !event.meta?.videoId) return;

    const sessionKey = `${tabId}::${event.meta.videoId}`;
    
    // Store raw event
    await storage.addEvent(event);

    switch (event.type) {
      case 'start':
      case 'navigation':
        await this.handleSessionStart(sessionKey, event, tabId);
        break;

      case 'time_update':
        await this.handleTimeUpdate(sessionKey, event, tabId);
        break;

      case 'end':
        await this.handleSessionEnd(sessionKey, event, tabId);
        break;

      case 'pause':
        // Update session but don't end it
        await this.handleTimeUpdate(sessionKey, event, tabId);
        break;
    }
  }

  private async handleSessionStart(sessionKey: string, event: TrackerEvent, tabId: number): Promise<void> {
    const session: SessionState = {
      videoId: event.meta?.videoId || '',
      platform: event.platform,
      category: event.category,
      startTime: event.timestamp,
      lastUpdateTime: event.timestamp,
      totalWatchMs: 0,
      counted: false
    };

    this.sessions.set(sessionKey, session);
    await this.updateTabStats(tabId);
  }

  private async handleTimeUpdate(sessionKey: string, event: TrackerEvent, tabId: number): Promise<void> {
    const session = this.sessions.get(sessionKey);
    if (!session) return;

    const timeDelta = event.timestamp - session.lastUpdateTime;
    
    if (isValidTimeDelta(timeDelta)) {
      session.totalWatchMs += timeDelta;
      session.lastUpdateTime = event.timestamp;

      // Update daily aggregate
      const today = getDateString();
      await storage.updateAggregate(
        today,
        session.platform,
        session.category,
        timeDelta,
        0
      );

      await this.updateTabStats(tabId);
    }
  }

  private async handleSessionEnd(sessionKey: string, event: TrackerEvent, tabId: number): Promise<void> {
    const session = this.sessions.get(sessionKey);
    if (!session) return;

    // Handle final time update
    await this.handleTimeUpdate(sessionKey, event, tabId);

    // Increment count if not already counted
    if (!session.counted) {
      const today = getDateString();
      await storage.updateAggregate(
        today,
        session.platform,
        session.category,
        0,
        1
      );
      session.counted = true;
    }

    // Clean up session
    this.sessions.delete(sessionKey);
    await this.updateTabStats(tabId);
  }

  private async updateTabStats(tabId: number): Promise<void> {
    const todayAggregates = await storage.getTodayAggregates();

    const stats: TabStats = {
      shortsCount: 0,
      shortsMs: 0,
      regularCount: 0,
      regularMs: 0
    };

    // Aggregate today's stats
    for (const aggregate of todayAggregates) {
      if (aggregate.category === 'shorts') {
        stats.shortsCount += aggregate.count;
        stats.shortsMs += aggregate.watchMs;
      } else if (aggregate.category === 'regular') {
        stats.regularCount += aggregate.count;
        stats.regularMs += aggregate.watchMs;
      }
    }

    // Add current session stats
    for (const [sessionKey, session] of this.sessions.entries()) {
      if (sessionKey.startsWith(`${tabId}::`)) {
        if (session.category === 'shorts') {
          stats.shortsMs += session.totalWatchMs;
          if (!session.counted) stats.shortsCount += 1;
        } else if (session.category === 'regular') {
          stats.regularMs += session.totalWatchMs;
          if (!session.counted) stats.regularCount += 1;
        }
      }
    }

    this.tabStats.set(tabId, stats);

    // Notify content script
    try {
      chrome.tabs.sendMessage(tabId, {
        type: 'TAB_STATS_UPDATE',
        payload: stats
      });
    } catch (error) {
      // Tab might be closed or not ready
    }
  }

  private async updateAllTabStats(): Promise<void> {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        await this.updateTabStats(tab.id);
      }
    }
  }

  private async getTabStats(tabId?: number): Promise<TabStats> {
    if (!tabId) {
      return { shortsCount: 0, shortsMs: 0, regularCount: 0, regularMs: 0 };
    }

    await this.updateTabStats(tabId);
    return this.tabStats.get(tabId) || { shortsCount: 0, shortsMs: 0, regularCount: 0, regularMs: 0 };
  }

  private async getGlobalSummary(): Promise<GlobalSummary> {
    const [todayAggs, yesterdayAggs, last7DaysAggs, last30DaysAggs] = await Promise.all([
      storage.getTodayAggregates(),
      storage.getYesterdayAggregates(),
      storage.getLast7DaysAggregates(),
      storage.getLast30DaysAggregates()
    ]);

    const aggregateStats = (aggregates: any[]): TabStats => {
      const stats: TabStats = { shortsCount: 0, shortsMs: 0, regularCount: 0, regularMs: 0 };
      
      for (const agg of aggregates) {
        if (agg.category === 'shorts') {
          stats.shortsCount += agg.count;
          stats.shortsMs += agg.watchMs;
        } else if (agg.category === 'regular') {
          stats.regularCount += agg.count;
          stats.regularMs += agg.watchMs;
        }
      }
      
      return stats;
    };

    // Generate trends data (last 30 days)
    const trendsMap = new Map<string, { shorts: { count: number; watchMs: number }, regular: { count: number; watchMs: number } }>();
    
    for (const agg of last30DaysAggs) {
      if (!trendsMap.has(agg.date)) {
        trendsMap.set(agg.date, {
          shorts: { count: 0, watchMs: 0 },
          regular: { count: 0, watchMs: 0 }
        });
      }
      
      const dayData = trendsMap.get(agg.date)!;
      if (agg.category === 'shorts') {
        dayData.shorts.count += agg.count;
        dayData.shorts.watchMs += agg.watchMs;
      } else if (agg.category === 'regular') {
        dayData.regular.count += agg.count;
        dayData.regular.watchMs += agg.watchMs;
      }
    }

    const trends = Array.from(trendsMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Platform breakdown
    const platformsMap = new Map<string, TabStats>();
    for (const agg of last30DaysAggs) {
      if (!platformsMap.has(agg.platform)) {
        platformsMap.set(agg.platform, { shortsCount: 0, shortsMs: 0, regularCount: 0, regularMs: 0 });
      }
      
      const platformStats = platformsMap.get(agg.platform)!;
      if (agg.category === 'shorts') {
        platformStats.shortsCount += agg.count;
        platformStats.shortsMs += agg.watchMs;
      } else if (agg.category === 'regular') {
        platformStats.regularCount += agg.count;
        platformStats.regularMs += agg.watchMs;
      }
    }

    return {
      today: aggregateStats(todayAggs),
      yesterday: aggregateStats(yesterdayAggs),
      last7Days: aggregateStats(last7DaysAggs),
      last30Days: aggregateStats(last30DaysAggs),
      platforms: Object.fromEntries(platformsMap) as Record<any, TabStats>,
      trends
    };
  }

  private async exportData(options: { format: 'csv' | 'json'; range: { start: string; end: string } }): Promise<string> {
    const { format, range } = options;
    
    if (format === 'csv') {
      return await storage.exportCSV(range);
    } else {
      return await storage.exportJSON(range);
    }
  }

  private cleanupTabSessions(tabId: number): void {
    // Remove all sessions for this tab
    const keysToDelete: string[] = [];
    for (const [key] of this.sessions.entries()) {
      if (key.startsWith(`${tabId}::`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.sessions.delete(key));
    this.tabStats.delete(tabId);
  }
}

// Initialize background engine
new BackgroundEngine();