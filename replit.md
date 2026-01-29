# Summari - Telemedicine Platform

## Overview

Summari is a full-stack telemedicine platform built for Spanish-speaking users. It enables patients to schedule video/audio medical consultations, maintain digital clinical records, receive digital prescriptions, and process payments through Stripe. The platform features real-time audio transcription for medical consultations and AI-powered prescription generation.

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
- **Authentication**: Replit Auth integration with OpenID Connect, session-based with PostgreSQL session store

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Key Tables**: users, sessions, doctors, patients, appointments, clinical_records, prescriptions, medical_instructions, conversations, messages
- **Migrations**: Managed via `drizzle-kit push` command

### Authentication & Authorization
- **Provider**: Replit Auth (OpenID Connect)
- **Session Storage**: PostgreSQL via connect-pg-simple
- **Protected Routes**: `isAuthenticated` middleware validates user sessions
- **User Sync**: Auto-creates patient profiles on first login

### Real-time Features
- **Video Calling**: WebRTC peer-to-peer video/audio calls with WebSocket signaling server on `/ws` path
- **WebRTC Hook**: `client/src/hooks/use-webrtc.ts` manages peer connections, media streams, and signaling
- **Security**: Appointment-based authorization validates users are doctor or patient for the consultation
- **Room Limits**: Maximum 2 participants per consultation room
- **Audio Processing**: Voice recording with WebM/Opus format, AudioWorklet for playback
- **Transcription**: OpenAI Whisper via Replit AI Integrations for speech-to-text
- **AI Features**: GPT-4o for extracting prescription data from consultation transcripts

### Payment Processing
- **Provider**: Stripe integration via Replit connector
- **Webhook Handling**: Automatic payment status updates for appointments
- **Schema Sync**: stripe-replit-sync manages Stripe-related database tables

## External Dependencies

### Third-Party Services
- **Stripe**: Payment processing for consultation fees, managed webhooks
- **OpenAI**: Audio transcription (Whisper) and text generation (GPT-4o) via Replit AI Integrations
- **Replit Auth**: User authentication and session management

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Required Tables**: sessions (mandatory for auth), users (mandatory for auth), plus application tables

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Express session encryption key
- `AI_INTEGRATIONS_OPENAI_API_KEY`: OpenAI API key from Replit integrations
- `AI_INTEGRATIONS_OPENAI_BASE_URL`: OpenAI base URL from Replit integrations
- `REPL_ID`: Replit environment identifier
- `ISSUER_URL`: OpenID Connect issuer (defaults to Replit)

### Key NPM Packages
- `drizzle-orm` + `drizzle-zod`: Database ORM and schema validation
- `express` + `express-session`: HTTP server and session handling
- `openai`: AI integrations for transcription and text generation
- `stripe` + `stripe-replit-sync`: Payment processing
- `passport` + `openid-client`: Authentication
- `@tanstack/react-query`: Client-side data fetching
- `wouter`: Client-side routing
- `react-day-picker`, `date-fns`: Date handling for appointment scheduling