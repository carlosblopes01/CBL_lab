/**
 * ============================================================================
 * PATRIA CAPITAL — Fichier de Configuration Centrale
 * ============================================================================
 *
 * Ce fichier centralise TOUS les parametres fiscaux, financiers et produits
 * utilises dans l'application. Aucune valeur ne doit etre codee en dur dans
 * engine.js ou tout autre module : tout doit etre lu depuis CONFIG.
 *
 * Les utilisateurs avances (administrateurs) peuvent surcharger les valeurs
 * via localStorage sans modifier le code source.
 *
 * Version : 2026.1 — Parametres applicables a compter du 01/01/2026
 * Pays    : France (FR)
 * ============================================================================
 */

const CONFIG = {

    // =========================================================================
    // 1. META — Informations generales sur cette configuration
    // =========================================================================
    meta: {
        version: '2026.1',
        lastUpdated: '2026-03-31',
        country: 'FR'
    },

    // =========================================================================
    // 2. PRELEVEMENTS SOCIAUX
    //    CSG 9,2% + CRDS 0,5% + Prelevement de solidarite 7,5% = 17,2%
    //    CSG deductible du revenu imposable : 6,8%
    // =========================================================================
    prelevementsSociaux: {
        taux: 0.172,
        /** Taux de CSG deductible du revenu imposable (applicable aux revenus du patrimoine) */
        csgDeductible: 0.068
    },

    // =========================================================================
    // 3. PFU — Prelevement Forfaitaire Unique (flat tax)
    //    IR 12,8% + PS 17,2% = 30%
    // =========================================================================
    pfu: {
        taux: 0.30
    },

    // =========================================================================
    // 4. IMPOT SUR LE REVENU — Bareme progressif 2026
    //    5 tranches (revenus 2025 declares en 2026)
    //    tmiTranches : tableau utilise pour determiner la TMI du foyer fiscal
    // =========================================================================
    ir: {
        /** Bareme progressif : [limiteHaute, taux] — la derniere tranche est Infinity */
        bareme: [
            { min: 0,      max: 11294,   taux: 0.00 },
            { min: 11294,  max: 28797,   taux: 0.11 },
            { min: 28797,  max: 82341,   taux: 0.30 },
            { min: 82341,  max: 177106,  taux: 0.41 },
            { min: 177106, max: Infinity, taux: 0.45 }
        ],
        /** Raccourci pour identifier rapidement la TMI applicable */
        tmiTranches: [
            { seuil: 177106, tmi: 0.45 },
            { seuil: 82341,  tmi: 0.41 },
            { seuil: 28797,  tmi: 0.30 },
            { seuil: 11294,  tmi: 0.11 },
            { seuil: 0,      tmi: 0.00 }
        ]
    },

    // =========================================================================
    // 5. IFI — Impot sur la Fortune Immobiliere
    //    Seuil d'imposition : 1 300 000 EUR (mais calcul des le 800 000 EUR)
    //    Abattement de 30% sur la residence principale
    // =========================================================================
    ifi: {
        seuilImposition: 1300000,
        abattementRP: 0.30,
        /** Tranches : [min, max, taux] — calcul progressif */
        tranches: [
            { min: 0,         max: 800000,    taux: 0.00 },
            { min: 800000,    max: 1300000,   taux: 0.005 },
            { min: 1300000,   max: 2570000,   taux: 0.007 },
            { min: 2570000,   max: 5000000,   taux: 0.01 },
            { min: 5000000,   max: 10000000,  taux: 0.0125 },
            { min: 10000000,  max: Infinity,  taux: 0.015 }
        ]
    },

    // =========================================================================
    // 6. SUCCESSION — Droits de mutation a titre gratuit
    //    Baremes et abattements selon le lien de parente
    // =========================================================================
    succession: {
        /** Ligne directe (parents → enfants) */
        ligneDirecte: {
            abattement: 100000,
            /** Bareme progressif des droits de succession en ligne directe */
            tranches: [
                { min: 0,       max: 8072,     taux: 0.05 },
                { min: 8072,    max: 12109,    taux: 0.10 },
                { min: 12109,   max: 15932,    taux: 0.15 },
                { min: 15932,   max: 552324,   taux: 0.20 },
                { min: 552324,  max: 902838,   taux: 0.30 },
                { min: 902838,  max: 1805677,  taux: 0.40 },
                { min: 1805677, max: Infinity,  taux: 0.45 }
            ]
        },
        /** Entre epoux ou partenaires de PACS — exoneration totale depuis 2007 */
        entreEpoux: {
            abattement: 80724,
            exonere: true
        },
        /** Entre freres et soeurs */
        entreFreresSoeurs: {
            abattement: 15932,
            tranches: [
                { min: 0,     max: 24430,    taux: 0.35 },
                { min: 24430, max: Infinity,  taux: 0.45 }
            ]
        },
        /** Neveux et nieces */
        neveux: {
            abattement: 7967,
            taux: 0.55
        },
        /** Tiers sans lien de parente */
        tiers: {
            abattement: 1594,
            tranches: [
                { min: 0,     max: 24430,    taux: 0.55 },
                { min: 24430, max: Infinity,  taux: 0.60 }
            ]
        }
    },

    // =========================================================================
    // 7. ASSURANCE VIE — Fiscalite, rendements, allocations et frais
    // =========================================================================
    assuranceVie: {
        /** Transmission — Regime successoral specifique a l'assurance vie */
        transmission: {
            /** Abattement par beneficiaire pour primes versees avant 70 ans (art. 990 I CGI) */
            abattementParBeneficiaire: 152500,
            /** Taux d'imposition apres abattement (jusqu'a 700 000 EUR) */
            tauxApresAbattement: 0.20,
            /** Taux au-dela de 700 000 EUR par beneficiaire */
            tauxAuDela700k: 0.3125,
            /** Abattement global pour primes versees apres 70 ans (art. 757 B CGI) */
            abattementApres70: 30500
        },

        /** Fiscalite des rachats — regles selon la duree du contrat */
        fiscaliteRachat: {
            /** Duree optimale de detention pour beneficier du regime le plus favorable */
            dureeOptimale: 8,
            /** Abattement annuel sur les gains en cas de rachat apres 8 ans */
            abattementApres8Ans: {
                celibataire: 4600,
                couple: 9200
            },
            /** Taux du prelevement liberatoire (option) */
            tauxPL: {
                avant8Ans: 0.128,
                apres8Ans: 0.075
            },
            /** PFU applicable si pas d'option pour le bareme progressif */
            pfu: 0.128
        },

        /** Rendements par support (hypotheses centrales de projection) */
        rendements: {
            fondsEuros: 0.025,
            mandatGestion: 0.044,
            produitStructure: 0.07,
            scpi: 0.045,
            privateEquity: 0.08,
            etf: 0.068
        },

        /** Allocation type par profil de risque (pourcentages fondsEuros / mandat / structure) */
        allocationProfilType: {
            securitaire: { fondsEuros: 0.85, mandat: 0.10, structure: 0.05 },
            prudent:     { fondsEuros: 0.60, mandat: 0.30, structure: 0.10 },
            equilibre:   { fondsEuros: 0.40, mandat: 0.40, structure: 0.20 },
            dynamique:   { fondsEuros: 0.20, mandat: 0.50, structure: 0.30 },
            offensif:    { fondsEuros: 0.10, mandat: 0.55, structure: 0.35 }
        },

        /** Frais appliques aux contrats distribues */
        frais: {
            entree: 0,
            gestionFE: 0.006,
            gestionUC: 0.008,
            arbitrage: 0
        }
    },

    // =========================================================================
    // 8. PEA — Plan d'Epargne en Actions
    //    Plafond 150 000 EUR (225 000 EUR avec PEA-PME)
    //    Fiscalite allegee apres 5 ans (PS 17,2% uniquement)
    // =========================================================================
    pea: {
        plafondVersement: 150000,
        plafondPME: 225000,
        dureeOptimale: 5,
        /** Avant 5 ans : PFU 30% sur les gains */
        fiscaliteAvant5Ans: {
            taux: 0.30
        },
        /** Apres 5 ans : seuls les prelevements sociaux (17,2%) sont dus */
        fiscaliteApres5Ans: {
            taux: 0.172
        },
        /** Cas de sortie anticipee sans penalite fiscale */
        casExoneratoires: [
            'licenciement',
            'invalidite',
            'retraite',
            'creation_entreprise',
            'deces'
        ],
        /** Rendements nets de frais de gestion des supports */
        rendements: {
            etfMonde: 0.068,
            mandatTitresVifs: 0.05,
            /** TER moyen des ETF (Total Expense Ratio) */
            terETF: 0.003,
            /** Frais du mandat de gestion en titres vifs */
            fraisMandat: 0.012
        }
    },

    // =========================================================================
    // 9. CTO — Compte-Titres Ordinaire
    //    Aucun plafond, enveloppe universelle
    //    PFU 30% ou option bareme progressif + PS
    // =========================================================================
    cto: {
        fiscalite: {
            pfu: 0.30,
            /**
             * Abattement pour duree de detention (titres acquis avant 01/01/2018 uniquement)
             * Applicable uniquement si option pour le bareme progressif
             */
            abattementDureeDetention: {
                droitCommun: {
                    entre2et8Ans: 0.50,
                    plus8Ans: 0.65
                },
                /** Abattement renforce pour les PME de moins de 10 ans */
                pmeRenforce: {
                    entre1et4Ans: 0.50,
                    entre4et8Ans: 0.65,
                    plus8Ans: 0.85
                }
            }
        },
        /** Rendement projete pour un portefeuille diversifie (actions mondiales) */
        rendements: {
            portefeuilleDiversifie: 0.0695
        },
        frais: {
            courtage: 0.001,
            droitsGarde: 0
        }
    },

    // =========================================================================
    // 10. IMMOBILIER — Parametres de simulation immobiliere
    //     Frais de notaire, plus-value, et parametres par defaut
    // =========================================================================
    immobilier: {
        fraisNotaire: {
            ancien: 0.08,
            neuf: 0.025
        },

        /** Plus-value immobiliere des particuliers (art. 150 U et suivants du CGI) */
        pvImmobiliere: {
            tauxIR: 0.19,
            tauxPS: 0.172,
            tauxGlobal: 0.362,
            /**
             * Abattements par annee de detention
             * IR : exoneration totale au bout de 22 ans
             * PS : exoneration totale au bout de 30 ans
             */
            abattementIR: {
                // Pas d'abattement les 5 premieres annees
                annees6a21: 0.06,    // 6% par an de la 6e a la 21e annee (soit 16 x 6% = 96%)
                annee22: 0.04,       // 4% la 22e annee (complement pour atteindre 100%)
                exonerationTotale: 22 // Exoneration totale d'IR apres 22 ans de detention
            },
            abattementPS: {
                annees6a21: 0.0165,  // 1,65% par an de la 6e a la 21e annee
                annee22: 0.018,      // 1,80% la 22e annee
                annees23a30: 0.09,   // 9% par an de la 23e a la 30e annee
                exonerationTotale: 30 // Exoneration totale de PS apres 30 ans
            },
            exonerationIR: 22,
            exonerationPS: 30
        },

        /** Parametres par defaut pour les simulations immobilieres */
        parametresDefaut: {
            tauxCredit: 0.038,
            dureePret: 20,
            tauxVacance: 0.05,
            fraisGestion: 0.07,
            chargesAnnuelles: 0.015,
            revalorisationAnnuelle: 0.02,
            assuranceEmprunteur: 0.003,
            garantieBancaire: 2000
        },

        /** Hypotheses de rendement locatif */
        rentabilite: {
            rendementLocatifBrut: 0.005
        }
    },

    // =========================================================================
    // 11. CLASSIFICATION DU PATRIMOINE
    //     Segmentation des clients par tranche de patrimoine net
    //     Ordre decroissant pour faciliter la recherche par boucle
    // =========================================================================
    classificationPatrimoine: [
        { min: 5000000,  label: 'Grande fortune' },
        { min: 1000000,  label: 'Patrimoine > 1M' },
        { min: 500000,   label: 'Patrimoine aise' },
        { min: 100000,   label: 'Patrimoine moyen' },
        { min: 0,        label: 'En construction' }
    ],

    // =========================================================================
    // 12. MINI SIMULATEUR — Projections par objectif d'investissement
    //     Chaque objectif est associe a un vehicule privilegie et un rendement
    // =========================================================================
    miniSimulateur: {
        projections: {
            valorisation: {
                vehicule: 'PEA ETF Monde',
                rendement: 0.068
            },
            revenus: {
                vehicule: 'SCPI (Assurance Vie)',
                rendement: 0.045
            },
            transmission: {
                vehicule: 'Assurance Vie Multi-support',
                rendement: 0.044
            },
            fiscal: {
                vehicule: 'PER Individuel',
                rendement: 0.05
            },
            retraite: {
                vehicule: 'PER + Assurance Vie',
                rendement: 0.05
            },
            epargne: {
                vehicule: 'Assurance Vie Fonds Euros',
                rendement: 0.025
            }
        }
    },

    // =========================================================================
    // 13. DEMEMBREMENT DE PROPRIETE
    //     Bareme fiscal de l'usufruit viager (art. 669 du CGI)
    //     et usufruit temporaire (evaluation economique)
    // =========================================================================
    demembrement: {
        /** Bareme fiscal de l'usufruit viager selon l'age de l'usufruitier */
        baremeUsufruitViager: [
            { ageMax: 20,  usufruit: 0.90 },
            { ageMax: 30,  usufruit: 0.80 },
            { ageMax: 40,  usufruit: 0.70 },
            { ageMax: 50,  usufruit: 0.60 },
            { ageMax: 60,  usufruit: 0.50 },
            { ageMax: 70,  usufruit: 0.40 },
            { ageMax: 80,  usufruit: 0.30 },
            { ageMax: 90,  usufruit: 0.20 },
            { ageMax: Infinity, usufruit: 0.10 }
        ],
        /** Usufruit temporaire : 23% de la valeur en pleine propriete par tranche de 10 ans */
        baremeUsufruitTemporaire: 0.23
    },

    // =========================================================================
    // 14. SCPI — Societes Civiles de Placement Immobilier
    //     Rendements moyens, frais standard et delai de jouissance
    // =========================================================================
    scpi: {
        rendements: {
            /** Taux de distribution moyen du marche (TDVM) */
            tauxDistribution: 0.045,
            /** Revalorisation moyenne annuelle du prix de part */
            revalorisationPart: 0.01
        },
        frais: {
            /** Frais de souscription (inclus dans le prix de part) */
            souscription: 0.10,
            /** Frais de gestion annuels sur les loyers */
            gestion: 0.10
        },
        /** Delai de jouissance moyen (en mois) avant perception des premiers revenus */
        delaiJouissance: 5
    },

    // =========================================================================
    // 15. PRODUITS STRUCTURES
    //     Parametres par defaut pour les simulations de produits structures
    // =========================================================================
    produitsStructures: {
        /** Coupon annuel moyen (hypothese centrale) */
        couponAnnuel: 0.07,
        /** Duree de vie maximale du produit (en annees) */
        dureeMax: 10,
        /** Barriere de protection du capital (en % du niveau initial) */
        barriereCapital: 0.60,
        /** Frequence d'observation pour le rappel anticipe */
        frequenceObservation: 'trimestrielle',
        /** Frais d'entree (generalement 0 sur AV) */
        fraisEntree: 0,
        /** Sous-jacent le plus frequent */
        sousJacentType: 'indice_actions'
    },

    // =========================================================================
    // 16. PRIVATE EQUITY
    //     Parametres pour les investissements en capital-investissement
    // =========================================================================
    privateEquity: {
        /** Rendement cible annualise (TRI net) */
        rendementCible: 0.08,
        /** Duree de blocage typique (en annees) */
        dureeBlockage: 8,
        /** Ticket d'entree minimum (en EUR) */
        ticketMinimum: 100000,
        /** Frais de gestion annuels moyens */
        fraisGestion: 0.02,
        /** Commission de surperformance (carried interest) */
        carry: 0.20,
        /** Hurdle rate (rendement minimum avant carry) */
        hurdleRate: 0.08,
        /** Profils eligibles */
        profilsEligibles: ['dynamique', 'offensif']
    },

    // =========================================================================
    // 17. CONTRAT DE CAPITALISATION
    //     Differences principales avec l'assurance vie
    // =========================================================================
    contratCapitalisation: {
        /** Duree du contrat (renouvelable) */
        dureeContrat: 30,
        /** Souscription possible par une personne morale */
        personneMorale: true,
        /** Pas de denouement au deces — le contrat entre dans la succession */
        denouementDeces: false,
        /** Regime fiscal des rachats identique a l'assurance vie */
        fiscaliteRachat: 'identique_av',
        /** Pas d'abattement 152 500 EUR — pas d'article 990 I CGI */
        avantageTransmission990I: false,
        /** Valorisation au deces : valeur nominale (pas de revalorisation des gains) */
        valorisationDeces: 'valeur_nominale',
        /** Integration dans l'assiette IFI (pour la part investie en UC immobilieres) */
        assietteIFI: true,
        /** Demembrement possible (a la difference de l'AV) */
        demembrement: true
    },

    // =========================================================================
    // 18. CONTRAT LUXEMBOURGEOIS
    //     Assurance vie et capitalisation de droit luxembourgeois
    // =========================================================================
    contratLuxembourgeois: {
        /** Minimum de souscription selon les compagnies */
        minimums: {
            /** Compagnies les plus accessibles */
            entreeGamme: 250000,
            /** Acces aux fonds dedies / FID */
            fondsDedies: 500000,
            /** Acces aux fonds internes collectifs / FIC */
            fondsInternesCollectifs: 1000000
        },
        /** Profils clients eligibles */
        profilsEligibles: [
            'patrimoine_financier_sup_250k',
            'expatries',
            'non_residents',
            'personnes_morales'
        ],
        /** Triangle de securite (super-privilege du souscripteur) */
        triangleSecurite: true,
        /** Neutralite fiscale — application de la convention fiscale du pays de residence */
        neutraliteFiscale: true,
        /** Acces a des classes d'actifs non disponibles en droit francais */
        actifsDiversifies: [
            'private_equity',
            'hedge_funds',
            'immobilier_direct',
            'metaux_precieux',
            'non_cote'
        ]
    },

    // =========================================================================
    // 19. OFFRES — Les 3 niveaux de service Patria Capital
    // =========================================================================
    offres: [
        {
            id: 1,
            nom: 'Diagnostic Patrimonial',
            sousTitre: 'Autonome - Digital',
            prix: { min: 29, max: 99 },
            features: [
                'Vision globale et consolidee du patrimoine',
                'Identification des desequilibres structurels',
                'Premiers axes d\'optimisation cibles',
                'Approche selfcare — a votre rythme'
            ],
            rapportAuto: true,
            lien: 'commande-diagnostic.html'
        },
        {
            id: 2,
            nom: 'Audit Strategique',
            sousTitre: 'Analyse - Plan d\'action',
            prix: { min: 500, max: 1500 },
            features: [
                'Analyse patrimoniale approfondie',
                'Allocation cible et reallocation',
                'Optimisation fiscale structuree',
                'Plan d\'action formalise',
                'Partiellement deductible si mise en place'
            ],
            rapportAuto: true,
            lien: 'audit-form.html'
        },
        {
            id: 3,
            nom: 'Accompagnement Complet',
            sousTitre: 'Strategie - Mise en oeuvre - Suivi',
            prix: { min: 1000, max: null },
            recommande: true,
            features: [
                'Analyse et structuration patrimoniale',
                'Allocation, arbitrages et optimisation',
                'Mise en oeuvre operationnelle complete',
                'Optimisation des frais d\'entree et de gestion',
                'Alignement des interets — honoraires integres'
            ],
            rapportAuto: true,
            lien: 'rdv.html'
        }
    ]

    // =========================================================================
    // 20. DIRIGEANT — Cession de parts, 150-0 B ter, Pacte Dutreil
    // =========================================================================
    dirigeant: {
        /** Article 150-0 B ter — Report d'imposition en cas d'apport-cession */
        apportCession150Bter: {
            /** Condition de reinvestissement : 60% dans les 24 mois */
            seuilReinvestissement: 0.60,
            delaiReinvestissement: 24, // mois
            /** Activites eligibles au reinvestissement */
            activitesEligibles: ['operationnelle', 'immobilier_professionnel', 'fonds_investissement'],
            /** PV en report : taxee a la cession des titres recus ou a la dissolution de la holding */
            fiscalitePV: {
                tauxIR: 0.128,      // PFU part IR
                ps: 0.172,          // Prelevements sociaux
                total: 0.30         // PFU total
            }
        },

        /** Pacte Dutreil — Exoneration partielle des droits de mutation (art. 787 B et C CGI) */
        pacteDutreil: {
            /** Exoneration de 75% de la valeur des titres transmis */
            exoneration: 0.75,
            /** Engagement collectif de conservation : minimum 2 ans */
            engagementCollectif: 2,
            /** Engagement individuel de conservation : minimum 4 ans */
            engagementIndividuel: 4,
            /** Seuil de detention minimale pendant l'engagement collectif */
            seuilDetention: {
                societeNonCotee: 0.34, // 34% des droits financiers et de vote
                societeCotee: 0.20     // 20% des droits financiers et de vote
            },
            /** Obligation d'exercer une fonction de direction pendant 3 ans */
            dureeDirection: 3,
            /** Reduction supplementaire de 50% si donation en pleine propriete avant 70 ans */
            reductionDonation: 0.50,
            ageMaxDonation: 70
        },

        /** Cession de parts — fiscalite applicable */
        cessionParts: {
            /** PFU 30% (defaut depuis 2018) */
            pfu: 0.30,
            /** Option bareme progressif + abattement pour duree de detention (titres acquis avant 2018) */
            abattementDureeDetention: {
                droitCommun: {
                    entre2et8Ans: 0.50,
                    plus8Ans: 0.65
                },
                dirigeantRetraite: {
                    entre1et4Ans: 0.50,
                    entre4et8Ans: 0.65,
                    plus8Ans: 0.85
                },
                /** Abattement fixe de 500 000 EUR pour depart en retraite du dirigeant */
                abattementFixeRetraite: 500000
            }
        },

        /** Formes juridiques de societe */
        formesJuridiques: ['SAS', 'SARL', 'SA', 'EURL', 'SCI', 'SNC', 'SASU'],
        /** Taux IS 2026 */
        is: {
            tauxReduit: 0.15,
            plafondTauxReduit: 42500,
            tauxNormal: 0.25
        }
    },

    // =========================================================================
    // 21. EPARGNE SALARIALE — Interessement, participation, abondement
    // =========================================================================
    epargneSalariale: {
        /** Plafonds d'interessement et participation */
        interessement: {
            /** Plafond individuel : 75% du PASS */
            plafondIndividuel: 34776, // 75% x 46368 (PASS 2026)
            /** Forfait social taux reduit (entreprises < 250 salaries) */
            forfaitSocialReduit: 0,
            /** Forfait social taux normal */
            forfaitSocialNormal: 0.20
        },
        participation: {
            /** Obligatoire a partir de 50 salaries */
            seuilObligatoire: 50,
            forfaitSocial: 0.20
        },

        /** PEE — Plan d'Epargne Entreprise */
        pee: {
            /** Abondement maximal : 300% du versement, plafonné a 8% du PASS */
            abondementMax: 3709,  // 8% x 46368
            tauxAbondementMax: 3.0,
            /** Duree de blocage : 5 ans (sauf cas de deblocage anticipe) */
            dureeBlocage: 5,
            /** Exoneration IR sur les sommes recues (interessement, participation, abondement) */
            exonerationIR: true,
            /** PS sur les gains a la sortie */
            psGains: 0.172
        },

        /** PERCO / PER Collectif */
        perCollectif: {
            /** Abondement maximal : 300% du versement, plafonné a 16% du PASS */
            abondementMax: 7418,  // 16% x 46368
            /** Blocage jusqu'a la retraite (sauf cas de deblocage) */
            blocageRetraite: true,
            /** Deductibilite des versements volontaires du revenu imposable */
            deductible: true,
            psGains: 0.172
        },

        /** Prime de partage de la valeur (ex-prime Macron) */
        primePartageValeur: {
            /** Exoneration totale si remuneration < 3 SMIC */
            seuilExoneration: 3,  // en multiple du SMIC
            /** Plafond d'exoneration */
            plafondExoneration: 3000,
            /** Plafond si accord d'interessement */
            plafondAvecInteressement: 6000,
            /** Exoneration de cotisations sociales */
            exonerationCotisations: true,
            /** Exoneration IR (jusqu'au 31/12/2026 pour entreprises < 50 salaries) */
            exonerationIR: true
        },

        /** PASS 2026 (Plafond Annuel de la Securite Sociale) */
        pass2026: 46368
    },

    // =========================================================================
    // 22. PER — Plan d'Epargne Retraite (individuel et dirigeant)
    // =========================================================================
    per: {
        /** Plafond de deduction : 10% des revenus nets, plafonne a 10% de 8 PASS */
        plafondDeduction: {
            tauxRevenus: 0.10,
            plafondAbsolu: 37094,  // 10% x 8 x 46368
            plancher: 4637         // 10% du PASS
        },
        /** Report des plafonds non utilises sur 3 ans + mutualisation couple */
        reportPlafond: 3,
        mutualisationCouple: true,

        /** Sortie en capital : imposition au bareme IR (versements) + PFU (gains) */
        sortieCapital: {
            versements: 'bareme_ir',
            gains: 0.30
        },
        /** Sortie en rente : regime des rentes a titre gratuit ou onereux selon l'origine */
        sortieRente: {
            abattement: { '60_69': 0.40, '70_plus': 0.30 }
        },
        /** Rendements projetes */
        rendements: {
            prudent: 0.03,
            equilibre: 0.045,
            dynamique: 0.06
        }
    }

}; // Fin de CONFIG


