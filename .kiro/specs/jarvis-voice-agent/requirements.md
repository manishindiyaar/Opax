# Requirements Document

## Introduction

The Jarvis Voice Agent feature replaces Opax's text-based microphone button with a real-time, bidirectional voice interaction system powered by Deepgram's Voice Agent API V1 (WebSocket). Doctors using the Opax clinical orchestration platform can activate a full-screen "Jarvis mode" featuring an animated sphere that reacts to conversation state (idle, listening, thinking, speaking), while the agent transcribes speech, reasons via an LLM, executes MCP tool calls in real time, and speaks responses back — all without leaving the clinical workflow.

## Glossary

- **VoiceAgentOverlay**: The full-screen React overlay component that hosts the Jarvis UI, animated sphere, live transcript, and session controls.
- **JarvisSphere**: The animated SVG/Canvas React component that visually reacts to the current VoiceAgentState.
- **DeepgramVoiceService**: The main-process service that owns the Deepgram WebSocket connection, routes audio, handles AgentEvents, and bridges MCP tool calls.
- **useVoiceAgent**: The renderer-side React hook that manages the voice session lifecycle, microphone capture, IPC communication, and TTS playback.
- **VoiceAgentState**: The state machine enum with values: `idle`, `connecting`, `listening`, `thinking`, `speaking`, `error`.
- **TranscriptEntry**: A single conversation turn with role (`user` or `agent`), text, and timestamp.
- **SettingsMessage**: The JSON configuration message sent to Deepgram over WebSocket immediately after connection opens.
- **FunctionCallRequest**: A Deepgram AgentEvent requesting execution of a named MCP tool with arguments.
- **FunctionCallResponse**: The JSON message sent back to Deepgram containing the MCP tool result or error.
- **MCPService**: The existing main-process service that executes MCP tool calls.
- **PCM Int16**: Linear 16-bit pulse-code modulation audio format used for both microphone input and TTS output at 24kHz.
- **IPC Bridge**: The Electron preload script that exposes `window.api.voiceAgent.*` methods to the renderer.
- **VoiceAgentStartConfig**: The configuration object passed to `voiceAgent:start` containing API keys, LLM provider, model, and optional system prompt.
- **api-config.json**: The existing JSON file in Electron `userData` that stores API keys for OpenAI, Gemini, and now Deepgram.

---

## Requirements

### Requirement 1: Voice Mode Activation and Session Lifecycle

**User Story:** As a doctor, I want to activate and deactivate a voice interaction mode, so that I can speak naturally with the clinical assistant without switching away from my workflow.

#### Acceptance Criteria

1. WHEN a doctor clicks the voice toggle button, THE VoiceAgentOverlay SHALL render in full-screen mode over the existing UI.
2. WHEN voice mode is activated, THE useVoiceAgent hook SHALL transition VoiceAgentState from `idle` to `connecting`.
3. WHEN the Deepgram WebSocket connection is established and a SettingsApplied event is received, THE useVoiceAgent hook SHALL transition VoiceAgentState to `listening`.
4. WHEN a doctor deactivates voice mode, THE useVoiceAgent hook SHALL transition VoiceAgentState to `idle` and release all audio resources.
5. WHEN voice mode is deactivated, THE VoiceAgentOverlay SHALL close and return the doctor to the previous UI state.
6. WHILE a voice session is active, THE useVoiceAgent hook SHALL maintain IPC event listeners for all VoiceAgentEvent types.

---

### Requirement 2: Deepgram WebSocket Session Management

**User Story:** As a developer, I want the DeepgramVoiceService to manage the WebSocket lifecycle reliably, so that voice sessions connect, stay alive, and disconnect cleanly.

#### Acceptance Criteria

1. WHEN a session starts, THE DeepgramVoiceService SHALL open a WebSocket connection to `wss://agent.deepgram.com/v1/agent` using an `Authorization: Token <key>` header.
2. WHEN the WebSocket connection opens, THE DeepgramVoiceService SHALL send a SettingsMessage configuring STT model `nova-3`, TTS model `aura-2-thalia-en`, the configured LLM provider and model, and all available MCP tools as function definitions.
3. WHILE a session is active, THE DeepgramVoiceService SHALL send a KeepAlive message to Deepgram every 5 seconds.
4. WHEN `stop()` is called, THE DeepgramVoiceService SHALL close the WebSocket connection gracefully and clear the keep-alive interval.
5. IF `start()` is called while a session is already active, THEN THE DeepgramVoiceService SHALL stop the existing session before starting the new one.
6. WHEN a session ends for any reason, THE DeepgramVoiceService SHALL set `isActive()` to `false`.

---

### Requirement 3: MCP Tool Call Bridging

**User Story:** As a doctor, I want the voice agent to execute clinical tools in real time during conversation, so that I can retrieve patient data and trigger workflows by speaking naturally.

#### Acceptance Criteria

