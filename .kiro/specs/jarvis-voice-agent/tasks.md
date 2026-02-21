# Implementation Plan: Jarvis Voice Agent

## Overview

Layered implementation: main-process WebSocket service → IPC bridge → renderer hook → animated UI. Each phase builds on the previous and ends with wired integration.

## Tasks

- [ ] 1. Install dependency and extend API key persistence
  - Run `npm install @deepgram/sdk` to add the Deepgram SDK
  - Extend the `ApiConfig` interface in `src/main/index.ts` (or shared types) with `deepgramApiKey?: string`
  - Update the `api:setKeys` IPC handler to read and persist `deepgramApiKey` to `api-config.json`
  - Update the `api:getStatus` IPC handler to return `deepgramApiKey` in its response
  - _Requirements: 8.2, 8.3_

- [ ] 2. Implement DeepgramVoiceService
  - [ ] 2.1 Create `src/main/services/DeepgramVoiceService.ts` with the class skeleton
    - Define `DeepgramVoiceServiceConfig`, `VoiceAgentEvent`, and `DeepgramFunctionDef` interfaces
    - Implement `isActive()`, `start()`, `stop()`, `sendAudio()`, `keepAlive()`, and `on()` methods
    - Implement `buildSettingsMessage()` as an exported pure function mapping config + MCP tools to `DeepgramSettingsMessage`
    - Implement `handleAgentEvent()` dispatching all Deepgram event types to typed `VoiceAgentEvent` emits
    - Implement `handleFunctionCall()` with try/catch ensuring exactly one `FunctionCallResponse` per request
    - Export a `getDeepgramVoiceService()` singleton factory
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 4.5, 4.6_

  - [ ]* 2.2 Write property test for `buildSettingsMessage` (Property 2)
    - **Property 2: SettingsMessage Structure Correctness**
    - **Validates: Requirements 2.2, 9.1, 9.2, 9.3, 9.4, 9.5**
    - Use `fast-check` to generate arbitrary valid configs and arbitrary MCP tool arrays
    - Assert `functions.length === mcpTools.length`, each entry has `name`/`description`/`parameters`, provider mapping is correct, audio encoding is `linear16` at `24000`

  - [ ]* 2.3 Write property test for `handleFunctionCall` one-to-one mapping (Property 3)
    - **Property 3: FunctionCallResponse One-to-One Mapping**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5**
    - Use `fast-check` to generate arbitrary sequences of `FunctionCallRequest` events (success, failure, not-found)
    - Assert exactly one `FunctionCallResponse` is sent per request matched by `function_call_id`, no exception propagates

- [ ] 3. Register IPC handlers in main process
  - Add `voiceAgent:start` handler (`ipcMain.handle`) in `src/main/index.ts` that calls `voiceService.start(config)` and returns `{ success, error? }`
  - Add `voiceAgent:stop` handler (`ipcMain.handle`) that calls `voiceService.stop()` and returns `{ success }`
  - Add `voiceAgent:audio` listener (`ipcMain.on`) that calls `voiceService.sendAudio(buffer)` fire-and-forget
  - Wire `voiceService.on('agentEvent', ...)` to push `voiceAgent:event` to renderer via `mainWindow.webContents.send`
  - Wire `voiceService.on('audioChunk', ...)` to push `voiceAgent:audio` to renderer
  - _Requirements: 2.1, 4.5, 12.2, 12.3_

