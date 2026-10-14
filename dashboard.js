/**
 * =================================================================
 * SCRIPT UTAMA DASHBOARD ADMIN - SISTEM JURNAL & DISIPLIN SMANEMA
 * =================================================================
 * @version 8.0 - Full Admin Management Tools (Unduh Template, Import CSV,
 *                Export Excel & Refresh Data di Seluruh Menu Admin)
 */

// ====================================================================
// TAHAP 1: KONFIGURASI GLOBAL DAN STATE APLIKASI
// ====================================================================

const SUPABASE_URL = 'https://pbfhvyqhshuvyakjfpka.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZmh2eXFoc2h1dnlha2pmcGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MTY1NTksImV4cCI6MjEwNjk5MjU1OX0.RMDKCmkniLHoCgxsFr0noBlbB4DoqH1CTZc4lRtnPNg';

if (typeof window.supabase === 'undefined') {
    alert("Error: Library Supabase tidak terdeteksi. Pastikan internet lancar atau CDN tidak memblokir.");
}

const { createClient } = window.supabase;
var supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const AppState = {
    user: null,
    profile: null,
    assignments: [],
    students: [],
    violations: [],
    teachers: [],
    allUsers: [],
    allAssignments: [],
    allWaliKelas: [],        
    allPiket: [],            
    allJurnalHistory: [],
    filteredJurnalHistory: [],
    allDisiplinHistory: [],
    filteredDisiplinHistory: []
};

// ====================================================================
// TAHAP 2: FUNGSI-FUNGSI PEMBANTU (HELPERS) & SMART UPSERT
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

function ensureSelectOption(selectElementId, value, text) {
    const select = document.getElementById(selectElementId);
    if (!select || !value) return;
    const exists = Array.from(select.options).some(opt => opt.value === String(value));
    if (!exists) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = text || value;
        select.appendChild(opt);
    }
    select.value = value;
}

function switchSection(sectionId) {
    document.querySelectorAll('.dashboard-content .content-section').forEach(s => {
        s.style.display = 'none';
    });
    const targetSection = document.getElementById(sectionId);
    if (targetSection) targetSection.style.display = 'block';

    document.querySelectorAll('.sidebar-nav .btn-nav').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === sectionId);
    });
}

/**
 * Helper Universal untuk Mengunduh File Template CSV
 */
function downloadCSVFile(filename, csvContent) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showStatusMessage(`Template ${filename} berhasil diunduh.`, 'success');
}

/**
 * Helper Universal untuk Mengekspor Array JSON ke File Excel (.xlsx)
 */
function exportJSONToExcel(dataArray, sheetName, filePrefix) {
    if (!dataArray || dataArray.length === 0) {
        return showStatusMessage(`Tidak ada data ${sheetName} untuk diekspor.`, 'info');
    }
    const worksheet = XLSX.utils.json_to_sheet(dataArray);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${filePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Helper Pencari ID Guru berdasarkan Nama Lengkap atau Email (Case-Insensitive)
 */
function findTeacherIdByNameOrEmail(identifier) {
    if (!identifier) return null;
    const clean = String(identifier).trim().toLowerCase();

    // 1. Cari di daftar guru (AppState.teachers)
    const fromTeachers = AppState.teachers.find(
        t => (t.full_name && t.full_name.trim().toLowerCase() === clean) || String(t.id).toLowerCase() === clean
    );
    if (fromTeachers) return fromTeachers.id;

    // 2. Cari di daftar seluruh pengguna (AppState.allUsers) berdasarkan nama atau email
    const fromAllUsers = AppState.allUsers.find(
        u => (u.full_name && u.full_name.trim().toLowerCase() === clean) ||
             (u.email && u.email.trim().toLowerCase() === clean) ||
             String(u.id).toLowerCase() === clean
    );
    if (fromAllUsers) return fromAllUsers.id;

    return null;
}

/**
 * Fungsi Smart Upsert: Mengecek apakah data dengan kolom kunci tertentu sudah ada.
 * Jika sudah ada -> otomatis timpa (UPDATE). Jika belum ada -> tambah baru (INSERT).
 */
async function smartUpsert(tableName, payload, matchColumns, pkColumn = 'id') {
    let checkQuery = supabaseClient.from(tableName).select(pkColumn);
    
    matchColumns.forEach(col => {
        checkQuery = checkQuery.eq(col, payload[col]);
    });

    const { data: existingRows, error: checkError } = await checkQuery;
    if (checkError) return { error: checkError, action: null };

    if (existingRows && existingRows.length > 0) {
        const targetId = existingRows[0][pkColumn];
        const { data, error: updateError } = await supabaseClient
            .from(tableName)
            .update(payload)
            .eq(pkColumn, targetId)
            .select();
        return { data, error: updateError, action: 'updated' };
    } else {
        const { data, error: insertError } = await supabaseClient
            .from(tableName)
            .insert(payload)
            .select();
        return { data, error: insertError, action: 'inserted' };
    }
}

function parseDateValue(dateStr) {
    if (!dateStr) return 0;
    const cleanStr = dateStr.trim();
    const parts = cleanStr.split('/');
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day).getTime() || 0;
    }
    return new Date(cleanStr).getTime() || 0;
}

function initSortableTables() {
    const urutanHari = {
        'senin': 1, 'selasa': 2, 'rabu': 3,
        'kamis': 4, 'jumat': 5, 'sabtu': 6, 'minggu': 7
    };

    document.querySelectorAll('th.sortable').forEach(headerCell => {
        headerCell.addEventListener('click', () => {
            const table = headerCell.closest('table');
            const tbody = table.querySelector('tbody');
            if (!tbody) return;

            const columnIndex = Array.from(headerCell.parentElement.children).indexOf(headerCell);
            const dataType = headerCell.dataset.type || 'text';
            const isAscending = !headerCell.classList.contains('asc');

            const rows = Array.from(tbody.querySelectorAll('tr')).filter(row => {
                return row.children.length > 1 && !row.querySelector('td[colspan]');
            });

            if (rows.length <= 1) return;

            table.querySelectorAll('th.sortable').forEach(th => th.classList.remove('asc', 'desc'));
            headerCell.classList.toggle('asc', isAscending);
            headerCell.classList.toggle('desc', !isAscending);

            rows.sort((rowA, rowB) => {
                const cellElA = rowA.children[columnIndex];
                const cellElB = rowB.children[columnIndex];

                const rawA = cellElA?.dataset.sort || cellElA?.innerText.trim() || '';
                const rawB = cellElB?.dataset.sort || cellElB?.innerText.trim() || '';

                let comparison = 0;

                if (dataType === 'number') {
                    const numA = parseFloat(rawA.replace(/[^0-9.-]+/g, '')) || 0;
                    const numB = parseFloat(rawB.replace(/[^0-9.-]+/g, '')) || 0;
                    comparison = numA - numB;
                } else if (dataType === 'date') {
                    comparison = parseDateValue(rawA) - parseDateValue(rawB);
                } else if (dataType === 'day') {
                    const dayA = urutanHari[rawA.toLowerCase()] || 99;
                    const dayB = urutanHari[rawB.toLowerCase()] || 99;
                    comparison = dayA - dayB;
                } else {
                    comparison = rawA.localeCompare(rawB, 'id', { numeric: true, sensitivity: 'base' });
                }

                return isAscending ? comparison : -comparison;
            });

            tbody.append(...rows);
        });
    });
}

// ====================================================================
// TAHAP 3: FUNGSI OTENTIKASI & MANAJEMEN SESI
// ====================================================================

async function checkAuthenticationAndSetup() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        window.location.replace('index.html');
        return;
    }
    
    AppState.user = session.user;
    
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
        const welcomeEl = document.getElementById('welcomeMessage');
        if(welcomeEl) welcomeEl.textContent = `Selamat Datang, ${session.user.email}!`;
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
// TAHAP 4: FUNGSI UTAMA APLIKASI
// ====================================================================

async function checkUserRoleAndSetupUI() {
    if (!AppState.profile) return;
    const adminElements = document.querySelectorAll('.admin-only');
    
    if (AppState.profile.role !== 'Admin') {
        adminElements.forEach(el => el.style.display = 'none');
    } else {
        adminElements.forEach(el => {
            if (el.tagName === 'DIV') {
                el.style.display = 'block';
            } else if (el.tagName === 'BUTTON') {
                el.style.display = 'inline-flex';
            } else {
                el.style.display = 'inline-block';
            }
        });
    }
}

