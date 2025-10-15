import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas as FabricCanvas } from 'fabric';
import { InteractiveSAM2, SAM2Point } from '@/lib/sam2/interactive';
import { Button } from '@/components/ui/button';
import { X, MousePointer2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface InteractiveSAMProps {
  canvas: FabricCanvas | null;
  onExit: () => void;
  onExtract: (canvas: HTMLCanvasElement, elementType: 'character' | 'prop' | 'scene') => void;
}

export const InteractiveSAM = ({ canvas, onExit, onExtract }: InteractiveSAMProps) => {
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [sam, setSam] = useState<InteractiveSAM2 | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<SAM2Point[]>([]);
  const [isHovering, setIsHovering] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);

  // Initialize SAM2
  useEffect(() => {
    const init = async () => {
      try {
        toast.info('正在加载 SAM2 模型...');
        const samInstance = new InteractiveSAM2();
        await samInstance.initialize();
        setSam(samInstance);
        
        // Encode the selected image
        const activeObject = canvas?.getActiveObject();
        if (activeObject && activeObject.type === 'image') {
          const imageDataURL = (activeObject as any).toDataURL({
            format: 'png',
            quality: 1
          });
          
          // Load image and get ImageData
          const img = await loadImage(imageDataURL);
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          const ctx = tempCanvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          
          await samInstance.encodeImage(imageData);
          setIsInitialized(true);
          toast.success('模型已加载，点击图片提取物体');
        }
      } catch (error) {
        console.error('Failed to initialize SAM:', error);
        toast.error('模型加载失败');
      }
    };

    init();
  }, [canvas]);

  // Handle mouse move for hover highlight
  const handleMouseMove = useCallback(async (e: MouseEvent) => {
    if (!sam || !isInitialized || !overlayCanvasRef.current || !canvas) return;
    
    const activeObject = canvas.getActiveObject();
    if (!activeObject) return;

    const rect = overlayCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Clear previous timeout
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
    }

    // Debounce hover prediction
    hoverTimeoutRef.current = window.setTimeout(async () => {
      try {
        setIsHovering(true);
        const points: SAM2Point[] = [{ x, y, type: 1 }];
        const result = await sam.predictMask(points);
        
        if (result && overlayCanvasRef.current) {
          sam.drawMaskOnCanvas(
            overlayCanvasRef.current,
            result.masks,
            result.width,
            result.height,
            'rgba(0, 255, 255, 0.3)'
          );
        }
      } catch (error) {
        console.error('Hover prediction error:', error);
      } finally {
        setIsHovering(false);
      }
    }, 300); // 300ms debounce
  }, [sam, isInitialized, canvas]);

  // Handle click to extract object
  const handleClick = useCallback(async (e: MouseEvent) => {
    if (!sam || !isInitialized || !overlayCanvasRef.current || !canvas) return;
    
    const activeObject = canvas.getActiveObject();
    if (!activeObject) return;

    const rect = overlayCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    try {
      toast.info('正在提取物体...');
      
      // Get mask for clicked point
      const points: SAM2Point[] = [{ x, y, type: 1 }];
      const result = await sam.predictMask(points);
      
      if (!result) {
        toast.error('未检测到物体');
        return;
      }

      // Extract the masked object
      const imageDataURL = (activeObject as any).toDataURL({
        format: 'png',
        quality: 1
      });
      const img = await loadImage(imageDataURL);
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = img.width;
      sourceCanvas.height = img.height;
      const ctx = sourceCanvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      
      const extractedCanvas = sam.extractMaskedImage(
        sourceCanvas,
        result.masks,
        result.width,
        result.height
      );

      // Convert to blob for classification
      const blob = await new Promise<Blob>((resolve, reject) => {
        extractedCanvas.toBlob(
          (b) => b ? resolve(b) : reject(new Error('Failed to create blob')),
          'image/png'
        );
      });

      // Classify the object
      toast.info('正在识别物体类型...');
      const elementType = await classifyObject(blob);
      
      // Pass extracted canvas to parent
      onExtract(extractedCanvas, elementType);
      
      toast.success(`已提取物体 (${elementType})`);
    } catch (error) {
      console.error('Extract error:', error);
      toast.error('提取失败');
    }
  }, [sam, isInitialized, canvas, onExtract]);

  // Set up event listeners
  useEffect(() => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas || !isInitialized) return;

    overlayCanvas.addEventListener('mousemove', handleMouseMove);
    overlayCanvas.addEventListener('click', handleClick);

    return () => {
      overlayCanvas.removeEventListener('mousemove', handleMouseMove);
      overlayCanvas.removeEventListener('click', handleClick);
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, [handleMouseMove, handleClick, isInitialized]);

  // Position and size the overlay canvas
  useEffect(() => {
    if (!canvas || !overlayCanvasRef.current) return;

    const activeObject = canvas.getActiveObject();
    if (!activeObject) return;

    const canvasElement = canvas.getElement();
    const rect = canvasElement.getBoundingClientRect();
    
    overlayCanvasRef.current.width = rect.width;
    overlayCanvasRef.current.height = rect.height;
    overlayCanvasRef.current.style.left = `${rect.left}px`;
    overlayCanvasRef.current.style.top = `${rect.top}px`;
  }, [canvas]);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Overlay Canvas */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute pointer-events-auto cursor-crosshair"
        style={{ background: 'transparent' }}
      />
      
      {/* Control Panel */}
      <div className="fixed top-4 right-4 flex gap-2 pointer-events-auto">
        <div className="bg-background border rounded-lg px-4 py-2 shadow-lg flex items-center gap-2">
          <MousePointer2 className="h-4 w-4" />
          <span className="text-sm font-medium">
            {isHovering ? '检测中...' : '点击提取物体'}
          </span>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={onExit}
        >
          <X className="h-4 w-4 mr-2" />
          退出
        </Button>
      </div>
    </div>
  );
};

// Helper functions
const loadImage = (dataUrl: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
};

const classifyObject = async (imageBlob: Blob): Promise<'character' | 'prop' | 'scene'> => {
  try {
    const reader = new FileReader();
    const imageDataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(imageBlob);
    });
    
    const { data, error } = await supabase.functions.invoke('classify-object', {
      body: { imageUrl: imageDataUrl }
    });
    
    if (error) throw error;
    return data.elementType;
  } catch (error) {
    console.error('Classification error:', error);
    return 'prop';
  }
};
