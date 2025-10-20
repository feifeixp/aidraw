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

export const StoryboardFrameSettings = ({
  open,
  onOpenChange,
  onApplyFrameSize,
  currentFrameWidth,
  currentFrameHeight,
}: StoryboardFrameSettingsProps) => {
  const [frameWidth, setFrameWidth] = useState(currentFrameWidth);
  const [frameHeight, setFrameHeight] = useState(currentFrameHeight);

  const handleApplyFrameSize = () => {
    if (frameWidth < 50 || frameHeight < 50) {
      toast.error("分镜尺寸不能小于50px");
      return;
    }
    if (frameWidth > 2048 || frameHeight > 2048) {
      toast.error("分镜尺寸不能大于2048px");
      return;
    }
    onApplyFrameSize(frameWidth, frameHeight);
    toast.success("分镜尺寸已更新");
  };

  const setFramePreset = (width: number, height: number) => {
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
          <div className="space-y-2">
            <Label>常用分镜尺寸</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFramePreset(512, 288)}
                className="w-full"
              >
                512×288 (16:9)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFramePreset(640, 360)}
                className="w-full"
              >
                640×360 (16:9)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFramePreset(768, 432)}
                className="w-full"
              >
                768×432 (16:9)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFramePreset(400, 400)}
                className="w-full"
              >
                400×400 (方形)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFramePreset(360, 640)}
                className="w-full"
              >
                360×640 (竖屏)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFramePreset(1024, 576)}
                className="w-full"
              >
                1024×576 (16:9)
              </Button>
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
                max={2048}
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
                max={2048}
              />
            </div>
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <p>• 分镜尺寸决定每个分镜框的大小</p>
            <p>• 较小的尺寸适合预览和规划</p>
            <p>• 较大的尺寸适合详细绘制</p>
          </div>

          <Button onClick={handleApplyFrameSize} className="w-full">
            应用分镜尺寸
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
