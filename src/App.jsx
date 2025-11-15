import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import Dashboard from './view/Dashboard'
import Header from './view/Header'
import { LanguageProvider } from '@/i18n/LanguageProvider'
import {WebSocketProvider} from './websocket/WebsocketProvider'
import '@/styles/index.less';

function App() {
  const [count, setCount] = useState(0)

  return (
    // <WebSocketProvider>
    <LanguageProvider>
      <div className="app">
        {/* <Header /> */}
        <Dashboard />
      </div>
    </LanguageProvider>
    // </WebSocketProvider>
  )
}

export default App
