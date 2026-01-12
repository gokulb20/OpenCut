/**
 * AI Video Editor Types
 *
 * Defines the action system that allows an AI agent to manipulate the video editor.
 * Each action maps to operations on the timeline, media, and external AI services.
 */

// ============================================================================
// Core Types
// ============================================================================

export interface AIMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  actions?: AIActionResult[];
}

export interface AIActionResult {
  action: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface AIConversation {
  id: string;
  projectId: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Action Definitions - These are the "tools" the AI can call
// ============================================================================

export type AIAction =
  // Timeline Actions
  | AddClipToTimelineAction
  | RemoveClipAction
  | TrimClipAction
  | SplitClipAction
  | MoveClipAction
  | DuplicateClipAction
  // Text Actions
  | AddTextAction
  | UpdateTextAction
  | RemoveTextAction
  // Audio Actions
  | SeparateAudioAction
  | MuteClipAction
  | AddMusicAction
  // Track Actions
  | AddTrackAction
  | RemoveTrackAction
  | MuteTrackAction
  // Playback Actions
  | SeekToTimeAction
  | PlayAction
  | PauseAction
  // Project Actions
  | SetCanvasSizeAction
  | SetProjectFpsAction
  // AI Generation Actions
  | GenerateVideoAction
  | GenerateMusicAction
  | GenerateVoiceoverAction
  | AnalyzeVideoAction
  | TranscribeAudioAction
  // Query Actions
  | GetTimelineInfoAction
  | GetMediaListAction
  | GetProjectInfoAction;

// ============================================================================
// Timeline Actions
// ============================================================================

export interface AddClipToTimelineAction {
  type: "add_clip_to_timeline";
  params: {
    mediaId: string;
    trackId?: string; // Optional - will create or find appropriate track
    startTime: number;
    duration?: number; // Optional - uses media duration if not specified
    trimStart?: number;
    trimEnd?: number;
  };
}

export interface RemoveClipAction {
  type: "remove_clip";
  params: {
    trackId: string;
    elementId: string;
  };
}

export interface TrimClipAction {
  type: "trim_clip";
  params: {
    trackId: string;
    elementId: string;
    trimStart?: number;
    trimEnd?: number;
    duration?: number;
  };
}

export interface SplitClipAction {
  type: "split_clip";
  params: {
    trackId: string;
    elementId: string;
    splitTime: number;
    keepSide: "left" | "right" | "both";
  };
}

export interface MoveClipAction {
  type: "move_clip";
  params: {
    trackId: string;
    elementId: string;
    newStartTime?: number;
    newTrackId?: string;
  };
}

export interface DuplicateClipAction {
  type: "duplicate_clip";
  params: {
    trackId: string;
    elementId: string;
  };
}

// ============================================================================
// Text Actions
// ============================================================================

export interface AddTextAction {
  type: "add_text";
  params: {
    content: string;
    startTime: number;
    duration: number;
    trackId?: string;
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    backgroundColor?: string;
    textAlign?: "left" | "center" | "right";
    fontWeight?: "normal" | "bold";
    fontStyle?: "normal" | "italic";
    x?: number;
    y?: number;
    rotation?: number;
    opacity?: number;
  };
}

export interface UpdateTextAction {
  type: "update_text";
  params: {
    trackId: string;
    elementId: string;
    content?: string;
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    backgroundColor?: string;
    textAlign?: "left" | "center" | "right";
    fontWeight?: "normal" | "bold";
    fontStyle?: "normal" | "italic";
    x?: number;
    y?: number;
    rotation?: number;
    opacity?: number;
  };
}

export interface RemoveTextAction {
  type: "remove_text";
  params: {
    trackId: string;
    elementId: string;
  };
}

// ============================================================================
// Audio Actions
// ============================================================================

export interface SeparateAudioAction {
  type: "separate_audio";
  params: {
    trackId: string;
    elementId: string;
  };
}

export interface MuteClipAction {
  type: "mute_clip";
  params: {
    trackId: string;
    elementId: string;
    muted: boolean;
  };
}

export interface AddMusicAction {
  type: "add_music";
  params: {
    mediaId: string;
    startTime: number;
    duration?: number;
    volume?: number;
  };
}

// ============================================================================
// Track Actions
// ============================================================================

export interface AddTrackAction {
  type: "add_track";
  params: {
    trackType: "media" | "text" | "audio";
    name?: string;
  };
}

export interface RemoveTrackAction {
  type: "remove_track";
  params: {
    trackId: string;
  };
}

export interface MuteTrackAction {
  type: "mute_track";
  params: {
    trackId: string;
    muted: boolean;
  };
}

// ============================================================================
// Playback Actions
// ============================================================================

export interface SeekToTimeAction {
  type: "seek_to_time";
  params: {
    time: number;
  };
}

export interface PlayAction {
  type: "play";
  params: Record<string, never>;
}

export interface PauseAction {
  type: "pause";
  params: Record<string, never>;
}

// ============================================================================
// Project Actions
// ============================================================================

export interface SetCanvasSizeAction {
  type: "set_canvas_size";
  params: {
    preset: "16:9" | "9:16" | "1:1" | "4:3" | "custom";
    width?: number;
    height?: number;
  };
}

export interface SetProjectFpsAction {
  type: "set_project_fps";
  params: {
    fps: number;
  };
}

// ============================================================================
// AI Generation Actions - For external AI APIs
// ============================================================================

export interface GenerateVideoAction {
  type: "generate_video";
  params: {
    prompt: string;
    duration?: number;
    aspectRatio?: "16:9" | "9:16" | "1:1";
    provider?: "kling" | "runway" | "pika" | "gemini";
  };
}

export interface GenerateMusicAction {
  type: "generate_music";
  params: {
    prompt: string;
    duration?: number;
    genre?: string;
    mood?: string;
    provider?: "suno" | "udio";
  };
}

export interface GenerateVoiceoverAction {
  type: "generate_voiceover";
  params: {
    text: string;
    voice?: string;
    speed?: number;
    provider?: "elevenlabs" | "openai";
  };
}

export interface AnalyzeVideoAction {
  type: "analyze_video";
  params: {
    mediaId: string;
    analysisType: "scenes" | "objects" | "transcript" | "summary";
  };
}

export interface TranscribeAudioAction {
  type: "transcribe_audio";
  params: {
    mediaId: string;
    language?: string;
    addCaptions?: boolean;
  };
}

// ============================================================================
// Query Actions - For reading state
// ============================================================================

export interface GetTimelineInfoAction {
  type: "get_timeline_info";
  params: Record<string, never>;
}

export interface GetMediaListAction {
  type: "get_media_list";
  params: Record<string, never>;
}

export interface GetProjectInfoAction {
  type: "get_project_info";
  params: Record<string, never>;
}

// ============================================================================
// API Configuration
// ============================================================================

export interface AIApiConfig {
  // LLM for orchestration
  anthropicApiKey?: string;
  openaiApiKey?: string;

  // Video generation
  klingApiKey?: string;
  runwayApiKey?: string;
  pikaApiKey?: string;
  geminiApiKey?: string;

  // Music generation
  sunoApiKey?: string;
  udioApiKey?: string;

  // Voice generation
  elevenlabsApiKey?: string;

  // Preferred providers
  preferredVideoProvider?: "kling" | "runway" | "pika" | "gemini";
  preferredMusicProvider?: "suno" | "udio";
  preferredVoiceProvider?: "elevenlabs" | "openai";
}

// ============================================================================
// Action Schema for Tool Calling
// ============================================================================

export interface ActionSchema {
  name: string;
  description: string;
  parameters: Record<
    string,
    {
      type: "string" | "number" | "boolean" | "object";
      description: string;
      required?: boolean;
      enum?: string[];
    }
  >;
}

export const ACTION_SCHEMAS: ActionSchema[] = [
  {
    name: "add_clip_to_timeline",
    description:
      "Add a media clip (video, image, or audio) to the timeline at a specific position",
    parameters: {
      mediaId: {
        type: "string",
        description: "The ID of the media file to add",
        required: true,
      },
      startTime: {
        type: "number",
        description: "Start time in seconds where the clip should be placed",
        required: true,
      },
      trackId: {
        type: "string",
        description:
          "Optional track ID. If not specified, an appropriate track will be found or created",
      },
      duration: {
        type: "number",
        description: "Duration in seconds. Defaults to media duration",
      },
    },
  },
  {
    name: "trim_clip",
    description:
      "Trim a clip by adjusting its start/end points or overall duration",
    parameters: {
      trackId: {
        type: "string",
        description: "The track ID containing the clip",
        required: true,
      },
      elementId: {
        type: "string",
        description: "The element/clip ID to trim",
        required: true,
      },
      trimStart: {
        type: "number",
        description: "Amount to trim from the start in seconds",
      },
      trimEnd: {
        type: "number",
        description: "Amount to trim from the end in seconds",
      },
      duration: {
        type: "number",
        description: "New total duration in seconds",
      },
    },
  },
  {
    name: "split_clip",
    description: "Split a clip at a specific time point",
    parameters: {
      trackId: {
        type: "string",
        description: "The track ID containing the clip",
        required: true,
      },
      elementId: {
        type: "string",
        description: "The element/clip ID to split",
        required: true,
      },
      splitTime: {
        type: "number",
        description: "Time in seconds where to split the clip",
        required: true,
      },
      keepSide: {
        type: "string",
        description: "Which side to keep after splitting",
        enum: ["left", "right", "both"],
        required: true,
      },
    },
  },
  {
    name: "add_text",
    description: "Add a text overlay to the timeline",
    parameters: {
      content: {
        type: "string",
        description: "The text content to display",
        required: true,
      },
      startTime: {
        type: "number",
        description: "Start time in seconds",
        required: true,
      },
      duration: {
        type: "number",
        description: "Duration in seconds",
        required: true,
      },
      fontSize: {
        type: "number",
        description: "Font size in pixels (default: 48)",
      },
      color: {
        type: "string",
        description: "Text color as hex (default: #FFFFFF)",
      },
      x: {
        type: "number",
        description: "X position relative to center (default: 0)",
      },
      y: {
        type: "number",
        description: "Y position relative to center (default: 0)",
      },
    },
  },
  {
    name: "generate_video",
    description: "Generate a video clip using AI based on a text prompt",
    parameters: {
      prompt: {
        type: "string",
        description: "Text description of the video to generate",
        required: true,
      },
      duration: {
        type: "number",
        description: "Desired duration in seconds",
      },
      aspectRatio: {
        type: "string",
        description: "Aspect ratio of the video",
        enum: ["16:9", "9:16", "1:1"],
      },
      provider: {
        type: "string",
        description: "AI provider to use",
        enum: ["kling", "runway", "pika", "gemini"],
      },
    },
  },
  {
    name: "generate_music",
    description: "Generate background music using AI based on a text prompt",
    parameters: {
      prompt: {
        type: "string",
        description: "Text description of the music to generate",
        required: true,
      },
      duration: {
        type: "number",
        description: "Desired duration in seconds",
      },
      genre: {
        type: "string",
        description: "Music genre (e.g., electronic, classical, jazz)",
      },
      mood: {
        type: "string",
        description: "Mood of the music (e.g., upbeat, calm, dramatic)",
      },
    },
  },
  {
    name: "transcribe_audio",
    description:
      "Transcribe audio from a video/audio clip and optionally add captions",
    parameters: {
      mediaId: {
        type: "string",
        description: "The media file ID to transcribe",
        required: true,
      },
      language: {
        type: "string",
        description: "Language code (auto-detected if not specified)",
      },
      addCaptions: {
        type: "boolean",
        description: "Whether to automatically add captions to the timeline",
      },
    },
  },
  {
    name: "get_timeline_info",
    description:
      "Get information about the current timeline including all tracks and clips",
    parameters: {},
  },
  {
    name: "get_media_list",
    description: "Get a list of all imported media files in the project",
    parameters: {},
  },
  {
    name: "seek_to_time",
    description: "Move the playhead to a specific time in the timeline",
    parameters: {
      time: {
        type: "number",
        description: "Time in seconds to seek to",
        required: true,
      },
    },
  },
];
