console.log("Refleksjon JS lastet");


import { auth, db } from "./firebase-refleksjon.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";


/* =====================================================
   AUTH – KUN COACH
===================================================== */

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../login.html";
    return;
  }

  const snap = await getDoc(doc(db, "users", user.uid));

  if (!snap.exists() || snap.data().role !== "coach") {
    alert("Kun trener har tilgang.");
    window.location.href = "../index.html";
    return;
  }

  // Når coach er bekreftet → start UI
  initCoachRefleksjonUI();
});

/* =====================================================
   HENT DATA
===================================================== */

async function fetchUsers() {
  const snap = await getDocs(collection(db, "users"));

  return snap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(u => u.role === "player" && u.approved === true);
}

async function fetchRefleksjoner(playerId) {
  const snap = await getDocs(
    collection(db, "refleksjoner", playerId, "entries")
  );

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}

/* =====================================================
   GODKJENNING AV BRUKERE
===================================================== */

async function loadPendingUsersUI() {
  const toggle = document.getElementById("approvalToggle");
  const dropdown = document.getElementById("approvalDropdown");

  if (!toggle || !dropdown) return;

  const snap = await getDocs(collection(db, "users"));
  
  console.log("Total users in DB:", snap.size);
console.log("All users data:", snap.docs.map(d => d.data()));

  const pending = snap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(u => u.role === "player" && u.approved !== true);

  toggle.textContent = `Ventende (${pending.length}) ▾`;

  if (pending.length === 0) {
    dropdown.innerHTML =
      '<div class="ref-approval-empty">Ingen ventende godkjenninger</div>';
    return;
  }

  dropdown.innerHTML = "";

  pending.forEach(u => {
    const row = document.createElement("div");
    row.className = "ref-approval-item";

    const label = document.createElement("span");
    label.textContent = u.name || u.email || "Ukjent";

    const btn = document.createElement("button");
    btn.className = "ref-approve-btn";
    btn.textContent = "Godkjenn";

    btn.onclick = async () => {
      await updateDoc(doc(db, "users", u.uid), {
        approved: true
      });
      loadPendingUsersUI();
    };

    row.appendChild(label);
    row.appendChild(btn);
    dropdown.appendChild(row);
  });
}

/* =====================================================
   HOVED-UI
===================================================== */

async function initCoachRefleksjonUI() {

  await loadPendingUsersUI();

  const selPlayer = document.getElementById("refPlayerSelect");
  const selWeek = document.getElementById("refWeekSelect");
  const list = document.getElementById("refList");

  selPlayer.innerHTML = `<option value="">Velg spiller</option>`;
  selWeek.innerHTML = `<option value="">Alle</option>`;
  list.innerHTML = `<div class="ref-empty">Velg en spiller.</div>`;

  const players = await fetchUsers();

  players.forEach(p => {
    const op = document.createElement("option");
    op.value = p.uid;
    op.textContent = p.name || p.email;
    selPlayer.appendChild(op);
  });

  selPlayer.onchange = () => loadAndRenderRefleksjoner(selPlayer.value);
  selWeek.onchange = () => loadAndRenderRefleksjoner(selPlayer.value);
}

/* =====================================================
   RENDER REFLEKSJONER
===================================================== */

async function loadAndRenderRefleksjoner(playerId) {

  const list = document.getElementById("refList");
  const selWeek = document.getElementById("refWeekSelect");

  if (!playerId) {
    list.innerHTML =
      `<div class="ref-empty">Velg en spiller for å se refleksjoner.</div>`;
    return;
  }

  const entries = await fetchRefleksjoner(playerId);

  selWeek.innerHTML = `<option value="">Alle</option>`;

  [...new Set(entries.map(e => String(e.week)))]
    .sort((a, b) => Number(b) - Number(a))
    .forEach(w => {
      const op = document.createElement("option");
      op.value = w;
      op.textContent = `Uke ${w}`;
      selWeek.appendChild(op);
    });

  const weekFilter = selWeek.value;
  const filtered = weekFilter
    ? entries.filter(e => String(e.week) === weekFilter)
    : entries;

  if (!filtered.length) {
    list.innerHTML =
      `<div class="ref-empty">Ingen refleksjoner funnet.</div>`;
    return;
  }

 list.innerHTML = filtered.map(e => `
  <div class="ref-item collapsible" data-id="${e.id}">
    
    <div class="ref-item-header">
      <div class="ref-item-title">
        Uke ${e.week} – ${e.dateNor || ""}
      </div>
      <div class="chevron">▾</div>
    </div>

    <div class="ref-item-body">
      <div class="ref-kv">
        <div><span class="k">Innsats:</span> ${e.effort || "-"}</div>
        <div><span class="k">Energi:</span> ${e.energy || "-"}</div>
        <div><span class="k">Fornøyd med:</span> ${e.goodThing || "-"}</div>
        <div><span class="k">Neste uke:</span> ${e.improveThing || "-"}</div>
        <div><span class="k">Til trener:</span> ${e.coachNote || "-"}</div>
      </div>

      <div class="coach-feedback-box">
        <label>Din tilbakemelding</label>
        <textarea id="fb-${e.id}" rows="3">${e.coachFeedback || ""}</textarea>
        <button onclick="saveFeedback('${playerId}','${e.id}')">
          Lagre tilbakemelding
        </button>
      </div>
    </div>

  </div>
`).join("");

const items = list.querySelectorAll(".collapsible");

items.forEach(item => {

  const header = item.querySelector(".ref-item-header");

  if (!header) return;

  header.addEventListener("click", (event) => {
    event.stopPropagation();

    // Lukk alle først
    items.forEach(i => i.classList.remove("open"));

    // Åpne denne
    item.classList.add("open");
  });

});

document.addEventListener("click", (event) => {

  const clickedInside = event.target.closest(".ref-item");

  if (!clickedInside) {
    items.forEach(i => i.classList.remove("open"));
  }

});

}

const items = document.querySelectorAll(".collapsible");

items.forEach(item => {

  const header = item.querySelector(".ref-item-header");

  header.addEventListener("click", (e) => {
    e.stopPropagation();

    // Lukk alle først
    items.forEach(i => i.classList.remove("open"));

    // Åpne valgt
    item.classList.add("open");
  });

});

// Klikk utenfor → lukk alle
document.addEventListener("click", () => {
  items.forEach(i => i.classList.remove("open"));
});

window.saveFeedback = async function(playerId, entryId) {

  const textarea = document.getElementById(`fb-${entryId}`);
  const value = textarea.value.trim();

  await updateDoc(
    doc(db, "refleksjoner", playerId, "entries", entryId),
    {
      coachFeedback: value,
      coachFeedbackUpdatedAt: serverTimestamp()
    }
  );

  textarea.style.border = "2px solid #22c55e";

  setTimeout(() => {
    textarea.style.border = "";
  }, 1000);
};

const toggleBtn = document.getElementById("approvalToggle");
const dropdown = document.getElementById("approvalDropdown");

if (toggleBtn && dropdown) {

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });

  document.addEventListener("click", () => {
    dropdown.classList.remove("open");
  });

}
window.goBack = function () {
  window.history.back();
};
