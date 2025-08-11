import { createRoot } from 'react-dom/client';
import { YouTubeModule } from './platforms/youtubeModule';
import { PlatformModule } from './platforms/platformInterface';
import { TrackerEvent } from './types';
import OverlayApp from './overlay/OverlayApp';

class ContentScript {
  private platformModule: PlatformModule | null = null;
  private overlayContainer: HTMLDivElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private reactRoot: any = null;
  private moduleCleanup: (() => void) | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    try {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }

      // Initialize platform module
      await this.initializePlatformModule();
      
      // Create overlay
      await this.createOverlay();

      // Set up cleanup on page unload
      window.addEventListener('beforeunload', () => this.cleanup());
      
    } catch (error) {
      console.error('ContentScript initialization failed:', error);
    }
  }

  private async initializePlatformModule(): Promise<void> {
    const currentUrl = window.location.href;
    
    // Check which platform module to load
    const youtubeModule = new YouTubeModule();
    
    if (youtubeModule.matches(currentUrl)) {
      this.platformModule = youtubeModule;
      
      // Initialize the module with event emission
      this.moduleCleanup = this.platformModule.init(document, (event: TrackerEvent) => {
        this.handleTrackerEvent(event);
      }).destroy;
    }
  }

  private async createOverlay(): Promise<void> {
    // Create container element
    this.overlayContainer = document.createElement('div');
    this.overlayContainer.id = 'social-watch-tracker-overlay';
    this.overlayContainer.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      z-index: 2147483647;
      pointer-events: none;
    `;

    // Create shadow DOM to isolate styles
    this.shadowRoot = this.overlayContainer.attachShadow({ mode: 'closed' });
    
    // Create React root container
    const reactContainer = document.createElement('div');
    reactContainer.style.pointerEvents = 'auto';
    this.shadowRoot.appendChild(reactContainer);

    // Load CSS
    await this.loadOverlayCSS();

    // Render React app
    this.reactRoot = createRoot(reactContainer);
    this.reactRoot.render(<OverlayApp />);

    // Add to page
    document.body.appendChild(this.overlayContainer);
  }

  private async loadOverlayCSS(): Promise<void> {
    try {
      // Get CSS from web accessible resources
      const cssUrl = chrome.runtime.getURL('overlay.css');
      const response = await fetch(cssUrl);
      const cssText = await response.text();

      // Create style element
      const style = document.createElement('style');
      style.textContent = cssText;
      this.shadowRoot?.appendChild(style);
    } catch (error) {
      console.error('Failed to load overlay CSS:', error);
      // Fallback: inject basic styles
      const style = document.createElement('style');
      style.textContent = `
        .swt-overlay {
          position: fixed;
          top: 20px;
          right: 20px;
          background: rgba(0, 0, 0, 0.85);
          color: white;
          padding: 12px;
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          min-width: 200px;
          z-index: 10000;
        }
      `;
      this.shadowRoot?.appendChild(style);
    }
  }

  private handleTrackerEvent(event: TrackerEvent): void {
    // Send event to background script
    chrome.runtime.sendMessage({
      type: 'TRACK_EVENT',
      payload: event
    }).catch(error => {
      console.error('Failed to send tracker event:', error);
    });
  }

  private cleanup(): void {
    // Clean up platform module
    if (this.moduleCleanup) {
      this.moduleCleanup();
      this.moduleCleanup = null;
    }

    // Clean up React
    if (this.reactRoot) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }

    // Remove overlay from DOM
    if (this.overlayContainer && this.overlayContainer.parentNode) {
      this.overlayContainer.parentNode.removeChild(this.overlayContainer);
      this.overlayContainer = null;
    }

    this.shadowRoot = null;
    this.platformModule = null;
  }
}

// Initialize content script
new ContentScript();