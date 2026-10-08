/**
 * =================================================================
 * SCRIPT UTAMA DASHBOARD - SISTEM JURNAL & DISIPLIN GURU
 * =================================================================
 * @version 6.2 - Fix "Identifier already declared" (Renaming to supabaseClient)
 * @author Disesuaikan oleh AI untuk Proyek Anda
 */

// ====================================================================
// TAHAP 1: KONFIGURASI GLOBAL DAN STATE APLIKASI
// ====================================================================

const SUPABASE_URL = 'https://lkxjgsgkajpaloswedck.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxreGpnc2drYWpwYWxvc3dlZGNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MDEyMjQsImV4cCI6MjA4NjE3NzIyNH0.A2KeArJQz6TNtLauZSyurMit3IK4hClwdoy4_qicPUc';

// Cek Library
if (typeof window.supabase === 'undefined') {
    alert("Error: Library Supabase tidak terdeteksi. Pastikan internet lancar atau CDN tidak memblokir.");
}

const { createClient } = window.supabase;

// [PERBAIKAN] Menggunakan nama 'supabaseClient' dan 'var' untuk mencegah konflik
var supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const AppState = {
    user: null,
    profile: null,
    assignments: [],
    students: [],
    violations: [],
    teachers: [],
    allAssignments: [],
    allJurnalHistory: [],
    filteredJurnalHistory: [],
    allDisiplinHistory: [],
    filteredDisiplinHistory: []
};

// ====================================================================
// TAHAP 2: FUNGSI-FUNGSI PEMBANTU (HELPERS)
// ====================================================================

function showLoading(isLoading) {
    const loader = document.getElementById('loadingIndicator');
    if (loader) loader.style.display = isLoading ? 'flex' : 'none';
}

function showStatusMessage(message, type = 'info', duration = 4000) {
    const statusEl = document.getElementById('statusMessage');
    if (!statusEl) { alert(message); return; }
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    statusEl.style.display = 'block';
    // Scroll agar pesan terlihat
    statusEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    if (duration > 0) setTimeout(() => { statusEl.style.display = 'none'; }, duration);
}

function populateDropdown(selectElementId, data, valueField, textField, defaultOptionText) {
    const select = document.getElementById(selectElementId);
    if (!select) return;
    select.innerHTML = `<option value="">-- ${defaultOptionText} --</option>`;
    
    // Filter item unik
    const uniqueItems = [...new Map(data.map(item => [item[valueField], item])).values()];
    
    uniqueItems.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueField];
        option.textContent = item[textField];
        select.appendChild(option);
    });
}

// ====================================================================
// TAHAP 3: FUNGSI OTENTIKASI & MANAJEMEN SESI (KHUSUS DASHBOARD)
// ====================================================================

