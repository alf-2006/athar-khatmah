import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, Copy, Moon, RefreshCw, Share2, Sun, X } from 'lucide-react';
import Logo, { Ornament } from './Logo.jsx';
import './tokens.css';
import './styles.css';

const configured = import.meta.env.VITE_API_ENABLED !== 'false';

const JUZ_META = [
  { number: 1, title: 'الم', surahs: 'الفاتحة - البقرة' },
  { number: 2, title: 'سيقول', surahs: 'البقرة' },
  { number: 3, title: 'تلك الرسل', surahs: 'البقرة - آل عمران' },
  { number: 4, title: 'لن تنالوا', surahs: 'آل عمران - النساء' },
  { number: 5, title: 'والمحصنات', surahs: 'النساء' },
  { number: 6, title: 'لا يحب الله', surahs: 'النساء - المائدة' },
  { number: 7, title: 'وإذا سمعوا', surahs: 'المائدة - الأنعام' },
  { number: 8, title: 'ولو أننا', surahs: 'الأنعام - الأعراف' },
  { number: 9, title: 'قال الملأ', surahs: 'الأعراف - الأنفال' },
  { number: 10, title: 'واعلموا', surahs: 'الأنفال - التوبة' },
  { number: 11, title: 'يعتذرون', surahs: 'التوبة - هود' },
  { number: 12, title: 'وما من دابة', surahs: 'هود - يوسف' },
  { number: 13, title: 'وما أبرئ', surahs: 'يوسف - إبراهيم' },
  { number: 14, title: 'ربما', surahs: 'الحجر - النحل' },
  { number: 15, title: 'سبحان الذي', surahs: 'الإسراء - الكهف' },
  { number: 16, title: 'قال ألم', surahs: 'الكهف - طه' },
  { number: 17, title: 'اقترب للناس', surahs: 'الأنبياء - الحج' },
  { number: 18, title: 'قد أفلح', surahs: 'المؤمنون - الفرقان' },
  { number: 19, title: 'وقال الذين', surahs: 'الفرقان - النمل' },
  { number: 20, title: 'أمن خلق', surahs: 'النمل - العنكبوت' },
  { number: 21, title: 'اتل ما أوحي', surahs: 'العنكبوت - الأحزاب' },
  { number: 22, title: 'ومن يقنت', surahs: 'الأحزاب - يس' },
  { number: 23, title: 'وما لي', surahs: 'يس - الزمر' },
  { number: 24, title: 'فمن أظلم', surahs: 'الزمر - فصلت' },
  { number: 25, title: 'إليه يرد', surahs: 'فصلت - الجاثية' },
  { number: 26, title: 'حم', surahs: 'الأحقاف - الذاريات' },
  { number: 27, title: 'قال فما خطبكم', surahs: 'الذاريات - الحديد' },
  { number: 28, title: 'قد سمع الله', surahs: 'المجادلة - التحريم' },
  { number: 29, title: 'تبارك الذي', surahs: 'الملك - المرسلات' },
  { number: 30, title: 'عمّ يتساءلون', surahs: 'النبأ - الناس' }
];

const PRAYERS = [
  {
    heading: 'دعاء للشهداء والمصابين',
    body: 'اللهم اغفر لهم وارحمهم وعافهم واعف عنهم، وأكرم نزلهم ووسع مدخلهم، واجعل قبورهم روضة من رياض الجنة، وأنزل على أهلهم وذويهم الصبر والسكينة، واشف المصابين شفاء لا يغادر سقما.'
  },
  {
    heading: 'دعاء إتمام التلاوة',
    body: 'اللهم إنا قرأنا ما تيسر من كتابك الكريم، فنسألك أن تتقبله منا خالصا لوجهك، وأن تهب ثواب ما قرأنا لشهدائنا، وأن تجعله نورا ورحمة ورفعة لهم في درجاتهم، وتجمعنا بهم في مستقر رحمتك.'
  }
];

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

function toAr(value) {
  return String(value).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);
}

