import { Canvas as FabricCanvas, FabricObject } from "fabric";

// Layer type definitions and their z-index ranges
export type LayerType = 'scene' | 'character' | 'prop' | 'effect' | 'composite';

// Each type has a base z-index range (100 slots per type)
const LAYER_TYPE_RANGES: Record<LayerType, { min: number; max: number }> = {
  scene: { min: 0, max: 99 },
  character: { min: 100, max: 199 },
  prop: { min: 200, max: 299 },
  effect: { min: 300, max: 399 },
  composite: { min: 400, max: 499 },
};

/**
 * Get the layer type from an object
 */
export const getObjectLayerType = (obj: FabricObject): LayerType => {
  const data = (obj as any).data;
  if (data?.elementType) {
    return data.elementType as LayerType;
  }
  // Default to prop if no type is set
  return 'prop';
};

/**
 * Set the layer type for an object
 */
export const setObjectLayerType = (obj: FabricObject, type: LayerType) => {
  const data = (obj as any).data || {};
  (obj as any).data = { ...data, elementType: type };
};

/**
 * Sort all objects in the canvas by their layer type
 * This ensures the correct stacking order: scene < character < prop < effect < composite
 */
export const sortCanvasByLayerType = (canvas: FabricCanvas) => {
  const objects = canvas.getObjects();
  
  // Separate frame (workframe) from regular objects
  const frame = objects.find(obj => obj.selectable === false && obj.evented === false);
  const regularObjects = objects.filter(obj => obj.selectable !== false || obj.evented !== false);
  
  // Group objects by type
  const objectsByType: Record<LayerType, FabricObject[]> = {
    scene: [],
    character: [],
    prop: [],
    effect: [],
    composite: [],
  };
  
  regularObjects.forEach(obj => {
    const type = getObjectLayerType(obj);
    objectsByType[type].push(obj);
  });
  
  // Clear canvas
  canvas.remove(...objects);
  
  // Re-add frame first (always at bottom)
  if (frame) {
    canvas.add(frame);
  }
  
  // Add objects in the correct order
  const typeOrder: LayerType[] = ['scene', 'character', 'prop', 'effect', 'composite'];
  typeOrder.forEach(type => {
    objectsByType[type].forEach(obj => {
      canvas.add(obj);
    });
  });
  
  canvas.renderAll();
};

/**
 * Insert an object at the correct position based on its layer type
 */
export const insertObjectWithLayerType = (canvas: FabricCanvas, obj: FabricObject, type?: LayerType) => {
  // Set type if provided
  if (type) {
    setObjectLayerType(obj, type);
  }
  
  const objectType = getObjectLayerType(obj);
  const objects = canvas.getObjects();
  
  // Find the insertion index
  let insertIndex = 0;
  
  // Skip the frame (should always be at index 0)
  const frame = objects.find(obj => obj.selectable === false && obj.evented === false);
  if (frame) {
    insertIndex = 1;
  }
  
  // Find the last object of the same or lower type
  for (let i = insertIndex; i < objects.length; i++) {
    const currentObj = objects[i];
    const currentType = getObjectLayerType(currentObj);
    const currentRange = LAYER_TYPE_RANGES[currentType];
    const targetRange = LAYER_TYPE_RANGES[objectType];
    
    if (currentRange.min < targetRange.min) {
      insertIndex = i + 1;
    } else if (currentRange.min === targetRange.min) {
      // Same type, insert after
      insertIndex = i + 1;
    } else {
      // Found a higher type, insert before
      break;
    }
  }
  
  canvas.insertAt(insertIndex, obj);
  canvas.renderAll();
};

/**
 * Move an object within its type range (up or down)
 */
export const moveObjectInLayer = (canvas: FabricCanvas, obj: FabricObject, direction: 'up' | 'down') => {
  const objectType = getObjectLayerType(obj);
  const objects = canvas.getObjects();
  const currentIndex = objects.indexOf(obj);
  
  if (currentIndex === -1) return;
  
  // Find objects of the same type
  const sameTypeIndices: number[] = [];
  objects.forEach((o, i) => {
    if (getObjectLayerType(o) === objectType) {
      sameTypeIndices.push(i);
    }
  });
  
  const positionInType = sameTypeIndices.indexOf(currentIndex);
  
  if (direction === 'up' && positionInType < sameTypeIndices.length - 1) {
    // Swap with next same-type object
    const targetIndex = sameTypeIndices[positionInType + 1];
    canvas.remove(obj);
    canvas.insertAt(targetIndex, obj);
  } else if (direction === 'down' && positionInType > 0) {
    // Swap with previous same-type object
    const targetIndex = sameTypeIndices[positionInType - 1];
    canvas.remove(obj);
    canvas.insertAt(targetIndex, obj);
  }
  
  canvas.renderAll();
};

/**
 * Move an object to the top or bottom within its type range
 */
export const moveObjectToEdgeInLayer = (canvas: FabricCanvas, obj: FabricObject, edge: 'top' | 'bottom') => {
  const objectType = getObjectLayerType(obj);
  const objects = canvas.getObjects();
  
  // Find the range of same-type objects
  let firstSameTypeIndex = -1;
  let lastSameTypeIndex = -1;
  
  objects.forEach((o, i) => {
    if (getObjectLayerType(o) === objectType) {
      if (firstSameTypeIndex === -1) firstSameTypeIndex = i;
      lastSameTypeIndex = i;
    }
  });
  
  if (firstSameTypeIndex === -1) return;
  
  const targetIndex = edge === 'top' ? lastSameTypeIndex : firstSameTypeIndex;
  canvas.remove(obj);
  canvas.insertAt(targetIndex, obj);
  canvas.renderAll();
};
