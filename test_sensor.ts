// test_sensor.ts
// Ganti nilai API_KEY di bawah ini dengan API Key perangkat yang Anda buat di dashboard!
const API_KEY: string = "iot_mangga_0c24183a044be1c296ea1161718b82157b96128a931bb2d47943072d712dbd96";
const ENDPOINT = "http://localhost:5173/api/sensor-data";

function randomFloat(min: number, max: number) {
  return (Math.random() * (max - min) + min).toFixed(2);
}


async function sendData() {
  if (API_KEY === "YOUR_API_KEY_HERE") {
    console.error("❌ ERROR: Silakan isi nilai API_KEY terlebih dahulu di baris 3 file test_sensor.ts!");
    console.error("Anda bisa mendapatkan API Key dengan membuat Pohon baru di halaman 'Manajemen Pohon'.");
    process.exit(1);
  }

  // Membuat data acak/simulasi untuk sensor
  const payload = {
    moisture: parseFloat(randomFloat(20, 90)), // Kelembapan 20% - 90%
    ph: parseFloat(randomFloat(5.0, 8.5)),     // pH Tanah 5.0 - 8.5
    tds: parseFloat(randomFloat(300, 1200))    // TDS 300 - 1200 ppm
  };

  try {
    console.log(`\n📤 Mengirim data: Moisture=${payload.moisture}%, pH=${payload.ph}, TDS=${payload.tds}ppm`);
    
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`✅ Berhasil tersimpan di Database! ID: ${data.id}`);
    } else {
      const errorText = await res.text();
      console.error(`❌ Gagal (${res.status}):`, errorText);
    }
  } catch (error: any) {
    console.error("❌ Error jaringan/Server mati:", error.message);
  }
}

console.log("📡 Memulai simulasi sensor IoT mikrokontroler (ESP32/ESP8266)...");
console.log("⏱️ Data baru akan dikirim setiap 5 detik.");
console.log("Tekan Ctrl+C untuk berhenti.\n");

// Kirim data pertama
sendData();

// Lakukan pengulangan pengiriman data setiap 5 detik
setInterval(sendData, 5000);
