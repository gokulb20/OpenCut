/**
 * Video Replicator
 *
 * Main orchestration for the video replication pipeline.
 * Takes a reference video and character image, then recreates the video
 * with the character mimicking the original motions.
 *
 * Pipeline:
 * 1. Analyze reference video (scenes, timings, motions, camera angles)
 * 2. Prepare character poses (generate missing poses with Gemini)
 * 3. Generate motion clips for each scene (Domo AI)
 * 4. Reconstruct timeline with generated clips
 *
 * Usage:
 * ```typescript
 * import { replicateVideo, analyzeForReplication } from '@/lib/ai-editor/video-replicator';
 *
 * // Full replication
 * const result = await replicateVideo({
 *   videoMediaId: 'reference-video-123',
 *   characterImage: 'character-456',
 *   characterBasePrompt: 'A cute robot mascot with big eyes',
 *   options: {
 *     style: 'anime',
 *     generateMissingPoses: true,
 *     onProgress: (stage, progress, message) => console.log(message)
 *   }
 * });
 * ```
 */

import type { VideoBreakdown, VideoScene } from "./video-analyzer";
import type { CharacterPoseLibrary, CharacterPose } from "./character-manager";
import type { DomoStyle } from "./domo-service";
import type { VideoScript, Clip } from "./script-types";
import { analyzeVideoForReplication, getRequiredPoses } from "./video-analyzer";
import {
  createPoseLibrary,
  findBestPose,
  addPoseToLibrary,
  loadPoseLibrary,
  savePoseLibrary,
} from "./character-manager";
import {
  generateMotionVideoSmart,
  buildMotionPromptFromAnalysis,
  getMotionPrompt,
} from "./domo-service";
import { executeScript } from "./script-executor";

// ============================================================================
// Types
// ============================================================================

export interface ReplicationOptions {
  /** Media ID of the video to replicate */
  videoMediaId: string;
  /** Media ID of the character image */
  characterImage: string;
  /** Base prompt for generating character poses */
  characterBasePrompt: string;
  /** Additional character poses (optional media IDs) */
  additionalPoses?: string[];
  /** Replication options */
  options?: {
    /** Art style for Domo AI */
    style?: DomoStyle;
    /** Keep original audio or generate similar */
    keepOriginalAudio?: boolean;
    /** Auto-generate missing poses with Gemini */
    generateMissingPoses?: boolean;
    /** Progress callback */
    onProgress?: ReplicationProgressCallback;
  };
}

export interface ReplicationResult {
  success: boolean;
  /** The reconstructed video (if exported) */
  videoMediaId?: string;
  /** Detailed breakdown used */
  breakdown?: VideoBreakdown;
  /** Generated/used poses */
  poseLibrary?: CharacterPoseLibrary;
  /** Generated scene clips */
  generatedClips?: Array<{
    sceneIndex: number;
    mediaId: string;
    duration: number;
  }>;
  /** Errors if any */
  errors?: string[];
  /** Warnings (non-fatal issues) */
  warnings?: string[];
}

export interface ReplicationPlan {
  /** Original video breakdown */
  source: VideoBreakdown;
  /** Character pose library */
  character: CharacterPoseLibrary;
  /** Plan for each scene */
  sceneReplications: SceneReplicationPlan[];
  /** Music strategy */
  music: {
    strategy: "keep_original" | "generate_similar" | "none";
    prompt?: string;
    mediaId?: string;
  };
}

export interface SceneReplicationPlan {
  sceneIndex: number;
  /** Character pose to use as start frame */
  pose: CharacterPose;
  /** Motion prompt for Domo AI */
  motionPrompt: string;
  /** Style to apply */
  style: DomoStyle;
  /** Duration to generate */
  duration: number;
  /** Original scene for reference */
  originalScene: VideoScene;
}

export type ReplicationProgressCallback = (
  stage: ReplicationStage,
  progress: number,
  message: string
) => void;

export type ReplicationStage =
  | "analyzing"
  | "preparing_character"
  | "generating_motions"
  | "building_timeline"
  | "complete"
  | "error";

// ============================================================================
// Main Replication Function
// ============================================================================

/**
 * Replicate a video with your character
 *
 * This is the main entry point for the video replication pipeline.
 */