// =============================================================================
// FONCTIONS UTILITAIRES
// =============================================================================

/**
 * deepMerge — Fusion recursive de deux objets
 * Les valeurs de `source` ecrasent celles de `target` pour les proprietes simples.
 * Les sous-objets sont fusionnes recursivement. Les tableaux de `source` remplacent
 * entierement ceux de `target`.
 *
 * @param {Object} target — objet de base
 * @param {Object} source — objet de surcharge
 * @returns {Object} — objet fusionne (nouveau, sans mutation)
 */
function deepMerge(target, source) {
    const output = Object.assign({}, target);
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}

/** Verifie qu'une valeur est un objet simple (pas un tableau, pas null) */
function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}


/**
 * getEffectiveConfig — Retourne la configuration effective
 * Fusionne CONFIG (valeurs par defaut) avec les surcharges stockees dans
 * localStorage sous la cle 'patria_config_overrides'.
 *
 * @returns {Object} — configuration effective (CONFIG + surcharges)
 */
function getEffectiveConfig() {
    try {
        const raw = localStorage.getItem('patria_config_overrides');
        if (!raw) return CONFIG;
        const overrides = JSON.parse(raw);
        return deepMerge(CONFIG, overrides);
    } catch (e) {
        console.warn('[PATRIA CONFIG] Erreur lors de la lecture des surcharges localStorage :', e);
        return CONFIG;
    }
}


