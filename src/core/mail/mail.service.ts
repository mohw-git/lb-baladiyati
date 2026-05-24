import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';

type Locale = 'EN' | 'AR' | 'FR';

interface SendArgs {
  to: string;
  subject: string;
  /** Plain-text body. Always provided. */
  text: string;
  /** Optional HTML body. */
  html?: string;
  locale?: Locale;
  /**
   * Optional context for structured logging — e.g. "verify_email", "reset_password",
   * "login_2fa_otp". Surfaces in pino so operators can grep delivery outcomes by
   * intent without parsing subject strings.
   */
  event?: string;
}

/** Structured outcome returned by send(). Never throws. */
export interface MailSendResult {
  delivered: boolean;
  provider: 'resend' | 'smtp' | 'noop';
  /** Resend message id / SMTP messageId, when available. */
  providerId?: string;
  /** Free-text error message if delivery failed. */
  error?: string;
}

/**
 * Centralized mail service.
 *
 * Provider order of preference:
 *   1. Resend (if RESEND_API_KEY is set) — preferred for production
 *   2. SMTP via nodemailer (if SMTP_HOST is set) — fallback
 *   3. Console logger (development) — never sends
 *
 * Templates live in this file as small string functions returning
 * `{ subject, text, html }` and are responsible for their own EN/AR/FR copy.
 *
 * Failures NEVER throw. The caller can rely on `send()` to swallow and log
 * any provider error so business events (complaint update, KYC review,
 * announcement publish) keep working even when email is degraded.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private resend: Resend | null = null;
  private smtp: nodemailer.Transporter | null = null;
  private fromAddress = 'Baladi <noreply@lb-baladiyati.com>';
  private replyToAddress: string | undefined;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const resendKey = this.config.get<string>('RESEND_API_KEY');
    const fromName = this.config.get<string>('MAIL_FROM_NAME') ?? 'Baladi';
    const fromEmail = this.config.get<string>('MAIL_FROM');
    if (fromEmail) {
      // If MAIL_FROM is already in "Name <email>" format we keep it; otherwise wrap.
      this.fromAddress = fromEmail.includes('<')
        ? fromEmail
        : `${fromName} <${fromEmail}>`;
    }
    this.replyToAddress = this.config.get<string>('MAIL_REPLY_TO') || undefined;

    if (resendKey) {
      this.resend = new Resend(resendKey);
      this.logger.log('Mail provider: Resend');
      return;
    }

    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
      const secure = (this.config.get<string>('SMTP_SECURE') ?? 'false').toLowerCase() === 'true';
      const user = this.config.get<string>('SMTP_USER');
      const pass = this.config.get<string>('SMTP_PASSWORD');
      this.smtp = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined,
      });
      this.logger.log(`Mail provider: SMTP (${host}:${port})`);
      return;
    }

    this.logger.warn(
      'No mail provider configured (RESEND_API_KEY or SMTP_HOST) — emails will be logged to console only.',
    );
  }

  async send(args: SendArgs): Promise<MailSendResult> {
    const toMasked = redactEmail(args.to);
    const event = args.event ?? 'email';

    // ───────────────────────── Resend ─────────────────────────
    if (this.resend) {
      try {
        const result = await this.resend.emails.send({
          from: this.fromAddress,
          to: args.to,
          subject: args.subject,
          text: args.text,
          html: args.html ?? `<pre>${args.text}</pre>`,
          ...(this.replyToAddress ? { replyTo: this.replyToAddress } : {}),
        });
        // Resend SDK shape: { data: { id }, error: null } on success,
        // { data: null, error: { name, message } } on failure.
        const data = (result as any)?.data ?? null;
        const error = (result as any)?.error ?? null;
        const providerId = data?.id as string | undefined;

        if (error) {
          this.logger.error({
            event: `${event}.delivery_failed`,
            provider: 'resend',
            to: toMasked,
            subject: args.subject,
            reason: error?.message ?? error?.name ?? 'unknown',
            statusCode: error?.statusCode,
          }, `Resend rejected email to ${toMasked}: ${error?.message ?? 'unknown'}`);
          return {
            delivered: false,
            provider: 'resend',
            error: error?.message ?? 'unknown',
          };
        }

        if (!providerId) {
          // No id returned — treat as suppression / no-op. Resend will
          // sometimes accept the request but skip sending for hard-bounced
          // or complained recipients.
          this.logger.warn({
            event: `${event}.suppressed`,
            provider: 'resend',
            to: toMasked,
            subject: args.subject,
          }, `Resend returned no message id for ${toMasked} — possible suppression`);
          return {
            delivered: false,
            provider: 'resend',
            error: 'no_message_id_returned',
          };
        }

        this.logger.log({
          event: `${event}.sent`,
          provider: 'resend',
          providerId,
          to: toMasked,
          subject: args.subject,
        }, `Email sent via Resend to ${toMasked} (id=${providerId})`);
        return { delivered: true, provider: 'resend', providerId };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown';
        this.logger.error({
          event: `${event}.send_threw`,
          provider: 'resend',
          to: toMasked,
          subject: args.subject,
          reason: message,
        }, `Resend send threw for ${toMasked}: ${message}`);
        return { delivered: false, provider: 'resend', error: message };
      }
    }

    // ───────────────────────── SMTP ────────────────────────────
    if (this.smtp) {
      try {
        const info = await this.smtp.sendMail({
          from: this.fromAddress,
          to: args.to,
          subject: args.subject,
          text: args.text,
          html: args.html ?? `<pre>${args.text}</pre>`,
          ...(this.replyToAddress ? { replyTo: this.replyToAddress } : {}),
        });
        const providerId = (info as any)?.messageId as string | undefined;
        this.logger.log({
          event: `${event}.sent`,
          provider: 'smtp',
          providerId,
          to: toMasked,
          subject: args.subject,
        }, `Email sent via SMTP to ${toMasked}`);
        return { delivered: true, provider: 'smtp', providerId };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown';
        this.logger.error({
          event: `${event}.send_threw`,
          provider: 'smtp',
          to: toMasked,
          subject: args.subject,
          reason: message,
        }, `SMTP send failed for ${toMasked}: ${message}`);
        return { delivered: false, provider: 'smtp', error: message };
      }
    }

    // ──────────────── Dev fallback (no provider) ───────────────
    this.logger.warn({
      event: `${event}.noop`,
      provider: 'noop',
      to: toMasked,
      subject: args.subject,
    }, `No mail provider configured — email to ${toMasked} not sent (dev fallback).`);
    this.logger.debug(args.text);
    return { delivered: false, provider: 'noop', error: 'no_provider_configured' };
  }

  // ─────────────────────────── TEMPLATES ───────────────────────────

  passwordReset(
    locale: Locale,
    args: { resetUrl: string; expiresInMinutes: number; firstName?: string },
  ): { subject: string; text: string; html: string } {
    if (locale === 'AR') {
      const subject = 'إعادة تعيين كلمة المرور - بلدي';
      const text = `مرحبًا${args.firstName ? ` ${args.firstName}` : ''}،\n\nلقد تلقّينا طلبًا لإعادة تعيين كلمة المرور.\nرابط إعادة التعيين (صالح لمدة ${args.expiresInMinutes} دقيقة):\n\n${args.resetUrl}\n\nإذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة.\n\nفريق بلدي`;
      return { subject, text, html: htmlWrap(subject, text, true) };
    }
    if (locale === 'FR') {
      const subject = 'Réinitialisation du mot de passe — Baladi';
      const text = `Bonjour${args.firstName ? ` ${args.firstName}` : ''},\n\nVous avez demandé la réinitialisation de votre mot de passe.\nLien (valable ${args.expiresInMinutes} minutes) :\n\n${args.resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message.\n\nL'équipe Baladi`;
      return { subject, text, html: htmlWrap(subject, text) };
    }
    const subject = 'Reset your Baladi password';
    const text = `Hello${args.firstName ? ` ${args.firstName}` : ''},\n\nWe received a request to reset your Baladi password.\nThis link is valid for ${args.expiresInMinutes} minutes:\n\n${args.resetUrl}\n\nIf you did not request this, you can safely ignore this email.\n\n— Baladi Team`;
    return { subject, text, html: htmlWrap(subject, text) };
  }

  emailVerification(
    locale: Locale,
    args: { verifyUrl: string; expiresInMinutes: number; firstName?: string },
  ): { subject: string; text: string; html: string } {
    if (locale === 'AR') {
      const subject = 'تأكيد البريد الإلكتروني - بلدي';
      const text = `مرحبًا${args.firstName ? ` ${args.firstName}` : ''}،\n\nيرجى تأكيد بريدك الإلكتروني للمتابعة.\nالرابط صالح لمدة ${args.expiresInMinutes} دقيقة:\n\n${args.verifyUrl}\n\nإذا لم تنشئ هذا الحساب، يمكنك تجاهل هذه الرسالة.\n\nفريق بلدي`;
      return { subject, text, html: htmlWrap(subject, text, true) };
    }
    if (locale === 'FR') {
      const subject = 'Confirmez votre adresse e-mail — Baladi';
      const text = `Bonjour${args.firstName ? ` ${args.firstName}` : ''},\n\nVeuillez confirmer votre adresse e-mail pour continuer.\nCe lien est valable ${args.expiresInMinutes} minutes :\n\n${args.verifyUrl}\n\nSi vous n'avez pas créé de compte, ignorez ce message.\n\nL'équipe Baladi`;
      return { subject, text, html: htmlWrap(subject, text) };
    }
    const subject = 'Confirm your email — Baladi';
    const text = `Hello${args.firstName ? ` ${args.firstName}` : ''},\n\nPlease confirm your email address to continue.\nThis link is valid for ${args.expiresInMinutes} minutes:\n\n${args.verifyUrl}\n\nIf you did not create this account, you can safely ignore this email.\n\n— Baladi Team`;
    return { subject, text, html: htmlWrap(subject, text) };
  }

  emailOtp(
    locale: Locale,
    args: { code: string; expiresInMinutes: number; purpose?: 'LOGIN' | 'GENERIC' },
  ): { subject: string; text: string; html: string } {
    const isLogin = args.purpose === 'LOGIN';
    if (locale === 'AR') {
      const subject = isLogin
        ? 'رمز تسجيل الدخول - بلدي'
        : 'رمز التحقق الخاص بك';
      const text = `${isLogin ? 'رمز تسجيل الدخول' : 'رمز التحقق'}: ${args.code}\n\nصالح لمدة ${args.expiresInMinutes} دقيقة. لا تشاركه مع أي شخص.\nإذا لم تطلب هذا الرمز، يرجى تأمين حسابك فورًا.\n\nفريق بلدي`;
      return { subject, text, html: htmlWrap(subject, text, true) };
    }
    if (locale === 'FR') {
      const subject = isLogin
        ? 'Code de connexion — Baladi'
        : 'Votre code de vérification';
      const text = `${isLogin ? 'Code de connexion' : 'Code de vérification'} : ${args.code}\n\nValable ${args.expiresInMinutes} minutes. Ne le partagez avec personne.\nSi vous n'avez pas demandé ce code, sécurisez immédiatement votre compte.\n\nL'équipe Baladi`;
      return { subject, text, html: htmlWrap(subject, text) };
    }
    const subject = isLogin ? 'Your Baladi sign-in code' : 'Your verification code';
    const text = `${isLogin ? 'Sign-in code' : 'Verification code'}: ${args.code}\n\nThis code is valid for ${args.expiresInMinutes} minutes. Do not share it with anyone.\nIf you didn't request this, please secure your account.\n\n— Baladi Team`;
    return { subject, text, html: htmlWrap(subject, text) };
  }

  kycApproved(locale: Locale, firstName?: string) {
    if (locale === 'AR') {
      const subject = 'تم التحقق من هويتك';
      const text = `مرحبًا${firstName ? ` ${firstName}` : ''}،\nتم التحقق من هويتك بنجاح. يمكنك الآن تقديم الشكاوى ومتابعتها.\n\nفريق بلدي`;
      return { subject, text, html: htmlWrap(subject, text, true) };
    }
    if (locale === 'FR') {
      const subject = 'Votre identité a été vérifiée';
      const text = `Bonjour${firstName ? ` ${firstName}` : ''},\nVotre identité a été vérifiée avec succès. Vous pouvez désormais déposer et suivre des réclamations.\n\nL'équipe Baladi`;
      return { subject, text, html: htmlWrap(subject, text) };
    }
    const subject = 'Your identity has been verified';
    const text = `Hello${firstName ? ` ${firstName}` : ''},\nYour identity has been verified. You can now submit and track municipal complaints.\n\n— Baladi Team`;
    return { subject, text, html: htmlWrap(subject, text) };
  }

  kycRejected(
    locale: Locale,
    args: { firstName?: string; reason?: string },
  ) {
    if (locale === 'AR') {
      const subject = 'تعذّر التحقق من هويتك';
      const text = `مرحبًا${args.firstName ? ` ${args.firstName}` : ''}،\nتعذّر التحقق من هويتك.${args.reason ? `\nالسبب: ${args.reason}` : ''}\nيمكنك إعادة التقديم بعد التحقق من المستندات.\n\nفريق بلدي`;
      return { subject, text, html: htmlWrap(subject, text, true) };
    }
    if (locale === 'FR') {
      const subject = 'Vérification d\'identité refusée';
      const text = `Bonjour${args.firstName ? ` ${args.firstName}` : ''},\nVotre vérification d'identité n'a pas pu être validée.${args.reason ? `\nMotif : ${args.reason}` : ''}\nVous pouvez soumettre à nouveau après vérification de vos documents.\n\nL'équipe Baladi`;
      return { subject, text, html: htmlWrap(subject, text) };
    }
    const subject = 'Identity verification rejected';
    const text = `Hello${args.firstName ? ` ${args.firstName}` : ''},\nYour identity verification could not be validated.${args.reason ? `\nReason: ${args.reason}` : ''}\nYou can resubmit after reviewing your documents.\n\n— Baladi Team`;
    return { subject, text, html: htmlWrap(subject, text) };
  }

  /**
   * Citizen-facing complaint status update.
   * Critical: NEVER include staff identity, internal notes, or assignee names.
   * Only the reference code, the localized status, and a safe link are exposed.
   */
  complaintStatusChanged(
    locale: Locale,
    args: {
      referenceCode: string;
      localizedStatus: string;
      complaintUrl: string;
      firstName?: string;
    },
  ): { subject: string; text: string; html: string } {
    if (locale === 'AR') {
      const subject = `تحديث حالة الشكوى ${args.referenceCode}`;
      const text = `مرحبًا${args.firstName ? ` ${args.firstName}` : ''}،\n\nحالة الشكوى رقم ${args.referenceCode} أصبحت الآن: ${args.localizedStatus}.\n\nيمكنك مراجعة التفاصيل من خلال الرابط التالي:\n${args.complaintUrl}\n\nفريق بلدي`;
      return { subject, text, html: htmlWrap(subject, text, true) };
    }
    if (locale === 'FR') {
      const subject = `Mise à jour de la réclamation ${args.referenceCode}`;
      const text = `Bonjour${args.firstName ? ` ${args.firstName}` : ''},\n\nLe statut de la réclamation ${args.referenceCode} est désormais : ${args.localizedStatus}.\n\nConsulter les détails :\n${args.complaintUrl}\n\nL'équipe Baladi`;
      return { subject, text, html: htmlWrap(subject, text) };
    }
    const subject = `Complaint ${args.referenceCode} update`;
    const text = `Hello${args.firstName ? ` ${args.firstName}` : ''},\n\nYour complaint ${args.referenceCode} is now: ${args.localizedStatus}.\n\nView details:\n${args.complaintUrl}\n\n— Baladi Team`;
    return { subject, text, html: htmlWrap(subject, text) };
  }

  newsPublished(
    locale: Locale,
    args: {
      title: string;
      municipalityName: string;
      announcementUrl: string;
    },
  ): { subject: string; text: string; html: string } {
    if (locale === 'AR') {
      const subject = `إعلان جديد من ${args.municipalityName}`;
      const text = `${args.title}\n\nاطّلع على الإعلان كاملًا:\n${args.announcementUrl}\n\nفريق بلدي`;
      return { subject, text, html: htmlWrap(subject, text, true) };
    }
    if (locale === 'FR') {
      const subject = `Nouvelle annonce de ${args.municipalityName}`;
      const text = `${args.title}\n\nLire l'annonce :\n${args.announcementUrl}\n\nL'équipe Baladi`;
      return { subject, text, html: htmlWrap(subject, text) };
    }
    const subject = `New announcement from ${args.municipalityName}`;
    const text = `${args.title}\n\nRead the full announcement:\n${args.announcementUrl}\n\n— Baladi Team`;
    return { subject, text, html: htmlWrap(subject, text) };
  }
}

function htmlWrap(subject: string, body: string, rtl = false): string {
  const dir = rtl ? 'rtl' : 'ltr';
  const safeBody = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!doctype html>
<html dir="${dir}">
  <body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#f7f8fb; padding:24px;">
    <div style="max-width:560px; margin:0 auto; background:#ffffff; border:1px solid #e3e6ec; border-radius:6px; padding:24px;">
      <h1 style="margin:0 0 12px; font-size:18px; color:#0c1a2e;">${subject}</h1>
      <pre style="white-space:pre-wrap; font-family:inherit; font-size:14px; line-height:1.6; color:#374151;">${safeBody}</pre>
      <hr style="border:none; border-top:1px solid #e3e6ec; margin:18px 0;" />
      <p style="margin:0; font-size:11px; color:#6b7280;">This is an automated message from the Baladi platform. Please do not reply.</p>
    </div>
  </body>
</html>`;
}

/** Mask local-part of email for log lines so we never log full addresses. */
export function redactEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  if (local.length <= 2) return `${local[0] ?? '*'}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}
