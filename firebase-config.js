// ===== FIREBASE CONFIGURATION =====
// Remplacez ces valeurs par celles de votre projet Firebase
// Instructions : https://console.firebase.google.com
const firebaseConfig = {
    apiKey: "VOTRE_API_KEY",
    authDomain: "VOTRE_PROJECT.firebaseapp.com",
    projectId: "VOTRE_PROJECT_ID",
    storageBucket: "VOTRE_PROJECT.appspot.com",
    messagingSenderId: "VOTRE_SENDER_ID",
    appId: "VOTRE_APP_ID"
};

// Initialize Firebase
let db = null;
let firebaseReady = false;

function initFirebase() {
    try {
        if (firebaseConfig.apiKey === "VOTRE_API_KEY") {
            console.warn('Firebase non configure — les donnees restent en localStorage uniquement.');
            return;
        }
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        firebaseReady = true;
        console.log('Firebase connecte.');
    } catch (e) {
        console.error('Erreur Firebase:', e);
    }
}

// ===== FIRESTORE SYNC FUNCTIONS =====

async function syncUserToCloud(user) {
    if (!firebaseReady || !db) return;
    try {
        await db.collection('users').doc(user.id).set({
            id: user.id,
            nom: user.nom,
            prenom: user.prenom,
            email: user.email,
            createdAt: user.createdAt
        });
    } catch (e) {
        console.error('Erreur sync user:', e);
    }
}

async function syncClientDataToCloud(userId, data) {
    if (!firebaseReady || !db) return;
    try {
        await db.collection('clients').doc(userId).set({
            userId: userId,
            data: data,
            updatedAt: new Date().toISOString()
        });
    } catch (e) {
        console.error('Erreur sync data:', e);
    }
}

async function getAllClientsFromCloud() {
    if (!firebaseReady || !db) return null;
    try {
        const usersSnap = await db.collection('users').get();
        const clientsSnap = await db.collection('clients').get();

        const clientsMap = {};
        clientsSnap.forEach(doc => {
            const d = doc.data();
            clientsMap[d.userId] = d.data;
        });

        const result = [];
        usersSnap.forEach(doc => {
            const u = doc.data();
            result.push({
                user: u,
                data: clientsMap[u.id] || {}
            });
        });

        return result;
    } catch (e) {
        console.error('Erreur lecture cloud:', e);
        return null;
    }
}

async function deleteClientFromCloud(userId) {
    if (!firebaseReady || !db) return;
    try {
        await db.collection('users').doc(userId).delete();
        await db.collection('clients').doc(userId).delete();
    } catch (e) {
        console.error('Erreur suppression cloud:', e);
    }
}

// Init on load
document.addEventListener('DOMContentLoaded', initFirebase);
