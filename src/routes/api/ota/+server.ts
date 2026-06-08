import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';

export const GET: RequestHandler = async ({ request }) => {
  try {
    // 1. Extract Headers sent by ESP32/ESP8266 HTTPUpdater
    const apiKey = request.headers.get('x-api-key');
    const macAddress = request.headers.get('x-mac-address');
    const currentVersion = request.headers.get('x-firmware-version');

    if (!apiKey || !macAddress || !currentVersion) {
      return json({ error: 'Missing required headers: x-api-key, x-mac-address, x-firmware-version' }, { status: 400 });
    }

    // 2. Authenticate Device
    const device = await prisma.device.findUnique({
      where: { apiKey }
    });

    if (!device) {
      return json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
    }

    if (device.macAddress !== macAddress) {
      // Security check: ensure API key matches the registered MAC address
      return json({ error: 'Forbidden: MAC Address mismatch' }, { status: 403 });
    }

    // 3. Check if device has a target firmware scheduled
    if (!device.targetFirmwareId) {
      return new Response(null, { status: 304 }); // No update targeted
    }

    // 4. Find the targeted firmware
    const targetFirmware = await prisma.firmware.findUnique({
      where: { id: device.targetFirmwareId }
    });

    if (!targetFirmware) {
      return json({ error: 'Target firmware not found on server' }, { status: 404 });
    }

    // 5. Compare Versions
    // If the device already has the targeted version, cancel the update.
    if (targetFirmware.version === currentVersion) {
      // 304 Not Modified tells the ESP32 that no update is needed.
      return new Response(null, { status: 304 });
    }

    // 6. Download the .bin file from Supabase Storage
    const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
      .from('firmware-builds')
      .download(targetFirmware.fileUrl);

    if (downloadError || !fileBlob) {
      return json({ error: 'Internal Server Error: Firmware file missing or corrupted' }, { status: 500 });
    }

    // 6. Convert Blob to ArrayBuffer to stream back to the microcontroller
    const arrayBuffer = await fileBlob.arrayBuffer();

    // 8. Send the binary stream
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Content-Disposition': `attachment; filename="firmware_v${targetFirmware.version}.bin"`,
        'x-new-version': targetFirmware.version // Optional header for ESP32 to verify
      }
    });

  } catch (err) {
    return json({ error: 'Internal Server Error' }, { status: 500 });
  }
};