async function loadInitialData() {
    showLoading(true);
    
    const promises = [
        supabaseClient.from('penugasan_guru').select('kelas, mata_pelajaran').eq('guru_id', AppState.user.id),
        supabaseClient.from('siswa').select('nisn, nama, kelas').order('nama'),
        supabaseClient.from('pelanggaran_master').select('id, deskripsi, poin').order('deskripsi')
    ];

    if (AppState.profile.role === 'Admin') {
        promises.push(supabaseClient.from('profiles').select('id, full_name').in('role', ['Guru', 'Wali Kelas']).order('full_name'));
        promises.push(supabaseClient.from('penugasan_guru').select('*, profiles(full_name)').order('kelas'));
        promises.push(supabaseClient.from('wali_kelas').select('*, profiles(full_name)').order('kelas'));
        promises.push(supabaseClient.from('jadwal_piket').select('*').order('hari'));
        promises.push(supabaseClient.from('pengaturan').select('*'));
    } else {
        promises.push(Promise.resolve({ data: [] }));
        promises.push(Promise.resolve({ data: [] }));
        promises.push(Promise.resolve({ data: [] }));
        promises.push(Promise.resolve({ data: [] }));
        promises.push(Promise.resolve({ data: [] }));
    }

    const [assignments, students, violations, teachers, allAssignments, walis, piket, pengaturan] = await Promise.all(promises);
    
    if (assignments.data) AppState.assignments = assignments.data;
    if (students.data) AppState.students = students.data;
    if (violations.data) AppState.violations = violations.data;
    
    if (AppState.profile.role === 'Admin') {
        if (teachers.data) AppState.teachers = teachers.data;
        if (allAssignments.data) AppState.allAssignments = allAssignments.data;
        if (walis.data) AppState.allWaliKelas = walis.data;
        if (piket.data) AppState.allPiket = piket.data;
        
        if (pengaturan.data) {
            const waPiket = pengaturan.data.find(p => p.kunci === 'nomor_wa_piket');
            if (waPiket && document.getElementById('pengaturanWaPiket')) {
                document.getElementById('pengaturanWaPiket').value = waPiket.nilai;
            }
        }
        
        loadPenugasanTable();
        loadWaliKelasTable();
        loadPiketTable();
        loadSiswaTable();
        loadUsersTable();
    }

    showLoading(false);
}

function populateInitialDropdowns() {
    populateDropdown('jurnalKelas', AppState.assignments, 'kelas', 'kelas', 'Pilih Kelas');
    populateDropdown('jurnalMapel', AppState.assignments, 'mata_pelajaran', 'mata_pelajaran', 'Pilih Mata Pelajaran');
    populateDropdown('deskripsiDisiplinInput', AppState.violations, 'id', 'deskripsi', 'Pilih Pelanggaran');
    
    if (AppState.profile && AppState.profile.role === 'Admin') {
        populateDropdown('penugasanGuru', AppState.teachers, 'id', 'full_name', 'Pilih Guru');
        populateDropdown('waliKelasGuru', AppState.teachers, 'id', 'full_name', 'Pilih Guru/Wali');
    }
}

// ====================================================================
// MODUL JURNAL PEMBELAJARAN (INPUT, EDIT, RIWAYAT, HAPUS)
// ====================================================================

async function loadSiswaForJurnal() {
    const kelas = document.getElementById('jurnalKelas').value;
    const mapel = document.getElementById('jurnalMapel').value;
    const tableBody = document.getElementById('presensiTableBody');

    if (!kelas || !mapel) return showStatusMessage('Harap pilih Kelas dan Mata Pelajaran terlebih dahulu.', 'error');

    showLoading(true);
    tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center;">Memuat data siswa...</td></tr>`;

    const { data, error } = await supabaseClient.from('siswa').select('nisn, nama').eq('kelas', kelas).order('nama');

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

function resetJurnalForm() {
    const form = document.getElementById('formJurnal');
    if (form) form.reset();

    const idInput = document.getElementById('jurnalIdToUpdate');
    if (idInput) idInput.value = '';

    populateInitialDropdowns();

    const submitBtn = document.getElementById('submitJurnalButton');
    if (submitBtn) submitBtn.textContent = 'Simpan Jurnal & Presensi';

    const cancelBtn = document.getElementById('cancelJurnalEditButton');
    if (cancelBtn) cancelBtn.style.display = 'none';

    const tableBody = document.getElementById('presensiTableBody');
    if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center;">Pilih kelas dan mata pelajaran, lalu klik "Tampilkan Siswa".</td></tr>`;
    }
}

async function handleJurnalSubmit(event) {
    event.preventDefault();

    const jurnalIdToUpdate = document.getElementById('jurnalIdToUpdate')?.value;
    const jurnalData = {
        guru_id: AppState.user.id,
        kelas: document.getElementById('jurnalKelas').value,
        mata_pelajaran: document.getElementById('jurnalMapel').value,
        tanggal: document.getElementById('jurnalTanggal').value,
        materi: document.getElementById('jurnalMateri').value.trim(),
        catatan: document.getElementById('jurnalCatatan').value.trim(),
    };

    if (jurnalIdToUpdate) {
        const originalJurnal = AppState.allJurnalHistory.find(j => String(j.id) === String(jurnalIdToUpdate));
        if (originalJurnal && originalJurnal.guru_id) {
            jurnalData.guru_id = originalJurnal.guru_id;
        }
    }

    if (!jurnalData.kelas || !jurnalData.mata_pelajaran || !jurnalData.tanggal || !jurnalData.materi) {
        return showStatusMessage('Harap isi semua kolom jurnal yang wajib diisi.', 'error');
    }

    const presensiRows = document.querySelectorAll('#presensiTableBody tr');
    const siswaTidakHadir = [];

    presensiRows.forEach(row => {
        if (row.dataset.nisn) { 
            const status = row.querySelector('.kehadiran-status').value;
            if (status !== 'Hadir') {
                siswaTidakHadir.push({ nama: row.dataset.nama, status: status });
            }
        }
    });

    let catatanPresensi = "";
    if (siswaTidakHadir.length > 0) {
        catatanPresensi += "\n\n--- PRESENSI TIDAK HADIR ---\n";
        catatanPresensi += siswaTidakHadir.map(s => `${s.nama} (${s.status})`).join('\n');
    }
    
    if (jurnalData.catatan && siswaTidakHadir.length > 0) jurnalData.catatan += " "; 
    jurnalData.catatan += catatanPresensi;

    const siswaDiKelas = AppState.students.filter(s => s.kelas === jurnalData.kelas);
    if (!jurnalIdToUpdate && siswaDiKelas.length > 0 && presensiRows[0]?.cells?.[0]?.textContent.includes('Pilih kelas')) {
         return showStatusMessage('Harap klik "Tampilkan Siswa untuk Presensi" terlebih dahulu.', 'error');
    }

    showLoading(true);
    let error = null;
    let action = 'inserted';

    if (jurnalIdToUpdate) {
        const res = await supabaseClient.from('jurnal_pelajaran').update(jurnalData).eq('id', jurnalIdToUpdate);
        error = res.error;
        action = 'updated';
    } else {
        const res = await smartUpsert('jurnal_pelajaran', jurnalData, ['guru_id', 'kelas', 'mata_pelajaran', 'tanggal']);
        error = res.error;
        action = res.action;
    }
    showLoading(false);
    
    if (error) return showStatusMessage(`Gagal menyimpan jurnal: ${error.message}`, 'error');
    
    showStatusMessage(
        action === 'updated' ? 'Data Jurnal & Presensi berhasil diperbarui!' : 'Jurnal & presensi berhasil disimpan!',
        'success'
    );
    resetJurnalForm();
}

