// ===== CONFIGURATION CGP =====
const CGP_EMAIL = 'carlosblopes01@gmail.com'; // <-- Remplacez par votre email professionnel
const CGP_NOM = 'Patria Capital';

// ===== CALCULATION ENGINE =====

function fmt(n) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function pct(n) {
    return (n * 100).toFixed(1) + '%';
}

function getField(name) {
    const el = document.querySelector(`[data-field="${name}"]`);
    if (!el) return 0;
    if (el.type === 'number') return parseFloat(el.value) || 0;
    return el.value;
}

// ===== REAL-TIME PROFILE CALCULATIONS =====
function recalcAll() {
    const d = collectFormData();

    // Revenus
    const totalRevenusClient = (d.salairesClient || 0) + (d.revenusBIC || 0) + (d.dividendes || 0) + (d.revenusFonciers || 0) + (d.pensions || 0) + (d.autresRevenus || 0);
    const totalRevenusConjoint = d.salairesConjoint || 0;
    const totalRevenus = totalRevenusClient + totalRevenusConjoint;
    setHTML('total-revenus', fmt(totalRevenus));

    // Charges
    const totalCharges = (d.loyer || 0) + (d.creditRP || 0) + (d.creditLocatif || 0) + (d.creditConso || 0) + (d.pensionAlim || 0) + (d.autresCharges || 0);
    setHTML('total-charges', fmt(totalCharges));

    const capaciteEpargne = (totalRevenus / 12) - totalCharges;
    setHTML('capacite-epargne', fmt(capaciteEpargne));

    // Immobilier
    const totalImmo = (d.immoRP || 0) + (d.immoRS || 0) + (d.immoLoc1 || 0) + (d.immoLoc2 || 0) + (d.immoPro || 0) + (d.immoAutres || 0);
    setHTML('total-immo', fmt(totalImmo));

    // Financier
    const totalFin = (d.livrets || 0) + (d.pel || 0) + (d.assuranceVie || 0) + (d.pea || 0) + (d.cto || 0) + (d.per || 0) + (d.epargneSalariale || 0) + (d.autresPlacement || 0);
    setHTML('total-financier', fmt(totalFin));

    // Synthese
    const patriBrut = totalImmo + totalFin;
    const dettes = (d.capitalRestantRP || 0);
    const patriNet = patriBrut - dettes;
    const tauxEndettement = patriBrut > 0 ? dettes / patriBrut : 0;

    let classe = '—';
    if (patriNet >= 5000000) classe = 'Grande fortune';
    else if (patriNet >= 1000000) classe = 'Patrimoine > 1M';
    else if (patriNet >= 500000) classe = 'Patrimoine aise';
    else if (patriNet >= 100000) classe = 'Patrimoine moyen';
    else classe = 'En construction';

    setHTML('synth-brut', fmt(patriBrut));
    setHTML('synth-net', fmt(patriNet));
    setHTML('synth-endettement', pct(tauxEndettement));
    setHTML('synth-classe', classe);

    // Dashboard KPIs
    setHTML('kpi-patri-net', fmt(patriNet));
    setHTML('kpi-patri-brut', 'Brut : ' + fmt(patriBrut));
    setHTML('kpi-revenus', fmt(totalRevenus));
    setHTML('kpi-revenus-detail', 'Client : ' + fmt(totalRevenusClient) + ' + Conjoint : ' + fmt(totalRevenusConjoint));
    setHTML('kpi-epargne', fmt(capaciteEpargne) + '/mois');
    setHTML('kpi-epargne-pct', totalRevenus > 0 ? pct(capaciteEpargne * 12 / totalRevenus) + ' des revenus' : '');
    setHTML('kpi-endettement', pct(tauxEndettement));
    setHTML('kpi-dette-detail', 'Capital restant du : ' + fmt(dettes));

    // Dashboard summary
    setHTML('dash-client-name', 'Client ' + (d.nom || ''));
    setHTML('dash-classe', classe);
    setHTML('dash-risque', d.profilRisque || '—');
    setHTML('dash-objectif', d.objectifPrincipal || '—');
    setHTML('dash-horizon', d.horizon || '—');
    setHTML('dash-tmi', d.tmi ? pct(parseFloat(d.tmi)) : '—');
    setHTML('dash-apport', d.apportDispo ? fmt(d.apportDispo) : '—');

    // IFI calc
    calculateIFI(d, totalImmo, dettes);

    // Fiscalite succession
    calculateFiscalite(d, patriNet, totalFin);

    // Patrimoine page
    updatePatrimoinePage(d, totalImmo, totalFin, dettes, patriBrut, patriNet);
}

function setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

// ===== SAVE & CALCULATE =====
function saveAndCalculate() {
    const data = collectFormData();
    saveUserData(data);
    recalcAll();

    // Auto-run all simulations based on profile
    autoRunSimulations(data);

    // Generate recommendation
    generateRecommendation(data);

    // Show action buttons
    const dashActions = document.getElementById('dash-actions');
    if (dashActions) dashActions.classList.remove('hidden');
    const recoActions = document.getElementById('reco-actions');
    if (recoActions) recoActions.classList.remove('hidden');

    // Switch to dashboard
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById('accueil').classList.add('active');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector('[data-section="accueil"]').classList.add('active');
    window.scrollTo(0, 0);

    // Update contextual dashboard
    updateDashboardContext();

    // Reinit charts
    setTimeout(() => initCharts(), 200);

    // Animate
    setTimeout(() => {
        document.querySelectorAll('.section.active .kpi-card, .section.active .card').forEach(el => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        });
    }, 100);
}

// ===== AUTO-RUN ALL SIMULATIONS =====
function autoRunSimulations(d) {
    const apport = d.apportDispo || 0;
    const horizon = d.horizonAnnees || 8;
    const tmi = parseFloat(d.tmi) || 0.3;
    const ps = 0.172;
    const totalRevenus = (d.salairesClient || 0) + (d.salairesConjoint || 0) + (d.revenusBIC || 0) + (d.dividendes || 0) + (d.revenusFonciers || 0) + (d.pensions || 0) + (d.autresRevenus || 0);

    if (apport <= 0) return;

    // --- IMMOBILIER ---
    const immo_prix = apport * 3;
    const immo_notaire = 0.08;
    const immo_travaux = immo_prix * 0.05;
    const immo_garantie = 2000;
    const immo_coutTotal = immo_prix + immo_prix * immo_notaire + immo_travaux + immo_garantie;
    const immo_aFinancer = immo_coutTotal - apport;
    const immo_taux = 0.038;
    const immo_dureePret = 20;
    const immo_tauxMens = immo_taux / 12;
    const immo_nbMens = immo_dureePret * 12;
    const immo_mensualite = immo_aFinancer > 0 ? immo_aFinancer * immo_tauxMens / (1 - Math.pow(1 + immo_tauxMens, -immo_nbMens)) : 0;
    const immo_loyer = immo_prix * 0.005;
    const immo_loyerAn = immo_loyer * 12 * 0.95;
    const immo_chargesAn = immo_prix * 0.015;
    const immo_resultatFiscal = immo_loyerAn - immo_chargesAn;
    const immo_impotAn = immo_resultatFiscal > 0 ? immo_resultatFiscal * (tmi + ps) : 0;
    const immo_cashFlowMens = (immo_loyerAn - immo_chargesAn - immo_impotAn) / 12 - immo_mensualite;
    const immo_revalo = 0.02;
    const immo_valeurRevente = immo_prix * Math.pow(1 + immo_revalo, immo_dureePret);
    const immo_pvBrute = immo_valeurRevente - immo_prix;
    const immo_abattPV = immo_dureePret >= 22 ? 1 : (immo_dureePret >= 6 ? (immo_dureePret - 5) * 0.06 : 0);
    const immo_impotPV = immo_pvBrute * (1 - immo_abattPV) * 0.362;
    const immo_produitCession = immo_valeurRevente - immo_impotPV;
    const immo_tri = apport > 0 ? (Math.pow(immo_produitCession / apport, 1 / immo_dureePret) - 1) : 0;

    saveSimResult('immo', { capitalNet: immo_produitCession, tri: immo_tri, capitalInvesti: immo_coutTotal, cashFlowMens: immo_cashFlowMens, duree: immo_dureePret });

    // --- ASSURANCE VIE ---
    const profil = d.profilRisque || '';
    let av_pctFE = 0.6, av_pctMandat = 0.3, av_pctStruct = 0.1;
    if (profil.includes('Securitaire')) { av_pctFE = 0.85; av_pctMandat = 0.10; av_pctStruct = 0.05; }
    else if (profil.includes('Prudent')) { av_pctFE = 0.60; av_pctMandat = 0.30; av_pctStruct = 0.10; }
    else if (profil.includes('Equilibre')) { av_pctFE = 0.40; av_pctMandat = 0.40; av_pctStruct = 0.20; }
    else if (profil.includes('Dynamique')) { av_pctFE = 0.20; av_pctMandat = 0.50; av_pctStruct = 0.30; }
    else if (profil.includes('Offensif')) { av_pctFE = 0.10; av_pctMandat = 0.55; av_pctStruct = 0.35; }

    const av_rdtFE = 0.025, av_rdtMandat = 0.044, av_couponStruct = 0.07;
    const av_capFE = apport * av_pctFE;
    const av_capMandat = apport * av_pctMandat;
    const av_capStruct = apport * av_pctStruct;
    const av_finalFE = av_capFE * Math.pow(1 + av_rdtFE, horizon);
    const av_finalMandat = av_capMandat * Math.pow(1 + av_rdtMandat, horizon);
    const av_finalStruct = av_capStruct + av_capStruct * av_couponStruct * horizon;
    const av_totalFinal = av_finalFE + av_finalMandat + av_finalStruct;
    const av_gain = av_totalFinal - apport;
    const av_abattement = horizon >= 8 ? 4600 : 0;
    const av_gainImposable = Math.max(0, av_gain - av_abattement);
    const av_fisc = av_gainImposable * 0.30;
    const av_capitalNet = av_totalFinal - av_fisc;
    const av_tri = Math.pow(av_capitalNet / apport, 1 / horizon) - 1;

    saveSimResult('av', { capitalNet: av_capitalNet, tri: av_tri, capitalInvesti: apport, gain: av_gain, fiscalite: av_fisc, transmission: Math.min(apport, 152500 * (d.nbEnfants || 1)), pctFE: av_pctFE, pctMandat: av_pctMandat, pctStruct: av_pctStruct });

    // --- PEA LIBRE ---
    const pea_capital = Math.min(apport, 150000);
    const pea_rdtNet = 0.068;
    const pea_final = pea_capital * Math.pow(1 + pea_rdtNet, horizon);
    const pea_gains = pea_final - pea_capital;
    const pea_fisc = pea_gains * 0.172;
    const pea_net = pea_final - pea_fisc;
    const pea_tri = Math.pow(pea_net / pea_capital, 1 / horizon) - 1;

    saveSimResult('peaLibre', { capitalNet: pea_net, tri: pea_tri, capitalInvesti: pea_capital });

    // --- PEA MANDAT ---
    const peaM_rdtNet = 0.05;
    const peaM_final = pea_capital * Math.pow(1 + peaM_rdtNet, horizon);
    const peaM_gains = peaM_final - pea_capital;
    const peaM_fisc = peaM_gains * 0.172;
    const peaM_net = peaM_final - peaM_fisc;
    const peaM_tri = Math.pow(peaM_net / pea_capital, 1 / horizon) - 1;

    saveSimResult('peaMandat', { capitalNet: peaM_net, tri: peaM_tri, capitalInvesti: pea_capital });

    // --- CTO ---
    const cto_capital = apport;
    const cto_rdtNet = 0.0695;
    const cto_final = cto_capital * Math.pow(1 + cto_rdtNet, horizon);
    const cto_gains = cto_final - cto_capital;
    const cto_impot = cto_gains * 0.30;
    const cto_net = cto_final - cto_impot;
    const cto_tri = Math.pow(cto_net / cto_capital, 1 / horizon) - 1;

    saveSimResult('cto', { capitalNet: cto_net, tri: cto_tri, capitalInvesti: cto_capital });

    // Update comparatif
    updateComparatif();

    // Update individual simulation displays
    updateImmoDisplay(d, immo_prix, immo_coutTotal, apport, immo_aFinancer, immo_mensualite, immo_loyerAn, immo_chargesAn, immo_impotAn, immo_cashFlowMens, immo_valeurRevente, immo_pvBrute, immo_impotPV, immo_produitCession, immo_tri, immo_dureePret);
    updateAVDisplay(d, apport, horizon, av_pctFE, av_pctMandat, av_pctStruct, av_rdtFE, av_rdtMandat, av_couponStruct, av_capFE, av_capMandat, av_capStruct, av_finalFE, av_finalMandat, av_finalStruct, av_totalFinal, av_gain, av_fisc, av_capitalNet, av_tri);
    updatePEADisplay(pea_capital, horizon, pea_final, pea_gains, pea_fisc, pea_net, pea_tri, peaM_final, peaM_gains, peaM_fisc, peaM_net, peaM_tri);
    updateCTODisplay(cto_capital, horizon, cto_final, cto_gains, cto_impot, cto_net, cto_tri);
}

