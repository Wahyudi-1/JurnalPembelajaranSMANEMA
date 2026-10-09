/**
 * =================================================================
 * SCRIPT KHUSUS PANEL GURU - SISTEM JURNAL & DISIPLIN (WITH NILAI)
 * =================================================================
 */

const SUPABASE_URL = 'https://pbfhvyqhshuvyakjfpka.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZmh2eXFoc2h1dnlha2pmcGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MTY1NTksImV4cCI6MjEwNjk5MjU1OX0.RMDKCmkniLHoCgxsFr0noBlbB4DoqH1CTZc4lRtnPNg';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const AppState = {
    user: null,
    profile: null,
    assignments: [],
    students: [],
    violations: [],
    allJurnalHistory: [],
    filteredJurnalHistory: [],
    allDisiplinHistory: [],
    filteredDisiplinHistory: []
};

// --- HELPERS ---
function showLoading(isLoading) { document.getElementById('loadingIndicator').style.display = isLoading ? 'flex' : 'none'; }
function showStatusMessage(message, type = 'info', duration = 4000) {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    statusEl.style.display = 'block';
    statusEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (duration > 0) setTimeout(() => { statusEl.style.display = 'none'; }, duration);
}
function populateDropdown(selectElementId, data, valueField, textField, defaultOptionText) {
    const select = document.getElementById(selectElementId);
    if (!select) return;
    select.innerHTML = `<option value="">-- ${defaultOptionText} --</option>`;
    const uniqueItems = [...new Map(data.map(item => [item[valueField], item])).values()];
    uniqueItems.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueField];
        option.textContent = item[textField];
        select.appendChild(option);
    });
}

// --- INISIALISASI ---
async function initSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return window.location.replace('index.html');
    
    AppState.user = session.user;
    const { data: profileData } = await supabaseClient.from('profiles').select('*').eq('id', AppState.user.id).single();
    
    if (profileData) {
        if (profileData.role !== 'Guru') return window.location.replace('index.html');
        AppState.profile = profileData;
        document.getElementById('welcomeMessage').textContent = `Selamat Datang, ${profileData.full_name}`;
    }
}

async function loadInitialData() {
    showLoading(true);
    const [assignments, students, violations] = await Promise.all([
        supabaseClient.from('penugasan_guru').select('kelas, mata_pelajaran').eq('guru_id', AppState.user.id),
        supabaseClient.from('siswa').select('nisn, nama, kelas').order('nama'),
        supabaseClient.from('pelanggaran_master').select('id, deskripsi, poin').order('deskripsi')
    ]);

    if (assignments.data) AppState.assignments = assignments.data;
    if (students.data) AppState.students = students.data;
    if (violations.data) AppState.violations = violations.data;
    showLoading(false);

    // Dropdown Jurnal
    populateDropdown('jurnalKelas', AppState.assignments, 'kelas', 'kelas', 'Pilih Kelas');
    populateDropdown('jurnalMapel', AppState.assignments, 'mata_pelajaran', 'mata_pelajaran', 'Pilih Mata Pelajaran');
    
    // Dropdown Disiplin
    const selectDisiplin = document.getElementById('deskripsiDisiplinInput');
    selectDisiplin.innerHTML = '<option value="">-- Pilih Pelanggaran --</option>';
    AppState.violations.forEach(v => selectDisiplin.innerHTML += `<option value="${v.id}">${v.deskripsi} (${v.poin} Poin)</option>`);

    // Dropdown Fitur Baru (Nilai)
    const currentYear = new Date().getFullYear();
    document.getElementById('nilaiFilterTahunAjaran').innerHTML = `
        <option value="">-- Pilih --</option>
        <option value="${currentYear-1}/${currentYear}">${currentYear-1}/${currentYear}</option>
        <option value="${currentYear}/${currentYear+1}">${currentYear}/${currentYear+1}</option>
    `;
    document.getElementById('nilaiFilterSemester').innerHTML = `
        <option value="">-- Pilih --</option><option value="Ganjil">Ganjil</option><option value="Genap">Genap</option>
    `;
    populateDropdown('nilaiFilterKelas', AppState.assignments, 'kelas', 'kelas', 'Pilih Kelas');
    populateDropdown('nilaiFilterMataPelajaran', AppState.assignments, 'mata_pelajaran', 'mata_pelajaran', 'Pilih Mata Pelajaran');
}

