/**
 * Motion Extractor
 *
 * Uses MediaPipe Pose for extracting body pose landmarks from video frames.
 * This enables motion analysis and classification for video replication.
 *
 * MediaPipe Pose detects 33 body landmarks in real-time.
 *
 * Usage:
 * ```typescript
 * import { extractPoseFromFrame, analyzeMotionFromPoses, classifyMotion } from '@/lib/ai-editor/motion-extractor';
 *
 * // Extract pose from a single frame
 * const pose = await extractPoseFromFrame(frameDataUrl);
 *
 * // Analyze motion from multiple poses over time
 * const motion = analyzeMotionFromPoses(poses);
 * ```
 */

// ============================================================================
// Types
// ============================================================================

/**
 * A single pose landmark (x, y, z coordinates + visibility)
 */
export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

/**
 * Complete pose with all 33 landmarks
 */
export interface Pose {
  landmarks: PoseLandmark[];
  timestamp?: number;
}

/**
 * Pose landmark indices for reference
 */
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

/**
 * Motion analysis result
 */
export interface MotionAnalysis {
  /** Classified motion type */
  type: "static" | "movement" | "dance" | "gesture" | "walking" | "unknown";
  /** Motion intensity */
  intensity: "low" | "medium" | "high";
  /** Primary body parts moving */
  movingParts: string[];
  /** Average movement speed (normalized) */
  speed: number;
  /** Detailed description */
  description: string;
}

// ============================================================================
// MediaPipe Loading
// ============================================================================

// Store for loaded MediaPipe instance
let poseInstance: MediaPipePose | null = null;
let loadingPromise: Promise<MediaPipePose> | null = null;

interface MediaPipePose {
  process: (image: ImageData | HTMLCanvasElement) => Promise<{ poseLandmarks?: PoseLandmark[] }>;
  close: () => void;
}

/**
 * Load MediaPipe Pose model (lazy loading)
 */
async function loadMediaPipePose(): Promise<MediaPipePose> {
  if (poseInstance) return poseInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      // Dynamically import MediaPipe
      // Note: User needs to have @mediapipe/pose installed
      const mediapipe = await import("@mediapipe/pose");
      const { Pose } = mediapipe;

      const pose = new Pose({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        },
      });

      pose.setOptions({
        modelComplexity: 1, // 0 = lite, 1 = full, 2 = heavy
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      await pose.initialize();

      poseInstance = {
        process: async (image) => {
          return new Promise((resolve) => {
            pose.onResults((results: { poseLandmarks?: PoseLandmark[] }) => {
              resolve(results);
            });
            pose.send({ image });
          });
        },
        close: () => pose.close(),
      };

      return poseInstance;
    } catch (error) {
      console.warn("MediaPipe Pose not available, using fallback:", error);
      // Return a mock that always returns no pose
      poseInstance = {
        process: async () => ({ poseLandmarks: undefined }),
        close: () => {},
      };
      return poseInstance;
    }
  })();

  return loadingPromise;
}

// ============================================================================
// Pose Extraction
// ============================================================================

/**
 * Extract pose from a single frame (data URL or canvas)
 *
 * @param frameDataUrl - Frame image as data URL
 * @returns Extracted pose or null if no person detected
 */
export async function extractPoseFromFrame(
  frameDataUrl: string
): Promise<Pose | null> {
  const pose = await loadMediaPipePose();

  // Convert data URL to canvas
  const canvas = await dataUrlToCanvas(frameDataUrl);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Get image data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Process with MediaPipe
  const result = await pose.process(imageData);

  if (!result.poseLandmarks || result.poseLandmarks.length === 0) {
    return null;
  }

  return {
    landmarks: result.poseLandmarks,
  };
}

/**
 * Extract poses from multiple frames
 *
 * @param frames - Array of frames with timestamps
 * @param onProgress - Progress callback
 * @returns Array of poses with timestamps
 */
export async function extractPosesFromFrames(
  frames: Array<{ time: number; dataUrl: string }>,
  onProgress?: (progress: number) => void
): Promise<Pose[]> {
  const poses: Pose[] = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    onProgress?.(i / frames.length);

    const pose = await extractPoseFromFrame(frame.dataUrl);
    if (pose) {
      pose.timestamp = frame.time;
      poses.push(pose);
    }
  }

  onProgress?.(1);
  return poses;
}

// ============================================================================
// Motion Analysis
// ============================================================================

/**
 * Analyze motion from a sequence of poses
 *
 * @param poses - Array of poses over time
 * @returns Motion analysis result
 */
