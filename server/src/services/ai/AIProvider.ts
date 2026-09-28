/**
 * AI provider boundary.
 *
 * Phase 1 deliberately contains NO AI implementation and NO AI credentials.
 * This file only defines the contract that a concrete provider (OpenAI,
 * Gemini, or a local model) must satisfy in a later phase, so that the
 * provider can be swapped without touching business logic.
 */
export interface VideoAnalysisInput {
  projectId: string;
  videoPath: string;
  /** Absolute path to the locally stored thumbnail, when present. */
  thumbnailPath?: string;
  /** Free-form direction from the user, e.g. "focus on the food". */
  userNotes?: string;
}

/** Structured, grounded understanding of the video produced by Phase 2. */
export interface ContentProfile {
  summary: string;
  topics: string[];
  keyMoments: { timestampSeconds: number; label: string }[];
  detectedLanguage?: string;
  transcript?: string;
}

export interface TitleOptions {
  count: number;
  maxLength: number;
  tone?: string;
}

export interface Chapter {
  timestampSeconds: number;
  title: string;
}

export interface AIProvider {
  readonly name: string;

  analyzeVideo(input: VideoAnalysisInput): Promise<ContentProfile>;
  generateTitles(profile: ContentProfile, options: TitleOptions): Promise<string[]>;
  generateHooks(profile: ContentProfile, options: TitleOptions): Promise<string[]>;
  generateDescription(profile: ContentProfile): Promise<string>;
  generateHashtags(profile: ContentProfile, options: TitleOptions): Promise<string[]>;
  generateTags(profile: ContentProfile, options: TitleOptions): Promise<string[]>;
  generateChapters(profile: ContentProfile): Promise<Chapter[]>;
}

/** Thrown when no AI provider is configured - expected in Phase 1. */
export class AIProviderNotConfiguredError extends Error {
  constructor() {
    super('No AI provider is configured. AI features are introduced in a later phase.');
    this.name = 'AIProviderNotConfiguredError';
  }
}
