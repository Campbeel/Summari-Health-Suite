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
- **Schema**: `shared/schema.ts` (users, sessions, doctors, patients, appointments, clinical_records, prescriptions, medical_instructions, wearable_metrics, consultation_messages, consultation_ratings, exam_orders, reimbursement_requests, ges)
- **Migrations**: Drizzle-kit
- **File Storage**: `uploads/chat/` for chat attachments.

### Core Features
- **User Authentication**: JWT-based, RUT (Chilean ID) as primary identifier, password hashing (bcryptjs), localStorage for JWT storage.
- **Consultations**: WebRTC video/audio with tooltips on call controls (mute, camera, record, end call), appointment-based authorization, audio processing (WebM/Opus), continuous audio recording during consultations, server-side transcription post-consultation.
- **AI Integration**: OpenAI Whisper for audio transcription, GPT-4o for generating clinical summaries, prescriptions, medical instructions, exam orders, and structured medical reports (informe médico) from transcripts. Raw transcription is stored in DB but hidden from UI; a structured medical report is displayed instead. AI Clinical Assistant chatbot available during consultations (doctor sidebar) and on validation page (right panel) - provides context-aware clinical support with patient summary on load. AI-generated diagnosis auto-matches against GES database.
- **GES (Garantías Explícitas en Salud) Integration**: Read-only `ges` table with 87 unique health problems and ~6,178 CIE-10 descriptors. Uses `pg_trgm` extension for fuzzy search. When AI generates a diagnosis, it auto-matches against GES entries and stores them in `clinical_records.ges_diagnosis` (JSONB). Doctors can manually search/add GES diagnoses on the validation page via a search panel. Each GES entry has `idProblema`, `problemaDeSalud`, `codigoCie10`, `descriptor`. APIs: `GET /api/ges/search?q=`, `GET /api/ges/problems?q=`, `GET /api/ges/problems/:id/descriptors`, `POST /api/ges/match`.
- **Payment Gateway**: Flow (Chilean payment gateway) for consultation fees, HMAC-SHA256 webhook verification. Payment receipt email sent automatically via SMTP on successful payment.
- **Appointment Rescheduling**: Patients can reschedule scheduled/confirmed appointments via dialog with date/time picker that respects doctor availability. API: `POST /api/appointments/:id/reschedule`.
- **Reimbursement Requests**: Patients can request reimbursement for paid appointments. Schema: `reimbursement_requests` table. APIs: `POST /api/appointments/:id/reimbursement`, `GET /api/appointments/:id/reimbursement`, `GET /api/reimbursements`.
- **Online Presence Indicators**: Real-time presence detection using WebSocket signaling rooms. Doctor dashboard shows patient online/waiting status. Patient waiting room shows doctor online indicator. API: `GET /api/appointments/:id/presence`.
- **Specialty Filtering**: Booking page includes dropdown filter to narrow doctors by specialty.
- **Wearable Health Data**: Tracking system for various metrics (heart rate, steps, etc.), support for manual entry, CSV import, and Fitbit OAuth2 integration with scheduled sync.
- **Post-Consultation Workflow**: Doctor validation page with clinical alerts system (prescription error detection, dosage warnings, health risk analysis), patient feedback system, PDF document generation with in-app preview modal, and email delivery of documents (prescriptions, instructions, exam orders) via Resend. Exam orders use per-exam justification (not global). No AI suggestion button on validation page.
- **Document Management**: Patient-facing pages for medical instructions and exam orders, with PDF download and preview.
- **Patient Card**: Validation page shows a compact horizontal patient info bar at the top with name, RUT, age, gender, blood type, email, WhatsApp, allergies, and medical history. Emergency contact data is available via the API.
- **Clinical Assistant Chatbot**: Reusable `ClinicalAssistant` component (`client/src/components/clinical-assistant.tsx`). Backend endpoints: `POST /api/consultations/:id/assistant/welcome` (auto-greeting with patient context) and `POST /api/consultations/:id/assistant/chat` (conversation). Both verify doctor ownership of the appointment. Available in consultation sidebar (forceMount to preserve state across tab switches) and validation page right panel.
- **Doctor Patient Management**: Patient list page (`/doctor/patients`) with search by name/RUT/email, patient detail page (`/doctor/patients/:patientId`) with tabs for appointment history, clinical records, prescriptions, and exam orders. Doctors can see full patient history including consultations with other doctors. Access is relationship-scoped: doctors can only view patients they have at least one appointment with. Backend enforces authorization via `doctorHasPatientRelationship` check. APIs: `GET /api/doctors/me/patients`, `GET /api/doctors/me/patients/:id`, `GET /api/doctors/me/patients/:id/history`, `/records`, `/prescriptions`, `/exam-orders`.

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