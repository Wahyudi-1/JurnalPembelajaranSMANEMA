/**
 * =================================================================
 * SCRIPT KHUSUS PANEL GURU - SISTEM JURNAL & DISIPLIN
 * =================================================================
 * @version 7.4 - Fitur Ubah & Hapus (Jurnal, Nilai, Disiplin),
 *                Sortir Tabel Rekap, Ekspor Excel Lengkap & Offline Sync
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
    filteredDisiplinHistory: [],
    allNilaiHistory: [],
    filteredNilaiHistory: []
};

// ====================================================================
// MODUL OFFLINE SYNC
// ====================================================================
const OFFLINE_QUEUE_KEY = 'jurnal_offline_queue';

function simpanKeAntreanOffline(data) {
    let antrean = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY)) || [];
    antrean.push(data);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(antrean));
    showStatusMessage('Anda sedang offline! Data disimpan di perangkat dan akan dikirim otomatis saat internet kembali.', 'info', 6000);
}

async function sinkronisasiDataOffline() {
    let antrean = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY)) || [];
    if (antrean.length === 0) return;

    showStatusMessage('Koneksi internet kembali. Mengirim data offline ke server...', 'info', 0);
    
    let antreanGagal = [];
    let berhasil = 0;

    for (let data of antrean) {
        const { error } = await supabaseClient.from('jurnal_pelajaran').insert(data);
        if (!error) {
            berhasil++;
        } else {
            antreanGagal.push(data);
        }
    }

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(antreanGagal));
    
    if (berhasil > 0) {
        showStatusMessage(`${berhasil} data jurnal offline berhasil tersinkronisasi!`, 'success');
        if (typeof loadRiwayatJurnal === 'function') loadRiwayatJurnal();
    }
}

window.addEventListener('online', sinkronisasiDataOffline);
window.addEventListener('offline', () => showStatusMessage('Koneksi terputus. Anda masuk ke Mode Offline.', 'info'));

// ====================================================================
// FUNGSI PEMBANTU (HELPERS) & SORTIR TABEL
// ====================================================================
function showLoading(isLoading) {
    const el = document.getElementById('loadingIndicator');
    if (el) el.style.display = isLoading ? 'flex' : 'none';
}

function showStatusMessage(message, type = 'info', duration = 4000) {
    const statusEl = document.getElementById('statusMessage');
    if (!statusEl) return;
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
    const target = document.getElementById(sectionId);
    if (target) target.style.display = 'block';

    document.querySelectorAll('.sidebar-nav .btn-nav').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === sectionId);
    });
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

/**
 * Inisialisasi Fitur Pengurutan Kolom Tabel (Mendukung teks, angka, tanggal, dan kolom input nilai)
 */
function initSortableTables() {
    document.querySelectorAll('th.sortable').forEach(headerCell => {
        headerCell.addEventListener('click', () => {
            const table = headerCell.closest('table');
            const tbody = table?.querySelector('tbody');
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

                let rawA = cellElA?.dataset.sort ?? cellElA?.innerText.trim() ?? '';
                let rawB = cellElB?.dataset.sort ?? cellElB?.innerText.trim() ?? '';

                // Jika kolom berisi elemen <input> (seperti pada Daftar Input Nilai)
                if (dataType === 'input-number') {
                    const inputA = cellElA?.querySelector('input');
                    const inputB = cellElB?.querySelector('input');
                    const numA = inputA && inputA.value !== '' ? parseFloat(inputA.value) : -1;
                    const numB = inputB && inputB.value !== '' ? parseFloat(inputB.value) : -1;
                    return isAscending ? numA - numB : numB - numA;
                }

                let comparison = 0;

                if (dataType === 'number') {
                    const numA = parseFloat(String(rawA).replace(/[^0-9.-]+/g, '')) || 0;
                    const numB = parseFloat(String(rawB).replace(/[^0-9.-]+/g, '')) || 0;
                    comparison = numA - numB;
                } else if (dataType === 'date') {
                    comparison = parseDateValue(String(rawA)) - parseDateValue(String(rawB));
                } else {
                    comparison = String(rawA).localeCompare(String(rawB), 'id', { numeric: true, sensitivity: 'base' });
                }

                return isAscending ? comparison : -comparison;
            });

            tbody.append(...rows);
        });
    });
}

// ====================================================================
// INISIALISASI SESI & DATA AWAL
// ====================================================================
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
    const [assignments, students, violations, nilaiHistory] = await Promise.all([
        supabaseClient.from('penugasan_guru').select('kelas, mata_pelajaran').eq('guru_id', AppState.user.id),
        supabaseClient.from('siswa').select('nisn, nama, kelas').order('nama'),
        supabaseClient.from('pelanggaran_master').select('id, deskripsi, poin').order('deskripsi'),
        supabaseClient.from('nilai_siswa').select(`id, tahun_ajaran, semester, kelas, mata_pelajaran, jenis_penilaian, nisn_siswa, nilai, created_at, siswa (nisn, nama)`).eq('guru_id', AppState.user.id).order('created_at', { ascending: false })
    ]);

    if (assignments.data) AppState.assignments = assignments.data;
    if (students.data) AppState.students = students.data;
    if (violations.data) AppState.violations = violations.data;
    if (nilaiHistory.data) {
        AppState.allNilaiHistory = nilaiHistory.data;
        AppState.filteredNilaiHistory = nilaiHistory.data;
    }
    showLoading(false);

    populateDropdown('jurnalKelas', AppState.assignments, 'kelas', 'kelas', 'Pilih Kelas');
    populateDropdown('jurnalMapel', AppState.assignments, 'mata_pelajaran', 'mata_pelajaran', 'Pilih Mata Pelajaran');
    
    const selectDisiplin = document.getElementById('deskripsiDisiplinInput');
    selectDisiplin.innerHTML = '<option value="">-- Pilih Pelanggaran --</option>';
    AppState.violations.forEach(v => selectDisiplin.innerHTML += `<option value="${v.id}">${v.deskripsi} (${v.poin} Poin)</option>`);

    // LOGIKA AUTO-SELECT TAHUN AJARAN DAN SEMESTER BERDASARKAN KALENDER
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    let currentTA = '';
    let currentSemester = '';

    if (month >= 7) {
        currentTA = `${year}/${year + 1}`;
        currentSemester = 'Ganjil';
    } else {
        currentTA = `${year - 1}/${year}`;
        currentSemester = 'Genap';
    }

    const taHTML = `
        <option value="">-- Pilih --</option>
        <option value="${year - 1}/${year}">${year - 1}/${year}</option>
        <option value="${year}/${year + 1}">${year}/${year + 1}</option>
    `;
    const semesterHTML = `<option value="">-- Pilih --</option><option value="Ganjil">Ganjil</option><option value="Genap">Genap</option>`;

    // Form Input Nilai
    const elemTahunInput = document.getElementById('nilaiFilterTahunAjaran');
    const elemSmtInput = document.getElementById('nilaiFilterSemester');
    if (elemTahunInput) { elemTahunInput.innerHTML = taHTML; elemTahunInput.value = currentTA; }
    if (elemSmtInput) { elemSmtInput.innerHTML = semesterHTML; elemSmtInput.value = currentSemester; }
    populateDropdown('nilaiFilterKelas', AppState.assignments, 'kelas', 'kelas', 'Pilih Kelas');
    populateDropdown('nilaiFilterMataPelajaran', AppState.assignments, 'mata_pelajaran', 'mata_pelajaran', 'Pilih Mata Pelajaran');

    // Form Rekap Nilai
    const elemTahunRekap = document.getElementById('rekapNilaiTA');
    const elemSmtRekap = document.getElementById('rekapNilaiSemester');
    if (elemTahunRekap) { elemTahunRekap.innerHTML = taHTML; elemTahunRekap.value = currentTA; }
    if (elemSmtRekap) { elemSmtRekap.innerHTML = semesterHTML; elemSmtRekap.value = currentSemester; }
    populateDropdown('rekapNilaiKelas', AppState.assignments, 'kelas', 'kelas', 'Pilih Kelas');
    populateDropdown('rekapNilaiMapel', AppState.assignments, 'mata_pelajaran', 'mata_pelajaran', 'Pilih Mata Pelajaran');
}

