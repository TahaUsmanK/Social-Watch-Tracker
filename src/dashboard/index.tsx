import { createRoot } from 'react-dom/client';
import Dashboard from './Dashboard';

const container = document.getElementById('dashboard-root');
if (container) {
  const root = createRoot(container);
  root.render(<Dashboard />);
}