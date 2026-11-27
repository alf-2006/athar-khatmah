import { ensureSchema } from './_db.js';
import { MEMORIAL_SLUG, findGroup, isSlug } from './_util.js';

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const PRONOUN = { deceased_m: 'له', deceased_f: 'لها', deceased_p: 'لهم' };

function previewFor(group) {
  if (!group) {
    return {
      title: 'أثر | مجلس ختمة قرآنية جماعية',
      description: 'ختمة قرآنية جماعية: احجز جزءك واقرأ في وقتك وأهدِ الثواب صدقةً جارية.',
    };
  }
  if (group.kind === 'martyrs') {
    return {
      title: 'أثر | مجلس ختمة قرآنية جماعية',
      description:
        'شارك في مجلس الختمة القرآنية الجماعية «أثر»؛ احجز جزءك واقرأ في وقتك وادعُ لشهداء الحادث بالرحمة والمغفرة.',
    };
  }
  const pronoun = PRONOUN[group.kind];
  if (pronoun) {
    return {
      title: `ختمة قرآنية عن روح ${group.title}`,
      description: `شارك بجزء من الختمة صدقةً جاريةً عن ${group.title}: احجز جزءك، واقرأ في وقتك، وادعُ ${pronoun} بالرحمة والمغفرة.`,
    };
  }
  return {
    title: `ختمة قرآنية: ${group.title}`,
    description: group.message || 'شارك بجزء من هذه الختمة الجماعية: احجز جزءك، واقرأ في وقتك، وأهدِ الثواب.',
  };
}

/** يُستدعى فقط لزواحف المعاينة (واتساب/فيسبوك/إكس/تيليجرام…) عبر rewrite في vercel.json. */
export default async function handler(req, res) {
  const slug = String(req.query?.slug || MEMORIAL_SLUG).toLowerCase();
  let group = null;
  if (isSlug(slug)) {
    try {
      const pool = await ensureSchema();
      group = await findGroup(pool, slug);
    } catch (error) {
      console.error('og_lookup_failed', error);
    }
  }
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'athar-khatmah.vercel.app';
  const origin = `https://${host}`;
  const url = group ? `${origin}/k/${group.slug}` : origin;
  const { title, description } = previewFor(group);

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta name="robots" content="noindex, nofollow" />
<link rel="canonical" href="${esc(url)}" />
<meta property="og:type" content="website" />
<meta property="og:locale" content="ar_EG" />
<meta property="og:site_name" content="أثر" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${esc(origin)}/og-image.png" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(origin)}/og-image.png" />
</head>
<body>
<h1>${esc(title)}</h1>
<p>${esc(description)}</p>
<p><a href="${esc(url)}">فتح الختمة</a></p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return res.status(group || !isSlug(slug) ? 200 : 404).send(html);
}
