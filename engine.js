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

    const classe = typeof getPatrimoineClasse === 'function' ? getPatrimoineClasse(patriNet) : 'En construction';

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
    const cfg = typeof getEffectiveConfig === 'function' ? getEffectiveConfig() : CONFIG;
    const apport = d.apportDispo || 0;
    const horizon = d.horizonAnnees || 8;
    const tmi = parseFloat(d.tmi) || 0.3;
    const ps = cfg.prelevementsSociaux.taux;
    const totalRevenus = (d.salairesClient || 0) + (d.salairesConjoint || 0) + (d.revenusBIC || 0) + (d.dividendes || 0) + (d.revenusFonciers || 0) + (d.pensions || 0) + (d.autresRevenus || 0);

    if (apport <= 0) return;

    // --- IMMOBILIER ---
    const immo_prix = apport * 3;
    const immo_notaire = cfg.immobilier.fraisNotaire.ancien;
    const immo_travaux = immo_prix * 0.05;
    const immo_garantie = cfg.immobilier.parametresDefaut.garantieBancaire;
    const immo_coutTotal = immo_prix + immo_prix * immo_notaire + immo_travaux + immo_garantie;
    const immo_aFinancer = immo_coutTotal - apport;
    const immo_taux = cfg.immobilier.parametresDefaut.tauxCredit;
    const immo_dureePret = cfg.immobilier.parametresDefaut.dureePret;
    const immo_tauxMens = immo_taux / 12;
    const immo_nbMens = immo_dureePret * 12;
    const immo_mensualite = immo_aFinancer > 0 ? immo_aFinancer * immo_tauxMens / (1 - Math.pow(1 + immo_tauxMens, -immo_nbMens)) : 0;
    const immo_loyer = immo_prix * cfg.immobilier.rentabilite.rendementLocatifBrut;
    const immo_loyerAn = immo_loyer * 12 * (1 - cfg.immobilier.parametresDefaut.tauxVacance);
    const immo_chargesAn = immo_prix * cfg.immobilier.parametresDefaut.chargesAnnuelles;
    const immo_resultatFiscal = immo_loyerAn - immo_chargesAn;
    const immo_impotAn = immo_resultatFiscal > 0 ? immo_resultatFiscal * (tmi + ps) : 0;
    const immo_cashFlowMens = (immo_loyerAn - immo_chargesAn - immo_impotAn) / 12 - immo_mensualite;
    const immo_revalo = cfg.immobilier.parametresDefaut.revalorisationAnnuelle;
    const immo_valeurRevente = immo_prix * Math.pow(1 + immo_revalo, immo_dureePret);
    const immo_pvBrute = immo_valeurRevente - immo_prix;
    const immo_abattPV = typeof calcAbattementPVImmo === 'function' ? calcAbattementPVImmo(immo_dureePret, 'ir') : (immo_dureePret >= 22 ? 1 : (immo_dureePret >= 6 ? (immo_dureePret - 5) * 0.06 : 0));
    const immo_impotPV = immo_pvBrute * (1 - immo_abattPV) * cfg.immobilier.pvImmobiliere.tauxGlobal;
    const immo_produitCession = immo_valeurRevente - immo_impotPV;
    const immo_tri = apport > 0 ? (Math.pow(immo_produitCession / apport, 1 / immo_dureePret) - 1) : 0;

    saveSimResult('immo', { capitalNet: immo_produitCession, tri: immo_tri, capitalInvesti: immo_coutTotal, cashFlowMens: immo_cashFlowMens, duree: immo_dureePret });

    // --- ASSURANCE VIE ---
    const profil = d.profilRisque || '';
    const profilKey = profil.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
    const allocProfil = cfg.assuranceVie.allocationProfilType[profilKey] || cfg.assuranceVie.allocationProfilType.prudent;
    let av_pctFE = allocProfil.fondsEuros, av_pctMandat = allocProfil.mandat, av_pctStruct = allocProfil.structure;

    const av_rdtFE = cfg.assuranceVie.rendements.fondsEuros;
    const av_rdtMandat = cfg.assuranceVie.rendements.mandatGestion;
    const av_couponStruct = cfg.assuranceVie.rendements.produitStructure;
    const av_capFE = apport * av_pctFE;
    const av_capMandat = apport * av_pctMandat;
    const av_capStruct = apport * av_pctStruct;
    const av_finalFE = av_capFE * Math.pow(1 + av_rdtFE, horizon);
    const av_finalMandat = av_capMandat * Math.pow(1 + av_rdtMandat, horizon);
    const av_finalStruct = av_capStruct + av_capStruct * av_couponStruct * horizon;
    const av_totalFinal = av_finalFE + av_finalMandat + av_finalStruct;
    const av_gain = av_totalFinal - apport;
    const av_abattement = horizon >= cfg.assuranceVie.fiscaliteRachat.dureeOptimale ? cfg.assuranceVie.fiscaliteRachat.abattementApres8Ans.celibataire : 0;
    const av_gainImposable = Math.max(0, av_gain - av_abattement);
    const av_fisc = av_gainImposable * cfg.pfu.taux;
    const av_capitalNet = av_totalFinal - av_fisc;
    const av_tri = Math.pow(av_capitalNet / apport, 1 / horizon) - 1;

    saveSimResult('av', { capitalNet: av_capitalNet, tri: av_tri, capitalInvesti: apport, gain: av_gain, fiscalite: av_fisc, transmission: Math.min(apport, cfg.assuranceVie.transmission.abattementParBeneficiaire * (d.nbEnfants || 1)), pctFE: av_pctFE, pctMandat: av_pctMandat, pctStruct: av_pctStruct });

    // --- PEA LIBRE ---
    const pea_capital = Math.min(apport, cfg.pea.plafondVersement);
    const pea_rdtNet = cfg.pea.rendements.etfMonde;
    const pea_final = pea_capital * Math.pow(1 + pea_rdtNet, horizon);
    const pea_gains = pea_final - pea_capital;
    const pea_fisc = pea_gains * (horizon >= cfg.pea.dureeOptimale ? cfg.pea.fiscaliteApres5Ans.taux : cfg.pea.fiscaliteAvant5Ans.taux);
    const pea_net = pea_final - pea_fisc;
    const pea_tri = Math.pow(pea_net / pea_capital, 1 / horizon) - 1;

    saveSimResult('peaLibre', { capitalNet: pea_net, tri: pea_tri, capitalInvesti: pea_capital });

    // --- PEA MANDAT ---
    const peaM_rdtNet = cfg.pea.rendements.mandatTitresVifs;
    const peaM_final = pea_capital * Math.pow(1 + peaM_rdtNet, horizon);
    const peaM_gains = peaM_final - pea_capital;
    const peaM_fisc = peaM_gains * (horizon >= cfg.pea.dureeOptimale ? cfg.pea.fiscaliteApres5Ans.taux : cfg.pea.fiscaliteAvant5Ans.taux);
    const peaM_net = peaM_final - peaM_fisc;
    const peaM_tri = Math.pow(peaM_net / pea_capital, 1 / horizon) - 1;

    saveSimResult('peaMandat', { capitalNet: peaM_net, tri: peaM_tri, capitalInvesti: pea_capital });

    // --- CTO ---
    const cto_capital = apport;
    const cto_rdtNet = cfg.cto.rendements.portefeuilleDiversifie;
    const cto_final = cto_capital * Math.pow(1 + cto_rdtNet, horizon);
    const cto_gains = cto_final - cto_capital;
    const cto_impot = cto_gains * cfg.cto.fiscalite.pfu;
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
    const cfg = typeof getEffectiveConfig === 'function' ? getEffectiveConfig() : CONFIG;
    const rpVal = d.immoRP || 0;
    const abattRP = rpVal * cfg.ifi.abattementRP;
    const rpNette = rpVal - abattRP;
    const locatif = (d.immoLoc1 || 0) + (d.immoLoc2 || 0) + (d.immoPro || 0);
    const autres = (d.immoRS || 0) + (d.immoAutres || 0);
    const assiette = rpNette + locatif + autres - dettes;

    let ifi = 0;
    if (assiette > cfg.ifi.tranches[1].min) {
        cfg.ifi.tranches.forEach(t => {
            if (t.taux > 0 && assiette > t.min) ifi += (Math.min(assiette, t.max) - t.min) * t.taux;
        });
    }

    const assujetti = assiette > cfg.ifi.seuilImposition;
    setHTML('dash-ifi', assujetti ? 'Assujetti — ' + fmt(ifi) : 'Non assujetti');
    setHTML('dash-ir', '—');

    // IFI page
    const ifiEl = document.getElementById('ifi-content');
    if (ifiEl && totalImmo > 0) {
        ifiEl.innerHTML = `
            <div class="kpi-grid">
                <div class="kpi-card ${assujetti ? 'kpi-red' : 'kpi-green'}"><div class="kpi-label">IFI Du</div><div class="kpi-value">${assujetti ? fmt(ifi) : '0 &euro;'}</div></div>
                <div class="kpi-card kpi-primary"><div class="kpi-label">Assiette Nette</div><div class="kpi-value">${fmt(assiette)}</div></div>
                <div class="kpi-card kpi-orange"><div class="kpi-label">Seuil IFI</div><div class="kpi-value">${fmt(cfg.ifi.seuilImposition)}</div></div>
                <div class="kpi-card kpi-blue"><div class="kpi-label">Statut</div><div class="kpi-value">${assujetti ? '<span class="badge badge-red">Assujetti</span>' : '<span class="badge badge-green">Non assujetti</span>'}</div></div>
            </div>
            <div class="dashboard-grid">
                <div class="card"><h3>Assiette Taxable</h3><div class="data-grid">
                    <div class="data-row"><span class="data-label">Residence principale</span><span class="data-value">${fmt(rpVal)}</span></div>
                    <div class="data-row"><span class="data-label">Abattement RP ${Math.round(cfg.ifi.abattementRP * 100)}%</span><span class="data-value">-${fmt(abattRP)}</span></div>
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
    const cfg = typeof getEffectiveConfig === 'function' ? getEffectiveConfig() : CONFIG;
    const nbEnfants = d.nbEnfants || 0;
    if (nbEnfants === 0 || patriNet === 0) return;

    const av = d.assuranceVie || 0;
    const horsAV = patriNet - av;
    const abattParEnfant = cfg.succession.ligneDirecte.abattement;
    const totalAbatt = abattParEnfant * nbEnfants;
    const partTaxable = Math.max(0, (horsAV / nbEnfants) - abattParEnfant);

    // Bareme succession ligne directe — depuis CONFIG
    function calcDroits(base) {
        return typeof calcBareme === 'function' ? calcBareme(base, cfg.succession.ligneDirecte.tranches) : 0;
    }

    const droitsParEnfant = calcDroits(partTaxable);
    const droitsTotaux = droitsParEnfant * nbEnfants;

    const abattAV = cfg.assuranceVie.transmission.abattementParBeneficiaire;
    const partAV = av / nbEnfants;
    const taxableAV = Math.max(0, partAV - abattAV);
    const droitsAV = taxableAV * cfg.assuranceVie.transmission.tauxApresAbattement;
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

function exportBilanPDF() {
    const d = collectFormData();
    const r = getSimResults();
    const nf = new Intl.NumberFormat('fr-FR');
    const fmtEur = (v) => v != null && v !== 0 ? nf.format(v) + ' \u20AC' : '\u2014';
    const dateStr = new Date().toLocaleDateString('fr-FR');
    const clientName = `${d.prenom || ''} ${d.nom || ''}`.trim() || 'Client';

    const totalRevenus = (d.salairesClient || 0) + (d.salairesConjoint || 0) + (d.revenusBIC || 0) + (d.dividendes || 0) + (d.revenusFonciers || 0) + (d.pensions || 0) + (d.autresRevenus || 0);
    const totalCharges = (d.loyer || 0) + (d.creditRP || 0) + (d.creditLocatif || 0) + (d.creditConso || 0) + (d.pensionAlim || 0) + (d.autresCharges || 0);
    const totalImmo = (d.immoRP || 0) + (d.immoRS || 0) + (d.immoLoc1 || 0) + (d.immoLoc2 || 0) + (d.immoPro || 0) + (d.immoAutres || 0);
    const totalFin = (d.livrets || 0) + (d.pel || 0) + (d.assuranceVie || 0) + (d.pea || 0) + (d.cto || 0) + (d.per || 0) + (d.epargneSalariale || 0) + (d.autresPlacement || 0);
    const patriBrut = totalImmo + totalFin;
    const dettes = d.capitalRestantRP || 0;
    const patriNet = patriBrut - dettes;

    // Helper to build a table row
    const row = (label, value) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #e8e8e8;">${label}</td><td style="padding:6px 12px;border-bottom:1px solid #e8e8e8;text-align:right;font-weight:500;">${value}</td></tr>`;
    const totalRow = (label, value) => `<tr><td style="padding:8px 12px;border-top:2px solid #254a65;font-weight:700;color:#254a65;">${label}</td><td style="padding:8px 12px;border-top:2px solid #254a65;text-align:right;font-weight:700;color:#254a65;">${value}</td></tr>`;
    const sectionTitle = (title) => `<h2 style="color:#254a65;font-size:16px;margin:28px 0 6px 0;padding-bottom:6px;border-bottom:2px solid #c8a94e;font-family:'Georgia',serif;">${title}</h2>`;
    const tableOpen = '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px;">';
    const tableClose = '</table>';

    // Build sections
    let identite = sectionTitle('Identit\u00e9');
    identite += tableOpen;
    identite += row('Nom', `${d.nom || '\u2014'} ${d.prenom || ''}`);
    identite += row('Date de naissance', d.dateNaissance || '\u2014');
    identite += row('Situation matrimoniale', d.situationMatri || '\u2014');
    identite += row('R\u00e9gime matrimonial', d.regimeMatri || '\u2014');
    identite += row('Enfants', `${d.nbEnfants || 0} (dont ${d.enfantsCharge || 0} \u00e0 charge)`);
    identite += tableClose;

    let sitPro = sectionTitle('Situation professionnelle');
    sitPro += tableOpen;
    sitPro += row('Statut', d.statutPro || '\u2014');
    sitPro += row('Profession', d.profession || '\u2014');
    sitPro += row('Secteur', d.secteur || '\u2014');
    sitPro += tableClose;

    let revenus = sectionTitle('Revenus annuels');
    revenus += tableOpen;
    if (d.salairesClient) revenus += row('Salaires client', fmtEur(d.salairesClient));
    if (d.salairesConjoint) revenus += row('Salaires conjoint', fmtEur(d.salairesConjoint));
    if (d.revenusBIC) revenus += row('BIC / BNC', fmtEur(d.revenusBIC));
    if (d.dividendes) revenus += row('Dividendes', fmtEur(d.dividendes));
    if (d.revenusFonciers) revenus += row('Revenus fonciers', fmtEur(d.revenusFonciers));
    if (d.pensions) revenus += row('Pensions', fmtEur(d.pensions));
    if (d.autresRevenus) revenus += row('Autres revenus', fmtEur(d.autresRevenus));
    revenus += totalRow('Total revenus', fmtEur(totalRevenus));
    revenus += tableClose;

    let charges = sectionTitle('Charges mensuelles');
    charges += tableOpen;
    if (d.loyer) charges += row('Loyer', fmtEur(d.loyer) + ' /mois');
    if (d.creditRP) charges += row('Cr\u00e9dit r\u00e9sidence principale', fmtEur(d.creditRP) + ' /mois');
    if (d.creditLocatif) charges += row('Cr\u00e9dits locatifs', fmtEur(d.creditLocatif) + ' /mois');
    if (d.creditConso) charges += row('Cr\u00e9dits consommation', fmtEur(d.creditConso) + ' /mois');
    if (d.pensionAlim) charges += row('Pension alimentaire', fmtEur(d.pensionAlim) + ' /mois');
    if (d.autresCharges) charges += row('Autres charges', fmtEur(d.autresCharges) + ' /mois');
    charges += totalRow('Total charges', fmtEur(totalCharges) + ' /mois');
    charges += row('Capacit\u00e9 d\u2019\u00e9pargne', fmtEur(Math.round(totalRevenus / 12 - totalCharges)) + ' /mois');
    charges += tableClose;

    let immo = sectionTitle('Patrimoine immobilier');
    immo += tableOpen;
    if (d.immoRP) immo += row('R\u00e9sidence principale', fmtEur(d.immoRP));
    if (d.immoRS) immo += row('R\u00e9sidence secondaire', fmtEur(d.immoRS));
    if (d.immoLoc1) immo += row('Locatif 1', fmtEur(d.immoLoc1));
    if (d.immoLoc2) immo += row('Locatif 2', fmtEur(d.immoLoc2));
    if (d.immoPro) immo += row('Immobilier professionnel', fmtEur(d.immoPro));
    if (d.immoAutres) immo += row('Autres immobiliers', fmtEur(d.immoAutres));
    immo += totalRow('Total immobilier', fmtEur(totalImmo));
    immo += tableClose;

    let fin = sectionTitle('Patrimoine financier');
    fin += tableOpen;
    if (d.livrets) fin += row('Livrets', fmtEur(d.livrets));
    if (d.pel) fin += row('PEL', fmtEur(d.pel));
    if (d.assuranceVie) fin += row('Assurance Vie', fmtEur(d.assuranceVie));
    if (d.pea) fin += row('PEA', fmtEur(d.pea));
    if (d.cto) fin += row('CTO', fmtEur(d.cto));
    if (d.per) fin += row('PER', fmtEur(d.per));
    if (d.epargneSalariale) fin += row('\u00c9pargne salariale', fmtEur(d.epargneSalariale));
    if (d.autresPlacement) fin += row('Autres placements', fmtEur(d.autresPlacement));
    fin += totalRow('Total financier', fmtEur(totalFin));
    fin += tableClose;

    let synthese = sectionTitle('Synth\u00e8se patrimoniale');
    synthese += `<div style="background:linear-gradient(135deg,#f8f6f0,#fff);border:2px solid #c8a94e;border-radius:10px;padding:20px;margin:12px 0;">`;
    synthese += tableOpen;
    synthese += row('Patrimoine brut', fmtEur(patriBrut));
    synthese += row('Dettes', fmtEur(dettes));
    synthese += `<tr><td style="padding:12px;border-top:2px solid #c8a94e;font-size:16px;font-weight:700;color:#254a65;">Patrimoine net</td><td style="padding:12px;border-top:2px solid #c8a94e;text-align:right;font-size:18px;font-weight:700;color:#c8a94e;">${fmtEur(patriNet)}</td></tr>`;
    synthese += tableClose;
    synthese += tableOpen;
    synthese += row('TMI', d.tmi ? (parseFloat(d.tmi) * 100) + ' %' : '\u2014');
    synthese += row('Parts fiscales', d.partsFiscales || '\u2014');
    synthese += tableClose;
    synthese += '</div>';

    let objectifs = sectionTitle('Objectifs');
    objectifs += tableOpen;
    objectifs += row('Objectif principal', d.objectifPrincipal || '\u2014');
    objectifs += row('Profil de risque', d.profilRisque || '\u2014');
    objectifs += row('Horizon', `${d.horizon || '\u2014'} (${d.horizonAnnees || '\u2014'} ans)`);
    objectifs += row('Apport disponible', fmtEur(d.apportDispo || 0));
    objectifs += row('\u00c9pargne mensuelle', fmtEur(d.epargneMensuelle || 0));
    objectifs += row('Besoin de revenus', d.besoinRevenus || 'Non');
    objectifs += row('Pr\u00e9occupation succession', d.preoccSucc || 'Non');
    objectifs += tableClose;

    let simulations = '';
    if (Object.keys(r).length > 0) {
        simulations = sectionTitle('R\u00e9sultats des simulations');
        simulations += tableOpen;
        simulations += `<tr style="background:#254a65;color:#fff;"><th style="padding:8px 12px;text-align:left;">Enveloppe</th><th style="padding:8px 12px;text-align:right;">Capital net</th><th style="padding:8px 12px;text-align:right;">TRI</th></tr>`;
        if (r.immo) simulations += `<tr><td style="padding:6px 12px;border-bottom:1px solid #e8e8e8;">Immobilier</td><td style="padding:6px 12px;border-bottom:1px solid #e8e8e8;text-align:right;">${fmtEur(Math.round(r.immo.capitalNet))}</td><td style="padding:6px 12px;border-bottom:1px solid #e8e8e8;text-align:right;">${(r.immo.tri * 100).toFixed(1)} %</td></tr>`;
        if (r.av) simulations += `<tr><td style="padding:6px 12px;border-bottom:1px solid #e8e8e8;">Assurance Vie</td><td style="padding:6px 12px;border-bottom:1px solid #e8e8e8;text-align:right;">${fmtEur(Math.round(r.av.capitalNet))}</td><td style="padding:6px 12px;border-bottom:1px solid #e8e8e8;text-align:right;">${(r.av.tri * 100).toFixed(1)} %</td></tr>`;
        if (r.peaLibre) simulations += `<tr><td style="padding:6px 12px;border-bottom:1px solid #e8e8e8;">PEA Libre</td><td style="padding:6px 12px;border-bottom:1px solid #e8e8e8;text-align:right;">${fmtEur(Math.round(r.peaLibre.capitalNet))}</td><td style="padding:6px 12px;border-bottom:1px solid #e8e8e8;text-align:right;">${(r.peaLibre.tri * 100).toFixed(1)} %</td></tr>`;
        if (r.peaMandat) simulations += `<tr><td style="padding:6px 12px;border-bottom:1px solid #e8e8e8;">PEA Mandat</td><td style="padding:6px 12px;border-bottom:1px solid #e8e8e8;text-align:right;">${fmtEur(Math.round(r.peaMandat.capitalNet))}</td><td style="padding:6px 12px;border-bottom:1px solid #e8e8e8;text-align:right;">${(r.peaMandat.tri * 100).toFixed(1)} %</td></tr>`;
        if (r.cto) simulations += `<tr><td style="padding:6px 12px;border-bottom:1px solid #e8e8e8;">CTO</td><td style="padding:6px 12px;border-bottom:1px solid #e8e8e8;text-align:right;">${fmtEur(Math.round(r.cto.capitalNet))}</td><td style="padding:6px 12px;border-bottom:1px solid #e8e8e8;text-align:right;">${(r.cto.tri * 100).toFixed(1)} %</td></tr>`;
        simulations += tableClose;
    }

    // Full HTML document
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Bilan Patrimonial \u2014 ${clientName}</title>
<style>
    @page {
        size: A4;
        margin: 20mm 18mm 25mm 18mm;
    }
    @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .no-print { display: none; }
    }
    * { box-sizing: border-box; }
    body {
        font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        color: #2c2c2c;
        line-height: 1.5;
        margin: 0;
        padding: 0;
        font-size: 13px;
    }
    .page-wrapper {
        max-width: 750px;
        margin: 0 auto;
        padding: 10px 0;
    }
    .header {
        text-align: center;
        padding-bottom: 16px;
        margin-bottom: 10px;
    }
    .header img {
        max-height: 70px;
        margin-bottom: 8px;
    }
    .header h1 {
        font-family: 'Georgia', serif;
        font-size: 22px;
        letter-spacing: 6px;
        color: #254a65;
        margin: 0 0 4px 0;
        font-weight: 400;
    }
    .header .gold-line {
        width: 120px;
        height: 2px;
        background: #c8a94e;
        margin: 10px auto;
    }
    .subtitle {
        text-align: center;
        font-size: 15px;
        color: #555;
        margin-bottom: 6px;
    }
    .date-line {
        text-align: center;
        font-size: 12px;
        color: #888;
        margin-bottom: 24px;
    }
    table { page-break-inside: avoid; }
    h2 { page-break-after: avoid; }
    .footer {
        margin-top: 40px;
        padding-top: 12px;
        border-top: 1px solid #ccc;
        text-align: center;
        font-size: 10px;
        color: #999;
    }
