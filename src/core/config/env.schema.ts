import * as Joi from 'joi';

/**
 * Environment validation schema. Anything not listed here is allowed
 * (Joi unknown defaults to true). The required fields are the ones
 * we genuinely cannot start without.
 */
export const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRATION: Joi.string().default('7d'),
  UPLOAD_PATH: Joi.string().default('./uploads'),
  MAX_FILE_SIZE: Joi.number().default(10485760), // 10MB

  // Public URLs (used in email links, CORS, etc.)
  APP_PUBLIC_URL: Joi.string().uri().optional().allow(''),
  API_PUBLIC_URL: Joi.string().uri().optional().allow(''),
  FRONTEND_URL: Joi.string().uri().optional().allow(''),

  // CORS
  CORS_ORIGINS: Joi.string().optional().allow(''),

  // Firebase
  FIREBASE_SERVICE_ACCOUNT_PATH: Joi.string().optional().allow(''),
  FIREBASE_SERVICE_ACCOUNT: Joi.string().optional().allow(''),
  FCM_SERVER_KEY: Joi.string().optional().allow(''),

  // Mail (Resend preferred; SMTP fallback)
  RESEND_API_KEY: Joi.string().optional().allow(''),
  MAIL_FROM: Joi.string().optional().allow(''),
  MAIL_FROM_NAME: Joi.string().optional().allow(''),
  MAIL_REPLY_TO: Joi.string().email().optional().allow(''),
  SMTP_HOST: Joi.string().optional().allow(''),
  SMTP_PORT: Joi.number().optional(),
  SMTP_SECURE: Joi.string().optional().allow(''),
  SMTP_USER: Joi.string().optional().allow(''),
  SMTP_PASSWORD: Joi.string().optional().allow(''),

  // Observability
  SENTRY_DSN: Joi.string().optional().allow(''),
  ENABLE_SWAGGER: Joi.string().optional().allow(''),
  LOG_LEVEL: Joi.string().optional().allow(''),
});
