# Social Watch Tracker

A modular Chrome extension that tracks video watch counts and watch time for different social media platforms, starting with YouTube.

## Features

- **Real-time tracking** of video watch time and counts
- **Platform-specific modules** (currently YouTube, extensible to TikTok, Instagram, etc.)
- **Overlay UI** showing live stats while browsing
- **Comprehensive dashboard** with charts and analytics
- **Data export** in CSV and JSON formats
- **Local storage** using IndexedDB for privacy
- **Modular architecture** for easy platform additions

## Architecture

### Core Components

1. **Content Scripts** - Platform-specific event detection
2. **Background Engine** - Data aggregation and session management
3. **Overlay UI** - Real-time stats display (React + Shadow DOM)
4. **Dashboard** - Analytics and data visualization (React + Chart.js)
5. **Storage Layer** - IndexedDB with automatic cleanup

### Platform Modules

- **YouTube Module**: Detects Shorts vs regular videos, tracks play/pause/end events
- **Extensible Interface**: Easy to add TikTok, Instagram, and other platforms

## Installation

### Development Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` folder

### Production Build

```bash
npm run build
```

## Usage

1. **Install the extension** and navigate to YouTube
2. **Watch videos** - the overlay will appear in the top-right corner showing real-time stats
3. **View dashboard** - click the settings button in the overlay or go to the extension options
4. **Export data** - use the dashboard to export your watch history

## Data Categories

- **Shorts**: Videos under 60 seconds or from `/shorts` URLs
- **Regular**: Standard YouTube videos over 60 seconds

## Privacy

- All data is stored locally using IndexedDB
- No data is sent to external servers
- Raw events are automatically cleaned up after 30 days
- Daily aggregates are preserved for analytics

## Development

### Project Structure

```
/src
  /platforms
    youtubeModule.ts      # YouTube-specific tracking
    platformInterface.ts  # Platform module interface
  /overlay
    OverlayApp.tsx       # Real-time stats overlay
    overlay.css          # Overlay styles
  /dashboard
    Dashboard.tsx        # Analytics dashboard
    dashboard.css        # Dashboard styles
  contentScript.tsx      # Content script entry point
  background.ts          # Background service worker
  storage.ts            # IndexedDB storage layer
  types.ts              # TypeScript definitions
  utils.ts              # Utility functions
```

### Adding New Platforms

1. Create a new module implementing `PlatformModule` interface
2. Add platform detection logic in `contentScript.tsx`
3. Update types and storage as needed
4. Test thoroughly with the new platform

### Building

- **Development**: `npm run dev`
- **Production**: `npm run build`
- **Type checking**: `npm run type-check`

## Technical Details

### Event Types

- `start`: Video playback begins
- `pause`: Video is paused
- `time_update`: Periodic time updates (throttled to 1s)
- `end`: Video playback ends
- `navigation`: SPA navigation to new video

### Storage Schema

- **Events**: Raw tracking events with 30-day retention
- **Daily Aggregates**: Summarized data by date/platform/category
- **Settings**: User preferences and configuration

### Performance

- Throttled time updates (1 second intervals)
- Efficient DOM observation with MutationObserver
- Background aggregation to minimize content script overhead
- Shadow DOM isolation for overlay styles

## Browser Compatibility

- Chrome Manifest V3
- Modern JavaScript (ES2020+)
- React 18+ with TypeScript

## License

MIT License - see LICENSE file for details.