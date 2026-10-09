/**
 * =================================================================
 * SCRIPT UTAMA DASHBOARD ADMIN - SISTEM JURNAL & DISIPLIN
 * =================================================================
 */

const SUPABASE_URL = 'https://pbfhvyqhshuvyakjfpka.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZmh2eXFoc2h1dnlha2pmcGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MTY1NTksImV4cCI6MjEwNjk5MjU1OX0.RMDKCmkniLHoCgxsFr0noBlbB4DoqH1CTZc4lRtnPNg';
const { createClient } = window.supabase;
var supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const AppState = { 
    user: null, 
    profile: null, 
    students: [], 
    teachers: [], 
    allAssignments: [], 
    allWaliKelas: [], 
    allPiket: [] 
};

// --- FUNGSI PEMBANTU ---
function showLoading(isLoading) { 
    document.getElementById('loadingIndicator').style.display = isLoading ? 'flex' : 'none'; 
}

function showStatusMessage(message, type = 'info', duration = 4000) {
    const statusEl = document.getElementById('statusMessage'); 
    statusEl.textContent = message; 
    statusEl.className = `status-message ${type}`; 
    statusEl.style.display = 'block'; 
    statusEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (duration > 0) setTimeout(() => { statusEl.style.display = 'none'; }, duration);
}

function populateDropdown(selectId, data, valField, txtField, defaultTxt) {
    const select = document.getElementById(selectId); 
    if (!select) return;
    select.innerHTML = `<option value="">-- ${defaultTxt} --</option>`;
    const unique = [...new Map(data.map(item => [item[valField], item])).values()];
    unique.forEach(item => { 
        const option = document.createElement('option'); 
        option.value = item[valField]; 
        option.textContent = item[txtField]; 
        select.appendChild(option); 
    });
}

// --- INISIALISASI ---
async function initDashboardPage() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return window.location.replace('index.html');
    
    AppState.user = session.user;
    const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', AppState.user.id).single();
    if(profile) {
        AppState.profile = profile;
        document.getElementById('welcomeMessage').textContent = `Admin: ${profile.full_name}`;
        if(profile.role === 'Admin') document.querySelectorAll('.admin-only').forEach(el => el.style.display = el.tagName === 'DIV' ? 'block' : 'inline-block');
    }

    await loadInitialData();
    setupDashboardListeners();
}

async function loadInitialData() {
    showLoading(true);
    if (AppState.profile.role === 'Admin') {
        const [teachers, assignments, walis, students, piket] = await Promise.all([
            supabaseClient.from('profiles').select('id, full_name').in('role', ['Guru', 'Wali Kelas']).order('full_name'),
            supabaseClient.from('penugasan_guru').select('*, profiles(full_name)').order('kelas'),
            supabaseClient.from('wali_kelas').select('*, profiles(full_name)').order('kelas'),
            supabaseClient.from('siswa').select('nisn, nama, kelas').order('nama'),
            supabaseClient.from('jadwal_piket').select('*').order('hari')
        ]);
        
        if (teachers.data) AppState.teachers = teachers.data;
        if (assignments.data) AppState.allAssignments = assignments.data;
        if (walis.data) AppState.allWaliKelas = walis.data;
        if (students.data) AppState.students = students.data;
        if (piket.data) AppState.allPiket = piket.data;

        populateDropdown('penugasanGuru', AppState.teachers, 'id', 'full_name', 'Pilih Guru');
        populateDropdown('waliKelasGuru', AppState.teachers, 'id', 'full_name', 'Pilih Guru/Wali');
        
        loadPenugasanTable(); 
        loadWaliKelasTable(); 
        loadSiswaTable(); 
        loadUsersTable(); 
        loadPiketTable();
    }
    showLoading(false);
}

// --- MODUL: JADWAL PIKET (BARU) ---
async function handlePiketSubmit(e) {
    e.preventDefault();
    const dataPiket = {
        nama_guru: document.getElementById('piketNamaGuru').value.trim(),
        nomor_wa: document.getElementById('piketNoWa').value.trim(),
        hari: document.getElementById('piketHari').value
    };
    showLoading(true);
    const { error } = await supabaseClient.from('jadwal_piket').insert(dataPiket);
    showLoading(false);
    
    if (error) return showStatusMessage(`Gagal menyimpan jadwal: ${error.message}`, 'error');
    showStatusMessage('Jadwal piket berhasil ditambahkan!', 'success');
    e.target.reset();
    
    const { data } = await supabaseClient.from('jadwal_piket').select('*').order('hari');
    if (data) AppState.allPiket = data;
    loadPiketTable();
}

function loadPiketTable() {
    const tableBody = document.getElementById('piketTableBody');
    if (!tableBody) return;
    if (AppState.allPiket.length === 0) return tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Belum ada jadwal piket.</td></tr>';
    
    // Sortir array berdasar urutan hari manual agar rapi
    const urutanHari = { "Senin": 1, "Selasa": 2, "Rabu": 3, "Kamis": 4, "Jumat": 5, "Sabtu": 6, "Minggu": 7 };
    const sortedPiket = [...AppState.allPiket].sort((a, b) => urutanHari[a.hari] - urutanHari[b.hari]);

    tableBody.innerHTML = sortedPiket.map(p => `
        <tr>
            <td data-label="Hari" style="font-weight:600;">${p.hari}</td>
            <td data-label="Nama Guru">${p.nama_guru}</td>
            <td data-label="WhatsApp">+${p.nomor_wa}</td>
            <td data-label="Aksi"><button class="btn btn-sm btn-danger" onclick="deletePiket('${p.id}')">Hapus</button></td>
        </tr>
    `).join('');
}

window.deletePiket = async function(id) {
    if (!confirm('Hapus jadwal piket ini?')) return;
    showLoading(true); 
    await supabaseClient.from('jadwal_piket').delete().eq('id', id); 
    showLoading(false);
    showStatusMessage('Jadwal dihapus.', 'success');
    const { data } = await supabaseClient.from('jadwal_piket').select('*').order('hari');
    if (data) AppState.allPiket = data; 
    loadPiketTable();
}

// --- MANAJEMEN WALI KELAS ---
async function handleWaliKelasSubmit(e) {
    e.preventDefault();
    const waliData = { 
        guru_id: document.getElementById('waliKelasGuru').value, 
        kelas: document.getElementById('waliKelasNama').value.trim() 
    };
    showLoading(true); 
    const { error } = await supabaseClient.from('wali_kelas').insert(waliData); 
    showLoading(false);
    if (error) return showStatusMessage(`Gagal menyimpan: ${error.message}`, 'error');
    showStatusMessage('Wali Kelas ditugaskan!', 'success'); e.target.reset();
    const { data } = await supabaseClient.from('wali_kelas').select('*, profiles(full_name)').order('kelas');
    if(data) AppState.allWaliKelas = data; loadWaliKelasTable();
}

