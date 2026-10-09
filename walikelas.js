/**
 * =================================================================
 * SCRIPT KHUSUS PANEL WALI KELAS (GABUNGAN FITUR GURU + WALI)
 * =================================================================
 */

const SUPABASE_URL = 'https://pbfhvyqhshuvyakjfpka.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZmh2eXFoc2h1dnlha2pmcGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MTY1NTksImV4cCI6MjEwNjk5MjU1OX0.RMDKCmkniLHoCgxsFr0noBlbB4DoqH1CTZc4lRtnPNg';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const AppState = {
    user: null, profile: null, assignments: [], students: [], violations: [],
    waliKelasData: null, // Menyimpan nama kelas yang diwalikan
    allJurnalHistory: [], filteredJurnalHistory: [],
    allDisiplinHistory: [], filteredDisiplinHistory: [],
    allNilaiHistory: [], filteredNilaiHistory: []
};

// --- HELPERS ---
function showLoading(isLoading) { document.getElementById('loadingIndicator').style.display = isLoading ? 'flex' : 'none'; }
function showStatusMessage(message, type = 'info', duration = 4000) {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message; statusEl.className = `status-message ${type}`;
    statusEl.style.display = 'block'; statusEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (duration > 0) setTimeout(() => { statusEl.style.display = 'none'; }, duration);
}
function populateDropdown(selectElementId, data, valueField, textField, defaultOptionText) {
    const select = document.getElementById(selectElementId);
    if (!select) return;
    select.innerHTML = `<option value="">-- ${defaultOptionText} --</option>`;
    const uniqueItems = [...new Map(data.map(item => [item[valueField], item])).values()];
    uniqueItems.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueField]; option.textContent = item[textField];
        select.appendChild(option);
    });
}

// --- INISIALISASI WALI KELAS ---
async function initSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return window.location.replace('index.html');
    
    AppState.user = session.user;
    const { data: profileData } = await supabaseClient.from('profiles').select('*').eq('id', AppState.user.id).single();
    
    if (profileData) {
        if (profileData.role !== 'Wali Kelas') return window.location.replace('index.html');
        AppState.profile = profileData;
        document.getElementById('welcomeMessage').textContent = `Selamat Datang, ${profileData.full_name}`;
    }
}

