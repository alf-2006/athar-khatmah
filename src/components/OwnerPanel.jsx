import React, { useState } from 'react';
import { Check, Copy, Lock, LockOpen } from 'lucide-react';
import { toAr } from '../lib/juz.js';
import { copyText } from '../lib/client.js';

const MAX_ROUNDS = 100;

export default function OwnerPanel({ info, busy, publicLink, privateLink, onAddRounds, onToggleClosed }) {
  const [count, setCount] = useState('1');
  const [copied, setCopied] = useState('');

  const rounds = info?.rounds ?? 1;
  const room = MAX_ROUNDS - rounds;
  const waiting = info?.waiting ?? 0;
  const suggested = waiting > 0 ? Math.min(Math.ceil(waiting / 30), Math.max(room, 1)) : 0;
  const parsed = Number.parseInt(count, 10);
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= room;

  async function copy(kind, text) {
    if (await copyText(text)) {
      setCopied(kind);
      window.setTimeout(() => setCopied(''), 1800);
    }
  }

  function submit(event) {
    event.preventDefault();
    if (valid && !busy) onAddRounds(parsed);
  }

  return (
    <section className="sheet-card owner-card" aria-labelledby="owner-heading">
      <div className="card-header-rule">
        <h2 id="owner-heading" className="panel-heading">
          لوحة صاحب المجلس
        </h2>
        <span className="card-tag">خاصة بك</span>
      </div>

      {info ? (
        <dl className="owner-stats">
          <div>
            <dt>الختمات المفتوحة</dt>
            <dd>{toAr(info.rounds)}</dd>
          </div>
          <div>
            <dt>الأجزاء المحجوزة</dt>
            <dd>
              {toAr(info.taken)} / {toAr(info.total_parts)}
            </dd>
          </div>
          <div>
            <dt>الأجزاء المكتملة</dt>
            <dd>{toAr(info.completed)}</dd>
          </div>
          <div>
            <dt>ينتظرون مكانا</dt>
            <dd>{toAr(waiting)}</dd>
          </div>
        </dl>
      ) : (
        <p className="owner-note">جار تحميل أرقام المجلس...</p>
      )}

      {waiting > 0 && room > 0 && (
        <p className="owner-note">
          سجّل {toAr(waiting)} مشاركا رغبتهم في الانضمام. يكفيهم فتح {toAr(suggested)}{' '}
          {suggested === 1 ? 'ختمة إضافية' : 'ختمات إضافية'}.
        </p>
      )}

      {room > 0 ? (
        <form className="owner-add reserve-form" onSubmit={submit}>
          <label htmlFor="add-rounds">افتح ختمات إضافية</label>
          <div className="owner-add-row">
            <input
              id="add-rounds"
              type="number"
              inputMode="numeric"
              min={1}
              max={room}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              aria-describedby="add-rounds-hint"
            />
            <button type="submit" className="primary-btn" disabled={!valid || busy}>
              {valid ? `افتح ${toAr(parsed)} ${parsed === 1 ? 'ختمة' : 'ختمات'}` : 'افتح'}
            </button>
          </div>
          <small id="add-rounds-hint" className="field-hint">
            كل ختمة ٣٠ جزءا. يمكنك فتح حتى {toAr(room)} ختمة أخرى (الحد الأقصى ١٠٠).
          </small>
        </form>
      ) : (
        <p className="owner-note">وصل المجلس إلى الحد الأقصى: ١٠٠ ختمة.</p>
      )}

      <div className="owner-actions">
        <button type="button" className="ghost-btn" onClick={onToggleClosed} disabled={busy || !info}>
          {info?.closed ? <LockOpen size={15} /> : <Lock size={15} />}
          <span>{info?.closed ? 'إعادة فتح الحجز' : 'إغلاق الحجز'}</span>
        </button>
      </div>

      <div className="owner-links">
        <button type="button" className="ghost-btn" onClick={() => copy('public', publicLink)}>
          {copied === 'public' ? <Check size={15} /> : <Copy size={15} />}
          <span>{copied === 'public' ? 'نُسخ' : 'نسخ رابط المشاركة'}</span>
        </button>
        <button type="button" className="ghost-btn" onClick={() => copy('private', privateLink)}>
          {copied === 'private' ? <Check size={15} /> : <Copy size={15} />}
          <span>{copied === 'private' ? 'نُسخ' : 'نسخ رابط الإدارة'}</span>
        </button>
      </div>
      <p className="owner-note subtle">
        رابط الإدارة خاص بك وحدك؛ احفظه لتدير المجلس من أي جهاز. اضغط على أي جزء قيد القراءة في الفهرس لتحريره عند الحاجة.
      </p>
    </section>
  );
}