window.editJurnalHandler = async function(jurnalId) {
    const jurnal = AppState.allJurnalHistory.find(j => String(j.id) === String(jurnalId));
    if (!jurnal) return showStatusMessage('Data jurnal tidak ditemukan.', 'error');

    switchSection('jurnalSection');

    const idInput = document.getElementById('jurnalIdToUpdate');
    if (idInput) idInput.value = jurnal.id;

    ensureSelectOption('jurnalKelas', jurnal.kelas, jurnal.kelas);
    ensureSelectOption('jurnalMapel', jurnal.mata_pelajaran, jurnal.mata_pelajaran);

    const formattedDate = jurnal.tanggal ? String(jurnal.tanggal).slice(0, 10) : '';
    document.getElementById('jurnalTanggal').value = formattedDate;
    document.getElementById('jurnalMateri').value = jurnal.materi || '';

    const marker = '--- PRESENSI TIDAK HADIR ---';
    let catatanMurni = jurnal.catatan || '';
    const presensiTidakHadirMap = {};

    if (catatanMurni.includes(marker)) {
        const parts = catatanMurni.split(marker);
        catatanMurni = parts[0].trim();
        const lines = (parts[1] || '').trim().split('\n');
        lines.forEach(line => {
            const match = line.trim().match(/^(.*)\s+\((Hadir|Sakit|Izin|Alfa)\)$/i);
            if (match) {
                const namaSiswaKey = match[1].trim().toLowerCase();
                const statusKehadiran = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();
                presensiTidakHadirMap[namaSiswaKey] = statusKehadiran;
            }
        });
    }
    document.getElementById('jurnalCatatan').value = catatanMurni;

    await loadSiswaForJurnal();
    document.querySelectorAll('#presensiTableBody tr').forEach(row => {
        const namaSiswa = (row.dataset.nama || '').trim().toLowerCase();
        const selectStatus = row.querySelector('.kehadiran-status');
        if (selectStatus && namaSiswa && presensiTidakHadirMap[namaSiswa]) {
            selectStatus.value = presensiTidakHadirMap[namaSiswa];
        }
    });

    const submitBtn = document.getElementById('submitJurnalButton');
    if (submitBtn) {
        submitBtn.textContent = 'Update Jurnal & Presensi';
        let cancelBtn = document.getElementById('cancelJurnalEditButton');
        if (!cancelBtn) {
            cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.id = 'cancelJurnalEditButton';
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.style.marginLeft = '8px';
            cancelBtn.textContent = 'Batal Ubah';
            cancelBtn.addEventListener('click', resetJurnalForm);
            submitBtn.parentElement.appendChild(cancelBtn);
        }
        cancelBtn.style.display = 'inline-block';
    }

    document.getElementById('jurnalSection')?.scrollIntoView({ behavior: 'smooth' });
    showStatusMessage('Mode Ubah Jurnal aktif. Silakan perbarui data lalu klik "Update Jurnal & Presensi".', 'info');
};

window.deleteJurnalHandler = async function(jurnalId) {
    if (!confirm('Apakah Anda yakin ingin menghapus data jurnal pembelajaran ini?')) return;
    showLoading(true);
    const { error } = await supabaseClient.from('jurnal_pelajaran').delete().eq('id', jurnalId);
    showLoading(false);

    if (error) return showStatusMessage(`Gagal menghapus jurnal: ${error.message}`, 'error');
    showStatusMessage('Data jurnal berhasil dihapus.', 'success');
    await loadRiwayatJurnal();
};

