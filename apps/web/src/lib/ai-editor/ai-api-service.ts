/**
 * AI API Service
 *
 * Handles integration with external AI APIs for content generation.
 * Claude Code can use these to generate videos, music, voiceovers, and more.
 *
 * Supported providers:
 * - Video: Kling, Runway, Pika, Gemini
 * - Music: Suno, Udio
 * - Voice: ElevenLabs, OpenAI TTS
 * - Analysis: Gemini (video understanding)
 */

import { useMediaStore } from "@/stores/media-store";
import { useProjectStore } from "@/stores/project-store";
import { useAISettingsStore } from "@/stores/ai-settings-store";

// ============================================================================
// Types
// ============================================================================

export interface GenerateVideoParams {
  prompt: string;
  duration?: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  negativePrompt?: string;
}

export interface GenerateMusicParams {
  prompt: string;
  duration?: number;
  genre?: string;
  mood?: string;
  instrumental?: boolean;
}

export interface GenerateVoiceParams {
  text: string;
  voice?: string;
  speed?: number;
  pitch?: number;
}

export interface AnalyzeVideoParams {
  mediaId: string;
  prompt?: string;
}

export interface GenerationResult {
  success: boolean;
  mediaId?: string;
  url?: string;
  error?: string;
}

// ============================================================================
// API Key Management (uses Zustand store for caching and persistence)
// ============================================================================

export interface AIApiKeys {
  gemini?: string;
  kling?: string;
  runway?: string;
  pika?: string;
  suno?: string;
  udio?: string;
  elevenlabs?: string;
  openai?: string;
  fal?: string;
  replicate?: string;
}

/**
 * Get stored API keys (uses cached Zustand store)
 */
export function getApiKeys(): AIApiKeys {
  return useAISettingsStore.getState().apiKeys;
}

/**
 * Save API keys (backwards compatibility - use setApiKey instead)
 * @deprecated Use setApiKey for individual keys
 */
export function saveApiKeys(keys: AIApiKeys): void {
  const store = useAISettingsStore.getState();
  for (const [provider, key] of Object.entries(keys)) {
    if (key) {
      store.setApiKey(provider, key);
    }
  }
}

/**
 * Set a specific API key
 */
export function setApiKey(provider: keyof AIApiKeys, key: string): void {
  useAISettingsStore.getState().setApiKey(provider, key);
}

/**
 * Check if a provider is configured
 */
export function hasApiKey(provider: keyof AIApiKeys): boolean {
  return useAISettingsStore.getState().hasApiKey(provider);
}

// ============================================================================
// Video Generation
// ============================================================================

/**
 * Generate a video using AI
 *
 * @example
 * const result = await generateVideo({
 *   prompt: "A sunset over the ocean with waves crashing",
 *   duration: 5,
 *   aspectRatio: "16:9"
 * }, "kling");
 */
export async function generateVideo(
  params: GenerateVideoParams,
  provider: "kling" | "runway" | "pika" | "gemini" | "fal" = "fal"
): Promise<GenerationResult> {
  const keys = getApiKeys();

  switch (provider) {
    case "fal":
      return generateVideoWithFal(params, keys.fal);
    case "kling":
      return generateVideoWithKling(params, keys.kling);
    case "runway":
      return generateVideoWithRunway(params, keys.runway);
    case "gemini":
      return generateVideoWithGemini(params, keys.gemini);
    default:
      return { success: false, error: `Provider '${provider}' not implemented` };
  }
}

