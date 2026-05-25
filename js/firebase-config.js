/* ================================================================
   PI THINKING — Configuração do Firebase
   ================================================================
   Arquivo: js/firebase-config.js
   ================================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyAYRHmDrAoCXIYsnt5ZruAESUoFFpmXJSo",
  authDomain: "painel-facilitador.firebaseapp.com",
  databaseURL: "https://painel-facilitador-default-rtdb.firebaseio.com",
  projectId: "painel-facilitador",
  storageBucket: "painel-facilitador.firebasestorage.app",
  messagingSenderId: "603611055391",
  appId: "1:603611055391:web:6668e92e9bf812cffa5c2a"
};

// Inicialização correta para a versão "compat" importada no HTML
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase inicializado com sucesso (Modo Compat).");
} else {
    console.error("ERRO: A biblioteca do Firebase não foi carregada no HTML.");
}
