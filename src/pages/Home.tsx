import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Wand2, Layers, Zap, ArrowRight, Star, Users, TrendingUp } from "lucide-react";
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-32 px-6">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-accent/5 rounded-full blur-3xl" />
        </div>
        
        <div className="relative mx-auto max-w-7xl text-center">
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI智能创作平台</span>
          </div>
          
          <h1 className="mb-6 text-6xl font-bold tracking-tight md:text-7xl lg:text-8xl animate-fade-in">
            <span className="bg-[var(--gradient-primary)] bg-clip-text text-transparent">
              Neo-Domain
            </span>
          </h1>
          
          <p className="mb-4 text-2xl font-semibold text-foreground md:text-3xl animate-fade-in" style={{ animationDelay: '0.1s' }}>
            AI驱动的智能图像创作平台
          </p>
          
          <p className="mx-auto mb-12 max-w-3xl text-lg text-muted-foreground leading-relaxed animate-fade-in" style={{ animationDelay: '0.2s' }}>
            结合前沿人工智能技术与专业编辑工具，为创作者提供从灵感到成品的完整解决方案。
            让创意无限延伸，让每个想法都能成为现实。
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-4 mb-16 animate-fade-in" style={{ animationDelay: '0.3s' }}>
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

          {/* Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto animate-fade-in" style={{ animationDelay: '0.4s' }}>
            {[
              { icon: Users, label: "活跃用户", value: "10K+" },
              { icon: Star, label: "生成图片", value: "1M+" },
              { icon: TrendingUp, label: "满意度", value: "99%" }
            ].map((stat, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-card/50 backdrop-blur border border-border/40">
                <stat.icon className="h-8 w-8 text-primary mx-auto mb-2" />
                <div className="text-3xl font-bold mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 relative">
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
                className="group border-border/40 bg-card/50 backdrop-blur transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-2 animate-fade-in"
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

      {/* Product Introduction Section */}
      <section className="py-24 px-6 bg-gradient-to-br from-muted/30 to-muted/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-[var(--gradient-card)] opacity-30" />
        
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
                content: "Neo-Domain 采用最前沿的人工智能技术，让您通过自然语言即可生成高质量图像，无需专业绘画技能。"
              },
              {
                title: "专业工具",
                content: "强大的分镜编辑器支持多图层管理、智能合成、精确裁剪等专业功能，让创作过程更加流畅高效。"
              },
              {
                title: "全面支持",
                content: "丰富的灵感广场和模型管理功能，帮助您发现新的创作思路，并管理自己的作品历史。"
              }
            ].map((item, idx) => (
              <Card 
                key={idx} 
                className="border-border/40 bg-card/80 backdrop-blur hover:shadow-lg transition-all duration-300 animate-fade-in"
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

      {/* CTA Section */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[var(--gradient-primary)] opacity-5" />
        
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
