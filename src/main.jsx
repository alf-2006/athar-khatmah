import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BookOpen, Heart, CheckCircle2, LockKeyhole, RefreshCw, Share2, Info, X, Sparkles, CircleHelp } from 'lucide-react';
import './styles.css';

const configured = import.meta.env.VITE_API_ENABLED !== 'false';
const PARTS = Array.from({ length: 30 }, (_, i) => i + 1);
const prayers = [
  'اللهم اغفر لهم وارحمهم وعافهم واعف عنهم، وأكرم نزلهم ووسع مدخلهم.',
  'اللهم اجعل قبورهم روضة من رياض الجنة، وأنزل عليهم نورًا ورحمة وسكينة.',
  'اللهم اربط على قلوب أهلهم وذويهم، وارزقهم الصبر والسلوان، واشفِ المصابين شفاءً لا يغادر سقمًا.',
  'اللهم اجعل ما قدموه في الدنيا من خير في ميزان حسناتهم، واجمعنا بهم في جنات النعيم.'
];

function App() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [myBookings, setMyBookings] = useState([]);
  const [copied, setCopied] = useState(false);

  const completed = bookings.filter(b => b.completed).length;
  const reserved = bookings.length;
  const percent = Math.round((completed / 30) * 100);
  const byPart = useMemo(() => new Map(bookings.map(b => [b.part_number, b])), [bookings]);

  async function loadBookings() {
    setError('');
    try {
      const response = await fetch('/api/bookings', { cache: 'no-store' });
      if (!response.ok) throw new Error('request_failed');
      const payload = await response.json();
      setBookings(payload.bookings || []);
    } catch {
      setError('تعذر تحميل الحجوزات. حاول تحديث الصفحة بعد قليل.');
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

  async function reserve(e) {
    e.preventDefault();
    if (!selected || busy) return;
    const cleanName = name.trim();
    if (!cleanName) return setNotice('اكتب الاسم الذي تريد ظهوره في قائمة المشاركين.');
    setBusy(true);
    setNotice('');
    const token = crypto.randomUUID() + crypto.randomUUID();
    let response;
    try {
      response = await fetch('/api/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          part_number: selected,
          display_name: cleanName.slice(0, 40),
          token_hash: await sha256(token)
        })
      });
    } catch {
      response = null;
    }
    if (!response?.ok) {
      const payload = await response?.json().catch(() => ({}));
      setNotice(payload?.error === 'PART_TAKEN' ? 'هذا الجزء تم حجزه للتو. اختر جزءًا آخر.' : 'لم نتمكن من إتمام الحجز. حاول مرة أخرى.');
    } else {
      const record = { part_number: selected, display_name: cleanName.slice(0, 40), token };
      const updated = [...myBookings.filter(item => item.part_number !== selected), record].sort((a, b) => a.part_number - b.part_number);
      setMyBookings(updated);
      localStorage.setItem('athar-my-bookings', JSON.stringify(updated));
      localStorage.setItem('athar-my-booking', JSON.stringify(record));
      setNotice('تم حجز الجزء بنجاح. احتفظ بهذا الجهاز حتى تتمكن من تأكيد إتمام القراءة.');
      setSelected(null);
      setName('');
      await loadBookings();
    }
    setBusy(false);
  }

  async function markComplete(item) {
    if (!item || busy) return;
    setBusy(true);
    setNotice('');
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
      setNotice('تقبل الله منك. تم تسجيل إتمام القراءة.');
      await loadBookings();
    } catch {
      setNotice('تعذر تأكيد القراءة. يجب استخدام الجهاز الذي تم الحجز منه.');
    }
    setBusy(false);
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function share() {
    const data = { title: 'أثر | خير يبقى وأثر لا ينقطع', text: 'شارك في الختمة القرآنية الجماعية والدعاء لشهداء الحادث.', url: location.href };
    if (navigator.share) {
      try { await navigator.share(data); } catch {}
    } else {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  const shareText = encodeURIComponent(`شارك في ختمة القرآن الجماعية «أثر» والدعاء لشهداء الحادث بالرحمة والمغفرة:\n${typeof window !== 'undefined' ? window.location.href : ''}`);

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#home" aria-label="أثر الصفحة الرئيسية">
        <span className="brand-mark"><BookOpen size={21}/></span>
        <span><b>أَثَر</b><small>خير يبقى وأثر لا ينقطع</small></span>
      </a>
      <div className="topbar-actions">
        <a className="whatsapp-btn" href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noreferrer">واتساب</a>
        <button className="share-btn" onClick={share}><Share2 size={17}/><span>{copied ? 'تم نسخ الرابط' : 'مشاركة المبادرة'}</span></button>
      </div>
    </header>
    <main id="home">
      <section className="hero">
        <div className="hero-pattern" aria-hidden="true"></div>
        <div className="hero-content">
          <span className="eyebrow"><Sparkles size={14}/> مبادرة تطوعية مفتوحة للجميع</span>
          <h1>أَثَر</h1>
          <p className="hero-subtitle">خيرٌ يبقى وأثرٌ لا ينقطع</p>
          <div className="ornament"><span></span><BookOpen size={19}/><span></span></div>
          <p className="hero-copy">ختمة قرآنية جماعية، يشارك فيها كل شخص من مكانه، ونجتمع على الدعاء لشهداء الحادث بالرحمة والمغفرة.</p>
          <a className="primary-link" href="#parts">شارك في الختمة <span>←</span></a>
        </div>
        <div className="hero-bottom"><span>﴿ وَمَا تُقَدِّمُوا لِأَنْفُسِكُم مِّنْ خَيْرٍ تَجِدُوهُ عِندَ اللَّهِ ﴾</span><small>البقرة · 110</small></div>
      </section>

      <section className="intro section-wrap">
        <div className="section-icon"><Heart size={21}/></div>
        <div>
          <h2>عن المبادرة</h2>
          <p>مساحة تطوعية لتنظيم قراءة القرآن الكريم بصورة جماعية عن بُعد، مع الدعاء للمتوفين بالرحمة والمغفرة. يمكنك اختيار جزء متاح وقراءته في الوقت المناسب لك.</p>
        </div>
      </section>

      <section className="stats-grid" aria-label="إحصائيات الختمة">
        <div className="stat-card"><span>الأجزاء المحجوزة</span><strong>{configured ? reserved : '—'}<small> / 30</small></strong></div>
        <div className="stat-card"><span>الأجزاء المكتملة</span><strong>{configured ? completed : '—'}<small> / 30</small></strong></div>
        <div className="stat-card"><span>نسبة الإتمام</span><strong>{configured ? percent : '—'}<small>%</small></strong></div>
      </section>

      <section className="section-wrap parts-section" id="parts">
        <div className="section-heading">
          <div>
            <span className="kicker">شارك بما تستطيع</span>
            <h2>اختر جزءك من القرآن</h2>
            <p>كل جزء يُحجز مرة واحدة فقط.</p>
          </div>
          <button className="refresh-btn" onClick={loadBookings} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''}/> تحديث</button>
        </div>
        {!configured && <div className="setup-alert"><Info size={20}/><div><b>الموقع في وضع المعاينة</b><p>الموقع غير متصل بالخادم حاليًا. أعد المحاولة بعد اكتمال إعداد الاستضافة.</p></div></div>}
        {error && <div className="inline-error">{error}</div>}
        <div className="legend">
          <span><i className="dot available"></i> متاح</span>
          <span><i className="dot reserved"></i> محجوز</span>
          <span><i className="dot done"></i> تمت القراءة</span>
        </div>
        <div className="parts-grid">
          {PARTS.map(n => {
            const b = byPart.get(n);
            const status = !b ? 'available' : b.completed ? 'done' : 'reserved';
            return <button
              key={n}
              className={`part-card ${status}`}
              onClick={() => !b && configured && setSelected(n)}
              disabled={Boolean(b) || !configured}
              aria-label={`الجزء ${n} ${status === 'available' ? 'متاح' : status === 'done' ? 'تمت قراءته' : 'محجوز'}`}
            >
              <span className="part-number">{String(n).padStart(2, '0')}</span>
              <span className="part-label">الجزء {n}</span>
              <span className="part-status">{status === 'available' ? 'متاح للحجز' : status === 'done' ? 'تمت القراءة' : 'محجوز'}</span>
              {b?.display_name && <span className="part-reader" title={b.display_name}>{b.display_name}</span>}
              {status === 'done' ? <CheckCircle2 size={17}/> : status === 'reserved' ? <LockKeyhole size={16}/> : <BookOpen size={17}/>}
            </button>;
          })}
        </div>
        {loading && <p className="loading-line">جارٍ تحميل حالة الأجزاء…</p>}
      </section>

      {myBookings.length > 0 && <section className="my-booking section-wrap">
        <div className="my-booking-head"><CheckCircle2 size={20}/><b>حجوزاتك على هذا الجهاز</b></div>
        <div className="my-booking-list">
          {myBookings.map(item => {
            const isDone = byPart.get(item.part_number)?.completed;
            return <div key={item.part_number} className="my-booking-row">
              <p>الجزء رقم <strong>{item.part_number}</strong> باسم <strong>{item.display_name}</strong></p>
              {!isDone
                ? <button className="complete-btn" onClick={() => markComplete(item)} disabled={busy}>{busy ? 'جارٍ التسجيل…' : 'تأكيد إتمام القراءة'}</button>
                : <span className="completed-label">تم تسجيل إتمام القراءة، تقبل الله منك.</span>}
            </div>;
          })}
        </div>
      </section>}

      <section className="prayer-section">
        <div className="prayer-inner">
          <span className="kicker light">دعاء ورجاء</span>
          <h2>اللهم ارحم شهداءنا</h2>
          <p className="prayer-lead">اللهم اغفر لهم وارحمهم، واجعل قبورهم روضة من رياض الجنة، وألهم أهلهم الصبر والسلوان، واشفِ المصابين شفاءً تامًا.</p>
          <div className="prayer-list">{prayers.map((p, i) => <p key={i}><span>۞</span>{p}</p>)}</div>
          <p className="closing-prayer">إنا لله وإنا إليه راجعون</p>
        </div>
      </section>

      <section className="manners section-wrap">
        <div className="section-icon"><CircleHelp size={21}/></div>
        <div>
          <h2>كيف تشارك؟</h2>
          <ol>
            <li>اختر جزءًا متاحًا من الأجزاء الثلاثين.</li>
            <li>اكتب الاسم الذي ترغب في ظهوره بقائمة المشاركين.</li>
            <li>اقرأ الجزء كاملًا في الوقت المناسب لك.</li>
            <li>عد إلى الموقع واضغط «تأكيد إتمام القراءة».</li>
          </ol>
          <p className="note">المشاركة اختيارية، ولا يشترط الاجتماع في مكان واحد. نسأل الله القبول، ونرجو أن يكون العمل خالصًا لوجهه الكريم.</p>
        </div>
      </section>
    </main>
    <footer>
      <div className="footer-brand">أَثَر</div>
      <p>اللهم تقبل منا صالح الأعمال</p>
      <small>مبادرة تطوعية مستقلة · ليست جهة رسمية أو دينية</small>
      <div className="footer-rule"></div>
      <small>صُنع بنية الخير</small>
    </footer>

    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="close-modal" onClick={() => setSelected(null)} aria-label="إغلاق"><X size={19}/></button>
        <span className="kicker">حجز جديد</span>
        <h2>الجزء رقم {selected}</h2>
        <p>اكتب اسمًا مختصرًا ليظهر في قائمة المشاركين.</p>
        <form onSubmit={reserve}>
          <label htmlFor="display-name">الاسم الظاهر</label>
          <input id="display-name" value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder="مثال: أحمد" autoFocus required/>
          <small className="privacy-hint">لا تكتب رقم هاتفك أو أي بيانات شخصية.</small>
          {notice && <div className="form-notice">{notice}</div>}
          <button className="submit-btn" disabled={busy}>{busy ? 'جارٍ الحجز…' : 'تأكيد حجز الجزء'}</button>
        </form>
      </div>
    </div>}
    {notice && !selected && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="إغلاق"><X size={16}/></button></div>}
    <div className="bottom-note">اللهم ارحمهم واغفر لهم</div>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