export async function replicateVideo(
  options: ReplicationOptions
): Promise<ReplicationResult> {
  const {
    videoMediaId,
    characterImage,
    characterBasePrompt,
    additionalPoses = [],
    options: opts = {},
  } = options;

  const {
    style = "default",
    keepOriginalAudio = false,
    generateMissingPoses = true,
    onProgress,
  } = opts;

  const result: ReplicationResult = {
    success: false,
    errors: [],
    warnings: [],
    generatedClips: [],
  };

  try {
    // ========================================================================
    // Stage 1: Analyze Reference Video
    // ========================================================================
    onProgress?.("analyzing", 0, "Analyzing reference video...");

    const breakdown = await analyzeVideoForReplication(videoMediaId, {
      onProgress: (progress, message) => {
        onProgress?.("analyzing", progress * 0.25, message);
      },
    });

    result.breakdown = breakdown;
    onProgress?.("analyzing", 0.25, `Found ${breakdown.scenes.length} scenes`);

    // ========================================================================
    // Stage 2: Prepare Character Poses
    // ========================================================================
    onProgress?.("preparing_character", 0.25, "Preparing character poses...");

    // Get required poses from the video analysis
    const requiredPoses = getRequiredPoses(breakdown);
    onProgress?.(
      "preparing_character",
      0.3,
      `Need ${requiredPoses.length} poses: ${requiredPoses.join(", ")}`
    );

    // Try to load existing pose library
    let poseLibrary = loadPoseLibrary(characterImage);

    if (!poseLibrary) {
      // Create new pose library
      onProgress?.("preparing_character", 0.35, "Creating pose library...");

      poseLibrary = await createPoseLibrary({
        characterImageId: characterImage,
        basePrompt: characterBasePrompt,
        requiredPoses: generateMissingPoses ? requiredPoses : ["standing"],
        style: style !== "default" ? style : undefined,
        onProgress: (progress, message) => {
          onProgress?.(
            "preparing_character",
            0.35 + progress * 0.1,
            message
          );
        },
      });

      // Save for future use
      savePoseLibrary(characterImage, poseLibrary);
    } else if (generateMissingPoses) {
      // Generate any missing poses
      const existingPoseTypes = poseLibrary.poses.map((p) => p.poseType);
      const missingPoses = requiredPoses.filter(
        (p) => !existingPoseTypes.includes(p)
      );

      if (missingPoses.length > 0) {
        onProgress?.(
          "preparing_character",
          0.4,
          `Generating ${missingPoses.length} missing poses...`
        );

        for (const poseType of missingPoses) {
          try {
            await addPoseToLibrary(poseLibrary, poseType, style);
          } catch (error) {
            result.warnings?.push(
              `Failed to generate pose '${poseType}': ${error}`
            );
          }
        }

        savePoseLibrary(characterImage, poseLibrary);
      }
    }

    result.poseLibrary = poseLibrary;
    onProgress?.(
      "preparing_character",
      0.45,
      `Character ready with ${poseLibrary.poses.length} poses`
    );

    // ========================================================================
    // Stage 3: Generate Motion Clips for Each Scene
    // ========================================================================
    onProgress?.("generating_motions", 0.45, "Generating motion clips...");

    const generatedClips: ReplicationResult["generatedClips"] = [];
    const totalScenes = breakdown.scenes.length;

    for (let i = 0; i < totalScenes; i++) {
      const scene = breakdown.scenes[i];
      const sceneProgress = 0.45 + (i / totalScenes) * 0.4;

      onProgress?.(
        "generating_motions",
        sceneProgress,
        `Generating scene ${i + 1}/${totalScenes}...`
      );

      // Find best pose for this scene
      const poseMatch = findBestPose(poseLibrary, scene.motion.type);
      if (!poseMatch) {
        result.warnings?.push(`No suitable pose for scene ${i + 1}, using default`);
        continue;
      }

      // Build motion prompt
      const motionPrompt = buildMotionPromptFromAnalysis(scene.motion);

      try {
        // Generate motion video
        const motionResult = await generateMotionVideoSmart({
          imageDataUrl: poseMatch.dataUrl,
          prompt: motionPrompt,
          style,
          duration: Math.min(scene.duration, 5), // Domo typically generates 3-5s
          aspectRatio: breakdown.source.aspectRatio,
        });

        if (motionResult.success && motionResult.mediaId) {
          generatedClips.push({
            sceneIndex: i,
            mediaId: motionResult.mediaId,
            duration: scene.duration,
          });
        } else {
          result.warnings?.push(
            `Failed to generate scene ${i + 1}: ${motionResult.error}`
          );
        }
      } catch (error) {
        result.warnings?.push(
          `Error generating scene ${i + 1}: ${error instanceof Error ? error.message : "Unknown"}`
        );
      }
    }

    result.generatedClips = generatedClips;
    onProgress?.(
      "generating_motions",
      0.85,
      `Generated ${generatedClips.length}/${totalScenes} scenes`
    );

    // ========================================================================
    // Stage 4: Build Timeline
    // ========================================================================
    onProgress?.("building_timeline", 0.85, "Building timeline...");

    // Create a VideoScript from the generated clips
    const script = buildReplicationScript(
      breakdown,
      generatedClips,
      keepOriginalAudio
    );

    // Execute the script to build the timeline
    const scriptResult = await executeScript(script, (stage, progress, message) => {
      onProgress?.("building_timeline", 0.85 + progress * 0.14, message);
    });

    if (!scriptResult.success) {
      result.errors?.push(`Timeline build failed: ${scriptResult.error}`);
    }

    // ========================================================================
    // Complete
    // ========================================================================
    result.success = generatedClips.length > 0;
    onProgress?.(
      "complete",
      1,
      result.success
        ? `Replication complete! Created ${generatedClips.length} scenes.`
        : "Replication completed with errors"
    );

    return result;
  } catch (error) {
    result.success = false;
    result.errors?.push(
      error instanceof Error ? error.message : "Unknown error"
    );
    onProgress?.(
      "error",
      0,
      `Error: ${error instanceof Error ? error.message : "Unknown"}`
    );
    return result;
  }
}

