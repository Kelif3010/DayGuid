import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Remove splash screen
const splash = document.getElementById('splash')
if (splash) splash.remove()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      console.log('SW registered:', reg.scope)
      
      // Check for updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'activated') {
            // New version available - could show update prompt
            console.log('New version available')
          }
        })
      })
    } catch (err) {
      console.log('SW registration failed:', err)
    }
  })
}

// Request notification permission proactively
if ('Notification' in window && Notification.permission === 'default') {
  // Will be requested when entering child mode
}