async function loadInitialData() {
    showLoading(true);
    
    // Tarik data Wali Kelas
    const { data: waliData } = await supabaseClient.from('wali_kelas').select('kelas').eq('guru_id', AppState.user.id).single();
    if (waliData) {
        AppState.waliKelasData = waliData.kelas;
        document.getElementById('infoKelasWali').textContent = waliData.kelas;
        document.querySelectorAll('.text-kelas-wali').forEach(el => el.textContent = waliData.kelas);
    } else {
        document.getElementById('infoKelasWali').textContent = "Belum Diset Admin";
    }

    const [assignments, students, violations] = await Promise.all([
        supabaseClient.from('penugasan_guru').select('kelas, mata_pelajaran').eq('guru_id', AppState.user.id),
        supabaseClient.from('siswa').select('nisn, nama, kelas').order('nama'),
        supabaseClient.from('pelanggaran_master').select('id, deskripsi, poin').order('deskripsi')
    ]);

    if (assignments.data) AppState.assignments = assignments.data;
    if (students.data) AppState.students = students.data;
    if (violations.data) AppState.violations = violations.data;
    
    // Auto-Set Waktu
    const today = new Date(); const month = today.getMonth() + 1; const year = today.getFullYear();
    const currentTA = month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
    const currentSemester = month >= 7 ? 'Ganjil' : 'Genap';
    const taHTML = `<option value="">-- Pilih --</option><option value="${year - 1}/${year}">${year - 1}/${year}</option><option value="${year}/${year + 1}">${year}/${year + 1}</option>`;
    const semesterHTML = `<option value="">-- Pilih --</option><option value="Ganjil">Ganjil</option><option value="Genap">Genap</option>`;

    // Dropdown Guru Biasa
    populateDropdown('jurnalKelas', AppState.assignments, 'kelas', 'kelas', 'Pilih Kelas');
    populateDropdown('jurnalMapel', AppState.assignments, 'mata_pelajaran', 'mata_pelajaran', 'Pilih Mata Pelajaran');
    const selectDisiplin = document.getElementById('deskripsiDisiplinInput');
    selectDisiplin.innerHTML = '<option value="">-- Pilih Pelanggaran --</option>';
    AppState.violations.forEach(v => selectDisiplin.innerHTML += `<option value="${v.id}">${v.deskripsi} (${v.poin} Poin)</option>`);

    // Dropdown Nilai
    document.getElementById('nilaiFilterTahunAjaran').innerHTML = taHTML; document.getElementById('nilaiFilterTahunAjaran').value = currentTA;
    document.getElementById('nilaiFilterSemester').innerHTML = semesterHTML; document.getElementById('nilaiFilterSemester').value = currentSemester;
    populateDropdown('nilaiFilterKelas', AppState.assignments, 'kelas', 'kelas', 'Pilih Kelas');
    populateDropdown('nilaiFilterMataPelajaran', AppState.assignments, 'mata_pelajaran', 'mata_pelajaran', 'Pilih Mata Pelajaran');

    document.getElementById('rekapNilaiTA').innerHTML = taHTML; document.getElementById('rekapNilaiTA').value = currentTA;
    document.getElementById('rekapNilaiSemester').innerHTML = semesterHTML; document.getElementById('rekapNilaiSemester').value = currentSemester;
    populateDropdown('rekapNilaiKelas', AppState.assignments, 'kelas', 'kelas', 'Pilih Kelas');
    populateDropdown('rekapNilaiMapel', AppState.assignments, 'mata_pelajaran', 'mata_pelajaran', 'Pilih Mata Pelajaran');

    showLoading(false);
    
    // Auto Load Fitur Wali jika ada
    if (AppState.waliKelasData) {
        loadWaliKehadiran();
        loadWaliJurnal();
    }
}

// ====================================================================
// FUNGSI KHUSUS WALI KELAS
// ====================================================================
async function loadWaliKehadiran() {
    if (!AppState.waliKelasData) return;
    showLoading(true);
    
    const classStudents = AppState.students.filter(s => s.kelas === AppState.waliKelasData);
    const { data: jurnals } = await supabaseClient.from('jurnal_pelajaran').select('catatan').eq('kelas', AppState.waliKelasData);
    showLoading(false);

    let rekap = {};
    classStudents.forEach(s => rekap[s.nama] = { Sakit: 0, Izin: 0, Alfa: 0 }); // Inisialisasi 0

    // Logika Parsing Detektif untuk Membaca Catatan Semua Guru
    if (jurnals) {
        jurnals.forEach(j => {
            if (j.catatan && j.catatan.includes('--- PRESENSI TIDAK HADIR ---')) {
                const parts = j.catatan.split('--- PRESENSI TIDAK HADIR ---');
                if (parts.length > 1) {
                    const lines = parts[1].trim().split('\n');
                    lines.forEach(line => {
                        const match = line.match(/(.+) \((Sakit\vert{}Izin\vert{}Alfa)\)/);
                        if (match) {
                            const name = match[1].trim();
                            const status = match[2];
                            if (rekap[name] !== undefined) rekap[name][status]++;
                        }
                    });
                }
            }
        });
    }

    const tbody = document.getElementById('waliKehadiranTableBody');
    if (classStudents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Tidak ada siswa di kelas ini.</td></tr>';
        return;
    }

    tbody.innerHTML = classStudents.map(s => {
        const data = rekap[s.nama];
        const total = data.Sakit + data.Izin + data.Alfa;
        return `<tr>
            <td data-label="Nama Siswa" style="font-weight:600;">${s.nama}</td>
            <td data-label="Sakit">${data.Sakit}</td>
            <td data-label="Izin">${data.Izin}</td>
            <td data-label="Alfa">${data.Alfa}</td>
            <td data-label="Total Absen" style="color:var(--danger-color); font-weight:bold;">${total} x</td>
        </tr>`;
    }).join('');
}