function loadWaliKelasTable() {
    const tableBody = document.getElementById('waliKelasTableBody');
    if (AppState.allWaliKelas.length === 0) return tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Belum ada wali kelas ditugaskan.</td></tr>';
    tableBody.innerHTML = AppState.allWaliKelas.map(w => `
        <tr>
            <td data-label="Wali Kelas">${w.profiles ? w.profiles.full_name : 'Dihapus'}</td>
            <td data-label="Kelas">${w.kelas}</td>
            <td data-label="Aksi"><button class="btn btn-sm btn-danger" onclick="deleteWaliKelas('${w.id}')">Hapus</button></td>
        </tr>
    `).join('');
}

window.deleteWaliKelas = async function(id) {
    if (!confirm('Hapus wali kelas ini?')) return;
    showLoading(true); 
    await supabaseClient.from('wali_kelas').delete().eq('id', id); 
    showLoading(false);
    const { data } = await supabaseClient.from('wali_kelas').select('*, profiles(full_name)').order('kelas');
    if(data) AppState.allWaliKelas = data; 
    loadWaliKelasTable();
}

// --- MANAJEMEN PENUGASAN GURU ---
async function handlePenugasanSubmit(e) {
    e.preventDefault();
    const penugasanData = { 
        guru_id: document.getElementById('penugasanGuru').value, 
        kelas: document.getElementById('penugasanKelas').value.trim(), 
        mata_pelajaran: document.getElementById('penugasanMapel').value.trim() 
    };
    showLoading(true); 
    const { error } = await supabaseClient.from('penugasan_guru').insert(penugasanData); 
    showLoading(false);
    if (error) return showStatusMessage(`Gagal menyimpan: ${error.message}`, 'error');
    showStatusMessage('Penugasan disimpan!', 'success'); e.target.reset();
    const { data } = await supabaseClient.from('penugasan_guru').select('*, profiles(full_name)');
    if(data) AppState.allAssignments = data; loadPenugasanTable();
}

function loadPenugasanTable() {
    const tableBody = document.getElementById('penugasanTableBody');
    if (AppState.allAssignments.length === 0) return tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Belum ada penugasan.</td></tr>';
    tableBody.innerHTML = AppState.allAssignments.map(a => `
        <tr>
            <td data-label="Guru">${a.profiles ? a.profiles.full_name : 'Dihapus'}</td>
            <td data-label="Kelas">${a.kelas}</td>
            <td data-label="Mapel">${a.mata_pelajaran}</td>
            <td data-label="Aksi"><button class="btn btn-sm btn-danger" onclick="deletePenugasan('${a.id}')">Hapus</button></td>
        </tr>
    `).join('');
}

window.deletePenugasan = async function(id) {
    if (!confirm('Hapus penugasan ini?')) return;
    showLoading(true); 
    await supabaseClient.from('penugasan_guru').delete().eq('id', id); 
    showLoading(false);
    const { data } = await supabaseClient.from('penugasan_guru').select('*, profiles(full_name)');
    if(data) AppState.allAssignments = data; 
    loadPenugasanTable();
}

// --- MANAJEMEN PENGGUNA (AKUN) ---
async function handlePenggunaSubmit(event) {
    event.preventDefault();
    const userIdToUpdate = document.getElementById('formUserIdToUpdate').value;
    const nama = document.getElementById('formNamaPengguna').value;
    const email = document.getElementById('formEmailPengguna').value;
    const password = document.getElementById('formPasswordPengguna').value;
    const role = document.getElementById('formPeran').value;

    showLoading(true);
    if (userIdToUpdate) {
        if (password && password.length < 6) { showLoading(false); return showStatusMessage('Password minimal 6 karakter.', 'error'); }
        const { error } = await supabaseClient.rpc('admin_update_user', { target_id: userIdToUpdate, new_email: email, new_password: password || null, new_full_name: nama, new_role: role });
        showLoading(false);
        if (error) return showStatusMessage(`Gagal update: ${error.message}`, 'error');
        showStatusMessage('Data pengguna diperbarui.', 'success');
    } else {
        if (!password || password.length < 6) { showLoading(false); return showStatusMessage('Password minimal 6 karakter.', 'error'); }
        const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false }});
        const { error } = await tempClient.auth.signUp({ email: email, password: password, options: { data: { full_name: nama, role: role }}});
        showLoading(false);
        if (error) return showStatusMessage(`Gagal membuat pengguna: ${error.message}`, 'error');
        showStatusMessage(`Pengguna ${email} berhasil dibuat!`, 'success');
    }
    document.getElementById('formPengguna').reset(); 
    document.getElementById('formUserIdToUpdate').value = '';
    document.getElementById('submitPenggunaButton').textContent = 'Buat Pengguna'; 
    loadUsersTable();
}

async function loadUsersTable() {
    const tableBody = document.getElementById('penggunaTableBody');
    showLoading(true); 
    const { data, error } = await supabaseClient.rpc('get_all_users'); 
    showLoading(false);
    if (error) return tableBody.innerHTML = '<tr><td colspan="4">Gagal memuat pengguna.</td></tr>';
    tableBody.innerHTML = data.map(user => `
        <tr>
            <td data-label="Nama">${user.full_name}</td>
            <td data-label="Email">${user.email}</td>
            <td data-label="Peran">${user.role}</td>
            <td data-label="Aksi">
                <button class="btn btn-sm btn-secondary" onclick="editUserHandler('${user.id}', '${user.full_name.replace(/'/g,"\\'")}', '${user.email}', '${user.role}')" ${user.id===AppState.user.id?'disabled':''}>Ubah</button> 
                <button class="btn btn-sm btn-danger" onclick="deleteUserHandler('${user.id}')" ${user.id===AppState.user.id?'disabled':''}>Hapus</button>
            </td>
        </tr>
    `).join('');
}

window.editUserHandler = function(id, fullName, email, role) {
    document.getElementById('formUserIdToUpdate').value = id; 
    document.getElementById('formNamaPengguna').value = fullName; 
    document.getElementById('formEmailPengguna').value = email; 
    document.getElementById('formPeran').value = role;
    document.getElementById('formPasswordPengguna').required = false; 
    document.getElementById('submitPenggunaButton').textContent = 'Update Pengguna'; 
    document.getElementById('penggunaSection').scrollIntoView({ behavior: 'smooth' });
}

window.deleteUserHandler = async function(userId) {
    if (!confirm('Hapus pengguna ini dari sistem?')) return;
    showLoading(true); 
    await supabaseClient.rpc('admin_delete_user', { target_user_id: userId }); 
    showLoading(false);
    loadUsersTable();
}

