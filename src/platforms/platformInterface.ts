import { TrackerEvent } from '../types';

export interface PlatformModule {
  platformId: string;
  matches(url: string): boolean;
  init(root: Document, emit: (event: TrackerEvent) => void): { destroy(): void };
}