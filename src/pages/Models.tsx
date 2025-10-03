import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Save, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface ModelFormData {
  model_id: string;
  name: string;
  description: string;
  tags: string;
  features: string;
  thumbnail_url: string;
  model_url: string;
  checkpoint_id: string;
  lora_version_id: string;
  sampler: string;
  cfg_scale: string;
  randn_source: string;
  lora_weight: string;
  base_algo: string;
}

const Models = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<any>(null);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [isCheckpoint, setIsCheckpoint] = useState(false);
  const [formData, setFormData] = useState<ModelFormData>({
    model_id: "",
    name: "",
    description: "",
    tags: "",
    features: "",
    thumbnail_url: "",
    model_url: "",
    checkpoint_id: "",
    lora_version_id: "",
    sampler: "15",
    cfg_scale: "7",
    randn_source: "0",
    lora_weight: "0.8",
    base_algo: "1",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: models, isLoading } = useQuery({
    queryKey: ["liblib-models"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("liblib_models")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const parseModelUrl = async (url: string) => {
    if (isAutoFilling) {
      console.log("Already fetching model info, ignoring click");
      return;
    }

    try {
      const urlObj = new URL(url);
      const versionUuid = urlObj.searchParams.get('versionUuid') || '';
      
      if (!versionUuid) {
        toast({
          title: "URL解析失败",
          description: "URL中没有找到versionUuid参数",
          variant: "destructive",
        });
        return;
      }

      setIsAutoFilling(true);
      
      toast({
        title: "正在获取模型信息...",
        description: "请稍候，这可能需要几秒钟",
      });

      console.log("Fetching model info for versionUuid:", versionUuid);

      const { data, error } = await supabase.functions.invoke("liblib-model-info", {
        body: { versionUuid },
      });

      console.log("Model info response:", data);

      if (error) {
        console.error("Model info error:", error);
        throw error;
      }

      if (data.success && data.data) {
        const modelInfo = data.data;
        const baseAlgo = modelInfo.baseAlgo || 1;
        const isCheckpointModel = modelInfo.modelType === "checkpoint";
        
        // 更新是否为底模的状态
        setIsCheckpoint(isCheckpointModel);
        
        // 根据模型类型设置不同的ID字段
        setFormData(prev => ({
          ...prev,
          lora_version_id: isCheckpointModel ? '' : versionUuid,
          checkpoint_id: isCheckpointModel ? versionUuid : '',
          model_id: versionUuid,
          name: `${modelInfo.modelName || ''} ${modelInfo.versionName || ''}`.trim(),
          description: `基础算法: ${modelInfo.baseAlgoName || modelInfo.baseAlgo}\n${modelInfo.commercialUse === 1 ? '可商用' : '不可商用'}\n模型类型: ${isCheckpointModel ? '底模(Checkpoint)' : 'LoRA'}`,
          thumbnail_url: modelInfo.modelUrl || '',
          base_algo: String(baseAlgo),
        }));
        
        toast({
          title: "模型信息获取成功",
          description: `${modelInfo.modelName} - ${modelInfo.baseAlgoName} (${isCheckpointModel ? '底模' : 'LoRA'})`,
        });
      } else {
        throw new Error(data.error || "获取模型信息失败");
      }
    } catch (error) {
      console.error("Parse model URL error:", error);
      toast({
        title: "获取模型信息失败",
        description: error instanceof Error ? error.message : "请检查URL格式或网络连接",
        variant: "destructive",
      });
    } finally {
      setIsAutoFilling(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: ModelFormData) => {
      const payload = {
        model_id: data.model_id,
        name: data.name,
        description: data.description || null,
        tags: data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        features: data.features ? JSON.parse(data.features) : {},
        thumbnail_url: data.thumbnail_url || null,
        checkpoint_id: data.checkpoint_id || null,
        lora_version_id: data.lora_version_id || null,
        sampler: parseInt(data.sampler) || 15,
        cfg_scale: parseFloat(data.cfg_scale) || 7,
        randn_source: parseInt(data.randn_source) || 0,
        lora_weight: parseFloat(data.lora_weight) || 0.8,
        base_algo: parseInt(data.base_algo) || 1,
      };

      if (editingModel) {
        const { error } = await supabase
          .from("liblib_models")
          .update(payload)
          .eq("id", editingModel.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("liblib_models")
          .insert(payload);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["liblib-models"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: editingModel ? "模型已更新" : "模型已添加",
      });
    },
    onError: (error: any) => {
      toast({
        title: "操作失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("liblib_models")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["liblib-models"] });
      toast({
        title: "模型已删除",
      });
    },
    onError: (error: any) => {
      toast({
        title: "删除失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      model_id: "",
      name: "",
      description: "",
      tags: "",
      features: "",
      thumbnail_url: "",
      model_url: "",
      checkpoint_id: "",
      lora_version_id: "",
      sampler: "15",
      cfg_scale: "7",
      randn_source: "0",
      lora_weight: "0.8",
      base_algo: "1",
    });
    setEditingModel(null);
    setIsCheckpoint(false);
  };

  const handleEdit = (model: any) => {
    setEditingModel(model);
    setIsCheckpoint(!!model.checkpoint_id);
    setFormData({
      model_id: model.model_id,
      name: model.name,
      description: model.description || "",
      tags: model.tags?.join(", ") || "",
      features: JSON.stringify(model.features || {}, null, 2),
      thumbnail_url: model.thumbnail_url || "",
      model_url: "",
      checkpoint_id: model.checkpoint_id || "",
      lora_version_id: model.lora_version_id || "",
      sampler: String(model.sampler || 15),
      cfg_scale: String(model.cfg_scale || 7),
      randn_source: String(model.randn_source || 0),
      lora_weight: String(model.lora_weight || 0.8),
      base_algo: String(model.base_algo || 1),
    });
    setIsDialogOpen(true);
  };

  const handleCheckpointToggle = (checked: boolean) => {
    setIsCheckpoint(checked);
    // 当切换时，自动调整checkpoint_id和lora_version_id
    if (formData.model_id) {
      if (checked) {
        // 切换为底模：将model_id设为checkpoint_id，清空lora_version_id
        setFormData(prev => ({
          ...prev,
          checkpoint_id: prev.model_id,
          lora_version_id: '',
        }));
      } else {
        // 切换为LoRA：将model_id设为lora_version_id，清空checkpoint_id
        setFormData(prev => ({
          ...prev,
          checkpoint_id: '',
          lora_version_id: prev.model_id,
        }));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-[var(--gradient-primary)] bg-clip-text text-transparent">
              模型管理
            </h1>
            <p className="mt-2 text-muted-foreground">
              添加和管理LibLib AI模型及其特征标注
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                添加模型
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingModel ? "编辑模型" : "添加新模型"}
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                填写模型信息以便AI智能选择使用
              </p>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="model_url">LibLib模型URL *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="model_url"
                      value={formData.model_url}
                      onChange={(e) => setFormData({ ...formData, model_url: e.target.value })}
                      placeholder="https://www.liblib.art/modelinfo/...?versionUuid=..."
                    />
                    <Button
                      type="button"
                      onClick={() => parseModelUrl(formData.model_url)}
                      disabled={!formData.model_url || isAutoFilling}
                    >
                      {isAutoFilling ? "获取中..." : "自动填充"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    粘贴LibLib模型URL，点击"自动填充"获取完整模型信息
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="checkpoint_id">底模ID (checkPointId)</Label>
                    <Input
                      id="checkpoint_id"
                      value={formData.checkpoint_id}
                      onChange={(e) => setFormData({ ...formData, checkpoint_id: e.target.value })}
                      placeholder="可选：某些模型需要指定底模"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Flux模型无需填写，SD/XL模型才需要
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="lora_version_id">Lora版本ID (versionUuid)</Label>
                    <Input
                      id="lora_version_id"
                      value={formData.lora_version_id}
                      onChange={(e) => setFormData({ ...formData, lora_version_id: e.target.value })}
                      placeholder="自动填充"
                      readOnly
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-md bg-muted/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="is_checkpoint" className="text-base">
                      底模模型
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      勾选表示这是一个底模(Checkpoint)，否则为LoRA模型
                    </p>
                  </div>
                  <Switch
                    id="is_checkpoint"
                    checked={isCheckpoint}
                    onCheckedChange={handleCheckpointToggle}
                  />
                </div>

                <div>
                  <Label htmlFor="model_id">模型ID *</Label>
                  <Input
                    id="model_id"
                    value={formData.model_id}
                    onChange={(e) => setFormData({ ...formData, model_id: e.target.value })}
                    placeholder="自动填充"
                    required
                    disabled={!!editingModel}
                  />
                </div>

                <div>
                  <Label htmlFor="name">模型名称 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="梦幻风格模型"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">描述</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="描述模型的特点和适用场景..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="tags">标签（逗号分隔）</Label>
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="写实, 人像, 风景"
                  />
                </div>

                <div>
                  <Label htmlFor="features">特征（JSON格式）</Label>
                  <Textarea
                    id="features"
                    value={formData.features}
                    onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                    placeholder='{"style": "realistic", "quality": "high"}'
                    rows={4}
                    className="font-mono text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="thumbnail_url">缩略图URL</Label>
                  <Input
                    id="thumbnail_url"
                    value={formData.thumbnail_url}
                    onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sampler">采样方法</Label>
                    <Input
                      id="sampler"
                      type="number"
                      value={formData.sampler}
                      onChange={(e) => setFormData({ ...formData, sampler: e.target.value })}
                      placeholder="15"
                    />
                  </div>

                  <div>
                    <Label htmlFor="cfg_scale">提示词引导系数 (CFG Scale)</Label>
                    <Input
                      id="cfg_scale"
                      type="number"
                      step="0.1"
                      value={formData.cfg_scale}
                      onChange={(e) => setFormData({ ...formData, cfg_scale: e.target.value })}
                      placeholder="7"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="randn_source">随机种子生成器</Label>
                    <select
                      id="randn_source"
                      value={formData.randn_source}
                      onChange={(e) => setFormData({ ...formData, randn_source: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="0">CPU (0)</option>
                      <option value="1">GPU (1)</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="lora_weight">Lora权重</Label>
                    <Input
                      id="lora_weight"
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={formData.lora_weight}
                      onChange={(e) => setFormData({ ...formData, lora_weight: e.target.value })}
                      placeholder="0.8"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    <X className="mr-2 h-4 w-4" />
                    取消
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {saveMutation.isPending ? "保存中..." : "保存"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">加载中...</p>
          </div>
        ) : models && models.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {models.map((model) => (
              <Card key={model.id} className="overflow-hidden bg-gradient-to-br from-card via-card to-primary/5 border-primary/20">
                {model.thumbnail_url ? (
                  <div className="aspect-[3/4] w-full overflow-hidden bg-muted relative">
                    <img
                      src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-proxy?url=${encodeURIComponent(model.thumbnail_url)}`}
                      alt={model.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        console.error("Failed to load image:", model.thumbnail_url);
                        const parent = e.currentTarget.parentElement;
                        if (parent && e.currentTarget.style.display !== 'none') {
                          e.currentTarget.style.display = 'none';
                          const fallback = document.createElement('div');
                          fallback.className = 'absolute inset-0 flex items-center justify-center bg-muted';
                          fallback.innerHTML = `
                            <div class="text-center p-4">
                              <svg class="mx-auto h-12 w-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <p class="mt-2 text-sm text-muted-foreground">预览图加载失败</p>
                              <a href="${model.thumbnail_url}" target="_blank" rel="noopener noreferrer" class="text-xs text-primary hover:underline mt-1 block">查看原图</a>
                            </div>
                          `;
                          parent.appendChild(fallback);
                        }
                      }}
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="aspect-video w-full overflow-hidden bg-muted flex items-center justify-center">
                    <div className="text-center p-4">
                      <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="mt-2 text-sm text-muted-foreground">暂无预览图</p>
                    </div>
                  </div>
                )}
                
                <div className="p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{model.name}</h3>
                      <p className="text-xs text-muted-foreground">ID: {model.model_id}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEdit(model)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(model.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {model.description && (
                    <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
                      {model.description}
                    </p>
                  )}

                  {model.tags && model.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {model.tags.map((tag: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <p className="mb-4 text-muted-foreground">还没有添加任何模型</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              添加第一个模型
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Models;