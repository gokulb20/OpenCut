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
 * 1. READ THE CURRENT STATE:
 *    ```typescript
 *    import { getTimelineState, getMediaList, getProjectInfo } from '@/lib/ai-editor';
 *
 *    const timeline = getTimelineState();
 *    const media = getMediaList();
 *    const project = getProjectInfo();
 *    ```
 *
 * 2. EXECUTE EDITING ACTIONS:
 *    ```typescript
 *    import { addClip, addText, splitClip, trimClip, deleteClip } from '@/lib/ai-editor';
 *
 *    // Add a clip to the timeline
 *    await addClip('media-id-123', 0);  // Add at time 0
 *
 *    // Add text overlay
 *    await addText('Hello World', 0, 5, { fontSize: 64, color: '#FFFFFF' });
 *
 *    // Split a clip
 *    await splitClip('track-id', 'element-id', 2.5, 'both');
 *
 *    // Trim a clip
 *    await trimClip('track-id', 'element-id', { trimStart: 1, trimEnd: 2 });
 *    ```
 *
 * 3. GENERATE AI CONTENT:
 *    ```typescript
 *    import { generateVideo, generateMusic, generateVoiceover } from '@/lib/ai-editor';
 *
 *    // Generate a video (requires API key)
 *    const video = await generateVideo({
 *      prompt: 'A sunset over the ocean',
 *      duration: 5,
 *      aspectRatio: '16:9'
 *    });
 *
 *    // Generate music
 *    const music = await generateMusic({
 *      prompt: 'Upbeat electronic music',
 *      duration: 30
 *    });
 *
 *    // Generate voiceover
 *    const voice = await generateVoiceover({
 *      text: 'Welcome to our video',
 *      voice: 'alloy'
 *    });
 *    ```
 *
 * 4. CONFIGURE API KEYS:
 *    ```typescript
 *    import { setApiKey } from '@/lib/ai-editor';
 *
 *    setApiKey('fal', 'your-fal-api-key');
 *    setApiKey('gemini', 'your-gemini-api-key');
 *    setApiKey('openai', 'your-openai-api-key');
 *    ```
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
export { executeAction } from "./action-executor";

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
