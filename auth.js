/**
 * =================================================================
 * SCRIPT OTENTIKASI - SISTEM JURNAL & DISIPLIN GURU
 * =================================================================
 * @version 3.0 - Mendukung Offline Session Caching & Perbaikan PWA Button
 */

const SUPABASE_URL = 'https://pbfhvyqhshuvyakjfpka.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZmh2eXFoc2h1dnlha2pmcGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MTY1NTksImV4cCI6MjEwNjk5MjU1OX0.RMDKCmkniLHoCgxsFr0noBlbB4DoqH1CTZc4lRtnPNg';

const OFFLINE_PROFILE_KEY = 'smanema_cached_profile';

if (typeof window.supabase === 'undefined') {
    console.error('CRITICAL ERROR: Library Supabase belum dimuat.');
}

const { createClient } = window.supabase;
var supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====================================================================
// TAHAP 2: FUNGSI PEMBANTU (UI HELPERS)
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
    
    if (duration > 0) {
        setTimeout(() => { statusEl.style.display = 'none'; }, duration);
    }
}

// ====================================================================
// TAHAP 3: FUNGSI ROUTING (DENGAN DUKUNGAN CACHE OFFLINE)
// ====================================================================

function redirectByRole(role) {
    if (role === 'Kepala Sekolah') window.location.replace('rekap.html');
    else if (role === 'Wali Kelas') window.location.replace('walikelas.html');
    else if (role === 'Guru') window.location.replace('guru.html');
    else if (role === 'Siswa') window.location.replace('siswa.html');
    else window.location.replace('dashboard.html'); // Admin
}

async function routeUser(userId) {
    // Jika sedang OFFLINE, gunakan data profil yang tersimpan di localStorage HP
    if (!navigator.onLine) {
        const cached = localStorage.getItem(OFFLINE_PROFILE_KEY);
        if (cached) {
            const parsedProfile = JSON.parse(cached);
            redirectByRole(parsedProfile.role);
            return;
        }
    }

    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error || !profile) {
        // Fallback ke cache lokal jika jaringan tiba-tiba terputus
        const cached = localStorage.getItem(OFFLINE_PROFILE_KEY);
        if (cached) {
            const parsedProfile = JSON.parse(cached);
            redirectByRole(parsedProfile.role);
            return;
        }
        showStatusMessage('Gagal membaca hak akses profil dari database.', 'error');
        showLoading(false);
        return;
    }

    // Simpan profil ke penyimpanan lokal HP agar bisa digunakan saat Offline
    localStorage.setItem(OFFLINE_PROFILE_KEY, JSON.stringify(profile));
    redirectByRole(profile.role);
}

// ====================================================================
// TAHAP 4: FUNGSI OTENTIKASI & MANAJEMEN SESI
// ====================================================================

async function checkSessionForLoginPage() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && !window.location.hash.includes('type=recovery')) {
            showLoading(true);
            await routeUser(session.user.id);
        }
    } catch (err) {
        // Jika offline dan masih ada sesi lokal tersimpan
        const cached = localStorage.getItem(OFFLINE_PROFILE_KEY);
        if (cached && !navigator.onLine) {
            const parsed = JSON.parse(cached);
            redirectByRole(parsed.role);
        }
    }
}

async function handleLogin(e) {
    if (e) e.preventDefault();
    
    if (!navigator.onLine) {
        const cached = localStorage.getItem(OFFLINE_PROFILE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            showStatusMessage('Masuk menggunakan sesi Offline yang tersimpan...', 'info', 2000);
            setTimeout(() => redirectByRole(parsed.role), 1000);
            return;
        }
        return showStatusMessage('Anda sedang offline. Login pertama kali memerlukan koneksi internet.', 'error');
    }

    const email = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        return showStatusMessage('Email dan password harus diisi.', 'error');
    }

    showLoading(true);
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        showLoading(false);
        return showStatusMessage(`Login Gagal: ${error.message}`, 'error');
    }
    
    showStatusMessage('Login berhasil! Mengalihkan ke halaman Anda...', 'success', 0);
    await routeUser(data.user.id);
}

async function handleForgotPassword(e) {
    if (e) e.preventDefault();
    const emailEl = document.getElementById('username');
    const email = emailEl.value.trim();

    if (!email) {
        return showStatusMessage('Silakan masukkan alamat email Anda, lalu klik "Lupa Password?".', 'error');
    }
    if (!confirm(`Anda akan mengirimkan link reset password ke alamat: ${email}. Lanjutkan?`)) {
        return;
    }

    showLoading(true);
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname,
    });
    showLoading(false);

    if (error) return showStatusMessage(`Gagal mengirim email: ${error.message}`, 'error');
    showStatusMessage('Email untuk reset password telah dikirim! Silakan periksa kotak masuk Anda.', 'success');
}

function setupPasswordToggle() {
    const toggleIcon = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    if (!toggleIcon || !passwordInput) return;

    const eyeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/><path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/></svg>`;
    const eyeSlashIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.94 5.94 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/><path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.288.822.822.083.083.083.083a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829l.822.822.083.083z"/><path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 6.884-12-12 .708-.708 12 12-.708.708z"/></svg>`;
    
    toggleIcon.innerHTML = eyeIcon;
    toggleIcon.onclick = () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        toggleIcon.innerHTML = isPassword ? eyeSlashIcon : eyeIcon;
    };
}

function setupAuthListener() {
    supabaseClient.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
            const loginBox = document.querySelector('.login-box');
            const resetContainer = document.getElementById('resetPasswordContainer');
            if (!loginBox || !resetContainer) return;
            
            loginBox.style.display = 'none';
            resetContainer.style.display = 'grid';

            document.getElementById('resetPasswordForm').onsubmit = async (e) => {
                e.preventDefault();
                const newPassword = document.getElementById('newPassword').value;
                if (!newPassword || newPassword.length < 6) {
                    return showStatusMessage('Password baru minimal 6 karakter.', 'error');
                }
                
                showLoading(true);
                const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
                showLoading(false);
                
                if (error) return showStatusMessage(`Gagal memperbarui password: ${error.message}`, 'error');
                
                showStatusMessage('Password berhasil diperbarui! Mengalihkan ke login...', 'success', 3000);
                setTimeout(() => { 
                    window.location.hash = '';
                    window.location.reload(); 
                }, 3000);
            };
        }
    });
}

// ====================================================================
// TAHAP 5: INISIALISASI HALAMAN LOGIN (TANPA MERUSAK TOMBOL PWA)
// ====================================================================

function initLoginPage() {
    checkSessionForLoginPage();
    setupAuthListener();
    setupPasswordToggle();

    const loginForm = document.getElementById('loginFormElement') || document.querySelector('.login-form-container form');
    if (loginForm) {
        loginForm.onsubmit = handleLogin;
    }

    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) {
        forgotPasswordLink.onclick = handleForgotPassword;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoginPage);
} else {
    initLoginPage();
}