async function loadWaliJurnal() {
    if (!AppState.waliKelasData) return;
    showLoading(true);
    const { data, error } = await supabaseClient
        .from('jurnal_pelajaran')
        .select('tanggal, mata_pelajaran, materi, catatan, profiles(full_name)')
        .eq('kelas', AppState.waliKelasData)
        .order('tanggal', { ascending: false });
    showLoading(false);

    const tbody = document.getElementById('waliJurnalTableBody');
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Belum ada jurnal masuk untuk kelas ini.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(j => `
        <tr>
            <td data-label="Tanggal">${new Date(j.tanggal).toLocaleDateString('id-ID')}</td>
            <td data-label="Mapel">${j.mata_pelajaran}</td>
            <td data-label="Guru">${j.profiles?.full_name || 'Tidak diketahui'}</td>
            <td data-label="Materi"><strong>${j.materi}</strong><br><span style="font-size:0.85em; color:gray;">${(j.catatan || '').replace(/\n/g, '<br>')}</span></td>
        </tr>
    `).join('');
}

// ====================================================================
// FUNGSI GURU MENGAJAR (IDENTIK DENGAN GURU.JS)
// ====================================================================

// --- JURNAL ---
async function loadSiswaForJurnal() {
    const kelas = document.getElementById('jurnalKelas').value;
    const mapel = document.getElementById('jurnalMapel').value;
    const tbody = document.getElementById('presensiTableBody');
    if (!kelas || !mapel) return showStatusMessage('Pilih Kelas dan Mapel.', 'error');
    
    const siswaDiKelas = AppState.students.filter(s => s.kelas === kelas);
    if (siswaDiKelas.length === 0) return tbody.innerHTML = `<tr><td colspan="3" style="text-align: center;">Kosong.</td></tr>`;

    tbody.innerHTML = siswaDiKelas.map(s => `
        <tr data-nisn="${s.nisn}" data-nama="${s.nama}">
            <td data-label="NISN">${s.nisn}</td><td data-label="Nama">${s.nama}</td>
            <td data-label="Kehadiran"><select class="kehadiran-status" style="width:100%; padding:0.5rem; border-radius:5px;"><option value="Hadir">Hadir</option><option value="Sakit">Sakit</option><option value="Izin">Izin</option><option value="Alfa">Alfa</option></select></td>
        </tr>
    `).join('');
}

async function handleJurnalSubmit(e) {
    e.preventDefault();
    const rows = document.querySelectorAll('#presensiTableBody tr');
    if (rows[0]?.cells[0]?.textContent.includes('Pilih')) return showStatusMessage('Tampilkan siswa dulu.', 'error');

    const jData = {
        guru_id: AppState.user.id, kelas: document.getElementById('jurnalKelas').value, mata_pelajaran: document.getElementById('jurnalMapel').value,
        tanggal: document.getElementById('jurnalTanggal').value, materi: document.getElementById('jurnalMateri').value, catatan: document.getElementById('jurnalCatatan').value || ''
    };

    const absen = [];
    rows.forEach(r => { if(r.dataset.nisn) { const s = r.querySelector('.kehadiran-status').value; if(s !== 'Hadir') absen.push(`${r.dataset.nama} (${s})`); }});
    if (absen.length > 0) jData.catatan += `\n\n--- PRESENSI TIDAK HADIR ---\n${absen.join('\n')}`;

    showLoading(true);
    const { error } = await supabaseClient.from('jurnal_pelajaran').insert(jData);
    showLoading(false);
    
    if (error) return showStatusMessage(`Gagal: ${error.message}`, 'error');
    showStatusMessage('Jurnal disimpan!', 'success');
    e.target.reset(); document.getElementById('presensiTableBody').innerHTML = `<tr><td colspan="3">Pilih kelas...</td></tr>`;
    
    if (jData.kelas === AppState.waliKelasData) { loadWaliKehadiran(); loadWaliJurnal(); } // Auto Update Panel Wali
}