- [ ] 4. Extend preload IPC bridge
  - Add `voiceAgent` namespace to `src/preload/index.ts` exposing `start`, `stop`, `sendAudio`, `onEvent`, `onAudio`, `removeListeners`
  - Implement `sendAudio` using `ipcRenderer.send` (fire-and-forget); implement `start`/`stop` using `ipcRenderer.invoke`
  - Implement `removeListeners` to remove all `voiceAgent:event` and `voiceAgent:audio` listeners
  - Update `src/preload/index.d.ts` with the `VoiceAgentAPI` interface and `window.api.voiceAgent` type declaration
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [ ] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement `convertFloat32ToInt16` and `useVoiceAgent` hook
  - [ ] 6.1 Create `src/renderer/hooks/useVoiceAgent.ts`
    - Export `convertFloat32ToInt16(float32: Float32Array): Int16Array` as a named pure function (clamp + scale)
    - Implement the `useVoiceAgent` hook with `VoiceAgentState` state machine, `transcript` array, and `error` field
    - Implement `startSession()`: set state to `connecting`, call `window.api.voiceAgent.start()`, start mic capture via `getUserMedia` at 24kHz, wire `ScriptProcessorNode` to send PCM chunks
    - Implement `stopSession()`: stop mic tracks, close `AudioContext`, call `window.api.voiceAgent.stop()`, call `removeListeners()`, set state to `idle`
    - Implement TTS audio playback queue (`enqueuePCMAudio` + `drainQueue`) using `AudioBufferSourceNode` chaining
    - Register `onEvent` and `onAudio` listeners to update state machine, transcript, and audio queue
    - _Requirements: 1.2, 1.3, 1.4, 1.6, 4.1, 4.2, 4.3, 4.4, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 8.4, 8.5, 10.2, 10.4_

  - [ ]* 6.2 Write property test for `convertFloat32ToInt16` (Property 4)
    - **Property 4: Float32-to-Int16 PCM Conversion Correctness**
    - **Validates: Requirements 11.1, 11.2, 11.3**
    - Use `fast-check` to generate arbitrary `Float32Array` values including out-of-range values
    - Assert output length equals input length, values in `[-1, 1]` scale linearly, values outside clamp to `±32767`

  - [ ]* 6.3 Write property test for TTS audio FIFO ordering (Property 5)
    - **Property 5: TTS Audio FIFO Playback Order**
    - **Validates: Requirements 5.3, 5.4**
    - Use `fast-check` to generate arbitrary sequences of PCM buffers
    - Assert buffers are played in exact enqueue order, each played exactly once

  - [ ]* 6.4 Write property test for state machine transitions (Property 1)
    - **Property 1: State Machine Transitions**
    - **Validates: Requirements 1.2, 1.3, 1.4, 6.1, 6.2, 6.3, 6.4, 6.5**
    - Use `fast-check` to generate arbitrary sequences of Deepgram AgentEvent types
    - Assert resulting `VoiceAgentState` matches the deterministic mapping for each event type

  - [ ]* 6.5 Write property test for transcript accumulation (Property 6)
    - **Property 6: Transcript Accumulation**
    - **Validates: Requirements 6.6, 6.7**
    - Use `fast-check` to generate arbitrary sequences of `ConversationText` events
    - Assert transcript grows by exactly one entry per event, role and text are preserved, array is not cleared on session end

- [ ] 7. Create JarvisSphere component
  - Create `src/renderer/components/JarvisSphere.tsx` accepting `state: VoiceAgentState` and optional `size` prop
  - Implement `framer-motion` animation variants for all 6 states with distinct CSS classes, colors, and animation parameters per the state→animation mapping in the design
  - Create `src/renderer/components/JarvisSphere.css` with per-state color variables (idle: muted blue-grey, connecting: amber, listening: sage green, thinking: soft white, speaking: bright teal, error: red)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 7.1 Write unit test for JarvisSphere distinct animation per state (Property 8)
    - **Property 8: JarvisSphere Renders Distinct Animation Per State**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7**
    - Assert no two states produce the same CSS class or animation variant key

- [ ] 8. Create VoiceAgentOverlay component
  - Create `src/renderer/components/VoiceAgentOverlay.tsx` accepting `isOpen: boolean` and `onClose: () => void`
  - Mount `useVoiceAgent` hook; render `JarvisSphere` with current state; render scrollable transcript list of `TranscriptEntry` items
  - Render a stop/close button that calls `stopSession()` then `onClose()`
  - Animate overlay in/out with `framer-motion`
  - Create `src/renderer/components/VoiceAgentOverlay.css`
  - _Requirements: 1.1, 1.5, 7.8, 7.9, 10.5_

- [ ] 9. Update SettingsModal with Deepgram API key field
  - Add a `deepgramApiKey` state field to `src/renderer/components/SettingsModal.tsx`
  - Render a labeled password input for the Deepgram API key in the API keys section
  - Load the existing `deepgramApiKey` from `api:getStatus` on modal open
  - Include `deepgramApiKey` in the `api:setKeys` payload when saving
  - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 9.1 Write property test for API key persistence round-trip (Property 7)
    - **Property 7: API Key Persistence Round-Trip**
    - **Validates: Requirements 8.2, 8.3**
    - Use `fast-check` to generate arbitrary non-empty API key strings
    - Assert key saved via `api:setKeys` is returned identically by `api:getStatus` and does not alter existing OpenAI/Gemini key values

- [ ] 10. Wire voice toggle button into App.tsx
  - Add a voice toggle button to `src/renderer/App.tsx` (or `InputArea`) that toggles a `voiceOpen` boolean state
  - Conditionally render `<VoiceAgentOverlay isOpen={voiceOpen} onClose={() => setVoiceOpen(false)} />`
  - _Requirements: 1.1, 1.5_

- [ ] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests live in `tests/property/` and use `fast-check`
- `sendAudio` uses `ipcRenderer.send` (not `invoke`) — no response path, minimizing IPC overhead
- `convertFloat32ToInt16` should be exported from the hook file so it can be tested independently
- The `@deepgram/sdk` package provides typed WebSocket client and `AgentEvents` enum; use it in `DeepgramVoiceService`