// --- MANAJEMEN SISWA ---
async function handleSiswaSubmit(event) {
    event.preventDefault();
    const oldNisn = document.getElementById('formNisnOld').value;
    const siswaData = { 
        nisn: document.getElementById('formNisn').value.trim(), 
        nama: document.getElementById('formNama').value.trim(), 
        kelas: document.getElementById('formKelas').value.trim() 
    };
    
    showLoading(true);
    let error;
    if (oldNisn) { 
        const { error: e } = await supabaseClient.from('siswa').update(siswaData).eq('nisn', oldNisn); 
        error = e; 
    } else { 
        const { error: e } = await supabaseClient.from('siswa').insert(siswaData); 
        error = e; 
    }
    showLoading(false);
    
    if (error) return showStatusMessage(`Gagal menyimpan: ${error.message}`, 'error');
    showStatusMessage(oldNisn ? 'Data diperbarui.' : 'Siswa ditambahkan.', 'success');
    
    document.getElementById('formSiswa').reset(); 
    document.getElementById('formNisnOld').value = ''; 
    document.getElementById('saveSiswaButton').textContent = 'Simpan Data';
    
    const { data } = await supabaseClient.from('siswa').select('nisn, nama, kelas').order('nama');
    if(data) AppState.students = data; 
    loadSiswaTable();
}

