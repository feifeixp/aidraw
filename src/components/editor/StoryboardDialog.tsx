import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

interface StoryboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (type: string, customPrompt?: string) => Promise<void>;
  isGenerating: boolean;
}

const storyboardTypes = [
  {
    id: "close-up",
    name: "特写镜头",
    description: "聚焦角色面部表情或物体细节",
    prompt: "Close-up shot composition, simple abstract wireframe sketch, minimalist geometric shapes representing facial features, basic line art, composition guide only"
  },
  {
    id: "medium-shot",
    name: "中景镜头",
    description: "展示角色上半身，适合对话场景",
    prompt: "Medium shot composition, simple abstract wireframe sketch, minimalist stick figure from waist up, basic geometric shapes, composition guide only"
  },
  {
    id: "full-shot",
    name: "全景镜头",
    description: "展示角色全身及周围环境",
    prompt: "Full shot composition, simple abstract wireframe sketch, minimalist stick figure full body, basic geometric environment shapes, composition guide only"
  },
  {
    id: "long-shot",
    name: "远景镜头",
    description: "广阔的场景，角色较小",
    prompt: "Long shot composition, simple abstract wireframe sketch, tiny minimalist figure in wide space, basic geometric environment, composition guide only"
  },
  {
    id: "over-shoulder",
    name: "过肩镜头",
    description: "从一个角色肩膀后方拍摄另一角色",
    prompt: "Over-the-shoulder shot composition, simple abstract wireframe sketch, minimalist geometric shapes for shoulder and subject, basic line art, composition guide only"
  },
  {
    id: "high-angle",
    name: "俯视镜头",
    description: "从上方向下拍摄，营造弱势感",
    prompt: "High angle shot composition, simple abstract wireframe sketch from above, minimalist stick figure looking down, basic geometric shapes, composition guide only"
  },
  {
    id: "low-angle",
    name: "仰视镜头",
    description: "从下方向上拍摄，展现力量感",
    prompt: "Low angle shot composition, simple abstract wireframe sketch from below, minimalist stick figure looking up, basic geometric shapes, composition guide only"
  },
  {
    id: "birds-eye",
    name: "鸟瞰镜头",
    description: "完全垂直向下的顶视图",
    prompt: "Bird's eye view composition, simple abstract wireframe sketch directly overhead, minimalist top-down geometric shapes, basic line art, composition guide only"
  },
  {
    id: "eye-level",
    name: "平视镜头",
    description: "与角色视线平齐，自然视角",
    prompt: "Eye level shot composition, simple abstract wireframe sketch at neutral height, minimalist stick figure front view, basic geometric shapes, composition guide only"
  },
  {
    id: "dutch-angle",
    name: "荷兰角度",
    description: "倾斜的相机角度，营造不安感",
    prompt: "Dutch angle shot composition, simple abstract wireframe sketch with tilted frame, minimalist geometric shapes at angle, basic line art, composition guide only"
  },
  {
    id: "two-shot",
    name: "双人镜头",
    description: "同时展示两个角色的互动",
    prompt: "Two shot composition, simple abstract wireframe sketch with two figures, minimalist stick figures interacting, basic geometric shapes, composition guide only"
  },
  {
    id: "group-shot",
    name: "群体镜头",
    description: "多个角色的群组画面",
    prompt: "Group shot composition, simple abstract wireframe sketch with multiple figures, minimalist stick figures arranged together, basic geometric shapes, composition guide only"
  },
  {
    id: "tracking-shot",
    name: "移动镜头",
    description: "跟随移动主体的动态镜头",
    prompt: "Tracking shot composition, simple abstract wireframe sketch showing motion, minimalist stick figure with arrow lines indicating movement, basic geometric shapes, composition guide only"
  },
  {
    id: "follow-shot",
    name: "追随镜头",
    description: "跟随角色移动的镜头",
    prompt: "Follow shot composition, simple abstract wireframe sketch with movement sense, minimalist stick figure in motion path, basic geometric shapes, composition guide only"
  },
  {
    id: "symmetrical",
    name: "对称构图",
    description: "画面左右对称的构图方式",
    prompt: "Symmetrical composition, simple abstract wireframe sketch with mirror balance, minimalist geometric shapes centered and balanced, basic line art, composition guide only"
  },
  {
    id: "rule-of-thirds",
    name: "三分法构图",
    description: "将画面分为九宫格的经典构图",
    prompt: "Rule of thirds composition, simple abstract wireframe sketch with grid guides, minimalist geometric shapes at intersection points, basic line art, composition guide only"
  }
];

export const StoryboardDialog = ({
  open,
  onOpenChange,
  onGenerate,
  isGenerating
}: StoryboardDialogProps) => {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");

  const handleGenerate = async () => {
    if (selectedType) {
      const type = storyboardTypes.find(t => t.id === selectedType);
      if (type) {
        await onGenerate(type.prompt, customPrompt);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>分镜构图生成器</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="presets" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="presets">预设分镜</TabsTrigger>
            <TabsTrigger value="custom">自定义</TabsTrigger>
          </TabsList>
          
          <TabsContent value="presets" className="mt-4">
            <ScrollArea className="h-[500px] pr-4">
              <div className="grid grid-cols-2 gap-4">
                {storyboardTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`p-4 border rounded-lg text-left transition-all hover:border-primary ${
                      selectedType === type.id
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <h3 className="font-medium mb-1">{type.name}</h3>
                    <p className="text-sm text-muted-foreground">{type.description}</p>
                  </button>
                ))}
              </div>
            </ScrollArea>
            
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="additional-prompt">补充描述（可选）</Label>
                <Textarea
                  id="additional-prompt"
                  placeholder="添加更多细节描述，例如：角色动作、情绪、场景氛围等..."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={3}
                />
              </div>
              
              <Button
                onClick={handleGenerate}
                disabled={!selectedType || isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  "生成草图"
                )}
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="custom" className="mt-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="custom-prompt">自定义分镜描述</Label>
                <Textarea
                  id="custom-prompt"
                  placeholder="详细描述您想要的分镜构图，包括：镜头角度、构图方式、角色位置、场景元素等..."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={10}
                  className="resize-none"
                />
              </div>
              
              <Button
                onClick={() => onGenerate(customPrompt)}
                disabled={!customPrompt.trim() || isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  "生成草图"
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
