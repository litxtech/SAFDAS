import { useCallback } from 'react';
import { useI18nStore, type Locale } from '@/i18n';

/**
 * SAFDAŞ NASİP copy (Turkish / English). Other app locales fall back to English.
 * All labels that describe stored enum values live in constants.ts.
 */
const DICT = {
  brand: ['SAFDAŞ NASİP', 'SAFDAŞ NASİP'],
  tagline: ['Ciddi bir niyet, anlamlı bir başlangıç.', 'A serious intention, a meaningful beginning.'],
  introBody: [
    'Evlilik amacıyla tanışmak isteyen insanları, güvenli ve karşılıklı onaya dayalı bir ortamda buluşturan özel merkez.',
    'A private space where people looking for marriage meet in a safe environment built on mutual consent.',
  ],
  createProfile: ['Profilimi Oluştur', 'Create my profile'],
  howItWorks: ['Nasıl Çalışır?', 'How does it work?'],
  how1Title: ['Ciddi bir profil', 'A serious profile'],
  how1Body: ['Evlilik niyetini ve temel bilgilerini paylaş. Profilin yalnızca NASİP içinde görünür.', 'Share your marriage intention and basics. Your profile is visible only inside NASİP.'],
  how2Title: ['Karşılıklı tercihler', 'Mutual preferences'],
  how2Body: ['Adaylar yalnızca iki tarafın da tercihleri uyduğunda gösterilir.', 'Candidates appear only when both sides’ preferences match.'],
  how3Title: ['Tanışma isteği', 'Introduction request'],
  how3Body: ['İlgilendiğin kişiye kısa bir istek gönder. Günlük hakkın sunucuda takip edilir.', 'Send a short request to someone you are interested in. Your daily limit is enforced on the server.'],
  how4Title: ['Karşılıklı kabul', 'Mutual acceptance'],
  how4Body: ['İstek kabul edilince ücretsiz ve özel bir görüşme açılır.', 'When a request is accepted, a private conversation opens for free.'],
  continue: ['Devam Et', 'Continue'],
  back: ['Geri', 'Back'],
  save: ['Kaydet', 'Save'],
  cancel: ['Vazgeç', 'Cancel'],
  close: ['Kapat', 'Close'],
  next: ['Devam Et', 'Continue'],
  finish: ['Tamamla', 'Finish'],
  loading: ['Yükleniyor…', 'Loading…'],
  saving: ['Kaydediliyor…', 'Saving…'],
  retry: ['Tekrar dene', 'Try again'],
  optional: ['İsteğe bağlı', 'Optional'],
  required: ['Zorunlu', 'Required'],
  any: ['Fark etmez', 'Any'],
  errorGeneric: ['Bir şeyler ters gitti. Lütfen tekrar dene.', 'Something went wrong. Please try again.'],
  errorNetwork: ['Bağlantı kurulamadı. İnternetini kontrol et.', 'Could not connect. Check your connection.'],
  errorUnauthorized: ['Bu işlem için giriş yapmalısın.', 'You need to sign in for this action.'],
  errorProfileRequired: ['Önce NASİP profilini tamamlamalısın.', 'Complete your NASİP profile first.'],
  errorAdultOnly: ['NASİP yalnızca 18 yaş ve üzeri kullanıcılar içindir.', 'NASİP is only available to users aged 18 and over.'],
  errorBirthDateLocked: ['Doğum tarihi güvenlik nedeniyle kilitlidir. Düzeltme için destek ekibine başvur.', 'Your date of birth is locked for safety. Contact support to correct it.'],
  errorQuota: ['Günlük tanışma isteği hakkın doldu.', 'You have used today’s introduction requests.'],
  errorPlusRequired: ['Bu özellik NASİP PLUS üyeleri içindir.', 'This feature is for NASİP PLUS members.'],
  errorBlocked: ['Bu kullanıcıyla iletişim kurulamıyor.', 'You cannot contact this user.'],
  errorCooldown: ['Bu kişiye kısa süre içinde yeniden istek gönderemezsin.', 'You cannot send another request to this person so soon.'],
  errorRequestExists: ['Bu kişiyle zaten açık bir istek veya eşleşmen var.', 'You already have an open request or match with this person.'],
  errorNotCompatible: ['Karşılıklı tercihler uyuşmuyor.', 'Your mutual preferences do not match.'],
  errorNotFound: ['Kayıt bulunamadı.', 'Record not found.'],
  errorSuspended: ['Hesabın güvenlik incelemesi nedeniyle kullanılamıyor.', 'Your account is unavailable during a safety review.'],
  errorStore: ['Mağaza işlemi tamamlanamadı.', 'The store operation could not be completed.'],
  tryAgain: ['Tekrar dene', 'Try again'],

  // Wizard
  stepBasic: ['Temel bilgiler', 'Basics'],
  stepAbout: ['Hakkımda', 'About me'],
  stepPreferences: ['Evlilik tercihlerim', 'Marriage preferences'],
  stepPhoto: ['Fotoğraf ve gizlilik', 'Photo & privacy'],
  displayName: ['Görünen ad', 'Display name'],
  displayNamePlaceholder: ['Örn. Ayşe', 'E.g. Ayşe'],
  displayNameHint: ['Soyadını paylaşmak zorunda değilsin.', 'You do not have to share your surname.'],
  genderLabel: ['Cinsiyet', 'Gender'],
  genderHint: ['Cinsiyetini kendin seçmelisin. Tahmin edilmez.', 'You choose your gender. It is never guessed.'],
  genderDetail: ['Kendini nasıl tanımlıyorsun?', 'How do you describe yourself?'],
  genderDetailPlaceholder: ['Kısa bir açıklama', 'A short description'],
  birthDate: ['Doğum tarihi', 'Date of birth'],
  birthDateHint: ['Yalnızca yaşın profilde görünür. Doğum tarihin herkese açık değildir.', 'Only your age is shown. Your birth date is never public.'],
  birthDatePlaceholder: ['GG.AA.YYYY', 'DD.MM.YYYY'],
  invalidBirthDate: ['Geçerli bir doğum tarihi gir.', 'Enter a valid date of birth.'],
  mustBe18: ['NASİP için 18 yaşını doldurmuş olmalısın.', 'You must be 18 or older to use NASİP.'],
  country: ['Ülke', 'Country'],
  city: ['Şehir', 'City'],
  district: ['İlçe', 'District'],
  selectCountry: ['Ülke seç', 'Select country'],
  selectCity: ['Şehir seç', 'Select city'],
  locationHint: ['Bu konum namaz vakti konumundan bağımsızdır. Kesin GPS konumu paylaşılmaz.', 'This location is separate from prayer times. No precise GPS location is shared.'],
  marriageIntent: ['Evlilik amacıyla tanışmak istiyorum.', 'I am here to meet someone for marriage.'],
  termsAccept: ['Kullanım koşullarını okudum ve kabul ediyorum.', 'I have read and accept the Terms of Use.'],
  privacyAccept: ['Gizlilik bilgilendirmesini okudum.', 'I have read the Privacy Notice.'],
  rulesAccept: ['Topluluk ve güvenlik kurallarını kabul ediyorum.', 'I accept the Community and Safety Rules.'],
  acceptAll: ['Tümünü kabul et', 'Accept all'],
  adultNote: ['18 yaş altındaki kişiler NASİP’e erişemez.', 'People under 18 cannot access NASİP.'],
  height: ['Boy', 'Height'],
  education: ['Eğitim durumu', 'Education'],
  profession: ['Meslek', 'Profession'],
  professionPlaceholder: ['Örn. Öğretmen', 'E.g. Teacher'],
  employment: ['Çalışma durumu', 'Employment'],
  maritalStatus: ['Medeni durum', 'Marital status'],
  previouslyMarried: ['Daha önce evlilik yaptın mı?', 'Have you been married before?'],
  hasChildren: ['Çocuğun var mı?', 'Do you have children?'],
  childrenCount: ['Çocuk sayısı', 'Number of children'],
  smoking: ['Sigara kullanımı', 'Smoking'],
  relocation: ['Taşınmaya açık mısın?', 'Open to relocating?'],
  bio: ['Kısa biyografi', 'Short bio'],
  bioPlaceholder: ['Kendini, hayatını ve evlilikten beklentilerini kısaca anlat.', 'Briefly describe yourself, your life and what you expect from marriage.'],
  bioCount: ['{count}/600', '{count}/600'],
  yes: ['Evet', 'Yes'],
  no: ['Hayır', 'No'],
  sensitiveTitle: ['İsteğe bağlı hassas tercih', 'Optional sensitive preference'],
  religiousPractice: ['Dinî yaşam tercihi', 'Religious practice preference'],
  religiousPracticeHint: ['Bu alan isteğe bağlıdır ve eşleşme için zorunlu değildir. Yalnızca açık izninle saklanır.', 'This field is optional and never required for matching. It is stored only with your explicit consent.'],
  sensitiveConsent: ['Bu hassas bilgiyi paylaşmayı kabul ediyorum.', 'I consent to sharing this sensitive information.'],
  preferencesTitle: ['Eş adayında aradıkların', 'What you look for'],
  interestedGenders: ['Tanışmak istediğin cinsiyetler', 'Genders you want to meet'],
  interestedGendersHint: ['En az bir seçim yapmalısın. Cinsiyetinle otomatik eşitlenmez.', 'Choose at least one. This is not copied from your gender.'],
  ageRange: ['Yaş aralığı', 'Age range'],
  minAge: ['En az', 'Minimum'],
  maxAge: ['En fazla', 'Maximum'],
  preferredCountries: ['Tercih ettiğin ülkeler', 'Preferred countries'],
  preferredCities: ['Tercih ettiğin şehirler', 'Preferred cities'],
  timeline: ['Evlilik zaman beklentisi', 'Marriage timeline'],
  relocationPreference: ['Taşınma tercihi', 'Relocation preference'],
  educationPreference: ['Eğitim tercihi', 'Education preference'],
  photosTitle: ['Fotoğrafların', 'Your photos'],
  addPhoto: ['Fotoğraf ekle', 'Add photo'],
  photoHint: ['En fazla 6 fotoğraf ekleyebilirsin. Yüklediğin fotoğraflar moderasyon onayından sonra gösterilir.', 'You can add up to 6 photos. Uploaded photos appear after moderation.'],
  photoPending: ['Moderasyon bekliyor', 'Pending review'],
  photoRejected: ['Onaylanmadı', 'Not approved'],
  removePhoto: ['Fotoğrafı kaldır', 'Remove photo'],
  makePrimary: ['Kapak yap', 'Make cover'],
  photoPrivacy: ['Fotoğraf görünürlüğü', 'Photo visibility'],
  showCity: ['Konum görünürlüğü', 'Location visibility'],
  showOnline: ['Son aktiflik görünsün', 'Show last active'],
  readReceipts: ['Okundu bilgisi paylaşılsın', 'Share read receipts'],
  notificationPreview: ['Bildirimlerde mesaj metni görünsün', 'Show message text in notifications'],
  hiddenVisits: ['Gizli gezinme', 'Invisible browsing'],
  hiddenVisitsPlus: ['Gizli gezinme NASİP PLUS ile kullanılabilir.', 'Invisible browsing requires NASİP PLUS.'],
  allowPhotoRequests: ['Fotoğraf izin taleplerine açık ol', 'Allow photo access requests'],
  profileReady: ['Profilin hazır!', 'Your profile is ready!'],
  profileReadyBody: ['Artık sana uygun kişileri keşfedebilirsin.', 'You can now discover people who fit your preferences.'],
  discoverCandidates: ['Adayları Keşfet', 'Discover candidates'],
  incompleteHint: ['Profili tamamlamak için eksik alanları doldur.', 'Fill in the missing fields to complete your profile.'],
  draftSaved: ['Taslak kaydedildi.', 'Draft saved.'],
  selectGender: ['Cinsiyetini seçmelisin.', 'Please select your gender.'],
  selectAtLeastOneGender: ['En az bir cinsiyet tercihi seç.', 'Choose at least one gender preference.'],
  ageRangeInvalid: ['Yaş aralığı geçersiz.', 'The age range is invalid.'],
  saveFailed: ['Kaydedilemedi. Lütfen tekrar dene.', 'Could not save. Please try again.'],

  // Discover
  discoverTitle: ['SAFDAŞ NASİP', 'SAFDAŞ NASİP'],
  discoverTagline: ['Ciddi Evlilik Merkezi', 'Serious Marriage Centre'],
  forYou: ['Senin İçin Seçilenler', 'Selected for you'],
  forYouBody: ['Tercihlerine uygun evlilik adaylarını keşfet.', 'Discover marriage candidates who fit your preferences.'],
  todayQuotaLeft: ['Bugün {count} tanışma hakkın kaldı', '{count} introduction requests left today'],
  todayQuotaNone: ['Bugünlük tanışma hakkın doldu', 'You have used today’s introduction requests'],
  plusLink: ['PLUS', 'PLUS'],
  plusActiveTitle: ['NASİP PLUS üyeliğin aktif', 'Your NASİP PLUS membership is active'],
  plusActiveBody: ['Gelişmiş filtreler ve geniş keşif açık.', 'Advanced filters and broader discovery are on.'],
  plusActiveBodyUntil: ['{date} tarihine kadar geçerli.', 'Active until {date}.'],
  plusManage: ['Aboneliği yönet', 'Manage subscription'],
  clearAllFilters: ['Tümünü temizle', 'Clear all'],
  removeFilter: ['{label} filtresini kaldır', 'Remove {label} filter'],
  searchResultsTitle: ['Arama sonuçları', 'Search results'],
  searchResultsBody: ['Tercihlerine uygun kişileri keşfet.', 'Discover people who match your preferences.'],
  emptyFilteredTitle: ['Henüz uygun bir profil bulunamadı.', 'No suitable profile found yet.'],
  emptyFilteredBody: ['Arama tercihlerini genişleterek yeni kişileri keşfedebilirsin.', 'Widen your search preferences to discover new people.'],
  editFilters: ['Filtreleri Düzenle', 'Edit filters'],
  moreCandidates: ['Daha fazla aday göster', 'Show more candidates'],
  endOfResults: ['Yeni adaylar uygun olduğunda burada görünür.', 'New candidates appear here when they fit.'],
  filters: ['Filtreler', 'Filters'],
  search: ['Ara', 'Search'],
  searchTitle: ['Aday ara', 'Search candidates'],
  searchSubtitle: ['Karşılıklı tercihlere uyan adayları filtrele.', 'Filter candidates who match your mutual preferences.'],
  advancedFilters: ['Gelişmiş filtreler', 'Advanced filters'],
  basicFilters: ['Temel filtreler', 'Basic filters'],
  plusFilterHint: ['Gelişmiş filtreler NASİP PLUS ile açılır.', 'Advanced filters require NASİP PLUS.'],
  verifiedOnly: ['Yalnızca doğrulanmış profiller', 'Verified profiles only'],
  clearFilters: ['Filtreleri temizle', 'Clear filters'],
  applyFilters: ['Sonuçları göster', 'Show results'],
  resultsCount: ['{count} aday', '{count} candidates'],
  noCandidates: ['Şu an uygun aday yok', 'No suitable candidates right now'],
  noCandidatesBody: ['Tercihlerini genişletmeyi veya daha sonra tekrar bakmayı dene. Sistem sahte aday göstermez.', 'Try widening your preferences or check again later. The system never shows fake candidates.'],
  noMore: ['Şimdilik bu kadar.', 'That’s all for now.'],
  lastActive: ['Son aktiflik', 'Last active'],
  compatibility: ['Karşılıklı uyum', 'Mutual fit'],
  skip: ['Geç', 'Skip'],
  viewProfile: ['Profili Gör', 'View profile'],
  sendRequest: ['Tanışma İsteği Gönder', 'Send introduction request'],
  requestSent: ['İstek gönderildi', 'Request sent'],
  requestPending: ['İstek beklemede', 'Request pending'],
  matched: ['Eşleştiniz', 'Matched'],
  message: ['Mesaj gönder', 'Message'],
  profileUnavailable: ['Bu profil şu anda kullanılamıyor.', 'This profile is currently unavailable.'],
  photoHidden: ['Fotoğraf gizli', 'Photo is private'],
  verified: ['Doğrulanmış', 'Verified'],

  // Detail
  about: ['Hakkında', 'About'],
  lookingFor: ['Evlilik beklentisi', 'Marriage expectations'],
  photos: ['Fotoğraflar', 'Photos'],
  requestMessageTitle: ['Kısa bir not ekle', 'Add a short note'],
  requestMessagePlaceholder: ['Kendini kısaca tanıt (isteğe bağlı)', 'Introduce yourself briefly (optional)'],
  send: ['Gönder', 'Send'],
  report: ['Şikâyet et', 'Report'],
  block: ['Engelle', 'Block'],
  unblock: ['Engeli kaldır', 'Unblock'],
  photoRequest: ['Fotoğraf izni iste', 'Request photo access'],
  photoRequestSent: ['Fotoğraf izin talebi gönderildi.', 'Photo access request sent.'],
  photoGranted: ['Fotoğraf erişimi açık.', 'Photo access granted.'],
  photoRequestHint: ['Bu kişi fotoğrafını yalnızca izin verdiği kişilere gösteriyor.', 'This person shares photos only with people they approve.'],
  requestLimit: ['Bugün kalan istek hakkı: {count}', 'Requests left today: {count}'],

  // Interests
  interestsTitle: ['İlgiler', 'Interests'],
  incoming: ['Gelen istekler', 'Incoming'],
  outgoing: ['Gönderilen istekler', 'Sent'],
  visitors: ['Beni görenler', 'Who viewed me'],
  matches: ['Eşleşmeler', 'Matches'],
  incomingEmpty: ['Henüz gelen istek yok.', 'No incoming requests yet.'],
  outgoingEmpty: ['Henüz istek göndermedin.', 'You have not sent any requests yet.'],
  visitorsEmpty: ['Son dönemde profilini görüntüleyen yok.', 'Nobody has viewed your profile recently.'],
  matchesEmpty: ['Henüz eşleşmen yok.', 'No matches yet.'],
  accept: ['Kabul Et', 'Accept'],
  decline: ['Reddet', 'Decline'],
  blockUser: ['Engelle', 'Block'],
  withdraw: ['Geri çek', 'Withdraw'],
  visitorsPlus: ['Beni görenleri görmek NASİP PLUS ile açılır.', 'Seeing who viewed you requires NASİP PLUS.'],
  photoRequests: ['Fotoğraf izin talepleri', 'Photo access requests'],
  noPhotoRequests: ['Bekleyen fotoğraf izin talebi yok.', 'No pending photo access requests.'],
  approve: ['İzin ver', 'Allow'],
  deny: ['İzin verme', 'Don’t allow'],

  // Conversations
  conversationsTitle: ['Görüşmeler', 'Conversations'],
  noConversations: ['Henüz görüşme yok', 'No conversations yet'],
  noConversationsBody: ['Karşılıklı bir tanışma isteği kabul edildiğinde görüşme burada açılır.', 'A conversation opens here when an introduction request is accepted.'],
  chatInput: ['Mesaj yaz…', 'Write a message…'],
  messageDeleted: ['Bu mesaj silindi.', 'This message was deleted.'],
  conversationEnded: ['Bu görüşme sonlandırıldı. Yeni mesaj gönderilemez.', 'This conversation has ended. You cannot send new messages.'],
  endConversation: ['Görüşmeyi sonlandır', 'End conversation'],
  endConfirm: ['Görüşmeyi sonlandırmak istediğine emin misin? Mevcut mesajlar korunur.', 'End this conversation? Existing messages are kept.'],
  blockConfirm: ['Bu kişiyi engellemek istediğine emin misin? Karşı tarafa bildirim gönderilmez.', 'Block this person? They are not notified.'],
  reportTitle: ['Şikâyet et', 'Report'],
  reportReason: ['Neden şikâyet ediyorsun?', 'Why are you reporting?'],
  reportDetails: ['Ek açıklama (isteğe bağlı)', 'Additional details (optional)'],
  reportSubmit: ['Şikâyeti gönder', 'Send report'],
  reportDone: ['Şikâyetin alındı. Bildirim kodun: {code}', 'Your report was received. Reference: {code}'],
  blockDone: ['Kullanıcı engellendi.', 'User blocked.'],
  unblockDone: ['Engel kaldırıldı.', 'User unblocked.'],
  online: ['Şu anda aktif', 'Active now'],
  today: ['Bugün', 'Today'],
  yesterday: ['Dün', 'Yesterday'],

  // Profile
  profileTitle: ['Profilim', 'My profile'],
  editProfile: ['Profilimi Düzenle', 'Edit profile'],
  myPreferences: ['Evlilik Tercihlerim', 'Marriage preferences'],
  photoPrivacySettings: ['Fotoğraf ve Gizlilik', 'Photo & privacy'],
  visibilitySettings: ['Görünürlük Ayarları', 'Visibility settings'],
  history: ['Tanışma Geçmişim', 'Introduction history'],
  plusMembership: ['NASİP PLUS', 'NASİP PLUS'],
  notifications: ['Bildirimler', 'Notifications'],
  security: ['Güvenlik', 'Safety'],
  freeze: ['Hesabı Dondur', 'Freeze profile'],
  deleteProfile: ['NASİP Profilimi Sil', 'Delete my NASİP profile'],
  freezeTitle: ['Profilini dondur', 'Freeze your profile'],
  freezeBody: ['Profilin keşiften kalkar. Mevcut eşleşmelerin ve mesajların korunur.', 'Your profile leaves discovery. Existing matches and messages are kept.'],
  freezeConfirm: ['Profili dondur', 'Freeze profile'],
  unfreeze: ['Profilimi yeniden aktif et', 'Reactivate my profile'],
  deleteTitle: ['NASİP profilini sil', 'Delete your NASİP profile'],
  deleteBody: ['Bu işlem yalnızca NASİP profilini, fotoğraflarını, isteklerini ve eşleşmelerini siler. SAFDAŞ hesabın silinmez.', 'This deletes only your NASİP profile, photos, requests and matches. Your SAFDAŞ account is not deleted.'],
  deleteConfirm: ['Profilimi sil', 'Delete my profile'],
  deleteDone: ['NASİP profilin silindi.', 'Your NASİP profile was deleted.'],
  frozenDone: ['Profilin donduruldu.', 'Your profile was frozen.'],
  unfrozenDone: ['Profilin yeniden aktif.', 'Your profile is active again.'],
  verification: ['Hesap doğrulama', 'Account verification'],
  verificationBody: ['Doğrulanmış profiller daha güvenilir görünür. Belge ve selfie yalnızca moderasyon ekibi tarafından görülür.', 'Verified profiles look more trustworthy. Documents and selfies are visible only to the moderation team.'],
  submitVerification: ['Doğrulama başvurusu gönder', 'Submit verification'],
  verificationPending: ['Doğrulama inceleniyor', 'Verification under review'],
  verificationApproved: ['Doğrulanmış profil', 'Verified profile'],
  verificationRejected: ['Doğrulama reddedildi', 'Verification rejected'],
  completion: ['Profil tamamlanma', 'Profile completion'],
  completeProfile: ['Profili tamamla', 'Complete profile'],
  quotaTitle: ['Günlük tanışma istekleri', 'Daily introduction requests'],
  quotaBody: ['{used}/{limit} kullanıldı', '{used}/{limit} used'],
  memberSince: ['Üyelik başlangıcı', 'Member since'],
  noPhotos: ['Henüz fotoğraf eklemedin.', 'You have not added photos yet.'],
  manageSubscription: ['Aboneliği yönet', 'Manage subscription'],
  restore: ['Satın alımları geri yükle', 'Restore purchases'],
  terms: ['Kullanım koşulları', 'Terms of Use'],
  privacyPolicy: ['Gizlilik politikası', 'Privacy Policy'],
  rules: ['Topluluk kuralları', 'Community rules'],
  profileUpdated: ['Profil güncellendi.', 'Profile updated.'],
  notificationPrefsSaved: ['Bildirim tercihleri kaydedildi.', 'Notification preferences saved.'],
  photoUploaded: ['Fotoğraf yüklendi. Moderasyon onayından sonra görünecek.', 'Photo uploaded. It will appear after moderation.'],
  photoRemoved: ['Fotoğraf kaldırıldı.', 'Photo removed.'],

  // PLUS
  plusTitle: ['NASİP PLUS', 'NASİP PLUS'],
  plusSubtitle: ['Daha geniş keşif, daha güçlü araçlar.', 'Broader discovery, stronger tools.'],
  plusMonthly: ['aylık', 'monthly'],
  targetPrice: ['Hedef fiyat', 'Target price'],
  storePriceNote: ['Fiyat mağazadan alınır. Görünen fiyat App Store veya Google Play tarafından belirlenir.', 'The price comes from the store. The displayed price is set by the App Store or Google Play.'],
  activeUntil: ['Bitiş', 'Ends'],
  pendingVerification: ['Doğrulama bekleniyor', 'Pending verification'],
  storePending: ['Mağaza fiyatı alınıyor…', 'Loading the store price…'],
  storeUnavailable: ['Satın alımlar yalnızca iOS ve Android uygulamasında kullanılabilir.', 'Purchases are available only in the iOS and Android app.'],
  purchase: ['NASİP PLUS satın al', 'Buy NASİP PLUS'],
  purchaseQueued: ['Satın alımın doğrulama sırasına alındı. Doğrulama tamamlanınca üyelik açılacak.', 'Your purchase was queued for verification. Membership activates once verified.'],
  purchaseSuccess: ['NASİP PLUS aktif.', 'NASİP PLUS is active.'],
  purchaseCancelled: ['Satın alım iptal edildi.', 'Purchase cancelled.'],
  purchaseFailed: ['Satın alım tamamlanamadı. Lütfen tekrar dene.', 'The purchase could not be completed. Please try again.'],
  restoreEmpty: ['Geri yüklenecek bir satın alım bulunamadı.', 'No purchase to restore was found.'],
  restoreDone: ['Geri yüklenen satın alımlar doğrulama sırasına alındı.', 'Restored purchases were queued for verification.'],
  continueFree: ['Ücretsiz devam et', 'Continue for free'],
  plusBenefitsTitle: ['PLUS ile neler açılır?', 'What does PLUS unlock?'],
  freePlan: ['Ücretsiz', 'Free'],
  plusPlan: ['NASİP PLUS', 'NASİP PLUS'],
  autoRenewNote: ['Abonelik, dönem bitiminden en az 24 saat önce iptal edilmezse otomatik yenilenir. İptal ve yönetim mağaza hesabından yapılır.', 'The subscription renews automatically unless cancelled at least 24 hours before the period ends. Manage or cancel it in your store account.'],
  guaranteeNote: ['Abonelik bir eşleşme, iletişim veya evlilik garantisi vermez. Güvenlik ve temel gizlilik özellikleri her zaman ücretsizdir.', 'A subscription does not guarantee a match, contact or marriage. Safety and basic privacy features are always free.'],
  paymentNote: ['Ödeme Apple veya Google tarafından işlenir. İade ve faturalandırma mağaza kurallarına tabidir.', 'Payment is processed by Apple or Google. Refunds and billing follow store rules.'],

  // Safety
  safetyTitle: ['Güvenlik', 'Safety'],
  safetyBody: ['Tanışma sürecinde kişisel bilgilerini koru. Para göndermeden veya kişisel belge paylaşmadan önce dikkatli ol.', 'Protect your personal information while getting to know someone. Be careful before sending money or documents.'],
  blockedUsers: ['Engellenen kullanıcılar', 'Blocked users'],
  myReports: ['Şikâyetlerim', 'My reports'],
  noBlockedUsers: ['Engellenen kullanıcı yok.', 'No blocked users.'],
  noReports: ['Henüz şikâyet bildirimin yok.', 'You have not submitted any reports.'],
} as const;