function updateImmoDisplay(d, prix, coutTotal, apport, aFinancer, mensualite, loyerAn, chargesAn, impotAn, cashFlowMens, valeurRevente, pvBrute, impotPV, produitCession, tri, duree) {
    document.getElementById('immo-results').classList.remove('hidden');
    setHTML('immo-kpis', `
        <div class="kpi-card kpi-primary"><div class="kpi-label">Capital Final Net</div><div class="kpi-value">${fmt(produitCession)}</div></div>
        <div class="kpi-card ${cashFlowMens >= 0 ? 'kpi-green' : 'kpi-red'}"><div class="kpi-label">Cash-flow Mensuel</div><div class="kpi-value">${fmt(cashFlowMens)}</div></div>
        <div class="kpi-card kpi-blue"><div class="kpi-label">TRI</div><div class="kpi-value">${pct(tri)}</div></div>
        <div class="kpi-card kpi-orange"><div class="kpi-label">Cout Acquisition</div><div class="kpi-value">${fmt(coutTotal)}</div></div>
    `);
    setHTML('immo-details', `
        <div class="card"><h3>Financement</h3><div class="data-grid">
            <div class="data-row"><span class="data-label">Prix acquisition</span><span class="data-value">${fmt(prix)}</span></div>
            <div class="data-row"><span class="data-label">Montant a financer</span><span class="data-value">${fmt(aFinancer)}</span></div>
            <div class="data-row"><span class="data-label">Mensualite</span><span class="data-value">${fmt(mensualite)}</span></div>
            <div class="data-row"><span class="data-label">Loyer annuel net</span><span class="data-value">${fmt(loyerAn)}</span></div>
            <div class="data-row"><span class="data-label">Charges annuelles</span><span class="data-value">${fmt(chargesAn)}</span></div>
        </div></div>
        <div class="card"><h3>Cession (${duree} ans)</h3><div class="data-grid">
            <div class="data-row"><span class="data-label">Valeur revente</span><span class="data-value">${fmt(valeurRevente)}</span></div>
            <div class="data-row"><span class="data-label">Plus-value brute</span><span class="data-value">${fmt(pvBrute)}</span></div>
            <div class="data-row highlight"><span class="data-label">Produit net cession</span><span class="data-value">${fmt(produitCession)}</span></div>
        </div></div>
    `);
}

function updateAVDisplay(d, apport, horizon, pctFE, pctMandat, pctStruct, rdtFE, rdtMandat, couponStruct, capFE, capMandat, capStruct, finalFE, finalMandat, finalStruct, totalFinal, gain, fisc, capitalNet, tri) {
    document.getElementById('av-results').classList.remove('hidden');
    setHTML('av-results', `
        <div class="kpi-grid">
            <div class="kpi-card kpi-green"><div class="kpi-label">Capital Net Total</div><div class="kpi-value">${fmt(capitalNet)}</div></div>
            <div class="kpi-card kpi-primary"><div class="kpi-label">Gain Global</div><div class="kpi-value">${fmt(gain)}</div></div>
            <div class="kpi-card kpi-blue"><div class="kpi-label">Rendement Net</div><div class="kpi-value">${pct(tri)}</div></div>
            <div class="kpi-card kpi-orange"><div class="kpi-label">Avantage Transmission</div><div class="kpi-value">${fmt(Math.min(apport, 152500 * (d.nbEnfants || 1)))}</div></div>
        </div>
        <div class="card"><h3>Allocation adaptee a votre profil : ${d.profilRisque || 'Equilibre'}</h3>
        <table class="data-table"><thead><tr><th>Poche</th><th>%</th><th>Capital</th><th>Rdt</th><th>Final</th></tr></thead><tbody>
            <tr><td>Fonds Euros</td><td class="num">${(pctFE*100).toFixed(0)}%</td><td class="num">${fmt(capFE)}</td><td class="num">${(rdtFE*100).toFixed(1)}%</td><td class="num">${fmt(finalFE)}</td></tr>
            <tr><td>Mandat Gestion</td><td class="num">${(pctMandat*100).toFixed(0)}%</td><td class="num">${fmt(capMandat)}</td><td class="num">${(rdtMandat*100).toFixed(1)}%</td><td class="num">${fmt(finalMandat)}</td></tr>
            <tr><td>Produit Structure</td><td class="num">${(pctStruct*100).toFixed(0)}%</td><td class="num">${fmt(capStruct)}</td><td class="num">${(couponStruct*100).toFixed(1)}%</td><td class="num">${fmt(finalStruct)}</td></tr>
            <tr class="total-row"><td><strong>TOTAL</strong></td><td class="num strong">100%</td><td class="num strong">${fmt(apport)}</td><td></td><td class="num strong">${fmt(totalFinal)}</td></tr>
        </tbody></table></div>
        <div class="card"><h3>Synthese Fiscale</h3><div class="data-grid">
            <div class="data-row"><span class="data-label">Gains totaux</span><span class="data-value">${fmt(gain)}</span></div>
            <div class="data-row"><span class="data-label">Fiscalite</span><span class="data-value">${fmt(fisc)}</span></div>
            <div class="data-row highlight"><span class="data-label">CAPITAL NET</span><span class="data-value">${fmt(capitalNet)}</span></div>
        </div></div>
    `);
}

function updatePEADisplay(capital, horizon, finalETF, gainsETF, fiscETF, netETF, triETF, finalMandat, gainsMandat, fiscMandat, netMandat, triMandat) {
    document.getElementById('pea-results').classList.remove('hidden');
    setHTML('pea-results', `
        <div class="kpi-grid">
            <div class="kpi-card kpi-green"><div class="kpi-label">Capital Net ETF</div><div class="kpi-value">${fmt(netETF)}</div></div>
            <div class="kpi-card kpi-blue"><div class="kpi-label">Capital Net Mandat</div><div class="kpi-value">${fmt(netMandat)}</div></div>
            <div class="kpi-card kpi-primary"><div class="kpi-label">TRI ETF</div><div class="kpi-value">${pct(triETF)}</div></div>
            <div class="kpi-card kpi-orange"><div class="kpi-label">Ecart ETF - Mandat</div><div class="kpi-value">${fmt(netETF - netMandat)}</div></div>
        </div>
        <div class="dashboard-grid">
            <div class="card card-highlight-green"><div class="card-badge">Recommande</div><h3>Gestion Libre (ETF)</h3><div class="data-grid">
                <div class="data-row"><span class="data-label">Capital final brut</span><span class="data-value">${fmt(finalETF)}</span></div>
                <div class="data-row"><span class="data-label">Gains</span><span class="data-value">${fmt(gainsETF)}</span></div>
                <div class="data-row"><span class="data-label">Fiscalite (PS 17,2%)</span><span class="data-value">${fmt(fiscETF)}</span></div>
                <div class="data-row highlight"><span class="data-label">CAPITAL NET</span><span class="data-value">${fmt(netETF)}</span></div>
            </div></div>
            <div class="card"><h3>Mandat Titres Vifs</h3><div class="data-grid">
                <div class="data-row"><span class="data-label">Capital final brut</span><span class="data-value">${fmt(finalMandat)}</span></div>
                <div class="data-row"><span class="data-label">Gains</span><span class="data-value">${fmt(gainsMandat)}</span></div>
                <div class="data-row"><span class="data-label">Fiscalite (PS 17,2%)</span><span class="data-value">${fmt(fiscMandat)}</span></div>
                <div class="data-row highlight"><span class="data-label">CAPITAL NET</span><span class="data-value">${fmt(netMandat)}</span></div>
            </div></div>
        </div>
    `);
}

