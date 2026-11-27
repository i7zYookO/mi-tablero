/* Datos públicos del proyecto de Firebase (no son secretos: la seguridad está en firestore.rules).
   Se llenan una sola vez con lo que da la consola de Firebase. Si están vacíos, la app funciona
   solo en este dispositivo, sin nube ni notificaciones. */
self.FB_CONFIG = {
  apiKey: "AIzaSyAsZIHjM1HiKlBMiID3slOuNqVPeOHDS5c",
  authDomain: "mi-tablero-2041e.firebaseapp.com",
  projectId: "mi-tablero-2041e",
  storageBucket: "mi-tablero-2041e.firebasestorage.app",
  messagingSenderId: "804202773346",
  appId: "1:804202773346:web:c6d63fbbc022e3dc4d4a3b"
};
self.FB_VAPID = "BNScNepxpqFNzRFHdBWWxdOFW3NNCd8kYMY8EOC8iGotSKghtOrErWxtlOubQ-7sO0BgWpy1e4TTEsjtH8cGPz8"; // Cloud Messaging > Certificados push web > par de claves
