# Canton Quests — Technical Architecture & Engineering Framework

---

## 1. Architectural Philosophy

> **Distinction Note**: Items marked **[DECISION]** represent confirmed architectural commitments. Items marked **[RECOMMENDATION]** represent evaluated technology candidates subject to validation during Phase 1 MVP development.

Canton Quests requires a lightweight, highly responsive, mobile-first Progressive Web App (PWA) architecture. The system must operate reliably out in the physical city on cellular networks while supporting real-world geolocation, instant media uploads, real-time leaderboards, and administrative event controls.

---

## 2. Technology Stack Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT / FRONTEND (PWA)                         │
│   Next.js 14+ (App Router) • React 18+ • TypeScript • Tailwind CSS    │
│   Mapbox GL / Leaflet • HTML5 Camera API • Geolocation API • Workbox   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS / WebSockets / Server Actions
┌───────────────────────────────────▼────────────────────────────────────┐
│                       BACKEND & PLATFORM SERVICES                      │
│   Supabase (PostgreSQL 15+ • Row Level Security • Realtime Subscriptions)│
│   Supabase Auth (SMS OTP / OAuth) • Supabase Storage (Photos/Videos)   │
│   Vercel Serverless / Edge Functions • Upstash Redis (Rate Limiting)   │
└────────────────────────────────────────────────────────────────────────┘
```

| Layer | Status | Candidate Technology | Rationale |
| :--- | :--- | :--- | :--- |
| **Framework** | **[DECISION]** | **Next.js 14+ (App Router)** | Full-stack React framework with SSR, Edge API routes, PWA support, and Vercel optimization. |
| **Language** | **[DECISION]** | **TypeScript 5.x** | End-to-end type safety across backend schemas, client state, and API payload definitions. |
| **Database** | **[DECISION]** | **Supabase (PostgreSQL)** | Enterprise relational DB with built-in PostGIS location extension, RLS policies, and real-time triggers. |
| **Auth** | **[DECISION]** | **Supabase Auth** | Frictionless passwordless auth via SMS OTP, Magic Link, and OAuth (Google/Apple). |
| **Storage** | **[DECISION]** | **Supabase Storage** | S3-backed CDN storage for player proof photos, video submissions, and avatar assets. |
| **Hosting** | **[RECOMMENDATION]** | **Vercel** | Automated deployment pipelines, global edge caching, and serverless scalability. |
| **Mapping** | **[RECOMMENDATION]** | **Mapbox GL JS / Leaflet** | Vector tile maps with custom dark-mode theme layers and custom marker overlays. |
| **Cache & Queue**| **[RECOMMENDATION]** | **Upstash Redis** | Fast rate limiting, temporary leaderboard caching, and leaderboard lock states. |

---

## 3. Core System Subsystems

### 3.1 Mobile-First PWA Engine
- Zero app store download required: Players scan a physical QR code in Canton and land directly in the playable PWA within 3 seconds.
- Offline support via Service Workers: Active quest steps cached locally so players don't lose progress if cellular signal drops briefly in historic brick buildings.

### 3.2 Geolocation & Map Engine
- Browser Geolocation API integration with fallback high-accuracy mode (`enableHighAccuracy: true`).
- Client-side geo-fence evaluation combined with server-side validation using PostGIS point-in-polygon functions.

### 3.3 Proof Verification & Anti-Cheat Engine
- **QR Code Engine**: Dynamic HMAC-signed QR tokens to prevent players from sharing QR photos remotely.
- **Speed & Spoofing Guard**: Server checks time delta vs physical distance between check-ins. Moving >15 mph locks auto-checkins.
- **Media Proof Verification**: Photo/video submissions automatically tagged with EXIF metadata (GPS + timestamp) and routed to admin review queue.

### 3.4 Real-Time Scoring & Leaderboard Subsystem
- Supabase Realtime subscriptions broadcast live score changes to client leaderboards.
- Automated 2-hour blackout curtain prior to Sunday Finale managed via Redis key state.

### 3.5 Admin & Live Operations Control Center
- Web-based admin console for event directors to:
  - Trigger live Flash Quests with push notifications.
  - Review and score pending photo/video proof submissions.
  - Pause/Resume events or edit quest parameters dynamically.
  - Broadcast live alerts to all active player dashboards.

---

## 4. Multi-City Expansion Readiness

The system isolates city configuration (`cities` table, local spatial bounding boxes, localized branding assets) from the core game engine logic:

```typescript
// Core Engine Context Structure
interface GameContext {
  cityId: string;        // e.g. "canton-oh"
  eventId: string;       // e.g. "canton-vol-1"
  playerLocation: {
    lat: number;
    lng: number;
    accuracy: number;
  };
}
```

This guarantees Canton launch priority while ensuring future cities (*Akron*, *Cleveland*, *Columbus*) can be spun up simply by adding database records and asset bundles.