// --- MODUL NILAI SISWA (FITUR BARU) ---
function handleLoadSiswaNilai(e) {
    e.preventDefault(); // Mencegah reload halaman
    
    const kelas = document.getElementById('nilaiFilterKelas').value;
    const tableBody = document.getElementById('nilaiTableBody');
    const tableHead = document.getElementById('nilaiTableHead');
    
    const siswaDiKelas = AppState.students.filter(s => s.kelas === kelas);
    
    if (siswaDiKelas.length === 0) {
        showStatusMessage(`Tidak ada data siswa ditemukan untuk kelas ${kelas}.`, 'error');
        document.getElementById('areaInputNilai').style.display = 'none';
        return;
    }

    // Munculkan area input dan tabel
    document.getElementById('areaInputNilai').style.display = 'block';
    
    // Generate Header (Nilai (...))
    tableHead.innerHTML = `
        <tr>
            <th style="width: 20%;">NISN</th>
            <th style="width: 50%;">Nama Siswa</th>
            <th id="headerNilaiDinamis" style="width: 30%;">Nilai (...)</th>
        </tr>
    `;

    // Generate Baris Siswa dengan Input Form 0-100
    tableBody.innerHTML = siswaDiKelas.map(siswa => `
        <tr>
            <td data-label="NISN">${siswa.nisn}</td>
            <td data-label="Nama Siswa" style="font-weight: 500;">${siswa.nama}</td>
            <td data-label="Nilai">
                <input type="number" class="input-nilai-siswa" data-nisn="${siswa.nisn}" min="0" max="100" placeholder="0-100" style="padding: 0.4rem; border: 1px solid #ccc; border-radius: 4px; width: 100px;">
            </td>
        </tr>
    `).join('');
}

// Event untuk merubah tulisan Header "Nilai (...)" secara Realtime
document.getElementById('jenisNilai')?.addEventListener('input', (e) => {
    const header = document.getElementById('headerNilaiDinamis');
    if (header) {
        header.textContent = e.target.value ? `Nilai (${e.target.value})` : 'Nilai (...)';
    }
});

async function handleSimpanSemuaNilai(e) {
    e.preventDefault();
    
    const ta = document.getElementById('nilaiFilterTahunAjaran').value;
    const semester = document.getElementById('nilaiFilterSemester').value;
    const kelas = document.getElementById('nilaiFilterKelas').value;
    const mapel = document.getElementById('nilaiFilterMataPelajaran').value;
    const jenisNilai = document.getElementById('jenisNilai').value;
    
    const inputs = document.querySelectorAll('.input-nilai-siswa');
    const dataInsert = [];

    // Kumpulkan semua input nilai yang tidak kosong
    inputs.forEach(input => {
        if (input.value !== '') {
            dataInsert.push({
                guru_id: AppState.user.id,
                tahun_ajaran: ta,
                semester: semester,
                kelas: kelas,
                mata_pelajaran: mapel,
                jenis_penilaian: jenisNilai,
                nisn_siswa: input.dataset.nisn,
                nilai: parseFloat(input.value)
            });
        }
    });

    if (dataInsert.length === 0) return showStatusMessage('Belum ada nilai siswa yang diisi (minimal isi 1 siswa).', 'error');

    showLoading(true);
    const { error } = await supabaseClient.from('nilai_siswa').insert(dataInsert);
    showLoading(false);

    if (error) {
        // Deteksi jika nilai untuk ulangan tersebut sudah pernah disimpan
        if (error.code === '23505') {
            return showStatusMessage('Data gagal disimpan. Jenis penilaian ini sudah pernah dimasukkan untuk kelas tersebut.', 'error');
        }
        return showStatusMessage(`Gagal menyimpan nilai: ${error.message}`, 'error');
    }

    showStatusMessage('Semua nilai berhasil disimpan ke database!', 'success');
    document.getElementById('formInputNilai').reset();
    document.getElementById('areaInputNilai').style.display = 'none';
    document.getElementById('headerNilaiDinamis').textContent = 'Nilai (...)';
}