/**
 * saveConfigOverrides — Sauvegarde des surcharges de configuration
 * Persiste un objet partiel dans localStorage. Seules les proprietes presentes
 * dans `overrides` seront ecrasees lors de la fusion par getEffectiveConfig().
 *
 * @param {Object} overrides — objet partiel de surcharges
 */
function saveConfigOverrides(overrides) {
    try {
        const existing = localStorage.getItem('patria_config_overrides');
        const current = existing ? JSON.parse(existing) : {};
        const merged = deepMerge(current, overrides);
        localStorage.setItem('patria_config_overrides', JSON.stringify(merged));
        console.info('[PATRIA CONFIG] Surcharges sauvegardees :', merged);
    } catch (e) {
        console.error('[PATRIA CONFIG] Erreur lors de la sauvegarde des surcharges :', e);
    }
}


/**
 * resetConfigToDefaults — Supprime toutes les surcharges
 * Retire la cle 'patria_config_overrides' de localStorage pour revenir
 * aux valeurs par defaut de CONFIG.
 */
function resetConfigToDefaults() {
    try {
        localStorage.removeItem('patria_config_overrides');
        console.info('[PATRIA CONFIG] Configuration remise aux valeurs par defaut.');
    } catch (e) {
        console.error('[PATRIA CONFIG] Erreur lors de la reinitialisation :', e);
    }
}


