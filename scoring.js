// ===== SCORING PATRIMONIAL V2 =====
// Score global /100 + sous-scores + alertes intelligentes + plan d'action
// Patria Capital — Cockpit Patrimonial

const SCORING = {

    // ===== WEIGHT CONFIGURATION =====
    weights: {
        diversification: 20,
        fiscalite: 20,
        liquidite: 15,
        risque: 15,
        coherence: 15,
        structuration: 15
    },

    // ===== THRESHOLDS =====
    thresholds: {
        immoPctMax: 0.70,      // >70% immo = alert
        immoPctTarget: 0.50,    // 50% immo = ideal
        liquiditePctMin: 0.05,  // <5% liquide = alert
        liquiditePctTarget: 0.15, // 15% = ideal
        endettementMax: 0.40,   // >40% = danger
        endettementTarget: 0.25, // <25% = bon
        enveloppeFiscaleMin: 0.20, // <20% en enveloppes fiscales = sous-optimisé
        concentrationMax: 0.60, // >60% sur un seul actif = trop concentré
        epargneMinPct: 0.10,   // <10% taux d'épargne = faible
        tresoImproductiveMax: 0.20 // >20% en livrets = improductif
    },

    // ===== ALERT DEFINITIONS =====
    alertTypes: {
        critical: { label: 'Critique', color: '#dc3545', icon: '⚠️', priority: 1 },
        warning: { label: 'Attention', color: '#e8a838', icon: '⚡', priority: 2 },
        info: { label: 'Opportunité', color: '#c1925e', icon: '💡', priority: 3 },
        success: { label: 'Acquis', color: '#28a745', icon: '✓', priority: 4 }
    }
};

// ===== SCORE CALCULATION ENGINE =====

