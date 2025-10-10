import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Wand2, Layers, Zap, ArrowRight, ExternalLink, Info } from "lucide-react";
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
      {/* Test Notice Banner */}
      <div className="bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 border-b border-primary/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-center">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              <span className="font-medium text-foreground">测试页面 - 限时免费使用</span>
            </div>
            <span className="hidden sm:inline text-muted-foreground">|</span>
            <a 
              href="https://story.neodomain.ai" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-medium"
            >
              访问官方正式产品
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Hero Section - 紫色渐变 */}
      <section className="relative overflow-hidden py-32 px-6 bg-gradient-to-br from-primary/10 via-accent/5 to-background">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
        </div>
        
        <div className="relative mx-auto max-w-7xl text-center">
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 animate-fade-in">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI智能创作平台</span>
          </div>
          
          <h1 className="mb-6 text-6xl font-bold tracking-tight md:text-7xl lg:text-8xl animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <span className="bg-[var(--gradient-primary)] bg-clip-text text-transparent">
              Neo-Domain
            </span>
          </h1>
          
          <p className="mb-4 text-2xl font-semibold text-foreground md:text-3xl animate-fade-in" style={{ animationDelay: '0.2s' }}>
            AI驱动的智能图像创作平台
          </p>
          
          <p className="mx-auto mb-12 max-w-3xl text-lg text-muted-foreground leading-relaxed animate-fade-in" style={{ animationDelay: '0.3s' }}>
            结合前沿人工智能技术与专业编辑工具，为创作者提供从灵感到成品的完整解决方案。
            让创意无限延伸，让每个想法都能成为现实。
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <Link to="/generate">
              <Button size="lg" className="gap-2 text-lg px-8 py-6 hover-scale shadow-lg shadow-primary/20">
                开始创作
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/editor">
              <Button size="lg" variant="outline" className="gap-2 text-lg px-8 py-6 hover-scale">
                打开编辑器
                <Layers className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section - 浅色背景 */}
      <section className="py-24 px-6 bg-gradient-to-br from-background via-muted/20 to-background">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="mb-4 text-4xl font-bold md:text-5xl">
              <span className="bg-[var(--gradient-primary)] bg-clip-text text-transparent">
                强大的功能特性
              </span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              一站式图像创作与编辑解决方案，满足您的所有创作需求
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="group border-border/40 bg-card backdrop-blur transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-2 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-8">
                  <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="mb-3 text-xl font-bold group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Product Introduction Section - 蓝色渐变 */}
      <section className="py-24 px-6 bg-gradient-to-br from-accent/10 via-accent/5 to-background relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-accent/5 rounded-full blur-3xl" />
        </div>
        
        <div className="relative mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="mb-4 text-4xl font-bold md:text-5xl">
              关于 <span className="bg-[var(--gradient-primary)] bg-clip-text text-transparent">Neo-Domain</span>
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "创新技术",
                content: "Neo-Domain 采用最前沿的人工智能技术，让您通过自然语言即可生成高质量图像，无需专业绘画技能。",
                gradient: "from-primary/5 to-primary/10"
              },
              {
                title: "专业工具",
                content: "强大的分镜编辑器支持多图层管理、智能合成、精确裁剪等专业功能，让创作过程更加流畅高效。",
                gradient: "from-accent/5 to-accent/10"
              },
              {
                title: "全面支持",
                content: "丰富的灵感广场和模型管理功能，帮助您发现新的创作思路，并管理自己的作品历史。",
                gradient: "from-primary/10 to-accent/5"
              }
            ].map((item, idx) => (
              <Card 
                key={idx} 
                className={`border-border/40 bg-gradient-to-br ${item.gradient} backdrop-blur hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-fade-in`}
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold mb-4 bg-[var(--gradient-primary)] bg-clip-text text-transparent">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {item.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - 渐变背景 */}
      <section className="py-32 px-6 relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        </div>
        
        <div className="relative mx-auto max-w-4xl text-center">
          <h2 className="mb-6 text-4xl font-bold md:text-5xl animate-fade-in">
            准备好开始创作了吗？
          </h2>
          <p className="mb-12 text-xl text-muted-foreground animate-fade-in" style={{ animationDelay: '0.1s' }}>
            立即体验AI驱动的智能图像创作，让您的创意成为现实
          </p>
          <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <Link to="/generate">
              <Button size="lg" className="gap-2 text-lg px-10 py-7 hover-scale shadow-2xl shadow-primary/30">
                免费开始创作
                <Sparkles className="h-6 w-6" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
