/**
 * AI Settings Store
 *
 * Manages API keys and preferences for AI-powered video editing.
 * Keys are persisted to localStorage for convenience.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AIProvider {
  id: string;
  name: string;
  category: "video" | "music" | "voice" | "analysis";
  description: string;
  docsUrl?: string;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "fal",
    name: "FAL.ai",
    category: "video",
    description: "Access to Kling, SDXL, and other models via FAL platform",
    docsUrl: "https://fal.ai/docs",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    category: "video",
    description: "Veo 2 video generation and video analysis",
    docsUrl: "https://ai.google.dev/",
  },
  {
    id: "domo",
    name: "Domo AI",
    category: "video",
    description: "Character animation and motion generation from images",
    docsUrl: "https://www.domoai.app/",
  },
  {
    id: "kling",
    name: "Kling AI",
    category: "video",
    description: "High-quality AI video generation",
    docsUrl: "https://klingai.com/",
  },
  {
    id: "runway",
    name: "Runway",
    category: "video",
    description: "Gen-3 video generation",
    docsUrl: "https://runwayml.com/",
  },
  {
    id: "suno",
    name: "Suno",
    category: "music",
    description: "AI music generation with lyrics",
    docsUrl: "https://suno.com/",
  },
  {
    id: "openai",
    name: "OpenAI",
    category: "voice",
    description: "TTS voice generation",
    docsUrl: "https://platform.openai.com/",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    category: "voice",
    description: "Realistic voice cloning and generation",
    docsUrl: "https://elevenlabs.io/",
  },
];

interface AISettingsState {
  // API Keys
  apiKeys: Record<string, string>;

  // Preferred providers
  preferredVideoProvider: string;
  preferredMusicProvider: string;
  preferredVoiceProvider: string;

  // Actions
  setApiKey: (provider: string, key: string) => void;
  getApiKey: (provider: string) => string | undefined;
  hasApiKey: (provider: string) => boolean;
  removeApiKey: (provider: string) => void;
  clearAllKeys: () => void;

  setPreferredProvider: (category: "video" | "music" | "voice", provider: string) => void;

  // Get configured providers
  getConfiguredProviders: () => AIProvider[];
}

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set, get) => ({
      apiKeys: {},
      preferredVideoProvider: "fal",
      preferredMusicProvider: "fal",
      preferredVoiceProvider: "openai",

      setApiKey: (provider: string, key: string) => {
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: key },
        }));
      },

      getApiKey: (provider: string) => {
        return get().apiKeys[provider];
      },

      hasApiKey: (provider: string) => {
        const key = get().apiKeys[provider];
        return Boolean(key?.trim());
      },

      removeApiKey: (provider: string) => {
        set((state) => {
          const newKeys = { ...state.apiKeys };
          delete newKeys[provider];
          return { apiKeys: newKeys };
        });
      },

      clearAllKeys: () => {
        set({ apiKeys: {} });
      },

      setPreferredProvider: (category, provider) => {
        switch (category) {
          case "video":
            set({ preferredVideoProvider: provider });
            break;
          case "music":
            set({ preferredMusicProvider: provider });
            break;
          case "voice":
            set({ preferredVoiceProvider: provider });
            break;
        }
      },

      getConfiguredProviders: () => {
        const { apiKeys } = get();
        return AI_PROVIDERS.filter((p) => Boolean(apiKeys[p.id]?.trim()));
      },
    }),
    {
      name: "opencut-ai-settings",
    }
  )
);