export function analyzeMotionFromPoses(poses: Pose[]): MotionAnalysis {
  if (poses.length < 2) {
    return {
      type: "static",
      intensity: "low",
      movingParts: [],
      speed: 0,
      description: "Not enough frames to analyze motion",
    };
  }

  // Calculate movement for each landmark across frames
  const movements = calculateLandmarkMovements(poses);

  // Identify which body parts are moving significantly
  const movingParts = identifyMovingParts(movements);

  // Calculate overall speed
  const speed = calculateOverallSpeed(movements);

  // Classify the motion type
  const type = classifyMotionType(movingParts, movements);

  // Determine intensity
  const intensity = classifyIntensity(speed, movingParts.length);

  // Generate description
  const description = generateMotionDescription(type, movingParts, intensity);

  return {
    type,
    intensity,
    movingParts,
    speed,
    description,
  };
}

/**
 * Quick motion classification from poses
 */
export function classifyMotion(poses: Pose[]): string {
  const analysis = analyzeMotionFromPoses(poses);
  return analysis.type;
}

// ============================================================================
// Movement Calculations
// ============================================================================

interface LandmarkMovement {
  index: number;
  name: string;
  averageDisplacement: number;
  maxDisplacement: number;
  directionChanges: number;
}

function calculateLandmarkMovements(poses: Pose[]): LandmarkMovement[] {
  const movements: LandmarkMovement[] = [];
  const landmarkNames = Object.entries(POSE_LANDMARKS);

  for (const [name, index] of landmarkNames) {
    let totalDisplacement = 0;
    let maxDisplacement = 0;
    let directionChanges = 0;
    let lastDx = 0;
    let lastDy = 0;

    for (let i = 1; i < poses.length; i++) {
      const prev = poses[i - 1].landmarks[index];
      const curr = poses[i].landmarks[index];

      if (!prev || !curr) continue;

      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const displacement = Math.sqrt(dx * dx + dy * dy);

      totalDisplacement += displacement;
      maxDisplacement = Math.max(maxDisplacement, displacement);

      // Check for direction changes (indicates oscillating motion)
      if (i > 1) {
        if ((dx > 0 && lastDx < 0) || (dx < 0 && lastDx > 0)) directionChanges++;
        if ((dy > 0 && lastDy < 0) || (dy < 0 && lastDy > 0)) directionChanges++;
      }

      lastDx = dx;
      lastDy = dy;
    }

    movements.push({
      index,
      name,
      averageDisplacement: totalDisplacement / (poses.length - 1),
      maxDisplacement,
      directionChanges,
    });
  }

  return movements;
}

function identifyMovingParts(movements: LandmarkMovement[]): string[] {
  const threshold = 0.02; // 2% of frame movement threshold
  const movingParts: string[] = [];

  // Group landmarks by body part
  const bodyParts: Record<string, number[]> = {
    head: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    left_arm: [11, 13, 15, 17, 19, 21],
    right_arm: [12, 14, 16, 18, 20, 22],
    torso: [11, 12, 23, 24],
    left_leg: [23, 25, 27, 29, 31],
    right_leg: [24, 26, 28, 30, 32],
  };

  for (const [part, indices] of Object.entries(bodyParts)) {
    const partMovements = movements.filter((m) => indices.includes(m.index));
    const avgMovement =
      partMovements.reduce((sum, m) => sum + m.averageDisplacement, 0) /
      partMovements.length;

    if (avgMovement > threshold) {
      movingParts.push(part);
    }
  }

  return movingParts;
}

function calculateOverallSpeed(movements: LandmarkMovement[]): number {
  const totalMovement = movements.reduce(
    (sum, m) => sum + m.averageDisplacement,
    0
  );
  return totalMovement / movements.length;
}

function classifyMotionType(
  movingParts: string[],
  movements: LandmarkMovement[]
): MotionAnalysis["type"] {
  // Check for dance (rhythmic movement with many direction changes)
  const totalDirectionChanges = movements.reduce(
    (sum, m) => sum + m.directionChanges,
    0
  );
  const isRhythmic = totalDirectionChanges > movements.length * 2;

  if (isRhythmic && movingParts.length >= 3) {
    return "dance";
  }

  // Check for walking (legs moving, forward motion)
  const legsMoving =
    movingParts.includes("left_leg") || movingParts.includes("right_leg");
  const armsStatic =
    !movingParts.includes("left_arm") && !movingParts.includes("right_arm");

  if (legsMoving && armsStatic) {
    return "walking";
  }

  // Check for gesture (arms moving, body static)
  const armsMoving =
    movingParts.includes("left_arm") || movingParts.includes("right_arm");
  const bodyStatic =
    !movingParts.includes("torso") &&
    !movingParts.includes("left_leg") &&
    !movingParts.includes("right_leg");

  if (armsMoving && bodyStatic) {
    return "gesture";
  }

  // Check for general movement
  if (movingParts.length > 0) {
    return "movement";
  }

  // Static or unknown
  return "static";
}