async function checkAuthenticationAndSetup() {
    // Gunakan supabaseClient
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    // Jika tidak ada sesi, pengguna tidak boleh berada di dashboard.
    if (!session) {
        window.location.replace('index.html');
        return;
    }
    
    // Jika ada sesi, lanjutkan setup
    AppState.user = session.user;
    
    // Ambil data profil dari tabel 'profiles'
    const { data: profileData, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', AppState.user.id)
        .single();

    if (profileData) {
        AppState.profile = profileData;
        const welcomeEl = document.getElementById('welcomeMessage');
        if(welcomeEl) welcomeEl.textContent = `Selamat Datang, ${profileData.full_name || session.user.email}!`;
    } else {
        console.warn("Profil tidak ditemukan:", error);
        // Fallback jika profil belum dibuat trigger
        const welcomeEl = document.getElementById('welcomeMessage');
        if(welcomeEl) welcomeEl.textContent = `Selamat Datang, ${session.user.email}!`;
        // Set dummy profile agar UI tidak crash
        AppState.profile = { role: 'Guru', full_name: session.user.email }; 
    }
}

async function handleLogout() {
    if (!confirm('Apakah Anda yakin ingin logout?')) return;
    showLoading(true);
    await supabaseClient.auth.signOut();
    showLoading(false);
    window.location.replace('index.html');
}


// ====================================================================
// TAHAP 4: FUNGSI UTAMA APLIKASI (SEMUA LOGIKA DASHBOARD)
// ====================================================================

// --- 4.1 Inisialisasi & Kontrol UI ---
async function checkUserRoleAndSetupUI() {
    if (!AppState.profile) return;
    const adminElements = document.querySelectorAll('.admin-only');
    
    if (AppState.profile.role !== 'Admin') {
        adminElements.forEach(el => el.style.display = 'none');
    } else {
        adminElements.forEach(el => {
             // Pastikan display block untuk div, inline-block untuk tombol jika perlu
             el.style.display = el.tagName === 'DIV' ? 'block' : 'inline-block';
         });
    }
}

async function loadInitialData() {
    showLoading(true);
    
    // Ambil data secara paralel
    const promises = [
        supabaseClient.from('penugasan_guru').select('kelas, mata_pelajaran').eq('guru_id', AppState.user.id),
        supabaseClient.from('siswa').select('nisn, nama, kelas').order('nama'),
        supabaseClient.from('pelanggaran_master').select('id, deskripsi').order('deskripsi')
    ];

    // Jika Admin, ambil data tambahan
    if (AppState.profile.role === 'Admin') {
        promises.push(supabaseClient.from('profiles').select('id, full_name').eq('role', 'Guru').order('full_name'));
        promises.push(supabaseClient.from('penugasan_guru').select('*, profiles(full_name)').order('kelas'));
    } else {
        // Placeholder agar array destructuring tidak error
        promises.push(Promise.resolve({ data: [] }));
        promises.push(Promise.resolve({ data: [] }));
    }

    const [assignments, students, violations, teachers, allAssignments] = await Promise.all(promises);
    
    if (assignments.data) AppState.assignments = assignments.data;
    if (students.data) AppState.students = students.data;
    if (violations.data) AppState.violations = violations.data;
    if (teachers.data) AppState.teachers = teachers.data;
    if (allAssignments.data) AppState.allAssignments = allAssignments.data;

    showLoading(false);
}

function populateInitialDropdowns() {
    populateDropdown('jurnalKelas', AppState.assignments, 'kelas', 'kelas', 'Pilih Kelas');
    populateDropdown('jurnalMapel', AppState.assignments, 'mata_pelajaran', 'mata_pelajaran', 'Pilih Mata Pelajaran');
    populateDropdown('deskripsiDisiplinInput', AppState.violations, 'id', 'deskripsi', 'Pilih Pelanggaran');
    if (AppState.profile && AppState.profile.role === 'Admin') {
        populateDropdown('penugasanGuru', AppState.teachers, 'id', 'full_name', 'Pilih Guru');
    }
}

// --- 4.2 Fungsi Modul Jurnal & Riwayat Jurnal ---
async function loadSiswaForJurnal() {
    const kelas = document.getElementById('jurnalKelas').value;
    const mapel = document.getElementById('jurnalMapel').value;
    const tableBody = document.getElementById('presensiTableBody');

    if (!kelas || !mapel) {
        return showStatusMessage('Harap pilih Kelas dan Mata Pelajaran terlebih dahulu.', 'error');
    }

    showLoading(true);
    tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center;">Memuat data siswa...</td></tr>`;

    const { data, error } = await supabaseClient
        .from('siswa')
        .select('nisn, nama')
        .eq('kelas', kelas)
        .order('nama');

    showLoading(false);

    if (error) {
        tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center;">Gagal memuat siswa: ${error.message}</td></tr>`;
        return showStatusMessage('Gagal memuat data siswa.', 'error');
    }

    if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center;">Tidak ada data siswa ditemukan untuk kelas ${kelas}.</td></tr>`;
        return;
    }

    tableBody.innerHTML = data.map(siswa => `
        <tr data-nisn="${siswa.nisn}" data-nama="${siswa.nama}">
            <td data-label="NISN">${siswa.nisn}</td>
            <td data-label="Nama">${siswa.nama}</td>
            <td data-label="Kehadiran">
                <select class="kehadiran-status" style="width:100%; padding: 0.5rem; border-radius: var(--border-radius); border: 1px solid var(--border-color);">
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

    const jurnalData = {
        guru_id: AppState.user.id,
        kelas: document.getElementById('jurnalKelas').value,
        mata_pelajaran: document.getElementById('jurnalMapel').value,
        tanggal: document.getElementById('jurnalTanggal').value,
        materi: document.getElementById('jurnalMateri').value,
        catatan: document.getElementById('jurnalCatatan').value,
    };

    if (!jurnalData.kelas || !jurnalData.mata_pelajaran || !jurnalData.tanggal || !jurnalData.materi) {
        return showStatusMessage('Harap isi semua kolom jurnal yang wajib diisi.', 'error');
    }

    const presensiRows = document.querySelectorAll('#presensiTableBody tr');
    const siswaTidakHadir = [];

    presensiRows.forEach(row => {
        if (row.dataset.nisn) { 
            const status = row.querySelector('.kehadiran-status').value;
            if (status !== 'Hadir') {
                siswaTidakHadir.push({
                    nama: row.dataset.nama,
                    status: status
                });
            }
        }
    });

    let catatanPresensi = "";
    if (siswaTidakHadir.length > 0) {
        catatanPresensi += "\n\n--- PRESENSI (TIDAK HADIR) ---\n";
        catatanPresensi += siswaTidakHadir.map(s => `${s.nama}: ${s.status}`).join('\n');
    }
    
    if (jurnalData.catatan && siswaTidakHadir.length > 0) {
        jurnalData.catatan += " "; 
    }
    jurnalData.catatan += catatanPresensi;

    const siswaDiKelas = AppState.students.filter(s => s.kelas === jurnalData.kelas);
    if (siswaDiKelas.length > 0 && presensiRows[0]?.cells[0].textContent.includes('Pilih kelas')) {
         return showStatusMessage('Harap klik "Tampilkan Siswa untuk Presensi" terlebih dahulu.', 'error');
    }

    showLoading(true);
    // Gunakan supabaseClient
    const { error } = await supabaseClient.from('jurnal_pelajaran').insert(jurnalData);
    showLoading(false);
    
    if (error) {
        return showStatusMessage(`Gagal menyimpan jurnal: ${error.message}`, 'error');
    }
    
    showStatusMessage('Jurnal & presensi berhasil disimpan!', 'success');
    event.target.reset();
    document.getElementById('presensiTableBody').innerHTML = `<tr><td colspan="3" style="text-align: center;">Pilih kelas dan mata pelajaran, lalu klik "Tampilkan Siswa".</td></tr>`;
}

async function loadRiwayatJurnal() {
    const tableBody = document.getElementById('riwayatJurnalTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="6">Memuat riwayat...</td></tr>';
    
    showLoading(true);
    // Gunakan supabaseClient
    let query = supabaseClient.from('jurnal_pelajaran').select('*').order('tanggal', { ascending: false });
    if (AppState.profile.role !== 'Admin') {
        query = query.eq('guru_id', AppState.user.id);
    }

    const { data, error } = await query;
    showLoading(false);

    if (error) {
        tableBody.innerHTML = '<tr><td colspan="6">Gagal memuat riwayat.</td></tr>';
        return showStatusMessage('Gagal memuat data riwayat.', 'error');
    }

    AppState.allJurnalHistory = data;
    AppState.filteredJurnalHistory = data;
    
    populateDropdown('riwayatFilterKelas', AppState.allJurnalHistory, 'kelas', 'kelas', 'Semua Kelas');
    populateDropdown('riwayatFilterMapel', AppState.allJurnalHistory, 'mata_pelajaran', 'mata_pelajaran', 'Semua Mapel');
    
    renderRiwayatJurnalTable(AppState.filteredJurnalHistory);
}

function renderRiwayatJurnalTable(data) {
    const tableBody = document.getElementById('riwayatJurnalTableBody');
    document.getElementById('exportRiwayatButton').style.display = data.length > 0 ? 'inline-block' : 'none';

    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Tidak ada riwayat ditemukan sesuai filter.</td></tr>';
        return;
    }

    tableBody.innerHTML = data.map(j => {
        const catatanRingkas = (j.catatan || '').replace(/\n/g, ' ').substring(0, 70);
        return `
            <tr>
                <td data-label="Tanggal">${new Date(j.tanggal).toLocaleDateString('id-ID')}</td>
                <td data-label="Kelas">${j.kelas}</td>
                <td data-label="Mapel">${j.mata_pelajaran}</td>
                <td data-label="Materi">${j.materi.substring(0, 50)}...</td>
                <td data-label="Catatan">${catatanRingkas}...</td>
                <td data-label="Aksi">
                    <button class="btn btn-sm btn-secondary" onclick="editJurnalHandler('${j.id}')">Ubah</button>
                </td>
            </tr>
        `;
    }).join('');
}

function applyRiwayatFilter() {
    const filterKelas = document.getElementById('riwayatFilterKelas').value;
    const filterMapel = document.getElementById('riwayatFilterMapel').value;
    const filterMulai = document.getElementById('riwayatFilterTanggalMulai').value;
    const filterSelesai = document.getElementById('riwayatFilterTanggalSelesai').value;

    AppState.filteredJurnalHistory = AppState.allJurnalHistory.filter(jurnal => {
        const tanggalJurnal = new Date(jurnal.tanggal);
        const mulai = filterMulai ? new Date(filterMulai) : null;
        const selesai = filterSelesai ? new Date(filterSelesai) : null;
        if(mulai) mulai.setHours(0, 0, 0, 0);
        if(selesai) selesai.setHours(23, 59, 59, 999);
        
        const isKelasMatch = !filterKelas || jurnal.kelas === filterKelas;
        const isMapelMatch = !filterMapel || jurnal.mata_pelajaran === filterMapel;
        const isTanggalMatch = (!mulai || tanggalJurnal >= mulai) && (!selesai || tanggalJurnal <= selesai);

        return isKelasMatch && isMapelMatch && isTanggalMatch;
    });

    renderRiwayatJurnalTable(AppState.filteredJurnalHistory);
}

function exportRiwayatToExcel() {
    const dataToExport = AppState.filteredJurnalHistory;
    if (dataToExport.length === 0) {
        return showStatusMessage('Tidak ada data untuk diekspor.', 'info');
    }

    const formattedData = dataToExport.map(j => ({
        Tanggal: new Date(j.tanggal).toLocaleDateString('id-ID'),
        Kelas: j.kelas,
        'Mata Pelajaran': j.mata_pelajaran,
        Materi: j.materi,
        Catatan: j.catatan
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Riwayat Jurnal");
    XLSX.writeFile(workbook, `Riwayat_Jurnal_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

async function editJurnalHandler(jurnalId) {
    showStatusMessage('Fitur "Ubah" sedang dalam pengembangan.', 'info');
    console.log(`Edit diminta untuk Jurnal ID: ${jurnalId}`);
}

// --- 4.3 Fungsi Modul Disiplin & Riwayat Disiplin ---
function setupSiswaSearch() {
    const searchInput = document.getElementById('nisnDisiplinInput');
    const suggestionsContainer = document.getElementById('nisnSuggestions');
    const namaSiswaInput = document.getElementById('namaSiswaDisiplin');

    if (!searchInput) return;

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        suggestionsContainer.style.display = 'block';
        if (query.length < 2) {
            suggestionsContainer.innerHTML = '';
            return;
        }
        const filteredSiswa = AppState.students.filter(s => 
            s.nama.toLowerCase().includes(query) || s.nisn.includes(query)
        ).slice(0, 5);

        suggestionsContainer.innerHTML = filteredSiswa.map(s => 
            `<div class="suggestion-item" data-nisn="${s.nisn}" data-nama="${s.nama}">${s.nama} (${s.nisn})</div>`
        ).join('');
    });
    
    searchInput.addEventListener('blur', () => {
        setTimeout(() => { suggestionsContainer.style.display = 'none'; }, 200);
    });

    suggestionsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-item')) {
            const nisn = e.target.dataset.nisn;
            const nama = e.target.dataset.nama;
            searchInput.value = nisn;
            namaSiswaInput.value = nama;
            suggestionsContainer.innerHTML = '';
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
    if (!disiplinData.nisn_siswa || !disiplinData.id_pelanggaran) {
        return showStatusMessage('Harap pilih siswa dan jenis pelanggaran.', 'error');
    }
    showLoading(true);
    // Gunakan supabaseClient
    const { error } = await supabaseClient.from('catatan_disiplin').insert(disiplinData);
    showLoading(false);
    if (error) return showStatusMessage(`Gagal menyimpan: ${error.message}`, 'error');
    showStatusMessage('Catatan disiplin berhasil disimpan!', 'success');
    event.target.reset();
    document.getElementById('namaSiswaDisiplin').value = '';
}

