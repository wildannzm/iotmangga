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
  let chartLabels = $derived(historicalData.map(d => new Date(d.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })));

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

  const chartOptionsMoisture: ChartOptions<'line'> = { ...baseChartOptions, scales: { y: { type: 'linear', display: true, title: { display: true, text: 'Kelembapan (%)' }, min: 0, max: 100 } } };
  const chartOptionsPh: ChartOptions<'line'> = { ...baseChartOptions, scales: { y: { type: 'linear', display: true, title: { display: true, text: 'pH Tanah' }, min: 0, max: 14 } } };
  const chartOptionsTds: ChartOptions<'line'> = { ...baseChartOptions, scales: { y: { type: 'linear', display: true, title: { display: true, text: 'TDS (ppm)' }, min: 0 } } };

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
                Versi {fw.version} (Dirilis: {new Date(fw.createdAt).toLocaleDateString('id-ID')})
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
</div>
