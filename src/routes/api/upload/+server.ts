import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';

const BUCKET = 'product-images';
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Tidak terautentikasi');
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file || !(file instanceof File)) {
    throw error(400, 'File tidak ditemukan dalam request');
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw error(400, 'Format file tidak didukung. Gunakan JPG, PNG, WebP, atau GIF.');
  }

  if (file.size > MAX_SIZE_BYTES) {
    throw error(400, 'Ukuran file terlalu besar. Maksimal 5 MB.');
  }

  // Buat nama file unik: userId/timestamp-random.ext
  const ext = file.name.split('.').pop() ?? 'jpg';
  const filename = `${locals.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { data, error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filename, buffer, {
      contentType: file.type,
      upsert: false
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    throw error(500, 'Gagal mengunggah foto. Pastikan bucket "product-images" sudah dibuat di Supabase Storage.');
  }

  // Get public URL
  const { data: urlData } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(data.path);

  return json({ url: urlData.publicUrl });
};
