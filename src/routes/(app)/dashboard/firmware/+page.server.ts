import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(302, '/login');
  }

  // Fetch all firmware history
  const firmwares = await prisma.firmware.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return { firmwares };
};

export const actions: Actions = {
  upload: async ({ request, locals }) => {
    if (!locals.user) {
      throw redirect(302, '/login');
    }

    const formData = await request.formData();
    const version = formData.get('version')?.toString().trim();
    const releaseNotes = formData.get('releaseNotes')?.toString().trim() || null;
    const file = formData.get('firmwareFile') as File;

    if (!version || !file || file.size === 0) {
      return fail(400, { error: 'Versi dan file .bin wajib diisi.' });
    }

    if (!file.name.endsWith('.bin')) {
      return fail(400, { error: 'Hanya file berekstensi .bin yang diperbolehkan.' });
    }

    // Check if version already exists
    const existing = await prisma.firmware.findUnique({ where: { version } });
    if (existing) {
      return fail(400, { error: `Firmware dengan versi ${version} sudah ada di database.` });
    }

    // Convert Web File to Buffer for Supabase Upload
    const fileName = `${version}_${Date.now()}.bin`;
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage using Admin Client
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('firmware-builds')
      .upload(fileName, fileBuffer, {
        contentType: 'application/octet-stream',
        upsert: false
      });

    if (uploadError) {
      return fail(500, { error: 'Gagal mengunggah file ke penyimpanan Supabase.' });
    }

    const fileUrl = uploadData.path;

    // Save metadata to Database
    try {
      await prisma.firmware.create({
        data: {
          version,
          releaseNotes,
          fileUrl
        }
      });
    } catch (dbError) {
      await supabaseAdmin.storage.from('firmware-builds').remove([fileName]);
      return fail(500, { error: 'Terjadi kesalahan saat menyimpan data firmware ke database.' });
    }

    return { success: true };
  }
};