// --- MODUL JURNAL (TETAP) ---
async function loadSiswaForJurnal() {
    const kelas = document.getElementById('jurnalKelas').value;
    const mapel = document.getElementById('jurnalMapel').value;
    const tableBody = document.getElementById('presensiTableBody');

    if (!kelas || !mapel) return showStatusMessage('Harap pilih Kelas dan Mata Pelajaran.', 'error');
    
    const siswaDiKelas = AppState.students.filter(s => s.kelas === kelas);
    if (siswaDiKelas.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center;">Tidak ada data siswa di kelas ${kelas}.</td></tr>`;
        return;
    }

    tableBody.innerHTML = siswaDiKelas.map(siswa => `
        <tr data-nisn="${siswa.nisn}" data-nama="${siswa.nama}">
            <td data-label="NISN">${siswa.nisn}</td>
            <td data-label="Nama">${siswa.nama}</td>
            <td data-label="Kehadiran">
                <select class="kehadiran-status" style="width:100%; padding:0.5rem; border:1px solid #dfe4ea; border-radius:5px;">
                    <option value="Hadir" selected>Hadir</option>
                    <option value="Sakit">Sakit</option>
                    <option value="Izin">Izin</option>
                    <option value="Alfa">Alfa</option>
                </select>
            </td>
        </tr>
    `).join('');
}

async function handleJurnalSubmit(event) {
    event.preventDefault();
    const presensiRows = document.querySelectorAll('#presensiTableBody tr');
    
    if (presensiRows.length > 0 && presensiRows[0]?.cells?.[0]?.textContent.includes('Pilih kelas')) {
         return showStatusMessage('Harap klik "Tampilkan Siswa untuk Presensi" terlebih dahulu.', 'error');
    }

    const jurnalData = {
        guru_id: AppState.user.id,
        kelas: document.getElementById('jurnalKelas').value,
        mata_pelajaran: document.getElementById('jurnalMapel').value,
        tanggal: document.getElementById('jurnalTanggal').value,
        materi: document.getElementById('jurnalMateri').value,
        catatan: document.getElementById('jurnalCatatan').value || '',
    };

    const siswaTidakHadir = [];
    presensiRows.forEach(row => {
        if (row.dataset.nisn) { 
            const status = row.querySelector('.kehadiran-status').value;
            if (status !== 'Hadir') siswaTidakHadir.push(`${row.dataset.nama} (${status})`);
        }
    });

    if (siswaTidakHadir.length > 0) jurnalData.catatan += `\n\n--- PRESENSI TIDAK HADIR ---\n${siswaTidakHadir.join('\n')}`;

    showLoading(true);
    const { error } = await supabaseClient.from('jurnal_pelajaran').insert(jurnalData);
    showLoading(false);
    
    if (error) return showStatusMessage(`Gagal menyimpan: ${error.message}`, 'error');
    
    showStatusMessage('Jurnal & presensi berhasil disimpan!', 'success');
    event.target.reset();
    document.getElementById('presensiTableBody').innerHTML = `<tr><td colspan="3" style="text-align: center;">Pilih kelas dan mapel, lalu klik "Tampilkan Siswa".</td></tr>`;
}

// --- MODUL DISIPLIN (TETAP) ---
function setupSiswaSearch() {
    const searchInput = document.getElementById('nisnDisiplinInput');
    const suggestionsContainer = document.getElementById('nisnSuggestions');
    const namaSiswaInput = document.getElementById('namaSiswaDisiplin');

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        suggestionsContainer.style.display = 'block';
        if (query.length < 2) { suggestionsContainer.innerHTML = ''; return; }
        
        const filteredSiswa = AppState.students.filter(s => s.nama.toLowerCase().includes(query) || s.nisn.includes(query)).slice(0, 5);
        suggestionsContainer.innerHTML = filteredSiswa.map(s => `<div class="suggestion-item" data-nisn="${s.nisn}" data-nama="${s.nama}">${s.nama} (${s.nisn})</div>`).join('');
    });
    
    searchInput.addEventListener('blur', () => setTimeout(() => { suggestionsContainer.style.display = 'none'; }, 200));

    suggestionsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-item')) {
            searchInput.value = e.target.dataset.nisn;
            namaSiswaInput.value = e.target.dataset.nama;
            suggestionsContainer.style.display = 'none';
        }
    });
}

