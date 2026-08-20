<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { invalidateAll } from '$app/navigation';
  import type { PageData } from './$types';
  import { Line } from 'svelte-chartjs';
  import { Chart, Title, Tooltip, Legend, PointElement, LineElement, CategoryScale, LinearScale, type ChartOptions } from 'chart.js';
  import * as XLSX from 'xlsx';

  Chart.register(Title, Tooltip, Legend, PointElement, LineElement, CategoryScale, LinearScale);

  let { data }: { data: PageData } = $props();

  // Reactive state containing all devices and their 1 latest sensor data
  let devices = $state(data.devices);
  $effect(() => { devices = data.devices; });

  let activeTab = $state<'cards' | 'charts' | 'tables'>('cards');

  let isRefreshing = $state(false);
  async function handleRefresh() {
    isRefreshing = true;
    await invalidateAll();
    setTimeout(() => {
      isRefreshing = false;
    }, 500);
  }

  let filteredDevices = $derived(devices);

  // --- Table Pagination Logic ---
  let currentPage = $state(1);
  const itemsPerPage = 25;

  let allSensorData = $derived.by(() => {
    const all = [];
    for (const d of devices) {
      for (const s of d.sensorData) {
        all.push({
          ...s,
          deviceName: d.name,
          deviceMac: d.macAddress,
          deviceId: d.id
        });
      }
    }
    // Sort descending by time
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return all;
  });

  let totalPages = $derived(Math.max(1, Math.ceil(allSensorData.length / itemsPerPage)));
  let paginatedData = $derived(allSensorData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage));

  $effect(() => {
    // Ensure currentPage is valid if data changes
    if (currentPage > totalPages && totalPages > 0) {
      currentPage = totalPages;
    }
  });

  // --- Aggregate Computations ---
  let totalDevices = $derived(devices.length);

  let activeDevicesCount = $derived(devices.filter(d => {
    if (d.sensorData.length === 0) return false;
    // Consider active if the latest data is within the last 24 hours
    const diff = new Date().getTime() - new Date(d.sensorData[0].createdAt).getTime();
    return diff < 24 * 60 * 60 * 1000;
  }).length);

  const chartColors = ['#3b82f6', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

  let chartLabels = $derived.by(() => {
    let maxLen = 0;
    let bestDevice = null;
    for (const d of filteredDevices) {
      if (d.sensorData.length > maxLen) {
        maxLen = d.sensorData.length;
        bestDevice = d;
      }
    }
    if (!bestDevice || maxLen === 0) {
      return [];
    }
    return bestDevice.sensorData.map(d => {
      const dt = new Date(d.createdAt);
      const day = String(dt.getDate()).padStart(2, '0');
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const hours = String(dt.getHours()).padStart(2, '0');
      const mins = String(dt.getMinutes()).padStart(2, '0');
      return `${day}/${month} ${hours}:${mins}`;
    }).reverse();
  });

  let chartDataMoisture = $derived({
    labels: chartLabels,
    datasets: filteredDevices.map((device, i) => {
      const data = device.sensorData.map(d => d.moisture).reverse();
      const paddedData = [...Array(Math.max(0, chartLabels.length - data.length)).fill(null), ...data];
      return {
        label: device.name,
        data: paddedData,
        backgroundColor: chartColors[i % chartColors.length] + '33',
        borderColor: chartColors[i % chartColors.length],
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 2
      };
    })
  });

  let chartDataPh = $derived({
    labels: chartLabels,
    datasets: filteredDevices.map((device, i) => {
      const data = device.sensorData.map(d => d.ph).reverse();
      const paddedData = [...Array(Math.max(0, chartLabels.length - data.length)).fill(null), ...data];
      return {
        label: device.name,
        data: paddedData,
        backgroundColor: chartColors[i % chartColors.length] + '33',
        borderColor: chartColors[i % chartColors.length],
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 2
      };
    })
  });

  let chartDataTds = $derived({
    labels: chartLabels,
    datasets: filteredDevices.map((device, i) => {
      const data = device.sensorData.map(d => d.tds).reverse();
      const paddedData = [...Array(Math.max(0, chartLabels.length - data.length)).fill(null), ...data];
      return {
        label: device.name,
        data: paddedData,
        backgroundColor: chartColors[i % chartColors.length] + '33',
        borderColor: chartColors[i % chartColors.length],
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 2
      };
    })
  });

  const baseChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: { legend: { display: true, position: 'bottom' as const, labels: { boxWidth: 12 } } }
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

  const chartOptionsMoisture: ChartOptions<'line'> = { ...baseChartOptions, scales: { x: baseScalesX, y: { beginAtZero: true, max: 100, title: { display: true, text: 'Kelembapan (%)' } } } };
  const chartOptionsPh: ChartOptions<'line'> = { ...baseChartOptions, scales: { x: baseScalesX, y: { beginAtZero: true, max: 14, title: { display: true, text: 'pH' } } } };
  const chartOptionsTds: ChartOptions<'line'> = { ...baseChartOptions, scales: { x: baseScalesX, y: { beginAtZero: true, title: { display: true, text: 'TDS (ppm)' } } } };

  // --- WebSockets ---
  let channel: any;

  onMount(() => {
    channel = supabase
      .channel('global-sensor-data')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'SensorData',
          // We intentionally DO NOT filter by deviceId here so we receive ALL incoming data
        },
        (payload) => {
          const newRecord = payload.new as any; // Cast generic payload
          
          // Find the affected device in our local state and update it
          const index = devices.findIndex(d => d.id === newRecord.deviceId);
          if (index !== -1) {
            // Re-assign the array to trigger deep reactivity and keep last 25
            devices[index].sensorData = [newRecord, ...devices[index].sensorData].slice(0, 25);
          }
        }
      )
      .subscribe();
  });

  onDestroy(() => {
    if (channel) supabase.removeChannel(channel);
  });

  // --- UI Helpers ---
  // --- UI Helpers ---
  function getPhColor(ph: number) {
    if (ph >= 5.5 && ph <= 7.5) return 'text-green-600';
    if (ph >= 4.5 && ph < 5.5) return 'text-amber-500';
    if (ph > 7.5 && ph <= 8.5) return 'text-amber-500';
    return 'text-red-500';
  }

  function getMoistureColor(moisture: number) {
    if (moisture >= 40 && moisture <= 80) return 'text-green-600';
    if (moisture < 40) return 'text-orange-500';
    return 'text-blue-500';
  }

  function exportToExcel() {
    const dataForExcel = allSensorData.map(row => ({
      'Waktu': new Date(row.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      'Nama Perangkat': row.deviceName,
      'MAC Address': row.deviceMac,
      'Kelembapan (%)': Number(row.moisture.toFixed(1)),
      'pH Tanah': Number(row.ph.toFixed(2)),
      'TDS (ppm)': Number(row.tds.toFixed(0))
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Sensor");
    
    // Tweak column widths for better reading
    const wscols = [
      {wch: 22}, // Waktu
      {wch: 20}, // Nama Perangkat
      {wch: 18}, // MAC Address
      {wch: 18}, // Kelembapan
      {wch: 12}, // pH Tanah
      {wch: 12}  // TDS
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `laporan_sensor_mangga_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }
</script>

<svelte:head>
  <title>Dashboard - IoT Mangga</title>
</svelte:head>

<div class="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
  <div class="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard IoT Mangga</h1>
      <p class="text-sm text-gray-500 mt-1 sm:mt-2">Pemantauan real-time seluruh perangkat IoT di lapangan.</p>
    </div>
    <div class="flex items-center gap-3">
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

  <!-- Tabs Navigation -->
  <div class="border-b border-gray-200 mb-8 overflow-x-auto pb-1" style="scrollbar-width: none; -ms-overflow-style: none;">
    <nav class="-mb-px flex space-x-4 sm:space-x-8 min-w-max px-1" aria-label="Tabs">
      <button 
        onclick={() => activeTab = 'cards'}
        class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'cards' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
      >
        <div class="flex items-center space-x-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
          <span>Dashboard</span>
        </div>
      </button>

      <button 
        onclick={() => activeTab = 'charts'}
        class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'charts' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
      >
        <div class="flex items-center space-x-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
          <span>Grafik</span>
        </div>
      </button>

      <button 
        onclick={() => activeTab = 'tables'}
        class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'tables' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
      >
        <div class="flex items-center space-x-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
          <span>Tabel</span>
        </div>
      </button>
    </nav>
  </div>

  {#snippet emptyState(message: string)}
    <div class="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-gray-100 border-dashed w-full h-full">
      <svg class="h-16 w-16 text-gray-200 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
      <p class="text-gray-500 font-medium">{message}</p>
    </div>
  {/snippet}

  <!-- Tab Content -->
  {#if activeTab === 'cards'}
    {#if filteredDevices.length === 0}
      {@render emptyState('Tidak ada kartu pohon yang sesuai dengan filter saat ini.')}
    {:else}
      <!-- Per-Device Cards -->
    <div class="grid grid-cols-1 gap-8">
      {#each filteredDevices as device}
        <div class="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 flex flex-col">
          <!-- Device Header -->
          <div class="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
            <div>
              <a href="/dashboard/devices/{device.id}" class="text-xl sm:text-2xl font-bold text-gray-900 hover:text-amber-600 transition-colors">
                {device.name}
              </a>
              <p class="text-xs sm:text-sm text-gray-500 font-mono mt-1">MAC: {device.macAddress}</p>
            </div>
          </div>
          
          <!-- Metric Cards -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <!-- Kelembapan Card -->
            <div class="bg-stone-50 rounded-2xl border border-gray-100 p-6 flex flex-col justify-center transition-colors hover:bg-stone-100">
              <div>
                <p class="text-sm font-medium text-gray-500">Kelembapan Tanah</p>
                {#if device.sensorData.length > 0}
                  <h3 class="text-3xl font-bold {getMoistureColor(device.sensorData[0].moisture)}">
                    {device.sensorData[0].moisture.toFixed(1)}<span class="text-lg font-medium text-gray-400 ml-1">%</span>
                  </h3>
                {:else}
                  <h3 class="text-xl font-medium text-gray-400">Belum ada data</h3>
                {/if}
              </div>
            </div>

            <!-- pH Card -->
            <div class="bg-stone-50 rounded-2xl border border-gray-100 p-6 flex flex-col justify-center transition-colors hover:bg-stone-100">
              <div>
                <p class="text-sm font-medium text-gray-500">pH Tanah</p>
                {#if device.sensorData.length > 0}
                  <h3 class="text-3xl font-bold {getPhColor(device.sensorData[0].ph)}">
                    {device.sensorData[0].ph.toFixed(2)}
                  </h3>
                {:else}
                  <h3 class="text-xl font-medium text-gray-400">Belum ada data</h3>
                {/if}
              </div>
            </div>

            <!-- TDS Card -->
            <div class="bg-stone-50 rounded-2xl border border-gray-100 p-6 flex flex-col justify-center transition-colors hover:bg-stone-100">
              <div>
                <p class="text-sm font-medium text-gray-500">Kadar Garam (TDS)</p>
                {#if device.sensorData.length > 0}
                  <h3 class="text-3xl font-bold text-gray-700">
                    {device.sensorData[0].tds.toFixed(0)}<span class="text-lg font-medium text-gray-400 ml-1">ppm</span>
                  </h3>
                {:else}
                  <h3 class="text-xl font-medium text-gray-400">Belum ada data</h3>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
    {/if}
  {/if}

  {#if activeTab === 'charts'}
    {#if filteredDevices.length === 0}
      {@render emptyState('Tidak ada data grafik yang sesuai dengan filter saat ini.')}
    {:else}
      <!-- Bar Charts -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 class="text-lg font-bold text-gray-800 mb-4">Grafik Kelembapan</h3>
        <div class="h-64 w-full relative">
          <Line data={chartDataMoisture} options={chartOptionsMoisture} />
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 class="text-lg font-bold text-gray-800 mb-4">Grafik pH Tanah</h3>
        <div class="h-64 w-full relative">
          <Line data={chartDataPh} options={chartOptionsPh} />
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 class="text-lg font-bold text-gray-800 mb-4">Grafik TDS</h3>
        <div class="h-64 w-full relative">
          <Line data={chartDataTds} options={chartOptionsTds} />
        </div>
      </div>
    </div>
    {/if}
  {/if}

  {#if activeTab === 'tables'}
    <!-- Status List / Table -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
      <div class="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-stone-50/50">
        <h3 class="text-lg font-bold text-gray-800">Tabel Semua Pohon</h3>
        <button 
          onclick={exportToExcel}
          disabled={allSensorData.length === 0}
          class="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path></svg>
          Export Excel
        </button>
      </div>
      {#if allSensorData.length === 0}
        <div class="p-8">
          {@render emptyState('Belum ada data sensor yang terekam.')}
        </div>
      {:else}
        <div class="overflow-x-auto overflow-y-auto flex-1 max-h-[500px] w-full">
        <table class="hidden sm:table min-w-full divide-y divide-gray-200">
          <thead class="bg-stone-50 sticky top-0 shadow-sm z-10">
            <tr>
              <th scope="col" class="px-4 sm:px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Waktu</th>
              <th scope="col" class="px-4 sm:px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Nama Perangkat</th>
              <th scope="col" class="px-4 sm:px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Kelembapan</th>
              <th scope="col" class="px-4 sm:px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">pH Tanah</th>
              <th scope="col" class="px-4 sm:px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">TDS</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-100">
            {#each paginatedData as row}
              <tr class="hover:bg-stone-50 transition-colors">
                <td class="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(row.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
                <td class="px-4 sm:px-6 py-4 whitespace-nowrap">
                  <a href="/dashboard/devices/{row.deviceId}" class="text-sm font-medium text-gray-900 hover:text-amber-600 underline-offset-2 hover:underline">
                    {row.deviceName}
                  </a>
                  <p class="text-xs text-gray-500 font-mono mt-0.5" title="MAC Address">{row.deviceMac}</p>
                </td>
                <td class="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                  <span class={row.moisture < 40 ? 'text-orange-600 font-bold' : ''}>
                    {row.moisture.toFixed(1)}%
                  </span>
                </td>
                <td class="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                  {row.ph.toFixed(2)}
                </td>
                <td class="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                  {row.tds.toFixed(0)} ppm
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        
        <!-- Mobile Card View -->
        <div class="sm:hidden flex flex-col divide-y divide-gray-100">
          {#each paginatedData as row}
            <div class="p-4 hover:bg-stone-50 transition-colors">
              <div class="flex justify-between items-start mb-2">
                <div>
                  <a href="/dashboard/devices/{row.deviceId}" class="text-sm font-bold text-gray-900 hover:text-amber-600 underline-offset-2 hover:underline">
                    {row.deviceName}
                  </a>
                  <p class="text-xs text-gray-500 font-mono mt-0.5">{row.deviceMac}</p>
                </div>
                <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md border border-gray-200">{new Date(row.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div class="grid grid-cols-3 gap-2 text-center mt-3">
                <div class="bg-stone-50 p-2 rounded-lg border border-gray-100">
                  <p class="text-[10px] text-gray-500 uppercase font-bold mb-1">Moist</p>
                  <p class="text-sm font-bold {row.moisture < 40 ? 'text-orange-600' : 'text-gray-900'}">{row.moisture.toFixed(1)}%</p>
                </div>
                <div class="bg-stone-50 p-2 rounded-lg border border-gray-100">
                  <p class="text-[10px] text-gray-500 uppercase font-bold mb-1">pH</p>
                  <p class="text-sm font-bold text-gray-900">{row.ph.toFixed(2)}</p>
                </div>
                <div class="bg-stone-50 p-2 rounded-lg border border-gray-100">
                  <p class="text-[10px] text-gray-500 uppercase font-bold mb-1">TDS</p>
                  <p class="text-sm font-bold text-gray-900">{row.tds.toFixed(0)}</p>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
      
      <!-- Pagination Controls -->
      <div class="px-4 py-3 border-t border-gray-200 bg-stone-50 flex items-center justify-between sm:px-6">
        <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p class="text-sm text-gray-700">
              Menampilkan <span class="font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> hingga <span class="font-medium">{Math.min(currentPage * itemsPerPage, allSensorData.length)}</span> dari <span class="font-medium">{allSensorData.length}</span> data
            </p>
          </div>
          <div>
            <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              <button 
                disabled={currentPage === 1}
                onclick={() => currentPage--}
                class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span class="sr-only">Sebelumnya</span>
                <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
              </button>
              
              <span class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                Halaman {currentPage} dari {totalPages}
              </span>

              <button 
                disabled={currentPage === totalPages}
                onclick={() => currentPage++}
                class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span class="sr-only">Selanjutnya</span>
                <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg>
              </button>
            </nav>
          </div>
        </div>
        
        <!-- Mobile Pagination -->
        <div class="flex items-center justify-between w-full sm:hidden">
          <button 
            disabled={currentPage === 1}
            onclick={() => currentPage--}
            class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Sebelumnya
          </button>
          <span class="text-sm text-gray-700 font-medium">Hal {currentPage}/{totalPages}</span>
          <button 
            disabled={currentPage === totalPages}
            onclick={() => currentPage++}
            class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Selanjutnya
          </button>
        </div>
      </div>
      {/if}
    </div>
  {/if}
</div>
