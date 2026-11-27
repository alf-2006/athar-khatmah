import React, { useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { Check, Copy, QrCode } from 'lucide-react';
import { copyText } from '../lib/client.js';

/** كود QR للرابط العام، مفيد في الجلسات حين يمسحه الحاضرون بدل تداول اللينك. */
export default function QrPanel({ url, title, caption = 'امسح الكود بهاتفك للانضمام إلى المجلس.' }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const svg = useMemo(() => {
    if (!open) return '';
    try {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    } catch {
      return '';
    }
  }, [open, url]);

  async function copy() {
    if (await copyText(url)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <div className="qr-block">
      <button
        type="button"
        className="ghost-btn qr-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <QrCode size={15} />
        <span>{open ? 'إخفاء رمز QR' : 'رمز QR للمجلس'}</span>
      </button>

      {open && (
        <div className="qr-card" aria-live="polite">
          <div className="qr-frame" dangerouslySetInnerHTML={{ __html: svg }} />
          {title && <p className="qr-title">{title}</p>}
          <p className="qr-caption">{caption}</p>
          <button type="button" className="ghost-btn" onClick={copy}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
            <span>{copied ? 'نُسخ الرابط' : 'نسخ الرابط'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
