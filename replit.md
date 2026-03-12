# Summari - Telemedicine Platform

## Overview

Summari is a full-stack telemedicine platform built for Spanish-speaking users. It enables patients to schedule video/audio medical consultations, maintain digital clinical records, receive digital prescriptions, and process payments through Flow (Chilean payment gateway). The platform features real-time audio transcription for medical consultations and AI-powered prescription generation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, built using Vite
- **Routing**: Wouter for client-side navigation
- **State Management**: TanStack React Query for server state and caching
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with Summari brand color palette (light/dark mode support)
- **Brand Assets**: SVG logos in `client/public/` - logotype (COLOR_1=white for dark, COLOR_2=blue for light), isotipo (2=white for dark, 2_1=blue for light). BrandLogo component handles theme switching.
- **Typography**: Arial (system font) per brand manual
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **Build Tool**: esbuild for production bundling, tsx for development
- **API Pattern**: RESTful endpoints under `/api/` prefix
- **Authentication**: Custom JWT-based authentication (bcryptjs + jsonwebtoken)

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Key Tables**: users, sessions, doctors, patients, appointments, clinical_records, prescriptions, medical_instructions
- **Migrations**: Managed via `drizzle-kit push` command

### Authentication & Authorization
- **Provider**: Custom JWT-based authentication system
- **Auth Module**: `server/auth.ts` - contains register/login endpoints, RUT validation, and isAuthenticated JWT middleware
- **RUT as Primary Identifier**: Each user is uniquely identified by their Chilean RUT (modulo-11 validated on both frontend and backend)
- **Password Hashing**: bcryptjs with salt rounds 10
- **JWT Token**: Signed with SESSION_SECRET (required), expires in 7 days
- **Frontend Storage**: JWT token stored in localStorage, sent as `Authorization: Bearer <token>` header
- **Protected Routes**: `isAuthenticated` middleware verifies JWT and sets `req.userId`
- **User Registration**: POST `/api/auth/register` (rut, email, whatsapp, password, firstName, lastName) - also auto-creates patient profile
- **User Login**: POST `/api/auth/login` (identifier [RUT or email], password) → returns JWT token + user data
- **User Sync**: Auto-creates patient profiles on first authenticated request to /api/auth/user
- **Frontend Auth Pages**: `/login` (sign in with RUT or email), `/crear-cuenta` (sign up with RUT, email, WhatsApp, name, password)

### Real-time Features
- **Video Calling**: WebRTC peer-to-peer video/audio calls with WebSocket signaling server on `/ws` path
- **WebRTC Hook**: `client/src/hooks/use-webrtc.ts` manages peer connections, media streams, and signaling
- **Security**: Appointment-based authorization validates users are doctor or patient for the consultation
- **Room Limits**: Maximum 2 participants per consultation room
- **Audio Processing**: Voice recording with WebM/Opus format, AudioWorklet for playback
- **Transcription**: OpenAI Whisper via Replit AI Integrations for speech-to-text
- **AI Features**: GPT-4o for extracting prescription data from consultation transcripts

### Payment Processing
- **Provider**: Flow (Chilean payment gateway) with HMAC-SHA256 webhook signature verification
- **Payment Flow**: Create payment → Flow redirect → webhook confirmation → appointment status update
- **Security**: Duplicate payment prevention, idempotent webhook processing, ownership verification
- **Configuration**: FLOW_KEY, FLOW_SECRET environment variables, FLOW_BASE_URL defaults to sandbox

## External Dependencies

