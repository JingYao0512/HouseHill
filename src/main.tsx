import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Frame-bust: GitHub Pages can't send `frame-ancestors` headers, so we refuse
// to render inside an iframe of a different origin. Mitigates clickjacking.
if (window.top !== window.self) {
  try {
    if (window.top!.location.origin !== window.self.location.origin) {
      window.top!.location.replace(window.self.location.href);
    }
  } catch {
    // Cross-origin top — accessing .location throws. Replace blindly.
    window.top!.location.replace(window.self.location.href);
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
