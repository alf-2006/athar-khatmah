/* تذكير تقويم محلي: يُنزَّل ملف .ics يفتحه تقويم الهاتف أو الحاسوب مباشرة، دون أي حساب أو سيرفر. */

const encoder = new TextEncoder();

function pad(n) {
  return String(n).padStart(2, '0');
}

function dateStamp(date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function utcStamp(date) {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function escapeText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** ثني الأسطر عند ٧٥ بايتا كما يفرض المعيار، دون قطع أي حرف عربي في منتصفه. */
function foldLine(line) {
  if (encoder.encode(line).length <= 75) return line;
  const parts = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 74) {
      parts.push(current);
      current = ` ${char}`;
      bytes = 1 + size;
    } else {
      current += char;
      bytes += size;
    }
  }
  parts.push(current);
  return parts.join('\r\n');
}

/**
 * ينشئ ملف تقويم بحدث يومي كامل لقراءة جزء.
 * @param {{title: string, description?: string, url?: string, date?: Date}} options
 */
export function buildIcs({ title, description = '', url = '', date = new Date() }) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const uid = `athar-${start.getTime()}-${Math.random().toString(36).slice(2, 10)}@athar-khatmah`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Athar//Khatmah//AR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART;VALUE=DATE:${dateStamp(start)}`,
    `DTEND;VALUE=DATE:${dateStamp(end)}`,
    `SUMMARY:${escapeText(title)}`,
    description ? `DESCRIPTION:${escapeText(description)}` : null,
    url ? `URL:${escapeText(url)}` : null,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean);

  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** ينزّل ملف التقويم على الجهاز باسم مفهوم. */
export function downloadIcs(options, filename = 'athar-reminder.ics') {
  try {
    const blob = new Blob([buildIcs(options)], { type: 'text/calendar;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(href), 4000);
    return true;
  } catch {
    return false;
  }
}
