import * as ort from 'onnxruntime-web';

const DECODER_MODEL_URL = 'https://storage.googleapis.com/lb-artifacts-testing-public/sam2/sam2_hiera_tiny.decoder.onnx';

export interface SAM2Point {
  x: number;
  y: number;
  type: number; // 1 for positive (foreground), 0 for negative (background)
}

export class SAM2Decoder {
  private session: ort.InferenceSession | null = null;

  async initialize() {
    if (this.session) return;
    
    console.log('Loading SAM2 decoder model...');
    this.session = await ort.InferenceSession.create(DECODER_MODEL_URL, {
      executionProviders: ['wasm']
    });
    console.log('Decoder model loaded successfully');
  }

  private prepareInputs(embedding: ort.Tensor, points: SAM2Point[]) {
    const numLabels = 1;
    const numPoints = points.length;
    const pointCoordsData: number[] = [];
    const pointLabelsData: number[] = [];

    for (const point of points) {
      pointCoordsData.push(point.x, point.y);
      pointLabelsData.push(point.type);
    }

    return {
      image_embed: embedding,
      point_coords: new ort.Tensor(
        'float32',
        Float32Array.from(pointCoordsData),
        [numLabels, numPoints, 2]
      ),
      point_labels: new ort.Tensor(
        'float32',
        Float32Array.from(pointLabelsData),
        [numLabels, numPoints]
      ),
      mask_input: new ort.Tensor(
        'float32',
        new Float32Array(numLabels * 1 * 256 * 256),
        [numLabels, 1, 256, 256]
      ),
      has_mask_input: new ort.Tensor('float32', new Float32Array([0.0]), [numLabels]),
      high_res_feats_0: new ort.Tensor(
        'float32',
        new Float32Array(1 * 32 * 256 * 256),
        [1, 32, 256, 256]
      ),
      high_res_feats_1: new ort.Tensor(
        'float32',
        new Float32Array(1 * 64 * 128 * 128),
        [1, 64, 128, 128]
      ),
    };
  }

  async predict(embedding: ort.Tensor, inputPoints: SAM2Point[]) {
    if (!this.session) {
      throw new Error('Decoder not initialized');
    }

    const inputs = this.prepareInputs(embedding, inputPoints);
    const results = await this.session.run(inputs);
    
    return results;
  }
}
