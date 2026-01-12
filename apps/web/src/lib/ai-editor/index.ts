/**
 * AI Video Editor API
 *
 * This module provides programmatic access to the video editor for AI-driven editing.
 * Claude Code can use these functions to read state, execute actions, and generate content.
 *
 * ============================================================================
 * QUICK START FOR CLAUDE CODE
 * ============================================================================
 *
 * RECOMMENDED: Use the high-level script/template system for creating reels:
 *
 * ```typescript
 * import { createReel, getTemplateIds, REEL_TEMPLATES } from '@/lib/ai-editor';
 *
 * // See available templates
 * const templates = getTemplateIds();
 * // ["hook-content-cta", "before-after", "listicle-5", "tutorial", ...]
 *
 * // Create a reel using a template
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
 * ```
 *
 * Or build a custom script:
 *
 * ```typescript
 * import { executeScript, VideoScript } from '@/lib/ai-editor';
 *
 * const script: VideoScript = {
 *   name: "Custom Reel",
 *   canvas: "9:16",
 *   clips: [
 *     { duration: 3, text: { content: "Hello!", style: "title", position: "center" } },
 *     { duration: 5, media: { id: "video-123" } },
 *     { duration: 3, text: { content: "Follow for more!", style: "title", position: "center" } }
 *   ],
 *   audio: { music: { generate: "lo-fi chill beats" } }
 * };
 *
 * const result = await executeScript(script);
 * ```
 *
 * ============================================================================
 * LOW-LEVEL API (for fine-grained control)
 * ============================================================================
 *
 * 1. READ STATE:
 *    ```typescript
 *    import { getTimelineState, getMediaList, getProjectInfo } from '@/lib/ai-editor';
 *    const timeline = getTimelineState();
 *    const media = getMediaList();
 *    ```
 *
 * 2. EXECUTE ACTIONS:
 *    ```typescript
 *    import { addClip, addText, splitClip, trimClip } from '@/lib/ai-editor';
 *    await addClip('media-id', 0);
 *    await addText('Hello', 0, 5, { fontSize: 64 });
 *    ```
 *
 * 3. GENERATE AI CONTENT:
 *    ```typescript
 *    import { generateVideo, generateMusic, generateVoiceover } from '@/lib/ai-editor';
 *    const video = await generateVideo({ prompt: 'A sunset', duration: 5 });
 *    ```
 *
 * 4. CONFIGURE API KEYS:
 *    ```typescript
 *    import { setApiKey } from '@/lib/ai-editor';
 *    setApiKey('fal', 'your-key');
 *    ```
 *
 * ============================================================================
 * VIDEO REPLICATION PIPELINE (for cloning videos with your character)
 * ============================================================================
 *
 * Replicate any video with your AI mascot character:
 *
 * ```typescript
 * import { replicateVideo, analyzeForReplication } from '@/lib/ai-editor';
 *
 * // First, analyze the video to see what's needed
 * const analysis = await analyzeForReplication('reference-video-id');
 * console.log(analysis.summary);
 * // Duration: 15.0s, Scenes: 5, Pacing: fast
 * // Required poses: standing, waving, dancing
 *
 * // Then replicate with your character
 * const result = await replicateVideo({
 *   videoMediaId: 'reference-video-id',
 *   characterImage: 'my-character-id',
 *   characterBasePrompt: 'A cute robot mascot with big eyes',
 *   options: {
 *     style: 'anime',
 *     generateMissingPoses: true,
 *     onProgress: (stage, progress, msg) => console.log(msg)
 *   }
 * });
 * ```
 *
 * ============================================================================
 */

// State readers
export {
  getTimelineState,
  getMediaList,
  getProjectInfo,
  getPlaybackState,
} from "./action-executor";

// Action executor
export { executeAction, executeActions } from "./action-executor";

// Convenience functions for common operations
export {
  addClip,
  addText,
  splitClip,
  trimClip,
  deleteClip,
  seekTo,
  play,
  pause,
} from "./action-executor";