function updateCTODisplay(capital, horizon, finalBrut, gains, impot, capitalNet, tri) {
    document.getElementById('cto-results').classList.remove('hidden');
    setHTML('cto-results', `
        <div class="kpi-grid">
            <div class="kpi-card kpi-primary"><div class="kpi-label">Capital Investi</div><div class="kpi-value">${fmt(capital)}</div></div>
            <div class="kpi-card kpi-green"><div class="kpi-label">Capital Net</div><div class="kpi-value">${fmt(capitalNet)}</div></div>
            <div class="kpi-card kpi-blue"><div class="kpi-label">TRI</div><div class="kpi-value">${pct(tri)}</div></div>
            <div class="kpi-card kpi-red"><div class="kpi-label">Fiscalite PFU 30%</div><div class="kpi-value">${fmt(impot)}</div></div>
        </div>
        <div class="card"><h3>Detail</h3><div class="data-grid">
            <div class="data-row"><span class="data-label">Capital final brut</span><span class="data-value">${fmt(finalBrut)}</span></div>
            <div class="data-row"><span class="data-label">Gains totaux</span><span class="data-value">${fmt(gains)}</span></div>
            <div class="data-row"><span class="data-label">PFU 30%</span><span class="data-value">${fmt(impot)}</span></div>
            <div class="data-row highlight"><span class="data-label">CAPITAL NET CTO</span><span class="data-value">${fmt(capitalNet)}</span></div>
        </div></div>
    `);
}

// ===== RECOMMENDATION ENGINE =====
function generateRecommendation(d) {
    const r = getSimResults();
    if (Object.keys(r).length === 0) return;

    const objectif = d.objectifPrincipal || '';
    const profil = d.profilRisque || '';
    const horizon = d.horizon || '';
    const horizonAn = d.horizonAnnees || 8;
    const tmi = parseFloat(d.tmi) || 0.3;
    const besoinRevenus = d.besoinRevenus || 'Non';
    const preoccSucc = d.preoccSucc || 'Non';
    const totalRevenus = (d.salairesClient || 0) + (d.salairesConjoint || 0);
    const capacite = (totalRevenus / 12) - ((d.loyer || 0) + (d.creditRP || 0) + (d.creditLocatif || 0) + (d.creditConso || 0));

    // Scoring matrix: each vehicle gets scored 1-10 on each criterion
    const vehicles = [
        { key: 'immo', name: 'Immobilier Locatif', short: 'IMMO' },
        { key: 'av', name: 'Assurance Vie Multi-Support', short: 'AV' },
        { key: 'peaLibre', name: 'PEA Gestion Libre (ETF)', short: 'PEA' },
        { key: 'peaMandat', name: 'PEA Mandat Titres Vifs', short: 'PEA M.' },
        { key: 'cto', name: 'Compte-Titres Ordinaire', short: 'CTO' }
    ].filter(v => r[v.key]);

    const criteria = [
        { name: 'Objectif capital', weight: 2, field: objectif },
        { name: 'Profil risque', weight: 2, field: profil },
        { name: 'Horizon', weight: 1.5, field: horizon },
        { name: 'TMI & fiscalite', weight: 1.5, field: pct(tmi) },
        { name: 'Revenus immediats', weight: 1, field: besoinRevenus },
        { name: 'Transmission', weight: 2, field: preoccSucc },
        { name: 'Capacite epargne', weight: 1, field: fmt(capacite) }
    ];

    // Score each vehicle
    function scoreVehicle(key) {
        const scores = {};

        // Objectif capital
        if (objectif.includes('Transmission')) scores.objectif = { immo: 4, av: 9, peaLibre: 6, peaMandat: 5, cto: 5 }[key] || 5;
        else if (objectif.includes('Valorisation')) scores.objectif = { immo: 6, av: 6, peaLibre: 9, peaMandat: 7, cto: 8 }[key] || 5;
        else if (objectif.includes('Revenus')) scores.objectif = { immo: 9, av: 7, peaLibre: 4, peaMandat: 4, cto: 5 }[key] || 5;
        else if (objectif.includes('fiscal')) scores.objectif = { immo: 7, av: 8, peaLibre: 9, peaMandat: 9, cto: 3 }[key] || 5;
        else if (objectif.includes('retraite')) scores.objectif = { immo: 6, av: 8, peaLibre: 8, peaMandat: 7, cto: 6 }[key] || 5;
        else scores.objectif = { immo: 5, av: 7, peaLibre: 7, peaMandat: 6, cto: 6 }[key] || 5;

        // Profil risque
        if (profil.includes('Securitaire')) scores.risque = { immo: 4, av: 9, peaLibre: 3, peaMandat: 3, cto: 3 }[key] || 5;
        else if (profil.includes('Prudent')) scores.risque = { immo: 4, av: 8, peaLibre: 3, peaMandat: 4, cto: 3 }[key] || 5;
        else if (profil.includes('Equilibre')) scores.risque = { immo: 6, av: 7, peaLibre: 7, peaMandat: 6, cto: 6 }[key] || 5;
        else if (profil.includes('Dynamique')) scores.risque = { immo: 7, av: 5, peaLibre: 9, peaMandat: 7, cto: 8 }[key] || 5;
        else if (profil.includes('Offensif')) scores.risque = { immo: 6, av: 4, peaLibre: 10, peaMandat: 7, cto: 9 }[key] || 5;
        else scores.risque = { immo: 5, av: 6, peaLibre: 6, peaMandat: 5, cto: 5 }[key] || 5;

        // Horizon
        if (horizonAn <= 3) scores.horizon = { immo: 2, av: 4, peaLibre: 3, peaMandat: 3, cto: 6 }[key] || 4;
        else if (horizonAn <= 5) scores.horizon = { immo: 3, av: 6, peaLibre: 5, peaMandat: 5, cto: 6 }[key] || 5;
        else if (horizonAn <= 8) scores.horizon = { immo: 5, av: 8, peaLibre: 8, peaMandat: 7, cto: 7 }[key] || 6;
        else scores.horizon = { immo: 8, av: 9, peaLibre: 9, peaMandat: 8, cto: 8 }[key] || 7;

        // Fiscalite (TMI)
        if (tmi >= 0.41) scores.fiscalite = { immo: 5, av: 8, peaLibre: 10, peaMandat: 10, cto: 3 }[key] || 5;
        else if (tmi >= 0.30) scores.fiscalite = { immo: 6, av: 8, peaLibre: 10, peaMandat: 10, cto: 5 }[key] || 5;
        else scores.fiscalite = { immo: 7, av: 7, peaLibre: 8, peaMandat: 8, cto: 6 }[key] || 5;

        // Revenus immediats
        if (besoinRevenus.includes('immediatement')) scores.revenus = { immo: 9, av: 7, peaLibre: 3, peaMandat: 3, cto: 4 }[key] || 5;
        else if (besoinRevenus.includes('terme')) scores.revenus = { immo: 7, av: 6, peaLibre: 5, peaMandat: 5, cto: 5 }[key] || 5;
        else scores.revenus = { immo: 5, av: 5, peaLibre: 6, peaMandat: 6, cto: 6 }[key] || 5;

        // Transmission
        if (preoccSucc.includes('priorite')) scores.transmission = { immo: 5, av: 10, peaLibre: 5, peaMandat: 5, cto: 4 }[key] || 5;
        else if (preoccSucc.includes('secondaire')) scores.transmission = { immo: 5, av: 8, peaLibre: 5, peaMandat: 5, cto: 4 }[key] || 5;
        else scores.transmission = { immo: 5, av: 5, peaLibre: 5, peaMandat: 5, cto: 5 }[key] || 5;

        // Capacite epargne
        if (capacite >= 5000) scores.capacite = { immo: 9, av: 7, peaLibre: 9, peaMandat: 8, cto: 7 }[key] || 7;
        else if (capacite >= 2000) scores.capacite = { immo: 6, av: 7, peaLibre: 7, peaMandat: 6, cto: 6 }[key] || 6;
        else scores.capacite = { immo: 3, av: 6, peaLibre: 5, peaMandat: 5, cto: 5 }[key] || 5;

        const allScores = [scores.objectif, scores.risque, scores.horizon, scores.fiscalite, scores.revenus, scores.transmission, scores.capacite];
        const weights = criteria.map(c => c.weight);
        const weighted = allScores.reduce((sum, s, i) => sum + s * weights[i], 0);
        const totalWeight = weights.reduce((a, b) => a + b, 0);

        return { scores: allScores, total: weighted / totalWeight };
    }

    const results = vehicles.map(v => ({ ...v, ...scoreVehicle(v.key), data: r[v.key] }));
    results.sort((a, b) => b.total - a.total);
    const best = results[0];
    const second = results[1];

    // Dashboard banner
    setHTML('dash-reco-text', `<strong>${best.name}</strong> — Score d'adequation : ${best.total.toFixed(1)}/10`);
    const dashBtn = document.querySelector('.recommendation-banner .btn');
    if (dashBtn) { dashBtn.textContent = 'Voir le detail'; dashBtn.dataset.section = 'recommandation'; }

    // Recommendation page
    const recoEl = document.getElementById('reco-content');
    if (!recoEl) return;

    // Explanation texts per vehicle
    const explanations = {
        av: {
            adequation: `L'assurance vie multi-support cumule capitalisation, revenus differes et transmission optimisee. L'allocation a ete adaptee a votre profil ${profil} avec ${(r.av.pctFE * 100).toFixed(0)}% fonds euros, ${(r.av.pctMandat * 100).toFixed(0)}% mandat et ${(r.av.pctStruct * 100).toFixed(0)}% structures.`,
            fiscal: `Fiscalite allegee sur rachats apres 8 ans (abattement 4 600 &euro;/an). Taux sur gains : 7,5% IR + 17,2% PS (vs 30% PFU CTO). Avantage transmission : 152 500 &euro;/beneficiaire hors droits de succession.`,
            avantages: ['4 poches complementaires adaptables', 'Transmission hors succession (152 500 &euro;/benef.)', 'Disponibilite des fonds', 'Fiscalite allegee apres 8 ans'],
            vigilance: ['Rendement fonds euros en baisse', 'Pas de garantie de performance des UC', 'Produits structures : risque de perte si barriere franchie']
        },
        peaLibre: {
            adequation: `Le PEA en gestion libre (ETF) offre le meilleur rendement net grace a des frais tres faibles et une fiscalite avantageuse (PS 17,2% seulement apres 5 ans). Ideal pour la valorisation long terme.`,
            fiscal: `Exoneration d'IR apres 5 ans de detention. Seuls les prelevements sociaux (17,2%) restent dus. Economie significative vs CTO (PFU 30%).`,
            avantages: ['Meilleur rendement net historique', 'Fiscalite optimale apres 5 ans', 'Frais tres reduits (ETF)', 'Acces aux marches mondiaux'],
            vigilance: ['Plafond de versement 150 000 &euro;', 'Risque de marche actions', 'Pas de transmission avantageuse', 'Retrait avant 5 ans = cloture']
        },
        peaMandat: {
            adequation: `Le PEA en mandat de gestion offre une gestion deleguee sur actions France/Europe avec la meme fiscalite avantageuse que le PEA libre.`,
            fiscal: `Meme regime fiscal que le PEA libre : exoneration IR apres 5 ans, PS 17,2% seulement.`,
            avantages: ['Gestion deleguee par un professionnel', 'Fiscalite PEA avantageuse', 'Univers actions diversifie'],
            vigilance: ['Frais de gestion plus eleves', 'Rendement net inferieur au PEA libre', 'Plafond 150 000 &euro;']
        },
        cto: {
            adequation: `Le CTO offre la plus grande flexibilite sans plafond de versement et l'acces a tous les marches mondiaux. Adapte pour les montants superieurs au plafond PEA.`,
            fiscal: `PFU 30% (IR 12,8% + PS 17,2%) sur dividendes ET plus-values. Taux fixe quel que soit le montant.`,
            avantages: ['Aucun plafond de versement', 'Acces a tous les marches mondiaux', 'Flexibilite totale', 'Pas de duree minimale'],
            vigilance: ['Fiscalite la plus lourde (PFU 30%)', 'Pas de transmission avantageuse', 'Pas d\'exoneration possible']
        },
        immo: {
            adequation: `L'immobilier locatif offre un effet de levier via le credit et des revenus reguliers. L'investissement a ete calibre a ${fmt(r.immo?.capitalInvesti || 0)} avec un apport de ${fmt(d.apportDispo || 0)}.`,
            fiscal: `Revenus fonciers imposes a TMI (${pct(tmi)}) + PS (17,2%). Plus-value imposee a 36,2% avec abattement progressif. Deduction des charges et interets d'emprunt.`,
            avantages: ['Effet de levier du credit', 'Revenus locatifs reguliers', 'Actif tangible', 'Valorisation long terme'],
            vigilance: ['Risque de vacance locative', 'Charges et entretien', 'Liquidite faible', 'IFI si patrimoine > 1,3M']
        }
    };

    const bestExpl = explanations[best.key] || explanations.av;
    const secondExpl = second ? (explanations[second.key] || explanations.av) : null;

    recoEl.innerHTML = `
        <div class="card client-banner">
            <p><strong>Client : ${d.nom || ''} ${d.prenom || ''}</strong> | Profil : ${profil || '—'} | Objectif : ${objectif || '—'} | Horizon : ${horizon || '—'}</p>
        </div>

        <div class="card">
            <h3>Matrice d'Adequation — Score /10</h3>
            <table class="data-table score-table">
                <thead><tr><th>Critere</th><th>Profil client</th>${vehicles.map(v => `<th>${v.short}</th>`).join('')}</tr></thead>
                <tbody>
                    ${criteria.map((c, ci) => `<tr><td>${c.name}</td><td>${c.field}</td>${results.map(v => {
                        const s = v.scores[ci];
                        const cls = s >= 9 ? 'score-high' : (s >= 7 ? '' : '');
                        return `<td class="num ${cls}">${s}</td>`;
                    }).join('')}</tr>`).join('')}
                    <tr class="total-row"><td><strong>SCORE FINAL /10</strong></td><td></td>${results.map((v, i) => `<td class="num ${i === 0 ? 'score-best' : ''}"><strong>${v.total.toFixed(1)}</strong></td>`).join('')}</tr>
                    <tr class="total-row"><td><strong>CLASSEMENT</strong></td><td></td>${results.map((v, i) => `<td class="num ${i === 0 ? 'score-best' : ''}">${i + 1}${i === 0 ? 'er' : 'e'}</td>`).join('')}</tr>
                </tbody>
            </table>
        </div>

        <div class="card recommendation-card">
            <div class="rec-badge">Solution Recommandee</div>
            <h2>${best.name}</h2>
            <p class="rec-score">Score d'adequation : ${best.total.toFixed(1)} / 10 — Capital net estime : ${fmt(best.data.capitalNet)} — TRI : ${pct(best.data.tri)}</p>
            <div class="rec-sections">
                <div class="rec-section"><h4>Adequation Objectif</h4><p>${bestExpl.adequation}</p></div>
                <div class="rec-section"><h4>Analyse Fiscale</h4><p>${bestExpl.fiscal}</p></div>
                <div class="rec-section"><h4>Avantages Cles</h4><ul>${bestExpl.avantages.map(a => `<li>${a}</li>`).join('')}</ul></div>
                <div class="rec-section"><h4>Points de Vigilance</h4><ul class="warning-list">${bestExpl.vigilance.map(v => `<li>${v}</li>`).join('')}</ul></div>
            </div>
        </div>

        ${second ? `
        <div class="card">
            <h3>2e Option — ${second.name}</h3>
            <p>Score : ${second.total.toFixed(1)}/10 — Ecart avec solution n&deg;1 : ${(best.total - second.total).toFixed(1)} points — Capital net : ${fmt(second.data.capitalNet)}</p>
            <p class="rec-detail" style="margin-top:8px;">${secondExpl ? secondExpl.adequation : ''}</p>
        </div>` : ''}

        <div class="card">
            <h3>Strategie Complementaire Recommandee</h3>
            <p>Pour optimiser votre patrimoine, combinez plusieurs vehicules. Ratio suggere :</p>
            <div class="computed-row-big" style="margin-top:16px;">
                ${results.slice(0, 3).map(v => `<div><div class="computed-label">${v.short}</div><div class="computed-value big">${Math.round(v.total / results.slice(0,3).reduce((s,x)=>s+x.total,0) * 100)}%</div></div>`).join('')}
                <div><div class="computed-label">Liquidites</div><div class="computed-value big">10%</div></div>
            </div>
        </div>

        <div class="card disclaimer-card">
            <p>Cette recommandation est generee automatiquement sur la base des informations collectees. Elle ne constitue pas un conseil en investissement au sens reglementaire. Le conseiller doit valider cette analyse avant toute souscription.</p>
        </div>
    `;
}

