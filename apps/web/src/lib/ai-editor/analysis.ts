/**
 * Content Analysis Module
 *
 * Provides functions for Claude Code to understand video and audio content.
 * This enables smart editing decisions based on content analysis.
 *
 * Usage:
 * ```typescript
 * import { extractFrames, analyzeVideoContent, detectSilence } from '@/lib/ai-editor/analysis';
 *
 * // Extract frames for visual analysis
 * const frames = await extractFrames('media-id', 5);
 * // Returns: [{ time: 0, dataUrl: 'data:image/png;base64,...' }, ...]
 *
 * // Get AI analysis of video content
 * const analysis = await analyzeVideoContent('media-id');
 * // Returns: { scenes: [...], suggestedCuts: [...], pacing: 'medium', ... }
 *
 * // Detect silent segments for auto-cutting
 * const silences = await detectSilence('media-id');
 * // Returns: [{ start: 2.5, end: 3.1 }, ...]
 * ```
 */

import { useMediaStore } from "@/stores/media-store";
import { videoCache } from "@/lib/video-cache";
import { analyzeVideo, getApiKeys } from "./ai-api-service";

// ============================================================================
// Frame Extraction
// ============================================================================

export interface ExtractedFrame {
  time: number;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Extract frames from a video at evenly-spaced intervals
 *
 * This lets Claude "see" the video content by sampling frames.
 *
 * @param mediaId - The media file ID
 * @param count - Number of frames to extract (default: 5)
 * @returns Array of frames with timestamps and data URLs
 *
 * @example
 * const frames = await extractFrames('video-123', 5);
 * // Can now send frames to vision AI for analysis
 */
export async function extractFrames(
  mediaId: string,
  count = 5
): Promise<ExtractedFrame[]> {
  const mediaStore = useMediaStore.getState();
  const mediaFile = mediaStore.mediaFiles.find((f) => f.id === mediaId);

  if (!mediaFile) {
    throw new Error(`Media file with ID '${mediaId}' not found`);
  }

  if (mediaFile.type !== "video") {
    throw new Error("Frame extraction only works with video files");
  }

  const duration = mediaFile.duration || 0;
  if (duration === 0) {
    throw new Error("Video has no duration");
  }

  // Get the actual file - need to load from storage
  const file = await getMediaFile(mediaId);
  if (!file) {
    throw new Error("Could not load media file");
  }

  const frames: ExtractedFrame[] = [];
  const interval = duration / (count + 1);

  for (let i = 1; i <= count; i++) {
    const time = interval * i;

    try {
      const frame = await videoCache.getFrameAt(mediaId, file, time);

      if (frame && frame.canvas) {
        const dataUrl = frame.canvas.toDataURL("image/jpeg", 0.8);
        frames.push({
          time,
          dataUrl,
          width: frame.canvas.width,
          height: frame.canvas.height,
        });
      }
    } catch (error) {
      console.warn(`Failed to extract frame at ${time}s:`, error);
    }
  }

  return frames;
}

/**
 * Extract a single frame at a specific time
 *
 * @param mediaId - The media file ID
 * @param time - Time in seconds
 * @returns Frame data or null if extraction failed
 */
export async function extractFrameAt(
  mediaId: string,
  time: number
): Promise<ExtractedFrame | null> {
  const mediaStore = useMediaStore.getState();
  const mediaFile = mediaStore.mediaFiles.find((f) => f.id === mediaId);

  if (!mediaFile || mediaFile.type !== "video") {
    return null;
  }

  const file = await getMediaFile(mediaId);
  if (!file) {
    return null;
  }

  try {
    const frame = await videoCache.getFrameAt(mediaId, file, time);

    if (frame && frame.canvas) {
      return {
        time,
        dataUrl: frame.canvas.toDataURL("image/jpeg", 0.8),
        width: frame.canvas.width,
        height: frame.canvas.height,
      };
    }
  } catch (error) {
    console.warn(`Failed to extract frame at ${time}s:`, error);
  }

  return null;
}

// ============================================================================
// Video Content Analysis
// ============================================================================

export interface VideoContentAnalysis {
  /** Detected scenes with descriptions */
  scenes: Array<{
    startTime: number;
    endTime: number;
    description: string;
    suggestedAction?: "keep" | "trim" | "cut";
  }>;

