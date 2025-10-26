import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wand2, Eraser, Sparkles, Image } from "lucide-react";

interface FeaturesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Feature {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  videoUrl?: string;
}

const features: Feature[] = [
  {
    id: "ai-operations",
    title: "元素的AI智能操作",
    description: "可以编辑角色动作、场景元素可以快捷视角和环境",
    icon: Wand2,
    videoUrl: "", // 待填充
  },
  {
    id: "pixel-editor",
    title: "像素编辑器",
    description: "可以通过AI智能提取方便提取图片中的元素",
    icon: Eraser,
    videoUrl: "", // 待填充
  },
  {
    id: "smart-synthesis",
    title: "智能合成",
    description: "可以通过文本和标记对图片做复杂的调整",
    icon: Sparkles,
    videoUrl: "", // 待填充
  },
  {
    id: "render-export",
    title: "渲染导出",
    description: "最终合成的图片可以通过渲染优化图片，重新渲染光照和阴影",
    icon: Image,
    videoUrl: "", // 待填充
  },
];

export const FeaturesDialog = ({ open, onOpenChange }: FeaturesDialogProps) => {
  const [activeTab, setActiveTab] = useState(features[0].id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">特色功能介绍</DialogTitle>
          <DialogDescription>
            探索Neo-Domain强大的AI图像编辑功能
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <TabsTrigger
                  key={feature.id}
                  value={feature.id}
                  className="flex items-center gap-2"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{feature.title}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <TabsContent
                key={feature.id}
                value={feature.id}
                className="space-y-4 mt-6"
              >
                <div className="flex items-start gap-3">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{feature.title}</h3>
                    <p className="text-muted-foreground mt-1">
                      {feature.description}
                    </p>
                  </div>
                </div>

                {/* 视频播放区域 */}
                <div className="aspect-video rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden">
                  {feature.videoUrl ? (
                    <video
                      src={feature.videoUrl}
                      controls
                      className="w-full h-full object-contain"
                    >
                      您的浏览器不支持视频播放
                    </video>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <Icon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>演示视频即将上线</p>
                    </div>
                  )}
                </div>

                {/* 功能详细说明 */}
                <div className="space-y-2 text-sm">
                  <h4 className="font-medium">功能特点：</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {feature.id === "ai-operations" && (
                      <>
                        <li>智能识别图像中的角色和元素</li>
                        <li>通过AI指令编辑角色动作和姿态</li>
                        <li>快速调整场景视角和环境氛围</li>
                        <li>支持自然语言描述进行精准编辑</li>
                      </>
                    )}
                    {feature.id === "pixel-editor" && (
                      <>
                        <li>AI驱动的智能选区和抠图</li>
                        <li>精确的像素级编辑工具</li>
                        <li>自动边缘检测和优化</li>
                        <li>支持魔棒和智能提取功能</li>
                      </>
                    )}
                    {feature.id === "smart-synthesis" && (
                      <>
                        <li>基于文本描述的图像编辑</li>
                        <li>标记区域进行局部调整</li>
                        <li>智能融合多个元素</li>
                        <li>保持画面整体和谐统一</li>
                      </>
                    )}
                    {feature.id === "render-export" && (
                      <>
                        <li>AI优化最终图像质量</li>
                        <li>智能重新渲染光照效果</li>
                        <li>自动调整阴影和高光</li>
                        <li>支持多种导出格式和分辨率</li>
                      </>
                    )}
                  </ul>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
