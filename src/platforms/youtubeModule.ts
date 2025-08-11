import { PlatformModule } from './platformInterface';
import { TrackerEvent, Platform, Category } from '../types';
import { extractVideoId, generateEventId } from '../utils';

export class YouTubeModule implements PlatformModule {
  platformId = 'youtube';
  private currentVideo: HTMLVideoElement | null = null;
  private currentVideoId: string | null = null;
  private observers: MutationObserver[] = [];
  private eventListeners: Array<{ element: Element | Window; event: string; handler: EventListener }> = [];
  private emit: ((event: TrackerEvent) => void) | null = null;
  private lastTimeUpdate = 0;
  private timeUpdateThrottle = 1000; // 1 second

  matches(url: string): boolean {
    return url.includes('youtube.com');
  }

  init(root: Document, emit: (event: TrackerEvent) => void): { destroy(): void } {
    this.emit = emit;
    this.setupVideoDetection(root);
    this.setupNavigationDetection();
    
    return {
      destroy: () => this.destroy()
    };
  }

  private setupVideoDetection(root: Document): void {
    // Initial video detection
    this.detectVideo(root);

    // Watch for DOM changes to detect new videos
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (element.tagName === 'VIDEO' || element.querySelector('video')) {
                this.detectVideo(root);
                break;
              }
            }
          }
        }
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true
    });

    this.observers.push(observer);
  }

  private setupNavigationDetection(): void {
    // Listen for URL changes (SPA navigation)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    const handleNavigation = () => {
      setTimeout(() => {
        this.handleNavigation();
      }, 100); // Small delay to let the page update
    };

    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      handleNavigation();
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      handleNavigation();
    };

    this.addEventListener(window, 'popstate', handleNavigation);
  }

  private detectVideo(root: Document): void {
    const video = root.querySelector('video') as HTMLVideoElement;
    
    if (video && video !== this.currentVideo) {
      this.setupVideoListeners(video);
    }
  }

  private setupVideoListeners(video: HTMLVideoElement): void {
    // Clean up previous video listeners
    this.cleanupVideoListeners();

    this.currentVideo = video;
    this.currentVideoId = this.getCurrentVideoId();

    // Add event listeners
    this.addEventListener(video, 'play', () => this.handlePlay());
    this.addEventListener(video, 'pause', () => this.handlePause());
    this.addEventListener(video, 'ended', () => this.handleEnd());
    this.addEventListener(video, 'timeupdate', () => this.handleTimeUpdate());
    this.addEventListener(video, 'loadstart', () => this.handleLoadStart());
  }

  private cleanupVideoListeners(): void {
    // Remove all event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
  }

  private addEventListener(element: Element | Window, event: string, handler: EventListener): void {
    element.addEventListener(event, handler);
    this.eventListeners.push({ element, event, handler });
  }

  private getCurrentVideoId(): string | null {
    return extractVideoId(window.location.href);
  }

  private getVideoCategory(): Category {
    const pathname = window.location.pathname;
    
    // Check if it's a Shorts URL
    if (pathname.startsWith('/shorts')) {
      return 'shorts';
    }
    
    // Check video duration for regular videos
    if (this.currentVideo && this.currentVideo.duration > 0 && this.currentVideo.duration < 60) {
      return 'shorts';
    }
    
    return 'regular';
  }

  private createEvent(type: TrackerEvent['type'], additionalData: Partial<TrackerEvent> = {}): TrackerEvent {
    const videoId = this.getCurrentVideoId();
    const category = this.getVideoCategory();
    
    return {
      eventId: generateEventId(),
      timestamp: Date.now(),
      platform: 'youtube' as Platform,
      category,
      type,
      currentTime: this.currentVideo?.currentTime ? Math.floor(this.currentVideo.currentTime * 1000) : undefined,
      duration: this.currentVideo?.duration ? Math.floor(this.currentVideo.duration * 1000) : undefined,
      meta: {
        videoId: videoId || undefined,
        title: document.title,
        url: window.location.href
      },
      ...additionalData
    };
  }

  private handlePlay(): void {
    if (!this.emit) return;
    
    this.emit(this.createEvent('start'));
  }

  private handlePause(): void {
    if (!this.emit) return;
    
    this.emit(this.createEvent('pause'));
  }

  private handleEnd(): void {
    if (!this.emit) return;
    
    this.emit(this.createEvent('end'));
  }

  private handleTimeUpdate(): void {
    if (!this.emit || !this.currentVideo) return;
    
    const now = Date.now();
    if (now - this.lastTimeUpdate < this.timeUpdateThrottle) {
      return;
    }
    
    this.lastTimeUpdate = now;
    this.emit(this.createEvent('time_update'));
  }

  private handleLoadStart(): void {
    // Video changed, update current video ID
    const newVideoId = this.getCurrentVideoId();
    if (newVideoId !== this.currentVideoId) {
      this.currentVideoId = newVideoId;
      this.handleNavigation();
    }
  }

  private handleNavigation(): void {
    if (!this.emit) return;
    
    const newVideoId = this.getCurrentVideoId();
    if (newVideoId !== this.currentVideoId) {
      this.currentVideoId = newVideoId;
      this.emit(this.createEvent('navigation'));
      
      // Re-detect video element after navigation
      setTimeout(() => {
        this.detectVideo(document);
      }, 500);
    }
  }

  private destroy(): void {
    // Clean up observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    
    // Clean up event listeners
    this.cleanupVideoListeners();
    
    // Reset state
    this.currentVideo = null;
    this.currentVideoId = null;
    this.emit = null;
  }
}