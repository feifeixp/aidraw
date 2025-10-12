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
    prompt: "Close-up shot composition, focus on facial details and emotions, dramatic lighting, sketch style line art"
  },
  {
    id: "medium-shot",
    name: "中景镜头",
    description: "展示角色上半身，适合对话场景",
    prompt: "Medium shot composition, character from waist up, balanced framing, sketch style line art"
  },
  {
    id: "full-shot",
    name: "全景镜头",
    description: "展示角色全身及周围环境",
    prompt: "Full shot composition, complete character body visible, environment context, sketch style line art"
  },
  {
    id: "long-shot",
    name: "远景镜头",
    description: "广阔的场景，角色较小",
    prompt: "Long shot composition, wide view of scene, character in environment, sketch style line art"
  },
  {
    id: "over-shoulder",
    name: "过肩镜头",
    description: "从一个角色肩膀后方拍摄另一角色",
    prompt: "Over-the-shoulder shot composition, foreground character shoulder and back, facing subject, sketch style line art"
  },
  {
    id: "high-angle",
    name: "俯视镜头",
    description: "从上方向下拍摄，营造弱势感",
    prompt: "High angle shot composition, camera looking down at subject, creates vulnerability, sketch style line art"
  },
  {
    id: "low-angle",
    name: "仰视镜头",
    description: "从下方向上拍摄，展现力量感",
    prompt: "Low angle shot composition, camera looking up at subject, creates power and dominance, sketch style line art"
  },
  {
    id: "birds-eye",
    name: "鸟瞰镜头",
    description: "完全垂直向下的顶视图",
    prompt: "Bird's eye view composition, directly overhead shot, top-down perspective, sketch style line art"
  },
  {
    id: "eye-level",
    name: "平视镜头",
    description: "与角色视线平齐，自然视角",
    prompt: "Eye level shot composition, neutral camera height, natural perspective, sketch style line art"
  },
  {
    id: "dutch-angle",
    name: "荷兰角度",
    description: "倾斜的相机角度，营造不安感",
    prompt: "Dutch angle shot composition, tilted camera angle, creates tension and unease, sketch style line art"
  },
  {
    id: "two-shot",
    name: "双人镜头",
    description: "同时展示两个角色的互动",
    prompt: "Two shot composition, two characters in frame, interaction and relationship, sketch style line art"
  },
  {
    id: "group-shot",
    name: "群体镜头",
    description: "多个角色的群组画面",
    prompt: "Group shot composition, multiple characters arranged in frame, ensemble scene, sketch style line art"
  },
  {
    id: "tracking-shot",
    name: "移动镜头",
    description: "跟随移动主体的动态镜头",
    prompt: "Tracking shot composition, dynamic movement, following subject motion, sketch style line art with motion lines"
  },
  {
    id: "follow-shot",
    name: "追随镜头",
    description: "跟随角色移动的镜头",
    prompt: "Follow shot composition, camera moving with character, sense of journey, sketch style line art"
  },
  {
    id: "symmetrical",
    name: "对称构图",
    description: "画面左右对称的构图方式",
    prompt: "Symmetrical composition, balanced left and right elements, centered subject, sketch style line art"
  },
  {
    id: "rule-of-thirds",
    name: "三分法构图",
    description: "将画面分为九宫格的经典构图",
    prompt: "Rule of thirds composition, subject positioned at intersection points, balanced negative space, sketch style line art"
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
