const requiredVars = [
  'MONGODB_URI',
  'JWT_SECRET',
];

const optionalVars = [
  'PORT',
  'NODE_ENV',
  'BACKEND_URL',
  'EMAIL_FROM',
  'BREVO_API_KEY',
  'BREVO_SMTP_HOST',
  'BREVO_SMTP_PORT',
  'BREVO_SMTP_USER',
  'BREVO_SMTP_PASS',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'STORAGE_UPLOAD_URL',
  'STORAGE_UPLOAD_KEY',
  'STORAGE_BASE_URL',
  'ATTENDANCE_CUTOFF_HOUR',
  'ATTENDANCE_CUTOFF_MINUTE',
  'ACCESS_TOKEN_TTL',
  'REFRESH_TOKEN_TTL_DAYS',
  'EMAIL_DEBUG',
];

const validateEnv = () => {
  const missing = requiredVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    const msg = `Missing required env vars: ${missing.join(', ')}`;
    throw new Error(msg);
  }

  const unused = optionalVars.filter((key) => process.env[key] === undefined);
  if (unused.length === optionalVars.length) {
    // Intentionally no-op; optional values are fine.
  }
};

module.exports = { validateEnv };
