import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Generate from "./pages/Generate";
import Models from "./pages/Models";
import History from "./pages/History";
import Inspiration from "./pages/Inspiration";
import Test from "./pages/Test";
import DebugQwen from "./pages/DebugQwen";
import Navigation from "./components/Navigation";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Navigation />
        <div className="pt-16">
          <Routes>
            <Route path="/" element={<Generate />} />
            <Route path="/inspiration" element={<Inspiration />} />
            <Route path="/models" element={<Models />} />
            <Route path="/history" element={<History />} />
            <Route path="/test" element={<Test />} />
            <Route path="/debug-qwen" element={<DebugQwen />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
