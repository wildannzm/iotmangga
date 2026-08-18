<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let storefrontData = $derived(data.storefrontData);

  // Search & Location Filter State
  let searchQuery = $state('');
  let activeLocation = $state('Semua');

  // Modals state
  let isSensorModalOpen = $state(false);
  let activeSensorDevice = $state<any>(null);
  let activeSensorProduct = $state<any>(null);
  let activeChartMetric = $state<'moisture' | 'ph' | 'tds'>('moisture');

  let isImageViewerOpen = $state(false);
  let activeImageProduct = $state<any>(null);

  // Toast state
  let toastMessage = $state('');
  let showToastState = $state(false);

  // Canvas element reference
  let canvasElement: HTMLCanvasElement | null = $state(null);

  // Live sensor indicator & Realtime updates
  let isConnected = $state(false);
  let isLive = $state(false);
  let recentlyUpdatedDeviceIds = $state<Set<string>>(new Set());
  let realtimeSensorMap = $state<Record<string, { moisture: number; ph: number; tds: number; hasData: boolean }>>({});

  function getSensorAvg(device: { id: string; sensorAvg: { moisture: number; ph: number; tds: number; hasData: boolean } }) {
    return realtimeSensorMap[device.id] ?? device.sensorAvg;
  }

  // Supabase Realtime channel
  let channel: ReturnType<typeof supabase.channel> | null = null;

  onMount(() => {
    const fallbackTimer = setTimeout(() => { isConnected = true; }, 3000);

    channel = supabase
      .channel('storefront-sensor-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'SensorData' }, (payload) => {
        const incoming = payload.new as { deviceId: string; moisture: number; ph: number; tds: number };

        let initialSensorAvg = { moisture: 0, ph: 0, tds: 0, hasData: false };
        for (const kebun of data.storefrontData) {
          const dev = kebun.devices.find(d => d.id === incoming.deviceId);
          if (dev) {
            initialSensorAvg = dev.sensorAvg;
            break;
          }
        }

        const prev = realtimeSensorMap[incoming.deviceId] ?? initialSensorAvg;
        const alpha = 1 / 20;

        realtimeSensorMap[incoming.deviceId] = prev.hasData
          ? {
              moisture: prev.moisture * (1 - alpha) + incoming.moisture * alpha,
              ph: prev.ph * (1 - alpha) + incoming.ph * alpha,
              tds: prev.tds * (1 - alpha) + incoming.tds * alpha,
              hasData: true
            }
          : { moisture: incoming.moisture, ph: incoming.ph, tds: incoming.tds, hasData: true };

        isLive = true;
        recentlyUpdatedDeviceIds = new Set([...recentlyUpdatedDeviceIds, incoming.deviceId]);
        setTimeout(() => {
          recentlyUpdatedDeviceIds = new Set([...recentlyUpdatedDeviceIds].filter(id => id !== incoming.deviceId));
        }, 3000);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          isConnected = true;
          clearTimeout(fallbackTimer);
        }
      });
  });

  onDestroy(() => { if (channel) supabase.removeChannel(channel); });

  // Flat list of all products
  let allProducts = $derived(
    storefrontData.flatMap(kebun =>
      kebun.devices.flatMap(device =>
        device.products.map(p => ({
          ...p,
          kebunName: kebun.name,
          kebunId: kebun.id,
          kebunLocation: kebun.location,
          waNumber: kebun.waNumber,
          deviceName: device.name,
          deviceId: device.id,
          sensorAvg: getSensorAvg(device),
          history: device.history
        }))
      )
    )
  );

  // Available locations
  let availableLocations = $derived([
    'Semua',
    ...Array.from(new Set(allProducts.map(p => p.kebunLocation).filter(Boolean)))
  ]);

  // Filtered products derived state
  let filteredProducts = $derived(() => {
    let results = allProducts;
    if (activeLocation !== 'Semua') {
      results = results.filter(p => p.kebunLocation === activeLocation);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        p.kebunName.toLowerCase().includes(q) ||
        p.kebunLocation.toLowerCase().includes(q)
      );
    }
    return results;
  });

  function getLocationProductCount(loc: string) {
    if (loc === 'Semua') return allProducts.length;
    return allProducts.filter(p => p.kebunLocation === loc).length;
  }

  function formatPrice(price: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price);
  }

  // Sensor Telemetry Modal & Chart
  function openSensorModal(product: any) {
    activeSensorProduct = product;
    activeSensorDevice = {
      name: product.deviceName,
      sensorAvg: product.sensorAvg,
      history: product.history
    };
    activeChartMetric = 'moisture';
    isSensorModalOpen = true;

    setTimeout(() => {
      drawSensorChart();
    }, 100);
  }

  function closeSensorModal() {
    isSensorModalOpen = false;
  }

  function switchChartMetric(metric: 'moisture' | 'ph' | 'tds') {
    activeChartMetric = metric;
    drawSensorChart();
  }

  function drawSensorChart() {
    if (!canvasElement || !activeSensorDevice || !activeSensorDevice.history) return;

    const ctx = canvasElement.getContext('2d');
    if (!ctx) return;

    const rect = canvasElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvasElement.width = rect.width * dpr || 500;
    canvasElement.height = rect.height * dpr || 200;

    const width = canvasElement.width;
    const height = canvasElement.height;

    ctx.clearRect(0, 0, width, height);

    const history = activeSensorDevice.history;
    const dates = history.dates && history.dates.length ? history.dates : ['01/08', '02/08', '03/08', '04/08', '05/08', '06/08', '07/08'];
    const rawValues = history[activeChartMetric] && history[activeChartMetric].length
      ? history[activeChartMetric]
      : (activeChartMetric === 'moisture' ? [70, 72, 75, 74, 76, 75, 75] : activeChartMetric === 'ph' ? [6.8, 6.9, 7.0, 7.1, 7.0, 7.2, 7.1] : [160, 165, 170, 172, 175, 176, 177]);

    const paddingLeft = 45 * dpr;
    const paddingRight = 20 * dpr;
    const paddingTop = 20 * dpr;
    const paddingBottom = 35 * dpr;

    const minVal = Math.min(...rawValues) * 0.85;
    const maxVal = Math.max(...rawValues) * 1.15 || 1;

    const chartW = width - paddingLeft - paddingRight;
    const chartH = height - paddingTop - paddingBottom;

    // Grid lines & Y Axis labels
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = `${10 * dpr}px Inter, sans-serif`;

    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const y = paddingTop + (chartH / steps) * i;
      const val = (maxVal - ((maxVal - minVal) / steps) * i).toFixed(1);

      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();

      ctx.fillText(val, 5 * dpr, y + 3);
    }

    // Calculate coordinates
    const points = rawValues.map((val: number, idx: number) => {
      const x = paddingLeft + (chartW / (rawValues.length - 1 || 1)) * idx;
      const y = paddingTop + chartH - ((val - minVal) / (maxVal - minVal || 1)) * chartH;
      return { x, y, val, date: dates[idx] ?? '' };
    });

    // Fill Gradient
    const gradient = ctx.createLinearGradient(0, paddingTop, 0, height - paddingBottom);
    if (activeChartMetric === 'moisture') {
      gradient.addColorStop(0, 'rgba(59, 130, 246, 0.35)');
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
    } else if (activeChartMetric === 'ph') {
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
    } else {
      gradient.addColorStop(0, 'rgba(168, 85, 247, 0.35)');
      gradient.addColorStop(1, 'rgba(168, 85, 247, 0.0)');
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, height - paddingBottom);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, height - paddingBottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw Chart Line
    ctx.beginPath();
    points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });

    ctx.strokeStyle = activeChartMetric === 'moisture' ? '#3b82f6' : activeChartMetric === 'ph' ? '#10b981' : '#a855f7';
    ctx.lineWidth = 3 * dpr;
    ctx.stroke();

    // Points and X Axis Labels
    const totalPoints = points.length;
    const labelStep = Math.max(1, Math.floor(totalPoints / 5));

    points.forEach((p, idx) => {
      // Draw X Axis date-time text at clean intervals to avoid text overlap
      if (idx === 0 || idx === totalPoints - 1 || idx % labelStep === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = `${9 * dpr}px Inter, sans-serif`;
        ctx.fillText(p.date, Math.max(paddingLeft - (15 * dpr), Math.min(p.x - (20 * dpr), width - paddingRight - (40 * dpr))), height - (8 * dpr));
      }

      // Circle point
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = activeChartMetric === 'moisture' ? '#3b82f6' : activeChartMetric === 'ph' ? '#10b981' : '#a855f7';
      ctx.lineWidth = 2 * dpr;
      ctx.stroke();

      // Point Value Tag
      if (totalPoints <= 10 || idx % 2 === 0 || idx === totalPoints - 1) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${8.5 * dpr}px Inter, sans-serif`;
        ctx.fillText(String(p.val), p.x - (7 * dpr), p.y - (7 * dpr));
      }
    });
  }

  // Image Viewer Modal
  function openImageViewer(product: any) {
    activeImageProduct = product;
    isImageViewerOpen = true;
  }

  function closeImageViewer() {
    isImageViewerOpen = false;
  }

  // WhatsApp Direct Order Flow
  function orderViaWA(product: any) {
    const formattedPrice = formatPrice(product.price);
    const waPhone = product.waNumber || '6281234567890';
    const message = `Halo ${product.kebunName}! Saya berminat memesan produk berikut:%0A%0A` +
                    `🥭 *Produk:* ${product.name}%0A` +
                    `📍 *Kebun Lokasi:* ${product.kebunLocation}%0A` +
                    `💰 *Harga:* ${formattedPrice}/${product.unit}%0A%0A` +
                    `Mohon informasi stok dan cara pengiriman. Terima kasih!`;

    const waUrl = `https://wa.me/${waPhone}?text=${message}`;

    triggerToast(`Membuka WhatsApp untuk memesan ${product.name}`);

    setTimeout(() => {
      window.open(waUrl, '_blank');
    }, 800);
  }

  function triggerToast(text: string) {
    toastMessage = text;
    showToastState = true;
    setTimeout(() => {
      showToastState = false;
    }, 3000);
  }
</script>

<svelte:head>
  <title>MangoFresh - IoT Mango Marketplace</title>
  <meta name="description" content="Platform e-commerce mangga berbasis IoT. Data sensor terverifikasi realtime." />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</svelte:head>

<div style="font-family: 'Inter', sans-serif;" class="bg-slate-50 text-slate-800 min-h-screen flex flex-col antialiased">

  <!-- TOP ANNOUNCEMENT BAR -->
  <div class="bg-orange-600 text-white text-xs sm:text-sm py-2 px-4 text-center font-medium tracking-wide shadow-sm flex items-center justify-center gap-2">
    <span>🥭</span>
    <span>Kualitas mangga terverifikasi sensor IoT realtime · Langsung dari kebun ke tangan Anda</span>
  </div>

  <!-- STICKY HEADER -->
  <header class="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
      <!-- Logo -->
      <a href="/" class="flex items-center gap-2 group shrink-0">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
          <span class="text-xl">🥭</span>
        </div>
        <span class="text-xl font-extrabold tracking-tight text-slate-900">
          Mango<span class="text-orange-600">Fresh</span>
        </span>
      </a>

      <!-- Global Search Box -->
      <div class="flex-1 max-w-xl">
        <div class="relative">
          <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Cari mangga, kebun, atau varietas..."
            class="w-full pl-10 pr-4 py-2 bg-slate-100 hover:bg-slate-50 focus:bg-white text-slate-800 placeholder-slate-400 rounded-full text-sm border border-transparent focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all"
          />
        </div>
      </div>

      <!-- Header Badge Info -->
      <div class="hidden sm:flex items-center gap-3 text-xs font-semibold text-slate-600">
        <div class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>IoT Sensor Active</span>
        </div>
      </div>
    </div>
  </header>

  <!-- HERO BANNER -->
  <section class="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-400 text-white py-10 md:py-14 px-4 sm:px-6 lg:px-8 relative overflow-hidden shadow-inner">
    <div class="max-w-7xl mx-auto relative z-10">
      <div class="max-w-2xl">
        <h1 class="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight mb-3 text-white drop-shadow-sm">
          Mangga Segar<br class="hidden sm:inline"> Langsung dari Kebun
        </h1>
        <p class="text-orange-50 text-base sm:text-lg leading-relaxed font-normal opacity-95">
          Setiap produk dilengkapi data sensor tanah realtime — kelembapan, pH, dan nutrisi — sehingga kualitas benar-benar terverifikasi secara presisi.
        </p>
      </div>
    </div>
    <div class="absolute right-4 -bottom-10 opacity-15 pointer-events-none hidden md:block">
      <svg width="320" height="320" viewBox="0 0 200 200" fill="currentColor" class="text-yellow-200">
        <path d="M44.7,-58.2C56.6,-47.5,64.2,-31.8,67.8,-15.1C71.4,1.6,71,19.3,63.1,33.4C55.2,47.5,39.8,58,22.8,64.3C5.8,70.5,-12.8,72.4,-29.4,66.5C-46,60.6,-60.7,46.8,-68.2,29.7C-75.7,12.6,-76,-7.9,-69.5,-25.1C-63,-42.2,-49.6,-56.1,-34.5,-65.4C-19.4,-74.6,-2.6,-79.3,12.8,-75.7C28.2,-72.1,32.8,-68.9,44.7,-58.2Z" transform="translate(100 100)" />
      </svg>
    </div>
  </section>

  <!-- MAIN CONTENT CONTAINER -->
  <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

    <!-- Filter Controls Container -->
    <div class="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 mb-8 space-y-4">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
            <i class="fa-solid fa-location-dot text-orange-500"></i>
            Pilih Lokasi Kebun Mangga
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">Klik filter lokasi di bawah ini untuk menyaring produk secara presisi</p>
        </div>
        <!-- Total Product Counter -->
        <div class="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg self-start md:self-auto">
          Menampilkan <span class="text-orange-600 font-bold">{filteredProducts().length}</span> Produk
        </div>
      </div>

      <!-- Horizontal Scrollable Location Filter Pills -->
      <div class="flex items-center gap-2 overflow-x-auto pb-2 pt-1">
        {#each availableLocations as loc}
          {@const isActive = loc === activeLocation}
          {@const count = getLocationProductCount(loc)}
          <button
            onclick={() => activeLocation = loc}
            class="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-2 cursor-pointer
              {isActive
                ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20 ring-2 ring-orange-400/30'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60'}"
          >
            <i class="fa-solid {loc === 'Semua' ? 'fa-layer-group' : 'fa-location-dot text-orange-400'} text-xs"></i>
            <span>{loc}</span>
            <span class="px-1.5 py-0.5 rounded-full text-[10px] {isActive ? 'bg-orange-700 text-white' : 'bg-slate-200 text-slate-600'}">
              {count}
            </span>
          </button>
        {/each}
      </div>
    </div>

    <!-- Product Cards Grid -->
    {#if filteredProducts().length === 0}
      <!-- Empty State -->
      <div class="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 my-6">
        <div class="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🔍</div>
        <h3 class="text-base font-bold text-slate-800">Tidak ada produk ditemukan</h3>
        <p class="text-slate-500 text-sm mt-1">Coba ubah kata kunci atau pilih lokasi kebun lain.</p>
        <button
          onclick={() => { activeLocation = 'Semua'; searchQuery = ''; }}
          class="mt-4 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer"
        >
          Reset Filter
        </button>
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {#each filteredProducts() as product (product.id)}
          <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden group hover:-translate-y-1">

            <!-- Card Top Image (Clickable for Lightbox) -->
            <div
              onclick={() => openImageViewer(product)}
              class="relative h-48 w-full overflow-hidden bg-slate-100 cursor-pointer group/img"
            >
              {#if product.imageUrl}
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  class="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-500"
                  loading="lazy"
                  onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              {:else}
                <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
                  <span class="text-5xl group-hover/img:scale-110 transition-transform">🥭</span>
                </div>
              {/if}

              <!-- Hover Overlay Hint -->
              <div class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/img:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2 text-white font-semibold text-xs backdrop-blur-xs">
                <span class="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-sm">🔍</span>
                <span>Lihat Foto Kebun & Buah</span>
              </div>

              <!-- Location Pill Badge on Top Right -->
              <div class="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-md">
                <i class="fa-solid fa-location-dot text-orange-400 text-[11px]"></i>
                <span>{product.kebunLocation}</span>
              </div>

              <!-- Farm Name Tag on Top Left -->
              <div class="absolute top-3 left-3 bg-white/90 backdrop-blur-md text-slate-800 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1.5 shadow-sm border border-slate-200">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                <span>{product.kebunName}</span>
              </div>
            </div>

            <!-- Card Body -->
            <div class="p-4 sm:p-5 flex-1 flex flex-col justify-between">
              <div>
                <!-- Product Title & Variety -->
                <h3 class="text-base font-extrabold text-slate-900 group-hover:text-orange-600 transition-colors line-clamp-1">
                  {product.name}
                </h3>
                <p class="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  {product.description ?? product.deviceName}
                </p>

                <!-- Price and Stock Details -->
                <div class="mt-3 flex items-baseline justify-between">
                  <div>
                    <span class="text-lg font-black text-orange-600">{formatPrice(product.price)}</span>
                    <span class="text-xs text-slate-400 font-normal">/{product.unit}</span>
                  </div>
                  <div class="text-right text-xs">
                    <span class="text-slate-500 font-medium">Stok: <strong class="text-slate-700">{product.stock} {product.unit}</strong></span>
                  </div>
                </div>
              </div>

              <!-- BUTTON TO OPEN SENSOR HISTORY & GRAPH MODAL -->
              <button
                onclick={() => openSensorModal(product)}
                class="w-full bg-orange-50 hover:bg-orange-100 active:bg-orange-200 text-orange-700 font-bold text-[11px] py-1.5 px-3 mt-4 rounded-lg border border-orange-200/80 transition-all flex items-center justify-center gap-1.5 group/sensorBtn cursor-pointer"
              >
                <i class="fa-solid fa-chart-line text-orange-600 group-hover/sensorBtn:scale-110 transition-transform"></i>
                <span>Lihat Riwayat & Grafik Sensor</span>
              </button>

              <!-- Card Bottom Action Section -->
              <div class="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
                <div class="flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    <i class="fa-regular fa-calendar-check mr-1"></i>
                    Panen: {product.harvestDate ? new Date(product.harvestDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Segar Hari Ini'}
                  </span>
                  <span class="text-emerald-600 font-medium">Tersedia</span>
                </div>

                <!-- ORDER VIA WHATSAPP BUTTON -->
                <button
                  onclick={() => orderViaWA(product)}
                  class="w-full mt-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm py-2.5 px-4 rounded-xl shadow-md hover:shadow-lg hover:shadow-emerald-600/20 transition-all duration-200 flex items-center justify-center gap-2 group/btn cursor-pointer"
                >
                  <i class="fa-brands fa-whatsapp text-lg group-hover/btn:scale-110 transition-transform"></i>
                  <span>Pesan Sekarang via WA</span>
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </main>

  <!-- IMAGE VIEWER MODAL / LIGHTBOX -->
  {#if isImageViewerOpen && activeImageProduct}
    <div
      onclick={(e) => { if (e.target === e.currentTarget) closeImageViewer(); }}
      class="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-3 sm:p-5 overflow-y-auto max-h-screen transition-all duration-300 select-none"
    >
      <!-- Top Bar -->
      <div class="flex items-center justify-between text-white max-w-5xl w-full mx-auto shrink-0 mb-2">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center text-base sm:text-lg">
            🥭
          </div>
          <div>
            <h4 class="font-bold text-sm sm:text-base text-slate-100 leading-tight line-clamp-1">{activeImageProduct.name}</h4>
            <p class="text-[11px] sm:text-xs text-slate-400">
              <span class="text-orange-400 font-medium">📍 {activeImageProduct.kebunLocation}</span> · {activeImageProduct.kebunName}
            </p>
          </div>
        </div>
        <button
          onclick={closeImageViewer}
          class="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 transition-all cursor-pointer shrink-0"
        >
          <i class="fa-solid fa-xmark text-base sm:text-lg"></i>
        </button>
      </div>

      <!-- Main Image Display -->
      <div class="flex-1 min-h-0 flex flex-col items-center justify-center my-2 max-w-5xl w-full mx-auto overflow-hidden">
        {#if activeImageProduct.imageUrl}
          <img
            src={activeImageProduct.imageUrl}
            alt={activeImageProduct.name}
            class="max-h-[48vh] sm:max-h-[55vh] md:max-h-[58vh] w-auto max-w-full object-contain rounded-2xl shadow-2xl border border-slate-800 shrink"
          />
        {:else}
          <div class="w-48 h-48 sm:w-64 sm:h-64 bg-slate-900 rounded-2xl flex items-center justify-center text-6xl sm:text-7xl">🥭</div>
        {/if}
        <div class="mt-2.5 bg-slate-900/90 border border-slate-800 text-slate-200 text-xs px-3.5 py-2 rounded-xl max-w-md text-center backdrop-blur-md shadow-lg shrink-0">
          <span class="bg-orange-500/20 text-orange-300 text-[10px] font-bold px-2 py-0.5 rounded-md mr-1.5 inline-block">Foto Produk</span>
          <span class="text-slate-300 font-medium">{activeImageProduct.name} — {activeImageProduct.kebunName} ({activeImageProduct.kebunLocation})</span>
        </div>
      </div>

      <!-- Bottom Bar -->
      <div class="max-w-3xl w-full mx-auto bg-slate-900/90 rounded-2xl p-2.5 border border-slate-800 text-center shrink-0 mt-2">
        <button
          onclick={() => orderViaWA(activeImageProduct)}
          class="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer inline-flex items-center justify-center gap-2 shadow-md hover:shadow-emerald-600/20"
        >
          <i class="fa-brands fa-whatsapp text-base sm:text-lg"></i>
          <span>Pesan Buah Ini via WhatsApp</span>
        </button>
      </div>
    </div>
  {/if}

  <!-- SENSOR HISTORY & GRAPH MODAL -->
  {#if isSensorModalOpen && activeSensorProduct}
    <div class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 transition-all duration-300">
      <div class="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        <!-- Modal Header -->
        <div class="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center text-lg">
              <i class="fa-solid fa-chart-line"></i>
            </div>
            <div>
              <h3 class="font-extrabold text-base sm:text-lg text-white">Riwayat Sensor Kebun</h3>
              <p class="text-xs text-slate-400">{activeSensorProduct.kebunName} ({activeSensorProduct.kebunLocation}) · {activeSensorProduct.deviceName}</p>
            </div>
          </div>
          <button
            onclick={closeSensorModal}
            class="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 transition-colors cursor-pointer"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Modal Content Body -->
        <div class="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
          
          <!-- Live Current Metrics Summary Cards -->
          <div class="grid grid-cols-3 gap-3">
            <div class="bg-blue-50/70 border border-blue-100 rounded-xl p-3 text-center">
              <div class="text-[11px] font-semibold text-blue-600 mb-0.5">💧 Kelembapan</div>
              <div class="text-lg sm:text-xl font-black text-blue-900">{activeSensorProduct.sensorAvg.moisture.toFixed(0)}%</div>
              <div class="text-[10px] text-blue-500 mt-0.5">Sensor Tanah</div>
            </div>
            <div class="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 text-center">
              <div class="text-[11px] font-semibold text-emerald-600 mb-0.5">🌾 pH Tanah</div>
              <div class="text-lg sm:text-xl font-black text-emerald-900">{activeSensorProduct.sensorAvg.ph.toFixed(1)}</div>
              <div class="text-[10px] text-emerald-500 mt-0.5">Tingkat Keasaman</div>
            </div>
            <div class="bg-purple-50/70 border border-purple-100 rounded-xl p-3 text-center">
              <div class="text-[11px] font-semibold text-purple-600 mb-0.5">🧪 TDS Nutrisi</div>
              <div class="text-lg sm:text-xl font-black text-purple-900">{activeSensorProduct.sensorAvg.tds.toFixed(0)} ppm</div>
              <div class="text-[10px] text-purple-500 mt-0.5">Kandungan Mineral</div>
            </div>
          </div>

          <!-- Tab Selector for Chart Type -->
          <div class="flex items-center justify-between border-b border-slate-200 pb-3">
            <span class="text-xs font-bold text-slate-700">Grafik Telemetri:</span>
            <div class="flex items-center gap-1.5 text-xs">
              <button
                onclick={() => switchChartMetric('moisture')}
                class="px-3 py-1 rounded-lg font-bold transition-all cursor-pointer {activeChartMetric === 'moisture' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
              >💧 Kelembapan</button>
              <button
                onclick={() => switchChartMetric('ph')}
                class="px-3 py-1 rounded-lg font-bold transition-all cursor-pointer {activeChartMetric === 'ph' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
              >🌾 pH</button>
              <button
                onclick={() => switchChartMetric('tds')}
                class="px-3 py-1 rounded-lg font-bold transition-all cursor-pointer {activeChartMetric === 'tds' ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
              >🧪 TDS</button>
            </div>
          </div>

          <!-- Canvas Chart Area -->
          <div class="bg-slate-900 rounded-xl p-4 shadow-inner relative">
            <div class="flex items-center justify-between text-xs text-slate-400 mb-3">
              <span class="font-semibold text-slate-200">
                {activeChartMetric === 'moisture' ? 'Tren Kelembapan Tanah (%)' : activeChartMetric === 'ph' ? 'Tren pH Tanah' : 'Tren Nutrisi / TDS (ppm)'}
              </span>
              <span class="text-[11px] text-emerald-400 flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Dynamic IoT Node
              </span>
            </div>
            <div class="h-48 w-full relative">
              <canvas bind:this={canvasElement} class="w-full h-full block"></canvas>
            </div>
          </div>

          <!-- Historical Summary note -->
          <div class="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-900">
            <i class="fa-solid fa-circle-info text-amber-600 text-base shrink-0 mt-0.5"></i>
            <div>
              <span class="font-bold">Informasi Telemetri Kebun:</span> Data diambil dari sensor perakaran secara otomatis. Riwayat ini mencerminkan stabilitas nutrisi dan kadar air tanah tempat buah tumbuh.
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="bg-slate-50 border-t border-slate-100 p-3 sm:px-6 flex justify-between items-center">
          <button
            onclick={() => orderViaWA(activeSensorProduct)}
            class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <i class="fa-brands fa-whatsapp text-sm"></i>
            <span>Pesan via WA</span>
          </button>
          <button
            onclick={closeSensorModal}
            class="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Tutup Riwayat
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- TOAST NOTIFICATION -->
  {#if showToastState}
    <div class="fixed bottom-5 right-5 z-50 transition-all duration-300">
      <div class="bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700">
        <div class="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
          <i class="fa-solid fa-check"></i>
        </div>
        <div>
          <p class="text-sm font-medium">{toastMessage}</p>
          <p class="text-xs text-slate-400">Mengarahkan ke WhatsApp...</p>
        </div>
      </div>
    </div>
  {/if}

  <!-- FOOTER -->
  <footer class="bg-slate-900 text-slate-400 mt-16 border-t border-slate-800">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center text-white text-xs">🥭</div>
        <span class="text-white font-bold tracking-tight text-lg">MangoFresh</span>
      </div>
      <p class="text-xs text-slate-400 text-center sm:text-right">
        Platform e-commerce mangga berbasis IoT. Data sensor terverifikasi realtime.
      </p>
    </div>
    <div class="bg-slate-950 py-4 px-4 text-center text-xs text-slate-500 border-t border-slate-800/80">
      © 2026 MangoFresh · IoT Mangga Monitoring System. All rights reserved.
    </div>
  </footer>

</div>
