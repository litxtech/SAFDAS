export type DuaLocale = 'tr' | 'en' | 'ar' | 'es';

export type BundledDua = {
  slug: string;
  arabic: string;
  transliteration: string;
  source: string;
  audioUrl: string | null;
  sortOrder: number;
  translations: Record<DuaLocale, { title: string; meaning: string; source: string }>;
};

export const BUNDLED_DUAS: BundledDua[] = [
  {
    slug: 'morning',
    arabic: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ',
    transliteration: 'Asbahna wa asbahal-mulku lillah',
    source: 'Müslim',
    audioUrl: null,
    sortOrder: 1,
    translations: {
      tr: { title: 'Sabah duası', meaning: 'Allah’ın mülküyle sabaha erdik.', source: 'Müslim' },
      en: { title: 'Morning supplication', meaning: 'We have reached the morning and the dominion belongs to Allah.', source: 'Muslim' },
      ar: { title: 'دعاء الصباح', meaning: 'أصبحنا وأصبح الملك لله.', source: 'مسلم' },
      es: { title: 'Súplica de la mañana', meaning: 'Hemos amanecido y el dominio pertenece a Alá.', source: 'Muslim' },
    },
  },
  {
    slug: 'food',
    arabic: 'بِسْمِ اللَّهِ',
    transliteration: 'Bismillah',
    source: 'Buhârî, Müslim',
    audioUrl: null,
    sortOrder: 2,
    translations: {
      tr: { title: 'Yemek duası', meaning: 'Allah’ın adıyla.', source: 'Buhârî, Müslim' },
      en: { title: 'Before eating', meaning: 'In the name of Allah.', source: 'Bukhari, Muslim' },
      ar: { title: 'دعاء الطعام', meaning: 'باسم الله.', source: 'البخاري ومسلم' },
      es: { title: 'Antes de comer', meaning: 'En el nombre de Alá.', source: 'Bujari, Muslim' },
    },
  },
  {
    slug: 'protection',
    arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ',
    transliteration: "A'udhu bi kalimatillahit-tammati min sharri ma khalaq",
    source: 'Müslim',
    audioUrl: null,
    sortOrder: 3,
    translations: {
      tr: { title: 'Korunma duası', meaning: 'Yarattığı şeylerin şerrinden Allah’ın eksiksiz kelimelerine sığınırım.', source: 'Müslim' },
      en: { title: 'Seeking protection', meaning: 'I seek refuge in the perfect words of Allah from the evil of what He created.', source: 'Muslim' },
      ar: { title: 'دعاء الحفظ', meaning: 'أعوذ بكلمات الله التامات من شر ما خلق.', source: 'مسلم' },
      es: { title: 'Súplica de protección', meaning: 'Me refugio en las palabras perfectas de Alá del mal de lo que ha creado.', source: 'Muslim' },
    },
  },
  {
    slug: 'kursi',
    arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ',
    transliteration: 'Allahu la ilaha illa huwal-hayyul-qayyum',
    source: "Kur'an 2:255",
    audioUrl: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/262.mp3',
    sortOrder: 4,
    translations: {
      tr: { title: 'Ayetel Kürsi', meaning: 'Allah, O’ndan başka ilah olmayandır. Diridir, kayyumdur.', source: "Kur'an 2:255" },
      en: { title: 'Ayat al-Kursi', meaning: 'Allah — there is no god except Him, the Ever-Living, the Sustainer of all.', source: "Qur'an 2:255" },
      ar: { title: 'آية الكرسي', meaning: 'الله لا إله إلا هو الحي القيوم.', source: 'القرآن ٢:٢٥٥' },
      es: { title: 'Ayat al-Kursi', meaning: 'Alá: no hay divinidad sino Él, el Viviente, el Sustentador.', source: 'Corán 2:255' },
    },
  },
  {
    slug: 'istighfar',
    arabic: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ',
    transliteration: 'Allahumma anta rabbi la ilaha illa ant',
    source: 'Buhârî',
    audioUrl: null,
    sortOrder: 5,
    translations: {
      tr: { title: 'Seyyidü’l-istiğfar', meaning: 'Allah’ım, sen benim Rabbimsin. Senden başka ilah yoktur.', source: 'Buhârî' },
      en: { title: 'Best prayer for forgiveness', meaning: 'O Allah, You are my Lord. There is no god but You.', source: 'Bukhari' },
      ar: { title: 'سيد الاستغفار', meaning: 'اللهم أنت ربي لا إله إلا أنت.', source: 'البخاري' },
      es: { title: 'La mejor súplica de perdón', meaning: 'Oh Alá, Tú eres mi Señor. No hay divinidad sino Tú.', source: 'Bujari' },
    },
  },
  {
    slug: 'travel',
    arabic: 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَٰذَا',
    transliteration: 'Subhanalladhi sakhkhara lana hadha',
    source: 'Müslim',
    audioUrl: null,
    sortOrder: 6,
    translations: {
      tr: { title: 'Yolculuk duası', meaning: 'Bunu bizim hizmetimize veren Allah’ı tenzih ederim.', source: 'Müslim' },
      en: { title: 'Travel supplication', meaning: 'Glory be to the One who has subjected this to us.', source: 'Muslim' },
      ar: { title: 'دعاء السفر', meaning: 'سبحان الذي سخر لنا هذا.', source: 'مسلم' },
      es: { title: 'Súplica de viaje', meaning: 'Gloria a quien ha puesto esto a nuestro servicio.', source: 'Muslim' },
    },
  },
];
