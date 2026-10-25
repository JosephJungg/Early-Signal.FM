import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
// Bundled locally so a flaky venue network can't swap the font and shift column widths.
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/ibm-plex-mono/700.css';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
