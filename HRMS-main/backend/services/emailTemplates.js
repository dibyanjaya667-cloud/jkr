const BRAND = process.env.EMAIL_BRAND || 'HRMS';
const APP_URL = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173';

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const buildEmail = ({ title, preheader, intro, details = [], cta, footerNote }) => {
  const subject = `${BRAND} | ${title}`;
  const safePreheader = preheader || intro || title;

  const detailRows = (details || [])
    .filter((d) => d && d.label)
    .map((d) => `
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:13px;width:40%;vertical-align:top;">${d.label}</td>
        <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${d.value ?? '-'}</td>
      </tr>
    `)
    .join('');

  const detailsTable = detailRows
    ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:12px;border-top:1px solid #e5e7eb;">
        ${detailRows}
      </table>
    `
    : '';

  const ctaHtml = cta?.text && cta?.url
    ? `
      <div style="margin-top:20px;">
        <a href="${cta.url}" style="background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;display:inline-block;font-size:14px;">${cta.text}</a>
      </div>
    `
    : '';

  const footer = footerNote
    ? `<p style="margin:20px 0 0;color:#6b7280;font-size:12px;">${footerNote}</p>`
    : '';

  const html = `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${subject}</title>
    </head>
    <body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
      <div style="display:none;font-size:1px;color:#f3f4f6;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${safePreheader}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 30px rgba(15,23,42,0.08);">
              <tr>
                <td style="background:linear-gradient(90deg,#111827,#1f2937);padding:20px 28px;color:#ffffff;">
                  <div style="font-size:18px;font-weight:700;letter-spacing:0.4px;">${BRAND}</div>
                  <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:4px;">HRMS Notifications</div>
                </td>
              </tr>
              <tr>
                <td style="padding:28px;">
                  <h2 style="margin:0 0 10px;font-size:20px;color:#111827;">${title}</h2>
                  <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.6;">${intro || ''}</p>
                  ${detailsTable}
                  ${ctaHtml}
                  ${footer}
                </td>
              </tr>
              <tr>
                <td style="padding:18px 28px;background:#f9fafb;color:#9ca3af;font-size:12px;">
                  If you did not request this, please contact HR immediately.
                </td>
              </tr>
            </table>
            <div style="margin-top:12px;color:#9ca3af;font-size:11px;">© ${new Date().getFullYear()} ${BRAND}. All rights reserved.</div>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;

  const textDetails = (details || [])
    .filter((d) => d && d.label)
    .map((d) => `${d.label}: ${d.value ?? '-'}`)
    .join('\n');

  const text = [
    `${BRAND} | ${title}`,
    intro || '',
    textDetails,
    cta?.url ? `\n${cta.text || 'View'}: ${cta.url}` : '',
    footerNote || '',
  ].filter(Boolean).join('\n');

  return { subject, html, text };
};

const emailVerifiedEmail = ({ userName }) => buildEmail({
  title: 'Email Verified',
  preheader: 'Your email has been verified successfully.',
  intro: `Hi ${userName || 'there'}, your email has been verified. Your account is now pending HR activation.`,
  cta: { text: 'Go to Login', url: `${APP_URL}/login` },
});

const accountStatusEmail = ({ userName, active, activatedBy }) => buildEmail({
  title: active ? 'Account Activated' : 'Account Deactivated',
  preheader: active ? 'Your account is now active.' : 'Your account has been deactivated.',
  intro: active
    ? `Hi ${userName || 'there'}, your HRMS account is now active.`
    : `Hi ${userName || 'there'}, your HRMS account has been deactivated.`,
  details: [
    { label: 'Status', value: active ? 'Active' : 'Inactive' },
    activatedBy ? { label: 'Updated By', value: activatedBy } : null,
  ].filter(Boolean),
  cta: active ? { text: 'Login to HRMS', url: `${APP_URL}/login` } : null,
  footerNote: active ? 'You can now sign in and complete your profile.' : 'Please contact HR for assistance.',
});

const leaveStatusEmail = ({ userName, status, leaveType, startDate, endDate, totalDays, approverName, note }) => buildEmail({
  title: `Leave ${status === 'approved' ? 'Approved' : 'Rejected'}`,
  preheader: `Your leave request has been ${status}.`,
  intro: `Hi ${userName || 'there'}, your ${leaveType} leave request has been ${status}.`,
  details: [
    { label: 'Leave Type', value: leaveType },
    { label: 'Dates', value: `${formatDate(startDate)} - ${formatDate(endDate)}` },
    { label: 'Total Days', value: totalDays },
    approverName ? { label: 'Action By', value: approverName } : null,
    note ? { label: 'Note', value: note } : null,
  ].filter(Boolean),
  cta: { text: 'View Leave', url: `${APP_URL}/leave-management` },
});

