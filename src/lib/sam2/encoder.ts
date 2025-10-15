import * as ort from 'onnxruntime-web';

// Using SAM2 tiny model for faster performance
const ENCODER_MODEL_URL = 'https://storage.googleapis.com/lb-artifacts-testing-public/sam2/sam2_hiera_tiny.encoder.onnx';

export class SAM2Encoder {
  private session: ort.InferenceSession | null = null;
  public lastEmbeddings: ort.Tensor | null = null;

  async initialize() {
    if (this.session) return;
    
    console.log('Loading SAM2 encoder model...');
    this.session = await ort.InferenceSession.create(ENCODER_MODEL_URL, {
      executionProviders: ['wasm']
    });
    console.log('Encoder model loaded successfully');
  }

  private imageDataToTensor(imageData: ImageData): ort.Tensor {
    const { width, height } = imageData;
    const targetSize = 1024;
    
    // Create a canvas to resize the image
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d')!;
    
    // Draw resized image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);
    
    ctx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, targetSize, targetSize);
    const resizedImageData = ctx.getImageData(0, 0, targetSize, targetSize);
    
    // Normalize to [-1, 1] and rearrange to CHW format
    const inputArray = new Float32Array(3 * targetSize * targetSize);
    const data = resizedImageData.data;
    
    for (let i = 0; i < targetSize * targetSize; i++) {
      inputArray[i] = (data[i * 4] / 255.0) * 2 - 1; // R channel
      inputArray[i + targetSize * targetSize] = (data[i * 4 + 1] / 255.0) * 2 - 1; // G channel
      inputArray[i + 2 * targetSize * targetSize] = (data[i * 4 + 2] / 255.0) * 2 - 1; // B channel
    }
    
    return new ort.Tensor('float32', inputArray, [1, 3, targetSize, targetSize]);
  }

  async encode(imageData: ImageData): Promise<ort.Tensor> {
    if (!this.session) {
      throw new Error('Encoder not initialized');
    }
    
    const tensor = this.imageDataToTensor(imageData);
    const feeds = { image: tensor };
    const results = await this.session.run(feeds);
    this.lastEmbeddings = results.image_embed;
    
    return this.lastEmbeddings;
  }
}
