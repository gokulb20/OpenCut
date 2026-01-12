/**
 * AI Editor Action Executor
 *
 * This service provides programmatic access to all editor operations.
 * Claude Code can call these functions directly to manipulate the video editor.
 *
 * Usage from Claude Code:
 *   import { executeAction, getTimelineState, getMediaList } from '@/lib/ai-editor/action-executor';
 *
 *   // Add a clip to timeline
 *   executeAction({ type: 'add_clip_to_timeline', params: { mediaId: '...', startTime: 0 } });
 *
 *   // Get current state
 *   const timeline = getTimelineState();
 *   const media = getMediaList();
 */

import { useTimelineStore } from "@/stores/timeline-store";
import { useMediaStore } from "@/stores/media-store";
import { useProjectStore } from "@/stores/project-store";
import { usePlaybackStore } from "@/stores/playback-store";
import { DEFAULT_TEXT_ELEMENT } from "@/constants/text-constants";
import type {
  AIAction,
  AIActionResult,
  AddClipToTimelineAction,
  TrimClipAction,
  SplitClipAction,
  MoveClipAction,
  AddTextAction,
  UpdateTextAction,
  SeparateAudioAction,
  AddTrackAction,
  SeekToTimeAction,
  MuteClipAction,
  MuteTrackAction,
  DuplicateClipAction,
  RemoveClipAction,
  RemoveTrackAction,
} from "./types";

// ============================================================================
// State Readers - Use these to understand the current editor state
// ============================================================================

/**
 * Get the current timeline state including all tracks and elements
 */
export function getTimelineState() {
  const state = useTimelineStore.getState();
  return {
    tracks: state.tracks.map((track) => ({
      id: track.id,
      name: track.name,
      type: track.type,
      muted: track.muted,
      isMain: track.isMain,
      elements: track.elements.map((el) => ({
        id: el.id,
        name: el.name,
        type: el.type,
        startTime: el.startTime,
        duration: el.duration,
        trimStart: el.trimStart,
        trimEnd: el.trimEnd,
        hidden: el.hidden,
        ...(el.type === "media" && {
          mediaId: el.mediaId,
          muted: el.muted,
        }),
        ...(el.type === "text" && {
          content: el.content,
          fontSize: el.fontSize,
          color: el.color,
          x: el.x,
          y: el.y,
        }),
      })),
    })),
    totalDuration: state.getTotalDuration(),
    selectedElements: state.selectedElements,
    snappingEnabled: state.snappingEnabled,
    rippleEditingEnabled: state.rippleEditingEnabled,
  };
}

/**
 * Get all media files in the current project
 */
export function getMediaList() {
  const state = useMediaStore.getState();
  return state.mediaFiles.map((file) => ({
    id: file.id,
    name: file.name,
    type: file.type,
    duration: file.duration,
    width: file.width,
    height: file.height,
    fps: file.fps,
    url: file.url,
    thumbnailUrl: file.thumbnailUrl,
  }));
}

/**
 * Get current project information
 */
export function getProjectInfo() {
  const state = useProjectStore.getState();
  return {
    id: state.currentProject?.id,
    name: state.currentProject?.name,
    canvas: state.currentProject?.canvasSize,
    fps: state.currentProject?.fps,
    background: state.currentProject?.background,
  };
}

/**
 * Get current playback state
 */
export function getPlaybackState() {
  const state = usePlaybackStore.getState();
  return {
    isPlaying: state.isPlaying,
    currentTime: state.currentTime,
    duration: state.duration,
    volume: state.volume,
    speed: state.speed,
    muted: state.muted,
  };
}

// ============================================================================
// Action Executor - Main entry point for executing actions
// ============================================================================

interface ExecutionOptions {
  skipHistory?: boolean;
}

/**
 * Execute multiple AI actions as a batch
 *
 * This is the recommended way to execute multiple related actions because:
 * 1. Actions are executed sequentially in order
 * 2. Early failure can stop remaining actions (if stopOnError is true)
 * 3. All results are returned together for easy error checking
 *
 * Note: Each action will push its own history entry. If you need single-undo
 * for the entire batch, call undo() multiple times or use the timeline
 * store's pushHistory() before and squash after.
 *
 * @example
 * const results = await executeActions([
 *   { type: 'add_clip_to_timeline', params: { mediaId: '...', startTime: 0 } },
 *   { type: 'add_text', params: { content: 'Hello', startTime: 0, duration: 3 } },
 *   { type: 'trim_clip', params: { trackId: '...', elementId: '...', trimStart: 1 } },
 * ]);
 *
 * // Check for any failures
 * const failures = results.filter(r => !r.success);
 */