// --- NILAI ---
function handleLoadSiswaNilai(e) {
    e.preventDefault();
    const kelas = document.getElementById('nilaiFilterKelas').value;
    const tbody = document.getElementById('nilaiTableBody');
    const thead = document.getElementById('nilaiTableHead');
    const siswaDiKelas = AppState.students.filter(s => s.kelas === kelas);
    
    if (siswaDiKelas.length === 0) return document.getElementById('areaInputNilai').style.display = 'none';

    document.getElementById('areaInputNilai').style.display = 'block';
    thead.innerHTML = `<tr><th style="width: 20%;">NISN</th><th style="width: 50%;">Nama Siswa</th><th id="headerNilaiDinamis" style="width: 30%;">Nilai (...)</th></tr>`;
    tbody.innerHTML = siswaDiKelas.map(s => `<tr><td data-label="NISN">${s.nisn}</td><td data-label="Nama">${s.nama}</td><td data-label="Nilai"><input type="number" class="input-nilai-siswa" data-nisn="${s.nisn}" min="0" max="100" style="padding:0.4rem; border:1px solid #ccc; width:100px;"></td></tr>`).join('');
}
document.getElementById('jenisNilai')?.addEventListener('input', (e) => { const h = document.getElementById('headerNilaiDinamis'); if(h) h.textContent = e.target.value ? `Nilai (${e.target.value})` : 'Nilai (...)'; });

async function handleSimpanSemuaNilai(e) {
    e.preventDefault();
    const dataInsert = [];
    document.querySelectorAll('.input-nilai-siswa').forEach(i => {
        if (i.value !== '') dataInsert.push({ guru_id: AppState.user.id, tahun_ajaran: document.getElementById('nilaiFilterTahunAjaran').value, semester: document.getElementById('nilaiFilterSemester').value, kelas: document.getElementById('nilaiFilterKelas').value, mata_pelajaran: document.getElementById('nilaiFilterMataPelajaran').value, jenis_penilaian: document.getElementById('jenisNilai').value, nisn_siswa: i.dataset.nisn, nilai: parseFloat(i.value) });
    });
    if (dataInsert.length === 0) return showStatusMessage('Isi minimal 1 nilai.', 'error');

    showLoading(true); const { error } = await supabaseClient.from('nilai_siswa').insert(dataInsert); showLoading(false);
    if (error) return showStatusMessage(error.code === '23505' ? 'Penilaian sudah pernah dimasukkan.' : error.message, 'error');
    
    showStatusMessage('Nilai disimpan!', 'success');
    document.getElementById('formInputNilai').reset(); document.getElementById('areaInputNilai').style.display = 'none';
}

async function loadRiwayatNilai() {
    showLoading(true); const { data } = await supabaseClient.from('nilai_siswa').select(`id, tahun_ajaran, semester, kelas, mata_pelajaran, jenis_penilaian, nilai, siswa(nisn, nama)`).eq('guru_id', AppState.user.id).order('created_at', { ascending: false }); showLoading(false);
    AppState.allNilaiHistory = data || []; AppState.filteredNilaiHistory = data || [];
    renderRiwayatNilaiTable();
}

function renderRiwayatNilaiTable() {
    const tbody = document.getElementById('riwayatNilaiTableBody');
    if (AppState.filteredNilaiHistory.length === 0) { document.getElementById('areaKonversiExport').style.display = 'none'; return tbody.innerHTML = '<tr><td colspan="5">Kosong.</td></tr>'; }
    document.getElementById('areaKonversiExport').style.display = 'block';
    tbody.innerHTML = AppState.filteredNilaiHistory.map(n => `<tr><td>${n.tahun_ajaran} (${n.semester})</td><td>${n.siswa?.nisn}</td><td>${n.siswa?.nama}</td><td>${n.jenis_penilaian}</td><td>${n.nilai}</td></tr>`).join('');
}

