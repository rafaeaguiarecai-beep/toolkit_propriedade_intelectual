/* ================================================================
   PI THINKING — Configuração do Firebase
   ================================================================
   Arquivo: js/firebase-config.js
   ================================================================ */

// Declaramos em MAIÚSCULO para satisfazer a requisição do dashboard.html
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAYRHmDrAoCXIYsnt5ZruAESUoFFpmXJSo",
  authDomain: "painel-facilitador.firebaseapp.com",
  databaseURL: "https://painel-facilitador-default-rtdb.firebaseio.com",
  projectId: "painel-facilitador",
  storageBucket: "painel-facilitador.firebasestorage.app",
  messagingSenderId: "603611055391",
  appId: "1:603611055391:web:6668e92e9bf812cffa5c2a"
};

// Criamos um espelho em camelCase para garantir compatibilidade com o sync.js e tutoriais padrão
const firebaseConfig = FIREBASE_CONFIG;

// Inicialização correta para a versão "compat" importada no HTML
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(FIREBASE_CONFIG);
    console.log("Firebase inicializado com sucesso (Modo Compat).");
} else {
    console.error("ERRO: A biblioteca do Firebase não foi carregada no HTML.");
}