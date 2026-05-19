import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <StrictMode>
    <HashRouter>
      <App />
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
    </HashRouter>
  </StrictMode>
);