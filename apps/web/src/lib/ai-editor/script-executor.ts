/**
 * Script Executor
 *
 * Executes VideoScript definitions to build timelines.
 * This is the core engine that converts declarative scripts into actual video editor state.
 *
 * Usage:
 * ```typescript
 * import { executeScript } from '@/lib/ai-editor/script-executor';
 *
 * const result = await executeScript({
 *   name: "My Reel",
 *   canvas: "9:16",
 *   clips: [
 *     { duration: 3, text: { content: "Hello!", style: "title", position: "center" } },
 *     { duration: 5, media: { id: "media-123" } },
 *     { duration: 3, text: { content: "Follow for more!", style: "title", position: "center" } }
 *   ],
 *   audio: {
 *     music: { generate: "upbeat lo-fi" }
 *   }
 * });
 * ```
 */

import { useTimelineStore } from "@/stores/timeline-store";
import { useProjectStore } from "@/stores/project-store";
import { addClip, addText } from "./action-executor";
import {
  generateVideo,
  generateMusic,
  generateVoiceover,
} from "./ai-api-service";
import {
  getTextStyleProperties,
  getTextYPosition,
} from "./templates";
import type {
  VideoScript,
  Clip,
  ScriptExecutionResult,
  ScriptProgressCallback,
} from "./script-types";
import { getCanvasDimensions, getScriptDuration } from "./script-types";

// ============================================================================
// Main Executor
// ============================================================================

/**
 * Execute a video script to build the timeline
 *
 * @param script - The VideoScript to execute
 * @param onProgress - Optional progress callback
 * @returns Execution result with success status and details
 */
export async function executeScript(
  script: VideoScript,
  onProgress?: ScriptProgressCallback
): Promise<ScriptExecutionResult> {
  const result: ScriptExecutionResult = {
    success: false,
    completedClips: 0,
    totalClips: script.clips.length,
    generatedMedia: [],
    trackIds: {},
    warnings: [],
  };

  try {
    // Step 1: Set canvas size
    onProgress?.("setup", 0, "Setting up canvas...");
    await setupCanvas(script.canvas);

    // Step 2: Generate any AI content first (this can take time)
    onProgress?.("generating", 0.1, "Checking for AI content to generate...");
    const generatedContent = await generateAIContent(script, onProgress, result);

    // Step 3: Create tracks
    onProgress?.("tracks", 0.4, "Creating tracks...");
    const trackIds = await createTracks(script);
    result.trackIds = trackIds;

    // Step 4: Place clips on timeline
    onProgress?.("clips", 0.5, "Placing clips on timeline...");
    await placeClips(script, trackIds, generatedContent, onProgress, result);

    // Step 5: Add audio tracks
    onProgress?.("audio", 0.9, "Adding audio...");
    await addAudioTracks(script, trackIds, generatedContent, result);

    result.success = true;
    onProgress?.("complete", 1, "Script execution complete!");
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Unknown error";
    result.success = false;
  }

  return result;
}

// ============================================================================
// Setup Functions
// ============================================================================

async function setupCanvas(canvas: "16:9" | "9:16" | "1:1"): Promise<void> {
  const projectStore = useProjectStore.getState();
  const dimensions = getCanvasDimensions(canvas);
  await projectStore.updateCanvasSize(dimensions, "preset");
}

async function createTracks(
  script: VideoScript
): Promise<ScriptExecutionResult["trackIds"]> {
  const timelineStore = useTimelineStore.getState();
  const trackIds: ScriptExecutionResult["trackIds"] = {};

  // Check if we need a media track
  const needsMediaTrack = script.clips.some((clip) => clip.media);
  if (needsMediaTrack) {
    // Use existing media track or create one
    const existingMedia = timelineStore.tracks.find((t) => t.type === "media");
    trackIds.media = existingMedia?.id || timelineStore.addTrack("media");
  }

  // Check if we need a text track
  const needsTextTrack = script.clips.some((clip) => clip.text?.content);
  if (needsTextTrack) {
    // Use existing text track or create one
    const existingText = timelineStore.tracks.find((t) => t.type === "text");
    trackIds.text = existingText?.id || timelineStore.addTrack("text");
  }

  // Audio tracks for music and voiceover
  if (script.audio?.music) {
    const existingAudio = timelineStore.tracks.find((t) => t.type === "audio");
    trackIds.music = existingAudio?.id || timelineStore.addTrack("audio");
  }

  if (script.audio?.voiceover) {
    // Voiceover gets its own track
    trackIds.voiceover = timelineStore.addTrack("audio");
  }

  return trackIds;
}

// ============================================================================
// AI Content Generation
// ============================================================================

interface GeneratedContent {
  clips: Map<number, string>; // clip index -> mediaId
  music?: string; // mediaId
  voiceover?: string; // mediaId
}

