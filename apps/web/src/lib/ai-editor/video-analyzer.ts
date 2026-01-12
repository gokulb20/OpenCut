/**
 * Video Analyzer
 *
 * Provides comprehensive video breakdown for replication:
 * - Scene/cut detection with timing
 * - Camera angles and shot types
 * - Motion analysis
 * - Text overlay detection
 * - Audio analysis (beats, speech, music)
 *
 * Usage:
 * ```typescript
 * import { analyzeVideoForReplication } from '@/lib/ai-editor/video-analyzer';
 *
 * const breakdown = await analyzeVideoForReplication('media-id');
 * // Returns detailed VideoBreakdown with scenes, camera info, motions, etc.
 * ```
 */

import { useMediaStore } from "@/stores/media-store";
import { extractFrames, analyzeAudio } from "./analysis";
import { getApiKeys } from "./ai-api-service";

// ============================================================================
// Types
// ============================================================================

export interface VideoBreakdown {
  /** Source video metadata */
  source: {
    mediaId: string;
    duration: number;
    aspectRatio: "16:9" | "9:16" | "1:1";
    fps: number;
    width: number;
    height: number;
  };

  /** Detected scenes with timing and content */
  scenes: VideoScene[];

  /** Audio analysis */
  audio: {
    hasSpeech: boolean;
    hasMusic: boolean;
    musicGenre?: string;
    musicMood?: string;
    beatTimestamps: number[];
    speechSegments: Array<{ start: number; end: number; text?: string }>;
  };

  /** Text overlays detected */
  textOverlays: Array<{
    startTime: number;
    endTime: number;
    content: string;
    position: "top" | "center" | "bottom";
    style: "title" | "subtitle" | "caption";
  }>;

  /** Overall video characteristics */
  characteristics: {
    pacing: "slow" | "medium" | "fast";
    averageSceneDuration: number;
    transitionStyle: "cut" | "fade" | "mixed";
    dominantColors: string[];
    mood: string;
  };
}

export interface VideoScene {
  index: number;
  startTime: number;
  endTime: number;
  duration: number;

  /** Visual description */
  description: string;

  /** Camera angle/shot type */
  camera: {
    angle: "front" | "side" | "overhead" | "low" | "dutch" | "pov" | "unknown";
    shotType: "wide" | "medium" | "close-up" | "extreme-close-up" | "unknown";
    movement: "static" | "pan" | "zoom" | "tilt" | "dolly" | "shake" | "unknown";
    direction?: string;
  };

  /** Detected motion/action */
  motion: {
    type: "static" | "movement" | "dance" | "gesture" | "transition" | "unknown";
    description: string;
    intensity: "low" | "medium" | "high";
  };

