/**
 * Character Manager
 *
 * Manages AI mascot character poses for video replication:
 * - Create and maintain a pose library for a character
 * - Generate new poses using Gemini with the user's base prompt
 * - Match required poses to existing library
 *
 * Usage:
 * ```typescript
 * import { createPoseLibrary, generateCharacterPose } from '@/lib/ai-editor/character-manager';
 *
 * // Create a pose library from a character image
 * const library = await createPoseLibrary({
 *   characterImageId: 'char-123',
 *   basePrompt: 'A cute robot mascot with big eyes',
 *   requiredPoses: ['standing', 'waving', 'dancing']
 * });
 *
 * // Generate a specific pose
 * const pose = await generateCharacterPose({
 *   basePrompt: 'A cute robot mascot with big eyes',
 *   poseType: 'jumping',
 *   referenceImageId: 'char-123'
 * });
 * ```
 */

import { useMediaStore } from "@/stores/media-store";
import { useProjectStore } from "@/stores/project-store";
import { getApiKeys } from "./ai-api-service";
import { extractFrameAt } from "./analysis";

// ============================================================================
// Types
// ============================================================================

export interface CharacterPoseLibrary {
  /** Base character info */
  baseImage: {
    mediaId: string;
    dataUrl: string;
  };

  /** User's base prompt for generating this character */
  basePrompt: string;

  /** Generated poses for different motions */
  poses: CharacterPose[];

  /** When the library was created/updated */
  updatedAt: Date;
}

export interface CharacterPose {
  /** Pose identifier */
  poseType: string;
  /** Media ID of the generated pose image */
  imageMediaId: string;
  /** Data URL for quick access */
  dataUrl: string;
  /** Prompt used to generate this pose */
  prompt: string;
  /** Which scenes this pose works for */
  suitableForScenes: number[];
}

export interface GeneratePoseParams {
  /** Base prompt describing the character */
  basePrompt: string;
  /** Type of pose to generate */
  poseType: string;
  /** Reference image media ID (optional, helps with consistency) */
  referenceImageId?: string;
  /** Additional style modifiers */
  style?: string;
}

// ============================================================================
// Pose Type Definitions
// ============================================================================

/**
 * Standard pose types and their generation prompts
 */
export const POSE_PROMPTS: Record<string, string> = {
  // Basic poses
  standing: "standing straight, facing forward, neutral pose",
  sitting: "sitting down, relaxed pose",
  walking: "walking forward, mid-stride",
  running: "running, dynamic pose with motion",

  // Gestures
  waving: "waving hand at camera, friendly gesture",
  pointing: "pointing at camera with one hand",
  thumbs_up: "giving thumbs up, approving gesture",
  peace_sign: "making peace sign with fingers",
  thinking: "hand on chin, thinking pose",
  shrugging: "shrugging shoulders, questioning pose",

  // Expressions/Emotions
  happy: "happy expression, slight smile",
  surprised: "surprised expression, eyes wide",
  excited: "excited pose, arms raised",
  sad: "sad expression, downcast",

  // Actions
  dancing: "dancing pose, dynamic movement",
  jumping: "jumping in the air, energetic",
  clapping: "clapping hands",
  celebrating: "celebrating, arms up in victory",

  // Camera-specific
  face_closeup: "close-up portrait, face centered",
  profile: "side profile view",
  three_quarter: "three-quarter view, slight angle",

  // Special
  speaking: "mouth open as if speaking",
  listening: "attentive listening pose",
};

// ============================================================================
// Pose Library Management
// ============================================================================

/**
 * Create a pose library for a character
 *
 * @param options - Library creation options
 * @returns Created pose library
 */
