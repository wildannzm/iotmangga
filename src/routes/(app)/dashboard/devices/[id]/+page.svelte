<script lang="ts">
  import { enhance } from '$app/forms';
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { invalidateAll } from '$app/navigation';
  import type { PageData } from './$types';
  import { Line } from 'svelte-chartjs';
  import { Chart, Title, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale, type ChartOptions } from 'chart.js';

  // Register Chart.js components
  Chart.register(Title, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale);

  let { data }: { data: PageData } = $props();

  // State to hold our data (reactive in Svelte 5)
  let historicalData = $state(data.historicalData);
  $effect(() => { historicalData = data.historicalData; });
  let latestData = $derived(historicalData.length > 0 ? historicalData[historicalData.length - 1] : null);

  // Reactive chart data
  let chartLabels = $derived(historicalData.map(d => {
    const dt = new Date(d.createdAt);
    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const hours = String(dt.getHours()).padStart(2, '0');
    const mins = String(dt.getMinutes()).padStart(2, '0');
    return `${day}/${month} ${hours}:${mins}`;
  }));

  let isRefreshing = $state(false);
  async function handleRefresh() {
    isRefreshing = true;
    await invalidateAll();
    setTimeout(() => {
      isRefreshing = false;
    }, 500);
  }

  let chartDataMoisture = $derived({
    labels: chartLabels,
    datasets: [{
      label: 'Kelembapan (%)',
      data: historicalData.map(d => d.moisture),
      borderColor: '#f97316', // Orange-500
      backgroundColor: 'rgba(249, 115, 22, 0.2)',
      tension: 0.3
    }]
  });

  let chartDataPh = $derived({
    labels: chartLabels,
    datasets: [{
      label: 'pH Tanah',
      data: historicalData.map(d => d.ph),
      borderColor: '#16a34a', // Green-600
      backgroundColor: 'rgba(22, 163, 74, 0.2)',
      tension: 0.3
    }]
  });

  let chartDataTds = $derived({
    labels: chartLabels,
    datasets: [{
      label: 'TDS (ppm)',
      data: historicalData.map(d => d.tds),
      borderColor: '#3b82f6', // Blue-500
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      tension: 0.3
    }]
  });

  const baseChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: { legend: { display: false } }
  };

  const baseScalesX = {
    ticks: {
      autoSkip: true,
      maxTicksLimit: 4,
      maxRotation: 0,
      minRotation: 0,
      font: { size: 9 },
      padding: 6
    },
    grid: {
      display: false
    }
  };

  const chartOptionsMoisture: ChartOptions<'line'> = { ...baseChartOptions, scales: { x: baseScalesX, y: { type: 'linear', display: true, title: { display: true, text: 'Kelembapan (%)' }, min: 0, max: 100 } } };
  const chartOptionsPh: ChartOptions<'line'> = { ...baseChartOptions, scales: { x: baseScalesX, y: { type: 'linear', display: true, title: { display: true, text: 'pH Tanah' }, min: 0, max: 14 } } };
  const chartOptionsTds: ChartOptions<'line'> = { ...baseChartOptions, scales: { x: baseScalesX, y: { type: 'linear', display: true, title: { display: true, text: 'TDS (ppm)' }, min: 0 } } };

  // Real-time WebSocket connection
  let channel: any;

  onMount(() => {
    channel = supabase
      .channel('sensor-data-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'SensorData',
          filter: `deviceId=eq.${data.device.id}`
        },
        (payload) => {
          // Add the new data point to our array, keeping max 25 points
          const newRecord = payload.new as typeof historicalData[0];
          let newData = [...historicalData, newRecord];
          if (newData.length > 25) {
            newData.shift(); // Remove the oldest point
          }
          historicalData = newData;
        }
      )
      .subscribe();
  });

  onDestroy(() => {
    if (channel) supabase.removeChannel(channel);
  });

  // Helper functions for UI styling based on Mango theme
  function getPhColor(ph: number) {
    if (ph >= 5.5 && ph <= 7.5) return 'text-green-600'; // Normal
    if (ph >= 4.5 && ph < 5.5) return 'text-amber-500';  // Slightly acidic
    if (ph > 7.5 && ph <= 8.5) return 'text-amber-500';  // Slightly alkaline
    return 'text-red-500'; // Dangerous
  }

  function getMoistureColor(moisture: number) {
    if (moisture >= 40 && moisture <= 80) return 'text-green-600'; // Normal
    if (moisture < 40) return 'text-orange-500'; // Dry
    return 'text-blue-500'; // Too wet
  }

  // ---- Product management state ----
  let products = $state(data.products);
  $effect(() => { products = data.products; });

  let showAddProductForm = $state(false);
  let editingProductId = $state<string | null>(null);

  // New product form state
  let newProduct = $state({
    name: '',
    description: '',
    imageUrl: '',
    price: '',
    stock: '',
    unit: 'kg',
    harvestDate: '',
    isPublished: false
  });

  // Edit product form state
  let editProduct = $state({
    name: '',
    description: '',
    imageUrl: '',
    price: '',
    stock: '',
    unit: 'kg',
    harvestDate: '',
    isPublished: false
  });

  function startEditProduct(product: typeof products[0]) {
    editingProductId = product.id;
    editProduct = {
      name: product.name,
      description: product.description ?? '',
      imageUrl: product.imageUrl ?? '',
      price: product.price.toString(),
      stock: product.stock.toString(),
      unit: product.unit,
      harvestDate: product.harvestDate
        ? new Date(product.harvestDate).toISOString().split('T')[0]
        : '',
      isPublished: product.isPublished
    };
  }

  function resetNewProductForm() {
    newProduct = { name: '', description: '', imageUrl: '', price: '', stock: '', unit: 'kg', harvestDate: '', isPublished: false };
    showAddProductForm = false;
  }

  function formatPrice(price: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price);
  }

  // ---- Image upload ----
  let uploadingNew = $state(false);
  let uploadingEdit = $state(false);
  let uploadErrorNew = $state('');
  let uploadErrorEdit = $state('');

  async function uploadImage(file: File, target: 'new' | 'edit') {
    if (target === 'new') { uploadingNew = true; uploadErrorNew = ''; }
    else { uploadingEdit = true; uploadErrorEdit = ''; }

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Gagal mengunggah foto');
      }
      const { url } = await res.json();
      if (target === 'new') newProduct.imageUrl = url;
      else editProduct.imageUrl = url;
    } catch (e: any) {
      if (target === 'new') uploadErrorNew = e.message ?? 'Gagal mengunggah foto';
      else uploadErrorEdit = e.message ?? 'Gagal mengunggah foto';
    } finally {
      if (target === 'new') uploadingNew = false;
      else uploadingEdit = false;
    }
  }
