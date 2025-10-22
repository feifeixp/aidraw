import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";

interface StoryboardFrameSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyFrameSize: (width: number, height: number) => void;
  currentFrameWidth: number;
  currentFrameHeight: number;
}

const RESOLUTION_PRESETS = {
  "1k": 1024,
  "2k": 2048,
  "4k": 4096,
};

const ASPECT_RATIOS = {
  "16:9": { width: 16, height: 9, label: "16:9 横屏" },
  "4:3": { width: 4, height: 3, label: "4:3 标准" },
  "1:1": { width: 1, height: 1, label: "1:1 方形" },
  "9:16": { width: 9, height: 16, label: "9:16 竖屏" },
  "21:9": { width: 21, height: 9, label: "21:9 超宽" },
};

export const StoryboardFrameSettings = ({
  open,
  onOpenChange,
  onApplyFrameSize,
  currentFrameWidth,
  currentFrameHeight,
}: StoryboardFrameSettingsProps) => {
  const [frameWidth, setFrameWidth] = useState(currentFrameWidth);
  const [frameHeight, setFrameHeight] = useState(currentFrameHeight);
  const [resolution, setResolution] = useState<"1k" | "2k" | "4k">("1k");
  const [aspectRatio, setAspectRatio] = useState<keyof typeof ASPECT_RATIOS>("16:9");

  const handleApplyFrameSize = () => {
    if (frameWidth < 50 || frameHeight < 50) {
      toast.error("分镜尺寸不能小于50px");
      return;
    }
    if (frameWidth > 4096 || frameHeight > 4096) {
      toast.error("分镜尺寸不能大于4096px");
      return;
    }
    onApplyFrameSize(frameWidth, frameHeight);
    toast.success("分镜尺寸已更新");
  };

  const calculateDimensions = () => {
    const baseSize = RESOLUTION_PRESETS[resolution];
    const ratio = ASPECT_RATIOS[aspectRatio];
    
    let width: number;
    let height: number;
    
    if (ratio.width >= ratio.height) {
      // 横向或方形
      width = baseSize;
      height = Math.round(baseSize * (ratio.height / ratio.width));
    } else {
      // 竖向
      height = baseSize;
      width = Math.round(baseSize * (ratio.width / ratio.height));
    }
    
    return { width, height };
  };

  const applyPresetSize = () => {
    const { width, height } = calculateDimensions();
    setFrameWidth(width);
    setFrameHeight(height);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>分镜尺寸设置</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* 精度选择 */}
          <div className="space-y-2">
            <Label>精度</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={resolution === "1k" ? "default" : "outline"}
                size="sm"
                onClick={() => setResolution("1k")}
                className="w-full"
              >
                1K
              </Button>
              <Button
                variant={resolution === "2k" ? "default" : "outline"}
                size="sm"
                onClick={() => setResolution("2k")}
                className="w-full"
              >
                2K
              </Button>
              <Button
                variant={resolution === "4k" ? "default" : "outline"}
                size="sm"
                onClick={() => setResolution("4k")}
                className="w-full"
              >
                4K
              </Button>
            </div>
          </div>

          {/* 宽高比选择 */}
          <div className="space-y-2">
            <Label>宽高比</Label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ASPECT_RATIOS).map(([key, value]) => (
                <Button
                  key={key}
                  variant={aspectRatio === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAspectRatio(key as keyof typeof ASPECT_RATIOS)}
                  className="w-full"
                >
                  {value.label}
                </Button>
              ))}
            </div>
          </div>

          {/* 预览和应用预设 */}
          <div className="space-y-2">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">
                预设尺寸：{calculateDimensions().width} × {calculateDimensions().height} px
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {resolution.toUpperCase()} 精度，{ASPECT_RATIOS[aspectRatio].label}
              </p>
            </div>
            <Button onClick={applyPresetSize} variant="outline" className="w-full">
              应用此预设
            </Button>
          </div>

          {/* 分隔线 */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">或自定义尺寸</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="frame-width">宽度 (px)</Label>
              <Input
                id="frame-width"
                type="number"
                value={frameWidth}
                onChange={(e) => setFrameWidth(Number(e.target.value))}
                min={50}
                max={4096}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="frame-height">高度 (px)</Label>
              <Input
                id="frame-height"
                type="number"
                value={frameHeight}
                onChange={(e) => setFrameHeight(Number(e.target.value))}
                min={50}
                max={4096}
              />
            </div>
          </div>

          <div className="text-sm text-muted-foreground space-y-1 pt-2">
            <p>• 精度越高，画面细节越丰富</p>
            <p>• 可使用预设或手动输入自定义尺寸</p>
            <p>• 当前分镜：{currentFrameWidth} × {currentFrameHeight} px</p>
          </div>

          <Button onClick={handleApplyFrameSize} className="w-full" size="lg">
            应用分镜尺寸
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
