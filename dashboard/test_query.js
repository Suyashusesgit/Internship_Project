const { initializeApp } = require("firebase/app");
const { getFirestore, collection, query, where, orderBy, getDocs, Timestamp } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyDB_Qb_oo7pQAdjic5d-Ti1YiddPz-OCio",
  authDomain: "tbtn-dashboard.firebaseapp.com",
  projectId: "tbtn-dashboard",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const q = query(
    collection(db, "readings"),
    where("deviceId", "==", "tbtn-001"),
    orderBy("timestamp", "asc")
  );
  
  const snap = await getDocs(q);
  console.log("Total docs:", snap.size);
  snap.docs.forEach(d => {
    console.log(d.id, d.data().timestamp.toDate());
  });
}
run().catch(console.error);
