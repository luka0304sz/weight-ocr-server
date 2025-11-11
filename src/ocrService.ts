import { createWorker, PSM } from 'tesseract.js';

export interface WeightRecognitionResult {
  weight: string;
  confidence: number;
  rawText: string;
}

/**
 * Extracts weight value from OCR text
 * Looks for numeric patterns that might represent weight
 */
function extractWeightFromText(text: string): { value: string; confidence: number } {
  // Remove extra whitespace and normalize
  const normalized = text.replace(/\s+/g, ' ').trim();

  // First, try to find decimal numbers (highest priority)
  const decimalPattern = /(\d+[.,]\d+)/g;
  const decimalMatches = normalized.match(decimalPattern);

  if (decimalMatches && decimalMatches.length > 0) {
    // If there are decimal numbers, pick the longest one
    const longest = decimalMatches.reduce((a, b) => a.length >= b.length ? a : b);
    return { value: longest.replace(',', '.'), confidence: 0.95 };
  }

  // If no decimals, find all whole numbers
  const wholePattern = /\d+/g;
  const wholeMatches = normalized.match(wholePattern);

  if (!wholeMatches || wholeMatches.length === 0) {
    return { value: normalized, confidence: 0.5 };
  }

  // Pick the longest number (most likely to be the weight)
  // For "1\n1626", this will pick "1626" instead of "1"
  const longestNumber = wholeMatches.reduce((a, b) => a.length >= b.length ? a : b);

  return { value: longestNumber, confidence: 0.9 };
}

/**
 * Performs OCR on an image to recognize weight display
 */
export async function recognizeWeight(imagePath: string): Promise<WeightRecognitionResult> {
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  try {
    // Configure Tesseract for better number recognition
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789.,kg ',
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK, // Assume single uniform block of text
    });

    const { data } = await worker.recognize(imagePath);

    console.log('Raw OCR text:', data.text);
    console.log('Confidence:', data.confidence);

    const extracted = extractWeightFromText(data.text);

    return {
      weight: extracted.value,
      confidence: (data.confidence * extracted.confidence) / 100,
      rawText: data.text.trim(),
    };
  } finally {
    await worker.terminate();
  }
}
