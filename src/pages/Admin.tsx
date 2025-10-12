import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import ModelsContent from "./Models";
import PoseReferencesManager from "@/components/admin/PoseReferencesManager";

const Admin = () => {
  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8">
            <h1 className="text-4xl font-bold bg-[var(--gradient-primary)] bg-clip-text text-transparent">
              管理中心
            </h1>
            <p className="mt-2 text-muted-foreground">
              系统管理和配置
            </p>
          </header>

          <Tabs defaultValue="models" className="w-full">
            <TabsList className="grid w-full max-w-2xl grid-cols-3">
              <TabsTrigger value="models">模型管理</TabsTrigger>
              <TabsTrigger value="pose-refs">动作参考</TabsTrigger>
              <TabsTrigger value="users">用户管理</TabsTrigger>
            </TabsList>
            
            <TabsContent value="models" className="mt-6">
              <ModelsContent />
            </TabsContent>

            <TabsContent value="pose-refs" className="mt-6">
              <Card className="p-6">
                <h2 className="text-2xl font-bold mb-4">动作参考图片管理</h2>
                <PoseReferencesManager />
              </Card>
            </TabsContent>
            
            <TabsContent value="users" className="mt-6">
              <Card className="p-6">
                <h2 className="text-2xl font-bold mb-4">用户管理</h2>
                <p className="text-muted-foreground">用户管理功能即将推出...</p>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default Admin;
