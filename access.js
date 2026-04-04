// ===== ACCESS CONTROL SYSTEM =====
// Manages user roles, permissions, and feature gating for Patria Capital
//
// User Roles:
//   'free'           — No access (landing page only)
//   'simulation'     — Offer 1: basic tool access (paid 49€)
//   'strategie'      — Offer 2: full tool access (paid 1 900€)
//   'accompagnement' — Offer 3: full access + ongoing support
//
// Access Levels:
//   0 = free (no tool access)
//   1 = simulation (limited features)
//   2 = strategie (full features)
//   3 = accompagnement (full + support)

const ACCESS = {
    // Feature permissions by role
    permissions: {
        free: {
            level: 0,
            sections: [],
            features: []
        },
        simulation: {
            level: 1,
            sections: ['accueil', 'profil', 'patrimoine', 'immobilier', 'assurance-vie', 'pea', 'cto'],
            features: ['saisie', 'vue-globale', 'indicateurs', 'simulations-base', 'dashboard']
        },
        strategie: {
            level: 2,
            sections: ['accueil', 'profil', 'patrimoine', 'immobilier', 'assurance-vie', 'pea', 'cto', 'comparatif', 'recommandation', 'fiscalite', 'ifi', 'demembrement', 'clause-benef', 'dirigeant', 'obo'],
            features: ['saisie', 'vue-globale', 'indicateurs', 'simulations-base', 'dashboard', 'optimisation-fiscale', 'allocation', 'arbitrages', 'comparatifs', 'projections', 'rapport']
        },
        accompagnement: {
            level: 3,
            sections: ['accueil', 'profil', 'patrimoine', 'immobilier', 'assurance-vie', 'pea', 'cto', 'comparatif', 'recommandation', 'fiscalite', 'ifi', 'demembrement', 'clause-benef', 'dirigeant', 'obo'],
            features: ['saisie', 'vue-globale', 'indicateurs', 'simulations-base', 'dashboard', 'optimisation-fiscale', 'allocation', 'arbitrages', 'comparatifs', 'projections', 'rapport', 'suivi', 'reporting', 'coordination']
        }
    },

    // Locked sections for simulation users (shown with lock overlay)
    lockedForSimulation: ['comparatif', 'recommandation', 'fiscalite', 'ifi', 'demembrement', 'clause-benef'],

    // Upgrade messages per locked feature
    upgradeMessages: {
        comparatif: {
            title: 'Comparatif d\'enveloppes',
            message: 'Comparez AV, PEA, PER, SCPI et CTO en détail pour identifier l\'allocation optimale.',
            cta: 'Débloquer avec la Stratégie patrimoniale'
        },
        recommandation: {
            title: 'Recommandation personnalisée',
            message: 'Recevez une stratégie d\'allocation sur-mesure basée sur votre profil et vos objectifs.',
            cta: 'Débloquer avec la Stratégie patrimoniale'
        },
        fiscalite: {
            title: 'Optimisation fiscale',
            message: 'Analyse détaillée de votre fiscalité avec leviers d\'optimisation chiffrés.',
            cta: 'Débloquer avec la Stratégie patrimoniale'
        },
        ifi: {
            title: 'Simulation IFI',
            message: 'Calcul précis de votre IFI et stratégies de réduction.',
            cta: 'Débloquer avec la Stratégie patrimoniale'
        },
        demembrement: {
            title: 'Démembrement',
            message: 'Simulation de démembrement (donation, transmission, usufruit temporaire).',
            cta: 'Débloquer avec la Stratégie patrimoniale'
        },
        'clause-benef': {
            title: 'Clause bénéficiaire',
            message: 'Optimisation des clauses bénéficiaires de vos contrats d\'assurance-vie.',
            cta: 'Débloquer avec la Stratégie patrimoniale'
        }
    }
};

// ===== ROLE MANAGEMENT =====

function getUserRole() {
    return localStorage.getItem('userRole') || 'free';
}

function getAccessLevel() {
    return parseInt(localStorage.getItem('accessLevel')) || 0;
}

function setUserRole(role) {
    if (!ACCESS.permissions[role]) return;
    localStorage.setItem('userRole', role);
    localStorage.setItem('accessLevel', ACCESS.permissions[role].level);
}