// AI generation functions
export {
  generateVideo,
  generateMusic,
  generateVoiceover,
  analyzeVideo,
} from "./ai-api-service";

// API key management
export {
  getApiKeys,
  saveApiKeys,
  setApiKey,
  hasApiKey,
} from "./ai-api-service";

// Types
export type {
  AIAction,
  AIActionResult,
  AIMessage,
  AIConversation,
  AIApiConfig,
  ActionSchema,
  // Action types
  AddClipToTimelineAction,
  TrimClipAction,
  SplitClipAction,
  MoveClipAction,
  AddTextAction,
  UpdateTextAction,
  GenerateVideoAction,
  GenerateMusicAction,
  GenerateVoiceoverAction,
  AnalyzeVideoAction,
  TranscribeAudioAction,
} from "./types";

// Action schemas for tool calling
export { ACTION_SCHEMAS } from "./types";

// ============================================================================
// REEL CREATION - High-level functions for creating videos
// ============================================================================

// Script execution
export { executeScript, createReel, createSimpleVideo } from "./script-executor";

// Templates
export {
  REEL_TEMPLATES,
  getTemplateIds,
  getTemplate,
  fillTemplate,
  getTextStyleProperties,
  getTextYPosition,
} from "./templates";

// Script types
export type {
  VideoScript,
  Clip,
  ClipContent,
  ScriptExecutionResult,
  ScriptProgressCallback,
} from "./script-types";

export { getCanvasDimensions, getScriptDuration } from "./script-types";

// ============================================================================
// CONTENT ANALYSIS - Understand video/audio content
// ============================================================================

export {
  extractFrames,
  extractFrameAt,
  analyzeVideoContent,
  analyzeAudio,
  detectSilence,
  getMediaSummary,
} from "./analysis";

export type {
  ExtractedFrame,
  VideoContentAnalysis,
  AudioAnalysis,
} from "./analysis";

// ============================================================================
// VIDEO REPLICATION PIPELINE - Clone videos with your character
// ============================================================================

// Main replication functions
export {
  replicateVideo,
  createReplicationPlan,
  executeReplicationPlan,
  analyzeForReplication,
  summarizeReplicationPlan,
} from "./video-replicator";

export type {
  ReplicationOptions,
  ReplicationResult,
  ReplicationPlan,
  SceneReplicationPlan,
  ReplicationProgressCallback,
  ReplicationStage,
} from "./video-replicator";

// Video analysis
export {
  analyzeVideoForReplication,
  summarizeBreakdown,
  getRequiredPoses,
} from "./video-analyzer";

export type {
  VideoBreakdown,
  VideoScene,
} from "./video-analyzer";

// Character management
export {
  createPoseLibrary,
  generateCharacterPose,
  addPoseToLibrary,
  findBestPose,
  getAvailablePoseTypes,
  savePoseLibrary,
  loadPoseLibrary,
  listPoseLibraries,
  POSE_PROMPTS,
} from "./character-manager";

export type {
  CharacterPoseLibrary,
  CharacterPose,
  GeneratePoseParams,
} from "./character-manager";

// Motion generation (Domo AI)
export {
  generateMotionVideo,
  transferMotion,
  generateMotionVideoSmart,
  getMotionPrompt,
  buildMotionPromptFromAnalysis,
  MOTION_PROMPTS,
  STYLE_DESCRIPTIONS,
} from "./domo-service";

export type {
  DomoGenerationParams,
  DomoTransferParams,
  DomoResult,
  DomoStyle,
} from "./domo-service";

// Motion extraction (MediaPipe)
export {
  extractPoseFromFrame,
  extractPosesFromFrames,
  analyzeMotionFromPoses,
  classifyMotion,
  comparePoses,
  findMostSimilarPose,
  drawPoseOnCanvas,
  disposePoseExtractor,
  POSE_LANDMARKS,
} from "./motion-extractor";

export type {
  Pose,
  PoseLandmark,
  MotionAnalysis,
} from "./motion-extractor";
