/**
 * Mobile-side message catalogue. Mirrors the web catalog where keys overlap,
 * but only contains UI text the mobile actually shows. Missing keys fall back
 * to the English value, and a missing English value falls back to the raw key
 * (so the screen is never empty).
 *
 * Entity names (municipality, department, category, role) carry their own
 * Ar/Fr variants from the database and are rendered with `pickName(item, locale)`
 * from `@shared/types/locale`.
 */
import type { Locale } from '@shared/types/locale';

export type MessageKey = keyof typeof en;

const en = {
  // Common
  'common.appName': 'Baladi',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.confirm': 'Confirm',
  'common.loading': 'Loading…',
  'common.retry': 'Retry',
  'common.error': 'Error',
  'common.success': 'Success',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.submit': 'Submit',
  'common.language': 'Language',

  // Tabs
  'tabs.home': 'Home',
  'tabs.complaints': 'My Reports',
  'tabs.submit': 'Submit',
  'tabs.tasks': 'Tasks',
  'tabs.inbox': 'Inbox',
  'tabs.news': 'News',
  'tabs.profile': 'Profile',

  // Profile
  'profile.personalInfo': 'Personal Info',
  'profile.edit': 'Edit',
  'profile.firstName': 'First Name',
  'profile.lastName': 'Last Name',
  'profile.phone': 'Phone',
  'profile.email': 'Email',
  'profile.name': 'Name',
  'profile.municipality': 'Municipality',
  'profile.notSet': 'Not set',
  'profile.notifications': 'Notifications',
  'profile.signOut': 'Sign Out',
  'profile.signOutConfirm': 'Are you sure you want to sign out?',
  'profile.verified': 'Verified',
  'profile.verifyPending': 'Verification In Progress',
  'profile.verifyPendingHint': 'Your documents are under review.',
  'profile.verifyMissing': 'Identity Not Verified',
  'profile.verifyMissingHint': 'Tap to verify your identity and access all services.',
  'profile.updated': 'Profile updated',
  'profile.updateFailed': 'Could not update profile',

  // Language picker
  'language.title': 'Language',
  'language.subtitle': 'Choose how the app is displayed.',
  'language.saved': 'Language updated',
  'language.saveFailed': 'Could not update language',
  'language.restartHint': 'Some layout changes may require restarting the app.',

  // Languages
  'lang.en': 'English',
  'lang.ar': 'العربية',
  'lang.fr': 'Français',
} as const;

const ar: Partial<Record<MessageKey, string>> = {
  'common.appName': 'بلدي',
  'common.cancel': 'إلغاء',
  'common.save': 'حفظ',
  'common.delete': 'حذف',
  'common.confirm': 'تأكيد',
  'common.loading': 'جارٍ التحميل…',
  'common.retry': 'إعادة المحاولة',
  'common.error': 'خطأ',
  'common.success': 'تم',
  'common.yes': 'نعم',
  'common.no': 'لا',
  'common.back': 'رجوع',
  'common.next': 'التالي',
  'common.submit': 'إرسال',
  'common.language': 'اللغة',

  'tabs.home': 'الرئيسية',
  'tabs.complaints': 'بلاغاتي',
  'tabs.submit': 'إرسال بلاغ',
  'tabs.tasks': 'المهام',
  'tabs.inbox': 'الوارد',
  'tabs.news': 'الأخبار',
  'tabs.profile': 'الملف الشخصي',

  'profile.personalInfo': 'البيانات الشخصية',
  'profile.edit': 'تعديل',
  'profile.firstName': 'الاسم الأول',
  'profile.lastName': 'الكنية',
  'profile.phone': 'الهاتف',
  'profile.email': 'البريد الإلكتروني',
  'profile.name': 'الاسم',
  'profile.municipality': 'البلدية',
  'profile.notSet': 'غير محدّد',
  'profile.notifications': 'الإشعارات',
  'profile.signOut': 'تسجيل الخروج',
  'profile.signOutConfirm': 'هل أنت متأكد من تسجيل الخروج؟',
  'profile.verified': 'موثّق',
  'profile.verifyPending': 'قيد التحقق',
  'profile.verifyPendingHint': 'وثائقك قيد المراجعة.',
  'profile.verifyMissing': 'لم يتم توثيق الهوية',
  'profile.verifyMissingHint': 'اضغط لتوثيق هويتك والوصول إلى جميع الخدمات.',
  'profile.updated': 'تم تحديث الملف الشخصي',
  'profile.updateFailed': 'تعذّر تحديث الملف الشخصي',

  'language.title': 'اللغة',
  'language.subtitle': 'اختر كيفية عرض التطبيق.',
  'language.saved': 'تم تحديث اللغة',
  'language.saveFailed': 'تعذّر تحديث اللغة',
  'language.restartHint': 'قد تحتاج بعض التغييرات إلى إعادة تشغيل التطبيق.',

  'lang.en': 'English',
  'lang.ar': 'العربية',
  'lang.fr': 'Français',
};

const fr: Partial<Record<MessageKey, string>> = {
  'common.appName': 'Baladi',
  'common.cancel': 'Annuler',
  'common.save': 'Enregistrer',
  'common.delete': 'Supprimer',
  'common.confirm': 'Confirmer',
  'common.loading': 'Chargement…',
  'common.retry': 'Réessayer',
  'common.error': 'Erreur',
  'common.success': 'Succès',
  'common.yes': 'Oui',
  'common.no': 'Non',
  'common.back': 'Retour',
  'common.next': 'Suivant',
  'common.submit': 'Envoyer',
  'common.language': 'Langue',

  'tabs.home': 'Accueil',
  'tabs.complaints': 'Mes plaintes',
  'tabs.submit': 'Soumettre',
  'tabs.tasks': 'Tâches',
  'tabs.inbox': 'Boîte de réception',
  'tabs.news': 'Actualités',
  'tabs.profile': 'Profil',

  'profile.personalInfo': 'Informations personnelles',
  'profile.edit': 'Modifier',
  'profile.firstName': 'Prénom',
  'profile.lastName': 'Nom',
  'profile.phone': 'Téléphone',
  'profile.email': 'E-mail',
  'profile.name': 'Nom',
  'profile.municipality': 'Municipalité',
  'profile.notSet': 'Non renseigné',
  'profile.notifications': 'Notifications',
  'profile.signOut': 'Déconnexion',
  'profile.signOutConfirm': 'Voulez-vous vraiment vous déconnecter ?',
  'profile.verified': 'Vérifié',
  'profile.verifyPending': 'Vérification en cours',
  'profile.verifyPendingHint': 'Vos documents sont en cours de vérification.',
  'profile.verifyMissing': 'Identité non vérifiée',
  'profile.verifyMissingHint': 'Appuyez pour vérifier votre identité et accéder à tous les services.',
  'profile.updated': 'Profil mis à jour',
  'profile.updateFailed': 'Impossible de mettre à jour le profil',

  'language.title': 'Langue',
  'language.subtitle': 'Choisissez l’affichage de l’application.',
  'language.saved': 'Langue mise à jour',
  'language.saveFailed': 'Impossible de mettre à jour la langue',
  'language.restartHint': 'Certains changements de mise en page peuvent nécessiter un redémarrage.',

  'lang.en': 'English',
  'lang.ar': 'العربية',
  'lang.fr': 'Français',
};

const dictionaries: Record<Locale, Partial<Record<MessageKey, string>>> = {
  en,
  ar,
  fr,
};

function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`,
  );
}

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const dict = dictionaries[locale] ?? en;
  const value = dict[key] ?? en[key] ?? key;
  return format(value, vars);
}
