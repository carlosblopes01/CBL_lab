// =============================================================================
// PATRIA CAPITAL — Scoring Patrimonial V3
// =============================================================================
// Score global /100 + 6 sous-scores detailles + alertes intelligentes
// + plan d'action + synthese narrative
// Compatible avec engine.js : calculatePatrimonialScore(data) entry point
// =============================================================================

const SCORING = {

    // ===== WEIGHT CONFIGURATION (total = 100) =====
    weights: {
        diversification: 20,
        liquidite: 15,
        adequationRisque: 20,
        solidite: 15,
        transmission: 15,
        optimisation: 15
    },

    // ===== BACKWARD-COMPATIBLE KEY MAPPING =====
    // Maps new internal keys to old keys consumed by engine.js PDF export
    legacyMapping: {
        diversification: 'diversification',
        liquidite: 'liquidite',
        adequationRisque: 'risque',
        solidite: 'coherence',
        transmission: 'structuration',
        optimisation: 'fiscalite'
    },

    // ===== THRESHOLDS =====
    thresholds: {
        immoPctMax: 0.70,
        liquiditePctMin: 0.05,
        liquiditePctMax: 0.30,
        endettementMax: 0.40,
        endettementCritique: 0.33,
        concentrationMax: 0.40,
        concentrationCritique: 0.60,
        epargneMinPct: 0.10,
        emergencyMonths: 6,
        transmissionPatriSeuil: 500000,
        avAbattement: 152500
    },

    // ===== SCORE LEVELS =====
    levels: [
        { max: 30, label: 'Critique', color: '#dc3545' },
        { max: 50, label: 'Faible',   color: '#e06050' },
        { max: 70, label: 'Moyen',    color: '#e8a838' },
        { max: 85, label: 'Bon',      color: '#6aab5e' },
        { max: 101, label: 'Excellent', color: '#28a745' }
    ],

    // ===== RISK PROFILE THRESHOLDS =====
    // pctSafe = fonds euros + livrets + PEL, pctDynamic = actions + PEA + CTO + PE
    riskProfiles: {
        securitaire: { safeMin: 0.70, safeMax: 1.00, dynMin: 0.00, dynMax: 0.10 },
        prudent:     { safeMin: 0.50, safeMax: 0.70, dynMin: 0.00, dynMax: 0.20 },
        equilibre:   { safeMin: 0.30, safeMax: 0.50, dynMin: 0.20, dynMax: 0.40 },
        dynamique:   { safeMin: 0.15, safeMax: 0.35, dynMin: 0.35, dynMax: 0.55 },
        offensif:    { safeMin: 0.00, safeMax: 0.20, dynMin: 0.50, dynMax: 1.00 }
    },

    // ===== ALERT DEFINITIONS =====
    alertTypes: {
        critical: { label: 'Critique', color: '#dc3545', icon: '\u26A0\uFE0F', priority: 1 },
        warning:  { label: 'Attention', color: '#e8a838', icon: '\u26A1', priority: 2 },
        info:     { label: 'Opportunit\u00e9', color: '#c1925e', icon: '\uD83D\uDCA1', priority: 3 },
        success:  { label: 'Acquis', color: '#28a745', icon: '\u2713', priority: 4 }
    }
};


// =============================================================================
// HELPERS
// =============================================================================

/**
 * Clamp a value between 0 and 100
 */
function clampScore(v) {
    return Math.max(0, Math.min(100, Math.round(v)));
}

/**
 * Get level object for a given score
 */
function getScoreLevel(score) {
    for (var i = 0; i < SCORING.levels.length; i++) {
        if (score < SCORING.levels[i].max) return SCORING.levels[i];
    }
    return SCORING.levels[SCORING.levels.length - 1];
}

/**
 * Normalize a profile string to a clean lowercase key
 */
function normalizeProfile(raw) {
    if (!raw) return 'equilibre';
    var s = raw.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z]/g, '');
    if (s.indexOf('securitaire') >= 0) return 'securitaire';
    if (s.indexOf('prudent') >= 0) return 'prudent';
    if (s.indexOf('equilibre') >= 0) return 'equilibre';
    if (s.indexOf('dynamique') >= 0) return 'dynamique';
    if (s.indexOf('offensif') >= 0) return 'offensif';
    return 'equilibre';
}

/**
 * Format a number as Euro currency
 */
function formatEuro(n) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency', currency: 'EUR',
        minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(n);
}

/**
 * Build a score detail object
 */
function makeScoreDetail(value, explanation, recommendations) {
    var v = clampScore(value);
    var level = getScoreLevel(v);
    return {
        value: v,
        level: level.label,
        color: level.color,
        explanation: explanation || '',
        recommendations: recommendations || []
    };
}


// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

