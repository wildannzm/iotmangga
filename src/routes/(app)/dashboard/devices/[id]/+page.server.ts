import { error, redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';

// Simple URL validation helper
function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

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
        },
        products: {
          orderBy: { createdAt: 'desc' }
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
    // The query above gets the newest 25. We want to show them chronologically.
    const historicalData = device.sensorData.reverse();

    const firmwares = await prisma.firmware.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return {
      device,
      historicalData,
      firmwares,
      products: device.products
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

    const device = await prisma.device.findUnique({ where: { id: params.id } });
    if (!device || device.userId !== locals.user.id) {
      return fail(403, { error: 'Akses ditolak.' });
    }

    const data = await request.formData();
    const targetFirmwareId = data.get('targetFirmwareId')?.toString();

    try {
      await prisma.device.update({
        where: { id: params.id },
        data: { 
          targetFirmwareId: targetFirmwareId ? targetFirmwareId : null 
        }
      });
      return { success: true };
    } catch (err) {
      return fail(500, { error: 'Gagal menjadwalkan pembaruan firmware.' });
    }
  },

  createProduct: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(302, '/login');

    // Verify device ownership first
    const device = await prisma.device.findUnique({ where: { id: params.id } });
    if (!device || device.userId !== locals.user.id) {
      return fail(403, { error: 'Akses ditolak.' });
    }

    const data = await request.formData();
    const name = data.get('name')?.toString().trim() ?? '';
    const description = data.get('description')?.toString().trim() ?? '';
    const imageUrl = data.get('imageUrl')?.toString().trim() ?? '';
    const priceRaw = data.get('price')?.toString() ?? '';
    const stockRaw = data.get('stock')?.toString() ?? '';
    const unit = data.get('unit')?.toString().trim() || 'kg';
    const harvestDateRaw = data.get('harvestDate')?.toString() ?? '';
    // Checkbox hanya mengirim 'true' jika dicentang, tidak mengirim apapun jika tidak
    const isPublished = data.get('isPublished') === 'true';

    // Validation
    if (!name) return fail(400, { productError: 'Nama produk wajib diisi.' });
    if (name.length > 200) return fail(400, { productError: 'Nama produk maksimal 200 karakter.' });
    if (description.length > 1000) return fail(400, { productError: 'Deskripsi maksimal 1000 karakter.' });
    if (imageUrl && !isValidUrl(imageUrl)) return fail(400, { productError: 'URL gambar tidak valid. Harus diawali dengan http:// atau https://' });

    const price = parseFloat(priceRaw);
    const stock = parseFloat(stockRaw);

    if (isNaN(price) || price < 0) return fail(400, { productError: 'Harga harus berupa angka >= 0.' });
    if (isNaN(stock) || stock < 0) return fail(400, { productError: 'Stok harus berupa angka >= 0.' });

    const harvestDate = harvestDateRaw ? new Date(harvestDateRaw) : null;

    try {
      await prisma.product.create({
        data: {
          deviceId: params.id,
          name,
          description: description || null,
          imageUrl: imageUrl || null,
          price,
          stock,
          unit,
          harvestDate,
          isPublished
        }
      });
      return { productSuccess: true };
    } catch {
      return fail(500, { productError: 'Gagal menambahkan produk. Silakan coba lagi.' });
    }
  },

  updateProduct: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(302, '/login');

    // Verify device ownership
    const device = await prisma.device.findUnique({ where: { id: params.id } });
    if (!device || device.userId !== locals.user.id) {
      return fail(403, { productError: 'Akses ditolak.' });
    }

    const data = await request.formData();
    const productId = data.get('productId')?.toString() ?? '';
    const name = data.get('name')?.toString().trim() ?? '';
    const description = data.get('description')?.toString().trim() ?? '';
    const imageUrl = data.get('imageUrl')?.toString().trim() ?? '';
    const priceRaw = data.get('price')?.toString() ?? '';
    const stockRaw = data.get('stock')?.toString() ?? '';
    const unit = data.get('unit')?.toString().trim() || 'kg';
    const harvestDateRaw = data.get('harvestDate')?.toString() ?? '';
    // Checkbox hanya mengirim 'true' jika dicentang, tidak mengirim apapun jika tidak
    const isPublished = data.get('isPublished') === 'true';

    if (!productId) return fail(400, { productError: 'ID produk tidak valid.' });
    if (!name) return fail(400, { productError: 'Nama produk wajib diisi.' });
    if (name.length > 200) return fail(400, { productError: 'Nama produk maksimal 200 karakter.' });
    if (description.length > 1000) return fail(400, { productError: 'Deskripsi maksimal 1000 karakter.' });
    if (imageUrl && !isValidUrl(imageUrl)) return fail(400, { productError: 'URL gambar tidak valid.' });

    const price = parseFloat(priceRaw);
    const stock = parseFloat(stockRaw);

    if (isNaN(price) || price < 0) return fail(400, { productError: 'Harga harus berupa angka >= 0.' });
    if (isNaN(stock) || stock < 0) return fail(400, { productError: 'Stok harus berupa angka >= 0.' });

    // Verify product belongs to this device
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.deviceId !== params.id) {
      return fail(403, { productError: 'Produk tidak ditemukan atau akses ditolak.' });
    }

    const harvestDate = harvestDateRaw ? new Date(harvestDateRaw) : null;

    try {
      await prisma.product.update({
        where: { id: productId },
        data: { name, description: description || null, imageUrl: imageUrl || null, price, stock, unit, harvestDate, isPublished }
      });
      return { productSuccess: true };
    } catch {
      return fail(500, { productError: 'Gagal menyimpan perubahan produk.' });
    }
  },

  deleteProduct: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(302, '/login');

    // Verify device ownership
    const device = await prisma.device.findUnique({ where: { id: params.id } });
    if (!device || device.userId !== locals.user.id) {
      return fail(403, { productError: 'Akses ditolak.' });
    }

    const data = await request.formData();
    const productId = data.get('productId')?.toString() ?? '';

    if (!productId) return fail(400, { productError: 'ID produk tidak valid.' });

    // Verify product belongs to this device
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.deviceId !== params.id) {
      return fail(403, { productError: 'Produk tidak ditemukan atau akses ditolak.' });
    }

    try {
      await prisma.product.delete({ where: { id: productId } });
      return { productSuccess: true };
    } catch {
      return fail(500, { productError: 'Gagal menghapus produk.' });
    }
  }
};
