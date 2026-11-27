import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Topbar from './components/Topbar.jsx';
import GroupPage from './pages/GroupPage.jsx';
import NewGroup from './pages/NewGroup.jsx';
import { Link, matchRoute, usePath, useTheme } from './lib/router.jsx';
import './tokens.css';
import './styles.css';

function NotFound({ theme, onToggleTheme }) {
  useEffect(() => {
    document.title = 'الصفحة غير موجودة | أثر';
  }, []);
  return (
    <div className="majlis-app">
      <Topbar theme={theme} onToggleTheme={onToggleTheme} />
      <main className="page-narrow">
        <section className="sheet-card centered-card">
          <h1 className="majlis-title">هذه الصفحة غير موجودة</h1>
          <p className="majlis-desc">تأكد من الرابط، أو ارجع إلى الصفحة الرئيسية.</p>
          <div className="centered-actions">
            <Link to="/" className="primary-btn">
              الصفحة الرئيسية
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function App() {
  const path = usePath();
  const [theme, toggleTheme] = useTheme();
  const route = matchRoute(path);

  if (route.name === 'new') return <NewGroup theme={theme} onToggleTheme={toggleTheme} />;
  if (route.name === 'group') {
    return <GroupPage key={route.slug} slug={route.slug} theme={theme} onToggleTheme={toggleTheme} />;
  }
  return <NotFound theme={theme} onToggleTheme={toggleTheme} />;
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')).render(<App />);
