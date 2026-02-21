import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

try {
  const root = document.getElementById('root');
  if (root) {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } else {
    console.error('[Opax] Root element not found');
  }
} catch (error) {
  console.error('[Opax] Failed to mount React app:', error);
  // Show error on screen as fallback
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `<div style="padding:40px;color:red;font-family:monospace;">
      <h2>Opax failed to start</h2>
      <pre>${error instanceof Error ? error.message + '\n' + error.stack : String(error)}</pre>
    </div>`;
  }
}
