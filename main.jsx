import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx'; // App.jsx está en la misma carpeta raíz

// Polyfill window.storage → usa localStorage del navegador
window.storage = {
  get: async (key) => {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? { value: v } : null;
    } catch (e) {
      return null;
    }
  },
  set: async (key, value) => {
    try {
      localStorage.setItem(key, value);
      return { value };
    } catch (e) {
      return null;
    }
  },
  delete: async (key) => {
    try {
      localStorage.removeItem(key);
      return { deleted: true };
    } catch (e) {
      return null;
    }
  },
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
