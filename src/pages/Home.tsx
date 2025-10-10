import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Wand2, Layers, Zap, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const Home = () => {
  const features = [
    {
      icon: Sparkles,
      title: "AI智能生成",
      description: "使用先进的AI技术，根据文字描述生成高质量的图像内容"
    },
    {
      icon: Layers,
      title: "分镜编辑",
      description: "专业的画布编辑工具，支持多图层管理、智能合成和精确调整"
    },
    {
      icon: Wand2,
      title: "智能优化",
      description: "一键重绘、背景移除、色彩调整等智能功能，让创作更轻松"
    },
    {
      icon: Zap,
      title: "高效工作流",
      description: "从创意到成品的完整工作流程，大幅提升创作效率"
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-6">
        <div className="absolute inset-0 bg-[var(--gradient-card)] opacity-50" />
        <div className="relative mx-auto max-w-7xl text-center">
          <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl">
            <span className="bg-[var(--gradient-primary)] bg-clip-text text-transparent">
              Neo-Domain
            </span>
          </h1>
          <p className="mb-8 text-xl text-muted-foreground md:text-2xl">
            AI驱动的智能图像创作平台
          </p>
          <p className="mx-auto mb-12 max-w-2xl text-lg text-muted-foreground">
            结合前沿人工智能技术与专业编辑工具，为创作者提供从灵感到成品的完整解决方案
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/generate">
              <Button size="lg" className="gap-2">
                开始创作
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/editor">
              <Button size="lg" variant="outline" className="gap-2">
                打开编辑器
                <Layers className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-4 text-center text-3xl font-bold md:text-4xl">
            强大的功能特性
          </h2>
          <p className="mb-12 text-center text-lg text-muted-foreground">
            一站式图像创作与编辑解决方案
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <Card key={index} className="border-border/40 bg-card/50 backdrop-blur transition-all hover:shadow-lg hover:shadow-primary/10">
                <CardContent className="p-6">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Product Introduction Section */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-8 text-center text-3xl font-bold md:text-4xl">
            关于产品
          </h2>
          <div className="space-y-6 text-lg leading-relaxed text-muted-foreground">
            <p>
              Neo-Domain 是一款专为创意工作者打造的AI图像创作平台。我们致力于将最前沿的人工智能技术与直观的用户体验相结合，让每个人都能轻松实现自己的创意想法。
            </p>
            <p>
              通过我们的平台，您可以使用自然语言描述来生成高质量的图像，无需专业的绘画技能。强大的分镜编辑器支持多图层管理、智能合成、精确裁剪等专业功能，让您的创作过程更加流畅高效。
            </p>
            <p>
              我们还提供丰富的灵感广场和模型管理功能，帮助您发现新的创作思路，并管理自己的作品历史。无论您是专业设计师、内容创作者，还是对图像创作感兴趣的爱好者，Neo-Domain 都能为您提供所需的工具和支持。
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-6 text-3xl font-bold md:text-4xl">
            准备好开始创作了吗？
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            立即体验AI驱动的智能图像创作
          </p>
          <Link to="/generate">
            <Button size="lg" className="gap-2">
              免费开始
              <Sparkles className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