</script>

<svelte:head>
  <title>Detail Pohon: {data.device.name} - Mango Tree IoT</title>
</svelte:head>

<div class="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
  <div class="mb-8 flex items-center justify-between">
    <div>
      <div class="flex items-center space-x-3">
        <a href="/dashboard/devices" class="text-gray-400 hover:text-gray-600">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </a>
        <h1 class="text-3xl font-bold text-gray-900">{data.device.name}</h1>
      </div>
      <p class="text-sm text-gray-500 mt-2 ml-9 font-mono">MAC: {data.device.macAddress} &bull; Firmware: {data.device.firmwareVer}</p>
    </div>
    <div>
      <button 
        onclick={handleRefresh}
        disabled={isRefreshing}
        class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 transition-colors"
      >
        <svg class="h-4 w-4 mr-2 {isRefreshing ? 'animate-spin' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Refresh
      </button>
    </div>
  </div>

  <!-- Metric Cards -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
    <!-- Kelembapan Card -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-center">
      <div>
        <p class="text-sm font-medium text-gray-500">Kelembapan Tanah</p>
        {#if latestData}
          <h3 class="text-3xl font-bold {getMoistureColor(latestData.moisture)}">
            {latestData.moisture.toFixed(1)}<span class="text-lg font-medium text-gray-400 ml-1">%</span>
          </h3>
        {:else}
          <h3 class="text-xl font-medium text-gray-400">Belum ada data</h3>
        {/if}
      </div>
    </div>

    <!-- pH Card -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-center">
      <div>
        <p class="text-sm font-medium text-gray-500">pH Tanah</p>
        {#if latestData}
          <h3 class="text-3xl font-bold {getPhColor(latestData.ph)}">
            {latestData.ph.toFixed(2)}
          </h3>
        {:else}
          <h3 class="text-xl font-medium text-gray-400">Belum ada data</h3>
        {/if}
      </div>
    </div>

    <!-- TDS Card -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-center">
      <div>
        <p class="text-sm font-medium text-gray-500">Kadar Garam (TDS)</p>
        {#if latestData}
          <h3 class="text-3xl font-bold text-gray-700">
            {latestData.tds.toFixed(0)}<span class="text-lg font-medium text-gray-400 ml-1">ppm</span>
          </h3>
        {:else}
          <h3 class="text-xl font-medium text-gray-400">Belum ada data</h3>
        {/if}
      </div>
    </div>
  </div>

  <!-- OTA Update Panel -->
  <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h3 class="text-lg font-bold text-gray-800 flex items-center">
          <svg class="w-5 h-5 mr-2 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
          Manajemen OTA Firmware
        </h3>
        <p class="text-sm text-gray-500 mt-1">Jadwalkan pembaruan jarak jauh secara aman untuk alat ini.</p>
      </div>
      <div class="bg-stone-50 rounded-xl px-4 py-2 border border-gray-100 text-center sm:text-right">
        <p class="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Versi Terpasang</p>
        <p class="text-lg font-mono font-bold text-gray-900">v{data.device.firmwareVer}</p>
      </div>
    </div>
    
    <div class="mt-6 border-t border-gray-100 pt-6">
      <form method="POST" action="?/setTargetFirmware" use:enhance class="flex flex-col sm:flex-row sm:items-end gap-4">
        <div class="flex-1">
          <label for="targetFirmwareId" class="block text-sm font-medium text-gray-700 mb-2">Target Pembaruan</label>
          <select id="targetFirmwareId" name="targetFirmwareId" class="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm rounded-xl">
            <option value="">-- Jangan Perbarui (Pertahankan Versi Saat Ini) --</option>
            {#each data.firmwares as fw}
              <option value={fw.id} selected={fw.id === data.device.targetFirmwareId}>
                Versi {fw.version} (Dirilis: {new Date(fw.createdAt).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })})
              </option>
            {/each}
          </select>
        </div>
        <button type="submit" class="inline-flex w-full sm:w-auto items-center justify-center px-6 py-2.5 border border-transparent shadow-sm text-sm font-bold rounded-xl text-white bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors">
          Jadwalkan Update
        </button>
      </form>
      {#if data.device.targetFirmwareId}
        <div class="mt-4 flex items-center text-sm text-blue-700 bg-blue-50 px-4 py-3 rounded-xl border border-blue-100">
          <svg class="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          Perangkat ini dijadwalkan untuk melakukan pembaruan otomatis saat koneksi berikutnya.
        </div>
      {/if}
    </div>
  </div>

  <!-- Chart Section -->
  <div class="mb-8">
    <h3 class="text-lg font-bold text-gray-800 mb-6">Grafik Pemantauan Historis</h3>
    {#if historicalData.length > 0}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h4 class="text-sm font-bold text-gray-700 mb-4">Grafik Kelembapan</h4>
          <div class="h-64 w-full relative">
            <Line data={chartDataMoisture} options={chartOptionsMoisture} />
          </div>
        </div>
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h4 class="text-sm font-bold text-gray-700 mb-4">Grafik pH Tanah</h4>
          <div class="h-64 w-full relative">
            <Line data={chartDataPh} options={chartOptionsPh} />
          </div>
        </div>
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h4 class="text-sm font-bold text-gray-700 mb-4">Grafik TDS</h4>
          <div class="h-64 w-full relative">
            <Line data={chartDataTds} options={chartOptionsTds} />
          </div>
        </div>
      </div>
    {:else}
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 flex items-center justify-center">
        <div class="text-center">
          <svg class="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          <p class="text-gray-500">Belum ada data riwayat yang terekam dari alat IoT.</p>
        </div>
      </div>
    {/if}
  </div>

  <!-- ==================== SECTION PRODUK ==================== -->
  <div class="mb-8">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h3 class="text-lg font-bold text-gray-800">Hasil Buah (Produk)</h3>
        <p class="text-sm text-gray-500 mt-0.5">Kelola daftar produk mangga dari perangkat ini untuk ditampilkan di etalase publik.</p>
      </div>
      <button
        onclick={() => (showAddProductForm = !showAddProductForm)}
        class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-bold rounded-xl text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
      >
        <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Tambah Produk
      </button>
    </div>

    <!-- Form Tambah Produk Baru -->
    {#if showAddProductForm}
      <div class="bg-white rounded-2xl shadow-sm border border-green-100 p-6 mb-6">
        <h4 class="text-base font-bold text-gray-800 mb-4">Produk Baru</h4>
        <form
          method="POST"
          action="?/createProduct"
          use:enhance={() => {
            return ({ result, update }) => {
              if (result.type === 'success') resetNewProductForm();
              update();
            };
          }}
          class="space-y-4"
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="new-prod-name" class="block text-sm font-medium text-gray-700 mb-1">Nama Produk <span class="text-red-500">*</span></label>
              <input id="new-prod-name" name="name" type="text" maxlength="200" required bind:value={newProduct.name}
                placeholder="Contoh: Mangga Harum Manis" class="block w-full border-gray-300 rounded-xl shadow-sm focus:ring-amber-500 focus:border-amber-500 sm:text-sm" />
            </div>
            <div>
              <label for="new-prod-unit" class="block text-sm font-medium text-gray-700 mb-1">Satuan</label>
              <input id="new-prod-unit" name="unit" type="text" bind:value={newProduct.unit}
                placeholder="kg" class="block w-full border-gray-300 rounded-xl shadow-sm focus:ring-amber-500 focus:border-amber-500 sm:text-sm" />
            </div>
          </div>
          <div>
            <label for="new-prod-desc" class="block text-sm font-medium text-gray-700 mb-1">Deskripsi (maks. 1000 karakter)</label>
            <textarea id="new-prod-desc" name="description" rows="2" maxlength="1000" bind:value={newProduct.description}
              placeholder="Deskripsi singkat produk mangga..." class="block w-full border-gray-300 rounded-xl shadow-sm focus:ring-amber-500 focus:border-amber-500 sm:text-sm"></textarea>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label for="new-prod-price" class="block text-sm font-medium text-gray-700 mb-1">Harga (Rp) <span class="text-red-500">*</span></label>
              <input id="new-prod-price" name="price" type="number" min="0" step="100" required bind:value={newProduct.price}
                placeholder="25000" class="block w-full border-gray-300 rounded-xl shadow-sm focus:ring-amber-500 focus:border-amber-500 sm:text-sm" />
            </div>
            <div>
              <label for="new-prod-stock" class="block text-sm font-medium text-gray-700 mb-1">Stok <span class="text-red-500">*</span></label>
              <input id="new-prod-stock" name="stock" type="number" min="0" step="0.1" required bind:value={newProduct.stock}
                placeholder="100" class="block w-full border-gray-300 rounded-xl shadow-sm focus:ring-amber-500 focus:border-amber-500 sm:text-sm" />
            </div>
            <div>
              <label for="new-prod-harvest" class="block text-sm font-medium text-gray-700 mb-1">Tanggal Panen</label>
              <input id="new-prod-harvest" name="harvestDate" type="date" bind:value={newProduct.harvestDate}
                class="block w-full border-gray-300 rounded-xl shadow-sm focus:ring-amber-500 focus:border-amber-500 sm:text-sm" />
            </div>
          </div>
          <!-- Foto Produk Upload -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Foto Produk</label>
            <div class="flex items-start gap-4">
              <!-- Preview -->
              <div class="h-20 w-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden bg-amber-50">
                {#if newProduct.imageUrl}
                  <img src={newProduct.imageUrl} alt="preview" class="h-full w-full object-cover" />
                {:else}
                  <span class="text-2xl">🥭</span>
                {/if}
              </div>
              <div class="flex-1">
                <label for="new-prod-file" class="inline-flex items-center gap-2 cursor-pointer px-4 py-2 text-sm font-medium rounded-xl border border-gray-300 bg-white hover:bg-gray-50 transition-colors {uploadingNew ? 'opacity-50 pointer-events-none' : ''}">
                  {#if uploadingNew}
                    <svg class="h-4 w-4 animate-spin text-amber-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                    Mengunggah...
                  {:else}
                    <svg class="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Pilih Foto
                  {/if}
                </label>
                <input
                  id="new-prod-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  class="hidden"
                  onchange={(e) => { const f = (e.currentTarget as HTMLInputElement).files?.[0]; if (f) uploadImage(f, 'new'); }}
                />
                {#if uploadErrorNew}
                  <p class="text-xs text-red-500 mt-1">{uploadErrorNew}</p>
                {:else}
                  <p class="text-xs text-gray-400 mt-1">JPG, PNG, WebP · maks. 5 MB</p>
                {/if}
                <!-- Hidden input agar imageUrl terkirim ke server action -->
                <input type="hidden" name="imageUrl" bind:value={newProduct.imageUrl} />
              </div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <label class="inline-flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" name="isPublished" value="true" bind:checked={newProduct.isPublished}
                class="h-4 w-4 text-amber-500 border-gray-300 rounded focus:ring-amber-500" />
              <span class="text-sm font-medium text-gray-700">Tampilkan di etalase publik</span>
            </label>
          </div>
          <div class="flex items-center gap-3 pt-2">
            <button type="submit" class="px-5 py-2 text-sm font-bold rounded-xl text-white bg-green-600 hover:bg-green-700 transition-colors">
              Simpan Produk
            </button>
            <button type="button" onclick={resetNewProductForm}
              class="px-5 py-2 text-sm font-medium rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">
              Batal
            </button>
          </div>
        </form>
      </div>
    {/if}

    <!-- Daftar Produk -->
    {#if products.length === 0}
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 flex items-center justify-center">
        <div class="text-center">
          <svg class="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p class="text-gray-500">Belum ada produk yang ditambahkan untuk perangkat ini.</p>
          <p class="text-gray-400 text-sm mt-1">Klik "Tambah Produk" untuk mulai mendaftarkan hasil panen.</p>
        </div>
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each products as product (product.id)}
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <!-- Gambar Produk -->
            {#if product.imageUrl}
              <img
                src={product.imageUrl}
                alt={product.name}
                class="w-full h-40 object-cover"
                onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            {:else}
              <div class="w-full h-40 bg-amber-50 flex items-center justify-center">
                <svg class="h-12 w-12 text-amber-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            {/if}

            <div class="p-4 flex flex-col flex-1">
              {#if editingProductId === product.id}
                <!-- Form Edit Produk -->
                <form
                  method="POST"
                  action="?/updateProduct"
                  use:enhance={() => {
                    return ({ result, update }) => {
                      if (result.type === 'success') editingProductId = null;
                      update();
                    };
                  }}
                  class="space-y-3"
                >
                  <input type="hidden" name="productId" value={product.id} />
                  <input name="name" type="text" maxlength="200" required bind:value={editProduct.name}
                    class="block w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-amber-500 focus:border-amber-500" />
                  <textarea name="description" rows="2" maxlength="1000" bind:value={editProduct.description}
                    class="block w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-amber-500 focus:border-amber-500"></textarea>
                  <div class="grid grid-cols-2 gap-2">
                    <input name="price" type="number" min="0" step="100" required bind:value={editProduct.price}
                      placeholder="Harga" class="block w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-amber-500 focus:border-amber-500" />
                    <input name="stock" type="number" min="0" step="0.1" required bind:value={editProduct.stock}
                      placeholder="Stok" class="block w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-amber-500 focus:border-amber-500" />
                  </div>
                  <input name="unit" type="text" bind:value={editProduct.unit}
                    placeholder="Satuan" class="block w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-amber-500 focus:border-amber-500" />
                  <!-- Upload foto edit -->
                  <div class="flex items-center gap-3">
                    <div class="h-12 w-12 rounded-lg border border-gray-200 overflow-hidden bg-amber-50 flex-shrink-0 flex items-center justify-center">
                      {#if editProduct.imageUrl}
                        <img src={editProduct.imageUrl} alt="preview" class="h-full w-full object-cover" />
                      {:else}
                        <span class="text-xl">🥭</span>
                      {/if}
                    </div>
                    <label for="edit-prod-file-{product.id}" class="inline-flex items-center gap-1.5 cursor-pointer px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors {uploadingEdit ? 'opacity-50 pointer-events-none' : ''}">
                      {#if uploadingEdit}
                        <svg class="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                        Mengunggah...
                      {:else}
                        Ganti Foto
                      {/if}
                    </label>
                    <input id="edit-prod-file-{product.id}" type="file" accept="image/jpeg,image/png,image/webp" class="hidden"
                      onchange={(e) => { const f = (e.currentTarget as HTMLInputElement).files?.[0]; if (f) uploadImage(f, 'edit'); }} />
                    <input type="hidden" name="imageUrl" bind:value={editProduct.imageUrl} />
                  </div>
                  {#if uploadErrorEdit}<p class="text-xs text-red-500">{uploadErrorEdit}</p>{/if}
                  <input name="harvestDate" type="date" bind:value={editProduct.harvestDate}
                    class="block w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-amber-500 focus:border-amber-500" />
                  <label class="inline-flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" name="isPublished" value="true" bind:checked={editProduct.isPublished}
                      class="h-4 w-4 text-amber-500 border-gray-300 rounded" />
                    Tampilkan di etalase
                  </label>
                  <div class="flex gap-2">
                    <button type="submit" class="flex-1 py-1.5 text-xs font-bold rounded-lg text-white bg-amber-500 hover:bg-amber-600 transition-colors">
                      Simpan
                    </button>
                    <button type="button" onclick={() => editingProductId = null}
                      class="flex-1 py-1.5 text-xs font-medium rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">
                      Batal
                    </button>
                  </div>
                </form>
              {:else}
                <!-- Info Produk -->
                <div class="flex-1">
                  <div class="flex items-start justify-between mb-1">
                    <h4 class="font-bold text-gray-900 text-sm leading-tight">{product.name}</h4>
                    <span class="ml-2 flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {product.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
                      {product.isPublished ? 'Publik' : 'Draf'}
                    </span>
                  </div>
                  {#if product.description}
                    <p class="text-xs text-gray-500 mb-2 line-clamp-2">{product.description}</p>
                  {/if}
                  <p class="text-base font-bold text-amber-600">{formatPrice(product.price)}<span class="text-xs font-normal text-gray-400">/{product.unit}</span></p>
                  <p class="text-xs text-gray-500">Stok: {product.stock} {product.unit}</p>
                  {#if product.harvestDate}
                    <p class="text-xs text-gray-400 mt-1">Panen: {new Date(product.harvestDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })}</p>
                  {/if}
                </div>
                <div class="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                  <button
                    onclick={() => startEditProduct(product)}
                    class="flex-1 py-1.5 text-xs font-medium rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                  >
                    Edit
                  </button>
                  <form method="POST" action="?/deleteProduct" use:enhance class="flex-1">
                    <input type="hidden" name="productId" value={product.id} />
                    <button
                      type="submit"
                      onclick={(e) => { if (!confirm(`Hapus produk "${product.name}"?`)) e.preventDefault(); }}
                      class="w-full py-1.5 text-xs font-medium rounded-lg text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                    >
                      Hapus
                    </button>
                  </form>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