function getInitialTheme() {
  try {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark' || attr === 'light') return attr;
    const saved = localStorage.getItem('athar-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {}
  return 'light';
}

function App() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPart, setSelectedPart] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [formNotice, setFormNotice] = useState('');
  const [toast, setToast] = useState('');
  const [myBookings, setMyBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [mobileSection, setMobileSection] = useState('index');
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);

  const byPart = useMemo(() => new Map(bookings.map((b) => [b.part_number, b])), [bookings]);
  const myPartSet = useMemo(() => new Set(myBookings.map((m) => m.part_number)), [myBookings]);

  const completedCount = useMemo(() => bookings.filter((b) => b.completed).length, [bookings]);
  const readingCount = bookings.length - completedCount;
  const openCount = 30 - bookings.length;
  const completedPct = Math.round((completedCount / 30) * 100);
  const readingPct = Math.round((readingCount / 30) * 100);

  const pendingMineCount = useMemo(
    () => myBookings.filter((item) => !byPart.get(item.part_number)?.completed).length,
    [myBookings, byPart]
  );

  const filteredJuz = useMemo(() => {
    return JUZ_META.filter((juz) => {
      const booking = byPart.get(juz.number);
      if (filter === 'open') return !booking;
      if (filter === 'reading') return Boolean(booking && !booking.completed);
      if (filter === 'done') return Boolean(booking?.completed);
      return true;
    });
  }, [byPart, filter]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.getElementById('meta-theme-color');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0f0a05' : '#FDFBF7');
    try {
      localStorage.setItem('athar-theme', theme);
    } catch {}
  }, [theme]);

  async function loadBookings() {
    setError('');
    try {
      const response = await fetch('/api/bookings', { cache: 'no-store' });
      if (!response.ok) throw new Error('request_failed');
      const payload = await response.json();
      setBookings(payload.bookings || []);
    } catch {
      setError('تعذر تحديث حالة الأجزاء حاليا. تحقق من الاتصال وحاول مجددا.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBookings();
    const timer = window.setInterval(loadBookings, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const listRaw = localStorage.getItem('athar-my-bookings');
      if (listRaw) {
        const parsed = JSON.parse(listRaw);
        if (Array.isArray(parsed)) {
          setMyBookings(parsed);
          return;
        }
      }
      const singleRaw = localStorage.getItem('athar-my-booking');
      if (singleRaw) {
        const single = JSON.parse(singleRaw);
        if (single?.part_number && single?.token) {
          setMyBookings([single]);
          localStorage.setItem('athar-my-bookings', JSON.stringify([single]));
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(() => setToast(''), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape' && selectedPart && !busy) {
        setSelectedPart(null);
        setFormNotice('');
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedPart, busy]);

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function openReserveDialog(juz) {
    if (!configured || loading || byPart.has(juz.number)) return;
    setFormNotice('');
    setSelectedPart(juz);
  }

  async function reserve(e) {
    e.preventDefault();
    if (!selectedPart || busy) return;
    const cleanName = name.trim();
    if (!cleanName) {
      setFormNotice('اكتب الاسم الذي ترغب في ظهوره أمام الجزء.');
      return;
    }
    setBusy(true);
    setFormNotice('');
    const token = crypto.randomUUID() + crypto.randomUUID();
    let response;
    try {
      response = await fetch('/api/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          part_number: selectedPart.number,
          display_name: cleanName.slice(0, 40),
          token_hash: await sha256(token)
        })
      });
    } catch {
      response = null;
    }

    if (!response?.ok) {
      const payload = await response?.json().catch(() => ({}));
      setFormNotice(
        payload?.error === 'PART_TAKEN'
          ? 'سبقك مشارك آخر إلى هذا الجزء للتو. اختر جزءا آخر متاحا.'
          : 'تعذر تثبيت الحجز الآن. حاول مرة أخرى.'
      );
      await loadBookings();
    } else {
      const record = {
        part_number: selectedPart.number,
        display_name: cleanName.slice(0, 40),
        token
      };
      const updated = [
        ...myBookings.filter((item) => item.part_number !== selectedPart.number),
        record
      ].sort((a, b) => a.part_number - b.part_number);
      setMyBookings(updated);
      localStorage.setItem('athar-my-bookings', JSON.stringify(updated));
      localStorage.setItem('athar-my-booking', JSON.stringify(record));
      setSelectedPart(null);
      setName('');
      setToast(`تم تسجيل الجزء ${toAr(selectedPart.number)} باسمك. أتم القراءة في وقتك ثم أكدها من هذا الجهاز.`);
      await loadBookings();
    }
    setBusy(false);
  }

  async function markComplete(item) {
    if (!item || busy) return;
    setBusy(true);
    try {
      const response = await fetch('/api/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          part_number: item.part_number,
          token_hash: await sha256(item.token)
        })
      });
      if (!response.ok) throw new Error('completion_failed');
      setToast(`تقبل الله منك، تم توثيق إتمام الجزء ${toAr(item.part_number)}.`);
      await loadBookings();
    } catch {
      setToast('تعذر تأكيد القراءة. يلزم التأكيد من نفس المتصفح الذي حجزت منه.');
    }
    setBusy(false);
  }

  async function shareLink() {
    const shareData = {
      title: 'أثر | مجلس ختمة قرآنية جماعية',
      text: 'شارك في مجلس الختمة القرآنية الجماعية «أثر» والدعاء لشهداء الحادث بالرحمة والمغفرة.',
      url: window.location.href
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(
    `مجلس ختمة قرآنية جماعية (أثر) بنية إهداء ثواب التلاوة والدعاء لشهداء الحادث بالرحمة والمغفرة:\n${
      typeof window !== 'undefined' ? window.location.href : ''
    }`
  )}`;

  const filterTabs = [
    { id: 'all', label: 'الكل', count: 30 },
    { id: 'open', label: 'متاح', count: openCount },
    { id: 'reading', label: 'قيد القراءة', count: readingCount },
    { id: 'done', label: 'مكتمل', count: completedCount }
  ];

  return (
    <div className="majlis-app">
      <a className="skip-link" href="#index-heading">
        تخطَّ إلى فهرس الأجزاء
      </a>

      <header className="topbar">
        <div className="topbar-inner">
          <a href="#top" className="brand-group" onClick={() => setMobileSection('index')}>
            <Logo size={34} compact />
            <span className="brand-wordmark">أَثَر</span>
            <span className="brand-divider" aria-hidden="true" />
            <span className="brand-caption">مجلس ختمة قرآنية جماعية</span>
          </a>

          <div className="topbar-controls">
            <a
              className="ghost-btn whatsapp-link"
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              aria-label="مشاركة عبر واتساب"
            >
              <span>واتساب</span>
            </a>
            <button type="button" className="ghost-btn" onClick={shareLink}>
              {copied ? <Check size={15} /> : <Share2 size={15} />}
              <span>{copied ? 'نُسخ الرابط' : 'مشاركة'}</span>
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
              title={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="workspace" data-mobile-section={mobileSection}>
        {/* Right Column on Desktop: Majlis Archival Panel */}
        <aside className="majlis-column">
          <section className="sheet-card dedication-card corner-frame" aria-labelledby="majlis-heading">
            <span className="corner tl" aria-hidden="true" />
            <span className="corner tr" aria-hidden="true" />
            <span className="corner bl" aria-hidden="true" />
            <span className="corner br" aria-hidden="true" />

            <div className="card-header-rule">
              <div className="seal-row">
                <Logo size={26} compact />
                <span className="card-tag">سجل الختمة القائمة</span>
              </div>
              <span className="ayah-ref">البقرة · ١١٠</span>
            </div>

            <p className="quran-verse">
              ﴿ وَمَا تُقَدِّمُوا لِأَنْفُسِكُم مِّنْ خَيْرٍ تَجِدُوهُ عِندَ اللَّهِ ﴾
            </p>

            <Ornament className="verse-ornament" />

            <h1 id="majlis-heading" className="majlis-title">
              خيرٌ يبقى وأثرٌ لا ينقطع
            </h1>
            <p className="majlis-desc">
              ختمة قرآنية جماعية مفتوحة، يقرأ فيها كل مشارك جزءه من مكانه وفي وقته بنية إهداء ثواب التلاوة والدعاء لشهداء حادث الحريق بالرحمة والمغفرة.
            </p>

            <div className="progress-block" aria-label="نسبة تقدم الختمة">
              <div className="progress-header">
                <span>إنجاز الختمة</span>
                <strong>
                  {configured ? `${toAr(completedCount)} من ${toAr(30)} جزءا (${toAr(completedPct)}٪)` : '—'}
                </strong>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-valuenow={completedPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span className="progress-fill done" style={{ width: `${completedPct}%` }} />
                <span className="progress-fill reading" style={{ width: `${readingPct}%` }} />
              </div>
              <div className="progress-legend">
                <span>
                  <i className="swatch done" /> مكتمل ({configured ? toAr(completedCount) : '—'})
                </span>
                <span>
                  <i className="swatch reading" /> قيد القراءة ({configured ? toAr(readingCount) : '—'})
                </span>
                <span>
                  <i className="swatch open" /> متاح ({configured ? toAr(openCount) : '—'})
                </span>
              </div>
            </div>
          </section>

          {myBookings.length > 0 && (
            <section className="sheet-card my-wird-card" aria-labelledby="wird-heading">
              <div className="card-header-rule">
                <h2 id="wird-heading" className="panel-heading">
                  وردك المسجل على هذا الجهاز
                </h2>
                <span className="count-pill">{toAr(myBookings.length)}</span>
              </div>
              <div className="wird-list">
                {myBookings.map((item) => {
                  const meta = JUZ_META[item.part_number - 1];
                  const isDone = byPart.get(item.part_number)?.completed;
                  return (
                    <div key={item.part_number} className={`wird-row ${isDone ? 'is-done' : ''}`}>
                      <div className="wird-info">
                        <div className="wird-part">
                          الجزء {toAr(item.part_number)} · <span>«{meta?.title}»</span>
                        </div>
                        <div className="wird-reader">باسم: {item.display_name}</div>
                      </div>
                      {isDone ? (
                        <span className="wird-done-badge">
                          <Check size={14} /> تمت القراءة
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="primary-btn compact"
                          onClick={() => markComplete(item)}
                          disabled={busy}
                        >
                          {busy ? 'جار الحفظ...' : 'أتممت القراءة'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="sheet-card dua-card" aria-labelledby="dua-heading">
            <div className="card-header-rule">
              <h2 id="dua-heading" className="panel-heading">
                الدعاء وآداب المشاركة
              </h2>
              <span className="card-tag">دعاء الختمة</span>
            </div>

            <div className="dua-entries">
              {PRAYERS.map((entry, idx) => (
                <article key={idx} className="dua-entry">
                  <h3>{entry.heading}</h3>
                  <p>{entry.body}</p>
                </article>
              ))}
            </div>

            <div className="adab-box">
              <h3>طريقة المشاركة</h3>
              <ol>
                <li>اختر جزءا متاحا من الفهرس وسجله باسمك الأول أو لقبك.</li>
                <li>اقرأ الجزء كاملا في وقتك دون اشتراط اجتماع في مكان واحد.</li>
                <li>ارجع من نفس المتصفح واضغط «أتممت القراءة» لتوثيق الإنجاز.</li>
              </ol>
            </div>

            <footer className="majlis-footer">
              <Ornament className="footer-ornament" />
              <span>إنا لله وإنا إليه راجعون</span>
              <small>مبادرة تطوعية مفتوحة · ليست جهة رسمية أو إفتائية</small>
            </footer>
          </section>
        </aside>

        {/* Left Column on Desktop: 30 Juz Index */}
        <section className="index-column" aria-labelledby="index-heading">
          <div className="mobile-summary-strip corner-frame">
            <span className="corner tl" aria-hidden="true" />
            <span className="corner tr" aria-hidden="true" />
            <span className="corner bl" aria-hidden="true" />
            <span className="corner br" aria-hidden="true" />

            <div className="mobile-summary-top">
              <div>
                <h1 className="mobile-headline">مجلس أجزاء الختمة</h1>
                <p className="mobile-subline">
                  اختر جزءا متاحا لقراءته وإهداء ثوابه والدعاء لشهداء الحادث
                </p>
              </div>
              <strong className="mobile-pct">{configured ? `${toAr(completedPct)}٪` : '—'}</strong>
            </div>
            <div className="progress-track">
              <span className="progress-fill done" style={{ width: `${completedPct}%` }} />
              <span className="progress-fill reading" style={{ width: `${readingPct}%` }} />
            </div>
            <div className="progress-legend compact">
              <span>
                <i className="swatch done" /> مكتمل {configured ? toAr(completedCount) : '—'}
              </span>
              <span>
                <i className="swatch reading" /> يُقرأ {configured ? toAr(readingCount) : '—'}
              </span>
              <span>
                <i className="swatch open" /> متاح {configured ? toAr(openCount) : '—'}
              </span>
            </div>

            {myBookings.length > 0 && pendingMineCount > 0 && (
              <div className="mobile-wird-banner">
                <div className="mobile-wird-text">
                  لديك {pendingMineCount === 1 ? 'جزء قيد القراءة' : `${toAr(pendingMineCount)} أجزاء قيد القراءة`} على هذا الجهاز
                </div>
                <button
                  type="button"
                  className="primary-btn compact"
                  onClick={() => {
                    const firstPending = myBookings.find((m) => !byPart.get(m.part_number)?.completed);
                    if (firstPending) markComplete(firstPending);
                  }}
                  disabled={busy}
                >
                  {pendingMineCount === 1
                    ? `إتمام الجزء ${toAr(myBookings.find((m) => !byPart.get(m.part_number)?.completed)?.part_number)}`
                    : 'تأكيد الإتمام'}
                </button>
              </div>
            )}
          </div>

          <div className="index-toolbar">
            <div className="index-heading-wrap">
              <h2 id="index-heading" className="index-heading">
                فهرس الأجزاء الثلاثين
              </h2>
              <span className="sync-hint">{loading ? 'جار التحديث...' : 'تحديث تلقائي'}</span>
            </div>

            <div className="toolbar-controls">
              <div className="segmented-tabs" role="tablist" aria-label="تصفية الأجزاء">
                {filterTabs.map((tabItem) => (
                  <button
                    key={tabItem.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === tabItem.id}
                    className={`seg-btn ${filter === tabItem.id ? 'active' : ''}`}
                    onClick={() => setFilter(tabItem.id)}
                  >
                    <span>{tabItem.label}</span>
                    <small>{toAr(tabItem.count)}</small>
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="icon-btn"
                onClick={loadBookings}
                disabled={loading}
                aria-label="تحديث القائمة"
                title="تحديث القائمة"
              >
                <RefreshCw size={15} className={loading ? 'spin' : ''} />
              </button>
            </div>
          </div>

          {!configured && (
            <div className="banner-alert">
              الموقع في وضع المعاينة المحلية وغير متصل بقاعدة البيانات حاليا.
            </div>
          )}
          {error && <div className="banner-alert error">{error}</div>}

          {filteredJuz.length === 0 ? (
            <div className="empty-filter-state">
              <p>لا توجد أجزاء ضمن هذا التصنيف حاليا.</p>
              <button type="button" className="ghost-btn" onClick={() => setFilter('all')}>
                عرض جميع الأجزاء الثلاثين
              </button>
            </div>
          ) : (
            <div className="juz-grid">
              {filteredJuz.map((juz) => {
                const booking = byPart.get(juz.number);
                const isMine = myPartSet.has(juz.number);
                const state = !booking ? 'open' : booking.completed ? 'done' : 'reading';
                const interactive = state === 'open' && configured && !loading;

                return (
                  <button
                    key={juz.number}
                    type="button"
                    className={`juz-tile state-${state} ${isMine ? 'is-mine' : ''}`}
                    onClick={() => openReserveDialog(juz)}
                    disabled={!interactive}
                    aria-label={`الجزء ${toAr(juz.number)} (${juz.title}) - ${
                      state === 'open'
                        ? 'متاح للحجز'
                        : state === 'done'
                          ? `تمت القراءة بواسطة ${booking.display_name}`
                          : `قيد القراءة بواسطة ${booking.display_name}`
                    }`}
                  >
                    <div className="juz-tile-top">
                      <div className="juz-title-group">
                        <span className="juz-num-badge">{toAr(juz.number)}</span>
                        <div>
                          <span className="juz-label">الجزء {toAr(juz.number)}</span>
                          <span className="juz-incipit">«{juz.title}»</span>
                        </div>
                      </div>
                      <span className="juz-surahs">{juz.surahs}</span>
                    </div>

                    <div className="juz-tile-bottom">
                      <span className="juz-reader-line" title={booking?.display_name || ''}>
                        {state === 'open'
                          ? loading
                            ? 'جار التحقق...'
                            : 'متاح للمشاركة'
                          : state === 'done'
                            ? `تمت القراءة · ${booking.display_name}`
                            : isMine
                              ? `وردك · ${booking.display_name}`
                              : `يقرأه · ${booking.display_name}`}
                      </span>
                      <span className={`status-indicator ${state}`}>
                        {state === 'done' ? <Check size={14} /> : <i className="status-dot" />}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Mobile PWA Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav" aria-label="التنقل السفلي">
        <button
          type="button"
          className={`nav-tab ${mobileSection === 'index' ? 'active' : ''}`}
          onClick={() => setMobileSection('index')}
        >
          <span>فهرس الأجزاء</span>
          <small>{toAr(openCount)} متاح</small>
        </button>
        <button
          type="button"
          className={`nav-tab ${mobileSection === 'majlis' ? 'active' : ''}`}
          onClick={() => setMobileSection('majlis')}
        >
          <span>وردك والدعاء</span>
          {pendingMineCount > 0 ? (
            <small className="nav-badge">{toAr(pendingMineCount)}</small>
          ) : (
            <small>آداب ونية</small>
          )}
        </button>
        <button type="button" className="nav-tab" onClick={shareLink}>
          <span>{copied ? 'نُسخ الرابط' : 'دعوة مشارك'}</span>
          <small>{copied ? <Copy size={12} /> : 'مشاركة'}</small>
        </button>
      </nav>

      {/* Responsive Reserve Sheet (Bottom Sheet on Mobile, Centered Dialog on Tablet/Desktop) */}
      {selectedPart && (
        <div
          className="sheet-backdrop"
          onClick={() => {
            if (!busy) {
              setSelectedPart(null);
              setFormNotice('');
            }
          }}
        >
          <div
            className="reserve-sheet corner-frame"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reserve-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-handle" aria-hidden="true" />
            <div className="reserve-sheet-head">
              <div>
                <span className="card-tag">توثيق مشاركة في الختمة</span>
                <h2 id="reserve-dialog-title">
                  الجزء {toAr(selectedPart.number)} · «{selectedPart.title}»
                </h2>
                <p className="sheet-surah-note">نطاق السور: {selectedPart.surahs}</p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  setSelectedPart(null);
                  setFormNotice('');
                }}
                aria-label="إغلاق النافذة"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={reserve} className="reserve-form">
              <label htmlFor="reader-name">الاسم الظاهر في سجل الختمة</label>
              <input
                id="reader-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="مثال: أحمد، أم محمد، فاعل خير"
                autoFocus
                required
              />
              <small className="field-hint">
                يُكتفى بالاسم الأول أو الكنية. لا تدخل رقم هاتف أو بيانات خاصة.
              </small>

              {formNotice && <div className="form-alert">{formNotice}</div>}

              <div className="sheet-actions">
                <button type="submit" className="primary-btn full" disabled={busy}>
                  {busy ? 'جار تسجيل الجزء...' : `تأكيد حجز الجزء ${toAr(selectedPart.number)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-bar" role="status">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast('')} aria-label="إغلاق التنبيه">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')).render(<App />);
