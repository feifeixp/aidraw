import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, Trash2, Eye, EyeOff, Edit2, X, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PoseReference {
  id: string;
  image_url: string;
  description: string | null;
  tags: string[];
  is_active: boolean;
  created_at: string;
}

const PoseReferencesManager = () => {
  const [references, setReferences] = useState<PoseReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editTags, setEditTags] = useState("");

  useEffect(() => {
    loadReferences();
  }, []);

  const loadReferences = async () => {
    try {
      const { data, error } = await supabase
        .from("pose_reference_presets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReferences(data || []);
    } catch (error: any) {
      toast.error("加载失败: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片大小不能超过5MB");
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from("pose-references")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("pose-references")
        .getPublicUrl(filePath);

      const tagsArray = tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t);

      const { error: insertError } = await supabase
        .from("pose_reference_presets")
        .insert({
          image_url: urlData.publicUrl,
          description: description || null,
          tags: tagsArray,
        });

      if (insertError) throw insertError;

      toast.success("上传成功");
      setDescription("");
      setTags("");
      setSelectedFile(null);
      setPreviewUrl("");
      loadReferences();
    } catch (error: any) {
      toast.error("上传失败: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCancelUpload = () => {
    setSelectedFile(null);
    setPreviewUrl("");
    setDescription("");
    setTags("");
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from("pose_reference_presets")
        .update({ is_active: !currentState })
        .eq("id", id);

      if (error) throw error;

      toast.success(currentState ? "已隐藏" : "已显示");
      loadReferences();
    } catch (error: any) {
      toast.error("操作失败: " + error.message);
    }
  };

  const handleDelete = async (id: string, imageUrl: string) => {
    if (!confirm("确定要删除这个参考图片吗？")) return;

    try {
      const urlParts = imageUrl.split("/");
      const fileName = urlParts[urlParts.length - 1];

      const { error: deleteError } = await supabase
        .from("pose_reference_presets")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;

      await supabase.storage.from("pose-references").remove([fileName]);

      toast.success("删除成功");
      loadReferences();
    } catch (error: any) {
      toast.error("删除失败: " + error.message);
    }
  };

  const handleStartEdit = (ref: PoseReference) => {
    setEditingId(ref.id);
    setEditDescription(ref.description || "");
    setEditTags(ref.tags.join(", "));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditDescription("");
    setEditTags("");
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const tagsArray = editTags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t);

      const { error } = await supabase
        .from("pose_reference_presets")
        .update({
          description: editDescription || null,
          tags: tagsArray,
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("更新成功");
      setEditingId(null);
      loadReferences();
    } catch (error: any) {
      toast.error("更新失败: " + error.message);
    }
  };

  if (loading) {
    return <div className="p-6">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">上传新的参考图片</h3>
        <div className="space-y-4">
          {previewUrl && (
            <div className="relative aspect-square rounded-lg overflow-hidden bg-muted max-w-md">
              <img
                src={previewUrl}
                alt="预览"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-2 block">描述</label>
            <Textarea
              placeholder="输入图片描述（可选）"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={!selectedFile}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">标签</label>
            <Input
              placeholder="用逗号分隔多个标签，例如：站立,微笑,正面"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              disabled={!selectedFile}
            />
          </div>
          <div className="flex gap-2">
            {!selectedFile ? (
              <>
                <label htmlFor="upload-pose-ref" className="cursor-pointer">
                  <Button disabled={uploading} asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      选择图片
                    </span>
                  </Button>
                </label>
                <input
                  id="upload-pose-ref"
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </>
            ) : (
              <>
                <Button
                  onClick={handleConfirmUpload}
                  disabled={uploading}
                >
                  <Check className="w-4 h-4 mr-2" />
                  {uploading ? "上传中..." : "确认上传"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancelUpload}
                  disabled={uploading}
                >
                  <X className="w-4 h-4 mr-2" />
                  取消
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {references.map((ref) => (
          <Card key={ref.id} className="p-4 space-y-3">
            <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
              <img
                src={ref.image_url}
                alt={ref.description || "参考图片"}
                className="w-full h-full object-cover"
              />
              {!ref.is_active && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Badge variant="secondary">已隐藏</Badge>
                </div>
              )}
            </div>
            {editingId === ref.id ? (
              <>
                <div>
                  <label className="text-xs font-medium mb-1 block">描述</label>
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">标签</label>
                  <Input
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    className="text-sm"
                    placeholder="用逗号分隔"
                  />
                </div>
              </>
            ) : (
              <>
                {ref.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {ref.description}
                  </p>
                )}
                {ref.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {ref.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </>
            )}
            <div className="flex gap-2">
              {editingId === ref.id ? (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleSaveEdit(ref.id)}
                    className="flex-1"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    保存
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdit}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleActive(ref.id, ref.is_active)}
                    className="flex-1"
                  >
                    {ref.is_active ? (
                      <>
                        <EyeOff className="w-4 h-4 mr-1" />
                        隐藏
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-1" />
                        显示
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStartEdit(ref)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(ref.id, ref.image_url)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>

      {references.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          暂无参考图片，请上传新的参考图片
        </div>
      )}
    </div>
  );
};

export default PoseReferencesManager;
