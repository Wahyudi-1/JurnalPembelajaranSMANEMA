/**
 * =================================================================
 * SCRIPT KHUSUS PANEL SISWA - SISTEM JURNAL & DISIPLIN
 * =================================================================
 */

// Konfigurasi Database
const SUPABASE_URL = 'https://pbfhvyqhshuvyakjfpka.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZmh2eXFoc2h1dnlha2pmcGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MTY1NTksImV4cCI6MjEwNjk5MjU1OX0.RMDKCmkniLHoCgxsFr0noBlbB4DoqH1CTZc4lRtnPNg';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variabel Nomor WhatsApp Guru Piket (Nilai awal, akan ditimpa otomatis dari database)
let nomorWaPiket = '6281234567890'; 

const AppState = {
    user: null,
    profile: null,
    daftarKelas: [],
    allJurnal: []
};

// --- HELPERS ---
function showLoading(isLoading) { document.getElementById('loadingIndicator').style.display = isLoading ? 'flex' : 'none'; }

// --- INISIALISASI SESI ---
async function initSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return window.location.replace('index.html');
    
    AppState.user = session.user;
    const { data: profileData } = await supabaseClient.from('profiles').select('*').eq('id', AppState.user.id).single();
    
    if (profileData) {
        if (profileData.role !== 'Siswa') return window.location.replace('index.html');
        AppState.profile = profileData;
        document.getElementById('welcomeMessage').textContent = `Halo, Siswa SMANEMA`;
    }

    // TARIK NOMOR WA PIKET DARI DATABASE (Tabel Pengaturan)
    const { data: pengaturan } = await supabaseClient.from('pengaturan').select('nilai').eq('kunci', 'nomor_wa_piket').single();
    if (pengaturan && pengaturan.nilai) {
        nomorWaPiket = pengaturan.nilai;
    }
}

async function loadDaftarKelas() {
    // Mengambil daftar unik kelas dari tabel siswa untuk mengisi dropdown
    const { data } = await supabaseClient.from('siswa').select('kelas');
    if (data) {
        const uniqueKelas = [...new Set(data.map(item => item.kelas))].sort();
        AppState.daftarKelas = uniqueKelas;
        
        const laporSelect = document.getElementById('laporKelas');
        const filterSelect = document.getElementById('filterKelasJurnal');
        
        const optionsHTML = `<option value="">-- Pilih Kelas Anda --</option>` + 
                            uniqueKelas.map(k => `<option value="${k}">${k}</option>`).join('');
        
        laporSelect.innerHTML = optionsHTML;
        filterSelect.innerHTML = optionsHTML;
    }
}

// --- FITUR LAPOR WHATSAPP GURU KOSONG ---
function handleLaporWA(e) {
    e.preventDefault();
    
    const kelas = document.getElementById('laporKelas').value;
    const mapel = document.getElementById('laporMapel').value;
    const guru = document.getElementById('laporGuru').value;
    const jam = document.getElementById('laporJam').value;

    // Cek kelengkapan
    if (!kelas || !mapel || !guru || !jam) {
        alert("Harap lengkapi semua isian sebelum mengirim laporan.");
        return;
    }

    // Format Pesan
    const pesanAwal = `Assalamu'alaikum
Mohon izin menyampaikan bahwa *${guru}* untuk mata pelajaran *${mapel}* masih belum hadir di kelas *${kelas}* pada periode pelajaran *${jam}*.

Mohon bantuan untuk diberikan arahan tindakan yang harus kelas kami lakukan di periode jam tersebut.

Terima kasih`;

    // Encode string agar menjadi format URL (mengubah spasi menjadi %20, enter menjadi %0A)
    const pesanEncoded = encodeURIComponent(pesanAwal);
    
    // Buka Tab Baru menuju API WhatsApp menggunakan nomor dinamis dari database
    const urlWhatsapp = `https://wa.me/${nomorWaPiket}?text=${pesanEncoded}`;
    window.open(urlWhatsapp, '_blank');
    
    // Reset Form
    e.target.reset();
}

// --- FITUR REKAP JURNAL KELAS ---
async function fetchJurnalSiswa() {
    const kelasTerpilih = document.getElementById('filterKelasJurnal').value;
    const tglMulai = document.getElementById('filterTanggalMulai').value;
    const tglSelesai = document.getElementById('filterTanggalSelesai').value;
    const tbody = document.getElementById('tabelJurnalBody');

    if (!kelasTerpilih) {
        alert("Silakan pilih Kelas Anda terlebih dahulu.");
        return;
    }

    showLoading(true);
    let query = supabaseClient
        .from('jurnal_pelajaran')
        .select('tanggal, mata_pelajaran, materi, catatan, profiles(full_name)')
        .eq('kelas', kelasTerpilih)
        .order('tanggal', { ascending: false });

    const { data, error } = await query;
    showLoading(false);

    if (error) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Gagal memuat data: ${error.message}</td></tr>`;
        return;
    }

    // Filter Tanggal secara lokal (di Javascript)
    let filteredData = data;
    if (tglMulai || tglSelesai) {
        filteredData = data.filter(j => {
            const tglJurnal = new Date(j.tanggal);
            const isAfterMulai = !tglMulai || tglJurnal >= new Date(tglMulai);
            const isBeforeSelesai = !tglSelesai || tglJurnal <= new Date(tglSelesai);
            return isAfterMulai && isBeforeSelesai;
        });
    }

    // Render Data
    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Tidak ada materi/jurnal yang ditemukan untuk kelas ini.</td></tr>';
        return;
    }

    tbody.innerHTML = filteredData.map(j => `
        <tr>
            <td data-label="Tanggal">${new Date(j.tanggal).toLocaleDateString('id-ID')}</td>
            <td data-label="Mata Pelajaran">${j.mata_pelajaran}</td>
            <td data-label="Guru Pengajar">${j.profiles?.full_name || 'Guru'}</td>
            <td data-label="Materi"><strong>${j.materi}</strong></td>
        </tr>
    `).join('');
}

// --- SETUP LISTENERS ---
document.addEventListener('DOMContentLoaded', async () => {
    if (!document.querySelector('.dashboard-wrapper')) return; 
    
    await initSession();
    await loadDaftarKelas();

    // Navigasi Tab / Sidebar
    document.querySelectorAll('.sidebar-nav .btn-nav').forEach(button => {
        button.addEventListener('click', (e) => {
            const sectionId = e.currentTarget.dataset.section;
            document.querySelectorAll('.dashboard-content .content-section').forEach(s => s.style.display = 'none');
            document.getElementById(sectionId).style.display = 'block';
            
            document.querySelectorAll('.sidebar-nav .btn-nav').forEach(btn => btn.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });

    document.getElementById('logoutButton').addEventListener('click', async () => {
        if (!confirm('Apakah Anda yakin ingin keluar?')) return;
        showLoading(true);
        await supabaseClient.auth.signOut();
        window.location.replace('index.html');
    });
    
    // Listeners Utama
    document.getElementById('formLapor').addEventListener('submit', handleLaporWA);
    document.getElementById('btnFilterJurnal').addEventListener('click', fetchJurnalSiswa);
});
