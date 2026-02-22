# Opax — Product Overview v1.0.1

## What is Opax?

Opax is a privacy-first clinical orchestration platform built as a cross-platform desktop application (macOS and Windows). It serves as an intelligent interface between clinicians and the fragmented hospital IT landscape — EHR systems, pharmacy dispensers, communication platforms, and lab systems — all accessible through natural language conversation.

Instead of forcing doctors to navigate 5-6 disconnected legacy systems per shift, Opax lets them talk to one AI assistant that can reach into any system on their behalf. Think of it as the operating system for the hospital edge.

## Why Opax Exists

Clinicians lose roughly 30% of their shifts navigating rigid, disconnected software. Existing AI solutions fail in healthcare for three reasons:

1. **Privacy** — Cloud-based LLMs require sending Protected Health Information (PHI) to external servers, creating HIPAA compliance nightmares.
2. **Latency** — Cloud round-trips introduce delays that frustrate fast-moving medical staff.
3. **Integration** — Hard-coding integrations for every hospital's unique software mix (Epic vs. Cerner, Cisco vs. Genesys) is unscalable.

Opax solves this with a "Bring Your Own Tool" architecture using the Model Context Protocol (MCP). Hospitals connect their own systems as MCP servers, and Opax orchestrates them through a single conversational interface. No PHI leaves the device unless explicitly configured.

## Who It's For

- Doctors and nurses who need fast access to patient data, lab results, and scheduling
- Hospital IT teams looking for a vendor-agnostic integration layer
- Clinical administrators managing staff and workflows
- Healthcare organizations prioritizing HIPAA compliance

---

## Current Features (v1.0.1)

### AI-Powered Chat

The core of Opax is a streaming chat interface powered by the Vercel AI SDK. Clinicians type or speak naturally, and the AI understands intent, calls the right tools, and presents results in rich visual cards.

- Supports OpenAI (GPT-4o-mini, GPT-4o) and Google Gemini (Gemini 2.5 Flash Lite)
- Real-time streaming responses with tool call visualization
- Conversation history persisted locally via RxDB (IndexedDB)
- Multi-session support with sidebar navigation

### MCP Tool Integration

Opax connects to clinical backend systems via the Model Context Protocol. This is the "Universal Adapter" layer.

- Connect to local MCP servers via stdio (Python/Node.js scripts)
- Connect to cloud-hosted MCP servers via StreamableHTTP
- Three preinstalled clinical servers available out of the box:
  - **Clinical PMS** — Patient management (appointments, records)
  - **Clinical SAS** — Staff and administration
  - **Clinical LTS** — Lab tests and results
- All hosted at `clinicaltools.vercel.app`
- Tool discovery, execution, and result rendering happen automatically
- The AI decides which tools to call based on the conversation

### Dynamic UI Card System

When MCP servers return data, Opax renders it as rich, interactive cards instead of raw text. The server drives the UI — each response includes a `metadata.componentType` field that tells Opax which card to render.

11 card types currently supported:

- **Patient Cards** — PatientInfoCard, PatientProfileCard, PatientListCard
- **Staff Cards** — StaffProfileCard, StaffListCard
- **Call Cards** — Outgoing call banner with pulse animations
- **Lab Cards** — LabResultCard (with abnormal value highlighting), LabResultsListCard, LabOrderCard, LabOrderListCard
- **Form Cards** — Dynamic form generation from server schema
- **Error Cards** — Graceful error display

Cards feature priority badges (normal/urgent/stat), status color coding, abnormal value detection (red highlighting for out-of-range lab results), and responsive layouts.

### Human-in-the-Loop Forms

When a clinician asks the AI to create something (schedule an appointment, order a lab test), the MCP server returns a form schema instead of creating the record blindly. Opax renders a dynamic form, and the AI is completely paused — no prompts are processed until the clinician fills out and submits the form.

This ensures:
- Doctors review and confirm all data before it's written
- No accidental record creation from AI hallucinations
- Full control over clinical data entry

### Voice Input (Whisper STT)

Opax includes local speech-to-text via Whisper (whisper.cpp). Clinicians can tap the microphone button, speak their request, and the transcribed text appears in the input field. All transcription happens on-device — no audio leaves the machine.

- Supports multiple Whisper models (base.en, distil-large-v3)
- Audio captured via browser MediaRecorder API
- Processed in the Electron main process

### Conversation Persistence

All conversations are stored locally using RxDB with Dexie (IndexedDB) storage. This means:

- Chat history survives app restarts
- Multiple conversation sessions with sidebar navigation
- Conversation previews and timestamps
- Delete individual conversations
- Automatic corruption recovery (wipes and rebuilds if IndexedDB is corrupted)

### Welcome Experience

First-time users see a welcome modal to set their name. The name is persisted in the local database and displayed throughout the app (sidebar avatar, greeting screen).

### Settings and Configuration

- Configure OpenAI or Gemini API keys
- Select AI model
- Provider switching (OpenAI ↔ Gemini)
- API keys stored locally in `api-config.json` in the user data directory
- Profile management (name, avatar)

### Security