  /** Frame samples for this scene */
  keyFrames: Array<{
    time: number;
    dataUrl: string;
  }>;
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Analyze a video comprehensively for replication
 *
 * @param mediaId - The media file ID to analyze
 * @param options - Analysis options
 * @returns Detailed VideoBreakdown
 */
export async function analyzeVideoForReplication(
  mediaId: string,
  options?: {
    /** Number of frames to extract per expected scene (default: 3) */
    framesPerScene?: number;
    /** Minimum scene duration in seconds (default: 0.5) */
    minSceneDuration?: number;
    /** Progress callback */
    onProgress?: (progress: number, message: string) => void;
  }
): Promise<VideoBreakdown> {
  const { framesPerScene = 3, minSceneDuration = 0.5, onProgress } = options || {};

  const keys = getApiKeys();
  if (!keys.gemini) {
    throw new Error("Gemini API key required for video analysis. Set it in Settings > AI Settings.");
  }

  const mediaStore = useMediaStore.getState();
  const mediaFile = mediaStore.mediaFiles.find((f) => f.id === mediaId);

  if (!mediaFile) {
    throw new Error(`Media file with ID '${mediaId}' not found`);
  }

  if (mediaFile.type !== "video") {
    throw new Error("Video analysis only works with video files");
  }

  onProgress?.(0.1, "Extracting frames...");

  // Step 1: Extract frames for analysis
  const duration = mediaFile.duration || 10;
  const estimatedScenes = Math.max(3, Math.ceil(duration / 3)); // Estimate ~3s per scene
  const frameCount = estimatedScenes * framesPerScene;
  const frames = await extractFrames(mediaId, Math.min(frameCount, 20)); // Cap at 20 frames

  if (frames.length === 0) {
    throw new Error("Could not extract any frames from video");
  }

  onProgress?.(0.3, "Analyzing video content with AI...");

  // Step 2: Send frames to Gemini for comprehensive analysis
  const analysisPrompt = buildAnalysisPrompt(duration);
  const geminiAnalysis = await analyzeFramesWithGemini(frames, analysisPrompt, keys.gemini);

  onProgress?.(0.6, "Analyzing audio...");

  // Step 3: Analyze audio
  let audioAnalysis;
  try {
    audioAnalysis = await analyzeAudio(mediaId);
  } catch {
    audioAnalysis = { hasSpeech: false, silenceSegments: [], beatTimestamps: [] };
  }

  onProgress?.(0.8, "Building breakdown...");

  // Step 4: Parse and structure the analysis
  const breakdown = parseGeminiAnalysis(
    geminiAnalysis,
    mediaFile,
    frames,
    audioAnalysis,
    minSceneDuration
  );

  onProgress?.(1.0, "Analysis complete!");

  return breakdown;
}

// ============================================================================
// Gemini Analysis
// ============================================================================

function buildAnalysisPrompt(duration: number): string {
  return `Analyze this video sequence comprehensively. The video is ${duration.toFixed(1)} seconds long.

For each distinct scene/shot, provide:
1. **Scene timing**: Estimate when each scene starts and ends (in seconds)
2. **Camera angle**: front, side, overhead, low, dutch, pov
3. **Shot type**: wide, medium, close-up, extreme-close-up
4. **Camera movement**: static, pan, zoom, tilt, dolly, shake
5. **Motion/action**: What's happening (static, movement, dance, gesture, transition)
6. **Motion intensity**: low, medium, high
7. **Visual description**: Brief description of what's shown

Also identify:
- Any text overlays (content, position, timing)
- Overall pacing (slow, medium, fast)
- Transition style between shots (cut, fade, mixed)
- Dominant colors
- Overall mood/tone

Format your response as JSON:
{
  "scenes": [
    {
      "startTime": 0,
      "endTime": 3,
      "camera": { "angle": "front", "shotType": "medium", "movement": "static" },
      "motion": { "type": "gesture", "description": "Person waving", "intensity": "medium" },
      "description": "Person in center frame waving at camera"
    }
  ],
  "textOverlays": [
    { "startTime": 0, "endTime": 3, "content": "Hello!", "position": "top", "style": "title" }
  ],
  "characteristics": {
    "pacing": "medium",
    "transitionStyle": "cut",
    "dominantColors": ["blue", "white"],
    "mood": "energetic"
  }
}`;
}

async function analyzeFramesWithGemini(
  frames: Array<{ time: number; dataUrl: string }>,
  prompt: string,
  apiKey: string
): Promise<string> {
  // Build parts array with text prompt and images
  const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [
    { text: prompt },
  ];

  // Add frame images (convert data URLs to base64)
  for (const frame of frames) {
    const base64 = frame.dataUrl.replace(/^data:image\/\w+;base64,/, "");
    parts.push({
      inline_data: {
        mime_type: "image/jpeg",
        data: base64,
      },
    });
    // Add timestamp context
    parts.push({ text: `[Frame at ${frame.time.toFixed(2)}s]` });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No analysis returned from Gemini");
  }

  return text;
}

// ============================================================================
// Parse Gemini Response
// ============================================================================

interface AudioAnalysisResult {
  hasSpeech: boolean;
  silenceSegments: Array<{ start: number; end: number }>;
  beatTimestamps?: number[];
  estimatedBpm?: number;
}

function parseGeminiAnalysis(
  analysisText: string,
  mediaFile: { duration?: number; width?: number; height?: number; fps?: number },
  frames: Array<{ time: number; dataUrl: string }>,
  audioAnalysis: AudioAnalysisResult,
  minSceneDuration: number
): VideoBreakdown {
  const duration = mediaFile.duration || 10;
  const width = mediaFile.width || 1920;
  const height = mediaFile.height || 1080;
  const fps = mediaFile.fps || 30;

  // Determine aspect ratio
  const ratio = width / height;
  let aspectRatio: "16:9" | "9:16" | "1:1" = "16:9";
  if (ratio < 0.7) aspectRatio = "9:16";
  else if (ratio > 0.9 && ratio < 1.1) aspectRatio = "1:1";

  // Try to parse JSON from response
  let parsed: {
    scenes?: Array<{
      startTime?: number;
      endTime?: number;
      camera?: { angle?: string; shotType?: string; movement?: string; direction?: string };
      motion?: { type?: string; description?: string; intensity?: string };
      description?: string;
    }>;
    textOverlays?: Array<{
      startTime?: number;
      endTime?: number;
      content?: string;
      position?: string;
      style?: string;
    }>;
    characteristics?: {
      pacing?: string;
      transitionStyle?: string;
      dominantColors?: string[];
      mood?: string;
    };
  } | null = null;

  try {
    // Extract JSON from response (might be wrapped in markdown code blocks)
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch {
    // JSON parsing failed, fall back to text parsing
  }

  // Build scenes from parsed data or generate defaults
  const scenes: VideoScene[] = [];

  if (parsed?.scenes && parsed.scenes.length > 0) {
    for (let i = 0; i < parsed.scenes.length; i++) {
      const s = parsed.scenes[i];
      const startTime = s.startTime ?? (i * duration) / parsed.scenes.length;
      const endTime = s.endTime ?? ((i + 1) * duration) / parsed.scenes.length;

      if (endTime - startTime < minSceneDuration) continue;

      // Find key frames for this scene
      const sceneFrames = frames.filter(
        (f) => f.time >= startTime && f.time <= endTime
      );

      scenes.push({
        index: scenes.length,
        startTime,
        endTime,
        duration: endTime - startTime,
        description: s.description || "Scene " + (scenes.length + 1),
        camera: {
          angle: normalizeAngle(s.camera?.angle),
          shotType: normalizeShotType(s.camera?.shotType),
          movement: normalizeMovement(s.camera?.movement),
          direction: s.camera?.direction,
        },
        motion: {
          type: normalizeMotionType(s.motion?.type),
          description: s.motion?.description || "",
          intensity: normalizeIntensity(s.motion?.intensity),
        },
        keyFrames: sceneFrames.map((f) => ({ time: f.time, dataUrl: f.dataUrl })),
      });
    }
  }

  // If no scenes parsed, create default based on frame timestamps
  if (scenes.length === 0) {
    const sceneCount = Math.max(1, Math.floor(duration / 3));
    for (let i = 0; i < sceneCount; i++) {
      const startTime = (i * duration) / sceneCount;
      const endTime = ((i + 1) * duration) / sceneCount;
      const sceneFrames = frames.filter(
        (f) => f.time >= startTime && f.time <= endTime
      );

      scenes.push({
        index: i,
        startTime,
        endTime,
        duration: endTime - startTime,
        description: `Scene ${i + 1}`,
        camera: {
          angle: "unknown",
          shotType: "unknown",
          movement: "unknown",
        },
        motion: {
          type: "unknown",
          description: "",
          intensity: "medium",
        },
        keyFrames: sceneFrames.map((f) => ({ time: f.time, dataUrl: f.dataUrl })),
      });
    }
  }

  // Parse text overlays
  const textOverlays: VideoBreakdown["textOverlays"] = [];
  if (parsed?.textOverlays) {
    for (const t of parsed.textOverlays) {
      if (t.content) {
        textOverlays.push({
          startTime: t.startTime ?? 0,
          endTime: t.endTime ?? duration,
          content: t.content,
          position: normalizePosition(t.position),
          style: normalizeTextStyle(t.style),
        });
      }
    }
  }

  // Build characteristics
  const avgSceneDuration = scenes.length > 0
    ? scenes.reduce((sum, s) => sum + s.duration, 0) / scenes.length
    : duration;

  const pacing = normalizePacing(parsed?.characteristics?.pacing, avgSceneDuration);
  const transitionStyle = normalizeTransitionStyle(parsed?.characteristics?.transitionStyle);
  const dominantColors = parsed?.characteristics?.dominantColors || [];
  const mood = parsed?.characteristics?.mood || "neutral";

  return {
    source: {
      mediaId: mediaFile.duration ? "" : "", // Will be set by caller
      duration,
      aspectRatio,
      fps,
      width,
      height,
    },
    scenes,
    audio: {
      hasSpeech: audioAnalysis.hasSpeech,
      hasMusic: !audioAnalysis.hasSpeech && (audioAnalysis.beatTimestamps?.length ?? 0) > 5,
      beatTimestamps: audioAnalysis.beatTimestamps || [],
      speechSegments: [],
    },
    textOverlays,
    characteristics: {
      pacing,
      averageSceneDuration: avgSceneDuration,
      transitionStyle,
      dominantColors,
      mood,
    },
  };
}

// ============================================================================
// Normalization Helpers
// ============================================================================

function normalizeAngle(angle?: string): VideoScene["camera"]["angle"] {
  if (!angle) return "unknown";
  const normalized = angle.toLowerCase().replace(/[^a-z]/g, "");
  const map: Record<string, VideoScene["camera"]["angle"]> = {
    front: "front",
    side: "side",
    overhead: "overhead",
    low: "low",
    dutch: "dutch",
    pov: "pov",
    pointofview: "pov",
  };
  return map[normalized] || "unknown";
}

function normalizeShotType(shot?: string): VideoScene["camera"]["shotType"] {
  if (!shot) return "unknown";
  const normalized = shot.toLowerCase().replace(/[^a-z]/g, "");
  const map: Record<string, VideoScene["camera"]["shotType"]> = {
    wide: "wide",
    medium: "medium",
    closeup: "close-up",
    close: "close-up",
    extremecloseup: "extreme-close-up",
    extreme: "extreme-close-up",
  };
  return map[normalized] || "unknown";
}

function normalizeMovement(movement?: string): VideoScene["camera"]["movement"] {
  if (!movement) return "unknown";
  const normalized = movement.toLowerCase().replace(/[^a-z]/g, "");
  const map: Record<string, VideoScene["camera"]["movement"]> = {
    static: "static",
    pan: "pan",
    zoom: "zoom",
    tilt: "tilt",
    dolly: "dolly",
    shake: "shake",
    handheld: "shake",
  };
  return map[normalized] || "unknown";
}

function normalizeMotionType(type?: string): VideoScene["motion"]["type"] {
  if (!type) return "unknown";
  const normalized = type.toLowerCase().replace(/[^a-z]/g, "");
  const map: Record<string, VideoScene["motion"]["type"]> = {
    static: "static",
    movement: "movement",
    dance: "dance",
    dancing: "dance",
    gesture: "gesture",
    transition: "transition",
  };
  return map[normalized] || "unknown";
}

function normalizeIntensity(intensity?: string): "low" | "medium" | "high" {
  if (!intensity) return "medium";
  const normalized = intensity.toLowerCase();
  if (normalized.includes("low")) return "low";
  if (normalized.includes("high")) return "high";
  return "medium";
}

function normalizePosition(position?: string): "top" | "center" | "bottom" {
  if (!position) return "center";
  const normalized = position.toLowerCase();
  if (normalized.includes("top")) return "top";
  if (normalized.includes("bottom")) return "bottom";
  return "center";
}

function normalizeTextStyle(style?: string): "title" | "subtitle" | "caption" {
  if (!style) return "title";
  const normalized = style.toLowerCase();
  if (normalized.includes("subtitle")) return "subtitle";
  if (normalized.includes("caption")) return "caption";
  return "title";
}

function normalizePacing(
  pacing?: string,
  avgSceneDuration?: number
): "slow" | "medium" | "fast" {
  if (pacing) {
    const normalized = pacing.toLowerCase();
    if (normalized.includes("slow")) return "slow";
    if (normalized.includes("fast")) return "fast";
  }
  // Infer from average scene duration
  if (avgSceneDuration !== undefined) {
    if (avgSceneDuration > 5) return "slow";
    if (avgSceneDuration < 2) return "fast";
  }
  return "medium";
}

function normalizeTransitionStyle(style?: string): "cut" | "fade" | "mixed" {
  if (!style) return "cut";
  const normalized = style.toLowerCase();
  if (normalized.includes("fade")) return "fade";
  if (normalized.includes("mix")) return "mixed";
  return "cut";
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get a summary of the video breakdown for display
 */
export function summarizeBreakdown(breakdown: VideoBreakdown): string {
  const lines: string[] = [
    `Video: ${breakdown.source.duration.toFixed(1)}s, ${breakdown.source.aspectRatio}, ${breakdown.source.fps}fps`,
    `Scenes: ${breakdown.scenes.length}`,
    `Pacing: ${breakdown.characteristics.pacing}`,
    `Mood: ${breakdown.characteristics.mood}`,
  ];

  if (breakdown.audio.hasMusic) {
    lines.push(`Music: Yes (${breakdown.audio.beatTimestamps.length} beats detected)`);
  }
  if (breakdown.audio.hasSpeech) {
    lines.push("Speech: Yes");
  }
  if (breakdown.textOverlays.length > 0) {
    lines.push(`Text overlays: ${breakdown.textOverlays.length}`);
  }

  lines.push("\nScenes:");
  for (const scene of breakdown.scenes) {
    lines.push(
      `  ${scene.index + 1}. [${scene.startTime.toFixed(1)}s-${scene.endTime.toFixed(1)}s] ` +
        `${scene.camera.shotType} ${scene.camera.angle}, ${scene.motion.type} (${scene.motion.intensity})`
    );
  }

  return lines.join("\n");
}

/**
 * Get required character poses from a breakdown
 */
export function getRequiredPoses(breakdown: VideoBreakdown): string[] {
  const poses = new Set<string>();

  for (const scene of breakdown.scenes) {
    // Map motion types to pose requirements
    if (scene.motion.type === "dance") {
      poses.add("dancing");
    } else if (scene.motion.type === "gesture") {
      poses.add("gesturing");
      // Try to extract specific gesture from description
      const desc = scene.motion.description.toLowerCase();
      if (desc.includes("wave") || desc.includes("waving")) poses.add("waving");
      if (desc.includes("point")) poses.add("pointing");
      if (desc.includes("thumbs")) poses.add("thumbs_up");
    } else if (scene.motion.type === "static") {
      poses.add("standing");
    } else if (scene.motion.type === "movement") {
      poses.add("walking");
    }

    // Map shot types to poses
    if (scene.camera.shotType === "close-up" || scene.camera.shotType === "extreme-close-up") {
      poses.add("face_closeup");
    }
  }

  return Array.from(poses);
}