1. WHEN a FunctionCallRequest event is received from Deepgram, THE DeepgramVoiceService SHALL invoke `MCPService.executeTool()` with the function name and input arguments from the event.
2. WHEN an MCP tool execution completes successfully, THE DeepgramVoiceService SHALL send exactly one FunctionCallResponse to Deepgram containing the tool result as a string.
3. IF an MCP tool execution fails or throws an exception, THEN THE DeepgramVoiceService SHALL send a FunctionCallResponse containing a descriptive error string without terminating the session.
4. IF the requested MCP tool is not found, THEN THE DeepgramVoiceService SHALL send a FunctionCallResponse with an error message without throwing an exception.
5. THE DeepgramVoiceService SHALL send exactly one FunctionCallResponse for each FunctionCallRequest received, identified by the matching `function_call_id`.

---

### Requirement 4: Microphone Audio Capture

**User Story:** As a doctor, I want my speech to be captured and streamed to the voice agent in real time, so that the agent can transcribe and respond to what I say.

#### Acceptance Criteria

1. WHEN a voice session starts, THE useVoiceAgent hook SHALL request microphone access via `getUserMedia` with a 24kHz sample rate constraint.
2. WHEN microphone audio is captured, THE useVoiceAgent hook SHALL convert Float32 PCM samples to PCM Int16 format before transmission.
3. WHEN PCM Int16 audio chunks are ready, THE useVoiceAgent hook SHALL send them to the main process via `window.api.voiceAgent.sendAudio()` using fire-and-forget IPC.
4. WHEN a voice session ends, THE useVoiceAgent hook SHALL stop all microphone stream tracks and close the AudioContext.
5. WHEN the DeepgramVoiceService receives a PCM Int16 audio buffer, THE DeepgramVoiceService SHALL forward it as a binary WebSocket frame to Deepgram if the connection is open.
6. IF the WebSocket is not open when audio is received, THEN THE DeepgramVoiceService SHALL silently discard the buffer without throwing an exception.

---

### Requirement 5: TTS Audio Playback

**User Story:** As a doctor, I want to hear the voice agent's spoken responses through my speakers, so that I can receive information hands-free while working.

#### Acceptance Criteria

1. WHEN a binary audio frame is received from Deepgram, THE DeepgramVoiceService SHALL push it to the renderer via the `voiceAgent:audio` IPC channel.
2. WHEN a TTS audio chunk is received by the renderer, THE useVoiceAgent hook SHALL enqueue the PCM Int16 buffer for sequential playback.
3. THE useVoiceAgent hook SHALL play TTS audio buffers in FIFO order, converting PCM Int16 to Float32 before scheduling playback via the Web Audio API.
4. WHEN a TTS audio buffer finishes playing, THE useVoiceAgent hook SHALL immediately begin playing the next queued buffer if one is available.
5. WHEN a voice session ends, THE useVoiceAgent hook SHALL stop any in-progress TTS playback and clear the audio queue.

---

### Requirement 6: Voice Agent State Machine and Transcript

**User Story:** As a doctor, I want the UI to reflect the agent's current activity in real time, so that I always know whether the agent is listening, thinking, or speaking.

#### Acceptance Criteria

1. WHEN a `UserStartedSpeaking` event is received from Deepgram, THE useVoiceAgent hook SHALL set VoiceAgentState to `listening`.
2. WHEN an `AgentThinking` event is received from Deepgram, THE useVoiceAgent hook SHALL set VoiceAgentState to `thinking`.
3. WHEN an `AgentStartedSpeaking` event is received from Deepgram, THE useVoiceAgent hook SHALL set VoiceAgentState to `speaking`.
4. WHEN an `AgentAudioDone` event is received from Deepgram, THE useVoiceAgent hook SHALL set VoiceAgentState to `listening`.
5. WHEN an `Error` event is received from Deepgram, THE useVoiceAgent hook SHALL set VoiceAgentState to `error` and store the error message.
6. WHEN a `ConversationText` event is received from Deepgram, THE useVoiceAgent hook SHALL append a TranscriptEntry with the role and text to the transcript array.
7. WHEN a voice session ends, THE useVoiceAgent hook SHALL preserve the transcript array without clearing it.

---

### Requirement 7: Jarvis Sphere Animated UI

**User Story:** As a doctor, I want a visually distinct animated sphere that reacts to the agent's state, so that I can understand the agent's activity at a glance without reading text.

#### Acceptance Criteria

1. THE JarvisSphere component SHALL render a distinct visual animation for each VoiceAgentState value.
2. WHEN VoiceAgentState is `idle`, THE JarvisSphere SHALL display a slow gentle pulse animation in muted blue-grey.
3. WHEN VoiceAgentState is `connecting`, THE JarvisSphere SHALL display a rotating ring animation in amber.
4. WHEN VoiceAgentState is `listening`, THE JarvisSphere SHALL display expanding ripple wave animations in sage green.
5. WHEN VoiceAgentState is `thinking`, THE JarvisSphere SHALL display orbiting particle animations in soft white.
6. WHEN VoiceAgentState is `speaking`, THE JarvisSphere SHALL display radial frequency bar animations pulsing in bright teal.
7. WHEN VoiceAgentState is `error`, THE JarvisSphere SHALL display a static red glow.
8. THE VoiceAgentOverlay SHALL display a scrollable live transcript of all TranscriptEntry items during an active session.
9. THE VoiceAgentOverlay SHALL provide a stop/close button that calls `stopSession()` and closes the overlay.