// ===== PATRIMOINE PAGE =====
function updatePatrimoinePage(d, totalImmo, totalFin, dettes, brut, net) {
    setHTML('pat-brut', fmt(brut));
    setHTML('pat-dettes', fmt(dettes));
    setHTML('pat-net', fmt(net));
    setHTML('pat-immo-pct', brut > 0 ? pct(totalImmo / brut) : '0%');

    const immoItems = [
        ['Residence principale', d.immoRP],
        ['Residence secondaire', d.immoRS],
        ['Investissement locatif 1', d.immoLoc1],
        ['Investissement locatif 2', d.immoLoc2],
        ['Immobilier professionnel', d.immoPro],
        ['Autres immobiliers', d.immoAutres]
    ].filter(x => x[1] > 0);

    let html = '<table class="data-table"><thead><tr><th>Bien</th><th>Valeur</th></tr></thead><tbody>';
    immoItems.forEach(([n, v]) => { html += `<tr><td>${n}</td><td class="num">${fmt(v)}</td></tr>`; });
    html += `<tr class="total-row"><td><strong>TOTAL</strong></td><td class="num strong">${fmt(totalImmo)}</td></tr></tbody></table>`;
    setHTML('pat-immo-table', html);

    const finItems = [
        ['Livrets', d.livrets], ['PEL/CEL', d.pel], ['Assurance Vie', d.assuranceVie],
        ['PEA', d.pea], ['CTO', d.cto], ['PER', d.per],
        ['Epargne salariale', d.epargneSalariale], ['Autres', d.autresPlacement]
    ].filter(x => x[1] > 0);

    html = '<table class="data-table"><thead><tr><th>Support</th><th>Encours</th></tr></thead><tbody>';
    finItems.forEach(([n, v]) => { html += `<tr><td>${n}</td><td class="num">${fmt(v)}</td></tr>`; });
    html += `<tr class="total-row"><td><strong>TOTAL</strong></td><td class="num strong">${fmt(totalFin)}</td></tr></tbody></table>`;
    setHTML('pat-fin-table', html);
}

