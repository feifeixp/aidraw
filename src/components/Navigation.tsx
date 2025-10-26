import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Sparkles, Settings, Pencil, ChevronDown, Home, ExternalLink, LogOut, User, Briefcase, HelpCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { exportAuthToProject } from "@/utils/crossProjectAuth";
import { toast } from "sonner";
import { FeaturesDialog } from "@/components/FeaturesDialog";
const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [hasHovered, setHasHovered] = useState(false);
  const [featuresDialogOpen, setFeaturesDialogOpen] = useState(false);

  // 处理编辑器页面的导航拦截
  const handleNavClick = (e: React.MouseEvent, path: string) => {
    if (location.pathname === "/editor" && path !== "/editor") {
      e.preventDefault();
      // 触发自定义事件通知Editor组件
      const event = new CustomEvent("editor:navigation-blocked", { detail: { path } });
      window.dispatchEvent(event);
    }
  };

  // Ensure navigation starts hidden and only shows on hover
  useEffect(() => {
    setIsVisible(false);
  }, [location.pathname]);

  const handleMouseEnter = () => {
    setIsVisible(true);
    setHasHovered(true);
  };
  const {
    user,
    isAdmin,
    signOut
  } = useAuth();

  const handleJumpToWorkspace = async () => {
    try {
      await exportAuthToProject("https://workspace.neodomain.ai");
    } catch (error) {
      console.error("跳转失败:", error);
      toast.error("跳转失败，请确保已登录");
    }
  };
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
      {/* Top hover area - invisible trigger */}
      <div 
        onMouseEnter={handleMouseEnter} 
        className="fixed top-0 left-0 right-0 h-4 z-50 cursor-pointer"
      />

      {/* Top indicator - only shows after first hover */}
      {hasHovered && (
        <div 
          onMouseEnter={handleMouseEnter} 
          onClick={() => setIsVisible(!isVisible)} 
          className={cn(
            "fixed top-0 left-0 right-0 h-6 flex items-center justify-center z-50 cursor-pointer transition-opacity duration-300",
            isVisible ? "opacity-0 pointer-events-none" : "opacity-100"
          )}
        >
          <div className="bg-background/80 backdrop-blur-sm rounded-b-lg px-4 py-1">
            <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
          </div>
        </div>
      )}

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
            
            {user && (
              <button 
                onClick={handleJumpToWorkspace}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground whitespace-nowrap shrink-0"
              >
                <Briefcase className="h-4 w-4 shrink-0" />
                前往工作台
              </button>
            )}
          </div>

          <div className="flex gap-1 items-center shrink-0">
            {links.map(({
            to,
            label,
            icon: Icon
          }) => <Link 
                key={to} 
                to={to} 
                onClick={(e) => handleNavClick(e, to)}
                className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0", location.pathname === to ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground")}>
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>)}
            
            <button
              onClick={() => setFeaturesDialogOpen(true)}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground whitespace-nowrap shrink-0"
            >
              <HelpCircle className="h-4 w-4 shrink-0" />
              帮助
            </button>
            
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
      
      <FeaturesDialog 
        open={featuresDialogOpen} 
        onOpenChange={setFeaturesDialogOpen} 
      />
    </>;
};
export default Navigation;