function loadSiswaTable() {
    const tableBody = document.getElementById('siswaResultsTableBody');
    if(AppState.students.length === 0) return tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Belum ada data siswa.</td></tr>';
    
    tableBody.innerHTML = AppState.students.map(s => `
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

window.editSiswaHandler = function(nisn) {
    const siswa = AppState.students.find(s => s.nisn === nisn);
    if (!siswa) return;
    document.getElementById('formNisn').value = siswa.nisn;
    document.getElementById('formNama').value = siswa.nama;
    document.getElementById('formKelas').value = siswa.kelas;
    document.getElementById('formNisnOld').value = siswa.nisn;
    document.getElementById('saveSiswaButton').textContent = 'Update Data Siswa';
    document.getElementById('siswaSection').scrollIntoView({ behavior: 'smooth' });
};

window.deleteSiswaHandler = async function(nisn) {
    if (!confirm(`Hapus siswa dengan NISN ${nisn}?`)) return;
    showLoading(true); 
    await supabaseClient.from('siswa').delete().eq('nisn', nisn); 
    showLoading(false);
    AppState.students = AppState.students.filter(s => s.nisn !== nisn); 
    loadSiswaTable();
}

// --- EVENT LISTENERS ---
function setupDashboardListeners() {
    document.querySelectorAll('.sidebar-nav .btn-nav').forEach(button => {
        button.addEventListener('click', (e) => {
            const sectionId = e.currentTarget.dataset.section;
            document.querySelectorAll('.dashboard-content .content-section').forEach(s => s.style.display = 'none');
            const activeSection = document.getElementById(sectionId);
            if (activeSection) activeSection.style.display = 'block';
            document.querySelectorAll('.sidebar-nav .btn-nav').forEach(btn => btn.classList.remove('active'));
            e.currentTarget.classList.add('active');

            if (sectionId === 'penugasanSection') loadPenugasanTable();
            if (sectionId === 'waliKelasSection') loadWaliKelasTable();
            if (sectionId === 'siswaSection') loadSiswaTable();
            if (sectionId === 'penggunaSection') loadUsersTable();
            if (sectionId === 'piketSection') loadPiketTable();
        });
    });

    document.getElementById('logoutButton').addEventListener('click', async () => { 
        await supabaseClient.auth.signOut(); 
        window.location.replace('index.html'); 
    });
    
    document.getElementById('formPenugasan')?.addEventListener('submit', handlePenugasanSubmit);
    document.getElementById('formWaliKelas')?.addEventListener('submit', handleWaliKelasSubmit);
    document.getElementById('formPengguna')?.addEventListener('submit', handlePenggunaSubmit);
    document.getElementById('formPiket')?.addEventListener('submit', handlePiketSubmit);
    document.getElementById('formSiswa')?.addEventListener('submit', handleSiswaSubmit);
    
    // Fitur Reset Siswa
    document.getElementById('resetSiswaButton')?.addEventListener('click', () => {
        document.getElementById('formSiswa').reset(); 
        document.getElementById('formNisnOld').value = ''; 
        document.getElementById('saveSiswaButton').textContent = 'Simpan Data';
    });
}

document.addEventListener('DOMContentLoaded', initDashboardPage);/**
 * =================================================================
 * SCRIPT UTAMA DASHBOARD ADMIN - SISTEM JURNAL & DISIPLIN
 * =================================================================
 */

const SUPABASE_URL = 'https://pbfhvyqhshuvyakjfpka.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZmh2eXFoc2h1dnlha2pmcGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MTY1NTksImV4cCI6MjEwNjk5MjU1OX0.RMDKCmkniLHoCgxsFr0noBlbB4DoqH1CTZc4lRtnPNg';
const { createClient } = window.supabase;
var supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const AppState = { 
    user: null, 
    profile: null, 
    students: [], 
    teachers: [], 
    allAssignments: [], 
    allWaliKelas: [], 
    allPiket: [] 
};

// --- FUNGSI PEMBANTU ---
function showLoading(isLoading) { 
    document.getElementById('loadingIndicator').style.display = isLoading ? 'flex' : 'none'; 
}

function showStatusMessage(message, type = 'info', duration = 4000) {
    const statusEl = document.getElementById('statusMessage'); 
    statusEl.textContent = message; 
    statusEl.className = `status-message ${type}`; 
    statusEl.style.display = 'block'; 
    statusEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (duration > 0) setTimeout(() => { statusEl.style.display = 'none'; }, duration);
}

function populateDropdown(selectId, data, valField, txtField, defaultTxt) {
    const select = document.getElementById(selectId); 
    if (!select) return;
    select.innerHTML = `<option value="">-- ${defaultTxt} --</option>`;
    const unique = [...new Map(data.map(item => [item[valField], item])).values()];
    unique.forEach(item => { 
        const option = document.createElement('option'); 
        option.value = item[valField]; 
        option.textContent = item[txtField]; 
        select.appendChild(option); 
    });
}

// --- INISIALISASI ---
async function initDashboardPage() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return window.location.replace('index.html');
    
    AppState.user = session.user;
    const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', AppState.user.id).single();
    if(profile) {
        AppState.profile = profile;
        document.getElementById('welcomeMessage').textContent = `Admin: ${profile.full_name}`;
        if(profile.role === 'Admin') document.querySelectorAll('.admin-only').forEach(el => el.style.display = el.tagName === 'DIV' ? 'block' : 'inline-block');
    }

    await loadInitialData();
    setupDashboardListeners();
}

async function loadInitialData() {
    showLoading(true);
    if (AppState.profile.role === 'Admin') {
        const [teachers, assignments, walis, students, piket] = await Promise.all([
            supabaseClient.from('profiles').select('id, full_name').in('role', ['Guru', 'Wali Kelas']).order('full_name'),
            supabaseClient.from('penugasan_guru').select('*, profiles(full_name)').order('kelas'),
            supabaseClient.from('wali_kelas').select('*, profiles(full_name)').order('kelas'),
            supabaseClient.from('siswa').select('nisn, nama, kelas').order('nama'),
            supabaseClient.from('jadwal_piket').select('*').order('hari')
        ]);
        
        if (teachers.data) AppState.teachers = teachers.data;
        if (assignments.data) AppState.allAssignments = assignments.data;
        if (walis.data) AppState.allWaliKelas = walis.data;
        if (students.data) AppState.students = students.data;
        if (piket.data) AppState.allPiket = piket.data;

        populateDropdown('penugasanGuru', AppState.teachers, 'id', 'full_name', 'Pilih Guru');
        populateDropdown('waliKelasGuru', AppState.teachers, 'id', 'full_name', 'Pilih Guru/Wali');
        
        loadPenugasanTable(); 
        loadWaliKelasTable(); 
        loadSiswaTable(); 
        loadUsersTable(); 
        loadPiketTable();
    }
    showLoading(false);
}

// --- MODUL: JADWAL PIKET (BARU) ---
async function handlePiketSubmit(e) {
    e.preventDefault();
    const dataPiket = {
        nama_guru: document.getElementById('piketNamaGuru').value.trim(),
        nomor_wa: document.getElementById('piketNoWa').value.trim(),
        hari: document.getElementById('piketHari').value
    };
    showLoading(true);
    const { error } = await supabaseClient.from('jadwal_piket').insert(dataPiket);
    showLoading(false);
    
    if (error) return showStatusMessage(`Gagal menyimpan jadwal: ${error.message}`, 'error');
    showStatusMessage('Jadwal piket berhasil ditambahkan!', 'success');
    e.target.reset();
    
    const { data } = await supabaseClient.from('jadwal_piket').select('*').order('hari');
    if (data) AppState.allPiket = data;
    loadPiketTable();
}

function loadPiketTable() {
    const tableBody = document.getElementById('piketTableBody');
    if (!tableBody) return;
    if (AppState.allPiket.length === 0) return tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Belum ada jadwal piket.</td></tr>';
    
    // Sortir array berdasar urutan hari manual agar rapi
    const urutanHari = { "Senin": 1, "Selasa": 2, "Rabu": 3, "Kamis": 4, "Jumat": 5, "Sabtu": 6, "Minggu": 7 };
    const sortedPiket = [...AppState.allPiket].sort((a, b) => urutanHari[a.hari] - urutanHari[b.hari]);

    tableBody.innerHTML = sortedPiket.map(p => `
        <tr>
            <td data-label="Hari" style="font-weight:600;">${p.hari}</td>
            <td data-label="Nama Guru">${p.nama_guru}</td>
            <td data-label="WhatsApp">+${p.nomor_wa}</td>
            <td data-label="Aksi"><button class="btn btn-sm btn-danger" onclick="deletePiket('${p.id}')">Hapus</button></td>
        </tr>
    `).join('');
}

window.deletePiket = async function(id) {
    if (!confirm('Hapus jadwal piket ini?')) return;
    showLoading(true); 
    await supabaseClient.from('jadwal_piket').delete().eq('id', id); 
    showLoading(false);
    showStatusMessage('Jadwal dihapus.', 'success');
    const { data } = await supabaseClient.from('jadwal_piket').select('*').order('hari');
    if (data) AppState.allPiket = data; 
    loadPiketTable();
}

// --- MANAJEMEN WALI KELAS ---
async function handleWaliKelasSubmit(e) {
    e.preventDefault();
    const waliData = { 
        guru_id: document.getElementById('waliKelasGuru').value, 
        kelas: document.getElementById('waliKelasNama').value.trim() 
    };
    showLoading(true); 
    const { error } = await supabaseClient.from('wali_kelas').insert(waliData); 
    showLoading(false);
    if (error) return showStatusMessage(`Gagal menyimpan: ${error.message}`, 'error');
    showStatusMessage('Wali Kelas ditugaskan!', 'success'); e.target.reset();
    const { data } = await supabaseClient.from('wali_kelas').select('*, profiles(full_name)').order('kelas');
    if(data) AppState.allWaliKelas = data; loadWaliKelasTable();
}

function loadWaliKelasTable() {
    const tableBody = document.getElementById('waliKelasTableBody');
    if (AppState.allWaliKelas.length === 0) return tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Belum ada wali kelas ditugaskan.</td></tr>';
    tableBody.innerHTML = AppState.allWaliKelas.map(w => `
        <tr>
            <td data-label="Wali Kelas">${w.profiles ? w.profiles.full_name : 'Dihapus'}</td>
            <td data-label="Kelas">${w.kelas}</td>
            <td data-label="Aksi"><button class="btn btn-sm btn-danger" onclick="deleteWaliKelas('${w.id}')">Hapus</button></td>
        </tr>
    `).join('');
}

window.deleteWaliKelas = async function(id) {
    if (!confirm('Hapus wali kelas ini?')) return;
    showLoading(true); 
    await supabaseClient.from('wali_kelas').delete().eq('id', id); 
    showLoading(false);
    const { data } = await supabaseClient.from('wali_kelas').select('*, profiles(full_name)').order('kelas');
    if(data) AppState.allWaliKelas = data; 
    loadWaliKelasTable();
}

// --- MANAJEMEN PENUGASAN GURU ---
async function handlePenugasanSubmit(e) {
    e.preventDefault();
    const penugasanData = { 
        guru_id: document.getElementById('penugasanGuru').value, 
        kelas: document.getElementById('penugasanKelas').value.trim(), 
        mata_pelajaran: document.getElementById('penugasanMapel').value.trim() 
    };
    showLoading(true); 
    const { error } = await supabaseClient.from('penugasan_guru').insert(penugasanData); 
    showLoading(false);
    if (error) return showStatusMessage(`Gagal menyimpan: ${error.message}`, 'error');
    showStatusMessage('Penugasan disimpan!', 'success'); e.target.reset();
    const { data } = await supabaseClient.from('penugasan_guru').select('*, profiles(full_name)');
    if(data) AppState.allAssignments = data; loadPenugasanTable();
}

function loadPenugasanTable() {
    const tableBody = document.getElementById('penugasanTableBody');
    if (AppState.allAssignments.length === 0) return tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Belum ada penugasan.</td></tr>';
    tableBody.innerHTML = AppState.allAssignments.map(a => `
        <tr>
            <td data-label="Guru">${a.profiles ? a.profiles.full_name : 'Dihapus'}</td>
            <td data-label="Kelas">${a.kelas}</td>
            <td data-label="Mapel">${a.mata_pelajaran}</td>
            <td data-label="Aksi"><button class="btn btn-sm btn-danger" onclick="deletePenugasan('${a.id}')">Hapus</button></td>
        </tr>
    `).join('');
}

window.deletePenugasan = async function(id) {
    if (!confirm('Hapus penugasan ini?')) return;
    showLoading(true); 
    await supabaseClient.from('penugasan_guru').delete().eq('id', id); 
    showLoading(false);
    const { data } = await supabaseClient.from('penugasan_guru').select('*, profiles(full_name)');
    if(data) AppState.allAssignments = data; 
    loadPenugasanTable();
}

// --- MANAJEMEN PENGGUNA (AKUN) ---
async function handlePenggunaSubmit(event) {
    event.preventDefault();
    const userIdToUpdate = document.getElementById('formUserIdToUpdate').value;
    const nama = document.getElementById('formNamaPengguna').value;
    const email = document.getElementById('formEmailPengguna').value;
    const password = document.getElementById('formPasswordPengguna').value;
    const role = document.getElementById('formPeran').value;

    showLoading(true);
    if (userIdToUpdate) {
        if (password && password.length < 6) { showLoading(false); return showStatusMessage('Password minimal 6 karakter.', 'error'); }
        const { error } = await supabaseClient.rpc('admin_update_user', { target_id: userIdToUpdate, new_email: email, new_password: password || null, new_full_name: nama, new_role: role });
        showLoading(false);
        if (error) return showStatusMessage(`Gagal update: ${error.message}`, 'error');
        showStatusMessage('Data pengguna diperbarui.', 'success');
    } else {
        if (!password || password.length < 6) { showLoading(false); return showStatusMessage('Password minimal 6 karakter.', 'error'); }
        const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false }});
        const { error } = await tempClient.auth.signUp({ email: email, password: password, options: { data: { full_name: nama, role: role }}});
        showLoading(false);
        if (error) return showStatusMessage(`Gagal membuat pengguna: ${error.message}`, 'error');
        showStatusMessage(`Pengguna ${email} berhasil dibuat!`, 'success');
    }
    document.getElementById('formPengguna').reset(); 
    document.getElementById('formUserIdToUpdate').value = '';
    document.getElementById('submitPenggunaButton').textContent = 'Buat Pengguna'; 
    loadUsersTable();
}

async function loadUsersTable() {
    const tableBody = document.getElementById('penggunaTableBody');
    showLoading(true); 
    const { data, error } = await supabaseClient.rpc('get_all_users'); 
    showLoading(false);
    if (error) return tableBody.innerHTML = '<tr><td colspan="4">Gagal memuat pengguna.</td></tr>';
    tableBody.innerHTML = data.map(user => `
        <tr>
            <td data-label="Nama">${user.full_name}</td>
            <td data-label="Email">${user.email}</td>
            <td data-label="Peran">${user.role}</td>
            <td data-label="Aksi">
                <button class="btn btn-sm btn-secondary" onclick="editUserHandler('${user.id}', '${user.full_name.replace(/'/g,"\\'")}', '${user.email}', '${user.role}')" ${user.id===AppState.user.id?'disabled':''}>Ubah</button> 
                <button class="btn btn-sm btn-danger" onclick="deleteUserHandler('${user.id}')" ${user.id===AppState.user.id?'disabled':''}>Hapus</button>
            </td>
        </tr>
    `).join('');
}

window.editUserHandler = function(id, fullName, email, role) {
    document.getElementById('formUserIdToUpdate').value = id; 
    document.getElementById('formNamaPengguna').value = fullName; 
    document.getElementById('formEmailPengguna').value = email; 
    document.getElementById('formPeran').value = role;
    document.getElementById('formPasswordPengguna').required = false; 
    document.getElementById('submitPenggunaButton').textContent = 'Update Pengguna'; 
    document.getElementById('penggunaSection').scrollIntoView({ behavior: 'smooth' });
}

window.deleteUserHandler = async function(userId) {
    if (!confirm('Hapus pengguna ini dari sistem?')) return;
    showLoading(true); 
    await supabaseClient.rpc('admin_delete_user', { target_user_id: userId }); 
    showLoading(false);
    loadUsersTable();
}

// --- MANAJEMEN SISWA ---
async function handleSiswaSubmit(event) {
    event.preventDefault();
    const oldNisn = document.getElementById('formNisnOld').value;
    const siswaData = { 
        nisn: document.getElementById('formNisn').value.trim(), 
        nama: document.getElementById('formNama').value.trim(), 
        kelas: document.getElementById('formKelas').value.trim() 
    };
    
    showLoading(true);
    let error;
    if (oldNisn) { 
        const { error: e } = await supabaseClient.from('siswa').update(siswaData).eq('nisn', oldNisn); 
        error = e; 
    } else { 
        const { error: e } = await supabaseClient.from('siswa').insert(siswaData); 
        error = e; 
    }
    showLoading(false);
    
    if (error) return showStatusMessage(`Gagal menyimpan: ${error.message}`, 'error');
    showStatusMessage(oldNisn ? 'Data diperbarui.' : 'Siswa ditambahkan.', 'success');
    
    document.getElementById('formSiswa').reset(); 
    document.getElementById('formNisnOld').value = ''; 
    document.getElementById('saveSiswaButton').textContent = 'Simpan Data';
    
    const { data } = await supabaseClient.from('siswa').select('nisn, nama, kelas').order('nama');
    if(data) AppState.students = data; 
    loadSiswaTable();
}

function loadSiswaTable() {
    const tableBody = document.getElementById('siswaResultsTableBody');
    if(AppState.students.length === 0) return tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Belum ada data siswa.</td></tr>';
    
    tableBody.innerHTML = AppState.students.map(s => `
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

window.editSiswaHandler = function(nisn) {
    const siswa = AppState.students.find(s => s.nisn === nisn);
    if (!siswa) return;
    document.getElementById('formNisn').value = siswa.nisn;
    document.getElementById('formNama').value = siswa.nama;
    document.getElementById('formKelas').value = siswa.kelas;
    document.getElementById('formNisnOld').value = siswa.nisn;
    document.getElementById('saveSiswaButton').textContent = 'Update Data Siswa';
    document.getElementById('siswaSection').scrollIntoView({ behavior: 'smooth' });
};

window.deleteSiswaHandler = async function(nisn) {
    if (!confirm(`Hapus siswa dengan NISN ${nisn}?`)) return;
    showLoading(true); 
    await supabaseClient.from('siswa').delete().eq('nisn', nisn); 
    showLoading(false);
    AppState.students = AppState.students.filter(s => s.nisn !== nisn); 
    loadSiswaTable();
}

// --- EVENT LISTENERS ---
function setupDashboardListeners() {
    document.querySelectorAll('.sidebar-nav .btn-nav').forEach(button => {
        button.addEventListener('click', (e) => {
            const sectionId = e.currentTarget.dataset.section;
            document.querySelectorAll('.dashboard-content .content-section').forEach(s => s.style.display = 'none');
            const activeSection = document.getElementById(sectionId);
            if (activeSection) activeSection.style.display = 'block';
            document.querySelectorAll('.sidebar-nav .btn-nav').forEach(btn => btn.classList.remove('active'));
            e.currentTarget.classList.add('active');

            if (sectionId === 'penugasanSection') loadPenugasanTable();
            if (sectionId === 'waliKelasSection') loadWaliKelasTable();
            if (sectionId === 'siswaSection') loadSiswaTable();
            if (sectionId === 'penggunaSection') loadUsersTable();
            if (sectionId === 'piketSection') loadPiketTable();
        });
    });

    document.getElementById('logoutButton').addEventListener('click', async () => { 
        await supabaseClient.auth.signOut(); 
        window.location.replace('index.html'); 
    });
    
    document.getElementById('formPenugasan')?.addEventListener('submit', handlePenugasanSubmit);
    document.getElementById('formWaliKelas')?.addEventListener('submit', handleWaliKelasSubmit);
    document.getElementById('formPengguna')?.addEventListener('submit', handlePenggunaSubmit);
    document.getElementById('formPiket')?.addEventListener('submit', handlePiketSubmit);
    document.getElementById('formSiswa')?.addEventListener('submit', handleSiswaSubmit);
    
    // Fitur Reset Siswa
    document.getElementById('resetSiswaButton')?.addEventListener('click', () => {
        document.getElementById('formSiswa').reset(); 
        document.getElementById('formNisnOld').value = ''; 
        document.getElementById('saveSiswaButton').textContent = 'Simpan Data';
    });
}

document.addEventListener('DOMContentLoaded', initDashboardPage);/**
 * =================================================================
 * SCRIPT UTAMA DASHBOARD ADMIN - SISTEM JURNAL & DISIPLIN
 * =================================================================
 */

const SUPABASE_URL = 'https://pbfhvyqhshuvyakjfpka.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZmh2eXFoc2h1dnlha2pmcGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MTY1NTksImV4cCI6MjEwNjk5MjU1OX0.RMDKCmkniLHoCgxsFr0noBlbB4DoqH1CTZc4lRtnPNg';
const { createClient } = window.supabase;
var supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const AppState = { 
    user: null, 
    profile: null, 
    students: [], 
    teachers: [], 
    allAssignments: [], 
    allWaliKelas: [], 
    allPiket: [] 
};

// --- FUNGSI PEMBANTU ---
function showLoading(isLoading) { 
    document.getElementById('loadingIndicator').style.display = isLoading ? 'flex' : 'none'; 
}

function showStatusMessage(message, type = 'info', duration = 4000) {
    const statusEl = document.getElementById('statusMessage'); 
    statusEl.textContent = message; 
    statusEl.className = `status-message ${type}`; 
    statusEl.style.display = 'block'; 
    statusEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (duration > 0) setTimeout(() => { statusEl.style.display = 'none'; }, duration);
}

function populateDropdown(selectId, data, valField, txtField, defaultTxt) {
    const select = document.getElementById(selectId); 
    if (!select) return;
    select.innerHTML = `<option value="">-- ${defaultTxt} --</option>`;
    const unique = [...new Map(data.map(item => [item[valField], item])).values()];
    unique.forEach(item => { 
        const option = document.createElement('option'); 
        option.value = item[valField]; 
        option.textContent = item[txtField]; 
        select.appendChild(option); 
    });
}

// --- INISIALISASI ---
async function initDashboardPage() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return window.location.replace('index.html');
    
    AppState.user = session.user;
    const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', AppState.user.id).single();
    if(profile) {
        AppState.profile = profile;
        document.getElementById('welcomeMessage').textContent = `Admin: ${profile.full_name}`;
        if(profile.role === 'Admin') document.querySelectorAll('.admin-only').forEach(el => el.style.display = el.tagName === 'DIV' ? 'block' : 'inline-block');
    }

    await loadInitialData();
    setupDashboardListeners();
}

