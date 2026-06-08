<script lang="ts">
  import { page } from '$app/stores';
</script>

<svelte:head>
  <title>Dokumentasi API & OTA - IoT Mangga</title>
</svelte:head>

<div class="py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-2">Dokumentasi API</h1>
    <p class="text-gray-600">Panduan integrasi alat (ESP32/ESP8266) dengan server IoT Mangga.</p>
  </div>

  <!-- Pengiriman Data Sensor -->
  <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
    <div class="bg-stone-50 border-b border-gray-100 px-6 py-4 flex items-center gap-3">
      <span class="px-3 py-1 bg-green-100 text-green-700 font-bold rounded-lg text-sm">POST</span>
      <h2 class="text-lg font-bold text-gray-800 font-mono">/api/sensor-data</h2>
    </div>
    <div class="p-6">
      <p class="text-gray-700 mb-4">Gunakan *endpoint* ini untuk mengirim data dari sensor ke *database* secara *real-time*.</p>
      
      <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Headers yang Diwajibkan</h3>
      <div class="bg-gray-800 rounded-xl p-4 mb-6 overflow-x-auto text-sm text-gray-300 font-mono">
        <p><span class="text-amber-400">Content-Type</span>: application/json</p>
        <p><span class="text-amber-400">x-api-key</span>: &lt;API_KEY_DARI_DASHBOARD&gt;</p>
      </div>

      <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Format Body (JSON)</h3>
      <div class="bg-gray-800 rounded-xl p-4 mb-6 overflow-x-auto text-sm text-blue-300 font-mono">
        <pre>{`{
  "moisture": 45.5,   // Kelembapan Tanah (%)
  "ph": 6.8,          // pH Tanah (0 - 14)
  "tds": 450          // Total Dissolved Solids (ppm)
}`}</pre>
      </div>

      <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Respon Server</h3>
      <ul class="list-disc list-inside text-gray-600 space-y-1">
        <li><strong class="text-green-600">201 Created</strong>: Data berhasil disimpan.</li>
        <li><strong class="text-red-600">401 Unauthorized</strong>: API Key salah atau tidak ditemukan.</li>
        <li><strong class="text-red-600">400 Bad Request</strong>: Format JSON salah atau ada nilai yang kurang.</li>
      </ul>
    </div>
  </div>

  <!-- Pembaruan OTA (Over The Air) -->
  <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
    <div class="bg-stone-50 border-b border-gray-100 px-6 py-4 flex items-center gap-3">
      <span class="px-3 py-1 bg-blue-100 text-blue-700 font-bold rounded-lg text-sm">GET</span>
      <h2 class="text-lg font-bold text-gray-800 font-mono">/api/ota</h2>
    </div>
    <div class="p-6">
      <p class="text-gray-700 mb-4">Gunakan *endpoint* ini pada modul HTTP Updater ESP32 Anda untuk mengecek dan mengunduh versi *firmware* terbaru. Pastikan Anda mengaktifkan Target Update di Dashboard terlebih dahulu.</p>
      
      <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Headers yang Diwajibkan</h3>
      <div class="bg-gray-800 rounded-xl p-4 mb-6 overflow-x-auto text-sm text-gray-300 font-mono">
        <p><span class="text-amber-400">x-api-key</span>: &lt;API_KEY_DARI_DASHBOARD&gt;</p>
        <p><span class="text-amber-400">x-mac-address</span>: &lt;MAC_ADDRESS_ALAT_ANDA&gt; <span class="text-gray-500">// contoh: AA:BB:CC:DD:EE:FF</span></p>
        <p><span class="text-amber-400">x-firmware-version</span>: &lt;VERSI_SAAT_INI&gt; <span class="text-gray-500">// contoh: 1.0.0</span></p>
      </div>

      <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Cara Kerjanya</h3>
      <p class="text-gray-600 mb-4 text-sm leading-relaxed">
        Server tidak akan mengirimkan berkas `.bin` secara serampangan. Server akan mengecek apakah pengguna telah menekan tombol <strong>"Jadwalkan Update"</strong> untuk MAC Address tersebut. Jika iya, server akan mengecek versinya.
      </p>

      <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Respon Server</h3>
      <ul class="list-disc list-inside text-gray-600 space-y-2 mb-6">
        <li>
          <strong class="text-gray-900">304 Not Modified</strong>: 
          Alat Anda belum ditargetkan untuk *update* dari dashboard, ATAU versi yang terpasang di alat sudah sama persis dengan versi target. <strong>(Jangan lakukan proses flashing memori)</strong>.
        </li>
        <li>
          <strong class="text-green-600">200 OK</strong>: 
          Target *update* ditemukan dan versinya berbeda! Server akan mengalirkan (*stream*) sebuah berkas berjenis <code>application/octet-stream</code>. Langsung tulis *stream* ini ke memori *Flash* perangkat. Anda juga bisa mengecek Header balasan <code>x-new-version</code> untuk memastikan versi barunya.
        </li>
        <li><strong class="text-red-600">403 Forbidden</strong>: MAC Address yang dikirim tidak cocok dengan API Key.</li>
      </ul>

      <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Contoh Kode C++ (Arduino/ESP32)</h3>
      <div class="bg-gray-800 rounded-xl p-4 overflow-x-auto text-sm text-green-300 font-mono">
        <pre>{`#include <HTTPClient.h>
#include <HTTPUpdate.h>

void checkForUpdates() {
  WiFiClient client;
  httpUpdate.onStart([]() { Serial.println("Mulai Update OTA..."); });
  httpUpdate.onEnd([]() { Serial.println("Update Selesai! Rebooting..."); });

  // Tambahkan headers yang diwajibkan
  httpUpdate.setLedPin(LED_BUILTIN, LOW);
  httpUpdate.rebootOnUpdate(true);
  
  // Karena library HTTPUpdate tidak bisa injek custom header dengan mudah untuk metode standard, 
  // sangat disarankan menggunakan fungsi update custom HTTPClient 
  // atau mengirim query parameter jika library Anda membatasi headers.
  // Pastikan x-api-key, x-mac-address, dan x-firmware-version terkirim!
}`}</pre>
      </div>
    </div>
  </div>
</div>
