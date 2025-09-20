import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { setTtclidCookieFromURL } from './utils/tiktokUtils'

// Initialize TikTok ttclid cookie from URL parameters
setTtclidCookieFromURL();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
