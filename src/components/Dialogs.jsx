import React from 'react';
import { BookOpen, CalendarPlus, X } from 'lucide-react';
import { JUZ_META, toAr } from '../lib/juz.js';
import { quranUrl } from '../lib/quran.js';

function Frame({ labelId, onClose, busy, children }) {
  return (
    <div
      className="sheet-backdrop"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="reserve-sheet corner-frame"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}

function CloseButton({ onClose }) {
  return (
    <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق النافذة">
      <X size={17} />
    </button>
  );
}

export function ReserveDialog({ target, name, onNameChange, busy, notice, onSubmit, onClose, rounds }) {
  const auto = target.auto;
  const juz = target.juz;
  return (
    <Frame labelId="reserve-dialog-title" onClose={onClose} busy={busy}>
      <div className="reserve-sheet-head">
        <div>
          <span className="card-tag">توثيق مشاركة في الختمة</span>
          <h2 id="reserve-dialog-title">
            {auto ? (
              'احجز لي جزءا'
            ) : (
              <>
                الجزء {toAr(juz.number)} · «{juz.title}»
              </>
            )}
          </h2>
          <p className="sheet-surah-note">
            {auto
              ? 'سيُخصَّص لك أول جزء متاح في المجلس.'
              : `نطاق السور: ${juz.surahs}${rounds > 1 ? ` · الختمة ${toAr(target.round)}` : ''}`}
          </p>
        </div>
        <CloseButton onClose={onClose} />
      </div>

      <form onSubmit={onSubmit} className="reserve-form">
        <label htmlFor="reader-name">الاسم الظاهر في سجل الختمة</label>
        <input
          id="reader-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={40}
          placeholder="مثال: أحمد، أم محمد، فاعل خير"
          autoFocus
          required
        />
        <small className="field-hint">يُكتفى بالاسم الأول أو الكنية. لا تدخل رقم هاتف أو بيانات خاصة.</small>

        {notice && (
          <div className="form-alert" role="alert">
            {notice}
          </div>
        )}

        <div className="sheet-actions">
          <button type="submit" className="primary-btn full" disabled={busy}>
            {busy ? 'جار تسجيل الجزء...' : auto ? 'تأكيد الحجز' : `تأكيد حجز الجزء ${toAr(juz.number)}`}
          </button>
        </div>
      </form>
    </Frame>
  );
}

export function ReleaseDialog({ target, busy, onConfirm, onClose }) {
  return (
    <Frame labelId="release-dialog-title" onClose={onClose} busy={busy}>
      <div className="reserve-sheet-head">
        <div>
          <span className="card-tag">إدارة المجلس</span>
          <h2 id="release-dialog-title">
            تحرير الجزء {toAr(target.juz.number)} · «{target.juz.title}»
          </h2>
          <p className="sheet-surah-note">
            محجوز باسم: {target.booking.display_name}
            {target.rounds > 1 ? ` · الختمة ${toAr(target.round)}` : ''}
          </p>
        </div>
        <CloseButton onClose={onClose} />
      </div>
      <p className="release-text">
        تحرير الجزء يعيده متاحا لغيره، وتزول قراءته عن صاحب الاسم الحالي. استخدمه إن غاب القارئ أو لم يناسبك الاسم المكتوب.
      </p>
      <div className="sheet-actions release-actions">
        <button type="button" className="primary-btn full" onClick={onConfirm} disabled={busy}>
          {busy ? 'جار التحرير...' : 'تحرير الجزء'}
        </button>
        <button type="button" className="ghost-btn full-ghost" onClick={onClose} disabled={busy}>
          إلغاء
        </button>
      </div>
    </Frame>
  );
}

export function ReserveSuccessDialog({ target, rounds, onCalendar, onClose }) {
  const part = target.part_number;
  const juz = JUZ_META[part - 1];
  return (
    <Frame labelId="success-dialog-title" onClose={onClose} busy={false}>
      <div className="reserve-sheet-head">
        <div>
          <span className="card-tag">تم توثيق المشاركة</span>
          <h2 id="success-dialog-title">الجزء {toAr(part)} باسم {target.display_name}</h2>
          <p className="sheet-surah-note">
            «{juz?.title}» · {juz?.surahs}
            {rounds > 1 ? ` · الختمة ${toAr(target.round_no)}` : ''}
          </p>
        </div>
        <CloseButton onClose={onClose} />
      </div>

      <p className="success-note">
        اقرأ الجزء في وقت يناسبك، وعد إلى هذا الجهاز واضغط «أتممت القراءة» ليُحتسب في الختمة.
      </p>

      <div className="success-actions">
        <a className="primary-btn full" href={quranUrl(part)} target="_blank" rel="noreferrer">
          <BookOpen size={16} aria-hidden="true" />
          اقرأ الجزء الآن
        </a>
        <button type="button" className="ghost-btn full-ghost" onClick={onCalendar}>
          <CalendarPlus size={16} aria-hidden="true" />
          أضف تذكيراً للتقويم
        </button>
        <button type="button" className="ghost-btn full-ghost" onClick={onClose}>
          تم، سأقرأه لاحقاً
        </button>
      </div>
    </Frame>
  );
}