// ============================================================================
// Planning Functions
// ============================================================================

/**
 * Analyze a video and create a replication plan (without executing)
 *
 * Use this to preview what will be generated before running the full pipeline.
 */
export async function createReplicationPlan(
  options: Omit<ReplicationOptions, "options"> & {
    options?: Omit<ReplicationOptions["options"], "onProgress">;
  }
): Promise<ReplicationPlan> {
  const {
    videoMediaId,
    characterImage,
    characterBasePrompt,
    options: opts = {},
  } = options;

  const { style = "default" } = opts;

  // Analyze video
  const breakdown = await analyzeVideoForReplication(videoMediaId);

  // Get or create pose library
  let poseLibrary = loadPoseLibrary(characterImage);
  if (!poseLibrary) {
    const requiredPoses = getRequiredPoses(breakdown);
    poseLibrary = await createPoseLibrary({
      characterImageId: characterImage,
      basePrompt: characterBasePrompt,
      requiredPoses,
      style: style !== "default" ? style : undefined,
    });
    savePoseLibrary(characterImage, poseLibrary);
  }

  // Create scene plans
  const sceneReplications: SceneReplicationPlan[] = [];

  for (let i = 0; i < breakdown.scenes.length; i++) {
    const scene = breakdown.scenes[i];
    const pose = findBestPose(poseLibrary, scene.motion.type);

    if (pose) {
      sceneReplications.push({
        sceneIndex: i,
        pose,
        motionPrompt: buildMotionPromptFromAnalysis(scene.motion),
        style,
        duration: scene.duration,
        originalScene: scene,
      });
    }
  }

  return {
    source: breakdown,
    character: poseLibrary,
    sceneReplications,
    music: {
      strategy: breakdown.audio.hasMusic ? "generate_similar" : "none",
      prompt: breakdown.audio.musicMood
        ? `${breakdown.audio.musicMood} ${breakdown.audio.musicGenre || "music"}`
        : undefined,
    },
  };
}

/**
 * Execute an existing replication plan
 */
