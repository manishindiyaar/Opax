import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import './styles/App.css';
import { Greeting } from './components/Greeting';
import { InputArea } from './components/InputArea';
import { Message } from './components/Message';
import { ToolCall } from './components/ToolCallCard';
import { SettingsModal } from './components/SettingsModal';
import { ProfileModal } from './components/ProfileModal';
import { ConnectToolButton } from './components/ConnectToolButton';
import { ToolConnectionModal } from './components/ToolConnectionModal';
import { PreinstalledMCPModal } from './components/PreinstalledMCPModal';
import { WelcomeModal } from './components/WelcomeModal';
import { DebugConsole } from './components/DebugConsole';
import { AgentComposer } from './components/AgentComposer';
import { OpaxLogo } from './components/OpaxLogo';
import { useRecorder } from './hooks/useRecorder';
import { useConversations } from './hooks/useConversations';
import { useMCP } from './hooks/useMCP';
import { ToolCallData } from './db/schemas';
import { rxdbService } from './db/RxDBService';
import { StreamEvent, StreamToolCall } from '../preload/index';

// UI message type with streaming state
interface MessageData {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
}

// Sidebar animation variants with spring physics
const sidebarVariants = {
  open: {
    x: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 40,
    },
  },
  closed: {
    x: '-100%',
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 40,
    },
  },
};

// Backdrop animation variants
const backdropVariants = {
  visible: { opacity: 1 },
  hidden: { opacity: 0 },
};

// Greeting animation variants
const greetingVariants = {
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' as const }
  },
  hidden: { 
    opacity: 0, 
    y: -20,
    transition: { duration: 0.2, ease: 'easeIn' as const }
  },
};

