/**
 * Domo AI Service
 *
 * Integration with Domo AI for character motion generation:
 * - Image-to-video: Animate a character image with motion prompts
 * - Video-to-video: Transfer motion from a reference video to a character
 * - Multiple style options (anime, 3D cartoon, pixel, realistic)
 *
 * Usage:
 * ```typescript
 * import { generateMotionVideo, transferMotion } from '@/lib/ai-editor/domo-service';
 *
 * // Generate motion from image
 * const result = await generateMotionVideo({
 *   imageDataUrl: 'data:image/png;base64,...',
 *   prompt: 'character waving at camera',
 *   style: 'anime',
 *   duration: 4
 * });
 *
 * // Transfer motion from reference video
 * const result = await transferMotion({
 *   referenceVideoId: 'video-123',
 *   targetImageDataUrl: 'data:image/png;base64,...',
 *   style: 'anime'
 * });
 * ```
 */

import { useMediaStore } from "@/stores/media-store";
import { useProjectStore } from "@/stores/project-store";
import { useAISettingsStore } from "@/stores/ai-settings-store";
import { extractFrameAt } from "./analysis";

// ============================================================================
// Types
// ============================================================================

export interface DomoGenerationParams {
  /** Character image as data URL */
  imageDataUrl: string;
  /** Motion description prompt */
  prompt: string;
  /** Art style */
  style?: DomoStyle;
  /** Duration in seconds (typical: 3-5s) */
  duration?: number;
  /** Aspect ratio */
  aspectRatio?: "16:9" | "9:16" | "1:1";
  /** Seed for reproducibility */
  seed?: number;
}

export interface DomoTransferParams {
  /** Reference video media ID */
  referenceVideoId: string;
  /** Target character image as data URL */
  targetImageDataUrl: string;
  /** Art style to apply */
  style?: DomoStyle;
  /** Start time in reference video (optional) */
  startTime?: number;
  /** Duration to transfer (optional) */
  duration?: number;
}

export interface DomoResult {
  success: boolean;
  /** Generated video media ID */
  mediaId?: string;
  /** Video URL */
  url?: string;
  /** Error message if failed */
  error?: string;
  /** Task ID for polling (if async) */
  taskId?: string;
}

export type DomoStyle =
  | "anime"
  | "3d-cartoon"
  | "pixel"
  | "realistic"
  | "clay"
  | "watercolor"
  | "sketch"
  | "default";

// ============================================================================
// Style Mapping
// ============================================================================

/**
 * Map our style names to Domo AI style IDs
 */
const STYLE_MAP: Record<DomoStyle, string> = {
  anime: "anime",
  "3d-cartoon": "3d_cartoon",
  pixel: "pixel_art",
  realistic: "realistic",
  clay: "clay",
  watercolor: "watercolor",
  sketch: "sketch",
  default: "default",
};

/**
 * Style descriptions for prompting
 */
export const STYLE_DESCRIPTIONS: Record<DomoStyle, string> = {
  anime: "Japanese anime style, cel-shaded, vibrant colors",
  "3d-cartoon": "3D rendered cartoon style, Pixar-like",
  pixel: "Retro pixel art style, 8-bit aesthetic",
  realistic: "Photorealistic style, lifelike rendering",
  clay: "Claymation style, stop-motion aesthetic",
  watercolor: "Watercolor painting style, soft edges",
  sketch: "Hand-drawn sketch style, pencil lines",
  default: "Default style",
};

// ============================================================================
// Motion Generation
// ============================================================================

/**
 * Generate a motion video from a character image
 *
 * @param params - Generation parameters
 * @returns Generated video result
 */
