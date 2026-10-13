# PetLife — Virtual Pet 3D

Prototype awal PetLife: website virtual pet offline-first dengan Three.js, TypeScript, kontrol joystick, kebutuhan pet, koin/XP, toko aksesori, save lokal, dan perintah suara opsional.

## Kebutuhan
- Node.js 20.19+ atau 22.12+
- npm
- Browser modern dengan WebGL

## Jalankan di komputer atau Codespaces
```bash
npm install
npm run dev
```
Buka URL lokal/forwarded port yang diberikan Vite.

## Build produksi
```bash
npm run build
npm run preview
```

## Kontrol
- Gerakkan joystick di kiri bawah untuk berjalan.
- Tombol panah di kanan untuk lompat.
- Tombol Beri makan, Mandi, Main bareng, Istirahat untuk merawat Mochi.
- Ketuk "Panggil Mochi" untuk mencoba perintah suara jika browser mendukungnya.
- Buka Toko Mochi untuk membeli aksesori.
- Klik ikon pensil untuk mengganti nama.

## Simpanan dan offline
- Progres awal disimpan pada `localStorage` browser.
- Service Worker meng-cache app shell dan aset same-origin setelah situs dibuka melalui HTTP/HTTPS.
- Fitur offline harus diuji melalui server/hosting, bukan membuka `index.html` langsung dengan `file://`.
- Menghapus data situs dapat menghapus progres. Gunakan Pengaturan → Ekspor progres untuk membuat salinan JSON.

## Batasan prototype
- Model kucing sekarang dibuat dari geometri Three.js sederhana sebagai placeholder, belum model original ber-rig khusus.
- Gerakan karakter dan animasi masih prototipe; belum ada navigasi pathfinding penuh, animasi wajah tingkat lanjut, atau collision presisi.
- Mini-game Kejar Bola, evolusi, multiplayer, akun, cloud save, dan banyak ruangan belum dibuat.
- Pengenalan suara bergantung pada dukungan browser dan izin mikrofon; fitur ini opsional.
- Google Fonts hanya digunakan untuk tipografi. Untuk pengalaman benar-benar offline, gunakan font lokal atau hapus import font dari CSS.
- Ini fondasi yang bisa dijalankan, bukan rilis game final.

## Catatan produksi
Ganti placeholder Mochi dengan file GLB original yang telah dimodelkan, di-rig, dan dianimasikan. Integrasikan aset melalui `GLTFLoader` dari `three/addons/loaders/GLTFLoader.js`, lalu sambungkan klip animasi ke `AnimationMixer`.