function calculatePatrimonialScore(data) {
    if (!data) data = typeof collectFormData === 'function' ? collectFormData() : {};

    const cfg = typeof getEffectiveConfig === 'function' ? getEffectiveConfig() : (typeof CONFIG !== 'undefined' ? CONFIG : {});

    // Gather key metrics
    const totalRevenusClient = (data.salairesClient || 0) + (data.revenusBIC || 0) + (data.dividendes || 0) + (data.revenusFonciers || 0) + (data.pensions || 0) + (data.autresRevenus || 0);
    const totalRevenusConjoint = data.salairesConjoint || 0;
    const totalRevenus = totalRevenusClient + totalRevenusConjoint;

    const totalCharges = (data.loyer || 0) + (data.creditRP || 0) + (data.creditLocatif || 0) + (data.creditConso || 0) + (data.pensionAlim || 0) + (data.autresCharges || 0);
    const capaciteEpargne = totalRevenus > 0 ? ((totalRevenus / 12) - totalCharges) : 0;
    const tauxEpargne = totalRevenus > 0 ? (capaciteEpargne * 12) / totalRevenus : 0;

    const totalImmo = (data.immoRP || 0) + (data.immoRS || 0) + (data.immoLoc1 || 0) + (data.immoLoc2 || 0) + (data.immoSCPI || 0) + (data.immoPro || 0) + (data.immoAutres || 0);
    const totalFin = (data.livrets || 0) + (data.pel || 0) + (data.assuranceVie || 0) + (data.pea || 0) + (data.cto || 0) + (data.per || 0) + (data.epargneSalariale || 0) + (data.autresPlacement || 0);
    const dettes = (data.capitalRestantRP || 0) + (data.immoRP_creditRestant || 0) + (data.immoRS_creditRestant || 0) + (data.immoLoc1_creditRestant || 0) + (data.immoLoc2_creditRestant || 0);

    const patriBrut = totalImmo + totalFin;
    const patriNet = patriBrut - dettes;

    // Calculate enveloppes fiscales utilisées
    const enveloppeFiscale = (data.assuranceVie || 0) + (data.pea || 0) + (data.per || 0);
    const pctEnveloppeFiscale = totalFin > 0 ? enveloppeFiscale / totalFin : 0;

    // Calculate liquidités (livrets + PEL + trésorerie)
    const liquidites = (data.livrets || 0) + (data.pel || 0);
    const pctLiquidites = patriBrut > 0 ? liquidites / patriBrut : 0;

    // Ratios
    const pctImmo = patriBrut > 0 ? totalImmo / patriBrut : 0;
    const pctFin = patriBrut > 0 ? totalFin / patriBrut : 0;
    const tauxEndettement = patriBrut > 0 ? dettes / patriBrut : 0;

    // Trésorerie improductive
    const tresoImproductive = patriBrut > 0 ? liquidites / patriBrut : 0;

    // TMI
    const tmi = parseFloat(data.tmi) || 0;

    // Profile data
    const horizon = data.horizonAnnees || 8;
    const profil = (data.profilRisque || '').toLowerCase();
    const objectif = data.objectifPrincipal || '';
    const age = data.dateNaissance ? Math.floor((Date.now() - new Date(data.dateNaissance).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 40;
    const nbEnfants = parseInt(data.nbEnfants) || 0;
    const testament = data.testament || false;
    const preoccSucc = data.preoccSucc || '';

    // ===== SUB-SCORES =====
    var scores = {};

    // 1. DIVERSIFICATION (0-100)
    scores.diversification = calcDiversificationScore(pctImmo, pctFin, pctLiquidites, totalImmo, totalFin, data);

    // 2. OPTIMISATION FISCALE (0-100)
    scores.fiscalite = calcFiscaliteScore(pctEnveloppeFiscale, tmi, data, totalRevenus, totalFin);

    // 3. LIQUIDITÉ (0-100)
    scores.liquidite = calcLiquiditeScore(pctLiquidites, tresoImproductive, capaciteEpargne, totalRevenus);

    // 4. RISQUE (0-100)
    scores.risque = calcRisqueScore(tauxEndettement, pctImmo, profil, age, horizon, data);

    // 5. COHÉRENCE AVEC OBJECTIFS (0-100)
    scores.coherence = calcCoherenceScore(objectif, profil, horizon, age, data, pctImmo, pctFin, pctEnveloppeFiscale);

    // 6. STRUCTURATION (0-100)
    scores.structuration = calcStructurationScore(data, nbEnfants, age, testament, preoccSucc, patriNet);

    // Global score (weighted average)
    var totalWeight = 0;
    var weightedSum = 0;
    for (var key in SCORING.weights) {
        if (scores[key] !== undefined) {
            weightedSum += scores[key] * SCORING.weights[key];
            totalWeight += SCORING.weights[key];
        }
    }
    var globalScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

    // ===== ALERTS =====
    var alerts = generateAlerts(data, scores, {
        pctImmo: pctImmo, pctFin: pctFin, pctLiquidites: pctLiquidites,
        tauxEndettement: tauxEndettement, tresoImproductive: tresoImproductive,
        pctEnveloppeFiscale: pctEnveloppeFiscale, tmi: tmi,
        totalRevenus: totalRevenus, capaciteEpargne: capaciteEpargne,
        patriNet: patriNet, patriBrut: patriBrut, age: age,
        nbEnfants: nbEnfants, testament: testament, preoccSucc: preoccSucc,
        totalImmo: totalImmo, totalFin: totalFin, liquidites: liquidites,
        enveloppeFiscale: enveloppeFiscale
    });

    // ===== PLAN D'ACTION =====
    var actions = generateActionPlan(data, scores, alerts, {
        pctImmo: pctImmo, pctFin: pctFin, pctLiquidites: pctLiquidites,
        tauxEndettement: tauxEndettement, tresoImproductive: tresoImproductive,
        pctEnveloppeFiscale: pctEnveloppeFiscale, tmi: tmi,
        totalRevenus: totalRevenus, capaciteEpargne: capaciteEpargne,
        patriNet: patriNet, age: age, nbEnfants: nbEnfants,
        totalImmo: totalImmo, totalFin: totalFin, liquidites: liquidites,
        enveloppeFiscale: enveloppeFiscale
    });

    return {
        global: globalScore,
        scores: scores,
        alerts: alerts,
        actions: actions,
        metrics: {
            patriNet: patriNet, patriBrut: patriBrut,
            totalImmo: totalImmo, totalFin: totalFin,
            pctImmo: pctImmo, pctFin: pctFin,
            pctLiquidites: pctLiquidites, tauxEndettement: tauxEndettement,
            tauxEpargne: tauxEpargne, tmi: tmi
        }
    };
}

// ===== SUB-SCORE CALCULATORS =====

function calcDiversificationScore(pctImmo, pctFin, pctLiquidites, totalImmo, totalFin, data) {
    var score = 50; // Base

    // Pénalité concentration immobilière
    if (pctImmo > 0.80) score -= 35;
    else if (pctImmo > 0.70) score -= 25;
    else if (pctImmo > 0.60) score -= 15;
    else if (pctImmo > 0.50) score -= 5;

    // Bonus diversification financière
    var nbSupports = 0;
    if (data.assuranceVie > 0) nbSupports++;
    if (data.pea > 0) nbSupports++;
    if (data.cto > 0) nbSupports++;
    if (data.per > 0) nbSupports++;
    if (data.immoSCPI > 0) nbSupports++;
    if (data.epargneSalariale > 0) nbSupports++;

    if (nbSupports >= 5) score += 30;
    else if (nbSupports >= 4) score += 20;
    else if (nbSupports >= 3) score += 10;
    else if (nbSupports >= 2) score += 5;
    else if (nbSupports <= 1) score -= 15;

    // Bonus si équilibre immo/fin
    if (pctImmo >= 0.35 && pctImmo <= 0.55) score += 15;
    else if (pctImmo >= 0.25 && pctImmo <= 0.65) score += 5;

    // Pénalité si tout en liquidités
    if (pctLiquidites > 0.50) score -= 20;

    return Math.max(0, Math.min(100, score));
}

function calcFiscaliteScore(pctEnveloppeFiscale, tmi, data, totalRevenus, totalFin) {
    var score = 50;

    // Bonus utilisation enveloppes fiscales
    if (pctEnveloppeFiscale >= 0.60) score += 25;
    else if (pctEnveloppeFiscale >= 0.40) score += 15;
    else if (pctEnveloppeFiscale >= 0.20) score += 5;
    else score -= 20;

    // PEA ouvert et utilisé
    if (data.pea > 0) score += 10;
    else if (tmi >= 0.30) score -= 10; // PEA manquant avec TMI élevé

    // PER pertinent si TMI élevé
    if (tmi >= 0.41 && (data.per || 0) === 0) score -= 15;
    else if (tmi >= 0.30 && data.per > 0) score += 10;
    else if (tmi >= 0.41 && data.per > 0) score += 15;

    // AV ouverte
    if (data.assuranceVie > 0) score += 5;
    else score -= 5;

    // CTO seul = sous-optimal
    if (data.cto > 0 && (data.pea || 0) === 0 && (data.assuranceVie || 0) === 0) score -= 15;

    return Math.max(0, Math.min(100, score));
}

function calcLiquiditeScore(pctLiquidites, tresoImproductive, capaciteEpargne, totalRevenus) {
    var score = 50;

    // Trop de liquidités improductives
    if (tresoImproductive > 0.30) score -= 25;
    else if (tresoImproductive > 0.20) score -= 15;
    else if (tresoImproductive > 0.15) score -= 5;

    // Pas assez de liquidités (épargne de précaution)
    if (pctLiquidites < 0.03) score -= 20;
    else if (pctLiquidites < 0.05) score -= 10;
    else if (pctLiquidites >= 0.05 && pctLiquidites <= 0.15) score += 20;

    // Capacité d'épargne positive
    if (capaciteEpargne > 0) {
        var tauxEpargne = totalRevenus > 0 ? (capaciteEpargne * 12) / totalRevenus : 0;
        if (tauxEpargne >= 0.20) score += 20;
        else if (tauxEpargne >= 0.10) score += 10;
        else score += 5;
    } else {
        score -= 15;
    }

    return Math.max(0, Math.min(100, score));
}

function calcRisqueScore(tauxEndettement, pctImmo, profil, age, horizon, data) {
    var score = 60;

    // Endettement
    if (tauxEndettement > 0.50) score -= 30;
    else if (tauxEndettement > 0.40) score -= 20;
    else if (tauxEndettement > 0.30) score -= 10;
    else if (tauxEndettement <= 0.20) score += 10;

    // Concentration risque immobilier
    if (pctImmo > 0.80) score -= 15;
    else if (pctImmo > 0.70) score -= 10;

    // Adéquation profil/allocation
    if (profil === 'securitaire' || profil === 'prudent') {
        if (pctImmo > 0.60) score -= 10; // Trop exposé immo pour un prudent
    }
    if (profil === 'dynamique' || profil === 'offensif') {
        if (pctImmo < 0.20 && (data.pea || 0) === 0) score -= 5; // Sous-exposé pour un dynamique
    }

    // Âge et horizon
    if (age > 55 && tauxEndettement > 0.30) score -= 10;
    if (age > 60 && pctImmo > 0.70) score -= 10;

    return Math.max(0, Math.min(100, score));
}

function calcCoherenceScore(objectif, profil, horizon, age, data, pctImmo, pctFin, pctEnveloppeFiscale) {
    var score = 50;

    // Objectif vs allocation
    if (objectif === 'Transmission') {
        if (data.assuranceVie > 0) score += 15;
        if (data.preoccSucc === 'Priorite') score += 10;
        if ((data.testament || false) === true) score += 5;
        else score -= 10;
    }
    if (objectif === 'Retraite') {
        if (data.per > 0) score += 15;
        if (horizon >= 10) score += 10;
        else score -= 5;
    }
    if (objectif === 'Fiscal') {
        if (pctEnveloppeFiscale >= 0.40) score += 15;
        else score -= 10;
    }
    if (objectif === 'Valorisation') {
        if (data.pea > 0 || data.cto > 0) score += 10;
        if (horizon >= 8) score += 10;
    }
    if (objectif === 'Revenus') {
        if (data.revenusFonciers > 0 || data.immoSCPI > 0) score += 10;
        if (data.assuranceVie > 0) score += 5;
    }

    // Profil vs horizon
    if ((profil === 'dynamique' || profil === 'offensif') && horizon < 5) score -= 15;
    if ((profil === 'securitaire' || profil === 'prudent') && horizon > 15) score += 5;

    // Apport disponible vs investissement
    if ((data.apportDispo || 0) > 0 && pctFin < 0.20) score -= 5;

    return Math.max(0, Math.min(100, score));
}

function calcStructurationScore(data, nbEnfants, age, testament, preoccSucc, patriNet) {
    var score = 50;

    // Protection familiale
    if (nbEnfants > 0) {
        if (data.assuranceVie > 0) score += 10;
        if (testament) score += 10;
        else score -= 10;
        if (preoccSucc === 'Priorite') score += 5;
    }

    // Régime matrimonial adapté
    if (data.situationMatri === 'Marie(e)' && data.regimeMatri) score += 5;

    // Démembrement / donation anticipée
    if (data.donationRealisee) score += 10;

    // Diversité des enveloppes juridiques
    var nbStructures = 0;
    if (data.assuranceVie > 0) nbStructures++;
    if (data.pea > 0) nbStructures++;
    if (data.per > 0) nbStructures++;
    if ((data.immoLoc1 || 0) > 0 || (data.immoLoc2 || 0) > 0) nbStructures++;
    if (data.immoSCPI > 0) nbStructures++;

    if (nbStructures >= 4) score += 15;
    else if (nbStructures >= 3) score += 10;
    else if (nbStructures >= 2) score += 5;

    // Patrimoine significatif sans structuration
    if (patriNet > 1000000 && nbStructures < 3) score -= 15;
    if (patriNet > 500000 && !testament && nbEnfants > 0) score -= 10;

    return Math.max(0, Math.min(100, score));
}

// ===== ALERT GENERATION =====

function generateAlerts(data, scores, m) {
    var alerts = [];

    // CRITICAL ALERTS
    if (m.pctImmo > 0.80) {
        alerts.push({
            type: 'critical',
            category: 'diversification',
            title: 'Concentration immobilière excessive',
            message: 'Votre patrimoine est concentré à ' + Math.round(m.pctImmo * 100) + '% en immobilier. Ce niveau d\'exposition crée un risque de liquidité et de concentration significatif.',
            action: 'Envisager une diversification vers des actifs financiers (AV, PEA, SCPI).',
            impact: 'Réduction du risque de concentration et amélioration de la liquidité globale.'
        });
    }

    if (m.tauxEndettement > 0.45) {
        alerts.push({
            type: 'critical',
            category: 'risque',
            title: 'Endettement élevé',
            message: 'Votre taux d\'endettement patrimonial atteint ' + Math.round(m.tauxEndettement * 100) + '%. Ce niveau peut fragiliser votre situation en cas de retournement.',
            action: 'Prioriser le désendettement ou la constitution de réserves.',
            impact: 'Sécurisation du patrimoine et réduction de la pression financière.'
        });
    }

    if (m.capaciteEpargne < 0) {
        alerts.push({
            type: 'critical',
            category: 'liquidite',
            title: 'Capacité d\'épargne négative',
            message: 'Vos charges mensuelles excèdent vos revenus. Cette situation nécessite une action immédiate.',
            action: 'Revoir la structure de charges et les crédits en cours.',
            impact: 'Rétablissement de l\'équilibre budgétaire.'
        });
    }

    // WARNING ALERTS
    if (m.pctImmo > 0.65 && m.pctImmo <= 0.80) {
        alerts.push({
            type: 'warning',
            category: 'diversification',
            title: 'Surexposition immobilière',
            message: 'Votre patrimoine est exposé à ' + Math.round(m.pctImmo * 100) + '% en immobilier, au-dessus du seuil recommandé de 50-60%.',
            action: 'Envisager un rééquilibrage progressif vers des actifs financiers.',
            impact: 'Meilleure diversification et liquidité accrue.'
        });
    }

    if (m.tresoImproductive > 0.20) {
        alerts.push({
            type: 'warning',
            category: 'liquidite',
            title: 'Trésorerie improductive importante',
            message: Math.round(m.tresoImproductive * 100) + '% de votre patrimoine est placé sur des supports à faible rendement (livrets, PEL). Ce capital pourrait être mieux employé.',
            action: 'Réallouer l\'excédent de trésorerie vers des enveloppes adaptées (AV, PEA, PER).',
            impact: 'Gain de rendement estimé de ' + (m.liquidites > 0 ? formatEuro(m.liquidites * 0.03) : '—') + '/an.'
        });
    }

    if (m.tmi >= 0.41 && m.pctEnveloppeFiscale < 0.30) {
        alerts.push({
            type: 'warning',
            category: 'fiscalite',
            title: 'Enveloppes fiscales sous-utilisées',
            message: 'Avec un TMI à ' + Math.round(m.tmi * 100) + '%, vos enveloppes fiscales (AV, PEA, PER) ne représentent que ' + Math.round(m.pctEnveloppeFiscale * 100) + '% de votre épargne financière.',
            action: 'Maximiser les versements sur PER (déduction fiscale) et PEA (exonération IR après 5 ans).',
            impact: 'Économie fiscale potentielle significative.'
        });
    }

    if (m.tmi >= 0.30 && (data.pea || 0) === 0) {
        alerts.push({
            type: 'warning',
            category: 'fiscalite',
            title: 'PEA non ouvert',
            message: 'Vous ne disposez pas de PEA. Cette enveloppe offre une exonération d\'IR après 5 ans de détention.',
            action: 'Ouvrir un PEA pour prendre date fiscale, même avec un versement minimal.',
            impact: 'Économie de ' + Math.round(m.tmi * 100 - 17.2) + ' points de fiscalité sur les plus-values après 5 ans.'
        });
    }

    if (m.tmi >= 0.41 && (data.per || 0) === 0) {
        alerts.push({
            type: 'warning',
            category: 'fiscalite',
            title: 'PER non ouvert',
            message: 'Avec un TMI à ' + Math.round(m.tmi * 100) + '%, le PER offre une déduction fiscale immédiate sur les versements.',
            action: 'Ouvrir un PER et optimiser les versements dans la limite du plafond.',
            impact: 'Économie fiscale jusqu\'à ' + formatEuro(Math.min(m.totalRevenus * 0.10, 37094) * m.tmi) + '/an.'
        });
    }

    if (m.nbEnfants > 0 && !(data.testament) && m.patriNet > 300000) {
        alerts.push({
            type: 'warning',
            category: 'structuration',
            title: 'Succession non préparée',
            message: 'Votre patrimoine dépasse 300 k€ et vous avez ' + m.nbEnfants + ' enfant(s), mais aucune disposition testamentaire ou de transmission n\'est en place.',
            action: 'Consulter un notaire, envisager des donations ou un démembrement.',
            impact: 'Optimisation des droits de succession et protection familiale.'
        });
    }

    // OPPORTUNITY ALERTS
    if (m.pctEnveloppeFiscale >= 0.50 && m.tmi <= 0.30) {
        alerts.push({
            type: 'success',
            category: 'fiscalite',
            title: 'Bonne utilisation des enveloppes fiscales',
            message: 'Vos enveloppes fiscales sont bien utilisées au regard de votre TMI.',
            action: null,
            impact: null
        });
    }

    if (m.pctImmo >= 0.30 && m.pctImmo <= 0.55 && m.pctFin >= 0.30) {
        alerts.push({
            type: 'success',
            category: 'diversification',
            title: 'Bonne diversification patrimoniale',
            message: 'L\'équilibre entre immobilier et financier est satisfaisant.',
            action: null,
            impact: null
        });
    }

    if (m.tauxEndettement <= 0.20 && m.tauxEndettement > 0) {
        alerts.push({
            type: 'success',
            category: 'risque',
            title: 'Endettement maîtrisé',
            message: 'Votre taux d\'endettement patrimonial est contenu à ' + Math.round(m.tauxEndettement * 100) + '%.',
            action: null,
            impact: null
        });
    }

    // Sort by priority
    alerts.sort(function(a, b) {
        var pA = SCORING.alertTypes[a.type] ? SCORING.alertTypes[a.type].priority : 99;
        var pB = SCORING.alertTypes[b.type] ? SCORING.alertTypes[b.type].priority : 99;
        return pA - pB;
    });

    return alerts;
}

// ===== PLAN D'ACTION GENERATION =====

function generateActionPlan(data, scores, alerts, m) {
    var actions = [];
    var savedActions = JSON.parse(localStorage.getItem('patria_action_plan') || '[]');

    // Map saved statuses
    var statusMap = {};
    savedActions.forEach(function(a) { statusMap[a.id] = a.status; });

    // Generate actions from alerts and scores
    if ((data.pea || 0) === 0 && m.tmi >= 0.30) {
        actions.push({
            id: 'open-pea',
            title: 'Ouvrir un PEA',
            description: 'Prendre date fiscale sur un PEA pour bénéficier de l\'exonération d\'IR après 5 ans.',
            priority: 'urgent',
            category: 'fiscalite',
            gain: 'Exonération IR sur les plus-values (économie de ' + Math.round((m.tmi - 0.172) * 100) + ' points)',
            effort: 'Faible',
            horizon: 'Immédiat',
            status: statusMap['open-pea'] || 'todo'
        });
    }

    if (m.tmi >= 0.41 && (data.per || 0) === 0) {
        actions.push({
            id: 'open-per',
            title: 'Ouvrir un PER',
            description: 'Déduire vos versements de votre revenu imposable et constituer un capital retraite.',
            priority: 'urgent',
            category: 'fiscalite',
            gain: formatEuro(Math.min(m.totalRevenus * 0.10, 37094) * m.tmi) + '/an d\'économie fiscale',
            effort: 'Faible',
            horizon: 'Immédiat',
            status: statusMap['open-per'] || 'todo'
        });
    }

    if (m.tresoImproductive > 0.20 && m.liquidites > 20000) {
        var excedent = m.liquidites - (m.patriNet > 0 ? m.patriNet * 0.10 : 20000);
        if (excedent > 0) {
            actions.push({
                id: 'realloc-treso',
                title: 'Réallouer la trésorerie excédentaire',
                description: 'Transférer ' + formatEuro(excedent) + ' de liquidités improductives vers des supports adaptés.',
                priority: 'important',
                category: 'allocation',
                gain: 'Rendement additionnel estimé : ' + formatEuro(excedent * 0.035) + '/an',
                effort: 'Moyen',
                horizon: '1-3 mois',
                status: statusMap['realloc-treso'] || 'todo'
            });
        }
    }

    if (m.pctImmo > 0.70) {
        actions.push({
            id: 'diversif-immo',
            title: 'Rééquilibrer le patrimoine immobilier',
            description: 'Réduire la concentration immobilière de ' + Math.round(m.pctImmo * 100) + '% vers un objectif de 50-55%.',
            priority: 'important',
            category: 'diversification',
            gain: 'Meilleure liquidité, réduction du risque de concentration',
            effort: 'Élevé',
            horizon: '6-18 mois',
            status: statusMap['diversif-immo'] || 'todo'
        });
    }

    if ((data.assuranceVie || 0) === 0 && m.patriNet > 50000) {
        actions.push({
            id: 'open-av',
            title: 'Ouvrir un contrat d\'assurance-vie',
            description: 'Prendre date fiscale et préparer la transmission (abattement 152 500 €/bénéficiaire).',
            priority: 'important',
            category: 'structuration',
            gain: 'Fiscalité allégée après 8 ans + avantage successoral',
            effort: 'Faible',
            horizon: 'Immédiat',
            status: statusMap['open-av'] || 'todo'
        });
    }

    if (m.nbEnfants > 0 && !data.testament && m.patriNet > 300000) {
        actions.push({
            id: 'prep-succession',
            title: 'Préparer la transmission',
            description: 'Mettre en place des dispositions testamentaires et envisager des donations anticipées.',
            priority: 'important',
            category: 'structuration',
            gain: 'Optimisation des droits de succession, protection du conjoint',
            effort: 'Moyen',
            horizon: '3-6 mois',
            status: statusMap['prep-succession'] || 'todo'
        });
    }

    if (scores.diversification < 40) {
        actions.push({
            id: 'improve-diversif',
            title: 'Améliorer la diversification',
            description: 'Votre score de diversification est de ' + scores.diversification + '/100. Envisagez d\'élargir vos supports d\'investissement.',
            priority: 'opportunite',
            category: 'diversification',
            gain: 'Réduction du risque global et optimisation du rendement ajusté',
            effort: 'Moyen',
            horizon: '3-12 mois',
            status: statusMap['improve-diversif'] || 'todo'
        });
    }

    if (m.capaciteEpargne > 500 && (data.epargneMensuelle || 0) === 0) {
        actions.push({
            id: 'versements-prog',
            title: 'Mettre en place des versements programmés',
            description: 'Automatiser l\'épargne mensuelle pour capitaliser régulièrement.',
            priority: 'opportunite',
            category: 'allocation',
            gain: 'Constitution de capital par effet de lissage',
            effort: 'Faible',
            horizon: 'Immédiat',
            status: statusMap['versements-prog'] || 'todo'
        });
    }

    // Sort by priority
    var priorityOrder = { urgent: 1, important: 2, opportunite: 3 };
    actions.sort(function(a, b) {
        return (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);
    });

    return actions;
}

// ===== ACTION STATUS MANAGEMENT =====

function updateActionStatus(actionId, newStatus) {
    var saved = JSON.parse(localStorage.getItem('patria_action_plan') || '[]');
    var found = false;
    saved.forEach(function(a) {
        if (a.id === actionId) { a.status = newStatus; a.updatedAt = new Date().toISOString(); found = true; }
    });
    if (!found) saved.push({ id: actionId, status: newStatus, updatedAt: new Date().toISOString() });
    localStorage.setItem('patria_action_plan', JSON.stringify(saved));
}

// ===== DISPLAY FUNCTIONS =====

function renderScoreGauge(containerId, score, label) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var color = score >= 70 ? '#28a745' : score >= 50 ? '#e8a838' : '#dc3545';
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

    var labels = {
        diversification: 'Diversification',
        fiscalite: 'Optimisation fiscale',
        liquidite: 'Liquidité',
        risque: 'Maîtrise du risque',
        coherence: 'Cohérence objectifs',
        structuration: 'Structuration'
    };

    var html = '<div class="sub-scores-grid">';
    for (var key in scores) {
        var s = scores[key];
        var color = s >= 70 ? '#28a745' : s >= 50 ? '#e8a838' : '#dc3545';
        var width = Math.max(s, 5);
        html += '<div class="sub-score-item">' +
            '<div class="sub-score-header">' +
            '<span class="sub-score-label">' + (labels[key] || key) + '</span>' +
            '<span class="sub-score-value" style="color:' + color + ';">' + s + '/100</span>' +
            '</div>' +
            '<div class="sub-score-bar"><div class="sub-score-fill" style="width:' + width + '%;background:' + color + ';"></div></div>' +
            '</div>';
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
        el.innerHTML = '<div class="alert-empty">Aucune alerte détectée. Votre situation semble bien structurée.</div>';
        return;
    }

    var html = '<div class="alerts-list">';
    displayed.forEach(function(alert) {
        var type = SCORING.alertTypes[alert.type] || SCORING.alertTypes.info;
        html += '<div class="alert-card alert-' + alert.type + '">' +
            '<div class="alert-header">' +
            '<span class="alert-badge" style="background:' + type.color + ';">' + type.icon + ' ' + type.label + '</span>' +
            '<span class="alert-category">' + alert.category + '</span>' +
            '</div>' +
            '<h4 class="alert-title">' + alert.title + '</h4>' +
            '<p class="alert-message">' + alert.message + '</p>';
        if (alert.action) {
            html += '<div class="alert-action"><strong>Action recommandée :</strong> ' + alert.action + '</div>';
        }
        if (alert.impact) {
            html += '<div class="alert-impact"><strong>Impact attendu :</strong> ' + alert.impact + '</div>';
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
        el.innerHTML = '<div class="action-empty">Aucune action prioritaire identifiée pour le moment.</div>';
        return;
    }

    var priorityLabels = {
        urgent: { label: 'Urgent', color: '#dc3545', icon: '🔴' },
        important: { label: 'Important', color: '#e8a838', icon: '🟡' },
        opportunite: { label: 'Opportunité', color: '#c1925e', icon: '🟢' }
    };

    var statusLabels = {
        todo: { label: 'À faire', color: '#6b7b8d' },
        inprogress: { label: 'En cours', color: '#e8a838' },
        done: { label: 'Réalisé', color: '#28a745' }
    };

    var html = '<div class="action-plan-list">';
    actions.forEach(function(action) {
        var p = priorityLabels[action.priority] || priorityLabels.opportunite;
        var s = statusLabels[action.status] || statusLabels.todo;

        html += '<div class="action-card action-' + action.status + '">' +
            '<div class="action-header">' +
            '<span class="action-priority" style="background:' + p.color + ';">' + p.icon + ' ' + p.label + '</span>' +
            '<select class="action-status-select" data-action-id="' + action.id + '" onchange="handleActionStatusChange(this)">' +
            '<option value="todo"' + (action.status === 'todo' ? ' selected' : '') + '>À faire</option>' +
            '<option value="inprogress"' + (action.status === 'inprogress' ? ' selected' : '') + '>En cours</option>' +
            '<option value="done"' + (action.status === 'done' ? ' selected' : '') + '>Réalisé</option>' +
            '</select>' +
            '</div>' +
            '<h4 class="action-title">' + action.title + '</h4>' +
            '<p class="action-desc">' + action.description + '</p>' +
            '<div class="action-meta">' +
            '<span class="action-gain">💰 ' + action.gain + '</span>' +
            '<span class="action-effort">⚡ Effort : ' + action.effort + '</span>' +
            '<span class="action-horizon">📅 ' + action.horizon + '</span>' +
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

    // Update card visual
    var card = selectEl.closest('.action-card');
    if (card) {
        card.className = 'action-card action-' + newStatus;
    }
}

// ===== ALLOCATION VISUALIZATION =====

function renderAllocationComparison(containerId, data) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var totalImmo = (data.immoRP || 0) + (data.immoRS || 0) + (data.immoLoc1 || 0) + (data.immoLoc2 || 0) + (data.immoSCPI || 0) + (data.immoPro || 0) + (data.immoAutres || 0);
    var totalFin = (data.livrets || 0) + (data.pel || 0) + (data.assuranceVie || 0) + (data.pea || 0) + (data.cto || 0) + (data.per || 0) + (data.epargneSalariale || 0) + (data.autresPlacement || 0);
    var total = totalImmo + totalFin;
    if (total === 0) { el.innerHTML = ''; return; }

    // Current allocation
    var current = {
        'Immobilier': totalImmo,
        'Assurance-vie': data.assuranceVie || 0,
        'PEA': data.pea || 0,
        'CTO': data.cto || 0,
        'PER': data.per || 0,
        'SCPI': data.immoSCPI || 0,
        'Liquidités': (data.livrets || 0) + (data.pel || 0),
        'Autres': (data.epargneSalariale || 0) + (data.autresPlacement || 0)
    };

    // Target allocation (based on profile)
    var profil = (data.profilRisque || 'equilibre').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
    var target = getTargetAllocation(profil, total);

    var colors = {
        'Immobilier': '#254a65', 'Assurance-vie': '#c1925e', 'PEA': '#4a8b6e',
        'CTO': '#6b8bb5', 'PER': '#8b6bb5', 'SCPI': '#3a6d8c',
        'Liquidités': '#a0a8b0', 'Autres': '#7a8a9a'
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
        securitaire: { 'Immobilier': 0.30, 'Assurance-vie': 0.35, 'PEA': 0.05, 'PER': 0.10, 'SCPI': 0.10, 'Liquidités': 0.10 },
        prudent: { 'Immobilier': 0.35, 'Assurance-vie': 0.25, 'PEA': 0.10, 'PER': 0.10, 'SCPI': 0.10, 'Liquidités': 0.08, 'CTO': 0.02 },
        equilibre: { 'Immobilier': 0.40, 'Assurance-vie': 0.20, 'PEA': 0.15, 'PER': 0.08, 'SCPI': 0.08, 'Liquidités': 0.05, 'CTO': 0.04 },
        dynamique: { 'Immobilier': 0.35, 'Assurance-vie': 0.15, 'PEA': 0.20, 'CTO': 0.10, 'SCPI': 0.08, 'PER': 0.07, 'Liquidités': 0.05 },
        offensif: { 'Immobilier': 0.25, 'PEA': 0.25, 'CTO': 0.20, 'Assurance-vie': 0.10, 'SCPI': 0.10, 'PER': 0.05, 'Liquidités': 0.05 }
    };

    var t = targets[profil] || targets.equilibre;
    var result = {};
    for (var key in t) {
        result[key] = Math.round(total * t[key]);
    }
    return result;
}

// ===== UTILITY =====

function formatEuro(n) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

// ===== INTEGRATION WITH EXISTING ENGINE =====

function refreshScoring() {
    var data = typeof collectFormData === 'function' ? collectFormData() : {};
    var result = calculatePatrimonialScore(data);

    // Update dashboard elements if they exist
    renderScoreGauge('score-gauge-main', result.global, 'Score patrimonial');
    renderSubScores('sub-scores-container', result.scores);
    renderAlerts('alerts-container', result.alerts, 5);
    renderAlerts('dashboard-alerts', result.alerts, 3);
    renderActionPlan('action-plan-container', result.actions);
    renderAllocationComparison('allocation-comparison', data);

    // Update score badge on dashboard
    var scoreBadge = document.getElementById('dash-score');
    if (scoreBadge) scoreBadge.textContent = result.global + '/100';

    // Update section-level pages
    refreshScoringPages(result, data);

    // Store for access elsewhere
    window._patriScore = result;

    return result;
}

// ===== SECTION-LEVEL RENDERERS =====

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
}

function renderAlertSummaryBar(containerId, alerts) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var counts = { critical: 0, warning: 0, info: 0, success: 0 };
    alerts.forEach(function(a) { counts[a.type] = (counts[a.type] || 0) + 1; });

    var items = [
        { type: 'critical', label: 'Critiques', color: '#dc3545' },
        { type: 'warning', label: 'Attention', color: '#e8a838' },
        { type: 'info', label: 'Opportunités', color: '#c1925e' },
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
        el.innerHTML = '<p style="color:#6b7b8d;text-align:center;padding:20px;">Complétez votre profil patrimonial pour obtenir des recommandations d\'allocation.</p>';
        return;
    }

    var profil = (data.profilRisque || 'equilibre').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
    var target = getTargetAllocation(profil, total);
    var current = {
        'Immobilier': totalImmo,
        'Assurance-vie': data.assuranceVie || 0,
        'PEA': data.pea || 0,
        'CTO': data.cto || 0,
        'PER': data.per || 0,
        'SCPI': data.immoSCPI || 0,
        'Liquidités': (data.livrets || 0) + (data.pel || 0)
    };

    var html = '<div class="alloc-reco-list">';
    for (var key in target) {
        var diff = (target[key] || 0) - (current[key] || 0);
        if (Math.abs(diff) > total * 0.03) {
            var direction = diff > 0 ? 'Renforcer' : 'Réduire';
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
        html = '<p style="color:#28a745;text-align:center;padding:20px;font-weight:600;">Votre allocation est globalement en ligne avec le profil ' + profil + '. Aucun ajustement majeur nécessaire.</p>';
    }

    el.innerHTML = html;
}

// ===== ACTION FILTERING =====

function filterActions(filter, btn) {
    // Update button states
    document.querySelectorAll('.action-plan-filters .filter-btn').forEach(function(b) {
        b.classList.remove('active');
    });
    if (btn) btn.classList.add('active');

    // Filter action cards
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

// Auto-refresh on profile changes
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        // Refresh scoring after a short delay to ensure data is loaded
        setTimeout(refreshScoring, 1000);
    });
}