function hasAccess(section) {
    const role = getUserRole();
    const perms = ACCESS.permissions[role];
    if (!perms) return false;
    return perms.sections.includes(section);
}

function hasFeature(feature) {
    const role = getUserRole();
    const perms = ACCESS.permissions[role];
    if (!perms) return false;
    return perms.features.includes(feature);
}

function isLocked(section) {
    const role = getUserRole();
    if (role === 'free') return true;
    if (role === 'simulation') return ACCESS.lockedForSimulation.includes(section);
    return false;
}

// ===== UI INTEGRATION =====

function initAccessControl() {
    const role = getUserRole();
    const level = getAccessLevel();

    // Check for welcome redirect (after payment)
    const params = new URLSearchParams(window.location.search);
    if (params.get('welcome') === 'true') {
        showWelcomeMessage(params.get('access') || role);
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
    }

    // Apply sidebar locks based on role
    applySidebarLocks();

    // Add locked overlays to sections
    addLockedOverlays();

    // Update user badge
    updateUserBadge();
}

function applySidebarLocks() {
    const role = getUserRole();

    ACCESS.lockedForSimulation.forEach(function(section) {
        const link = document.querySelector('.nav-link[data-section="' + section + '"]');
        if (!link) return;

        const li = link.closest('li');
        if (!li) return;

        if (isLocked(section)) {
            link.classList.add('locked');
            // Add lock icon if not already present
            if (!link.querySelector('.lock-icon')) {
                var lockSpan = document.createElement('span');
                lockSpan.className = 'lock-icon';
                lockSpan.innerHTML = '&#128274;';
                lockSpan.style.cssText = 'margin-left:auto;font-size:12px;opacity:0.5;';
                link.appendChild(lockSpan);
            }
        } else {
            link.classList.remove('locked');
            var existingLock = link.querySelector('.lock-icon');
            if (existingLock) existingLock.remove();
        }
    });
}

function addLockedOverlays() {
    const role = getUserRole();
    if (role !== 'simulation') return;

    ACCESS.lockedForSimulation.forEach(function(sectionId) {
        var section = document.getElementById(sectionId);
        if (!section) return;

        // Check if overlay already exists
        if (section.querySelector('.locked-overlay')) return;

        var msg = ACCESS.upgradeMessages[sectionId] || {
            title: 'Fonctionnalité premium',
            message: 'Cette fonctionnalité est disponible avec l\'offre Stratégie patrimoniale.',
            cta: 'Voir les offres'
        };

        var overlay = document.createElement('div');
        overlay.className = 'locked-overlay';
        overlay.innerHTML = '<div class="locked-overlay-content">' +
            '<div class="locked-overlay-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#c1925e" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div>' +
            '<h3 class="locked-overlay-title">' + msg.title + '</h3>' +
            '<p class="locked-overlay-text">' + msg.message + '</p>' +
            '<a href="offres.html" class="btn btn-gold">' + msg.cta + '</a>' +
            '<p class="locked-overlay-hint">Votre offre actuelle : Simulation patrimoniale</p>' +
            '</div>';

        // Make the section content blurred
        var children = section.children;
        for (var i = 0; i < children.length; i++) {
            if (!children[i].classList.contains('section-header')) {
                children[i].style.filter = 'blur(6px)';
                children[i].style.pointerEvents = 'none';
                children[i].style.userSelect = 'none';
            }
        }

        section.style.position = 'relative';
        section.appendChild(overlay);
    });
}

function updateUserBadge() {
    const role = getUserRole();
    const badgeEl = document.getElementById('user-badge');
    const roleLabels = {
        free: '',
        simulation: 'Simulation',
        strategie: 'Stratégie',
        accompagnement: 'Accompagnement'
    };

    if (badgeEl && roleLabels[role]) {
        badgeEl.textContent = roleLabels[role];
        badgeEl.style.display = 'inline-block';
    }

    // Also update sidebar footer if exists
    var sidebarFooter = document.querySelector('.sidebar-footer');
    if (sidebarFooter && role === 'simulation') {
        var upgradeBtn = sidebarFooter.querySelector('.btn-upgrade');
        if (!upgradeBtn) {
            upgradeBtn = document.createElement('a');
            upgradeBtn.href = 'offres.html';
            upgradeBtn.className = 'btn btn-outline btn-full btn-sm btn-upgrade';
            upgradeBtn.style.cssText = 'margin-top:8px;font-size:12px;';
            upgradeBtn.textContent = 'Passer à la Stratégie →';
            sidebarFooter.insertBefore(upgradeBtn, sidebarFooter.querySelector('.version'));
        }
    }
}

