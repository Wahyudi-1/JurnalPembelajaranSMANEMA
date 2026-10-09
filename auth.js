async function handleLogin() {
    const email = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) return showStatusMessage('Email dan password harus diisi.', 'error');

    showLoading(true);
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    
    if (error) {
        showLoading(false);
        return showStatusMessage(`Login Gagal: ${error.message}`, 'error');
    }
    
    // Ambil role pengguna dari tabel profiles
    const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

    showLoading(false);

    if (profileError) {
        return showStatusMessage('Gagal mengambil data profil.', 'error');
    }

    showStatusMessage('Login berhasil! Mengalihkan...', 'success');
    
    // PENGALIHAN BERDASARKAN ROLE
    if (profile.role === 'Kepala Sekolah') {
        window.location.href = 'rekap.html';
    } else if (profile.role === 'Guru') {
        window.location.href = 'guru.html';
    } else {
        // Default Admin
        window.location.href = 'dashboard.html'; 
    }
}
