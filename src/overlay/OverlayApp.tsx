import React, { useState, useEffect } from 'react';
import { TabStats } from '../types';
import { formatTime } from '../utils';

interface OverlayAppProps {
  // No props - fetches data from background
}

const OverlayApp: React.FC<OverlayAppProps> = () => {
  const [stats, setStats] = useState<TabStats>({
    shortsCount: 0,
    shortsMs: 0,
    regularCount: 0,
    regularMs: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHidden] = useState(false);

  useEffect(() => {
    // Fetch initial stats
    fetchStats();

    // Set up periodic updates
    const interval = setInterval(fetchStats, 1000);

    // Listen for messages from background
    const messageListener = (message: any) => {
      if (message.type === 'TAB_STATS_UPDATE') {
        setStats(message.payload);
        setIsLoading(false);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      clearInterval(interval);
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  const fetchStats = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_TAB_STATS'
      });
      
      if (response) {
        setStats(response);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleSettingsClick = () => {
    chrome.runtime.openOptionsPage();
  };

  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed);
  };

  const getProgressPercentage = (current: number, max: number): number => {
    if (max === 0) return 0;
    return Math.min((current / max) * 100, 100);
  };

  // Calculate max values for progress bars
  const maxWatchTime = Math.max(stats.shortsMs, stats.regularMs);

  if (isHidden) {
    return null;
  }

  return (
    <div className={`swt-overlay ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="swt-header">
        <div className="swt-title" onClick={toggleCollapsed} style={{ cursor: 'pointer' }}>
          📺 Watch Tracker
        </div>
        <button 
          className="swt-settings-btn" 
          onClick={handleSettingsClick}
          title="Settings"
        >
          ⚙️
        </button>
      </div>

      {isLoading ? (
        <div className="swt-loading">Loading...</div>
      ) : (
        <>
          <div className="swt-stats-group">
            <div className="swt-category-title">Shorts</div>
            <div className="swt-stat-row">
              <span className="swt-stat-label">Count:</span>
              <span className="swt-stat-value">{stats.shortsCount}</span>
            </div>
            <div className="swt-stat-row">
              <span className="swt-stat-label">Time:</span>
              <span className="swt-stat-value">{formatTime(stats.shortsMs)}</span>
            </div>
            <div className="swt-progress-container">
              <div 
                className="swt-progress-bar shorts"
                style={{ 
                  width: `${getProgressPercentage(stats.shortsMs, maxWatchTime)}%` 
                }}
              />
            </div>
          </div>

          <div className="swt-stats-group">
            <div className="swt-category-title">Regular</div>
            <div className="swt-stat-row">
              <span className="swt-stat-label">Count:</span>
              <span className="swt-stat-value">{stats.regularCount}</span>
            </div>
            <div className="swt-stat-row">
              <span className="swt-stat-label">Time:</span>
              <span className="swt-stat-value">{formatTime(stats.regularMs)}</span>
            </div>
            <div className="swt-progress-container">
              <div 
                className="swt-progress-bar regular"
                style={{ 
                  width: `${getProgressPercentage(stats.regularMs, maxWatchTime)}%` 
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OverlayApp;