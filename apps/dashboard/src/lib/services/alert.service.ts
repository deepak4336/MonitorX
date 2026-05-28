import { prisma } from '../prisma';
import { sendAlertEmail } from './email.service';

interface AlertContext {
  projectId: string;
  issueId: string;
  issueTitle: string;
  issueLevel?: string;
  issueCulprit?: string;
  occurrences?: number;
  trigger: 'new_issue' | 'regression' | 'spike';
  environment: string;
  projectName?: string;
}

export async function fireAlerts(ctx: AlertContext): Promise<void> {
  const rules = await prisma.alertRule.findMany({
    where: {
      project_id: ctx.projectId,
      is_active: true,
      trigger: ctx.trigger,
    },
  });

  for (const rule of rules) {
    if (rule.last_fired) {
      const minutesSince = (Date.now() - rule.last_fired.getTime()) / 60000;
      if (minutesSince < rule.cooldown_min) continue;
    }

    try {
      if (rule.channel === 'email') {
        await sendEmailAlert(rule.destination, ctx);
      } else if (rule.channel === 'slack') {
        await sendSlackAlert(rule.destination, ctx);
      }

      await prisma.alertRule.updateMany({
        where: { id: rule.id },
        data: { last_fired: new Date() },
      });
    } catch (err) {
      console.error(`[AlertService] Failed to fire alert ${rule.id}:`, err);
    }
  }
}

async function sendEmailAlert(email: string, ctx: AlertContext): Promise<void> {
  let projectName = ctx.projectName;
  if (!projectName) {
    const project = await prisma.project.findUnique({
      where: { id: ctx.projectId },
      select: { name: true },
    });
    projectName = project?.name ?? 'Unknown Project';
  }

  let issueLevel = ctx.issueLevel;
  let issueCulprit = ctx.issueCulprit;
  let occurrences = ctx.occurrences;
  if (!issueLevel || !occurrences) {
    const issue = await prisma.issue.findUnique({
      where: { id: ctx.issueId },
      select: { level: true, culprit: true, occurrences: true },
    });
    issueLevel = issue?.level ?? 'error';
    issueCulprit = issue?.culprit ?? undefined;
    occurrences = issue?.occurrences ?? 1;
  }

  await sendAlertEmail({
    to: email,
    projectName,
    projectId: ctx.projectId,
    issueId: ctx.issueId,
    issueTitle: ctx.issueTitle,
    issueLevel,
    issueCulprit,
    triggerType: ctx.trigger,
    occurrences,
  });
}

async function sendSlackAlert(webhookUrl: string, ctx: AlertContext): Promise<void> {
  const emoji = ctx.trigger === 'new_issue' ? '🔴' : ctx.trigger === 'regression' ? '⚠️' : '📈';
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `${emoji} *MonitorX Alert* — ${ctx.trigger.replace('_', ' ')}`,
      blocks: [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *${ctx.trigger.replace('_', ' ').toUpperCase()}*\n*${ctx.issueTitle}*\nEnvironment: \`${ctx.environment}\``,
        },
      }],
    }),
  });
}