async function generateAIContent(
  script: VideoScript,
  onProgress: ScriptProgressCallback | undefined,
  result: ScriptExecutionResult
): Promise<GeneratedContent> {
  const generated: GeneratedContent = {
    clips: new Map(),
  };

  const totalGenerations = countAIGenerations(script);
  if (totalGenerations === 0) {
    return generated;
  }

  let completedGenerations = 0;
  const updateProgress = () => {
    const progress = 0.1 + (completedGenerations / totalGenerations) * 0.3;
    onProgress?.(
      "generating",
      progress,
      `Generating AI content (${completedGenerations}/${totalGenerations})...`
    );
  };

  // Generate clip media
  for (let i = 0; i < script.clips.length; i++) {
    const clip = script.clips[i];
    if (clip.media?.generate) {
      try {
        const aspectRatio = script.canvas === "9:16" ? "9:16" : script.canvas === "1:1" ? "1:1" : "16:9";
        const videoResult = await generateVideo(
          {
            prompt: clip.media.generate,
            duration: clip.duration,
            aspectRatio,
          },
          "fal"
        );

        if (videoResult.success && videoResult.mediaId) {
          generated.clips.set(i, videoResult.mediaId);
          result.generatedMedia.push(videoResult.mediaId);
        } else {
          result.warnings.push(
            `Failed to generate video for clip ${i + 1}: ${videoResult.error}`
          );
        }
      } catch (error) {
        result.warnings.push(
          `Error generating video for clip ${i + 1}: ${error instanceof Error ? error.message : "Unknown"}`
        );
      }
      completedGenerations++;
      updateProgress();
    }
  }

  // Generate music
  if (script.audio?.music?.generate) {
    try {
      const duration = getScriptDuration(script);
      const musicResult = await generateMusic(
        {
          prompt: script.audio.music.generate,
          duration,
          instrumental: true,
        },
        "fal"
      );

      if (musicResult.success && musicResult.mediaId) {
        generated.music = musicResult.mediaId;
        result.generatedMedia.push(musicResult.mediaId);
      } else {
        result.warnings.push(`Failed to generate music: ${musicResult.error}`);
      }
    } catch (error) {
      result.warnings.push(
        `Error generating music: ${error instanceof Error ? error.message : "Unknown"}`
      );
    }
    completedGenerations++;
    updateProgress();
  }

  // Generate voiceover
  if (script.audio?.voiceover?.text) {
    try {
      const voiceResult = await generateVoiceover(
        {
          text: script.audio.voiceover.text,
          voice: script.audio.voiceover.voice,
        },
        "openai"
      );

      if (voiceResult.success && voiceResult.mediaId) {
        generated.voiceover = voiceResult.mediaId;
        result.generatedMedia.push(voiceResult.mediaId);
      } else {
        result.warnings.push(
          `Failed to generate voiceover: ${voiceResult.error}`
        );
      }
    } catch (error) {
      result.warnings.push(
        `Error generating voiceover: ${error instanceof Error ? error.message : "Unknown"}`
      );
    }
    completedGenerations++;
    updateProgress();
  }

  return generated;
}

function countAIGenerations(script: VideoScript): number {
  let count = 0;

  // Count clip generations
  for (const clip of script.clips) {
    if (clip.media?.generate) count++;
  }

  // Count audio generations
  if (script.audio?.music?.generate) count++;
  if (script.audio?.voiceover?.text) count++;

  return count;
}

// ============================================================================
// Clip Placement
// ============================================================================

async function placeClips(
  script: VideoScript,
  trackIds: ScriptExecutionResult["trackIds"],
  generatedContent: GeneratedContent,
  onProgress: ScriptProgressCallback | undefined,
  result: ScriptExecutionResult
): Promise<void> {
  let currentTime = 0;
  const canvasDimensions = getCanvasDimensions(script.canvas);

  for (let i = 0; i < script.clips.length; i++) {
    const clip = script.clips[i];
    const progress = 0.5 + (i / script.clips.length) * 0.4;
    onProgress?.("clips", progress, `Placing clip ${i + 1}/${script.clips.length}...`);

    try {
      // Place media
      await placeClipMedia(clip, i, currentTime, trackIds, generatedContent);

      // Place text overlay
      await placeClipText(clip, currentTime, trackIds, canvasDimensions);

      result.completedClips++;
    } catch (error) {
      result.warnings.push(
        `Error placing clip ${i + 1}: ${error instanceof Error ? error.message : "Unknown"}`
      );
    }

    currentTime += clip.duration;
  }
}

