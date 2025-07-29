// src/colorExtractor.js
// Utility for extracting the three most prevalent colors from images

/**
 * Extracts the three most prevalent colors from an image
 * @param {File|string} imageSource - Image file or URL
 * @returns {Promise<string[]>} Array of 3 hex color codes
 */
export async function extractDominantColors(imageSource) {
  console.log('Starting color extraction for:', typeof imageSource === 'string' ? 'URL' : 'File');
  
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        console.log('Image loaded, dimensions:', img.width, 'x', img.height);
        
        // Set canvas size to a reasonable size for processing
        const maxSize = 200;
        const ratio = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        
        console.log('Canvas size for processing:', canvas.width, 'x', canvas.height);
        
        // Draw image to canvas
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        console.log('Processing', data.length / 4, 'pixels');
        
        // Extract colors and count frequencies
        const colorMap = new Map();
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          
          // Skip transparent pixels
          if (a < 128) continue;
          
          // Quantize colors to reduce similar colors
          const quantizedR = Math.round(r / 32) * 32;
          const quantizedG = Math.round(g / 32) * 32;
          const quantizedB = Math.round(b / 32) * 32;
          
          // Filter for bright colors only
          const brightness = quantizedR + quantizedG + quantizedB;
          const minBrightness = 300; // Increased minimum total RGB value for brighter colors
          const minChannelValue = 80; // Increased minimum individual RGB channel value
          
          // Skip dark colors (low brightness)
          if (brightness < minBrightness) continue;
          
          // Skip colors where all channels are too low (muted colors)
          if (quantizedR < minChannelValue && quantizedG < minChannelValue && quantizedB < minChannelValue) continue;
          
          // Skip colors that are too gray (all channels too similar)
          const maxDiff = Math.max(quantizedR, quantizedG, quantizedB) - Math.min(quantizedR, quantizedG, quantizedB);
          if (maxDiff < 50) continue; // Skip if channels are too similar (grayish)
          
          const colorKey = `${quantizedR},${quantizedG},${quantizedB}`;
          colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
        }
        
        console.log('Found', colorMap.size, 'unique bright quantized colors');
        
        // Convert to array and calculate color scores
        const colorArray = Array.from(colorMap.entries())
          .map(([colorKey, count]) => {
            const [r, g, b] = colorKey.split(',').map(Number);
            const brightness = r + g + b;
            const saturation = Math.max(r, g, b) - Math.min(r, g, b);
            
            // Calculate color score based on frequency, brightness, and saturation
            const frequencyScore = count;
            const brightnessScore = brightness / 765; // Normalize to 0-1 (765 = 255*3)
            const saturationScore = saturation / 255; // Normalize to 0-1
            
            const totalScore = frequencyScore * 0.5 + brightnessScore * 0.3 + saturationScore * 0.2;
            
            return {
              color: rgbToHex(r, g, b),
              count,
              rgb: [r, g, b],
              brightness,
              saturation,
              score: totalScore
            };
          })
          .sort((a, b) => b.score - a.score);
        
        console.log('Top colors by score:', colorArray.slice(0, 5).map(c => `${c.color} (score: ${c.score.toFixed(2)})`));
        
        // Filter out very similar colors and get top 6 for better selection
        const uniqueColors = [];
        for (const color of colorArray) {
          if (uniqueColors.length >= 6) break;
          
          // Check if this color is too similar to already selected colors
          const isSimilar = uniqueColors.some(existing => 
            colorDistance(color.rgb, existing.rgb) < 80
          );
          
          if (!isSimilar) {
            uniqueColors.push(color);
          }
        }
        
        // Assign colors to roles: Primary, Secondary, Highlight
        let primaryColor = null;
        let secondaryColor = null;
        let highlightColor = null;
        
        if (uniqueColors.length >= 3) {
          // Primary: Highest frequency/brightness (most prominent)
          primaryColor = uniqueColors[0].color;
          
          // Secondary: Good balance of frequency and saturation
          secondaryColor = uniqueColors[1].color;
          
          // Highlight: Most saturated/vibrant color
          const sortedBySaturation = [...uniqueColors].sort((a, b) => b.saturation - a.saturation);
          highlightColor = sortedBySaturation[0].color;
          
          // Ensure highlight is different from primary and secondary
          if (highlightColor === primaryColor || highlightColor === secondaryColor) {
            highlightColor = uniqueColors[2].color;
          }
        } else if (uniqueColors.length === 2) {
          primaryColor = uniqueColors[0].color;
          secondaryColor = uniqueColors[1].color;
          highlightColor = uniqueColors[0].color; // Use primary as highlight
        } else if (uniqueColors.length === 1) {
          primaryColor = uniqueColors[0].color;
          secondaryColor = uniqueColors[0].color;
          highlightColor = uniqueColors[0].color;
        }
        
        // Use bright fallbacks if needed
        const brightFallbacks = ['#FF6B6B', '#4ECDC4', '#45B7D1']; // Bright red, teal, blue
        if (!primaryColor) primaryColor = brightFallbacks[0];
        if (!secondaryColor) secondaryColor = brightFallbacks[1];
        if (!highlightColor) highlightColor = brightFallbacks[2];
        
        const result = [primaryColor, secondaryColor, highlightColor];
        
        console.log('Final extracted colors:', result);
        resolve(result);
        
      } catch (error) {
        console.error('Error processing image:', error);
        // Return bright default colors if processing fails
        resolve(['#FF6B6B', '#4ECDC4', '#45B7D1']);
      }
    };
    
    img.onerror = () => {
      console.error('Failed to load image for color extraction');
      // Return bright default colors if image loading fails
      resolve(['#FF6B6B', '#4ECDC4', '#45B7D1']);
    };
    
    // Set image source
    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      img.src = URL.createObjectURL(imageSource);
    }
  });
}

/**
 * Convert RGB values to hex color
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @returns {string} Hex color code
 */
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Calculate color distance using Euclidean distance in RGB space
 * @param {number[]} rgb1 - First RGB color [r, g, b]
 * @param {number[]} rgb2 - Second RGB color [r, g, b]
 * @returns {number} Distance between colors
 */
function colorDistance(rgb1, rgb2) {
  return Math.sqrt(
    Math.pow(rgb1[0] - rgb2[0], 2) +
    Math.pow(rgb1[1] - rgb2[1], 2) +
    Math.pow(rgb1[2] - rgb2[2], 2)
  );
} 