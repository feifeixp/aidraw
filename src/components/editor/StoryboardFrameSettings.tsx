import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { toast } from "sonner";

interface StoryboardFrameSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyCanvasSize: (width: number, height: number) => void;
  currentCanvasWidth: number;
  currentCanvasHeight: number;
  onApplyFrameSize: (width: number, height: number) => void;
  currentFrameWidth: number;
  currentFrameHeight: number;
}

export const StoryboardFrameSettings = ({
  open,
  onOpenChange,
  onApplyCanvasSize,
  currentCanvasWidth,
  currentCanvasHeight,
  onApplyFrameSize,
  currentFrameWidth,
  currentFrameHeight,
}: StoryboardFrameSettingsProps) => {
  const [canvasWidth, setCanvasWidth] = useState(currentCanvasWidth);
  const [canvasHeight, setCanvasHeight] = useState(currentCanvasHeight);
  const [frameWidth, setFrameWidth] = useState(currentFrameWidth);
  const [frameHeight, setFrameHeight] = useState(currentFrameHeight);

  const handleApplyCanvasSize = () => {
    if (canvasWidth < 100 || canvasHeight < 100) {
      toast.error("画布尺寸不能小于100px");
      return;
    }
    if (canvasWidth > 4096 || canvasHeight > 4096) {
      toast.error("画布尺寸不能大于4096px");
      return;
    }
    onApplyCanvasSize(canvasWidth, canvasHeight);
    toast.success("画布尺寸已更新");
  };

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

  const setCanvasPreset = (width: number, height: number) => {
    setCanvasWidth(width);
    setCanvasHeight(height);
  };

  const setFramePreset = (width: number, height: number) => {
    setFrameWidth(width);
    setFrameHeight(height);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>分镜与画布设置</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="canvas" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="canvas">画布尺寸</TabsTrigger>
            <TabsTrigger value="frame">分镜尺寸</TabsTrigger>
          </TabsList>

          <TabsContent value="canvas" className="space-y-4">
            <div className="space-y-2">
              <Label>常用尺寸</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCanvasPreset(1920, 1080)}
                  className="w-full"
                >
                  1920×1080 (Full HD)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCanvasPreset(1280, 720)}
                  className="w-full"
                >
                  1280×720 (HD)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCanvasPreset(1024, 1024)}
                  className="w-full"
                >
                  1024×1024 (方形)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCanvasPreset(1080, 1920)}
                  className="w-full"
                >
                  1080×1920 (竖屏)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCanvasPreset(2560, 1440)}
                  className="w-full"
                >
                  2560×1440 (2K)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCanvasPreset(3840, 2160)}
                  className="w-full"
                >
                  3840×2160 (4K)
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="canvas-width">宽度 (px)</Label>
                <Input
                  id="canvas-width"
                  type="number"
                  value={canvasWidth}
                  onChange={(e) => setCanvasWidth(Number(e.target.value))}
                  min={100}
                  max={4096}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="canvas-height">高度 (px)</Label>
                <Input
                  id="canvas-height"
                  type="number"
                  value={canvasHeight}
                  onChange={(e) => setCanvasHeight(Number(e.target.value))}
                  min={100}
                  max={4096}
                />
              </div>
            </div>

            <Button onClick={handleApplyCanvasSize} className="w-full">
              应用画布尺寸
            </Button>
          </TabsContent>

          <TabsContent value="frame" className="space-y-4">
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