async function loadRiwayatDisiplin() {
    const tableBody = document.getElementById('riwayatDisiplinTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="7">Memuat riwayat...</td></tr>';

    showLoading(true);
    // Gunakan supabaseClient
    const { data, error } = await supabaseClient
        .from('catatan_disiplin')
        .select(`
            id,
            created_at,
            siswa (nisn, nama),
            pelanggaran_master (deskripsi, poin),
            profiles (full_name)
        `)
        .order('created_at', { ascending: false });
    
    showLoading(false);

    if (error) {
        tableBody.innerHTML = '<tr><td colspan="7">Gagal memuat riwayat.</td></tr>';
        return showStatusMessage('Gagal memuat data riwayat disiplin.', 'error');
    }

    AppState.allDisiplinHistory = data;
    renderRiwayatDisiplinTable(data);
}

function renderRiwayatDisiplinTable(data) {
    const tableBody = document.getElementById('riwayatDisiplinTableBody');
    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Tidak ada riwayat ditemukan sesuai filter.</td></tr>';
        return;
    }

    tableBody.innerHTML = data.map(d => `
        <tr>
            <td data-label="Tanggal">${new Date(d.created_at).toLocaleDateString('id-ID')}</td>
            <td data-label="NISN">${d.siswa?.nisn || 'N/A'}</td>
            <td data-label="Nama Siswa">${d.siswa?.nama || 'Siswa Dihapus'}</td>
            <td data-label="Pelanggaran">${d.pelanggaran_master?.deskripsi || 'Pelanggaran Dihapus'}</td>
            <td data-label="Poin">${d.pelanggaran_master?.poin || 'N/A'}</td>
            <td data-label="Pencatat">${d.profiles?.full_name || 'Pengguna Dihapus'}</td>
            <td data-label="Aksi">
                <button class="btn btn-sm btn-secondary" onclick="editDisiplinHandler('${d.id}')">Ubah</button>
            </td>
        </tr>
    `).join('');
}

