import { useCallback } from 'react';
import { useI18nStore, type Locale } from './index';

/**
 * Copy for the live-dua + life-stories surfaces. Kept separate from the core
 * catalog so the two features stay self-contained; Spanish/Arabic fall back to
 * English where a translation is not yet provided.
 */
const featureCopy = {
  liveDuaTitle: {
    tr: 'Aynı Duada Buluşanlar',
    en: 'Meeting in the Same Dua',
    ar: 'لقاء في الدعاء نفسه',
    es: 'Encuentro en la misma súplica',
  },
  liveDuaIntro: {
    tr: 'Bu içeriği seninle birlikte dinleyenleri keşfet.',
    en: 'Discover the people listening to this with you.',
    ar: 'اكتشف من يستمع إلى هذا المحتوى معك.',
    es: 'Descubre a quienes escuchan esto contigo.',
  },
  liveDuaEnable: {
    tr: 'Aynı Duada Buluş',
    en: 'Join the same dua',
    ar: 'انضم إلى الدعاء نفسه',
    es: 'Únete a la misma súplica',
  },
  liveDuaEnableHint: {
    tr: 'Seninle aynı anda aynı sureyi veya duayı dinleyen kişilerle tanışabilirsin.',
    en: 'Meet people listening to the same surah or dua at the same time.',
  },
  liveDuaListening: {
    tr: 'Şu anda {count} kişi dinliyor',
    en: '{count} people listening now',
  },
  liveDuaConnecting: { tr: 'Bağlanıyor…', en: 'Connecting…' },
  liveDuaOffline: { tr: 'Canlı bağlantı kurulamadı', en: 'Live connection unavailable' },
  liveDuaPaused: {
    tr: 'Ses duraklatıldı. Devam ettiğinde tekrar görünürsün.',
    en: 'Playback paused. You will be visible again when you resume.',
  },
  liveDuaOff: {
    tr: 'Canlı eşleşme kapalı. Açtığında bu içeriği birlikte dinleyenleri görebilirsin.',
    en: 'Live matching is off. Turn it on to see who is listening with you.',
  },
  liveDuaSee: { tr: 'Katılımcıları gör', en: 'See listeners' },
  liveDuaSettings: { tr: 'Canlı eşleşme ayarları', en: 'Live matching settings' },
  liveDuaShareCity: { tr: 'Şehrimi paylaş', en: 'Share my city' },
  liveDuaAllowContact: { tr: 'İletişim isteklerine açık ol', en: 'Open to contact requests' },
  liveDuaAllowRooms: { tr: 'Ortak dinleme odalarına katıl', en: 'Join shared listening rooms' },
  liveDuaRequests: { tr: 'İstekler', en: 'Requests' },
  liveDuaIncoming: { tr: 'Gelen istekler', en: 'Incoming requests' },
  liveDuaOutgoing: { tr: 'Giden istekler', en: 'Sent requests' },
  liveDuaConnections: { tr: 'Bağlantılar', en: 'Connections' },
  liveDuaNoRequests: { tr: 'Bekleyen istek yok.', en: 'No pending requests.' },
  liveDuaAccept: { tr: 'Kabul Et', en: 'Accept' },
  liveDuaDecline: { tr: 'Reddet', en: 'Decline' },
  liveDuaBlock: { tr: 'Engelle', en: 'Block' },
  liveDuaOpenChat: { tr: 'Sohbeti aç', en: 'Open chat' },
  liveDuaContact: { tr: 'İletişim', en: 'Contact' },
  liveDuaSendRequest: { tr: 'İletişim isteği gönder', en: 'Send contact request' },
  liveDuaRequestSent: { tr: 'İletişim isteği gönderildi.', en: 'Contact request sent.' },
  liveDuaDefaultMessage: {
    tr: 'Merhaba, aynı duada buluştuk. İstersen birbirimizin hikâyesini dinleyebiliriz.',
    en: 'Hello, we met in the same dua. If you like, we can listen to each other’s story.',
  },
  liveDuaAltMessage: {
    tr: 'Bugün seni bu sureye getiren neydi?',
    en: 'What brought you to this surah today?',
  },
  liveDuaListenTogether: { tr: 'Birlikte dinle', en: 'Listen together' },
  liveDuaRooms: { tr: 'Ortak dinleme odaları', en: 'Shared listening rooms' },
  liveDuaCreateRoom: { tr: 'Oda aç', en: 'Create room' },
  liveDuaJoinRoom: { tr: 'Katıl', en: 'Join' },
  liveDuaNoRooms: { tr: 'Bu içerik için açılmış oda yok.', en: 'No room is open for this content.' },
  liveDuaRoomRules: {
    tr: 'Bu oda saygılı paylaşım ve manevi destek içindir. Kişisel bilgilerini paylaşma.',
    en: 'This room is for respectful sharing and spiritual support. Do not share personal information.',
  },
  liveDuaMessage: { tr: 'Bir mesaj yaz', en: 'Write a message' },
  liveDuaSend: { tr: 'Gönder', en: 'Send' },
  liveDuaHost: { tr: 'Oda sahibi', en: 'Host' },
  liveDuaLeave: { tr: 'Odadan ayrıl', en: 'Leave room' },
  liveDuaEnd: { tr: 'Odayı kapat', en: 'End room' },
  liveDuaSync: { tr: 'Oynatmayı eşitle', en: 'Sync playback' },
  liveDuaRoomClosed: { tr: 'Oda kapandı.', en: 'This room has ended.' },
  liveDuaReport: { tr: 'Mesajı bildir', en: 'Report message' },
  liveDuaReported: { tr: 'Bildirildi.', en: 'Reported.' },
  liveDuaProfile: { tr: 'Profili gör', en: 'View profile' },
  liveDuaListener: { tr: 'Dinliyor', en: 'Listening' },
  liveDuaNoParticipants: {
    tr: 'Şu anda görünür başka bir dinleyici yok.',
    en: 'No other visible listener right now.',
  },
  liveDuaMoreListeners: {
    tr: 've {count} kişi daha dinliyor',
    en: 'and {count} more listening',
  },
  liveDuaLoadFailed: { tr: 'Canlı eşleşme yüklenemedi.', en: 'Live matching could not be loaded.' },
  liveDuaPrivacyNote: {
    tr: 'Canlı eşleşme yalnızca açıkken ve ses oynarken görünür. Dinleme geçmişi, konum veya sürekli çevrimiçi bilgisi paylaşılmaz.',
    en: 'Live matching is visible only while it is on and audio is playing. Listening history, location and constant online status are never shared.',
  },
  liveDuaBlockConfirm: {
    tr: 'Bu kişiyi engelleyip isteği kaldırmak istiyor musun?',
    en: 'Block this person and remove the request?',
  },
  liveDuaPending: { tr: 'Beklemede', en: 'Pending' },
  liveDuaAccepted: { tr: 'Kabul edildi', en: 'Accepted' },
  liveDuaDeclined: { tr: 'Reddedildi', en: 'Declined' },
  liveDuaBlocked: { tr: 'Engellendi', en: 'Blocked' },
  liveDuaParticipants: { tr: 'Katılımcılar', en: 'Participants' },
  liveDuaRoomSyncHint: {
    tr: 'Oynatmayı oda sahibi yönetir. Eşitlediğinde aynı yerden devam edersin.',
    en: 'The host controls playback. When you sync, you continue from the same point.',
  },
  liveDuaStartPlayback: { tr: 'Oynatmayı başlat', en: 'Start playback' },
  liveDuaLoadOlder: { tr: 'Eski mesajları yükle', en: 'Load older messages' },
  liveDuaLeaveConfirm: {
    tr: 'Odadan ayrılmak istiyor musun?',
    en: 'Leave this room?',
  },
  liveDuaLeaveHostConfirm: {
    tr: 'Odayı kapatmak istiyor musun? Diğer katılımcılar için de kapanır.',
    en: 'End this room? It will close for everyone.',
  },
  liveDuaMessageFailed: { tr: 'Mesaj gönderilemedi.', en: 'Message could not be sent.' },

  storiesTitle: { tr: 'Hayat Hikâyeleri', en: 'Life Stories', ar: 'قصص الحياة', es: 'Historias de vida' },
  storiesTagline: {
    tr: 'Her hayatın anlatacak bir hikâyesi vardır.',
    en: 'Every life has a story to tell.',
    ar: 'لكل حياة قصة تُروى.',
    es: 'Cada vida tiene una historia que contar.',
  },
  storiesForYou: { tr: 'Sana Özel', en: 'For you', ar: 'لك', es: 'Para ti' },
  storiesNew: { tr: 'Yeni Hikâyeler', en: 'New stories', ar: 'قصص جديدة', es: 'Nuevas' },
  storiesCategories: { tr: 'Kategoriler', en: 'Categories', ar: 'الفئات', es: 'Categorías' },
  storiesSaved: { tr: 'Kaydettiklerim', en: 'Saved', ar: 'المحفوظة', es: 'Guardadas' },
  storiesWrite: { tr: 'Hikâye Yaz', en: 'Write a story', ar: 'اكتب قصة', es: 'Escribir' },
  storiesMine: { tr: 'Hikâyelerim', en: 'My stories' },
  storiesRead: { tr: 'dk okuma', en: 'min read' },
  storiesEmpty: { tr: 'Burada henüz bir hikâye yok.', en: 'No stories here yet.' },
  storiesListen: { tr: 'Hikâyeyi Dinle', en: 'Listen to the story' },
  storiesPause: { tr: 'Duraklat', en: 'Pause' },
  storiesResume: { tr: 'Devam Et', en: 'Resume' },
  storiesStop: { tr: 'Durdur', en: 'Stop' },
  storiesSupport: { tr: 'Senin İçin Dua Ediyorum', en: 'I am praying for you' },
  storiesSupported: { tr: 'Dua ettin', en: 'You prayed' },
  storiesSupportCount: { tr: '{count} dua', en: '{count} prayers' },
  storiesComments: { tr: 'Yorumlar', en: 'Comments' },
  storiesSave: { tr: 'Kaydet', en: 'Save' },
  storiesSavedAction: { tr: 'Kaydedildi', en: 'Saved' },
  storiesShare: { tr: 'Paylaş', en: 'Share' },
  storiesReport: { tr: 'Şikâyet Et', en: 'Report' },
  storiesContact: { tr: 'İletişim İsteği', en: 'Contact request' },
  storiesContactClosed: {
    tr: 'Yazar özel iletişime kapalı.',
    en: 'The author is not open to private contact.',
  },
  storiesPseudonymousContact: {
    tr: 'Takma adla paylaşılan hikâyelerde özel iletişim kapalıdır.',
    en: 'Private contact is unavailable for pseudonymous stories.',
  },
  storiesProfileShare: { tr: 'Profilimle Paylaş', en: 'Share with my profile' },
  storiesPseudonymousShare: { tr: 'Takma Adla Paylaş', en: 'Share pseudonymously' },
  storiesPseudonymousHint: {
    tr: 'Hikâye profil kimliğin gösterilmeden yayınlanır. Moderasyon için hesap ilişkisi güvenli şekilde saklanır.',
    en: 'Your story is published without your profile identity. The account link is kept securely for moderation.',
  },
  storiesPublish: { tr: 'Yayınla', en: 'Publish' },
  storiesDraft: { tr: 'Taslak Kaydet', en: 'Save draft' },
  storiesDraftConfirm: {
    tr: 'Hikâyen taslak olarak kaydedilsin mi? Daha sonra "Hikâyelerim" ekranından devam edebilirsin.',
    en: 'Save your story as a draft? You can continue later from "My stories".',
  },
  storiesEdit: { tr: 'Düzenle', en: 'Edit' },
  storiesDelete: { tr: 'Sil', en: 'Delete' },
  storiesDeleteConfirm: { tr: 'Bu hikâye kalıcı olarak silinsin mi?', en: 'Delete this story permanently?' },
  storiesTitleLabel: { tr: 'Hikâye başlığı', en: 'Story title' },
  storiesBodyLabel: { tr: 'Hikâyen', en: 'Your story' },
  storiesCategoryLabel: { tr: 'Kategori', en: 'Category' },
  storiesCover: { tr: 'Kapak görseli', en: 'Cover image' },
  storiesLink: { tr: 'Dua veya sure ekle', en: 'Add a dua or surah' },
  storiesLinkRemove: { tr: 'İlgili içeriği kaldır', en: 'Remove linked content' },
  storiesCommentsEnabled: { tr: 'Yorumlara izin ver', en: 'Allow comments' },
  storiesContactEnabled: { tr: 'İletişim isteklerine izin ver', en: 'Allow contact requests' },
  storiesSupportEnabled: { tr: 'Dua desteğine izin ver', en: 'Allow prayer support' },
  storiesLinkedListen: { tr: 'İlgili içeriği dinle', en: 'Listen to linked content' },
  storiesCommentPlaceholder: { tr: 'Düşünceni paylaş…', en: 'Share your thought…' },
  storiesCommentsHint: {
    tr: 'Hikâye hakkındaki düşüncelerini paylaş.',
    en: 'Share what this story made you think about.',
  },
  storiesNoComments: { tr: 'İlk yorumu sen yaz.', en: 'Be the first to comment.' },
  storiesCommentsClosed: { tr: 'Yazar yorumları kapatmış.', en: 'The author has turned off comments.' },
  storiesStatusDraft: { tr: 'Taslak', en: 'Draft' },
  storiesStatusPublished: { tr: 'Yayında', en: 'Published' },
  storiesStatusHidden: { tr: 'İncelemede', en: 'Under review' },
  storiesStatusRemoved: { tr: 'Kaldırıldı', en: 'Removed' },
  storiesNoMine: { tr: 'Henüz bir hikâye yazmadın.', en: 'You have not written a story yet.' },
  storiesRequests: { tr: 'İletişim İstekleri', en: 'Contact requests' },
  storiesNoRequests: { tr: 'Bekleyen istek yok.', en: 'No pending requests.' },
  storiesCategoryAll: { tr: 'Tümü', en: 'All' },
  storiesJourney: { tr: 'Dua Yolculuğu', en: 'Dua journey' },
  storiesJourneyLive: { tr: 'Aynı Duada Buluşanlar', en: 'Meeting in the same dua' },
  storiesJourneyLiveBody: {
    tr: 'Şu anda aynı içeriği dinleyenlerle tanış veya birlikte dinle.',
    en: 'Meet people listening to the same content right now, or listen together.',
  },
  storiesJourneyStories: { tr: 'Dinlediğin içerikle ilgili hikâyeler', en: 'Stories linked to what you listen to' },
  storiesJourneyExplore: { tr: 'Hikâyelere göz at', en: 'Explore stories' },
  storiesPosts: { tr: 'Paylaşımlar', en: 'Posts' },
  storiesSearchPlaceholder: { tr: 'Hikâye veya dua ara…', en: 'Search a story or dua…' },
  storiesPickContent: { tr: 'İçerik seç', en: 'Choose content' },
  storiesLoadMore: { tr: 'Daha fazla', en: 'Load more' },
  storiesSaveFailed: { tr: 'Hikâye kaydedilemedi.', en: 'Story could not be saved.' },
  storiesTitleTooShort: {
    tr: 'Başlık en az 3 karakter olmalı.',
    en: 'The title must be at least 3 characters.',
  },
  storiesBodyRequired: {
    tr: 'Hikâye metni boş olamaz.',
    en: 'The story text cannot be empty.',
  },
  storiesBodyTooShort: {
    tr: 'Yayınlamak için hikâye en az 120 karakter olmalı.',
    en: 'A story needs at least 120 characters to be published.',
  },
  storiesDeleted: { tr: 'Hikâye silindi.', en: 'Story deleted.' },
  storiesCommentDeleteConfirm: { tr: 'Bu yorum silinsin mi?', en: 'Delete this comment?' },
  storiesCommentDeleted: { tr: 'Yorum silindi.', en: 'Comment deleted.' },
  storiesTtsUnavailable: { tr: 'Bu cihazda sesli okuma kullanılamıyor.', en: 'Text-to-speech is unavailable on this device.' },
  storiesSpeechHint: {
    tr: 'Hikâye cihazında seslendirilir; sunucuya ses gönderilmez.',
    en: 'The story is read on your device; no audio is sent to a server.',
  },
  storiesVoiceLabel: { tr: 'Ses', en: 'Voice' },
  storiesVoiceFemale: { tr: 'Kadın', en: 'Female' },
  storiesVoiceDevice: { tr: 'Cihaz', en: 'Device' },
  storiesVoiceExternalTitle: {
    tr: 'Harici seslendirme',
    en: 'External voice',
  },
  storiesVoiceExternalBody: {
    tr: 'Kadın sesi, hikâye metnini harici bir seslendirme servisine gönderir. Bunun yerine cihazındaki ses kullanılabilir.',
    en: 'The female voice sends the story text to an external speech service. Your device voice can be used instead.',
  },
  storiesContinue: { tr: 'Devam et', en: 'Continue' },
  storiesVoiceFemaleHint: {
    tr: 'Kadın sesi açık (anahtarsız) ses servisinden gelir; cihazında kadın ses yoksa da çalışır.',
    en: 'The female voice comes from an open, key-free service and works even when your device has no female voice.',
  },
  storiesContactDefault: {
    tr: 'Merhaba, hikâyeni okudum. Paylaştığın için teşekkür ederim.',
    en: 'Hello, I read your story. Thank you for sharing it.',
  },
  storiesContactSent: {
    tr: 'İletişim isteği gönderildi.',
    en: 'Contact request sent.',
  },
  storiesContactPending: {
    tr: 'İsteğin yanıt bekliyor.',
    en: 'Your request is awaiting a reply.',
  },
  storiesReportSent: {
    tr: 'Şikâyetin incelemeye alındı.',
    en: 'Your report has been sent for review.',
  },
  storiesSupportResources: {
    tr: 'Destek kaynakları',
    en: 'Support resources',
  },
  storiesReportSpam: { tr: 'Spam veya reklam', en: 'Spam or advertising' },
  storiesReportHarassment: { tr: 'Taciz veya tehdit', en: 'Harassment or threats' },
  storiesReportMisattribution: { tr: 'Yanlış dinî atıf', en: 'Incorrect religious attribution' },
  storiesReportOther: { tr: 'Diğer', en: 'Other' },
  storiesCancel: { tr: 'Vazgeç', en: 'Cancel', ar: 'إلغاء', es: 'Cancelar' },
  storiesCommentFailed: {
    tr: 'Yorum gönderilemedi.',
    en: 'Comment could not be sent.',
  },
  storiesNotFound: {
    tr: 'Hikâye bulunamadı veya erişime kapalı.',
    en: 'The story could not be found or is not accessible.',
  },
  storiesSpeechRate: { tr: 'Okuma hızı', en: 'Reading speed' },
  storiesSpeechUnavailable: {
    tr: 'Bu sürümde sesli okuma kullanılamıyor. Uygulamayı güncelleyip tekrar deneyin.',
    en: 'Read-aloud is unavailable in this build. Update the app and try again.',
  },
} as const;

export type FeatureKey = keyof typeof featureCopy;

export function featureText(locale: Locale, key: FeatureKey, vars?: Record<string, string | number>) {
  const row = featureCopy[key] as Partial<Record<Locale, string>>;
  let value = row[locale] ?? row.en ?? row.tr ?? key;
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.split(`{${name}}`).join(String(replacement));
    }
  }
  return value;
}

export function useFeatureT() {
  const locale = useI18nStore((state) => state.locale);
  return useCallback(
    (key: FeatureKey, vars?: Record<string, string | number>) => featureText(locale, key, vars),
    [locale],
  );
}
