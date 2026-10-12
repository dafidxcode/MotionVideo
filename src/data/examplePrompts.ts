export interface ExamplePrompt {
  id: string;
  styleId: string;
  title: string;
  styleName: string;
  category: string;
  accentColor: string;
  image: string;
  prompt: string;
}

export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    id: "ex-swdbot-launch",
    styleId: "grainy-gradient",
    title: "Pelancaran Swdbot AI 2.0 (Fitur AI)",
    styleName: "Grainy Gradient",
    category: "Opener",
    accentColor: "#6366f1",
    image: "/gallery/01-grainy-gradient.jpg",
    prompt:
      "Cipta video pembukaan sinematik gaya Grainy Gradient untuk pelancaran Swdbot AI 2.0. Latar belakang gelap beratmosfera indigo (#0c0f1d) dengan kilauan cahaya amber keemasan. Kamera bergerak menembusi bulatan dimensi bercahaya sambil zarah terapung secara organik. Tajuk kinetik masuk dengan pantulan spring kemas: 'Revolusi Automasi AI Swdbot - Buat Video & Automasi 10x Lebih Pantas'.",
  },
  {
    id: "ex-faceless-habits",
    styleId: "kinetic-colorblock",
    title: "3 Tabiat Musnahkan Masa Depan (YouTube Faceless)",
    styleName: "Poster Color-Block",
    category: "Typo",
    accentColor: "#ff2d55",
    image: "/gallery/02-kinetic-colorblock.jpg",
    prompt:
      "Animasi tipografi kinetik Poster Color-Block bertenaga tinggi untuk video YouTube Faceless. Blok warna pepejal berani (merah menyala #ff2d55, hitam legam, dan putih salji). Perkataan gergasi berimpak tinggi masuk tepat mengikut rentak tempo muzik dengan fizik spring tajam: '3 TABIAT INI SEDANG HANCURKAN POTENSI ANDA! BANGKIT SEKARANG JUGA!'",
  },
  {
    id: "ex-swdbot-dashboard",
    styleId: "saas-ui-tour",
    title: "Demo Dashboard & CRM Swdbot (Fitur AI)",
    styleName: "SaaS Product Tour",
    category: "Product",
    accentColor: "#3b82f6",
    image: "/gallery/03-saas-ui-tour.jpg",
    prompt:
      "Animasi jelajah produk SaaS Swdbot dalam mod gelap (dark mode). Kad papan pemuka interaktif terapung keluar memaparkan metrik jualan melonjak naik daripada RM12,500 kepada RM89,000 secara live. Kamera zum masuk lancar ke butang 'Aktifkan Bot Auto-Closing', kemudian bergerak mendedahkan graf penukaran prospek dan lencana analitik automatik.",
  },
  {
    id: "ex-whatsapp-bot",
    styleId: "flat-vector",
    title: "Bisnes Automasi WhatsApp 24 Jam (Bisnis)",
    styleName: "Flat Vector Illustration",
    category: "Promo",
    accentColor: "#10b981",
    image: "/gallery/04-flat-vector.jpg",
    prompt:
      "Promosi ilustrasi vektor rata (flat vector) untuk sistem automasi WhatsApp bisnes. Bentuk geometri bersih dengan warna hijau zamrud dan pudina segar. Telefon pintar terapung dengan kesan lantunan lembut, memaparkan bot membalas mesej pelanggan secara automatik dalam masa 2 saat dan menjana resit pembayaran segera tanpa staf manual.",
  },
  {
    id: "ex-debt-free",
    styleId: "continuous-action",
    title: "Langkah Bijak Bebas Hutang (Kehidupan)",
    styleName: "Continuous Action",
    category: "Explainer",
    accentColor: "#f59e0b",
    image: "/gallery/05-continuous-action.jpg",
    prompt:
      "Video penerangan aksi berterusan (continuous action) tentang pengurusan kewangan peribadi. Watak protagonis bergerak melintasi garis masa dari bebanan hutang kad kredit menuju kebebasan kewangan tanpa potongan babak. Nombor penjimatan dan graf pelaburan bulanan bertambah secara langsung sepanjang laluan animasi.",
  },
  {
    id: "ex-samad-sales",
    styleId: "cartoon-stage",
    title: "Kisah Peniaga Gandakan Jualan (Bisnis & Cerita)",
    styleName: "Cartoon Stage",
    category: "Storytelling",
    accentColor: "#ec4899",
    image: "/gallery/06-cartoon-stage.jpg",
    prompt:
      "Animasi panggung kartun berperingkat mengisahkan Pak Samad, peniaga kopi tempatan. Pentas warna-warni memaparkan kedai kopi kecilnya yang sunyi berubah menjadi sangat sesak selepas menggunakan pemasaran video AI Swdbot. Reaksi watak riang, cawan kopi melompat ceria, dan kotak dialog ekspresif muncul berselang-seli.",
  },
  {
    id: "ex-payday-sale",
    styleId: "flat-pop-photo",
    title: "Kempen Jualan Gila Hari Gaji (E-Commerce)",
    styleName: "Flat Pop with Photos",
    category: "Campaign",
    accentColor: "#8b5cf6",
    image: "/gallery/07-flat-pop-photo.jpg",
    prompt:
      "Kempen promosi Flat Pop bertenaga untuk jualan hari gaji. Gambar potongan produk asli melompat masuk ke skrin dengan putaran condong yang rancak, dihiasi pelekat diskaun warna-warni, garisan highlighter neon bercahaya, dan teks tajuk tebal: 'JUALAN MEGA HARI GAJI: DISKAUN SEHINGGA 70% HANYA 3 HARI SAHAJA!'",
  },
  {
    id: "ex-aesthetic-desk",
    styleId: "white-catalog",
    title: "Ruang Kerja Produktiviti Estetik (Gaya Hidup)",
    styleName: "White Catalog",
    category: "Showcase",
    accentColor: "#64748b",
    image: "/gallery/08-white-catalog.jpg",
    prompt:
      "Katalog elegan gaya White Catalog untuk inspirasi ruang kerja moden. Latar belakang putih bersih estetik (#f8fafc) dengan garisan grid seni bina halus. Aksesori meja kerja aluminium terapung dalam ruang 2.5D bersama tipografi editorial mewah dan petunjuk ukuran produk yang terperinci: 'Cipta Fokus Maksimum Dalam Ruang Kerja Idaman Anda'.",
  },
  {
    id: "ex-startup-failure",
    styleId: "visual-journalism",
    title: "Siasatan: Mengapa 90% Bisnes Gagal? (YouTube Faceless)",
    styleName: "Visual Journalism",
    category: "News",
    accentColor: "#ef4444",
    image: "/gallery/09-visual-journalism.jpg",
    prompt:
      "Video siasatan gaya kewartawanan visual untuk saluran YouTube Faceless: 'Mengapa 90% Startup Gagal?'. Latar belakang hitam arang dengan lencana merah 'LAPORAN KHAS'. Foto bukti keratan akhbar muncul bersama tag sumber rasmi, animasi stabilo kuning menyorot data statistik modal hangus, dan garisan penghubung fakta kritikal.",
  },
  {
    id: "ex-first-paper-money",
    styleId: "vintage-sketch",
    title: "Sejarah Wang Kertas Pertama Dunia (YouTube Faceless)",
    styleName: "Vintage Sketch",
    category: "Documentary",
    accentColor: "#b45309",
    image: "/gallery/10-vintage-sketch.jpg",
    prompt:
      "Dokumentari sejarah gaya lakaran vintaj tentang asal usul mata wang kertas Dinasti Song. Latar belakang kertas perkamen purba (#f5ebe0), tipografi serif klasik, cop setem berwarna karat, dan lukisan ukiran tembaga terperinci yang terbentuk perlahan-lahan melalui garisan lakaran tangan yang anggun.",
  },
  {
    id: "ex-brain-focus",
    styleId: "cartoon-collage",
    title: "Rahsia Otak Kekal Fokus & Produktif (Kehidupan)",
    styleName: "Cartoon Collage",
    category: "Education",
    accentColor: "#06b6d4",
    image: "/gallery/11-cartoon-collage.jpg",
    prompt:
      "Video penerangan sains santai di atas kertas bertekstur krim (#fffbeb): 'Bagaimana Hormon Dopamin Mengawal Fokus Anda'. Elemen ilustrasi keratan kertas comel, lencana pil warna-warni, nota tulisan tangan yang bersahaja, dan animasi otak berfikir yang melantun ceria bersama bayang-bayang kertas realistik.",
  },
];
