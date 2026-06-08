import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';
import crypto from 'crypto';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(302, '/login');
  }

  const devices = await prisma.device.findMany({
    where: { userId: locals.user.id },
    orderBy: { createdAt: 'asc' },
    // Include the latest sensor data if we want to show status later
    include: {
      sensorData: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  return {
    devices
  };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    if (!locals.user) {
      throw redirect(302, '/login');
    }

    const data = await request.formData();
    const name = data.get('name');
    const macAddress = data.get('macAddress');

    if (typeof name !== 'string' || !name || typeof macAddress !== 'string' || !macAddress) {
      return fail(400, { error: 'Nama Pohon dan MAC Address harus diisi.' });
    }

    // Generate a secure 64-character hex API key
    const rawApiKey = crypto.randomBytes(32).toString('hex');
    const apiKey = `iot_mangga_${rawApiKey}`;

    try {
      const newDevice = await prisma.device.create({
        data: {
          name,
          macAddress,
          apiKey,
          firmwareVer: '1.0.0', // default initial firmware version
          userId: locals.user.id
        }
      });

      return {
        success: true,
        device: newDevice,
        // Return apiKey so frontend can display it ONCE
        apiKey
      };
    } catch (e) {
      return fail(500, { error: 'Gagal menambahkan pohon karena kesalahan sistem' });
    }
  },

  update: async ({ request, locals }) => {
    if (!locals.user) throw redirect(302, '/login');

    const data = await request.formData();
    const id = data.get('id');
    const name = data.get('name');
    const macAddress = data.get('macAddress');

    if (typeof id !== 'string' || typeof name !== 'string' || !name || typeof macAddress !== 'string' || !macAddress) {
      return fail(400, { error: 'Data tidak valid.' });
    }

    try {
      const device = await prisma.device.findUnique({ where: { id } });
      if (!device || device.userId !== locals.user.id) {
        return fail(403, { error: 'Akses ditolak.' });
      }

      await prisma.device.update({
        where: { id },
        data: { name, macAddress }
      });

      return { success: true };
    } catch (e) {
      return fail(500, { error: 'Gagal menyimpan perubahan' });
    }
  },

  delete: async ({ request, locals }) => {
    if (!locals.user) throw redirect(302, '/login');

    const data = await request.formData();
    const id = data.get('id');

    if (typeof id !== 'string' || !id) {
      return fail(400, { error: 'ID tidak valid.' });
    }

    try {
      const device = await prisma.device.findUnique({ where: { id } });
      if (!device || device.userId !== locals.user.id) {
        return fail(403, { error: 'Akses ditolak.' });
      }

      await prisma.device.delete({ where: { id } });

      return { success: true };
    } catch (e) {
      return fail(500, { error: 'Gagal menghapus pohon' });
    }
  }
};