### Third-Party Services
- **Flow**: Chilean payment processing for consultation fees (sandbox: https://sandbox.flow.cl/api)
- **OpenAI**: Audio transcription (Whisper) and text generation (GPT-4o) via Replit AI Integrations

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Required Tables**: users (with rut unique, passwordHash, whatsapp), patients, doctors, plus application tables

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: JWT signing secret key (required at startup)
- `FLOW_KEY`: Flow payment gateway API key
- `FLOW_SECRET`: Flow payment gateway secret key
- `AI_INTEGRATIONS_OPENAI_API_KEY`: OpenAI API key from Replit integrations
- `AI_INTEGRATIONS_OPENAI_BASE_URL`: OpenAI base URL from Replit integrations

### Key NPM Packages
- `drizzle-orm` + `drizzle-zod`: Database ORM and schema validation
- `express`: HTTP server
- `bcryptjs` + `jsonwebtoken`: Custom JWT authentication
- `openai`: AI integrations for transcription and text generation
- `@tanstack/react-query`: Client-side data fetching
- `wouter`: Client-side routing
- `react-day-picker`, `date-fns`: Date handling for appointment scheduling

## Recent Changes
- **2026-02-09**: Integrated RUT, WhatsApp, and email into main registration form. RUT is now the unique identifier for all users. Login accepts RUT or email. Removed separate /registro page. Server-side modulo-11 RUT validation added.
- **2026-02-09**: Replaced Replit Auth (OIDC/Passport) with custom JWT-based authentication. Added login page (/login), register page (/crear-cuenta).
- **2026-02-09**: Integrated Flow payment gateway with HMAC-SHA256 webhook verification.
- **2026-02-09**: Added password recovery system via email (Resend integration). Users can request a reset link by RUT or email, receive it via email, and set a new password. Token expires in 1 hour.
- **2026-02-09**: Integrated Flow payment into appointment booking flow. Appointments are created as "scheduled"/"pending" and automatically initiate a Flow payment. User is redirected to Flow to pay. Appointment is confirmed only after successful payment via webhook. Payment status badges shown in appointment list.
- **2026-02-10**: Added post-consultation validation flow. When a doctor ends a consultation, the appointment enters "pending_validation" status. A validation page (/doctor/consultation/:id/validate) lets the doctor review/edit AI-generated clinical summaries, prescriptions, and medical instructions from the transcription before finalizing. The consultation is only marked "completed" after doctor validation. AI suggestions use GPT-4o to extract all three data types in a single call.
- **2026-02-11**: Added wearable health data tracking system. New `wearable_metrics` table supports 9 metric types (heart_rate, steps, sleep_duration, spo2, bp_systolic, bp_diastolic, weight, temperature, calories) from multiple sources (manual, csv_import, apple_health, google_fit, fitbit, etc.). Patient Health Data page (`/health-data`) with manual entry, CSV import, summary cards with out-of-range alerts, 30-day trend charts (recharts/shadcn), and history view. Doctor consultation validation sidebar includes "Datos Wearable" card showing patient metrics summary and AI analysis button (GPT-4o). API routes: patient CRUD (`/api/wearable-metrics`), batch import, doctor access (`/api/doctor/patients/:id/wearable-metrics`), AI analysis endpoint.
- **2026-02-11**: Integrated Fitbit OAuth2 with PKCE flow. New `wearable_connections` table stores OAuth tokens per patient/provider. Backend routes: POST `/api/fitbit/authorize` (generates PKCE auth URL with HMAC-signed state), GET `/api/fitbit/callback` (exchanges code, stores tokens), POST `/api/fitbit/sync` (fetches 30 days of steps/heart rate/sleep/SpO2/weight/calories/temperature with auto token refresh), DELETE `/api/fitbit/disconnect`, GET `/api/fitbit/connections` (status). Frontend sync tab shows live connection status, connect/sync/disconnect buttons. Google Fit marked as deprecated (June 2025). Requires FITBIT_CLIENT_ID and FITBIT_CLIENT_SECRET secrets. Callback URL: `{BASE_URL}/api/fitbit/callback`.
- **2026-02-11**: Fixed Fitbit data accuracy: weight now uses log endpoint (not time-series which repeats last value daily), calories filtered to days with actual step activity only (no BMR-only estimates), per-day deduplication for weight.
- **2026-02-11**: Added automatic Fitbit sync scheduler (`server/fitbit-scheduler.ts`). Runs every 60 minutes for all active Fitbit connections. Auto-refreshes expired tokens, deactivates invalid connections, deduplicates metrics. Starts 30s after server boot. Builds historical record for doctor analysis during consultations.
- **2026-02-12**: Applied brand manual theming. Color palette: primary #3473a8 (Azul), secondary #00ced1 (Celeste), text #1c2833 (Oscuro), muted #708090 (Gris). Font switched to Arial. SVG brand logos replace stethoscope icon across all pages (sidebar, login, register, landing, forgot/reset password). Favicon updated to brand isotipo SVG. BrandLogo component (`client/src/components/brand-logo.tsx`) handles dark/light theme switching with system theme detection.
- **2026-02-18**: Added exam orders feature to consultation validation. New `exam_orders` table stores ordered exams (name, instructions) with clinical justification per clinical record. Backend: storage CRUD (get/create/delete by record ID), API GET validation returns exam orders, POST validate persists exam orders with Zod validation. Frontend: new "Exámenes" tab in consultation validation page with add/edit/remove exam items and clinical justification field. AI suggestions (GPT-4o) now extract exam orders from transcriptions alongside clinical summary, prescriptions, and instructions.
- **2026-02-19**: Moved transcription from real-time to end-of-consultation. Audio is now recorded continuously during the consultation (stored client-side) but NOT transcribed in real-time. When the doctor ends the consultation, all audio chunks are combined into a single blob, sent to the server, and transcribed server-side using `transcribeAudioChunked` (splits large audio into 2-min WAV segments via ffmpeg for reliable transcription). AI suggestions are generated after transcription completes. Processing overlay shown while transcription runs. Consultation page tab renamed from "Transcripción" to "Grabación".
- **2026-03-08**: Improved WebRTC video call reliability: ICE candidate queuing (fixes race condition where candidates arrive before remote description), stable callback refs via useRef pattern, WebSocket ping/pong keep-alive (25s interval), server-side stale connection cleanup on reconnect, audio-only fallback.
- **2026-03-08**: Added consultation chat system with file sharing. New `consultation_messages` table stores text messages and file attachments per appointment. Both doctor and patient can chat and share files (up to 10MB) during consultations. Chat messages are delivered in real-time via WebSocket broadcast. Role-based sidebar tabs: patients see Chat + Médico tabs; doctors see Chat + Paciente + Notas + Grabación tabs. File uploads stored in `uploads/chat/` with multer. API: GET/POST `/api/consultations/:id/messages`.
- **2026-03-09**: Added post-consultation feedback page for patients. When patient ends call or doctor disconnects, patient is redirected to `/consultation/:id/feedback` to rate the doctor (1-5 stars + comment) and the platform (1-5 stars + comment). After submitting, shows confirmation with info about pending clinical documents (ficha clínica, recetas, indicaciones) that will be available once the doctor finalizes them. New `consultation_ratings` table. Consultation page rendered fullscreen (no sidebar) to prevent accidental navigation during calls.
- **2026-03-09**: Fixed AI suggestions persistence bug. When doctor ends consultation, AI-generated suggestions (clinical summary, prescriptions, medical instructions, exam orders) are now stored in the database as draft records. The validation page loads pre-filled data from these persisted records instead of relying on transient response data. Added detailed transcription logging (buffer sizes, conversion status) to diagnose empty transcription issues.
- **2026-03-12**: Added consultation document email delivery. After doctor validates a consultation, a post-validation screen shows checkboxes to select which documents (prescription, medical instructions, exam orders) to send to the patient's email. Uses Resend integration. API: POST `/api/consultations/:id/send-documents` with `{ documentTypes: ['prescription', 'instructions', 'exams'] }`. HTML email templates with branded styling, medication tables, instruction cards with priority badges, and exam order lists. All user-interpolated content is HTML-escaped to prevent injection.
