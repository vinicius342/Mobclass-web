// src/services/firebase.ts

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging } from "firebase/messaging"; // ✅ IMPORTANTE para FCM

// Configuração do Firebase
export const firebaseConfig = {
  apiKey: "AIzaSyA79C5G4duVt6ji1Ssbqq_NMo-0FdyVx6g",
  authDomain: "agenda-digital-e481b.firebaseapp.com",
  projectId: "agenda-digital-e481b",
  storageBucket: "agenda-digital-e481b.appspot.com",
  messagingSenderId: "88928166311",
  appId: "1:88928166311:web:bf1375d45b7e7f7e76d682",
  measurementId: "G-J3ML1J8VZM",
};

// Inicialização do app Firebase
const app = initializeApp(firebaseConfig);

// Exports principais
export const auth = getAuth(app);
export const db = getFirestore(app);
export const messaging = getMessaging(app); // ✅ Agora disponível para obter FCM token