async function loadInitialData() {
    showLoading(true);
    if (AppState.profile.role === 'Admin') {
        const [teachers, assignments, walis, students, piket] = await Promise.all([
            supabaseClient.from('profiles').select('id, full_name').in('role', ['Guru', 'Wali Kelas']).order('full_name'),
            supabaseClient.from('penugasan_guru').select('*, profiles(full_name)').order('kelas'),
            supabaseClient.from('wali_kelas').select('*, profiles(full_name)').order('kelas'),
            supabaseClient.from('siswa').select('nisn, nama, kelas').order('nama'),
            supabaseClient.from('jadwal_piket').select('*').order('hari')
        ]);
        
        if (teachers.data) AppState.teachers = teachers.data;
        if (assignments.data) AppState.allAssignments = assignments.data;
        if (walis.data) AppState.allWaliKelas = walis.data;
        if (students.data) AppState.students = students.data;
        if (piket.data) AppState.allPiket = piket.data;

        populateDropdown('penugasanGuru', AppState.teachers, 'id', 'full_name', 'Pilih Guru');
        populateDropdown('waliKelasGuru', AppState.teachers, 'id', 'full_name', 'Pilih Guru/Wali');
        
        loadPenugasanTable(); 
        loadWaliKelasTable(); 
        loadSiswaTable(); 
        loadUsersTable(); 
        loadPiketTable();
    }
    showLoading(false);
}

