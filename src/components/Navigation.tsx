import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Sparkles, Database, History, Star, Pencil, ChevronDown, Home } from "lucide-react";
import { useState } from "react";

const Navigation = () => {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(false);

  const links = [
    { to: "/", label: "首页", icon: Home },
    { to: "/generate", label: "智能生成", icon: Sparkles },
    { to: "/editor", label: "分镜编辑", icon: Pencil },
    { to: "/models", label: "模型管理", icon: Database },
    { to: "/history", label: "生成历史", icon: History },
  ];

  return (
    <>
      {/* Top indicator bar - always visible */}
      <div 
        className="fixed top-0 left-0 right-0 h-8 flex items-center justify-center z-50 cursor-pointer"
        onMouseEnter={() => setIsVisible(true)}
        onClick={() => setIsVisible(!isVisible)}
      >
        <ChevronDown className={cn(
          "h-5 w-5 text-muted-foreground transition-transform duration-300",
          isVisible && "rotate-180"
        )} />
      </div>

      {/* Main navigation bar */}
      <nav 
        className={cn(
          "fixed top-0 left-0 right-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur transition-all duration-300",
          isVisible ? "translate-y-0" : "-translate-y-full"
        )}
        onMouseLeave={() => setIsVisible(false)}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
            </div>
            <span className="text-xl font-bold bg-[var(--gradient-primary)] bg-clip-text text-transparent">
              Neo-Domain
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
    </>
  );
};

export default Navigation;
