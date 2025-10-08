/**
 * Intelligently detect and remove background color from an image
 * Samples the four corners to determine the background color
 */
export const convertMagentaToTransparent = async (imageUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      // Draw the image
      ctx.drawImage(img, 0, 0);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Sample the four corners to detect background color
      const sampleSize = 10; // Sample a 10x10 area from each corner
      const corners = [
        { x: 0, y: 0 }, // Top-left
        { x: canvas.width - sampleSize, y: 0 }, // Top-right
        { x: 0, y: canvas.height - sampleSize }, // Bottom-left
        { x: canvas.width - sampleSize, y: canvas.height - sampleSize } // Bottom-right
      ];
      
      // Collect color samples from corners
      const colorSamples: { r: number; g: number; b: number }[] = [];
      
      corners.forEach(corner => {
        for (let dy = 0; dy < sampleSize; dy++) {
          for (let dx = 0; dx < sampleSize; dx++) {
            const x = Math.min(corner.x + dx, canvas.width - 1);
            const y = Math.min(corner.y + dy, canvas.height - 1);
            const i = (y * canvas.width + x) * 4;
            colorSamples.push({
              r: data[i],
              g: data[i + 1],
              b: data[i + 2]
            });
          }
        }
      });
      
      // Calculate average background color
      const avgColor = colorSamples.reduce(
        (acc, color) => ({
          r: acc.r + color.r / colorSamples.length,
          g: acc.g + color.g / colorSamples.length,
          b: acc.b + color.b / colorSamples.length
        }),
        { r: 0, g: 0, b: 0 }
      );
      
      console.log('Detected background color:', avgColor);
      
      // Convert pixels similar to background color to transparent
      // Use a higher tolerance for better results
      const tolerance = 40;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Calculate color distance from background
        const distance = Math.sqrt(
          Math.pow(r - avgColor.r, 2) +
          Math.pow(g - avgColor.g, 2) +
          Math.pow(b - avgColor.b, 2)
        );
        
        // If color is close to background, make it transparent
        if (distance < tolerance) {
          data[i + 3] = 0;
        }
      }
      
      // Put the modified data back
      ctx.putImageData(imageData, 0, 0);
      
      // Convert to blob URL
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(URL.createObjectURL(blob));
        } else {
          reject(new Error('Failed to create blob'));
        }
      }, 'image/png');
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
};