// ===== IMMOBILIER SIMULATION =====
function calculateImmo() {
    const prix = getField('immo_prix');
    const notairePct = getField('immo_notaire') / 100;
    const travaux = getField('immo_travaux');
    const garantie = getField('immo_garantie');
    const apport = getField('immo_apport');
    const taux = getField('immo_taux') / 100;
    const duree = getField('immo_duree');
    const loyer = getField('immo_loyer');
    const vacance = getField('immo_vacance') / 100;
    const charges = getField('immo_charges');
    const taxe = getField('immo_taxe');
    const revalo = getField('immo_revalo') / 100;

    const d = collectFormData();
    const tmi = parseFloat(d.tmi) || 0.3;
    const ps = 0.172;

    const notaire = prix * notairePct;
    const coutTotal = prix + notaire + travaux + garantie;
    const aFinancer = coutTotal - apport;

    // Mensualite credit
    const tauxMens = taux / 12;
    const nbMens = duree * 12;
    const mensualite = aFinancer > 0 ? aFinancer * tauxMens / (1 - Math.pow(1 + tauxMens, -nbMens)) : 0;
    const coutCredit = mensualite * nbMens - aFinancer;

    // Revenus locatifs
    const loyerAnnuel = loyer * 12 * (1 - vacance);
    const fraisGestion = loyerAnnuel * 0.07;
    const totalChargesAn = charges + taxe + 250 + fraisGestion;
    const resultatFiscal = loyerAnnuel - totalChargesAn;
    const impotLocatif = resultatFiscal > 0 ? resultatFiscal * (tmi + ps) : 0;
    const cashFlowMens = (loyerAnnuel - totalChargesAn - impotLocatif) / 12 - mensualite;

    // Cession
    const valeurRevente = prix * Math.pow(1 + revalo, duree);
    const pvBrute = valeurRevente - prix;
    const abattementPV = duree >= 22 ? 1 : (duree >= 6 ? (duree - 5) * 0.06 : 0);
    const impotPV = pvBrute * (1 - abattementPV) * 0.362;
    const produitCession = valeurRevente - impotPV;
    const cashFlowsCumules = cashFlowMens * nbMens;
    const tri = aFinancer > 0 ? (Math.pow(produitCession / apport, 1 / duree) - 1) : 0;

    document.getElementById('immo-results').classList.remove('hidden');

    setHTML('immo-kpis', `
        <div class="kpi-card kpi-primary"><div class="kpi-label">Capital Final Net</div><div class="kpi-value">${fmt(produitCession)}</div></div>
        <div class="kpi-card ${cashFlowMens >= 0 ? 'kpi-green' : 'kpi-red'}"><div class="kpi-label">Cash-flow Mensuel</div><div class="kpi-value">${fmt(cashFlowMens)}</div></div>
        <div class="kpi-card kpi-blue"><div class="kpi-label">TRI Approximatif</div><div class="kpi-value">${pct(tri)}</div></div>
        <div class="kpi-card kpi-orange"><div class="kpi-label">Cout Total Acquisition</div><div class="kpi-value">${fmt(coutTotal)}</div></div>
    `);

    setHTML('immo-details', `
        <div class="card"><h3>Financement</h3><div class="data-grid">
            <div class="data-row"><span class="data-label">Montant a financer</span><span class="data-value">${fmt(aFinancer)}</span></div>
            <div class="data-row"><span class="data-label">Mensualite</span><span class="data-value">${fmt(mensualite)}</span></div>
            <div class="data-row"><span class="data-label">Cout total credit</span><span class="data-value">${fmt(coutCredit)}</span></div>
            <div class="data-row"><span class="data-label">Loyer annuel net vacance</span><span class="data-value">${fmt(loyerAnnuel)}</span></div>
            <div class="data-row"><span class="data-label">Total charges/an</span><span class="data-value">${fmt(totalChargesAn)}</span></div>
            <div class="data-row"><span class="data-label">Impots locatifs/an</span><span class="data-value">${fmt(impotLocatif)}</span></div>
        </div></div>
        <div class="card"><h3>Cession (${duree} ans)</h3><div class="data-grid">
            <div class="data-row"><span class="data-label">Valeur revente</span><span class="data-value">${fmt(valeurRevente)}</span></div>
            <div class="data-row"><span class="data-label">Plus-value brute</span><span class="data-value">${fmt(pvBrute)}</span></div>
            <div class="data-row"><span class="data-label">Impot PV (36,2%)</span><span class="data-value">${fmt(impotPV)}</span></div>
            <div class="data-row highlight"><span class="data-label">Produit net cession</span><span class="data-value">${fmt(produitCession)}</span></div>
            <div class="data-row"><span class="data-label">Cash-flows cumules</span><span class="data-value">${fmt(cashFlowsCumules)}</span></div>
        </div></div>
    `);

    saveSimResult('immo', { capitalNet: produitCession, tri, capitalInvesti: coutTotal });
    updateComparatif();
}

// ===== ASSURANCE VIE =====
function calculateAV() {
    const apport = getField('av_apport');
    const mensuel = getField('av_mensuel');
    const horizon = getField('av_horizon');
    const pctFE = getField('av_pct_fe') / 100;
    const rdtFE = getField('av_rdt_fe') / 100;
    const pctMandat = getField('av_pct_mandat') / 100;
    const rdtMandat = getField('av_rdt_mandat') / 100;
    const pctStruct = getField('av_pct_struct') / 100;
    const couponStruct = getField('av_rdt_struct') / 100;

    const capFE = apport * pctFE;
    const capMandat = apport * pctMandat;
    const capStruct = apport * pctStruct;

    const finalFE = capFE * Math.pow(1 + rdtFE, horizon);
    const finalMandat = capMandat * Math.pow(1 + rdtMandat, horizon);
    const gainStruct = capStruct * couponStruct * horizon;
    const finalStruct = capStruct + gainStruct;

    const totalFinal = finalFE + finalMandat + finalStruct;
    const totalGain = totalFinal - apport;
    const abattement = 4600;
    const gainImposable = Math.max(0, totalGain - abattement);
    const fiscalite = gainImposable * 0.30;
    const capitalNet = totalFinal - fiscalite;
    const rdtNet = Math.pow(capitalNet / apport, 1 / horizon) - 1;

    document.getElementById('av-results').classList.remove('hidden');
    setHTML('av-results', `
        <div class="kpi-grid">
            <div class="kpi-card kpi-green"><div class="kpi-label">Capital Net Total</div><div class="kpi-value">${fmt(capitalNet)}</div></div>
            <div class="kpi-card kpi-primary"><div class="kpi-label">Gain Global</div><div class="kpi-value">${fmt(totalGain)}</div></div>
            <div class="kpi-card kpi-blue"><div class="kpi-label">Rendement Net</div><div class="kpi-value">${pct(rdtNet)}</div></div>
            <div class="kpi-card kpi-orange"><div class="kpi-label">Avantage Transmission</div><div class="kpi-value">${fmt(Math.min(apport, 152500 * 2))}</div></div>
        </div>
        <div class="card">
            <h3>Detail par poche</h3>
            <table class="data-table"><thead><tr><th>Poche</th><th>Allocation</th><th>Capital</th><th>Rendement</th><th>Final</th></tr></thead>
            <tbody>
                <tr><td>Fonds Euros</td><td>${(pctFE*100).toFixed(0)}%</td><td class="num">${fmt(capFE)}</td><td class="num">${(rdtFE*100).toFixed(1)}%</td><td class="num">${fmt(finalFE)}</td></tr>
                <tr><td>Mandat Gestion</td><td>${(pctMandat*100).toFixed(0)}%</td><td class="num">${fmt(capMandat)}</td><td class="num">${(rdtMandat*100).toFixed(1)}%</td><td class="num">${fmt(finalMandat)}</td></tr>
                <tr><td>Produit Structure</td><td>${(pctStruct*100).toFixed(0)}%</td><td class="num">${fmt(capStruct)}</td><td class="num">${(couponStruct*100).toFixed(1)}%</td><td class="num">${fmt(finalStruct)}</td></tr>
                <tr class="total-row"><td><strong>TOTAL</strong></td><td><strong>100%</strong></td><td class="num strong">${fmt(apport)}</td><td></td><td class="num strong">${fmt(totalFinal)}</td></tr>
            </tbody></table>
        </div>
        <div class="card"><h3>Synthese Fiscale</h3><div class="data-grid">
            <div class="data-row"><span class="data-label">Gains totaux</span><span class="data-value">${fmt(totalGain)}</span></div>
            <div class="data-row"><span class="data-label">Abattement AV (8 ans)</span><span class="data-value">${fmt(abattement)}</span></div>
            <div class="data-row"><span class="data-label">Fiscalite (PFU 30%)</span><span class="data-value">${fmt(fiscalite)}</span></div>
            <div class="data-row highlight"><span class="data-label">CAPITAL NET</span><span class="data-value">${fmt(capitalNet)}</span></div>
        </div></div>
    `);

    saveSimResult('av', { capitalNet, tri: rdtNet, capitalInvesti: apport });
    updateComparatif();
}

// ===== PEA =====
function calculatePEA() {
    const capital = getField('pea_capital');
    const horizon = getField('pea_horizon');
    const rdtETF = (getField('pea_rdt_etf') - getField('pea_ter')) / 100;
    const rdtMandat = (getField('pea_rdt_mandat') - getField('pea_frais_mandat')) / 100;

    const finalETF = capital * Math.pow(1 + rdtETF, horizon);
    const gainsETF = finalETF - capital;
    const fiscETF = gainsETF * 0.172;
    const netETF = finalETF - fiscETF;
    const triETF = Math.pow(netETF / capital, 1 / horizon) - 1;

    const finalMandat = capital * Math.pow(1 + rdtMandat, horizon);
    const gainsMandat = finalMandat - capital;
    const fiscMandat = gainsMandat * 0.172;
    const netMandat = finalMandat - fiscMandat;
    const triMandat = Math.pow(netMandat / capital, 1 / horizon) - 1;

    document.getElementById('pea-results').classList.remove('hidden');
    setHTML('pea-results', `
        <div class="kpi-grid">
            <div class="kpi-card kpi-green"><div class="kpi-label">Capital Net ETF</div><div class="kpi-value">${fmt(netETF)}</div></div>
            <div class="kpi-card kpi-blue"><div class="kpi-label">Capital Net Mandat</div><div class="kpi-value">${fmt(netMandat)}</div></div>
            <div class="kpi-card kpi-primary"><div class="kpi-label">TRI ETF</div><div class="kpi-value">${pct(triETF)}</div></div>
            <div class="kpi-card kpi-orange"><div class="kpi-label">Ecart ETF - Mandat</div><div class="kpi-value">${fmt(netETF - netMandat)}</div></div>
        </div>
        <div class="dashboard-grid">
            <div class="card card-highlight-green"><div class="card-badge">Recommande</div><h3>Gestion Libre (ETF)</h3><div class="data-grid">
                <div class="data-row"><span class="data-label">Capital final brut</span><span class="data-value">${fmt(finalETF)}</span></div>
                <div class="data-row"><span class="data-label">Gains</span><span class="data-value">${fmt(gainsETF)}</span></div>
                <div class="data-row"><span class="data-label">Fiscalite (PS 17,2%)</span><span class="data-value">${fmt(fiscETF)}</span></div>
                <div class="data-row highlight"><span class="data-label">CAPITAL NET</span><span class="data-value">${fmt(netETF)}</span></div>
                <div class="data-row"><span class="data-label">TRI</span><span class="data-value">${pct(triETF)}</span></div>
            </div></div>
            <div class="card"><h3>Mandat Titres Vifs</h3><div class="data-grid">
                <div class="data-row"><span class="data-label">Capital final brut</span><span class="data-value">${fmt(finalMandat)}</span></div>
                <div class="data-row"><span class="data-label">Gains</span><span class="data-value">${fmt(gainsMandat)}</span></div>
                <div class="data-row"><span class="data-label">Fiscalite (PS 17,2%)</span><span class="data-value">${fmt(fiscMandat)}</span></div>
                <div class="data-row highlight"><span class="data-label">CAPITAL NET</span><span class="data-value">${fmt(netMandat)}</span></div>
                <div class="data-row"><span class="data-label">TRI</span><span class="data-value">${pct(triMandat)}</span></div>
            </div></div>
        </div>
        <div class="card info-card"><p>PEA exonere d'IR apres 5 ans — seuls les 17,2% PS restent dus. ETF plus performant de <strong>${fmt(netETF - netMandat)}</strong>.</p></div>
    `);

    saveSimResult('peaLibre', { capitalNet: netETF, tri: triETF, capitalInvesti: capital });
    saveSimResult('peaMandat', { capitalNet: netMandat, tri: triMandat, capitalInvesti: capital });
    updateComparatif();
}

