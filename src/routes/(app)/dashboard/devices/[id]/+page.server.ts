import { error, redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';

export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
  if (!locals.user) {
    throw redirect(302, '/login');
  }

  // Cache the database response for 60 seconds in the browser to prevent rapid DB queries
  setHeaders({
    'Cache-Control': 'private, max-age=60'
  });

  const { id } = params;

  // Validate UUID format roughly or let Prisma throw if invalid
  try {
    const device = await prisma.device.findUnique({
      where: {
        id
      },
      include: {
        sensorData: {
          orderBy: { createdAt: 'desc' },
          take: 25
        }
      }
    });

    if (!device) {
      throw error(404, 'Perangkat tidak ditemukan');
    }

    // Ensure the user actually owns this device for security
    if (device.userId !== locals.user.id) {
      throw error(403, 'Akses ditolak');
    }

    // Reverse sensor data so the chart draws from oldest to newest (left to right)
    // Reverse sensor data so the chart draws from oldest to newest (left to right)
    // The query above gets the newest 25. We want to show them chronologically.
    const historicalData = device.sensorData.reverse();

    const firmwares = await prisma.firmware.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return {
      device,
      historicalData,
      firmwares
    };
  } catch (err: any) {
    if (err.status === 404 || err.status === 403) {
      throw err;
    }
    throw error(500, 'Terjadi kesalahan pada server saat mengambil data perangkat');
  }
};

export const actions: Actions = {
  setTargetFirmware: async ({ request, params, locals }) => {
    if (!locals.user) {
      throw redirect(302, '/login');
    }

    const data = await request.formData();
    const targetFirmwareId = data.get('targetFirmwareId')?.toString();

    try {
      await prisma.device.update({
        where: { id: params.id },
        data: { 
          // If empty string is passed (for clearing target), set to null
          targetFirmwareId: targetFirmwareId ? targetFirmwareId : null 
        }
      });
      return { success: true };
    } catch (err) {
      return fail(500, { error: 'Gagal menjadwalkan pembaruan firmware.' });
    }
  }
};
