/**
 * =================================================================
 * SCRIPT OTENTIKASI - SISTEM JURNAL & DISIPLIN GURU
 * =================================================================
 * @version 1.1 - Fix "Identifier already declared" & Robust Loading
 * @author Disesuaikan oleh AI untuk Proyek Anda
 */

// ====================================================================
// TAHAP 1: KONFIGURASI SUPABASE (DIPERBARUI)
// ====================================================================

const SUPABASE_URL = 'https://lkxjgsgkajpaloswedck.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxreGpnc2drYWpwYWxvc3dlZGNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MDEyMjQsImV4cCI6MjA4NjE3NzIyNH0.A2KeArJQz6TNtLauZSyurMit3IK4hClwdoy4_qicPUc';

// Cek apakah library Supabase sudah dimuat
if (typeof window.supabase === 'undefined') {
    console.error('CRITICAL ERROR: Library Supabase belum dimuat. Pastikan script CDN ada di index.html');
    alert('Sistem Error: Koneksi ke database gagal (Library Missing).');
}

const { createClient } = window.supabase;

// [PERBAIKAN] Menggunakan 'var' dan nama 'supabaseClient' untuk menghindari konflik
// jika script tidak sengaja terpanggil dua kali atau konflik dengan nama global library.
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
    // Scroll ke pesan agar terlihat user
    statusEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    if (duration > 0) {
        setTimeout(() => { statusEl.style.display = 'none'; }, duration);
    }
}


// ====================================================================
// TAHAP 3: FUNGSI OTENTIKASI & MANAJEMEN SESI
// ====================================================================

async function checkSessionForLoginPage() {
    // Gunakan supabaseClient yang baru
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session && !window.location.hash.includes('type=recovery')) {
        console.log('User sudah login, mengalihkan ke dashboard...');
        window.location.replace('dashboard.html');
    }
}

async function handleLogin() {
    console.log('Proses Login Dimulai...'); // Debugging log
    const email = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        return showStatusMessage('Email dan password harus diisi.', 'error');
    }

    showLoading(true);
    // Gunakan supabaseClient
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    showLoading(false);

    if (error) {
        console.error('Login Error:', error);
        return showStatusMessage(`Login Gagal: ${error.message}`, 'error');
    }
    
    console.log('Login Berhasil:', data);
    showStatusMessage('Login berhasil! Mengalihkan...', 'success');
    window.location.href = 'dashboard.html';
}

async function handleForgotPassword() {
    const emailEl = document.getElementById('username');
    const email = emailEl.value;

    if (!email) {
        return showStatusMessage('Silakan masukkan alamat email Anda, lalu klik "Lupa Password?".', 'error');
    }

    if (!confirm(`Anda akan mengirimkan link reset password ke alamat: ${email}. Lanjutkan?`)) {
        return;
    }

    showLoading(true);
    // Gunakan supabaseClient
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/index.html',
    });
    showLoading(false);

    if (error) {
        return showStatusMessage(`Gagal mengirim email: ${error.message}`, 'error');
    }
    
    showStatusMessage('Email untuk reset password telah dikirim! Silakan periksa kotak masuk Anda.', 'success');
}

function setupPasswordToggle() {
    const toggleIcon = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    if (!toggleIcon || !passwordInput) return;

    const eyeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/><path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/></svg>`;
    const eyeSlashIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.94 5.94 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/><path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.288.822.822.083.083.083.083a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829l.822.822.083.083z"/><path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 6.884-12-12 .708-.708 12 12-.708.708z"/></svg>`;
    
    toggleIcon.innerHTML = eyeIcon;
    toggleIcon.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        toggleIcon.innerHTML = isPassword ? eyeSlashIcon : eyeIcon;
    });
}

function setupAuthListener() {
    // Gunakan supabaseClient
    supabaseClient.auth.onAuthStateChange((event, session) => {
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
                // Gunakan supabaseClient
                const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
                showLoading(false);
                
                if (error) {
                    return showStatusMessage(`Gagal memperbarui password: ${error.message}`, 'error');
                }
                
                showStatusMessage('Password berhasil diperbarui! Anda akan diarahkan ke halaman login.', 'success', 3000);
                setTimeout(() => { 
                    window.location.hash = '';
                    window.location.reload(); 
                }, 3000);
            };
        }
    });
}


// ====================================================================
// TAHAP 4: INISIALISASI HALAMAN LOGIN
// ====================================================================

function initLoginPage() {
    console.log('Inisialisasi Halaman Login...');
    checkSessionForLoginPage();
    setupAuthListener();
    setupPasswordToggle();

    const loginForm = document.querySelector('.login-form-container form'); // Selektor lebih spesifik
    if (loginForm) {
        // Hapus event listener lama dengan clone node (trik untuk membersihkan event listener duplikat)
        const newForm = loginForm.cloneNode(true);
        loginForm.parentNode.replaceChild(newForm, loginForm);
        
        newForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleLogin();
        });
        
        // Re-attach password toggle logic karena elemen input baru saja di-clone
        setupPasswordToggle(); 
    } else {
        console.error('Form login tidak ditemukan!');
    }

    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) {
        const newLink = forgotPasswordLink.cloneNode(true);
        forgotPasswordLink.parentNode.replaceChild(newLink, forgotPasswordLink);
        
        newLink.addEventListener('click', (e) => {
            e.preventDefault();
            handleForgotPassword();
        });
    }
}

// Jalankan saat dokumen siap
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoginPage);
} else {
    initLoginPage();
}
