/**
 * Reel Templates
 *
 * Pre-built structures for common reel formats.
 * Each template is a VideoScript skeleton that can be filled with actual content.
 *
 * Usage:
 * ```typescript
 * import { REEL_TEMPLATES, fillTemplate } from '@/lib/ai-editor/templates';
 *
 * // Get a template
 * const template = REEL_TEMPLATES["hook-content-cta"];
 *
 * // Fill with content
 * const script = fillTemplate("hook-content-cta", {
 *   name: "Product Launch Reel",
 *   clips: [
 *     { text: "You need to see this!" },
 *     { mediaId: productDemo.id },
 *     { text: "Link in bio" }
 *   ],
 *   music: { generate: "upbeat tech, energetic, modern" }
 * });
 * ```
 */

import type { VideoScript, Clip, ClipContent } from "./script-types";

// ============================================================================
// Reel Templates
// ============================================================================

export const REEL_TEMPLATES: Record<string, Omit<VideoScript, "name">> = {
  /**
   * Hook-Content-CTA: Classic viral format
   * Hook them fast, deliver value, ask for action
   */
  "hook-content-cta": {
    canvas: "9:16",
    clips: [
      {
        duration: 3,
        text: { content: "", style: "title", position: "center" },
      },
      { duration: 12 },
      {
        duration: 3,
        text: { content: "", style: "title", position: "center" },
      },
    ],
  },

  /**
   * Before-After: Transformation content
   * Before state -> After state
   */
  "before-after": {
    canvas: "9:16",
    clips: [
      {
        duration: 2,
        text: { content: "Before", style: "subtitle", position: "top" },
      },
      { duration: 4 },
      {
        duration: 2,
        text: { content: "After", style: "subtitle", position: "top" },
      },
      { duration: 4 },
    ],
  },

  /**
   * Listicle-5: Quick list format
   * 5 rapid points with intro and CTA
   */
  "listicle-5": {
    canvas: "9:16",
    clips: [
      {
        duration: 2,
        text: { content: "", style: "title", position: "center" },
      },
      {
        duration: 2.5,
        text: { content: "1.", style: "subtitle", position: "bottom" },
      },
      {
        duration: 2.5,
        text: { content: "2.", style: "subtitle", position: "bottom" },
      },
      {
        duration: 2.5,
        text: { content: "3.", style: "subtitle", position: "bottom" },
      },
      {
        duration: 2.5,
        text: { content: "4.", style: "subtitle", position: "bottom" },
      },
      {
        duration: 2.5,
        text: { content: "5.", style: "subtitle", position: "bottom" },
      },
      {
        duration: 2,
        text: { content: "", style: "title", position: "center" },
      },
    ],
  },

  /**
   * Listicle-3: Shorter list format
   * 3 points with intro and CTA
   */
  "listicle-3": {
    canvas: "9:16",
    clips: [
      {
        duration: 2,
        text: { content: "", style: "title", position: "center" },
      },
      {
        duration: 3,
        text: { content: "1.", style: "subtitle", position: "bottom" },
      },
      {
        duration: 3,
        text: { content: "2.", style: "subtitle", position: "bottom" },
      },
      {
        duration: 3,
        text: { content: "3.", style: "subtitle", position: "bottom" },
      },
      {
        duration: 2,
        text: { content: "", style: "title", position: "center" },
      },
    ],
  },

  /**
   * Story Arc: Narrative structure
   * Setup -> Tension -> Resolution
   */
  "story-arc": {
    canvas: "9:16",
    clips: [
      { duration: 5 }, // Setup
      { duration: 8 }, // Tension
      { duration: 5 }, // Resolution
    ],
  },

  /**
   * Tutorial: Step-by-step guide
   * Problem -> Steps -> Result
   */
  tutorial: {
    canvas: "9:16",
    clips: [
      {
        duration: 3,
        text: { content: "", style: "title", position: "center" },
      },
      {
        duration: 4,
        text: { content: "Step 1", style: "subtitle", position: "top" },
      },
      {
        duration: 4,
        text: { content: "Step 2", style: "subtitle", position: "top" },
      },
      {
        duration: 4,
        text: { content: "Step 3", style: "subtitle", position: "top" },
      },
      {
        duration: 3,
        text: { content: "", style: "title", position: "center" },
      },
    ],
  },

  /**
   * Product Showcase: Feature highlights
   * Intro -> Features -> CTA
   */
  "product-showcase": {
    canvas: "9:16",
    clips: [
      {
        duration: 3,
        text: { content: "", style: "title", position: "center" },
      },
      {
        duration: 4,
        text: { content: "", style: "subtitle", position: "bottom" },
      },
      {
        duration: 4,
        text: { content: "", style: "subtitle", position: "bottom" },
      },
      {
        duration: 4,
        text: { content: "", style: "subtitle", position: "bottom" },
      },
      {
        duration: 3,
        text: { content: "", style: "title", position: "center" },
      },
    ],
  },

  /**
   * Quote/Testimonial: Single powerful statement
   */
  quote: {
    canvas: "9:16",
    clips: [
      {
        duration: 5,
        text: { content: "", style: "title", position: "center" },
      },
      {
        duration: 3,
        text: { content: "", style: "subtitle", position: "bottom" },
      },
    ],
  },

  /**
   * Announcement: Big reveal format
   * Teaser -> Reveal -> Details
   */
  announcement: {
    canvas: "9:16",
    clips: [
      {
        duration: 3,
        text: { content: "", style: "subtitle", position: "center" },
      },
      {
        duration: 4,
        text: { content: "", style: "title", position: "center" },
      },
      {
        duration: 5,
        text: { content: "", style: "subtitle", position: "bottom" },
      },
    ],
  },

  /**
   * Simple: Just media with optional text overlay
   */
  simple: {
    canvas: "9:16",
    clips: [{ duration: 15 }],
  },
};

