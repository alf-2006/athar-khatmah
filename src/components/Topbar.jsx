import React from 'react';
import { Moon, Plus, Sun } from 'lucide-react';
import Logo from '../Logo.jsx';
import { Link } from '../lib/router.jsx';

export default function Topbar({ theme, onToggleTheme, onBrandClick, showStart = true, children }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand-group" onClick={onBrandClick}>
          <Logo size={34} compact />
          <span className="brand-wordmark">أَثَر</span>
          <span className="brand-divider" aria-hidden="true" />
          <span className="brand-caption">مجلس ختمة قرآنية جماعية</span>
        </Link>

        <div className="topbar-controls">
          {children}
          {showStart && (
            <Link to="/new" className="ghost-btn topbar-cta">
              <Plus size={15} aria-hidden="true" />
              <span>ابدأ ختمة لمن تحب</span>
            </Link>
          )}
          <button
            type="button"
            className="icon-btn"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
            title={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>
    </header>
  );
}
