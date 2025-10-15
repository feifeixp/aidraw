import { pipeline, RawImage } from '@huggingface/transformers';
import { supabase } from '@/integrations/supabase/client';

let segmenter: any = null;

export const initializeSegmenter = async () => {
  if (!segmenter) {
    console.log('Initializing SAM segmenter...');
    segmenter = await pipeline(
      'image-segmentation',
      'Xenova/slimsam-77-uniform',
      { device: 'webgpu' }
    );
    console.log('Segmenter initialized');
  }
  return segmenter;
};

export const segmentImage = async (imageElement: HTMLImageElement): Promise<Array<{
  mask: any;
  score: number;
  label: string;
}>> => {
  try {
    const segmenterInstance = await initializeSegmenter();
    
    // Convert image to canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    
    canvas.width = imageElement.naturalWidth;
    canvas.height = imageElement.naturalHeight;
    ctx.drawImage(imageElement, 0, 0);
    
    // Get image data URL
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    
    console.log('Segmenting image...');
    const results = await segmenterInstance(imageDataUrl);
    console.log('Segmentation results:', results.length, 'objects found');
    
    return results;
  } catch (error) {
    console.error('Error segmenting image:', error);
    throw error;
  }
};

export const extractObjectFromMask = async (
  originalImage: HTMLImageElement,
  mask: any
): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  canvas.width = originalImage.naturalWidth;
  canvas.height = originalImage.naturalHeight;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error('Could not get canvas context');
  
  // Draw original image
  ctx.drawImage(originalImage, 0, 0);
  
  // Apply mask to alpha channel
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  for (let i = 0; i < mask.data.length; i++) {
    const alpha = Math.round(mask.data[i] * 255);
    data[i * 4 + 3] = alpha;
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      },
      'image/png',
      1.0
    );
  });
};

export const classifyObject = async (imageBlob: Blob): Promise<'character' | 'prop' | 'scene'> => {
  try {
    // Convert blob to data URL
    const reader = new FileReader();
    const imageDataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(imageBlob);
    });
    
    console.log('Classifying object...');
    const { data, error } = await supabase.functions.invoke('classify-object', {
      body: { imageUrl: imageDataUrl }
    });
    
    if (error) {
      console.error('Classification error:', error);
      throw error;
    }
    
    console.log('Classification result:', data.elementType);
    return data.elementType;
  } catch (error) {
    console.error('Error classifying object:', error);
    // Default to prop if classification fails
    return 'prop';
  }
};
