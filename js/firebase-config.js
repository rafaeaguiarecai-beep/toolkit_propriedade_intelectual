/* ================================================================
   PI THINKING — Configuração do Firebase
   ================================================================ */

(function (global) {
  'use strict';

  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyAYRHmDrAoCXIYsnt5ZruAESUoFFpmXJSo",
    authDomain: "painel-facilitador.firebaseapp.com",
    databaseURL: "https://painel-facilitador-default-rtdb.firebaseio.com",
    projectId: "painel-facilitador",
    storageBucket: "painel-facilitador.firebasestorage.app",
    messagingSenderId: "603611055391",
    appId: "1:603611055391:web:6668e92e9bf812cffa5c2a"
  };

  global.FIREBASE_CONFIG = FIREBASE_CONFIG;
  global.firebaseConfig = FIREBASE_CONFIG;
  global.PI_FIREBASE_CONFIG = FIREBASE_CONFIG;
  global.getPIFirebaseConfig = function () { return FIREBASE_CONFIG; };

  if (typeof global.firebase !== 'undefined') {
    try {
      if (!global.firebase.apps || !global.firebase.apps.length) {
        global.firebase.initializeApp(FIREBASE_CONFIG);
      }
      console.log('Firebase inicializado com sucesso.');
    } catch (error) {
      console.warn('Firebase já estava inicializado ou indisponível.', error);
    }
  } else {
    console.error('ERRO: A biblioteca do Firebase não foi carregada no HTML.');
  }
})(window);
