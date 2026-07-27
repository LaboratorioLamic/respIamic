// Configuração e inicialização do Firebase

// CONFIGURAÇÃO DO FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyAykEcKqLPOi0WfDuoxZC-tPKko7k27Wh4",
    authDomain: "agendaresp.firebaseapp.com",
    databaseURL: "https://agendaresp-default-rtdb.firebaseio.com",
    projectId: "agendaresp",
    storageBucket: "agendaresp.firebasestorage.app",
    messagingSenderId: "812520906432",
    appId: "1:812520906432:web:03fa5edf2b2e42cb3cd725"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
