"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PanelBaseView as BaseView } from "@/components/editor/panel-base-view";
import {
  PropertyItem,
  PropertyItemLabel,
  PropertyItemValue,
  PropertyGroup,
} from "../../properties-panel/property-item";
import { FPS_PRESETS } from "@/constants/timeline-constants";
import { useProjectStore } from "@/stores/project-store";
import type { BlurIntensity } from "@/types/project";
import { useEditorStore } from "@/stores/editor-store";
import { useAspectRatio } from "@/hooks/use-aspect-ratio";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { colors } from "@/data/colors/solid";
import { patternCraftGradients } from "@/data/colors/pattern-craft";
import { PipetteIcon, PlusIcon, EyeIcon, EyeOffIcon, CheckIcon, XIcon } from "lucide-react";
import { useMemo, memo, useCallback, useState } from "react";
import { syntaxUIGradients } from "@/data/colors/syntax-ui";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useAISettingsStore, AI_PROVIDERS } from "@/stores/ai-settings-store";

export function SettingsView() {
  return <ProjectSettingsTabs />;
}

function ProjectSettingsTabs() {
  return (
    <BaseView
      defaultTab="project-info"
      tabs={[
        {
          value: "project-info",
          label: "Project info",
          content: (
            <div className="p-5">
              <ProjectInfoView />
            </div>
          ),
        },
        {
          value: "background",
          label: "Background",
          content: (
            <div className="flex flex-col justify-between h-full">
              <div className="flex-1 p-5">
                <BackgroundView />
              </div>
              <div className="flex flex-col sticky -bottom-0 bg-panel/85 backdrop-blur-lg">
                <Separator />
                <Button className="w-fit h-auto p-5 py-4 !bg-transparent shadow-none text-muted-foreground hover:text-foreground/85 text-xs">
                  Custom background
                  <PlusIcon />
                </Button>
              </div>

              {/* Another UI, looks so beautiful i don't wanna remove it */}
              {/* <div className="flex flex-col justify-center items-center pb-5 sticky bottom-0">
                <Button className="w-fit h-auto gap-1.5 px-3.5 py-1.5 bg-foreground hover:bg-foreground/85 text-background rounded-full">
                  <span className="text-sm">Custom</span>
                  <PlusIcon className="" />
                </Button>
              </div> */}
            </div>
          ),
        },
        {
          value: "ai-settings",
          label: "AI Settings",
          content: (
            <div className="p-5 overflow-y-auto h-full">
              <AISettingsView />
            </div>
          ),
        },
      ]}
      className="flex flex-col justify-between h-full p-0"
    />
  );
}

