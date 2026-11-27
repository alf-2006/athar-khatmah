import React, { useEffect, useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import Topbar from '../components/Topbar.jsx';
import { Ornament } from '../Logo.jsx';
import { Link, navigate } from '../lib/router.jsx';
import {
  api,
  configured,
  copyText,
  errorText,
  ownerUrl,
  publicUrl,
  setOwnerToken
} from '../lib/client.js';
import { NEW_PAGE_TITLE } from '../lib/texts.js';

const KIND_OPTIONS = [
  { id: 'deceased_m', label: 'له', hint: 'عن روح رجل' },
  { id: 'deceased_f', label: 'لها', hint: 'عن روح امرأة' },
  { id: 'deceased_p', label: 'لهم', hint: 'عن روح أكثر من شخص' },
  { id: 'general', label: 'عام', hint: 'صدقة جارية بلا تحديد' }
];

function CopyField({ label, value, warning, id }) {
  const [done, setDone] = useState(false);
  async function copy() {
    if (await copyText(value)) {
      setDone(true);
      window.setTimeout(() => setDone(false), 1800);
    }
  }
  return (
    <div className="link-field">
      <label htmlFor={id}>{label}</label>
      <div className="link-box">
        <input id={id} type="text" readOnly value={value} dir="ltr" onFocus={(e) => e.target.select()} />
        <button type="button" className="ghost-btn" onClick={copy}>
          {done ? <Check size={15} /> : <Copy size={15} />}
          <span>{done ? 'نُسخ' : 'نسخ'}</span>
        </button>
      </div>
      {warning && <small className="field-hint warn">{warning}</small>}
    </div>
  );
}

export default function NewGroup({ theme, onToggleTheme }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('deceased_m');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [created, setCreated] = useState(null);

  useEffect(() => {
    document.title = NEW_PAGE_TITLE;
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const cleanTitle = title.trim();
    if (cleanTitle.length < 2) {
      setNotice('اكتب اسم من تهدي إليه الختمة (حرفان على الأقل).');
      return;
    }
    setBusy(true);
    setNotice('');
    const res = await api('/api/groups', {
      method: 'POST',
      body: { title: cleanTitle, kind, message: message.trim() }
    });
    if (res.ok) {
      setOwnerToken(res.data.slug, res.data.owner_token);
      setCreated(res.data);
    } else {
      setNotice(errorText(res.error));
    }
    setBusy(false);
  }

  async function shareCreated() {
    const url = publicUrl(created.slug);
    const text = `ختمة قرآنية جماعية صدقة جارية. احجز جزءك واقرأه في وقتك:`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'ختمة صدقة جارية', text, url });
        return;
      } catch {}
    }
    await copyText(`${text}\n${url}`);
  }

  if (created) {
    const pub = publicUrl(created.slug);
    const priv = ownerUrl(created.slug, created.owner_token);
    const whatsapp = `https://wa.me/?text=${encodeURIComponent(
      `ختمة قرآنية جماعية صدقة جارية${kind === 'general' ? '' : ` عن روح ${title.trim()}`}. احجز جزءك واقرأه في وقتك وشاركنا الأجر:\n${pub}`
    )}`;
    return (
      <div className="majlis-app">
        <Topbar theme={theme} onToggleTheme={onToggleTheme} showStart={false} />
        <main className="page-narrow">
          <section className="sheet-card created-card corner-frame" aria-labelledby="created-heading">
            <span className="corner tl" aria-hidden="true" />
            <span className="corner tr" aria-hidden="true" />
            <span className="corner bl" aria-hidden="true" />
            <span className="corner br" aria-hidden="true" />
            <div className="card-header-rule">
              <span className="card-tag">تم إنشاء المجلس</span>
              <span className="count-pill">١ ختمة · ٣٠ جزءا</span>
            </div>
            <h1 id="created-heading" className="majlis-title">
              {kind === 'general' ? title.trim() : `عن روح ${title.trim()}`}
            </h1>
            <Ornament className="verse-ornament" />
            <p className="majlis-desc">
              مجلسك جاهز. انشر رابط المشاركة بين من تحب، ويحجز كلٌّ منهم جزءه. حين تمتلئ الأجزاء افتح ختمات إضافية من رابط الإدارة.
            </p>

            <CopyField id="public-link" label="رابط المشاركة (انشره للجميع)" value={pub} />
            <div className="created-share">
              <a className="primary-btn" href={whatsapp} target="_blank" rel="noreferrer">
                شارك عبر واتساب
              </a>
              <button type="button" className="ghost-btn" onClick={shareCreated}>
                <Share2 size={15} /> مشاركة
              </button>
            </div>

            <div className="owner-secret">
              <CopyField
                id="owner-link"
                label="رابط الإدارة (لك وحدك)"
                value={priv}
                warning="لا تشاركه مع أحد. منه تفتح ختمات إضافية وتغلق الحجز وتتابع المنتظرين. حُفظ على هذا الجهاز تلقائيا، فانسخه واحفظه لتدير المجلس من أي جهاز آخر، ولا يمكن استرجاعه إن فُقد."
              />
            </div>

            <div className="centered-actions">
              <button type="button" className="primary-btn" onClick={() => navigate(`/k/${created.slug}`)}>
                افتح صفحة المجلس
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="majlis-app">
      <Topbar theme={theme} onToggleTheme={onToggleTheme} showStart={false} />
      <main className="page-narrow">
        <section className="sheet-card new-card corner-frame" aria-labelledby="new-heading">
          <span className="corner tl" aria-hidden="true" />
          <span className="corner tr" aria-hidden="true" />
          <span className="corner bl" aria-hidden="true" />
          <span className="corner br" aria-hidden="true" />

          <div className="card-header-rule">
            <span className="card-tag">مجلس جديد</span>
            <Link to="/" className="back-link">
              العودة للرئيسية
            </Link>
          </div>

          <h1 id="new-heading" className="majlis-title">
            ابدأ ختمة لمن تحب
          </h1>
          <p className="majlis-desc">
            اجعل ختمة قرآنية جماعية صدقة جارية عن شخص تحبه. تحصل على رابط تشاركه، ويحجز كل مشارك جزءا ويقرأه في وقته.
          </p>

          <form className="reserve-form new-form" onSubmit={submit} noValidate>
            <label htmlFor="group-title">اسم من تهدي إليه الختمة</label>
            <input
              id="group-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
              placeholder="مثال: والدي الحاج أحمد"
              autoComplete="off"
              required
            />
            <small className="field-hint">اسم أو صفة فقط، دون أرقام هواتف أو روابط.</small>

            <span className="form-label" id="kind-label">
              صيغة الدعاء
            </span>
            <div className="segmented-tabs kind-tabs" role="radiogroup" aria-labelledby="kind-label">
              {KIND_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={kind === option.id}
                  className={`seg-btn ${kind === option.id ? 'active' : ''}`}
                  onClick={() => setKind(option.id)}
                  title={option.hint}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <small className="field-hint">{KIND_OPTIONS.find((o) => o.id === kind)?.hint}.</small>

            <label htmlFor="group-message">رسالة قصيرة للمشاركين (اختياري)</label>
            <textarea
              id="group-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="مثال: جزاكم الله خيرا على مشاركتكم، ونسألكم الدعاء له."
            />
            <small className="field-hint">{200 - message.length} حرفا متبقيا</small>

            {notice && (
              <div className="form-alert" role="alert">
                {notice}
              </div>
            )}
            {!configured && (
              <div className="form-alert" role="alert">
                الموقع في وضع المعاينة المحلية وغير متصل بقاعدة البيانات.
              </div>
            )}

            <p className="new-note">
              تبدأ الختمة بثلاثين جزءا. حين تمتلئ الأجزاء تفتح ختمات إضافية من رابط الإدارة الخاص بك، حتى مئة ختمة.
            </p>

            <div className="sheet-actions">
              <button type="submit" className="primary-btn full" disabled={busy || !configured}>
                {busy ? 'جار إنشاء المجلس...' : 'إنشاء المجلس'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
