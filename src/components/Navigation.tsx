import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Sparkles, Database, History, TestTube2, Bug } from "lucide-react";

const Navigation = () => {
  const location = useLocation();

  const links = [
    { to: "/", label: "智能生成", icon: Sparkles },
    { to: "/models", label: "模型管理", icon: Database },
    { to: "/history", label: "生成历史", icon: History },
    { to: "/test", label: "API测试", icon: TestTube2 },
    { to: "/debug-qwen", label: "Qwen调试", icon: Bug },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--gradient-primary)]">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold bg-[var(--gradient-primary)] bg-clip-text text-transparent">
            LibLib AI Studio
          </span>
        </div>

        <div className="flex gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                location.pathname === to
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;