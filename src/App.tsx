import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Generate from "./pages/Generate";
import Models from "./pages/Models";
import History from "./pages/History";
import Inspiration from "./pages/Inspiration";
import Editor from "./pages/Editor";
import Navigation from "./components/Navigation";
import NotFound from "./pages/NotFound";
import logo from "@/assets/logo.png";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Navigation />
        
        {/* Logo in top-left corner - visible on all pages */}
        <div className="fixed top-4 left-4 z-50">
          <img src={logo} alt="Neo-Domain Logo" className="h-12 w-12 object-contain" />
        </div>
        
        <div>
          <Routes>
            <Route path="/" element={<Generate />} />
            <Route path="/inspiration" element={<Inspiration />} />
            <Route path="/models" element={<Models />} />
            <Route path="/history" element={<History />} />
            <Route path="/editor" element={<Editor />} />
            {/* IMPORTANT: All routes must be above this line */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
