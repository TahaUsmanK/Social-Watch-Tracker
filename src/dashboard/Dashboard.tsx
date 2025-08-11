import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { GlobalSummary, TabStats } from '../types';
import { formatTime, getDateString, getDaysAgo } from '../utils';
import './dashboard.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<GlobalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportStartDate, setExportStartDate] = useState(getDaysAgo(30));
  const [exportEndDate, setExportEndDate] = useState(getDateString());

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchSummary = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_GLOBAL_SUMMARY'
      });
      
      if (response) {
        setSummary(response);
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error);
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setExportLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXPORT_DATA',
        payload: {
          format,
          range: {
            start: exportStartDate,
            end: exportEndDate
          }
        }
      });

      if (response) {
        // Create download
        const blob = new Blob([response], { 
          type: format === 'csv' ? 'text/csv' : 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `watch-tracker-${exportStartDate}-to-${exportEndDate}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExportLoading(false);
    }
  };

  const renderOverviewCard = (title: string, stats: TabStats) => (
    <div className="overview-card">
      <div className="card-title">{title}</div>
      <div className="card-stats">
        <div className="stat-group">
          <div className="stat-label">Shorts</div>
          <div className="stat-value shorts">{stats.shortsCount}</div>
          <div className="stat-value shorts">{formatTime(stats.shortsMs)}</div>
        </div>
        <div className="stat-group">
          <div className="stat-label">Regular</div>
          <div className="stat-value regular">{stats.regularCount}</div>
          <div className="stat-value regular">{formatTime(stats.regularMs)}</div>
        </div>
      </div>
    </div>
  );

  const getPlatformBreakdownData = () => {
    if (!summary) return null;

    const platforms = Object.keys(summary.platforms);
    const shortsData = platforms.map(platform => summary.platforms[platform as keyof typeof summary.platforms].shortsMs);
    const regularData = platforms.map(platform => summary.platforms[platform as keyof typeof summary.platforms].regularMs);

    return {
      labels: platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)),
      datasets: [
        {
          label: 'Shorts (minutes)',
          data: shortsData.map(ms => Math.round(ms / 60000)),
          backgroundColor: 'rgba(231, 76, 60, 0.8)',
          borderColor: 'rgba(231, 76, 60, 1)',
          borderWidth: 1,
        },
        {
          label: 'Regular (minutes)',
          data: regularData.map(ms => Math.round(ms / 60000)),
          backgroundColor: 'rgba(52, 152, 219, 0.8)',
          borderColor: 'rgba(52, 152, 219, 1)',
          borderWidth: 1,
        },
      ],
    };
  };

  const getCategoryDistributionData = () => {
    if (!summary) return null;

    const totalShortsMs = summary.last30Days.shortsMs;
    const totalRegularMs = summary.last30Days.regularMs;

    return {
      labels: ['Shorts', 'Regular Videos'],
      datasets: [
        {
          data: [
            Math.round(totalShortsMs / 60000),
            Math.round(totalRegularMs / 60000)
          ],
          backgroundColor: [
            'rgba(231, 76, 60, 0.8)',
            'rgba(52, 152, 219, 0.8)',
          ],
          borderColor: [
            'rgba(231, 76, 60, 1)',
            'rgba(52, 152, 219, 1)',
          ],
          borderWidth: 2,
        },
      ],
    };
  };

  const getTrendsData = () => {
    if (!summary) return null;

    const last30Days = summary.trends.slice(-30);

    return {
      labels: last30Days.map(day => {
        const date = new Date(day.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }),
      datasets: [
        {
          label: 'Shorts (minutes)',
          data: last30Days.map(day => Math.round(day.shorts.watchMs / 60000)),
          borderColor: 'rgba(231, 76, 60, 1)',
          backgroundColor: 'rgba(231, 76, 60, 0.1)',
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Regular Videos (minutes)',
          data: last30Days.map(day => Math.round(day.regular.watchMs / 60000)),
          borderColor: 'rgba(52, 152, 219, 1)',
          backgroundColor: 'rgba(52, 152, 219, 0.1)',
          fill: true,
          tension: 0.4,
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <h1 className="dashboard-title">Social Watch Tracker</h1>
          <p className="dashboard-subtitle">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">📺 Social Watch Tracker</h1>
        <p className="dashboard-subtitle">Track your video consumption across social platforms</p>
      </div>

      {/* Overview Section */}
      <section className="overview-section">
        <h2 className="section-title">Overview</h2>
        <div className="overview-grid">
          {renderOverviewCard('Today', summary.today)}
          {renderOverviewCard('Yesterday', summary.yesterday)}
          {renderOverviewCard('Last 7 Days', summary.last7Days)}
          {renderOverviewCard('Last 30 Days', summary.last30Days)}
        </div>
      </section>

      {/* Charts Section */}
      <section className="charts-section">
        <h2 className="section-title">Analytics</h2>
        <div className="charts-grid">
          <div className="chart-container">
            <h3 className="chart-title">Platform Breakdown (Last 30 Days)</h3>
            <div className="chart-wrapper">
              {getPlatformBreakdownData() && (
                <Bar data={getPlatformBreakdownData()!} options={chartOptions} />
              )}
            </div>
          </div>
          
          <div className="chart-container">
            <h3 className="chart-title">Content Distribution (Last 30 Days)</h3>
            <div className="chart-wrapper">
              {getCategoryDistributionData() && (
                <Doughnut data={getCategoryDistributionData()!} options={doughnutOptions} />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Trends Section */}
      <section className="trends-section">
        <h2 className="section-title">Trends</h2>
        <div className="trends-container">
          <h3 className="chart-title">Daily Watch Time (Last 30 Days)</h3>
          <div className="trends-chart">
            {getTrendsData() && (
              <Line data={getTrendsData()!} options={chartOptions} />
            )}
          </div>
        </div>
      </section>

      {/* Export Section */}
      <section className="export-section">
        <h2 className="section-title">Export Data</h2>
        <div className="export-container">
          <div className="export-controls">
            <div className="date-input-group">
              <label htmlFor="start-date">Start Date:</label>
              <input
                id="start-date"
                type="date"
                value={exportStartDate}
                onChange={(e) => setExportStartDate(e.target.value)}
              />
            </div>
            <div className="date-input-group">
              <label htmlFor="end-date">End Date:</label>
              <input
                id="end-date"
                type="date"
                value={exportEndDate}
                onChange={(e) => setExportEndDate(e.target.value)}
              />
            </div>
            <div className="export-buttons">
              <button
                className="btn btn-primary"
                onClick={() => handleExport('csv')}
                disabled={exportLoading}
              >
                Export CSV
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleExport('json')}
                disabled={exportLoading}
              >
                Export JSON
              </button>
            </div>
          </div>
          {exportLoading && <div className="loading">Preparing export...</div>}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;