# FangUs — dari nol

FangUs adalah prototipe game deduksi sosial original berbasis web: UI responsif, room berkode 5 karakter, lobby kru, dan posisi karakter yang disiarkan real-time melalui Supabase Realtime. Frontend bisa di-host gratis di Vercel.

## Yang sudah ada
- Landing page dan lobby responsif untuk HP/laptop.
- Buat room dan gabung room menggunakan kode.
- Daftar pemain dan indikator host.
- Maksimal tampilan 6 pemain; karakter bisa digerakkan dengan WASD/tombol panah atau tap/click di area game.
- Broadcast posisi dan status mulai permainan.
- Hosting frontend di Vercel.

## Batasan prototipe (penting)
Ini belum menjadi game siap produksi: Supabase Realtime channel bukan sistem matchmaking/otorisasi yang kuat. Kode room bersifat channel name, dan aturan batas 6 pemain/minimal 3 pemain belum ditegakkan dengan aman oleh server. Role penyusup, eliminasi, voting, chat, misi, serta validasi anti-cheat belum diimplementasikan. Jangan gunakan untuk room privat yang membutuhkan keamanan sungguhan. Langkah berikutnya adalah menambahkan Edge Function/server-authoritative state dan aturan akses yang sesuai.

## Langkah 1 — buat project Supabase gratis
1. Buka https://supabase.com dan buat project baru.
2. Di project, buka **Project Settings → API** (atau bagian API Keys).
3. Salin **Project URL** dan **anon/public/publishable key**. Jangan pernah pakai `service_role`/secret key di website.

## Langkah 2 — set konfigurasi
Buat file `.env.local` di folder proyek (sejajar dengan package.json), lalu isi:

```env
VITE_SUPABASE_URL=https://PROJECT-ANDA.supabase.co
VITE_SUPABASE_ANON_KEY=ISI_PUBLIC_ANON_KEY
```

Tidak perlu tabel database untuk prototipe presence/broadcast ini. Pastikan Realtime tersedia pada project Supabase. Jangan menaruh rahasia/service-role key di frontend.

## Langkah 3 — jalankan lokal
Butuh Node.js 20+.
```bash
npm install
npm run dev
```
Buka alamat lokal yang ditampilkan Vite.

## Langkah 4 — deploy gratis ke Vercel
1. Upload folder proyek ke repository GitHub.
2. Buka https://vercel.com → **Add New → Project** lalu import repository.
3. Framework Preset: **Vite**; Build Command: `npm run build`; Output Directory: `dist`.
4. Di **Environment Variables**, tambahkan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` dengan nilai dari Supabase.
5. Klik Deploy. Jika mengubah environment variables, lakukan redeploy.
6. Bagikan URL Vercel ke teman. Untuk bergabung, semua pemain memasukkan kode room yang sama.

## Kontrol
- Gerak: WASD atau tombol panah.
- HP: tap area peta untuk mengarahkan karakter.
- Buat room: host.
- Mulai: host; UI meminta minimal 3 pemain, tetapi validasi ini masih client-side dalam prototipe.

## Keamanan
Anon/publishable key memang digunakan pada frontend, tetapi tetap harus dibatasi dengan kebijakan akses yang tepat. Jangan menaruh service-role key, password, atau secret server di GitHub/Vercel frontend.