// ===== CTO =====
function calculateCTO() {
    const capital = getField('cto_capital');
    const horizon = getField('cto_horizon');
    const rdt = (getField('cto_rdt') - getField('cto_frais')) / 100;

    const finalBrut = capital * Math.pow(1 + rdt, horizon);
    const gains = finalBrut - capital;
    const impot = gains * 0.30;
    const capitalNet = finalBrut - impot;
    const tri = Math.pow(capitalNet / capital, 1 / horizon) - 1;

    document.getElementById('cto-results').classList.remove('hidden');
    setHTML('cto-results', `
        <div class="kpi-grid">
            <div class="kpi-card kpi-primary"><div class="kpi-label">Capital Investi</div><div class="kpi-value">${fmt(capital)}</div></div>
            <div class="kpi-card kpi-green"><div class="kpi-label">Capital Net</div><div class="kpi-value">${fmt(capitalNet)}</div></div>
            <div class="kpi-card kpi-blue"><div class="kpi-label">TRI</div><div class="kpi-value">${pct(tri)}</div></div>
            <div class="kpi-card kpi-red"><div class="kpi-label">Fiscalite PFU 30%</div><div class="kpi-value">${fmt(impot)}</div></div>
        </div>
        <div class="card"><h3>Detail</h3><div class="data-grid">
            <div class="data-row"><span class="data-label">Capital final brut</span><span class="data-value">${fmt(finalBrut)}</span></div>
            <div class="data-row"><span class="data-label">Gains totaux</span><span class="data-value">${fmt(gains)}</span></div>
            <div class="data-row"><span class="data-label">PFU 30% sur gains</span><span class="data-value">${fmt(impot)}</span></div>
            <div class="data-row highlight"><span class="data-label">CAPITAL NET CTO</span><span class="data-value">${fmt(capitalNet)}</span></div>
            <div class="data-row"><span class="data-label">TRI</span><span class="data-value">${pct(tri)}</span></div>
        </div></div>
        <div class="card info-card"><p>Le CTO subit la PFU 30% mais n'a pas de plafond de versement (PEA plafonne a 150 000 &euro;) et donne acces a tous les marches mondiaux.</p></div>
    `);

    saveSimResult('cto', { capitalNet, tri, capitalInvesti: capital });
    updateComparatif();
}

// ===== SIMULATION RESULTS STORAGE =====
function saveSimResult(key, data) {
    const all = JSON.parse(sessionStorage.getItem('sim_results') || '{}');
    all[key] = data;
    sessionStorage.setItem('sim_results', JSON.stringify(all));
}

function getSimResults() {
    return JSON.parse(sessionStorage.getItem('sim_results') || '{}');
}

// ===== COMPARATIF =====
function updateComparatif() {
    const r = getSimResults();
    if (Object.keys(r).length === 0) return;

    const items = [
        { name: 'Immobilier', key: 'immo' },
        { name: 'Assurance Vie', key: 'av' },
        { name: 'PEA Libre', key: 'peaLibre' },
        { name: 'PEA Mandat', key: 'peaMandat' },
        { name: 'CTO', key: 'cto' }
    ].filter(x => r[x.key]);

    if (items.length === 0) return;

    let best = items[0];
    items.forEach(x => { if (r[x.key].capitalNet > r[best.key].capitalNet) best = x; });

    let html = `<h3>Comparatif</h3><table class="data-table"><thead><tr><th>Critere</th>`;
    items.forEach(x => { html += `<th>${x.name}</th>`; });
    html += `<th>Meilleur</th></tr></thead><tbody>`;

    html += `<tr><td><strong>Capital net</strong></td>`;
    items.forEach(x => { html += `<td class="num">${fmt(r[x.key].capitalNet)}</td>`; });
    html += `<td class="best">${best.name}</td></tr>`;

    let bestTRI = items[0];
    items.forEach(x => { if (r[x.key].tri > r[bestTRI.key].tri) bestTRI = x; });
    html += `<tr><td><strong>TRI</strong></td>`;
    items.forEach(x => { html += `<td class="num">${pct(r[x.key].tri)}</td>`; });
    html += `<td class="best">${bestTRI.name}</td></tr>`;

    html += `<tr><td><strong>Capital investi</strong></td>`;
    items.forEach(x => { html += `<td class="num">${fmt(r[x.key].capitalInvesti)}</td>`; });
    html += `<td></td></tr>`;

    html += `</tbody></table>`;
    setHTML('comparatif-table-container', html);
}

// ===== IFI =====
function calculateIFI(d, totalImmo, dettes) {
    const rpVal = d.immoRP || 0;
    const abattRP = rpVal * 0.3;
    const rpNette = rpVal - abattRP;
    const locatif = (d.immoLoc1 || 0) + (d.immoLoc2 || 0) + (d.immoPro || 0);
    const autres = (d.immoRS || 0) + (d.immoAutres || 0);
    const assiette = rpNette + locatif + autres - dettes;

    let ifi = 0;
    if (assiette > 800000) {
        const tranches = [
            [800000, 1300000, 0.005],
            [1300000, 2570000, 0.007],
            [2570000, 5000000, 0.01],
            [5000000, 10000000, 0.0125],
            [10000000, Infinity, 0.015]
        ];
        tranches.forEach(([min, max, rate]) => {
            if (assiette > min) ifi += (Math.min(assiette, max) - min) * rate;
        });
    }

    const assujetti = assiette > 1300000;
    setHTML('dash-ifi', assujetti ? 'Assujetti — ' + fmt(ifi) : 'Non assujetti');
    setHTML('dash-ir', '—');

    // IFI page
    const ifiEl = document.getElementById('ifi-content');
    if (ifiEl && totalImmo > 0) {
        ifiEl.innerHTML = `
            <div class="kpi-grid">
                <div class="kpi-card ${assujetti ? 'kpi-red' : 'kpi-green'}"><div class="kpi-label">IFI Du</div><div class="kpi-value">${assujetti ? fmt(ifi) : '0 &euro;'}</div></div>
                <div class="kpi-card kpi-primary"><div class="kpi-label">Assiette Nette</div><div class="kpi-value">${fmt(assiette)}</div></div>
                <div class="kpi-card kpi-orange"><div class="kpi-label">Seuil IFI</div><div class="kpi-value">1 300 000 &euro;</div></div>
                <div class="kpi-card kpi-blue"><div class="kpi-label">Statut</div><div class="kpi-value">${assujetti ? '<span class="badge badge-red">Assujetti</span>' : '<span class="badge badge-green">Non assujetti</span>'}</div></div>
            </div>
            <div class="dashboard-grid">
                <div class="card"><h3>Assiette Taxable</h3><div class="data-grid">
                    <div class="data-row"><span class="data-label">Residence principale</span><span class="data-value">${fmt(rpVal)}</span></div>
                    <div class="data-row"><span class="data-label">Abattement RP 30%</span><span class="data-value">-${fmt(abattRP)}</span></div>
                    <div class="data-row"><span class="data-label">Immobilier locatif</span><span class="data-value">${fmt(locatif)}</span></div>
                    <div class="data-row"><span class="data-label">Autres immobiliers</span><span class="data-value">${fmt(autres)}</span></div>
                    <div class="data-row"><span class="data-label">Dettes deductibles</span><span class="data-value">-${fmt(dettes)}</span></div>
                    <div class="data-row highlight"><span class="data-label">ASSIETTE IFI NETTE</span><span class="data-value">${fmt(assiette)}</span></div>
                </div></div>
                <div class="card"><h3>Calcul IFI</h3><div class="data-grid">
                    <div class="data-row"><span class="data-label">800k — 1,3M (0,50%)</span><span class="data-value">${fmt(Math.min(Math.max(assiette - 800000, 0), 500000) * 0.005)}</span></div>
                    <div class="data-row"><span class="data-label">1,3M — 2,57M (0,70%)</span><span class="data-value">${fmt(Math.min(Math.max(assiette - 1300000, 0), 1270000) * 0.007)}</span></div>
                    <div class="data-row highlight"><span class="data-label">IFI TOTAL DU</span><span class="data-value">${fmt(ifi)}</span></div>
                </div></div>
            </div>
        `;
    }
}

// ===== FISCALITE & SUCCESSION =====
function calculateFiscalite(d, patriNet, totalFin) {
    const nbEnfants = d.nbEnfants || 0;
    if (nbEnfants === 0 || patriNet === 0) return;

    const av = d.assuranceVie || 0;
    const horsAV = patriNet - av;
    const abattParEnfant = 100000;
    const totalAbatt = abattParEnfant * nbEnfants;
    const partTaxable = Math.max(0, (horsAV / nbEnfants) - abattParEnfant);

    // Bareme succession ligne directe
    function calcDroits(base) {
        let droits = 0;
        const tranches = [[0,8072,0.05],[8072,12109,0.10],[12109,15932,0.15],[15932,552324,0.20],[552324,902838,0.30],[902838,1805677,0.40],[1805677,Infinity,0.45]];
        tranches.forEach(([min, max, rate]) => { if (base > min) droits += (Math.min(base, max) - min) * rate; });
        return droits;
    }

    const droitsParEnfant = calcDroits(partTaxable);
    const droitsTotaux = droitsParEnfant * nbEnfants;

    const abattAV = 152500;
    const partAV = av / nbEnfants;
    const taxableAV = Math.max(0, partAV - abattAV);
    const droitsAV = taxableAV * 0.20;
    const economieAV = droitsTotaux - droitsAV * nbEnfants;

    const fiscEl = document.getElementById('fiscalite-content');
    if (fiscEl) {
        fiscEl.innerHTML = `
            <div class="kpi-grid">
                <div class="kpi-card kpi-red"><div class="kpi-label">Droits Totaux Famille</div><div class="kpi-value">${fmt(droitsTotaux)}</div></div>
                <div class="kpi-card kpi-green"><div class="kpi-label">Economie via AV</div><div class="kpi-value">${fmt(economieAV)}</div></div>
                <div class="kpi-card kpi-blue"><div class="kpi-label">Abattement / enfant</div><div class="kpi-value">${fmt(abattParEnfant)}</div></div>
                <div class="kpi-card kpi-orange"><div class="kpi-label">Abattement AV / benef.</div><div class="kpi-value">${fmt(abattAV)}</div></div>
            </div>
            <div class="dashboard-grid">
                <div class="card"><h3>Donnees Successorales</h3><div class="data-grid">
                    <div class="data-row"><span class="data-label">Patrimoine net</span><span class="data-value">${fmt(patriNet)}</span></div>
                    <div class="data-row"><span class="data-label">dont Assurance Vie</span><span class="data-value">${fmt(av)}</span></div>
                    <div class="data-row"><span class="data-label">Patrimoine hors AV</span><span class="data-value">${fmt(horsAV)}</span></div>
                    <div class="data-row"><span class="data-label">Nombre d'enfants</span><span class="data-value">${nbEnfants}</span></div>
                    <div class="data-row"><span class="data-label">Total abattements</span><span class="data-value">${fmt(totalAbatt)}</span></div>
                    <div class="data-row"><span class="data-label">Part taxable / enfant</span><span class="data-value">${fmt(partTaxable)}</span></div>
                    <div class="data-row highlight"><span class="data-label">DROITS TOTAUX FAMILLE</span><span class="data-value">${fmt(droitsTotaux)}</span></div>
                </div></div>
                <div class="card card-highlight-green"><h3>Avantage Assurance Vie</h3><div class="data-grid">
                    <div class="data-row"><span class="data-label">Abattement AV / benef.</span><span class="data-value">${fmt(abattAV)}</span></div>
                    <div class="data-row"><span class="data-label">Cout transmission AV</span><span class="data-value">${fmt(droitsAV * nbEnfants)}</span></div>
                    <div class="data-row highlight"><span class="data-label">ECONOMIE vs succession</span><span class="data-value">${fmt(economieAV)}</span></div>
                </div></div>
            </div>
        `;
    }
}

