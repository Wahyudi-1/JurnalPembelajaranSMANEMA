/**
 * SCRIPT KHUSUS PANEL KEPALA SEKOLAH (VIEW & EXPORT ONLY)
 */

const SUPABASE_URL = 'https://pbfhvyqhshuvyakjfpka.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZmh2eXFoc2h1dnlha2pmcGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MTY1NTksImV4cCI6MjEwNjk5MjU1OX0.RMDKCmkniLHoCgxsFr0noBlbB4DoqH1CTZc4lRtnPNg';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const State = {
    allJurnal: [],
    filteredJurnal: [],
    allDisiplin: [],
    filteredDisiplin: []
};

function showLoading(show) { document.getElementById('loadingIndicator').style.display = show ? 'flex' : 'none'; }

async function initSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return window.location.replace('index.html');
    
    const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', session.user.id).single();
    if (profile) {
        if (profile.role !== 'Kepala Sekolah') return window.location.replace('index.html'); // Cegah guru/admin masuk
        document.getElementById('welcomeMessage').textContent = `Selamat Datang, Bapak/Ibu ${profile.full_name}`;
    }
}

// --- MODUL JURNAL ---
async function fetchJurnal() {
    showLoading(true);
    const { data, error } = await supabaseClient
        .from('jurnal_pelajaran')
        .select('*, profiles(full_name)')
        .order('tanggal', { ascending: false });
    
    showLoading(false);
    if (error) return console.error(error);
    
    State.allJurnal = data;
    State.filteredJurnal = data;
    
    // Isi Dropdown Filter Guru
    const guruSelect = document.getElementById('filterGuruJurnal');
    guruSelect.innerHTML = '<option value="">-- Semua Guru --</option>';
    const uniqueGurus = [...new Set(data.map(item => item.profiles?.full_name))].filter(Boolean);
    uniqueGurus.forEach(g => guruSelect.innerHTML += `<option value="${g}">${g}</option>`);
    
    renderJurnal();
}

function renderJurnal() {
    const tbody = document.getElementById('tableBodyJurnal');
    document.getElementById('btnExportJurnal').style.display = State.filteredJurnal.length ? 'inline-block' : 'none';
    
    if (!State.filteredJurnal.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Tidak ada data jurnal.</td></tr>';
        return;
    }

    tbody.innerHTML = State.filteredJurnal.map(j => `
        <tr>
            <td data-label="Tanggal">${new Date(j.tanggal).toLocaleDateString('id-ID')}</td>
            <td data-label="Guru" style="font-weight:600; color:var(--primary-dark);">${j.profiles?.full_name || 'Tidak diketahui'}</td>
            <td data-label="Kelas">${j.kelas}</td>
            <td data-label="Mapel">${j.mata_pelajaran}</td>
            <td data-label="Materi & Catatan">
                <strong>${j.materi}</strong><br>
                <span style="font-size:0.85em; color:gray;">${(j.catatan || '').replace(/\n/g, '<br>')}</span>
            </td>
        </tr>
    `).join('');
}

// --- MODUL DISIPLIN ---
async function fetchDisiplin() {
    showLoading(true);
    const { data, error } = await supabaseClient
        .from('catatan_disiplin')
        .select(`id, created_at, siswa(nisn, nama), pelanggaran_master(deskripsi, poin), profiles(full_name)`)
        .order('created_at', { ascending: false });
    showLoading(false);
    
    if (error) return console.error(error);
    State.allDisiplin = data;
    State.filteredDisiplin = data;
    renderDisiplin();
}

