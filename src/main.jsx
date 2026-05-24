import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { I18nProvider } from './i18n.js';
import './styles.css';

// previne o navegador de abrir/navegar quando solta arquivo fora do dropzone
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

// Captura erros do renderer e manda pro errorTracker do main
window.addEventListener('error', (e) => {
  try {
    window.api?.errors?.report?.({
      type: 'windowError',
      message: e.message,
      stack: e.error?.stack,
      url: e.filename,
      line: e.lineno,
      col: e.colno
    });
  } catch {}
});
window.addEventListener('unhandledrejection', (e) => {
  try {
    const r = e.reason;
    window.api?.errors?.report?.({
      type: 'unhandledRejection',
      message: r?.message || String(r),
      stack: r?.stack
    });
  } catch {}
});

createRoot(document.getElementById('root')).render(
  <I18nProvider>
    <App />
  </I18nProvider>
);
