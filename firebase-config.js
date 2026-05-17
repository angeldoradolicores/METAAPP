/* ═══════════════════════════════════════
   firebase-config.js
   INSTRUCCIONES:
   1. Ve a https://console.firebase.google.com
   2. Crea un proyecto "goretti-social"
   3. Agrega una app web (icono </> )
   4. Copia tu configuración aquí
   5. Habilita Firestore Database y Authentication
   6. En Authentication > Sign-in method > habilita Email/Password
   7. En Authentication > Users > Add user:
        Email: admin@goretti.edu.co
        Password: G0r3tt!8
═══════════════════════════════════════ */

const firebaseConfig = {
  apiKey: "AIzaSyD_uxzEjJDkYDyjPN6JT0i289CNHaG2j-0",
  authDomain: "metaapp-a3ec5.firebaseapp.com",
  projectId: "metaapp-a3ec5",
  storageBucket: "metaapp-a3ec5.firebasestorage.app",
  messagingSenderId: "163506635692",
  appId: "1:163506635692:web:d953411b9aa188ae7ab009"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();
