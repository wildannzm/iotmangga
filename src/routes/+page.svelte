<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let storefrontData = $derived(data.storefrontData);

  // Search
  let searchQuery = $state('');

  // Live sensor indicator
  let isConnected = $state(false); // WebSocket berhasil subscribe
  let isLive = $state(false);      // Ada data sensor masuk
  let lastUpdated = $state<Date | null>(null);
  let recentlyUpdatedDeviceIds = $state<Set<string>>(new Set());

  // Realtime sensor overrides per deviceId
  let realtimeSensorMap = $state<Record<string, { moisture: number; ph: number; tds: number; hasData: boolean }>>({});

  function getSensorAvg(device: { id: string; sensorAvg: { moisture: number; ph: number; tds: number; hasData: boolean } }) {
    return realtimeSensorMap[device.id] ?? device.sensorAvg;
  }

  // Supabase realtime
  let channel: ReturnType<typeof supabase.channel> | null = null;

  onMount(() => {
    // Fallback: setelah 3 detik anggap sudah terhubung
    const fallbackTimer = setTimeout(() => { isConnected = true; }, 3000);

    channel = supabase
      .channel('storefront-sensor-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'SensorData' }, (payload) => {
        const incoming = payload.new as { deviceId: string; moisture: number; ph: number; tds: number };

        // Find existing device initial sensorAvg
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
        lastUpdated = new Date();
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

  // All products flat list (for search/filter)
  let allProducts = $derived(
    storefrontData.flatMap(kebun =>
      kebun.devices.flatMap(device =>
        device.products.map(p => ({
          ...p,
          kebunName: kebun.name,
          kebunId: kebun.id,
          kebunLocation: kebun.location,
          deviceName: device.name,
          deviceId: device.id,
          sensorAvg: getSensorAvg(device)
        }))
      )
    )
  );

  let filteredProducts = $derived(() => {
    let results = allProducts;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        p.kebunName.toLowerCase().includes(q)
      );
    }
    return results;
  });

  let totalProducts = $derived(allProducts.length);
  let totalKebun = $derived(storefrontData.length);

  function formatPrice(price: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price);
  }

  function phLabel(ph: number) {
    if (ph >= 5.5 && ph <= 7.5) return { label: 'Optimal', cls: 'bg-green-100 text-green-700' };
    if ((ph >= 4.5 && ph < 5.5) || (ph > 7.5 && ph <= 8.5)) return { label: 'Cukup', cls: 'bg-yellow-100 text-yellow-700' };
    return { label: 'Perhatian', cls: 'bg-red-100 text-red-700' };
  }

  function moistureLabel(m: number) {
    if (m >= 40 && m <= 80) return { label: 'Optimal', cls: 'bg-green-100 text-green-700' };
    if (m < 40) return { label: 'Kering', cls: 'bg-orange-100 text-orange-700' };
    return { label: 'Basah', cls: 'bg-blue-100 text-blue-700' };
  }
</script>

<svelte:head>
  <title>Etalase Mangga Segar — IoT Mangga</title>
  <meta name="description" content="Beli mangga segar langsung dari kebun IoT terverifikasi. Kualitas tanah terpantau realtime." />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</svelte:head>