// --- MODUL: JADWAL PIKET (BARU) ---
async function handlePiketSubmit(e) {
    e.preventDefault();
    const dataPiket = {
        nama_guru: document.getElementById('piketNamaGuru').value.trim(),
        nomor_wa: document.getElementById('piketNoWa').value.trim(),
        hari: document.getElementById('piketHari').value
    };
    showLoading(true);
    const { error } = await supabaseClient.from('jadwal_piket').insert(dataPiket);
    showLoading(false);
    
    if (error) return showStatusMessage(`Gagal menyimpan jadwal: ${error.message}`, 'error');
    showStatusMessage('Jadwal piket berhasil ditambahkan!', 'success');
    e.target.reset();
    
    const { data } = await supabaseClient.from('jadwal_piket').select('*').order('hari');
    if (data) AppState.allPiket = data;
    loadPiketTable();
}

function loadPiketTable() {
    const tableBody = document.getElementById('piketTableBody');
    if (!tableBody) return;
    if (AppState.allPiket.length === 0) return tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Belum ada jadwal piket.</td></tr>';
    
    // Sortir array berdasar urutan hari manual agar rapi
    const urutanHari = { "Senin": 1, "Selasa": 2, "Rabu": 3, "Kamis": 4, "Jumat": 5, "Sabtu": 6, "Minggu": 7 };
    const sortedPiket = [...AppState.allPiket].sort((a, b) => urutanHari[a.hari] - urutanHari[b.hari]);

    tableBody.innerHTML = sortedPiket.map(p => `
        <tr>
            <td data-label="Hari" style="font-weight:600;">${p.hari}</td>
            <td data-label="Nama Guru">${p.nama_guru}</td>
            <td data-label="WhatsApp">+${p.nomor_wa}</td>
            <td data-label="Aksi"><button class="btn btn-sm btn-danger" onclick="deletePiket('${p.id}')">Hapus</button></td>
        </tr>
    `).join('');
}

