import { SAM2Encoder } from './encoder';
import { SAM2Decoder, SAM2Point } from './decoder';
import * as ort from 'onnxruntime-web';

export type { SAM2Point };

export class InteractiveSAM2 {
  private encoder: SAM2Encoder;
  private decoder: SAM2Decoder;
  private embedding: ort.Tensor | null = null;
  private imageWidth: number = 0;
  private imageHeight: number = 0;
  private isInitialized: boolean = false;

  constructor() {
    this.encoder = new SAM2Encoder();
    this.decoder = new SAM2Decoder();
  }

  async initialize() {
    if (this.isInitialized) return;
    
    await Promise.all([
      this.encoder.initialize(),
      this.decoder.initialize()
    ]);
    
    this.isInitialized = true;
  }

  async encodeImage(imageData: ImageData) {
    this.imageWidth = imageData.width;
    this.imageHeight = imageData.height;
    this.embedding = await this.encoder.encode(imageData);
  }

  async predictMask(points: SAM2Point[]): Promise<{ masks: Float32Array; width: number; height: number } | null> {
    if (!this.embedding) {
      throw new Error('Image not encoded yet');
    }

    // Scale points to 1024x1024 (SAM2 input size)
    const scaledPoints: SAM2Point[] = points.map(point => ({
      x: (point.x / this.imageWidth) * 1024,
      y: (point.y / this.imageHeight) * 1024,
      type: point.type
    }));

    const results = await this.decoder.predict(this.embedding, scaledPoints);
    
    if (!results.masks) return null;

    const masks = results.masks.data as Float32Array;
    const [, , height, width] = results.masks.dims;

    return {
      masks,
      width,
      height
    };
  }

  drawMaskOnCanvas(
    canvas: HTMLCanvasElement,
    masks: Float32Array,
    maskWidth: number,
    maskHeight: number,
    color: string = 'rgba(0, 255, 0, 0.5)'
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous mask
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Create ImageData for the mask
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;

    // Parse color
    const rgba = this.parseColor(color);

    // Scale mask to canvas size
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const maskX = Math.floor((x / canvas.width) * maskWidth);
        const maskY = Math.floor((y / canvas.height) * maskHeight);
        const maskIdx = maskY * maskWidth + maskX;
        const maskValue = masks[maskIdx];

        if (maskValue > 0) {
          const idx = (y * canvas.width + x) * 4;
          data[idx] = rgba.r;
          data[idx + 1] = rgba.g;
          data[idx + 2] = rgba.b;
          data[idx + 3] = rgba.a;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  private parseColor(color: string): { r: number; g: number; b: number; a: number } {
    // Simple rgba parser
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3]),
        a: match[4] ? Math.floor(parseFloat(match[4]) * 255) : 255
      };
    }
    return { r: 0, g: 255, b: 0, a: 128 };
  }

  extractMaskedImage(
    sourceCanvas: HTMLCanvasElement,
    masks: Float32Array,
    maskWidth: number,
    maskHeight: number
  ): HTMLCanvasElement {
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = sourceCanvas.width;
    outputCanvas.height = sourceCanvas.height;
    const ctx = outputCanvas.getContext('2d')!;

    // Draw original image
    ctx.drawImage(sourceCanvas, 0, 0);

    // Apply mask to alpha channel
    const imageData = ctx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
    const data = imageData.data;

    for (let y = 0; y < outputCanvas.height; y++) {
      for (let x = 0; x < outputCanvas.width; x++) {
        const maskX = Math.floor((x / outputCanvas.width) * maskWidth);
        const maskY = Math.floor((y / outputCanvas.height) * maskHeight);
        const maskIdx = maskY * maskWidth + maskX;
        const maskValue = masks[maskIdx];

        const idx = (y * outputCanvas.width + x) * 4;
        data[idx + 3] = maskValue > 0 ? 255 : 0;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return outputCanvas;
  }
}