// ====================================================================
// MODUL JURNAL PENGAJARAN (INPUT, EDIT, HAPUS, OFFLINE SYNC)
// ====================================================================
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

function resetJurnalForm() {
    document.getElementById('formJurnal')?.reset();
    const idInput = document.getElementById('jurnalIdToUpdate');
    if (idInput) idInput.value = '';

    const submitBtn = document.getElementById('submitJurnalButton');
    if (submitBtn) submitBtn.textContent = 'Simpan Jurnal';

    const cancelBtn = document.getElementById('cancelJurnalEditButton');
    if (cancelBtn) cancelBtn.style.display = 'none';

    const tableBody = document.getElementById('presensiTableBody');
    if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center;">Pilih kelas dan mapel...</td></tr>`;
    }
}

async function handleJurnalSubmit(event) {
    event.preventDefault();
    const jurnalIdToUpdate = document.getElementById('jurnalIdToUpdate')?.value;
    const presensiRows = document.querySelectorAll('#presensiTableBody tr');
    
    if (!jurnalIdToUpdate && presensiRows.length > 0 && presensiRows[0]?.cells?.[0]?.textContent.includes('Pilih kelas')) {
         return showStatusMessage('Harap klik "Tampilkan Siswa untuk Presensi" terlebih dahulu.', 'error');
    }

    const jurnalData = {
        guru_id: AppState.user.id,
        kelas: document.getElementById('jurnalKelas').value,
        mata_pelajaran: document.getElementById('jurnalMapel').value,
        tanggal: document.getElementById('jurnalTanggal').value,
        materi: document.getElementById('jurnalMateri').value.trim(),
        catatan: (document.getElementById('jurnalCatatan').value || '').trim(),
    };

    const siswaTidakHadir = [];
    presensiRows.forEach(row => {
        if (row.dataset.nisn) { 
            const status = row.querySelector('.kehadiran-status').value;
            if (status !== 'Hadir') siswaTidakHadir.push(`${row.dataset.nama} (${status})`);
        }
    });

    if (siswaTidakHadir.length > 0) {
        jurnalData.catatan += `\n\n--- PRESENSI TIDAK HADIR ---\n${siswaTidakHadir.join('\n')}`;
    }

    // --- CEK MODE OFFLINE ---
    if (!navigator.onLine) {
        simpanKeAntreanOffline(jurnalData);
        resetJurnalForm();
        return;
    }

    // --- PROSES ONLINE (INSERT ATAU UPDATE) ---
    showLoading(true);
    let error = null;

    if (jurnalIdToUpdate) {
        const res = await supabaseClient
            .from('jurnal_pelajaran')
            .update(jurnalData)
            .eq('id', jurnalIdToUpdate)
            .eq('guru_id', AppState.user.id);
        error = res.error;
    } else {
        // Cek apakah jurnal dengan guru, kelas, mapel, dan tanggal yang sama sudah ada
        const { data: existing } = await supabaseClient
            .from('jurnal_pelajaran')
            .select('id')
            .eq('guru_id', jurnalData.guru_id)
            .eq('kelas', jurnalData.kelas)
            .eq('mata_pelajaran', jurnalData.mata_pelajaran)
            .eq('tanggal', jurnalData.tanggal);

        if (existing && existing.length > 0) {
            const res = await supabaseClient
                .from('jurnal_pelajaran')
                .update(jurnalData)
                .eq('id', existing[0].id);
            error = res.error;
        } else {
            const res = await supabaseClient.from('jurnal_pelajaran').insert(jurnalData);
            error = res.error;
        }
    }
    showLoading(false);
    
    if (error) return showStatusMessage(`Gagal menyimpan: ${error.message}`, 'error');
    
    showStatusMessage(
        jurnalIdToUpdate ? 'Jurnal & presensi berhasil diperbarui!' : 'Jurnal & presensi berhasil disimpan!',
        'success'
    );
    resetJurnalForm();
}