const wfhStatusEmail = ({ userName, status, startDate, endDate, totalDays, approverName, note }) => buildEmail({
  title: `WFH ${status === 'approved' ? 'Approved' : 'Rejected'}`,
  preheader: `Your WFH request has been ${status}.`,
  intro: `Hi ${userName || 'there'}, your WFH request has been ${status}.`,
  details: [
    { label: 'Dates', value: `${formatDate(startDate)} - ${formatDate(endDate)}` },
    { label: 'Total Days', value: totalDays },
    approverName ? { label: 'Action By', value: approverName } : null,
    note ? { label: 'Note', value: note } : null,
  ].filter(Boolean),
  cta: { text: 'View WFH', url: `${APP_URL}/wfh-management` },
});

const passwordChangedEmail = ({ userName, changedAt }) => buildEmail({
  title: 'Password Changed',
  preheader: 'Your password has been updated.',
  intro: `Hi ${userName || 'there'}, your HRMS password was changed successfully.`,
  details: [
    { label: 'Time', value: formatTime(changedAt || new Date()) },
    { label: 'Date', value: formatDate(changedAt || new Date()) },
  ],
  footerNote: 'If this was not you, contact HR immediately and reset your password.',
  cta: { text: 'Login', url: `${APP_URL}/login` },
});

const tempPasswordEmail = ({ userName, tempPassword, purpose }) => buildEmail({
  title: 'Temporary Password',
  preheader: 'A temporary password has been issued for your account.',
  intro: `Hi ${userName || 'there'}, ${purpose || 'a temporary password has been created for your HRMS account'}.`,
  details: [
    { label: 'Temporary Password', value: tempPassword },
    { label: 'Next Step', value: 'Login and change your password immediately.' },
  ],
  cta: { text: 'Login', url: `${APP_URL}/login` },
  footerNote: 'Do not share this password with anyone.',
});

const missedPunchOutEmail = ({ userName, date, autoTime }) => buildEmail({
  title: 'Punch-out Missing',
  preheader: 'Your punch-out was auto-closed.',
  intro: `Hi ${userName || 'there'}, your punch-out was auto-closed due to missing punch-out.`,
  details: [
    { label: 'Date', value: formatDate(date) },
    { label: 'Auto Punch-out Time', value: formatTime(autoTime) },
  ],
  cta: { text: 'View Attendance', url: `${APP_URL}/dashboard` },
  footerNote: 'Please ensure you punch out on time to avoid attendance issues.',
});

const accountCreatedEmail = ({ userName, tempPassword }) => buildEmail({
  title: 'Your HRMS Account',
  preheader: 'Your account has been created by admin.',
  intro: `Hi ${userName || 'there'}, your HRMS account has been created by admin.`,
  details: tempPassword ? [
    { label: 'Temporary Password', value: tempPassword },
    { label: 'Next Step', value: 'Login and change your password immediately.' },
  ] : [
    { label: 'Next Step', value: 'Login using the password provided by admin.' },
  ],
  cta: { text: 'Login', url: `${APP_URL}/login` },
  footerNote: 'If you did not expect this email, contact HR.',
});

const profileStatusEmail = ({ userName, status, reviewerName, rejectionReason }) => buildEmail({
  title: status === 'approved' ? 'Profile Verified' : 'Profile Rejected',
  preheader: status === 'approved'
    ? 'Your profile has been verified successfully.'
    : 'Your profile verification was rejected.',
  intro: status === 'approved'
    ? `Hi ${userName || 'there'}, your profile has been verified.`
    : `Hi ${userName || 'there'}, your profile verification was rejected.`,
  details: [
    { label: 'Status', value: status === 'approved' ? 'Approved' : 'Rejected' },
    reviewerName ? { label: 'Reviewed By', value: reviewerName } : null,
    rejectionReason ? { label: 'Reason', value: rejectionReason } : null,
  ].filter(Boolean),
  cta: { text: 'Open Profile', url: `${APP_URL}/profile-details` },
  footerNote: status === 'approved'
    ? 'You can continue using HRMS without any restrictions.'
    : 'Please update your profile and resubmit for verification.',
});

const otpVerificationEmail = ({ userName, otp, expiresInMinutes }) => buildEmail({
  title: 'Email Verification Code',
  preheader: 'Your OTP is ready. It expires soon.',
  intro: `Hi ${userName || 'there'}, use the OTP below to verify your email address.`,
  details: [
    { label: 'OTP Code', value: otp },
    { label: 'Expiry', value: `${expiresInMinutes || 10} minutes` },
  ],
  footerNote: 'If you did not request this, please ignore this email.',
});

module.exports = {
  buildEmail,
  formatDate,
  formatTime,
  emailVerifiedEmail,
  accountStatusEmail,
  leaveStatusEmail,
  wfhStatusEmail,
  passwordChangedEmail,
  tempPasswordEmail,
  missedPunchOutEmail,
  accountCreatedEmail,
  otpVerificationEmail,
  profileStatusEmail,
};
