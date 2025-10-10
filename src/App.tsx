import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Generate from "./pages/Generate";
import Models from "./pages/Models";
import Editor from "./pages/Editor";
import Navigation from "./components/Navigation";
import NotFound from "./pages/NotFound";
import logo from "@/assets/logo.png";
const queryClient = new QueryClient();
const App = () => <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Navigation />
        
        {/* Logo in top-left corner - visible on all pages */}
        <div className="fixed top-4 left-4 z-50 my-[20px]">
          <img src={logo} alt="Neo-Domain Logo" className="h-6 w-6 object-contain" />
        </div>
        
        <div>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/generate" element={<Generate />} />
            <Route path="/models" element={<Models />} />
            <Route path="/editor" element={<Editor />} />
            {/* IMPORTANT: All routes must be above this line */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>;
export default App;