async function loadRiwayatJurnal() {
    const tableBody = document.getElementById('riwayatJurnalTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Memuat riwayat...</td></tr>';
    
    showLoading(true);
    let query = supabaseClient.from('jurnal_pelajaran').select('*').order('tanggal', { ascending: false });
    if (AppState.profile.role !== 'Admin') {
        query = query.eq('guru_id', AppState.user.id);
    }

    const { data, error } = await query;
    showLoading(false);

    if (error) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Gagal memuat riwayat.</td></tr>';
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
    const exportBtn = document.getElementById('exportRiwayatButton');
    if(exportBtn) exportBtn.style.display = data.length > 0 ? 'inline-block' : 'none';

    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Tidak ada riwayat ditemukan sesuai filter.</td></tr>';
        return;
    }

    tableBody.innerHTML = data.map(j => {
        const catatanRingkas = (j.catatan || '').replace(/\n/g, ' ').substring(0, 70);
        return `
            <tr>
                <td data-label="Tanggal" data-sort="${j.tanggal}">${new Date(j.tanggal).toLocaleDateString('id-ID')}</td>
                <td data-label="Kelas">${j.kelas}</td>
                <td data-label="Mapel">${j.mata_pelajaran}</td>
                <td data-label="Materi">${j.materi.substring(0, 50)}${j.materi.length > 50 ? '...' : ''}</td>
                <td data-label="Catatan">${catatanRingkas}${catatanRingkas.length >= 70 ? '...' : ''}</td>
                <td data-label="Aksi" style="text-align: right; white-space: nowrap;">
                    <button class="btn btn-sm btn-secondary" onclick="editJurnalHandler('${j.id}')">Ubah</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteJurnalHandler('${j.id}')">Hapus</button>
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
    if (dataToExport.length === 0) return showStatusMessage('Tidak ada data untuk diekspor.', 'info');

    const formattedData = dataToExport.map(j => ({
        Tanggal: new Date(j.tanggal).toLocaleDateString('id-ID'),
        Kelas: j.kelas,
        'Mata Pelajaran': j.mata_pelajaran,
        Materi: j.materi,
        Catatan: j.catatan
    }));

    exportJSONToExcel(formattedData, "Riwayat Jurnal", "Riwayat_Jurnal");
}

// ====================================================================
// MODUL DISIPLIN SISWA (INPUT, EDIT, RIWAYAT, HAPUS)
// ====================================================================

function setupSiswaSearch() {
    const searchInput = document.getElementById('nisnDisiplinInput');
    const suggestionsContainer = document.getElementById('nisnSuggestions');
    const namaSiswaInput = document.getElementById('namaSiswaDisiplin');

    if (!searchInput) return;

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        suggestionsContainer.style.display = 'block';
        if (query.length < 2) { suggestionsContainer.innerHTML = ''; return; }
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
            searchInput.value = e.target.dataset.nisn;
            namaSiswaInput.value = e.target.dataset.nama;
            suggestionsContainer.innerHTML = '';
            suggestionsContainer.style.display = 'none';
        }
    });
}

function resetDisiplinForm() {
    const form = document.getElementById('formDisiplin');
    if (form) form.reset();

    const namaInput = document.getElementById('namaSiswaDisiplin');
    if (namaInput) namaInput.value = '';

    const idInput = document.getElementById('disiplinIdToUpdate');
    if (idInput) idInput.value = '';

    const submitBtn = document.getElementById('submitDisiplinButton');
    if (submitBtn) submitBtn.textContent = 'Simpan Catatan Disiplin';

    const cancelBtn = document.getElementById('cancelDisiplinEditButton');
    if (cancelBtn) cancelBtn.style.display = 'none';
}

async function handleDisiplinSubmit(event) {
    event.preventDefault();

    const disiplinIdToUpdate = document.getElementById('disiplinIdToUpdate')?.value;
    const disiplinData = {
        nisn_siswa: document.getElementById('nisnDisiplinInput').value.trim(),
        id_pelanggaran: document.getElementById('deskripsiDisiplinInput').value,
        pencatat_id: AppState.user.id
    };

    if (!disiplinData.nisn_siswa || !disiplinData.id_pelanggaran) {
        return showStatusMessage('Harap pilih siswa dan jenis pelanggaran.', 'error');
    }
    
    showLoading(true);
    let error = null;

    if (disiplinIdToUpdate) {
        const originalCatatan = AppState.allDisiplinHistory.find(d => String(d.id) === String(disiplinIdToUpdate));
        if (originalCatatan && originalCatatan.pencatat_id) {
            disiplinData.pencatat_id = originalCatatan.pencatat_id;
        }
        const res = await supabaseClient.from('catatan_disiplin').update(disiplinData).eq('id', disiplinIdToUpdate);
        error = res.error;
    } else {
        const res = await supabaseClient.from('catatan_disiplin').insert(disiplinData);
        error = res.error;
    }
    showLoading(false);
    
    if (error) return showStatusMessage(`Gagal menyimpan: ${error.message}`, 'error');
    showStatusMessage(
        disiplinIdToUpdate ? 'Catatan disiplin berhasil diperbarui!' : 'Catatan disiplin berhasil disimpan!',
        'success'
    );
    resetDisiplinForm();
}

window.editDisiplinHandler = function(catatanId) {
    const catatan = AppState.allDisiplinHistory.find(d => String(d.id) === String(catatanId));
    if (!catatan) return showStatusMessage('Data catatan disiplin tidak ditemukan.', 'error');

    switchSection('disiplinSection');

    const formDisiplin = document.getElementById('formDisiplin');
    let idInput = document.getElementById('disiplinIdToUpdate');
    if (!idInput && formDisiplin) {
        idInput = document.createElement('input');
        idInput.type = 'hidden';
        idInput.id = 'disiplinIdToUpdate';
        formDisiplin.prepend(idInput);
    }
    if (idInput) idInput.value = catatan.id;

    const nisn = catatan.nisn_siswa || catatan.siswa?.nisn || '';
    const nama = catatan.siswa?.nama || AppState.students.find(s => s.nisn === nisn)?.nama || '';
    document.getElementById('nisnDisiplinInput').value = nisn;
    document.getElementById('namaSiswaDisiplin').value = nama;

    const pelanggaranId =
        catatan.id_pelanggaran ||
        catatan.pelanggaran_master?.id ||
        AppState.violations.find(v => v.deskripsi === catatan.pelanggaran_master?.deskripsi)?.id ||
        '';
    document.getElementById('deskripsiDisiplinInput').value = pelanggaranId;

    const submitBtn = document.getElementById('submitDisiplinButton');
    if (submitBtn) {
        submitBtn.textContent = 'Update Catatan Disiplin';
        let cancelBtn = document.getElementById('cancelDisiplinEditButton');
        if (!cancelBtn) {
            cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.id = 'cancelDisiplinEditButton';
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.style.marginLeft = '8px';
            cancelBtn.textContent = 'Batal Ubah';
            cancelBtn.addEventListener('click', resetDisiplinForm);
            submitBtn.parentElement.appendChild(cancelBtn);
        }
        cancelBtn.style.display = 'inline-block';
    }

    document.getElementById('disiplinSection')?.scrollIntoView({ behavior: 'smooth' });
    showStatusMessage('Mode Ubah Catatan Disiplin aktif. Silakan perbarui data lalu klik "Update Catatan Disiplin".', 'info');
};

window.deleteDisiplinHandler = async function(catatanId) {
    if (!confirm('Apakah Anda yakin ingin menghapus catatan disiplin ini?')) return;
    showLoading(true);
    const { error } = await supabaseClient.from('catatan_disiplin').delete().eq('id', catatanId);
    showLoading(false);

    if (error) return showStatusMessage(`Gagal menghapus catatan disiplin: ${error.message}`, 'error');
    showStatusMessage('Catatan disiplin berhasil dihapus.', 'success');
    await loadRiwayatDisiplin();
};

async function loadRiwayatDisiplin() {
    const tableBody = document.getElementById('riwayatDisiplinTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Memuat riwayat...</td></tr>';

    showLoading(true);
    const { data, error } = await supabaseClient
        .from('catatan_disiplin')
        .select(`id, created_at, nisn_siswa, id_pelanggaran, pencatat_id, siswa (nisn, nama), pelanggaran_master (id, deskripsi, poin), profiles (full_name)`)
        .order('created_at', { ascending: false });
    showLoading(false);

    if (error) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Gagal memuat riwayat.</td></tr>';
        return showStatusMessage('Gagal memuat data riwayat disiplin.', 'error');
    }

    AppState.allDisiplinHistory = data;
    AppState.filteredDisiplinHistory = data;
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
            <td data-label="Tanggal" data-sort="${d.created_at}">${new Date(d.created_at).toLocaleDateString('id-ID')}</td>
            <td data-label="NISN">${d.siswa?.nisn || d.nisn_siswa || 'N/A'}</td>
            <td data-label="Nama Siswa">${d.siswa?.nama || 'Siswa Dihapus'}</td>
            <td data-label="Pelanggaran">${d.pelanggaran_master?.deskripsi || 'Pelanggaran Dihapus'}</td>
            <td data-label="Poin">${d.pelanggaran_master?.poin || 0}</td>
            <td data-label="Pencatat">${d.profiles?.full_name || 'Pengguna Dihapus'}</td>
            <td data-label="Aksi" style="text-align: right; white-space: nowrap;">
                <button class="btn btn-sm btn-secondary" onclick="editDisiplinHandler('${d.id}')">Ubah</button>
                <button class="btn btn-sm btn-danger" onclick="deleteDisiplinHandler('${d.id}')">Hapus</button>
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
        
        const nisnVal = catatan.siswa?.nisn || catatan.nisn_siswa || '';
        const isNisnMatch = !filterNisn || nisnVal.includes(filterNisn);
        const isTanggalMatch = (!mulai || tanggalCatatan >= mulai) && (!selesai || tanggalCatatan <= selesai);

        return isNisnMatch && isTanggalMatch;
    });

    renderRiwayatDisiplinTable(AppState.filteredDisiplinHistory);
}

// ====================================================================
// MODUL ADMIN 1: MANAJEMEN PENUGASAN GURU (CRUD, TEMPLATE, CSV, EXCEL, REFRESH)
// ====================================================================

async function handlePenugasanSubmit(event) {
    event.preventDefault();
    const penugasanData = {
        guru_id: document.getElementById('penugasanGuru').value,
        kelas: document.getElementById('penugasanKelas').value.trim(),
        mata_pelajaran: document.getElementById('penugasanMapel').value.trim()
    };
    showLoading(true);
    const { error, action } = await smartUpsert('penugasan_guru', penugasanData, ['kelas', 'mata_pelajaran']);
    showLoading(false);
    
    if (error) return showStatusMessage(`Gagal menyimpan: ${error.message}`, 'error');
    showStatusMessage(
        action === 'updated' ? 'Penugasan untuk kelas & mapel tersebut berhasil diperbarui (ditimpa)!' : 'Penugasan berhasil disimpan!',
        'success'
    );
    event.target.reset();
    await refreshPenugasanData(false);
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
            <td data-label="Aksi" style="text-align: right;"><button class="btn btn-sm btn-danger" onclick="deletePenugasan('${a.id}')">Hapus</button></td>
        </tr>
    `).join('');
}

window.deletePenugasan = async function(id) {
    if (!confirm('Yakin ingin menghapus penugasan ini?')) return;
    showLoading(true);
    const { error } = await supabaseClient.from('penugasan_guru').delete().eq('id', id);
    showLoading(false);
    
    if (error) return showStatusMessage(`Gagal menghapus: ${error.message}`, 'error');
    showStatusMessage('Penugasan berhasil dihapus.', 'success');
    await refreshPenugasanData(false);
};

function downloadTemplatePenugasan() {
    const contohGuru = AppState.teachers[0]?.full_name || "Budi Santoso, S.Pd";
    const csvContent = `Nama_Guru,Kelas,Mata_Pelajaran\n"${contohGuru}",X-A,Matematika\n"${contohGuru}",X-B,Fisika`;
    downloadCSVFile("Template_Import_Penugasan.csv", csvContent);
}

async function refreshPenugasanData(showToast = true) {
    showLoading(true);
    const [allRes, myRes, teachersRes] = await Promise.all([
        supabaseClient.from('penugasan_guru').select('*, profiles(full_name)').order('kelas'),
        supabaseClient.from('penugasan_guru').select('kelas, mata_pelajaran').eq('guru_id', AppState.user.id),
        supabaseClient.from('profiles').select('id, full_name').in('role', ['Guru', 'Wali Kelas']).order('full_name')
    ]);
    showLoading(false);

    if (allRes.error) return showStatusMessage('Gagal memuat ulang data penugasan.', 'error');
    if (allRes.data) AppState.allAssignments = allRes.data;
    if (myRes.data) AppState.assignments = myRes.data;
    if (teachersRes.data) AppState.teachers = teachersRes.data;

    loadPenugasanTable();
    populateInitialDropdowns();
    if (showToast) showStatusMessage('Data penugasan guru berhasil dimuat ulang.', 'success');
}

function exportPenugasanToExcel() {
    const formatted = AppState.allAssignments.map(a => ({
        'Nama Guru': a.profiles?.full_name || 'Guru Dihapus',
        'Kelas': a.kelas,
        'Mata Pelajaran': a.mata_pelajaran
    }));
    exportJSONToExcel(formatted, "Data Penugasan", "Data_Penugasan_Guru");
}

function handlePenugasanImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoading(true);
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
            let successCount = 0;
            let skipCount = 0;

            for (const row of results.data) {
                const namaGuru = (row.Nama_Guru || row.nama_guru || row.Guru || row.guru || row.Email || row.email || '').trim();
                const kelas = (row.Kelas || row.kelas || '').trim();
                const mapel = (row.Mata_Pelajaran || row.mata_pelajaran || row.Mapel || row.mapel || '').trim();

                if (!namaGuru || !kelas || !mapel) {
                    skipCount++;
                    continue;
                }

                const guruId = findTeacherIdByNameOrEmail(namaGuru);
                if (!guruId) {
                    skipCount++;
                    continue;
                }

                const { error } = await smartUpsert('penugasan_guru', {
                    guru_id: guruId,
                    kelas: kelas,
                    mata_pelajaran: mapel
                }, ['kelas', 'mata_pelajaran']);

                if (!error) successCount++;
                else skipCount++;
            }

            showLoading(false);
            await refreshPenugasanData(false);
            showStatusMessage(
                `Import Penugasan selesai: ${successCount} berhasil disimpan, ${skipCount} dilewati (pastikan Nama Guru sesuai dengan akun terdaftar).`,
                successCount > 0 ? 'success' : 'error'
            );
        },
        error: function(err) {
            showLoading(false);
            showStatusMessage(`Gagal membaca file CSV: ${err.message}`, 'error');
        }
    });
    event.target.value = '';
}

