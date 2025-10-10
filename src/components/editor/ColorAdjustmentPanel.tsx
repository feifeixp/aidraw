import { useState } from "react";
import { Canvas as FabricCanvas, filters } from "fabric";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Palette, RotateCcw } from "lucide-react";
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

    // Apply hue rotation (color shift)
    if (newHue !== 0) {
      const hueRotation = new filters.HueRotation({
        rotation: newHue / 180 // Convert to radians-like value
      });
      selectedObject.filters.push(hueRotation);
    }

    // Apply saturation
    if (newSaturation !== 0) {
      const saturationFilter = new filters.Saturation({
        saturation: newSaturation / 100 // -1 to 1 range
      });
      selectedObject.filters.push(saturationFilter);
    }

    // Apply brightness
    if (newBrightness !== 0) {
      const brightnessFilter = new filters.Brightness({
        brightness: newBrightness / 100 // -1 to 1 range
      });
      selectedObject.filters.push(brightnessFilter);
    }

    // Note: Channel selection is for future enhancements
    // Currently, adjustments apply to all channels regardless of selection

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

  if (!selectedObject || selectedObject.type !== 'image') {
    return null;
  }

  return (
    <div className="border-t pt-3 mt-3">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5" />
          <h3 className="font-medium">颜色调整</h3>
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

      <div className="space-y-4">
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
      </div>
    </div>
  );
};
