import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useRef } from "react";
import { Upload, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { DraftsManagerDialog } from "./DraftsManagerDialog";
import { Separator } from "@/components/ui/separator";

interface EditorInitialSetupProps {
  open: boolean;
  onComplete: (settings: {
    style: string;
    width: number;
    height: number;
  }) => void;
  onImportJSON?: (jsonData: string) => void;
  onLoadDraft?: (draftId: string, draftData: string) => void;
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

export const EditorInitialSetup = ({ open, onComplete, onImportJSON, onLoadDraft }: EditorInitialSetupProps) => {
  const [style, setStyle] = useState("auto");
  const [resolution, setResolution] = useState<"1k" | "2k" | "4k">("1k");
  const [aspectRatio, setAspectRatio] = useState<keyof typeof ASPECT_RATIOS>("16:9");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImportJSON = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);
      
      if (onImportJSON) {
        onImportJSON(JSON.stringify(jsonData));
        toast.success('JSON 文件导入成功');
      }
    } catch (error) {
      console.error('导入JSON失败:', error);
      toast.error('导入失败：文件格式不正确');
    }
  };

  const handleLoadDraftWrapper = (draftId: string, draftData: string) => {
    if (onLoadDraft) {
      onLoadDraft(draftId, draftData);
    }
  };

  const { width, height } = calculateDimensions();

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>分镜编辑器初始化设置</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* 快速开始选项 */}
          <div className="space-y-3">
            <Label className="text-base">快速开始</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-20 flex flex-col gap-2"
                onClick={handleImportJSON}
              >
                <Upload className="h-5 w-5" />
                <span className="text-sm">导入 JSON</span>
              </Button>
              
              {onLoadDraft && (
                <DraftsManagerDialog 
                  onLoadDraft={handleLoadDraftWrapper}
                  customTrigger={
                    <Button
                      variant="outline"
                      className="h-20 flex flex-col gap-2"
                    >
                      <FolderOpen className="h-5 w-5" />
                      <span className="text-sm">打开草稿</span>
                    </Button>
                  }
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              从本地JSON文件或云端草稿恢复项目
            </p>
          </div>

          <Separator />

          {/* 新建项目 */}
          <div className="space-y-3">
            <Label className="text-base">新建项目</Label>
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
        </div>

        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </DialogContent>
    </Dialog>
  );
};
