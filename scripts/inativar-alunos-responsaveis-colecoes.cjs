const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function inativarColecao(nomeColecao) {
  let total = 0;
  let lastDoc = null;

  while (true) {
    let query = db
      .collection(nomeColecao)
      .where("status", "==", "Ativo")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(450); // margem segura

    if (lastDoc) {
      query = query.startAfter(lastDoc.id);
    }

    const snap = await query.get();
    if (snap.empty) break;

    const batch = db.batch();

    snap.docs.forEach((doc) => {
      batch.update(doc.ref, { status: "Inativo" });
    });

    await batch.commit();

    total += snap.size;
    lastDoc = snap.docs[snap.docs.length - 1];

    console.log(`✅ ${nomeColecao}: inativados ${snap.size} (total: ${total})`);
  }

  console.log(`🏁 Final ${nomeColecao}: ${total}`);
}

(async () => {
  try {
    await inativarColecao("alunos");
    await inativarColecao("responsaveis");

    console.log("🚀 Concluído com sucesso (coleções)");
    process.exit(0);
  } catch (err) {
    console.error("❌ Erro:", err);
    process.exit(1);
  }
})();
