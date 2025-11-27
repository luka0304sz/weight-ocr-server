# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Weight OCR Server is a Node.js TypeScript application that uses Tesseract.js to perform Optical Character Recognition (OCR) on images of weight displays (digital scales, weight indicators). It extracts numeric weight values from uploaded images and provides REST API endpoints for integration.

The server is designed for scenarios like warehouse operations, industrial weighing systems, or any application that needs to digitize weight readings from displays.

## Development Commands

### Building and Running
```bash
npm run build         # Compile TypeScript to dist/
npm start             # Run production build (requires npm run build first)
npm run dev           # Development mode with ts-node (hot reload)
npm run watch         # Watch mode - recompile on file changes
```

### Environment Setup
Copy `.env.example` to `.env` and configure:
- `PORT` - Server port (default: 3000)
- `PUBLIC_URL` - Public URL for image links (e.g., http://localhost:3000)
- `WEBHOOK_URL` - Optional POST endpoint for OCR results
- `WEBHOOK_API_KEY` - Optional API key sent as `x-api-key` header
- `MAX_CONCURRENT_OCR` - Limit concurrent OCR processing (default: 2)

## Architecture

### Two-File Structure

The codebase is intentionally minimal with two main TypeScript files:

**src/server.ts** - Express server with:
- Multipart file upload handling via multer
- Image file storage with timestamped filenames: `weight-TIMESTAMP-RANDOM.ext`
- Generic metadata extraction from POST body (accepts any fields)
- OCR request rate limiting (tracked in-memory via `activeOCRRequests` counter)
- Async webhook notifications (fire-and-forget pattern)
- Static file serving for uploaded images
- Directory traversal protection

**src/ocrService.ts** - OCR processing with:
- Tesseract.js worker lifecycle management (create → configure → recognize → terminate)
- Digit-only whitelist configuration: `0123456789`
- Single-block page segmentation mode (PSM.SINGLE_BLOCK)
- Weight extraction logic that prioritizes longer numbers (e.g., "1626" over "1")
- Decimal/whole number detection with confidence scoring

### Key Design Patterns

**Concurrency Control**: The `activeOCRRequests` counter prevents server overload during OCR processing. When the limit is reached (configured via `MAX_CONCURRENT_OCR`), new requests receive 429 status. The counter is managed in a try-finally block to ensure proper cleanup even on errors.

**Metadata Flexibility**: The server accepts any form fields in the upload request via `{ ...req.body }` spread. This allows clients to send arbitrary context (userId, location, timestamp, orderNumber, etc.) without server-side changes.

**Weight Extraction Algorithm** (ocrService.ts:13-47):
1. First attempts to find decimal numbers (e.g., "162.6")
2. Falls back to whole numbers
3. Always selects the longest number found (handles multi-line OCR like "1\n1626")
4. Returns normalized value and confidence score

**Webhook Pattern**: Webhooks are sent asynchronously via `sendWebhook().catch()` to avoid blocking the HTTP response. They include all OCR results, metadata, and image URLs.

### File Storage

Images are saved to `uploads/` directory (created automatically at startup) with format:
```
weight-TIMESTAMP-RANDOM.ext
```
The timestamp (Unix milliseconds) allows extracting upload time from filename. Images are served via `GET /uploads/:filename` with directory traversal protection.

## API Behavior

### POST /api/upload
- Requires multipart/form-data with `image` field
- Accepts any additional fields as metadata
- Max file size: 10MB
- Allowed formats: jpeg, jpg, png, gif, bmp, webp
- Returns OCR result with imageUrl, filename, receivedAt timestamp, and metadata
- Rejects with 429 when OCR concurrency limit reached

### GET /uploads/:filename
- Serves static image files
- Protected against directory traversal attacks (src/server.ts:193)

### Webhook Notifications
If `WEBHOOK_URL` is configured, the server POSTs JSON containing:
- All OCR results (weight, confidence, rawText)
- All metadata from upload request
- `imageUrl` for accessing the uploaded image
- `receivedAt` and `webhookSentAt` timestamps

## OCR Configuration

The Tesseract configuration is critical for accurate weight recognition:

```typescript
tessedit_char_whitelist: "0123456789"      // Only digits allowed
tessedit_pageseg_mode: PSM.SINGLE_BLOCK   // Treat image as single text block
```

When modifying OCR behavior, consider:
- The whitelist excludes units (kg, lb) intentionally - pure numbers only
- PSM.SINGLE_BLOCK assumes the entire image is one weight display
- The worker is created and terminated per request (no reuse)
- Progress logging occurs during recognition (ocrService.ts:56-60)

## Common Modifications

**Adding OCR configuration**: Modify `await worker.setParameters()` in ocrService.ts:65

**Changing concurrency limits**: Set `MAX_CONCURRENT_OCR` in .env (affects both rate limiting and 429 response messages)

**Modifying weight extraction logic**: Edit `extractWeightFromText()` in ocrService.ts:13-47 (handles decimal/whole number detection and length-based selection)

**Adding response fields**: Modify the `responseData` object in server.ts:155-163 (automatically propagates to both API response and webhook payload)
