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
- **Styling**: Tailwind CSS with custom medical-themed color palette (light/dark mode support)
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
