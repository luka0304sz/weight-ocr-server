import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { recognizeWeight } from './ocrService';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `weight-${uniqueSuffix}${path.extname(file.originalname)}`);
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

    console.log(`Processing uploaded file: ${req.file.filename}`);

    // Extract additional metadata from request body
    const metadata = {
      timestamp: req.body.timestamp || null,
      userId: req.body.userId || null,
      location: req.body.location || null,
      deviceId: req.body.deviceId || null,
      notes: req.body.notes || null,
      // Any other custom fields the client sends
      ...Object.keys(req.body)
        .filter(key => !['timestamp', 'userId', 'location', 'deviceId', 'notes'].includes(key))
        .reduce((acc, key) => ({ ...acc, [key]: req.body[key] }), {}),
    };

    console.log('Received metadata:', metadata);

    // Perform OCR on the uploaded image
    const result = await recognizeWeight(req.file.path);

    res.json({
      success: true,
      data: {
        weight: result.weight,
        confidence: result.confidence,
        rawText: result.rawText,
        filename: req.file.filename,
        uploadedAt: new Date().toISOString(),
        metadata, // Include all metadata in response
      },
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
});
