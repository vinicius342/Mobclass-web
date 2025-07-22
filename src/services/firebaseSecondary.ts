// src/services/firebaseSecondary.ts

import { initializeApp } from "firebase/app";
import { getAuth }        from "firebase/auth";
import { firebaseConfig } from "./firebase";  // importa a config já exportada

// Inicializa um *second* app só para criação de usuários
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
export const secondaryAuth = getAuth(secondaryApp);

