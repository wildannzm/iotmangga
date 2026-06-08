<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
  <title>Masuk - Sistem Monitoring IoT Pohon Mangga</title>
</svelte:head>

<div class="min-h-screen bg-stone-50 flex items-center justify-center p-4">
  <div class="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-amber-100">
    <div class="p-8">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-800 mb-2">
          Selamat Datang
        </h1>
        <p class="text-sm text-gray-500">
          Sistem Monitoring IoT Pohon Mangga
        </p>
      </div>

      {#if form?.error}
        <div class="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-sm font-medium flex items-center border border-red-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {form.error}
        </div>
      {/if}

      <form method="POST" action="?/login" use:enhance class="space-y-5">
        <div>
          <label for="username" class="block text-sm font-medium text-gray-700 mb-1">Nama Pengguna</label>
          <input
            type="text"
            id="username"
            name="username"
            placeholder="Masukkan nama pengguna"
            required
            class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-colors"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Kata Sandi</label>
          <input
            type="password"
            id="password"
            name="password"
            placeholder="Masukkan kata sandi"
            required
            class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-colors"
          />
        </div>

        <button
          type="submit"
          class="w-full bg-amber-400 hover:bg-amber-500 text-amber-900 font-bold py-3 px-4 rounded-lg transition-colors shadow-sm mt-4 focus:ring-4 focus:ring-amber-200 outline-none"
        >
          Masuk
        </button>
      </form>
    </div>
  </div>
</div>
