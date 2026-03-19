# Summari - Telemedicine Platform

## Overview

Summari is a full-stack telemedicine platform designed for Spanish-speaking users, facilitating video/audio medical consultations, digital clinical records, e-prescriptions, and payment processing via Flow. It incorporates real-time audio transcription and AI-powered prescription generation to streamline medical workflows. The project aims to provide an accessible and efficient telehealth solution.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript (Vite)
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **UI**: shadcn/ui, Radix UI, Tailwind CSS (with Summari brand palette, light/dark mode)
- **Branding**: SVG logos (`client/public/`), Arial typography, dynamic `BrandLogo` component for theme-based asset switching.
- **Path Aliases**: `@/` for `client/src/`, `@shared/` for `shared/`

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM)
- **API**: RESTful (`/api/` prefix)
- **Authentication**: Custom JWT (bcryptjs, jsonwebtoken)
- **Real-time**: WebRTC for video/audio calls with WebSocket signaling (`/ws`), consultation chat with file sharing via WebSockets.

### Data & Persistence
- **Database**: PostgreSQL with Drizzle ORM
- **Schema**: `shared/schema.ts` (users, sessions, doctors, patients, appointments, clinical_records, prescriptions, medical_instructions, wearable_metrics, consultation_messages, consultation_ratings, exam_orders)
- **Migrations**: Drizzle-kit
- **File Storage**: `uploads/chat/` for chat attachments.

### Core Features
- **User Authentication**: JWT-based, RUT (Chilean ID) as primary identifier, password hashing (bcryptjs), localStorage for JWT storage.
- **Consultations**: WebRTC video/audio with tooltips on call controls (mute, camera, record, end call), appointment-based authorization, audio processing (WebM/Opus), continuous audio recording during consultations, server-side transcription post-consultation.
- **AI Integration**: OpenAI Whisper for audio transcription, GPT-4o for generating clinical summaries, prescriptions, medical instructions, exam orders, and structured medical reports (informe médico) from transcripts. Raw transcription is stored in DB but hidden from UI; a structured medical report is displayed instead.
- **Payment Gateway**: Flow (Chilean payment gateway) for consultation fees, HMAC-SHA256 webhook verification.
- **Wearable Health Data**: Tracking system for various metrics (heart rate, steps, etc.), support for manual entry, CSV import, and Fitbit OAuth2 integration with scheduled sync.
- **Post-Consultation Workflow**: Doctor validation page with clinical alerts system (prescription error detection, dosage warnings, health risk analysis), patient feedback system, PDF document generation with in-app preview modal, and email delivery of documents (prescriptions, instructions, exam orders) via Resend. Exam orders use per-exam justification (not global). No AI suggestion button on validation page.
- **Document Management**: Patient-facing pages for medical instructions and exam orders, with PDF download and preview.
- **Patient Card**: Validation page shows patient name, RUT, age (calculated), gender (Spanish), blood type, email, WhatsApp, allergies, medical history, and emergency contact.

## External Dependencies

### Third-Party Services
- **Flow**: Chilean payment processing (sandbox: `https://sandbox.flow.cl/api`)
- **OpenAI**: AI integrations for transcription (Whisper) and text generation (GPT-4o) via Replit AI Integrations
- **Resend**: For email delivery of documents and password recovery.
- **Fitbit**: OAuth2 integration for wearable health data synchronization.

### Database
- **PostgreSQL**: Primary data store.

### Environment Variables
- `DATABASE_URL`
- `SESSION_SECRET`
- `FLOW_KEY`
- `FLOW_SECRET`
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `FITBIT_CLIENT_ID`
- `FITBIT_CLIENT_SECRET`