async function handleDisiplinSubmit(event) {
    event.preventDefault();
    const disiplinData = {
        nisn_siswa: document.getElementById('nisnDisiplinInput').value,
        id_pelanggaran: document.getElementById('deskripsiDisiplinInput').value,
        pencatat_id: AppState.user.id
    };
    
    showLoading(true);
    const { error } = await supabaseClient.from('catatan_disiplin').insert(disiplinData);
    showLoading(false);
    
    if (error) return showStatusMessage(`Gagal menyimpan: ${error.message}`, 'error');
    showStatusMessage('Catatan disiplin berhasil disimpan!', 'success');
    event.target.reset();
    document.getElementById('namaSiswaDisiplin').value = '';
}

// --- RIWAYAT DATA (TETAP) ---
async function loadRiwayatJurnal() {
    showLoading(true);
    const { data, error } = await supabaseClient.from('jurnal_pelajaran').select('*').eq('guru_id', AppState.user.id).order('tanggal', { ascending: false });
    showLoading(false);

    if (error) return showStatusMessage('Gagal memuat data riwayat.', 'error');
    AppState.allJurnalHistory = data;
    AppState.filteredJurnalHistory = data;
    
    populateDropdown('riwayatFilterKelas', data, 'kelas', 'kelas', 'Semua Kelas');
    populateDropdown('riwayatFilterMapel', data, 'mata_pelajaran', 'mata_pelajaran', 'Semua Mapel');
    renderRiwayatJurnalTable();
}

function renderRiwayatJurnalTable() {
    const tableBody = document.getElementById('riwayatJurnalTableBody');
    document.getElementById('exportRiwayatButton').style.display = AppState.filteredJurnalHistory.length > 0 ? 'inline-block' : 'none';
    if (AppState.filteredJurnalHistory.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Tidak ada riwayat ditemukan.</td></tr>';
        return;
    }
    tableBody.innerHTML = AppState.filteredJurnalHistory.map(j => `
        <tr>
            <td data-label="Tanggal">${new Date(j.tanggal).toLocaleDateString('id-ID')}</td>
            <td data-label="Kelas">${j.kelas}</td>
            <td data-label="Mapel">${j.mata_pelajaran}</td>
            <td data-label="Materi & Catatan">
                <strong>${j.materi}</strong><br>
                <span style="font-size:0.85em; color:gray;">${(j.catatan || '').replace(/\n/g, '<br>')}</span>
            </td>
        </tr>
    `).join('');
}

async function loadRiwayatDisiplin() {
    showLoading(true);
    const { data, error } = await supabaseClient.from('catatan_disiplin').select(`id, created_at, siswa (nisn, nama), pelanggaran_master (deskripsi, poin), profiles (full_name)`).order('created_at', { ascending: false });
    showLoading(false);
    if (error) return showStatusMessage('Gagal memuat data riwayat disiplin.', 'error');
    AppState.allDisiplinHistory = data;
    AppState.filteredDisiplinHistory = data;
    renderRiwayatDisiplinTable();
}

function renderRiwayatDisiplinTable() {
    const tableBody = document.getElementById('riwayatDisiplinTableBody');
    if (AppState.filteredDisiplinHistory.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Tidak ada riwayat ditemukan.</td></tr>';
        return;
    }
    tableBody.innerHTML = AppState.filteredDisiplinHistory.map(d => `
        <tr>
            <td data-label="Tanggal">${new Date(d.created_at).toLocaleDateString('id-ID')}</td>
            <td data-label="NISN">${d.siswa?.nisn || '-'}</td>
            <td data-label="Nama Siswa">${d.siswa?.nama || '-'}</td>
            <td data-label="Pelanggaran">${d.pelanggaran_master?.deskripsi || '-'} <strong>(${d.pelanggaran_master?.poin || 0} Poin)</strong></td>
            <td data-label="Pencatat">${d.profiles?.full_name || '-'}</td>
        </tr>
    `).join('');
}

