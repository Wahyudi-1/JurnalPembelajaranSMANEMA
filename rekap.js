/**
 * ====================================================================
 * SCRIPT EXECUTIVE DASHBOARD KEPALA SEKOLAH (ANALITIK, GRAFIK & EXPORT)
 * ====================================================================
 * @version 2.0 - Dilengkapi Kepatuhan Harian Guru, Analitik Rombel & Wali Kelas,
 *                Evaluasi Poin Siswa Rawan (BK), Sortir Tabel, & Multi-Sheet Export
 */

const SUPABASE_URL = 'https://pbfhvyqhshuvyakjfpka.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZmh2eXFoc2h1dnlha2pmcGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MTY1NTksImV4cCI6MjEwNjk5MjU1OX0.RMDKCmkniLHoCgxsFr0noBlbB4DoqH1CTZc4lRtnPNg';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const State = {
    allJurnal: [],
    filteredJurnal: [],
    allDisiplin: [],
    filteredDisiplin: [],
    allSiswa: [],
    allPenugasan: [],
    allWaliKelas: [],
    allTeachers: [],
    guruList: [],
    kelasList: [],
    rekapGuruData: [],
    rekapKelasData: [],
    rekapAbsenSiswaList: [],
    rekapSiswaRawanList: []
};

// Penyimpanan instance Chart.js agar dapat di-destroy sebelum render ulang
let charts = {
    trenGlobal: null,
    disiplinGlobal: null,
    poinKelasGlobal: null,
    trenDisiplinGlobal: null,
    aktivitasGuru: null,
    aktivitasKelas: null,
    pieHadir: null,
    barAbsenKelas: null
};

// --- FUNGSI HELPER UI ---
function showLoading(show) {
    const el = document.getElementById('loadingIndicator');
    if (el) el.style.display = show ? 'flex' : 'none';
}

function showStatusMessage(message, type = 'info', duration = 3500) {
    const statusEl = document.getElementById('statusMessage');
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    statusEl.style.display = 'block';
    if (duration > 0) {
        setTimeout(() => { statusEl.style.display = 'none'; }, duration);
    }
}

function getLocalISODate(dateObj = new Date()) {
    const tzOffset = dateObj.getTimezoneOffset() * 60000;
    return new Date(dateObj.getTime() - tzOffset).toISOString().split('T')[0];
}

/**
 * Ekstraksi daftar ketidakhadiran dari teks catatan jurnal
 */
function parsePresensiFromCatatan(catatanText) {
    const result = [];
    if (!catatanText || !catatanText.includes('--- PRESENSI')) return result;

    const parts = catatanText.split('--- PRESENSI');
    const lines = (parts[1] || '').split('\n');
    lines.forEach(line => {
        const match = line.trim().match(/^(.+?)\s*\((Sakit|Izin|Alfa)\)$/i);
        if (match) {
            result.push({
                nama: match[1].trim(),
                status: match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase()
            });
        }
    });
    return result;
}

// --- OTENTIKASI SESI ---
async function initSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return window.location.replace('index.html');
    
    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (profile) {
        if (profile.role !== 'Kepala Sekolah' && profile.role !== 'Admin') {
            return window.location.replace('index.html');
        }
        document.getElementById('welcomeMessage').textContent = `Bapak/Ibu ${profile.full_name}`;
    }
}

// --- FETCH DATA GLOBAL DARI SUPABASE ---
async function fetchAllData(isManualRefresh = false) {
    showLoading(true);
    
    const [jurnalRes, disiplinRes, siswaRes, penugasanRes, waliRes, guruRes] = await Promise.all([
        supabaseClient.from('jurnal_pelajaran').select('*, profiles(full_name)').order('tanggal', { ascending: false }),
        supabaseClient.from('catatan_disiplin').select('id, created_at, nisn_siswa, siswa(nisn, nama, kelas), pelanggaran_master(deskripsi, poin), profiles(full_name)').order('created_at', { ascending: false }),
        supabaseClient.from('siswa').select('nisn, nama, kelas').order('nama'),
        supabaseClient.from('penugasan_guru').select('*, profiles(full_name)').order('kelas'),
        supabaseClient.from('wali_kelas').select('*, profiles(full_name)').order('kelas'),
        supabaseClient.from('profiles').select('id, full_name, role').in('role', ['Guru', 'Wali Kelas']).order('full_name')
    ]);
    
    showLoading(false);

    if (jurnalRes.data) {
        State.allJurnal = jurnalRes.data;
        State.filteredJurnal = jurnalRes.data;
    }
    if (disiplinRes.data) {
        State.allDisiplin = disiplinRes.data;
        State.filteredDisiplin = disiplinRes.data;
    }
    if (siswaRes.data) State.allSiswa = siswaRes.data;
    if (penugasanRes.data) State.allPenugasan = penugasanRes.data;
    if (waliRes.data) State.allWaliKelas = waliRes.data;
    if (guruRes.data) State.allTeachers = guruRes.data;

    // Kumpulkan Daftar Guru Unik (Gabungan dari tabel profiles, penugasan, dan jurnal)
    const guruSet = new Set([
        ...State.allTeachers.map(t => t.full_name),
        ...State.allPenugasan.map(p => p.profiles?.full_name),
        ...State.allJurnal.map(j => j.profiles?.full_name)
    ].filter(Boolean));
    State.guruList = [...guruSet].sort();

    // Kumpulkan Daftar Kelas Unik (Gabungan dari siswa, penugasan, dan jurnal)
    const kelasSet = new Set([
        ...State.allSiswa.map(s => s.kelas),
        ...State.allPenugasan.map(p => p.kelas),
        ...State.allJurnal.map(j => j.kelas)
    ].filter(Boolean));
    State.kelasList = [...kelasSet].sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));

    populateAllDropdowns();

    // Set Default Tanggal & Bulan jika belum terisi
    const now = new Date();
    const bulanInput = document.getElementById('hadirBulanInput');
    if (bulanInput && !bulanInput.value) {
        bulanInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    const kepatuhanDateInput = document.getElementById('kepatuhanTanggalInput');
    if (kepatuhanDateInput && !kepatuhanDateInput.value) {
        kepatuhanDateInput.value = getLocalISODate(now);
    }

    // Update Waktu Sinkronisasi
    const lastUpd = document.getElementById('lastUpdatedText');
    if (lastUpd) {
        lastUpd.textContent = `Terakhir diperbarui: ${now.toLocaleDateString('id-ID')} pukul ${now.toLocaleTimeString('id-ID')}`;
    }

    // Render Seluruh Modul Analitik
    updateDashboardUmum();
    renderKepatuhanGuruHarian();
    renderRekapKinerjaGuruTable();
    updateChartGuru();
    updateChartKelas();
    renderRekapKelasTable();
    generateAnalisisKehadiran();
    renderSiswaRawanTable();
    renderJurnalTable();
    renderDisiplinTable();

    if (isManualRefresh) {
        showStatusMessage('Seluruh data analitik berhasil diperbarui dari server!', 'success');
    }
}

