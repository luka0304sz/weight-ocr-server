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
  // Remove whitespace and normalize
  const normalized = text.replace(/\s+/g, ' ').trim();

  // Try to find numeric patterns (including decimals)
  // Patterns: "123.45", "123,45", "123", etc.
  const patterns = [
    /(\d+[.,]\d+)/g,  // Decimal numbers
    /(\d+)/g,         // Whole numbers
  ];

  const matches: string[] = [];
  for (const pattern of patterns) {
    const found = normalized.match(pattern);
    if (found) {
      matches.push(...found);
    }
  }

  if (matches.length === 0) {
    return { value: normalized, confidence: 0.5 };
  }

  // Take the first significant number found
  // Normalize decimal separator to dot
  const weight = matches[0].replace(',', '.');

  return { value: weight, confidence: 0.9 };
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
