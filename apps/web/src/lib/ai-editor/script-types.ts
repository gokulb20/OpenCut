/**
 * Script Types
 *
 * Defines the VideoScript format - a declarative way to define videos.
 * Inspired by Editly and Shotstack's JSON-based video editing formats.
 *
 * Design rationale:
 * - "clips" maps to timeline sections (sequential, no overlap)
 * - Each clip can have media + text overlay (layers stacked)
 * - Audio track is separate (music/voiceover spans entire video)
 * - Maps cleanly to OpenCut's timeline model
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * A complete video script definition
 */
export interface VideoScript {
  /** Project name */
  name: string;

  /** Canvas aspect ratio */
  canvas: "16:9" | "9:16" | "1:1";

  /** Sequential clips that make up the video */
  clips: Clip[];

  /** Audio tracks (music and/or voiceover) */
  audio?: {
    /** Background music */
    music?: {
      /** Use existing media */
      mediaId?: string;
      /** Or generate with AI */
      generate?: string;
    };
    /** Voiceover narration */
    voiceover?: {
      /** Use existing media */
      mediaId?: string;
      /** Or generate with AI TTS */
      text?: string;
      /** Voice to use for TTS */
      voice?: string;
    };
  };
}

/**
 * A single clip in the video
 * Clips are sequential - they play one after another
 */
export interface Clip {
  /** Duration in seconds */
  duration: number;

  /** Visual media layer (optional - can be text-only) */
  media?: {
    /** Use existing media by ID */
    id?: string;
    /** Or generate with AI */
    generate?: string;
    /** How to fit media to canvas */
    fit?: "cover" | "contain";
    /** Trim source media */
    trim?: { start?: number; end?: number };
  };

  /** Text overlay (optional) */
  text?: {
    /** The text content */
    content: string;
    /** Style preset */
    style?: "title" | "subtitle" | "caption";
    /** Position on screen */
    position?: "top" | "center" | "bottom";
  };

  /** Transition to next clip (not implemented yet) */
  transition?: {
    type: "fade" | "crossfade" | "wipe";
    duration: number;
  };
}

/**
 * Content to fill a template clip
 */
export interface ClipContent {
  /** Media ID to use */
  mediaId?: string;
  /** AI prompt to generate media */
  generate?: string;
  /** Text content (replaces template text) */
  text?: string;
}

// ============================================================================
// Execution Result Types
// ============================================================================

/**
 * Result of executing a video script
 */
export interface ScriptExecutionResult {
  /** Overall success */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Number of clips successfully placed */
  completedClips: number;

  /** Total clips in script */
  totalClips: number;

  /** IDs of any AI-generated media */
  generatedMedia: string[];

  /** IDs of tracks created */
  trackIds: {
    media?: string;
    text?: string;
    music?: string;
    voiceover?: string;
  };

  /** Any warnings (non-fatal issues) */
  warnings: string[];
}

/**
 * Progress callback for script execution
 */
export interface ScriptProgressCallback {
  (stage: string, progress: number, message: string): void;
}

// ============================================================================
// Canvas Utilities
// ============================================================================

/**
 * Get canvas dimensions from aspect ratio
 */
export function getCanvasDimensions(
  canvas: "16:9" | "9:16" | "1:1"
): { width: number; height: number } {
  switch (canvas) {
    case "16:9":
      return { width: 1920, height: 1080 };
    case "9:16":
      return { width: 1080, height: 1920 };
    case "1:1":
      return { width: 1080, height: 1080 };
    default:
      return { width: 1920, height: 1080 };
  }
}

/**
 * Calculate total script duration
 */
export function getScriptDuration(script: VideoScript): number {
  return script.clips.reduce((sum, clip) => sum + clip.duration, 0);
}
