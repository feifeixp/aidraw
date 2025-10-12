import { useState } from "react";
import { Canvas as FabricCanvas, filters } from "fabric";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Palette, RotateCcw, Sun, Moon, Droplets, Cloud, CloudRain, CloudSnow, CloudFog, Sunrise, Sunset } from "lucide-react";
import { toast } from "sonner";

interface ColorAdjustmentPanelProps {
  canvas: FabricCanvas | null;
  selectedObject: any;
  saveState: () => void;
}

type ColorChannel = "all" | "red" | "green" | "blue";

export const ColorAdjustmentPanel = ({ canvas, selectedObject, saveState }: ColorAdjustmentPanelProps) => {
  const [channel, setChannel] = useState<ColorChannel>("all");
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [brightness, setBrightness] = useState(0);

  const applyFilters = (
    newChannel: ColorChannel = channel,
    newHue: number = hue,
    newSaturation: number = saturation,
    newBrightness: number = brightness
  ) => {
    if (!selectedObject || !canvas || selectedObject.type !== 'image') return;

    // Clear existing filters
    selectedObject.filters = [];

    if (newChannel === "all") {
      // Apply to all channels using standard filters
      if (newHue !== 0) {
        const hueRotation = new filters.HueRotation({
          rotation: newHue / 180
        });
        selectedObject.filters.push(hueRotation);
      }

      if (newSaturation !== 0) {
        const saturationFilter = new filters.Saturation({
          saturation: newSaturation / 100
        });
        selectedObject.filters.push(saturationFilter);
      }

      if (newBrightness !== 0) {
        const brightnessFilter = new filters.Brightness({
          brightness: newBrightness / 100
        });
        selectedObject.filters.push(brightnessFilter);
      }
    } else {
      // Apply to specific channel using ColorMatrix
      const matrix = [1, 0, 0, 0, 0,
                      0, 1, 0, 0, 0,
                      0, 0, 1, 0, 0,
                      0, 0, 0, 1, 0];
      
      const channelIndex = newChannel === "red" ? 0 : newChannel === "green" ? 1 : 2;
      
      // Apply brightness adjustment to specific channel
      if (newBrightness !== 0) {
        matrix[channelIndex * 5 + 4] = newBrightness / 100;
      }
      
      // Apply saturation-like adjustment (multiply channel)
      if (newSaturation !== 0) {
        matrix[channelIndex * 5 + channelIndex] = 1 + (newSaturation / 100);
      }
      
      // Apply hue rotation to specific channel
      if (newHue !== 0) {
        const hueAdjust = newHue / 360;
        matrix[channelIndex * 5 + channelIndex] += hueAdjust;
      }
      
      const colorMatrix = new filters.ColorMatrix({
        matrix: matrix
      });
      selectedObject.filters.push(colorMatrix);
    }

    selectedObject.applyFilters();
    canvas.renderAll();
    saveState();
  };

  const handleChannelChange = (value: ColorChannel) => {
    setChannel(value);
    applyFilters(value, hue, saturation, brightness);
  };

  const handleHueChange = (value: number[]) => {
    const newHue = value[0];
    setHue(newHue);
    applyFilters(channel, newHue, saturation, brightness);
  };

  const handleSaturationChange = (value: number[]) => {
    const newSaturation = value[0];
    setSaturation(newSaturation);
    applyFilters(channel, hue, newSaturation, brightness);
  };

  const handleBrightnessChange = (value: number[]) => {
    const newBrightness = value[0];
    setBrightness(newBrightness);
    applyFilters(channel, hue, saturation, newBrightness);
  };

  const handleReset = () => {
    setChannel("all");
    setHue(0);
    setSaturation(0);
    setBrightness(0);
    
    if (!selectedObject || !canvas) return;
    selectedObject.filters = [];
    selectedObject.applyFilters();
    canvas.renderAll();
    saveState();
    toast.success("颜色调整已重置");
  };

  // Environment preset configurations
  const applyPreset = (presetHue: number, presetSaturation: number, presetBrightness: number, presetName: string) => {
    setChannel("all");
    setHue(presetHue);
    setSaturation(presetSaturation);
    setBrightness(presetBrightness);
    applyFilters("all", presetHue, presetSaturation, presetBrightness);
    toast.success(`已应用${presetName}效果`);
  };

  const environmentPresets = [
    // Time of day
    { name: "白天", icon: Sun, hue: 0, saturation: 10, brightness: 20 },
    { name: "黎明", icon: Sunrise, hue: 20, saturation: 15, brightness: -10 },
    { name: "黄昏", icon: Sunset, hue: 30, saturation: 25, brightness: -15 },
    { name: "夜晚", icon: Moon, hue: -30, saturation: -20, brightness: -40 },
    
    // Weather conditions
    { name: "晴天", icon: Sun, hue: 5, saturation: 20, brightness: 25 },
    { name: "阴天", icon: Cloud, hue: 0, saturation: -30, brightness: -10 },
    { name: "雨天", icon: CloudRain, hue: -10, saturation: -20, brightness: -20 },
    { name: "雪天", icon: CloudSnow, hue: -20, saturation: -40, brightness: 15 },
    { name: "雾天", icon: CloudFog, hue: 0, saturation: -50, brightness: -5 },
    
    // Color tones
    { name: "暖色调", icon: Droplets, hue: 25, saturation: 30, brightness: 5 },
    { name: "冷色调", icon: Droplets, hue: -40, saturation: 20, brightness: -5 },
    
    // Atmosphere
    { name: "明亮", icon: Sun, hue: 0, saturation: 15, brightness: 35 },
    { name: "柔和", icon: Cloud, hue: 5, saturation: -10, brightness: 10 },
    { name: "鲜艳", icon: Palette, hue: 0, saturation: 50, brightness: 10 },
    { name: "复古", icon: Palette, hue: 25, saturation: -15, brightness: -10 },
  ];

  if (!selectedObject || selectedObject.type !== 'image') {
    return null;
  }

  return (
    <div className="border-t pt-3 mt-3">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5" />
          <h3 className="font-medium">色彩调整</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          title="重置所有调整"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      <Tabs defaultValue="manual" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual">手动调整</TabsTrigger>
          <TabsTrigger value="environment">环境氛围</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-4 mt-4">
          <div>
            <Label htmlFor="color-channel">颜色通道</Label>
            <Select value={channel} onValueChange={handleChannelChange}>
              <SelectTrigger id="color-channel" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部通道</SelectItem>
                <SelectItem value="red">红色 (R)</SelectItem>
                <SelectItem value="green">绿色 (G)</SelectItem>
                <SelectItem value="blue">蓝色 (B)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <Label htmlFor="hue-slider">色相偏移</Label>
              <span className="text-sm text-muted-foreground">{hue}°</span>
            </div>
            <Slider
              id="hue-slider"
              value={[hue]}
              onValueChange={handleHueChange}
              min={-180}
              max={180}
              step={1}
              className="mt-1"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <Label htmlFor="saturation-slider">饱和度</Label>
              <span className="text-sm text-muted-foreground">{saturation > 0 ? '+' : ''}{saturation}%</span>
            </div>
            <Slider
              id="saturation-slider"
              value={[saturation]}
              onValueChange={handleSaturationChange}
              min={-100}
              max={100}
              step={1}
              className="mt-1"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <Label htmlFor="brightness-slider">亮度</Label>
              <span className="text-sm text-muted-foreground">{brightness > 0 ? '+' : ''}{brightness}%</span>
            </div>
            <Slider
              id="brightness-slider"
              value={[brightness]}
              onValueChange={handleBrightnessChange}
              min={-100}
              max={100}
              step={1}
              className="mt-1"
            />
          </div>
        </TabsContent>

        <TabsContent value="environment" className="mt-4">
          <div className="space-y-4">
            <div>
              <Label className="mb-3 block">时间</Label>
              <div className="grid grid-cols-2 gap-2">
                {environmentPresets.slice(0, 4).map((preset) => (
                  <Button
                    key={preset.name}
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset.hue, preset.saturation, preset.brightness, preset.name)}
                    className="flex items-center justify-center gap-2"
                  >
                    <preset.icon className="w-4 h-4" />
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-3 block">天气</Label>
              <div className="grid grid-cols-2 gap-2">
                {environmentPresets.slice(4, 9).map((preset) => (
                  <Button
                    key={preset.name}
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset.hue, preset.saturation, preset.brightness, preset.name)}
                    className="flex items-center justify-center gap-2"
                  >
                    <preset.icon className="w-4 h-4" />
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-3 block">色调</Label>
              <div className="grid grid-cols-2 gap-2">
                {environmentPresets.slice(9, 11).map((preset) => (
                  <Button
                    key={preset.name}
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset.hue, preset.saturation, preset.brightness, preset.name)}
                    className="flex items-center justify-center gap-2"
                  >
                    <preset.icon className="w-4 h-4" />
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-3 block">氛围</Label>
              <div className="grid grid-cols-2 gap-2">
                {environmentPresets.slice(11).map((preset) => (
                  <Button
                    key={preset.name}
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset.hue, preset.saturation, preset.brightness, preset.name)}
                    className="flex items-center justify-center gap-2"
                  >
                    <preset.icon className="w-4 h-4" />
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