window.deletePiket = async function(id) {
    if (!confirm('Hapus jadwal piket ini?')) return;
    showLoading(true); 
    await supabaseClient.from('jadwal_piket').delete().eq('id', id); 
    showLoading(false);
    showStatusMessage('Jadwal dihapus.', 'success');
    const { data } = await supabaseClient.from('jadwal_piket').select('*').order('hari');
    if (data) AppState.allPiket = data; 
    loadPiketTable();
}

// --- MANAJEMEN WALI KELAS ---
async function handleWaliKelasSubmit(e) {
    e.preventDefault();
    const waliData = { 
        guru_id: document.getElementById('waliKelasGuru').value, 
        kelas: document.getElementById('waliKelasNama').value.trim() 
    };
    showLoading(true); 
    const { error } = await supabaseClient.from('wali_kelas').insert(waliData); 
    showLoading(false);
    if (error) return showStatusMessage(`Gagal menyimpan: ${error.message}`, 'error');
    showStatusMessage('Wali Kelas ditugaskan!', 'success'); e.target.reset();
    const { data } = await supabaseClient.from('wali_kelas').select('*, profiles(full_name)').order('kelas');
    if(data) AppState.allWaliKelas = data; loadWaliKelasTable();
}

function loadWaliKelasTable() {
    const tableBody = document.getElementById('waliKelasTableBody');
    if (AppState.allWaliKelas.length === 0) return tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Belum ada wali kelas ditugaskan.</td></tr>';
    tableBody.innerHTML = AppState.allWaliKelas.map(w => `
        <tr>
            <td data-label="Wali Kelas">${w.profiles ? w.profiles.full_name : 'Dihapus'}</td>
            <td data-label="Kelas">${w.kelas}</td>
            <td data-label="Aksi"><button class="btn btn-sm btn-danger" onclick="deleteWaliKelas('${w.id}')">Hapus</button></td>
        </tr>
    `).join('');
}

window.deleteWaliKelas = async function(id) {
    if (!confirm('Hapus wali kelas ini?')) return;
    showLoading(true); 
    await supabaseClient.from('wali_kelas').delete().eq('id', id); 
    showLoading(false);
    const { data } = await supabaseClient.from('wali_kelas').select('*, profiles(full_name)').order('kelas');
    if(data) AppState.allWaliKelas = data; 
    loadWaliKelasTable();
}

// --- MANAJEMEN PENUGASAN GURU ---
async function handlePenugasanSubmit(e) {
    e.preventDefault();
    const penugasanData = { 
        guru_id: document.getElementById('penugasanGuru').value, 
        kelas: document.getElementById('penugasanKelas').value.trim(), 
        mata_pelajaran: document.getElementById('penugasanMapel').value.trim() 
    };
    showLoading(true); 
    const { error } = await supabaseClient.from('penugasan_guru').insert(penugasanData); 
    showLoading(false);
    if (error) return showStatusMessage(`Gagal menyimpan: ${error.message}`, 'error');
    showStatusMessage('Penugasan disimpan!', 'success'); e.target.reset();
    const { data } = await supabaseClient.from('penugasan_guru').select('*, profiles(full_name)');
    if(data) AppState.allAssignments = data; loadPenugasanTable();
}

function loadPenugasanTable() {
    const tableBody = document.getElementById('penugasanTableBody');
    if (AppState.allAssignments.length === 0) return tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Belum ada penugasan.</td></tr>';
    tableBody.innerHTML = AppState.allAssignments.map(a => `
        <tr>
            <td data-label="Guru">${a.profiles ? a.profiles.full_name : 'Dihapus'}</td>
            <td data-label="Kelas">${a.kelas}</td>
            <td data-label="Mapel">${a.mata_pelajaran}</td>
            <td data-label="Aksi"><button class="btn btn-sm btn-danger" onclick="deletePenugasan('${a.id}')">Hapus</button></td>
        </tr>
    `).join('');
}

window.deletePenugasan = async function(id) {
    if (!confirm('Hapus penugasan ini?')) return;
    showLoading(true); 
    await supabaseClient.from('penugasan_guru').delete().eq('id', id); 
    showLoading(false);
    const { data } = await supabaseClient.from('penugasan_guru').select('*, profiles(full_name)');
    if(data) AppState.allAssignments = data; 
    loadPenugasanTable();
}

// --- MANAJEMEN PENGGUNA (AKUN) ---
async function handlePenggunaSubmit(event) {
    event.preventDefault();
    const userIdToUpdate = document.getElementById('formUserIdToUpdate').value;
    const nama = document.getElementById('formNamaPengguna').value;
    const email = document.getElementById('formEmailPengguna').value;
    const password = document.getElementById('formPasswordPengguna').value;
    const role = document.getElementById('formPeran').value;

    showLoading(true);
    if (userIdToUpdate) {
        if (password && password.length < 6) { showLoading(false); return showStatusMessage('Password minimal 6 karakter.', 'error'); }
        const { error } = await supabaseClient.rpc('admin_update_user', { target_id: userIdToUpdate, new_email: email, new_password: password || null, new_full_name: nama, new_role: role });
        showLoading(false);
        if (error) return showStatusMessage(`Gagal update: ${error.message}`, 'error');
        showStatusMessage('Data pengguna diperbarui.', 'success');
    } else {
        if (!password || password.length < 6) { showLoading(false); return showStatusMessage('Password minimal 6 karakter.', 'error'); }
        const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false }});
        const { error } = await tempClient.auth.signUp({ email: email, password: password, options: { data: { full_name: nama, role: role }}});
        showLoading(false);
        if (error) return showStatusMessage(`Gagal membuat pengguna: ${error.message}`, 'error');
        showStatusMessage(`Pengguna ${email} berhasil dibuat!`, 'success');
    }
    document.getElementById('formPengguna').reset(); 
    document.getElementById('formUserIdToUpdate').value = '';
    document.getElementById('submitPenggunaButton').textContent = 'Buat Pengguna'; 
    loadUsersTable();
}