  /** Suggested cut points (good places to cut/split) */
  suggestedCuts: number[];

  /** Overall pacing assessment */
  pacing: "slow" | "medium" | "fast";

  /** Dominant colors in the video */
  dominantColors: string[];

  /** Whether text/titles are detected */
  hasText: boolean;

  /** Whether faces are detected */
  hasFaces: boolean;

  /** Raw AI analysis text */
  rawAnalysis?: string;
}

/**
 * Analyze video content using AI vision
 *
 * This provides structured insights about the video for smart editing.
 *
 * @param mediaId - The media file ID
 * @param prompt - Optional custom prompt for analysis
 * @returns Structured analysis of video content
 */
export async function analyzeVideoContent(
  mediaId: string,
  prompt?: string
): Promise<VideoContentAnalysis> {
  const keys = getApiKeys();

  if (!keys.gemini) {
    throw new Error("Gemini API key required for video analysis. Set it in Settings > AI Settings.");
  }

  // First, get basic analysis from the existing analyzeVideo function
  const basicAnalysis = await analyzeVideo({
    mediaId,
    prompt: prompt || "Analyze this video comprehensively. Describe each scene, identify good edit points, assess the pacing, note any text or faces visible, and list dominant colors.",
  });

  if (!basicAnalysis.success) {
    throw new Error(basicAnalysis.error || "Video analysis failed");
  }

  // Parse the analysis into structured format
  return parseVideoAnalysis(basicAnalysis.analysis || "", mediaId);
}

/**
 * Parse AI analysis text into structured format
 */
async function parseVideoAnalysis(
  analysisText: string,
  mediaId: string
): Promise<VideoContentAnalysis> {
  const mediaStore = useMediaStore.getState();
  const mediaFile = mediaStore.mediaFiles.find((f) => f.id === mediaId);
  const duration = mediaFile?.duration || 10;

  // Default analysis structure
  const analysis: VideoContentAnalysis = {
    scenes: [],
    suggestedCuts: [],
    pacing: "medium",
    dominantColors: [],
    hasText: false,
    hasFaces: false,
    rawAnalysis: analysisText,
  };

  // Parse scenes from text
  const sceneRegex = /(?:scene|segment|section)\s*(?:\d+)?[:\s]+([^.]+)/gi;
  let match;
  let sceneStart = 0;
  const sceneDuration = duration / 3; // Estimate 3 scenes

  while ((match = sceneRegex.exec(analysisText)) !== null) {
    analysis.scenes.push({
      startTime: sceneStart,
      endTime: sceneStart + sceneDuration,
      description: match[1].trim(),
    });
    sceneStart += sceneDuration;
  }

  // If no scenes parsed, create a default
  if (analysis.scenes.length === 0) {
    analysis.scenes.push({
      startTime: 0,
      endTime: duration,
      description: analysisText.substring(0, 200),
    });
  }

  // Detect pacing mentions
  const textLower = analysisText.toLowerCase();
  if (textLower.includes("slow") || textLower.includes("calm") || textLower.includes("relaxed")) {
    analysis.pacing = "slow";
  } else if (textLower.includes("fast") || textLower.includes("quick") || textLower.includes("rapid") || textLower.includes("energetic")) {
    analysis.pacing = "fast";
  }

  // Detect faces mention
  if (textLower.includes("face") || textLower.includes("person") || textLower.includes("people")) {
    analysis.hasFaces = true;
  }

  // Detect text mention
  if (textLower.includes("text") || textLower.includes("title") || textLower.includes("caption")) {
    analysis.hasText = true;
  }

  // Extract colors
  const colorRegex = /(?:color|colours?).*?(?:red|blue|green|yellow|orange|purple|pink|white|black|gray|grey|brown)/gi;
  const colorMatches = analysisText.match(colorRegex) || [];
  analysis.dominantColors = [...new Set(colorMatches.map(c => {
    const color = c.match(/(red|blue|green|yellow|orange|purple|pink|white|black|gray|grey|brown)/i);
    return color ? color[1].toLowerCase() : null;
  }).filter(Boolean) as string[])];

  // Generate suggested cut points (every 3-5 seconds for reels)
  const cutInterval = analysis.pacing === "fast" ? 2 : analysis.pacing === "slow" ? 5 : 3;
  for (let t = cutInterval; t < duration; t += cutInterval) {
    analysis.suggestedCuts.push(t);
  }

  return analysis;
}

// ============================================================================
// Audio Analysis
// ============================================================================

export interface AudioAnalysis {
  /** Whether speech is detected */
  hasSpeech: boolean;

