/**
 * ====================================================================
 * SCRIPT DASHBOARD KEPALA SEKOLAH (DENGAN ANALITIK CHART.JS & EXPORT)
 * ====================================================================
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
    guruList: [],
    kelasList: []
};

// Objek untuk menyimpan instance grafik (agar bisa dihancurkan saat update data)
let charts = {
    trenGlobal: null, disiplinGlobal: null, aktivitasGuru: null, aktivitasKelas: null, pieHadir: null
};

function showLoading(show) { document.getElementById('loadingIndicator').style.display = show ? 'flex' : 'none'; }

async function initSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return window.location.replace('index.html');
    
    const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', session.user.id).single();
    if (profile) {
        if (profile.role !== 'Kepala Sekolah') return window.location.replace('index.html');
        document.getElementById('welcomeMessage').textContent = `Bapak/Ibu ${profile.full_name}`;
    }
}

// --- FETCH DATA GLOBAL ---
async function fetchAllData() {
    showLoading(true);
    
    // Tarik Semua Data Penting Sekaligus
    const [jurnalRes, disiplinRes, siswaRes] = await Promise.all([
        supabaseClient.from('jurnal_pelajaran').select('*, profiles(full_name)').order('tanggal', { ascending: true }),
        supabaseClient.from('catatan_disiplin').select('id, created_at, siswa(nisn, nama), pelanggaran_master(deskripsi, poin), profiles(full_name)'),
        supabaseClient.from('siswa').select('nisn, nama, kelas')
    ]);
    
    showLoading(false);

    if (jurnalRes.data) { State.allJurnal = jurnalRes.data; State.filteredJurnal = jurnalRes.data; }
    if (disiplinRes.data) { State.allDisiplin = disiplinRes.data; State.filteredDisiplin = disiplinRes.data; }
    if (siswaRes.data) { State.allSiswa = siswaRes.data; }

    // Ekstrak Daftar Guru Unik
    State.guruList = [...new Set(State.allJurnal.map(j => j.profiles?.full_name).filter(Boolean))].sort();
    const dropGuru1 = document.getElementById('filterGuruJurnal');
    const dropGuru2 = document.getElementById('chartGuruSelect');
    State.guruList.forEach(g => {
        dropGuru1.innerHTML += `<option value="${g}">${g}</option>`;
        dropGuru2.innerHTML += `<option value="${g}">${g}</option>`;
    });

    // Ekstrak Daftar Kelas Unik
    State.kelasList = [...new Set(State.allJurnal.map(j => j.kelas).filter(Boolean))].sort();
    const dropKelas1 = document.getElementById('chartKelasSelect');
    State.kelasList.forEach(k => {
        dropKelas1.innerHTML += `<option value="${k}">${k}</option>`;
    });

    // Set Default Input Bulan
    const now = new Date();
    document.getElementById('hadirBulanInput').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

    // Render Semua Modul
    renderJurnalTable();
    renderDisiplinTable();
    updateDashboardUmum();
    updateChartGuru();
    updateChartKelas();
}

// ====================================================================
// MODUL 1: DASHBOARD UMUM (OVERVIEW GLOBAL)
// ====================================================================
function updateDashboardUmum() {
    const now = new Date();
    const curMonth = now.getMonth(); const curYear = now.getFullYear();
    
    // Stat: Total Jurnal Bulan Ini
    const jurnalBulanIni = State.allJurnal.filter(j => {
        const d = new Date(j.tanggal); return d.getMonth() === curMonth && d.getFullYear() === curYear;
    });
    document.getElementById('statTotalJurnal').textContent = jurnalBulanIni.length;

    // Stat: Disiplin Bulan Ini
    const disiplinBulanIni = State.allDisiplin.filter(d => {
        const date = new Date(d.created_at); return date.getMonth() === curMonth && date.getFullYear() === curYear;
    });
    document.getElementById('statTotalDisiplin').textContent = disiplinBulanIni.length;

    // Stat: Rata-Rata Kehadiran Kasar Bulan Ini
    // Logika: 1 Jurnal = Hadir Semua Siswa di Kelas itu dikurangi Absen di Catatan.
    let totalExpected = 0; let totalAbsen = 0;
    jurnalBulanIni.forEach(j => {
        const siswaDiKelas = State.allSiswa.filter(s => s.kelas === j.kelas).length;
        if(siswaDiKelas > 0) {
            totalExpected += siswaDiKelas;
            if(j.catatan && j.catatan.includes('--- PRESENSI')) {
                const countAbsen = (j.catatan.match(/\((Sakit\vert{}Izin\vert{}Alfa)\)/gi) || []).length;
                totalAbsen += countAbsen;
            }
        }
    });
    const persentaseHadir = totalExpected === 0 ? 0 : Math.round(((totalExpected - totalAbsen) / totalExpected) * 100);
    document.getElementById('statKehadiran').textContent = `${persentaseHadir}%`;

    // --- Chart 1: Tren Jurnal (7 Hari Terakhir) ---
    const last7Days = Array.from({length: 7}, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d.toISOString().split('T')[0];
    });
    const trenData = last7Days.map(tgl => State.allJurnal.filter(j => j.tanggal === tgl).length);
    
    if(charts.trenGlobal) charts.trenGlobal.destroy();
    charts.trenGlobal = new Chart(document.getElementById('chartTrenGlobal'), {
        type: 'line',
        data: { labels: last7Days, datasets: [{ label: 'Jumlah Jurnal Diajarkan', data: trenData, borderColor: '#3498db', backgroundColor: 'rgba(52, 152, 219, 0.2)', fill: true, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // --- Chart 2: Persentase Jenis Pelanggaran ---
    const topPelanggaran = {};
    State.allDisiplin.forEach(d => {
        const n = d.pelanggaran_master?.deskripsi || 'Lainnya';
        topPelanggaran[n] = (topPelanggaran[n] || 0) + 1;
    });
    const labelPel = Object.keys(topPelanggaran).slice(0,5); // Ambil 5 Terbanyak
    const dataPel = Object.values(topPelanggaran).slice(0,5);

    if(charts.disiplinGlobal) charts.disiplinGlobal.destroy();
    charts.disiplinGlobal = new Chart(document.getElementById('chartDisiplinGlobal'), {
        type: 'doughnut',
        data: { labels: labelPel, datasets: [{ data: dataPel, backgroundColor: ['#e74c3c', '#e67e22', '#f1c40f', '#3498db', '#9b59b6'] }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// ====================================================================
// MODUL 2: ANALISIS KINERJA GURU
// ====================================================================
function updateChartGuru() {
    const guru = document.getElementById('chartGuruSelect').value;
    const timeframe = document.getElementById('chartGuruTimeframe').value;
    
    let dataset = State.allJurnal;
    if (guru !== 'ALL') dataset = dataset.filter(j => j.profiles?.full_name === guru);

    const chartData = groupDataByTimeframe(dataset, timeframe);

    if(charts.aktivitasGuru) charts.aktivitasGuru.destroy();
    charts.aktivitasGuru = new Chart(document.getElementById('chartAktivitasGuru'), {
        type: guru === 'ALL' ? 'bar' : 'line',
        data: { labels: chartData.labels, datasets: [{ label: 'Jumlah Sesi Mengajar', data: chartData.values, backgroundColor: '#2ecc71', borderColor: '#27ae60', borderWidth: 2, fill: true, tension: 0.1 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
}
document.getElementById('chartGuruSelect').addEventListener('change', updateChartGuru);
document.getElementById('chartGuruTimeframe').addEventListener('change', updateChartGuru);

// ====================================================================
// MODUL 3: ANALISIS KELAS
// ====================================================================
function updateChartKelas() {
    const kelas = document.getElementById('chartKelasSelect').value;
    const timeframe = document.getElementById('chartKelasTimeframe').value;
    
    if (kelas === 'ALL') {
        // Tampilkan Bar Chart perbandingan SEMUA kelas secara total
        const countPerKelas = {};
        State.allJurnal.forEach(j => countPerKelas[j.kelas] = (countPerKelas[j.kelas] || 0) + 1);
        const labels = Object.keys(countPerKelas).sort();
        const values = labels.map(l => countPerKelas[l]);

        if(charts.aktivitasKelas) charts.aktivitasKelas.destroy();
        charts.aktivitasKelas = new Chart(document.getElementById('chartAktivitasKelas'), {
            type: 'bar',
            data: { labels: labels, datasets: [{ label: 'Total Sesi Pembelajaran', data: values, backgroundColor: '#9b59b6' }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    } else {
        // Tampilkan Line Chart progres SATU kelas berdasarkan rentang waktu
        const dataset = State.allJurnal.filter(j => j.kelas === kelas);
        const chartData = groupDataByTimeframe(dataset, timeframe);

        if(charts.aktivitasKelas) charts.aktivitasKelas.destroy();
        charts.aktivitasKelas = new Chart(document.getElementById('chartAktivitasKelas'), {
            type: 'line',
            data: { labels: chartData.labels, datasets: [{ label: `Aktivitas Kelas ${kelas}`, data: chartData.values, borderColor: '#8e44ad', backgroundColor: 'rgba(142, 68, 173, 0.2)', fill: true }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}
document.getElementById('chartKelasSelect').addEventListener('change', updateChartKelas);
document.getElementById('chartKelasTimeframe').addEventListener('change', updateChartKelas);

// ====================================================================
// FUNGSI HELPER: PENGELOMPOKAN WAKTU UNTUK GRAFIK
// ====================================================================
function groupDataByTimeframe(dataArray, type) {
    let result = { labels: [], values: [] };
    const counts = {};

    if (type === 'harian') {
        // 7 Hari Terakhir
        for(let i=6; i>=0; i--){
            let d = new Date(); d.setDate(d.getDate() - i);
            let str = d.toISOString().split('T')[0];
            counts[str] = 0; result.labels.push(str);
        }
        dataArray.forEach(j => { if(counts[j.tanggal] !== undefined) counts[j.tanggal]++; });
        result.values = result.labels.map(l => counts[l]);
    } 
    else if (type === 'mingguan') {
        // 4 Pekan Terakhir
        result.labels = ['Pekan 1', 'Pekan 2', 'Pekan 3', 'Pekan 4 (Terbaru)'];
        result.values = [0, 0, 0, 0];
        const now = new Date().getTime();
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        dataArray.forEach(j => {
            const jTime = new Date(j.tanggal).getTime();
            const diffWeeks = Math.floor((now - jTime) / oneWeek);
            if (diffWeeks >= 0 && diffWeeks < 4) {
                result.values[3 - diffWeeks]++; // Pekan 4 adalah pekan saat ini
            }
        });
    } 
    else if (type === 'bulanan') {
        // 12 Bulan Terakhir
        const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
        const curDate = new Date();
        for(let i=11; i>=0; i--) {
            let d = new Date(curDate.getFullYear(), curDate.getMonth() - i, 1);
            let label = `${months[d.getMonth()]} ${d.getFullYear()}`;
            counts[label] = 0; result.labels.push(label);
        }
        dataArray.forEach(j => {
            let d = new Date(j.tanggal);
            let label = `${months[d.getMonth()]} ${d.getFullYear()}`;
            if(counts[label] !== undefined) counts[label]++;
        });
        result.values = result.labels.map(l => counts[l]);
    }

    return result;
}


// ====================================================================
// MODUL 4: ANALISIS KEHADIRAN (PARSING DARI CATATAN JURNAL)
// ====================================================================
document.getElementById('hadirFilterType').addEventListener('change', (e) => {
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
});

document.getElementById('btnGenerateHadir').addEventListener('click', () => {
    const type = document.getElementById('hadirFilterType').value;
    const target = document.getElementById('hadirTargetSelect').value;
    const bulan = document.getElementById('hadirBulanInput').value; // format: YYYY-MM
    
    if(!bulan) return alert("Pilih bulan terlebih dahulu.");

    const [tTahun, tBulan] = bulan.split('-');
    
    // Filter Jurnal Berdasarkan Bulan
    let filteredJurnal = State.allJurnal.filter(j => {
        const d = new Date(j.tanggal);
        return d.getFullYear() == tTahun && (d.getMonth() + 1) == tBulan;
    });

    // Filter Siswa Target
    let targetSiswa = State.allSiswa;
    if (type === 'angkatan') {
        targetSiswa = targetSiswa.filter(s => s.kelas.startsWith(target));
        filteredJurnal = filteredJurnal.filter(j => j.kelas.startsWith(target));
    } else if (type === 'kelas') {
        targetSiswa = targetSiswa.filter(s => s.kelas === target);
        filteredJurnal = filteredJurnal.filter(j => j.kelas === target);
    }

    // Perhitungan
    let rekapAbsenSiswa = {};
    let totalExpectedHadir = 0;
    let sumSakit = 0, sumIzin = 0, sumAlfa = 0;

    targetSiswa.forEach(s => rekapAbsenSiswa[s.nama] = { kelas: s.kelas, total: 0 });

    filteredJurnal.forEach(j => {
        const popKelas = targetSiswa.filter(s => s.kelas === j.kelas).length;
        totalExpectedHadir += popKelas; // Setiap jurnal = semua siswa di kelas itu dianggap hadir awalnya

        if(j.catatan && j.catatan.includes('--- PRESENSI')) {
            const barisCatatan = j.catatan.split('\n');
            barisCatatan.forEach(baris => {
                const match = baris.match(/(.+)\s*\((Sakit\vert{}Izin\vert{}Alfa)\)/i);
                if (match) {
                    const namaSiswa = match[1].trim();
                    const status = match[2].toLowerCase();
                    
                    if (rekapAbsenSiswa[namaSiswa] !== undefined) {
                        rekapAbsenSiswa[namaSiswa].total++;
                        if (status === 'sakit') sumSakit++;
                        else if (status === 'izin') sumIzin++;
                        else if (status === 'alfa') sumAlfa++;
                    }
                }
            });
        }
    });

    const sumHadir = totalExpectedHadir - (sumSakit + sumIzin + sumAlfa);

    // Update Chart Pie
    if(charts.pieHadir) charts.pieHadir.destroy();
    charts.pieHadir = new Chart(document.getElementById('chartPieHadir'), {
        type: 'pie',
        data: { 
            labels: ['Hadir', 'Sakit', 'Izin', 'Alfa'], 
            datasets: [{ data: [sumHadir, sumSakit, sumIzin, sumAlfa], backgroundColor: ['#2ecc71', '#f1c40f', '#3498db', '#e74c3c'] }] 
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Update Top 10 Siswa Sering Absen
    const arrayAbsen = Object.keys(rekapAbsenSiswa)
        .map(nama => ({ nama, kelas: rekapAbsenSiswa[nama].kelas, total: rekapAbsenSiswa[nama].total }))
        .filter(s => s.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

    const tbody = document.getElementById('tbodyTopAbsen');
    if (arrayAbsen.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Alhamdulillah, tidak ada siswa absen di periode ini.</td></tr>';
    } else {
        tbody.innerHTML = arrayAbsen.map(s => `<tr><td>${s.nama}</td><td>${s.kelas}</td><td style="color:red; font-weight:bold;">${s.total} Kali</td></tr>`).join('');
    }
});


// ====================================================================
// MODUL 5: ARSIP TABEL (VERSI LAMA - TETAP DIPERTAHANKAN)
// ====================================================================

function renderJurnalTable() {
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

function renderDisiplinTable() {
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

function applyFiltersArchive() {
    const guru = document.getElementById('filterGuruJurnal').value;
    const m1 = document.getElementById('filterMulaiJurnal').value;
    const s1 = document.getElementById('filterSelesaiJurnal').value;
    
    State.filteredJurnal = State.allJurnal.filter(j => {
        const tgl = new Date(j.tanggal);
        const matchGuru = !guru || j.profiles?.full_name === guru;
        const matchTgl = (!m1 || tgl >= new Date(m1)) && (!s1 || tgl <= new Date(s1));
        return matchGuru && matchTgl;
    });
    renderJurnalTable();

    const siswa = document.getElementById('filterSiswaDisiplin').value.toLowerCase();
    const m2 = document.getElementById('filterMulaiDisiplin').value;
    const s2 = document.getElementById('filterSelesaiDisiplin').value;
    
    State.filteredDisiplin = State.allDisiplin.filter(d => {
        const tgl = new Date(d.created_at);
        const matchSiswa = !siswa || (d.siswa?.nama || '').toLowerCase().includes(siswa) || (d.siswa?.nisn || '').includes(siswa);
        const matchTgl = (!m2 || tgl >= new Date(m2)) && (!s2 || tgl <= new Date(s2));
        return matchSiswa && matchTgl;
    });
    renderDisiplinTable();
}

function exportExcel(type) {
    let dataToExport = [];
    let filename = '';
    
    if (type === 'jurnal') {
        dataToExport = State.filteredJurnal.map(j => ({
            Tanggal: new Date(j.tanggal).toLocaleDateString('id-ID'),
            Guru: j.profiles?.full_name, Kelas: j.kelas, 'Mata Pelajaran': j.mata_pelajaran,
            Materi: j.materi, Catatan: j.catatan
        }));
        filename = `Arsip_Jurnal_${new Date().toISOString().slice(0, 10)}.xlsx`;
    } else {
        dataToExport = State.filteredDisiplin.map(d => ({
            Tanggal: new Date(d.created_at).toLocaleDateString('id-ID'),
            NISN: d.siswa?.nisn, 'Nama Siswa': d.siswa?.nama,
            Pelanggaran: d.pelanggaran_master?.deskripsi, Poin: d.pelanggaran_master?.poin,
            Pencatat: d.profiles?.full_name
        }));
        filename = `Arsip_Disiplin_${new Date().toISOString().slice(0, 10)}.xlsx`;
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap");
    XLSX.writeFile(wb, filename);
}

// --- INISIALISASI EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', async () => {
    if(!document.querySelector('.dashboard-wrapper')) return;
    
    await initSession();
    await fetchAllData();

    // Navigasi Tab / Sidebar
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

    document.getElementById('btnFilterJurnal').addEventListener('click', applyFiltersArchive);
    document.getElementById('btnFilterDisiplin').addEventListener('click', applyFiltersArchive);
    document.getElementById('btnExportJurnal').addEventListener('click', () => exportExcel('jurnal'));
    document.getElementById('btnExportDisiplin').addEventListener('click', () => exportExcel('disiplin'));
});