window.editJurnalHandler = async function(jurnalId) {
    const jurnal = AppState.allJurnalHistory.find(j => String(j.id) === String(jurnalId));
    if (!jurnal) return showStatusMessage('Data jurnal tidak ditemukan.', 'error');

    switchSection('jurnalSection');

    let idInput = document.getElementById('jurnalIdToUpdate');
    if (!idInput) {
        idInput = document.createElement('input');
        idInput.type = 'hidden';
        idInput.id = 'jurnalIdToUpdate';
        document.getElementById('formJurnal')?.prepend(idInput);
    }
    idInput.value = jurnal.id;

    ensureSelectOption('jurnalKelas', jurnal.kelas, jurnal.kelas);
    ensureSelectOption('jurnalMapel', jurnal.mata_pelajaran, jurnal.mata_pelajaran);

    document.getElementById('jurnalTanggal').value = jurnal.tanggal ? String(jurnal.tanggal).slice(0, 10) : '';
    document.getElementById('jurnalMateri').value = jurnal.materi || '';

    // Pisahkan catatan guru dengan daftar presensi tidak hadir
    const marker = '--- PRESENSI TIDAK HADIR ---';
    let catatanMurni = jurnal.catatan || '';
    const presensiMap = {};

    if (catatanMurni.includes(marker)) {
        const parts = catatanMurni.split(marker);
        catatanMurni = parts[0].trim();
        const lines = (parts[1] || '').trim().split('\n');
        lines.forEach(line => {
            const match = line.trim().match(/^(.*)\s+\((Hadir\vert{}Sakit\vert{}Izin\vert{}Alfa)\)$/i);
            if (match) {
                const namaKey = match[1].trim().toLowerCase();
                const statusVal = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();
                presensiMap[namaKey] = statusVal;
            }
        });
    }
    document.getElementById('jurnalCatatan').value = catatanMurni;

    await loadSiswaForJurnal();
    document.querySelectorAll('#presensiTableBody tr').forEach(row => {
        const namaSiswa = (row.dataset.nama || '').trim().toLowerCase();
        const selectStatus = row.querySelector('.kehadiran-status');
        if (selectStatus && namaSiswa && presensiMap[namaSiswa]) {
            selectStatus.value = presensiMap[namaSiswa];
        }
    });

    const submitBtn = document.getElementById('submitJurnalButton');
    if (submitBtn) submitBtn.textContent = 'Update Jurnal & Presensi';

    const cancelBtn = document.getElementById('cancelJurnalEditButton');
    if (cancelBtn) cancelBtn.style.display = 'inline-block';

    document.getElementById('jurnalSection')?.scrollIntoView({ behavior: 'smooth' });
    showStatusMessage('Mode Ubah Jurnal aktif. Silakan perbarui data lalu klik "Update Jurnal & Presensi".', 'info');
};

window.deleteJurnalHandler = async function(jurnalId) {
    if (!confirm('Apakah Anda yakin ingin menghapus riwayat jurnal ini?')) return;
    showLoading(true);
    const { error } = await supabaseClient
        .from('jurnal_pelajaran')
        .delete()
        .eq('id', jurnalId)
        .eq('guru_id', AppState.user.id);
    showLoading(false);

    if (error) return showStatusMessage(`Gagal menghapus jurnal: ${error.message}`, 'error');
    showStatusMessage('Jurnal berhasil dihapus.', 'success');
    loadRiwayatJurnal();
};

// ====================================================================
// MODUL DISIPLIN (INPUT, EDIT, HAPUS)
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
        
        const filteredSiswa = AppState.students
            .filter(s => s.nama.toLowerCase().includes(query) || s.nisn.includes(query))
            .slice(0, 5);
        suggestionsContainer.innerHTML = filteredSiswa
            .map(s => `<div class="suggestion-item" data-nisn="${s.nisn}" data-nama="${s.nama}">${s.nama} (${s.nisn})</div>`)
            .join('');
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

