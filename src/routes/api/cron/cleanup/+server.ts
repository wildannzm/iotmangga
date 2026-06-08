import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { CRON_SECRET } from '$env/static/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
  try {
    const authHeader = request.headers.get('authorization');
    
    // Verifikasi identitas Vercel Cron
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return json({ error: 'Unauthorized: Invalid CRON_SECRET' }, { status: 401 });
    }

    // 1. Hapus semua data sensor
    const deleteSensorData = prisma.sensorData.deleteMany();

    // 2. Hapus semua sesi login
    const deleteSessions = prisma.session.deleteMany();

    // 3. Hapus Firmware (baik file fisik maupun database)
    const firmwares = await prisma.firmware.findMany();
    
    let deletedFilesCount = 0;
    if (firmwares.length > 0) {
      const fileNames = firmwares.map(fw => fw.fileUrl.split('/').pop() || '');
      // Hapus file fisik dari Supabase Storage
      const { data, error } = await supabaseAdmin.storage
        .from('firmware-builds')
        .remove(fileNames.filter(name => name !== ''));
        
      if (!error && data) {
        deletedFilesCount = data.length;
      } else {
        console.error('Peringatan: Gagal menghapus beberapa file firmware fisik', error);
      }
    }
    
    const deleteFirmwares = prisma.firmware.deleteMany();

    // Eksekusi semua perintah penghapusan database secara bersamaan (Parallel / Transaction)
    const [sensorResult, sessionResult, firmwareResult] = await prisma.$transaction([
      deleteSensorData,
      deleteSessions,
      deleteFirmwares
    ]);

    return json({
      success: true,
      message: 'Pembersihan bulanan berhasil dieksekusi',
      deleted_records: {
        sensor_data: sensorResult.count,
        sessions: sessionResult.count,
        firmware_db: firmwareResult.count,
        firmware_files: deletedFilesCount
      }
    });

  } catch (error: any) {
    return json({ error: 'Terjadi kesalahan sistem saat menjalankan pembersihan bulanan' }, { status: 500 });
  }
};