export async function createPoseLibrary(options: {
  /** Media ID of the base character image */
  characterImageId: string;
  /** Base prompt describing the character (used for all generations) */
  basePrompt: string;
  /** Poses to generate (defaults to common poses if not specified) */
  requiredPoses?: string[];
  /** Style modifier (e.g., "anime style", "3D render") */
  style?: string;
  /** Progress callback */
  onProgress?: (progress: number, message: string) => void;
}): Promise<CharacterPoseLibrary> {
  const {
    characterImageId,
    basePrompt,
    requiredPoses = ["standing", "waving", "happy"],
    style,
    onProgress,
  } = options;

  const keys = getApiKeys();
  if (!keys.gemini) {
    throw new Error("Gemini API key required for pose generation. Set it in Settings > AI Settings.");
  }

  // Get the base character image
  const mediaStore = useMediaStore.getState();
  const baseMediaFile = mediaStore.mediaFiles.find((f) => f.id === characterImageId);

  if (!baseMediaFile) {
    throw new Error(`Character image with ID '${characterImageId}' not found`);
  }

  // Get the image data URL
  let baseDataUrl: string;
  if (baseMediaFile.type === "image" && baseMediaFile.url) {
    baseDataUrl = await fetchAsDataUrl(baseMediaFile.url);
  } else if (baseMediaFile.type === "video") {
    // Extract first frame from video
    const frame = await extractFrameAt(characterImageId, 0);
    if (!frame) {
      throw new Error("Could not extract frame from video for character reference");
    }
    baseDataUrl = frame.dataUrl;
  } else {
    throw new Error("Character must be an image or video file");
  }

  const library: CharacterPoseLibrary = {
    baseImage: {
      mediaId: characterImageId,
      dataUrl: baseDataUrl,
    },
    basePrompt,
    poses: [],
    updatedAt: new Date(),
  };

  // Generate each required pose
  const totalPoses = requiredPoses.length;
  for (let i = 0; i < totalPoses; i++) {
    const poseType = requiredPoses[i];
    onProgress?.((i / totalPoses) * 0.9, `Generating pose: ${poseType}...`);

    try {
      const pose = await generateCharacterPose({
        basePrompt,
        poseType,
        referenceImageId: characterImageId,
        style,
      });

      library.poses.push(pose);
    } catch (error) {
      console.warn(`Failed to generate pose '${poseType}':`, error);
      // Continue with other poses
    }
  }

  onProgress?.(1.0, "Pose library created!");

  return library;
}

/**
 * Generate a single character pose
 *
 * @param params - Pose generation parameters
 * @returns Generated pose
 */
export async function generateCharacterPose(
  params: GeneratePoseParams
): Promise<CharacterPose> {
  const keys = getApiKeys();
  if (!keys.gemini) {
    throw new Error("Gemini API key required for pose generation");
  }

  const { basePrompt, poseType, referenceImageId, style } = params;

  // Build the full prompt
  const poseDescription = POSE_PROMPTS[poseType] || poseType;
  let fullPrompt = `${basePrompt}, ${poseDescription}`;
  if (style) {
    fullPrompt += `, ${style}`;
  }
  fullPrompt += ", high quality, consistent character design";

  // Get reference image if provided
  let referenceDataUrl: string | undefined;
  if (referenceImageId) {
    const mediaStore = useMediaStore.getState();
    const refMedia = mediaStore.mediaFiles.find((f) => f.id === referenceImageId);
    if (refMedia?.url) {
      try {
        referenceDataUrl = await fetchAsDataUrl(refMedia.url);
      } catch {
        // Continue without reference
      }
    }
  }

  // Generate image with Gemini Imagen
  const imageResult = await generateImageWithGemini(fullPrompt, referenceDataUrl, keys.gemini);

  if (!imageResult.success || !imageResult.dataUrl) {
    throw new Error(imageResult.error || "Failed to generate pose image");
  }

  // Import the generated image into the project
  const mediaId = await importGeneratedImage(
    imageResult.dataUrl,
    `Character - ${poseType}`
  );

  return {
    poseType,
    imageMediaId: mediaId,
    dataUrl: imageResult.dataUrl,
    prompt: fullPrompt,
    suitableForScenes: [],
  };
}

/**
 * Add a pose to an existing library
 */
export async function addPoseToLibrary(
  library: CharacterPoseLibrary,
  poseType: string,
  style?: string
): Promise<CharacterPose> {
  const pose = await generateCharacterPose({
    basePrompt: library.basePrompt,
    poseType,
    referenceImageId: library.baseImage.mediaId,
    style,
  });

  library.poses.push(pose);
  library.updatedAt = new Date();

  return pose;
}

/**
 * Find the best pose in a library for a given requirement
 */
export function findBestPose(
  library: CharacterPoseLibrary,
  requirement: string
): CharacterPose | null {
  // Direct match
  const directMatch = library.poses.find(
    (p) => p.poseType.toLowerCase() === requirement.toLowerCase()
  );
  if (directMatch) return directMatch;

  // Partial match
  const partialMatch = library.poses.find(
    (p) =>
      p.poseType.toLowerCase().includes(requirement.toLowerCase()) ||
      requirement.toLowerCase().includes(p.poseType.toLowerCase())
  );
  if (partialMatch) return partialMatch;

  // Similar category match
  const categoryMap: Record<string, string[]> = {
    movement: ["walking", "running", "dancing", "jumping"],
    gesture: ["waving", "pointing", "thumbs_up", "peace_sign", "clapping"],
    emotion: ["happy", "surprised", "excited", "sad"],
    static: ["standing", "sitting", "thinking"],
  };

  for (const [_category, poses] of Object.entries(categoryMap)) {
    if (poses.includes(requirement.toLowerCase())) {
      const categoryMatch = library.poses.find((p) =>
        poses.includes(p.poseType.toLowerCase())
      );
      if (categoryMatch) return categoryMatch;
    }
  }

  // Return standing as default, or first available
  return (
    library.poses.find((p) => p.poseType === "standing") ||
    library.poses[0] ||
    null
  );
}