function applyRiwayatDisiplinFilter() {
    const filterNisn = document.getElementById('riwayatDisiplinFilterNisn').value.trim();
    const filterMulai = document.getElementById('riwayatDisiplinFilterTanggalMulai').value;
    const filterSelesai = document.getElementById('riwayatDisiplinFilterTanggalSelesai').value;

    AppState.filteredDisiplinHistory = AppState.allDisiplinHistory.filter(catatan => {
        const tanggalCatatan = new Date(catatan.created_at);
        const mulai = filterMulai ? new Date(filterMulai) : null;
        const selesai = filterSelesai ? new Date(filterSelesai) : null;
        if(mulai) mulai.setHours(0, 0, 0, 0);
        if(selesai) selesai.setHours(23, 59, 59, 999);
        
        const isNisnMatch = !filterNisn || (catatan.siswa && catatan.siswa.nisn.includes(filterNisn));
        const isTanggalMatch = (!mulai || tanggalCatatan >= mulai) && (!selesai || tanggalCatatan <= selesai);

        return isNisnMatch && isTanggalMatch;
    });

    renderRiwayatDisiplinTable(AppState.filteredDisiplinHistory);
}

async function editDisiplinHandler(catatanId) {
    showStatusMessage('Fitur "Ubah Catatan Disiplin" sedang dalam pengembangan.', 'info');
    console.log(`Edit diminta untuk Catatan Disiplin ID: ${catatanId}`);
}