// ====================================================================
// MODUL ADMIN 2: MANAJEMEN WALI KELAS (CRUD, TEMPLATE, CSV, EXCEL, REFRESH)
// ====================================================================

async function handleWaliKelasSubmit(e) {
    e.preventDefault();
    const waliData = { 
        guru_id: document.getElementById('waliKelasGuru').value, 
        kelas: document.getElementById('waliKelasNama').value.trim() 
    };
    
    showLoading(true); 
    const { error, action } = await smartUpsert('wali_kelas', waliData, ['kelas']);
    showLoading(false);
    
    if (error) return showStatusMessage(`Gagal menyimpan wali kelas: ${error.message}`, 'error');
    
    showStatusMessage(
        action === 'updated' ? `Wali Kelas ${waliData.kelas} berhasil diganti (ditimpa)!` : 'Wali Kelas berhasil ditugaskan!',
        'success'
    ); 
    e.target.reset();
    await refreshWaliKelasData(false);
}

function loadWaliKelasTable() {
    const tableBody = document.getElementById('waliKelasTableBody');
    if (!tableBody) return;
    if (AppState.allWaliKelas.length === 0) {
        return tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Belum ada wali kelas ditugaskan.</td></tr>';
    }

    tableBody.innerHTML = AppState.allWaliKelas.map(w => `
        <tr>
            <td data-label="Nama Wali Kelas">${w.profiles ? w.profiles.full_name : 'Guru Dihapus dari Sistem'}</td>
            <td data-label="Kelas">${w.kelas}</td>
            <td data-label="Aksi" style="text-align: right;">
                <button class="btn btn-sm btn-danger" onclick="deleteWaliKelas('${w.id}')">Hapus</button>
            </td>
        </tr>
    `).join('');
}

window.deleteWaliKelas = async function(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus tugas wali kelas ini?')) return;
    showLoading(true); 
    await supabaseClient.from('wali_kelas').delete().eq('id', id); 
    showLoading(false);
    await refreshWaliKelasData(false);
};

function downloadTemplateWaliKelas() {
    const contohGuru = AppState.teachers[0]?.full_name || "Siti Aminah, S.Pd";
    const csvContent = `Nama_Guru,Kelas\n"${contohGuru}",X-A\n"${contohGuru}",XI-A`;
    downloadCSVFile("Template_Import_Wali_Kelas.csv", csvContent);
}

async function refreshWaliKelasData(showToast = true) {
    showLoading(true);
    const { data, error } = await supabaseClient.from('wali_kelas').select('*, profiles(full_name)').order('kelas');
    showLoading(false);

    if (error) return showStatusMessage('Gagal memuat ulang data wali kelas.', 'error');
    if (data) AppState.allWaliKelas = data;
    loadWaliKelasTable();
    if (showToast) showStatusMessage('Data wali kelas berhasil dimuat ulang.', 'success');
}

function exportWaliKelasToExcel() {
    const formatted = AppState.allWaliKelas.map(w => ({
        'Nama Wali Kelas': w.profiles?.full_name || 'Guru Dihapus',
        'Kelas yang Diampu': w.kelas
    }));
    exportJSONToExcel(formatted, "Data Wali Kelas", "Data_Wali_Kelas");
}

function handleWaliKelasImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoading(true);
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
            let successCount = 0;
            let skipCount = 0;

            for (const row of results.data) {
                const namaGuru = (row.Nama_Guru || row.nama_guru || row.Nama_Wali_Kelas || row.Guru || row.guru || '').trim();
                const kelas = (row.Kelas || row.kelas || '').trim();

                if (!namaGuru || !kelas) {
                    skipCount++;
                    continue;
                }

                const guruId = findTeacherIdByNameOrEmail(namaGuru);
                if (!guruId) {
                    skipCount++;
                    continue;
                }

                const { error } = await smartUpsert('wali_kelas', {
                    guru_id: guruId,
                    kelas: kelas
                }, ['kelas']);

                if (!error) successCount++;
                else skipCount++;
            }

            showLoading(false);
            await refreshWaliKelasData(false);
            showStatusMessage(
                `Import Wali Kelas selesai: ${successCount} berhasil disimpan, ${skipCount} dilewati (pastikan Nama Guru sesuai dengan akun terdaftar).`,
                successCount > 0 ? 'success' : 'error'
            );
        },
        error: function(err) {
            showLoading(false);
            showStatusMessage(`Gagal membaca file CSV: ${err.message}`, 'error');
        }
    });
    event.target.value = '';
}

// ====================================================================
// MODUL ADMIN 3: MANAJEMEN SISWA (CRUD, TEMPLATE, CSV, EXCEL, REFRESH)
// ====================================================================

function downloadTemplateSiswa() {
    const csvContent = "NISN,Nama,Kelas\n1234567890,Fulan Bin Fulan,X-A\n0987654321,Siti Aminah,XI-B";
    downloadCSVFile("Template_Import_Siswa.csv", csvContent);
}

async function refreshSiswaData() {
    showLoading(true);
    const { data: updatedSiswa, error } = await supabaseClient.from('siswa').select('nisn, nama, kelas').order('nama');
    showLoading(false);
    
    if (error) return showStatusMessage('Gagal memuat ulang data siswa.', 'error');

    if (updatedSiswa) {
        AppState.students = updatedSiswa;
        loadSiswaTable();
        showStatusMessage('Data siswa berhasil dimuat ulang.', 'success');
    }
}

function exportSiswaToExcel() {
    exportJSONToExcel(AppState.students, "Data Siswa", "Data_Siswa");
}

async function handleSiswaImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoading(true);
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
            const rawData = results.data.map(row => ({
                nisn: String(row.nisn || row.NISN || '').trim(),
                nama: String(row.nama || row.Nama || '').trim(),
                kelas: String(row.kelas || row.Kelas || '').trim()
            })).filter(s => s.nisn && s.nama && s.kelas); 

            if (rawData.length === 0) {
                showLoading(false);
                return showStatusMessage('File CSV tidak valid. Header harus: NISN, Nama, Kelas.', 'error');
            }

            const uniqueSiswaMap = new Map();
            rawData.forEach(item => uniqueSiswaMap.set(item.nisn, item));
            const dataToUpsert = Array.from(uniqueSiswaMap.values());

            const { error } = await supabaseClient
                .from('siswa')
                .upsert(dataToUpsert, { onConflict: 'nisn', ignoreDuplicates: false });
            
            showLoading(false);
            if (error) return showStatusMessage(`Gagal mengimpor data: ${error.message}`, 'error');
            
            showStatusMessage(`${dataToUpsert.length} data siswa berhasil diimpor/diperbarui!`, 'success');
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
                <td data-label="Aksi" style="text-align: right; white-space: nowrap;">
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
    if (!siswaData.nisn || !siswaData.nama || !siswaData.kelas) return showStatusMessage('Semua kolom wajib diisi.', 'error');
    
    showLoading(true);
    let error;
    if (oldNisn && oldNisn !== siswaData.nisn) {
        const { error: updateError } = await supabaseClient.from('siswa').update(siswaData).eq('nisn', oldNisn);
        error = updateError;
    } else {
        const { error: upsertError } = await supabaseClient
            .from('siswa')
            .upsert(siswaData, { onConflict: 'nisn', ignoreDuplicates: false });
        error = upsertError;
    }
    showLoading(false);
    
    if (error) return showStatusMessage(`Gagal menyimpan: ${error.message}`, 'error');
    showStatusMessage('Data siswa berhasil disimpan/diperbarui!', 'success');
    resetFormSiswa();
    await refreshSiswaData();
}

