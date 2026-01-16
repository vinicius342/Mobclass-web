const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function inativarPorTipo(tipo) {
  let total = 0;
  let lastDoc = null;

  while (true) {
    let query = db
      .collection("users")
      .where("tipo", "==", tipo)
      .where("status", "==", "Ativo")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(450);

    if (lastDoc) query = query.startAfter(lastDoc.id);

    const snap = await query.get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => {
      batch.update(doc.ref, { status: "Inativo" });
    });

    await batch.commit();

    total += snap.size;
    lastDoc = snap.docs[snap.docs.length - 1];
    console.log(`✅ ${tipo}: inativados ${snap.size} (total: ${total})`);
  }

  console.log(`🏁 Final ${tipo}: ${total}`);
}

(async () => {
  try {
    await inativarPorTipo("alunos");
    await inativarPorTipo("responsaveis");
    console.log("🚀 Concluído com sucesso");
    process.exit(0);
  } catch (e) {
    console.error("❌ Erro:", e);
    process.exit(1);
  }
})();
