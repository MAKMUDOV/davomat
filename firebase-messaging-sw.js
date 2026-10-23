// Telefon bildirishnomalari (Firebase Cloud Messaging) — sayt yopiq bo'lsa ham ishlaydi
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");
firebase.initializeApp({
  apiKey: "AIzaSyCsa2tSR2q3t3UpO1f2mvI6YKLW3uOAbGg",
  authDomain: "davomat-daftari-6889b.firebaseapp.com",
  projectId: "davomat-daftari-6889b",
  storageBucket: "davomat-daftari-6889b.firebasestorage.app",
  messagingSenderId: "519049457190",
  appId: "1:519049457190:web:b112405ded7554ed6100e7"
});
firebase.messaging(); // server yuborgan bildirishnomani o'zi ko'rsatadi