function classifyIntensity(
  speed: number,
  movingPartsCount: number
): MotionAnalysis["intensity"] {
  const combinedScore = speed * 100 + movingPartsCount * 0.5;

  if (combinedScore > 5) return "high";
  if (combinedScore > 2) return "medium";
  return "low";
}

function generateMotionDescription(
  type: MotionAnalysis["type"],
  movingParts: string[],
  intensity: MotionAnalysis["intensity"]
): string {
  const intensityWord =
    intensity === "high" ? "energetic" : intensity === "low" ? "subtle" : "";

  const partsStr = movingParts.join(", ").replace(/_/g, " ");

  switch (type) {
    case "dance":
      return `${intensityWord} dancing movement involving ${partsStr}`.trim();
    case "walking":
      return `${intensityWord} walking motion`.trim();
    case "gesture":
      return `${intensityWord} gesture with ${partsStr}`.trim();
    case "movement":
      return `${intensityWord} movement of ${partsStr}`.trim();
    case "static":
      return "static pose with minimal movement";
    default:
      return "unknown motion pattern";
  }
}

// ============================================================================
// Pose Comparison
// ============================================================================

/**
 * Compare two poses and calculate similarity score
 *
 * @param pose1 - First pose
 * @param pose2 - Second pose
 * @returns Similarity score (0-1, where 1 is identical)
 */
export function comparePoses(pose1: Pose, pose2: Pose): number {
  if (
    !pose1.landmarks ||
    !pose2.landmarks ||
    pose1.landmarks.length !== pose2.landmarks.length
  ) {
    return 0;
  }

  let totalDistance = 0;
  let validLandmarks = 0;

  for (let i = 0; i < pose1.landmarks.length; i++) {
    const l1 = pose1.landmarks[i];
    const l2 = pose2.landmarks[i];

    // Only compare landmarks with good visibility
    if (l1.visibility > 0.5 && l2.visibility > 0.5) {
      const dx = l1.x - l2.x;
      const dy = l1.y - l2.y;
      const dz = l1.z - l2.z;
      totalDistance += Math.sqrt(dx * dx + dy * dy + dz * dz);
      validLandmarks++;
    }
  }

  if (validLandmarks === 0) return 0;

  // Normalize: max possible distance per landmark is sqrt(3) ≈ 1.73
  const maxDistance = validLandmarks * 1.73;
  const avgDistance = totalDistance / validLandmarks;

  // Convert to similarity (0-1)
  return Math.max(0, 1 - avgDistance / 0.5);
}

/**
 * Find the most similar pose in a library
 */
export function findMostSimilarPose(
  targetPose: Pose,
  library: Pose[]
): { pose: Pose; similarity: number; index: number } | null {
  if (library.length === 0) return null;

  let bestMatch = { pose: library[0], similarity: 0, index: 0 };

  for (let i = 0; i < library.length; i++) {
    const similarity = comparePoses(targetPose, library[i]);
    if (similarity > bestMatch.similarity) {
      bestMatch = { pose: library[i], similarity, index: i };
    }
  }

  return bestMatch;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Convert data URL to canvas
 */
async function dataUrlToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Visualize pose on a canvas (for debugging)
 */
export function drawPoseOnCanvas(
  ctx: CanvasRenderingContext2D,
  pose: Pose,
  options?: {
    color?: string;
    lineWidth?: number;
    pointRadius?: number;
  }
): void {
  const { color = "#00ff00", lineWidth = 2, pointRadius = 4 } = options || {};

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  // Draw connections
  const connections = [
    // Face
    [0, 1], [1, 2], [2, 3], [3, 7],
    [0, 4], [4, 5], [5, 6], [6, 8],
    [9, 10],
    // Body
    [11, 12], [11, 23], [12, 24], [23, 24],
    // Left arm
    [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
    // Right arm
    [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
    // Left leg
    [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
    // Right leg
    [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],
  ];

  for (const [i, j] of connections) {
    const l1 = pose.landmarks[i];
    const l2 = pose.landmarks[j];
    if (l1.visibility > 0.5 && l2.visibility > 0.5) {
      ctx.beginPath();
      ctx.moveTo(l1.x * width, l1.y * height);
      ctx.lineTo(l2.x * width, l2.y * height);
      ctx.stroke();
    }
  }

  // Draw points
  for (const landmark of pose.landmarks) {
    if (landmark.visibility > 0.5) {
      ctx.beginPath();
      ctx.arc(
        landmark.x * width,
        landmark.y * height,
        pointRadius,
        0,
        2 * Math.PI
      );
      ctx.fill();
    }
  }
}

/**
 * Clean up MediaPipe resources
 */
export function disposePoseExtractor(): void {
  if (poseInstance) {
    poseInstance.close();
    poseInstance = null;
  }
  loadingPromise = null;
}