export async function executeActions(
  actions: AIAction[],
  options?: { stopOnError?: boolean }
): Promise<AIActionResult[]> {
  const { stopOnError = false } = options || {};

  if (actions.length === 0) {
    return [];
  }

  const results: AIActionResult[] = [];
  for (const action of actions) {
    const result = await executeActionInternal(action, { skipHistory: false });
    results.push(result);

    if (stopOnError && !result.success) {
      break;
    }
  }

  return results;
}

/**
 * Execute an AI action on the editor
 */
export async function executeAction(action: AIAction): Promise<AIActionResult> {
  return executeActionInternal(action, { skipHistory: false });
}

/**
 * Internal action executor with options
 */
async function executeActionInternal(action: AIAction, _options: ExecutionOptions = {}): Promise<AIActionResult> {
  try {
    switch (action.type) {
      case "add_clip_to_timeline":
        return executeAddClip(action);
      case "remove_clip":
        return executeRemoveClip(action);
      case "trim_clip":
        return executeTrimClip(action);
      case "split_clip":
        return executeSplitClip(action);
      case "move_clip":
        return executeMoveClip(action);
      case "duplicate_clip":
        return executeDuplicateClip(action);
      case "add_text":
        return executeAddText(action);
      case "update_text":
        return executeUpdateText(action);
      case "remove_text":
        return executeRemoveText(action);
      case "separate_audio":
        return executeSeparateAudio(action);
      case "mute_clip":
        return executeMuteClip(action);
      case "add_track":
        return executeAddTrack(action);
      case "remove_track":
        return executeRemoveTrack(action);
      case "mute_track":
        return executeMuteTrack(action);
      case "seek_to_time":
        return executeSeekToTime(action);
      case "play":
        return executePlay();
      case "pause":
        return executePause();
      case "get_timeline_info":
        return { action: action.type, success: true, result: getTimelineState() };
      case "get_media_list":
        return { action: action.type, success: true, result: getMediaList() };
      case "get_project_info":
        return { action: action.type, success: true, result: getProjectInfo() };
      // AI generation actions - these will be implemented with external APIs
      case "generate_video":
      case "generate_music":
      case "generate_voiceover":
      case "analyze_video":
      case "transcribe_audio":
        return {
          action: action.type,
          success: false,
          error: `AI generation action '${action.type}' requires API configuration. See ai-api-service.ts`,
        };
      default:
        return {
          action: "unknown",
          success: false,
          error: `Unknown action type`,
        };
    }
  } catch (error) {
    return {
      action: action.type,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// ============================================================================
// Action Implementations
// ============================================================================

function executeAddClip(action: AddClipToTimelineAction): AIActionResult {
  const { mediaId, startTime, duration, trimStart = 0, trimEnd = 0, trackId } = action.params;
  const timelineStore = useTimelineStore.getState();
  const mediaStore = useMediaStore.getState();

  // Find the media file
  const mediaFile = mediaStore.mediaFiles.find((f) => f.id === mediaId);
  if (!mediaFile) {
    return {
      action: action.type,
      success: false,
      error: `Media file with ID '${mediaId}' not found`,
    };
  }

  // Determine track type based on media type
  const trackType = mediaFile.type === "audio" ? "audio" : "media";

  // Find or create appropriate track
  let targetTrackId = trackId;
  if (!targetTrackId) {
    const existingTrack = timelineStore.tracks.find((t) => t.type === trackType);
    if (existingTrack) {
      targetTrackId = existingTrack.id;
    } else {
      targetTrackId = timelineStore.addTrack(trackType);
    }
  }

  // Add element to track
  const elementDuration = duration ?? mediaFile.duration ?? 5;
  timelineStore.addElementToTrack(targetTrackId, {
    type: "media",
    name: mediaFile.name,
    mediaId: mediaFile.id,
    startTime,
    duration: elementDuration,
    trimStart,
    trimEnd,
    muted: false,
  });

  return {
    action: action.type,
    success: true,
    result: { trackId: targetTrackId, mediaId, startTime, duration: elementDuration },
  };
}

function executeRemoveClip(action: RemoveClipAction): AIActionResult {
  const { trackId, elementId } = action.params;
  const timelineStore = useTimelineStore.getState();

  // Select and delete
  timelineStore.selectElement(trackId, elementId, false);
  timelineStore.deleteSelected();

  return { action: action.type, success: true };
}

function executeTrimClip(action: TrimClipAction): AIActionResult {
  const { trackId, elementId, trimStart, trimEnd, duration } = action.params;
  const timelineStore = useTimelineStore.getState();

  if (trimStart !== undefined || trimEnd !== undefined) {
    const track = timelineStore.tracks.find((t) => t.id === trackId);
    const element = track?.elements.find((e) => e.id === elementId);
    if (!element) {
      return { action: action.type, success: false, error: "Element not found" };
    }
    timelineStore.updateElementTrim(
      trackId,
      elementId,
      trimStart ?? element.trimStart,
      trimEnd ?? element.trimEnd
    );
  }

  if (duration !== undefined) {
    timelineStore.updateElementDuration(trackId, elementId, duration);
  }

  return { action: action.type, success: true };
}

function executeSplitClip(action: SplitClipAction): AIActionResult {
  const { trackId, elementId, splitTime, keepSide } = action.params;
  const timelineStore = useTimelineStore.getState();

  if (keepSide === "left") {
    timelineStore.splitAndKeepLeft(trackId, elementId, splitTime);
  } else if (keepSide === "right") {
    timelineStore.splitAndKeepRight(trackId, elementId, splitTime);
  } else {
    // Keep both - split at time
    timelineStore.splitAndKeepLeft(trackId, elementId, splitTime);
    // The right portion is automatically created
  }

  return { action: action.type, success: true };
}

function executeMoveClip(action: MoveClipAction): AIActionResult {
  const { trackId, elementId, newStartTime, newTrackId } = action.params;
  const timelineStore = useTimelineStore.getState();

  if (newStartTime !== undefined) {
    timelineStore.updateElementStartTime(trackId, elementId, newStartTime);
  }

  if (newTrackId && newTrackId !== trackId) {
    timelineStore.moveElementToTrack(trackId, newTrackId, elementId);
  }

  return { action: action.type, success: true };
}

function executeDuplicateClip(action: DuplicateClipAction): AIActionResult {
  const { trackId, elementId } = action.params;
  const timelineStore = useTimelineStore.getState();

  timelineStore.duplicateElement(trackId, elementId);

  return { action: action.type, success: true };
}

function executeAddText(action: AddTextAction): AIActionResult {
  const {
    content,
    startTime,
    duration,
    trackId,
    fontSize = DEFAULT_TEXT_ELEMENT.fontSize,
    fontFamily = DEFAULT_TEXT_ELEMENT.fontFamily,
    color = DEFAULT_TEXT_ELEMENT.color,
    backgroundColor = DEFAULT_TEXT_ELEMENT.backgroundColor,
    textAlign = DEFAULT_TEXT_ELEMENT.textAlign,
    fontWeight = DEFAULT_TEXT_ELEMENT.fontWeight,
    fontStyle = DEFAULT_TEXT_ELEMENT.fontStyle,
    x = DEFAULT_TEXT_ELEMENT.x,
    y = DEFAULT_TEXT_ELEMENT.y,
    rotation = DEFAULT_TEXT_ELEMENT.rotation,
    opacity = DEFAULT_TEXT_ELEMENT.opacity,
  } = action.params;

  const timelineStore = useTimelineStore.getState();

  // Find or create text track
  let targetTrackId = trackId;
  if (!targetTrackId) {
    const existingTrack = timelineStore.tracks.find((t) => t.type === "text");
    if (existingTrack) {
      targetTrackId = existingTrack.id;
    } else {
      targetTrackId = timelineStore.addTrack("text");
    }
  }

  // Add text element
  timelineStore.addElementToTrack(targetTrackId, {
    type: "text",
    name: content.substring(0, 20) + (content.length > 20 ? "..." : ""),
    content,
    startTime,
    duration,
    trimStart: 0,
    trimEnd: 0,
    fontSize,
    fontFamily,
    color,
    backgroundColor,
    textAlign,
    fontWeight,
    fontStyle,
    textDecoration: "none",
    x,
    y,
    rotation,
    opacity,
  });

  return {
    action: action.type,
    success: true,
    result: { trackId: targetTrackId, content, startTime, duration },
  };
}

function executeUpdateText(action: UpdateTextAction): AIActionResult {
  const { trackId, elementId, ...updates } = action.params;
  const timelineStore = useTimelineStore.getState();

  // Filter out undefined values
  const filteredUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      filteredUpdates[key] = value;
    }
  }

  timelineStore.updateTextElement(trackId, elementId, filteredUpdates);

  return { action: action.type, success: true };
}

function executeRemoveText(action: { params: { trackId: string; elementId: string } }): AIActionResult {
  return executeRemoveClip({
    type: "remove_clip",
    params: action.params,
  });
}

function executeSeparateAudio(action: SeparateAudioAction): AIActionResult {
  const { trackId, elementId } = action.params;
  const timelineStore = useTimelineStore.getState();

  const newTrackId = timelineStore.separateAudio(trackId, elementId);

  if (!newTrackId) {
    return {
      action: action.type,
      success: false,
      error: "Failed to separate audio. Element may not have audio.",
    };
  }

  return {
    action: action.type,
    success: true,
    result: { newAudioTrackId: newTrackId },
  };
}

function executeMuteClip(action: MuteClipAction): AIActionResult {
  const { trackId, elementId, muted } = action.params;
  const timelineStore = useTimelineStore.getState();

  // Update the element's muted state
  const track = timelineStore.tracks.find((t) => t.id === trackId);
  const element = track?.elements.find((e) => e.id === elementId);

  if (!element || element.type !== "media") {
    return {
      action: action.type,
      success: false,
      error: "Element not found or is not a media element",
    };
  }

  // Select and toggle
  timelineStore.selectElement(trackId, elementId, false);
  if (muted !== element.muted) {
    timelineStore.toggleSelectedMuted();
  }

  return { action: action.type, success: true };
}

function executeAddTrack(action: AddTrackAction): AIActionResult {
  const { trackType } = action.params;
  const timelineStore = useTimelineStore.getState();

  const trackId = timelineStore.addTrack(trackType);

  return {
    action: action.type,
    success: true,
    result: { trackId },
  };
}

function executeRemoveTrack(action: RemoveTrackAction): AIActionResult {
  const { trackId } = action.params;
  const timelineStore = useTimelineStore.getState();

  timelineStore.removeTrack(trackId);

  return { action: action.type, success: true };
}

function executeMuteTrack(action: MuteTrackAction): AIActionResult {
  const { trackId, muted } = action.params;
  const timelineStore = useTimelineStore.getState();

  const track = timelineStore.tracks.find((t) => t.id === trackId);
  if (!track) {
    return { action: action.type, success: false, error: "Track not found" };
  }

  // Toggle if current state doesn't match desired state
  if (track.muted !== muted) {
    timelineStore.toggleTrackMute(trackId);
  }

  return { action: action.type, success: true };
}

function executeSeekToTime(action: SeekToTimeAction): AIActionResult {
  const { time } = action.params;
  const playbackStore = usePlaybackStore.getState();

  playbackStore.seek(time);

  return { action: action.type, success: true };
}

function executePlay(): AIActionResult {
  const playbackStore = usePlaybackStore.getState();
  playbackStore.play();
  return { action: "play", success: true };
}

function executePause(): AIActionResult {
  const playbackStore = usePlaybackStore.getState();
  playbackStore.pause();
  return { action: "pause", success: true };
}

// ============================================================================
// Convenience Functions for Claude Code
// ============================================================================

/**
 * Add a video/image/audio clip to the timeline
 */
export async function addClip(
  mediaId: string,
  startTime: number,
  options?: { trackId?: string; duration?: number }
) {
  return executeAction({
    type: "add_clip_to_timeline",
    params: { mediaId, startTime, ...options },
  });
}

/**
 * Add text overlay to the timeline
 */
export async function addText(
  content: string,
  startTime: number,
  duration: number,
  options?: Partial<AddTextAction["params"]>
) {
  return executeAction({
    type: "add_text",
    params: { content, startTime, duration, ...options },
  });
}

/**
 * Split a clip at the specified time
 */
export async function splitClip(
  trackId: string,
  elementId: string,
  splitTime: number,
  keepSide: "left" | "right" | "both" = "both"
) {
  return executeAction({
    type: "split_clip",
    params: { trackId, elementId, splitTime, keepSide },
  });
}

/**
 * Trim a clip
 */
export async function trimClip(
  trackId: string,
  elementId: string,
  options: { trimStart?: number; trimEnd?: number; duration?: number }
) {
  return executeAction({
    type: "trim_clip",
    params: { trackId, elementId, ...options },
  });
}

/**
 * Delete a clip from the timeline
 */
export async function deleteClip(trackId: string, elementId: string) {
  return executeAction({
    type: "remove_clip",
    params: { trackId, elementId },
  });
}

/**
 * Seek playhead to a specific time
 */
export async function seekTo(time: number) {
  return executeAction({
    type: "seek_to_time",
    params: { time },
  });
}

/**
 * Play the timeline
 */
export async function play() {
  return executeAction({ type: "play", params: {} });
}

/**
 * Pause the timeline
 */
export async function pause() {
  return executeAction({ type: "pause", params: {} });
}
