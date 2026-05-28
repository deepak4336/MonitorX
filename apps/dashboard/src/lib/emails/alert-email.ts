const levelColors: Record<string, string> = {
  fatal: '#ef4444',
  error: '#f97316',
  warning: '#eab308',
  info: '#3b82f6',
  debug: '#8b5cf6',
};

const triggerLabels: Record<string, string> = {
  new_issue: '🆕 New Issue Detected',
  regression: '🔄 Issue Regressed',
  spike: '📈 Error Spike Detected',
};

export interface AlertEmailProps {
  projectName: string;
  issueTitle: string;
  issueLevel: string;
  issueCulprit?: string;
  issueUrl: string;
  triggerType: string;
  occurrences: number;
}

export function buildAlertEmailHtml(props: AlertEmailProps): string {
  const color = levelColors[props.issueLevel] ?? '#6b7280';
  const triggerLabel = triggerLabels[props.triggerType] ?? 'Alert Triggered';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#e5e5e5;margin:0;padding:40px 20px;">
  <div style="max-width:560px;margin:0 auto;background:#141414;border-radius:8px;border:1px solid #262626;overflow:hidden;">

    <div style="background:#1a1a1a;padding:20px 24px;border-bottom:1px solid #262626;">
      <span style="font-weight:600;font-size:15px;">⚡ MonitorX Alert</span>
    </div>

    <div style="background:${color}22;border-bottom:2px solid ${color};padding:12px 24px;">
      <p style="margin:0;font-weight:600;font-size:14px;color:${color};">${triggerLabel}</p>
    </div>

    <div style="padding:24px;">
      <p style="margin:0 0 4px;font-size:12px;color:#737373;text-transform:uppercase;letter-spacing:0.05em;">Project</p>
      <p style="margin:0 0 20px;font-size:15px;font-weight:600;">${props.projectName}</p>

      <p style="margin:0 0 4px;font-size:12px;color:#737373;text-transform:uppercase;letter-spacing:0.05em;">Issue</p>
      <p style="margin:0 0 4px;font-family:monospace;font-size:13px;background:#1e1e1e;padding:10px 12px;border-radius:6px;border:1px solid #262626;">${props.issueTitle}</p>

      ${props.issueCulprit ? `<p style="margin:0 0 20px;font-size:12px;color:#737373;font-family:monospace;">${props.issueCulprit}</p>` : ''}

      <table width="100%" style="border-collapse:collapse;margin:20px 0;">
        <tr>
          <td width="50%" style="padding:0 8px 0 0;">
            <div style="background:#1e1e1e;border-radius:6px;padding:12px;border:1px solid #262626;text-align:center;">
              <p style="margin:0 0 4px;font-size:22px;font-weight:700;">${props.occurrences}</p>
              <p style="margin:0;font-size:11px;color:#737373;">Occurrences</p>
            </div>
          </td>
          <td width="50%" style="padding:0 0 0 8px;">
            <div style="background:${color}22;border-radius:6px;padding:12px;border:1px solid ${color}44;text-align:center;">
              <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:${color};text-transform:capitalize;">${props.issueLevel}</p>
              <p style="margin:0;font-size:11px;color:#737373;">Level</p>
            </div>
          </td>
        </tr>
      </table>

      <a href="${props.issueUrl}" style="display:block;background:#e5e5e5;color:#0a0a0a;text-align:center;padding:12px;border-radius:6px;font-weight:600;font-size:14px;text-decoration:none;">
        View Issue →
      </a>
    </div>

    <div style="padding:16px 24px;border-top:1px solid #262626;text-align:center;">
      <p style="margin:0;font-size:11px;color:#525252;">Sent by MonitorX · You're receiving this because an alert rule matched.</p>
    </div>

  </div>
</body>
</html>`;
}