async function generateVideoWithFal(
  params: GenerateVideoParams,
  apiKey?: string
): Promise<GenerationResult> {
  if (!apiKey) {
    return { success: false, error: "FAL API key not configured. Set it using setApiKey('fal', 'your-key')" };
  }

  try {
    // FAL.ai video generation endpoint (using Kling via FAL)
    const response = await fetch("https://fal.run/fal-ai/kling-video/v1/standard/text-to-video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: params.prompt,
        duration: params.duration ? `${params.duration}` : "5",
        aspect_ratio: params.aspectRatio || "16:9",
        negative_prompt: params.negativePrompt,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `FAL API error: ${error}` };
    }

    const data = await response.json();
    const videoUrl = data.video?.url;

    if (!videoUrl) {
      return { success: false, error: "No video URL in response" };
    }

    // Import the generated video into the project
    const mediaId = await importGeneratedMedia(videoUrl, `AI Video - ${params.prompt.substring(0, 30)}`, "video");

    return { success: true, mediaId, url: videoUrl };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function generateVideoWithKling(
  params: GenerateVideoParams,
  apiKey?: string
): Promise<GenerationResult> {
  if (!apiKey) {
    return { success: false, error: "Kling API key not configured" };
  }

  // Kling API implementation
  // Note: Kling's API may require polling for completion
  try {
    const response = await fetch("https://api.klingai.com/v1/videos/text-to-video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: params.prompt,
        duration: params.duration || 5,
        aspect_ratio: params.aspectRatio || "16:9",
        negative_prompt: params.negativePrompt,
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Kling API error: ${response.statusText}` };
    }

    const data = await response.json();

    // Poll for completion if needed
    if (data.task_id) {
      return await pollForCompletion("kling", data.task_id, apiKey);
    }

    const videoUrl = data.video_url || data.output?.video_url;
    if (!videoUrl) {
      return { success: false, error: "No video URL in response" };
    }

    const mediaId = await importGeneratedMedia(videoUrl, `Kling - ${params.prompt.substring(0, 30)}`, "video");
    return { success: true, mediaId, url: videoUrl };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function generateVideoWithRunway(
  params: GenerateVideoParams,
  apiKey?: string
): Promise<GenerationResult> {
  if (!apiKey) {
    return { success: false, error: "Runway API key not configured" };
  }

  try {
    const response = await fetch("https://api.runwayml.com/v1/text-to-video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: params.prompt,
        duration: params.duration || 4,
        aspect_ratio: params.aspectRatio || "16:9",
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Runway API error: ${response.statusText}` };
    }

    const data = await response.json();
    const videoUrl = data.output_url || data.video_url;

    if (!videoUrl) {
      return { success: false, error: "No video URL in response" };
    }

    const mediaId = await importGeneratedMedia(videoUrl, `Runway - ${params.prompt.substring(0, 30)}`, "video");
    return { success: true, mediaId, url: videoUrl };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function generateVideoWithGemini(
  params: GenerateVideoParams,
  apiKey?: string
): Promise<GenerationResult> {
  if (!apiKey) {
    return { success: false, error: "Gemini API key not configured" };
  }

  try {
    // Gemini video generation via Veo 2
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [
            {
              prompt: params.prompt,
            },
          ],
          parameters: {
            aspectRatio: params.aspectRatio || "16:9",
            durationSeconds: params.duration || 5,
          },
        }),
      }
    );

    if (!response.ok) {
      return { success: false, error: `Gemini API error: ${response.statusText}` };
    }

    const data = await response.json();

    // Gemini returns an operation that needs polling
    if (data.name) {
      return await pollGeminiOperation(data.name, apiKey);
    }

    return { success: false, error: "Unexpected Gemini response format" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ============================================================================
// Music Generation
// ============================================================================

/**
 * Generate music using AI
 *
 * @example
 * const result = await generateMusic({
 *   prompt: "Upbeat electronic music for a tech product video",
 *   duration: 30,
 *   mood: "energetic"
 * }, "suno");
 */
export async function generateMusic(
  params: GenerateMusicParams,
  provider: "suno" | "udio" | "fal" = "fal"
): Promise<GenerationResult> {
  const keys = getApiKeys();

  switch (provider) {
    case "fal":
      return generateMusicWithFal(params, keys.fal);
    case "suno":
      return generateMusicWithSuno(params, keys.suno);
    default:
      return { success: false, error: `Provider '${provider}' not implemented` };
  }
}

async function generateMusicWithFal(
  params: GenerateMusicParams,
  apiKey?: string
): Promise<GenerationResult> {
  if (!apiKey) {
    return { success: false, error: "FAL API key not configured" };
  }

  try {
    // Using MusicGen via FAL
    const response = await fetch("https://fal.run/fal-ai/musicgen", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: buildMusicPrompt(params),
        duration_seconds: params.duration || 30,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `FAL API error: ${error}` };
    }

    const data = await response.json();
    const audioUrl = data.audio?.url || data.audio_file?.url;

    if (!audioUrl) {
      return { success: false, error: "No audio URL in response" };
    }

    const mediaId = await importGeneratedMedia(audioUrl, `AI Music - ${params.prompt.substring(0, 30)}`, "audio");
    return { success: true, mediaId, url: audioUrl };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function generateMusicWithSuno(
  params: GenerateMusicParams,
  apiKey?: string
): Promise<GenerationResult> {
  if (!apiKey) {
    return { success: false, error: "Suno API key not configured" };
  }

  try {
    const response = await fetch("https://api.suno.ai/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: buildMusicPrompt(params),
        duration: params.duration || 30,
        instrumental: params.instrumental ?? true,
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Suno API error: ${response.statusText}` };
    }

    const data = await response.json();
    const audioUrl = data.audio_url || data.output_url;

    if (!audioUrl) {
      return { success: false, error: "No audio URL in response" };
    }

    const mediaId = await importGeneratedMedia(audioUrl, `Suno - ${params.prompt.substring(0, 30)}`, "audio");
    return { success: true, mediaId, url: audioUrl };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

function buildMusicPrompt(params: GenerateMusicParams): string {
  let prompt = params.prompt;
  if (params.genre) {
    prompt = `${params.genre} ${prompt}`;
  }
  if (params.mood) {
    prompt = `${params.mood} ${prompt}`;
  }
  return prompt;
}

// ============================================================================
// Voice Generation
// ============================================================================

/**
 * Generate voiceover using AI
 *
 * @example
 * const result = await generateVoiceover({
 *   text: "Welcome to our product demonstration",
 *   voice: "alloy",
 *   speed: 1.0
 * }, "openai");
 */
export async function generateVoiceover(
  params: GenerateVoiceParams,
  provider: "elevenlabs" | "openai" = "openai"
): Promise<GenerationResult> {
  const keys = getApiKeys();

  switch (provider) {
    case "openai":
      return generateVoiceWithOpenAI(params, keys.openai);
    case "elevenlabs":
      return generateVoiceWithElevenLabs(params, keys.elevenlabs);
    default:
      return { success: false, error: `Provider '${provider}' not implemented` };
  }
}

async function generateVoiceWithOpenAI(
  params: GenerateVoiceParams,
  apiKey?: string
): Promise<GenerationResult> {
  if (!apiKey) {
    return { success: false, error: "OpenAI API key not configured" };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: params.voice || "alloy",
        input: params.text,
        speed: params.speed || 1.0,
      }),
    });

    if (!response.ok) {
      return { success: false, error: `OpenAI TTS error: ${response.statusText}` };
    }

    // Response is audio blob
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    const mediaId = await importGeneratedMedia(
      audioUrl,
      `Voiceover - ${params.text.substring(0, 30)}`,
      "audio",
      audioBlob
    );

    return { success: true, mediaId, url: audioUrl };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function generateVoiceWithElevenLabs(
  params: GenerateVoiceParams,
  apiKey?: string
): Promise<GenerationResult> {
  if (!apiKey) {
    return { success: false, error: "ElevenLabs API key not configured" };
  }

  try {
    // Default to a common voice ID
    const voiceId = params.voice || "21m00Tcm4TlvDq8ikWAM"; // Rachel

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: params.text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    });

    if (!response.ok) {
      return { success: false, error: `ElevenLabs error: ${response.statusText}` };
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    const mediaId = await importGeneratedMedia(
      audioUrl,
      `ElevenLabs - ${params.text.substring(0, 30)}`,
      "audio",
      audioBlob
    );

    return { success: true, mediaId, url: audioUrl };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ============================================================================
// Video Analysis
// ============================================================================

/**
 * Analyze a video using AI to understand its content
 *
 * @example
 * const result = await analyzeVideo({
 *   mediaId: "...",
 *   prompt: "Describe the main scenes and suggest edit points"
 * });
 */
export async function analyzeVideo(params: AnalyzeVideoParams): Promise<{
  success: boolean;
  analysis?: string;
  error?: string;
}> {
  const keys = getApiKeys();

  if (!keys.gemini) {
    return { success: false, error: "Gemini API key not configured for video analysis" };
  }

  const mediaStore = useMediaStore.getState();
  const mediaFile = mediaStore.mediaFiles.find((f) => f.id === params.mediaId);

  if (!mediaFile) {
    return { success: false, error: `Media file with ID '${params.mediaId}' not found` };
  }

  try {
    // For Gemini video analysis, we need to upload the video first
    // This is a simplified version - in production you'd want to handle larger files
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${keys.gemini}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: params.prompt || "Analyze this video and describe its content, scenes, and suggest good edit points.",
                },
                {
                  file_data: {
                    mime_type: "video/mp4",
                    file_uri: mediaFile.url,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      return { success: false, error: `Gemini API error: ${response.statusText}` };
    }

    const data = await response.json();
    const analysis = data.candidates?.[0]?.content?.parts?.[0]?.text;

    return { success: true, analysis };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function importGeneratedMedia(
  url: string,
  name: string,
  type: "video" | "audio" | "image",
  blob?: Blob
): Promise<string> {
  const mediaStore = useMediaStore.getState();
  const projectStore = useProjectStore.getState();

  const projectId = projectStore.currentProject?.id;
  if (!projectId) {
    throw new Error("No active project");
  }

  // Fetch the media if we don't have a blob
  let mediaBlob = blob;
  if (!mediaBlob) {
    const response = await fetch(url);
    mediaBlob = await response.blob();
  }

  // Create a File object
  const extension = type === "video" ? "mp4" : type === "audio" ? "mp3" : "png";
  const file = new File([mediaBlob], `${name}.${extension}`, {
    type: type === "video" ? "video/mp4" : type === "audio" ? "audio/mpeg" : "image/png",
  });

  // Add to media store
  const mediaFile = await mediaStore.addMediaFile(projectId, {
    name,
    type,
    file,
    url: URL.createObjectURL(file),
    ephemeral: true, // Mark as ephemeral since it's generated
  });

  return mediaFile.id;
}

/**
 * Calculate delay with exponential backoff
 * Starts at 2s, doubles each attempt, caps at 30s
 */
function getBackoffDelay(attempt: number): number {
  const baseDelay = 2000; // 2 seconds
  const maxDelay = 30000; // 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add some jitter (±10%) to prevent thundering herd
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

async function pollForCompletion(
  provider: string,
  taskId: string,
  apiKey: string,
  maxAttempts = 30 // Reduced since we're using exponential backoff
): Promise<GenerationResult> {
  const pollUrls: Record<string, string> = {
    kling: `https://api.klingai.com/v1/videos/text-to-video/${taskId}`,
  };

  const pollUrl = pollUrls[provider];
  if (!pollUrl) {
    return { success: false, error: `Polling not implemented for ${provider}` };
  }

  for (let i = 0; i < maxAttempts; i++) {
    // Exponential backoff: 2s, 4s, 8s, 16s, 30s, 30s...
    const delay = getBackoffDelay(i);
    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      const response = await fetch(pollUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!response.ok) continue;

      const data = await response.json();

      if (data.status === "completed" || data.status === "succeeded") {
        const videoUrl = data.video_url || data.output?.video_url;
        if (videoUrl) {
          const mediaId = await importGeneratedMedia(videoUrl, `${provider} video`, "video");
          return { success: true, mediaId, url: videoUrl };
        }
      }

      if (data.status === "failed") {
        return { success: false, error: data.error || "Generation failed" };
      }
    } catch {
      // Network error, continue polling
      continue;
    }
  }

  return { success: false, error: "Generation timed out" };
}

async function pollGeminiOperation(
  operationName: string,
  apiKey: string,
  maxAttempts = 30 // Reduced since we're using exponential backoff
): Promise<GenerationResult> {
  for (let i = 0; i < maxAttempts; i++) {
    // Exponential backoff: 2s, 4s, 8s, 16s, 30s, 30s...
    const delay = getBackoffDelay(i);
    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`
      );

      if (!response.ok) continue;

      const data = await response.json();

      if (data.done) {
        if (data.error) {
          return { success: false, error: data.error.message };
        }

        const videoUrl = data.response?.generatedVideos?.[0]?.video?.uri;
        if (videoUrl) {
          const mediaId = await importGeneratedMedia(videoUrl, "Gemini video", "video");
          return { success: true, mediaId, url: videoUrl };
        }
      }
    } catch {
      // Network error, continue polling
      continue;
    }
  }

  return { success: false, error: "Generation timed out" };
}
