# IoT Mangga — Sistem Monitoring & Etalase Mangga

Aplikasi web berbasis **SvelteKit + Bun + Prisma + Supabase** untuk monitoring sensor IoT pohon mangga (kelembapan tanah, pH, dan TDS) via ESP32/ESP8266, lengkap dengan etalase publik hasil panen.

---

## Fitur Utama

### 🌿 Monitoring IoT Realtime
- Dashboard sensor realtime via Supabase WebSocket (tanpa polling)
- Grafik historis kelembapan, pH, dan TDS per perangkat
- Manajemen perangkat IoT dengan API Key one-time-view
- OTA (Over-The-Air) firmware update untuk ESP32/ESP8266

### 🏡 Manajemen Kebun
- Buat dan kelola Kebun (lokasi) di `/dashboard/kebun`
- Hubungkan perangkat IoT ke kebun masing-masing
- Tampilan agregasi produk per kebun

### 🥭 Etalase Publik (Root `/`)
- Halaman publik tanpa login yang menampilkan produk mangga per kebun
- Rata-rata sensor (kelembapan, pH, TDS) diperbarui **realtime** via Supabase Realtime
- Indikator kualitas tanah berwarna hijau/kuning/merah
- Empty state jika belum ada produk terpublish

### 📦 Manajemen Produk
- Tambah/edit/hapus produk per perangkat di `/dashboard/devices/[id]`
- Field: nama, deskripsi, harga, stok, satuan, tanggal panen, foto (URL), toggle publish
- Validasi: harga & stok >= 0, URL foto harus valid, nama max 200 karakter

---

## Stack Teknologi

| Layer | Teknologi |
|-------|-----------|
| Framework | SvelteKit (App Router) |
| Runtime | Bun |
| Database | Supabase PostgreSQL |
| ORM | Prisma (with `@prisma/adapter-pg`) |
| Realtime | Supabase Realtime (WebSocket) |
| Styling | TailwindCSS v4 |
| Hardware | ESP32/ESP8266 (C++ Firmware) |

---

## Setup & Pengembangan

### 1. Prasyarat
```sh
# Install dependencies
bun install
```

### 2. Konfigurasi Environment
Salin `.env.example` ke `.env` dan isi variabel berikut:
```env
PUBLIC_SUPABASE_URL=https://xxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
DATABASE_URL=postgresql://...?pgbouncer=true
DIRECT_URL=postgresql://...   # Untuk migrasi Prisma
CRON_SECRET=your_secret_here
```

### 3. Migrasi Database

#### Inisialisasi pertama kali:
```sh
bunx prisma migrate dev --name init
bunx prisma generate
```

#### Migrasi Kebun & Produk (fitur etalase):
Jika schema tidak sinkron dengan migration history (drift), gunakan:
```sh
# Lihat SQL yang perlu dijalankan:
bunx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script

# Buat file migration manual di prisma/migrations/<timestamp>_<name>/migration.sql
# lalu tandai sebagai applied:
bunx prisma migrate resolve --applied <migration_name>

# Atau untuk development: push langsung tanpa history tracking:
bunx prisma db push
```

#### Generate Prisma Client:
```sh
bunx prisma generate
```

### 4. Jalankan Dev Server
```sh
bun run dev
```

---

## Konfigurasi Supabase Realtime

Fitur live update di etalase publik dan dashboard membutuhkan Realtime enabled pada tabel `SensorData`:

1. Buka Supabase Dashboard → **Database** → **Replication**
2. Enable replication untuk tabel `public.SensorData`
3. Pastikan **INSERT** events diaktifkan

---

## Endpoint API (untuk ESP32/ESP8266)

### Kirim Data Sensor
```
POST /api/sensor-data
Header: x-api-key: iot_mangga_<api_key>
Body: { "moisture": 65.2, "ph": 6.8, "tds": 320 }
```

### OTA Firmware Check
```
GET /api/ota
Header: x-api-key: <api_key>
        x-firmware-version: 1.0.0
        x-mac-address: AA:BB:CC:DD:EE:FF
```

---

## Build Production

```sh
bun run build
bun run preview
```

---

## Reproduksi Project

```sh
bun x sv@0.15.4 create --template minimal --no-types --add prettier tailwindcss="plugins:typography,forms" --install bun iotmangga
```
