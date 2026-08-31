# ✨ Frame AI PhotoBooth — Complete Backend & Frontend Kiosk

An end-to-end, production-ready **AI PhotoBooth & Video Kiosk** system built with Node.js, Express, MongoDB Atlas, and modular AI Video Generation Providers matching the 5-step mobile/kiosk workflow:
1. **Select Frame** (Choose decorative floral, royal gold, pink blossom, or midnight navy border)
2. **Capture / Upload Photo** (Camera live capture or file upload)
3. **Guest Details Entry** (Name, Email, Phone, Occasion, Wish Message)
4. **Creating Video** (Real-time progress percentage, AI video generation & frame compositing)
5. **Preview, Downloads & QR Code** (Framed MP4 Video, framed JPG Photo, instant QR Scan-to-Mobile)

---

## 🚀 How to Run Server & Frontend

### Method 1: Run Both in One Step (Recommended)

The backend Express server is pre-configured to serve **both** the full interactive Frontend Kiosk UI and the Backend REST APIs concurrently on port `5000`.

#### Step 1: Install Dependencies
```bash
npm install
```

#### Step 2: Seed Decorative Frames & Database
```bash
npm run seed
```

#### Step 3: Start Server & Frontend
```bash
npm run dev
```

#### Step 4: Open in Browser
Open your browser and navigate to:
👉 **`http://localhost:5000`**

You can now test the entire 5-step photo booth experience right in your browser!

---

### Method 2: If Using a Separate Frontend (React / Next.js / Vite / Vue)

If you are developing a custom separate frontend framework (e.g. React/Vite app on port `3000` or `5173`):

1. **Start the Backend Server** in Terminal 1:
   ```bash
   cd AIPhotoBooth
   npm run dev
   ```
   *(Backend runs on `http://localhost:5000`)*

2. **Connect your Frontend**:
   Set your Frontend API base URL environment variable (e.g. in `.env.local` or `vite.config.js`):
   ```env
   VITE_API_URL=http://localhost:5000
   # or
   NEXT_PUBLIC_API_URL=http://localhost:5000
   ```
   *Note: CORS is already pre-configured and enabled on the backend for all origins.*

---

## ⚙️ Environment Configuration (`.env`)

You can switch video AI providers and models dynamically in `.env` without editing any code:

```env
PORT=5000
NODE_ENV=development
APP_BASE_URL=http://localhost:5000

# ==============================================================================
# MongoDB Connection (Local or Atlas)
# Database Name: AIPhotoBoothUser
# ==============================================================================
MONGODB_URI=mongodb+srv://neeshu:qNrSkL65bbNqIkZW@neeshu.cwxzomm.mongodb.net/AIPhotoBoothUser?retryWrites=true&w=majority&appName=neeshu

# ==============================================================================
# DYNAMIC AI VIDEO GENERATION PROVIDER
# Supported: mock | fal | replicate | runway | kling | luma
# ==============================================================================
VIDEO_PROVIDER=mock

# Set ANY model from your provider:
# For Fal.ai:
#   VIDEO_MODEL=fal-ai/kling-video/v1.5/pro/image-to-video
#   VIDEO_MODEL=fal-ai/minimax-video
# For Replicate:
#   VIDEO_MODEL=kwaivgi/kling-v1.6-standard
# For Runway:
#   VIDEO_MODEL=gen3a_turbo
# For Luma:
#   VIDEO_MODEL=ray-2
VIDEO_MODEL=fal-ai/kling-video/v1.5/pro/image-to-video

# API Keys (Update when using cloud providers)
FAL_KEY=
REPLICATE_API_TOKEN=
RUNWAY_API_SECRET=
KLING_ACCESS_KEY=
KLING_SECRET_KEY=
LUMA_API_KEY=

VIDEO_DURATION_SECONDS=5
VIDEO_ASPECT_RATIO=9:16
DEFAULT_MOTION_PROMPT=gentle warm smile, natural subtle head movement, glowing photorealistic lighting, cinematic portrait
STORAGE_TYPE=local
```

---

## 🤖 Best Video Generation APIs (2025/2026 Comparison)

| Provider | Recommended Model | Best Use Case | Turnaround Latency | Developer Experience |
| :--- | :--- | :--- | :--- | :--- |
| **Fal.ai (Top Pick)** | `fal-ai/kling-video/v1.5/pro/image-to-video` or `fal-ai/minimax-video` | **Best for Photo Booths**: Lowest latency (~20–35s), realistic facial movements, unified API key. | ~20–35 seconds | ⭐⭐⭐⭐⭐ |
| **Replicate** | `kwaivgi/kling-v1.6-standard` or `luma/ray` | **Pay-per-second**: Easy token management, massive community library. | ~35–60 seconds | ⭐⭐⭐⭐⭐ |
| **RunwayML** | `gen3a_turbo` | **Cinematic lighting**: High-end hyper-realistic movement. | ~30–50 seconds | ⭐⭐⭐⭐ |
| **Kling AI (Kuaishou)** | `kling-v1-5` | **Realistic Human Portraits & Expressions**. | ~30–50 seconds | ⭐⭐⭐⭐ |
| **Luma Dream Machine** | `ray-2` | **Physics & Camera Transitions**. | ~30–45 seconds | ⭐⭐⭐⭐ |

---

## 📡 REST API Reference

### 1. Frame Selection (Step 1)
- `GET /api/frames` — List all active decorative frames and border overlays

### 2. Job Creation & Processing (Step 2, 3 & 4)
- `POST /api/jobs/generate` — Multipart form submission with `photo`, `frameId`, `fullName`, `email`, `phone`, `occasion`, `message`
- `GET /api/jobs/status/:jobId` — Real-time progress bar status polling (`0%` to `100%`)

### 3. Result, Downloads & Mobile Sharing (Step 5)
- `GET /api/jobs/result/:jobId` — Get final URLs for framed video, framed photo, and QR code
- `GET /api/jobs/download/:jobId/video` — Direct MP4 download
- `GET /api/jobs/download/:jobId/image` — Direct JPG download
- `GET /share/:jobId` — Mobile-responsive preview page loaded when scanning QR Code

### 4. Registered Users & History
- `GET /api/users` — List all registered guest profiles from `AIPhotoBoothUser` MongoDB collection
- `GET /api/users/:email` — Get single guest booth history

---

## 🧪 Run Verification Test Flow

To run an automated test that simulates an entire guest journey:
```bash
npm run test:flow
```