</style>
</head>
<body>
<div class="page-wrapper">
    <div class="header">
        <img src="logo.png" alt="Patria Capital">
        <h1>PATRIA CAPITAL</h1>
        <div class="gold-line"></div>
    </div>
    <div class="subtitle">Bilan Patrimonial \u2014 ${clientName}</div>
    <div class="date-line">${dateStr}</div>
    ${identite}
    ${sitPro}
    ${revenus}
    ${charges}
    ${immo}
    ${fin}
    ${synthese}
    ${objectifs}
    ${simulations}
    <div class="footer">
        Document confidentiel \u2014 Patria Capital \u2014 ${dateStr}
    </div>
</div>
</body>
</html>`;

    // Create hidden iframe and trigger print
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    // Wait for content (especially logo image) to load before printing
    iframe.contentWindow.onafterprint = () => {
        document.body.removeChild(iframe);
    };

    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        // Fallback cleanup after 60s if onafterprint doesn't fire
        setTimeout(() => {
            if (iframe.parentNode) {
                document.body.removeChild(iframe);
            }
        }, 60000);
    }, 500);
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

    // Projections depuis CONFIG
    const cfg = typeof getEffectiveConfig === 'function' ? getEffectiveConfig() : CONFIG;
    const labels = {
        'valorisation': 'Valorisation du capital',
        'revenus': 'Revenus complementaires',
        'transmission': 'Transmission patrimoniale',
        'fiscal': 'Optimisation fiscale',
        'retraite': 'Preparation retraite',
        'epargne': "Constitution d'epargne"
    };
    const miniCfg = cfg.miniSimulateur && cfg.miniSimulateur.projections ? cfg.miniSimulateur.projections : {};
    const proj = miniCfg[objectif] || miniCfg['valorisation'] || { vehicule: 'PEA', rendement: 0.05 };
    const p = { vehicle: proj.vehicule, rdt: proj.rendement, label: labels[objectif] || objectif };
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

// ===== DIRIGEANT TOGGLE =====
function toggleDirigeantSection() {
    const cb = document.getElementById('isDirigeant');
    const navItem = document.getElementById('nav-dirigeant');
    if (cb && navItem) {
        if (cb.checked) {
            navItem.classList.remove('hidden');
        } else {
            navItem.classList.add('hidden');
        }
    }
}

// ===== AV RACHAT =====
function calculateAVRachat() {
    const cfg = typeof getEffectiveConfig === 'function' ? getEffectiveConfig() : CONFIG;
    const encours = getField('av_exist_encours');
    const versements = getField('av_exist_versements');
    const anciennete = getField('av_exist_anciennete');
    const rachat = getField('av_exist_rachat');
    const situation = document.querySelector('[data-field="av_exist_situation"]')?.value || 'celibataire';

    if (encours <= 0 || rachat <= 0) return;

    const gains = Math.max(0, encours - versements);
    const partGains = (gains / encours) * rachat;
    const partCapital = rachat - partGains;

    const apres8 = anciennete >= cfg.assuranceVie.fiscaliteRachat.dureeOptimale;
    const abattement = apres8 ? (situation === 'couple' ? cfg.assuranceVie.fiscaliteRachat.abattementApres8Ans.couple : cfg.assuranceVie.fiscaliteRachat.abattementApres8Ans.celibataire) : 0;
    const gainsImposables = Math.max(0, partGains - abattement);

    const tauxPFU = apres8 ? cfg.assuranceVie.fiscaliteRachat.tauxPL.apres8Ans : cfg.assuranceVie.fiscaliteRachat.pfu;
    const irPFU = gainsImposables * tauxPFU;
    const ps = partGains * cfg.prelevementsSociaux.taux;
    const totalFiscalite = irPFU + ps;
    const netPercu = rachat - totalFiscalite;

    const el = document.getElementById('av-rachat-results');
    el.classList.remove('hidden');
    setHTML('av-rachat-results', `
        <div class="kpi-grid">
            <div class="kpi-card kpi-primary"><div class="kpi-label">Rachat demande</div><div class="kpi-value">${fmt(rachat)}</div></div>
            <div class="kpi-card kpi-green"><div class="kpi-label">Net percu</div><div class="kpi-value">${fmt(netPercu)}</div></div>
            <div class="kpi-card kpi-red"><div class="kpi-label">Fiscalite totale</div><div class="kpi-value">${fmt(totalFiscalite)}</div></div>
            <div class="kpi-card ${apres8 ? 'kpi-green' : 'kpi-orange'}"><div class="kpi-label">Regime</div><div class="kpi-value">${apres8 ? 'Apres 8 ans' : 'Avant 8 ans'}</div></div>
        </div>
        <div class="dashboard-grid">
            <div class="card"><h3>Decomposition du rachat</h3><div class="data-grid">
                <div class="data-row"><span class="data-label">Encours total</span><span class="data-value">${fmt(encours)}</span></div>
                <div class="data-row"><span class="data-label">Versements cumules</span><span class="data-value">${fmt(versements)}</span></div>
                <div class="data-row"><span class="data-label">Plus-values latentes</span><span class="data-value">${fmt(gains)}</span></div>
                <div class="data-row"><span class="data-label">Part capital dans rachat</span><span class="data-value">${fmt(partCapital)}</span></div>
                <div class="data-row"><span class="data-label">Part gains dans rachat</span><span class="data-value">${fmt(partGains)}</span></div>
            </div></div>
            <div class="card"><h3>Fiscalite</h3><div class="data-grid">
                ${apres8 ? '<div class="data-row"><span class="data-label">Abattement ' + situation + '</span><span class="data-value">' + fmt(abattement) + '</span></div>' : ''}
                <div class="data-row"><span class="data-label">Gains imposables</span><span class="data-value">${fmt(gainsImposables)}</span></div>
                <div class="data-row"><span class="data-label">IR (taux ${pct(tauxPFU)})</span><span class="data-value">${fmt(irPFU)}</span></div>
                <div class="data-row"><span class="data-label">Prelevements sociaux (${pct(cfg.prelevementsSociaux.taux)})</span><span class="data-value">${fmt(ps)}</span></div>
                <div class="data-row highlight"><span class="data-label">TOTAL FISCALITE</span><span class="data-value">${fmt(totalFiscalite)}</span></div>
                <div class="data-row highlight"><span class="data-label">NET PERCU</span><span class="data-value">${fmt(netPercu)}</span></div>
            </div></div>
        </div>
    `);
}

// ===== PEA RETRAIT =====
function calculatePEARetrait() {
    const cfg = typeof getEffectiveConfig === 'function' ? getEffectiveConfig() : CONFIG;
    const valeur = getField('pea_exist_valeur');
    const versements = getField('pea_exist_versements');
    const anciennete = getField('pea_exist_anciennete');
    const retrait = getField('pea_exist_retrait');

    if (valeur <= 0 || retrait <= 0) return;

    const gains = Math.max(0, valeur - versements);
    const partGains = (gains / valeur) * retrait;

    const apres5 = anciennete >= cfg.pea.dureeOptimale;
    const taux = apres5 ? cfg.pea.fiscaliteApres5Ans.taux : cfg.pea.fiscaliteAvant5Ans.taux;
    const fiscalite = partGains * taux;
    const netPercu = retrait - fiscalite;

    // Consequence sur le PEA
    const clotureAvant5 = !apres5;

    const el = document.getElementById('pea-retrait-results');
    el.classList.remove('hidden');
    setHTML('pea-retrait-results', `
        <div class="kpi-grid">
            <div class="kpi-card kpi-primary"><div class="kpi-label">Retrait demande</div><div class="kpi-value">${fmt(retrait)}</div></div>
            <div class="kpi-card kpi-green"><div class="kpi-label">Net percu</div><div class="kpi-value">${fmt(netPercu)}</div></div>
            <div class="kpi-card kpi-red"><div class="kpi-label">Fiscalite</div><div class="kpi-value">${fmt(fiscalite)}</div></div>
            <div class="kpi-card ${apres5 ? 'kpi-green' : 'kpi-red'}"><div class="kpi-label">Statut PEA</div><div class="kpi-value">${apres5 ? 'Retrait partiel OK' : 'Cloture du PEA'}</div></div>
        </div>
        <div class="dashboard-grid">
            <div class="card"><h3>Decomposition</h3><div class="data-grid">
                <div class="data-row"><span class="data-label">Valorisation actuelle</span><span class="data-value">${fmt(valeur)}</span></div>
                <div class="data-row"><span class="data-label">Versements cumules</span><span class="data-value">${fmt(versements)}</span></div>
                <div class="data-row"><span class="data-label">Plus-values latentes</span><span class="data-value">${fmt(gains)}</span></div>
                <div class="data-row"><span class="data-label">Part gains dans retrait</span><span class="data-value">${fmt(partGains)}</span></div>
            </div></div>
            <div class="card"><h3>Fiscalite du retrait</h3><div class="data-grid">
                <div class="data-row"><span class="data-label">Anciennete</span><span class="data-value">${anciennete} ans</span></div>
                <div class="data-row"><span class="data-label">Regime</span><span class="data-value">${apres5 ? 'PS seuls (17,2%)' : 'PFU 30%'}</span></div>
                <div class="data-row"><span class="data-label">Taux applique</span><span class="data-value">${pct(taux)}</span></div>
                <div class="data-row highlight"><span class="data-label">FISCALITE TOTALE</span><span class="data-value">${fmt(fiscalite)}</span></div>
                ${clotureAvant5 ? '<div class="data-row" style="color:#dc2626;"><span class="data-label">⚠ Attention</span><span class="data-value">Retrait avant 5 ans = cloture du PEA</span></div>' : '<div class="data-row" style="color:#059669;"><span class="data-label">&#10003; Apres 5 ans</span><span class="data-value">Retrait partiel sans cloture</span></div>'}
            </div></div>
        </div>
    `);
}

// ===== CTO CESSION =====
function calculateCTOCession() {
    const cfg = typeof getEffectiveConfig === 'function' ? getEffectiveConfig() : CONFIG;
    const valeur = getField('cto_exist_valeur');
    const pru = getField('cto_exist_pru');
    const duree = getField('cto_exist_duree');
    const cession = getField('cto_exist_cession');
    const dateAcq = document.querySelector('[data-field="cto_exist_date_acq"]')?.value || 'apres2018';

    if (valeur <= 0 || cession <= 0) return;

    const pv = Math.max(0, valeur - pru);
    const partPV = (pv / valeur) * cession;

    // PFU par defaut
    const fiscPFU = partPV * cfg.cto.fiscalite.pfu;

    // Option bareme progressif (titres avant 2018 uniquement)
    let abattement = 0;
    let pvApresAbatt = partPV;
    if (dateAcq === 'avant2018') {
        if (duree >= 8) abattement = cfg.cto.fiscalite.abattementDureeDetention.droitCommun.plus8Ans;
        else if (duree >= 2) abattement = cfg.cto.fiscalite.abattementDureeDetention.droitCommun.entre2et8Ans;
        pvApresAbatt = partPV * (1 - abattement);
    }

    const netPFU = cession - fiscPFU;

    const el = document.getElementById('cto-cession-results');
    el.classList.remove('hidden');
    setHTML('cto-cession-results', `
        <div class="kpi-grid">
            <div class="kpi-card kpi-primary"><div class="kpi-label">Cession</div><div class="kpi-value">${fmt(cession)}</div></div>
            <div class="kpi-card kpi-orange"><div class="kpi-label">Plus-value</div><div class="kpi-value">${fmt(partPV)}</div></div>
            <div class="kpi-card kpi-red"><div class="kpi-label">Fiscalite PFU</div><div class="kpi-value">${fmt(fiscPFU)}</div></div>
            <div class="kpi-card kpi-green"><div class="kpi-label">Net PFU</div><div class="kpi-value">${fmt(netPFU)}</div></div>
        </div>
        <div class="dashboard-grid">
            <div class="card"><h3>Plus-value de cession</h3><div class="data-grid">
                <div class="data-row"><span class="data-label">Valorisation actuelle</span><span class="data-value">${fmt(valeur)}</span></div>
                <div class="data-row"><span class="data-label">Prix d'acquisition (PRU)</span><span class="data-value">${fmt(pru)}</span></div>
                <div class="data-row"><span class="data-label">Plus-value globale</span><span class="data-value">${fmt(pv)}</span></div>
                <div class="data-row"><span class="data-label">PV proportionnelle (cession)</span><span class="data-value">${fmt(partPV)}</span></div>
            </div></div>
            <div class="card"><h3>Comparatif fiscal</h3><div class="data-grid">
                <div class="data-row highlight"><span class="data-label">Option PFU (30%)</span><span class="data-value">${fmt(fiscPFU)}</span></div>
                ${dateAcq === 'avant2018' ? `
                <div class="data-row"><span class="data-label">Abattement duree (${pct(abattement)})</span><span class="data-value">-${fmt(partPV * abattement)}</span></div>
                <div class="data-row"><span class="data-label">PV apres abattement</span><span class="data-value">${fmt(pvApresAbatt)}</span></div>
                <div class="data-row" style="color:#6b7280;"><span class="data-label">&#8594; A soumettre au bareme IR</span><span class="data-value">+ PS ${pct(cfg.prelevementsSociaux.taux)}</span></div>
                ` : '<div class="data-row"><span class="data-label">Titres acquis apres 2018</span><span class="data-value">Pas d\'abattement</span></div>'}
                <div class="data-row highlight"><span class="data-label">NET PERCU (PFU)</span><span class="data-value">${fmt(netPFU)}</span></div>
            </div></div>
        </div>
    `);
}

// ===== CESSION DE PARTS (DIRIGEANT) =====
function calculateCessionParts() {
    const cfg = typeof getEffectiveConfig === 'function' ? getEffectiveConfig() : CONFIG;
    const valeur = getField('dir_cession_valeur');
    const pru = getField('dir_cession_pru');
    const duree = getField('dir_cession_duree');
    const dateAcq = document.querySelector('[data-field="dir_cession_date_acq"]')?.value || 'apres2018';
    const retraite = document.querySelector('[data-field="dir_cession_retraite"]')?.value || 'non';
    const bter = document.querySelector('[data-field="dir_cession_150bter"]')?.value || 'non';

    if (valeur <= 0) return;
    const pv = Math.max(0, valeur - pru);

    // Scenario 1 : PFU
    const fiscPFU = pv * cfg.dirigeant.cessionParts.pfu;

    // Scenario 2 : Bareme avec abattement (si titres avant 2018)
    let abattPct = 0;
    if (dateAcq === 'avant2018') {
        if (retraite === 'oui') {
            if (duree >= 8) abattPct = cfg.dirigeant.cessionParts.abattementDureeDetention.dirigeantRetraite.plus8Ans;
            else if (duree >= 4) abattPct = cfg.dirigeant.cessionParts.abattementDureeDetention.dirigeantRetraite.entre4et8Ans;
            else if (duree >= 1) abattPct = cfg.dirigeant.cessionParts.abattementDureeDetention.dirigeantRetraite.entre1et4Ans;
        } else {
            if (duree >= 8) abattPct = cfg.dirigeant.cessionParts.abattementDureeDetention.droitCommun.plus8Ans;
            else if (duree >= 2) abattPct = cfg.dirigeant.cessionParts.abattementDureeDetention.droitCommun.entre2et8Ans;
        }
    }
    const pvApresAbatt = pv * (1 - abattPct);
    const abattFixeRetraite = (retraite === 'oui') ? Math.min(cfg.dirigeant.cessionParts.abattementDureeDetention.abattementFixeRetraite, pvApresAbatt) : 0;
    const pvImposable = Math.max(0, pvApresAbatt - abattFixeRetraite);

    // Scenario 3 : 150-0 B ter
    const reinvest = cfg.dirigeant.apportCession150Bter.seuilReinvestissement;

    const el = document.getElementById('cession-results');
    el.classList.remove('hidden');
    setHTML('cession-results', `
        <div class="kpi-grid">
            <div class="kpi-card kpi-primary"><div class="kpi-label">Plus-value brute</div><div class="kpi-value">${fmt(pv)}</div></div>
            <div class="kpi-card kpi-red"><div class="kpi-label">Fiscalite PFU</div><div class="kpi-value">${fmt(fiscPFU)}</div></div>
            <div class="kpi-card kpi-green"><div class="kpi-label">Net PFU</div><div class="kpi-value">${fmt(valeur - fiscPFU)}</div></div>
            <div class="kpi-card kpi-blue"><div class="kpi-label">150-0 B ter</div><div class="kpi-value">${bter === 'oui' ? 'Report actif' : 'Non utilise'}</div></div>
        </div>
        <div class="dashboard-grid">
            <div class="card"><h3>Scenario 1 — PFU 30%</h3><div class="data-grid">
                <div class="data-row"><span class="data-label">Plus-value</span><span class="data-value">${fmt(pv)}</span></div>
                <div class="data-row"><span class="data-label">PFU 30%</span><span class="data-value">${fmt(fiscPFU)}</span></div>
                <div class="data-row highlight"><span class="data-label">NET PERCU</span><span class="data-value">${fmt(valeur - fiscPFU)}</span></div>
            </div></div>

            ${dateAcq === 'avant2018' ? `
            <div class="card card-highlight-green"><h3>Scenario 2 — Bareme + abattement${retraite === 'oui' ? ' (depart retraite)' : ''}</h3><div class="data-grid">
                <div class="data-row"><span class="data-label">Abattement duree (${pct(abattPct)})</span><span class="data-value">-${fmt(pv * abattPct)}</span></div>
                ${retraite === 'oui' ? '<div class="data-row"><span class="data-label">Abattement fixe retraite</span><span class="data-value">-' + fmt(abattFixeRetraite) + '</span></div>' : ''}
                <div class="data-row"><span class="data-label">PV imposable au bareme</span><span class="data-value">${fmt(pvImposable)}</span></div>
                <div class="data-row"><span class="data-label">+ PS sur PV totale</span><span class="data-value">${fmt(pv * cfg.prelevementsSociaux.taux)}</span></div>
                <div class="data-row" style="font-size:11px;color:#6b7280;">A soumettre au bareme progressif IR selon TMI</div>
            </div></div>
            ` : ''}

            <div class="card"><h3>Scenario 3 — Report 150-0 B ter</h3><div class="data-grid">
                <div class="data-row"><span class="data-label">Apport des titres a une holding</span><span class="data-value">${fmt(valeur)}</span></div>
                <div class="data-row"><span class="data-label">PV en report d'imposition</span><span class="data-value">${fmt(pv)}</span></div>
                <div class="data-row"><span class="data-label">Obligation reinvestissement (${pct(reinvest)})</span><span class="data-value">${fmt(pv * reinvest)}</span></div>
                <div class="data-row"><span class="data-label">Delai reinvestissement</span><span class="data-value">${cfg.dirigeant.apportCession150Bter.delaiReinvestissement} mois</span></div>
                <div class="data-row highlight"><span class="data-label">IMPOT IMMEDIAT</span><span class="data-value">0 &euro;</span></div>
                <div class="data-row" style="font-size:11px;color:#6b7280;">PV taxee a la revente des titres de la holding ou apres 2 ans si reinvestissement < ${pct(reinvest)}</div>
            </div></div>
        </div>
    `);
}

// ===== PACTE DUTREIL =====
function calculateDutreil() {
    const cfg = typeof getEffectiveConfig === 'function' ? getEffectiveConfig() : CONFIG;
    const valeur = getField('dutreil_valeur');
    const nbBenef = getField('dutreil_beneficiaires') || 1;
    const type = document.querySelector('[data-field="dutreil_type"]')?.value || 'succession';
    const ageDonateur = getField('dutreil_age_donateur');

    if (valeur <= 0) return;

    const exoneration = cfg.dirigeant.pacteDutreil.exoneration;
    const valeurExoneree = valeur * exoneration;
    const valeurTaxable = valeur - valeurExoneree;

    // Droits par beneficiaire (en ligne directe)
    const abattLD = cfg.succession.ligneDirecte.abattement;
    const partParBenef = valeurTaxable / nbBenef;
    const partTaxable = Math.max(0, partParBenef - abattLD);
    const droitsParBenef = typeof calcBareme === 'function' ? calcBareme(partTaxable, cfg.succession.ligneDirecte.tranches) : 0;
    const droitsTotaux = droitsParBenef * nbBenef;

    // Sans Dutreil
    const partSansDutreil = valeur / nbBenef;
    const partTaxableSans = Math.max(0, partSansDutreil - abattLD);
    const droitsSansParBenef = typeof calcBareme === 'function' ? calcBareme(partTaxableSans, cfg.succession.ligneDirecte.tranches) : 0;
    const droitsSans = droitsSansParBenef * nbBenef;

    // Reduction donation avant 70 ans
    const reductionDonation = (type === 'donation' && ageDonateur < cfg.dirigeant.pacteDutreil.ageMaxDonation) ? cfg.dirigeant.pacteDutreil.reductionDonation : 0;
    const droitsApresReduction = droitsTotaux * (1 - reductionDonation);
    const economie = droitsSans - droitsApresReduction;

    const el = document.getElementById('dutreil-results');
    el.classList.remove('hidden');
    setHTML('dutreil-results', `
        <div class="kpi-grid">
            <div class="kpi-card kpi-green"><div class="kpi-label">Economie Dutreil</div><div class="kpi-value">${fmt(economie)}</div></div>
            <div class="kpi-card kpi-red"><div class="kpi-label">Droits sans Dutreil</div><div class="kpi-value">${fmt(droitsSans)}</div></div>
            <div class="kpi-card kpi-blue"><div class="kpi-label">Droits avec Dutreil</div><div class="kpi-value">${fmt(droitsApresReduction)}</div></div>
            <div class="kpi-card kpi-primary"><div class="kpi-label">Exoneration</div><div class="kpi-value">${pct(exoneration)}</div></div>
        </div>
        <div class="dashboard-grid">
            <div class="card"><h3>Sans Pacte Dutreil</h3><div class="data-grid">
                <div class="data-row"><span class="data-label">Valeur transmise</span><span class="data-value">${fmt(valeur)}</span></div>
                <div class="data-row"><span class="data-label">Abattement / beneficiaire</span><span class="data-value">${fmt(abattLD)}</span></div>
                <div class="data-row highlight"><span class="data-label">DROITS TOTAUX</span><span class="data-value">${fmt(droitsSans)}</span></div>
            </div></div>
            <div class="card card-highlight-green"><h3>Avec Pacte Dutreil</h3><div class="data-grid">
                <div class="data-row"><span class="data-label">Valeur transmise</span><span class="data-value">${fmt(valeur)}</span></div>
                <div class="data-row"><span class="data-label">Exoneration ${pct(exoneration)}</span><span class="data-value">-${fmt(valeurExoneree)}</span></div>
                <div class="data-row"><span class="data-label">Valeur taxable</span><span class="data-value">${fmt(valeurTaxable)}</span></div>
                <div class="data-row"><span class="data-label">Abattement / beneficiaire</span><span class="data-value">${fmt(abattLD)}</span></div>
                <div class="data-row"><span class="data-label">Droits bruts</span><span class="data-value">${fmt(droitsTotaux)}</span></div>
                ${reductionDonation > 0 ? '<div class="data-row"><span class="data-label">Reduction donation < 70 ans (-' + pct(reductionDonation) + ')</span><span class="data-value">-' + fmt(droitsTotaux * reductionDonation) + '</span></div>' : ''}
                <div class="data-row highlight"><span class="data-label">DROITS A PAYER</span><span class="data-value">${fmt(droitsApresReduction)}</span></div>
            </div></div>
        </div>
        <div class="card" style="margin-top:16px;"><h3>Conditions du Pacte Dutreil</h3><div class="data-grid">
            <div class="data-row"><span class="data-label">Engagement collectif</span><span class="data-value">${cfg.dirigeant.pacteDutreil.engagementCollectif} ans minimum</span></div>
            <div class="data-row"><span class="data-label">Engagement individuel</span><span class="data-value">${cfg.dirigeant.pacteDutreil.engagementIndividuel} ans minimum</span></div>
            <div class="data-row"><span class="data-label">Fonction de direction</span><span class="data-value">${cfg.dirigeant.pacteDutreil.dureeDirection} ans</span></div>
            <div class="data-row"><span class="data-label">Seuil detention (non cotee)</span><span class="data-value">${pct(cfg.dirigeant.pacteDutreil.seuilDetention.societeNonCotee)}</span></div>
        </div></div>
    `);
}

// ===== EPARGNE SALARIALE =====
function calculateEpargneSalariale() {
    const cfg = typeof getEffectiveConfig === 'function' ? getEffectiveConfig() : CONFIG;
    const budget = getField('es_budget');
    const type = document.querySelector('[data-field="es_type"]')?.value || 'interessement';
    const nbBenef = getField('es_beneficiaires') || 1;
    const placementPEE = document.querySelector('[data-field="es_placement_pee"]')?.value === 'oui';
    const tauxAbondement = getField('es_abondement') / 100;

    if (budget <= 0) return;

    const montantParSalarie = budget / nbBenef;

    let coutEmployeur = budget;
    let forfaitSocial = 0;
    let netSalarie = 0;
    let economieCotisations = 0;
    let exonerationIR = false;
    let label = '';

    if (type === 'interessement') {
        forfaitSocial = budget * cfg.epargneSalariale.interessement.forfaitSocialReduit;
        coutEmployeur = budget + forfaitSocial;
        netSalarie = placementPEE ? montantParSalarie : montantParSalarie * (1 - cfg.prelevementsSociaux.taux);
        exonerationIR = placementPEE;
        label = 'Interessement';
    } else if (type === 'participation') {
        forfaitSocial = budget * cfg.epargneSalariale.participation.forfaitSocial;
        coutEmployeur = budget + forfaitSocial;
        netSalarie = placementPEE ? montantParSalarie : montantParSalarie * (1 - cfg.prelevementsSociaux.taux);
        exonerationIR = placementPEE;
        label = 'Participation';
    } else if (type === 'prime_ppv') {
        forfaitSocial = 0;
        coutEmployeur = budget;
        const exoIR = cfg.epargneSalariale.primePartageValeur.exonerationIR;
        const plafond = cfg.epargneSalariale.primePartageValeur.plafondExoneration;
        netSalarie = Math.min(montantParSalarie, plafond);
        exonerationIR = exoIR;
        label = 'Prime de Partage de la Valeur';
    } else {
        // Prime classique soumise
        const chargesPatronales = 0.45;
        const chargesSalariales = 0.22;
        coutEmployeur = budget * (1 + chargesPatronales);
        netSalarie = montantParSalarie * (1 - chargesSalariales);
        exonerationIR = false;
        label = 'Prime classique';
    }

    // Comparaison prime classique
    const primeClassiqueCout = budget * 1.45;
    const primeClassiqueNet = montantParSalarie * 0.78;
    economieCotisations = primeClassiqueCout - coutEmployeur;

    // Abondement PEE
    const abondement = placementPEE ? Math.min(montantParSalarie * tauxAbondement, cfg.epargneSalariale.pee.abondementMax) : 0;

    const el = document.getElementById('es-results');
    el.classList.remove('hidden');
    setHTML('es-results', `
        <div class="kpi-grid">
            <div class="kpi-card kpi-primary"><div class="kpi-label">Cout employeur</div><div class="kpi-value">${fmt(coutEmployeur)}</div></div>
            <div class="kpi-card kpi-green"><div class="kpi-label">Net par salarie</div><div class="kpi-value">${fmt(netSalarie)}</div></div>
            <div class="kpi-card kpi-blue"><div class="kpi-label">Economie vs prime</div><div class="kpi-value">${fmt(economieCotisations)}</div></div>
            <div class="kpi-card ${exonerationIR ? 'kpi-green' : 'kpi-orange'}"><div class="kpi-label">Exoneration IR</div><div class="kpi-value">${exonerationIR ? 'Oui' : 'Non'}</div></div>
        </div>
        <div class="dashboard-grid">
            <div class="card card-highlight-green"><h3>${label}</h3><div class="data-grid">
                <div class="data-row"><span class="data-label">Budget brut</span><span class="data-value">${fmt(budget)}</span></div>
                <div class="data-row"><span class="data-label">Forfait social</span><span class="data-value">${fmt(forfaitSocial)}</span></div>
                <div class="data-row"><span class="data-label">Cout total employeur</span><span class="data-value">${fmt(coutEmployeur)}</span></div>
                <div class="data-row"><span class="data-label">Montant par salarie</span><span class="data-value">${fmt(montantParSalarie)}</span></div>
                <div class="data-row"><span class="data-label">Net percu par salarie</span><span class="data-value">${fmt(netSalarie)}</span></div>
                ${placementPEE ? '<div class="data-row"><span class="data-label">Abondement PEE / salarie</span><span class="data-value">' + fmt(abondement) + '</span></div>' : ''}
                <div class="data-row"><span class="data-label">Exoneration IR</span><span class="data-value">${exonerationIR ? 'Oui (si placement PEE 5 ans)' : 'Non'}</span></div>
            </div></div>
            <div class="card"><h3>Comparaison — Prime classique</h3><div class="data-grid">
                <div class="data-row"><span class="data-label">Meme budget brut</span><span class="data-value">${fmt(budget)}</span></div>
                <div class="data-row"><span class="data-label">Charges patronales (~45%)</span><span class="data-value">${fmt(budget * 0.45)}</span></div>
                <div class="data-row"><span class="data-label">Cout total employeur</span><span class="data-value">${fmt(primeClassiqueCout)}</span></div>
                <div class="data-row"><span class="data-label">Net par salarie (apres charges + IR)</span><span class="data-value">${fmt(primeClassiqueNet)}</span></div>
                <div class="data-row highlight"><span class="data-label">ECONOMIE EMPLOYEUR</span><span class="data-value">${fmt(economieCotisations)}</span></div>
                <div class="data-row highlight"><span class="data-label">GAIN NET SALARIE</span><span class="data-value">+${fmt(netSalarie - primeClassiqueNet)}</span></div>
            </div></div>
        </div>
    `);
}

// ===== PER DIRIGEANT =====
function calculatePERDirigeant() {
    const cfg = typeof getEffectiveConfig === 'function' ? getEffectiveConfig() : CONFIG;
    const revenu = getField('per_revenu');
    const tmi = parseFloat(document.querySelector('[data-field="per_tmi"]')?.value) || 0.30;
    const versement = getField('per_versement');
    const plafondN1 = getField('per_plafond_n1');
    const plafondN2 = getField('per_plafond_n2');
    const plafondN3 = getField('per_plafond_n3');
    const horizon = getField('per_horizon') || 15;
    const profil = document.querySelector('[data-field="per_profil"]')?.value || 'equilibre';

    if (versement <= 0) return;

    // Plafond de deduction
    const plafondAnnuel = Math.min(revenu * cfg.per.plafondDeduction.tauxRevenus, cfg.per.plafondDeduction.plafondAbsolu);
    const plafondEffectif = Math.max(plafondAnnuel, cfg.per.plafondDeduction.plancher);
    const plafondTotal = plafondEffectif + plafondN1 + plafondN2 + plafondN3;
    const versementDeductible = Math.min(versement, plafondTotal);
    const economieIR = versementDeductible * tmi;

    // Projection du capital
    const rdt = cfg.per.rendements[profil] || 0.045;
    let capital = 0;
    for (let i = 0; i < horizon; i++) {
        capital = (capital + versement) * (1 + rdt);
    }
    const totalVerse = versement * horizon;
    const gains = capital - totalVerse;
    const totalEconomieIR = economieIR * horizon;

    const el = document.getElementById('per-results');
    el.classList.remove('hidden');
    setHTML('per-results', `
        <div class="kpi-grid">
            <div class="kpi-card kpi-green"><div class="kpi-label">Economie IR / an</div><div class="kpi-value">${fmt(economieIR)}</div></div>
            <div class="kpi-card kpi-primary"><div class="kpi-label">Capital projete</div><div class="kpi-value">${fmt(capital)}</div></div>
            <div class="kpi-card kpi-blue"><div class="kpi-label">Total economie IR</div><div class="kpi-value">${fmt(totalEconomieIR)}</div></div>
            <div class="kpi-card kpi-orange"><div class="kpi-label">Rendement (${profil})</div><div class="kpi-value">${pct(rdt)}</div></div>
        </div>
        <div class="dashboard-grid">
            <div class="card"><h3>Deductibilite</h3><div class="data-grid">
                <div class="data-row"><span class="data-label">Revenu net imposable</span><span class="data-value">${fmt(revenu)}</span></div>
                <div class="data-row"><span class="data-label">TMI</span><span class="data-value">${pct(tmi)}</span></div>
                <div class="data-row"><span class="data-label">Plafond annuel (10% revenus)</span><span class="data-value">${fmt(plafondAnnuel)}</span></div>
                <div class="data-row"><span class="data-label">Reports N-1/N-2/N-3</span><span class="data-value">${fmt(plafondN1 + plafondN2 + plafondN3)}</span></div>
                <div class="data-row"><span class="data-label">Plafond total disponible</span><span class="data-value">${fmt(plafondTotal)}</span></div>
                <div class="data-row"><span class="data-label">Versement deductible</span><span class="data-value">${fmt(versementDeductible)}</span></div>
                <div class="data-row highlight"><span class="data-label">ECONOMIE IR ANNUELLE</span><span class="data-value">${fmt(economieIR)}</span></div>
            </div></div>
            <div class="card"><h3>Projection a ${horizon} ans</h3><div class="data-grid">
                <div class="data-row"><span class="data-label">Versement annuel</span><span class="data-value">${fmt(versement)}</span></div>
                <div class="data-row"><span class="data-label">Total verse</span><span class="data-value">${fmt(totalVerse)}</span></div>
                <div class="data-row"><span class="data-label">Rendement annuel (${profil})</span><span class="data-value">${pct(rdt)}</span></div>
                <div class="data-row"><span class="data-label">Gains estimes</span><span class="data-value">${fmt(gains)}</span></div>
                <div class="data-row highlight"><span class="data-label">CAPITAL PROJETE</span><span class="data-value">${fmt(capital)}</span></div>
                <div class="data-row highlight"><span class="data-label">TOTAL ECONOMIE IR</span><span class="data-value">${fmt(totalEconomieIR)}</span></div>
            </div></div>
        </div>
        <div class="card" style="margin-top:16px;"><h3>Sortie du PER</h3><div class="data-grid">
            <div class="data-row"><span class="data-label">Sortie en capital (versements)</span><span class="data-value">Soumis au bareme IR</span></div>
            <div class="data-row"><span class="data-label">Sortie en capital (gains)</span><span class="data-value">PFU ${pct(cfg.per.sortieCapital.gains)}</span></div>
            <div class="data-row"><span class="data-label">Sortie en rente</span><span class="data-value">Regime des rentes</span></div>
            <div class="data-row" style="font-size:11px;color:#6b7280;">Le PER est debloquable a la retraite ou pour l'achat de la residence principale</div>
        </div></div>
    `);
}

// ===== LIVE FORM UPDATES =====
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-field]').forEach(el => {
        el.addEventListener('input', () => {
            recalcAll();
        });
    });
    // Init dirigeant visibility
    toggleDirigeantSection();
});
