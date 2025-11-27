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
const MAX_CONCURRENT_OCR = parseInt(process.env.MAX_CONCURRENT_OCR || '2', 10);

// Track active OCR requests
let activeOCRRequests = 0;

// Store upload history (in-memory)
interface UploadRecord {
  weight: string;
  confidence: number;
  rawText: string;
  filename: string;
  imageUrl: string;
  receivedAt: string;
  metadata: any;
}

const uploadHistory: UploadRecord[] = [];

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

app.get('/api/history', (req: Request, res: Response) => {
  res.json({
    success: true,
    count: uploadHistory.length,
    data: uploadHistory,
  });
});

app.get('/dashboard', (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weight OCR Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%);
      min-height: 100vh;
    }

    .glass {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5);
    }

    .glass-dark {
      background: rgba(255, 255, 255, 0.02);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .fade-in {
      animation: fadeIn 0.5s ease-in;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .pulse-dot {
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    /* Mobile optimizations */
    @media (max-width: 640px) {
      body {
        padding: 0.5rem;
      }
    }
  </style>
</head>
<body class="p-2 sm:p-8">
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <div class="glass rounded-xl p-3 sm:p-6 mb-3 sm:mb-8 fade-in">
      <div class="flex flex-col gap-3 sm:gap-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl sm:text-4xl font-bold text-white sm:mb-2">
              Weight OCR
            </h1>
            <p class="text-white/80 text-xs sm:text-base hidden sm:block">Real-time weight monitoring</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="pulse-dot w-2 h-2 sm:w-3 sm:h-3 bg-green-400 rounded-full"></span>
            <span class="text-white/90 text-xs sm:text-sm"><span id="countdown">3</span>s</span>
          </div>
        </div>

        <!-- Controls -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <div class="flex items-center gap-2 flex-1">
            <label for="refresh-interval" class="text-white/80 text-xs sm:text-sm whitespace-nowrap">
              Refresh interval:
            </label>
            <input
              type="number"
              id="refresh-interval"
              min="1"
              max="60"
              value="3"
              class="glass-dark text-white px-2 sm:px-3 py-1 sm:py-2 rounded-lg text-xs sm:text-sm w-16 sm:w-20 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <span class="text-white/60 text-xs sm:text-sm">sec</span>
          </div>

          <button
            id="manual-refresh"
            class="glass-dark hover:bg-white/10 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <svg class="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Now
          </button>
        </div>
      </div>
    </div>

    <!-- Latest Upload -->
    <div id="latest-upload" class="mb-3 sm:mb-8">
      <div class="text-white/90 text-xs sm:text-sm font-semibold mb-2 uppercase tracking-wider">
        Latest Reading
      </div>
      <div class="glass rounded-xl p-3 sm:p-6 fade-in">
        <div class="text-white/70 text-center py-6 sm:py-12 text-sm">
          No uploads yet
        </div>
      </div>
    </div>

    <!-- Previous Uploads -->
    <div id="previous-uploads">
      <div class="text-white/90 text-xs sm:text-sm font-semibold mb-2 uppercase tracking-wider">
        Previous Readings
      </div>
      <div class="grid grid-cols-1 gap-2 sm:gap-4">
        <div class="glass-dark rounded-xl p-3 sm:p-6">
          <div class="text-white/70 text-center py-4 sm:py-6 text-sm">
            No previous uploads
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    let countdownValue = 3;
    let countdownInterval;

    function formatDate(isoString) {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now - date;
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffMs / 60000);

      if (diffSecs < 60) {
        return diffSecs + ' seconds ago';
      }
      if (diffMins < 60) {
        return diffMins + (diffMins === 1 ? ' minute ago' : ' minutes ago');
      }

      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');

      return day + '.' + month + '.' + date.getFullYear() + ' ' + hours + ':' + minutes;
    }

    function getTimeColor(isoString) {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now - date;
      const diffSecs = Math.floor(diffMs / 1000);

      if (diffSecs > 30) {
        return 'text-red-400';
      }
      return 'text-white';
    }

    function renderMetadata(metadata) {
      if (!metadata || Object.keys(metadata).length === 0) {
        return '<span class="text-white/50 text-xs sm:text-sm">No metadata</span>';
      }

      return Object.entries(metadata)
        .map(([key, value]) =>
          '<div class="inline-flex items-center gap-1 sm:gap-2 bg-white/10 rounded-lg px-2 sm:px-3 py-1 text-xs sm:text-sm">' +
          '<span class="text-white/60">' + key + ':</span>' +
          '<span class="text-white font-medium">' + value + '</span>' +
          '</div>'
        )
        .join('');
    }

    function renderLatestUpload(data) {
      if (!data || data.length === 0) {
        return '<div class="glass rounded-xl p-3 sm:p-6 fade-in">' +
               '<div class="text-white/70 text-center py-6 sm:py-12 text-sm">No uploads yet</div>' +
               '</div>';
      }

      const latest = data[0];
      const confidencePercent = Math.round(latest.confidence * 100);
      const confidenceColor = confidencePercent >= 80 ? 'text-green-400' :
                               confidencePercent >= 60 ? 'text-yellow-400' : 'text-red-400';

      return '<div class="glass rounded-xl p-3 sm:p-8 fade-in">' +
             '<div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-8">' +

             '<!-- Image -->' +
             '<div class="order-2 lg:order-1">' +
             '<img src="' + latest.imageUrl + '" alt="Weight display" ' +
             'class="w-full h-auto rounded-lg sm:rounded-xl shadow-2xl border border-white/20" />' +
             '</div>' +

             '<!-- Details -->' +
             '<div class="order-1 lg:order-2 flex flex-col justify-center">' +
             '<div class="text-white/70 text-xs sm:text-sm mb-1">Weight Value</div>' +
             '<div class="text-4xl sm:text-7xl font-bold text-white mb-3 sm:mb-4">' +
             latest.weight +
             '<span class="text-xl sm:text-3xl text-white/70 ml-1 sm:ml-2">kg</span>' +
             '</div>' +

             '<div class="space-y-2 sm:space-y-4 mb-3 sm:mb-6">' +
             '<div class="flex items-center justify-between glass-dark rounded-lg p-2 sm:p-4">' +
             '<span class="text-white/70 text-xs sm:text-base">Confidence</span>' +
             '<span class="text-lg sm:text-2xl font-bold ' + confidenceColor + '">' + confidencePercent + '%</span>' +
             '</div>' +

             '<div class="flex items-center justify-between glass-dark rounded-lg p-2 sm:p-4">' +
             '<span class="text-white/70 text-xs sm:text-base">Raw Text</span>' +
             '<span class="text-white font-mono text-xs sm:text-base">' + latest.rawText.split('\\n').join(' ') + '</span>' +
             '</div>' +

             '<div class="flex items-center justify-between glass-dark rounded-lg p-2 sm:p-4">' +
             '<span class="text-white/70 text-xs sm:text-base">Time</span>' +
             '<span class="' + getTimeColor(latest.receivedAt) + ' text-xs sm:text-base font-semibold">' + formatDate(latest.receivedAt) + '</span>' +
             '</div>' +
             '</div>' +

             '<!-- Metadata -->' +
             (Object.keys(latest.metadata).length > 0 ?
               '<div class="glass-dark rounded-lg p-2 sm:p-4">' +
               '<div class="text-white/70 text-xs sm:text-sm mb-2">Metadata</div>' +
               '<div class="flex flex-wrap gap-1 sm:gap-2">' +
               renderMetadata(latest.metadata) +
               '</div>' +
               '</div>'
             : '') +
             '</div>' +

             '</div>' +
             '</div>';
    }

    function renderPreviousUploads(data) {
      if (!data || data.length <= 1) {
        return '<div class="glass-dark rounded-xl p-3 sm:p-6">' +
               '<div class="text-white/70 text-center py-4 sm:py-6 text-sm">No previous uploads</div>' +
               '</div>';
      }

      const previous = data.slice(1, 4); // Show max 3 previous on mobile

      return previous.map(item => {
        const confidencePercent = Math.round(item.confidence * 100);
        const confidenceColor = confidencePercent >= 80 ? 'bg-green-500/20 text-green-400' :
                                 confidencePercent >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                                 'bg-red-500/20 text-red-400';

        return '<div class="glass-dark rounded-lg sm:rounded-xl p-2 sm:p-6 fade-in hover:bg-white/10 transition-all">' +
               '<div class="flex items-center justify-between gap-2 sm:gap-4">' +

               '<!-- Weight & Confidence -->' +
               '<div class="flex items-center gap-2 sm:gap-4">' +
               '<div>' +
               '<div class="text-2xl sm:text-4xl font-bold text-white">' +
               item.weight +
               '<span class="text-sm sm:text-xl text-white/50 ml-1">kg</span>' +
               '</div>' +
               '<div class="' + getTimeColor(item.receivedAt) + ' text-xs sm:text-sm mt-1 font-semibold">' + formatDate(item.receivedAt) + '</div>' +
               '</div>' +
               '</div>' +

               '<!-- Confidence -->' +
               '<div class="' + confidenceColor + ' px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap">' +
               confidencePercent + '%' +
               '</div>' +

               '</div>' +
               '</div>';
      }).join('');
    }

    async function fetchHistory() {
      const refreshBtn = document.getElementById('manual-refresh');
      const refreshIcon = refreshBtn.querySelector('svg');

      try {
        console.log('Fetching history...');
        refreshIcon.classList.add('spin');

        const response = await fetch('/api/history');
        console.log('Response status:', response.status);
        const result = await response.json();
        console.log('Result:', result);

        if (result.success) {
          console.log('Updating DOM with', result.data.length, 'items');
          document.getElementById('latest-upload').innerHTML =
            '<div class="text-white/90 text-xs sm:text-sm font-semibold mb-2 uppercase tracking-wider">Latest Reading</div>' +
            renderLatestUpload(result.data);

          document.getElementById('previous-uploads').innerHTML =
            '<div class="text-white/90 text-xs sm:text-sm font-semibold mb-2 uppercase tracking-wider">Previous Readings</div>' +
            '<div class="grid grid-cols-1 gap-2 sm:gap-4">' +
            renderPreviousUploads(result.data) +
            '</div>';
          console.log('DOM updated successfully');
        }
      } catch (error) {
        console.error('Failed to fetch history:', error);
      } finally {
        refreshIcon.classList.remove('spin');
      }
    }

    function startCountdown() {
      const intervalInput = document.getElementById('refresh-interval');
      const intervalSeconds = parseInt(intervalInput.value) || 3;
      countdownValue = intervalSeconds;
      document.getElementById('countdown').textContent = countdownValue;

      if (countdownInterval) clearInterval(countdownInterval);

      countdownInterval = setInterval(() => {
        countdownValue--;
        document.getElementById('countdown').textContent = countdownValue;

        if (countdownValue <= 0) {
          console.log('Countdown reached 0, fetching history...');
          fetchHistory();
          const currentInterval = parseInt(intervalInput.value) || 3;
          countdownValue = currentInterval;
        }
      }, 1000);
    }

    function manualRefresh() {
      console.log('Manual refresh triggered');
      fetchHistory();
      startCountdown(); // Reset countdown
    }

    // Event listeners
    document.getElementById('refresh-interval').addEventListener('change', function() {
      console.log('Interval changed to:', this.value);
      startCountdown(); // Restart countdown with new interval
    });

    document.getElementById('manual-refresh').addEventListener('click', manualRefresh);

    // Initial load
    console.log('Dashboard loaded, starting initial fetch...');
    fetchHistory();
    startCountdown();
  </script>
</body>
</html>
  `;

  res.send(html);
});

app.post('/api/upload', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided',
      });
    }

    // Check if we've reached the concurrent OCR limit
    if (activeOCRRequests >= MAX_CONCURRENT_OCR) {
      console.log(`OCR request blocked: ${activeOCRRequests}/${MAX_CONCURRENT_OCR} active requests`);
      return res.status(429).json({
        success: false,
        error: 'Too many concurrent OCR requests',
        message: `Server is processing ${activeOCRRequests} requests. Maximum allowed: ${MAX_CONCURRENT_OCR}. Please try again later.`,
        activeRequests: activeOCRRequests,
        maxConcurrent: MAX_CONCURRENT_OCR,
      });
    }

    // Increment active request counter
    activeOCRRequests++;
    console.log(`OCR request started: ${activeOCRRequests}/${MAX_CONCURRENT_OCR} active requests`);

    const receivedAt = new Date().toISOString();
    console.log(`Processing uploaded file: ${req.file.filename}`);

    // Extract all metadata generically - accept any fields from request body
    const metadata = { ...req.body };

    console.log('Received metadata:', metadata);

    let result;
    try {
      // Perform OCR on the uploaded image
      result = await recognizeWeight(req.file.path);
    } finally {
      // Always decrement counter, even if OCR fails
      activeOCRRequests--;
      console.log(`OCR request completed: ${activeOCRRequests}/${MAX_CONCURRENT_OCR} active requests`);
    }

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

    // Save to history (keep last 50 records)
    uploadHistory.unshift(responseData);
    if (uploadHistory.length > 50) {
      uploadHistory.pop();
    }

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
  console.log(`⚡ Max concurrent OCR requests: ${MAX_CONCURRENT_OCR}`);
  if (WEBHOOK_URL) {
    console.log(`🔔 Webhook enabled: ${WEBHOOK_URL}`);
    if (WEBHOOK_API_KEY) {
      console.log(`🔑 Webhook API key: configured`);
    }
  } else {
    console.log(`🔕 Webhook: not configured`);
  }
});
