import { Resend } from 'resend';
import { buildAlertEmailHtml } from '@/lib/emails/alert-email';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.ALERT_FROM_EMAIL ?? 'onboarding@resend.dev';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://monitorex.netlify.app';

interface SendAlertEmailParams {
  to: string;
  projectName: string;
  projectId: string;
  issueId: string;
  issueTitle: string;
  issueLevel: string;
  issueCulprit?: string;
  triggerType: string;
  occurrences: number;
}

export async function sendAlertEmail(params: SendAlertEmailParams) {
  console.log('[Email] RESEND_API_KEY present:', !!process.env.RESEND_API_KEY);
  console.log('[Email] FROM:', FROM);
  console.log('[Email] Sending to:', params.to);

  if (!process.env.RESEND_API_KEY) {
    console.error('[Email] RESEND_API_KEY is missing — skipping email');
    return { success: false, error: 'Missing API key' };
  }

  const issueUrl = `${APP_URL}/projects/${params.projectId}/issues/${params.issueId}`;

  const triggerSubjects: Record<string, string> = {
    new_issue: `[MonitorX] New ${params.issueLevel} issue in ${params.projectName}`,
    regression: `[MonitorX] Issue regressed in ${params.projectName}`,
    spike: `[MonitorX] Error spike in ${params.projectName}`,
  };

  const subject = triggerSubjects[params.triggerType] ?? `[MonitorX] Alert: ${params.projectName}`;

  const html = buildAlertEmailHtml({
    projectName: params.projectName,
    issueTitle: params.issueTitle,
    issueLevel: params.issueLevel,
    issueCulprit: params.issueCulprit,
    issueUrl,
    triggerType: params.triggerType,
    occurrences: params.occurrences,
  });

  try {
    console.log('[Email] Calling Resend API...');
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject,
      html,
    });

    if (error) {
      console.error('[Email] Resend error:', JSON.stringify(error));
      return { success: false, error };
    }

    console.log('[Email] Success! ID:', data?.id);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[Email] Unexpected error:', err);
    return { success: false, error: err };
  }
}