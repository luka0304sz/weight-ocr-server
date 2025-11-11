# Weight OCR Server

Serwer Node.js z TypeScript do rozpoznawania wagi z wyświetlaczy alfanumerycznych za pomocą OCR.

## Funkcjonalności

- Upload zdjęć wyświetlaczy wagi
- Automatyczne rozpoznawanie liczb za pomocą Tesseract.js OCR
- Zapisywanie przesłanych obrazów w katalogu `uploads`
- REST API z obsługą CORS

## Instalacja

```bash
npm install
```

## Uruchomienie

### Tryb development (z ts-node)
```bash
npm run dev
```

### Tryb production
```bash
# Budowanie
npm run build

# Uruchomienie
npm start
```

## API Endpoints

### `GET /`
Informacje o serwerze i dostępnych endpointach

### `GET /health`
Health check - sprawdzenie statusu serwera

### `POST /api/upload`
Upload zdjęcia wyświetlacza wagi

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body:
  - `image` (file) - plik ze zdjęciem (jpg, png, gif, bmp, webp)

**Response:**
```json
{
  "success": true,
  "data": {
    "weight": "125.5",
    "confidence": 0.85,
    "rawText": "125.5 kg",
    "filename": "weight-1234567890-123456789.jpg",
    "uploadedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

## Przykład użycia

### cURL
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "image=@/path/to/weight-display.jpg"
```

### JavaScript (Fetch API)
```javascript
const formData = new FormData();
formData.append('image', fileInput.files[0]);

const response = await fetch('http://localhost:3000/api/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('Rozpoznana waga:', result.data.weight);
```

### Python (requests)
```python
import requests

with open('weight-display.jpg', 'rb') as f:
    files = {'image': f}
    response = requests.post('http://localhost:3000/api/upload', files=files)

print(response.json())
```

## Struktura projektu

```
weight-ocr-server/
├── src/
│   ├── server.ts       # Główny plik serwera Express
│   └── ocrService.ts   # Serwis OCR z Tesseract.js
├── uploads/            # Katalog z uploadowanymi zdjęciami
├── dist/               # Skompilowane pliki (po npm run build)
├── package.json
├── tsconfig.json
└── README.md
```

## Technologie

- **Node.js** - środowisko uruchomieniowe
- **TypeScript** - typowany JavaScript
- **Express** - framework webowy
- **Multer** - middleware do obsługi upload plików
- **Tesseract.js** - biblioteka OCR do rozpoznawania tekstu
- **CORS** - obsługa cross-origin requests

## Konfiguracja

Domyślny port: `3000` (można zmienić przez zmienną środowiskową `PORT`)

```bash
PORT=8080 npm run dev
```

## Uwagi

- Maksymalny rozmiar pliku: 10MB
- Obsługiwane formaty: JPEG, PNG, GIF, BMP, WEBP
- OCR skonfigurowany do rozpoznawania cyfr i znaków: `0123456789.,kg`
- Zdjęcia zapisywane są w katalogu `uploads/` z unikalną nazwą

## Licencja

MIT
