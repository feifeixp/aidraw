import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Sparkles, Settings, Pencil, ChevronDown, Home, ExternalLink, LogOut, User } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
const Navigation = () => {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  const {
    user,
    isAdmin,
    signOut
  } = useAuth();
  const links = [{
    to: "/",
    label: "首页",
    icon: Home
  }, {
    to: "/generate",
    label: "图片生成",
    icon: Sparkles
  }, {
    to: "/editor",
    label: "分镜编辑",
    icon: Pencil
  }];
  
  // 只为admin用户添加管理中心链接
  if (isAdmin) {
    links.push({
      to: "/admin",
      label: "管理中心",
      icon: Settings
    });
  }
  return <>
      {/* Top indicator bar - always visible */}
      <div onMouseEnter={() => setIsVisible(true)} onClick={() => setIsVisible(!isVisible)} className="fixed top-0 left-0 right-0 h-8 w-300 flex items-center justify-center z-50 cursor-pointer rounded-none">
        <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform duration-300", isVisible && "rotate-180")} />
      </div>

      {/* Main navigation bar */}
      <nav className={cn("fixed top-0 left-0 right-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur transition-all duration-300 overflow-x-auto", isVisible ? "translate-y-0" : "-translate-y-full")} onMouseLeave={() => setIsVisible(false)}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-8 my-[10px] min-w-max">
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
            </div>
            <span className="text-xl font-bold bg-[var(--gradient-primary)] bg-clip-text text-transparent whitespace-nowrap">
              Neo-Domain
            </span>
            
            <a href="https://story.neodomain.ai" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground ml-8 whitespace-nowrap shrink-0">
              <ExternalLink className="h-4 w-4 shrink-0" />
              正式产品
            </a>
          </div>

          <div className="flex gap-1 items-center shrink-0">
            {links.map(({
            to,
            label,
            icon: Icon
          }) => <Link key={to} to={to} className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0", location.pathname === to ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground")}>
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>)}
            
            {user ? <div className="flex items-center gap-2 ml-4 shrink-0">
                <span className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap max-w-[200px] truncate">
                  <User className="h-4 w-4 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </span>
                <Button variant="ghost" size="sm" onClick={signOut} className="flex items-center gap-2 whitespace-nowrap shrink-0">
                  <LogOut className="h-4 w-4 shrink-0" />
                  登出
                </Button>
              </div> : <Link to="/auth" className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground ml-4 whitespace-nowrap shrink-0">
                登录
              </Link>}
          </div>
        </div>
      </nav>
    </>;
};
export default Navigation;