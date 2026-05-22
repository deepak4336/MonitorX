import { prisma } from '../prisma';

interface AlertContext {
  projectId: string;
  issueId: string;
  issueTitle: string;
  trigger: 'new_issue' | 'regression' | 'spike';
  environment: string;
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

      await prisma.alertRule.update({
        where: { id: rule.id },
        data: { last_fired: new Date() },
      });
    } catch (err) {
      console.error(`[AlertService] Failed to fire alert ${rule.id}:`, err);
    }
  }
}

async function sendEmailAlert(email: string, ctx: AlertContext): Promise<void> {
  console.log(`[AlertService] EMAIL → ${email} | ${ctx.trigger} | ${ctx.issueTitle}`);
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