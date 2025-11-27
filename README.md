# Weight OCR Server

Serwer Node.js z TypeScript do rozpoznawania wagi z wyświetlaczy alfanumerycznych za pomocą OCR.

## Funkcjonalności

- Upload zdjęć wyświetlaczy wagi
- Automatyczne rozpoznawanie liczb za pomocą Tesseract.js OCR
- Zapisywanie przesłanych obrazów w katalogu `uploads` z timestampem w nazwie
- REST API z obsługą CORS
- **Generyczne metadane** - akceptuje dowolne pola w request
- **Serwowanie obrazów** - endpoint do podglądu uploadowanych zdjęć
- **Webhook notifications** - opcjonalne powiadomienia POST z wynikami OCR i metadanymi

## Instalacja

```bash
npm install
```

## Konfiguracja

Skopiuj plik `.env.example` do `.env` i dostosuj wartości:

```bash
cp .env.example .env
```

### Zmienne środowiskowe

```bash
# Port serwera (domyślnie 3000)
PORT=3000

# Publiczny URL serwera (dla linków do obrazów w webhook)
PUBLIC_URL=http://localhost:3000

# Webhook - opcjonalne powiadomienia POST
WEBHOOK_URL=https://your-webhook-endpoint.com/webhook
WEBHOOK_API_KEY=your-secret-api-key
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
Upload zdjęcia wyświetlacza wagi z dowolnymi metadanymi

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body:
  - `image` (file, **required**) - plik ze zdjęciem (jpg, png, gif, bmp, webp)
  - **Dowolne inne pola** - wszystkie dodatkowe pola zostaną zapisane w `metadata`
  - Przykłady: `userId`, `timestamp`, `location`, `deviceId`, `orderNumber`, `notes`, etc.

**Response:**
```json
{
  "success": true,
  "data": {
    "weight": "1626",
    "confidence": 0.85,
    "rawText": "1626",
    "filename": "weight-1731348577250-123456789.jpg",
    "imageUrl": "http://localhost:3000/uploads/weight-1731348577250-123456789.jpg",
    "receivedAt": "2025-11-11T17:49:37.250Z",
    "metadata": {
      "userId": "user123",
      "location": "Warehouse A",
      "deviceId": "scale-01",
      "orderNumber": "ORD-001",
      "notes": "Morning weight check"
    }
  }
}
```

**Uwaga:** Nazwa pliku zawiera timestamp (`weight-TIMESTAMP-RANDOM.ext`), więc można wyekstrahować czas z nazwy.

### `GET /uploads/:filename`
Pobierz uploadowane zdjęcie

**Request:**
- Method: GET
- URL: `/uploads/{filename}`

**Response:**
- Plik obrazu (JPEG, PNG, GIF, BMP, WEBP)

**Przykład:**
```bash
curl http://localhost:3000/uploads/weight-1731348577250-123456789.jpg --output image.jpg
```

## Webhook Notifications

Jeśli skonfigurujesz `WEBHOOK_URL` w `.env`, serwer automatycznie wyśle POST request z wynikami po przetworzeniu każdego zdjęcia.

### Webhook Request

**Headers:**
```
Content-Type: application/json
x-api-key: YOUR_WEBHOOK_API_KEY  (jeśli skonfigurowany)
```

**Body:**
```json
{
  "weight": "1626",
  "confidence": 0.85,
  "rawText": "1626",
  "filename": "weight-1731348577250-123456789.jpg",
  "imageUrl": "http://localhost:3000/uploads/weight-1731348577250-123456789.jpg",
  "receivedAt": "2025-11-11T17:49:37.250Z",
  "metadata": {
    "userId": "user123",
    "location": "Warehouse A",
    "orderNumber": "ORD-001"
  },
  "webhookSentAt": "2025-11-11T17:49:38.100Z"
}
```

**Zawiera:**
- `weight` - rozpoznana waga (wartość OCR)
- `confidence` - pewność rozpoznania (0-1)
- `rawText` - surowy tekst z OCR
- `filename` - nazwa zapisanego pliku
- `imageUrl` - publiczny URL do podejrzenia zdjęcia
- `receivedAt` - czas otrzymania zdjęcia na serwerze (ISO 8601)
- `metadata` - wszystkie dodatkowe pola wysłane w request
- `webhookSentAt` - czas wysłania webhooka (ISO 8601)

## Przykład użycia

### cURL (podstawowy)
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "image=@/path/to/weight-display.jpg"
```

### cURL (z metadanymi)
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "image=@/path/to/weight-display.jpg" \
  -F "timestamp=2024-01-15T10:30:00.000Z" \
  -F "userId=user123" \
  -F "location=Warehouse A" \
  -F "deviceId=scale-01" \
  -F "notes=Morning weight check"
```

### JavaScript (Fetch API)
```javascript
const formData = new FormData();
formData.append('image', fileInput.files[0]);

// Dodaj opcjonalne metadane
formData.append('timestamp', new Date().toISOString());
formData.append('userId', 'user123');
formData.append('location', 'Warehouse A');
formData.append('deviceId', 'scale-01');
formData.append('notes', 'Morning weight check');

const response = await fetch('http://localhost:3000/api/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('Rozpoznana waga:', result.data.weight);
console.log('Metadane:', result.data.metadata);
```

### Python (requests)
```python
import requests
from datetime import datetime

with open('weight-display.jpg', 'rb') as f:
    files = {'image': f}

    # Opcjonalne metadane
    data = {
        'timestamp': datetime.now().isoformat(),
        'userId': 'user123',
        'location': 'Warehouse A',
        'deviceId': 'scale-01',
        'notes': 'Morning weight check'
    }

    response = requests.post(
        'http://localhost:3000/api/upload',
        files=files,
        data=data
    )

result = response.json()
print('Waga:', result['data']['weight'])
print('Metadane:', result['data']['metadata'])
```

### React Native / Mobile
```javascript
const uploadWeight = async (imageUri, metadata) => {
  const formData = new FormData();

  // Dodaj zdjęcie
  formData.append('image', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'weight.jpg',
  });

  // Dodaj metadane
  formData.append('timestamp', new Date().toISOString());
  formData.append('userId', metadata.userId);
  formData.append('location', metadata.location);

  const response = await fetch('http://localhost:3000/api/upload', {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return await response.json();
};
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
- **dotenv** - zarządzanie zmiennymi środowiskowymi

## Uwagi

### Upload i OCR
- Maksymalny rozmiar pliku: 10MB
- Obsługiwane formaty: JPEG, PNG, GIF, BMP, WEBP
- OCR skonfigurowany do rozpoznawania cyfr: `0123456789.,kg`
- OCR automatycznie wybiera **najdłuższą liczbę** (dla "1\n1626" zwróci "1626")

### Metadane
- **Pełna elastyczność** - serwer akceptuje dowolne pola w `multipart/form-data`
- Nie ma predefiniowanych pól - wysyłaj co potrzebujesz
- Wszystkie pola są automatycznie przekazywane w `metadata` response i webhook
- Nie trzeba używać query params - wszystko w jednym request

### Pliki i timestampy
- Nazwa pliku: `weight-TIMESTAMP-RANDOM.ext`
- Timestamp w nazwie = czas otrzymania na serwerze (Unix milliseconds)
- `receivedAt` w response = ISO 8601 format
- Obrazy dostępne przez `GET /uploads/:filename`

### Webhook
- Opcjonalny - konfiguruj przez `.env`
- Wysyłany asynchronicznie (nie blokuje response)
- Zawiera wszystkie dane: OCR, metadane, imageUrl, timestampy
- Obsługuje autentykację przez `x-api-key` header

## Licencja

MIT