window.editSiswaHandler = function(nisn) {
    const siswa = AppState.students.find(s => s.nisn === nisn);
    if (!siswa) return;
    
    document.getElementById('formNisn').value = siswa.nisn;
    document.getElementById('formNama').value = siswa.nama;
    document.getElementById('formKelas').value = siswa.kelas;
    document.getElementById('formNisnOld').value = siswa.nisn;
    document.getElementById('saveSiswaButton').textContent = 'Update Data Siswa';
    document.getElementById('formSiswa').scrollIntoView({ behavior: 'smooth' });
};

function resetFormSiswa() {
    document.getElementById('formSiswa').reset();
    document.getElementById('formNisnOld').value = '';
    document.getElementById('saveSiswaButton').textContent = 'Simpan Data';
}

window.deleteSiswaHandler = async function(nisn) {
    if (!confirm(`Yakin ingin menghapus siswa dengan NISN: ${nisn}?`)) return;

    showLoading(true);
    const { error } = await supabaseClient.from('siswa').delete().eq('nisn', nisn);
    showLoading(false);
    
    if (error) return showStatusMessage(`Gagal menghapus siswa: ${error.message}`, 'error');

    showStatusMessage('Siswa berhasil dihapus.', 'success');
    AppState.students = AppState.students.filter(s => s.nisn !== nisn);
    loadSiswaTable();
};

// ====================================================================
// MODUL ADMIN 4: MANAJEMEN PENGGUNA (CRUD, TEMPLATE, CSV, EXCEL, REFRESH)
// ====================================================================

async function handlePenggunaSubmit(event) {
    event.preventDefault();
    let userIdToUpdate = document.getElementById('formUserIdToUpdate').value;
    const nama = document.getElementById('formNamaPengguna').value.trim();
    const email = document.getElementById('formEmailPengguna').value.trim();
    const password = document.getElementById('formPasswordPengguna').value;
    const role = document.getElementById('formPeran').value;

    if (!userIdToUpdate && AppState.allUsers.length > 0) {
        const existingUser = AppState.allUsers.find(
            u => u.email && u.email.toLowerCase() === email.toLowerCase()
        );
        if (existingUser) {
            userIdToUpdate = existingUser.id;
        }
    }

    showLoading(true);

    if (userIdToUpdate) {
        if (password && password.length < 6) {
            showLoading(false);
            return showStatusMessage('Password baru minimal 6 karakter.', 'error');
        }

        const { error } = await supabaseClient.rpc('admin_update_user', {
            target_id: userIdToUpdate,
            new_email: email,
            new_password: password || null,
            new_full_name: nama,
            new_role: role
        });

        showLoading(false);
        if (error) return showStatusMessage(`Gagal update pengguna: ${error.message}`, 'error');
        showStatusMessage('Data pengguna berhasil diperbarui (ditimpa).', 'success');
    } else {
        if (!password || password.length < 6) {
            showLoading(false);
            return showStatusMessage('Password wajib diisi minimal 6 karakter.', 'error');
        }

        const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: false, autoRefreshToken: false }
        });

        const { error } = await tempClient.auth.signUp({
            email: email,
            password: password,
            options: { data: { full_name: nama, role: role } }
        });

        showLoading(false);
        if (error) return showStatusMessage(`Gagal membuat pengguna: ${error.message}`, 'error');
        
        showStatusMessage(`Pengguna ${email} berhasil dibuat!`, 'success');
    }

    resetPenggunaForm();
    await refreshPenggunaData(false);
}

async function loadUsersTable() {
    const tableBody = document.getElementById('penggunaTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Memuat data pengguna...</td></tr>';
    showLoading(true);

    const { data, error } = await supabaseClient.rpc('get_all_users');
    showLoading(false);

    if (error) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Gagal memuat pengguna. Anda mungkin bukan Admin.</td></tr>';
        return showStatusMessage(`Error: ${error.message}`, 'error');
    }
    AppState.allUsers = data || [];
    renderUsersTable(AppState.allUsers);
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
        const escapedEmail = user.email ? user.email.replace(/'/g, "\\'") : '';

        return `
            <tr>
                <td data-label="Nama">${user.full_name || 'N/A'}</td>
                <td data-label="Email">${user.email}</td>
                <td data-label="Peran">${user.role}</td>
                <td data-label="Aksi" style="text-align: right; white-space: nowrap;">
                    <button class="btn btn-sm btn-secondary" onclick="editUserHandler('${user.id}', '${escapedFullName}', '${escapedEmail}', '${user.role}')" ${disabledAttr}>Ubah</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteUserHandler('${user.id}')" ${disabledAttr}>Hapus</button>
                </td>
            </tr>
        `;
    }).join('');
}

window.editUserHandler = function(id, fullName, email, role) {
    document.getElementById('formUserIdToUpdate').value = id;
    document.getElementById('formNamaPengguna').value = fullName;
    document.getElementById('formEmailPengguna').value = email;
    document.getElementById('formPeran').value = role;
    
    const passwordInput = document.getElementById('formPasswordPengguna');
    passwordInput.placeholder = 'Isi hanya jika ingin mengubah password';
    passwordInput.required = false;

    document.getElementById('submitPenggunaButton').textContent = 'Update Pengguna';
    document.getElementById('penggunaSection').scrollIntoView({ behavior: 'smooth' });
};

window.deleteUserHandler = async function(userId) {
    if (!confirm('Apakah Anda yakin ingin menghapus pengguna ini? Tindakan ini tidak dapat dibatalkan.')) return;
    
    showLoading(true);
    const { error } = await supabaseClient.rpc('admin_delete_user', { target_user_id: userId });
    showLoading(false);

    if (error) return showStatusMessage(`Gagal menghapus pengguna: ${error.message}`, 'error');

    showStatusMessage('Pengguna berhasil dihapus.', 'success');
    await refreshPenggunaData(false);
};

function resetPenggunaForm() {
    document.getElementById('formPengguna').reset();
    document.getElementById('formUserIdToUpdate').value = '';
    
    const passwordInput = document.getElementById('formPasswordPengguna');
    passwordInput.placeholder = 'Minimal 6 karakter';
    passwordInput.required = true;
    
    document.getElementById('submitPenggunaButton').textContent = 'Buat Pengguna';
}

function downloadTemplatePengguna() {
    const csvContent = "Nama_Lengkap,Email,Password,Peran\n\"Budi Santoso, S.Pd\",budi@smanema.sch.id,guru12345,Guru\n\"Siti Aminah, S.Pd\",siti@smanema.sch.id,wali12345,Wali Kelas";
    downloadCSVFile("Template_Import_Pengguna.csv", csvContent);
}

async function refreshPenggunaData(showToast = true) {
    await loadUsersTable();
    const { data: teachersData } = await supabaseClient
        .from('profiles')
        .select('id, full_name')
        .in('role', ['Guru', 'Wali Kelas'])
        .order('full_name');
    if (teachersData) {
        AppState.teachers = teachersData;
        populateInitialDropdowns();
    }
    if (showToast) showStatusMessage('Data pengguna berhasil dimuat ulang.', 'success');
}

function exportPenggunaToExcel() {
    const formatted = AppState.allUsers.map(u => ({
        'Nama Lengkap': u.full_name || 'N/A',
        'Email': u.email || '',
        'Peran': u.role || ''
    }));
    exportJSONToExcel(formatted, "Data Pengguna", "Data_Pengguna_Sistem");
}

function handlePenggunaImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoading(true);
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
            let successCount = 0;
            let failCount = 0;

            const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: { persistSession: false, autoRefreshToken: false }
            });

            for (const row of results.data) {
                const nama = String(row.Nama_Lengkap || row.nama_lengkap || row.Nama || row.nama || '').trim();
                const email = String(row.Email || row.email || '').trim();
                const password = String(row.Password || row.password || '').trim();
                const role = String(row.Peran || row.peran || row.Role || row.role || 'Guru').trim();

                if (!nama || !email) {
                    failCount++;
                    continue;
                }

                const existingUser = AppState.allUsers.find(
                    u => u.email && u.email.toLowerCase() === email.toLowerCase()
                );

                if (existingUser) {
                    const { error } = await supabaseClient.rpc('admin_update_user', {
                        target_id: existingUser.id,
                        new_email: email,
                        new_password: password.length >= 6 ? password : null,
                        new_full_name: nama,
                        new_role: role
                    });
                    if (!error) successCount++;
                    else failCount++;
                } else {
                    if (password.length < 6) {
                        failCount++;
                        continue;
                    }
                    const { error } = await tempClient.auth.signUp({
                        email: email,
                        password: password,
                        options: { data: { full_name: nama, role: role } }
                    });
                    if (!error) successCount++;
                    else failCount++;
                }
            }

            showLoading(false);
            await refreshPenggunaData(false);
            showStatusMessage(
                `Import Pengguna selesai: ${successCount} akun diproses, ${failCount} gagal/dilewati.`,
                successCount > 0 ? 'success' : 'error'
            );
        },
        error: function(err) {
            showLoading(false);
            showStatusMessage(`Gagal membaca file CSV: ${err.message}`, 'error');
        }
    });
    event.target.value = '';
}

// ====================================================================
// MODUL ADMIN 5: JADWAL GURU PIKET (CRUD, TEMPLATE, CSV, EXCEL, REFRESH)
// ====================================================================

async function handlePiketSubmit(e) {
    e.preventDefault();
    const dataPiket = {
        nama_guru: document.getElementById('piketNamaGuru').value.trim(),
        nomor_wa: document.getElementById('piketNoWa').value.trim(),
        hari: document.getElementById('piketHari').value
    };
    
    showLoading(true);
    const { error, action } = await smartUpsert('jadwal_piket', dataPiket, ['hari', 'nama_guru']);
    showLoading(false);
    
    if (error) return showStatusMessage(`Gagal menyimpan jadwal: ${error.message}`, 'error');
    showStatusMessage(
        action === 'updated' ? 'Jadwal piket guru tersebut berhasil diperbarui (ditimpa)!' : 'Jadwal piket berhasil ditambahkan!',
        'success'
    );
    e.target.reset();
    await refreshPiketData(false);
}

function loadPiketTable() {
    const tableBody = document.getElementById('piketTableBody');
    if (!tableBody) return;
    if (AppState.allPiket.length === 0) {
        return tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Belum ada jadwal piket.</td></tr>';
    }
    
    const urutanHari = { "Senin": 1, "Selasa": 2, "Rabu": 3, "Kamis": 4, "Jumat": 5, "Sabtu": 6, "Minggu": 7 };
    const sortedPiket = [...AppState.allPiket].sort((a, b) => (urutanHari[a.hari] || 99) - (urutanHari[b.hari] || 99));

    tableBody.innerHTML = sortedPiket.map(p => `
        <tr>
            <td data-label="Hari" style="font-weight:600;">${p.hari}</td>
            <td data-label="Nama Guru">${p.nama_guru}</td>
            <td data-label="WhatsApp">+${p.nomor_wa}</td>
            <td data-label="Aksi" style="text-align: right;">
                <button class="btn btn-sm btn-danger" onclick="deletePiket('${p.id}')">Hapus</button>
            </td>
        </tr>
    `).join('');
}

window.deletePiket = async function(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus jadwal piket ini?')) return;
    showLoading(true); 
    await supabaseClient.from('jadwal_piket').delete().eq('id', id); 
    showLoading(false);
    
    showStatusMessage('Jadwal berhasil dihapus.', 'success');
    await refreshPiketData(false);
};

function downloadTemplatePiket() {
    const csvContent = "Hari,Nama_Guru,Nomor_WA\nSenin,\"Bapak Budi, S.Pd\",6281234567890\nSelasa,\"Ibu Siti, S.Pd\",6289876543210";
    downloadCSVFile("Template_Import_Jadwal_Piket.csv", csvContent);
}

async function refreshPiketData(showToast = true) {
    showLoading(true);
    const { data, error } = await supabaseClient.from('jadwal_piket').select('*').order('hari');
    showLoading(false);

    if (error) return showStatusMessage('Gagal memuat ulang jadwal piket.', 'error');
    if (data) AppState.allPiket = data;
    loadPiketTable();
    if (showToast) showStatusMessage('Jadwal guru piket berhasil dimuat ulang.', 'success');
}

function exportPiketToExcel() {
    const formatted = AppState.allPiket.map(p => ({
        'Hari': p.hari,
        'Nama Guru Piket': p.nama_guru,
        'Nomor WhatsApp': p.nomor_wa
    }));
    exportJSONToExcel(formatted, "Jadwal Piket", "Jadwal_Guru_Piket");
}

function handlePiketImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoading(true);
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
            let successCount = 0;
            let skipCount = 0;

            for (const row of results.data) {
                const rawHari = String(row.Hari || row.hari || '').trim();
                const namaGuru = String(row.Nama_Guru || row.nama_guru || row.Nama || row.nama || '').trim();
                let nomorWa = String(row.Nomor_WA || row.nomor_wa || row.WhatsApp || row.whatsapp || '').replace(/[^0-9]/g, '');

                if (nomorWa.startsWith('08')) {
                    nomorWa = '62' + nomorWa.slice(1);
                }

                if (!rawHari || !namaGuru || !nomorWa) {
                    skipCount++;
                    continue;
                }

                const hariFormatted = rawHari.charAt(0).toUpperCase() + rawHari.slice(1).toLowerCase();

                const { error } = await smartUpsert('jadwal_piket', {
                    hari: hariFormatted,
                    nama_guru: namaGuru,
                    nomor_wa: nomorWa
                }, ['hari', 'nama_guru']);

                if (!error) successCount++;
                else skipCount++;
            }

            showLoading(false);
            await refreshPiketData(false);
            showStatusMessage(
                `Import Jadwal Piket selesai: ${successCount} berhasil disimpan, ${skipCount} dilewati.`,
                successCount > 0 ? 'success' : 'error'
            );
        },
        error: function(err) {
            showLoading(false);
            showStatusMessage(`Gagal membaca file CSV: ${err.message}`, 'error');
        }
    });
    event.target.value = '';
}

async function handlePengaturanSubmit(e) {
    e.preventDefault();
    const wa = document.getElementById('pengaturanWaPiket').value.trim();
    showLoading(true);
    const { error } = await supabaseClient.from('pengaturan').upsert({ kunci: 'nomor_wa_piket', nilai: wa });
    showLoading(false);
    if(error) return showStatusMessage('Gagal menyimpan pengaturan: ' + error.message, 'error');
    showStatusMessage('Pengaturan WhatsApp Piket berhasil disimpan!', 'success');
}

// ====================================================================
// MODUL ADMIN: HAPUS SEMUA DATA (PERGANTIAN TAHUN AJARAN BARU)
// ====================================================================