export type NasipTextKey = keyof typeof DICT;

export function nasipText(locale: Locale, key: NasipTextKey, vars?: Record<string, string | number>): string {
  const row = DICT[key];
  let value: string = locale === 'tr' ? row[0] : row[1];
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.split(`{${name}}`).join(String(replacement));
    }
  }
  return value;
}

/**
 * Server-stored copy (premium offer title/body, product titles) is written by
 * staff through the admin panel. A pasted or re-encoded value can arrive as
 * mojibake ("NASÄ°P PLUS", "geliÅŸmiÅŸ") and would then be rendered as-is on the
 * NASİP PLUS cards. Rejecting it here lets every caller fall back to the
 * built-in Turkish copy instead of showing broken characters.
 */
const MOJIBAKE_PATTERN = /(Ã.|Ä.|Å.|Â|â€)/;

export function cleanNasipCopy(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return MOJIBAKE_PATTERN.test(trimmed) ? null : trimmed;
}

export function useNasipT() {
  const locale = useI18nStore((state) => state.locale);
  return useCallback(
    (key: NasipTextKey, vars?: Record<string, string | number>) => nasipText(locale, key, vars),
    [locale],
  );
}

export function mapNasipError(error: unknown, locale: Locale): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const normalized = raw.toLowerCase();
  const pick = (key: NasipTextKey) => nasipText(locale, key);
  if (normalized.includes('not_authenticated') || normalized.includes('unauthorized') || normalized.includes('jwt')) {
    return pick('errorUnauthorized');
  }
  if (normalized.includes('birth_date_locked')) return pick('errorBirthDateLocked');
  if (normalized.includes('adult') || normalized.includes('18')) return pick('errorAdultOnly');
  if (normalized.includes('quota_exceeded') || normalized.includes('too_many_attempts')) return pick('errorQuota');
  if (normalized.includes('plus_required')) return pick('errorPlusRequired');
  if (normalized.includes('user_blocked') || normalized.includes('blocked')) return pick('errorBlocked');
  if (normalized.includes('request_cooldown') || normalized.includes('cooldown')) return pick('errorCooldown');
  if (normalized.includes('request_exists') || normalized.includes('duplicate key')) return pick('errorRequestExists');
  if (normalized.includes('not_compatible')) return pick('errorNotCompatible');
  if (normalized.includes('profile_required')) return pick('errorProfileRequired');
  if (normalized.includes('not_found')) return pick('errorNotFound');
  if (normalized.includes('suspended')) return pick('errorSuspended');
  if (normalized.includes('network') || normalized.includes('fetch')) return pick('errorNetwork');
  if (normalized.includes('store_verification') || normalized.includes('purchase')) return pick('errorStore');
  return pick('errorGeneric');
}
