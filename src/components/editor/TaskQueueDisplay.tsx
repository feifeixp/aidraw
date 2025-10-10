import { Loader2, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface Task {
  id: string;
  name: string;
  status: "processing" | "completed";
}

interface TaskQueueDisplayProps {
  currentTask: Task | null;
}

export const TaskQueueDisplay = ({ currentTask }: TaskQueueDisplayProps) => {
  if (!currentTask) return null;

  return (
    <Card className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-3 shadow-lg bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-primary/20">
      <div className="flex items-center gap-3 min-w-[300px]">
        {currentTask.status === "processing" ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">{currentTask.name}</p>
              <Progress className="h-1 mt-1" value={undefined} />
            </div>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <p className="text-sm font-medium text-green-500">{currentTask.name}完成</p>
          </>
        )}
      </div>
    </Card>
  );
};