async function loadUsersTable() {
    const tableBody = document.getElementById('penggunaTableBody');
    showLoading(true); 
    const { data, error } = await supabaseClient.rpc('get_all_users'); 
    showLoading(false);
    if (error) return tableBody.innerHTML = '<tr><td colspan="4">Gagal memuat pengguna.</td></tr>';
    tableBody.innerHTML = data.map(user => `
        <tr>
            <td data-label="Nama">${user.full_name}</td>
            <td data-label="Email">${user.email}</td>
            <td data-label="Peran">${user.role}</td>
            <td data-label="Aksi">
                <button class="btn btn-sm btn-secondary" onclick="editUserHandler('${user.id}', '${user.full_name.replace(/'/g,"\\'")}', '${user.email}', '${user.role}')" ${user.id===AppState.user.id?'disabled':''}>Ubah</button> 
                <button class="btn btn-sm btn-danger" onclick="deleteUserHandler('${user.id}')" ${user.id===AppState.user.id?'disabled':''}>Hapus</button>
            </td>
        </tr>
    `).join('');
}

window.editUserHandler = function(id, fullName, email, role) {
    document.getElementById('formUserIdToUpdate').value = id; 
    document.getElementById('formNamaPengguna').value = fullName; 
    document.getElementById('formEmailPengguna').value = email; 
    document.getElementById('formPeran').value = role;
    document.getElementById('formPasswordPengguna').required = false; 
    document.getElementById('submitPenggunaButton').textContent = 'Update Pengguna'; 
    document.getElementById('penggunaSection').scrollIntoView({ behavior: 'smooth' });
}

window.deleteUserHandler = async function(userId) {
    if (!confirm('Hapus pengguna ini dari sistem?')) return;
    showLoading(true); 
    await supabaseClient.rpc('admin_delete_user', { target_user_id: userId }); 
    showLoading(false);
    loadUsersTable();
}

// --- MANAJEMEN SISWA ---
async function handleSiswaSubmit(event) {
    event.preventDefault();
    const oldNisn = document.getElementById('formNisnOld').value;
    const siswaData = { 
        nisn: document.getElementById('formNisn').value.trim(), 
        nama: document.getElementById('formNama').value.trim(), 
        kelas: document.getElementById('formKelas').value.trim() 
    };
    
    showLoading(true);
    let error;
    if (oldNisn) { 
        const { error: e } = await supabaseClient.from('siswa').update(siswaData).eq('nisn', oldNisn); 
        error = e; 
    } else { 
        const { error: e } = await supabaseClient.from('siswa').insert(siswaData); 
        error = e; 
    }
    showLoading(false);
    
    if (error) return showStatusMessage(`Gagal menyimpan: ${error.message}`, 'error');
    showStatusMessage(oldNisn ? 'Data diperbarui.' : 'Siswa ditambahkan.', 'success');
    
    document.getElementById('formSiswa').reset(); 
    document.getElementById('formNisnOld').value = ''; 
    document.getElementById('saveSiswaButton').textContent = 'Simpan Data';
    
    const { data } = await supabaseClient.from('siswa').select('nisn, nama, kelas').order('nama');
    if(data) AppState.students = data; 
    loadSiswaTable();
}

function loadSiswaTable() {
    const tableBody = document.getElementById('siswaResultsTableBody');
    if(AppState.students.length === 0) return tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Belum ada data siswa.</td></tr>';
    
    tableBody.innerHTML = AppState.students.map(s => `
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

window.editSiswaHandler = function(nisn) {
    const siswa = AppState.students.find(s => s.nisn === nisn);
    if (!siswa) return;
    document.getElementById('formNisn').value = siswa.nisn;
    document.getElementById('formNama').value = siswa.nama;
    document.getElementById('formKelas').value = siswa.kelas;
    document.getElementById('formNisnOld').value = siswa.nisn;
    document.getElementById('saveSiswaButton').textContent = 'Update Data Siswa';
    document.getElementById('siswaSection').scrollIntoView({ behavior: 'smooth' });
};

window.deleteSiswaHandler = async function(nisn) {
    if (!confirm(`Hapus siswa dengan NISN ${nisn}?`)) return;
    showLoading(true); 
    await supabaseClient.from('siswa').delete().eq('nisn', nisn); 
    showLoading(false);
    AppState.students = AppState.students.filter(s => s.nisn !== nisn); 
    loadSiswaTable();
}

// --- EVENT LISTENERS ---
function setupDashboardListeners() {
    document.querySelectorAll('.sidebar-nav .btn-nav').forEach(button => {
        button.addEventListener('click', (e) => {
            const sectionId = e.currentTarget.dataset.section;
            document.querySelectorAll('.dashboard-content .content-section').forEach(s => s.style.display = 'none');
            const activeSection = document.getElementById(sectionId);
            if (activeSection) activeSection.style.display = 'block';
            document.querySelectorAll('.sidebar-nav .btn-nav').forEach(btn => btn.classList.remove('active'));
            e.currentTarget.classList.add('active');

            if (sectionId === 'penugasanSection') loadPenugasanTable();
            if (sectionId === 'waliKelasSection') loadWaliKelasTable();
            if (sectionId === 'siswaSection') loadSiswaTable();
            if (sectionId === 'penggunaSection') loadUsersTable();
            if (sectionId === 'piketSection') loadPiketTable();
        });
    });

    document.getElementById('logoutButton').addEventListener('click', async () => { 
        await supabaseClient.auth.signOut(); 
        window.location.replace('index.html'); 
    });
    
    document.getElementById('formPenugasan')?.addEventListener('submit', handlePenugasanSubmit);
    document.getElementById('formWaliKelas')?.addEventListener('submit', handleWaliKelasSubmit);
    document.getElementById('formPengguna')?.addEventListener('submit', handlePenggunaSubmit);
    document.getElementById('formPiket')?.addEventListener('submit', handlePiketSubmit);
    document.getElementById('formSiswa')?.addEventListener('submit', handleSiswaSubmit);
    
    // Fitur Reset Siswa
    document.getElementById('resetSiswaButton')?.addEventListener('click', () => {
        document.getElementById('formSiswa').reset(); 
        document.getElementById('formNisnOld').value = ''; 
        document.getElementById('saveSiswaButton').textContent = 'Simpan Data';
    });
}

document.addEventListener('DOMContentLoaded', initDashboardPage);