async function confirmAndExecuteBulkDelete(labelData, deleteActionCallback) {
    const konfirmasi1 = confirm(
        `⚠️ PERINGATAN PERGANTIAN TAHUN AJARAN!\n\nAnda akan menghapus SEMUA data pada bagian "${labelData}".\nData yang dihapus tidak dapat dikembalikan. Apakah Anda yakin ingin melanjutkan?`
    );
    if (!konfirmasi1) return;

    const ketikHapus = prompt(
        `Ketik kata HAPUS (huruf kapital semua) untuk mengonfirmasi pengosongan "${labelData}":`
    );
    if (ketikHapus !== 'HAPUS') {
        showStatusMessage('Penghapusan seluruh data dibatalkan.', 'info');
        return;
    }

    showLoading(true);
    try {
        await deleteActionCallback();
        showStatusMessage(`Seluruh data "${labelData}" berhasil dikosongkan!`, 'success');
    } catch (err) {
        console.error(err);
        showStatusMessage(`Gagal menghapus seluruh data ${labelData}: ${err.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

function initDeleteAllButtons() {
    document.getElementById('deleteAllJurnalButton')?.addEventListener('click', () => {
        confirmAndExecuteBulkDelete('Riwayat Jurnal Pembelajaran', async () => {
            const { error } = await supabaseClient.from('jurnal_pelajaran').delete().not('id', 'is', null);
            if (error) throw error;
            await loadRiwayatJurnal();
        });
    });

    document.getElementById('deleteAllDisiplinButton')?.addEventListener('click', () => {
        confirmAndExecuteBulkDelete('Riwayat Catatan Disiplin', async () => {
            const { error } = await supabaseClient.from('catatan_disiplin').delete().not('id', 'is', null);
            if (error) throw error;
            await loadRiwayatDisiplin();
        });
    });

    document.getElementById('deleteAllPenugasanButton')?.addEventListener('click', () => {
        confirmAndExecuteBulkDelete('Penugasan Guru', async () => {
            const { error } = await supabaseClient.from('penugasan_guru').delete().not('id', 'is', null);
            if (error) throw error;
            AppState.allAssignments = [];
            AppState.assignments = [];
            loadPenugasanTable();
            populateInitialDropdowns();
        });
    });

    document.getElementById('deleteAllWaliKelasButton')?.addEventListener('click', () => {
        confirmAndExecuteBulkDelete('Wali Kelas', async () => {
            const { error } = await supabaseClient.from('wali_kelas').delete().not('id', 'is', null);
            if (error) throw error;
            AppState.allWaliKelas = [];
            loadWaliKelasTable();
        });
    });

    document.getElementById('deleteAllSiswaButton')?.addEventListener('click', () => {
        confirmAndExecuteBulkDelete('Database Siswa', async () => {
            const { error } = await supabaseClient.from('siswa').delete().not('nisn', 'is', null);
            if (error) {
                throw new Error(
                    `${error.message} (Pastikan Riwayat Disiplin sudah dikosongkan terlebih dahulu jika masih terhubung dengan NISN siswa)`
                );
            }
            AppState.students = [];
            loadSiswaTable();
        });
    });

    document.getElementById('deleteAllPenggunaButton')?.addEventListener('click', () => {
        confirmAndExecuteBulkDelete('Pengguna Non-Admin', async () => {
            const nonAdminUsers = AppState.allUsers.filter(
                u => u.role !== 'Admin' && u.id !== AppState.user.id
            );

            for (const u of nonAdminUsers) {
                const { error } = await supabaseClient.rpc('admin_delete_user', { target_user_id: u.id });
                if (error) throw error;
            }
            await loadUsersTable();
        });
    });

    document.getElementById('deleteAllPiketButton')?.addEventListener('click', () => {
        confirmAndExecuteBulkDelete('Jadwal Guru Piket', async () => {
            const { error } = await supabaseClient.from('jadwal_piket').delete().not('id', 'is', null);
            if (error) throw error;
            AppState.allPiket = [];
            loadPiketTable();
        });
    });
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
            switchSection(sectionId);

            if (sectionId === 'riwayatJurnalSection') loadRiwayatJurnal();
            if (sectionId === 'riwayatDisiplinSection') loadRiwayatDisiplin();
            if (sectionId === 'penugasanSection') loadPenugasanTable();
            if (sectionId === 'waliKelasSection') loadWaliKelasTable();
            if (sectionId === 'siswaSection') loadSiswaTable();
            if (sectionId === 'penggunaSection') loadUsersTable();
            if (sectionId === 'piketSection') loadPiketTable();
        });
    });

    // Form Submissions
    document.getElementById('formJurnal')?.addEventListener('submit', handleJurnalSubmit);
    document.getElementById('formDisiplin')?.addEventListener('submit', handleDisiplinSubmit);
    document.getElementById('formPenugasan')?.addEventListener('submit', handlePenugasanSubmit);
    document.getElementById('formWaliKelas')?.addEventListener('submit', handleWaliKelasSubmit);
    document.getElementById('formPengguna')?.addEventListener('submit', handlePenggunaSubmit);
    document.getElementById('formPiket')?.addEventListener('submit', handlePiketSubmit);
    document.getElementById('formPengaturan')?.addEventListener('submit', handlePengaturanSubmit);
    document.getElementById('formSiswa')?.addEventListener('submit', saveSiswaHandler);

    // Reset Buttons
    document.getElementById('resetSiswaButton')?.addEventListener('click', resetFormSiswa);
    document.getElementById('resetPenggunaButton')?.addEventListener('click', resetPenggunaForm);
    
    // 1. Listeners Admin: Penugasan Guru
    document.getElementById('downloadTemplatePenugasanButton')?.addEventListener('click', downloadTemplatePenugasan);
    document.getElementById('importPenugasanButton')?.addEventListener('click', () => document.getElementById('importPenugasanInput').click());
    document.getElementById('importPenugasanInput')?.addEventListener('change', handlePenugasanImport);
    document.getElementById('exportPenugasanButton')?.addEventListener('click', exportPenugasanToExcel);
    document.getElementById('refreshPenugasanButton')?.addEventListener('click', () => refreshPenugasanData(true));

    // 2. Listeners Admin: Wali Kelas
    document.getElementById('downloadTemplateWaliKelasButton')?.addEventListener('click', downloadTemplateWaliKelas);
    document.getElementById('importWaliKelasButton')?.addEventListener('click', () => document.getElementById('importWaliKelasInput').click());
    document.getElementById('importWaliKelasInput')?.addEventListener('change', handleWaliKelasImport);
    document.getElementById('exportWaliKelasButton')?.addEventListener('click', exportWaliKelasToExcel);
    document.getElementById('refreshWaliKelasButton')?.addEventListener('click', () => refreshWaliKelasData(true));

    // 3. Listeners Admin: Siswa
    document.getElementById('downloadTemplateSiswaButton')?.addEventListener('click', downloadTemplateSiswa);
    document.getElementById('importSiswaButton')?.addEventListener('click', () => document.getElementById('importSiswaInput').click());
    document.getElementById('importSiswaInput')?.addEventListener('change', handleSiswaImport);
    document.getElementById('exportSiswaButton')?.addEventListener('click', exportSiswaToExcel);
    document.getElementById('refreshSiswaButton')?.addEventListener('click', refreshSiswaData);

    // 4. Listeners Admin: Pengguna Sistem
    document.getElementById('downloadTemplatePenggunaButton')?.addEventListener('click', downloadTemplatePengguna);
    document.getElementById('importPenggunaButton')?.addEventListener('click', () => document.getElementById('importPenggunaInput').click());
    document.getElementById('importPenggunaInput')?.addEventListener('change', handlePenggunaImport);
    document.getElementById('exportPenggunaButton')?.addEventListener('click', exportPenggunaToExcel);
    document.getElementById('refreshPenggunaButton')?.addEventListener('click', () => refreshPenggunaData(true));

    // 5. Listeners Admin: Jadwal Guru Piket
    document.getElementById('downloadTemplatePiketButton')?.addEventListener('click', downloadTemplatePiket);
    document.getElementById('importPiketButton')?.addEventListener('click', () => document.getElementById('importPiketInput').click());
    document.getElementById('importPiketInput')?.addEventListener('change', handlePiketImport);
    document.getElementById('exportPiketButton')?.addEventListener('click', exportPiketToExcel);
    document.getElementById('refreshPiketButton')?.addEventListener('click', () => refreshPiketData(true));
    
    // Listeners Jurnal & Riwayat
    document.getElementById('loadSiswaForJurnalButton')?.addEventListener('click', loadSiswaForJurnal);
    document.getElementById('filterRiwayatButton')?.addEventListener('click', applyRiwayatFilter);
    document.getElementById('refreshRiwayatButton')?.addEventListener('click', loadRiwayatJurnal);
    document.getElementById('exportRiwayatButton')?.addEventListener('click', exportRiwayatToExcel);
    document.getElementById('filterRiwayatDisiplinButton')?.addEventListener('click', applyRiwayatDisiplinFilter);
    document.getElementById('refreshRiwayatDisiplinButton')?.addEventListener('click', loadRiwayatDisiplin);
    
    setupSiswaSearch();
    initSortableTables();
    initDeleteAllButtons();
}

async function initDashboardPage() {
    await checkAuthenticationAndSetup();
    if (AppState.user) {
        await checkUserRoleAndSetupUI();
        await loadInitialData();
        populateInitialDropdowns();
        setupDashboardListeners();
        document.querySelector('.sidebar-nav .btn-nav')?.click();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.dashboard-wrapper')) {
        initDashboardPage();
    }
});