function App() {
  const [backendStatus, setBackendStatus] = useState<string>('Checking...');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [toolModalOpen, setToolModalOpen] = useState(false);
  const [preinstalledModalOpen, setPreinstalledModalOpen] = useState(false);
  const [debugConsoleOpen, setDebugConsoleOpen] = useState(false);
  const [agentComposerOpen, setAgentComposerOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCall[]>([]);
  const [userName, setUserName] = useState<string>('');
  const [showWelcome, setShowWelcome] = useState(false);
  const [userLoaded, setUserLoaded] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Database-backed conversations hook
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    messages: dbMessages,
    isLoading: isDbLoading,
    error: dbError,
    createConversation,
    deleteConversation,
    addMessage
  } = useConversations();

  // Audio recording hook
  const { isRecording, isTranscribing, error: recorderError, startRecording, stopRecording } = useRecorder();

  // MCP server management hook
  const {
    connectedServers,
    isConnecting,
    error: mcpError,
    connect: connectMCP,
    connectHTTP: connectMCPHTTP,
    disconnect: disconnectMCP,
  } = useMCP();

  // Get initials for avatar
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Handle saving user name — persist to DB
  const handleSaveUserName = async (newName: string) => {
    setUserName(newName);
    localStorage.setItem('user_name', newName);
    try {
      await rxdbService.setUserName(newName);
    } catch (err) {
      console.error('Failed to save user name to DB:', err);
    }
  };

  // Load user name from DB on mount, show welcome if first time
  useEffect(() => {
    const loadUserName = async () => {
      try {
        await rxdbService.initialize();
        const savedName = await rxdbService.getUserName();
        if (savedName) {
          setUserName(savedName);
          localStorage.setItem('user_name', savedName);
        } else {
          // Check localStorage fallback (existing users)
          const lsName = localStorage.getItem('user_name');
          if (lsName && lsName !== 'User') {
            setUserName(lsName);
            await rxdbService.setUserName(lsName);
          } else {
            // First time user — show welcome
            setShowWelcome(true);
          }
        }
      } catch (err) {
        console.error('Failed to load user name:', err);
        setUserName(localStorage.getItem('user_name') || 'User');
      } finally {
        setUserLoaded(true);
      }
    };
    loadUserName();
  }, []);

  // Determine if we have messages (for layout transitions)
  const hasMessages = dbMessages.length > 0 || streamingMessageId !== null;

  // Convert DB messages to UI format, including streaming message
  const messages: MessageData[] = [
    ...dbMessages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp),
      toolCalls: msg.toolCalls?.map(tc => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.arguments,
        result: tc.result, // IMPORTANT: Include result for card rendering
        status: tc.status
      })),
    })),
    // Add streaming message if active
    ...(streamingMessageId ? [{
      id: streamingMessageId,
      role: 'assistant' as const,
      content: streamingContent,
      timestamp: new Date(),
      toolCalls: streamingToolCalls,
      isStreaming: true,
    }] : []),
  ];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);


  useEffect(() => {
    const fetchBackendStatus = async () => {
      try {
        const status = await window.api.backend.getStatus();
        if (status.running && status.healthy) {
          setBackendStatus('Online');
        } else if (status.running) {
          setBackendStatus('Starting...');
        } else {
          setBackendStatus('Offline');
        }
      } catch (error) {
        setBackendStatus('Error');
      }
    };

    fetchBackendStatus();

    // Poll backend status every 5 seconds
    const interval = setInterval(fetchBackendStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle stream events
  const handleStreamEvent = useCallback((event: StreamEvent) => {
    switch (event.type) {
      case 'text':
        setStreamingContent(prev => prev + (event.data as string));
        break;
      case 'tool-call':
        const toolCall = event.data as StreamToolCall;
        setStreamingToolCalls(prev => [...prev, {
          id: toolCall.id,
          name: toolCall.name,
          arguments: toolCall.arguments,
          status: toolCall.status,
        }]);
        break;
      case 'tool-result':
        const result = event.data as { toolCallId: string; result: string; status: 'success' | 'error' };
        setStreamingToolCalls(prev => prev.map(tc => 
          tc.id === result.toolCallId 
            ? { ...tc, result: result.result, status: result.status }
            : tc
        ));
        break;
      case 'complete':
        // Will be handled in handleSubmit
        break;
      case 'error':
        console.error('[Stream] Error:', event.data);
        break;
    }
  }, []);

  const handleSubmit = async () => {
    if (!inputValue.trim() || isSending) return;
    
    const userContent = inputValue.trim();
    setInputValue('');
    setIsSending(true);

    try {
      // Add user message to database
      await addMessage('user', userContent);

      // Initialize streaming state
      const streamId = `stream-${Date.now()}`;
      setStreamingMessageId(streamId);
      setStreamingContent('');
      setStreamingToolCalls([]);

      // Start streaming chat
      await new Promise<void>((resolve, reject) => {
        let finalContent = '';
        let finalToolCalls: ToolCall[] = [];

        window.api.chat.startStream(userContent, (event: unknown) => {
          const streamEvent = event as StreamEvent;
          handleStreamEvent(streamEvent);

          if (streamEvent.type === 'text') {
            finalContent += streamEvent.data as string;
          } else if (streamEvent.type === 'tool-call') {
            const tc = streamEvent.data as StreamToolCall;
            finalToolCalls.push({
              id: tc.id,
              name: tc.name,
              arguments: tc.arguments,
              status: tc.status,
            });
          } else if (streamEvent.type === 'tool-result') {
            const result = streamEvent.data as { toolCallId: string; result: string; status: 'success' | 'error' };
            finalToolCalls = finalToolCalls.map(tc =>
              tc.id === result.toolCallId
                ? { ...tc, result: result.result, status: result.status }
                : tc
            );
          } else if (streamEvent.type === 'complete') {
            // Save to database
            const toolCallData: ToolCallData[] | undefined = finalToolCalls.length > 0
              ? finalToolCalls.map(tc => ({
                  id: tc.id,
                  name: tc.name,
                  arguments: tc.arguments,
                  result: tc.result,
                  status: tc.status as 'pending' | 'success' | 'error',
                }))
              : undefined;

            addMessage('assistant', finalContent || 'No response received.', toolCallData)
              .then(() => {
                setStreamingMessageId(null);
                setStreamingContent('');
                setStreamingToolCalls([]);
                resolve();
              })
              .catch(reject);
          } else if (streamEvent.type === 'error') {
            reject(new Error(streamEvent.data as string));
          }
        });
      });

    } catch (error) {
      console.error('Chat error:', error);
      // Clear streaming state
      setStreamingMessageId(null);
      setStreamingContent('');
      setStreamingToolCalls([]);
      // Add error message to database
      await addMessage(
        'assistant',
        `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleMicClick = async () => {
    if (isRecording) {
      // Stop recording and get transcription
      try {
        const transcribedText = await stopRecording();
        if (transcribedText && transcribedText.trim()) {
          // Set the transcribed text in the input
          setInputValue(prev => prev ? `${prev} ${transcribedText}` : transcribedText);
        }
      } catch (error) {
        console.error('Failed to transcribe:', error);
      }
    } else {
      // Start recording
      try {
        await startRecording();
      } catch (error) {
        console.error('Failed to start recording:', error);
      }
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleNewSession = async () => {
    try {
      await window.api.chat.clear();
      await createConversation();
    } catch (error) {
      console.error('Failed to create new session:', error);
    }
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setSidebarOpen(false);
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteConversation(id);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  // Format timestamp for display
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };


  // Show loading state while database initializes
  if (isDbLoading) {
    return (
      <div className="app">
        <div className="loading-screen">
          <OpaxLogo isLoading={true} size={48} />
          <p>Loading conversations...</p>
        </div>
      </div>
    );
  }

  // Show error state if database failed
  if (dbError) {
    return (
      <div className="app">
        <div className="error-screen">
          <p>Failed to load conversations: {dbError}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Sidebar Backdrop with animation */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            className="sidebar-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Animated Sidebar */}
      <motion.aside 
        className="sidebar"
        variants={shouldReduceMotion ? undefined : sidebarVariants}
        initial={false}
        animate={sidebarOpen ? 'open' : 'closed'}
        aria-hidden={!sidebarOpen}
      >
        <div className="sidebar__drag-region" />
        <div className="sidebar-header">
          <button className="new-session-btn" onClick={handleNewSession}>
            <span>New Session</span>
            <span className="new-session-btn__icon">
              <span className="plus-icon">+</span>
            </span>
          </button>
        </div>
        <div className="sidebar-content">
          <div className="history-section__title">Conversations</div>
          <div className="conversation-list">
            {conversations.length > 0 ? (
              conversations.map(conv => (
                <div 
                  key={conv.id}
                  className={`conversation-item ${conv.id === activeConversationId ? 'conversation-item--active' : ''}`}
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  <div className="conversation-item__content">
                    <span className="conversation-item__title">
                      {conv.preview || conv.title}
                    </span>
                    <span className="conversation-item__time">
                      {formatTime(conv.updatedAt)}
                    </span>
                  </div>
                  <button 
                    className="conversation-item__delete"
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    aria-label="Delete conversation"
                  >
                    ×
                  </button>
                </div>
              ))
            ) : (
              <p className="empty-state">No conversations yet</p>
            )}
          </div>
        </div>
        <div className="sidebar-footer">
          <button 
            className="automations-btn"
            onClick={() => setAgentComposerOpen(true)}
            aria-label="Open automations"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="9" x2="15" y2="9" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            <span>Automations</span>
          </button>
          <button 
            className="settings-btn"
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            <span>Settings</span>
          </button>
          <button 
            className="user-profile"
            onClick={() => setProfileOpen(true)}
            aria-label="Open profile"
          >
            <div className="user-profile__avatar">{getInitials(userName)}</div>
            <span className="user-profile__name">{userName}</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="main-content">
        {/* PanelLeft Toggle Button */}
        <button 
          className="panel-toggle"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          aria-expanded={sidebarOpen}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>

        {/* Connect Tool Button */}
        <ConnectToolButton
          onClick={() => setToolModalOpen(true)}
          onPreinstalled={() => setPreinstalledModalOpen(true)}
          connectedCount={connectedServers.length}
        />

        {/* Chat Area with Layout Transitions */}
        <div className={`chat-area ${hasMessages ? 'chat-area--with-messages' : 'chat-area--empty'}`}>
          <AnimatePresence mode="wait">
            {!hasMessages ? (
              <motion.div
                key="greeting"
                className="greeting-wrapper"
                variants={greetingVariants}
                initial="visible"
                animate="visible"
                exit="hidden"
              >
                <Greeting 
                  userName={userName}
                  statusMessage={backendStatus === 'Online' ? 'System Secure & Online' : `System ${backendStatus}`}
                />
              </motion.div>
            ) : (
              <motion.div 
                key="messages"
                className="message-list" 
                ref={messageListRef}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {messages.map((message) => (
                  <Message
                    key={message.id}
                    role={message.role}
                    content={message.content}
                    timestamp={message.timestamp}
                    toolCalls={message.toolCalls}
                    isStreaming={message.isStreaming}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input Area with Position Transition */}
        <InputArea
          isListening={isRecording || isTranscribing}
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          onMicClick={handleMicClick}
          disabled={isSending || isTranscribing}
          isCentered={!hasMessages}
          isLoading={isSending}
        />
        
        {/* Show recorder error if any */}
        {recorderError && (
          <div className="recorder-error">
            {recorderError}
          </div>
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Profile Modal */}
      <ProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        userName={userName}
        onSave={handleSaveUserName}
      />

      {/* Tool Connection Modal */}
      <ToolConnectionModal
        isOpen={toolModalOpen}
        onClose={() => setToolModalOpen(false)}
        connectedServers={connectedServers}
        onConnect={connectMCP}
        onDisconnect={disconnectMCP}
        isConnecting={isConnecting}
        error={mcpError}
      />

      {/* Preinstalled MCP Modal */}
      <PreinstalledMCPModal
        isOpen={preinstalledModalOpen}
        onClose={() => setPreinstalledModalOpen(false)}
        connectedServers={connectedServers}
        onConnectHTTP={connectMCPHTTP}
        onDisconnect={disconnectMCP}
      />

      {/* Welcome Modal — first-time user setup */}
      <WelcomeModal
        isOpen={showWelcome}
        onSave={async (name) => {
          await handleSaveUserName(name);
          setShowWelcome(false);
        }}
      />

      {/* Debug Console */}
      <DebugConsole
        isOpen={debugConsoleOpen}
        onClose={() => setDebugConsoleOpen(false)}
      />

      {/* Agent Composer */}
      <AgentComposer
        isOpen={agentComposerOpen}
        onClose={() => setAgentComposerOpen(false)}
        onOpenDebugConsole={() => setDebugConsoleOpen(true)}
      />
    </div>
  );
}

export default App;
