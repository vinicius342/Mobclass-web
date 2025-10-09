// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';

import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { AnoLetivoProvider } from './contexts/AnoLetivoContext';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Elemento 'root' não encontrado no HTML.");
}

const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <AuthProvider>
      <AnoLetivoProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AnoLetivoProvider>
    </AuthProvider>
  </StrictMode>
);





