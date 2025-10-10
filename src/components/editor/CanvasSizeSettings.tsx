import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Maximize2 } from "lucide-react";

interface CanvasSizeSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (width: number, height: number) => void;
  currentWidth: number;
  currentHeight: number;
}

const ASPECT_RATIOS = [
  { label: "1:1", ratio: 1 / 1 },
  { label: "2:3", ratio: 2 / 3 },
  { label: "3:2", ratio: 3 / 2 },
  { label: "3:4", ratio: 3 / 4 },
  { label: "4:3", ratio: 4 / 3 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "9:16", ratio: 9 / 16 },
];

const RESOLUTIONS = [
  { label: "720p", width: 1280, height: 720 },
  { label: "1080p", width: 1920, height: 1080 },
];

export const CanvasSizeSettings = ({
  open,
  onOpenChange,
  onApply,
  currentWidth,
  currentHeight,
}: CanvasSizeSettingsProps) => {
  const [selectedRatio, setSelectedRatio] = useState<number | null>(null);
  const [selectedResolution, setSelectedResolution] = useState<{ width: number; height: number } | null>(null);
  const [customWidth, setCustomWidth] = useState(currentWidth.toString());
  const [customHeight, setCustomHeight] = useState(currentHeight.toString());

  const handleRatioSelect = (ratio: number, label: string) => {
    setSelectedRatio(ratio);
    setSelectedResolution(null);
    
    // Calculate dimensions based on selected resolution or current canvas
    const baseResolution = selectedResolution || { width: currentWidth, height: currentHeight };
    
    let width: number, height: number;
    if (ratio > 1) {
      // Landscape
      height = Math.round(Math.sqrt((baseResolution.width * baseResolution.height) / ratio));
      width = Math.round(height * ratio);
    } else {
      // Portrait or square
      width = Math.round(Math.sqrt((baseResolution.width * baseResolution.height) * ratio));
      height = Math.round(width / ratio);
    }
    
    setCustomWidth(width.toString());
    setCustomHeight(height.toString());
  };

  const handleResolutionSelect = (resolution: { width: number; height: number }) => {
    setSelectedResolution(resolution);
    
    if (selectedRatio) {
      // Apply ratio to the selected resolution
      let width: number, height: number;
      if (selectedRatio > 1) {
        // Landscape
        height = Math.round(Math.sqrt((resolution.width * resolution.height) / selectedRatio));
        width = Math.round(height * selectedRatio);
      } else {
        // Portrait or square
        width = Math.round(Math.sqrt((resolution.width * resolution.height) * selectedRatio));
        height = Math.round(width / selectedRatio);
      }
      setCustomWidth(width.toString());
      setCustomHeight(height.toString());
    } else {
      setCustomWidth(resolution.width.toString());
      setCustomHeight(resolution.height.toString());
    }
  };

  const handleApply = () => {
    const width = parseInt(customWidth);
    const height = parseInt(customHeight);
    
    if (isNaN(width) || isNaN(height) || width < 256 || height < 256 || width > 4096 || height > 4096) {
      alert("请输入有效的尺寸（256-4096像素）");
      return;
    }
    
    onApply(width, height);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Maximize2 className="h-5 w-5" />
            画布尺寸设置
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="ratio" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ratio">宽高比</TabsTrigger>
            <TabsTrigger value="resolution">精度</TabsTrigger>
            <TabsTrigger value="custom">自定义</TabsTrigger>
          </TabsList>

          <TabsContent value="ratio" className="space-y-4">
            <div className="space-y-2">
              <Label>选择宽高比</Label>
              <div className="grid grid-cols-4 gap-2">
                {ASPECT_RATIOS.map((item) => (
                  <Button
                    key={item.label}
                    variant={selectedRatio === item.ratio ? "default" : "outline"}
                    onClick={() => handleRatioSelect(item.ratio, item.label)}
                    className="w-full"
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            {selectedRatio && (
              <div className="space-y-2">
                <Label>精度调整（可选）</Label>
                <div className="grid grid-cols-2 gap-2">
                  {RESOLUTIONS.map((res) => (
                    <Button
                      key={res.label}
                      variant={selectedResolution?.width === res.width ? "default" : "outline"}
                      onClick={() => handleResolutionSelect(res)}
                      className="w-full"
                    >
                      {res.label} ({res.width}×{res.height})
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>预览尺寸</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(e.target.value)}
                  placeholder="宽度"
                />
                <span className="text-muted-foreground">×</span>
                <Input
                  type="number"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(e.target.value)}
                  placeholder="高度"
                />
                <span className="text-sm text-muted-foreground">像素</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="resolution" className="space-y-4">
            <div className="space-y-2">
              <Label>选择精度</Label>
              <div className="grid grid-cols-2 gap-2">
                {RESOLUTIONS.map((res) => (
                  <Button
                    key={res.label}
                    variant={selectedResolution?.width === res.width ? "default" : "outline"}
                    onClick={() => handleResolutionSelect(res)}
                    className="w-full"
                  >
                    {res.label} ({res.width}×{res.height})
                  </Button>
                ))}
              </div>
            </div>

            {selectedResolution && (
              <div className="space-y-2">
                <Label>应用宽高比（可选）</Label>
                <div className="grid grid-cols-4 gap-2">
                  {ASPECT_RATIOS.map((item) => (
                    <Button
                      key={item.label}
                      variant={selectedRatio === item.ratio ? "default" : "outline"}
                      onClick={() => handleRatioSelect(item.ratio, item.label)}
                      className="w-full"
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>预览尺寸</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(e.target.value)}
                  placeholder="宽度"
                />
                <span className="text-muted-foreground">×</span>
                <Input
                  type="number"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(e.target.value)}
                  placeholder="高度"
                />
                <span className="text-sm text-muted-foreground">像素</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="custom" className="space-y-4">
            <div className="space-y-2">
              <Label>自定义尺寸</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 space-y-1">
                  <Input
                    type="number"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(e.target.value)}
                    placeholder="宽度"
                    min="256"
                    max="4096"
                  />
                  <p className="text-xs text-muted-foreground">256-4096像素</p>
                </div>
                <span className="text-muted-foreground">×</span>
                <div className="flex-1 space-y-1">
                  <Input
                    type="number"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(e.target.value)}
                    placeholder="高度"
                    min="256"
                    max="4096"
                  />
                  <p className="text-xs text-muted-foreground">256-4096像素</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>快速比例</Label>
              <div className="grid grid-cols-4 gap-2">
                {ASPECT_RATIOS.map((item) => (
                  <Button
                    key={item.label}
                    variant="outline"
                    onClick={() => handleRatioSelect(item.ratio, item.label)}
                    className="w-full"
                    size="sm"
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            当前: {currentWidth} × {currentHeight}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleApply}>
              应用
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
