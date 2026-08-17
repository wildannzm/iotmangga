<script lang="ts">
  import { page } from '$app/stores';

  let { children } = $props();

  let isMobileMenuOpen = $state(false);

  // Helper to determine if a route is active
  const isActive = (path: string, currentPath: string) => {
    if (path === '/dashboard') {
      return currentPath === '/dashboard';
    }
    return currentPath.startsWith(path);
  };
</script>

<div class="min-h-screen bg-stone-50">
  <nav class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex">
          <div class="flex-shrink-0 flex items-center">
            <svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="h-8 w-8 iconify iconify--noto" preserveAspectRatio="xMidYMid meet" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><radialGradient id="IconifyId17ecdb2904d178eab13511" cx="75.424" cy="-61.613" r="183.963" gradientUnits="userSpaceOnUse"><stop offset=".532" stop-color="#f33a1f"></stop><stop offset=".615" stop-color="#f86922"></stop><stop offset=".696" stop-color="#fd9124"></stop><stop offset=".739" stop-color="#ffa025"></stop><stop offset=".793" stop-color="#fca025"></stop><stop offset=".839" stop-color="#f1a124"></stop><stop offset=".883" stop-color="#dfa222"></stop><stop offset=".925" stop-color="#c7a41f"></stop><stop offset=".962" stop-color="#aaa61c"></stop></radialGradient><path d="M4.03 89.43c-1.2 6.01 5.66 29.12 41.45 33.74c18.39 2.37 36.45-4.16 50.75-15.11S119.3 83 122.31 70.11c4.63-19.85-.69-49.82-40.06-51.59c-40.26-1.81-53.79 40.28-62.23 52.65C9.86 86.08 5.12 84 4.03 89.43z" fill="url(#IconifyId17ecdb2904d178eab13511)"></path><path d="M41.89 36.33s13.57 6.9 34.61 5.44c17.03-1.18 23.73-9.54 23.73-9.54s7.49 2.06 12.46.74c1.99-.53 2.42-1.61-.01-4.13c-3.67-3.82-16.27-10.89-34.85-9.7c-23.25 1.51-35.94 17.19-35.94 17.19z" fill="#dc0d27"></path><path d="M26.04 76.62c2.36 3.93 9.35-1.14 14.27-6.07c7.1-7.12 10.33-13.64 12.22-16.95c1.89-3.31 4.45-10.44-.71-11.59c-5.37-1.19-6.96 5.45-9.72 10.34s-6.6 10.71-9.68 14.5c-3.27 4.03-7.78 7.44-6.38 9.77z" fill="#ffebc9"></path><path d="M102.36 24.98c-.68 2.97 2.05 5.05 3.94 6.54s6.15 2.05 7.57 1.02c1.42-1.02-.16-4.02.87-5.83c1.02-1.81 2.84-4.02.63-5.52c-1.85-1.26-4.34-1.73-6.62-1.26s-2.29 2.21-3.23 2.68c-.96.48-2.93 1.35-3.16 2.37z" fill="#6d4c41"></path><path d="M100.14 25.88c-2.52 1.1-9.94 6.95-27.26 8.28c-19.1 1.47-41.53-.8-45.27-1.33c-3.74-.53-10.12-.78-10.03-2.38c.13-2.4 2.61-1.63 7.61-3.07c6.01-1.74 12.15-4.14 16.83-6.94c7.18-4.31 21.8-15.09 36.19-15.36c15.76-.29 20.83 4.67 24.7 8.81s3.93 8.48 2.86 10.22c-1.06 1.74-2.56.44-5.63 1.77z" fill="#518e30"></path><path d="M50.46 24.92c.37.46 7.35.72 11.24.59c8.88-.29 15.91-2.65 24.66-3.63s16.38 0 16.67-.34c.53-.62-4.84-7.92-22.41-5.95c-6.47.73-14.79 4.02-20.53 6.31c-3.66 1.49-9.98 2.58-9.63 3.02z" fill="#366918"></path></g></svg>
            <span class="ml-2 text-xl font-bold text-gray-900">IoT Mangga</span>
          </div>
          <div class="hidden sm:-my-px sm:ml-8 sm:flex sm:space-x-8">
            <a
              href="/dashboard"
              class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors
                {isActive('/dashboard', $page.url.pathname)
                  ? 'border-amber-500 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            >
              Dashboard
            </a>
            <a
              href="/dashboard/devices"
              class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors
                {isActive('/dashboard/devices', $page.url.pathname)
                  ? 'border-amber-500 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            >
              Manajemen Perangkat
            </a>
            <a
              href="/dashboard/kebun"
              class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors
                {isActive('/dashboard/kebun', $page.url.pathname)
                  ? 'border-amber-500 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            >
              Manajemen Kebun
            </a>
            <a
              href="/dashboard/firmware"
              class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors
                {isActive('/dashboard/firmware', $page.url.pathname)
                  ? 'border-amber-500 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            >
              Pembaruan Perangkat
            </a>
          </div>
        </div>
        
        <!-- Mobile menu button -->
        <div class="-mr-2 flex items-center sm:hidden">
          <button
            type="button"
            onclick={() => isMobileMenuOpen = !isMobileMenuOpen}
            class="bg-white inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            aria-expanded={isMobileMenuOpen}
          >
            <span class="sr-only">Buka menu utama</span>
            {#if isMobileMenuOpen}
              <svg class="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            {:else}
              <svg class="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            {/if}
          </button>
        </div>

        <div class="hidden sm:ml-6 sm:flex sm:items-center">
          <form method="POST" action="/login?/logout">
            <button
              type="submit"
              class="bg-white p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors"
              title="Keluar (Logout)"
            >
              <span class="sr-only">Keluar</span>
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>

    <!-- Mobile Menu -->
    {#if isMobileMenuOpen}
      <div class="sm:hidden border-t border-gray-200" id="mobile-menu">
        <div class="pt-2 pb-3 space-y-1">
          <a
            href="/dashboard"
            onclick={() => isMobileMenuOpen = false}
            class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium transition-colors
              {isActive('/dashboard', $page.url.pathname) ? 'bg-amber-50 border-amber-500 text-amber-700' : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'}"
          >
            Dashboard
          </a>
          <a
            href="/dashboard/devices"
            onclick={() => isMobileMenuOpen = false}
            class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium transition-colors
              {isActive('/dashboard/devices', $page.url.pathname) ? 'bg-amber-50 border-amber-500 text-amber-700' : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'}"
          >
            Manajemen Perangkat
          </a>
          <a
            href="/dashboard/kebun"
            onclick={() => isMobileMenuOpen = false}
            class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium transition-colors
              {isActive('/dashboard/kebun', $page.url.pathname) ? 'bg-amber-50 border-amber-500 text-amber-700' : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'}"
          >
            Manajemen Kebun
          </a>
          <a
            href="/dashboard/firmware"
            onclick={() => isMobileMenuOpen = false}
            class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium transition-colors
              {isActive('/dashboard/firmware', $page.url.pathname) ? 'bg-amber-50 border-amber-500 text-amber-700' : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'}"
          >
            Pembaruan Perangkat
          </a>
        </div>
        <div class="pt-4 pb-3 border-t border-gray-200">
          <form method="POST" action="/login?/logout" class="mt-3 px-2 space-y-1">
            <button
              type="submit"
              class="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors"
            >
              Keluar (Logout)
            </button>
          </form>
        </div>
      </div>
    {/if}
  </nav>

  <main>
    {@render children()}
  </main>
</div>
