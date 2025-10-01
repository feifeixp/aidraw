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

interface ModelFormData {
  model_id: string;
  name: string;
  description: string;
  tags: string;
  features: string;
  thumbnail_url: string;
}

const Models = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<any>(null);
  const [formData, setFormData] = useState<ModelFormData>({
    model_id: "",
    name: "",
    description: "",
    tags: "",
    features: "",
    thumbnail_url: "",
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

  const saveMutation = useMutation({
    mutationFn: async (data: ModelFormData) => {
      const payload = {
        model_id: data.model_id,
        name: data.name,
        description: data.description || null,
        tags: data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        features: data.features ? JSON.parse(data.features) : {},
        thumbnail_url: data.thumbnail_url || null,
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
    });
    setEditingModel(null);
  };

  const handleEdit = (model: any) => {
    setEditingModel(model);
    setFormData({
      model_id: model.model_id,
      name: model.name,
      description: model.description || "",
      tags: model.tags?.join(", ") || "",
      features: JSON.stringify(model.features || {}, null, 2),
      thumbnail_url: model.thumbnail_url || "",
    });
    setIsDialogOpen(true);
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
              <Button className="bg-[var(--gradient-primary)] hover:opacity-90">
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
                  <Label htmlFor="model_id">模型ID *</Label>
                  <Input
                    id="model_id"
                    value={formData.model_id}
                    onChange={(e) => setFormData({ ...formData, model_id: e.target.value })}
                    placeholder="liblib-model-001"
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
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {models.map((model) => (
              <Card key={model.id} className="overflow-hidden bg-gradient-to-br from-card via-card to-primary/5 border-primary/20">
                {model.thumbnail_url && (
                  <div className="aspect-video w-full overflow-hidden bg-muted">
                    <img
                      src={model.thumbnail_url}
                      alt={model.name}
                      className="h-full w-full object-cover"
                    />
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