// --- 4.4 Fungsi Modul Admin (Penugasan & Pengguna) ---
async function handlePenugasanSubmit(event) {
    event.preventDefault();
    const penugasanData = {
        guru_id: document.getElementById('penugasanGuru').value,
        kelas: document.getElementById('penugasanKelas').value.trim(),
        mata_pelajaran: document.getElementById('penugasanMapel').value.trim()
    };
    showLoading(true);
    // Gunakan supabaseClient
    const { error } = await supabaseClient.from('penugasan_guru').insert(penugasanData);
    showLoading(false);
    if (error) return showStatusMessage(`Gagal menyimpan: ${error.message}`, 'error');
    showStatusMessage('Penugasan berhasil disimpan!', 'success');
    event.target.reset();
    const { data } = await supabaseClient.from('penugasan_guru').select('*, profiles(full_name)');
    if(data) AppState.allAssignments = data;
    loadPenugasanTable();
}

function loadPenugasanTable() {
    const tableBody = document.getElementById('penugasanTableBody');
    if(!tableBody) return;
    
    if (AppState.allAssignments.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Belum ada data penugasan.</td></tr>';
        return;
    }

    tableBody.innerHTML = AppState.allAssignments.map(a => `
        <tr>
            <td data-label="Guru">${a.profiles ? a.profiles.full_name : 'Guru Dihapus'}</td>
            <td data-label="Kelas">${a.kelas}</td>
            <td data-label="Mapel">${a.mata_pelajaran}</td>
            <td data-label="Aksi"><button class="btn btn-sm btn-danger" onclick="deletePenugasan('${a.id}')">Hapus</button></td>
        </tr>
    `).join('');
}

async function deletePenugasan(id) {
    if (!confirm('Yakin ingin menghapus penugasan ini?')) return;
    showLoading(true);
    // Gunakan supabaseClient
    const { error } = await supabaseClient.from('penugasan_guru').delete().eq('id', id);
    showLoading(false);
    if (error) return showStatusMessage(`Gagal menghapus: ${error.message}`, 'error');
    showStatusMessage('Penugasan berhasil dihapus.', 'success');
    const { data } = await supabaseClient.from('penugasan_guru').select('*, profiles(full_name)');
    if(data) AppState.allAssignments = data;
    loadPenugasanTable();
}

