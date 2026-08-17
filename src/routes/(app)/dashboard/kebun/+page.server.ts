import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(302, '/login');

  const [kebuns, devices] = await Promise.all([
    prisma.kebun.findMany({
      where: { userId: locals.user.id },
      orderBy: { createdAt: 'asc' },
      include: {
        devices: {
          select: { id: true, name: true, kebunId: true }
        }
      }
    }),
    // All devices owned by user (to show in assign dropdown)
    prisma.device.findMany({
      where: { userId: locals.user.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, kebunId: true }
    })
  ]);

  return { kebuns, devices };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    if (!locals.user) throw redirect(302, '/login');

    const data = await request.formData();
    const name = data.get('name')?.toString().trim() ?? '';
    const location = data.get('location')?.toString().trim() ?? '';
    const waNumber = data.get('waNumber')?.toString().trim() ?? '';

    if (!name) return fail(400, { error: 'Nama kebun wajib diisi.' });
    if (name.length > 100) return fail(400, { error: 'Nama kebun maksimal 100 karakter.' });

    try {
      await prisma.kebun.create({
        data: {
          name,
          location: location || null,
          waNumber: waNumber || null,
          userId: locals.user.id
        }
      });
      return { success: true };
    } catch {
      return fail(500, { error: 'Gagal membuat kebun. Silakan coba lagi.' });
    }
  },

  update: async ({ request, locals }) => {
    if (!locals.user) throw redirect(302, '/login');

    const data = await request.formData();
    const id = data.get('id')?.toString() ?? '';
    const name = data.get('name')?.toString().trim() ?? '';
    const location = data.get('location')?.toString().trim() ?? '';
    const waNumber = data.get('waNumber')?.toString().trim() ?? '';

    if (!id) return fail(400, { error: 'ID kebun tidak valid.' });
    if (!name) return fail(400, { error: 'Nama kebun wajib diisi.' });
    if (name.length > 100) return fail(400, { error: 'Nama kebun maksimal 100 karakter.' });

    const kebun = await prisma.kebun.findUnique({ where: { id } });
    if (!kebun || kebun.userId !== locals.user.id) {
      return fail(403, { error: 'Akses ditolak.' });
    }

    try {
      await prisma.kebun.update({
        where: { id },
        data: {
          name,
          location: location || null,
          waNumber: waNumber || null
        }
      });
      return { success: true };
    } catch {
      return fail(500, { error: 'Gagal menyimpan perubahan kebun.' });
    }
  },

  delete: async ({ request, locals }) => {
    if (!locals.user) throw redirect(302, '/login');

    const data = await request.formData();
    const id = data.get('id')?.toString() ?? '';

    if (!id) return fail(400, { error: 'ID kebun tidak valid.' });

    const kebun = await prisma.kebun.findUnique({ where: { id } });
    if (!kebun || kebun.userId !== locals.user.id) {
      return fail(403, { error: 'Akses ditolak.' });
    }

    try {
      await prisma.kebun.delete({ where: { id } });
      return { success: true };
    } catch {
      return fail(500, { error: 'Gagal menghapus kebun.' });
    }
  },

  assignDevice: async ({ request, locals }) => {
    if (!locals.user) throw redirect(302, '/login');

    const data = await request.formData();
    const deviceId = data.get('deviceId')?.toString() ?? '';
    const kebunId = data.get('kebunId')?.toString() ?? '';

    if (!deviceId) return fail(400, { error: 'ID perangkat tidak valid.' });

    // Verify device ownership
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device || device.userId !== locals.user.id) {
      return fail(403, { error: 'Akses ditolak.' });
    }

    // If kebunId given, verify kebun ownership too
    if (kebunId) {
      const kebun = await prisma.kebun.findUnique({ where: { id: kebunId } });
      if (!kebun || kebun.userId !== locals.user.id) {
        return fail(403, { error: 'Akses ditolak.' });
      }
    }

    try {
      await prisma.device.update({
        where: { id: deviceId },
        data: { kebunId: kebunId || null }
      });
      return { success: true };
    } catch {
      return fail(500, { error: 'Gagal mengubah penugasan perangkat.' });
    }
  }
};