  /** Silent segments (good for cutting) */
  silenceSegments: Array<{ start: number; end: number }>;

  /** Beat/rhythm timestamps (for music sync) */
  beatTimestamps?: number[];

  /** Estimated BPM if music */
  estimatedBpm?: number;

  /** Transcript if speech detected */
  transcript?: string;
}

/**
 * Analyze audio content
 *
 * Note: Full audio analysis requires FFmpeg or specialized audio processing.
 * This provides a basic implementation using Web Audio API.
 *
 * @param mediaId - The media file ID
 * @returns Audio analysis results
 */
export async function analyzeAudio(mediaId: string): Promise<AudioAnalysis> {
  const mediaStore = useMediaStore.getState();
  const mediaFile = mediaStore.mediaFiles.find((f) => f.id === mediaId);

  if (!mediaFile) {
    throw new Error(`Media file with ID '${mediaId}' not found`);
  }

  const file = await getMediaFile(mediaId);
  if (!file) {
    throw new Error("Could not load media file");
  }

  const analysis: AudioAnalysis = {
    hasSpeech: false,
    silenceSegments: [],
  };

  try {
    // Use Web Audio API for basic analysis
    const audioContext = new AudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Detect silence segments
    analysis.silenceSegments = detectSilenceSegments(audioBuffer);

    // Estimate if there's speech (heuristic: speech has varied amplitude)
    analysis.hasSpeech = estimateSpeechPresence(audioBuffer);

    // Try to detect beats (basic implementation)
    const beats = detectBeats(audioBuffer);
    if (beats.length > 0) {
      analysis.beatTimestamps = beats;
      analysis.estimatedBpm = estimateBpm(beats);
    }

    await audioContext.close();
  } catch (error) {
    console.warn("Audio analysis failed:", error);
  }

  return analysis;
}

/**
 * Detect silent segments in audio
 *
 * @param mediaId - The media file ID
 * @param threshold - Silence threshold (0-1, default 0.01)
 * @param minDuration - Minimum silence duration in seconds (default 0.3)
 * @returns Array of silent segments
 */
export async function detectSilence(
  mediaId: string,
  threshold = 0.01,
  minDuration = 0.3
): Promise<Array<{ start: number; end: number }>> {
  const analysis = await analyzeAudio(mediaId);
  return analysis.silenceSegments.filter(
    (seg) => seg.end - seg.start >= minDuration
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the actual File object for a media item
 */
async function getMediaFile(mediaId: string): Promise<File | null> {
  const mediaStore = useMediaStore.getState();
  const mediaFile = mediaStore.mediaFiles.find((f) => f.id === mediaId);

  if (!mediaFile?.url) {
    return null;
  }

  // If URL is a blob URL, fetch it
  if (mediaFile.url.startsWith("blob:")) {
    try {
      const response = await fetch(mediaFile.url);
      const blob = await response.blob();
      return new File([blob], mediaFile.name || "media", { type: blob.type });
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Detect silence segments in an AudioBuffer
 */
function detectSilenceSegments(
  audioBuffer: AudioBuffer,
  threshold = 0.01
): Array<{ start: number; end: number }> {
  const segments: Array<{ start: number; end: number }> = [];
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  // Window size: 100ms
  const windowSize = Math.floor(sampleRate * 0.1);

  let silenceStart: number | null = null;

  for (let i = 0; i < channelData.length; i += windowSize) {
    // Calculate RMS for this window
    let sum = 0;
    const end = Math.min(i + windowSize, channelData.length);
    for (let j = i; j < end; j++) {
      sum += channelData[j] * channelData[j];
    }
    const rms = Math.sqrt(sum / (end - i));

    const time = i / sampleRate;

    if (rms < threshold) {
      if (silenceStart === null) {
        silenceStart = time;
      }
    } else {
      if (silenceStart !== null) {
        segments.push({ start: silenceStart, end: time });
        silenceStart = null;
      }
    }
  }

  // Handle trailing silence
  if (silenceStart !== null) {
    segments.push({
      start: silenceStart,
      end: audioBuffer.duration,
    });
  }

  return segments;
}

/**
 * Estimate if audio contains speech
 */
function estimateSpeechPresence(audioBuffer: AudioBuffer): boolean {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  // Look at amplitude variations - speech has more variation than music/silence
  const windowSize = Math.floor(sampleRate * 0.5); // 500ms windows
  const rmsValues: number[] = [];

  for (let i = 0; i < channelData.length; i += windowSize) {
    let sum = 0;
    const end = Math.min(i + windowSize, channelData.length);
    for (let j = i; j < end; j++) {
      sum += channelData[j] * channelData[j];
    }
    rmsValues.push(Math.sqrt(sum / (end - i)));
  }

  // Calculate coefficient of variation
  const mean = rmsValues.reduce((a, b) => a + b, 0) / rmsValues.length;
  const variance = rmsValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / rmsValues.length;
  const cv = Math.sqrt(variance) / (mean || 1);

  // Speech typically has higher variation (0.3-0.8 CV)
  return cv > 0.3 && cv < 1.5 && mean > 0.01;
}

/**
 * Basic beat detection using energy peaks
 */
function detectBeats(audioBuffer: AudioBuffer): number[] {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  // 20ms windows for beat detection
  const windowSize = Math.floor(sampleRate * 0.02);
  const energies: number[] = [];

  for (let i = 0; i < channelData.length; i += windowSize) {
    let sum = 0;
    const end = Math.min(i + windowSize, channelData.length);
    for (let j = i; j < end; j++) {
      sum += channelData[j] * channelData[j];
    }
    energies.push(sum / (end - i));
  }

  // Find peaks (local maxima above threshold)
  const beats: number[] = [];
  const avgEnergy = energies.reduce((a, b) => a + b, 0) / energies.length;
  const threshold = avgEnergy * 1.5;

  for (let i = 1; i < energies.length - 1; i++) {
    if (
      energies[i] > threshold &&
      energies[i] > energies[i - 1] &&
      energies[i] > energies[i + 1]
    ) {
      const time = (i * windowSize) / sampleRate;
      // Ensure minimum time between beats (100ms)
      if (beats.length === 0 || time - beats[beats.length - 1] > 0.1) {
        beats.push(time);
      }
    }
  }

  return beats;
}

/**
 * Estimate BPM from beat timestamps
 */
function estimateBpm(beats: number[]): number | undefined {
  if (beats.length < 4) return undefined;

  // Calculate intervals between beats
  const intervals: number[] = [];
  for (let i = 1; i < beats.length; i++) {
    intervals.push(beats[i] - beats[i - 1]);
  }

  // Filter outliers and get median interval
  intervals.sort((a, b) => a - b);
  const medianInterval = intervals[Math.floor(intervals.length / 2)];

  // Convert to BPM
  const bpm = 60 / medianInterval;

  // Return if reasonable (60-200 BPM)
  if (bpm >= 60 && bpm <= 200) {
    return Math.round(bpm);
  }

  return undefined;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get a quick summary of media content for editing decisions
 */
export async function getMediaSummary(mediaId: string): Promise<{
  type: "video" | "audio" | "image";
  duration?: number;
  hasAudio?: boolean;
  hasSpeech?: boolean;
  silentSegments?: number;
  frameCount?: number;
}> {
  const mediaStore = useMediaStore.getState();
  const mediaFile = mediaStore.mediaFiles.find((f) => f.id === mediaId);

  if (!mediaFile) {
    throw new Error(`Media file with ID '${mediaId}' not found`);
  }

  const summary: ReturnType<typeof getMediaSummary> extends Promise<infer T> ? T : never = {
    type: mediaFile.type as "video" | "audio" | "image",
    duration: mediaFile.duration,
  };

  if (mediaFile.type === "video" || mediaFile.type === "audio") {
    try {
      const audioAnalysis = await analyzeAudio(mediaId);
      summary.hasAudio = true;
      summary.hasSpeech = audioAnalysis.hasSpeech;
      summary.silentSegments = audioAnalysis.silenceSegments.length;
    } catch {
      summary.hasAudio = false;
    }
  }

  if (mediaFile.type === "video" && mediaFile.fps && mediaFile.duration) {
    summary.frameCount = Math.floor(mediaFile.fps * mediaFile.duration);
  }

  return summary;
}