function resetDisiplinForm() {
    document.getElementById('formDisiplin')?.reset();
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
    
    showLoading(true);
    let error = null;

    if (disiplinIdToUpdate) {
        const res = await supabaseClient
            .from('catatan_disiplin')
            .update({
                nisn_siswa: disiplinData.nisn_siswa,
                id_pelanggaran: disiplinData.id_pelanggaran
            })
            .eq('id', disiplinIdToUpdate);
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
    if (!catatan) return showStatusMessage('Catatan disiplin tidak ditemukan.', 'error');

    switchSection('disiplinSection');

    let idInput = document.getElementById('disiplinIdToUpdate');
    if (!idInput) {
        idInput = document.createElement('input');
        idInput.type = 'hidden';
        idInput.id = 'disiplinIdToUpdate';
        document.getElementById('formDisiplin')?.prepend(idInput);
    }
    idInput.value = catatan.id;

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
    if (submitBtn) submitBtn.textContent = 'Update Catatan Disiplin';

    const cancelBtn = document.getElementById('cancelDisiplinEditButton');
    if (cancelBtn) cancelBtn.style.display = 'inline-block';

    document.getElementById('disiplinSection')?.scrollIntoView({ behavior: 'smooth' });
    showStatusMessage('Mode Ubah Catatan Disiplin aktif. Silakan perbarui data lalu klik "Update Catatan Disiplin".', 'info');
};

window.deleteDisiplinHandler = async function(catatanId) {
    if (!confirm('Apakah Anda yakin ingin menghapus catatan kedisiplinan ini?')) return;
    showLoading(true);
    const { error } = await supabaseClient.from('catatan_disiplin').delete().eq('id', catatanId);
    showLoading(false);

    if (error) return showStatusMessage(`Gagal menghapus catatan: ${error.message}`, 'error');
    showStatusMessage('Catatan disiplin berhasil dihapus.', 'success');
    loadRiwayatDisiplin();
};

// ====================================================================
// MODUL NILAI (INPUT, AUTO-LOAD NILAI LAMA, EDIT, HAPUS, EKSPOR)
// ====================================================================
function renderTabelInputNilaiSiswa(kelas) {
    const tableBody = document.getElementById('nilaiTableBody');
    const siswaDiKelas = AppState.students.filter(s => s.kelas === kelas);
    
    if (siswaDiKelas.length === 0) {
        showStatusMessage(`Tidak ada data siswa ditemukan untuk kelas ${kelas}.`, 'error');
        document.getElementById('areaInputNilai').style.display = 'none';
        return false;
    }

    document.getElementById('areaInputNilai').style.display = 'block';
    
    tableBody.innerHTML = siswaDiKelas.map(siswa => `
        <tr data-nisn-row="${siswa.nisn}">
            <td data-label="NISN">${siswa.nisn}</td>
            <td data-label="Nama Siswa" style="font-weight: 500;">${siswa.nama}</td>
            <td data-label="Nilai">
                <input type="number" class="input-nilai-siswa" data-nisn="${siswa.nisn}" data-existing-id="" min="0" max="100" step="0.01" placeholder="0-100" style="padding: 0.4rem; border: 1px solid #ccc; border-radius: 4px; width: 110px;">
            </td>
        </tr>
    `).join('');

    return true;
}

/**
 * Mengisi otomatis kolom nilai siswa jika Jenis Penilaian sudah pernah diinput sebelumnya
 */
function populateExistingGradesInInputTable() {
    const ta = document.getElementById('nilaiFilterTahunAjaran').value;
    const semester = document.getElementById('nilaiFilterSemester').value;
    const kelas = document.getElementById('nilaiFilterKelas').value;
    const mapel = document.getElementById('nilaiFilterMataPelajaran').value;
    const jenisNilai = document.getElementById('jenisNilai').value.trim();

    const inputs = document.querySelectorAll('.input-nilai-siswa');
    if (inputs.length === 0) return;

    let ditemukanCount = 0;

    inputs.forEach(input => {
        const nisn = input.dataset.nisn;
        const existingRecord = AppState.allNilaiHistory.find(n =>
            n.tahun_ajaran === ta &&
            n.semester === semester &&
            n.kelas === kelas &&
            n.mata_pelajaran === mapel &&
            (n.jenis_penilaian || '').toLowerCase() === jenisNilai.toLowerCase() &&
            (n.nisn_siswa === nisn || n.siswa?.nisn === nisn)
        );

        if (existingRecord && jenisNilai !== '') {
            input.value = existingRecord.nilai;
            input.dataset.existingId = existingRecord.id;
            ditemukanCount++;
        } else {
            input.value = '';
            input.dataset.existingId = '';
        }
    });

    const submitBtn = document.getElementById('submitNilaiButton');
    const infoEl = document.getElementById('infoModeNilai');
    if (ditemukanCount > 0) {
        if (submitBtn) submitBtn.textContent = `Update / Simpan Nilai (${ditemukanCount} Data Terisi)`;
        if (infoEl) {
            infoEl.textContent = `✓ Ditemukan ${ditemukanCount} nilai tersimpan untuk "${jenisNilai}". Anda dapat langsung mengubahnya.`;
            infoEl.style.color = '#198754';
        }
    } else {
        if (submitBtn) submitBtn.textContent = 'Simpan Semua Nilai';
        if (infoEl) {
            infoEl.textContent = '*Jika jenis penilaian sudah pernah diinput, nilai lama otomatis dimuat dan dapat langsung diubah.';
            infoEl.style.color = 'var(--text-light)';
        }
    }
}

function handleLoadSiswaNilai(e) {
    if (e) e.preventDefault();
    const kelas = document.getElementById('nilaiFilterKelas').value;
    const berhasil = renderTabelInputNilaiSiswa(kelas);
    if (berhasil) {
        populateExistingGradesInInputTable();
    }
}

function resetNilaiForm() {
    document.getElementById('formInputNilai')?.reset();
    document.getElementById('areaInputNilai').style.display = 'none';
    const header = document.getElementById('headerNilaiDinamis');
    if (header) header.textContent = 'Nilai (...)';
    const submitBtn = document.getElementById('submitNilaiButton');
    if (submitBtn) submitBtn.textContent = 'Simpan Semua Nilai';
    const cancelBtn = document.getElementById('cancelNilaiEditButton');
    if (cancelBtn) cancelBtn.style.display = 'none';
}

async function handleSimpanSemuaNilai(e) {
    e.preventDefault();
    const ta = document.getElementById('nilaiFilterTahunAjaran').value;
    const semester = document.getElementById('nilaiFilterSemester').value;
    const kelas = document.getElementById('nilaiFilterKelas').value;
    const mapel = document.getElementById('nilaiFilterMataPelajaran').value;
    const jenisNilai = document.getElementById('jenisNilai').value.trim();
    const inputs = document.querySelectorAll('.input-nilai-siswa');

    const dataToInsert = [];
    const dataToUpdate = [];

    inputs.forEach(input => {
        if (input.value !== '') {
            const payload = {
                guru_id: AppState.user.id,
                tahun_ajaran: ta,
                semester: semester,
                kelas: kelas,
                mata_pelajaran: mapel,
                jenis_penilaian: jenisNilai,
                nisn_siswa: input.dataset.nisn,
                nilai: parseFloat(input.value)
            };

            const existingId = input.dataset.existingId;
            if (existingId) {
                dataToUpdate.push({ id: existingId, ...payload });
            } else {
                // Cek sekali lagi di memori apakah sudah ada
                const matchInMemory = AppState.allNilaiHistory.find(n =>
                    n.tahun_ajaran === ta &&
                    n.semester === semester &&
                    n.kelas === kelas &&
                    n.mata_pelajaran === mapel &&
                    (n.jenis_penilaian || '').toLowerCase() === jenisNilai.toLowerCase() &&
                    (n.nisn_siswa === input.dataset.nisn || n.siswa?.nisn === input.dataset.nisn)
                );
                if (matchInMemory) {
                    dataToUpdate.push({ id: matchInMemory.id, ...payload });
                } else {
                    dataToInsert.push(payload);
                }
            }
        }
    });

    if (dataToInsert.length === 0 && dataToUpdate.length === 0) {
        return showStatusMessage('Belum ada nilai siswa yang diisi (minimal isi 1 siswa).', 'error');
    }

    showLoading(true);
    let errorMsg = null;

    // 1. Jalankan Update untuk data nilai yang sudah ada
    for (const item of dataToUpdate) {
        const { id, ...updatePayload } = item;
        const { error } = await supabaseClient
            .from('nilai_siswa')
            .update(updatePayload)
            .eq('id', id)
            .eq('guru_id', AppState.user.id);
        if (error) {
            errorMsg = error.message;
            break;
        }
    }

    // 2. Jalankan Insert untuk data nilai siswa baru
    if (!errorMsg && dataToInsert.length > 0) {
        const { error } = await supabaseClient.from('nilai_siswa').insert(dataToInsert);
        if (error) errorMsg = error.message;
    }

    showLoading(false);

    if (errorMsg) {
        return showStatusMessage(`Gagal menyimpan nilai: ${errorMsg}`, 'error');
    }

    showStatusMessage(
        `Berhasil! ${dataToInsert.length} nilai baru disimpan & ${dataToUpdate.length} nilai diperbarui.`,
        'success'
    );
    resetNilaiForm();
    await loadRiwayatNilai();
}

/**
 * FUNGSI AKTIF: Ubah Nilai Siswa dari Tabel Rekap Nilai
 */
window.editNilaiHandler = function(nilaiId) {
    const record = AppState.allNilaiHistory.find(n => String(n.id) === String(nilaiId));
    if (!record) return showStatusMessage('Data nilai tidak ditemukan.', 'error');

    const targetNisn = record.nisn_siswa || record.siswa?.nisn || '';

    // 1. Pindah ke Section Input Nilai
    switchSection('nilaiSection');

    // 2. Isi Filter Tahun Ajaran, Semester, Kelas, dan Mapel
    ensureSelectOption('nilaiFilterTahunAjaran', record.tahun_ajaran, record.tahun_ajaran);
    ensureSelectOption('nilaiFilterSemester', record.semester, record.semester);
    ensureSelectOption('nilaiFilterKelas', record.kelas, record.kelas);
    ensureSelectOption('nilaiFilterMataPelajaran', record.mata_pelajaran, record.mata_pelajaran);

    // 3. Render tabel siswa kelas tersebut
    const berhasil = renderTabelInputNilaiSiswa(record.kelas);
    if (!berhasil) return;

    // 4. Isi Jenis Penilaian & muat semua nilai siswa pada penilaian tersebut
    const jenisInput = document.getElementById('jenisNilai');
    jenisInput.value = record.jenis_penilaian || '';
    const header = document.getElementById('headerNilaiDinamis');
    if (header) header.textContent = record.jenis_penilaian ? `Nilai (${record.jenis_penilaian})` : 'Nilai (...)';

    populateExistingGradesInInputTable();

    // 5. Tampilkan tombol Batal / Tutup
    const cancelBtn = document.getElementById('cancelNilaiEditButton');
    if (cancelBtn) cancelBtn.style.display = 'inline-block';

    // 6. Sorot (highlight) dan fokuskan ke baris siswa yang diklik
    const targetInput = document.querySelector(`.input-nilai-siswa[data-nisn="${targetNisn}"]`);
    if (targetInput) {
        const row = targetInput.closest('tr');
        if (row) {
            row.classList.remove('highlight-row');
            void row.offsetWidth; // trigger reflow
            row.classList.add('highlight-row');
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setTimeout(() => {
            targetInput.focus();
            targetInput.select();
        }, 300);
    }

    showStatusMessage(`Mode Ubah Nilai "${record.jenis_penilaian}" aktif. Silakan ubah nilai lalu klik Simpan.`, 'info');
};

window.deleteNilaiHandler = async function(nilaiId) {
    if (!confirm('Apakah Anda yakin ingin menghapus data nilai siswa ini?')) return;
    showLoading(true);
    const { error } = await supabaseClient
        .from('nilai_siswa')
        .delete()
        .eq('id', nilaiId)
        .eq('guru_id', AppState.user.id);
    showLoading(false);

    if (error) return showStatusMessage(`Gagal menghapus nilai: ${error.message}`, 'error');
    showStatusMessage('Data nilai berhasil dihapus.', 'success');
    loadRiwayatNilai();
};

async function loadRiwayatNilai() {
    showLoading(true);
    const { data, error } = await supabaseClient
        .from('nilai_siswa')
        .select(`id, tahun_ajaran, semester, kelas, mata_pelajaran, jenis_penilaian, nisn_siswa, nilai, created_at, siswa (nisn, nama)`)
        .eq('guru_id', AppState.user.id)
        .order('created_at', { ascending: false });
    
    showLoading(false);
    if (error) return showStatusMessage('Gagal memuat data rekap nilai.', 'error');
    
    AppState.allNilaiHistory = data || [];
    AppState.filteredNilaiHistory = data || [];
    renderRiwayatNilaiTable();
}

function renderRiwayatNilaiTable() {
    const tableBody = document.getElementById('riwayatNilaiTableBody');
    const areaKonversi = document.getElementById('areaKonversiExport');
    const exportAsliBtn = document.getElementById('exportNilaiAsliButton');

    if (AppState.filteredNilaiHistory.length === 0) {
        if (areaKonversi) areaKonversi.style.display = 'none';
        if (exportAsliBtn) exportAsliBtn.style.display = 'none';
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Tidak ada data nilai ditemukan sesuai filter.</td></tr>';
        return;
    }

    if (areaKonversi) areaKonversi.style.display = 'block';
    if (exportAsliBtn) exportAsliBtn.style.display = 'inline-block';

    tableBody.innerHTML = AppState.filteredNilaiHistory.map(n => `
        <tr>
            <td data-label="Tahun / Smt">${n.tahun_ajaran} (${n.semester})</td>
            <td data-label="NISN">${n.siswa?.nisn || n.nisn_siswa || '-'}</td>
            <td data-label="Nama Siswa">${n.siswa?.nama || '-'}</td>
            <td data-label="Penilaian">${n.jenis_penilaian} <small style="color:gray;">(${n.kelas} - ${n.mata_pelajaran})</small></td>
            <td data-label="Nilai Asli" data-sort="${n.nilai}" style="font-weight:bold; color:var(--primary-dark);">${n.nilai}</td>
            <td data-label="Aksi" style="text-align: right; white-space: nowrap;">
                <button class="btn btn-sm btn-secondary" onclick="editNilaiHandler('${n.id}')">Ubah</button>
                <button class="btn btn-sm btn-danger" onclick="deleteNilaiHandler('${n.id}')">Hapus</button>
            </td>
        </tr>
    `).join('');
}

function applyNilaiFilter() {
    const fTA = document.getElementById('rekapNilaiTA').value;
    const fSmt = document.getElementById('rekapNilaiSemester').value;
    const fKelas = document.getElementById('rekapNilaiKelas').value;
    const fMapel = document.getElementById('rekapNilaiMapel').value;

    AppState.filteredNilaiHistory = AppState.allNilaiHistory.filter(n => {
        return (!fTA || n.tahun_ajaran === fTA) && 
               (!fSmt || n.semester === fSmt) && 
               (!fKelas || n.kelas === fKelas) && 
               (!fMapel || n.mata_pelajaran === fMapel);
    });
    renderRiwayatNilaiTable();
}

/**
 * FUNGSI PEMBANTU: Menyusun Data Rekap Nilai Menjadi Bentuk Matriks (Pivot)
 * Baris = Siswa | Kolom = Jenis Penilaian (UH1, Tugas, PTS, PAS, dst.) + Rata-rata
 * @param {Array} records - Data nilai hasil filter (AppState.filteredNilaiHistory)
 * @param {boolean} useConversion - Apakah menggunakan rumus konversi nilai
 * @param {number} minTarget - Nilai minimum konversi
 * @param {number} maxTarget - Nilai maksimum konversi
 */
function buildMatrixNilaiData(records, useConversion = false, minTarget = 0, maxTarget = 100) {
    // 1. Kumpulkan semua jenis penilaian unik dan urutkan secara logis
    const jenisSet = new Set();
    records.forEach(r => {
        if (r.jenis_penilaian) jenisSet.add(r.jenis_penilaian.trim());
    });

    // Fungsi pemberi bobot urutan kolom agar UH -> Tugas -> PTS -> PAS tersusun rapi
    const getKategoriWeight = (namaPenilaian) => {
        const lower = namaPenilaian.toLowerCase();
        if (lower.includes('uh') || lower.includes('ulangan') || lower.includes('formatif') || lower.includes('kuis')) return 1;
        if (lower.includes('tugas') || lower.includes('praktek') || lower.includes('praktik') || lower.includes('proyek')) return 2;
        if (lower.includes('pts') || lower.includes('sts') || lower.includes('tengah')) return 3;
        if (lower.includes('pas') || lower.includes('sas') || lower.includes('pat') || lower.includes('akhir') || lower.includes('ujian')) return 4;
        return 2.5;
    };

    const jenisPenilaianList = Array.from(jenisSet).sort((a, b) => {
        const weightDiff = getKategoriWeight(a) - getKategoriWeight(b);
        if (weightDiff !== 0) return weightDiff;
        return a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' });
    });

    // 2. Kelompokkan nilai per Siswa (menggunakan kombinasi Kelas + Mapel + NISN)
    const siswaMap = new Map();

    records.forEach(r => {
        const nisn = r.siswa?.nisn || r.nisn_siswa || '-';
        const nama = r.siswa?.nama || AppState.students.find(s => s.nisn === nisn)?.nama || '-';
        const kelas = r.kelas || '-';
        const mapel = r.mata_pelajaran || '-';
        const key = `${ r.tahun_ajaran }_${ r.semester }_${ kelas }_${ mapel }_${ nisn }`;

        if (!siswaMap.has(key)) {
            siswaMap.set(key, {
                tahun_ajaran: r.tahun_ajaran || '-',
                semester: r.semester || '-',
                kelas: kelas,
                mata_pelajaran: mapel,
                nisn: nisn,
                nama: nama,
                scores: {}
            });
        }

        const nilaiAsli = parseFloat(r.nilai);
        if (!isNaN(nilaiAsli)) {
            let nilaiAkhir = nilaiAsli;
            if (useConversion) {
                nilaiAkhir = ((nilaiAsli / 100) * (maxTarget - minTarget)) + minTarget;
                nilaiAkhir = Math.round(nilaiAkhir * 100) / 100;
            }
            siswaMap.get(key).scores[r.jenis_penilaian.trim()] = nilaiAkhir;
        }
    });

    // 3. Urutkan baris siswa berdasarkan Kelas lalu Nama Siswa (A-Z)
    const sortedSiswaList = Array.from(siswaMap.values()).sort((a, b) => {
        const cmpKelas = a.kelas.localeCompare(b.kelas, 'id', { numeric: true, sensitivity: 'base' });
        if (cmpKelas !== 0) return cmpKelas;
        return a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' });
    });

    // 4. Bentuk baris objek untuk Sheet Excel
    return sortedSiswaList.map((s, index) => {
        const rowObj = {
            'No': index + 1,
            'Tahun Ajaran': s.tahun_ajaran,
            'Semester': s.semester,
            'Kelas': s.kelas,
            'Mata Pelajaran': s.mata_pelajaran,
            'NISN': s.nisn,
            'Nama Siswa': s.nama
        };

        let totalNilai = 0;
        let jumlahPenilaianDiikuti = 0;

        jenisPenilaianList.forEach(jenis => {
            const val = s.scores[jenis];
            if (val !== undefined && val !== null && val !== '') {
                rowObj[jenis] = val;
                totalNilai += val;
                jumlahPenilaianDiikuti++;
            } else {
                rowObj[jenis] = '-'; // Kosong jika siswa belum memiliki nilai pada penilaian tersebut
            }
        });

        rowObj['Rata-rata'] = jumlahPenilaianDiikuti > 0
            ? Math.round((totalNilai / jumlahPenilaianDiikuti) * 100) / 100
            : 0;

        return rowObj;
    });
}

/**
 * FUNGSI PEMBANTU: Mengatur Lebar Kolom Excel Secara Otomatis (Auto-Fit)
 */
function applyAutoColumnWidths(worksheet, jsonData) {
    if (!jsonData || jsonData.length === 0) return;
    const headers = Object.keys(jsonData[0]);
    worksheet['!cols'] = headers.map(header => {
        let maxLen = header.length;
        jsonData.forEach(row => {
            const cellVal = row[header] !== null && row[header] !== undefined ? String(row[header]) : '';
            if (cellVal.length > maxLen) maxLen = cellVal.length;
        });
        return { wch: Math.min(Math.max(maxLen + 3, 10), 40) };
    });
}

/**
 * EXPORT EXCEL 1: Nilai Asli (Sheet 1: Daftar Nilai, Sheet 2: Matriks Rekap Nilai)
 */
function exportRiwayatNilaiAsli() {
    if (AppState.filteredNilaiHistory.length === 0) {
        return showStatusMessage('Tidak ada data nilai untuk diekspor.', 'info');
    }

    // Sheet 1: Daftar Riwayat Nilai (Vertikal)
    const dataVertikal = AppState.filteredNilaiHistory.map(n => ({
        'Tahun Ajaran': n.tahun_ajaran,
        'Semester': n.semester,
        'Kelas': n.kelas,
        'Mata Pelajaran': n.mata_pelajaran,
        'Jenis Penilaian': n.jenis_penilaian,
        'NISN': n.siswa?.nisn || n.nisn_siswa || '-',
        'Nama Siswa': n.siswa?.nama || '-',
        'Nilai Asli': parseFloat(n.nilai) || 0
    }));

    // Sheet 2: Tabel Matriks (Siswa x Jenis Penilaian + Rata-rata)
    const dataMatriks = buildMatrixNilaiData(AppState.filteredNilaiHistory, false);

    const wb = XLSX.utils.book_new();

    const wsVertikal = XLSX.utils.json_to_sheet(dataVertikal);
    applyAutoColumnWidths(wsVertikal, dataVertikal);
    XLSX.utils.book_append_sheet(wb, wsVertikal, "Daftar Nilai Asli");

    const wsMatriks = XLSX.utils.json_to_sheet(dataMatriks);
    applyAutoColumnWidths(wsMatriks, dataMatriks);
    XLSX.utils.book_append_sheet(wb, wsMatriks, "Matriks Rekap Nilai");

    XLSX.writeFile(wb, `Rekap_Nilai_Asli_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showStatusMessage('File Excel (Daftar & Matriks Nilai Asli) berhasil diunduh!', 'success');
}

/**
 * EXPORT EXCEL 2: Nilai Konversi (Sheet 1: Daftar Nilai, Sheet 2: Matriks Konversi, Sheet 3: Matriks Asli)
 */
function exportRiwayatNilaiKonversi() {
    if (AppState.filteredNilaiHistory.length === 0) {
        return showStatusMessage('Tidak ada data nilai untuk diekspor.', 'info');
    }
    
    const minTarget = parseFloat(document.getElementById('konversiMin').value) || 0;
    const maxTarget = parseFloat(document.getElementById('konversiMax').value) || 100;

    // Sheet 1: Daftar Nilai (Vertikal)
    const dataVertikal = AppState.filteredNilaiHistory.map(n => {
        const nilaiAsli = parseFloat(n.nilai) || 0;
        let nilaiKonversi = ((nilaiAsli / 100) * (maxTarget - minTarget)) + minTarget;
        nilaiKonversi = Math.round(nilaiKonversi * 100) / 100;

        return {
            'Tahun Ajaran': n.tahun_ajaran,
            'Semester': n.semester,
            'Kelas': n.kelas,
            'Mata Pelajaran': n.mata_pelajaran,
            'Jenis Penilaian': n.jenis_penilaian,
            'NISN': n.siswa?.nisn || n.nisn_siswa || '-',
            'Nama Siswa': n.siswa?.nama || '-',
            'Nilai Asli': nilaiAsli,
            'Nilai Hasil Konversi': nilaiKonversi
        };
    });

    // Sheet 2: Tabel Matriks Nilai Hasil Konversi
    const dataMatriksKonversi = buildMatrixNilaiData(AppState.filteredNilaiHistory, true, minTarget, maxTarget);

    // Sheet 3: Tabel Matriks Nilai Asli
    const dataMatriksAsli = buildMatrixNilaiData(AppState.filteredNilaiHistory, false);

    const wb = XLSX.utils.book_new();

    const wsVertikal = XLSX.utils.json_to_sheet(dataVertikal);
    applyAutoColumnWidths(wsVertikal, dataVertikal);
    XLSX.utils.book_append_sheet(wb, wsVertikal, "Daftar Nilai");

    const wsMatriksKonversi = XLSX.utils.json_to_sheet(dataMatriksKonversi);
    applyAutoColumnWidths(wsMatriksKonversi, dataMatriksKonversi);
    XLSX.utils.book_append_sheet(wb, wsMatriksKonversi, "Matriks Nilai Konversi");

    const wsMatriksAsli = XLSX.utils.json_to_sheet(dataMatriksAsli);
    applyAutoColumnWidths(wsMatriksAsli, dataMatriksAsli);
    XLSX.utils.book_append_sheet(wb, wsMatriksAsli, "Matriks Nilai Asli");

    XLSX.writeFile(wb, `Rekap_Nilai_Konversi_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showStatusMessage('File Excel (Daftar & Matriks Nilai Konversi) berhasil diunduh!', 'success');
}

// ====================================================================
// MODUL RIWAYAT JURNAL & DISIPLIN (TAMPIL, FILTER, EKSPOR EXCEL)
// ====================================================================
async function loadRiwayatJurnal() {
    showLoading(true);
    const { data, error } = await supabaseClient
        .from('jurnal_pelajaran')
        .select('*')
        .eq('guru_id', AppState.user.id)
        .order('tanggal', { ascending: false });
    showLoading(false);
    
    if (error) return showStatusMessage('Gagal memuat data riwayat.', 'error');
    AppState.allJurnalHistory = data || [];
    AppState.filteredJurnalHistory = data || [];
    populateDropdown('riwayatFilterKelas', AppState.allJurnalHistory, 'kelas', 'kelas', 'Semua Kelas');
    populateDropdown('riwayatFilterMapel', AppState.allJurnalHistory, 'mata_pelajaran', 'mata_pelajaran', 'Semua Mapel');
    renderRiwayatJurnalTable();
}

function renderRiwayatJurnalTable() {
    const tableBody = document.getElementById('riwayatJurnalTableBody');
    const exportBtn = document.getElementById('exportRiwayatButton');
    if (exportBtn) {
        exportBtn.style.display = AppState.filteredJurnalHistory.length > 0 ? 'inline-block' : 'none';
    }
    
    if (AppState.filteredJurnalHistory.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Tidak ada riwayat ditemukan.</td></tr>';
        return;
    }
    
    tableBody.innerHTML = AppState.filteredJurnalHistory.map(j => `
        <tr>
            <td data-label="Tanggal" data-sort="${j.tanggal}">${new Date(j.tanggal).toLocaleDateString('id-ID')}</td>
            <td data-label="Kelas">${j.kelas}</td>
            <td data-label="Mapel">${j.mata_pelajaran}</td>
            <td data-label="Materi & Catatan">
                <strong>${j.materi}</strong><br>
                <span style="font-size:0.85em; color:gray;">${(j.catatan || '').replace(/\n/g, '<br>')}</span>
            </td>
            <td data-label="Aksi" style="text-align: right; white-space: nowrap;">
                <button class="btn btn-sm btn-secondary" onclick="editJurnalHandler('${j.id}')">Ubah</button>
                <button class="btn btn-sm btn-danger" onclick="deleteJurnalHandler('${j.id}')">Hapus</button>
            </td>
        </tr>
    `).join('');
}

async function loadRiwayatDisiplin() {
    showLoading(true);
    const { data, error } = await supabaseClient
        .from('catatan_disiplin')
        .select(`id, created_at, nisn_siswa, id_pelanggaran, pencatat_id, siswa (nisn, nama, kelas), pelanggaran_master (id, deskripsi, poin), profiles (full_name)`)
        .order('created_at', { ascending: false });
    showLoading(false);
    
    if (error) return showStatusMessage('Gagal memuat data riwayat disiplin.', 'error');
    AppState.allDisiplinHistory = data || [];
    AppState.filteredDisiplinHistory = data || [];
    renderRiwayatDisiplinTable();
}

function renderRiwayatDisiplinTable() {
    const tableBody = document.getElementById('riwayatDisiplinTableBody');
    const exportBtn = document.getElementById('exportRiwayatDisiplinButton');
    if (exportBtn) {
        exportBtn.style.display = AppState.filteredDisiplinHistory.length > 0 ? 'inline-block' : 'none';
    }

    if (AppState.filteredDisiplinHistory.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Tidak ada riwayat ditemukan.</td></tr>';
        return;
    }
    
    tableBody.innerHTML = AppState.filteredDisiplinHistory.map(d => {
        const poin = d.pelanggaran_master?.poin || 0;
        return `
            <tr>
                <td data-label="Tanggal" data-sort="${d.created_at}">${new Date(d.created_at).toLocaleDateString('id-ID')}</td>
                <td data-label="NISN">${d.siswa?.nisn || d.nisn_siswa || '-'}</td>
                <td data-label="Nama Siswa">${d.siswa?.nama || '-'}</td>
                <td data-label="Pelanggaran" data-sort="${poin}">${d.pelanggaran_master?.deskripsi || '-'} <strong>(${poin} Poin)</strong></td>
                <td data-label="Pencatat">${d.profiles?.full_name || '-'}</td>
                <td data-label="Aksi" style="text-align: right; white-space: nowrap;">
                    <button class="btn btn-sm btn-secondary" onclick="editDisiplinHandler('${d.id}')">Ubah</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteDisiplinHandler('${d.id}')">Hapus</button>
                </td>
            </tr>
        `;
    }).join('');
}

function applyJurnalFilter() {
    const fKelas = document.getElementById('riwayatFilterKelas').value;
    const fMapel = document.getElementById('riwayatFilterMapel').value;
    const fMulai = document.getElementById('riwayatFilterTanggalMulai').value;
    const fSelesai = document.getElementById('riwayatFilterTanggalSelesai').value;
    
    AppState.filteredJurnalHistory = AppState.allJurnalHistory.filter(j => {
        const tgl = new Date(j.tanggal);
        const mulai = fMulai ? new Date(fMulai) : null;
        const selesai = fSelesai ? new Date(fSelesai) : null;
        if (mulai) mulai.setHours(0, 0, 0, 0);
        if (selesai) selesai.setHours(23, 59, 59, 999);

        return (!fKelas || j.kelas === fKelas) && 
               (!fMapel || j.mata_pelajaran === fMapel) && 
               (!mulai || tgl >= mulai) && 
               (!selesai || tgl <= selesai);
    });
    renderRiwayatJurnalTable();
}

function applyDisiplinFilter() {
    const fNisn = document.getElementById('riwayatDisiplinFilterNisn').value.toLowerCase().trim();
    const fMulai = document.getElementById('riwayatDisiplinFilterTanggalMulai').value;
    const fSelesai = document.getElementById('riwayatDisiplinFilterTanggalSelesai').value;
    
    AppState.filteredDisiplinHistory = AppState.allDisiplinHistory.filter(d => {
        const tgl = new Date(d.created_at);
        const mulai = fMulai ? new Date(fMulai) : null;
        const selesai = fSelesai ? new Date(fSelesai) : null;
        if (mulai) mulai.setHours(0, 0, 0, 0);
        if (selesai) selesai.setHours(23, 59, 59, 999);

        const s = d.siswa || {};
        const nisnVal = (s.nisn || d.nisn_siswa || '').toLowerCase();
        const namaVal = (s.nama || '').toLowerCase();

        return (!fNisn || nisnVal.includes(fNisn) || namaVal.includes(fNisn)) && 
               (!mulai || tgl >= mulai) && 
               (!selesai || tgl <= selesai);
    });
    renderRiwayatDisiplinTable();
}

function exportRiwayatJurnal() {
    if (AppState.filteredJurnalHistory.length === 0) return;
    const dataToExport = AppState.filteredJurnalHistory.map(j => ({
        'Tanggal': new Date(j.tanggal).toLocaleDateString('id-ID'),
        'Kelas': j.kelas,
        'Mata Pelajaran': j.mata_pelajaran,
        'Materi': j.materi,
        'Catatan & Presensi': j.catatan
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataToExport), "Riwayat Jurnal");
    XLSX.writeFile(wb, `Jurnal_Mengajar_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function exportRiwayatDisiplin() {
    if (AppState.filteredDisiplinHistory.length === 0) {
        return showStatusMessage('Tidak ada data disiplin untuk diekspor.', 'info');
    }

    const dataToExport = AppState.filteredDisiplinHistory.map(d => {
        const nisn = d.siswa?.nisn || d.nisn_siswa || '-';
        const kelasSiswa = d.siswa?.kelas || AppState.students.find(s => s.nisn === nisn)?.kelas || '-';
        return {
            'Tanggal': new Date(d.created_at).toLocaleDateString('id-ID'),
            'NISN': nisn,
            'Nama Siswa': d.siswa?.nama || '-',
            'Kelas': kelasSiswa,
            'Jenis Pelanggaran': d.pelanggaran_master?.deskripsi || '-',
            'Poin Pelanggaran': Number(d.pelanggaran_master?.poin || 0),
            'Pencatat': d.profiles?.full_name || '-'
        };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataToExport), "Riwayat Disiplin");
    XLSX.writeFile(wb, `Riwayat_Disiplin_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ====================================================================
// SETUP EVENT LISTENERS UTAMA
// ====================================================================
document.addEventListener('DOMContentLoaded', async () => {
    if (!document.querySelector('.dashboard-wrapper')) return; 
    
    await initSession();
    await loadInitialData();
    setupSiswaSearch();
    initSortableTables();

    document.querySelectorAll('.sidebar-nav .btn-nav').forEach(button => {
        button.addEventListener('click', (e) => {
            const sectionId = e.currentTarget.dataset.section;
            switchSection(sectionId);

            if (sectionId === 'riwayatJurnalSection') loadRiwayatJurnal();
            if (sectionId === 'riwayatDisiplinSection') loadRiwayatDisiplin();
            if (sectionId === 'riwayatNilaiSection') loadRiwayatNilai();
        });
    });

    document.getElementById('logoutButton').addEventListener('click', async () => {
        if (!confirm('Apakah Anda yakin ingin logout?')) return;
        showLoading(true);
        await supabaseClient.auth.signOut();
        window.location.replace('index.html');
    });
    
    // Listeners Form Jurnal & Disiplin
    document.getElementById('formJurnal').addEventListener('submit', handleJurnalSubmit);
    document.getElementById('cancelJurnalEditButton')?.addEventListener('click', resetJurnalForm);
    document.getElementById('loadSiswaForJurnalButton').addEventListener('click', loadSiswaForJurnal);

    document.getElementById('formDisiplin').addEventListener('submit', handleDisiplinSubmit);
    document.getElementById('cancelDisiplinEditButton')?.addEventListener('click', resetDisiplinForm);
    
    // Listeners Form Nilai
    document.getElementById('formFilterNilai').addEventListener('submit', handleLoadSiswaNilai);
    document.getElementById('formInputNilai').addEventListener('submit', handleSimpanSemuaNilai);
    document.getElementById('cancelNilaiEditButton')?.addEventListener('click', resetNilaiForm);

    // Saat guru mengetik Jenis Penilaian, perbarui judul kolom & cek apakah sudah ada nilai tersimpan
    document.getElementById('jenisNilai')?.addEventListener('input', (e) => {
        const header = document.getElementById('headerNilaiDinamis');
        if (header) header.textContent = e.target.value ? `Nilai (${e.target.value})` : 'Nilai (...)';
        populateExistingGradesInInputTable();
    });

    // Listeners Rekap & Filter Jurnal
    document.getElementById('filterRiwayatButton').addEventListener('click', applyJurnalFilter);
    document.getElementById('refreshRiwayatButton').addEventListener('click', loadRiwayatJurnal);
    document.getElementById('exportRiwayatButton').addEventListener('click', exportRiwayatJurnal);
    
    // Listeners Rekap & Filter Disiplin
    document.getElementById('filterRiwayatDisiplinButton').addEventListener('click', applyDisiplinFilter);
    document.getElementById('refreshRiwayatDisiplinButton').addEventListener('click', loadRiwayatDisiplin);
    document.getElementById('exportRiwayatDisiplinButton')?.addEventListener('click', exportRiwayatDisiplin);

    // Listeners Rekap & Filter Nilai
    document.getElementById('filterRiwayatNilaiButton').addEventListener('click', applyNilaiFilter);
    document.getElementById('refreshRiwayatNilaiButton').addEventListener('click', loadRiwayatNilai);
    document.getElementById('exportNilaiAsliButton')?.addEventListener('click', exportRiwayatNilaiAsli);
    document.getElementById('exportRiwayatNilaiButton').addEventListener('click', exportRiwayatNilaiKonversi);

    // Kirim antrean data offline jika internet aktif saat pertama kali dibuka
    if (navigator.onLine) sinkronisasiDataOffline();
});