// ===== ENVOYER BILAN PAR EMAIL =====
function generateBilanText() {
    const d = collectFormData();
    const r = getSimResults();
    const totalRevenus = (d.salairesClient || 0) + (d.salairesConjoint || 0) + (d.revenusBIC || 0) + (d.dividendes || 0) + (d.revenusFonciers || 0) + (d.pensions || 0) + (d.autresRevenus || 0);
    const totalCharges = (d.loyer || 0) + (d.creditRP || 0) + (d.creditLocatif || 0) + (d.creditConso || 0) + (d.pensionAlim || 0) + (d.autresCharges || 0);
    const totalImmo = (d.immoRP || 0) + (d.immoRS || 0) + (d.immoLoc1 || 0) + (d.immoLoc2 || 0) + (d.immoPro || 0) + (d.immoAutres || 0);
    const totalFin = (d.livrets || 0) + (d.pel || 0) + (d.assuranceVie || 0) + (d.pea || 0) + (d.cto || 0) + (d.per || 0) + (d.epargneSalariale || 0) + (d.autresPlacement || 0);
    const patriBrut = totalImmo + totalFin;
    const dettes = d.capitalRestantRP || 0;
    const patriNet = patriBrut - dettes;

    let text = `BILAN PATRIMONIAL - ${d.prenom || ''} ${d.nom || ''}\n`;
    text += `Date : ${new Date().toLocaleDateString('fr-FR')}\n`;
    text += `${'='.repeat(50)}\n\n`;

    text += `IDENTITE\n`;
    text += `Nom : ${d.nom || ''} ${d.prenom || ''}\n`;
    text += `Date de naissance : ${d.dateNaissance || '—'}\n`;
    text += `Situation : ${d.situationMatri || '—'}\n`;
    text += `Regime matrimonial : ${d.regimeMatri || '—'}\n`;
    text += `Enfants : ${d.nbEnfants || 0} (dont ${d.enfantsCharge || 0} a charge)\n\n`;

    text += `SITUATION PROFESSIONNELLE\n`;
    text += `Statut : ${d.statutPro || '—'}\n`;
    text += `Profession : ${d.profession || '—'}\n`;
    text += `Secteur : ${d.secteur || '—'}\n\n`;

    text += `REVENUS ANNUELS\n`;
    if (d.salairesClient) text += `Salaires client : ${d.salairesClient} EUR\n`;
    if (d.salairesConjoint) text += `Salaires conjoint : ${d.salairesConjoint} EUR\n`;
    if (d.revenusBIC) text += `BIC/BNC : ${d.revenusBIC} EUR\n`;
    if (d.dividendes) text += `Dividendes : ${d.dividendes} EUR\n`;
    if (d.revenusFonciers) text += `Revenus fonciers : ${d.revenusFonciers} EUR\n`;
    if (d.pensions) text += `Pensions : ${d.pensions} EUR\n`;
    text += `TOTAL REVENUS : ${totalRevenus} EUR\n\n`;

    text += `CHARGES MENSUELLES\n`;
    if (d.loyer) text += `Loyer : ${d.loyer} EUR/mois\n`;
    if (d.creditRP) text += `Credit RP : ${d.creditRP} EUR/mois\n`;
    if (d.creditLocatif) text += `Credits locatifs : ${d.creditLocatif} EUR/mois\n`;
    if (d.creditConso) text += `Credits conso : ${d.creditConso} EUR/mois\n`;
    text += `TOTAL CHARGES : ${totalCharges} EUR/mois\n`;
    text += `Capacite epargne : ${Math.round(totalRevenus / 12 - totalCharges)} EUR/mois\n\n`;

    text += `PATRIMOINE IMMOBILIER\n`;
    if (d.immoRP) text += `Residence principale : ${d.immoRP} EUR\n`;
    if (d.immoRS) text += `Residence secondaire : ${d.immoRS} EUR\n`;
    if (d.immoLoc1) text += `Locatif 1 : ${d.immoLoc1} EUR\n`;
    if (d.immoLoc2) text += `Locatif 2 : ${d.immoLoc2} EUR\n`;
    text += `Total immobilier : ${totalImmo} EUR\n\n`;

    text += `PATRIMOINE FINANCIER\n`;
    if (d.livrets) text += `Livrets : ${d.livrets} EUR\n`;
    if (d.assuranceVie) text += `Assurance Vie : ${d.assuranceVie} EUR\n`;
    if (d.pea) text += `PEA : ${d.pea} EUR\n`;
    if (d.cto) text += `CTO : ${d.cto} EUR\n`;
    if (d.per) text += `PER : ${d.per} EUR\n`;
    text += `Total financier : ${totalFin} EUR\n\n`;

    text += `SYNTHESE\n`;
    text += `Patrimoine brut : ${patriBrut} EUR\n`;
    text += `Dettes : ${dettes} EUR\n`;
    text += `Patrimoine net : ${patriNet} EUR\n`;
    text += `TMI : ${d.tmi ? (parseFloat(d.tmi) * 100) + '%' : '—'}\n`;
    text += `Parts fiscales : ${d.partsFiscales || '—'}\n\n`;

    text += `OBJECTIFS\n`;
    text += `Objectif principal : ${d.objectifPrincipal || '—'}\n`;
    text += `Profil de risque : ${d.profilRisque || '—'}\n`;
    text += `Horizon : ${d.horizon || '—'} (${d.horizonAnnees || '—'} ans)\n`;
    text += `Apport disponible : ${d.apportDispo || 0} EUR\n`;
    text += `Epargne mensuelle : ${d.epargneMensuelle || 0} EUR\n`;
    text += `Besoin revenus : ${d.besoinRevenus || 'Non'}\n`;
    text += `Preoccupation succession : ${d.preoccSucc || 'Non'}\n\n`;

    if (Object.keys(r).length > 0) {
        text += `RESULTATS SIMULATIONS\n`;
        if (r.immo) text += `Immobilier : Capital net ${Math.round(r.immo.capitalNet)} EUR / TRI ${(r.immo.tri * 100).toFixed(1)}%\n`;
        if (r.av) text += `Assurance Vie : Capital net ${Math.round(r.av.capitalNet)} EUR / TRI ${(r.av.tri * 100).toFixed(1)}%\n`;
        if (r.peaLibre) text += `PEA Libre : Capital net ${Math.round(r.peaLibre.capitalNet)} EUR / TRI ${(r.peaLibre.tri * 100).toFixed(1)}%\n`;
        if (r.peaMandat) text += `PEA Mandat : Capital net ${Math.round(r.peaMandat.capitalNet)} EUR / TRI ${(r.peaMandat.tri * 100).toFixed(1)}%\n`;
        if (r.cto) text += `CTO : Capital net ${Math.round(r.cto.capitalNet)} EUR / TRI ${(r.cto.tri * 100).toFixed(1)}%\n`;
    }

    return text;
}

function sendBilan() {
    const d = collectFormData();
    const subject = encodeURIComponent(`Bilan Patrimonial - ${d.prenom || ''} ${d.nom || ''} - ${new Date().toLocaleDateString('fr-FR')}`);
    const body = encodeURIComponent(generateBilanText());
    window.location.href = `mailto:${CGP_EMAIL}?subject=${subject}&body=${body}`;
}

function prendreRDV() {
    const d = collectFormData();
    const subject = encodeURIComponent(`Demande de RDV - ${d.prenom || ''} ${d.nom || ''} - Mise en place recommandations`);
    const body = encodeURIComponent(
        `Bonjour,\n\n` +
        `Je souhaite prendre rendez-vous pour la mise en place des recommandations issues de mon bilan patrimonial.\n\n` +
        `Nom : ${d.prenom || ''} ${d.nom || ''}\n` +
        `Email : ${getCurrentUser()?.email || '—'}\n` +
        `Objectif : ${d.objectifPrincipal || '—'}\n` +
        `Profil : ${d.profilRisque || '—'}\n\n` +
        `Merci de me proposer un creneau.\n\n` +
        `Cordialement`
    );
    window.location.href = `mailto:${CGP_EMAIL}?subject=${subject}&body=${body}`;
}

// ===== ONBOARDING WIZARD =====
// NOTE: Also update enterApp() in auth.js to call updateDashboardContext()
const ONBOARDING_STEPS = [
    { id: 1, title: 'Identite & Revenus', fields: ['nom','prenom','dateNaissance','situationMatri','regimeMatri','nbEnfants','enfantsCharge','statutPro','profession','secteur','salairesClient','salairesConjoint','revenusBIC','dividendes','revenusFonciers','pensions','autresRevenus','loyer','creditRP','capitalRestantRP','echeanceRP','creditLocatif','creditConso','pensionAlim','autresCharges'] },
    { id: 2, title: 'Patrimoine', fields: ['immoRP','immoRS','immoLoc1','immoLoc2','immoPro','immoAutres','livrets','pel','assuranceVie','pea','cto','per','epargneSalariale','autresPlacement','partsFiscales','tmi'] },
    { id: 3, title: 'Objectifs & Strategie', fields: ['objectifPrincipal','horizon','horizonAnnees','apportDispo','epargneMensuelle','profilRisque','besoinRevenus','preoccSucc'] }
];

