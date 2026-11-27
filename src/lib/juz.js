export const PARTS = 30;

export const JUZ_META = [
  { number: 1, title: 'الم', surahs: 'الفاتحة - البقرة' },
  { number: 2, title: 'سيقول', surahs: 'البقرة' },
  { number: 3, title: 'تلك الرسل', surahs: 'البقرة - آل عمران' },
  { number: 4, title: 'لن تنالوا', surahs: 'آل عمران - النساء' },
  { number: 5, title: 'والمحصنات', surahs: 'النساء' },
  { number: 6, title: 'لا يحب الله', surahs: 'النساء - المائدة' },
  { number: 7, title: 'وإذا سمعوا', surahs: 'المائدة - الأنعام' },
  { number: 8, title: 'ولو أننا', surahs: 'الأنعام - الأعراف' },
  { number: 9, title: 'قال الملأ', surahs: 'الأعراف - الأنفال' },
  { number: 10, title: 'واعلموا', surahs: 'الأنفال - التوبة' },
  { number: 11, title: 'يعتذرون', surahs: 'التوبة - هود' },
  { number: 12, title: 'وما من دابة', surahs: 'هود - يوسف' },
  { number: 13, title: 'وما أبرئ', surahs: 'يوسف - إبراهيم' },
  { number: 14, title: 'ربما', surahs: 'الحجر - النحل' },
  { number: 15, title: 'سبحان الذي', surahs: 'الإسراء - الكهف' },
  { number: 16, title: 'قال ألم', surahs: 'الكهف - طه' },
  { number: 17, title: 'اقترب للناس', surahs: 'الأنبياء - الحج' },
  { number: 18, title: 'قد أفلح', surahs: 'المؤمنون - الفرقان' },
  { number: 19, title: 'وقال الذين', surahs: 'الفرقان - النمل' },
  { number: 20, title: 'أمن خلق', surahs: 'النمل - العنكبوت' },
  { number: 21, title: 'اتل ما أوحي', surahs: 'العنكبوت - الأحزاب' },
  { number: 22, title: 'ومن يقنت', surahs: 'الأحزاب - يس' },
  { number: 23, title: 'وما لي', surahs: 'يس - الزمر' },
  { number: 24, title: 'فمن أظلم', surahs: 'الزمر - فصلت' },
  { number: 25, title: 'إليه يرد', surahs: 'فصلت - الجاثية' },
  { number: 26, title: 'حم', surahs: 'الأحقاف - الذاريات' },
  { number: 27, title: 'قال فما خطبكم', surahs: 'الذاريات - الحديد' },
  { number: 28, title: 'قد سمع الله', surahs: 'المجادلة - التحريم' },
  { number: 29, title: 'تبارك الذي', surahs: 'الملك - المرسلات' },
  { number: 30, title: 'عمّ يتساءلون', surahs: 'النبأ - الناس' }
];

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toAr(value) {
  return String(value).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);
}