export async function generateMotionVideo(
  params: DomoGenerationParams
): Promise<DomoResult> {
  const apiKey = useAISettingsStore.getState().apiKeys.domo;

  if (!apiKey) {
    return {
      success: false,
      error: "Domo AI API key not configured. Set it in Settings > AI Settings.",
    };
  }

  const {
    imageDataUrl,
    prompt,
    style = "default",
    duration = 4,
    aspectRatio = "9:16",
    seed,
  } = params;

  try {
    // Convert data URL to base64
    const base64Image = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");

    // Build the enhanced prompt with style
    const styleDesc = STYLE_DESCRIPTIONS[style];
    const fullPrompt = style !== "default"
      ? `${prompt}, ${styleDesc}`
      : prompt;

    // Call Domo API (via DomoAPI.com wrapper)
    const response = await fetch("https://api.domoapi.com/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "domo-img2vid",
        input: {
          image: base64Image,
          prompt: fullPrompt,
          style: STYLE_MAP[style],
          duration: duration,
          aspect_ratio: aspectRatio,
          seed: seed,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Domo API error: ${error}` };
    }

    const data = await response.json();

    // Handle async generation (polling required)
    if (data.task_id && !data.video_url) {
      return await pollForDomoResult(data.task_id, apiKey);
    }

    // Immediate result
    const videoUrl = data.video_url || data.output?.video_url;
    if (!videoUrl) {
      return { success: false, error: "No video URL in response" };
    }

    // Import the generated video
    const mediaId = await importGeneratedVideo(
      videoUrl,
      `Motion - ${prompt.substring(0, 30)}`
    );

    return { success: true, mediaId, url: videoUrl };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Transfer motion from a reference video to a character image
 *
 * @param params - Transfer parameters
 * @returns Generated video result
 */
export async function transferMotion(
  params: DomoTransferParams
): Promise<DomoResult> {
  const apiKey = useAISettingsStore.getState().apiKeys.domo;

  if (!apiKey) {
    return {
      success: false,
      error: "Domo AI API key not configured. Set it in Settings > AI Settings.",
    };
  }

  const {
    referenceVideoId,
    targetImageDataUrl,
    style = "default",
    startTime = 0,
    duration,
  } = params;

  try {
    // Get the reference video
    const mediaStore = useMediaStore.getState();
    const refVideo = mediaStore.mediaFiles.find((f) => f.id === referenceVideoId);

    if (!refVideo) {
      return { success: false, error: `Reference video '${referenceVideoId}' not found` };
    }

    // Convert image data URL to base64
    const base64Image = targetImageDataUrl.replace(/^data:image\/\w+;base64,/, "");

    // We need to extract a segment of the reference video or use its URL
    // For now, we'll pass the video URL to Domo
    const videoUrl = refVideo.url;
    if (!videoUrl) {
      return { success: false, error: "Reference video has no URL" };
    }

    // Call Domo video-to-video API
    const response = await fetch("https://api.domoapi.com/v1/video-to-video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "domo-vid2vid",
        input: {
          reference_video: videoUrl,
          target_image: base64Image,
          style: STYLE_MAP[style],
          start_time: startTime,
          duration: duration,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Domo API error: ${error}` };
    }

    const data = await response.json();

    // Handle async generation
    if (data.task_id && !data.video_url) {
      return await pollForDomoResult(data.task_id, apiKey);
    }

    const outputUrl = data.video_url || data.output?.video_url;
    if (!outputUrl) {
      return { success: false, error: "No video URL in response" };
    }

    // Import the generated video
    const mediaId = await importGeneratedVideo(outputUrl, "Motion Transfer");

    return { success: true, mediaId, url: outputUrl };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// Motion Prompt Helpers
// ============================================================================

/**
 * Standard motion prompts for common actions
 */
export const MOTION_PROMPTS: Record<string, string> = {
  // Dance moves
  dance_hip_hop: "character dancing hip hop, bouncing movement, arms moving rhythmically",
  dance_energetic: "character doing energetic dance, quick arm movements, dynamic pose",
  dance_slow: "character swaying slowly, gentle dance movement, smooth motion",
  dance_wave: "character doing a wave dance move, arms flowing",

  // Gestures
  wave: "character waving hand at camera, friendly gesture, arm moving side to side",
  point: "character pointing at camera, direct gesture, arm extended",
  thumbs_up: "character giving thumbs up, approving gesture, arm raised",
  peace_sign: "character making peace sign, playful gesture, fingers in V shape",
  clap: "character clapping hands together, celebratory",
  shrug: "character shrugging shoulders, questioning gesture",

  // Expressions
  laugh: "character laughing, joyful expression, slight body movement",
  surprised: "character looking surprised, eyes widening, small jump back",
  thinking: "character thinking, hand on chin, contemplative pose",
  nod: "character nodding head, agreeing motion",
  shake_head: "character shaking head, disagreeing motion",

  // Actions
  walk_forward: "character walking towards camera, natural gait",
  walk_away: "character walking away from camera",
  turn_around: "character turning around, 180 degree turn, smooth rotation",
  jump: "character jumping up, energetic leap, arms up",
  sit_down: "character sitting down smoothly",
  stand_up: "character standing up from seated position",

  // Camera moves (applied as effects)
  zoom_in: "camera slowly zooming in on character",
  zoom_out: "camera slowly zooming out from character",
  pan_left: "camera panning left, character in frame",
  pan_right: "camera panning right, character in frame",
  shake: "slight camera shake, energetic feel",

  // Idle/Loop animations
  idle_breathing: "character in idle pose, subtle breathing motion",
  idle_looking: "character looking around curiously, head turning",
  idle_blink: "character blinking naturally, subtle movement",
};

/**
 * Get a motion prompt for a given motion type
 */
export function getMotionPrompt(motionType: string): string {
  return MOTION_PROMPTS[motionType] || motionType;
}

/**
 * Build a combined motion prompt from detected motion info
 */
export function buildMotionPromptFromAnalysis(motion: {
  type: string;
  description: string;
  intensity: string;
}): string {
  let prompt = "";

  // Start with the motion type
  const basePrompt = MOTION_PROMPTS[motion.type] || motion.type;
  prompt = basePrompt;

  // Add description details if available
  if (motion.description && motion.description !== motion.type) {
    prompt += `, ${motion.description}`;
  }

  // Add intensity modifier
  if (motion.intensity === "high") {
    prompt += ", energetic, fast movement";
  } else if (motion.intensity === "low") {
    prompt += ", subtle, slow movement";
  }

  return prompt;
}

// ============================================================================
// Polling and Helpers
// ============================================================================

/**
 * Poll for Domo task completion with exponential backoff
 */
async function pollForDomoResult(
  taskId: string,
  apiKey: string,
  maxAttempts = 30
): Promise<DomoResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Exponential backoff: 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      const response = await fetch(
        `https://api.domoapi.com/v1/tasks/${taskId}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );

      if (!response.ok) continue;

      const data = await response.json();

      if (data.status === "completed" || data.status === "succeeded") {
        const videoUrl = data.video_url || data.output?.video_url;
        if (videoUrl) {
          const mediaId = await importGeneratedVideo(videoUrl, "Domo Motion");
          return { success: true, mediaId, url: videoUrl };
        }
      }

      if (data.status === "failed") {
        return { success: false, error: data.error || "Generation failed" };
      }

      // Still processing, continue polling
    } catch {
      // Network error, continue polling
    }
  }

  return { success: false, error: "Generation timed out" };
}

/**
 * Import a generated video into the project
 */
async function importGeneratedVideo(
  url: string,
  name: string
): Promise<string> {
  const mediaStore = useMediaStore.getState();
  const projectStore = useProjectStore.getState();

  const projectId = projectStore.currentProject?.id;
  if (!projectId) {
    throw new Error("No active project");
  }

  // Fetch the video
  const response = await fetch(url);
  const blob = await response.blob();

  // Create file
  const file = new File([blob], `${name}.mp4`, { type: "video/mp4" });

  // Add to media store
  const mediaFile = await mediaStore.addMediaFile(projectId, {
    name,
    type: "video",
    file,
    url: URL.createObjectURL(file),
    ephemeral: true,
  });

  return mediaFile.id;
}

// ============================================================================
// Fallback Generation (using FAL.ai when Domo unavailable)
// ============================================================================

/**
 * Generate motion video using FAL.ai as fallback
 * This uses Kling or other video models available on FAL
 */
export async function generateMotionVideoFallback(
  params: DomoGenerationParams
): Promise<DomoResult> {
  const falKey = useAISettingsStore.getState().apiKeys.fal;

  if (!falKey) {
    return {
      success: false,
      error: "FAL API key not configured (fallback for Domo)",
    };
  }

  const { imageDataUrl, prompt, duration = 4, aspectRatio = "9:16" } = params;

  try {
    const base64Image = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");

    // Use Kling via FAL for image-to-video
    const response = await fetch(
      "https://fal.run/fal-ai/kling-video/v1/standard/image-to-video",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${falKey}`,
        },
        body: JSON.stringify({
          prompt: prompt,
          image_url: `data:image/png;base64,${base64Image}`,
          duration: String(duration),
          aspect_ratio: aspectRatio,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `FAL API error: ${error}` };
    }

    const data = await response.json();
    const videoUrl = data.video?.url;

    if (!videoUrl) {
      return { success: false, error: "No video URL in response" };
    }

    const mediaId = await importGeneratedVideo(
      videoUrl,
      `Motion - ${prompt.substring(0, 30)}`
    );

    return { success: true, mediaId, url: videoUrl };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Smart motion generation - tries Domo first, falls back to FAL
 */
export async function generateMotionVideoSmart(
  params: DomoGenerationParams
): Promise<DomoResult> {
  const domoKey = useAISettingsStore.getState().apiKeys.domo;

  if (domoKey) {
    const result = await generateMotionVideo(params);
    if (result.success) return result;
  }

  // Fall back to FAL
  return generateMotionVideoFallback(params);
}
