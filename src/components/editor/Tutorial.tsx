import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import tutorialConfig from "@/config/tutorial-steps.json";

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
}

interface TutorialProps {
  onComplete: () => void;
}

export const Tutorial = ({ onComplete }: TutorialProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const steps = tutorialConfig.steps as TutorialStep[];
  const step = steps[currentStep];

  useEffect(() => {
    if (!step.targetSelector) {
      setHighlightRect(null);
      return;
    }

    const updateHighlight = () => {
      const element = document.querySelector(step.targetSelector!);
      if (element) {
        setHighlightRect(element.getBoundingClientRect());
      }
    };

    updateHighlight();
    window.addEventListener("resize", updateHighlight);
    return () => window.removeEventListener("resize", updateHighlight);
  }, [step.targetSelector]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem("editor-tutorial-completed", "true");
    onComplete();
  };

  const getTooltipPosition = () => {
    if (!highlightRect || step.position === "center") {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const padding = 20;
    const style: React.CSSProperties = { position: "fixed" as const };

    switch (step.position) {
      case "bottom":
        style.top = highlightRect.bottom + padding;
        style.left = highlightRect.left + highlightRect.width / 2;
        style.transform = "translateX(-50%)";
        break;
      case "top":
        style.bottom = window.innerHeight - highlightRect.top + padding;
        style.left = highlightRect.left + highlightRect.width / 2;
        style.transform = "translateX(-50%)";
        break;
      case "right":
        style.top = highlightRect.top + highlightRect.height / 2;
        style.left = highlightRect.right + padding;
        style.transform = "translateY(-50%)";
        break;
      case "left":
        style.top = highlightRect.top + highlightRect.height / 2;
        style.right = window.innerWidth - highlightRect.left + padding;
        style.transform = "translateY(-50%)";
        break;
    }

    return style;
  };

  return (
    <>
      {/* Overlay with highlight cutout */}
      <div className="fixed inset-0 z-[100] pointer-events-none">
        <svg className="w-full h-full">
          <defs>
            <mask id="tutorial-mask">
              <rect width="100%" height="100%" fill="white" />
              {highlightRect && (
                <rect
                  x={highlightRect.left - 4}
                  y={highlightRect.top - 4}
                  width={highlightRect.width + 8}
                  height={highlightRect.height + 8}
                  rx="8"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.7)"
            mask="url(#tutorial-mask)"
            className="pointer-events-auto"
            onClick={handleComplete}
          />
        </svg>

        {/* Highlight border */}
        {highlightRect && (
          <div
            className="absolute border-2 border-primary rounded-lg pointer-events-none animate-pulse"
            style={{
              left: highlightRect.left - 4,
              top: highlightRect.top - 4,
              width: highlightRect.width + 8,
              height: highlightRect.height + 8,
            }}
          />
        )}
      </div>

      {/* Tutorial card */}
      <div
        className="fixed z-[101] bg-background border border-border rounded-lg shadow-2xl p-6 max-w-md pointer-events-auto"
        style={getTooltipPosition()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.description}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 ml-2"
            onClick={handleComplete}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {currentStep + 1} / {steps.length}
          </div>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="outline" size="sm" onClick={handlePrev}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                上一步
              </Button>
            )}
            <Button size="sm" onClick={handleNext}>
              {currentStep < steps.length - 1 ? (
                <>
                  下一步
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              ) : (
                "完成"
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
