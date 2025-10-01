import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ExternalLink, Network, Code, AlertCircle } from "lucide-react";

const DebugQwen = () => {
  const openLibLibWebsite = () => {
    window.open("https://www.liblib.art/modelinfo/c62a103bd98a4246a2334e2d952f7b21", "_blank");
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Qwen-Image API 调试</h1>
        <p className="text-muted-foreground">
          捕获 LibLib 官网使用 Qwen-Image 时的真实 API 调用
        </p>
      </div>

      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          目前生成的图片看起来不是 Qwen-Image 的风格，可能是 API 调用方式有问题。
          让我们通过捕获官网的实际请求来找出正确的调用方法。
        </AlertDescription>
      </Alert>

      <div className="space-y-6">
        {/* 步骤 1 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm">
                1
              </span>
              打开浏览器开发者工具
            </CardTitle>
            <CardDescription>
              在开始之前，需要准备好浏览器的网络监控工具
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>按下以下快捷键打开开发者工具：</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Windows/Linux: <code className="bg-secondary px-2 py-1 rounded">F12</code> 或 <code className="bg-secondary px-2 py-1 rounded">Ctrl + Shift + I</code></li>
              <li>Mac: <code className="bg-secondary px-2 py-1 rounded">Cmd + Option + I</code></li>
            </ul>
            <p className="text-sm">然后切换到 <strong>"Network"</strong> (网络) 标签页</p>
          </CardContent>
        </Card>

        {/* 步骤 2 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm">
                2
              </span>
              访问 Qwen-Image 模型页面
            </CardTitle>
            <CardDescription>
              前往 LibLib 官网的 Qwen-Image 模型页面
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={openLibLibWebsite} className="w-full">
              <ExternalLink className="mr-2 h-4 w-4" />
              打开 Qwen-Image 官方页面
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              点击后会在新标签页打开 LibLib 官网的 Qwen-Image 模型页面
            </p>
          </CardContent>
        </Card>

        {/* 步骤 3 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm">
                3
              </span>
              使用 Qwen-Image 生成图片
            </CardTitle>
            <CardDescription>
              在官网上触发一次图片生成
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>在 Qwen-Image 页面找到"在线生成"按钮</li>
              <li>输入一个简单的提示词，例如："一只可爱的猫"</li>
              <li>点击"生成"按钮</li>
              <li>等待图片生成完成</li>
            </ol>
          </CardContent>
        </Card>

        {/* 步骤 4 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm">
                4
              </span>
              查找 API 请求
            </CardTitle>
            <CardDescription>
              在 Network 标签中找到关键的 API 调用
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">需要查找的请求类型：</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>
                  <strong>文生图请求</strong>: 查找包含 "text2img", "generate", "create" 等关键词的 POST 请求
                </li>
                <li>
                  <strong>可能的 URL</strong>: 
                  <code className="bg-secondary px-2 py-1 rounded text-xs ml-2">
                    openapi.liblibai.cloud
                  </code>
                </li>
              </ul>
            </div>

            <Alert>
              <Code className="h-4 w-4" />
              <AlertDescription>
                <strong>提示</strong>: 在 Network 标签的搜索框中输入 "generate" 或 "qwen" 来快速过滤请求
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* 步骤 5 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm">
                5
              </span>
              提取关键信息
            </CardTitle>
            <CardDescription>
              记录以下重要信息并反馈给我
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-secondary p-4 rounded-lg">
                <h4 className="font-semibold mb-3">需要记录的信息：</h4>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium mb-1">1️⃣ API 端点 (URL)</p>
                    <p className="text-muted-foreground">例如: /api/generate/xxx 或 /api/qwen/generate</p>
                  </div>
                  
                  <div>
                    <p className="font-medium mb-1">2️⃣ 请求方法</p>
                    <p className="text-muted-foreground">GET 还是 POST？</p>
                  </div>
                  
                  <div>
                    <p className="font-medium mb-1">3️⃣ 请求体 (Request Body)</p>
                    <p className="text-muted-foreground">
                      右键点击请求 → "Copy" → "Copy as cURL" 或查看 "Payload" 标签
                    </p>
                  </div>
                  
                  <div>
                    <p className="font-medium mb-1">4️⃣ 关键参数</p>
                    <p className="text-muted-foreground">
                      特别注意:
                    </p>
                    <ul className="list-disc list-inside ml-4 mt-1">
                      <li>templateUuid (模板ID)</li>
                      <li>checkPointId / modelId (模型ID)</li>
                      <li>baseAlgo (基础算法)</li>
                      <li>任何 "qwen" 相关的参数</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Alert>
                <AlertDescription className="text-sm">
                  <strong>如何复制请求信息：</strong><br/>
                  在 Network 标签中找到请求后，右键点击 → "Copy" → "Copy as cURL (bash)" 
                  然后将整个命令粘贴给我分析
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>

        {/* 当前使用的参数 */}
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle>当前代码使用的参数</CardTitle>
            <CardDescription>
              对比官网实际使用的参数，找出差异
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-secondary p-4 rounded-lg text-xs overflow-x-auto">
{`当前调用:
- API: /api/generate/webui/text2img
- checkPointId: 75e0be0c93b34dd8baeec9c968013e0c
- templateUuid: e10adc3949ba59abbe56e057f20f883e (通用模板)
- baseAlgo: 9 (Qwen-Image)

问题: 生成的图片风格不是 Qwen-Image
可能原因: 
1. API 端点不对
2. templateUuid 不对
3. 缺少 Qwen 特定的参数`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DebugQwen;