- Electron context isolation enabled
- Node integration disabled in renderer
- Secure preload script with explicit API surface
- Content Security Policy enforced
- Single instance lock (prevents multiple app instances from corrupting the database)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron 34 |
| Frontend | React 18, TypeScript, Framer Motion |
| AI/LLM | Vercel AI SDK, OpenAI, Google Gemini |
| Tool Protocol | Model Context Protocol (MCP) SDK |
| Voice | Whisper (whisper.cpp via nodejs-whisper) |
| Database | RxDB with Dexie (IndexedDB) |
| Build | Vite, TypeScript, Electron Builder |
| Styling | CSS with custom properties (sage/slate-blue palette) |
| Testing | Vitest, fast-check (property-based) |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Renderer                    │
│  React App → Cards → Hooks → RxDB (local)   │
├─────────────────────────────────────────────┤
│              Preload (IPC Bridge)            │
│  Secure API surface: chat, mcp, form, etc.  │
├─────────────────────────────────────────────┤
│                Main Process                  │
│  AIService ← Vercel AI SDK                  │
│  MCPService ← stdio / StreamableHTTP        │
│  WhisperService ← whisper.cpp               │
├─────────────────────────────────────────────┤
│            External MCP Servers              │
│  Clinical PMS │ Clinical SAS │ Clinical LTS  │
└─────────────────────────────────────────────┘
```

---

## User Stories

### Story 1: Morning Patient Lookup
Dr. Patel opens Opax and types "Show me today's appointments." The AI calls the PMS `list_appointments` tool. Opax renders a list of appointment cards with patient names, times, and status badges. She taps a patient card to see their full profile.

### Story 2: Ordering a Lab Test
A nurse says "Order a CBC for patient Manish." The AI calls `create_lab_order` but the server returns a form schema (missing required fields). Opax renders a dynamic form with patient ID, test type, priority, and notes. The AI waits. The nurse fills in the details, selects "urgent" priority, and submits. The record is created and a confirmation card appears.

### Story 3: Checking Lab Results
Dr. Singh asks "What are the latest lab results for patient 42?" The AI calls `get_lab_results`. Opax renders lab result cards with values, reference ranges, and red highlighting for any abnormal results. The doctor spots an elevated creatinine level immediately.

### Story 4: Staff Management
The admin types "Show me all available doctors." The AI calls the SAS `list_staff` tool. Staff profile cards appear with names, specialties, and availability status.

### Story 5: Voice Workflow
Dr. Patel taps the mic button and says "Schedule an appointment for Manish with Dr. Sohan tomorrow at 10 AM." The text appears in the input, she hits send, and the AI processes the request through the PMS server.

---

## Platform Support

| Platform | Format | Status |
|----------|--------|--------|
| macOS (Apple Silicon) | DMG | Available |
| Windows (x64) | NSIS Installer (.exe) | Available |
| macOS (Intel) | — | Not yet built |
| Linux | — | Configured (AppImage/deb), not yet built |

Download from: [GitHub Releases](https://github.com/manishindiyaar/Opax/releases)

Note: Builds are not code-signed. Mac users need to right-click → Open to bypass Gatekeeper. Windows users click "More info" → "Run anyway" on SmartScreen.

---

## Future Scope

### Jarvis Voice Agent (Spec Complete, Implementation Pending)
A full-screen voice interaction mode powered by Deepgram's Voice Agent API. Features include:
- Animated "Jarvis sphere" that reacts to conversation state (idle, listening, thinking, speaking)
- Real-time bidirectional voice — speak naturally, hear responses
- Live transcript display
- MCP tool execution during voice conversation
- State machine with visual feedback for each phase
- Deepgram STT (Nova-3) + TTS (Aura-2) + configurable LLM backend

### AgentBox (Coming Soon)
An automation engine for clinical workflows:
- Cron-based and event-driven rule triggers
- Multi-step workflows with conditional logic
- Polling MCP servers for new data
- Automated notifications and actions

### Planned Enhancements
- Offline LLM support (FunctionGemma 270M via llama.cpp)
- Code signing for macOS and Windows
- Auto-update mechanism
- Multi-language support
- FHIR/HL7 integration adapters
- Audit logging for compliance
- Role-based access control
- Custom MCP server marketplace

---

## Design Language

Opax uses a "Clinical Zen" design system — calm, intelligent, paper-like.

- **Primary palette**: Sage green (#5D8570) and Slate blue (#647D94)
- **Background**: Warm paper (#FBFBF9) with white surfaces
- **Cards**: Dark gradient backgrounds (sage-900 → slate-blue-900) for contrast
- **Typography**: Mona Sans (UI) + Newsreader (headings)
- **Animations**: Spring physics via Framer Motion, reduced-motion support
- **Spacing**: 4px base scale (4, 8, 12, 16, 24, 32, 48, 64)

---

## Version History

| Version | Date | Highlights |
|---------|------|-----------|
| v1.0.0 | Feb 2026 | Initial release — chat, MCP, cards, voice input |
| v1.0.1 | Feb 2026 | Production build fix, AgentBox cleanup, Windows build, GitHub Release |

---

*Opax is open source and available at [github.com/manishindiyaar/Opax](https://github.com/manishindiyaar/Opax)*
