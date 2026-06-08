// test_ota.ts
// Replace with a valid API Key and MAC Address from your Dashboard
const API_KEY = 'iot_mangga_0c24183a044be1c296ea1161718b82157b96128a931bb2d47943072d712dbd96'; // From your test_sensor.ts
const MAC_ADDRESS = 'AA:BB:CC:DD:EE:FF'; // IMPORTANT: Ganti ini dengan MAC Address alat Anda (bisa dilihat di Dashboard)
const DEVICE_CURRENT_VERSION = '0.9.0'; 
const ENDPOINT = 'http://localhost:5173/api/ota';

async function testOTA() {
  if (MAC_ADDRESS === 'AA:BB:CC:DD:EE:FF') {
    console.error('ERROR: Harap sesuaikan MAC_ADDRESS di baris 4 dengan MAC Address perangkat Anda (lihat di Dashboard)!');
    process.exit(1);
  }

  console.log(`📡 Memulai simulasi OTA untuk mengecek Target Pembaruan...`);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'GET',
      headers: {
        'x-api-key': API_KEY,
        'x-mac-address': MAC_ADDRESS,
        'x-firmware-version': DEVICE_CURRENT_VERSION
      }
    });

    console.log(`\nHTTP Status: ${res.status} ${res.statusText}`);

    if (res.status === 304) {
      console.log('✅ Status 304 Not Modified: Perangkat ini TIDAK dijadwalkan untuk pembaruan (atau target sudah tercapai).');
    } else if (res.status === 200) {
      const contentType = res.headers.get('Content-Type');
      const newVersion = res.headers.get('x-new-version');
      
      console.log(`🚀 Status 200 OK: Target Pembaruan Ditemukan! Mengunduh file...`);
      console.log(`Versi Target: ${newVersion}`);
      
      const arrayBuffer = await res.arrayBuffer();
      console.log(`📦 Berhasil mengunduh payload binary sebesar: ${arrayBuffer.byteLength} bytes.`);
      console.log(`Simulasi ESP32 selesai (Flash memory written).`);
    } else {
      const err = await res.text();
      console.error(`❌ Gagal:`, err);
    }
  } catch (error: any) {
    console.error('❌ Error Jaringan:', error.message);
  }
}

testOTA();