---

### Requirement 8: Deepgram API Key Configuration

**User Story:** As a doctor, I want to configure my Deepgram API key in the settings modal alongside my other API keys, so that I can enable voice mode without modifying configuration files.

#### Acceptance Criteria

1. THE Settings modal SHALL include a Deepgram API key input field in the API keys section.
2. WHEN API keys are saved, THE system SHALL persist the Deepgram API key to `api-config.json` alongside the existing OpenAI and Gemini keys.
3. WHEN API keys are loaded, THE system SHALL return the stored Deepgram API key via the existing `api:getStatus` IPC channel.
4. IF the Deepgram API key is empty when voice mode is activated, THEN THE system SHALL return `{ success: false, error: 'Deepgram API key not configured' }` without attempting a WebSocket connection.
5. WHEN the Deepgram API key is missing, THE useVoiceAgent hook SHALL set VoiceAgentState to `error` and display a prompt to open Settings.

---

### Requirement 9: Settings Message Construction

**User Story:** As a developer, I want the SettingsMessage to be constructed correctly from the current configuration and available MCP tools, so that Deepgram initializes the session with the right LLM, voice, and tool definitions.

#### Acceptance Criteria

1. THE `buildSettingsMessage` function SHALL produce a valid DeepgramSettingsMessage for any valid VoiceAgentStartConfig and any array of MCP tools including an empty array.
2. WHEN `llmProvider` is `'openai'`, THE `buildSettingsMessage` function SHALL set `agent.think.provider.type` to `'open_ai'`.
3. WHEN `llmProvider` is `'gemini'`, THE `buildSettingsMessage` function SHALL set `agent.think.provider.type` to `'google'`.
4. THE `buildSettingsMessage` function SHALL produce a `functions` array with exactly one entry per MCP tool, each containing `name`, `description`, and `parameters` fields.
5. THE `buildSettingsMessage` function SHALL set audio input and output encoding to `linear16` at `24000` Hz sample rate.

---

### Requirement 10: Error Handling and Recovery

**User Story:** As a doctor, I want the voice agent to handle errors gracefully and allow me to retry, so that a transient failure does not disrupt my clinical workflow.

#### Acceptance Criteria

1. IF the WebSocket connection fails to open, THEN THE DeepgramVoiceService SHALL emit a `VoiceAgentEvent` with `type: 'error'` and call `stop()` to clean up resources.
2. IF microphone permission is denied by the operating system, THEN THE useVoiceAgent hook SHALL set VoiceAgentState to `error` with the message "Microphone access denied".
3. IF the WebSocket connection drops unexpectedly during an active session, THEN THE DeepgramVoiceService SHALL emit a `VoiceAgentEvent` with `type: 'done'` and clear the keep-alive interval.
4. WHEN a session ends due to an error or unexpected disconnect, THE useVoiceAgent hook SHALL release all microphone and audio resources.
5. WHEN VoiceAgentState is `error`, THE VoiceAgentOverlay SHALL display the error message and allow the doctor to retry by clicking the voice toggle again.

---

### Requirement 11: PCM Audio Conversion

**User Story:** As a developer, I want the Float32-to-Int16 PCM conversion to be accurate and safe, so that audio quality is preserved and no buffer overflows occur.

#### Acceptance Criteria

1. THE `convertFloat32ToInt16` function SHALL produce an Int16Array of the same length as the input Float32Array.
2. THE `convertFloat32ToInt16` function SHALL clamp input values greater than `1.0` to `32767` and values less than `-1.0` to `-32767`.
3. THE `convertFloat32ToInt16` function SHALL scale values in the range `[-1.0, 1.0]` linearly to the range `[-32767, 32767]`.

---

### Requirement 12: IPC Bridge Security and Channel Design

**User Story:** As a developer, I want the IPC bridge to expose only the necessary voice agent operations with appropriate channel types, so that the attack surface is minimized.

#### Acceptance Criteria

1. THE IPC Bridge SHALL expose `voiceAgent.start()`, `voiceAgent.stop()`, `voiceAgent.sendAudio()`, `voiceAgent.onEvent()`, `voiceAgent.onAudio()`, and `voiceAgent.removeListeners()` on `window.api`.
2. THE IPC Bridge SHALL implement `voiceAgent.sendAudio()` using `ipcRenderer.send` rather than `ipcRenderer.invoke` to avoid round-trip overhead on every audio chunk.
3. THE IPC Bridge SHALL implement `voiceAgent.start()` and `voiceAgent.stop()` using `ipcRenderer.invoke` to return success or error results.
4. WHEN `voiceAgent.removeListeners()` is called, THE IPC Bridge SHALL remove all registered `voiceAgent:event` and `voiceAgent:audio` IPC listeners.