let currentStep = 1;

function initOnboarding() {
    showStep(1);
    updateStepProgress();
}

function showStep(step) {
    currentStep = step;
    // Hide all step contents
    document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
    const stepEl = document.getElementById('step-' + step);
    if (stepEl) stepEl.classList.add('active');

    // Update progress indicators
    updateStepProgress();

    // Update nav buttons
    const backBtn = document.getElementById('step-back');
    const nextBtn = document.getElementById('step-next');
    if (backBtn) backBtn.style.display = step === 1 ? 'none' : 'inline-flex';
    if (nextBtn) {
        if (step === 3) {
            nextBtn.textContent = 'Lancer mon analyse';
            nextBtn.className = 'btn btn-gold';
        } else {
            nextBtn.textContent = 'Continuer';
            nextBtn.className = 'btn btn-primary';
        }
    }

    // Show step result if previous steps completed
    updateStepResults();

    window.scrollTo(0, 0);
}

function updateStepProgress() {
    for (let i = 1; i <= 3; i++) {
        const indicator = document.getElementById('indicator-' + i);
        if (!indicator) continue;
        indicator.classList.remove('active', 'completed');
        if (i === currentStep) indicator.classList.add('active');
        else if (i < currentStep) indicator.classList.add('completed');
    }
    // Update progress bar fill
    const fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = ((currentStep - 1) / 2 * 100) + '%';
}

function nextStep() {
    recalcAll();
    if (currentStep === 3) {
        // Final step: save and launch analysis
        saveAndCalculate();
        return;
    }
    showStep(currentStep + 1);
}

function prevStep() {
    if (currentStep > 1) showStep(currentStep - 1);
}

function updateStepResults() {
    const d = collectFormData();

    // Step 1 result: revenus + capacité épargne
    const totalRevenus = (d.salairesClient || 0) + (d.salairesConjoint || 0) + (d.revenusBIC || 0) + (d.dividendes || 0) + (d.revenusFonciers || 0) + (d.pensions || 0) + (d.autresRevenus || 0);
    const totalCharges = (d.loyer || 0) + (d.creditRP || 0) + (d.creditLocatif || 0) + (d.creditConso || 0) + (d.pensionAlim || 0) + (d.autresCharges || 0);
    const capacite = Math.round(totalRevenus / 12 - totalCharges);

    const result1 = document.getElementById('step-result-1');
    if (result1 && totalRevenus > 0 && currentStep > 1) {
        result1.classList.add('visible');
        result1.innerHTML = '<div class="result-grid"><div class="result-item"><span class="result-label">Revenus annuels</span><span class="result-value">' + fmt(totalRevenus) + '</span></div><div class="result-item"><span class="result-label">Capacite d\'epargne</span><span class="result-value">' + fmt(capacite) + '/mois</span></div></div>';
    }

    // Step 2 result: patrimoine + classe
    const totalImmo = (d.immoRP || 0) + (d.immoRS || 0) + (d.immoLoc1 || 0) + (d.immoLoc2 || 0) + (d.immoPro || 0) + (d.immoAutres || 0);
    const totalFin = (d.livrets || 0) + (d.pel || 0) + (d.assuranceVie || 0) + (d.pea || 0) + (d.cto || 0) + (d.per || 0) + (d.epargneSalariale || 0) + (d.autresPlacement || 0);
    const patriNet = totalImmo + totalFin - (d.capitalRestantRP || 0);

    let classe = 'En construction';
    if (patriNet >= 5000000) classe = 'Grande fortune';
    else if (patriNet >= 1000000) classe = 'Patrimoine > 1M';
    else if (patriNet >= 500000) classe = 'Patrimoine aise';
    else if (patriNet >= 100000) classe = 'Patrimoine moyen';

    const result2 = document.getElementById('step-result-2');
    if (result2 && (totalImmo + totalFin) > 0 && currentStep > 2) {
        result2.classList.add('visible');
        result2.innerHTML = '<div class="result-grid"><div class="result-item"><span class="result-label">Patrimoine net</span><span class="result-value">' + fmt(patriNet) + '</span></div><div class="result-item"><span class="result-label">Classe</span><span class="result-value">' + classe + '</span></div></div>';
    }
}

// ===== CONTEXTUAL DASHBOARD =====
function updateDashboardContext() {
    const d = collectFormData();
    const totalRevenus = (d.salairesClient || 0) + (d.salairesConjoint || 0) + (d.revenusBIC || 0) + (d.dividendes || 0) + (d.revenusFonciers || 0) + (d.pensions || 0) + (d.autresRevenus || 0);
    const hasProfile = totalRevenus > 0 && d.objectifPrincipal;

    const completionBanner = document.getElementById('completion-banner');
    const dashboardFull = document.getElementById('dashboard-full');
    const dashInsights = document.getElementById('dash-insights');

    if (!hasProfile) {
        // Show completion guide
        if (completionBanner) completionBanner.classList.remove('hidden');
        if (dashboardFull) dashboardFull.classList.add('hidden');
    } else {
        if (completionBanner) completionBanner.classList.add('hidden');
        if (dashboardFull) dashboardFull.classList.remove('hidden');

        // Generate insights
        if (dashInsights) {
            let insights = [];
            const totalCharges = (d.loyer || 0) + (d.creditRP || 0) + (d.creditLocatif || 0) + (d.creditConso || 0);
            const capacite = totalRevenus / 12 - totalCharges;
            const tauxEpargne = totalRevenus > 0 ? (capacite * 12 / totalRevenus) : 0;

            if (tauxEpargne > 0.3) insights.push({icon: '&#9650;', text: 'Votre taux d\'epargne de ' + (tauxEpargne * 100).toFixed(0) + '% est excellent. Vous avez une forte capacite d\'investissement.', type: 'positive'});
            else if (tauxEpargne > 0.15) insights.push({icon: '&#9644;', text: 'Votre taux d\'epargne de ' + (tauxEpargne * 100).toFixed(0) + '% est correct. Des optimisations sont possibles.', type: 'neutral'});
            else insights.push({icon: '&#9660;', text: 'Votre taux d\'epargne de ' + (tauxEpargne * 100).toFixed(0) + '% est faible. Privilegiez la reduction de charges.', type: 'warning'});

            const totalImmo = (d.immoRP || 0) + (d.immoRS || 0) + (d.immoLoc1 || 0) + (d.immoLoc2 || 0);
            const totalFin = (d.livrets || 0) + (d.assuranceVie || 0) + (d.pea || 0) + (d.cto || 0) + (d.per || 0);
            const patriBrut = totalImmo + totalFin;
            if (patriBrut > 0) {
                const pctImmo = totalImmo / patriBrut;
                if (pctImmo > 0.7) insights.push({icon: '&#9888;', text: 'Votre patrimoine est concentre a ' + (pctImmo * 100).toFixed(0) + '% en immobilier. Diversifiez vers des actifs financiers.', type: 'warning'});
                else if (pctImmo < 0.3 && totalImmo > 0) insights.push({icon: '&#9733;', text: 'Bonne diversification patrimoine immobilier / financier.', type: 'positive'});
            }

            if (d.tmi && parseFloat(d.tmi) >= 0.30) insights.push({icon: '&#9879;', text: 'Avec une TMI a ' + (parseFloat(d.tmi) * 100) + '%, privilegiez les enveloppes fiscales (PEA, Assurance Vie).', type: 'neutral'});

            dashInsights.innerHTML = insights.map(i => '<div class="insight-card insight-' + i.type + '"><span class="insight-icon">' + i.icon + '</span><p>' + i.text + '</p></div>').join('');
        }
    }
}

// ===== MINI SIMULATOR (LANDING) =====
function runMiniSim() {
    const objectif = document.getElementById('mini-objectif')?.value;
    const montant = parseFloat(document.getElementById('mini-montant')?.value) || 0;
    const horizon = parseInt(document.getElementById('mini-horizon')?.value) || 8;
    const resultEl = document.getElementById('mini-result');

    if (!objectif || montant <= 0 || !resultEl) return;

    // Simple projections
    const projections = {
        'valorisation': { vehicle: 'PEA (ETF)', rdt: 0.056, label: 'Valorisation du capital' },
        'revenus': { vehicle: 'Immobilier locatif', rdt: 0.045, label: 'Revenus complementaires' },
        'transmission': { vehicle: 'Assurance Vie', rdt: 0.035, label: 'Transmission patrimoniale' },
        'fiscal': { vehicle: 'PEA + Assurance Vie', rdt: 0.048, label: 'Optimisation fiscale' },
        'retraite': { vehicle: 'Assurance Vie + PER', rdt: 0.04, label: 'Preparation retraite' },
        'epargne': { vehicle: 'Assurance Vie', rdt: 0.032, label: 'Constitution d\'epargne' }
    };

    const p = projections[objectif] || projections['valorisation'];
    const capitalFinal = montant * Math.pow(1 + p.rdt, horizon);
    const gain = capitalFinal - montant;

    resultEl.classList.add('visible');
    resultEl.innerHTML = '<div class="mini-result-content">' +
        '<h3>Votre projection</h3>' +
        '<p class="mini-result-objectif">' + p.label + '</p>' +
        '<div class="mini-result-grid">' +
        '<div class="mini-result-item"><span class="mini-result-label">Capital projete a ' + horizon + ' ans</span><span class="mini-result-value">' + fmt(capitalFinal) + '</span></div>' +
        '<div class="mini-result-item"><span class="mini-result-label">Gain estime</span><span class="mini-result-value green">' + fmt(gain) + '</span></div>' +
        '<div class="mini-result-item"><span class="mini-result-label">Vehicule recommande</span><span class="mini-result-value">' + p.vehicle + '</span></div>' +
        '</div>' +
        '<p class="mini-result-cta-text">Creez votre compte pour acceder a votre analyse personnalisee complete.</p>' +
        '</div>';
}

// ===== LIVE FORM UPDATES =====
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-field]').forEach(el => {
        el.addEventListener('input', () => {
            recalcAll();
        });
    });
});