/**
 * calcBareme — Calculateur generique de bareme progressif
 * Fonctionne avec n'importe quel tableau de tranches au format
 * [{min, max, taux}, ...] (succession, IFI, IR, etc.)
 *
 * @param {number} base — montant taxable
 * @param {Array}  tranches — tableau d'objets {min, max, taux}
 * @returns {number} — montant total de l'impot ou des droits
 */
function calcBareme(base, tranches) {
    let total = 0;
    for (const tranche of tranches) {
        if (base > tranche.min) {
            const taxable = Math.min(base, tranche.max) - tranche.min;
            total += taxable * tranche.taux;
        }
    }
    return total;
}


/**
 * calcAbattementPVImmo — Calcul de l'abattement sur plus-value immobiliere
 * Retourne le pourcentage d'abattement applicable en IR ou en PS selon
 * la duree de detention du bien immobilier.
 *
 * @param {number} dureeDetention — nombre d'annees de detention
 * @param {string} type — 'ir' ou 'ps'
 * @returns {number} — pourcentage d'abattement (entre 0 et 1)
 */
function calcAbattementPVImmo(dureeDetention, type) {
    const pv = CONFIG.immobilier.pvImmobiliere;

    if (type === 'ir') {
        if (dureeDetention >= pv.exonerationIR) return 1;
        if (dureeDetention < 6) return 0;
        // De la 6e a la 21e annee : 6% par an
        let abattement = (Math.min(dureeDetention, 21) - 5) * pv.abattementIR.annees6a21;
        // La 22e annee : 4% supplementaire
        if (dureeDetention >= 22) abattement += pv.abattementIR.annee22;
        return Math.min(abattement, 1);
    }

    if (type === 'ps') {
        if (dureeDetention >= pv.exonerationPS) return 1;
        if (dureeDetention < 6) return 0;
        // De la 6e a la 21e annee : 1,65% par an
        let abattement = (Math.min(dureeDetention, 21) - 5) * pv.abattementPS.annees6a21;
        // La 22e annee : 1,80%
        if (dureeDetention >= 22) abattement += pv.abattementPS.annee22;
        // De la 23e a la 30e annee : 9% par an
        if (dureeDetention >= 23) {
            abattement += (Math.min(dureeDetention, 30) - 22) * pv.abattementPS.annees23a30;
        }
        return Math.min(abattement, 1);
    }

    console.warn('[PATRIA CONFIG] calcAbattementPVImmo : type inconnu "' + type + '". Utilisez "ir" ou "ps".');
    return 0;
}


/**
 * getPatrimoineClasse — Determine la classe de patrimoine
 * Parcourt le tableau classificationPatrimoine (trie en ordre decroissant)
 * et retourne le premier label dont le seuil est inferieur ou egal au patrimoine net.
 *
 * @param {number} patriNet — patrimoine net du client
 * @returns {string} — label de classification
 */
function getPatrimoineClasse(patriNet) {
    const classes = getEffectiveConfig().classificationPatrimoine;
    for (const classe of classes) {
        if (patriNet >= classe.min) return classe.label;
    }
    return 'En construction';
}


/**
 * formatConfigVersion — Retourne une chaine lisible de la version de configuration
 * Exemple : "Patria Capital Config v2026.1 (MAJ : 2026-03-31) — FR"
 *
 * @returns {string}
 */
function formatConfigVersion() {
    const m = CONFIG.meta;
    return 'Patria Capital Config v' + m.version + ' (MAJ : ' + m.lastUpdated + ') — ' + m.country;
}


// =============================================================================
// EXPOSITION GLOBALE
// Rend CONFIG et getEffectiveConfig accessibles depuis la console ou d'autres scripts
// =============================================================================
window.PATRIA_CONFIG = CONFIG;
window.getEffectiveConfig = getEffectiveConfig;