async function handlePenggunaSubmit(event) {
    event.preventDefault();
    const userIdToUpdate = document.getElementById('formUserIdToUpdate').value;

    if (userIdToUpdate) {
        // --- LOGIKA UPDATE ---
        const updates = {
            email: document.getElementById('formEmailPengguna').value,
            data: {
                full_name: document.getElementById('formNamaPengguna').value,
                role: document.getElementById('formPeran').value,
            },
        };
        const password = document.getElementById('formPasswordPengguna').value;
        if (password) {
            if (password.length < 6) return showStatusMessage('Password baru minimal 6 karakter.', 'error');
            updates.password = password;
        }

        showLoading(true);
        // Gunakan supabaseClient
        const { data: { user }, error } = await supabaseClient.auth.admin.updateUserById(userIdToUpdate, updates);
        showLoading(false);

        if (error) return showStatusMessage(`Gagal update pengguna: ${error.message}`, 'error');
        showStatusMessage('Data pengguna berhasil diperbarui.', 'success');
    } else {
        // --- LOGIKA CREATE ---
        const nama = document.getElementById('formNamaPengguna').value;
        const email = document.getElementById('formEmailPengguna').value;
        const password = document.getElementById('formPasswordPengguna').value;
        const role = document.getElementById('formPeran').value;
        
        showLoading(true);
        // Gunakan supabaseClient
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: nama,
                    role: role
                }
            }
        });
        showLoading(false);

        if (error) return showStatusMessage(`Gagal membuat pengguna: ${error.message}`, 'error');
        if (data.user) showStatusMessage(`Pengguna ${email} berhasil dibuat!`, 'success');
    }

    resetPenggunaForm();
    loadUsersTable();
}

