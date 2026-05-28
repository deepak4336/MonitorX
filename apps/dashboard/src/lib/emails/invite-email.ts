export interface InviteEmailProps {
  organizationName: string;
  invitedByEmail: string;
  role: string;
  inviteUrl: string;
  expiresAt: Date;
}

export function buildInviteEmailHtml(props: InviteEmailProps): string {
  const roleColors: Record<string, string> = {
    owner: '#ef4444',
    developer: '#3b82f6',
    viewer: '#6b7280',
  };
  const color = roleColors[props.role] ?? '#3b82f6';
  const expiryDate = new Date(props.expiresAt).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#e5e5e5;margin:0;padding:40px 20px;">
  <div style="max-width:560px;margin:0 auto;background:#141414;border-radius:8px;border:1px solid #262626;overflow:hidden;">

    <div style="background:#1a1a1a;padding:20px 24px;border-bottom:1px solid #262626;">
      <span style="font-weight:600;font-size:15px;">⚡ MonitorX</span>
    </div>

    <div style="padding:24px;">
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;">You've been invited!</h2>
      <p style="margin:0 0 24px;color:#a3a3a3;font-size:14px;">
        <strong style="color:#e5e5e5;">${props.invitedByEmail}</strong> has invited you to join
        <strong style="color:#e5e5e5;">${props.organizationName}</strong> on MonitorX.
      </p>

      <div style="background:#1e1e1e;border-radius:6px;padding:16px;border:1px solid #262626;margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <p style="margin:0 0 4px;font-size:12px;color:#737373;text-transform:uppercase;letter-spacing:0.05em;">Organization</p>
            <p style="margin:0;font-size:15px;font-weight:600;">${props.organizationName}</p>
          </div>
          <div style="text-align:right;">
            <p style="margin:0 0 4px;font-size:12px;color:#737373;text-transform:uppercase;letter-spacing:0.05em;">Role</p>
            <span style="background:${color}22;color:${color};padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600;text-transform:capitalize;border:1px solid ${color}44;">${props.role}</span>
          </div>
        </div>
      </div>

      <a href="${props.inviteUrl}" style="display:block;background:#e5e5e5;color:#0a0a0a;text-align:center;padding:14px;border-radius:6px;font-weight:600;font-size:14px;text-decoration:none;margin-bottom:16px;">
        Accept Invitation →
      </a>

      <p style="margin:0;font-size:12px;color:#525252;text-align:center;">
        This invitation expires on ${expiryDate}. If you don't have an account, you'll be able to create one.
      </p>
    </div>

    <div style="padding:16px 24px;border-top:1px solid #262626;text-align:center;">
      <p style="margin:0;font-size:11px;color:#525252;">Sent by MonitorX · If you didn't expect this, you can ignore this email.</p>
    </div>

  </div>
</body>
</html>`;
}