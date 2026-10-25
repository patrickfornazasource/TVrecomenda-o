import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(<App />);

// Offline no navegador (no APK os arquivos já estão no aparelho)
if ('serviceWorker' in navigator && location.protocol === 'https:' && !location.hostname.endsWith('.local')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
