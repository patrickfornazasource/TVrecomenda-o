import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource/bricolage-grotesque/latin-700.css';
import '@fontsource/bricolage-grotesque/latin-800.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(<App />);

// Offline no navegador (no APK os arquivos já estão no aparelho)
if ('serviceWorker' in navigator && location.protocol === 'https:' && !location.hostname.endsWith('.local')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
