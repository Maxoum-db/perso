import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './lib/auth'
import { CapteurProvider } from './lib/capteurContexte'
import { assurerServiceWorker } from './lib/partageGpx'
import { applyTextSize, readTextSize } from './lib/textSize'
import './index.css'

applyTextSize(readTextSize())

// Le service worker était enregistré UNIQUEMENT à l'activation des
// notifications. C'était tenable tant qu'il ne servait qu'à elles ; ça ne l'est
// plus depuis que le manifeste déclare une cible de partage. Une cible déclarée
// mais jamais interceptée est pire que pas de cible du tout : elle apparaît dans
// le menu de partage du téléphone, le POST part vers le réseau, et le fichier se
// perd sans que rien ne le dise.
void assurerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CapteurProvider>
          <App />
        </CapteurProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