/**
 * Get all available pose types
 */
export function getAvailablePoseTypes(): string[] {
  return Object.keys(POSE_PROMPTS);
}

// ============================================================================
// Gemini Image Generation
// ============================================================================

async function generateImageWithGemini(
  prompt: string,
  referenceDataUrl: string | undefined,
  apiKey: string
): Promise<{ success: boolean; dataUrl?: string; error?: string }> {
  try {
    // Build request parts
    const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [];

    // Add reference image if available
    if (referenceDataUrl) {
      const base64 = referenceDataUrl.replace(/^data:image\/\w+;base64,/, "");
      parts.push({
        inline_data: {
          mime_type: "image/png",
          data: base64,
        },
      });
      parts.push({
        text: `Based on this character reference image, generate a new image: ${prompt}`,
      });
    } else {
      parts.push({ text: `Generate an image: ${prompt}` });
    }

    // Use Gemini's image generation capability
    // Note: This uses Imagen 3 via Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ["image", "text"],
            responseMimeType: "image/png",
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Gemini API error: ${error}` };
    }

    const data = await response.json();

    // Extract image from response
    const imagePart = data.candidates?.[0]?.content?.parts?.find(
      (p: { inline_data?: { data: string } }) => p.inline_data?.data
    );

    if (imagePart?.inline_data?.data) {
      const dataUrl = `data:image/png;base64,${imagePart.inline_data.data}`;
      return { success: true, dataUrl };
    }

    // If no image in response, try text-to-image endpoint
    return await generateImageWithImagen(prompt, apiKey);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function generateImageWithImagen(
  prompt: string,
  apiKey: string
): Promise<{ success: boolean; dataUrl?: string; error?: string }> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: "1:1",
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Imagen API error: ${error}` };
    }

    const data = await response.json();
    const imageData = data.predictions?.[0]?.bytesBase64Encoded;

    if (imageData) {
      const dataUrl = `data:image/png;base64,${imageData}`;
      return { success: true, dataUrl };
    }

    return { success: false, error: "No image in response" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function fetchAsDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) {
    return url;
  }

  const response = await fetch(url);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function importGeneratedImage(
  dataUrl: string,
  name: string
): Promise<string> {
  const mediaStore = useMediaStore.getState();
  const projectStore = useProjectStore.getState();

  const projectId = projectStore.currentProject?.id;
  if (!projectId) {
    throw new Error("No active project");
  }

  // Convert data URL to blob
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  // Create file
  const file = new File([blob], `${name}.png`, { type: "image/png" });

  // Add to media store
  const mediaFile = await mediaStore.addMediaFile(projectId, {
    name,
    type: "image",
    file,
    url: URL.createObjectURL(file),
    ephemeral: true,
  });

  return mediaFile.id;
}

// ============================================================================
// Library Persistence (using localStorage for now)
// ============================================================================

const LIBRARY_STORAGE_KEY = "opencut_character_libraries";

/**
 * Save a pose library to persistent storage
 */
export function savePoseLibrary(
  characterId: string,
  library: CharacterPoseLibrary
): void {
  try {
    const stored = localStorage.getItem(LIBRARY_STORAGE_KEY);
    const libraries: Record<string, CharacterPoseLibrary> = stored
      ? JSON.parse(stored)
      : {};

    libraries[characterId] = library;
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(libraries));
  } catch (error) {
    console.warn("Failed to save pose library:", error);
  }
}

/**
 * Load a pose library from persistent storage
 */
export function loadPoseLibrary(
  characterId: string
): CharacterPoseLibrary | null {
  try {
    const stored = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (!stored) return null;

    const libraries: Record<string, CharacterPoseLibrary> = JSON.parse(stored);
    return libraries[characterId] || null;
  } catch {
    return null;
  }
}

/**
 * List all stored pose libraries
 */
export function listPoseLibraries(): string[] {
  try {
    const stored = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (!stored) return [];

    const libraries: Record<string, CharacterPoseLibrary> = JSON.parse(stored);
    return Object.keys(libraries);
  } catch {
    return [];
  }
}