function exportRiwayatNilaiKonversi() {
    const minTarget = parseFloat(document.getElementById('konversiMin').value) || 0; const maxTarget = parseFloat(document.getElementById('konversiMax').value) || 100;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(AppState.filteredNilaiHistory.map(n => ({ 'Tahun': n.tahun_ajaran, 'Smt': n.semester, 'Kelas': n.kelas, 'Mapel': n.mata_pelajaran, 'Tugas': n.jenis_penilaian, 'NISN': n.siswa?.nisn, 'Nama': n.siswa?.nama, 'Nilai Asli': n.nilai, 'Konversi': Math.round((((n.nilai/100)*(maxTarget-minTarget))+minTarget)*100)/100 }))), "Rekap Nilai");
    XLSX.writeFile(wb, `Rekap_Nilai.xlsx`);
}

// --- SETUP EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', async () => {
    if (!document.querySelector('.dashboard-wrapper')) return; 
    await initSession(); await loadInitialData();
    setupSiswaSearch(); // (Fungsi disiplin disederhanakan di DOM ini)

    document.querySelectorAll('.sidebar-nav .btn-nav').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.section;
            document.querySelectorAll('.dashboard-content .content-section').forEach(s => s.style.display = 'none');
            document.getElementById(id).style.display = 'block';
            document.querySelectorAll('.sidebar-nav .btn-nav').forEach(btn => btn.classList.remove('active')); e.currentTarget.classList.add('active');
            if (id === 'waliKehadiranSection') loadWaliKehadiran();
            if (id === 'waliJurnalSection') loadWaliJurnal();
            if (id === 'riwayatNilaiSection') loadRiwayatNilai();
        });
    });

    document.getElementById('logoutButton').addEventListener('click', async () => { await supabaseClient.auth.signOut(); window.location.replace('index.html'); });
    document.getElementById('formJurnal').addEventListener('submit', handleJurnalSubmit);
    document.getElementById('loadSiswaForJurnalButton').addEventListener('click', loadSiswaForJurnal);
    document.getElementById('formFilterNilai').addEventListener('submit', handleLoadSiswaNilai);
    document.getElementById('formInputNilai').addEventListener('submit', handleSimpanSemuaNilai);
    
    document.getElementById('exportRiwayatNilaiButton').addEventListener('click', exportRiwayatNilaiKonversi);

    // Setup Disiplin (Tetap)
    document.getElementById('formDisiplin').addEventListener('submit', async (e) => {
        e.preventDefault(); showLoading(true);
        await supabaseClient.from('catatan_disiplin').insert({ nisn_siswa: document.getElementById('nisnDisiplinInput').value, id_pelanggaran: document.getElementById('deskripsiDisiplinInput').value, pencatat_id: AppState.user.id });
        showLoading(false); showStatusMessage('Disiplin disimpan!', 'success'); e.target.reset(); document.getElementById('namaSiswaDisiplin').value='';
    });
    
    const sIn = document.getElementById('nisnDisiplinInput'); const sSug = document.getElementById('nisnSuggestions'); const sNama = document.getElementById('namaSiswaDisiplin');
    sIn.addEventListener('input', () => {
        const q = sIn.value.toLowerCase(); sSug.style.display = 'block'; if (q.length < 2) return sSug.innerHTML = '';
        sSug.innerHTML = AppState.students.filter(s => s.nama.toLowerCase().includes(q) || s.nisn.includes(q)).slice(0,5).map(s => `<div class="suggestion-item" data-nisn="${s.nisn}" data-nama="${s.nama}">${s.nama}</div>`).join('');
    });
    sSug.addEventListener('click', (e) => { if(e.target.classList.contains('suggestion-item')) { sIn.value = e.target.dataset.nisn; sNama.value = e.target.dataset.nama; sSug.style.display = 'none'; }});
});
