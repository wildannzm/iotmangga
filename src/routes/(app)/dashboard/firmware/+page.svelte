<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let isUploading = $state(false);
  
  // Format Date Helper
  const formatDate = (dateString: Date) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
</script>

<svelte:head>
  <title>Manajemen Firmware OTA - IoT Mangga</title>
</svelte:head>

<div class="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-gray-900">Pembaruan Firmware (OTA)</h1>
    <p class="text-sm text-gray-500 mt-2">Unggah file binary (.bin) untuk memperbarui program pada perangkat ESP32 secara nirkabel.</p>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <!-- Upload Form -->
    <div class="lg:col-span-1">
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-6">
        <h3 class="text-lg font-bold text-gray-800 mb-4">Unggah Firmware Baru</h3>
        
        <form 
          method="POST" 
          action="?/upload" 
          enctype="multipart/form-data"
          use:enhance={() => {
            isUploading = true;
            return async ({ update }) => {
              isUploading = false;
              update({ reset: true });
            };
          }}
          class="space-y-4"
        >
          <div>
            <label for="version" class="block text-sm font-medium text-gray-700">Versi Firmware</label>
            <input 
              type="text" 
              name="version" 
              id="version" 
              placeholder="Contoh: 1.0.2"
              required
              class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
            >
          </div>

          <div>
            <label for="releaseNotes" class="block text-sm font-medium text-gray-700">Catatan Rilis (Opsional)</label>
            <textarea 
              name="releaseNotes" 
              id="releaseNotes" 
              rows="3" 
              placeholder="Fitur baru atau perbaikan bug..."
              class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
            ></textarea>
          </div>

          <div>
            <label for="firmwareFile" class="block text-sm font-medium text-gray-700">Pilih File (.bin)</label>
            <input 
              type="file" 
              name="firmwareFile" 
              id="firmwareFile" 
              accept=".bin"
              required
              class="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
            >
          </div>

          {#if form?.error}
            <div class="p-3 rounded-md bg-red-50 text-red-700 text-sm">
              {form.error}
            </div>
          {/if}

          {#if form?.success}
            <div class="p-3 rounded-md bg-green-50 text-green-700 text-sm">
              Berhasil mengunggah firmware baru!
            </div>
          {/if}

          <button 
            type="submit" 
            disabled={isUploading}
            class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if isUploading}
              Mengunggah...
            {:else}
              Unggah File
            {/if}
          </button>
        </form>
      </div>
    </div>

    <!-- History Table -->
    <div class="lg:col-span-2">
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
        <div class="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 class="text-lg font-bold text-gray-800">Riwayat Firmware</h3>
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            {data.firmwares.length} Versi
          </span>
        </div>
        
        {#if data.firmwares.length === 0}
          <div class="p-12 text-center text-gray-500">
            Belum ada data firmware.
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-stone-50">
                <tr>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Versi</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tanggal Rilis</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Catatan</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-100">
                {#each data.firmwares as fw, index}
                  <tr class="hover:bg-stone-50 transition-colors">
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <span class="text-sm font-bold text-gray-900 font-mono">v{fw.version}</span>
                        {#if index === 0}
                          <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Terbaru
                          </span>
                        {/if}
                      </div>
                      <p class="text-xs text-gray-400 mt-1 truncate max-w-[120px]" title={fw.fileUrl}>{fw.fileUrl}</p>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(fw.createdAt)}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate" title={fw.releaseNotes || '-'}>
                      {fw.releaseNotes || '-'}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
