import { auth, db } from "./firebase-refleksjon.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

let utviklingsbank = {};

async function loadUtviklingsbank() {
  const response = await fetch("utviklingsbank.json");
  utviklingsbank = await response.json();
}

const playerSelect = document.getElementById("playerSelect");
const backBtn = document.getElementById("backBtn");
const savePlanBtn = document.getElementById("savePlanBtn");

const mainFocus = document.getElementById("mainFocus");
const trainingGoal = document.getElementById("trainingGoal");
const matchBehaviour = document.getElementById("matchBehaviour");
const measurement = document.getElementById("measurement");
const utviklingsmaalField = document.getElementById("utviklingsmaal");




backBtn.addEventListener("click", () => {
  window.history.back();
});

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  await loadUtviklingsbank();
  await loadPlayers();
});

async function loadPlayers() {
  const snapshot = await getDocs(collection(db, "spillere"));

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();

    const option = document.createElement("option");
    option.value = docSnap.id;
    option.textContent = data.navn;
    option.dataset.posisjon = data.posisjon; // 🔥 viktig
	option.dataset.uid = data.uid;

    playerSelect.appendChild(option);
  });
}

function fillMainFocusDropdown(posisjon) {
  mainFocus.innerHTML = '<option value="">Velg utviklingsområde</option>';

  if (!utviklingsbank[posisjon]) return;

  const rolleOmrader = utviklingsbank[posisjon] || [];
  const fellesOmrader = utviklingsbank["felles_utvikling"] || [];

  const alleOmrader = [...rolleOmrader, ...fellesOmrader];

  alleOmrader.forEach((omrade) => {
    const option = document.createElement("option");
    option.value = omrade.id;
    option.textContent = omrade.title;
    mainFocus.appendChild(option);
  });
}

function finnUtviklingsOmrade(omradeId, posisjon) {
  const rolleOmrader = utviklingsbank[posisjon] || [];
  const fellesOmrader = utviklingsbank["felles_utvikling"] || [];

  const alleOmrader = [...rolleOmrader, ...fellesOmrader];

  return alleOmrader.find(o => o.id === omradeId);
}

mainFocus.addEventListener("change", () => {
  const omradeId = mainFocus.value;
  if (!omradeId) return;

  const selectedOption = playerSelect.options[playerSelect.selectedIndex];
  const posisjon = selectedOption.dataset.posisjon;

  const omrade = finnUtviklingsOmrade(omradeId, posisjon);
  if (!omrade) return;

  // 🔹 Fyll utviklingsmål
  utviklingsmaalField.value = omrade.utviklingsmaal || "";

  // 🔹 Fyll treningsmål
  trainingGoal.value = "• " + omrade.trening.join("\n• ");

  // 🔹 Fyll kampatferd
  matchBehaviour.value = "• " + omrade.kamp.join("\n• ");
});

playerSelect.addEventListener("change", async () => {
  const uid = playerSelect.value;

  mainFocus.value = "";
  trainingGoal.value = "";
  matchBehaviour.value = "";
  measurement.value = "";

  if (!uid) return;

  const selectedOption = playerSelect.options[playerSelect.selectedIndex];
  const posisjon = selectedOption.dataset.posisjon;

  fillMainFocusDropdown(posisjon);

  const planRef = doc(db, "utviklingsplan", uid);
  const planSnap = await getDoc(planRef);

  if (!planSnap.exists()) return;

  const plan = planSnap.data();

  mainFocus.value = plan.mainFocus || "";
  trainingGoal.value = plan.trainingGoal || "";
  matchBehaviour.value = plan.matchBehaviour || "";
  measurement.value = plan.measurement || "";
  utviklingsmaalField.value = plan.utviklingsmaal || "";
});

savePlanBtn.addEventListener("click", async () => {

  const selectedOption = playerSelect.options[playerSelect.selectedIndex];

  if (!selectedOption || !selectedOption.dataset.uid) {
    alert("Spilleren mangler uid");
    return;
  }

  const spillerUid = selectedOption.dataset.uid;

  await setDoc(doc(db, "utviklingsplan", spillerUid), {
    mainFocus: mainFocus.value,
    utviklingsmaal: utviklingsmaalField.value,
    trainingGoal: trainingGoal.value,
    matchBehaviour: matchBehaviour.value,
    measurement: measurement.value,
    updatedAt: serverTimestamp()
  });

  alert("Utviklingsplan lagret!");
});

