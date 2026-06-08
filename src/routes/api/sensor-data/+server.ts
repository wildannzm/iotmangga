import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

export const POST: RequestHandler = async ({ request }) => {
  try {
    // 1. Get x-api-key from headers
    const apiKey = request.headers.get('x-api-key');

    if (!apiKey) {
      return json({ error: 'Akses ditolak. Header x-api-key tidak ditemukan.' }, { status: 401 });
    }

    // 2. Validate API Key by searching the database
    const device = await prisma.device.findUnique({
      where: { apiKey }
    });

    if (!device) {
      return json({ error: 'Akses ditolak. Kunci API tidak valid.' }, { status: 401 });
    }

    // 3. Extract sensor data from JSON body
    const body = await request.json();
    
    // Ensure all required fields exist and are numbers
    if (
      typeof body.moisture !== 'number' ||
      typeof body.ph !== 'number' ||
      typeof body.tds !== 'number'
    ) {
      return json(
        { error: 'Format data tidak valid. Pastikan moisture, ph, dan tds adalah angka.' },
        { status: 400 }
      );
    }

    // 4. Save to database
    const sensorData = await prisma.sensorData.create({
      data: {
        deviceId: device.id,
        moisture: body.moisture,
        ph: body.ph,
        tds: body.tds
      }
    });

    // 5. Return success
    return json(
      {
        message: 'Data sensor berhasil disimpan.',
        data: {
          id: sensorData.id,
          createdAt: sensorData.createdAt
        }
      },
      { status: 201 }
    );
  } catch (error) {
    // Removed error log
    return json({ error: 'Terjadi kesalahan pada server saat memproses data.' }, { status: 500 });
  }
};
