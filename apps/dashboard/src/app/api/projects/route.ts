import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/supabase-server';
import { CreateProjectSchema } from '@/lib/validations';
import { slugify } from '@/lib/utils';
import { ZodError } from 'zod';

function generateSiteKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'mx_live_';
  for (let i = 0; i < 16; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

// GET /api/projects?org_id=xxx
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('org_id');

  if (!orgId) {
    return NextResponse.json({ success: false, error: 'org_id is required' }, { status: 400 });
  }

  // Verify membership
  const membership = await prisma.organizationMember.findUnique({
    where: { organization_id_user_id: { organization_id: orgId, user_id: user.id } },
  });

  if (!membership) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const projects = await prisma.project.findMany({
    where: { organization_id: orgId },
    include: {
      site_keys: { where: { is_active: true }, take: 1 },
      _count: { select: { issues: true, events: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  const result = projects.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    environment: p.environment,
    organization_id: p.organization_id,
    created_at: p.created_at,
    site_key: p.site_keys[0]?.key ?? null,
    issue_count: p._count.issues,
    event_count: p._count.events,
  }));

  return NextResponse.json({ success: true, data: result });
}

// POST /api/projects — create project + site key
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = CreateProjectSchema.parse(body);

    // Verify membership
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: parsed.organization_id,
          user_id: user.id,
        },
      },
    });

    if (!membership || membership.role === 'viewer') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const slug = slugify(parsed.name);

    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name: parsed.name,
          slug,
          environment: parsed.environment ?? 'production',
          organization_id: parsed.organization_id,
        },
      });

      const siteKey = await tx.siteKey.create({
        data: {
          project_id: project.id,
          key: generateSiteKey(),
          label: 'Default Key',
        },
      });

      return { project, siteKey: siteKey.key };
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          ...result.project,
          site_key: result.siteKey,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 422 }
      );
    }
    console.error('[/api/projects POST]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}