import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Plus,
  RefreshCw,
  Share2,
  Users,
  X
} from 'lucide-react';
import Logo, { Ornament } from '../Logo.jsx';
import Topbar from '../components/Topbar.jsx';
import OwnerPanel from '../components/OwnerPanel.jsx';
import { ReleaseDialog, ReserveDialog, ReserveSuccessDialog } from '../components/Dialogs.jsx';
import { Link } from '../lib/router.jsx';
import { JUZ_META, PARTS, toAr } from '../lib/juz.js';
import { downloadIcs } from '../lib/ics.js';
import { quranUrl } from '../lib/quran.js';
import {
  MEMORIAL_SLUG,
  api,
  captureOwnerFragment,
  clearOwnerToken,
  configured,
  copyText,
  errorText,
  getDeviceHash,
  getWaiting,
  loadMyBookings,
  ownerUrl,
  publicUrl,
  randomToken,
  saveMyBookings,
  setWaiting,
  sha256,
  store
} from '../lib/client.js';
import { ADAB_STEPS, MEMORIAL_GROUP, groupCopy } from '../lib/texts.js';

const POLL_MS = 10000;

/* تذكير لطيف لمن حجز جزءا ولم يعد: يظهر بعد يوم كامل من الحجز. */
const DAY_MS = 24 * 60 * 60 * 1000;

const keyOf = (round, part) => `${round}:${part}`;

const remindKey = (slug) => `athar-remind:${slug}`;

