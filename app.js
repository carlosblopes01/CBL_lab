// ===== NAVIGATION =====
document.addEventListener('DOMContentLoaded', () => {
    const sections = document.querySelectorAll('.section');

    function switchSection(sectionId) {
        sections.forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

        const target = document.getElementById(sectionId);
        if (target) target.classList.add('active');

        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.dataset.section === sectionId) link.classList.add('active');
        });

        document.getElementById('sidebar').classList.remove('open');
        window.scrollTo(0, 0);

        setTimeout(() => {
            if (target) {
                target.querySelectorAll('.kpi-card, .card').forEach(el => {
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                });
            }
        }, 50);
    }

    document.addEventListener('click', (e) => {
        const link = e.target.closest('.nav-link');
        if (link) {
            e.preventDefault();
            const sectionId = link.dataset.section;
            if (sectionId) {
                // Check access control before navigation
                if (typeof checkAccessAndNavigate === 'function' && !checkAccessAndNavigate(sectionId)) {
                    return; // Blocked — upgrade modal shown
                }
                switchSection(sectionId);
            }
        }
    });

    // Mobile menu toggle
    const menuToggle = document.createElement('button');
    menuToggle.className = 'menu-toggle';
    menuToggle.innerHTML = '&#9776;';
    menuToggle.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });
    document.body.appendChild(menuToggle);
});

// ===== CHARTS =====
let chartInstances = {};

function initCharts() {
    // Destroy existing charts
    Object.values(chartInstances).forEach(c => c.destroy());
    chartInstances = {};

    const d = typeof collectFormData === 'function' ? collectFormData() : {};

    const immoRP = d.immoRP || 0;
    const immoRS = d.immoRS || 0;
    const immoLoc1 = d.immoLoc1 || 0;
    const immoLoc2 = d.immoLoc2 || 0;
    const livrets = d.livrets || 0;
    const av = d.assuranceVie || 0;
    const cto = d.cto || 0;
    const pea = d.pea || 0;

    const hasData = (immoRP + immoRS + immoLoc1 + immoLoc2 + livrets + av + cto + pea) > 0;

    const patrimoineCtx = document.getElementById('patrimoineChart');
    if (patrimoineCtx && hasData) {
        const labels = [];
        const data = [];
        const colors = ['#1a1f36', '#374151', '#2563eb', '#3b82f6', '#0d9488', '#059669', '#d97706', '#7c3aed'];
        const items = [
            ['Residence principale', immoRP],
            ['Residence secondaire', immoRS],
            ['Invest. locatif 1', immoLoc1],
            ['Invest. locatif 2', immoLoc2],
            ['Livrets', livrets],
            ['Assurance Vie', av],
            ['CTO', cto],
            ['PEA', pea]
        ];
        const bgColors = [];
        items.forEach(([n, v], i) => {
            if (v > 0) { labels.push(n); data.push(v); bgColors.push(colors[i]); }
        });

        chartInstances.patrimoine = new Chart(patrimoineCtx, {
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: bgColors, borderWidth: 2, borderColor: '#fff' }] },
            options: {
                responsive: true, maintainAspectRatio: true, cutout: '65%',
                plugins: {
                    legend: { position: 'right', labels: { font: { family: 'Inter', size: 12 }, padding: 12, usePointStyle: true } },
                    tooltip: { callbacks: { label: ctx => { const t = ctx.dataset.data.reduce((a,b)=>a+b,0); return `${ctx.label}: ${fmt(ctx.raw)} (${((ctx.raw/t)*100).toFixed(1)}%)`; } } }
                }
            }
        });
    }

    // Financier chart
    const financierCtx = document.getElementById('financierChart');
    if (financierCtx) {
        const fLabels = []; const fData = []; const fColors = [];
        const fItems = [['Livrets', livrets, '#0d9488'], ['Assurance Vie', av, '#059669'], ['CTO', cto, '#d97706'], ['PEA', pea, '#7c3aed']];
        fItems.forEach(([n,v,c]) => { if (v > 0) { fLabels.push(n); fData.push(v); fColors.push(c); } });
        if (fData.length > 0) {
            chartInstances.financier = new Chart(financierCtx, {
                type: 'doughnut',
                data: { labels: fLabels, datasets: [{ data: fData, backgroundColor: fColors, borderWidth: 2, borderColor: '#fff' }] },
                options: { responsive: true, maintainAspectRatio: true, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 11 }, usePointStyle: true } } } }
            });
        }
    }

    // Comparatif chart
    const comparatifCtx = document.getElementById('comparatifChart');
    if (comparatifCtx) {
        const r = typeof getSimResults === 'function' ? getSimResults() : {};
        const names = []; const invested = []; const finals = [];
        const mapping = [['Immobilier','immo'],['Assurance Vie','av'],['PEA Libre','peaLibre'],['PEA Mandat','peaMandat'],['CTO','cto']];
        mapping.forEach(([n,k]) => { if (r[k]) { names.push(n); invested.push(r[k].capitalInvesti); finals.push(r[k].capitalNet); } });

        if (names.length > 0) {
            chartInstances.comparatif = new Chart(comparatifCtx, {
                type: 'bar',
                data: {
                    labels: names,
                    datasets: [
                        { label: 'Capital investi', data: invested, backgroundColor: 'rgba(37,99,235,0.15)', borderColor: '#2563eb', borderWidth: 2, borderRadius: 6 },
                        { label: 'Capital final net', data: finals, backgroundColor: 'rgba(5,150,105,0.2)', borderColor: '#059669', borderWidth: 2, borderRadius: 6 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: true,
                    plugins: { legend: { position: 'top', labels: { font: { family: 'Inter', size: 12 }, usePointStyle: true } }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw)}` } } },
                    scales: { y: { beginAtZero: true, ticks: { callback: v => (v/1000)+'k', font: { family: 'Inter', size: 11 } }, grid: { color: '#f3f4f6' } }, x: { ticks: { font: { family: 'Inter', size: 11 } }, grid: { display: false } } }
                }
            });
        }
    }
}

// ===== SCROLL ANIMATIONS =====
function animateOnScroll() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.kpi-card, .card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.observe(el);
    });

    setTimeout(() => {
        document.querySelectorAll('.section.active .kpi-card, .section.active .card').forEach(el => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        });
    }, 100);
}