async function loadUsersTable() {
    const tableBody = document.getElementById('penggunaTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="4">Memuat data pengguna...</td></tr>';
    showLoading(true);

    // Gunakan supabaseClient
    const { data, error } = await supabaseClient.rpc('get_all_users');
    showLoading(false);

    if (error) {
        tableBody.innerHTML = '<tr><td colspan="4">Gagal memuat pengguna. Anda mungkin bukan Admin.</td></tr>';
        return showStatusMessage(`Error: ${error.message}`, 'error');
    }
    renderUsersTable(data);
}

function renderUsersTable(users) {
    const tableBody = document.getElementById('penggunaTableBody');
    const currentUserId = AppState.user.id; 

    if (!users || users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Belum ada pengguna terdaftar.</td></tr>';
        return;
    }

    tableBody.innerHTML = users.map(user => {
        const isCurrentUser = user.id === currentUserId;
        const disabledAttr = isCurrentUser ? 'disabled' : '';
        const escapedFullName = user.full_name ? user.full_name.replace(/'/g, "\\'") : '';
        const escapedEmail = user.email.replace(/'/g, "\\'");

        return `
            <tr>
                <td data-label="Nama">${user.full_name || 'N/A'}</td>
                <td data-label="Email">${user.email}</td>
                <td data-label="Peran">${user.role}</td>
                <td data-label="Aksi">
                    <button class="btn btn-sm btn-secondary" onclick="editUserHandler('${user.id}', '${escapedFullName}', '${escapedEmail}', '${user.role}')" ${disabledAttr}>Ubah</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteUserHandler('${user.id}')" ${disabledAttr}>Hapus</button>
                </td>
            </tr>
        `;
    }).join('');
}

function editUserHandler(id, fullName, email, role) {
    document.getElementById('formUserIdToUpdate').value = id;
    document.getElementById('formNamaPengguna').value = fullName;
    document.getElementById('formEmailPengguna').value = email;
    document.getElementById('formPeran').value = role;
    
    const passwordInput = document.getElementById('formPasswordPengguna');
    passwordInput.placeholder = 'Isi hanya jika ingin mengubah password';
    passwordInput.required = false;

    document.getElementById('submitPenggunaButton').textContent = 'Update Pengguna';
    document.getElementById('penggunaSection').scrollIntoView({ behavior: 'smooth' });
}

async function deleteUserHandler(userId) {
    if (!confirm('Apakah Anda yakin ingin menghapus pengguna ini? Tindakan ini tidak dapat dibatalkan.')) return;
    
    showLoading(true);
    // Gunakan supabaseClient
    const { data, error } = await supabaseClient.auth.admin.deleteUser(userId);
    showLoading(false);

    if (error) {
        return showStatusMessage(`Gagal menghapus pengguna: ${error.message}`, 'error');
    }

    showStatusMessage('Pengguna berhasil dihapus.', 'success');
    loadUsersTable();
}

function resetPenggunaForm() {
    document.getElementById('formPengguna').reset();
    document.getElementById('formUserIdToUpdate').value = '';
    
    const passwordInput = document.getElementById('formPasswordPengguna');
    passwordInput.placeholder = 'Minimal 6 karakter';
    passwordInput.required = true;
    
    document.getElementById('submitPenggunaButton').textContent = 'Buat Pengguna Baru';
}


// --- 4.5 Fungsi Modul Manajemen Siswa (Admin) ---
async function refreshSiswaData() {
    showLoading(true);
    // Gunakan supabaseClient
    const { data: updatedSiswa, error } = await supabaseClient.from('siswa').select('nisn, nama, kelas').order('nama');
    showLoading(false);
    
    if (error) {
        return showStatusMessage('Gagal memuat ulang data siswa.', 'error');
    }

    if (updatedSiswa) {
        AppState.students = updatedSiswa;
        loadSiswaTable();
        showStatusMessage('Data siswa berhasil dimuat ulang.', 'success');
    }
}

function exportSiswaToExcel() {
    if (AppState.students.length === 0) {
        return showStatusMessage('Tidak ada data siswa untuk diekspor.', 'info');
    }
    const worksheet = XLSX.utils.json_to_sheet(AppState.students);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Siswa");
    XLSX.writeFile(workbook, `Data_Siswa_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

async function handleSiswaImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoading(true);
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
            const dataToInsert = results.data.map(row => ({
                nisn: row.nisn || row.NISN,
                nama: row.nama || row.Nama,
                kelas: row.kelas || row.Kelas
            })).filter(s => s.nisn && s.nama && s.kelas); 

            if (dataToInsert.length === 0) {
                showLoading(false);
                return showStatusMessage('File CSV tidak berisi data yang valid. Pastikan header adalah: nisn, nama, kelas.', 'error');
            }

            // Gunakan supabaseClient
            const { error } = await supabaseClient.from('siswa').upsert(dataToInsert, { onConflict: 'nisn' });
            
            showLoading(false);
            if (error) { return showStatusMessage(`Gagal mengimpor data: ${error.message}`, 'error'); }
            showStatusMessage(`${dataToInsert.length} data siswa berhasil diimpor/diperbarui!`, 'success');
            await refreshSiswaData();
        },
        error: function(err) {
            showLoading(false);
            showStatusMessage(`Gagal membaca file CSV: ${err.message}`, 'error');
        }
    });
    event.target.value = '';
}

function loadSiswaTable() {
    const tableBody = document.getElementById('siswaResultsTableBody');
    if (!tableBody) return;
    const siswaData = AppState.students;
    
    tableBody.innerHTML = siswaData.length === 0 
        ? '<tr><td colspan="4" style="text-align: center;">Belum ada data siswa.</td></tr>'
        : siswaData.map(s => `
            <tr>
                <td data-label="NISN">${s.nisn}</td>
                <td data-label="Nama">${s.nama}</td>
                <td data-label="Kelas">${s.kelas}</td>
                <td data-label="Aksi">
                    <button class="btn btn-sm btn-secondary" onclick="editSiswaHandler('${s.nisn}')">Ubah</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteSiswaHandler('${s.nisn}')">Hapus</button>
                </td>
            </tr>
        `).join('');
}

async function saveSiswaHandler(event) {
    event.preventDefault();
    const oldNisn = document.getElementById('formNisnOld').value;
    const siswaData = {
        nisn: document.getElementById('formNisn').value.trim(),
        nama: document.getElementById('formNama').value.trim(),
        kelas: document.getElementById('formKelas').value.trim(),
    };
    if (!siswaData.nisn || !siswaData.nama || !siswaData.kelas) {
        return showStatusMessage('Semua kolom siswa wajib diisi.', 'error');
    }
    showLoading(true);
    let error;
    if (oldNisn) {
        // Gunakan supabaseClient
        const { error: updateError } = await supabaseClient.from('siswa').update( siswaData).eq('nisn', oldNisn);
        error = updateError;
    } else {
        // Gunakan supabaseClient
        const { error: insertError } = await supabaseClient.from('siswa').insert(siswaData);
        error = insertError;
    }
    showLoading(false);
    if (error) return showStatusMessage(`Gagal menyimpan data siswa: ${error.message}`, 'error');
    showStatusMessage(oldNisn ? 'Data siswa berhasil diperbarui.' : 'Siswa baru berhasil ditambahkan.', 'success');
    resetFormSiswa();
    await refreshSiswaData();
}

function editSiswaHandler(nisn) {
    const siswa = AppState.students.find(s => s.nisn === nisn);
    if (!siswa) return;
    
    document.getElementById('formNisn').value = siswa.nisn;
    document.getElementById('formNama').value = siswa.nama;
    document.getElementById('formKelas').value = siswa.kelas;
    document.getElementById('formNisnOld').value = siswa.nisn;
    document.getElementById('saveSiswaButton').textContent = 'Update Data Siswa';
    document.getElementById('formSiswa').scrollIntoView({ behavior: 'smooth' });
}

function resetFormSiswa() {
    document.getElementById('formSiswa').reset();
    document.getElementById('formNisnOld').value = '';
    document.getElementById('saveSiswaButton').textContent = 'Simpan Data Siswa';
}

async function deleteSiswaHandler(nisn) {
    if (!confirm(`Yakin ingin menghapus siswa dengan NISN: ${nisn}? Tindakan ini tidak dapat dibatalkan.`)) return;

    showLoading(true);
    // Gunakan supabaseClient
    const { error } = await supabaseClient.from('siswa').delete().eq('nisn', nisn);
    showLoading(false);
    if (error) return showStatusMessage(`Gagal menghapus siswa: ${error.message}`, 'error');

    showStatusMessage('Siswa berhasil dihapus.', 'success');
    AppState.students = AppState.students.filter(s => s.nisn !== nisn);
    loadSiswaTable();
}


// ====================================================================
// TAHAP 5: INISIALISASI DAN EVENT LISTENERS
// ====================================================================

function setupDashboardListeners() {
    document.getElementById('logoutButton')?.addEventListener('click', handleLogout);

    const navButtons = document.querySelectorAll('.sidebar-nav .btn-nav');
    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const sectionId = e.currentTarget.dataset.section;
            document.querySelectorAll('.dashboard-content .content-section').forEach(s => s.style.display = 'none');
            const activeSection = document.getElementById(sectionId);
            if (activeSection) activeSection.style.display = 'block';
            navButtons.forEach(btn => btn.classList.remove('active'));
            e.currentTarget.classList.add('active');

            if (sectionId === 'riwayatJurnalSection') loadRiwayatJurnal();
            if (sectionId === 'riwayatDisiplinSection') loadRiwayatDisiplin();
            if (sectionId === 'penugasanSection') loadPenugasanTable();
            if (sectionId === 'siswaSection') loadSiswaTable();
            if (sectionId === 'penggunaSection') loadUsersTable();
        });
    });

    // Event listeners untuk form
    document.getElementById('formJurnal')?.addEventListener('submit', handleJurnalSubmit);
    document.getElementById('formDisiplin')?.addEventListener('submit', handleDisiplinSubmit);
    document.getElementById('formPenugasan')?.addEventListener('submit', handlePenugasanSubmit);
    document.getElementById('formPengguna')?.addEventListener('submit', handlePenggunaSubmit);
    document.getElementById('formSiswa')?.addEventListener('submit', saveSiswaHandler);
    document.getElementById('resetSiswaButton')?.addEventListener('click', resetFormSiswa);
    document.getElementById('resetPenggunaButton')?.addEventListener('click', resetPenggunaForm);
    
    // Event listeners untuk tombol aksi
    document.getElementById('refreshSiswaButton')?.addEventListener('click', refreshSiswaData);
    document.getElementById('exportSiswaButton')?.addEventListener('click', exportSiswaToExcel);
    document.getElementById('importSiswaButton')?.addEventListener('click', () => {
        document.getElementById('importSiswaInput').click();
    });
    document.getElementById('importSiswaInput')?.addEventListener('change', handleSiswaImport);
    document.getElementById('loadSiswaForJurnalButton')?.addEventListener('click', loadSiswaForJurnal);
    document.getElementById('filterRiwayatButton')?.addEventListener('click', applyRiwayatFilter);
    document.getElementById('refreshRiwayatButton')?.addEventListener('click', loadRiwayatJurnal);
    document.getElementById('exportRiwayatButton')?.addEventListener('click', exportRiwayatToExcel);
    document.getElementById('filterRiwayatDisiplinButton')?.addEventListener('click', applyRiwayatDisiplinFilter);
    document.getElementById('refreshRiwayatDisiplinButton')?.addEventListener('click', loadRiwayatDisiplin);
    
    setupSiswaSearch();
}

async function initDashboardPage() {
    console.log("Inisialisasi Dashboard...");
    await checkAuthenticationAndSetup();
    if (AppState.user) {
        await checkUserRoleAndSetupUI();
        await loadInitialData();
        populateInitialDropdowns();
        setupDashboardListeners();
        // Secara otomatis klik tombol navigasi pertama
        document.querySelector('.sidebar-nav .btn-nav')?.click();
    }
}

// --- Titik Masuk Aplikasi ---
document.addEventListener('DOMContentLoaded', () => {
    // Pastikan kita berada di halaman dashboard sebelum menjalankan inisialisasi
    if (document.querySelector('.dashboard-wrapper')) {
        initDashboardPage();
    }
});