export async function executeReplicationPlan(
  plan: ReplicationPlan,
  onProgress?: ReplicationProgressCallback
): Promise<ReplicationResult> {
  const result: ReplicationResult = {
    success: false,
    breakdown: plan.source,
    poseLibrary: plan.character,
    generatedClips: [],
    errors: [],
    warnings: [],
  };

  const totalScenes = plan.sceneReplications.length;

  for (let i = 0; i < totalScenes; i++) {
    const scenePlan = plan.sceneReplications[i];
    const progress = i / totalScenes;

    onProgress?.(
      "generating_motions",
      progress,
      `Generating scene ${i + 1}/${totalScenes}...`
    );

    try {
      const motionResult = await generateMotionVideoSmart({
        imageDataUrl: scenePlan.pose.dataUrl,
        prompt: scenePlan.motionPrompt,
        style: scenePlan.style,
        duration: Math.min(scenePlan.duration, 5),
        aspectRatio: plan.source.source.aspectRatio,
      });

      if (motionResult.success && motionResult.mediaId) {
        result.generatedClips?.push({
          sceneIndex: scenePlan.sceneIndex,
          mediaId: motionResult.mediaId,
          duration: scenePlan.duration,
        });
      } else {
        result.warnings?.push(
          `Scene ${i + 1} failed: ${motionResult.error}`
        );
      }
    } catch (error) {
      result.warnings?.push(
        `Scene ${i + 1} error: ${error instanceof Error ? error.message : "Unknown"}`
      );
    }
  }

  // Build timeline
  if (result.generatedClips && result.generatedClips.length > 0) {
    onProgress?.("building_timeline", 0.9, "Building timeline...");

    const script = buildReplicationScript(
      plan.source,
      result.generatedClips,
      false
    );

    await executeScript(script);
  }

  result.success = (result.generatedClips?.length || 0) > 0;
  onProgress?.("complete", 1, "Replication complete!");

  return result;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build a VideoScript from generated clips
 */
function buildReplicationScript(
  breakdown: VideoBreakdown,
  generatedClips: Array<{ sceneIndex: number; mediaId: string; duration: number }>,
  keepOriginalAudio: boolean
): VideoScript {
  const clips: Clip[] = [];

  // Sort clips by scene index
  const sortedClips = [...generatedClips].sort(
    (a, b) => a.sceneIndex - b.sceneIndex
  );

  for (const clip of sortedClips) {
    const scene = breakdown.scenes[clip.sceneIndex];

    // Build clip
    const scriptClip: Clip = {
      duration: clip.duration,
      media: { id: clip.mediaId },
    };

    // Add text overlay if the original scene had one
    const overlay = breakdown.textOverlays.find(
      (t) =>
        t.startTime >= scene.startTime &&
        t.startTime < scene.endTime
    );

    if (overlay) {
      scriptClip.text = {
        content: overlay.content,
        style: overlay.style,
        position: overlay.position,
      };
    }

    clips.push(scriptClip);
  }

  // Build audio config
  let audio: VideoScript["audio"] | undefined;

  if (!keepOriginalAudio && breakdown.audio.hasMusic) {
    audio = {
      music: {
        generate: breakdown.audio.musicMood
          ? `${breakdown.audio.musicMood} ${breakdown.audio.musicGenre || "background music"}`
          : "background music matching video mood",
      },
    };
  }

  return {
    name: "Replicated Video",
    canvas: breakdown.source.aspectRatio,
    clips,
    audio,
  };
}

/**
 * Get a summary of the replication plan for display
 */
export function summarizeReplicationPlan(plan: ReplicationPlan): string {
  const lines: string[] = [
    "=== Replication Plan ===",
    "",
    `Source: ${plan.source.source.duration.toFixed(1)}s video, ${plan.source.source.aspectRatio}`,
    `Scenes: ${plan.source.scenes.length}`,
    `Character poses: ${plan.character.poses.length}`,
    "",
    "Scene breakdown:",
  ];

  for (const scene of plan.sceneReplications) {
    lines.push(
      `  ${scene.sceneIndex + 1}. [${scene.originalScene.startTime.toFixed(1)}s-${scene.originalScene.endTime.toFixed(1)}s] ` +
        `${scene.originalScene.motion.type} → "${scene.motionPrompt.substring(0, 40)}..."`
    );
  }

  if (plan.music.strategy !== "none") {
    lines.push("");
    lines.push(`Music: ${plan.music.strategy}`);
    if (plan.music.prompt) {
      lines.push(`  Prompt: "${plan.music.prompt}"`);
    }
  }

  return lines.join("\n");
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick analysis of a video for replication (without character prep)
 */
export async function analyzeForReplication(
  videoMediaId: string,
  onProgress?: (progress: number, message: string) => void
): Promise<{
  breakdown: VideoBreakdown;
  requiredPoses: string[];
  summary: string;
}> {
  const breakdown = await analyzeVideoForReplication(videoMediaId, {
    onProgress,
  });

  const requiredPoses = getRequiredPoses(breakdown);

  const summary = [
    `Duration: ${breakdown.source.duration.toFixed(1)}s`,
    `Scenes: ${breakdown.scenes.length}`,
    `Pacing: ${breakdown.characteristics.pacing}`,
    `Required poses: ${requiredPoses.join(", ")}`,
    breakdown.audio.hasMusic ? `Music: ${breakdown.audio.musicMood || "detected"}` : "No music",
    breakdown.audio.hasSpeech ? "Has speech" : "No speech",
  ].join("\n");

  return { breakdown, requiredPoses, summary };
}
