import 'dotenv/config';
import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { recognizeWeight } from './ocrService';

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Webhook notification function
async function sendWebhook(data: any): Promise<void> {
  if (!WEBHOOK_URL) {
    return; // Webhook not configured
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (WEBHOOK_API_KEY) {
      headers['x-api-key'] = WEBHOOK_API_KEY;
    }

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.error(`Webhook failed: ${response.status} ${response.statusText}`);
    } else {
      console.log('Webhook sent successfully');
    }
  } catch (error) {
    console.error('Webhook error:', error);
  }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Include timestamp in filename: weight-TIMESTAMP-RANDOM.ext
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    cb(null, `weight-${timestamp}-${random}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|bmp|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Weight OCR Server',
    version: '1.0.0',
    endpoints: {
      upload: 'POST /api/upload - Upload image of weight display',
      health: 'GET /health - Health check',
    },
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/upload', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided',
      });
    }

    const receivedAt = new Date().toISOString();
    console.log(`Processing uploaded file: ${req.file.filename}`);

    // Extract all metadata generically - accept any fields from request body
    const metadata = { ...req.body };

    console.log('Received metadata:', metadata);

    // Perform OCR on the uploaded image
    const result = await recognizeWeight(req.file.path);

    // Generate public URL for the image
    const imageUrl = `${PUBLIC_URL}/uploads/${req.file.filename}`;

    // Prepare response data
    const responseData = {
      weight: result.weight,
      confidence: result.confidence,
      rawText: result.rawText,
      filename: req.file.filename,
      imageUrl,
      receivedAt,
      metadata,
    };

    // Send webhook notification if configured
    if (WEBHOOK_URL) {
      sendWebhook({
        ...responseData,
        webhookSentAt: new Date().toISOString(),
      }).catch(err => console.error('Webhook failed:', err));
    }

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process image',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Serve uploaded images
app.get('/uploads/:filename', (req: Request, res: Response) => {
  const filename = req.params.filename;
  const filepath = path.join(uploadsDir, filename);

  // Security: Prevent directory traversal
  if (!filepath.startsWith(uploadsDir)) {
    return res.status(403).json({
      success: false,
      error: 'Access denied',
    });
  }

  // Check if file exists
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({
      success: false,
      error: 'Image not found',
    });
  }

  // Send file
  res.sendFile(filepath);
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Weight OCR Server running on port ${PORT}`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);
  console.log(`🔗 API endpoint: http://localhost:${PORT}/api/upload`);
  console.log(`🖼️  Image serving: ${PUBLIC_URL}/uploads/:filename`);
  if (WEBHOOK_URL) {
    console.log(`🔔 Webhook enabled: ${WEBHOOK_URL}`);
    if (WEBHOOK_API_KEY) {
      console.log(`🔑 Webhook API key: configured`);
    }
  } else {
    console.log(`🔕 Webhook: not configured`);
  }
});