function populateAllDropdowns() {
    const fillSelect = (id, items, defaultText, defaultVal = '') => {
        const el = document.getElementById(id);
        if (!el) return;
        const currentVal = el.value;
        el.innerHTML = `<option value="${defaultVal}">${defaultText}</option>` +
            items.map(item => `<option value="${item}">${item}</option>`).join('');
        if (items.includes(currentVal) || currentVal === defaultVal) el.value = currentVal;
    };

    fillSelect('filterGuruJurnal', State.guruList, '-- Semua Guru --', '');
    fillSelect('chartGuruSelect', State.guruList, '-- Seluruh Guru (Perbandingan Global) --', 'ALL');
    fillSelect('chartKelasSelect', State.kelasList, '-- Seluruh Kelas (Perbandingan) --', 'ALL');
    fillSelect('filterKelasRawan', State.kelasList, '-- Semua Kelas --', 'ALL');
    fillSelect('filterKelasJurnal', State.kelasList, '-- Semua Kelas --', '');
    fillSelect('filterKelasDisiplin', State.kelasList, '-- Semua Kelas --', '');
}

// ====================================================================
// MODUL 1: DASHBOARD UMUM (OVERVIEW GLOBAL)
// ====================================================================
function updateDashboardUmum() {
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    const todayStr = getLocalISODate(now);
    
    // 1. Stat: Total Jurnal Bulan Ini
    const jurnalBulanIni = State.allJurnal.filter(j => {
        const d = new Date(j.tanggal);
        return d.getMonth() === curMonth && d.getFullYear() === curYear;
    });
    document.getElementById('statTotalJurnal').textContent = jurnalBulanIni.length;

    // 2. Stat: Kepatuhan Guru Hari Ini (%)
    const guruTerjadwalSet = new Set(State.allPenugasan.map(p => p.profiles?.full_name).filter(Boolean));
    const totalGuruWajib = guruTerjadwalSet.size || State.guruList.length;
    const guruMengisiHariIni = new Set(
        State.allJurnal.filter(j => j.tanggal === todayStr).map(j => j.profiles?.full_name).filter(Boolean)
    );
    const persenPatuh = totalGuruWajib === 0 ? 0 : Math.min(100, Math.round((guruMengisiHariIni.size / totalGuruWajib) * 100));
    document.getElementById('statKepatuhanHariIni').textContent = `${persenPatuh}% (${guruMengisiHariIni.size}/${totalGuruWajib})`;

    // 3. Stat: Rata-Rata Kehadiran Bulan Ini
    let totalExpected = 0;
    let totalAbsen = 0;
    jurnalBulanIni.forEach(j => {
        const siswaDiKelas = State.allSiswa.filter(s => s.kelas === j.kelas).length;
        if (siswaDiKelas > 0) {
            totalExpected += siswaDiKelas;
            const absenList = parsePresensiFromCatatan(j.catatan);
            totalAbsen += absenList.length;
        }
    });
    const persentaseHadir = totalExpected === 0 ? 100 : Math.max(0, Math.round(((totalExpected - totalAbsen) / totalExpected) * 100));
    document.getElementById('statKehadiran').textContent = `${persentaseHadir}%`;

    // 4. Stat: Disiplin Bulan Ini
    const disiplinBulanIni = State.allDisiplin.filter(d => {
        const date = new Date(d.created_at);
        return date.getMonth() === curMonth && date.getFullYear() === curYear;
    });
    document.getElementById('statTotalDisiplin').textContent = disiplinBulanIni.length;

    // 5. Stat: Total Akumulasi Poin & Siswa Rawan (>= 50 Poin)
    let totalPoinSekolah = 0;
    const poinPerSiswa = {};
    State.allDisiplin.forEach(d => {
        const poin = Number(d.pelanggaran_master?.poin) || 0;
        totalPoinSekolah += poin;
        const nisn = d.siswa?.nisn || d.nisn_siswa;
        if (nisn) poinPerSiswa[nisn] = (poinPerSiswa[nisn] || 0) + poin;
    });
    const jumlahSiswaRawan = Object.values(poinPerSiswa).filter(p => p >= 50).length;
    document.getElementById('statTotalPoin').textContent = totalPoinSekolah;
    document.getElementById('statSiswaRawan').textContent = jumlahSiswaRawan;

    // --- Chart 1: Tren Jurnal Harian (Sesuai Pilihan 7 / 14 / 30 Hari) ---
    renderChartTrenJurnalGlobal();

    // --- Chart 2: Komposisi Jenis Pelanggaran (Top 6) ---
    const topPelanggaran = {};
    State.allDisiplin.forEach(d => {
        const desc = d.pelanggaran_master?.deskripsi || 'Lainnya';
        topPelanggaran[desc] = (topPelanggaran[desc] || 0) + 1;
    });
    const sortedPel = Object.entries(topPelanggaran).sort((a, b) => b[1] - a[1]).slice(0, 6);
    
    if (charts.disiplinGlobal) charts.disiplinGlobal.destroy();
    charts.disiplinGlobal = new Chart(document.getElementById('chartDisiplinGlobal'), {
        type: 'doughnut',
        data: {
            labels: sortedPel.map(p => p[0]),
            datasets: [{
                data: sortedPel.map(p => p[1]),
                backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // --- Chart 3: Akumulasi Poin Pelanggaran per Kelas ---
    const poinKelasMap = {};
    State.kelasList.forEach(k => poinKelasMap[k] = 0);
    State.allDisiplin.forEach(d => {
        const kelasSiswa = d.siswa?.kelas || State.allSiswa.find(s => s.nisn === d.nisn_siswa)?.kelas || 'Lainnya';
        const poin = Number(d.pelanggaran_master?.poin) || 0;
        poinKelasMap[kelasSiswa] = (poinKelasMap[kelasSiswa] || 0) + poin;
    });
    const kelasLabels = Object.keys(poinKelasMap);
    const kelasPoinValues = kelasLabels.map(k => poinKelasMap[k]);

    if (charts.poinKelasGlobal) charts.poinKelasGlobal.destroy();
    charts.poinKelasGlobal = new Chart(document.getElementById('chartPoinKelasGlobal'), {
        type: 'bar',
        data: {
            labels: kelasLabels,
            datasets: [{
                label: 'Total Poin Pelanggaran',
                data: kelasPoinValues,
                backgroundColor: '#f59e0b',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });

    // --- Chart 4: Tren Kasus Disiplin 4 Pekan Terakhir ---
    const pekanLabels = ['3 Pekan Lalu', '2 Pekan Lalu', 'Pekan Lalu', 'Pekan Ini'];
    const pekanValues = [0, 0, 0, 0];
    const nowMs = now.getTime();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    State.allDisiplin.forEach(d => {
        const diffWeeks = Math.floor((nowMs - new Date(d.created_at).getTime()) / oneWeekMs);
        if (diffWeeks >= 0 && diffWeeks < 4) {
            pekanValues[3 - diffWeeks]++;
        }
    });

    if (charts.trenDisiplinGlobal) charts.trenDisiplinGlobal.destroy();
    charts.trenDisiplinGlobal = new Chart(document.getElementById('chartTrenDisiplinGlobal'), {
        type: 'line',
        data: {
            labels: pekanLabels,
            datasets: [{
                label: 'Jumlah Kasus Pelanggaran',
                data: pekanValues,
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

function renderChartTrenJurnalGlobal() {
    const daysCount = parseInt(document.getElementById('selectTrenRange')?.value || '7', 10);
    const dateLabels = Array.from({ length: daysCount }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - ((daysCount - 1) - i));
        return getLocalISODate(d);
    });
    const trenData = dateLabels.map(tgl => State.allJurnal.filter(j => j.tanggal === tgl).length);

    if (charts.trenGlobal) charts.trenGlobal.destroy();
    charts.trenGlobal = new Chart(document.getElementById('chartTrenGlobal'), {
        type: 'line',
        data: {
            labels: dateLabels.map(d => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })),
            datasets: [{
                label: 'Jurnal Masuk',
                data: trenData,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.18)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

// ====================================================================
// MODUL 2: ANALISIS KINERJA & KEPATUHAN GURU
// ====================================================================
function renderKepatuhanGuruHarian() {
    const selectedDate = document.getElementById('kepatuhanTanggalInput')?.value || getLocalISODate();
    const filterStatus = document.getElementById('kepatuhanStatusFilter')?.value || 'ALL';
    const tbody = document.getElementById('tbodyKepatuhanGuru');
    if (!tbody) return;

    const jurnalPadaTanggal = State.allJurnal.filter(j => j.tanggal === selectedDate);

    const rowsData = State.guruList.map(namaGuru => {
        const tugasGuru = State.allPenugasan.filter(p => p.profiles?.full_name === namaGuru);
        const infoTugas = tugasGuru.length > 0
            ? tugasGuru.map(t => `${t.kelas} (${t.mata_pelajaran})`).join(', ')
            : 'Belum diatur di Penugasan';

        const jurnalGuruHariIni = jurnalPadaTanggal.filter(j => j.profiles?.full_name === namaGuru);
        const kelasDiisi = jurnalGuruHariIni.map(j => `${j.kelas} (${j.mata_pelajaran})`).join(', ') || '-';
        const sudahMengisi = jurnalGuruHariIni.length > 0;

        return {
            namaGuru,
            infoTugas,
            jumlahJurnal: jurnalGuruHariIni.length,
            kelasDiisi,
            sudahMengisi
        };
    }).filter(item => {
        if (filterStatus === 'SUDAH') return item.sudahMengisi;
        if (filterStatus === 'BELUM') return !item.sudahMengisi;
        return true;
    });

    if (rowsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Tidak ada data guru yang sesuai dengan filter.</td></tr>';
        return;
    }

    tbody.innerHTML = rowsData.map(r => `
        <tr>
            <td data-label="Nama Guru" style="font-weight: 600;">${r.namaGuru}</td>
            <td data-label="Penugasan" style="font-size: 0.85rem;">${r.infoTugas}</td>
            <td data-label="Jurnal Diisi">${r.jumlahJurnal} Sesi</td>
            <td data-label="Kelas Diisi">${r.kelasDiisi}</td>
            <td data-label="Status">
                <span class="badge ${r.sudahMengisi ? 'badge-success' : 'badge-danger'}">
                    ${r.sudahMengisi ? '✓ Sudah Mengisi' : '✗ Belum Mengisi'}
                </span>
            </td>
        </tr>
    `).join('');
}

function renderRekapKinerjaGuruTable() {
    const tbody = document.getElementById('tbodyRekapGuru');
    if (!tbody) return;

    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();

    State.rekapGuruData = State.guruList.map(namaGuru => {
        const tugas = State.allPenugasan.filter(p => p.profiles?.full_name === namaGuru);
        const jurnalGuru = State.allJurnal.filter(j => j.profiles?.full_name === namaGuru);
        const jurnalBulanIni = jurnalGuru.filter(j => {
            const d = new Date(j.tanggal);
            return d.getMonth() === curMonth && d.getFullYear() === curYear;
        });

        const terakhirMengisi = jurnalGuru.length > 0 ? jurnalGuru[0].tanggal : null;

        return {
            namaGuru,
            jumlahPenugasan: tugas.length,
            jurnalBulanIni: jurnalBulanIni.length,
            totalJurnal: jurnalGuru.length,
            terakhirMengisi
        };
    }).sort((a, b) => b.jurnalBulanIni - a.jurnalBulanIni);

    if (State.rekapGuruData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada data guru.</td></tr>';
        return;
    }

    tbody.innerHTML = State.rekapGuruData.map(g => `
        <tr>
            <td data-label="Nama Guru" style="font-weight:600;">${g.namaGuru}</td>
            <td data-label="Kelas Diampu">${g.jumlahPenugasan} Rombel/Mapel</td>
            <td data-label="Jurnal Bulan Ini"><strong>${g.jurnalBulanIni}</strong> Jurnal</td>
            <td data-label="Total Jurnal">${g.totalJurnal} Jurnal</td>
            <td data-label="Terakhir Mengisi" data-sort="${g.terakhirMengisi || ''}">
                ${g.terakhirMengisi ? new Date(g.terakhirMengisi).toLocaleDateString('id-ID') : '<span style="color:#ef4444;">Belum Pernah</span>'}
            </td>
        </tr>
    `).join('');
}

function updateChartGuru() {
    const guru = document.getElementById('chartGuruSelect').value;
    const timeframe = document.getElementById('chartGuruTimeframe').value;
    
    if (guru === 'ALL') {
        // Jika ALL: Bandingkan jumlah jurnal antar guru secara langsung
        const labels = State.rekapGuruData.map(g => g.namaGuru);
        const values = State.rekapGuruData.map(g => g.totalJurnal);

        if (charts.aktivitasGuru) charts.aktivitasGuru.destroy();
        charts.aktivitasGuru = new Chart(document.getElementById('chartAktivitasGuru'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total Jurnal Pembelajaran Diinput',
                    data: values,
                    backgroundColor: '#10b981',
                    borderRadius: 5
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });
    } else {
        const dataset = State.allJurnal.filter(j => j.profiles?.full_name === guru);
        const chartData = groupDataByTimeframe(dataset, timeframe);

        if (charts.aktivitasGuru) charts.aktivitasGuru.destroy();
        charts.aktivitasGuru = new Chart(document.getElementById('chartAktivitasGuru'), {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: `Sesi Mengajar ${guru}`,
                    data: chartData.values,
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    borderColor: '#059669',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.25
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
        });
    }
}

// ====================================================================
// MODUL 3: ANALISIS KELAS & WALI KELAS
// ====================================================================
function updateChartKelas() {
    const kelas = document.getElementById('chartKelasSelect').value;
    const timeframe = document.getElementById('chartKelasTimeframe').value;
    
    if (kelas === 'ALL') {
        const labels = State.kelasList;
        const jurnalValues = labels.map(k => State.allJurnal.filter(j => j.kelas === k).length);
        const disiplinValues = labels.map(k => State.allDisiplin.filter(d => (d.siswa?.kelas || '') === k).length);

        if (charts.aktivitasKelas) charts.aktivitasKelas.destroy();
        charts.aktivitasKelas = new Chart(document.getElementById('chartAktivitasKelas'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Total Sesi Pembelajaran (Jurnal)', data: jurnalValues, backgroundColor: '#6366f1' },
                    { label: 'Jumlah Kasus Pelanggaran', data: disiplinValues, backgroundColor: '#ef4444' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });
    } else {
        const dataset = State.allJurnal.filter(j => j.kelas === kelas);
        const chartData = groupDataByTimeframe(dataset, timeframe);

        if (charts.aktivitasKelas) charts.aktivitasKelas.destroy();
        charts.aktivitasKelas = new Chart(document.getElementById('chartAktivitasKelas'), {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: `Aktivitas Pembelajaran Kelas ${kelas}`,
                    data: chartData.values,
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124, 58, 237, 0.18)',
                    fill: true,
                    tension: 0.25
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });
    }
}

function renderRekapKelasTable() {
    const tbody = document.getElementById('tbodyRekapKelas');
    if (!tbody) return;

    State.rekapKelasData = State.kelasList.map(namaKelas => {
        const waliObj = State.allWaliKelas.find(w => w.kelas === namaKelas);
        const namaWali = waliObj?.profiles?.full_name || 'Belum Ditentukan';
        const jumlahSiswa = State.allSiswa.filter(s => s.kelas === namaKelas).length;
        const jurnalKelas = State.allJurnal.filter(j => j.kelas === namaKelas);

        let countS = 0, countI = 0, countA = 0;
        jurnalKelas.forEach(j => {
            const absens = parsePresensiFromCatatan(j.catatan);
            absens.forEach(a => {
                if (a.status === 'Sakit') countS++;
                else if (a.status === 'Izin') countI++;
                else if (a.status === 'Alfa') countA++;
            });
        });

        const disiplinKelas = State.allDisiplin.filter(d => {
            const kls = d.siswa?.kelas || State.allSiswa.find(s => s.nisn === d.nisn_siswa)?.kelas;
            return kls === namaKelas;
        });
        const totalPoin = disiplinKelas.reduce((acc, cur) => acc + (Number(cur.pelanggaran_master?.poin) || 0), 0);

        return {
            kelas: namaKelas,
            waliKelas: namaWali,
            jumlahSiswa,
            totalJurnal: jurnalKelas.length,
            countS, countI, countA,
            totalAbsen: countS + countI + countA,
            kasusDisiplin: disiplinKelas.length,
            totalPoin
        };
    });

    if (State.rekapKelasData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Belum ada data kelas.</td></tr>';
        return;
    }

    tbody.innerHTML = State.rekapKelasData.map(k => `
        <tr>
            <td data-label="Kelas" style="font-weight:700;">${k.kelas}</td>
            <td data-label="Wali Kelas">${k.waliKelas}</td>
            <td data-label="Jumlah Siswa">${k.jumlahSiswa} Siswa</td>
            <td data-label="Total Sesi Jurnal">${k.totalJurnal} Sesi</td>
            <td data-label="Ketidakhadiran" data-sort="${k.totalAbsen}">
                ${k.totalAbsen} Kali <span style="font-size:0.8rem; color:#64748b;">(S:${k.countS} / I:${k.countI} / A:${k.countA})</span>
            </td>
            <td data-label="Kasus Disiplin">${k.kasusDisiplin} Kasus</td>
            <td data-label="Total Poin">
                <span class="badge ${k.totalPoin >= 100 ? 'badge-danger' : k.totalPoin >= 40 ? 'badge-warning' : 'badge-success'}">
                    ${k.totalPoin} Poin
                </span>
            </td>
        </tr>
    `).join('');
}

// ====================================================================
// FUNGSI HELPER: PENGELOMPOKAN WAKTU UNTUK GRAFIK
// ====================================================================
function groupDataByTimeframe(dataArray, type) {
    let result = { labels: [], values: [] };
    const counts = {};

    if (type === 'harian') {
        for (let i = 6; i >= 0; i--) {
            let d = new Date();
            d.setDate(d.getDate() - i);
            let str = getLocalISODate(d);
            counts[str] = 0;
            result.labels.push(str);
        }
        dataArray.forEach(j => { if (counts[j.tanggal] !== undefined) counts[j.tanggal]++; });
        result.values = result.labels.map(l => counts[l]);
    } 
    else if (type === 'mingguan') {
        result.labels = ['Pekan 1', 'Pekan 2', 'Pekan 3', 'Pekan 4 (Terbaru)'];
        result.values = [0, 0, 0, 0];
        const now = new Date().getTime();
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        dataArray.forEach(j => {
            const jTime = new Date(j.tanggal).getTime();
            const diffWeeks = Math.floor((now - jTime) / oneWeek);
            if (diffWeeks >= 0 && diffWeeks < 4) {
                result.values[3 - diffWeeks]++;
            }
        });
    } 
    else if (type === 'bulanan') {
        const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
        const curDate = new Date();
        for (let i = 11; i >= 0; i--) {
            let d = new Date(curDate.getFullYear(), curDate.getMonth() - i, 1);
            let label = `${months[d.getMonth()]} ${d.getFullYear()}`;
            counts[label] = 0;
            result.labels.push(label);
        }
        dataArray.forEach(j => {
            let d = new Date(j.tanggal);
            let label = `${months[d.getMonth()]} ${d.getFullYear()}`;
            if (counts[label] !== undefined) counts[label]++;
        });
        result.values = result.labels.map(l => counts[l]);
    }

    return result;
}

// ====================================================================
// MODUL 4: ANALISIS KEHADIRAN SISWA (OTOMATIS & TERPERINCI S/I/A)
// ====================================================================
function generateAnalisisKehadiran() {
    const type = document.getElementById('hadirFilterType').value;
    const target = document.getElementById('hadirTargetSelect').value;
    const bulan = document.getElementById('hadirBulanInput').value;
    
    if (!bulan) return;
    const [tTahun, tBulan] = bulan.split('-');
    
    let filteredJurnal = State.allJurnal.filter(j => {
        const d = new Date(j.tanggal);
        return d.getFullYear() == tTahun && (d.getMonth() + 1) == tBulan;
    });

    let targetSiswa = State.allSiswa;
    if (type === 'angkatan' && target) {
        targetSiswa = targetSiswa.filter(s => s.kelas.startsWith(target));
        filteredJurnal = filteredJurnal.filter(j => j.kelas.startsWith(target));
    } else if (type === 'kelas' && target) {
        targetSiswa = targetSiswa.filter(s => s.kelas === target);
        filteredJurnal = filteredJurnal.filter(j => j.kelas === target);
    }

    let rekapAbsenSiswa = {};
    let absenPerKelasMap = {};
    let totalExpectedHadir = 0;
    let sumSakit = 0, sumIzin = 0, sumAlfa = 0;

    targetSiswa.forEach(s => {
        rekapAbsenSiswa[s.nama.toLowerCase()] = {
            nama: s.nama,
            kelas: s.kelas,
            sakit: 0,
            izin: 0,
            alfa: 0,
            total: 0
        };
        absenPerKelasMap[s.kelas] = { sakit: 0, izin: 0, alfa: 0 };
    });

    filteredJurnal.forEach(j => {
        const popKelas = targetSiswa.filter(s => s.kelas === j.kelas).length;
        totalExpectedHadir += popKelas;

        const absenList = parsePresensiFromCatatan(j.catatan);
        absenList.forEach(item => {
            const key = item.nama.toLowerCase();
            if (!rekapAbsenSiswa[key]) {
                rekapAbsenSiswa[key] = { nama: item.nama, kelas: j.kelas, sakit: 0, izin: 0, alfa: 0, total: 0 };
            }
            if (!absenPerKelasMap[j.kelas]) {
                absenPerKelasMap[j.kelas] = { sakit: 0, izin: 0, alfa: 0 };
            }

            rekapAbsenSiswa[key].total++;
            if (item.status === 'Sakit') {
                rekapAbsenSiswa[key].sakit++;
                absenPerKelasMap[j.kelas].sakit++;
                sumSakit++;
            } else if (item.status === 'Izin') {
                rekapAbsenSiswa[key].izin++;
                absenPerKelasMap[j.kelas].izin++;
                sumIzin++;
            } else if (item.status === 'Alfa') {
                rekapAbsenSiswa[key].alfa++;
                absenPerKelasMap[j.kelas].alfa++;
                sumAlfa++;
            }
        });
    });

    const sumHadir = Math.max(0, totalExpectedHadir - (sumSakit + sumIzin + sumAlfa));

    // Chart 1: Pie Rasio Kehadiran
    if (charts.pieHadir) charts.pieHadir.destroy();
    charts.pieHadir = new Chart(document.getElementById('chartPieHadir'), {
        type: 'pie',
        data: { 
            labels: ['Hadir', 'Sakit', 'Izin', 'Alfa'], 
            datasets: [{
                data: [sumHadir, sumSakit, sumIzin, sumAlfa],
                backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#ef4444']
            }] 
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Chart 2: Stacked Bar Ketidakhadiran per Kelas
    const kelasKeys = Object.keys(absenPerKelasMap).sort();
    if (charts.barAbsenKelas) charts.barAbsenKelas.destroy();
    charts.barAbsenKelas = new Chart(document.getElementById('chartBarAbsenKelas'), {
        type: 'bar',
        data: {
            labels: kelasKeys,
            datasets: [
                { label: 'Sakit', data: kelasKeys.map(k => absenPerKelasMap[k].sakit), backgroundColor: '#f59e0b' },
                { label: 'Izin', data: kelasKeys.map(k => absenPerKelasMap[k].izin), backgroundColor: '#3b82f6' },
                { label: 'Alfa', data: kelasKeys.map(k => absenPerKelasMap[k].alfa), backgroundColor: '#ef4444' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
        }
    });

    // Tabel Top Siswa Sering Absen
    State.rekapAbsenSiswaList = Object.values(rekapAbsenSiswa)
        .filter(s => s.total > 0)
        .sort((a, b) => b.total - a.total);

    const tbody = document.getElementById('tbodyTopAbsen');
    if (State.rekapAbsenSiswaList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Alhamdulillah, tidak ada catatan siswa absen di periode ini.</td></tr>';
    } else {
        tbody.innerHTML = State.rekapAbsenSiswaList.slice(0, 25).map(s => `
            <tr>
                <td data-label="Nama Siswa" style="font-weight:600;">${s.nama}</td>
                <td data-label="Kelas">${s.kelas}</td>
                <td data-label="Sakit">${s.sakit}</td>
                <td data-label="Izin">${s.izin}</td>
                <td data-label="Alfa" style="color:#ef4444; font-weight:600;">${s.alfa}</td>
                <td data-label="Total Absen"><span class="badge badge-danger">${s.total} Sesi</span></td>
            </tr>
        `).join('');
    }
}

// ====================================================================
// MODUL 5: ANALITIK DISIPLIN & SISWA RAWAN (PERHATIAN KHUSUS BK)
// ====================================================================
function renderSiswaRawanTable() {
    const filterKelas = document.getElementById('filterKelasRawan')?.value || 'ALL';
    const filterStatus = document.getElementById('filterStatusRawan')?.value || 'ALL';
    const searchQuery = (document.getElementById('searchSiswaRawan')?.value || '').toLowerCase().trim();
    const tbody = document.getElementById('tbodySiswaRawan');
    if (!tbody) return;

    const mapSiswa = {};

    State.allDisiplin.forEach(d => {
        const nisn = d.siswa?.nisn || d.nisn_siswa || 'N/A';
        const siswaRef = State.allSiswa.find(s => s.nisn === nisn);
        const nama = d.siswa?.nama || siswaRef?.nama || 'Siswa Tidak Dikenal';
        const kelas = d.siswa?.kelas || siswaRef?.kelas || '-';
        const poin = Number(d.pelanggaran_master?.poin) || 0;
        const pelanggaran = d.pelanggaran_master?.deskripsi || 'Pelanggaran';

        if (!mapSiswa[nisn]) {
            mapSiswa[nisn] = {
                nisn,
                nama,
                kelas,
                jumlahKasus: 0,
                totalPoin: 0,
                riwayatTerakhir: `${pelanggaran} (${new Date(d.created_at).toLocaleDateString('id-ID')})`
            };
        }
        mapSiswa[nisn].jumlahKasus++;
        mapSiswa[nisn].totalPoin += poin;
    });

    State.rekapSiswaRawanList = Object.values(mapSiswa)
        .map(s => {
            let kategori = 'PEMBINAAN';
            let labelRekomendasi = 'Pembinaan Wali Kelas';
            let badgeClass = 'badge-info';

            if (s.totalPoin >= 75) {
                kategori = 'KRITIS';
                labelRekomendasi = 'Panggilan Ortu & Tindak Lanjut BK / Kepsek';
                badgeClass = 'badge-danger';
            } else if (s.totalPoin >= 50) {
                kategori = 'PERINGATAN';
                labelRekomendasi = 'Peringatan Tertulis & Konseling BK';
                badgeClass = 'badge-warning';
            }

            return { ...s, kategori, labelRekomendasi, badgeClass };
        })
        .filter(s => {
            const matchKelas = filterKelas === 'ALL' || s.kelas === filterKelas;
            const matchStatus = filterStatus === 'ALL' || s.kategori === filterStatus;
            const matchQuery = !searchQuery || s.nama.toLowerCase().includes(searchQuery) || s.nisn.toLowerCase().includes(searchQuery);
            return matchKelas && matchStatus && matchQuery;
        })
        .sort((a, b) => b.totalPoin - a.totalPoin);

    if (State.rekapSiswaRawanList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Tidak ada siswa dengan catatan pelanggaran sesuai filter.</td></tr>';
        return;
    }

    tbody.innerHTML = State.rekapSiswaRawanList.map(s => `
        <tr>
            <td data-label="NISN">${s.nisn}</td>
            <td data-label="Nama Siswa" style="font-weight:600;">${s.nama}</td>
            <td data-label="Kelas">${s.kelas}</td>
            <td data-label="Jumlah Kasus">${s.jumlahKasus} Kali</td>
            <td data-label="Total Poin" style="font-weight:700; color:#b91c1c;">${s.totalPoin} Poin</td>
            <td data-label="Rekomendasi"><span class="badge ${s.badgeClass}">${s.labelRekomendasi}</span></td>
            <td data-label="Pelanggaran Terakhir" style="font-size:0.85rem;">${s.riwayatTerakhir}</td>
        </tr>
    `).join('');
}

// ====================================================================
// MODUL 6 & 7: ARSIP TABEL JURNAL & DISIPLIN
// ====================================================================
function renderJurnalTable() {
    const tbody = document.getElementById('tableBodyJurnal');
    const btnExport = document.getElementById('btnExportJurnal');
    if (btnExport) btnExport.style.display = State.filteredJurnal.length ? 'inline-block' : 'none';
    
    if (!State.filteredJurnal.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Tidak ada data jurnal yang sesuai filter.</td></tr>';
        return;
    }

    tbody.innerHTML = State.filteredJurnal.map(j => `
        <tr>
            <td data-label="Tanggal" data-sort="${j.tanggal}">${new Date(j.tanggal).toLocaleDateString('id-ID')}</td>
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

function renderDisiplinTable() {
    const tbody = document.getElementById('tableBodyDisiplin');
    const btnExport = document.getElementById('btnExportDisiplin');
    if (btnExport) btnExport.style.display = State.filteredDisiplin.length ? 'inline-block' : 'none';

    if (!State.filteredDisiplin.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Tidak ada data pelanggaran yang sesuai filter.</td></tr>';
        return;
    }

    tbody.innerHTML = State.filteredDisiplin.map(d => {
        const kelasSiswa = d.siswa?.kelas || State.allSiswa.find(s => s.nisn === d.nisn_siswa)?.kelas || '-';
        return `
            <tr>
                <td data-label="Tanggal" data-sort="${d.created_at}">${new Date(d.created_at).toLocaleDateString('id-ID')}</td>
                <td data-label="NISN">${d.siswa?.nisn || d.nisn_siswa || '-'}</td>
                <td data-label="Nama Siswa" style="font-weight:600;">${d.siswa?.nama || '-'}</td>
                <td data-label="Kelas">${kelasSiswa}</td>
                <td data-label="Pelanggaran">${d.pelanggaran_master?.deskripsi || '-'}</td>
                <td data-label="Poin"><span class="badge badge-danger">${d.pelanggaran_master?.poin || 0} Poin</span></td>
                <td data-label="Pencatat">${d.profiles?.full_name || '-'}</td>
            </tr>
        `;
    }).join('');
}

function applyFiltersArchive() {
    const guru = document.getElementById('filterGuruJurnal').value;
    const kelasJurnal = document.getElementById('filterKelasJurnal').value;
    const m1 = document.getElementById('filterMulaiJurnal').value;
    const s1 = document.getElementById('filterSelesaiJurnal').value;
    
    State.filteredJurnal = State.allJurnal.filter(j => {
        const tgl = new Date(j.tanggal);
        const mulai = m1 ? new Date(m1) : null;
        const selesai = s1 ? new Date(s1) : null;
        if (mulai) mulai.setHours(0, 0, 0, 0);
        if (selesai) selesai.setHours(23, 59, 59, 999);

        const matchGuru = !guru || j.profiles?.full_name === guru;
        const matchKelas = !kelasJurnal || j.kelas === kelasJurnal;
        const matchTgl = (!mulai || tgl >= mulai) && (!selesai || tgl <= selesai);
        return matchGuru && matchKelas && matchTgl;
    });
    renderJurnalTable();

    const siswa = document.getElementById('filterSiswaDisiplin').value.toLowerCase().trim();
    const kelasDisiplin = document.getElementById('filterKelasDisiplin').value;
    const m2 = document.getElementById('filterMulaiDisiplin').value;
    const s2 = document.getElementById('filterSelesaiDisiplin').value;
    
    State.filteredDisiplin = State.allDisiplin.filter(d => {
        const tgl = new Date(d.created_at);
        const mulai = m2 ? new Date(m2) : null;
        const selesai = s2 ? new Date(s2) : null;
        if (mulai) mulai.setHours(0, 0, 0, 0);
        if (selesai) selesai.setHours(23, 59, 59, 999);

        const kls = d.siswa?.kelas || State.allSiswa.find(s => s.nisn === d.nisn_siswa)?.kelas || '';
        const matchSiswa = !siswa || (d.siswa?.nama || '').toLowerCase().includes(siswa) || (d.siswa?.nisn || '').includes(siswa);
        const matchKelas = !kelasDisiplin || kls === kelasDisiplin;
        const matchTgl = (!mulai || tgl >= mulai) && (!selesai || tgl <= selesai);
        return matchSiswa && matchKelas && matchTgl;
    });
    renderDisiplinTable();
}

// ====================================================================
// FITUR EXPORT EXCEL (SPESIFIK & LAPORAN EKSEKUTIF MULTI-SHEET)
// ====================================================================
function exportSingleSheet(dataArray, sheetName, filePrefix) {
    if (!dataArray || dataArray.length === 0) {
        return showStatusMessage(`Tidak ada data ${sheetName} untuk diekspor.`, 'info');
    }
    const ws = XLSX.utils.json_to_sheet(dataArray);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filePrefix}_${getLocalISODate()}.xlsx`);
}

function exportExecutiveReport() {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Kinerja Guru
    const sheetGuru = State.rekapGuruData.map(g => ({
        'Nama Guru': g.namaGuru,
        'Rombel Diampu': g.jumlahPenugasan,
        'Jurnal Bulan Ini': g.jurnalBulanIni,
        'Total Jurnal': g.totalJurnal,
        'Terakhir Mengisi': g.terakhirMengisi || 'Belum Pernah'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetGuru), "Kinerja Guru");

    // Sheet 2: Rekap Kelas
    const sheetKelas = State.rekapKelasData.map(k => ({
        'Kelas': k.kelas,
        'Wali Kelas': k.waliKelas,
        'Jumlah Siswa': k.jumlahSiswa,
        'Total Jurnal': k.totalJurnal,
        'Sakit': k.countS,
        'Izin': k.countI,
        'Alfa': k.countA,
        'Kasus Disiplin': k.kasusDisiplin,
        'Total Poin Disiplin': k.totalPoin
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetKelas), "Kondisi Kelas");

    // Sheet 3: Siswa Rawan Disiplin
    const sheetRawan = State.rekapSiswaRawanList.map(s => ({
        'NISN': s.nisn,
        'Nama Siswa': s.nama,
        'Kelas': s.kelas,
        'Jumlah Kasus': s.jumlahKasus,
        'Total Poin': s.totalPoin,
        'Rekomendasi': s.labelRekomendasi,
        'Pelanggaran Terakhir': s.riwayatTerakhir
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRawan.length ? sheetRawan : [{ Info: 'Tidak ada data' }]), "Siswa Rawan BK");

    // Sheet 4: Arsip Jurnal
    const sheetJurnal = State.filteredJurnal.map(j => ({
        'Tanggal': new Date(j.tanggal).toLocaleDateString('id-ID'),
        'Nama Guru': j.profiles?.full_name,
        'Kelas': j.kelas,
        'Mata Pelajaran': j.mata_pelajaran,
        'Materi': j.materi,
        'Catatan': j.catatan
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetJurnal.length ? sheetJurnal : [{ Info: 'Tidak ada data' }]), "Arsip Jurnal");

    XLSX.writeFile(wb, `Laporan_Eksekutif_Kepsek_SMANEMA_${getLocalISODate()}.xlsx`);
    showStatusMessage('Laporan Eksekutif Multi-Sheet berhasil diunduh!', 'success');
}

// ====================================================================
// FITUR SORTIR TABEL UNIVERSAL
// ====================================================================
function initSortableTables() {
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
                const cellA = rowA.children[columnIndex];
                const cellB = rowB.children[columnIndex];
                const rawA = cellA?.dataset.sort || cellA?.innerText.trim() || '';
                const rawB = cellB?.dataset.sort || cellB?.innerText.trim() || '';

                let cmp = 0;
                if (dataType === 'number') {
                    const numA = parseFloat(rawA.replace(/[^0-9.-]+/g, '')) || 0;
                    const numB = parseFloat(rawB.replace(/[^0-9.-]+/g, '')) || 0;
                    cmp = numA - numB;
                } else if (dataType === 'date') {
                    cmp = (new Date(rawA).getTime() || 0) - (new Date(rawB).getTime() || 0);
                } else {
                    cmp = rawA.localeCompare(rawB, 'id', { numeric: true, sensitivity: 'base' });
                }
                return isAscending ? cmp : -cmp;
            });

            tbody.append(...rows);
        });
    });
}

// ====================================================================
// INISIALISASI EVENT LISTENERS
// ====================================================================
document.addEventListener('DOMContentLoaded', async () => {
    if (!document.querySelector('.dashboard-wrapper')) return;
    
    await initSession();
    await fetchAllData();
    initSortableTables();

    // Navigasi Sidebar
    document.querySelectorAll('.sidebar-nav .btn-nav').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.dashboard-content .content-section').forEach(s => s.style.display = 'none');
            const target = document.getElementById(e.currentTarget.dataset.section);
            if (target) target.style.display = 'block';
            document.querySelectorAll('.sidebar-nav .btn-nav').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });

    // Toolbar Eksekutif Global
    document.getElementById('btnRefreshGlobal')?.addEventListener('click', () => fetchAllData(true));
    document.getElementById('btnExportExecutive')?.addEventListener('click', exportExecutiveReport);
    document.getElementById('btnPrintDashboard')?.addEventListener('click', () => window.print());

    // Logout
    document.getElementById('logoutButton')?.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.replace('index.html');
    });

    // Listeners Overview & Kinerja Guru
    document.getElementById('selectTrenRange')?.addEventListener('change', renderChartTrenJurnalGlobal);
    document.getElementById('kepatuhanTanggalInput')?.addEventListener('change', renderKepatuhanGuruHarian);
    document.getElementById('kepatuhanStatusFilter')?.addEventListener('change', renderKepatuhanGuruHarian);
    document.getElementById('chartGuruSelect')?.addEventListener('change', updateChartGuru);
    document.getElementById('chartGuruTimeframe')?.addEventListener('change', updateChartGuru);
    document.getElementById('btnExportKinerjaGuru')?.addEventListener('click', () => {
        exportSingleSheet(State.rekapGuruData, "Rekap Guru", "Rekap_Kinerja_Guru");
    });

    // Listeners Analisis Kelas
    document.getElementById('chartKelasSelect')?.addEventListener('change', updateChartKelas);
    document.getElementById('chartKelasTimeframe')?.addEventListener('change', updateChartKelas);
    document.getElementById('btnExportRekapKelas')?.addEventListener('click', () => {
        exportSingleSheet(State.rekapKelasData, "Rekap Kelas", "Rekap_Kondisi_Kelas");
    });

    // Listeners Analisis Kehadiran
    document.getElementById('hadirFilterType')?.addEventListener('change', (e) => {
        const type = e.target.value;
        const targetCont = document.getElementById('hadirTargetContainer');
        const targetSel = document.getElementById('hadirTargetSelect');
        
        if (type === 'global') {
            targetCont.style.display = 'none';
        } else if (type === 'angkatan') {
            targetCont.style.display = 'block';
            targetSel.innerHTML = '<option value="X">Kelas X</option><option value="XI">Kelas XI</option><option value="XII">Kelas XII</option>';
        } else if (type === 'kelas') {
            targetCont.style.display = 'block';
            targetSel.innerHTML = State.kelasList.map(k => `<option value="${k}">${k}</option>`).join('');
        }
        generateAnalisisKehadiran();
    });
    document.getElementById('hadirTargetSelect')?.addEventListener('change', generateAnalisisKehadiran);
    document.getElementById('hadirBulanInput')?.addEventListener('change', generateAnalisisKehadiran);
    document.getElementById('btnGenerateHadir')?.addEventListener('click', generateAnalisisKehadiran);
    document.getElementById('btnExportHadir')?.addEventListener('click', () => {
        exportSingleSheet(State.rekapAbsenSiswaList, "Rekap Absensi", "Rekap_Ketidakhadiran_Siswa");
    });

    // Listeners Siswa Rawan (BK)
    document.getElementById('filterKelasRawan')?.addEventListener('change', renderSiswaRawanTable);
    document.getElementById('filterStatusRawan')?.addEventListener('change', renderSiswaRawanTable);
    document.getElementById('searchSiswaRawan')?.addEventListener('input', renderSiswaRawanTable);
    document.getElementById('btnExportSiswaRawan')?.addEventListener('click', () => {
        exportSingleSheet(State.rekapSiswaRawanList, "Siswa Rawan", "Daftar_Siswa_Perhatian_Khusus");
    });

    // Listeners Arsip Jurnal & Disiplin
    document.getElementById('btnFilterJurnal')?.addEventListener('click', applyFiltersArchive);
    document.getElementById('btnResetFilterJurnal')?.addEventListener('click', () => {
        document.getElementById('filterGuruJurnal').value = '';
        document.getElementById('filterKelasJurnal').value = '';
        document.getElementById('filterMulaiJurnal').value = '';
        document.getElementById('filterSelesaiJurnal').value = '';
        applyFiltersArchive();
    });

    document.getElementById('btnFilterDisiplin')?.addEventListener('click', applyFiltersArchive);
    document.getElementById('btnResetFilterDisiplin')?.addEventListener('click', () => {
        document.getElementById('filterSiswaDisiplin').value = '';
        document.getElementById('filterKelasDisiplin').value = '';
        document.getElementById('filterMulaiDisiplin').value = '';
        document.getElementById('filterSelesaiDisiplin').value = '';
        applyFiltersArchive();
    });

    document.getElementById('btnExportJurnal')?.addEventListener('click', () => {
        const data = State.filteredJurnal.map(j => ({
            Tanggal: new Date(j.tanggal).toLocaleDateString('id-ID'),
            Guru: j.profiles?.full_name,
            Kelas: j.kelas,
            'Mata Pelajaran': j.mata_pelajaran,
            Materi: j.materi,
            Catatan: j.catatan
        }));
        exportSingleSheet(data, "Arsip Jurnal", "Arsip_Jurnal");
    });

    document.getElementById('btnExportDisiplin')?.addEventListener('click', () => {
        const data = State.filteredDisiplin.map(d => ({
            Tanggal: new Date(d.created_at).toLocaleDateString('id-ID'),
            NISN: d.siswa?.nisn || d.nisn_siswa,
            'Nama Siswa': d.siswa?.nama,
            Kelas: d.siswa?.kelas || '-',
            Pelanggaran: d.pelanggaran_master?.deskripsi,
            Poin: d.pelanggaran_master?.poin,
            Pencatat: d.profiles?.full_name
        }));
        exportSingleSheet(data, "Arsip Disiplin", "Arsip_Disiplin");
    });
});