function loadDismissed(slug) {
  try {
    const parsed = JSON.parse(store.get(remindKey(slug)) || '[]');
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export default function GroupPage({ slug, theme, onToggleTheme }) {
  const memorial = slug === MEMORIAL_SLUG;

  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | notfound | error
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [viewRound, setViewRound] = useState(null);
  const [filter, setFilter] = useState('all');
  const [mobileSection, setMobileSection] = useState('index');
  const [dialog, setDialog] = useState(null);
  const [name, setName] = useState(() => store.get('athar-name') || '');
  const [busy, setBusy] = useState(false);
  const [formNotice, setFormNotice] = useState('');
  const [toast, setToast] = useState('');
  const [myBookings, setMyBookings] = useState(() => loadMyBookings(slug));
  const [mineStatus, setMineStatus] = useState({});
  const [copied, setCopied] = useState(false);
  const [owner, setOwner] = useState(() => captureOwnerFragment(slug));
  const [ownerInfo, setOwnerInfo] = useState(null);
  const [ownerBusy, setOwnerBusy] = useState(false);
  const [waiting, setWaitingState] = useState(() => getWaiting(slug));
  const [dismissedReminders, setDismissedReminders] = useState(() => loadDismissed(slug));

  const reqRef = useRef(0);
  const viewRoundRef = useRef(null);
  const myRef = useRef(myBookings);
  const statusRef = useRef(mineStatus);
  const ownerRef = useRef(owner);
  myRef.current = myBookings;
  statusRef.current = mineStatus;
  ownerRef.current = owner;

  const group = data?.group || (memorial ? MEMORIAL_GROUP : null);
  const copy = useMemo(() => (group ? groupCopy(group) : null), [group]);

  /* ---------------- تحميل البيانات ---------------- */
  const load = useCallback(
    async ({ fresh = false } = {}) => {
      const id = ++reqRef.current;
      const params = new URLSearchParams({ group: slug });
      if (viewRoundRef.current) params.set('round', String(viewRoundRef.current));
      if (fresh) params.set('t', String(Date.now()));
      setRefreshing(true);
      const res = await api(`/api/bookings?${params}`);
      if (id !== reqRef.current) return;
      setRefreshing(false);
      if (res.ok) {
        setData(res.data);
        setStatus('ready');
        setError('');
        // ربط الحجوزات المحفوظة القديمة بمعرّفها في الخادم ليتسنى قياس عمر الحجز.
        const rows = res.data?.bookings;
        if (Array.isArray(rows) && rows.length && myRef.current.length) {
          let changed = false;
          const next = myRef.current.map((item) => {
            if (item.id || item.round_no !== res.data.round) return item;
            const row = rows.find(
              (b) => b.part_number === item.part_number && b.display_name === item.display_name
            );
            if (!row?.id) return item;
            changed = true;
            return { ...item, id: row.id };
          });
          if (changed) {
            setMyBookings(next);
            saveMyBookings(slug, next);
          }
        }
      } else if (res.status === 404) {
        setStatus('notfound');
      } else {
        setError('تعذر تحديث حالة الأجزاء حاليا. تحقق من الاتصال وحاول مجددا.');
        setStatus((s) => (s === 'loading' ? 'error' : s));
      }
    },
    [slug]
  );

  const syncMine = useCallback(async () => {
    const pending = myRef.current
      .filter((it) => statusRef.current[keyOf(it.round_no, it.part_number)] !== 'done')
      .slice(0, 20);
    if (!pending.length) return;
    const items = await Promise.all(
      pending.map(async (it) => ({
        round_no: it.round_no,
        part_number: it.part_number,
        token_hash: await sha256(it.token)
      }))
    );
    const res = await api('/api/mine', { method: 'POST', body: { group: slug, items } });
    if (!res.ok || !Array.isArray(res.data.items)) return;
    const found = new Map(res.data.items.map((r) => [keyOf(r.round_no, r.part_number), r.status]));
    setMineStatus((prev) => {
      const next = { ...prev };
      for (const it of pending) {
        const key = keyOf(it.round_no, it.part_number);
        if (found.has(key)) next[key] = found.get(key);
      }
      return next;
    });
    const released = pending.filter((it) => !found.has(keyOf(it.round_no, it.part_number)));
    if (released.length) {
      const gone = new Set(released.map((it) => keyOf(it.round_no, it.part_number)));
      const rest = myRef.current.filter((it) => !gone.has(keyOf(it.round_no, it.part_number)));
      setMyBookings(rest);
      saveMyBookings(slug, rest);
      setToast('حرّر صاحب المجلس جزءا كان محجوزا باسمك، ويمكنك حجز جزء آخر.');
    }
  }, [slug]);

  const refreshOwner = useCallback(async () => {
    const token = ownerRef.current;
    if (!token) return;
    const res = await api('/api/manage', {
      method: 'POST',
      body: { group: slug, owner_token: token, action: 'overview' }
    });
    if (res.ok) {
      setOwnerInfo(res.data);
    } else if (res.status === 403) {
      clearOwnerToken(slug);
      setOwner(null);
      setOwnerInfo(null);
      setToast('رابط الإدارة المحفوظ لم يعد صالحا لهذا المجلس.');
    }
  }, [slug]);

  const refreshAll = useCallback(
    (opts) => Promise.all([load(opts), syncMine(), refreshOwner()]),
    [load, syncMine, refreshOwner]
  );

  useEffect(() => {
    refreshAll();
    const tick = () => {
      if (document.visibilityState === 'visible') refreshAll();
    };
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refreshAll]);

  useEffect(() => {
    if (copy) document.title = copy.docTitle;
  }, [copy]);

  // لصق رابط الإدارة في نفس التبويب المفتوح على المجلس يغيّر الـhash فقط دون إعادة تحميل.
  useEffect(() => {
    function onHashChange() {
      const token = captureOwnerFragment(slug);
      if (token && token !== ownerRef.current) {
        ownerRef.current = token;
        setOwner(token);
        setOwnerInfo(null);
        refreshOwner();
      }
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [slug, refreshOwner]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(() => setToast(''), 4600);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!dialog) return undefined;
    function onKeyDown(e) {
      if (e.key === 'Escape' && !busy) closeDialog();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialog, busy]);

  /* ---------------- قيم مشتقة ---------------- */
  const ready = status === 'ready';
  const rounds = group?.rounds ?? 1;
  const closed = Boolean(group?.closed);
  const round = data?.round ?? 1;
  const bookings = data?.bookings ?? [];
  const summary = data?.summary;
  const totalParts = summary?.total_parts ?? rounds * PARTS;
  const completedAll = summary?.completed ?? 0;
  const takenAll = summary?.taken ?? 0;
  const readingAll = Math.max(0, takenAll - completedAll);
  const openAll = summary ? summary.open : totalParts;
  const completedPct = Math.round((completedAll / totalParts) * 100);
  const readingPct = Math.round((readingAll / totalParts) * 100);
  const full = ready && openAll === 0 && !closed;
  const waitingActive = Boolean(waiting && waiting.rounds === rounds);

  const byPart = useMemo(() => new Map(bookings.map((b) => [b.part_number, b])), [bookings]);
  const roundCompleted = bookings.filter((b) => b.completed).length;
  const roundReading = bookings.length - roundCompleted;
  const roundOpen = PARTS - bookings.length;

  const myKeys = useMemo(
    () => new Set(myBookings.map((m) => keyOf(m.round_no, m.part_number))),
    [myBookings]
  );

  function statusOf(item) {
    const key = keyOf(item.round_no, item.part_number);
    if (mineStatus[key]) return mineStatus[key];
    return item.round_no === round && byPart.get(item.part_number)?.completed ? 'done' : 'reading';
  }

  const pendingMine = myBookings.filter((item) => statusOf(item) !== 'done');
  const firstPending = pendingMine[0];

  // أقدم جزء محجوز على هذا الجهاز ولم يُتمَّ بعد أكثر من يوم.
  const staleReminder = useMemo(() => {
    if (!ready) return null;
    const now = Date.now();
    for (const item of myBookings) {
      if (!item.id || dismissedReminders.includes(item.id)) continue;
      if (statusOf(item) === 'done') continue;
      const row = bookings.find((b) => b.id === item.id);
      if (!row || row.completed) continue;
      const started = Date.parse(row.created_at);
      if (!Number.isFinite(started) || now - started < DAY_MS) continue;
      return { ...item, days: Math.max(1, Math.floor((now - started) / DAY_MS)) };
    }
    return null;
  }, [ready, myBookings, bookings, dismissedReminders, mineStatus]);

  function dismissReminder() {
    if (!staleReminder?.id) return;
    const next = [...new Set([...dismissedReminders, staleReminder.id])].slice(-40);
    setDismissedReminders(next);
    store.set(remindKey(slug), JSON.stringify(next));
  }

  function addReminderToCalendar(record) {
    const meta = JUZ_META[record.part_number - 1];
    const ok = downloadIcs(
      {
        title: `قراءة الجزء ${toAr(record.part_number)} — ${copy.heading}`,
        description: `«${meta?.title}» · ${meta?.surahs}. أكمل القراءة ثم عد إلى صفحة المجلس لتوثيقها.`,
        url: publicUrl(slug)
      },
      `athar-juz-${record.part_number}.ics`
    );
    setToast(
      ok
        ? 'نزّلنا تذكيرا للتقويم. افتح الملف وسيضاف الموعد اليومي إلى تقويمك.'
        : 'تعذر إنشاء تذكير التقويم على هذا المتصفح.'
    );
  }

  const roundTaken = useMemo(() => {
    const map = new Map((summary?.rounds || []).map((r) => [r.round_no, r.taken]));
    return (n) => map.get(n) ?? 0;
  }, [summary]);

  const filteredJuz = useMemo(
    () =>
      JUZ_META.filter((juz) => {
        const booking = byPart.get(juz.number);
        if (filter === 'open') return !booking;
        if (filter === 'reading') return Boolean(booking && !booking.completed);
        if (filter === 'done') return Boolean(booking?.completed);
        return true;
      }),
    [byPart, filter]
  );

  /* ---------------- أفعال ---------------- */
  function closeDialog() {
    setDialog(null);
    setFormNotice('');
  }

  function selectRound(next) {
    const clamped = Math.min(Math.max(Number(next) || 1, 1), rounds);
    viewRoundRef.current = clamped;
    setViewRound(clamped);
    setFilter('all');
    load();
  }

  function openAuto() {
    if (!ready || !configured || closed || full) return;
    setFormNotice('');
    setDialog({ type: 'reserve', auto: true, round });
  }

  function openTile(juz) {
    if (!ready || !configured) return;
    const booking = byPart.get(juz.number);
    if (!booking) {
      if (closed) return;
      setFormNotice('');
      setDialog({ type: 'reserve', auto: false, juz, round });
    } else if (owner && !booking.completed) {
      setDialog({ type: 'release', juz, booking, round });
    }
  }

  async function submitReserve(e) {
    e.preventDefault();
    if (!dialog || dialog.type !== 'reserve' || busy) return;
    const cleanName = name.trim().slice(0, 40);
    if (!cleanName) {
      setFormNotice('اكتب الاسم الذي ترغب في ظهوره أمام الجزء.');
      return;
    }
    setBusy(true);
    setFormNotice('');
    const token = randomToken();
    const body = {
      group: slug,
      display_name: cleanName,
      token_hash: await sha256(token),
      device_hash: await getDeviceHash()
    };
    if (dialog.auto) body.auto = true;
    else {
      body.part_number = dialog.juz.number;
      body.round_no = dialog.round;
    }
    const res = await api('/api/reserve', { method: 'POST', body });

    if (!res.ok) {
      setFormNotice(errorText(res.error, 'تعذر تثبيت الحجز الآن. حاول مرة أخرى.'));
      if (['PART_TAKEN', 'GROUP_FULL', 'GROUP_CLOSED'].includes(res.error)) await refreshAll({ fresh: true });
    } else {
      const record = {
        id: res.data.id,
        round_no: res.data.round_no,
        part_number: res.data.part_number,
        display_name: cleanName,
        token
      };
      const updated = [
        ...myRef.current.filter((it) => keyOf(it.round_no, it.part_number) !== keyOf(record.round_no, record.part_number)),
        record
      ].sort((a, b) => a.round_no - b.round_no || a.part_number - b.part_number);
      setMyBookings(updated);
      saveMyBookings(slug, updated);
      setMineStatus((prev) => ({ ...prev, [keyOf(record.round_no, record.part_number)]: 'reading' }));
      store.set('athar-name', cleanName);
      setDialog({
        type: 'success',
        round_no: record.round_no,
        part_number: record.part_number,
        display_name: cleanName
      });
      const where = rounds > 1 ? ` من الختمة ${toAr(record.round_no)}` : '';
      setToast(
        `${dialog.auto ? 'خُصِّص لك' : 'تم تسجيل'} الجزء ${toAr(record.part_number)}${where} باسمك. أتم القراءة في وقتك ثم أكدها من هذا الجهاز.`
      );
      if (record.round_no !== round) {
        viewRoundRef.current = record.round_no;
        setViewRound(record.round_no);
      }
      await load({ fresh: true });
    }
    setBusy(false);
  }

  async function markComplete(item) {
    if (!item || busy) return;
    setBusy(true);
    const res = await api('/api/complete', {
      method: 'POST',
      body: {
        group: slug,
        round_no: item.round_no,
        part_number: item.part_number,
        token_hash: await sha256(item.token)
      }
    });
    if (res.ok) {
      setMineStatus((prev) => ({ ...prev, [keyOf(item.round_no, item.part_number)]: 'done' }));
      setToast(`تقبل الله منك، تم توثيق إتمام الجزء ${toAr(item.part_number)}.`);
      await load({ fresh: true });
    } else {
      setToast('تعذر تأكيد القراءة. يلزم التأكيد من نفس المتصفح الذي حجزت منه.');
    }
    setBusy(false);
  }

  async function joinWaiting() {
    if (busy || waitingActive) return;
    setBusy(true);
    const res = await api('/api/waitlist', {
      method: 'POST',
      body: { group: slug, token_hash: await getDeviceHash() }
    });
    if (res.ok) {
      setWaiting(slug, rounds);
      setWaitingState({ rounds });
      setToast('سجّلنا رغبتك في المشاركة، وسيعلم صاحب المجلس بوجود من ينتظر مكانا.');
    } else if (res.error === 'NOT_FULL') {
      setToast('أُتيحت أجزاء جديدة الآن، يمكنك الحجز.');
      await load({ fresh: true });
    } else {
      setToast(errorText(res.error));
    }
    setBusy(false);
  }

  async function ownerPost(action, extra = {}) {
    return api('/api/manage', {
      method: 'POST',
      body: { group: slug, owner_token: owner, action, ...extra }
    });
  }

  async function addRounds(count) {
    setOwnerBusy(true);
    const res = await ownerPost('add_rounds', { count });
    if (res.ok) {
      setOwnerInfo(res.data);
      setToast(count === 1 ? 'فُتحت ختمة إضافية.' : `فُتحت ${toAr(count)} ختمات إضافية.`);
      await load({ fresh: true });
    } else {
      setToast(errorText(res.error));
    }
    setOwnerBusy(false);
  }

  async function toggleClosed() {
    if (!ownerInfo) return;
    setOwnerBusy(true);
    const res = await ownerPost('set_closed', { closed: !ownerInfo.closed });
    if (res.ok) {
      setOwnerInfo(res.data);
      setToast(res.data.closed ? 'أُغلق الحجز. لن يتمكن أحد من حجز أجزاء جديدة.' : 'أُعيد فتح الحجز.');
      await load({ fresh: true });
    } else {
      setToast(errorText(res.error));
    }
    setOwnerBusy(false);
  }

  async function confirmRelease() {
    if (!dialog || dialog.type !== 'release') return;
    setBusy(true);
    const res = await ownerPost('release', { round_no: dialog.round, part_number: dialog.juz.number });
    if (res.ok) {
      setOwnerInfo(res.data);
      setToast(`تم تحرير الجزء ${toAr(dialog.juz.number)}.`);
      setDialog(null);
      await load({ fresh: true });
    } else {
      setToast(
        res.error === 'NOT_RELEASABLE'
          ? 'تعذر التحرير: ربما أُتم الجزء أو حُرر بالفعل.'
          : errorText(res.error)
      );
      await load({ fresh: true });
    }
    setBusy(false);
  }

  async function shareLink() {
    const url = publicUrl(slug);
    if (navigator.share) {
      try {
        await navigator.share({ title: copy.shareTitle, text: copy.shareText.split('\n')[0], url });
        return;
      } catch {}
    }
    if (await copyText(url)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  }

  /* ---------------- حالات الصفحة قبل الجاهزية ---------------- */
  if (status === 'notfound') {
    return (
      <div className="majlis-app">
        <Topbar theme={theme} onToggleTheme={onToggleTheme} />
        <main className="page-narrow">
          <section className="sheet-card centered-card">
            <h1 className="majlis-title">لم نعثر على هذا المجلس</h1>
            <p className="majlis-desc">قد يكون الرابط ناقصا أو كُتب بصورة غير صحيحة. تأكد من الرابط الذي وصلك.</p>
            <div className="centered-actions">
              <Link to="/" className="primary-btn">
                الصفحة الرئيسية
              </Link>
              <Link to="/new" className="ghost-btn">
                ابدأ ختمة لمن تحب
              </Link>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="majlis-app">
        <Topbar theme={theme} onToggleTheme={onToggleTheme} />
        <main className="page-narrow">
          <section className="sheet-card centered-card" aria-live="polite">
            {status === 'error' ? (
              <>
                <h1 className="majlis-title">تعذر تحميل المجلس</h1>
                <p className="majlis-desc">{error}</p>
                <div className="centered-actions">
                  <button type="button" className="primary-btn" onClick={() => refreshAll({ fresh: true })}>
                    إعادة المحاولة
                  </button>
                </div>
              </>
            ) : (
              <p className="majlis-desc">جار تحميل المجلس...</p>
            )}
          </section>
        </main>
      </div>
    );
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(copy.shareText)}`;
  const showRoundNav = rounds > 1;
  const interactiveOpen = ready && configured && !closed;
  const ownerLink = owner ? ownerUrl(slug, owner) : '';

  const filterTabs = [
    { id: 'all', label: 'الكل', count: PARTS },
    { id: 'open', label: 'متاح', count: roundOpen },
    { id: 'reading', label: 'قيد القراءة', count: roundReading },
    { id: 'done', label: 'مكتمل', count: roundCompleted }
  ];

  const progressLabel = rounds > 1 ? 'إنجاز الختمات' : 'إنجاز الختمة';

  /* ---------------- مكوّن الحجز السريع ---------------- */
  const reservePanel = closed ? (
    <div className="reserve-cta is-closed" role="status">
      <div className="reserve-cta-text">
        <strong>أُغلق الحجز حاليا</strong>
        <small>أغلق صاحب المجلس باب الحجز مؤقتا. يمكنك متابعة التقدم من الفهرس.</small>
      </div>
    </div>
  ) : full ? (
    <div className="reserve-cta is-full" role="status">
      <div className="reserve-cta-text">
        <strong>اكتملت الحجوزات حالياً</strong>
        <small>جزاكم الله خيرا. إن رغبت في المشاركة فسجّل رغبتك ليعلم صاحب المجلس أن هناك من ينتظر.</small>
      </div>
      <button
        type="button"
        className="primary-btn"
        onClick={joinWaiting}
        disabled={busy || waitingActive || !configured}
      >
        {waitingActive ? (
          <>
            <Check size={15} /> سجّلنا رغبتك
          </>
        ) : (
          <>
            <Users size={15} /> أريد المشاركة
          </>
        )}
      </button>
    </div>
  ) : (
    <div className="reserve-cta">
      <div className="reserve-cta-text">
        <strong>
          {ready
            ? `متاح ${toAr(openAll)} ${openAll === 1 ? 'جزء' : 'جزءا'}${rounds > 1 ? ` في ${toAr(rounds)} ختمات` : ''}`
            : 'جار التحقق من الأجزاء المتاحة...'}
        </strong>
        <small>يُخصَّص لك أول جزء متاح، أو اختر جزءا بعينه من الفهرس.</small>
      </div>
      <button type="button" className="primary-btn" onClick={openAuto} disabled={!interactiveOpen}>
        احجز لي جزءا
      </button>
    </div>
  );

  return (
    <div className="majlis-app">
      <a className="skip-link" href="#index-heading">
        تخطَّ إلى فهرس الأجزاء
      </a>

      <Topbar
        theme={theme}
        onToggleTheme={onToggleTheme}
        onBrandClick={() => setMobileSection('index')}
      >
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
      </Topbar>

      <main id="top" className="workspace" data-mobile-section={mobileSection}>
        <aside className={`majlis-column ${owner ? 'has-owner' : ''}`}>
          {owner && (
            <OwnerPanel
              info={ownerInfo}
              busy={ownerBusy}
              publicLink={publicUrl(slug)}
              privateLink={ownerLink}
              onAddRounds={addRounds}
              onToggleClosed={toggleClosed}
            />
          )}

          <section className="sheet-card dedication-card corner-frame" aria-labelledby="majlis-heading">
            <span className="corner tl" aria-hidden="true" />
            <span className="corner tr" aria-hidden="true" />
            <span className="corner bl" aria-hidden="true" />
            <span className="corner br" aria-hidden="true" />

            <div className="card-header-rule">
              <div className="seal-row">
                <Logo size={26} compact />
                <span className="card-tag">{copy.verseTag}</span>
              </div>
              <span className="ayah-ref">البقرة · ١١٠</span>
            </div>

            <p className="quran-verse">
              ﴿ وَمَا تُقَدِّمُوا لِأَنْفُسِكُم مِّنْ خَيْرٍ تَجِدُوهُ عِندَ اللَّهِ ﴾
            </p>

            <Ornament className="verse-ornament" />

            <h1 id="majlis-heading" className="majlis-title">
              {copy.heading}
            </h1>
            <p className="majlis-desc">{copy.desc}</p>
            {group.message && (
              <blockquote className="group-message">
                <span className="group-message-label">رسالة صاحب المجلس</span>
                {group.message}
              </blockquote>
            )}

            <div className="progress-block" aria-label="نسبة تقدم الختمة">
              <div className="progress-header">
                <span>{progressLabel}</span>
                <strong>
                  {configured && ready
                    ? `${toAr(completedAll)} من ${toAr(totalParts)} جزءا (${toAr(completedPct)}٪)`
                    : '—'}
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
                  <i className="swatch done" /> مكتمل ({ready ? toAr(completedAll) : '—'})
                </span>
                <span>
                  <i className="swatch reading" /> قيد القراءة ({ready ? toAr(readingAll) : '—'})
                </span>
                <span>
                  <i className="swatch open" /> متاح ({ready ? toAr(openAll) : '—'})
                </span>
              </div>
              {rounds > 1 && ready && (
                <p className="rounds-line">
                  اكتملت {toAr(summary?.completed_rounds ?? 0)} من {toAr(rounds)} ختمات
                </p>
              )}
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
                  const isDone = statusOf(item) === 'done';
                  return (
                    <div
                      key={keyOf(item.round_no, item.part_number)}
                      className={`wird-row ${isDone ? 'is-done' : ''}`}
                    >
                      <div className="wird-info">
                        <div className="wird-part">
                          {rounds > 1 && <>الختمة {toAr(item.round_no)} · </>}
                          الجزء {toAr(item.part_number)} · <span>«{meta?.title}»</span>
                        </div>
                        <div className="wird-reader">باسم: {item.display_name}</div>
                      </div>
                      {isDone ? (
                        <span className="wird-done-badge">
                          <Check size={14} /> تمت القراءة
                        </span>
                      ) : (
                        <div className="wird-actions">
                          <a
                            className="ghost-btn compact"
                            href={quranUrl(item.part_number)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <BookOpen size={14} aria-hidden="true" />
                            اقرأ
                          </a>
                          <button
                            type="button"
                            className="primary-btn compact"
                            onClick={() => markComplete(item)}
                            disabled={busy}
                          >
                            {busy ? 'جار الحفظ...' : 'أتممت القراءة'}
                          </button>
                        </div>
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
              {copy.prayers.map((entry) => (
                <article key={entry.heading} className="dua-entry">
                  <h3>{entry.heading}</h3>
                  <p>{entry.body}</p>
                </article>
              ))}
            </div>

            <div className="adab-box">
              <h3>طريقة المشاركة</h3>
              <ol>
                {ADAB_STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>

            <footer className="majlis-footer">
              <Ornament className="footer-ornament" />
              <span>{copy.footerLine}</span>
              <small>مبادرة تطوعية مفتوحة · ليست جهة رسمية أو إفتائية</small>
              {!memorial && (
                <small className="legal-note">
                  أنشأ هذا المجلس أحد المستخدمين على منصة «أثر»، والمنصة لا تراجع محتواه مسبقا.
                </small>
              )}
              <Link to="/new" className="footer-cta">
                ابدأ ختمة لمن تحب
              </Link>
            </footer>
          </section>
        </aside>

        <section className="index-column" aria-labelledby="index-heading">
          <div className="mobile-summary-strip corner-frame">
            <span className="corner tl" aria-hidden="true" />
            <span className="corner tr" aria-hidden="true" />
            <span className="corner bl" aria-hidden="true" />
            <span className="corner br" aria-hidden="true" />

            <div className="mobile-summary-top">
              <div>
                <h1 className="mobile-headline">{copy.mobileHeading}</h1>
                <p className="mobile-subline">{copy.mobileSub}</p>
              </div>
              <strong className="mobile-pct">{configured && ready ? `${toAr(completedPct)}٪` : '—'}</strong>
            </div>
            <div className="progress-track">
              <span className="progress-fill done" style={{ width: `${completedPct}%` }} />
              <span className="progress-fill reading" style={{ width: `${readingPct}%` }} />
            </div>
            <div className="progress-legend compact">
              <span>
                <i className="swatch done" /> مكتمل {ready ? toAr(completedAll) : '—'}
              </span>
              <span>
                <i className="swatch reading" /> يُقرأ {ready ? toAr(readingAll) : '—'}
              </span>
              <span>
                <i className="swatch open" /> متاح {ready ? toAr(openAll) : '—'}
              </span>
            </div>

            {owner && (
              <div className="mobile-wird-banner">
                <div className="mobile-wird-text">أنت صاحب هذا المجلس</div>
                <button type="button" className="ghost-btn" onClick={() => setMobileSection('majlis')}>
                  لوحة الإدارة
                </button>
              </div>
            )}

            {pendingMine.length > 0 && !staleReminder && (
              <div className="mobile-wird-banner">
                <div className="mobile-wird-text">
                  لديك {pendingMine.length === 1 ? 'جزء قيد القراءة' : `${toAr(pendingMine.length)} أجزاء قيد القراءة`} على هذا الجهاز
                </div>
                <button
                  type="button"
                  className="primary-btn compact"
                  onClick={() => markComplete(firstPending)}
                  disabled={busy}
                >
                  {pendingMine.length === 1 ? `إتمام الجزء ${toAr(firstPending.part_number)}` : 'تأكيد الإتمام'}
                </button>
              </div>
            )}
          </div>

          {reservePanel}

          {staleReminder && (
            <div className="remind-banner" role="status">
              <div className="remind-text">
                <strong>
                  {staleReminder.days === 1
                    ? 'عندك جزء محجوز من أمس'
                    : `عندك جزء محجوز من ${toAr(staleReminder.days)} أيام`}
                </strong>
                <small>
                  الجزء {toAr(staleReminder.part_number)} باسم {staleReminder.display_name}. عشر دقائق تكفي،
                  ويسعد صاحب المجلس بإتمامه.
                </small>
              </div>
              <div className="remind-actions">
                <a
                  className="primary-btn compact"
                  href={quranUrl(staleReminder.part_number)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <BookOpen size={15} aria-hidden="true" />
                  اقرأه الآن
                </a>
                <button
                  type="button"
                  className="ghost-btn compact"
                  onClick={() => markComplete(staleReminder)}
                  disabled={busy}
                >
                  أتممت القراءة
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={dismissReminder}
                  aria-label="إخفاء التذكير"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}

          <div className="index-toolbar">
            <div className="index-heading-wrap">
              <h2 id="index-heading" className="index-heading">
                {rounds > 1 ? `فهرس أجزاء الختمة ${toAr(round)}` : 'فهرس الأجزاء الثلاثين'}
              </h2>
              <span className="sync-hint">{!ready ? 'جار التحديث...' : 'تحديث تلقائي'}</span>
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
                onClick={() => refreshAll({ fresh: true })}
                disabled={refreshing}
                aria-label="تحديث القائمة"
                title="تحديث القائمة"
              >
                <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
              </button>
            </div>
          </div>

          {showRoundNav && (
            <div className="round-nav" role="group" aria-label="اختيار الختمة">
              <button
                type="button"
                className="icon-btn"
                onClick={() => selectRound(round - 1)}
                disabled={round <= 1}
                aria-label="الختمة السابقة"
              >
                <ChevronRight size={17} />
              </button>
              <label className="round-select-wrap">
                <span className="sr-only">اختر الختمة</span>
                <select
                  className="round-select"
                  value={viewRound ?? round}
                  onChange={(e) => selectRound(e.target.value)}
                >
                  {Array.from({ length: rounds }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {`الختمة ${toAr(n)} — محجوز ${toAr(roundTaken(n))} من ${toAr(PARTS)}`}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="icon-btn"
                onClick={() => selectRound(round + 1)}
                disabled={round >= rounds}
                aria-label="الختمة التالية"
              >
                <ChevronLeft size={17} />
              </button>
            </div>
          )}

          {!configured && (
            <div className="banner-alert">الموقع في وضع المعاينة المحلية وغير متصل بقاعدة البيانات حاليا.</div>
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
                const isMine = myKeys.has(keyOf(round, juz.number));
                const state = !booking ? 'open' : booking.completed ? 'done' : 'reading';
                const manageable = state === 'reading' && Boolean(owner) && ready;
                const interactive = (state === 'open' && interactiveOpen) || manageable;

                return (
                  <button
                    key={juz.number}
                    type="button"
                    className={`juz-tile state-${state} ${isMine ? 'is-mine' : ''} ${manageable ? 'is-manageable' : ''}`}
                    onClick={() => openTile(juz)}
                    disabled={!interactive}
                    aria-label={`الجزء ${toAr(juz.number)} (${juz.title}) - ${
                      state === 'open'
                        ? closed
                          ? 'الحجز مغلق'
                          : 'متاح للحجز'
                        : state === 'done'
                          ? `تمت القراءة بواسطة ${booking.display_name}`
                          : `قيد القراءة بواسطة ${booking.display_name}${manageable ? ' - اضغط للتحرير' : ''}`
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
                          ? !ready
                            ? 'جار التحقق...'
                            : closed
                              ? 'الحجز مغلق'
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

          <aside className="start-cta" aria-label="ابدأ ختمة">
            <div>
              <strong>هل تريد ختمة صدقة جارية عن شخص تحبه؟</strong>
              <small>أنشئ مجلسك الخاص في دقيقة، وشارك رابطه مع أهلك وأصدقائك ليقرأ كلٌّ جزءه.</small>
            </div>
            <Link to="/new" className="primary-btn">
              <Plus size={15} aria-hidden="true" />
              ابدأ ختمة لمن تحب
            </Link>
          </aside>
        </section>
      </main>

      <nav className="mobile-bottom-nav" aria-label="التنقل السفلي">
        <button
          type="button"
          className={`nav-tab ${mobileSection === 'index' ? 'active' : ''}`}
          onClick={() => setMobileSection('index')}
        >
          <span>فهرس الأجزاء</span>
          <small>{ready ? `${toAr(openAll)} متاح` : '—'}</small>
        </button>
        <button
          type="button"
          className={`nav-tab ${mobileSection === 'majlis' ? 'active' : ''}`}
          onClick={() => setMobileSection('majlis')}
        >
          <span>{owner ? 'لوحة المجلس والورد' : 'وردك والدعاء'}</span>
          {pendingMine.length > 0 ? (
            <small className="nav-badge">{toAr(pendingMine.length)}</small>
          ) : (
            <small>{owner ? 'إدارة' : 'آداب ونية'}</small>
          )}
        </button>
        <button type="button" className="nav-tab" onClick={shareLink}>
          <span>{copied ? 'نُسخ الرابط' : 'دعوة مشارك'}</span>
          <small>{copied ? <Copy size={12} /> : 'مشاركة'}</small>
        </button>
      </nav>

      {dialog?.type === 'reserve' && (
        <ReserveDialog
          target={dialog}
          name={name}
          onNameChange={setName}
          busy={busy}
          notice={formNotice}
          onSubmit={submitReserve}
          onClose={closeDialog}
          rounds={rounds}
        />
      )}

      {dialog?.type === 'release' && (
        <ReleaseDialog
          target={{ ...dialog, rounds }}
          busy={busy}
          onConfirm={confirmRelease}
          onClose={closeDialog}
        />
      )}

      {dialog?.type === 'success' && (
        <ReserveSuccessDialog
          target={dialog}
          rounds={rounds}
          onCalendar={() => addReminderToCalendar(dialog)}
          onClose={closeDialog}
        />
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
