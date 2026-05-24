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
  'common.ok': 'OK',

  // Auth / login
  'auth.subtitle': 'Municipal Issue Reporting',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.passwordPlaceholder': 'Enter your password',
  'auth.signIn': 'Sign In',
  'auth.signUp': 'Sign Up',
  'auth.noAccount': "Don't have an account?",
  'auth.fillAll': 'Please fill in all fields',
  'auth.loginFailed': 'Login Failed',
  'auth.serverError': 'Could not connect to server',
  'auth.2fa.totpSubtitle': 'Enter the 6-digit code from your authenticator app',
  'auth.2fa.emailSubtitle': 'Enter the 6-digit code sent to your email',
  'auth.2fa.verify': 'Verify & Sign In',
  'auth.2fa.back': 'Back to login',
  'auth.2fa.resend': "Didn't get the code? Resend",
  'auth.2fa.resending': 'Resending…',
  'auth.2fa.codeResent': 'A new sign-in code has been sent to your email.',
  'auth.2fa.invalidTitle': 'Invalid Code',
  'auth.2fa.invalid': 'Verification failed',
  'auth.unverified.title': 'Email not verified',
  'auth.unverified.body': 'Check your inbox for the verification link, or resend it below.',
  'auth.unverified.resend': 'Resend verification email',
  'auth.unverified.resendSuccess': 'If an account exists, a verification email has been sent.',

  // Staff 2FA enrollment
  'enroll2fa.title': 'Two-factor authentication required',
  'enroll2fa.body':
    'Your organization requires 2FA for staff accounts. Enable email-based 2FA below, or use the web dashboard for an authenticator app.',
  'enroll2fa.emailTitle': 'Email-based 2FA',
  'enroll2fa.emailHint': 'You will receive a 6-digit code by email at each sign-in.',
  'enroll2fa.emailNotVerified': 'Verify your email on the web dashboard before enabling email 2FA.',
  'enroll2fa.password': 'Current password',
  'enroll2fa.passwordRequired': 'Enter your password to continue',
  'enroll2fa.enableEmail': 'Enable email 2FA',
  'enroll2fa.emailSuccess': 'Email-based two-factor authentication is now enabled.',
  'enroll2fa.enableFailed': 'Could not enable two-factor authentication',
  'enroll2fa.totpWebOnly':
    'Authenticator app (TOTP) setup is available on the web dashboard under Profile → Security.',

  // Profile 2FA status
  'profile.2fa.title': 'Two-Factor Authentication',
  'profile.2fa.enabled': 'Enabled',
  'profile.2fa.disabled': 'Not enabled',
  'profile.2fa.methodTotp': 'Authenticator app',
  'profile.2fa.methodEmail': 'Email code',
  'profile.2fa.manageWeb': 'Manage 2FA on the web dashboard',

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
  'common.ok': 'موافق',

  'auth.subtitle': 'الإبلاغ عن المشكلات البلدية',
  'auth.email': 'البريد الإلكتروني',
  'auth.password': 'كلمة المرور',
  'auth.passwordPlaceholder': 'أدخل كلمة المرور',
  'auth.signIn': 'تسجيل الدخول',
  'auth.signUp': 'إنشاء حساب',
  'auth.noAccount': 'ليس لديك حساب؟',
  'auth.fillAll': 'يرجى تعبئة جميع الحقول',
  'auth.loginFailed': 'فشل تسجيل الدخول',
  'auth.serverError': 'تعذّر الاتصال بالخادم',
  'auth.2fa.totpSubtitle': 'أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة',
  'auth.2fa.emailSubtitle': 'أدخل الرمز المكوّن من 6 أرقام المرسل إلى بريدك',
  'auth.2fa.verify': 'تحقق وسجّل الدخول',
  'auth.2fa.back': 'العودة لتسجيل الدخول',
  'auth.2fa.resend': 'لم يصلك الرمز؟ إعادة الإرسال',
  'auth.2fa.resending': 'جارٍ إعادة الإرسال…',
  'auth.2fa.codeResent': 'تم إرسال رمز تسجيل دخول جديد إلى بريدك.',
  'auth.2fa.invalidTitle': 'رمز غير صالح',
  'auth.2fa.invalid': 'فشل التحقق',
  'auth.unverified.title': 'البريد غير مؤكّد',
  'auth.unverified.body': 'تحقق من بريدك للحصول على رابط التأكيد، أو أعد الإرسال أدناه.',
  'auth.unverified.resend': 'إعادة إرسال بريد التأكيد',
  'auth.unverified.resendSuccess': 'إذا وُجد حساب، تم إرسال بريد التأكيد.',

  'enroll2fa.title': 'التحقق الثنائي مطلوب',
  'enroll2fa.body':
    'تتطلّب مؤسستك التحقق الثنائي لحسابات الموظفين. فعّل التحقق عبر البريد أدناه، أو استخدم لوحة الويب لتطبيق المصادقة.',
  'enroll2fa.emailTitle': 'التحقق الثنائي عبر البريد',
  'enroll2fa.emailHint': 'ستستلم رمزًا من 6 أرقام عبر البريد عند كل تسجيل دخول.',
  'enroll2fa.emailNotVerified': 'أكّد بريدك عبر لوحة الويب قبل تفعيل التحقق عبر البريد.',
  'enroll2fa.password': 'كلمة المرور الحالية',
  'enroll2fa.passwordRequired': 'أدخل كلمة المرور للمتابعة',
  'enroll2fa.enableEmail': 'تفعيل التحقق عبر البريد',
  'enroll2fa.emailSuccess': 'تم تفعيل التحقق الثنائي عبر البريد.',
  'enroll2fa.enableFailed': 'تعذّر تفعيل التحقق الثنائي',
  'enroll2fa.totpWebOnly':
    'إعداد تطبيق المصادقة (TOTP) متاح على لوحة الويب ضمن الملف الشخصي → الأمان.',

  'profile.2fa.title': 'التحقق الثنائي',
  'profile.2fa.enabled': 'مفعّل',
  'profile.2fa.disabled': 'غير مفعّل',
  'profile.2fa.methodTotp': 'تطبيق المصادقة',
  'profile.2fa.methodEmail': 'رمز عبر البريد',
  'profile.2fa.manageWeb': 'إدارة التحقق الثنائي من لوحة الويب',

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
  'common.ok': 'OK',

  'auth.subtitle': 'Signalement municipal',
  'auth.email': 'E-mail',
  'auth.password': 'Mot de passe',
  'auth.passwordPlaceholder': 'Saisissez votre mot de passe',
  'auth.signIn': 'Connexion',
  'auth.signUp': 'Inscription',
  'auth.noAccount': 'Pas de compte ?',
  'auth.fillAll': 'Veuillez remplir tous les champs',
  'auth.loginFailed': 'Échec de la connexion',
  'auth.serverError': 'Impossible de joindre le serveur',
  'auth.2fa.totpSubtitle': 'Saisissez le code à 6 chiffres de votre application',
  'auth.2fa.emailSubtitle': 'Saisissez le code à 6 chiffres envoyé par e-mail',
  'auth.2fa.verify': 'Vérifier et se connecter',
  'auth.2fa.back': 'Retour à la connexion',
  'auth.2fa.resend': 'Code non reçu ? Renvoyer',
  'auth.2fa.resending': 'Envoi…',
  'auth.2fa.codeResent': 'Un nouveau code de connexion a été envoyé par e-mail.',
  'auth.2fa.invalidTitle': 'Code invalide',
  'auth.2fa.invalid': 'Échec de la vérification',
  'auth.unverified.title': 'E-mail non vérifié',
  'auth.unverified.body': 'Consultez votre boîte de réception ou renvoyez le lien ci-dessous.',
  'auth.unverified.resend': "Renvoyer l'e-mail de vérification",
  'auth.unverified.resendSuccess': 'Si un compte existe, un e-mail de vérification a été envoyé.',

  'enroll2fa.title': 'Authentification à deux facteurs requise',
  'enroll2fa.body':
    'Votre organisation exige la 2FA pour le personnel. Activez la 2FA par e-mail ci-dessous, ou utilisez le tableau de bord web pour une application d\'authentification.',
  'enroll2fa.emailTitle': '2FA par e-mail',
  'enroll2fa.emailHint': 'Vous recevrez un code à 6 chiffres par e-mail à chaque connexion.',
  'enroll2fa.emailNotVerified': 'Vérifiez votre e-mail sur le tableau de bord web avant d\'activer la 2FA par e-mail.',
  'enroll2fa.password': 'Mot de passe actuel',
  'enroll2fa.passwordRequired': 'Saisissez votre mot de passe pour continuer',
  'enroll2fa.enableEmail': 'Activer la 2FA par e-mail',
  'enroll2fa.emailSuccess': 'La 2FA par e-mail est maintenant activée.',
  'enroll2fa.enableFailed': "Impossible d'activer la 2FA",
  'enroll2fa.totpWebOnly':
    'La configuration par application (TOTP) est disponible sur le tableau de bord web, Profil → Sécurité.',

  'profile.2fa.title': 'Authentification à deux facteurs',
  'profile.2fa.enabled': 'Activée',
  'profile.2fa.disabled': 'Non activée',
  'profile.2fa.methodTotp': 'Application d\'authentification',
  'profile.2fa.methodEmail': 'Code par e-mail',
  'profile.2fa.manageWeb': 'Gérer la 2FA sur le tableau de bord web',

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