function ProjectInfoView() {
  const { activeProject, updateProjectFps, updateCanvasSize } =
    useProjectStore();
  const { canvasPresets } = useEditorStore();
  const { getDisplayName } = useAspectRatio();

  const handleAspectRatioChange = (value: string) => {
    const preset = canvasPresets.find((p) => p.name === value);
    if (preset) {
      updateCanvasSize(
        { width: preset.width, height: preset.height },
        "preset"
      );
    }
  };

  const handleFpsChange = (value: string) => {
    const fps = parseFloat(value);
    updateProjectFps(fps);
  };

  return (
    <div className="flex flex-col gap-4">
      <PropertyItem direction="column">
        <PropertyItemLabel>Name</PropertyItemLabel>
        <PropertyItemValue>
          {activeProject?.name || "Untitled project"}
        </PropertyItemValue>
      </PropertyItem>

      <PropertyItem direction="column">
        <PropertyItemLabel>Aspect ratio</PropertyItemLabel>
        <PropertyItemValue>
          <Select
            value={getDisplayName()}
            onValueChange={handleAspectRatioChange}
          >
            <SelectTrigger className="bg-panel-accent">
              <SelectValue placeholder="Select an aspect ratio" />
            </SelectTrigger>
            <SelectContent>
              {canvasPresets.map((preset) => (
                <SelectItem key={preset.name} value={preset.name}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PropertyItemValue>
      </PropertyItem>

      <PropertyItem direction="column">
        <PropertyItemLabel>Frame rate</PropertyItemLabel>
        <PropertyItemValue>
          <Select
            value={(activeProject?.fps || 30).toString()}
            onValueChange={handleFpsChange}
          >
            <SelectTrigger className="bg-panel-accent">
              <SelectValue placeholder="Select a frame rate" />
            </SelectTrigger>
            <SelectContent>
              {FPS_PRESETS.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PropertyItemValue>
      </PropertyItem>
    </div>
  );
}

const BlurPreview = memo(
  ({
    blur,
    isSelected,
    onSelect,
  }: {
    blur: { label: string; value: number };
    isSelected: boolean;
    onSelect: () => void;
  }) => (
    <div
      className={cn(
        "w-full aspect-square rounded-sm cursor-pointer border border-foreground/15 hover:border-primary relative overflow-hidden",
        isSelected && "border-2 border-primary"
      )}
      onClick={onSelect}
    >
      <Image
        src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
        alt={`Blur preview ${blur.label}`}
        fill
        className="object-cover"
        style={{ filter: `blur(${blur.value}px)` }}
        loading="eager"
      />
      <div className="absolute bottom-1 left-1 right-1 text-center">
        <span className="text-xs text-white bg-black/50 px-1 rounded">
          {blur.label}
        </span>
      </div>
    </div>
  )
);

BlurPreview.displayName = "BlurPreview";

const BackgroundPreviews = memo(
  ({
    backgrounds,
    currentBackgroundColor,
    isColorBackground,
    handleColorSelect,
    useBackgroundColor = false,
  }: {
    backgrounds: string[];
    currentBackgroundColor: string;
    isColorBackground: boolean;
    handleColorSelect: (bg: string) => void;
    useBackgroundColor?: boolean;
  }) => {
    return useMemo(
      () =>
        backgrounds.map((bg, index) => (
          <div
            key={`${index}-${bg}`}
            className={cn(
              "w-full aspect-square rounded-sm cursor-pointer border border-foreground/15 hover:border-primary",
              isColorBackground &&
                bg === currentBackgroundColor &&
                "border-2 border-primary"
            )}
            style={
              useBackgroundColor
                ? { backgroundColor: bg }
                : {
                    background: bg,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }
            }
            onClick={() => handleColorSelect(bg)}
          />
        )),
      [
        backgrounds,
        isColorBackground,
        currentBackgroundColor,
        handleColorSelect,
        useBackgroundColor,
      ]
    );
  }
);

BackgroundPreviews.displayName = "BackgroundPreviews";

function BackgroundView() {
  const { activeProject, updateBackgroundType } = useProjectStore();

  const blurLevels = useMemo<Array<{ label: string; value: BlurIntensity }>>(
    () => [
      { label: "Light", value: 4 },
      { label: "Medium", value: 8 },
      { label: "Heavy", value: 18 },
    ],
    []
  );

  const handleBlurSelect = useCallback(
    async (blurIntensity: BlurIntensity) => {
      await updateBackgroundType("blur", { blurIntensity });
    },
    [updateBackgroundType]
  );

  const handleColorSelect = useCallback(
    async (color: string) => {
      await updateBackgroundType("color", { backgroundColor: color });
    },
    [updateBackgroundType]
  );

  const currentBlurIntensity = activeProject?.blurIntensity || 8;
  const isBlurBackground = activeProject?.backgroundType === "blur";
  const currentBackgroundColor = activeProject?.backgroundColor || "#000000";
  const isColorBackground = activeProject?.backgroundType === "color";

  const blurPreviews = useMemo(
    () =>
      blurLevels.map((blur) => (
        <BlurPreview
          key={blur.value}
          blur={blur}
          isSelected={isBlurBackground && currentBlurIntensity === blur.value}
          onSelect={() => handleBlurSelect(blur.value)}
        />
      )),
    [blurLevels, isBlurBackground, currentBlurIntensity, handleBlurSelect]
  );

  return (
    <div className="flex flex-col gap-4 h-full">
      <PropertyGroup title="Blur" defaultExpanded={false}>
        <div className="grid grid-cols-4 gap-2 w-full">{blurPreviews}</div>
      </PropertyGroup>

      <PropertyGroup title="Colors" defaultExpanded={false}>
        <div className="grid grid-cols-4 gap-2 w-full">
          <div className="w-full aspect-square rounded-sm cursor-pointer border border-foreground/15 hover:border-primary flex items-center justify-center">
            <PipetteIcon className="size-4" />
          </div>
          <BackgroundPreviews
            backgrounds={colors}
            currentBackgroundColor={currentBackgroundColor}
            isColorBackground={isColorBackground}
            handleColorSelect={handleColorSelect}
            useBackgroundColor={true}
          />
        </div>
      </PropertyGroup>

      <PropertyGroup title="Pattern craft" defaultExpanded={false}>
        <div className="grid grid-cols-4 gap-2 w-full">
          <BackgroundPreviews
            backgrounds={patternCraftGradients}
            currentBackgroundColor={currentBackgroundColor}
            isColorBackground={isColorBackground}
            handleColorSelect={handleColorSelect}
          />
        </div>
      </PropertyGroup>

      <PropertyGroup title="Syntax UI" defaultExpanded={false}>
        <div className="grid grid-cols-4 gap-2 w-full">
          <BackgroundPreviews
            backgrounds={syntaxUIGradients}
            currentBackgroundColor={currentBackgroundColor}
            isColorBackground={isColorBackground}
            handleColorSelect={handleColorSelect}
          />
        </div>
      </PropertyGroup>
    </div>
  );
}

// ============================================================================
// AI Settings View - Configure API keys for AI-powered editing
// ============================================================================

function APIKeyInput({
  provider,
  label,
  description,
}: {
  provider: string;
  label: string;
  description: string;
}) {
  const { getApiKey, setApiKey, removeApiKey, hasApiKey } = useAISettingsStore();
  const [showKey, setShowKey] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const isConfigured = hasApiKey(provider);
  const currentKey = getApiKey(provider) || "";

  const handleSave = () => {
    if (inputValue.trim()) {
      setApiKey(provider, inputValue.trim());
      setInputValue("");
      setIsEditing(false);
    }
  };

  const handleRemove = () => {
    removeApiKey(provider);
    setInputValue("");
    setIsEditing(false);
  };

  const handleCancel = () => {
    setInputValue("");
    setIsEditing(false);
  };

  const maskedKey = currentKey ? `${currentKey.substring(0, 8)}...${currentKey.substring(currentKey.length - 4)}` : "";

  return (
    <div className="flex flex-col gap-2 p-3 rounded-md bg-panel-accent/50 border border-foreground/10">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">{description}</span>
        </div>
        {isConfigured && !isEditing && (
          <CheckIcon className="size-4 text-green-500" />
        )}
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter API key..."
              className="pr-10 bg-panel text-sm"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} className="flex-1">
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : isConfigured ? (
        <div className="flex items-center gap-2">
          <code className="text-xs bg-panel px-2 py-1 rounded flex-1 text-muted-foreground">
            {showKey ? currentKey : maskedKey}
          </code>
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="text-muted-foreground hover:text-foreground"
          >
            {showKey ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </button>
          <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
            Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={handleRemove}>
            <XIcon className="size-3" />
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsEditing(true)}
          className="w-full"
        >
          <PlusIcon className="size-4 mr-1" />
          Add API Key
        </Button>
      )}
    </div>
  );
}

function AISettingsView() {
  const videoProviders = AI_PROVIDERS.filter((p) => p.category === "video");
  const musicProviders = AI_PROVIDERS.filter((p) => p.category === "music");
  const voiceProviders = AI_PROVIDERS.filter((p) => p.category === "voice");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 mb-2">
        <h3 className="text-sm font-medium">AI API Keys</h3>
        <p className="text-xs text-muted-foreground">
          Configure API keys for AI-powered video generation, music, and voiceovers.
          Keys are stored locally in your browser.
        </p>
      </div>

      <PropertyGroup title="Video Generation" defaultExpanded={true}>
        <div className="flex flex-col gap-3">
          {videoProviders.map((provider) => (
            <APIKeyInput
              key={provider.id}
              provider={provider.id}
              label={provider.name}
              description={provider.description}
            />
          ))}
        </div>
      </PropertyGroup>

      <PropertyGroup title="Music Generation" defaultExpanded={false}>
        <div className="flex flex-col gap-3">
          {musicProviders.map((provider) => (
            <APIKeyInput
              key={provider.id}
              provider={provider.id}
              label={provider.name}
              description={provider.description}
            />
          ))}
        </div>
      </PropertyGroup>

      <PropertyGroup title="Voice Generation" defaultExpanded={false}>
        <div className="flex flex-col gap-3">
          {voiceProviders.map((provider) => (
            <APIKeyInput
              key={provider.id}
              provider={provider.id}
              label={provider.name}
              description={provider.description}
            />
          ))}
        </div>
      </PropertyGroup>

      <Separator className="my-2" />

      <div className="flex flex-col gap-2 text-xs text-muted-foreground">
        <p>
          <strong>How it works:</strong> Claude Code can use these API keys to generate
          videos, music, and voiceovers for your project. Just ask Claude to create content!
        </p>
        <p>
          <strong>Example:</strong> &quot;Generate a 5-second video of a sunset over the ocean
          and add upbeat background music&quot;
        </p>
      </div>
    </div>
  );
}