function applyJurnalFilter() {
    const fKelas = document.getElementById('riwayatFilterKelas').value;
    const fMapel = document.getElementById('riwayatFilterMapel').value;
    const fMulai = document.getElementById('riwayatFilterTanggalMulai').value;
    const fSelesai = document.getElementById('riwayatFilterTanggalSelesai').value;
    AppState.filteredJurnalHistory = AppState.allJurnalHistory.filter(j => {
        const tgl = new Date(j.tanggal);
        return (!fKelas || j.kelas === fKelas) && (!fMapel || j.mata_pelajaran === fMapel) && (!fMulai || tgl >= new Date(fMulai)) && (!fSelesai || tgl <= new Date(fSelesai));
    });
    renderRiwayatJurnalTable();
}

function applyDisiplinFilter() {
    const fNisn = document.getElementById('riwayatDisiplinFilterNisn').value.toLowerCase();
    const fMulai = document.getElementById('riwayatDisiplinFilterTanggalMulai').value;
    const fSelesai = document.getElementById('riwayatDisiplinFilterTanggalSelesai').value;
    AppState.filteredDisiplinHistory = AppState.allDisiplinHistory.filter(d => {
        const tgl = new Date(d.created_at);
        const s = d.siswa || {};
        return (!fNisn || (s.nisn || '').includes(fNisn) || (s.nama || '').toLowerCase().includes(fNisn)) && (!fMulai || tgl >= new Date(fMulai)) && (!fSelesai || tgl <= new Date(fSelesai));
    });
    renderRiwayatDisiplinTable();
}

function exportRiwayatJurnal() {
    if (AppState.filteredJurnalHistory.length === 0) return;
    const dataToExport = AppState.filteredJurnalHistory.map(j => ({
        Tanggal: new Date(j.tanggal).toLocaleDateString('id-ID'), Kelas: j.kelas, 'Mata Pelajaran': j.mata_pelajaran, Materi: j.materi, Catatan: j.catatan
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataToExport), "Riwayat Jurnal");
    XLSX.writeFile(wb, `Jurnal_Mengajar_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!document.querySelector('.dashboard-wrapper')) return; 
    
    await initSession();
    await loadInitialData();
    setupSiswaSearch();

    document.querySelectorAll('.sidebar-nav .btn-nav').forEach(button => {
        button.addEventListener('click', (e) => {
            const sectionId = e.currentTarget.dataset.section;
            document.querySelectorAll('.dashboard-content .content-section').forEach(s => s.style.display = 'none');
            document.getElementById(sectionId).style.display = 'block';
            document.querySelectorAll('.sidebar-nav .btn-nav').forEach(btn => btn.classList.remove('active'));
            e.currentTarget.classList.add('active');

            if (sectionId === 'riwayatJurnalSection') loadRiwayatJurnal();
            if (sectionId === 'riwayatDisiplinSection') loadRiwayatDisiplin();
        });
    });

    document.getElementById('logoutButton').addEventListener('click', handleLogout);
    
    // Listeners Form Jurnal & Disiplin
    document.getElementById('formJurnal').addEventListener('submit', handleJurnalSubmit);
    document.getElementById('formDisiplin').addEventListener('submit', handleDisiplinSubmit);
    document.getElementById('loadSiswaForJurnalButton').addEventListener('click', loadSiswaForJurnal);
    
    // Listeners Form Nilai Baru
    document.getElementById('formFilterNilai').addEventListener('submit', handleLoadSiswaNilai);
    document.getElementById('formInputNilai').addEventListener('submit', handleSimpanSemuaNilai);

    // Listeners Filter Jurnal & Disiplin
    document.getElementById('filterRiwayatButton').addEventListener('click', applyJurnalFilter);
    document.getElementById('refreshRiwayatButton').addEventListener('click', loadRiwayatJurnal);
    document.getElementById('exportRiwayatButton').addEventListener('click', exportRiwayatJurnal);
    
    document.getElementById('filterRiwayatDisiplinButton').addEventListener('click', applyDisiplinFilter);
    document.getElementById('refreshRiwayatDisiplinButton').addEventListener('click', loadRiwayatDisiplin);
});
