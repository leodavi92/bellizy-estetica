// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here. Other Firebase libraries
// are not available in the service worker.
importScripts('https://www.gstatic.com/firebasejs/10.11.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.1/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config-object
firebase.initializeApp({
  apiKey: "AIzaSyDFCnMZ5LRMRxpNBpSqBwUI_o3W6gBL1eg",
  authDomain: "estetica-f543c.firebaseapp.com",
  projectId: "estetica-f543c",
  storageBucket: "estetica-f543c.firebasestorage.app",
  messagingSenderId: "499472033905",
  appId: "1:499472033905:web:200d1f1465c62412ea13d0"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