function renderDisiplin() {
    const tbody = document.getElementById('tableBodyDisiplin');
    document.getElementById('btnExportDisiplin').style.display = State.filteredDisiplin.length ? 'inline-block' : 'none';

    if (!State.filteredDisiplin.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Tidak ada data pelanggaran.</td></tr>';
        return;
    }

    tbody.innerHTML = State.filteredDisiplin.map(d => `
        <tr>
            <td data-label="Tanggal">${new Date(d.created_at).toLocaleDateString('id-ID')}</td>
            <td data-label="NISN">${d.siswa?.nisn || '-'}</td>
            <td data-label="Nama Siswa" style="font-weight:600;">${d.siswa?.nama || '-'}</td>
            <td data-label="Pelanggaran">${d.pelanggaran_master?.deskripsi || '-'} <strong>(${d.pelanggaran_master?.poin || 0} Poin)</strong></td>
            <td data-label="Pencatat">${d.profiles?.full_name || '-'}</td>
        </tr>
    `).join('');
}

// --- FILTER & EXPORT EXCEL ---
function applyFilters() {
    // Filter Jurnal
    const guru = document.getElementById('filterGuruJurnal').value;
    const m1 = document.getElementById('filterMulaiJurnal').value;
    const s1 = document.getElementById('filterSelesaiJurnal').value;
    
    State.filteredJurnal = State.allJurnal.filter(j => {
        const tgl = new Date(j.tanggal);
        const matchGuru = !guru || j.profiles?.full_name === guru;
        const matchTgl = (!m1 || tgl >= new Date(m1)) && (!s1 || tgl <= new Date(s1));
        return matchGuru && matchTgl;
    });
    renderJurnal();

    // Filter Disiplin
    const siswa = document.getElementById('filterSiswaDisiplin').value.toLowerCase();
    const m2 = document.getElementById('filterMulaiDisiplin').value;
    const s2 = document.getElementById('filterSelesaiDisiplin').value;
    
    State.filteredDisiplin = State.allDisiplin.filter(d => {
        const tgl = new Date(d.created_at);
        const matchSiswa = !siswa || (d.siswa?.nama || '').toLowerCase().includes(siswa) || (d.siswa?.nisn || '').includes(siswa);
        const matchTgl = (!m2 || tgl >= new Date(m2)) && (!s2 || tgl <= new Date(s2));
        return matchSiswa && matchTgl;
    });
    renderDisiplin();
}

function exportExcel(type) {
    let dataToExport = [];
    let filename = '';
    
    if (type === 'jurnal') {
        dataToExport = State.filteredJurnal.map(j => ({
            Tanggal: new Date(j.tanggal).toLocaleDateString('id-ID'),
            Guru: j.profiles?.full_name,
            Kelas: j.kelas,
            'Mata Pelajaran': j.mata_pelajaran,
            Materi: j.materi,
            Catatan: j.catatan
        }));
        filename = `Rekap_Jurnal_${new Date().toISOString().slice(0, 10)}.xlsx`;
    } else {
        dataToExport = State.filteredDisiplin.map(d => ({
            Tanggal: new Date(d.created_at).toLocaleDateString('id-ID'),
            NISN: d.siswa?.nisn,
            'Nama Siswa': d.siswa?.nama,
            Pelanggaran: d.pelanggaran_master?.deskripsi,
            Poin: d.pelanggaran_master?.poin,
            Pencatat: d.profiles?.full_name
        }));
        filename = `Rekap_Disiplin_${new Date().toISOString().slice(0, 10)}.xlsx`;
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap");
    XLSX.writeFile(wb, filename);
}

// --- SETUP LISTENERS ---
document.addEventListener('DOMContentLoaded', async () => {
    await initSession();
    await fetchJurnal();
    await fetchDisiplin();

    // Setup Tab Navigasi
    document.querySelectorAll('.sidebar-nav .btn-nav').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.dashboard-content .content-section').forEach(s => s.style.display = 'none');
            document.getElementById(e.target.dataset.section).style.display = 'block';
            document.querySelectorAll('.sidebar-nav .btn-nav').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    document.getElementById('logoutButton').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.replace('index.html');
    });

    document.getElementById('btnFilterJurnal').addEventListener('click', applyFilters);
    document.getElementById('btnFilterDisiplin').addEventListener('click', applyFilters);
    document.getElementById('btnExportJurnal').addEventListener('click', () => exportExcel('jurnal'));
    document.getElementById('btnExportDisiplin').addEventListener('click', () => exportExcel('disiplin'));
});
