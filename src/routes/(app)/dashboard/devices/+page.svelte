<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let isCreateModalOpen = $state(false);
  
  // For Edit
  let isEditModalOpen = $state(false);
  let editDevice = $state<{ id: string, name: string, macAddress: string } | null>(null);

  // For Delete
  let isDeleteModalOpen = $state(false);
  let deleteDeviceId = $state<string | null>(null);

  // For API Key
  let isApiKeyModalOpen = $state(false);

  function openCreateModal() { isCreateModalOpen = true; }
  function closeCreateModal() { isCreateModalOpen = false; }

  function openEditModal(device: any) {
    editDevice = { id: device.id, name: device.name, macAddress: device.macAddress };
    isEditModalOpen = true;
  }
  function closeEditModal() {
    isEditModalOpen = false;
    editDevice = null;
  }

  function openDeleteModal(id: string) {
    deleteDeviceId = id;
    isDeleteModalOpen = true;
  }
  function closeDeleteModal() {
    isDeleteModalOpen = false;
    deleteDeviceId = null;
  }

  function closeApiKeyModal() {
    isApiKeyModalOpen = false;
  }

  let copySuccess = $state(false);

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      copySuccess = true;
      setTimeout(() => {
        copySuccess = false;
      }, 3000);
    } catch (err) {
      // Do nothing
      alert('Gagal menyalin API Key.');
    }
  }
</script>

<svelte:head>
  <title>Manajemen Perangkat - IoT Mangga</title>
</svelte:head>

