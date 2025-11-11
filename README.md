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
Upload zdjęcia wyświetlacza wagi z opcjonalnymi metadanymi

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body:
  - `image` (file, **required**) - plik ze zdjęciem (jpg, png, gif, bmp, webp)
  - `timestamp` (string, optional) - czas zrobienia zdjęcia (ISO 8601)
  - `userId` (string, optional) - ID użytkownika
  - `location` (string, optional) - lokalizacja pomiaru
  - `deviceId` (string, optional) - ID urządzenia
  - `notes` (string, optional) - dodatkowe notatki
  - ...dowolne inne pola (optional) - wszystkie dodatkowe pola zostaną zapisane w `metadata`

**Response:**
```json
{
  "success": true,
  "data": {
    "weight": "125.5",
    "confidence": 0.85,
    "rawText": "125.5 kg",
    "filename": "weight-1234567890-123456789.jpg",
    "uploadedAt": "2024-01-15T10:30:00.000Z",
    "metadata": {
      "timestamp": "2024-01-15T10:29:55.000Z",
      "userId": "user123",
      "location": "Warehouse A",
      "deviceId": "scale-01",
      "notes": "Morning weight check"
    }
  }
}
```

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
- **Metadane są w pełni opcjonalne** - można wysłać tylko zdjęcie lub dodać dowolne pola
- Wszystkie dodatkowe pola z `multipart/form-data` są automatycznie zapisywane w `metadata`
- Nie trzeba używać query params - wszystko idzie w jednym request jako form data

## Licencja

MIT