// ============================================================================
// Template Utilities
// ============================================================================

/**
 * Get list of available template IDs
 */
export function getTemplateIds(): string[] {
  return Object.keys(REEL_TEMPLATES);
}

/**
 * Get a template by ID with metadata
 */
export function getTemplate(templateId: string): {
  id: string;
  template: Omit<VideoScript, "name">;
  clipCount: number;
  totalDuration: number;
} | null {
  const template = REEL_TEMPLATES[templateId];
  if (!template) return null;

  return {
    id: templateId,
    template,
    clipCount: template.clips.length,
    totalDuration: template.clips.reduce((sum, clip) => sum + clip.duration, 0),
  };
}

/**
 * Fill a template with actual content
 *
 * @param templateId - The template to use
 * @param content - The content to fill in
 * @returns A complete VideoScript ready for execution
 */
export function fillTemplate(
  templateId: keyof typeof REEL_TEMPLATES,
  content: {
    name: string;
    clips: ClipContent[];
    music?: { generate: string } | { mediaId: string };
    voiceover?: { text: string; voice?: string } | { mediaId: string };
  }
): VideoScript {
  const template = REEL_TEMPLATES[templateId];
  if (!template) {
    throw new Error(`Template '${templateId}' not found`);
  }

  // Merge template clips with provided content
  const filledClips: Clip[] = template.clips.map((templateClip, index) => {
    const contentClip = content.clips[index] || {};

    return {
      ...templateClip,
      media: contentClip.mediaId
        ? { id: contentClip.mediaId }
        : contentClip.generate
          ? { generate: contentClip.generate }
          : templateClip.media,
      text: contentClip.text
        ? {
            ...templateClip.text,
            content: contentClip.text,
          }
        : templateClip.text,
    };
  });

  // Build audio config
  const audio: VideoScript["audio"] = {};
  if (content.music) {
    if ("generate" in content.music) {
      audio.music = { generate: content.music.generate };
    } else {
      audio.music = { mediaId: content.music.mediaId };
    }
  }
  if (content.voiceover) {
    if ("text" in content.voiceover) {
      audio.voiceover = {
        text: content.voiceover.text,
        voice: content.voiceover.voice,
      };
    } else {
      audio.voiceover = { mediaId: content.voiceover.mediaId };
    }
  }

  return {
    name: content.name,
    canvas: template.canvas,
    clips: filledClips,
    audio: Object.keys(audio).length > 0 ? audio : undefined,
  };
}

/**
 * Calculate text style properties based on style preset
 */
export function getTextStyleProperties(
  style: "title" | "subtitle" | "caption"
): {
  fontSize: number;
  fontWeight: "normal" | "bold";
  color: string;
  backgroundColor: string;
} {
  switch (style) {
    case "title":
      return {
        fontSize: 72,
        fontWeight: "bold",
        color: "#FFFFFF",
        backgroundColor: "transparent",
      };
    case "subtitle":
      return {
        fontSize: 48,
        fontWeight: "bold",
        color: "#FFFFFF",
        backgroundColor: "rgba(0,0,0,0.5)",
      };
    case "caption":
      return {
        fontSize: 36,
        fontWeight: "normal",
        color: "#FFFFFF",
        backgroundColor: "rgba(0,0,0,0.7)",
      };
    default:
      return {
        fontSize: 48,
        fontWeight: "normal",
        color: "#FFFFFF",
        backgroundColor: "transparent",
      };
  }
}

/**
 * Calculate text Y position based on position preset
 */
export function getTextYPosition(
  position: "top" | "center" | "bottom",
  canvasHeight = 1920 // Default for 9:16 at 1080p
): number {
  switch (position) {
    case "top":
      return -canvasHeight * 0.35;
    case "center":
      return 0;
    case "bottom":
      return canvasHeight * 0.35;
    default:
      return 0;
  }
}
