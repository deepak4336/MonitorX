import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/supabase-server';
import { CreateOrganizationSchema } from '@/lib/validations';
import { slugify } from '@/lib/utils';
import { ZodError } from 'zod';

// GET /api/organizations — list orgs for authenticated user
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { user_id: user.id },
    include: {
      organization: {
        include: {
          _count: { select: { projects: true, members: true } },
        },
      },
    },
    orderBy: { created_at: 'asc' },
  });

  const organizations = memberships.map((m) => ({
    ...m.organization,
    role: m.role,
    project_count: m.organization._count.projects,
    member_count: m.organization._count.members,
  }));

  return NextResponse.json({ success: true, data: organizations });
}

// POST /api/organizations — create a new organization
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = CreateOrganizationSchema.parse(body);

    const slug = parsed.slug ?? slugify(parsed.name);

    // Check slug uniqueness
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'An organization with this slug already exists' },
        { status: 409 }
      );
    }

    const org = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: parsed.name, slug },
      });

      // Ensure user record exists in our DB (mirrored from Supabase auth)
      await tx.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          email: user.email!,
          name: user.user_metadata?.name ?? user.email!.split('@')[0],
        },
        update: {},
      });

      await tx.organizationMember.create({
        data: {
          organization_id: organization.id,
          user_id: user.id,
          role: 'owner',
        },
      });

      return organization;
    });

    return NextResponse.json({ success: true, data: org }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 422 }
      );
    }
    console.error('[/api/organizations POST]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
