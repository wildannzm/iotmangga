<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let showCreateForm = $state(false);
  let editingKebunId = $state<string | null>(null);
  let showAssignForm = $state<string | null>(null); // kebunId yang sedang dibuka assign form-nya

  // Form state untuk create
  let createName = $state('');
  let createLocation = $state('');
  let createWaNumber = $state('');

  // Form state untuk edit
  let editName = $state('');
  let editLocation = $state('');
  let editWaNumber = $state('');

  function startEdit(kebun: { id: string; name: string; location: string | null; waNumber?: string | null }) {
    editingKebunId = kebun.id;
    editName = kebun.name;
    editLocation = kebun.location ?? '';
    editWaNumber = kebun.waNumber ?? '';
  }

  function cancelEdit() {
    editingKebunId = null;
  }

  // Devices yang belum punya kebun (untuk assign baru)
  let unassignedDevices = $derived(data.devices.filter((d) => !d.kebunId));
</script>

<svelte:head>
  <title>Manajemen Kebun - Mango Tree IoT</title>
</svelte:head>

<div class="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
  <!-- Header -->
  <div class="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Manajemen Kebun</h1>
      <p class="text-sm text-gray-500 mt-1">
        Kelola kebun (lokasi), nomor WhatsApp kontak, dan hubungkan perangkat IoT.
      </p>
    </div>
    <button
      onclick={() => (showCreateForm = !showCreateForm)}
      class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-bold rounded-xl text-white bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors"
    >
      <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      Tambah Kebun
    </button>
  </div>

  <!-- Form Buat Kebun Baru -->
  {#if showCreateForm}
    <div class="bg-white rounded-2xl shadow-sm border border-amber-100 p-6 mb-6">
      <h2 class="text-lg font-bold text-gray-800 mb-4">Kebun Baru</h2>
      <form
        method="POST"
        action="?/create"
        use:enhance={() => {
          return ({ result, update }) => {
            if (result.type === 'success') {
              showCreateForm = false;
              createName = '';
              createLocation = '';
              createWaNumber = '';
            }
            update();
          };
        }}
        class="space-y-4"
      >
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label for="create-name" class="block text-sm font-medium text-gray-700 mb-1"
              >Nama Kebun <span class="text-red-500">*</span></label
            >
            <input
              id="create-name"
              name="name"
              type="text"
              maxlength="100"
              required
              bind:value={createName}
              placeholder="Contoh: Kebun Sidamukti 1"
              class="block w-full border-gray-300 rounded-xl shadow-sm focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
            />
          </div>
          <div>
            <label for="create-location" class="block text-sm font-medium text-gray-700 mb-1"
              >Lokasi Kebun</label
            >
            <input
              id="create-location"
              name="location"
              type="text"
              bind:value={createLocation}
              placeholder="Contoh: Sidamukti"
              class="block w-full border-gray-300 rounded-xl shadow-sm focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
            />
          </div>
          <div>
            <label for="create-wa" class="block text-sm font-medium text-gray-700 mb-1"
              >Nomor WhatsApp</label
            >
            <input
              id="create-wa"
              name="waNumber"
              type="text"
              bind:value={createWaNumber}
              placeholder="Contoh: 6281234567890"
              class="block w-full border-gray-300 rounded-xl shadow-sm focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
            />
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button
            type="submit"
            class="px-5 py-2 text-sm font-bold rounded-xl text-white bg-green-600 hover:bg-green-700 transition-colors"
          >
            Simpan Kebun
          </button>
          <button
            type="button"
            onclick={() => (showCreateForm = false)}
            class="px-5 py-2 text-sm font-medium rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Batal
          </button>
        </div>
      </form>
    </div>
  {/if}

  <!-- Daftar Kebun -->
  {#if data.kebuns.length === 0}
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
      <svg
        class="mx-auto h-14 w-14 text-gray-300 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
      <p class="text-gray-500 text-lg font-medium">Belum ada kebun yang terdaftar.</p>
      <p class="text-gray-400 text-sm mt-1">
        Klik tombol "Tambah Kebun" di atas untuk mulai mengelola kebun Anda.
      </p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each data.kebuns as kebun (kebun.id)}
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <!-- Header Kebun -->
          <div class="p-6">
            {#if editingKebunId === kebun.id}
              <!-- Form Edit Kebun -->
              <form
                method="POST"
                action="?/update"
                use:enhance={() => {
                  return ({ result, update }) => {
                    if (result.type === 'success') cancelEdit();
                    update();
                  };
                }}
                class="space-y-4"
              >
                <input type="hidden" name="id" value={kebun.id} />
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label for="edit-name-{kebun.id}" class="block text-sm font-medium text-gray-700 mb-1"
                      >Nama Kebun <span class="text-red-500">*</span></label
                    >
                    <input
                      id="edit-name-{kebun.id}"
                      name="name"
                      type="text"
                      maxlength="100"
                      required
                      bind:value={editName}
                      class="block w-full border-gray-300 rounded-xl shadow-sm focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label for="edit-loc-{kebun.id}" class="block text-sm font-medium text-gray-700 mb-1"
                      >Lokasi</label
                    >
                    <input
                      id="edit-loc-{kebun.id}"
                      name="location"
                      type="text"
                      bind:value={editLocation}
                      class="block w-full border-gray-300 rounded-xl shadow-sm focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label for="edit-wa-{kebun.id}" class="block text-sm font-medium text-gray-700 mb-1"
                      >Nomor WhatsApp</label
                    >
                    <input
                      id="edit-wa-{kebun.id}"
                      name="waNumber"
                      type="text"
                      bind:value={editWaNumber}
                      placeholder="6281234567890"
                      class="block w-full border-gray-300 rounded-xl shadow-sm focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <button
                    type="submit"
                    class="px-4 py-2 text-sm font-bold rounded-xl text-white bg-amber-500 hover:bg-amber-600 transition-colors"
                  >
                    Simpan Perubahan
                  </button>
                  <button
                    type="button"
                    onclick={cancelEdit}
                    class="px-4 py-2 text-sm font-medium rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    Batal
                  </button>
                </div>
              </form>
            {:else}
              <!-- Info Kebun -->
              <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <svg
                      class="h-5 w-5 text-green-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                      />
                    </svg>
                    <h2 class="text-xl font-bold text-gray-900">{kebun.name}</h2>
                  </div>
                  <div class="ml-7 space-y-0.5">
                    {#if kebun.location}
                      <p class="text-sm text-gray-500">📍 Lokasi: <strong class="text-gray-700 font-semibold">{kebun.location}</strong></p>
                    {/if}
                    <p class="text-sm text-gray-500">
                      📱 WhatsApp: <strong class="text-emerald-600 font-semibold">{kebun.waNumber || 'Belum diisi'}</strong>
                    </p>
                  </div>
                  <p class="text-xs text-gray-400 ml-7 mt-2">
                    {kebun.devices.length} perangkat terhubung
                  </p>
                </div>
                <div class="flex items-center gap-2 ml-7 sm:ml-0">
                  <button
                    onclick={() => startEdit(kebun)}
                    class="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                  >
                    Edit
                  </button>
                  <form method="POST" action="?/delete" use:enhance>
                    <input type="hidden" name="id" value={kebun.id} />
                    <button
                      type="submit"
                      onclick={(e) => {
                        if (!confirm(`Hapus kebun "${kebun.name}"? Perangkat tidak akan terhapus.`))
                          e.preventDefault();
                      }}
                      class="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                    >
                      Hapus
                    </button>
                  </form>
                </div>
              </div>
            {/if}
          </div>

          <!-- Daftar Perangkat di Kebun -->
          {#if kebun.devices.length > 0}
            <div class="border-t border-gray-100 px-6 py-4 bg-stone-50">
              <p class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                Perangkat Terhubung
              </p>
              <div class="flex flex-wrap gap-2">
                {#each kebun.devices as device (device.id)}
                  <div
                    class="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 bg-white rounded-lg border border-gray-200 text-sm text-gray-700"
                  >
                    <span class="h-2 w-2 rounded-full bg-green-500 flex-shrink-0"></span>
                    <span class="font-medium">{device.name}</span>
                    <!-- Unassign -->
                    <form method="POST" action="?/assignDevice" use:enhance>
                      <input type="hidden" name="deviceId" value={device.id} />
                      <input type="hidden" name="kebunId" value="" />
                      <button
                        type="submit"
                        title="Lepaskan dari kebun ini"
                        class="text-gray-300 hover:text-red-500 transition-colors ml-1"
                      >
                        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </form>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Assign Perangkat -->
          <div class="border-t border-gray-100 px-6 py-3">
            {#if showAssignForm === kebun.id}
              <form
                method="POST"
                action="?/assignDevice"
                use:enhance={() => {
                  return ({ result, update }) => {
                    if (result.type === 'success') showAssignForm = null;
                    update();
                  };
                }}
                class="flex flex-col sm:flex-row items-start sm:items-center gap-3"
              >
                <input type="hidden" name="kebunId" value={kebun.id} />
                <select
                  name="deviceId"
                  required
                  class="block w-full sm:w-auto flex-1 border-gray-300 rounded-xl shadow-sm focus:ring-amber-500 focus:border-amber-500 text-sm"
                >
                  <option value="">-- Pilih Perangkat --</option>
                  {#each unassignedDevices as d (d.id)}
                    <option value={d.id}>{d.name}</option>
                  {/each}
                </select>
                <div class="flex items-center gap-2">
                  <button
                    type="submit"
                    class="px-4 py-2 text-sm font-bold rounded-xl text-white bg-green-600 hover:bg-green-700 transition-colors"
                  >
                    Hubungkan
                  </button>
                  <button
                    type="button"
                    onclick={() => (showAssignForm = null)}
                    class="px-4 py-2 text-sm font-medium rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    Batal
                  </button>
                </div>
              </form>
            {:else}
              <button
                onclick={() => (showAssignForm = kebun.id)}
                disabled={unassignedDevices.length === 0}
                class="inline-flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-800 font-medium disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                {unassignedDevices.length === 0 ? 'Semua perangkat sudah terhubung ke kebun' : 'Hubungkan Perangkat'}
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