function showWelcomeMessage(accessType) {
    var messages = {
        simulation: {
            title: 'Bienvenue ! Votre simulation est activée.',
            text: 'Complétez votre profil pour obtenir vos premiers résultats.',
            icon: '&#9733;'
        },
        strategie: {
            title: 'Bienvenue ! Votre accès Stratégie est activé.',
            text: 'Vous avez accès à l\'ensemble de nos outils d\'analyse et de simulation.',
            icon: '&#9733;'
        },
        accompagnement: {
            title: 'Bienvenue dans votre espace Accompagnement.',
            text: 'Votre conseiller dédié vous contactera sous 24h.',
            icon: '&#9733;'
        }
    };

    var msg = messages[accessType];
    if (!msg) return;

    // Create welcome banner (will be shown on dashboard)
    setTimeout(function() {
        var banner = document.getElementById('completion-banner');
        if (banner) {
            var welcomeDiv = document.createElement('div');
            welcomeDiv.className = 'welcome-banner';
            welcomeDiv.style.cssText = 'background:linear-gradient(135deg,#c1925e,#dbb88a);color:#fff;padding:20px 28px;border-radius:12px;margin-bottom:20px;display:flex;align-items:center;gap:16px;';
            welcomeDiv.innerHTML = '<span style="font-size:28px;">' + msg.icon + '</span>' +
                '<div><strong style="font-size:16px;">' + msg.title + '</strong>' +
                '<p style="margin:4px 0 0;opacity:0.9;font-size:14px;">' + msg.text + '</p></div>' +
                '<button onclick="this.parentElement.remove()" style="margin-left:auto;background:none;border:none;color:#fff;font-size:20px;cursor:pointer;opacity:0.7;">&times;</button>';
            banner.parentElement.insertBefore(welcomeDiv, banner);
        }
    }, 500);
}

// ===== SECTION NAVIGATION OVERRIDE =====
// Override the default section navigation to check access

function checkAccessAndNavigate(sectionId) {
    if (isLocked(sectionId)) {
        // Show upgrade modal instead of navigating
        showUpgradeModal(sectionId);
        return false;
    }
    return true;
}

function showUpgradeModal(sectionId) {
    var msg = ACCESS.upgradeMessages[sectionId] || {
        title: 'Fonctionnalité premium',
        message: 'Passez à l\'offre Stratégie pour débloquer cette fonctionnalité.',
        cta: 'Voir les offres'
    };

    // Remove existing modal
    var existing = document.getElementById('upgrade-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'upgrade-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(12,15,26,0.85);display:flex;align-items:center;justify-content:center;z-index:10000;backdrop-filter:blur(4px);';
    modal.innerHTML = '<div style="background:#fff;border-radius:16px;padding:48px;max-width:480px;width:90%;text-align:center;position:relative;">' +
        '<button onclick="document.getElementById(\'upgrade-modal\').remove()" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;color:#999;">&times;</button>' +
        '<div style="margin-bottom:20px;"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#c1925e" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div>' +
        '<h3 style="font-family:Playfair Display,serif;font-size:22px;color:#0c0f1a;margin-bottom:12px;">' + msg.title + '</h3>' +
        '<p style="font-size:14px;color:#6b7b8d;line-height:1.7;margin-bottom:28px;">' + msg.message + '</p>' +
        '<a href="offres.html" class="btn btn-gold" style="display:inline-block;padding:14px 32px;text-decoration:none;font-size:15px;">' + msg.cta + '</a>' +
        '<p style="font-size:12px;color:#999;margin-top:16px;">Votre offre actuelle : Simulation patrimoniale</p>' +
        '</div>';

    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.remove();
    });
}

// ===== INITIALIZATION =====
// Auto-init when DOM is ready (only on pages with the simulator)
if (document.getElementById('sidebar')) {
    document.addEventListener('DOMContentLoaded', function() {
        initAccessControl();
    });
}
