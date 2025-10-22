import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

interface EditorInitialSetupProps {
  open: boolean;
  onComplete: (settings: {
    style: string;
    width: number;
    height: number;
  }) => void;
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

export const EditorInitialSetup = ({ open, onComplete }: EditorInitialSetupProps) => {
  const [style, setStyle] = useState("auto");
  const [resolution, setResolution] = useState<"1k" | "2k" | "4k">("1k");
  const [aspectRatio, setAspectRatio] = useState<keyof typeof ASPECT_RATIOS>("16:9");

  const calculateDimensions = () => {
    const baseSize = RESOLUTION_PRESETS[resolution];
    const ratio = ASPECT_RATIOS[aspectRatio];
    
    // 计算尺寸：基于长边为基准分辨率
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

  const handleComplete = () => {
    const { width, height } = calculateDimensions();
    onComplete({ style, width, height });
  };

  const { width, height } = calculateDimensions();

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>分镜编辑器初始化设置</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* 风格选择 */}
          <div className="space-y-2">
            <Label>默认生成风格</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger>
                <SelectValue placeholder="选择生成风格" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">自动风格（根据参考图）</SelectItem>
                <SelectItem value="blackWhiteSketch">黑白线稿</SelectItem>
                <SelectItem value="blackWhiteComic">黑白漫画</SelectItem>
                <SelectItem value="japaneseAnime">日式动漫</SelectItem>
                <SelectItem value="americanComic">美式漫画</SelectItem>
                <SelectItem value="watercolor">水彩画风</SelectItem>
                <SelectItem value="oilPainting">油画风格</SelectItem>
                <SelectItem value="pixelArt">像素艺术</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              此风格将作为智能多分镜生成的默认风格
            </p>
          </div>

          {/* 分镜尺寸 */}
          <div className="space-y-4">
            <Label>分镜尺寸</Label>
            
            {/* 精度选择 */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">精度</Label>
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
              <Label className="text-sm text-muted-foreground">宽高比</Label>
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

            {/* 预览当前尺寸 */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">
                当前尺寸预览：{width} × {height} px
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {resolution.toUpperCase()} 精度，{ASPECT_RATIOS[aspectRatio].label}
              </p>
            </div>
          </div>

          <div className="text-sm text-muted-foreground space-y-1 pt-2 border-t">
            <p>• 精度越高，画面细节越丰富，但生成时间更长</p>
            <p>• 可在后续编辑中随时调整分镜尺寸</p>
          </div>

          <Button onClick={handleComplete} className="w-full" size="lg">
            开始创作
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
