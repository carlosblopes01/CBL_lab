// ===== AUTHENTICATION SYSTEM (localStorage) =====

function getUsers() {
    return JSON.parse(localStorage.getItem('cgp_users') || '[]');
}

function saveUsers(users) {
    localStorage.setItem('cgp_users', JSON.stringify(users));
}

function getCurrentUser() {
    const id = localStorage.getItem('cgp_current_user');
    if (!id) return null;
    return getUsers().find(u => u.id === id) || null;
}

function setCurrentUser(id) {
    localStorage.setItem('cgp_current_user', id);
}

function getUserData() {
    const user = getCurrentUser();
    if (!user) return {};
    return JSON.parse(localStorage.getItem('cgp_data_' + user.id) || '{}');
}

function saveUserData(data) {
    const user = getCurrentUser();
    if (!user) return;
    localStorage.setItem('cgp_data_' + user.id, JSON.stringify(data));

    // Sync to cloud
    if (typeof syncClientDataToCloud === 'function') syncClientDataToCloud(user.id, data);
}

function showLogin() {
    document.getElementById('login-form').classList.add('active');
    document.getElementById('signup-form').classList.remove('active');
    clearErrors();
}

function showSignup() {
    document.getElementById('signup-form').classList.add('active');
    document.getElementById('login-form').classList.remove('active');
    clearErrors();
}

function showAuthScreen(type) {
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('main-content').classList.add('hidden');
    if (type === 'signup') showSignup();
    else showLogin();
}

function showLanding() {
    document.getElementById('landing-page').classList.remove('hidden');
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('main-content').classList.add('hidden');
    const mt = document.querySelector('.menu-toggle');
    if (mt) mt.style.display = 'none';
}

function clearErrors() {
    document.getElementById('login-error').textContent = '';
    document.getElementById('signup-error').textContent = '';
}

function handleSignup() {
    const nom = document.getElementById('signup-nom').value.trim();
    const prenom = document.getElementById('signup-prenom').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const pw = document.getElementById('signup-password').value;
    const pw2 = document.getElementById('signup-password2').value;
    const errEl = document.getElementById('signup-error');

    if (!nom || !prenom || !email || !pw) {
        errEl.textContent = 'Veuillez remplir tous les champs.';
        return;
    }
    if (pw.length < 6) {
        errEl.textContent = 'Le mot de passe doit contenir au moins 6 caracteres.';
        return;
    }
    if (pw !== pw2) {
        errEl.textContent = 'Les mots de passe ne correspondent pas.';
        return;
    }

    const users = getUsers();
    if (users.find(u => u.email === email)) {
        errEl.textContent = 'Un compte existe deja avec cet email.';
        return;
    }

    const id = 'user_' + Date.now();
    const newUser = { id, nom, prenom, email, password: pw, createdAt: new Date().toISOString() };
    users.push(newUser);
    saveUsers(users);

    // Sync to cloud
    if (typeof syncUserToCloud === 'function') syncUserToCloud(newUser);

    // Pre-fill profile with signup data
    setCurrentUser(id);
    saveUserData({ nom, prenom });

    enterApp();
}

function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const pw = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');

    if (!email || !pw) {
        errEl.textContent = 'Veuillez remplir tous les champs.';
        return;
    }

    const users = getUsers();
    const user = users.find(u => u.email === email && u.password === pw);
    if (!user) {
        errEl.textContent = 'Email ou mot de passe incorrect.';
        return;
    }

    setCurrentUser(user.id);
    enterApp();
}

function handleLogout() {
    localStorage.removeItem('cgp_current_user');
    showLanding();
}

function enterApp() {
    const user = getCurrentUser();
    if (!user) return;

    // Check URL param for offer type
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('offer')) {
        localStorage.setItem('cgp_offer_type', urlParams.get('offer'));
    }

    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('sidebar').classList.remove('hidden');
    document.getElementById('main-content').classList.remove('hidden');

    // Set user info in sidebar
    document.getElementById('user-name').textContent = user.prenom + ' ' + user.nom;
    document.getElementById('user-avatar').textContent = (user.prenom[0] || 'U').toUpperCase();

    // Restrict sidebar for diagnostic offer
    const offerType = localStorage.getItem('cgp_offer_type');
    if (offerType === 'diagnostic') {
        const allowedSections = ['accueil', 'profil', 'immobilier', 'assurance-vie', 'pea', 'cto', 'comparatif', 'recommandation'];
        document.querySelectorAll('.nav-link[data-section]').forEach(link => {
            const section = link.getAttribute('data-section');
            if (!allowedSections.includes(section)) {
                link.closest('li').style.display = 'none';
            }
        });
    }

    // Load saved data into forms
    loadFormData();

    // Recalculate
    recalcAll();

    // Update contextual dashboard
    if (typeof updateDashboardContext === 'function') updateDashboardContext();

    // Init charts after DOM is visible
    setTimeout(() => {
        if (typeof initCharts === 'function') initCharts();
        if (typeof animateOnScroll === 'function') animateOnScroll();
    }, 100);
}

function loadFormData() {
    const data = getUserData();
    document.querySelectorAll('[data-field]').forEach(el => {
        const key = el.dataset.field;
        if (data[key] !== undefined) {
            el.value = data[key];
        }
    });
}

function collectFormData() {
    const data = {};
    document.querySelectorAll('[data-field]').forEach(el => {
        const key = el.dataset.field;
        if (el.type === 'number') {
            data[key] = parseFloat(el.value) || 0;
        } else {
            data[key] = el.value;
        }
    });
    return data;
}

// Auto-check login on page load
document.addEventListener('DOMContentLoaded', () => {
    if (getCurrentUser()) {
        enterApp();
    } else {
        showLanding();
    }

    // Landing nav scroll effect
    window.addEventListener('scroll', () => {
        const nav = document.querySelector('.landing-nav');
        if (nav) {
            nav.classList.toggle('scrolled', window.scrollY > 50);
        }
    });
});
