import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'

window.API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Global Fetch Interceptor to inject the Token into API requests
const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
  const urlString = typeof url === 'string' ? url : (url instanceof URL ? url.toString() : '');
  const isApi = urlString.startsWith(window.API_BASE_URL) || urlString.startsWith('/api/');

  if (isApi) {
    const cached = localStorage.getItem('rememberedUser');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.token) {
          if (!options.headers) {
            options.headers = {};
          }
          if (options.headers instanceof Headers) {
            options.headers.set('Authorization', `Bearer ${parsed.token}`);
          } else if (Array.isArray(options.headers)) {
            const hasAuth = options.headers.some(h => h[0].toLowerCase() === 'authorization');
            if (!hasAuth) {
              options.headers.push(['Authorization', `Bearer ${parsed.token}`]);
            }
          } else {
            options.headers = {
              ...options.headers,
              'Authorization': `Bearer ${parsed.token}`
            };
          }
        }
      } catch (e) {
        console.error("Error reading token from localStorage:", e);
      }
    }
  }
  return originalFetch.apply(this, [url, options]);
};


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)