<div style="font-family: 'Inter', sans-serif;" class="min-h-screen bg-gray-50">

  <!-- ===== TOP BAR ===== -->
  <div class="bg-orange-500 text-white text-xs py-1.5 text-center font-medium tracking-wide">
    🥭 Kualitas mangga terverifikasi sensor IoT realtime &nbsp;·&nbsp; Langsung dari kebun ke tangan Anda
  </div>

  <!-- ===== STICKY HEADER ===== -->
  <header class="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-100">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center gap-4 h-16">
        <!-- Logo -->
        <a href="/" class="flex items-center gap-2 flex-shrink-0">
          <span class="text-2xl">🥭</span>
          <span class="font-extrabold text-orange-500 text-lg leading-none">Mango<span class="text-green-600">Fresh</span></span>
        </a>

        <!-- Search Bar -->
        <div class="flex-1 max-w-2xl">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
            </svg>
            <input
              id="search-input"
              type="text"
              placeholder="Cari mangga, kebun, atau varietas..."
              bind:value={searchQuery}
              class="w-full pl-10 pr-4 py-2.5 bg-gray-100 border border-transparent rounded-full text-sm focus:outline-none focus:bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
            />
          </div>
        </div>

      </div>
    </div>
  </header>

  <!-- ===== HERO BANNER ===== -->
  <section class="relative overflow-hidden bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300">
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute -right-16 top-1/2 -translate-y-1/2 text-[200px] opacity-10 select-none">🥭</div>
      <div class="absolute right-48 -top-8 text-[80px] opacity-10 rotate-12 select-none">🌿</div>
    </div>
    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div class="max-w-lg">
        <h1 class="text-3xl sm:text-4xl font-extrabold text-white leading-tight drop-shadow">
          Mangga Segar<br/>Langsung dari Kebun
        </h1>
        <p class="mt-3 text-white/90 text-sm sm:text-base leading-relaxed">
          Setiap produk dilengkapi data sensor tanah realtime — kelembapan, pH, dan nutrisi — sehingga kualitas benar-benar terverifikasi.
        </p>
        <div class="mt-5 flex flex-wrap gap-3">
          {#if lastUpdated}
            <div class="bg-white/20 backdrop-blur rounded-xl px-4 py-2 text-white text-center">
              <p class="text-xs font-bold">Update Terakhir</p>
              <p class="text-xs text-white/80">{lastUpdated.toLocaleTimeString('id-ID')}</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </section>

  <!-- ===== MAIN CONTENT ===== -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">


    {#if totalProducts === 0}
      <!-- ===== EMPTY STATE ===== -->
      <div class="flex flex-col items-center justify-center py-24 text-center">
        <div class="h-28 w-28 rounded-full bg-orange-50 flex items-center justify-center mb-5 border-4 border-orange-100">
          <span class="text-5xl">🌱</span>
        </div>
        <h2 class="text-xl font-bold text-gray-700 mb-2">Belum ada produk tersedia</h2>
        <p class="text-gray-400 text-sm max-w-sm">Produk mangga akan muncul di sini setelah pemilik kebun mempublikasikan hasil panennya.</p>
      </div>
    {:else}
      <!-- ===== PRODUCT GRID (grouped by Kebun) ===== -->
      {#if searchQuery.trim()}
        <!-- Flat search results -->
        <div class="mb-4">
          <p class="text-sm text-gray-500">
            Menampilkan <strong class="text-gray-800">{filteredProducts().length}</strong> produk untuk "<strong class="text-orange-600">{searchQuery}</strong>"
          </p>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {#each filteredProducts() as product (product.id)}
            {@render ProductCard({ product })}
          {/each}
        </div>
        {#if filteredProducts().length === 0}
          <div class="text-center py-16">
            <p class="text-gray-400 text-lg mb-1">Tidak ada hasil</p>
            <p class="text-gray-400 text-sm">Coba kata kunci lain</p>
          </div>
        {/if}
      {:else}
        <!-- Grouped by Kebun -->
        <div class="space-y-10">
          {#each storefrontData as kebun (kebun.id)}
            <section>
              <!-- Kebun Header -->
              <div class="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                <div class="h-9 w-9 rounded-xl bg-green-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <svg class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 001 1v4a1 1 0 001 1m-6 0h6"/></svg>
                </div>
                <div>
                  <h2 class="text-base font-extrabold text-gray-900">{kebun.name}</h2>
                  {#if kebun.location}<p class="text-xs text-gray-400">📍 {kebun.location}</p>{/if}
                </div>
                <span class="ml-auto text-xs font-medium text-gray-400">
                  {kebun.devices.reduce((s,d)=>s+d.products.length,0)} produk
                </span>
              </div>

              <!-- Per device section -->
              {#each kebun.devices.filter(d => d.products.length > 0 || getSensorAvg(d).hasData) as device (device.id)}
                {@const sensor = getSensorAvg(device)}
                <div class="mb-6">
                  <!-- Device sensor strip -->
                  <div class="flex items-center gap-2 mb-3 flex-wrap">
                    <div class="flex items-center gap-1.5">
                      <span class="h-2 w-2 rounded-full {recentlyUpdatedDeviceIds.has(device.id) ? 'bg-green-500 animate-ping' : 'bg-green-400'} flex-shrink-0"></span>
                      <span class="text-xs font-semibold text-gray-600">{device.name}</span>
                    </div>
                    {#if sensor.hasData}
                      {@const ml = moistureLabel(sensor.moisture)}
                      {@const pl = phLabel(sensor.ph)}
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium {ml.cls}">
                        💧 {sensor.moisture.toFixed(0)}% · {ml.label}
                      </span>
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium {pl.cls}">
                        ⚗️ pH {sensor.ph.toFixed(1)} · {pl.label}
                      </span>
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                        🧪 TDS {sensor.tds.toFixed(0)} ppm
                      </span>
                    {:else}
                      <span class="text-xs text-gray-400 italic">Belum ada data sensor</span>
                    {/if}
                  </div>

                  <!-- Product grid for this device -->
                  <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {#each device.products as product (product.id)}
                      {@const enriched = { ...product, kebunName: kebun.name, kebunId: kebun.id, kebunLocation: kebun.location, deviceName: device.name, deviceId: device.id, sensorAvg: sensor }}
                      {@render ProductCard({ product: enriched })}
                    {/each}
                  </div>
                </div>
              {/each}
            </section>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  <!-- ===== FOOTER ===== -->
  <footer class="mt-16 bg-gray-900 text-gray-400">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <span class="text-2xl">🥭</span>
          <span class="font-extrabold text-white text-lg">MangoFresh</span>
        </div>
        <p class="text-xs text-gray-500">Platform e-commerce mangga berbasis IoT. Kualitas tanah terverifikasi sensor realtime.</p>
      </div>
      <div class="mt-6 pt-4 border-t border-gray-800 text-center text-xs text-gray-600">
        © 2026 MangoFresh · IoT Mangga Monitoring System
      </div>
    </div>
  </footer>
</div>

<!-- ===== PRODUCT CARD ===== -->
{#snippet ProductCard(props: { product: any })}
  {@const p = props.product}
  <article class="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-orange-200 hover:shadow-md transition-all duration-200 flex flex-col">

    <!-- Gambar produk -->
    <div class="overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50" style="aspect-ratio:4/3">
      {#if p.imageUrl}
        <img
          src={p.imageUrl}
          alt={p.name}
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      {:else}
        <div class="w-full h-full flex items-center justify-center">
          <span class="text-5xl group-hover:scale-110 transition-transform duration-200">🥭</span>
        </div>
      {/if}
    </div>

    <!-- Info produk -->
    <div class="p-3 flex flex-col flex-1 gap-1">
      <h3 class="font-bold text-gray-900 text-sm leading-snug line-clamp-2">{p.name}</h3>

      {#if p.description}
        <p class="text-xs text-gray-400 line-clamp-2 leading-relaxed">{p.description}</p>
      {/if}

      <div class="mt-auto pt-2 border-t border-gray-50">
        <p class="text-base font-extrabold text-orange-500 leading-none">
          {formatPrice(p.price)}<span class="text-xs font-normal text-gray-400">/{p.unit}</span>
        </p>
        <div class="mt-1.5 flex items-center justify-between text-xs">
          <span class="font-medium {p.stock <= 10 ? 'text-red-500' : 'text-gray-500'}">
            Stok: {p.stock} {p.unit}
          </span>
          {#if p.harvestDate}
            <span class="text-gray-400">
              🌾 {new Date(p.harvestDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          {/if}
        </div>
      </div>
    </div>
  </article>
{/snippet}
