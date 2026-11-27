/* روابط القراءة المباشرة: يفتح المشارك الجزء كاملا على quran.com دون بحث. */
export function quranUrl(part) {
  const n = Number(part);
  return Number.isInteger(n) && n >= 1 && n <= 30 ? `https://quran.com/juz/${n}` : 'https://quran.com/';
}
