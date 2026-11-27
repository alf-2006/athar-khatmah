import React from 'react';

/*
  شعار «أثر» — Ripple of Beads
  30 خرزة = 30 جزءًا من الختمة، والخرزة الذهبية الأكبر هي «الإمام» في المسبحة.
  حلقتان متحدتا المركز = أثرٌ يمتد ولا ينقطع، والمعين الذهبي يردد زخرفة الموقع.
  المصدر الهندسي: brand/tools/build_brand.py (نفس الإحداثيات).
*/

const polar = (count, radius) =>
  Array.from({ length: count }, (_, i) => {
    const a = ((-90 + (i * 360) / count) * Math.PI) / 180;
    return { x: +(100 + radius * Math.cos(a)).toFixed(2), y: +(100 + radius * Math.sin(a)).toFixed(2) };
  });

const BEADS_FULL = polar(30, 88);
const BEADS_COMPACT = polar(12, 86);

const DIAMOND_FULL = 'M100 68L132 100L100 132L68 100ZM100 88L88 100L100 112L112 100Z';
const DIAMOND_COMPACT = 'M100 62L138 100L100 138L62 100Z';

/**
 * variant: 'auto' يتبع الوضع (فاتح/داكن) — 'reversed' للخلفيات الخضراء الداكنة.
 * compact: نسخة مبسّطة (12 خرزة) تظل واضحة بأحجام أقل من 64px.
 */
export default function Logo({ variant = 'auto', size = 48, compact = false, title, className = '' }) {
  const beads = compact ? BEADS_COMPACT : BEADS_FULL;
  const labelled = Boolean(title);
  return (
    <svg
      className={`logo logo--${variant} ${className}`.trim()}
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role={labelled ? 'img' : undefined}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
    >
      {beads.map((b, i) => (
        <circle
          key={i}
          cx={b.x}
          cy={b.y}
          r={compact ? (i === 0 ? 10 : 7) : i === 0 ? 5.8 : 4.2}
          className={i === 0 ? 'logo-gold' : 'logo-ink'}
        />
      ))}
      <circle cx="100" cy="100" r={compact ? 66 : 70} className="logo-ring" style={compact ? { strokeWidth: 5 } : undefined} />
      {!compact && <circle cx="100" cy="100" r="54" className="logo-ring logo-ring--inner" />}
      <path className="logo-gold" fillRule="evenodd" d={compact ? DIAMOND_COMPACT : DIAMOND_FULL} />
    </svg>
  );
}

/** فاصل زخرفي: خط — معين — خط (يغني عن أيقونة الكتاب في الهيرو). */
export function Ornament({ className = '' }) {
  return (
    <div className={`ornament ${className}`.trim()} aria-hidden="true">
      <span></span>
      <i className="diamond"></i>
      <span></span>
    </div>
  );
}