<div class="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
  <div class="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4 mb-8">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Manajemen Perangkat</h1>
    </div>
    <button
      onclick={openCreateModal}
      class="bg-amber-400 hover:bg-amber-500 text-amber-900 font-bold py-2 px-4 rounded-lg shadow transition-colors w-full sm:w-auto text-center"
    >
      + Tambah Perangkat
    </button>
  </div>

  {#if form?.error && !isCreateModalOpen && !isEditModalOpen && !isDeleteModalOpen}
    <div class="bg-red-50 text-red-600 p-4 rounded-lg mb-6 border border-red-200">
      {form.error}
    </div>
  {/if}

  {#if data.devices.length === 0}
    <div class="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
      <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
      </svg>
      <h3 class="text-lg font-medium text-gray-900">Belum ada perangkat</h3>
      <p class="mt-1 text-sm text-gray-500">Anda belum mendaftarkan pohon mangga satupun.</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each data.devices as device}
        <div class="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
          <div class="p-6 flex-1">
            <div class="flex items-start justify-between mb-4">
              <h3 class="text-xl font-bold text-gray-900 pr-2">{device.name}</h3>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 shrink-0">
                Aktif
              </span>
            </div>
            <div class="space-y-2 text-sm text-gray-600">
              <p><span class="font-medium">MAC:</span> <span class="font-mono text-xs">{device.macAddress}</span></p>
              <p><span class="font-medium">Firmware:</span> {device.firmwareVer}</p>
              <p><span class="font-medium">Didaftarkan:</span> {new Date(device.createdAt).toLocaleDateString('id-ID')}</p>
            </div>
          </div>
          <div class="bg-stone-50 px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
            <a href="/dashboard/devices/{device.id}" class="text-green-600 hover:text-green-700 text-sm font-medium transition-colors w-full sm:w-auto text-center">
              Lihat Data &rarr;
            </a>
            <div class="flex space-x-3 w-full sm:w-auto justify-center">
              <button onclick={() => openEditModal(device)} class="text-gray-500 hover:text-amber-600 transition-colors" title="Edit Perangkat">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
              </button>
              <button onclick={() => openDeleteModal(device.id)} class="text-gray-500 hover:text-red-600 transition-colors" title="Hapus Perangkat">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Modal Tambah Perangkat -->
{#if isCreateModalOpen}
  <div class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
      <div class="p-6">
        <div class="flex justify-between items-center mb-5">
          <h2 class="text-xl font-bold text-gray-900">Tambah Pohon Baru</h2>
          <button onclick={closeCreateModal} class="text-gray-400 hover:text-gray-600">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {#if form?.error && isCreateModalOpen}
          <div class="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm border border-red-200">
            {form.error}
          </div>
        {/if}

        <form method="POST" action="?/create" use:enhance={() => {
          return async ({ result, update }) => {
            if (result.type === 'success') {
              closeCreateModal();
            }
            await update();
            if (result.type === 'success') {
              isApiKeyModalOpen = true;
            }
          };
        }} class="space-y-4">
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Nama Pohon / Lokasi</label>
            <input type="text" id="name" name="name" required placeholder="Contoh: Pohon Mangga Harum Manis 1" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none" />
          </div>

          <div>
            <label for="macAddress" class="block text-sm font-medium text-gray-700 mb-1">MAC Address ESP32</label>
            <input type="text" id="macAddress" name="macAddress" required placeholder="Contoh: 24:0A:C4:00:01:02" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none font-mono text-sm" />
          </div>

          <div class="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button type="button" onclick={closeCreateModal} class="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Batal</button>
            <button type="submit" class="w-full sm:w-auto px-4 py-2 bg-amber-400 text-amber-900 font-bold rounded-lg hover:bg-amber-500 transition-colors">Simpan Perangkat</button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<!-- Modal Edit Perangkat -->
{#if isEditModalOpen && editDevice}
  <div class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
      <div class="p-6">
        <div class="flex justify-between items-center mb-5">
          <h2 class="text-xl font-bold text-gray-900">Edit Pohon</h2>
          <button onclick={closeEditModal} class="text-gray-400 hover:text-gray-600">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {#if form?.error && isEditModalOpen}
          <div class="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm border border-red-200">
            {form.error}
          </div>
        {/if}

        <form method="POST" action="?/update" use:enhance={() => {
          return async ({ result, update }) => {
            if (result.type === 'success') {
              closeEditModal();
            }
            update();
          };
        }} class="space-y-4">
          <input type="hidden" name="id" value={editDevice.id} />
          
          <div>
            <label for="editName" class="block text-sm font-medium text-gray-700 mb-1">Nama Pohon / Lokasi</label>
            <input type="text" id="editName" name="name" bind:value={editDevice.name} required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none" />
          </div>

          <div>
            <label for="editMac" class="block text-sm font-medium text-gray-700 mb-1">MAC Address ESP32</label>
            <input type="text" id="editMac" name="macAddress" bind:value={editDevice.macAddress} required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none font-mono text-sm" />
          </div>

          <div class="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button type="button" onclick={closeEditModal} class="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Batal</button>
            <button type="submit" class="w-full sm:w-auto px-4 py-2 bg-amber-400 text-amber-900 font-bold rounded-lg hover:bg-amber-500 transition-colors">Simpan Perubahan</button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<!-- Modal Hapus Perangkat -->
{#if isDeleteModalOpen && deleteDeviceId}
  <div class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
      <div class="p-6 text-center">
        <svg class="mx-auto mb-4 text-red-500 w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        <h3 class="mb-5 text-lg font-normal text-gray-500">Apakah Anda yakin ingin menghapus perangkat ini? Seluruh riwayat data sensor akan ikut terhapus secara permanen.</h3>
        
        <form method="POST" action="?/delete" use:enhance={() => {
          return async ({ result, update }) => {
            if (result.type === 'success') {
              closeDeleteModal();
            }
            update();
          };
        }}>
          <input type="hidden" name="id" value={deleteDeviceId} />
          <div class="flex flex-col sm:flex-row justify-center gap-3">
            <button type="button" onclick={closeDeleteModal} class="w-full sm:w-auto px-4 py-2 text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-gray-200 transition-colors">Batal</button>
            <button type="submit" class="w-full sm:w-auto px-4 py-2 text-white bg-red-600 hover:bg-red-800 rounded-lg focus:ring-4 focus:outline-none focus:ring-red-300 font-bold transition-colors">Ya, Hapus</button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<!-- Modal Tampilkan API Key -->
{#if isApiKeyModalOpen && form?.apiKey}
  <div class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border-t-8 border-orange-500">
      <div class="p-6">
        <div class="flex justify-between items-start mb-4">
          <div class="flex items-center">
            <svg class="h-8 w-8 text-orange-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <h2 class="text-2xl font-bold text-gray-900">API Key Berhasil Dibuat</h2>
          </div>
          <button onclick={closeApiKeyModal} class="text-gray-400 hover:text-gray-600">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div class="mb-6 text-gray-600 text-sm bg-orange-50 p-4 rounded-lg border border-orange-100">
          <p class="mb-2">Perangkat Anda berhasil didaftarkan. Gunakan API Key di bawah ini untuk mikrokontroler Anda.</p>
          <p class="font-bold text-red-600">PENTING: Kunci ini hanya akan ditampilkan SEKALI ini saja. Simpan baik-baik!</p>
        </div>

        <div class="flex flex-col sm:flex-row items-stretch mb-4">
          <div class="bg-gray-100 p-4 sm:rounded-l-lg sm:rounded-tr-none rounded-t-lg border-x border-t sm:border-b border-gray-300 font-mono text-sm w-full break-all text-gray-800 flex items-center">
            {form.apiKey}
          </div>
          <button 
            onclick={() => copyToClipboard(form.apiKey)}
            class="bg-amber-400 hover:bg-amber-500 text-amber-900 font-bold p-4 sm:rounded-r-lg sm:rounded-bl-none rounded-b-lg border border-amber-500 transition-colors flex items-center justify-center min-w-[80px]"
            title="Salin ke Clipboard"
          >
            {#if copySuccess}
              <span class="mr-2 sm:hidden text-green-800">Tersalin!</span>
              <svg class="w-5 h-5 text-green-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            {:else}
              <span class="mr-2 sm:hidden">Salin</span>
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
            {/if}
          </button>
        </div>

        {#if copySuccess}
          <div class="mb-4 text-center text-sm font-medium text-green-700 bg-green-50 py-2 rounded-lg border border-green-200 animate-pulse">
            ✨ API Key berhasil disalin ke clipboard!
          </div>
        {/if}

        <div class="flex justify-end">
          <button onclick={closeApiKeyModal} class="w-full sm:w-auto px-6 py-2 bg-gray-900 text-white font-bold rounded-lg hover:bg-gray-800 transition-colors">
            Saya Sudah Menyimpannya
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