function calculatePatrimonialScore(data) {
    if (!data) data = typeof collectFormData === 'function' ? collectFormData() : {};

    var cfg = typeof getEffectiveConfig === 'function' ? getEffectiveConfig() : (typeof CONFIG !== 'undefined' ? CONFIG : {});

    // =========================================================================
    // GATHER ALL METRICS
    // =========================================================================
    var totalRevenusClient = (data.salairesClient || 0) + (data.revenusBIC || 0)
        + (data.dividendes || 0) + (data.revenusFonciers || 0)
        + (data.pensions || 0) + (data.autresRevenus || 0);
    var totalRevenusConjoint = data.salairesConjoint || 0;
    var totalRevenus = totalRevenusClient + totalRevenusConjoint;
    var revenusMensuels = totalRevenus / 12;

    var totalCharges = (data.loyer || 0) + (data.creditRP || 0)
        + (data.creditLocatif || 0) + (data.creditConso || 0)
        + (data.pensionAlim || 0) + (data.autresCharges || 0);
    var capaciteEpargne = revenusMensuels - totalCharges;
    var tauxEpargne = totalRevenus > 0 ? (capaciteEpargne * 12) / totalRevenus : 0;
    var epargneMensuelle = data.epargneMensuelle || 0;

    // Immobilier
    var immoRP = data.immoRP || 0;
    var immoRS = data.immoRS || 0;
    var immoLoc1 = data.immoLoc1 || 0;
    var immoLoc2 = data.immoLoc2 || 0;
    var immoSCPI = data.immoSCPI || 0;
    var immoPro = data.immoPro || 0;
    var immoAutres = data.immoAutres || 0;
    var totalImmo = immoRP + immoRS + immoLoc1 + immoLoc2 + immoSCPI + immoPro + immoAutres;

    // Financier
    var livrets = data.livrets || 0;
    var pel = data.pel || 0;
    var assuranceVie = data.assuranceVie || 0;
    var pea = data.pea || 0;
    var cto = data.cto || 0;
    var per = data.per || 0;
    var epargneSalariale = data.epargneSalariale || 0;
    var autresPlacement = data.autresPlacement || 0;
    var totalFin = livrets + pel + assuranceVie + pea + cto + per + epargneSalariale + autresPlacement;

    // Liquidites (supports immediatement disponibles)
    var liquidites = livrets + pel + (data.compteCourant || 0);

    // Dettes
    var dettes = (data.capitalRestantRP || 0) + (data.immoRP_creditRestant || 0)
        + (data.immoRS_creditRestant || 0) + (data.immoLoc1_creditRestant || 0)
        + (data.immoLoc2_creditRestant || 0);

    var patriBrut = totalImmo + totalFin;
    var patriNet = patriBrut - dettes;

    // Ratios
    var pctImmo = patriBrut > 0 ? totalImmo / patriBrut : 0;
    var pctFin = patriBrut > 0 ? totalFin / patriBrut : 0;
    var pctLiquidites = patriBrut > 0 ? liquidites / patriBrut : 0;
    var tauxEndettement = patriBrut > 0 ? dettes / patriBrut : 0;

    // Enveloppes fiscales
    var enveloppeFiscale = assuranceVie + pea + per;
    var pctEnveloppeFiscale = totalFin > 0 ? enveloppeFiscale / totalFin : 0;

    // Profile
    var tmi = parseFloat(data.tmi) || 0;
    var profil = normalizeProfile(data.profilRisque);
    var profilRaw = data.profilRisque || '';
    var objectif = data.objectifPrincipal || '';
    var horizon = parseInt(data.horizonAnnees) || 8;
    var age = data.dateNaissance
        ? Math.floor((Date.now() - new Date(data.dateNaissance).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : 40;
    var nbEnfants = parseInt(data.nbEnfants) || 0;
    var enfantsCharge = parseInt(data.enfantsCharge) || 0;
    var situationMatri = data.situationMatri || '';
    var statutPro = data.statutPro || '';
    var testament = data.testament || 'Non';
    var testamentOui = (testament === 'Oui');
    var donationRealisee = data.donationRealisee || 'Non';
    var donationOui = (donationRealisee === 'Oui');
    var prevoyance = data.prevoyance || '';
    var preoccSucc = data.preoccSucc || '';

    // New optional fields (graceful defaults)
    var tolerancePerte = data.tolerancePerte || '';
    var experienceFinanciere = data.experienceFinanciere || '';
    var clauseBeneficiaireAV = data.clauseBeneficiaireAV || '';
    var mandatProtection = data.mandatProtection || 'Non';
    var avDateOuverture = data.avDateOuverture || '';
    var peaDateOuverture = data.peaDateOuverture || '';
    var perDateOuverture = data.perDateOuverture || '';
    var demembrementEnPlace = data.demembrementEnPlace || 'Non';
    var regimeFoncier = data.regimeFoncier || '';

    // Safe / Moderate / Dynamic allocation breakdown (for risk adequacy)
    // Safe = livrets + PEL + fonds euros portion of AV (assume 60% of AV if no detail)
    var avFondsEuros = data.avFondsEuros || (assuranceVie * 0.6);
    var avUC = data.avUC || (assuranceVie * 0.4);
    var pctSafe = totalFin > 0 ? (livrets + pel + avFondsEuros) / totalFin : 1;
    var pctModerate = totalFin > 0 ? (avUC + (epargneSalariale * 0.5) + per * 0.5) / totalFin : 0;
    var pctDynamic = totalFin > 0 ? (pea + cto + (epargneSalariale * 0.5) + per * 0.5 + (autresPlacement * 0.5)) / totalFin : 0;
    // Normalize to sum=1
    var pctTotal = pctSafe + pctModerate + pctDynamic;
    if (pctTotal > 0) { pctSafe /= pctTotal; pctModerate /= pctTotal; pctDynamic /= pctTotal; }

    // Metrics bundle
    var m = {
        totalRevenus: totalRevenus, revenusMensuels: revenusMensuels,
        totalCharges: totalCharges, capaciteEpargne: capaciteEpargne,
        tauxEpargne: tauxEpargne, epargneMensuelle: epargneMensuelle,
        totalImmo: totalImmo, totalFin: totalFin, liquidites: liquidites,
        dettes: dettes, patriBrut: patriBrut, patriNet: patriNet,
        pctImmo: pctImmo, pctFin: pctFin, pctLiquidites: pctLiquidites,
        tauxEndettement: tauxEndettement,
        enveloppeFiscale: enveloppeFiscale, pctEnveloppeFiscale: pctEnveloppeFiscale,
        tmi: tmi, profil: profil, profilRaw: profilRaw, objectif: objectif,
        horizon: horizon, age: age, nbEnfants: nbEnfants, enfantsCharge: enfantsCharge,
        situationMatri: situationMatri, statutPro: statutPro,
        testamentOui: testamentOui, donationOui: donationOui,
        prevoyance: prevoyance, preoccSucc: preoccSucc,
        pctSafe: pctSafe, pctModerate: pctModerate, pctDynamic: pctDynamic,
        immoRP: immoRP, immoRS: immoRS, immoLoc1: immoLoc1, immoLoc2: immoLoc2,
        immoSCPI: immoSCPI, immoPro: immoPro, immoAutres: immoAutres,
        livrets: livrets, pel: pel, assuranceVie: assuranceVie, pea: pea,
        cto: cto, per: per, epargneSalariale: epargneSalariale,
        autresPlacement: autresPlacement,
        tolerancePerte: tolerancePerte, experienceFinanciere: experienceFinanciere,
        clauseBeneficiaireAV: clauseBeneficiaireAV, mandatProtection: mandatProtection,
        avDateOuverture: avDateOuverture, peaDateOuverture: peaDateOuverture,
        perDateOuverture: perDateOuverture, demembrementEnPlace: demembrementEnPlace,
        regimeFoncier: regimeFoncier
    };

    // =========================================================================
    // CALCULATE 6 DETAILED SCORES
    // =========================================================================
    var scoreDetails = {};
    scoreDetails.diversification = calcScoreDiversification(m, data);
    scoreDetails.liquidite = calcScoreLiquidite(m, data);
    scoreDetails.adequationRisque = calcScoreAdequationRisque(m, data);
    scoreDetails.solidite = calcScoreSolidite(m, data);
    scoreDetails.transmission = calcScoreTransmission(m, data);
    scoreDetails.optimisation = calcScoreOptimisation(m, data);

    // =========================================================================
    // GLOBAL SCORE (weighted average)
    // =========================================================================
    var totalWeight = 0;
    var weightedSum = 0;
    for (var key in SCORING.weights) {
        if (scoreDetails[key]) {
            weightedSum += scoreDetails[key].value * SCORING.weights[key];
            totalWeight += SCORING.weights[key];
        }
    }
    var globalScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

    // =========================================================================
    // BUILD BACKWARD-COMPATIBLE scores object (numeric values for engine.js PDF)
    // =========================================================================
    var scores = {};
    for (var sk in SCORING.legacyMapping) {
        var legacyKey = SCORING.legacyMapping[sk];
        if (scoreDetails[sk]) {
            scores[legacyKey] = scoreDetails[sk].value;
        }
    }

    // =========================================================================
    // ALERTS
    // =========================================================================
    var alerts = generateAlerts(data, scoreDetails, m);

    // =========================================================================
    // ACTION PLAN
    // =========================================================================
    var actions = generateActionPlan(data, scoreDetails, alerts, m);

    // =========================================================================
    // NARRATIVE SYNTHESIS
    // =========================================================================
    var narrative = generateNarrativeSynthesis(data, scoreDetails, m, alerts);

    // =========================================================================
    // RETURN (compatible with engine.js expectations)
    // =========================================================================
    return {
        global: globalScore,
        scores: scores,                // backward-compatible numeric map
        scoreDetails: scoreDetails,    // new detailed score objects
        alerts: alerts,
        actions: actions,
        narrative: narrative,
        metrics: {
            patriNet: patriNet, patriBrut: patriBrut,
            totalImmo: totalImmo, totalFin: totalFin,
            pctImmo: pctImmo, pctFin: pctFin,
            pctLiquidites: pctLiquidites, tauxEndettement: tauxEndettement,
            tauxEpargne: tauxEpargne, tmi: tmi
        }
    };
}


// =============================================================================
// 1. SCORE DE DIVERSIFICATION (weight: 20%)
// =============================================================================

function calcScoreDiversification(m, data) {
    var score = 0;
    var recs = [];

    // --- A. Balance immo / financier / liquidites (40 pts max) ---
    // Optimal: 25-35% immo, 45-55% financier, 10-20% liquidites
    var balanceScore = 0;

    // Immobilier balance
    if (m.pctImmo >= 0.25 && m.pctImmo <= 0.35) balanceScore += 15;
    else if (m.pctImmo >= 0.20 && m.pctImmo <= 0.45) balanceScore += 10;
    else if (m.pctImmo >= 0.15 && m.pctImmo <= 0.55) balanceScore += 5;
    else if (m.pctImmo > 0.70) { balanceScore -= 5; recs.push('R\u00e9\u00e9quilibrer le patrimoine : ' + Math.round(m.pctImmo * 100) + '% en immobilier d\u00e9passe largement la cible de 25-35%.'); }
    else if (m.pctImmo > 0.55) recs.push('La part immobili\u00e8re (' + Math.round(m.pctImmo * 100) + '%) est au-dessus de l\u2019optimum. Envisager une diversification vers le financier.');

    // Financier balance
    if (m.pctFin >= 0.45 && m.pctFin <= 0.55) balanceScore += 15;
    else if (m.pctFin >= 0.35 && m.pctFin <= 0.65) balanceScore += 10;
    else if (m.pctFin >= 0.20 && m.pctFin <= 0.75) balanceScore += 5;

    // Liquidites balance
    if (m.pctLiquidites >= 0.10 && m.pctLiquidites <= 0.20) balanceScore += 10;
    else if (m.pctLiquidites >= 0.05 && m.pctLiquidites <= 0.25) balanceScore += 5;
    else if (m.pctLiquidites > 0.30) { balanceScore -= 5; }

    score += Math.max(0, balanceScore);

    // --- B. Number of asset classes held (25 pts max) ---
    var classes = 0;
    if (m.totalImmo > 0) classes++;
    if (m.assuranceVie > 0) classes++;
    if (m.pea > 0) classes++;
    if (m.cto > 0) classes++;
    if (m.per > 0) classes++;
    if (m.immoSCPI > 0) classes++;
    if (m.epargneSalariale > 0) classes++;
    if (m.livrets > 0 || m.pel > 0) classes++;
    if (m.autresPlacement > 0) classes++;

    if (classes >= 6) score += 25;
    else if (classes >= 5) score += 20;
    else if (classes >= 4) score += 15;
    else if (classes >= 3) score += 10;
    else if (classes >= 2) score += 5;
    else { score += 0; recs.push('Diversifier les classes d\u2019actifs : un seul type de placement d\u00e9tenu.'); }

    // --- C. Concentration risk (20 pts max, penalties) ---
    var concentrationScore = 20;
    var assets = [m.immoRP, m.immoRS, m.immoLoc1, m.immoLoc2, m.immoSCPI, m.immoPro, m.immoAutres,
                  m.livrets, m.pel, m.assuranceVie, m.pea, m.cto, m.per, m.epargneSalariale, m.autresPlacement];
    var maxAsset = 0;
    for (var i = 0; i < assets.length; i++) { if (assets[i] > maxAsset) maxAsset = assets[i]; }
    var pctMaxAsset = m.patriBrut > 0 ? maxAsset / m.patriBrut : 0;

    if (pctMaxAsset > 0.60) {
        concentrationScore -= 20;
        recs.push('Concentration critique : un seul actif repr\u00e9sente ' + Math.round(pctMaxAsset * 100) + '% du patrimoine. Diversification urgente.');
    } else if (pctMaxAsset > 0.40) {
        concentrationScore -= 10;
        if (recs.length < 3) recs.push('Un actif concentre ' + Math.round(pctMaxAsset * 100) + '% du patrimoine. Envisager un r\u00e9\u00e9quilibrage.');
    }
    score += Math.max(0, concentrationScore);

    // --- D. Geographic / type diversification for real estate (15 pts max) ---
    var geoScore = 0;
    var nbImmoTypes = 0;
    if (m.immoRP > 0) nbImmoTypes++;
    if (m.immoRS > 0) nbImmoTypes++;
    if (m.immoLoc1 > 0 || m.immoLoc2 > 0) nbImmoTypes++;
    if (m.immoSCPI > 0) nbImmoTypes++;
    if (m.immoPro > 0) nbImmoTypes++;

    if (nbImmoTypes >= 3) geoScore = 15;
    else if (nbImmoTypes >= 2) geoScore = 10;
    else if (nbImmoTypes === 1) geoScore = 5;
    score += geoScore;

    var explanation = 'Votre patrimoine est r\u00e9parti entre ' + classes + ' classes d\u2019actifs';
    if (m.pctImmo > 0.60) explanation += ', avec une surexposition immobili\u00e8re notable (' + Math.round(m.pctImmo * 100) + '%).';
    else if (m.pctImmo >= 0.25 && m.pctImmo <= 0.45) explanation += ', avec un bon \u00e9quilibre immobilier/financier.';
    else explanation += '.';

    return makeScoreDetail(score, explanation, recs.slice(0, 3));
}


// =============================================================================
// 2. SCORE DE LIQUIDITE (weight: 15%)
// =============================================================================

function calcScoreLiquidite(m, data) {
    var score = 0;
    var recs = [];

    // --- A. Liquid assets as % of total patrimoine (30 pts max) ---
    // Optimal: 10-20%
    if (m.pctLiquidites >= 0.10 && m.pctLiquidites <= 0.20) score += 30;
    else if (m.pctLiquidites >= 0.05 && m.pctLiquidites <= 0.25) score += 20;
    else if (m.pctLiquidites >= 0.03 && m.pctLiquidites < 0.05) {
        score += 10;
        recs.push('Liquidit\u00e9s insuffisantes (' + Math.round(m.pctLiquidites * 100) + '%). Constituer une \u00e9pargne de pr\u00e9caution d\u2019au moins 10% du patrimoine.');
    } else if (m.pctLiquidites < 0.03) {
        score += 0;
        recs.push('Liquidit\u00e9s critiquement basses (' + Math.round(m.pctLiquidites * 100) + '%). Priorit\u00e9 : constituer un fonds d\u2019urgence.');
    } else if (m.pctLiquidites > 0.30) {
        score += 10;
        recs.push('Sur-liquidit\u00e9 d\u00e9tect\u00e9e (' + Math.round(m.pctLiquidites * 100) + '%). R\u00e9allouer l\u2019exc\u00e9dent vers des supports plus performants.');
    } else {
        score += 15; // 25-30%
    }

    // --- B. Emergency fund: livrets >= 6 months of charges (30 pts max) ---
    var emergencyTarget = m.totalCharges * SCORING.thresholds.emergencyMonths;
    var emergencyRatio = emergencyTarget > 0 ? m.livrets / emergencyTarget : (m.livrets > 0 ? 2 : 0);

    if (emergencyRatio >= 1.0) score += 30;
    else if (emergencyRatio >= 0.75) score += 20;
    else if (emergencyRatio >= 0.50) {
        score += 10;
        if (recs.length < 3) recs.push('Fonds d\u2019urgence couvre ' + Math.round(emergencyRatio * SCORING.thresholds.emergencyMonths) + ' mois de charges. Viser au moins 6 mois (' + formatEuro(emergencyTarget) + ').');
    } else {
        score += 0;
        if (recs.length < 3) recs.push('\u00c9pargne de pr\u00e9caution insuffisante : seulement ' + Math.round(emergencyRatio * SCORING.thresholds.emergencyMonths) + ' mois de charges couverts sur 6 recommand\u00e9s.');
    }

    // --- C. Monthly savings rate (20 pts max) ---
    // Optimal: >15%
    if (m.tauxEpargne >= 0.20) score += 20;
    else if (m.tauxEpargne >= 0.15) score += 15;
    else if (m.tauxEpargne >= 0.10) score += 10;
    else if (m.tauxEpargne >= 0.05) score += 5;
    else if (m.tauxEpargne > 0) score += 2;
    else {
        score += 0;
        if (recs.length < 3) recs.push('Taux d\u2019\u00e9pargne n\u00e9gatif ou nul. Revoir la structure de charges pour d\u00e9gager de la capacit\u00e9 d\u2019\u00e9pargne.');
    }

    // --- D. Cash drag detection: too much in livrets = penalty (20 pts max, penalty) ---
    var cashDragScore = 20;
    var tresoImproductive = m.patriBrut > 0 ? m.liquidites / m.patriBrut : 0;
    if (tresoImproductive > 0.40) {
        cashDragScore -= 20;
        if (recs.length < 3) recs.push('Cash drag important : ' + Math.round(tresoImproductive * 100) + '% du patrimoine en liquidit\u00e9s improductives. R\u00e9allouer vers AV fonds euros, PEA ou PER.');
    } else if (tresoImproductive > 0.30) {
        cashDragScore -= 15;
    } else if (tresoImproductive > 0.20) {
        cashDragScore -= 8;
    } else if (tresoImproductive > 0.15) {
        cashDragScore -= 3;
    }
    score += Math.max(0, cashDragScore);

    var explanation = 'Taux d\u2019\u00e9pargne de ' + Math.round(m.tauxEpargne * 100) + '%, liquidit\u00e9s \u00e0 ' + Math.round(m.pctLiquidites * 100) + '% du patrimoine';
    if (emergencyRatio >= 1) explanation += ', fonds d\u2019urgence correctement constitu\u00e9.';
    else explanation += ', fonds d\u2019urgence insuffisant.';

    return makeScoreDetail(score, explanation, recs.slice(0, 3));
}


// =============================================================================
// 3. SCORE D'ADEQUATION RISQUE (weight: 20%)
// =============================================================================

function calcScoreAdequationRisque(m, data) {
    var score = 0;
    var recs = [];

    var profileThresholds = SCORING.riskProfiles[m.profil] || SCORING.riskProfiles.equilibre;

    // --- A. Compare declared profile vs actual allocation (50 pts max) ---
    var allocScore = 50;

    // Check safe allocation vs expected range
    var safeDelta = 0;
    if (m.pctSafe < profileThresholds.safeMin) {
        safeDelta = profileThresholds.safeMin - m.pctSafe;
    } else if (m.pctSafe > profileThresholds.safeMax) {
        safeDelta = m.pctSafe - profileThresholds.safeMax;
    }

    // Check dynamic allocation vs expected range
    var dynDelta = 0;
    if (m.pctDynamic < profileThresholds.dynMin) {
        dynDelta = profileThresholds.dynMin - m.pctDynamic;
    } else if (m.pctDynamic > profileThresholds.dynMax) {
        dynDelta = m.pctDynamic - profileThresholds.dynMax;
    }

    var totalDelta = safeDelta + dynDelta;
    if (totalDelta === 0) allocScore = 50;
    else if (totalDelta < 0.10) allocScore = 40;
    else if (totalDelta < 0.20) allocScore = 25;
    else if (totalDelta < 0.35) allocScore = 10;
    else allocScore = 0;

    if (totalDelta >= 0.15) {
        recs.push('Allocation r\u00e9elle en d\u00e9calage avec le profil ' + m.profil + '. Ajuster la r\u00e9partition s\u00e9curitaire/dynamique.');
    }

    score += allocScore;

    // --- B. Tolerance a la perte vs actual exposure (25 pts max) ---
    var toleranceScore = 15; // default if field not available
    if (m.tolerancePerte) {
        var tolNorm = m.tolerancePerte.toLowerCase();
        var maxAcceptableDynamic = 0.20;
        if (tolNorm.indexOf('5') >= 0 || tolNorm.indexOf('faible') >= 0) maxAcceptableDynamic = 0.15;
        else if (tolNorm.indexOf('10') >= 0 || tolNorm.indexOf('moder') >= 0) maxAcceptableDynamic = 0.35;
        else if (tolNorm.indexOf('20') >= 0 || tolNorm.indexOf('elev') >= 0) maxAcceptableDynamic = 0.55;
        else if (tolNorm.indexOf('30') >= 0 || tolNorm.indexOf('tres') >= 0) maxAcceptableDynamic = 0.75;

        if (m.pctDynamic <= maxAcceptableDynamic) toleranceScore = 25;
        else if (m.pctDynamic <= maxAcceptableDynamic + 0.10) toleranceScore = 15;
        else {
            toleranceScore = 5;
            if (recs.length < 3) recs.push('Exposition dynamique sup\u00e9rieure \u00e0 votre tol\u00e9rance aux pertes. Risque de d\u00e9cisions \u00e9motionnelles en cas de baisse.');
        }
    }
    score += toleranceScore;

    // --- C. Experience financiere vs product complexity (25 pts max) ---
    var expScore = 15; // default if field not available
    if (m.experienceFinanciere) {
        var expNorm = m.experienceFinanciere.toLowerCase();
        var hasComplexProducts = (m.cto > 0 || m.pea > 0 || m.autresPlacement > 0);

        if (expNorm.indexOf('expert') >= 0 || expNorm.indexOf('confirm') >= 0) {
            expScore = 25;
        } else if (expNorm.indexOf('intermediaire') >= 0 || expNorm.indexOf('moyen') >= 0) {
            expScore = hasComplexProducts ? 15 : 20;
        } else if (expNorm.indexOf('debutant') >= 0 || expNorm.indexOf('aucune') >= 0) {
            expScore = hasComplexProducts ? 5 : 15;
            if (hasComplexProducts && recs.length < 3) recs.push('Produits financiers complexes d\u00e9tenus avec une exp\u00e9rience limit\u00e9e. Envisager un accompagnement professionnel.');
        }
    }
    score += expScore;

    var explanation = 'Profil d\u00e9clar\u00e9 ' + m.profil + ' avec ' + Math.round(m.pctSafe * 100) + '% en s\u00e9curitaire et ' + Math.round(m.pctDynamic * 100) + '% en dynamique.';
    if (totalDelta < 0.10) explanation += ' Bonne ad\u00e9quation.';
    else explanation += ' D\u00e9calage d\u00e9tect\u00e9.';

    return makeScoreDetail(score, explanation, recs.slice(0, 3));
}


// =============================================================================
// 4. SCORE DE SOLIDITE PATRIMONIALE (weight: 15%)
// =============================================================================

function calcScoreSolidite(m, data) {
    var score = 0;
    var recs = [];

    // --- A. Taux d'endettement (30 pts max) ---
    if (m.tauxEndettement === 0 && m.patriBrut > 0) score += 25; // No debt with assets = good but slightly less (no leverage)
    else if (m.tauxEndettement <= 0.20) score += 30;
    else if (m.tauxEndettement <= 0.33) score += 20;
    else if (m.tauxEndettement <= 0.40) {
        score += 10;
        recs.push('Taux d\u2019endettement de ' + Math.round(m.tauxEndettement * 100) + '%. Vigilance requise, seuil de confort \u00e0 33%.');
    } else {
        score += 0;
        recs.push('Endettement critique \u00e0 ' + Math.round(m.tauxEndettement * 100) + '%. Prioriser le d\u00e9sendettement.');
    }

    // --- B. Reste a vivre ratio (25 pts max) ---
    var resteAVivre = m.capaciteEpargne; // monthly
    var ravRatio = m.revenusMensuels > 0 ? resteAVivre / m.revenusMensuels : 0;

    if (ravRatio >= 0.30) score += 25;
    else if (ravRatio >= 0.20) score += 20;
    else if (ravRatio >= 0.10) score += 12;
    else if (ravRatio >= 0) score += 5;
    else {
        score += 0;
        if (recs.length < 3) recs.push('Reste \u00e0 vivre n\u00e9gatif. Revoir la structure de charges imm\u00e9diatement.');
    }

    // --- C. Patrimoine net / age ratio - wealth accumulation pace (20 pts max) ---
    // Simple heuristic: patriNet should be roughly age * revenus_annuels * facteur
    // At 30: 0.5x annual income, at 40: 2x, at 50: 4x, at 60: 6x
    var targetMultiple = Math.max(0, (m.age - 25) * 0.15);
    var actualMultiple = m.totalRevenus > 0 ? m.patriNet / m.totalRevenus : 0;

    if (actualMultiple >= targetMultiple) score += 20;
    else if (actualMultiple >= targetMultiple * 0.70) score += 15;
    else if (actualMultiple >= targetMultiple * 0.40) score += 8;
    else {
        score += 3;
        if (recs.length < 3) recs.push('Rythme d\u2019accumulation patrimoniale en dessous des rep\u00e8res pour votre \u00e2ge. Maximiser l\u2019\u00e9pargne et investir r\u00e9guli\u00e8rement.');
    }

    // --- D. Diversification des sources de revenus (10 pts max) ---
    var nbSources = 0;
    if ((data.salairesClient || 0) > 0) nbSources++;
    if ((data.salairesConjoint || 0) > 0) nbSources++;
    if ((data.revenusBIC || 0) > 0) nbSources++;
    if ((data.dividendes || 0) > 0) nbSources++;
    if ((data.revenusFonciers || 0) > 0) nbSources++;
    if ((data.pensions || 0) > 0) nbSources++;
    if ((data.autresRevenus || 0) > 0) nbSources++;

    if (nbSources >= 4) score += 10;
    else if (nbSources >= 3) score += 7;
    else if (nbSources >= 2) score += 4;
    else score += 1;

    // --- E. Prevoyance (15 pts max) ---
    var prevScore = 0;
    var hasFamille = m.nbEnfants > 0 || m.situationMatri.indexOf('Mari') >= 0 || m.situationMatri.indexOf('Pacs') >= 0;

    if (m.prevoyance.indexOf('Compl\u00e8te') >= 0) prevScore = 15;
    else if (m.prevoyance.indexOf('Compl\u00e9mentaire') >= 0) prevScore = 10;
    else if (m.prevoyance.indexOf('Minimale') >= 0) prevScore = hasFamille ? 3 : 7;
    else if (m.prevoyance === 'Aucune' || m.prevoyance === '') {
        prevScore = 0;
        if (hasFamille && recs.length < 3) recs.push('Absence de pr\u00e9voyance avec charge de famille. Souscrire une pr\u00e9voyance d\u00e9c\u00e8s/invalidit\u00e9 est prioritaire.');
    }
    score += prevScore;

    var explanation = 'Taux d\u2019endettement \u00e0 ' + Math.round(m.tauxEndettement * 100) + '%, reste \u00e0 vivre mensuel de ' + formatEuro(Math.round(resteAVivre));
    if (nbSources >= 3) explanation += ', sources de revenus diversifi\u00e9es.';
    else explanation += '.';

    return makeScoreDetail(score, explanation, recs.slice(0, 3));
}


// =============================================================================
// 5. SCORE DE PREPARATION TRANSMISSION (weight: 15%)
// =============================================================================

function calcScoreTransmission(m, data) {
    var score = 0;
    var recs = [];

    // Age urgency factor: more weight for older clients
    var ageFactor = 1.0;
    if (m.age >= 70) ageFactor = 1.3;
    else if (m.age >= 60) ageFactor = 1.2;
    else if (m.age >= 55) ageFactor = 1.1;
    else if (m.age < 35) ageFactor = 0.7;

    // --- A. Testament (15 pts max) ---
    if (m.testamentOui) score += 15;
    else if (data.testament === 'En projet') score += 7;
    else {
        score += 0;
        if (m.patriNet > 200000 || m.nbEnfants > 0) {
            recs.push('R\u00e9diger un testament pour organiser la transmission et prot\u00e9ger vos proches.');
        }
    }

    // --- B. Donations (15 pts max) ---
    if (m.donationOui) score += 15;
    else {
        if (m.age >= 50 && m.patriNet > 300000 && recs.length < 3) {
            recs.push('Envisager des donations anticip\u00e9es pour utiliser les abattements (100 000 \u20ac par enfant, renouvelables tous les 15 ans).');
        }
    }

    // --- C. Clause beneficiaire AV personnalisee (15 pts max) ---
    if (m.clauseBeneficiaireAV === 'Personnalis\u00e9e' || m.clauseBeneficiaireAV === 'Oui') score += 15;
    else if (m.assuranceVie > 0) {
        score += 5; // AV exists but clause may be standard
        if (m.assuranceVie > 100000 && recs.length < 3) {
            recs.push('V\u00e9rifier et personnaliser la clause b\u00e9n\u00e9ficiaire de vos contrats d\u2019assurance-vie.');
        }
    }

    // --- D. Mandat de protection future (10 pts max) ---
    if (m.mandatProtection === 'Oui') score += 10;
    else if (m.age >= 55 && recs.length < 3) {
        recs.push('Mettre en place un mandat de protection future pour anticiper une \u00e9ventuelle incapacit\u00e9.');
    }

    // --- E. Utilisation abattement AV 152.5k (20 pts max) ---
    var avTransmissionScore = 0;
    if (m.assuranceVie > 0) {
        var nbBeneficiaires = Math.max(m.nbEnfants, 1);
        var abattementTotal = SCORING.thresholds.avAbattement * nbBeneficiaires;
        if (m.assuranceVie >= abattementTotal * 0.80) avTransmissionScore = 20;
        else if (m.assuranceVie >= abattementTotal * 0.50) avTransmissionScore = 15;
        else if (m.assuranceVie >= abattementTotal * 0.25) avTransmissionScore = 10;
        else avTransmissionScore = 5;
    } else {
        avTransmissionScore = 0;
        if (m.patriNet > 100000 && recs.length < 3) {
            recs.push('Ouvrir une assurance-vie pour b\u00e9n\u00e9ficier de l\u2019abattement de 152 500 \u20ac par b\u00e9n\u00e9ficiaire en transmission.');
        }
    }
    score += avTransmissionScore;

    // --- F. Demembrement (10 pts max) ---
    if (m.demembrementEnPlace === 'Oui') score += 10;
    else if (m.totalImmo > 500000 && m.age >= 55 && recs.length < 3) {
        recs.push('\u00c9tudier le d\u00e9membrement de propri\u00e9t\u00e9 pour optimiser la transmission immobili\u00e8re.');
    }

    // --- G. Age-based scaling ---
    // Patrimoine significatif sans structuration = more critical with age
    var baseMax = 85; // max achievable before age factor
    score = Math.min(score, baseMax);

    // Apply age factor: missing items are more critical for older clients
    if (ageFactor > 1.0) {
        // Penalize missing items more heavily for older clients
        var missing = baseMax - score;
        score = baseMax - Math.round(missing * ageFactor);
    } else if (ageFactor < 1.0) {
        // Young clients: less urgency, boost toward 50 baseline
        score = Math.round(score * 0.85 + 15 * (1 - ageFactor));
    }

    // Bonus points for age > 55 with good preparation
    if (m.age >= 55 && score >= 60) score += 10;

    var explanation = '';
    if (m.age >= 55) explanation = 'Client de ' + m.age + ' ans : la pr\u00e9paration de la transmission est une priorit\u00e9.';
    else explanation = 'Client de ' + m.age + ' ans.';

    var transmItems = [];
    if (m.testamentOui) transmItems.push('testament');
    if (m.donationOui) transmItems.push('donations');
    if (m.assuranceVie > 0) transmItems.push('AV');
    if (m.demembrementEnPlace === 'Oui') transmItems.push('d\u00e9membrement');

    if (transmItems.length > 0) explanation += ' Dispositifs en place : ' + transmItems.join(', ') + '.';
    else explanation += ' Aucun dispositif de transmission identifi\u00e9.';

    return makeScoreDetail(score, explanation, recs.slice(0, 3));
}


// =============================================================================
// 6. SCORE D'OPTIMISATION PATRIMONIALE (weight: 15%)
// =============================================================================

function calcScoreOptimisation(m, data) {
    var score = 0;
    var recs = [];

    // --- A. PEA opened and used (20 pts max) ---
    if (m.pea > 0) {
        score += 10;
        // Bonus for > 5 years old
        if (m.peaDateOuverture) {
            var peaAge = (Date.now() - new Date(m.peaDateOuverture).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
            if (peaAge >= 5) score += 10;
            else if (peaAge >= 2) score += 5;
        } else {
            score += 3; // assume some maturity
        }
    } else {
        if (m.tmi >= 0.30 && recs.length < 3) {
            recs.push('Ouvrir un PEA pour prendre date fiscale. Apr\u00e8s 5 ans, exon\u00e9ration d\u2019IR sur les plus-values (TMI ' + Math.round(m.tmi * 100) + '%).');
        }
    }

    // --- B. AV opened and used (20 pts max) ---
    if (m.assuranceVie > 0) {
        score += 10;
        // Bonus for > 8 years old
        if (m.avDateOuverture) {
            var avAge = (Date.now() - new Date(m.avDateOuverture).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
            if (avAge >= 8) score += 10;
            else if (avAge >= 4) score += 5;
            else score += 2;
        } else {
            score += 3;
        }
    } else {
        if (recs.length < 3) {
            recs.push('Ouvrir un contrat d\u2019assurance-vie pour prendre date fiscale (abattement apr\u00e8s 8 ans + transmission).');
        }
    }

    // --- C. PER used (15 pts max) ---
    if (m.per > 0) {
        score += 8;
        if (m.tmi >= 0.30) score += 7; // PER + high TMI = good combo
        else score += 3;
    } else {
        if (m.tmi >= 0.30) {
            if (recs.length < 3) recs.push('Ouvrir un PER : avec un TMI de ' + Math.round(m.tmi * 100) + '%, la d\u00e9duction fiscale des versements est tr\u00e8s avantageuse.');
        }
    }

    // --- D. Proper use of fiscal envelopes vs CTO (15 pts max) ---
    var envelopeScore = 0;
    if (m.totalFin > 0) {
        var pctInEnvelopes = (m.assuranceVie + m.pea + m.per) / m.totalFin;
        if (pctInEnvelopes >= 0.70) envelopeScore = 15;
        else if (pctInEnvelopes >= 0.50) envelopeScore = 10;
        else if (pctInEnvelopes >= 0.30) envelopeScore = 5;
        else envelopeScore = 0;

        // Penalty: CTO used without PEA = suboptimal
        if (m.cto > 0 && m.pea === 0) {
            envelopeScore = Math.max(0, envelopeScore - 5);
            if (recs.length < 3) recs.push('CTO utilis\u00e9 sans PEA : privil\u00e9gier le PEA avant le CTO pour les actions europ\u00e9ennes (fiscalit\u00e9 all\u00e9g\u00e9e apr\u00e8s 5 ans).');
        }
    }
    score += envelopeScore;

    // --- E. Real estate tax optimization (15 pts max) ---
    var immoFiscalScore = 0;
    var hasLocatif = (m.immoLoc1 > 0 || m.immoLoc2 > 0);
    if (hasLocatif) {
        if (m.regimeFoncier) immoFiscalScore += 8; // At least a regime is chosen
        // Micro-foncier only valid if revenus fonciers < 15k
        if (m.regimeFoncier === 'Micro-foncier' && (data.revenusFonciers || 0) > 15000) {
            immoFiscalScore -= 3;
            if (recs.length < 3) recs.push('Revenus fonciers > 15 000 \u20ac : v\u00e9rifier si le r\u00e9gime r\u00e9el ne serait pas plus avantageux que le micro-foncier.');
        }
        immoFiscalScore += 7; // has locatif = actively investing
    } else if (m.immoSCPI > 0) {
        immoFiscalScore += 10; // SCPI = decent fiscal structure
    }
    score += Math.max(0, Math.min(15, immoFiscalScore));

    // --- F. IFI optimization (bonus 5 pts) ---
    // If patriBrut immo > 1.3M (IFI threshold), check if SCPI in AV
    var ifiSeuil = 1300000;
    if (m.totalImmo > ifiSeuil) {
        if (m.immoSCPI > 0 && m.assuranceVie > 0) {
            score += 5; // SCPI potentially in AV wrapper
        } else {
            if (recs.length < 3) recs.push('Patrimoine immobilier > 1,3 M\u20ac (seuil IFI). Envisager la d\u00e9tention de SCPI via assurance-vie pour r\u00e9duire l\u2019assiette IFI.');
        }
    }

    var explanation = '';
    var envelopesUsed = [];
    if (m.assuranceVie > 0) envelopesUsed.push('AV');
    if (m.pea > 0) envelopesUsed.push('PEA');
    if (m.per > 0) envelopesUsed.push('PER');

    if (envelopesUsed.length >= 3) explanation = 'Enveloppes fiscales bien utilis\u00e9es (' + envelopesUsed.join(', ') + ').';
    else if (envelopesUsed.length > 0) explanation = 'Enveloppes en place : ' + envelopesUsed.join(', ') + '. Des optimisations sont possibles.';
    else explanation = 'Aucune enveloppe fiscale utilis\u00e9e. Potentiel d\u2019optimisation important.';

    return makeScoreDetail(score, explanation, recs.slice(0, 3));
}


// =============================================================================
// ALERT GENERATION (15 anomalies)
// =============================================================================

function generateAlerts(data, scoreDetails, m) {
    var alerts = [];

    // Helper to push alert
    function alert(type, category, title, message, action, impact) {
        alerts.push({ type: type, category: category, title: title, message: message, action: action || null, impact: impact || null });
    }

    // ---- 1. Patrimoine concentre >70% en immobilier ----
    if (m.pctImmo > 0.70) {
        alert('critical', 'diversification',
            'Concentration immobili\u00e8re excessive',
            'Votre patrimoine est concentr\u00e9 \u00e0 ' + Math.round(m.pctImmo * 100) + '% en immobilier. Ce niveau d\u2019exposition cr\u00e9e un risque majeur de liquidit\u00e9 et de concentration.',
            'Envisager une diversification progressive vers des actifs financiers (AV, PEA, SCPI).',
            'R\u00e9duction du risque de concentration et am\u00e9lioration de la liquidit\u00e9 globale.');
    }

    // ---- 2. Sur-liquidite >30% en livrets/cash ----
    if (m.pctLiquidites > 0.30) {
        alert('warning', 'liquidite',
            'Sur-liquidit\u00e9 d\u00e9tect\u00e9e',
            Math.round(m.pctLiquidites * 100) + '% de votre patrimoine est en liquidit\u00e9s. Ce capital improductif pourrait \u00eatre mieux investi.',
            'R\u00e9allouer l\u2019exc\u00e9dent de tr\u00e9sorerie vers des enveloppes adapt\u00e9es (AV fonds euros, PEA, PER).',
            'Gain de rendement estim\u00e9 de ' + formatEuro(Math.round(m.liquidites * 0.03)) + '/an.');
    }

    // ---- 3. Sous-utilisation PEA ----
    if (m.pea === 0 && m.tmi >= 0.30) {
        alert('warning', 'optimisation',
            'PEA non ouvert',
            'Vous ne disposez pas de PEA. Avec un TMI \u00e0 ' + Math.round(m.tmi * 100) + '%, cette enveloppe offre une exon\u00e9ration d\u2019IR apr\u00e8s 5 ans.',
            'Ouvrir un PEA pour prendre date fiscale, m\u00eame avec un versement minimal.',
            '\u00c9conomie de ' + Math.round(m.tmi * 100 - 17.2) + ' points de fiscalit\u00e9 sur les plus-values apr\u00e8s 5 ans.');
    } else if (m.pea > 0 && m.pea < 5000 && m.tmi >= 0.30) {
        alert('info', 'optimisation',
            'PEA sous-utilis\u00e9',
            'Votre PEA ne contient que ' + formatEuro(m.pea) + '. Avec un TMI \u00e0 ' + Math.round(m.tmi * 100) + '%, maximiser les versements serait avantageux.',
            'Augmenter progressivement les versements sur PEA (plafond 150 000 \u20ac).',
            'Optimisation fiscale des plus-values boursi\u00e8res.');
    }

    // ---- 4. Sous-utilisation PER ----
    if (m.per === 0 && m.tmi >= 0.30) {
        alert('warning', 'optimisation',
            'PER non ouvert',
            'Avec un TMI \u00e0 ' + Math.round(m.tmi * 100) + '%, le PER offre une d\u00e9duction fiscale imm\u00e9diate sur les versements.',
            'Ouvrir un PER et optimiser les versements dans la limite du plafond.',
            '\u00c9conomie fiscale jusqu\u2019\u00e0 ' + formatEuro(Math.round(Math.min(m.totalRevenus * 0.10, 37094) * m.tmi)) + '/an.');
    }

    // ---- 5. AV non ouverte ----
    if (m.assuranceVie === 0 && m.patriNet > 20000) {
        alert('warning', 'optimisation',
            'Assurance-vie non ouverte',
            'Vous ne d\u00e9tenez aucun contrat d\u2019assurance-vie. C\u2019est l\u2019enveloppe la plus polyvalente (fiscalit\u00e9, transmission, \u00e9pargne).',
            'Ouvrir un contrat d\u2019AV pour prendre date fiscale (abattement apr\u00e8s 8 ans + 152 500 \u20ac/b\u00e9n\u00e9ficiaire en transmission).',
            'Fiscalit\u00e9 all\u00e9g\u00e9e + avantage successoral significatif.');
    }

    // ---- 6. Profil prudent avec allocation offensive ----
    if ((m.profil === 'securitaire' || m.profil === 'prudent') && m.pctDynamic > 0.30) {
        alert('critical', 'adequationRisque',
            'Allocation offensive pour un profil prudent',
            'Votre profil est ' + m.profilRaw + ' mais ' + Math.round(m.pctDynamic * 100) + '% de votre allocation financi\u00e8re est en actifs dynamiques.',
            'R\u00e9\u00e9quilibrer vers des actifs s\u00e9curitaires (fonds euros, livrets) ou revoir votre profil de risque.',
            'Alignement du risque r\u00e9el avec votre tol\u00e9rance d\u00e9clar\u00e9e.');
    }

    // ---- 7. Profil offensif avec allocation trop prudente ----
    if ((m.profil === 'offensif' || m.profil === 'dynamique') && m.pctSafe > 0.60) {
        alert('warning', 'adequationRisque',
            'Allocation trop prudente pour votre profil',
            'Votre profil est ' + m.profilRaw + ' mais ' + Math.round(m.pctSafe * 100) + '% de votre \u00e9pargne est en actifs s\u00e9curitaires.',
            'Augmenter l\u2019exposition aux actifs dynamiques (PEA, UC en AV) ou revoir votre profil.',
            'Meilleur potentiel de rendement sur votre horizon de ' + m.horizon + ' ans.');
    }

    // ---- 8. Absence de prevoyance avec enfants a charge ----
    var hasFamille = m.nbEnfants > 0 || m.enfantsCharge > 0;
    if (hasFamille && (m.prevoyance === 'Aucune' || m.prevoyance === '')) {
        alert('critical', 'solidite',
            'Absence de pr\u00e9voyance avec famille \u00e0 charge',
            'Vous avez ' + m.nbEnfants + ' enfant(s) mais aucune couverture pr\u00e9voyance. En cas d\u2019al\u00e9a, votre famille serait expos\u00e9e.',
            'Souscrire une assurance d\u00e9c\u00e8s/invalidit\u00e9 couvrant au minimum 3 ann\u00e9es de revenus.',
            'Protection financi\u00e8re de la famille en cas d\u2019impr\u00e9vu.');
    }

    // ---- 9. Pas de testament alors que patrimoine >500k ou situation complexe ----
    var situationComplexe = (m.situationMatri.indexOf('Divorc') >= 0 || m.situationMatri.indexOf('Recompos') >= 0 || m.nbEnfants >= 3);
    if (!m.testamentOui && (m.patriNet > 500000 || situationComplexe)) {
        alert('warning', 'transmission',
            'Succession non pr\u00e9par\u00e9e',
            'Patrimoine net de ' + formatEuro(m.patriNet) + (situationComplexe ? ' et situation familiale complexe' : '') + ' sans disposition testamentaire.',
            'Consulter un notaire pour r\u00e9diger un testament et organiser la transmission.',
            'Optimisation des droits de succession et protection du conjoint/enfants.');
    }

    // ---- 10. Endettement >40% ----
    if (m.tauxEndettement > 0.40) {
        alert('critical', 'solidite',
            'Endettement patrimonial \u00e9lev\u00e9',
            'Votre taux d\u2019endettement patrimonial atteint ' + Math.round(m.tauxEndettement * 100) + '%. Ce niveau fragilise votre situation en cas de retournement.',
            'Prioriser le d\u00e9sendettement ou la constitution de r\u00e9serves de s\u00e9curit\u00e9.',
            'S\u00e9curisation du patrimoine et r\u00e9duction de la pression financi\u00e8re.');
    }

    // ---- 11. Epargne de precaution <3 mois de charges ----
    var emergencyMonths = m.totalCharges > 0 ? m.livrets / m.totalCharges : 99;
    if (emergencyMonths < 3 && m.totalCharges > 0) {
        alert('warning', 'liquidite',
            '\u00c9pargne de pr\u00e9caution insuffisante',
            'Vos livrets couvrent seulement ' + Math.round(emergencyMonths * 10) / 10 + ' mois de charges (minimum recommand\u00e9 : 6 mois).',
            'Constituer une \u00e9pargne de pr\u00e9caution de ' + formatEuro(Math.round(m.totalCharges * 6)) + ' sur livrets.',
            'S\u00e9curit\u00e9 financi\u00e8re face aux impr\u00e9vus.');
    }

    // ---- 12. Aucune diversification (1 seul type d'actif) ----
    var nbTypes = 0;
    if (m.totalImmo > 0) nbTypes++;
    if (m.totalFin > 0) nbTypes++;
    if (nbTypes <= 1 && m.patriBrut > 0) {
        alert('warning', 'diversification',
            'Patrimoine non diversifi\u00e9',
            'Votre patrimoine repose sur un seul type d\u2019actif (' + (m.totalImmo > 0 ? 'immobilier' : 'financier') + '). Ce manque de diversification augmente le risque global.',
            'Diversifier vers ' + (m.totalImmo > 0 ? 'des actifs financiers (AV, PEA)' : 'de l\u2019immobilier (SCPI, locatif)') + '.',
            'R\u00e9duction du risque de concentration et meilleure r\u00e9silience.');
    }

    // ---- 13. Concentration immobiliere avec levier important ----
    if (m.pctImmo > 0.60 && m.dettes > m.totalImmo * 0.50) {
        alert('critical', 'solidite',
            'Concentration immobili\u00e8re avec levier \u00e9lev\u00e9',
            'Votre patrimoine est concentr\u00e9 en immobilier (' + Math.round(m.pctImmo * 100) + '%) avec un endettement repr\u00e9sentant ' + Math.round(m.dettes / m.totalImmo * 100) + '% de la valeur immobili\u00e8re.',
            'R\u00e9duire le levier ou diversifier d\u00e8s que possible pour limiter le risque.',
            'Protection contre un retournement du march\u00e9 immobilier.');
    }

    // ---- 14. Incoherence objectif retraite sans PER ----
    if (m.objectif === 'Retraite' && m.per === 0) {
        alert('warning', 'optimisation',
            'Objectif retraite sans PER',
            'Votre objectif principal est la retraite mais vous ne d\u00e9tenez pas de PER. Cette enveloppe est sp\u00e9cifiquement con\u00e7ue pour cet objectif.',
            'Ouvrir un PER pour b\u00e9n\u00e9ficier de la d\u00e9duction fiscale et pr\u00e9parer la retraite.',
            'D\u00e9duction fiscale imm\u00e9diate + capital/rente \u00e0 la retraite.');
    }

    // ---- 15. Capacite d'epargne non exploitee ----
    if (m.capaciteEpargne > 500 && m.epargneMensuelle === 0) {
        alert('info', 'optimisation',
            'Capacit\u00e9 d\u2019\u00e9pargne non exploit\u00e9e',
            'Votre capacit\u00e9 d\u2019\u00e9pargne mensuelle est de ' + formatEuro(Math.round(m.capaciteEpargne)) + ' mais aucun versement programm\u00e9 n\u2019est en place.',
            'Mettre en place des versements programm\u00e9s sur AV, PEA ou PER.',
            'Constitution de capital par lissage et discipline d\u2019investissement.');
    }

    // ---- ADDITIONAL POSITIVE ALERTS ----

    // Capacite epargne negative
    if (m.capaciteEpargne < 0) {
        alert('critical', 'liquidite',
            'Capacit\u00e9 d\u2019\u00e9pargne n\u00e9gative',
            'Vos charges mensuelles exc\u00e8dent vos revenus de ' + formatEuro(Math.round(Math.abs(m.capaciteEpargne))) + '. Cette situation n\u00e9cessite une action imm\u00e9diate.',
            'Revoir la structure de charges et les cr\u00e9dits en cours.',
            'R\u00e9tablissement de l\u2019\u00e9quilibre budg\u00e9taire.');
    }

    // Surexposition immo (65-70% = warning, not critical)
    if (m.pctImmo > 0.60 && m.pctImmo <= 0.70) {
        alert('warning', 'diversification',
            'Surexposition immobili\u00e8re',
            'Votre patrimoine est expos\u00e9 \u00e0 ' + Math.round(m.pctImmo * 100) + '% en immobilier, au-dessus du seuil recommand\u00e9.',
            'Envisager un r\u00e9\u00e9quilibrage progressif vers des actifs financiers.',
            'Meilleure diversification et liquidit\u00e9 accrue.');
    }

    // Success alerts
    if (m.pctImmo >= 0.20 && m.pctImmo <= 0.45 && m.pctFin >= 0.35) {
        alert('success', 'diversification', 'Bonne diversification patrimoniale',
            'L\u2019\u00e9quilibre entre immobilier (' + Math.round(m.pctImmo * 100) + '%) et financier (' + Math.round(m.pctFin * 100) + '%) est satisfaisant.', null, null);
    }

    if (m.tauxEndettement > 0 && m.tauxEndettement <= 0.20) {
        alert('success', 'solidite', 'Endettement ma\u00eetris\u00e9',
            'Votre taux d\u2019endettement patrimonial est contenu \u00e0 ' + Math.round(m.tauxEndettement * 100) + '%.', null, null);
    }

    if (m.pctEnveloppeFiscale >= 0.50) {
        alert('success', 'optimisation', 'Bonne utilisation des enveloppes fiscales',
            Math.round(m.pctEnveloppeFiscale * 100) + '% de votre \u00e9pargne financi\u00e8re est log\u00e9e dans des enveloppes fiscalement avantageuses.', null, null);
    }

    // Risk profile coherence check (use external function if available)
    if (typeof analyzeRealRiskProfile === 'function') {
        var riskAnalysis = analyzeRealRiskProfile();
        if (riskAnalysis && riskAnalysis.severity === 'critical') {
            alert('critical', 'adequationRisque',
                'Incoh\u00e9rence majeure profil / allocation',
                'Votre profil d\u00e9clar\u00e9 (' + (riskAnalysis.declaredProfile || '') + ') est en forte incoh\u00e9rence avec votre allocation r\u00e9elle (profil ' + (riskAnalysis.actualProfile || '') + ').',
                'Revoir votre profil de risque ou r\u00e9\u00e9quilibrer vos investissements.',
                'Alignement du risque r\u00e9el avec votre tol\u00e9rance d\u00e9clar\u00e9e.');
        } else if (riskAnalysis && riskAnalysis.severity === 'warning') {
            alert('warning', 'adequationRisque',
                'L\u00e9g\u00e8re incoh\u00e9rence profil / allocation',
                'Votre allocation r\u00e9elle correspond davantage \u00e0 un profil ' + (riskAnalysis.actualProfile || '') + ' alors que vous vous d\u00e9clarez ' + (riskAnalysis.declaredProfile || '') + '.',
                'Envisager un ajustement de votre allocation ou de votre profil de risque.',
                'Meilleure coh\u00e9rence entre risque pris et risque souhait\u00e9.');
        } else if (riskAnalysis && riskAnalysis.severity === 'coherent') {
            alert('success', 'adequationRisque', 'Profil de risque coh\u00e9rent',
                'Votre allocation r\u00e9elle est en ad\u00e9quation avec votre profil de risque d\u00e9clar\u00e9.', null, null);
        }
    }

    // Sort by priority
    alerts.sort(function(a, b) {
        var pA = SCORING.alertTypes[a.type] ? SCORING.alertTypes[a.type].priority : 99;
        var pB = SCORING.alertTypes[b.type] ? SCORING.alertTypes[b.type].priority : 99;
        return pA - pB;
    });

    return alerts;
}


// =============================================================================
// ACTION PLAN GENERATION
// =============================================================================

function generateActionPlan(data, scoreDetails, alerts, m) {
    var actions = [];
    var savedActions = JSON.parse(localStorage.getItem('patria_action_plan') || '[]');
    var statusMap = {};
    savedActions.forEach(function(a) { statusMap[a.id] = a.status; });

    function addAction(id, title, desc, priority, category, gain, effort, horizon) {
        actions.push({
            id: id, title: title, description: desc,
            priority: priority, category: category,
            gain: gain, effort: effort, horizon: horizon,
            status: statusMap[id] || 'todo'
        });
    }

    // PEA
    if (m.pea === 0 && m.tmi >= 0.30) {
        addAction('open-pea', 'Ouvrir un PEA',
            'Prendre date fiscale sur un PEA pour b\u00e9n\u00e9ficier de l\u2019exon\u00e9ration d\u2019IR apr\u00e8s 5 ans.',
            'urgent', 'optimisation',
            'Exon\u00e9ration IR sur les plus-values (\u00e9conomie de ' + Math.round((m.tmi - 0.172) * 100) + ' points)',
            'Faible', 'Imm\u00e9diat');
    }

    // PER
    if (m.per === 0 && m.tmi >= 0.30) {
        addAction('open-per', 'Ouvrir un PER',
            'D\u00e9duire vos versements de votre revenu imposable et constituer un capital retraite.',
            'urgent', 'optimisation',
            formatEuro(Math.round(Math.min(m.totalRevenus * 0.10, 37094) * m.tmi)) + '/an d\u2019\u00e9conomie fiscale',
            'Faible', 'Imm\u00e9diat');
    }

    // AV
    if (m.assuranceVie === 0 && m.patriNet > 50000) {
        addAction('open-av', 'Ouvrir un contrat d\u2019assurance-vie',
            'Prendre date fiscale et pr\u00e9parer la transmission (abattement 152 500 \u20ac/b\u00e9n\u00e9ficiaire).',
            'urgent', 'optimisation',
            'Fiscalit\u00e9 all\u00e9g\u00e9e apr\u00e8s 8 ans + avantage successoral',
            'Faible', 'Imm\u00e9diat');
    }

    // Reallocation tresorerie
    var tresoImproductive = m.patriBrut > 0 ? m.liquidites / m.patriBrut : 0;
    if (tresoImproductive > 0.20 && m.liquidites > 20000) {
        var excedent = m.liquidites - (m.patriNet > 0 ? m.patriNet * 0.10 : 20000);
        if (excedent > 0) {
            addAction('realloc-treso', 'R\u00e9allouer la tr\u00e9sorerie exc\u00e9dentaire',
                'Transf\u00e9rer ' + formatEuro(Math.round(excedent)) + ' de liquidit\u00e9s improductives vers des supports adapt\u00e9s.',
                'important', 'liquidite',
                'Rendement additionnel estim\u00e9 : ' + formatEuro(Math.round(excedent * 0.035)) + '/an',
                'Moyen', '1-3 mois');
        }
    }

    // Diversification immo
    if (m.pctImmo > 0.70) {
        addAction('diversif-immo', 'R\u00e9\u00e9quilibrer le patrimoine immobilier',
            'R\u00e9duire la concentration immobili\u00e8re de ' + Math.round(m.pctImmo * 100) + '% vers un objectif de 35-45%.',
            'important', 'diversification',
            'Meilleure liquidit\u00e9, r\u00e9duction du risque de concentration',
            '\u00c9lev\u00e9', '6-18 mois');
    }

    // Prevoyance
    var hasFamille = m.nbEnfants > 0 || m.enfantsCharge > 0;
    if (hasFamille && (m.prevoyance === 'Aucune' || m.prevoyance === '')) {
        addAction('prevoyance', 'Souscrire une pr\u00e9voyance d\u00e9c\u00e8s/invalidit\u00e9',
            'Prot\u00e9ger votre famille en cas d\u2019al\u00e9a de la vie (d\u00e9c\u00e8s, invalidit\u00e9, arr\u00eat de travail).',
            'urgent', 'solidite',
            'Protection du niveau de vie familial',
            'Faible', 'Imm\u00e9diat');
    }

    // Succession
    if (!m.testamentOui && m.nbEnfants > 0 && m.patriNet > 300000) {
        addAction('prep-succession', 'Pr\u00e9parer la transmission',
            'Mettre en place des dispositions testamentaires et envisager des donations anticip\u00e9es.',
            'important', 'transmission',
            'Optimisation des droits de succession, protection du conjoint',
            'Moyen', '3-6 mois');
    }

    // Donations
    if (!m.donationOui && m.nbEnfants > 0 && m.age >= 50 && m.patriNet > 400000) {
        addAction('donation-anticipee', 'Envisager des donations anticip\u00e9es',
            'Utiliser les abattements de 100 000 \u20ac par enfant (renouvelables tous les 15 ans) pour optimiser la transmission.',
            'important', 'transmission',
            'R\u00e9duction des droits de succession de ' + formatEuro(Math.round(m.nbEnfants * 100000 * 0.20)),
            'Moyen', '3-6 mois');
    }

    // Diversification faible
    if (scoreDetails.diversification && scoreDetails.diversification.value < 40) {
        addAction('improve-diversif', 'Am\u00e9liorer la diversification',
            'Votre score de diversification est de ' + scoreDetails.diversification.value + '/100. \u00c9largir vos supports d\u2019investissement.',
            'opportunite', 'diversification',
            'R\u00e9duction du risque global et optimisation du rendement ajust\u00e9',
            'Moyen', '3-12 mois');
    }

    // Versements programmes
    if (m.capaciteEpargne > 500 && m.epargneMensuelle === 0) {
        addAction('versements-prog', 'Mettre en place des versements programm\u00e9s',
            'Automatiser l\u2019\u00e9pargne mensuelle de ' + formatEuro(Math.round(Math.min(m.capaciteEpargne * 0.50, 2000))) + ' pour capitaliser r\u00e9guli\u00e8rement.',
            'opportunite', 'optimisation',
            'Constitution de capital par effet de lissage',
            'Faible', 'Imm\u00e9diat');
    }

    // Epargne de precaution
    var emergencyMonths = m.totalCharges > 0 ? m.livrets / m.totalCharges : 99;
    if (emergencyMonths < 3 && m.totalCharges > 0) {
        addAction('epargne-precaution', 'Constituer l\u2019\u00e9pargne de pr\u00e9caution',
            'Atteindre 6 mois de charges sur livrets soit ' + formatEuro(Math.round(m.totalCharges * 6)) + '.',
            'urgent', 'liquidite',
            'S\u00e9curit\u00e9 face aux impr\u00e9vus et s\u00e9r\u00e9nit\u00e9 financi\u00e8re',
            'Moyen', '3-12 mois');
    }

    // Sort by priority
    var priorityOrder = { urgent: 1, important: 2, opportunite: 3 };
    actions.sort(function(a, b) {
        return (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);
    });

    return actions;
}


// =============================================================================
// NARRATIVE SYNTHESIS
// =============================================================================

function generateNarrativeSynthesis(data, scoreDetails, m, alerts) {
    // Client profile
    var prenomNom = ((data.prenom || '') + ' ' + (data.nom || '')).trim() || 'Client';
    var ageStr = m.age + ' ans';
    var statutStr = m.statutPro || 'non renseign\u00e9';
    var situationFam = m.situationMatri || 'non renseign\u00e9e';
    if (m.nbEnfants > 0) situationFam += ', ' + m.nbEnfants + ' enfant(s)';

    var profilClient = prenomNom + ', ' + ageStr + ', ' + statutStr + ', ' + situationFam + '.';

    // Global situation
    var situationGlobale = 'Patrimoine net de ' + formatEuro(m.patriNet) + ' (brut ' + formatEuro(m.patriBrut) + ')';
    if (m.totalImmo > 0 && m.totalFin > 0) {
        situationGlobale += ' r\u00e9parti entre immobilier (' + Math.round(m.pctImmo * 100) + '%) et financier (' + Math.round(m.pctFin * 100) + '%).';
    } else if (m.totalImmo > 0) {
        situationGlobale += ', essentiellement immobilier.';
    } else if (m.totalFin > 0) {
        situationGlobale += ', essentiellement financier.';
    } else {
        situationGlobale += '.';
    }
    if (m.dettes > 0) situationGlobale += ' Endettement : ' + formatEuro(m.dettes) + ' (' + Math.round(m.tauxEndettement * 100) + '%).';
    situationGlobale += ' Revenus annuels : ' + formatEuro(m.totalRevenus) + ', capacit\u00e9 d\u2019\u00e9pargne mensuelle : ' + formatEuro(Math.round(m.capaciteEpargne)) + '.';

    // Forces
    var forces = [];
    for (var key in scoreDetails) {
        if (scoreDetails[key].value >= 70) {
            var labelMap = {
                diversification: 'Bonne diversification patrimoniale',
                liquidite: 'Gestion de la liquidit\u00e9 ma\u00eetris\u00e9e',
                adequationRisque: 'Allocation coh\u00e9rente avec le profil de risque',
                solidite: 'Solidit\u00e9 patrimoniale satisfaisante',
                transmission: 'Pr\u00e9paration de la transmission bien avanc\u00e9e',
                optimisation: 'Bonne utilisation des leviers d\u2019optimisation fiscale'
            };
            forces.push(labelMap[key] || (key + ' : score de ' + scoreDetails[key].value + '/100'));
        }
    }
    if (forces.length === 0) forces.push('Pas de point fort majeur identifi\u00e9 \u2014 des am\u00e9liorations sont possibles sur l\u2019ensemble des axes.');

    // Fragilites
    var fragilites = [];
    for (var key2 in scoreDetails) {
        if (scoreDetails[key2].value < 50) {
            var fragMap = {
                diversification: 'Diversification insuffisante du patrimoine',
                liquidite: 'Gestion de la liquidit\u00e9 \u00e0 am\u00e9liorer',
                adequationRisque: 'D\u00e9calage entre profil de risque et allocation r\u00e9elle',
                solidite: 'Solidit\u00e9 patrimoniale fragile',
                transmission: 'Transmission peu ou pas pr\u00e9par\u00e9e',
                optimisation: 'Potentiel d\u2019optimisation fiscale inexploit\u00e9'
            };
            fragilites.push(fragMap[key2] || (key2 + ' : score de ' + scoreDetails[key2].value + '/100'));
        }
    }
    if (fragilites.length === 0) fragilites.push('Aucune fragilit\u00e9 majeure d\u00e9tect\u00e9e.');

    // Priorites d'action (top 3 from alerts)
    var prioritesAction = [];
    var criticalAlerts = alerts.filter(function(a) { return a.type === 'critical' || a.type === 'warning'; });
    for (var i = 0; i < Math.min(criticalAlerts.length, 5); i++) {
        prioritesAction.push((i + 1) + '. ' + criticalAlerts[i].title + (criticalAlerts[i].action ? ' \u2014 ' + criticalAlerts[i].action : ''));
    }
    if (prioritesAction.length === 0) prioritesAction.push('Maintenir la strat\u00e9gie en place et surveiller les \u00e9volutions.');

    // Narrative synthesis (full paragraph)
    var globalLevel = getScoreLevel(
        Math.round(Object.keys(scoreDetails).reduce(function(sum, k) { return sum + scoreDetails[k].value; }, 0) / Math.max(Object.keys(scoreDetails).length, 1))
    );

    var syntheseNarrative = profilClient + ' ';
    syntheseNarrative += situationGlobale + ' ';

    if (globalLevel.label === 'Excellent' || globalLevel.label === 'Bon') {
        syntheseNarrative += 'La situation patrimoniale est globalement saine et bien structur\u00e9e. ';
    } else if (globalLevel.label === 'Moyen') {
        syntheseNarrative += 'La situation patrimoniale pr\u00e9sente des bases solides mais plusieurs axes d\u2019am\u00e9lioration ont \u00e9t\u00e9 identifi\u00e9s. ';
    } else {
        syntheseNarrative += 'La situation patrimoniale n\u00e9cessite une attention particuli\u00e8re sur plusieurs dimensions. ';
    }

    if (forces.length > 0 && forces[0].indexOf('Pas de point fort') < 0) {
        syntheseNarrative += 'Points forts : ' + forces.slice(0, 2).join(', ').toLowerCase() + '. ';
    }
    if (fragilites.length > 0 && fragilites[0].indexOf('Aucune fragilit') < 0) {
        syntheseNarrative += 'Points d\u2019attention : ' + fragilites.slice(0, 2).join(', ').toLowerCase() + '. ';
    }
    if (prioritesAction.length > 0 && prioritesAction[0].indexOf('Maintenir') < 0) {
        syntheseNarrative += 'Les actions prioritaires portent sur : ' + criticalAlerts.slice(0, 2).map(function(a) { return a.title.toLowerCase(); }).join(' et ') + '.';
    }

    return {
        profilClient: profilClient,
        situationGlobale: situationGlobale,
        forces: forces,
        fragilites: fragilites,
        prioritesAction: prioritesAction,
        syntheseNarrative: syntheseNarrative
    };
}


// =============================================================================
// ACTION STATUS MANAGEMENT
// =============================================================================

function updateActionStatus(actionId, newStatus) {
    var saved = JSON.parse(localStorage.getItem('patria_action_plan') || '[]');
    var found = false;
    saved.forEach(function(a) {
        if (a.id === actionId) { a.status = newStatus; a.updatedAt = new Date().toISOString(); found = true; }
    });
    if (!found) saved.push({ id: actionId, status: newStatus, updatedAt: new Date().toISOString() });
    localStorage.setItem('patria_action_plan', JSON.stringify(saved));
}


// =============================================================================
// DISPLAY FUNCTIONS
// =============================================================================

function renderScoreGauge(containerId, score, label) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var level = getScoreLevel(score);
    var color = level.color;
    var circumference = 2 * Math.PI * 54;
    var offset = circumference - (score / 100) * circumference;

    el.innerHTML = '<div class="score-gauge">' +
        '<svg viewBox="0 0 120 120" width="120" height="120">' +
        '<circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8"/>' +
        '<circle cx="60" cy="60" r="54" fill="none" stroke="' + color + '" stroke-width="8" ' +
        'stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '" ' +
        'stroke-linecap="round" transform="rotate(-90 60 60)" style="transition:stroke-dashoffset 1.5s ease;"/>' +
        '</svg>' +
        '<div class="score-gauge-value">' + score + '</div>' +
        '<div class="score-gauge-label">' + (label || 'Score global') + '</div>' +
        '</div>';
}

function renderSubScores(containerId, scores) {
    var el = document.getElementById(containerId);
    if (!el) return;

    // Use legacy labels for backward compatibility with existing HTML
    var labels = {
        diversification: 'Diversification',
        fiscalite: 'Optimisation fiscale',
        liquidite: 'Liquidit\u00e9',
        risque: 'Ad\u00e9quation risque',
        coherence: 'Solidit\u00e9 patrimoniale',
        structuration: 'Transmission'
    };

    var html = '<div class="sub-scores-grid">';
    for (var key in scores) {
        var s = scores[key];
        var level = getScoreLevel(s);
        var color = level.color;
        var width = Math.max(s, 5);
        html += '<div class="sub-score-item">' +
            '<div class="sub-score-header">' +
            '<span class="sub-score-label">' + (labels[key] || key) + '</span>' +
            '<span class="sub-score-value" style="color:' + color + ';">' + s + '/100 <small style="opacity:0.7;">(' + level.label + ')</small></span>' +
            '</div>' +
            '<div class="sub-score-bar"><div class="sub-score-fill" style="width:' + width + '%;background:' + color + ';"></div></div>' +
            '</div>';
    }
    html += '</div>';
    el.innerHTML = html;
}

function renderDetailedSubScores(containerId, scoreDetails) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var labels = {
        diversification: 'Diversification',
        liquidite: 'Liquidit\u00e9',
        adequationRisque: 'Ad\u00e9quation risque',
        solidite: 'Solidit\u00e9 patrimoniale',
        transmission: 'Pr\u00e9paration transmission',
        optimisation: 'Optimisation patrimoniale'
    };

    var html = '<div class="sub-scores-detailed">';
    for (var key in scoreDetails) {
        var sd = scoreDetails[key];
        var width = Math.max(sd.value, 5);
        html += '<div class="sub-score-detail-item">' +
            '<div class="sub-score-header">' +
            '<span class="sub-score-label">' + (labels[key] || key) + '</span>' +
            '<span class="sub-score-value" style="color:' + sd.color + ';">' + sd.value + '/100 <small>(' + sd.level + ')</small></span>' +
            '</div>' +
            '<div class="sub-score-bar"><div class="sub-score-fill" style="width:' + width + '%;background:' + sd.color + ';"></div></div>' +
            '<p class="sub-score-explanation" style="font-size:12px;color:#8a98a8;margin:4px 0 2px 0;">' + sd.explanation + '</p>';
        if (sd.recommendations && sd.recommendations.length > 0) {
            html += '<ul class="sub-score-recs" style="font-size:11px;color:#6b7b8d;margin:2px 0 8px 0;padding-left:16px;">';
            sd.recommendations.forEach(function(r) {
                html += '<li>' + r + '</li>';
            });
            html += '</ul>';
        }
        html += '</div>';
    }
    html += '</div>';
    el.innerHTML = html;
}

function renderAlerts(containerId, alerts, maxAlerts) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var max = maxAlerts || 5;
    var displayed = alerts.slice(0, max);

    if (displayed.length === 0) {
        el.innerHTML = '<div class="alert-empty">Aucune alerte d\u00e9tect\u00e9e. Votre situation semble bien structur\u00e9e.</div>';
        return;
    }

    var html = '<div class="alerts-list">';
    displayed.forEach(function(a) {
        var type = SCORING.alertTypes[a.type] || SCORING.alertTypes.info;
        html += '<div class="alert-card alert-' + a.type + '">' +
            '<div class="alert-header">' +
            '<span class="alert-badge" style="background:' + type.color + ';">' + type.icon + ' ' + type.label + '</span>' +
            '<span class="alert-category">' + a.category + '</span>' +
            '</div>' +
            '<h4 class="alert-title">' + a.title + '</h4>' +
            '<p class="alert-message">' + a.message + '</p>';
        if (a.action) {
            html += '<div class="alert-action"><strong>Action recommand\u00e9e :</strong> ' + a.action + '</div>';
        }
        if (a.impact) {
            html += '<div class="alert-impact"><strong>Impact attendu :</strong> ' + a.impact + '</div>';
        }
        html += '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
}

function renderActionPlan(containerId, actions) {
    var el = document.getElementById(containerId);
    if (!el) return;

    if (actions.length === 0) {
        el.innerHTML = '<div class="action-empty">Aucune action prioritaire identifi\u00e9e pour le moment.</div>';
        return;
    }

    var priorityLabels = {
        urgent: { label: 'Urgent', color: '#dc3545', icon: '\uD83D\uDD34' },
        important: { label: 'Important', color: '#e8a838', icon: '\uD83D\uDFE1' },
        opportunite: { label: 'Opportunit\u00e9', color: '#c1925e', icon: '\uD83D\uDFE2' }
    };

    var statusLabels = {
        todo: { label: '\u00c0 faire', color: '#6b7b8d' },
        inprogress: { label: 'En cours', color: '#e8a838' },
        done: { label: 'R\u00e9alis\u00e9', color: '#28a745' }
    };

    var html = '<div class="action-plan-list">';
    actions.forEach(function(action) {
        var p = priorityLabels[action.priority] || priorityLabels.opportunite;
        var s = statusLabels[action.status] || statusLabels.todo;

        html += '<div class="action-card action-' + action.status + '">' +
            '<div class="action-header">' +
            '<span class="action-priority" style="background:' + p.color + ';">' + p.icon + ' ' + p.label + '</span>' +
            '<select class="action-status-select" data-action-id="' + action.id + '" onchange="handleActionStatusChange(this)">' +
            '<option value="todo"' + (action.status === 'todo' ? ' selected' : '') + '>\u00c0 faire</option>' +
            '<option value="inprogress"' + (action.status === 'inprogress' ? ' selected' : '') + '>En cours</option>' +
            '<option value="done"' + (action.status === 'done' ? ' selected' : '') + '>R\u00e9alis\u00e9</option>' +
            '</select>' +
            '</div>' +
            '<h4 class="action-title">' + action.title + '</h4>' +
            '<p class="action-desc">' + action.description + '</p>' +
            '<div class="action-meta">' +
            '<span class="action-gain">\uD83D\uDCB0 ' + action.gain + '</span>' +
            '<span class="action-effort">\u26A1 Effort : ' + action.effort + '</span>' +
            '<span class="action-horizon">\uD83D\uDCC5 ' + action.horizon + '</span>' +
            '</div>' +
            '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
}

function handleActionStatusChange(selectEl) {
    var actionId = selectEl.getAttribute('data-action-id');
    var newStatus = selectEl.value;
    updateActionStatus(actionId, newStatus);
    var card = selectEl.closest('.action-card');
    if (card) card.className = 'action-card action-' + newStatus;
}


// =============================================================================
// ALLOCATION VISUALIZATION
// =============================================================================

function renderAllocationComparison(containerId, data) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var totalImmo = (data.immoRP || 0) + (data.immoRS || 0) + (data.immoLoc1 || 0) + (data.immoLoc2 || 0) + (data.immoSCPI || 0) + (data.immoPro || 0) + (data.immoAutres || 0);
    var totalFin = (data.livrets || 0) + (data.pel || 0) + (data.assuranceVie || 0) + (data.pea || 0) + (data.cto || 0) + (data.per || 0) + (data.epargneSalariale || 0) + (data.autresPlacement || 0);
    var total = totalImmo + totalFin;
    if (total === 0) { el.innerHTML = ''; return; }

    var current = {
        'Immobilier': totalImmo,
        'Assurance-vie': data.assuranceVie || 0,
        'PEA': data.pea || 0,
        'CTO': data.cto || 0,
        'PER': data.per || 0,
        'SCPI': data.immoSCPI || 0,
        'Liquidit\u00e9s': (data.livrets || 0) + (data.pel || 0),
        'Autres': (data.epargneSalariale || 0) + (data.autresPlacement || 0)
    };

    var profil = normalizeProfile(data.profilRisque);
    var target = getTargetAllocation(profil, total);

    var colors = {
        'Immobilier': '#254a65', 'Assurance-vie': '#c1925e', 'PEA': '#4a8b6e',
        'CTO': '#6b8bb5', 'PER': '#8b6bb5', 'SCPI': '#3a6d8c',
        'Liquidit\u00e9s': '#a0a8b0', 'Autres': '#7a8a9a'
    };

    var html = '<div class="alloc-comparison">';
    html += '<div class="alloc-col"><h4 class="alloc-col-title">Allocation actuelle</h4>';
    html += renderAllocationBars(current, total, colors);
    html += '</div>';
    html += '<div class="alloc-col"><h4 class="alloc-col-title">Allocation cible</h4>';
    html += renderAllocationBars(target, total, colors);
    html += '</div>';
    html += '</div>';

    el.innerHTML = html;
}

function renderAllocationBars(alloc, total, colors) {
    var html = '<div class="alloc-bars">';
    for (var key in alloc) {
        var val = alloc[key];
        var pct = total > 0 ? (val / total * 100) : 0;
        if (pct < 0.5) continue;
        html += '<div class="alloc-bar-item">' +
            '<div class="alloc-bar-label">' +
            '<span>' + key + '</span>' +
            '<span>' + Math.round(pct) + '%</span>' +
            '</div>' +
            '<div class="alloc-bar-track">' +
            '<div class="alloc-bar-fill" style="width:' + pct + '%;background:' + (colors[key] || '#6b7b8d') + ';"></div>' +
            '</div>' +
            '</div>';
    }
    html += '</div>';
    return html;
}

function getTargetAllocation(profil, total) {
    var targets = {
        securitaire: { 'Immobilier': 0.30, 'Assurance-vie': 0.35, 'PEA': 0.05, 'PER': 0.10, 'SCPI': 0.10, 'Liquidit\u00e9s': 0.10 },
        prudent: { 'Immobilier': 0.35, 'Assurance-vie': 0.25, 'PEA': 0.10, 'PER': 0.10, 'SCPI': 0.10, 'Liquidit\u00e9s': 0.08, 'CTO': 0.02 },
        equilibre: { 'Immobilier': 0.40, 'Assurance-vie': 0.20, 'PEA': 0.15, 'PER': 0.08, 'SCPI': 0.08, 'Liquidit\u00e9s': 0.05, 'CTO': 0.04 },
        dynamique: { 'Immobilier': 0.35, 'Assurance-vie': 0.15, 'PEA': 0.20, 'CTO': 0.10, 'SCPI': 0.08, 'PER': 0.07, 'Liquidit\u00e9s': 0.05 },
        offensif: { 'Immobilier': 0.25, 'PEA': 0.25, 'CTO': 0.20, 'Assurance-vie': 0.10, 'SCPI': 0.10, 'PER': 0.05, 'Liquidit\u00e9s': 0.05 }
    };

    var t = targets[profil] || targets.equilibre;
    var result = {};
    for (var key in t) {
        result[key] = Math.round(total * t[key]);
    }
    return result;
}


// =============================================================================
// INTEGRATION WITH ENGINE.JS
// =============================================================================

function refreshScoring() {
    var data = typeof collectFormData === 'function' ? collectFormData() : {};
    var result = calculatePatrimonialScore(data);

    // Update dashboard elements
    renderScoreGauge('score-gauge-main', result.global, 'Score patrimonial');
    renderSubScores('sub-scores-container', result.scores);
    renderAlerts('alerts-container', result.alerts, 5);
    renderAlerts('dashboard-alerts', result.alerts, 3);
    renderActionPlan('action-plan-container', result.actions);
    renderAllocationComparison('allocation-comparison', data);

    // Render detailed scores if container exists
    renderDetailedSubScores('sub-scores-detailed-container', result.scoreDetails);

    // Update score badge on dashboard
    var scoreBadge = document.getElementById('dash-score');
    if (scoreBadge) scoreBadge.textContent = result.global + '/100';

    // Update section-level pages
    refreshScoringPages(result, data);

    // Store for access elsewhere (engine.js PDF export uses this)
    window._patriScore = result;

    // Update synthesis dashboard if function exists (defined in engine.js)
    if (typeof renderSynthesisDashboard === 'function' && typeof collectFormData === 'function') {
        var d = collectFormData();
        var totalImmo = (d.immoRP || 0) + (d.immoRS || 0) + (d.immoLoc1 || 0) + (d.immoLoc2 || 0) + (d.immoSCPI || 0) + (d.immoPro || 0) + (d.immoAutres || 0);
        var totalFin = (d.livrets || 0) + (d.pel || 0) + (d.assuranceVie || 0) + (d.pea || 0) + (d.cto || 0) + (d.per || 0) + (d.epargneSalariale || 0) + (d.autresPlacement || 0);
        var dettes = (d.capitalRestantRP || 0) + (d.immoRP_creditRestant || 0) + (d.immoRS_creditRestant || 0) + (d.immoLoc1_creditRestant || 0) + (d.immoLoc2_creditRestant || 0);
        var patriBrut = totalImmo + totalFin;
        var patriNet = patriBrut - dettes;
        var tauxEndettement = patriBrut > 0 ? dettes / patriBrut : 0;
        var classe = typeof getPatrimoineClasse === 'function' ? getPatrimoineClasse(patriNet) : '';
        renderSynthesisDashboard(d, patriBrut, patriNet, tauxEndettement, totalImmo, totalFin, classe);
    }

    return result;
}

function refreshScoringPages(result, data) {
    // Plan d'action page
    renderScoreGauge('score-gauge-actions', result.global, 'Score patrimonial');
    var badgeActions = document.getElementById('score-badge-actions');
    if (badgeActions) badgeActions.textContent = result.global + '/100';

    // Allocation page
    var diversifScore = result.scores.diversification || 0;
    renderScoreGauge('score-gauge-alloc', diversifScore, 'Diversification');
    var badgeDiversif = document.getElementById('score-badge-diversif');
    if (badgeDiversif) badgeDiversif.textContent = diversifScore + '/100';

    // Detailed allocation on allocation page
    renderAllocationComparison('allocation-detail-comparison', data);

    // Allocation recommendations
    renderAllocationRecommendations('allocation-recommendations', data, result);

    // Alert summary bar
    renderAlertSummaryBar('alert-summary-bar', result.alerts);

    // Narrative synthesis if container exists
    renderNarrativeSynthesis('narrative-synthesis-container', result.narrative);
}

function renderAlertSummaryBar(containerId, alerts) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var counts = { critical: 0, warning: 0, info: 0, success: 0 };
    alerts.forEach(function(a) { counts[a.type] = (counts[a.type] || 0) + 1; });

    var items = [
        { type: 'critical', label: 'Critiques', color: '#dc3545' },
        { type: 'warning', label: 'Attention', color: '#e8a838' },
        { type: 'info', label: 'Opportunit\u00e9s', color: '#c1925e' },
        { type: 'success', label: 'Points forts', color: '#28a745' }
    ];

    var html = '';
    items.forEach(function(item) {
        html += '<div class="alert-summary-item">' +
            '<div class="alert-summary-count" style="background:' + item.color + ';">' + counts[item.type] + '</div>' +
            '<span>' + item.label + '</span>' +
            '</div>';
    });
    el.innerHTML = html;
}

function renderAllocationRecommendations(containerId, data, result) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var totalImmo = (data.immoRP || 0) + (data.immoRS || 0) + (data.immoLoc1 || 0) + (data.immoLoc2 || 0) + (data.immoSCPI || 0) + (data.immoPro || 0) + (data.immoAutres || 0);
    var totalFin = (data.livrets || 0) + (data.pel || 0) + (data.assuranceVie || 0) + (data.pea || 0) + (data.cto || 0) + (data.per || 0) + (data.epargneSalariale || 0) + (data.autresPlacement || 0);
    var total = totalImmo + totalFin;

    if (total === 0) {
        el.innerHTML = '<p style="color:#6b7b8d;text-align:center;padding:20px;">Compl\u00e9tez votre profil patrimonial pour obtenir des recommandations d\u2019allocation.</p>';
        return;
    }

    var profil = normalizeProfile(data.profilRisque);
    var target = getTargetAllocation(profil, total);
    var current = {
        'Immobilier': totalImmo,
        'Assurance-vie': data.assuranceVie || 0,
        'PEA': data.pea || 0,
        'CTO': data.cto || 0,
        'PER': data.per || 0,
        'SCPI': data.immoSCPI || 0,
        'Liquidit\u00e9s': (data.livrets || 0) + (data.pel || 0)
    };

    var html = '<div class="alloc-reco-list">';
    for (var key in target) {
        var diff = (target[key] || 0) - (current[key] || 0);
        if (Math.abs(diff) > total * 0.03) {
            var direction = diff > 0 ? 'Renforcer' : 'R\u00e9duire';
            var color = diff > 0 ? '#28a745' : '#dc3545';
            var arrow = diff > 0 ? '&#9650;' : '&#9660;';
            html += '<div class="alloc-reco-item">' +
                '<span class="alloc-reco-arrow" style="color:' + color + ';">' + arrow + '</span>' +
                '<span class="alloc-reco-text"><strong>' + direction + '</strong> ' + key + ' de ' + formatEuro(Math.abs(diff)) + '</span>' +
                '</div>';
        }
    }
    html += '</div>';

    if (html === '<div class="alloc-reco-list"></div>') {
        html = '<p style="color:#28a745;text-align:center;padding:20px;font-weight:600;">Votre allocation est globalement en ligne avec le profil ' + profil + '. Aucun ajustement majeur n\u00e9cessaire.</p>';
    }

    el.innerHTML = html;
}

function renderNarrativeSynthesis(containerId, narrative) {
    var el = document.getElementById(containerId);
    if (!el || !narrative) return;

    var html = '<div class="narrative-synthesis">';
    html += '<div class="narrative-profil"><strong>Profil :</strong> ' + narrative.profilClient + '</div>';
    html += '<div class="narrative-situation"><strong>Situation :</strong> ' + narrative.situationGlobale + '</div>';

    if (narrative.forces.length > 0) {
        html += '<div class="narrative-forces"><strong>Points forts :</strong><ul>';
        narrative.forces.forEach(function(f) { html += '<li>' + f + '</li>'; });
        html += '</ul></div>';
    }

    if (narrative.fragilites.length > 0) {
        html += '<div class="narrative-fragilites"><strong>Points d\u2019attention :</strong><ul>';
        narrative.fragilites.forEach(function(f) { html += '<li>' + f + '</li>'; });
        html += '</ul></div>';
    }

    if (narrative.prioritesAction.length > 0) {
        html += '<div class="narrative-actions"><strong>Priorit\u00e9s d\u2019action :</strong><ul>';
        narrative.prioritesAction.forEach(function(a) { html += '<li>' + a + '</li>'; });
        html += '</ul></div>';
    }

    html += '<div class="narrative-text" style="margin-top:12px;padding:12px;background:rgba(193,146,94,0.05);border-radius:8px;border-left:3px solid #c1925e;font-style:italic;">';
    html += narrative.syntheseNarrative;
    html += '</div>';

    html += '</div>';
    el.innerHTML = html;
}


// =============================================================================
// ACTION FILTERING
// =============================================================================

function filterActions(filter, btn) {
    document.querySelectorAll('.action-plan-filters .filter-btn').forEach(function(b) {
        b.classList.remove('active');
    });
    if (btn) btn.classList.add('active');

    var cards = document.querySelectorAll('#action-plan-container .action-card');
    cards.forEach(function(card) {
        if (filter === 'all') {
            card.style.display = '';
        } else {
            var priority = card.querySelector('.action-priority');
            if (priority) {
                var text = priority.textContent.toLowerCase();
                var match = (filter === 'urgent' && text.includes('urgent')) ||
                           (filter === 'important' && text.includes('important')) ||
                           (filter === 'opportunite' && text.includes('opportunit'));
                card.style.display = match ? '' : 'none';
            }
        }
    });
}


// =============================================================================
// AUTO-REFRESH ON LOAD
// =============================================================================

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(refreshScoring, 1000);
    });
}