async function placeClipMedia(
  clip: Clip,
  clipIndex: number,
  startTime: number,
  trackIds: ScriptExecutionResult["trackIds"],
  generatedContent: GeneratedContent
): Promise<void> {
  // Determine media ID
  let mediaId: string | undefined;

  if (clip.media?.id) {
    mediaId = clip.media.id;
  } else if (clip.media?.generate) {
    mediaId = generatedContent.clips.get(clipIndex);
  }

  if (mediaId && trackIds.media) {
    const trimOptions: { trimStart?: number; trimEnd?: number } = {};
    if (clip.media?.trim) {
      trimOptions.trimStart = clip.media.trim.start;
      trimOptions.trimEnd = clip.media.trim.end;
    }

    await addClip(mediaId, startTime, {
      trackId: trackIds.media,
      duration: clip.duration,
      ...trimOptions,
    });
  }
}

async function placeClipText(
  clip: Clip,
  startTime: number,
  trackIds: ScriptExecutionResult["trackIds"],
  canvasDimensions: { width: number; height: number }
): Promise<void> {
  if (!clip.text?.content || !trackIds.text) {
    return;
  }

  const style = clip.text.style || "title";
  const position = clip.text.position || "center";

  const styleProps = getTextStyleProperties(style);
  const yPosition = getTextYPosition(position, canvasDimensions.height);

  await addText(clip.text.content, startTime, clip.duration, {
    trackId: trackIds.text,
    fontSize: styleProps.fontSize,
    color: styleProps.color,
    fontWeight: styleProps.fontWeight,
    backgroundColor: styleProps.backgroundColor,
    x: 0,
    y: yPosition,
  });
}

// ============================================================================
// Audio Placement
// ============================================================================

async function addAudioTracks(
  script: VideoScript,
  trackIds: ScriptExecutionResult["trackIds"],
  generatedContent: GeneratedContent,
  result: ScriptExecutionResult
): Promise<void> {
  const totalDuration = getScriptDuration(script);

  // Add music
  if (trackIds.music) {
    const musicMediaId =
      script.audio?.music?.mediaId || generatedContent.music;

    if (musicMediaId) {
      try {
        await addClip(musicMediaId, 0, {
          trackId: trackIds.music,
          duration: totalDuration,
        });
      } catch (error) {
        result.warnings.push(
          `Failed to add music track: ${error instanceof Error ? error.message : "Unknown"}`
        );
      }
    }
  }

  // Add voiceover
  if (trackIds.voiceover) {
    const voiceMediaId =
      script.audio?.voiceover?.mediaId || generatedContent.voiceover;

    if (voiceMediaId) {
      try {
        await addClip(voiceMediaId, 0, {
          trackId: trackIds.voiceover,
        });
      } catch (error) {
        result.warnings.push(
          `Failed to add voiceover track: ${error instanceof Error ? error.message : "Unknown"}`
        );
      }
    }
  }
}

// ============================================================================
// High-Level Convenience Functions
// ============================================================================

/**
 * Create a reel using a template
 *
 * @example
 * const result = await createReel({
 *   template: "hook-content-cta",
 *   name: "My Product Launch",
 *   clips: [
 *     { text: "You NEED to see this!" },
 *     { mediaId: "product-demo-123" },
 *     { text: "Link in bio!" }
 *   ],
 *   music: { generate: "upbeat tech music" }
 * });
 */
export async function createReel(options: {
  template: string;
  name: string;
  clips: Array<{ mediaId?: string; generate?: string; text?: string }>;
  music?: { generate: string } | { mediaId: string };
  voiceover?: { text: string; voice?: string } | { mediaId: string };
  onProgress?: ScriptProgressCallback;
}): Promise<ScriptExecutionResult> {
  // Import fillTemplate dynamically to avoid circular deps
  const { fillTemplate } = await import("./templates");

  const script = fillTemplate(options.template as keyof typeof import("./templates").REEL_TEMPLATES, {
    name: options.name,
    clips: options.clips,
    music: options.music,
    voiceover: options.voiceover,
  });

  return executeScript(script, options.onProgress);
}

/**
 * Create a simple video from media with optional text overlay
 */
export async function createSimpleVideo(options: {
  name: string;
  mediaId: string;
  duration?: number;
  canvas?: "16:9" | "9:16" | "1:1";
  text?: {
    content: string;
    style?: "title" | "subtitle" | "caption";
    position?: "top" | "center" | "bottom";
  };
  music?: { generate: string } | { mediaId: string };
}): Promise<ScriptExecutionResult> {
  const script: VideoScript = {
    name: options.name,
    canvas: options.canvas || "9:16",
    clips: [
      {
        duration: options.duration || 15,
        media: { id: options.mediaId },
        text: options.text,
      },
    ],
    audio: options.music
      ? {
          music: "generate" in options.music
            ? { generate: options.music.generate }
            : { mediaId: options.music.mediaId },
        }
      : undefined,
  };

  return executeScript(script);
}
