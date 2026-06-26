# T-BTN Dashboard

**Real-time pet health telemetry dashboard** for a dog wearing a Raspberry Pi 5 biometric wearable.
Displays live temperature, BPM, SpO₂, and GPS location streamed to Firebase Firestore.

---

## Stack

| Layer      | Technology |
|------------|-----------|
| Frontend   | Next.js 15 (App Router, TypeScript) |
| Database   | Firebase Firestore (client SDK — no custom backend) |
| Charts     | Recharts |
| Maps       | React-Leaflet / OpenStreetMap |
| Hosting    | Vercel |

---

## 1 · Firebase Project Setup

### 1.1 Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. Give it a name (e.g. `tbtn-dashboard`)
3. Enable **Google Analytics** if you want (optional)

### 1.2 Enable Firestore

1. In the Firebase console → **Firestore Database** → **Create database**
2. Choose **Start in production mode** (we'll add rules next)
3. Select a region close to your dog's location

### 1.3 Deploy Security Rules

From this repository root (where `firestore.rules` lives):

```bash
# Install Firebase CLI if needed
npm install -g firebase-tools

# Log in
firebase login

# Link to your project
firebase use --add   # pick your project from the list

# Deploy only Firestore rules
firebase deploy --only firestore:rules
```

The rules in `firestore.rules`:
- **Allow public reads** of the `readings` collection (anyone can view the dashboard without logging in)
- **Block all client writes** — only the Pi's Firebase Admin SDK service account can write

> **Security note**: See the comments in `firestore.rules` for how to upgrade to authenticated-only reads if you want to restrict who can see your dog's health data.

### 1.4 Create the Firestore Index

The Live Dashboard queries:
```
collection: readings
WHERE deviceId == "tbtn-001"
ORDER BY timestamp DESC
LIMIT 25
```

Firestore will prompt you to create a composite index the first time you run the dashboard. Follow the link in the browser console error message, or create it manually:

- **Collection**: `readings`
- **Fields**: `deviceId` (Ascending) + `timestamp` (Descending)
- **Query scope**: Collection

### 1.5 Get Your Firebase Config

1. Firebase console → **Project Settings** (gear icon) → **General** → scroll to **Your apps**
2. Click **Add app** → **Web** (`</>`)
3. Register the app (name it anything, e.g. `tbtn-web`)
4. Copy the `firebaseConfig` object — you'll need these values next

---

## 2 · Local Development Setup

### 2.1 Clone and install

```bash
git clone <your-repo-url>
cd dashboard
npm install
```

### 2.2 Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in the values from your Firebase config:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef...
```

> These keys are **safe to commit** to your frontend repo — Firebase's design intentionally exposes them client-side. Security is enforced by Firestore Security Rules, not by keeping these values secret. Never commit your **Admin SDK service account JSON** — that belongs only on the Pi.

### 2.3 Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — Live Dashboard  
Open [http://localhost:3000/history](http://localhost:3000/history) — History View

---

## 3 · Deploy to Vercel

### Option A — Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

During the setup wizard, Vercel will detect Next.js automatically.

### Option B — Vercel Dashboard (recommended)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo
3. Framework preset: **Next.js** (auto-detected)
4. Add environment variables (same as `.env.local`) in **Settings → Environment Variables**
5. Deploy

---

## 4 · Firestore Data Model

Collection: **`readings`**

Each document written by the Pi:

```typescript
{
  deviceId:  string,          // e.g. "tbtn-001"
  timestamp: Timestamp,       // Firestore server timestamp
  temp:      number | null,   // body temperature in °C
  bpm:       number | null,   // heart rate
  spo2:      number | null,   // blood oxygen %
  lat:       number | null,   // GPS latitude  (null if no fix)
  lon:       number | null,   // GPS longitude (null if no fix)
}
```

Documents arrive roughly every **15 seconds**. The dashboard is designed for this cadence.

---

## 5 · Health Thresholds (Dog)

| Metric     | Normal          | Warning               | Critical           |
|------------|-----------------|-----------------------|--------------------|
| Temp (°C)  | 37.5 – 39.2    | 37.0–37.4 or 39.3–39.9| < 37.0 or ≥ 40.0   |
| BPM        | 60 – 160        | 40–59 or 161–200      | < 40 or > 200      |
| SpO₂ (%)   | ≥ 95           | 90 – 94               | < 90               |

---

## 6 · Project Structure

```
dashboard/
├── src/
│   ├── app/
│   │   ├── globals.css          # Design system (CSS custom properties)
│   │   ├── layout.tsx           # Root layout + Navbar
│   │   ├── page.tsx             # Live Dashboard (home)
│   │   └── history/
│   │       └── page.tsx         # History View
│   ├── components/
│   │   ├── VitalCard.tsx        # Stat card with threshold colour + trend
│   │   ├── LiveMap.tsx          # Current GPS location (Leaflet)
│   │   ├── TrailMap.tsx         # GPS trail polyline (Leaflet)
│   │   ├── TempChart.tsx        # Temperature line chart (Recharts)
│   │   ├── BpmChart.tsx         # BPM line chart (Recharts)
│   │   ├── Spo2Chart.tsx        # SpO₂ line chart (Recharts)
│   │   ├── DateRangePicker.tsx  # 24h / 3d / 7d selector
│   │   ├── DeviceSelector.tsx   # Device ID dropdown
│   │   ├── StatusBadge.tsx      # Live/Stale/Offline indicator
│   │   ├── LoadingSpinner.tsx
│   │   ├── ErrorState.tsx
│   │   └── NoDataState.tsx
│   ├── hooks/
│   │   ├── useLiveReading.ts    # onSnapshot real-time listener
│   │   └── useHistoryReadings.ts# getDocs + LTTB downsampling
│   ├── lib/
│   │   ├── firebase.ts          # Firebase app init
│   │   ├── thresholds.ts        # Dog health threshold logic
│   │   └── downsample.ts        # LTTB downsampling algorithm
│   └── types/
│       └── reading.ts           # Reading TypeScript interface
├── .env.local.example
└── firestore.rules              # (at repo root, one level up)
```

---

## 7 · Adding More Devices

The dashboard supports multiple devices via the `deviceId` field. To add a new dog/device:

1. Register the device in `KNOWN_DEVICES` array in `src/app/page.tsx` and `src/app/history/page.tsx`
2. The Pi device writes its `deviceId` (e.g. `"tbtn-002"`) to each Firestore document
3. Use the device selector dropdown in the UI to switch between devices

---

## 8 · Performance Notes

- **7-day view**: At 15s resolution, 7 days ≈ 40,000 readings. The dashboard queries up to 2,000 documents then applies **LTTB (Largest-Triangle-Three-Buckets)** downsampling to ~500 chart points per metric. This preserves the visual shape of the data without loading tens of thousands of documents.
- **Real-time updates**: Uses Firestore's `onSnapshot` — no polling, no manual refresh.
- **Maps**: Leaflet + OpenStreetMap (no API key required, no usage limits for small deployments).

---

## License

MIT
