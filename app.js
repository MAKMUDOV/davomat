// Davomat daftari — admin, o'qituvchi kabineti va ota-ona kabineti (Firebase)
import { firebaseConfig, TEACHER_UID as ADMIN_UID, SITE_NAME } from "./firebase-config.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword, updatePassword, EmailAuthProvider, reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, onSnapshot, getDoc, getDocs, setDoc, updateDoc,
  writeBatch, serverTimestamp, query, orderBy, where, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ================= umumiy ================= */
const MARKS = { k: { sym: "+", label: "Keldi" }, x: { sym: "k", label: "Kechikdi" }, s: { sym: "s", label: "Sababli" }, y: { sym: "y", label: "Sababsiz" } };
const HW = { t: { sym: "✓", label: "Topshirdi" }, q: { sym: "½", label: "Qisman" }, n: { sym: "✗", label: "Topshirmadi" } };
const PAR = { 1: "Sust", 2: "O'rta", 3: "Faol" };
const DEF = { late: 1, absent: 2, hw: 1, warn: 3, talk: 6, out: 10, lateMin: 15, autoNotify: true };
const LVL = ["Toza", "Ogohlantirish", "Ota-ona bilan suhbat", "Chetlatish masalasi"];
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const WD = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const pad = n => String(n).padStart(2, "0");
const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const monthTitle = m => { const [y, mo] = m.split("-").map(Number); return cap(MONTHS[mo - 1]) + " " + y; };
const shiftMonth = (m, n) => { const [y, mo] = m.split("-").map(Number); const d = new Date(y, mo - 1 + n, 1); return d.getFullYear() + "-" + pad(d.getMonth() + 1); };
const thisMonth = () => iso(new Date()).slice(0, 7);
const recentMonths = () => [thisMonth(), shiftMonth(thisMonth(), -1), shiftMonth(thisMonth(), -2)];
const $ = s => document.querySelector(s);
const appEl = $("#app"), dlgEl = $("#dlg"), toastEl = $("#toast");
const ls = { get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (_) { } } };

let toastT;
function toast(msg) { toastEl.textContent = msg; toastEl.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => toastEl.hidden = true, 2800); }
function fmtTime(ts) {
  const d = ts && ts.toDate ? ts.toDate() : null; if (!d) return "";
  const today = iso(new Date()) === iso(d);
  return (today ? "" : d.getDate() + "-" + MONTHS[d.getMonth()].slice(0, 3) + " ") + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

const configured = !!(firebaseConfig && firebaseConfig.apiKey && !/BU_YERGA/.test(firebaseConfig.apiKey + firebaseConfig.projectId) && ADMIN_UID && !/BU_YERGA/.test(ADMIN_UID));
let fbApp = null, auth = null, db = null;
if (configured) { fbApp = initializeApp(firebaseConfig); auth = getAuth(fbApp); db = getFirestore(fbApp); }
document.title = SITE_NAME || "Davomat daftari";
document.head.insertAdjacentHTML("beforeend", `<style>
.mrow{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-top:2px}
.mlab{font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);min-width:54px}
.mini{font-size:12px;font-weight:500;padding:1px 7px;border-radius:6px;background:var(--paper);color:var(--ink);border:1px solid var(--rule);white-space:nowrap}
.mini.s-k,.mini.s-x,.mini.s-s,.mini.s-y{border-color:transparent;font-weight:600}
.mini.none{color:var(--muted);border-style:dashed}
.mini.pp1{color:var(--muted)}
ol.roll li{grid-template-columns:28px minmax(0,1fr)!important}
.ctl{grid-column:2/-1;display:grid;grid-template-columns:76px minmax(0,1fr);gap:6px 10px;align-items:center}
.ctl .xl{font-size:11px}
.seg.lbl{width:100%}
.seg.lbl button{flex:1;min-width:0;height:auto;min-height:40px;padding:5px 4px;display:grid;justify-items:center;gap:0;line-height:1.15}
.seg.lbl button b{font:600 15px var(--f-mono)}
.seg.lbl button small{font:500 11.5px var(--f-body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.seg.lbl.txt button{font:500 13px var(--f-body);min-height:36px;align-content:center}
@media (max-width:560px){.ctl{grid-column:1/-1;grid-template-columns:64px minmax(0,1fr)}.seg.lbl button small{font-size:10.5px}}
.owner{font-size:11px;color:var(--muted);font-weight:500}
.tcard{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:10px 0;border-top:1px solid var(--rule)}
.tcard .meta{font-size:13px;color:var(--muted)}
.off{opacity:.55}
.note{border-left:3px solid var(--accent);background:var(--accent-soft);padding:9px 12px;border-radius:0 8px 8px 0;font-size:13px}
</style>`);

const S = {
  role: configured ? "loading" : "setup", loginMode: ls.get("dv_mode") || "parent",
  rules: { ...DEF },
  // o'qituvchi / admin
  uid: null, isAdmin: false, meT: null, ready: false,
  groups: [], students: [], att: {}, threads: {}, teachers: {}, loadedMonths: new Set(),
  tab: ls.get("dv_tab") || "bugun", gid: ls.get("dv_gid"), date: iso(new Date()), month: thisMonth(),
  confirmDel: null, detail: null, chat: null, msgs: [], cred: null, credBusy: null, tcred: null,
  // ota-ona
  me: null, groupName: "", lessons: {}, thread: null, pmsgs: [], ptab: "kabinet", pmonth: thisMonth()
};

let subs = [], chatUnsub = null;
function clearSubs() { subs.forEach(u => { try { u(); } catch (_) { } }); subs = []; if (chatUnsub) { chatUnsub(); chatUnsub = null; } }
const onErr = e => { console.error(e); toast("Ma'lumot o'qilmadi" + (e && e.code ? " (" + e.code + ")" : "")); };

function level(p) { const r = S.rules; if (p >= r.out) return 3; if (p >= r.talk) return 2; if (p >= r.warn) return 1; return 0; }
function tallyRecs(recs) {
  const t = { k: 0, x: 0, s: 0, y: 0, hwt: 0, hwq: 0, hwn: 0, parSum: 0, parN: 0, n: 0 };
  recs.forEach(r => {
    if (r.m && t[r.m] !== undefined) { t[r.m]++; t.n++; }
    if (r.h && t["hw" + r.h] !== undefined) t["hw" + r.h]++;
    const p = Number(r.p); if (p >= 1 && p <= 3) { t.parSum += p; t.parN++; }
  });
  t.pts = t.x * S.rules.late + t.y * S.rules.absent + t.hwn * S.rules.hw;
  t.par = t.parN ? t.parSum / t.parN : 0;
  return t;
}
const parWord = t => t.parN ? (t.par >= 2.5 ? "Faol" : t.par >= 1.5 ? "O'rta" : "Sust") : "–";
const host = () => (firebaseConfig.authDomain || "davomat.firebaseapp.com").replace(/^https?:\/\//, "");

/* ================= kirish ================= */
if (configured) {
  onAuthStateChanged(auth, async user => {
    clearSubs(); S.detail = null; S.chat = null; S.cred = null; S.tcred = null; S.isAdmin = false; S.meT = null;
    if (!user) { S.role = "login"; render(); return; }
    S.role = "loading"; render();
    if (user.uid === ADMIN_UID) { S.uid = user.uid; S.isAdmin = true; startTeacher(); return; }
    try {
      const t = await getDoc(doc(db, "teachers", user.uid));
      if (t.exists() && t.data().active === true) { S.uid = user.uid; S.meT = { id: user.uid, ...t.data() }; startTeacher(); return; }
    } catch (e) { console.error(e); }
    startParent(user);
  });
} else render();

async function doLogin(form) {
  const errEl = form.querySelector(".err"), btn = form.querySelector("button[type=submit]");
  errEl.textContent = ""; btn.disabled = true; btn.textContent = "Kirilmoqda…";
  try {
    const pw = form.querySelector("#l-pw").value;
    let id = form.querySelector("#l-id").value.trim();
    if (S.loginMode === "teacher" && id.includes("@")) {
      await signInWithEmailAndPassword(auth, id, pw);
    } else {
      const code = id.replace(/\D/g, "");
      if (code.length < 4) throw { code: "auth/invalid-credential" };
      const l = await getDoc(doc(db, "logins", code));
      if (!l.exists()) throw { code: "auth/invalid-credential" };
      await signInWithEmailAndPassword(auth, l.data().email, pw);
    }
  } catch (e) {
    const c = e && e.code || "";
    errEl.textContent = c.includes("too-many") ? "Ko'p marta noto'g'ri urinildi. Bir necha daqiqadan keyin qayta urinib ko'ring."
      : c.includes("network") ? "Internet aloqasi yo'q. Tarmoqni tekshirib, qayta urinib ko'ring."
      : "Kod yoki parol noto'g'ri. Tekshirib, qayta urinib ko'ring.";
    btn.disabled = false; btn.textContent = "Kirish";
  }
}
function vLogin() {
  const t = S.loginMode === "teacher";
  return `<section class="sheet login">
    <div><h1><small>Arab tili guruhlari</small>${esc(SITE_NAME)}</h1></div>
    <div class="seg" role="group" aria-label="Kim kiryapti">
      <button class="${t ? "" : "k"}" style="flex:1;font-family:var(--f-body);font-weight:600" data-mode="parent" aria-pressed="${!t}">Ota-ona</button>
      <button class="${t ? "k" : ""}" style="flex:1;font-family:var(--f-body);font-weight:600" data-mode="teacher" aria-pressed="${t}">O'qituvchi</button>
    </div>
    <form id="loginf" autocomplete="on">
      <label for="l-id">${t ? "O'qituvchi kodi (yoki email)" : "O'quvchi kodi"}<input type="${t ? "text" : "tel"}" id="l-id" ${t ? "" : `inputmode="numeric"`} autocomplete="username" placeholder="Masalan: 482193" required></label>
      <label for="l-pw">Parol<input type="password" id="l-pw" autocomplete="current-password" required></label>
      <p class="err" role="alert"></p>
      <button class="btn primary" type="submit">Kirish</button>
      <p class="hint">${t ? "Kod va parolni bosh o'qituvchidan olasiz." : "Kod va parolni farzandingiz o'qituvchisidan olasiz. Har bir o'quvchining kodi alohida."}</p>
    </form>
  </section>`;
}
function vSetup() {
  return `<section class="sheet setup"><h1><small>Sozlash kerak</small>${esc(SITE_NAME)}</h1>
    <p>Sayt hali Firebase loyihangizga ulanmagan. <code>firebase-config.js</code> faylini to'ldiring.</p></section>`;
}

/* ================= o'qituvchi: ma'lumot ================= */
const ownQ = () => S.isAdmin ? [] : [where("owner", "==", S.uid)];
function attDoc(d) {
  const x = d.data();
  return { groupId: x.groupId, owner: x.owner || "", date: String(x.date || ""), task: x.task || "", marks: { ...(x.marks || {}) }, hw: { ...(x.hw || {}) }, par: { ...(x.par || {}) }, notified: { ...(x.notified || {}) } };
}
function startTeacher() {
  S.role = "teacher"; S.ready = false; S.att = {}; S.loadedMonths = new Set(recentMonths()); render();
  const seen = {}; let n = 0;
  const first = k => { if (!seen[k]) { seen[k] = 1; if (++n === 3) { S.ready = true; if (S.isAdmin) migrate(); } } render(); };
  subs.push(onSnapshot(query(collection(db, "groups"), ...ownQ()), q => {
    S.groups = q.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.created || 0) - (b.created || 0)); first("g");
  }, onErr));
  subs.push(onSnapshot(query(collection(db, "students"), ...ownQ()), q => { S.students = q.docs.map(d => ({ id: d.id, ...d.data() })); first("s"); }, onErr));
  // Faqat oxirgi 3 oy jonli kuzatiladi (har oy uchun alohida, oddiy so'rov)
  let gotA = 0;
  recentMonths().forEach(mon => subs.push(onSnapshot(query(collection(db, "attendance"), ...ownQ(), where("month", "==", mon)), q => {
    const m = { ...S.att };
    q.docChanges().forEach(ch => { if (ch.type === "removed") delete m[ch.doc.id]; else m[ch.doc.id] = attDoc(ch.doc); });
    Object.keys(pend).forEach(k => { if (S.att[k]) m[k] = S.att[k]; }); // saqlanmagan o'zgarishlar ustun
    S.att = m; if (++gotA >= 3) first("a"); else render();
  }, onErr)));
  subs.push(onSnapshot(doc(db, "settings", "rules"), d => { S.rules = { ...DEF, ...(d.exists() ? d.data() : {}) }; render(); }, onErr));
  subs.push(onSnapshot(query(collection(db, "threads"), ...ownQ()), q => { const m = {}; q.docs.forEach(d => m[d.id] = d.data({ serverTimestamps: "estimate" })); S.threads = m; render(); }, onErr));
  if (S.isAdmin) subs.push(onSnapshot(collection(db, "teachers"), q => { const m = {}; q.docs.forEach(d => m[d.id] = { id: d.id, ...d.data() }); S.teachers = m; render(); }, onErr));
}
// Eski oylar faqat kerak bo'lganda bir marta yuklanadi
async function ensureMonth(m) {
  if (!m || S.loadedMonths.has(m) || S.role !== "teacher") return;
  S.loadedMonths.add(m);
  try {
    const q = await getDocs(query(collection(db, "attendance"), ...ownQ(), where("month", "==", m)));
    const a = { ...S.att }; q.docs.forEach(d => { a[d.id] = attDoc(d); }); S.att = a; render(); renderDlg();
  } catch (e) { S.loadedMonths.delete(m); onErr(e); }
}
// Avvalgi versiyadagi ma'lumotlarga egasini (owner) va oyni yozib qo'yish — faqat admin, bir marta
let migrated = false;
async function migrate() {
  if (migrated) return; migrated = true;
  try {
    const ops = [];
    const ownerOf = sid => (S.students.find(s => s.id === sid) || {}).owner || ADMIN_UID;
    S.groups.filter(g => !g.owner).forEach(g => ops.push(["groups", g.id, { owner: ADMIN_UID }]));
    S.students.filter(s => !s.owner).forEach(s => ops.push(["students", s.id, { owner: (S.groups.find(g => g.id === s.groupId) || {}).owner || ADMIN_UID }]));
    const att = await getDocs(collection(db, "attendance"));
    att.docs.forEach(d => { const x = d.data(); if (!x.owner || !x.month) ops.push(["attendance", d.id, { owner: x.owner || (S.groups.find(g => g.id === x.groupId) || {}).owner || ADMIN_UID, month: String(x.date || "").slice(0, 7) }]); });
    const th = await getDocs(collection(db, "threads"));
    th.docs.forEach(d => { if (!d.data().owner) ops.push(["threads", d.id, { owner: ownerOf(d.id) }]); });
    const lg = await getDocs(collection(db, "logins"));
    lg.docs.forEach(d => { const x = d.data(); if (!x.owner) ops.push(["logins", d.id, { owner: x.sid ? ownerOf(x.sid) : ADMIN_UID }]); });
    for (let i = 0; i < ops.length; i += 400) {
      const b = writeBatch(db); ops.slice(i, i + 400).forEach(([c, id, data]) => b.update(doc(db, c, id), data)); await b.commit();
    }
    if (ops.length) { toast("Eski ma'lumotlar yangi tizimga moslandi"); S.loadedMonths = new Set(); clearSubs(); startTeacher(); }
  } catch (e) { console.error("migrate", e); }
}
const activeStudents = gid => S.students.filter(s => s.groupId === gid && s.active !== false).sort((a, b) => a.name.localeCompare(b.name, "uz"));
const docsFor = (gid, month) => Object.values(S.att).filter(a => a.groupId === gid && a.date.startsWith(month)).sort((a, b) => a.date < b.date ? -1 : 1);
const recsFor = (sid, docs) => docs.map(d => ({ date: d.date, task: d.task, m: d.marks[sid], h: d.hw[sid], p: d.par[sid] }));
const unreadCount = () => Object.entries(S.threads).filter(([sid, t]) => t.unreadTeacher && S.students.some(s => s.id === sid && s.parentUid)).length;
const groupOwner = gid => (S.groups.find(g => g.id === gid) || {}).owner || S.uid;
const teacherName = uid => uid === ADMIN_UID ? "Siz" : ((S.teachers[uid] || {}).name || "O'qituvchi");

/* yozish: yo'qlama + har o'quvchining dars yozuvi */
const pend = {}; let flushT = null, flushing = false;
function editDoc(fn, changed, quiet) {
  const key = S.gid + "_" + S.date, o = S.att[key] || {};
  const d = { groupId: S.gid, owner: o.owner || groupOwner(S.gid), date: S.date, task: o.task || "", marks: { ...(o.marks || {}) }, hw: { ...(o.hw || {}) }, par: { ...(o.par || {}) }, notified: { ...(o.notified || {}) } };
  const notify = [];
  fn(d, notify);
  S.att = { ...S.att, [key]: d };
  const p = pend[key] || (pend[key] = { sids: new Set(), all: false, notify: new Set() });
  if (changed === "all") p.all = true; else changed.forEach(x => p.sids.add(x));
  notify.forEach(x => p.notify.add(x));
  if (!quiet) render();
  clearTimeout(flushT); flushT = setTimeout(flush, quiet ? 900 : 450);
}
async function flush() {
  if (flushing) { clearTimeout(flushT); flushT = setTimeout(flush, 300); return; }
  flushing = true;
  for (const key of Object.keys(pend)) {
    const p = pend[key]; delete pend[key];
    const a = S.att[key]; if (!a) continue;
    const sids = [...new Set([...(p.all ? activeStudents(a.groupId).map(s => s.id) : []), ...p.sids])];
    try {
      const b = writeBatch(db);
      b.set(doc(db, "attendance", key), { groupId: a.groupId, owner: a.owner, month: a.date.slice(0, 7), date: a.date, task: a.task || "", marks: a.marks, hw: a.hw, par: a.par, notified: a.notified });
      p.notify.forEach(sid => {
        const st = S.students.find(x => x.id === sid); if (!st || !st.parentUid) return;
        const dt = new Date(a.date + "T12:00:00");
        const text = `Assalomu alaykum. ${dt.getDate()}-${MONTHS[dt.getMonth()]} kuni ${st.name} darsga sababsiz kelmadi. Iltimos, sababini shu yerga yozib qoldiring.`;
        b.set(doc(collection(db, "threads", sid, "messages")), { from: "teacher", text, at: serverTimestamp() });
        b.set(doc(db, "threads", sid), { owner: st.owner || a.owner, lastAt: serverTimestamp(), lastText: text.slice(0, 120), lastFrom: "teacher", unreadParent: true }, { merge: true });
      });
      await b.commit();
      // Har o'quvchining dars yozuvi — kichik bo'laklarda (server qoidalari cheklovi uchun)
      for (let i = 0; i < sids.length; i += 8) {
        const lb = writeBatch(db);
        sids.slice(i, i + 8).forEach(sid => {
          const r = { groupId: a.groupId, date: a.date, task: a.task || "" };
          if (a.marks[sid]) r.m = a.marks[sid]; if (a.hw[sid]) r.h = a.hw[sid]; if (a.par[sid]) r.p = Number(a.par[sid]);
          lb.set(doc(db, "students", sid, "lessons", a.date), r);
        });
        await lb.commit();
      }
      toast("Saqlandi ✓");
    } catch (e) {
      console.error(e); toast("Saqlanmadi. Internetni tekshiring — keyinroq qayta yuboriladi.");
      const q = pend[key] || (pend[key] = { sids: new Set(), all: false, notify: new Set() });
      if (p.all) q.all = true; p.sids.forEach(x => q.sids.add(x)); p.notify.forEach(x => q.notify.add(x));
      clearTimeout(flushT); flushT = setTimeout(flush, 5000);
    }
  }
  flushing = false;
}
window.addEventListener("beforeunload", e => { if (Object.keys(pend).length) { flush(); e.preventDefault(); e.returnValue = ""; } });

const toggle = (o, k, v) => { if (o[k] === v) delete o[k]; else o[k] = v; };
function setMark(sid, m) {
  editDoc((d, notify) => {
    toggle(d.marks, sid, m);
    if (m === "s" || m === "y") delete d.par[sid];
    const st = S.students.find(x => x.id === sid);
    if (d.marks[sid] === "y" && S.rules.autoNotify && st && st.parentUid && !d.notified[sid]) { d.notified[sid] = true; notify.push(sid); }
  }, [sid]);
}
const setHw = (sid, v) => editDoc(d => toggle(d.hw, sid, v), [sid]);
const setPar = (sid, v) => editDoc(d => toggle(d.par, sid, v), [sid]);
const markAll = () => editDoc(d => { activeStudents(S.gid).forEach(s => { if (!d.marks[s.id]) d.marks[s.id] = "k"; }); }, "all");

/* kirish kodlari va parollar */
const PWCH = "abcdefghjkmnpqrstuvwxyz23456789";
const rnd = n => { const a = new Uint32Array(n); crypto.getRandomValues(a); return a; };
const genPw = () => Array.from(rnd(7), x => PWCH[x % PWCH.length]).join("");
async function uniqueCode() {
  for (let i = 0; i < 12; i++) { const c = String(100000 + rnd(1)[0] % 900000); if (!(await getDoc(doc(db, "logins", c))).exists()) return c; }
  throw new Error("Kod topilmadi");
}
async function newAccount(prefix, code) {
  const sec = initializeApp(firebaseConfig, "sec-" + Date.now());
  try {
    const pw = genPw();
    const email = `${prefix}${code}.${Date.now().toString(36)}@${host()}`;
    const cred = await createUserWithEmailAndPassword(getAuth(sec), email, pw);
    await signOut(getAuth(sec));
    return { uid: cred.user.uid, email, pw };
  } finally { deleteApp(sec).catch(() => { }); }
}
async function makeLogin(st) {
  S.credBusy = st.id; render();
  try {
    const code = st.code || await uniqueCode();
    const acc = await newAccount("p", code);
    const owner = st.owner || groupOwner(st.groupId);
    const b = writeBatch(db);
    b.set(doc(db, "logins", code), { email: acc.email, sid: st.id, role: "parent", owner });
    b.update(doc(db, "students", st.id), { code, parentUid: acc.uid, owner, groupName: (S.groups.find(g => g.id === st.groupId) || {}).name || "" });
    b.set(doc(db, "threads", st.id), { parentUid: acc.uid, owner }, { merge: true });
    await b.commit();
    S.cred = { sid: st.id, code, pw: acc.pw };
    toast("Kirish tayyor");
  } catch (e) { console.error(e); toast("Kirish yaratilmadi" + (e.code ? " (" + e.code + ")" : "") + ". Qayta urinib ko'ring."); }
  finally { S.credBusy = null; render(); }
}
function archiveBatch(b, st) {
  b.update(doc(db, "students", st.id), { active: false, parentUid: null, code: null });
  if (st.code) b.delete(doc(db, "logins", st.code));
}
function credText(st, c) {
  const url = location.origin + location.pathname;
  return `Assalomu alaykum! ${st.name}ning davomat kabinetiga kirish:\nSayt: ${url}\n"Ota-ona" bo'limini tanlang.\nKod: ${c.code}\nParol: ${c.pw}\nKirgandan keyin "Sozlamalar"da parolni o'zgartirishingiz mumkin.`;
}

/* admin: o'qituvchilar */
async function createTeacher(name) {
  S.credBusy = "newT"; render();
  try {
    const code = await uniqueCode();
    const acc = await newAccount("t", code);
    const b = writeBatch(db);
    b.set(doc(db, "teachers", acc.uid), { name, code, active: true, created: Date.now() });
    b.set(doc(db, "logins", code), { email: acc.email, role: "teacher", owner: ADMIN_UID });
    await b.commit();
    S.tcred = { tid: acc.uid, name, code, pw: acc.pw };
    toast("O'qituvchi qo'shildi");
  } catch (e) { console.error(e); toast("O'qituvchi qo'shilmadi" + (e.code ? " (" + e.code + ")" : "")); }
  finally { S.credBusy = null; render(); }
}
// Yangi parol: yangi akkaunt ochiladi va o'qituvchining barcha ma'lumoti unga o'tkaziladi
async function resetTeacher(t) {
  S.credBusy = t.id; render();
  try {
    const acc = await newAccount("t", t.code);
    const ops = [];
    for (const c of ["groups", "students", "attendance", "threads", "logins"]) {
      const q = await getDocs(query(collection(db, c), where("owner", "==", t.id)));
      q.docs.forEach(d => ops.push(["u", c, d.id, { owner: acc.uid }]));
    }
    ops.push(["s", "teachers", acc.uid, { name: t.name, code: t.code, active: true, created: t.created || Date.now() }]);
    ops.push(["s", "logins", t.code, { email: acc.email, role: "teacher", owner: ADMIN_UID }]);
    ops.push(["d", "teachers", t.id]);
    for (let i = 0; i < ops.length; i += 400) {
      const b = writeBatch(db);
      ops.slice(i, i + 400).forEach(([k, c, id, data]) => { const r = doc(db, c, id); if (k === "u") b.update(r, data); else if (k === "s") b.set(r, data); else b.delete(r); });
      await b.commit();
    }
    S.tcred = { tid: acc.uid, name: t.name, code: t.code, pw: acc.pw };
    toast("Yangi parol tayyor");
  } catch (e) { console.error(e); toast("Parol yangilanmadi" + (e.code ? " (" + e.code + ")" : "")); }
  finally { S.credBusy = null; render(); }
}
function tcredText(c) {
  const url = location.origin + location.pathname;
  return `Assalomu alaykum, ${c.name}! Davomat daftariga o'qituvchi sifatida kirish:\nSayt: ${url}\n"O'qituvchi" bo'limini tanlang.\nKod: ${c.code}\nParol: ${c.pw}\nKirgandan keyin "Sozlamalar"da parolni o'zgartiring.`;
}

/* xabarlar */
async function sendMsg(sid, text, from) {
  text = text.trim().slice(0, 2000); if (!text) return false;
  const b = writeBatch(db);
  b.set(doc(collection(db, "threads", sid, "messages")), { from, text, at: serverTimestamp() });
  const meta = { lastAt: serverTimestamp(), lastText: text.slice(0, 120), lastFrom: from };
  meta[from === "teacher" ? "unreadParent" : "unreadTeacher"] = true;
  b.set(doc(db, "threads", sid), meta, { merge: true });
  try { await b.commit(); return true; } catch (e) { console.error(e); toast("Xabar yuborilmadi. Internetni tekshiring."); return false; }
}
function openChat(sid) {
  if (chatUnsub) chatUnsub();
  S.chat = { sid }; S.detail = null; S.msgs = [];
  chatUnsub = onSnapshot(query(collection(db, "threads", sid, "messages"), orderBy("at", "desc"), limit(200)), q => {
    S.msgs = q.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) })).reverse();
    const t = S.threads[sid]; if (t && t.unreadTeacher) updateDoc(doc(db, "threads", sid), { unreadTeacher: false }).catch(() => { });
    renderDlg(true);
  }, onErr);
  renderDlg();
}
function closeDlg() {
  const back = (S.detail && S.detail.back) || (S.chat && S.chat.back);
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }
  S.detail = null; S.chat = null; renderDlg();
  try { back && back.isConnected && back.focus(); } catch (_) { }
}

/* ================= o'qituvchi: ko'rinishlar ================= */
function groupChips() {
  if (!S.groups.length) return "";
  return `<div class="bar" role="group" aria-label="Guruh">${S.groups.map(g => `<button class="chip" data-gid="${esc(g.id)}" aria-pressed="${g.id === S.gid}">${S.isAdmin && g.owner && g.owner !== ADMIN_UID ? `<span class="owner">${esc(teacherName(g.owner))} · </span>` : ""}${esc(g.name)}</button>`).join("")}</div>`;
}
const loadingCard = () => `<section class="sheet empty"><div class="spin" aria-label="Yuklanmoqda"></div></section>`;
const emptyGroups = () => `<section class="sheet empty"><h2>Daftar hali bo'sh</h2>
  <p>Avval guruh oching va o'quvchilar ismini kiriting. Keyin har dars boshida bitta bosish bilan yo'qlama qilasiz.</p>
  <button class="btn primary" data-go="guruh">Guruh qo'shish</button></section>`;

function todayTags(m, h, p) {
  const out = [];
  if (m) out.push(`<span class="mini s-${m}">${MARKS[m].sym} ${MARKS[m].label}</span>`);
  if (h) out.push(`<span class="mini ${{ t: "s-k", q: "s-x", n: "s-y" }[h]}">Vazifa ${HW[h].sym} ${HW[h].label}</span>`);
  const pv = Number(p); if (pv >= 1 && pv <= 3) out.push(`<span class="mini pp${pv}">Faollik: ${PAR[pv]}</span>`);
  return out.length ? out.join("") : `<span class="mini none">hali belgilanmagan</span>`;
}
function vBugun() {
  if (!S.ready) return loadingCard();
  if (!S.groups.length) return emptyGroups();
  const list = activeStudents(S.gid);
  const key = S.gid + "_" + S.date, a = S.att[key] || {}, marks = a.marks || {}, hw = a.hw || {}, par = a.par || {};
  const docs = docsFor(S.gid, S.date.slice(0, 7));
  const c = { k: 0, x: 0, s: 0, y: 0 }, an = { k: [], x: [], s: [], y: [] }, hc = { t: 0, q: 0, n: 0 }, hn = { t: [], q: [], n: [] };
  list.forEach(s => { const m = marks[s.id]; if (m) { c[m]++; an[m].push(s); } const h = hw[s.id]; if (h) { hc[h]++; hn[h].push(s); } });
  const left = list.length - c.k - c.x - c.s - c.y;
  const d = new Date(S.date + "T12:00:00");
  const pills = arr => arr.map(s => `<button class="nm" data-open="${esc(s.id)}">${esc(s.name)}</button>`).join("");
  const names = arr => arr.length ? `<span class="nms">${pills(arr)}</span>` : "";
  return `<section class="sheet">
    ${groupChips()}
    <div class="bar between">
      <div class="date">
        <button class="btn" data-shift="-1" aria-label="Oldingi kun">‹</button>
        <input type="date" id="date" value="${S.date}" aria-label="Sana">
        <button class="btn" data-shift="1" aria-label="Keyingi kun">›</button>
      </div>
      <button class="btn primary" data-act="all" ${list.length && left ? "" : "disabled"}>Qolganlarni “Keldi” qilish</button>
    </div>
    <p class="hint">${WD[d.getDay()]}, ${d.getDate()}-${MONTHS[d.getMonth()]} · ${left ? `<b>${left} ta</b> o'quvchi belgilanmagan` : "Yo'qlama to'liq"}</p>
    <label class="task" for="task"><span class="xl">Bugun tekshiriladigan vazifa</span>
      <input type="text" id="task" maxlength="140" value="${esc(a.task || "")}" placeholder="Masalan: Fahmul Maqru, 4-dars lug'ati yod"></label>
    <div class="stats">
      <div class="stat s-k"><b>${c.k}</b><span>Keldi</span></div>
      <div class="stat s-x"><b>${c.x}</b><span>Kechikdi</span>${names(an.x)}</div>
      <div class="stat s-s"><b>${c.s}</b><span>Sababli</span>${names(an.s)}</div>
      <div class="stat s-y"><b>${c.y}</b><span>Sababsiz</span>${names(an.y)}</div>
    </div>
    ${hc.t + hc.q + hc.n ? `<dl class="hwl">${Object.keys(HW).filter(k => hc[k]).map(k => `<div><dt class="c-${k}">${HW[k].sym} ${HW[k].label} · ${hc[k]}</dt><dd class="nms">${pills(hn[k])}</dd></div>`).join("")}</dl>` : ""}
    <p class="note">Har o'quvchi uchun uch qatorni belgilang: <b>Davomat</b> (keldimi), <b>Vazifa</b> (uy vazifasini topshirdimi), <b>Faollik</b> (darsda qanday qatnashdi). Xato bossangiz, o'sha tugmani qayta bosing — belgi olib tashlanadi.</p>
    ${list.length ? `<ol class="roll">${list.map((s, i) => {
      const t = tallyRecs(recsFor(s.id, docs)), lv = level(t.pts), m = marks[s.id], off = m === "s" || m === "y";
      return `<li><span class="num">${i + 1}</span>
        <div class="who"><button class="nmb" data-open="${esc(s.id)}" title="Darslardagi ishtirokini ko'rish">${esc(s.name)}</button>
          <div class="mrow"><span class="mlab">Bugun:</span>${todayTags(m, hw[s.id], par[s.id])}</div>
          <div class="mrow"><span class="mlab">Shu oy:</span><span class="mini">Davomat ${t.k + t.x}/${t.n}</span><span class="mini">Vazifa ${t.hwt}/${t.hwt + t.hwq + t.hwn}</span><span class="mini">Faollik: ${parWord(t)}</span><span class="lvl lv${lv}">${t.pts} ball · ${LVL[lv]}</span></div></div>
        <div class="ctl">
          <span class="xl">Davomat</span>
          <div class="seg lbl" role="group" aria-label="${esc(s.name)} davomati">${Object.keys(MARKS).map(k => `<button class="${k}" data-sid="${esc(s.id)}" data-m="${k}" aria-pressed="${m === k}"><b>${MARKS[k].sym}</b><small>${MARKS[k].label}</small></button>`).join("")}</div>
          <span class="xl">Vazifa</span>
          <div class="seg lbl" role="group" aria-label="${esc(s.name)} vazifasi">${Object.keys(HW).map(k => `<button class="h${k}" data-sid="${esc(s.id)}" data-hw="${k}" aria-pressed="${hw[s.id] === k}"><b>${HW[k].sym}</b><small>${HW[k].label}</small></button>`).join("")}</div>
          <span class="xl">Faollik</span>
          <div class="seg lbl txt" role="group" aria-label="${esc(s.name)} faolligi">${[1, 2, 3].map(v => `<button class="p${v}" data-sid="${esc(s.id)}" data-par="${v}" aria-pressed="${Number(par[s.id]) === v}" ${off ? "disabled" : ""}>${PAR[v]}</button>`).join("")}</div>
        </div></li>`;
    }).join("")}</ol>`
      : `<div class="empty"><p>Bu guruhda o'quvchi yo'q.</p><button class="btn" data-go="guruh">O'quvchi qo'shish</button></div>`}
  </section>`;
}

function vJurnal() {
  if (!S.ready) return loadingCard();
  if (!S.groups.length) return emptyGroups();
  const list = activeStudents(S.gid), docs = docsFor(S.gid, S.month);
  const mo = Number(S.month.slice(5, 7));
  const rows = list.map(s => ({ s, t: tallyRecs(recsFor(s.id, docs)) })).sort((a, b) => b.t.pts - a.t.pts || a.s.name.localeCompare(b.s.name, "uz"));
  const flagged = rows.filter(r => level(r.t.pts) > 0);
  return `<section class="sheet">
    ${groupChips()}
    <div class="bar between"><h2>${monthTitle(S.month)} · ${docs.length} ta dars</h2>
      <input type="month" id="month" value="${S.month}" aria-label="Oy"></div>
    ${flagged.length ? `<div class="ladder">${flagged.map(r => { const lv = level(r.t.pts); return `<div class="step lv${lv}"><b>${r.t.pts} ball</b><strong>${esc(r.s.name)}</strong><p>${LVL[lv]} · ${r.t.y} sababsiz, ${r.t.x} kechikish, ${r.t.hwn} vazifa topshirilmagan</p></div>`; }).join("")}</div>`
      : `<p class="hint">Bu oy chora ko'rilishi kerak bo'lgan o'quvchi yo'q.</p>`}
    ${docs.length && list.length ? `<div class="scroll"><table>
      <thead><tr><th class="name">O'quvchi</th>${docs.map(d => `<th>${Number(d.date.slice(8))}</th>`).join("")}<th>+</th><th>k</th><th>s</th><th>y</th><th>Vazifa</th><th>Faollik</th><th>Ball</th></tr></thead>
      <tbody>${rows.map(({ s, t }) => `<tr><td class="name"><button class="nmb" data-open="${esc(s.id)}">${esc(s.name)}</button></td>${docs.map(d => { const m = d.marks[s.id]; return `<td class="m ${m || ""}">${m ? MARKS[m].sym : "·"}</td>`; }).join("")}
        <td>${t.k}</td><td>${t.x}</td><td>${t.s}</td><td>${t.y}</td>
        <td>${t.hwt + t.hwq + t.hwn ? `${t.hwt}/${t.hwt + t.hwq + t.hwn}` : "–"}</td>
        <td>${parWord(t)}</td><td><span class="lvl lv${level(t.pts)}">${t.pts}</span></td></tr>`).join("")}</tbody>
    </table></div>` : `<div class="empty"><p>Bu oyda hali yo'qlama qilinmagan.</p></div>`}
    <p class="hint">Jadvalda: + keldi, k kechikdi, s sababli, y sababsiz. Ballar har oy boshida noldan boshlanadi. Ism ustiga bosib o'quvchi kartasini oching.</p>
    <h2>Shu oy tekshirilgan vazifalar</h2>
    ${docs.some(d => d.task) ? `<ol class="tasks">${docs.filter(d => d.task).map(d => {
      const tt = list.filter(s => d.hw[s.id] === "t").length;
      return `<li><span class="d">${Number(d.date.slice(8))}-${MONTHS[mo - 1].slice(0, 3)}</span><span class="t">${esc(d.task)}</span><span class="r c-t">${tt}/${list.length}</span></li>`;
    }).join("")}</ol>` : `<p class="hint">Yo'qlama sahifasidagi "Bugun tekshiriladigan vazifa" maydonini to'ldirsangiz, vazifalar shu yerda chiqadi.</p>`}
  </section>`;
}

function vXabar() {
  if (!S.ready) return loadingCard();
  const withLogin = S.students.filter(s => s.parentUid && s.active !== false);
  if (!withLogin.length) return `<section class="sheet empty"><h2>Hali hech bir ota-ona ulanmagan</h2>
    <p>"O'quvchilar" bo'limida o'quvchi yonidagi "Kirish yaratish" tugmasini bosing va chiqqan kod hamda parolni ota-onaga yuboring.</p>
    <button class="btn primary" data-go="guruh">O'quvchilarga o'tish</button></section>`;
  const gname = id => (S.groups.find(g => g.id === id) || {}).name || "";
  const ms = t => t && t.lastAt && t.lastAt.toMillis ? t.lastAt.toMillis() : 0;
  const rows = withLogin.map(s => ({ s, t: S.threads[s.id] || {} })).sort((a, b) => (b.t.unreadTeacher ? 1 : 0) - (a.t.unreadTeacher ? 1 : 0) || ms(b.t) - ms(a.t) || a.s.name.localeCompare(b.s.name, "uz"));
  return `<section class="sheet"><h2>Ota-onalar bilan yozishma</h2>
    <ul class="tlist">${rows.map(({ s, t }) => `<li><button data-chat="${esc(s.id)}">
      <span class="nmline">${esc(s.name)}${t.unreadTeacher ? `<span class="dot" title="Yangi xabar"></span>` : ""}</span>
      <span class="when">${esc(gname(s.groupId))}${t.lastAt ? " · " + fmtTime(t.lastAt) : ""}</span>
      <span class="last">${t.lastText ? (t.lastFrom === "teacher" ? "Siz: " : "") + esc(t.lastText) : "Hali xabar yo'q"}</span></button></li>`).join("")}</ul>
  </section>`;
}

function vGuruh() {
  if (!S.ready) return loadingCard();
  return `<section class="sheet"><h2>Yangi guruh</h2>
    <form class="bar" id="gform"><input type="text" id="gname" placeholder="Masalan: CEFR B2 — ertalabki" style="flex:1" maxlength="60"><button class="btn primary">Qo'shish</button></form></section>
  <div class="glist">${S.groups.map(g => {
    const st = activeStudents(g.id);
    return `<section class="sheet group">
      <div class="bar between"><h2>${esc(g.name)} <span class="hint">· ${st.length} o'quvchi${S.isAdmin && g.owner && g.owner !== ADMIN_UID ? " · " + esc(teacherName(g.owner)) : ""}</span></h2>
        ${S.confirmDel === g.id ? `<span class="bar"><button class="btn danger" data-delg="${esc(g.id)}">Ha, o'chirilsin</button><button class="btn" data-cancel>Bekor</button></span>`
          : `<button class="btn danger small" data-askdel="${esc(g.id)}">Guruhni o'chirish</button>`}</div>
      ${st.length ? `<div>${st.map(s => `<div class="srow">
          <div><button class="nmb" data-open="${esc(s.id)}">${esc(s.name)}</button><br><span class="code">${s.parentUid && s.code ? "Kod: " + esc(s.code) + " · ota-ona ulangan" : "Ota-ona hali ulanmagan"}</span></div>
          <div class="bar">
            <button class="btn small ${s.parentUid ? "" : "primary"}" data-mk="${esc(s.id)}" ${S.credBusy ? "disabled" : ""}>${S.credBusy === s.id ? "Yaratilmoqda…" : s.parentUid ? "Yangi parol" : "Kirish yaratish"}</button>
            <button class="btn small ghost" data-rm="${esc(s.id)}" aria-label="${esc(s.name)}ni guruhdan chiqarish" title="Guruhdan chiqarish">×</button>
          </div>
          ${S.cred && S.cred.sid === s.id ? `<div class="cred"><span class="xl">Ota-onaga yuboring — parol faqat hozir ko'rinadi</span>
            <pre id="credtxt">${esc(credText(s, S.cred))}</pre>
            <div class="bar"><button class="btn small primary" data-copy>Nusxa olish</button><button class="btn small" data-credok>Yubordim, yopish</button></div></div>` : ""}
        </div>`).join("")}</div>` : `<p class="hint">Hali o'quvchi yo'q.</p>`}
      <form class="sform" data-g="${esc(g.id)}" style="display:grid;gap:8px">
        <label class="hint" for="ta-${esc(g.id)}">Ismlarni qo'shing — har qatorda bittadan</label>
        <textarea id="ta-${esc(g.id)}" placeholder="Aziza Karimova&#10;Bobur Rahimov"></textarea>
        <div><button class="btn primary">O'quvchilarni qo'shish</button></div>
      </form></section>`;
  }).join("")}</div>
  <p class="hint">"Yangi parol" eski parolni darhol bekor qiladi. O'quvchini guruhdan chiqarsangiz, ota-onasining kirishi ham yopiladi.</p>`;
}

function vTeachers() {
  if (!S.ready) return loadingCard();
  const list = Object.values(S.teachers).sort((a, b) => (a.created || 0) - (b.created || 0));
  const cnt = (uid, arr) => arr.filter(x => x.owner === uid && x.active !== false).length;
  return `<section class="sheet"><h2>Yangi o'qituvchi qo'shish</h2>
      <p class="hint">O'qituvchiga kod va parol beriladi. U o'z kabinetida faqat o'z guruhlari va o'quvchilarini ko'radi, o'quvchilar ota-onalariga o'zi parol beradi. Siz hammasini ko'rasiz.</p>
      <form class="bar" id="tform"><input type="text" id="tname" placeholder="Ism-familiyasi, masalan: Malika Rahimova" style="flex:1" maxlength="60"><button class="btn primary" ${S.credBusy ? "disabled" : ""}>${S.credBusy === "newT" ? "Yaratilmoqda…" : "Qo'shish"}</button></form>
    </section>
    <section class="sheet"><h2>O'qituvchilar · ${list.length}</h2>
      ${list.length ? list.map(t => `<div class="tcard ${t.active ? "" : "off"}">
        <div><strong>${esc(t.name)}</strong><div class="meta">Kod: ${esc(t.code)} · ${cnt(t.id, S.groups)} guruh · ${S.students.filter(s => s.owner === t.id && s.active !== false).length} o'quvchi${t.active ? "" : " · bloklangan"}</div></div>
        <div class="bar">
          <button class="btn small" data-treset="${esc(t.id)}" ${S.credBusy ? "disabled" : ""}>${S.credBusy === t.id ? "Yaratilmoqda…" : "Yangi parol"}</button>
          <button class="btn small ${t.active ? "danger" : "primary"}" data-tblock="${esc(t.id)}">${t.active ? "Bloklash" : "Faollashtirish"}</button>
        </div>
        ${S.tcred && S.tcred.tid === t.id ? `<div class="cred"><span class="xl">O'qituvchiga yuboring — parol faqat hozir ko'rinadi</span>
          <pre id="credtxt">${esc(tcredText(S.tcred))}</pre>
          <div class="bar"><button class="btn small primary" data-copy>Nusxa olish</button><button class="btn small" data-tcredok>Yubordim, yopish</button></div></div>` : ""}
      </div>`).join("") : `<p class="hint">Hali o'qituvchi qo'shilmagan.</p>`}
    </section>`;
}

function rulesList(r) {
  return `<ul class="rules">
    <li><span class="sym s-k">+</span><span>Dars boshlanishidan oldin kelgan</span><span class="pts">0 ball</span></li>
    <li><span class="sym s-x">k</span><span>${r.lateMin} daqiqagacha kechikish</span><span class="pts">${r.late} ball</span></li>
    <li><span class="sym s-y">y</span><span>${r.lateMin} daqiqadan ortiq kechikish — kelmagan deb yoziladi</span><span class="pts">${r.absent} ball</span></li>
    <li><span class="sym s-y">y</span><span>Xabarsiz qoldirish</span><span class="pts">${r.absent} ball</span></li>
    <li><span class="sym s-s">s</span><span>Sababli: dars boshlanishidan <b>oldin</b> xabar berilgan. Darsdan keyin aytilgan sabab qabul qilinmaydi.</span><span class="pts">0 ball</span></li>
    <li><span class="sym s-k">✓</span><span>Uy vazifasi to'liq topshirildi</span><span class="pts">0 ball</span></li>
    <li><span class="sym s-x">½</span><span>Vazifa chala — keyingi darsgacha to'ldiriladi</span><span class="pts">0 ball</span></li>
    <li><span class="sym s-y">✗</span><span>Vazifa topshirilmadi (darsga kelmagan bo'lsa ham so'raladi)</span><span class="pts">${r.hw} ball</span></li>
  </ul>
  <div class="ladder">
    <div class="step lv1"><b>${r.warn}+ ball</b><strong>Ogohlantirish</strong><p>Darsdan keyin yakkama-yakka suhbat.</p></div>
    <div class="step lv2"><b>${r.talk}+ ball</b><strong>Ota-ona bilan suhbat</strong><p>Ota-ona bilan uchrashuv yoki qo'ng'iroq.</p></div>
    <div class="step lv3"><b>${r.out}+ ball</b><strong>Chetlatish masalasi</strong><p>Guruhda qolish-qolmasligi hal qilinadi.</p></div>
  </div>
  <p class="hint">Ballar har oy boshida noldan boshlanadi. Faollik ball bermaydi, lekin o'rtachasi ko'rinib turadi.</p>`;
}
function vQoida() {
  const r = S.rules, dis = S.isAdmin ? "" : "disabled";
  return `<section class="sheet"><h2>Davomat qoidalari</h2>
    <p class="hint">Bu qoidalar barcha guruhlar va ota-onalar kabinetida bir xil.${S.isAdmin ? "" : " Ularni faqat bosh o'qituvchi o'zgartiradi."}</p>
    ${rulesList(r)}
    <label class="check" for="r-auto"><input type="checkbox" id="r-auto" ${r.autoNotify ? "checked" : ""} ${dis}>
      <span>O'quvchi sababsiz kelmasa, ota-onasiga avtomatik xabar yuborilsin</span></label>
    ${S.isAdmin ? `<details><summary style="cursor:pointer;font-weight:600">Raqamlarni o'zgartirish</summary>
      <div class="cfg" style="margin-top:12px">
        ${[["late", "Kechikish uchun ball"], ["absent", "Sababsiz uchun ball"], ["hw", "Vazifa topshirmaslik (ball)"], ["lateMin", "Kechikish chegarasi (daqiqa)"], ["warn", "Ogohlantirish (ball)"], ["talk", "Ota-ona suhbati (ball)"], ["out", "Chetlatish masalasi (ball)"]]
          .map(([k, l]) => `<label for="r-${k}">${l}<input type="number" min="0" max="99" id="r-${k}" data-rule="${k}" value="${r[k]}"></label>`).join("")}
      </div></details>` : ""}
  </section>`;
}
function pwSection() {
  return `<section class="sheet"><h2>Parolni o'zgartirish</h2>
      <form id="pwf" style="display:grid;gap:10px;max-width:380px">
        <label class="hint" for="pw-old">Hozirgi parol<input type="password" id="pw-old" autocomplete="current-password" required style="width:100%"></label>
        <label class="hint" for="pw-new">Yangi parol (kamida 6 belgi)<input type="password" id="pw-new" autocomplete="new-password" minlength="6" required style="width:100%"></label>
        <label class="hint" for="pw-new2">Yangi parolni takrorlang<input type="password" id="pw-new2" autocomplete="new-password" minlength="6" required style="width:100%"></label>
        <p class="err" role="alert"></p>
        <div><button class="btn primary" type="submit">Saqlash</button></div>
      </form>
      <div><button class="btn danger" data-logout>Chiqish</button></div></section>
    <section class="sheet"><h2>Telefonga o'rnatish</h2>
      <p class="hint">Saytni telefon ekraniga ilova kabi qo'yish mumkin. <b>Android (Chrome)</b>: ⋮ menyu → "Bosh ekranga qo'shish". <b>iPhone (Safari)</b>: "Ulashish" tugmasi → "Bosh ekranga qo'shish".</p></section>`;
}

function vTeacher() {
  const u = unreadCount();
  const tabs = [["bugun", "Yo'qlama"], ["jurnal", "Oylik jurnal"], ["xabar", "Xabarlar"], ["guruh", "O'quvchilar"]];
  if (S.isAdmin) tabs.push(["oqit", "O'qituvchilar"]);
  tabs.push(["qoida", "Qoidalar"], ["sozlama", "Sozlamalar"]);
  if (!tabs.some(([k]) => k === S.tab)) S.tab = "bugun";
  if (S.groups.length && !S.groups.some(g => g.id === S.gid)) S.gid = S.groups[0].id;
  const body = { bugun: vBugun, jurnal: vJurnal, xabar: vXabar, guruh: vGuruh, oqit: vTeachers, qoida: vQoida, sozlama: pwSection }[S.tab] || vBugun;
  const who = S.isAdmin ? "Bosh o'qituvchi (admin)" : "O'qituvchi · " + esc(S.meT ? S.meT.name : "");
  return `<header class="top"><h1><small>${who}</small>${esc(SITE_NAME)}</h1><button class="btn small" data-logout>Chiqish</button></header>
    <nav class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${S.tab === k}">${l}${k === "xabar" && u ? `<span class="badge">${u}</span>` : ""}</button>`).join("")}</nav>
    <main style="display:grid;gap:14px">${body()}</main>`;
}

/* kartochka (o'qituvchi uchun dialog, ota-ona uchun sahifa) */
function cardBody(name, gname, recs, month, extraBtn) {
  const t = tallyRecs(recs), lv = level(t.pts);
  const lessons = recs.slice().sort((a, b) => a.date < b.date ? 1 : -1);
  return `<div class="date">
      <button class="btn" data-dm="-1" aria-label="Oldingi oy">‹</button>
      <strong class="mname">${monthTitle(month)}</strong>
      <button class="btn" data-dm="1" aria-label="Keyingi oy">›</button>
    </div>
    <div class="dsum">
      <div><span class="xl">Ball</span><b>${t.pts}</b><span class="lvl lv${lv}">${LVL[lv]}</span></div>
      <div><span class="xl">Davomat</span><b>${t.k + t.x}/${t.n}</b><span class="hint">${t.x} kech · ${t.s} sab · ${t.y} sababsiz</span></div>
      <div><span class="xl">Vazifa</span><b>${t.hwt}/${t.hwt + t.hwq + t.hwn}</b><span class="hint">${t.hwq} qisman · ${t.hwn} yo'q</span></div>
      <div><span class="xl">Faollik</span><b>${parWord(t)}</b><span class="hint">${t.parN ? t.par.toFixed(1) + " / 3" : "belgilanmagan"}</span></div>
    </div>
    ${extraBtn || ""}
    ${lessons.length ? `<ol class="hist">${lessons.map(r => {
      const dt = new Date(r.date + "T12:00:00"), p = Number(r.p);
      return `<li><div class="hd"><b>${dt.getDate()}</b><span>${WD[dt.getDay()].slice(0, 3)}</span></div>
        <div class="hb"><div class="tags">
          <span class="tag ${r.m ? "s-" + r.m : ""}">${r.m ? MARKS[r.m].sym + " " + MARKS[r.m].label : "Belgilanmagan"}</span>
          ${p >= 1 && p <= 3 ? `<span class="tag pp${p}">Faollik: ${PAR[p]}</span>` : ""}
          ${r.h ? `<span class="tag ${{ t: "s-k", q: "s-x", n: "s-y" }[r.h]}">Vazifa ${HW[r.h].sym} ${HW[r.h].label}</span>` : ""}
        </div>${r.task ? `<p class="hint">Vazifa: ${esc(r.task)}</p>` : ""}</div></li>`;
    }).join("")}</ol>` : `<p class="hint">Bu oyda darslar bo'yicha yozuv yo'q.</p>`}`;
}
function vDetail() {
  const st = S.students.find(x => x.id === S.detail.sid); if (!st) return "";
  const g = S.groups.find(x => x.id === st.groupId);
  const recs = recsFor(st.id, docsFor(st.groupId, S.detail.month));
  const btn = st.parentUid ? `<button class="btn" data-chat="${esc(st.id)}">Ota-onaga xabar yozish</button>` : `<p class="hint">Ota-ona hali ulanmagan — "O'quvchilar" bo'limida kirish yarating.</p>`;
  return `<div class="panel" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
    <div class="ph"><div><span class="xl">${esc(g ? g.name : "")}</span><h2 id="dlg-t">${esc(st.name)}</h2></div><button class="btn x" data-close aria-label="Yopish">×</button></div>
    ${cardBody(st.name, g ? g.name : "", recs, S.detail.month, btn)}</div>`;
}
function chatBody(msgs, mine) {
  if (!msgs.length) return `<div class="chat" id="chatbox"><p class="hint" style="margin:auto;text-align:center">Hali xabar yo'q. Birinchi bo'lib yozing.</p></div>`;
  return `<div class="chat" id="chatbox">${msgs.map(m => `<div class="msg ${m.from === mine ? "me" : ""}">${esc(m.text)}<time>${fmtTime(m.at)}</time></div>`).join("")}</div>`;
}
function vChatDlg() {
  const st = S.students.find(x => x.id === S.chat.sid); if (!st) return "";
  return `<div class="panel chatp" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
    <div class="ph"><div><span class="xl">Ota-onasi bilan yozishma</span><h2 id="dlg-t">${esc(st.name)}</h2></div><button class="btn x" data-close aria-label="Yopish">×</button></div>
    ${chatBody(S.msgs, "teacher")}
    <form class="compose" id="tsend"><textarea id="tmsg" maxlength="2000" placeholder="Xabar yozing…" aria-label="Xabar"></textarea><button class="btn primary">Yuborish</button></form>
  </div>`;
}
function renderDlg(keepInput) {
  const open = (S.detail && S.students.some(x => x.id === S.detail.sid)) || (S.chat && S.students.some(x => x.id === S.chat.sid));
  if (!open) { if (!dlgEl.hidden) { dlgEl.hidden = true; dlgEl.innerHTML = ""; document.body.style.overflow = ""; } return; }
  const first = dlgEl.hidden;
  const ta = dlgEl.querySelector("#tmsg"), draft = ta ? ta.value : "", focused = ta && document.activeElement === ta;
  const panel = dlgEl.querySelector(".panel"), sc = panel ? panel.scrollTop : 0;
  dlgEl.innerHTML = S.chat ? vChatDlg() : vDetail();
  dlgEl.hidden = false; document.body.style.overflow = "hidden";
  const p2 = dlgEl.querySelector(".panel"); if (p2 && !S.chat) p2.scrollTop = sc;
  const box = dlgEl.querySelector("#chatbox"); if (box) box.scrollTop = box.scrollHeight;
  const ta2 = dlgEl.querySelector("#tmsg"); if (ta2) { ta2.value = draft; if (focused || (first && S.chat)) ta2.focus(); }
  if (first && !S.chat) dlgEl.querySelector("[data-close]")?.focus();
}

/* ================= ota-ona ================= */
async function startParent(user) {
  S.role = "loading"; render();
  try {
    const q = await getDocs(query(collection(db, "students"), where("parentUid", "==", user.uid), limit(1)));
    if (q.empty) { S.role = "revoked"; render(); return; }
    const sid = q.docs[0].id;
    S.role = "parent"; S.lessons = {}; S.pmsgs = []; S.thread = null;
    subs.push(onSnapshot(doc(db, "students", sid), d => {
      if (!d.exists() || d.data().parentUid !== user.uid) { clearSubs(); S.role = "revoked"; render(); return; }
      S.me = { id: d.id, ...d.data() };
      S.groupName = S.me.groupName || "";
      render();
    }, e => { console.error(e); clearSubs(); S.role = "revoked"; render(); }));
    subs.push(onSnapshot(collection(db, "students", sid, "lessons"), q2 => { const m = {}; q2.docs.forEach(x => m[x.id] = x.data()); S.lessons = m; render(); }, onErr));
    subs.push(onSnapshot(doc(db, "threads", sid), d => { S.thread = d.exists() ? d.data() : null; markParentRead(); render(); }, onErr));
    subs.push(onSnapshot(query(collection(db, "threads", sid, "messages"), orderBy("at", "desc"), limit(200)), q3 => {
      S.pmsgs = q3.docs.map(x => ({ id: x.id, ...x.data({ serverTimestamps: "estimate" }) })).reverse(); render();
    }, onErr));
    subs.push(onSnapshot(doc(db, "settings", "rules"), d => { S.rules = { ...DEF, ...(d.exists() ? d.data() : {}) }; render(); }, onErr));
  } catch (e) { console.error(e); S.role = "revoked"; render(); }
}
function markParentRead() {
  if (S.role === "parent" && S.ptab === "xabar" && S.thread && S.thread.unreadParent && S.me && document.visibilityState === "visible")
    updateDoc(doc(db, "threads", S.me.id), { unreadParent: false }).catch(() => { });
}
document.addEventListener("visibilitychange", markParentRead);

function vParent() {
  if (!S.me) return loadingCard();
  const unread = S.thread && S.thread.unreadParent;
  const tabs = [["kabinet", "Kabinet"], ["xabar", "O'qituvchiga yozish"], ["sozlama", "Sozlamalar"]];
  let body = "";
  if (S.ptab === "xabar") {
    body = `<section class="sheet"><h2>O'qituvchi bilan yozishma</h2>
      ${chatBody(S.pmsgs, "parent").replace('class="chat"', 'class="chat page"')}
      <form class="compose" id="psend"><textarea id="pmsg" maxlength="2000" placeholder="Masalan: Bugun farzandim kasal, darsga kela olmaydi." aria-label="Xabar"></textarea><button class="btn primary">Yuborish</button></form>
      <p class="hint">Dars qoldirilishi kerak bo'lsa, darsdan <b>oldin</b> yozing — shunda sababli hisoblanadi.</p></section>`;
  } else if (S.ptab === "sozlama") {
    body = pwSection().replace("<div><button class=\"btn danger\" data-logout>Chiqish</button></div>", `<p class="hint">Kirish kodi: <b style="font-family:var(--f-mono)">${esc(S.me.code || "")}</b>. Parolni unutsangiz, o'qituvchidan yangisini so'rang.</p><div><button class="btn danger" data-logout>Chiqish</button></div>`);
  } else {
    const recs = Object.values(S.lessons).filter(r => String(r.date || "").startsWith(S.pmonth));
    body = `<section class="sheet">${cardBody(S.me.name, S.groupName, recs, S.pmonth, "")}</section>
      <section class="sheet"><details><summary style="cursor:pointer;font-weight:600">Davomat qoidalari</summary><div style="display:grid;gap:12px;margin-top:12px">${rulesList(S.rules)}</div></details></section>`;
  }
  return `<header class="top"><h1><small>${esc(S.groupName || "Ota-ona kabineti")}</small>${esc(S.me.name)}</h1><button class="btn small" data-logout>Chiqish</button></header>
    <nav class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-ptab="${k}" aria-selected="${S.ptab === k}">${l}${k === "xabar" && unread ? `<span class="badge">1</span>` : ""}</button>`).join("")}</nav>
    <main style="display:grid;gap:14px">${body}</main>`;
}
async function changePw(form) {
  const err = form.querySelector(".err"), btn = form.querySelector("button");
  const o = form.querySelector("#pw-old").value, n1 = form.querySelector("#pw-new").value, n2 = form.querySelector("#pw-new2").value;
  err.textContent = "";
  if (n1.length < 6) { err.textContent = "Yangi parol kamida 6 belgidan iborat bo'lsin."; return; }
  if (n1 !== n2) { err.textContent = "Yangi parollar bir xil emas."; return; }
  btn.disabled = true;
  try {
    const u = auth.currentUser;
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, o));
    await updatePassword(u, n1);
    form.reset(); toast("Parol o'zgartirildi ✓");
  } catch (e) {
    const c = e && e.code || "";
    err.textContent = c.includes("wrong-password") || c.includes("invalid-credential") ? "Hozirgi parol noto'g'ri." : c.includes("weak") ? "Parol juda oddiy, boshqasini tanlang." : "Parol o'zgarmadi. Qayta urinib ko'ring.";
  }
  btn.disabled = false;
}

/* ================= chizish ================= */
let rq = false;
function render() { if (rq) return; rq = true; requestAnimationFrame(() => { rq = false; draw(); }); } // ko'p yangilanish bitta chizishga yig'iladi
function draw() {
  let html;
  if (S.role === "setup") html = vSetup();
  else if (S.role === "loading") html = `<div class="empty" style="margin-top:20vh"><div class="spin" aria-label="Yuklanmoqda"></div></div>`;
  else if (S.role === "login") html = vLogin();
  else if (S.role === "revoked") html = `<section class="sheet empty login"><h2>Kirish yopilgan</h2><p>Bu kod uchun kirish bekor qilingan yoki parol yangilangan. Yangi kod va parol so'rang.</p><button class="btn primary" data-logout>Qaytadan kirish</button></section>`;
  else if (S.role === "teacher") html = vTeacher();
  else html = vParent();
  // yozilayotgan matnni saqlab qolish
  const ae = document.activeElement, aid = ae && ae.id && appEl.contains(ae) ? ae.id : null;
  const typing = ae && (ae.tagName === "TEXTAREA" || (ae.tagName === "INPUT" && /^(text|password|email|tel|number)$/.test(ae.type)));
  const keep = {}; appEl.querySelectorAll("textarea, input[type=text], input[type=password], input[type=email], input[type=tel]").forEach(el => { if (el.id && el.value) keep[el.id] = el.value; });
  const sel = typing ? [ae.selectionStart, ae.selectionEnd] : null;
  const pchat = appEl.querySelector(".chat.page"), atBottom = !pchat || pchat.scrollHeight - pchat.scrollTop - pchat.clientHeight < 40;
  if (S.role === "login" && appEl.querySelector("#loginf") && appEl.dataset.mode === S.loginMode) return; // kirish formasi qayta chizilmaydi
  appEl.dataset.mode = S.role === "login" ? S.loginMode : "";
  appEl.innerHTML = html;
  Object.entries(keep).forEach(([id, v]) => { const el = document.getElementById(id); if (el && !el.value && id !== "task") el.value = v; else if (el && id === "task" && pend[S.gid + "_" + S.date]) el.value = v; });
  if (aid && !S.detail && !S.chat) { const el = document.getElementById(aid); if (el) { el.focus(); if (sel) { try { el.setSelectionRange(sel[0], sel[1]); } catch (_) { } } } }
  const pc = appEl.querySelector(".chat.page"); if (pc && atBottom) pc.scrollTop = pc.scrollHeight;
  if (S.role === "teacher") renderDlg(true); else if (!dlgEl.hidden) { dlgEl.hidden = true; dlgEl.innerHTML = ""; document.body.style.overflow = ""; }
}

/* ================= hodisalar ================= */
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && (S.detail || S.chat)) closeDlg();
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && (e.target.id === "tmsg" || e.target.id === "pmsg")) { e.preventDefault(); e.target.form.requestSubmit(); }
});
function copyCred() {
  const el = $("#credtxt"); if (!el) return;
  (navigator.clipboard ? navigator.clipboard.writeText(el.textContent) : Promise.reject()).then(() => toast("Nusxa olindi")).catch(() => {
    const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Matn belgilandi — nusxa oling");
  });
}
document.addEventListener("click", e => {
  if (e.target === dlgEl) { closeDlg(); return; }
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.mode) { S.loginMode = b.dataset.mode; ls.set("dv_mode", S.loginMode); appEl.dataset.mode = ""; render(); return; }
  if (b.hasAttribute("data-logout")) { if (Object.keys(pend).length) flush(); signOut(auth); return; }
  if (b.dataset.ptab) { S.ptab = b.dataset.ptab; render(); markParentRead(); return; }
  if (b.dataset.dm) {
    if (S.role === "parent") { S.pmonth = shiftMonth(S.pmonth, Number(b.dataset.dm)); render(); }
    else if (S.detail) { S.detail.month = shiftMonth(S.detail.month, Number(b.dataset.dm)); ensureMonth(S.detail.month); renderDlg(); }
    return;
  }
  if (b.hasAttribute("data-copy")) { copyCred(); return; }
  if (S.role !== "teacher") return;
  if (b.dataset.tab) { S.tab = b.dataset.tab; S.confirmDel = null; ls.set("dv_tab", S.tab); render(); return; }
  if (b.dataset.go) { S.tab = b.dataset.go; ls.set("dv_tab", S.tab); render(); return; }
  if (b.dataset.gid) { S.gid = b.dataset.gid; ls.set("dv_gid", S.gid); render(); return; }
  if (b.dataset.shift) { const d = new Date(S.date + "T12:00:00"); d.setDate(d.getDate() + Number(b.dataset.shift)); S.date = iso(d); ensureMonth(S.date.slice(0, 7)); render(); return; }
  if (b.dataset.open) { S.detail = { sid: b.dataset.open, month: S.tab === "jurnal" ? S.month : S.date.slice(0, 7), back: b }; S.chat = null; renderDlg(); return; }
  if (b.dataset.chat) { const back = S.detail ? S.detail.back : b; openChat(b.dataset.chat); S.chat.back = back; return; }
  if (b.hasAttribute("data-close")) { closeDlg(); return; }
  if (b.dataset.m) { setMark(b.dataset.sid, b.dataset.m); return; }
  if (b.dataset.hw) { setHw(b.dataset.sid, b.dataset.hw); return; }
  if (b.dataset.par) { setPar(b.dataset.sid, Number(b.dataset.par)); return; }
  if (b.dataset.act === "all") { markAll(); return; }
  if (b.dataset.mk) { const st = S.students.find(x => x.id === b.dataset.mk); if (st) makeLogin(st); return; }
  if (b.hasAttribute("data-credok")) { S.cred = null; render(); return; }
  if (b.hasAttribute("data-tcredok")) { S.tcred = null; render(); return; }
  if (b.dataset.treset && S.isAdmin) { const t = S.teachers[b.dataset.treset]; if (t) resetTeacher(t); return; }
  if (b.dataset.tblock && S.isAdmin) {
    const t = S.teachers[b.dataset.tblock]; if (!t) return;
    updateDoc(doc(db, "teachers", t.id), { active: !t.active }).then(() => toast(t.active ? t.name + " bloklandi" : t.name + " faollashtirildi")).catch(onErr);
    return;
  }
  if (b.dataset.rm) {
    const st = S.students.find(x => x.id === b.dataset.rm); if (!st) return;
    const bt = writeBatch(db); archiveBatch(bt, st);
    bt.commit().then(() => toast(st.name + " guruhdan chiqarildi")).catch(err => { console.error(err); toast("O'zgarmadi. Qayta urinib ko'ring."); });
    return;
  }
  if (b.dataset.askdel) { S.confirmDel = b.dataset.askdel; render(); return; }
  if (b.hasAttribute("data-cancel")) { S.confirmDel = null; render(); return; }
  if (b.dataset.delg) {
    const id = b.dataset.delg; S.confirmDel = null;
    const bt = writeBatch(db); bt.delete(doc(db, "groups", id));
    S.students.filter(s => s.groupId === id && s.active !== false).forEach(s => archiveBatch(bt, s));
    bt.commit().then(() => toast("Guruh o'chirildi")).catch(err => { console.error(err); toast("O'chirilmadi. Qayta urinib ko'ring."); });
    return;
  }
});
document.addEventListener("input", e => {
  if (e.target.id === "task" && S.role === "teacher") { const v = e.target.value.slice(0, 140); editDoc(d => { d.task = v; }, "all", true); }
});
document.addEventListener("change", e => {
  const t = e.target; if (S.role !== "teacher") return;
  if (t.id === "date" && t.value) { S.date = t.value; ensureMonth(S.date.slice(0, 7)); render(); }
  if (t.id === "month" && t.value) { S.month = t.value; ensureMonth(S.month); render(); }
  if ((t.dataset.rule || t.id === "r-auto") && S.isAdmin) {
    const next = { ...S.rules };
    if (t.id === "r-auto") next.autoNotify = t.checked;
    else next[t.dataset.rule] = Math.max(0, Math.min(99, parseInt(t.value, 10) || 0));
    S.rules = next; render();
    setDoc(doc(db, "settings", "rules"), next).then(() => toast("Qoida yangilandi")).catch(err => { console.error(err); toast("Saqlanmadi."); });
  }
});
document.addEventListener("submit", async e => {
  e.preventDefault(); const f = e.target;
  if (f.id === "loginf") { doLogin(f); return; }
  if (f.id === "pwf") { changePw(f); return; }
  if (f.id === "psend") {
    const ta = f.querySelector("#pmsg"), txt = ta.value; if (!txt.trim() || !S.me) return;
    ta.value = ""; if (!(await sendMsg(S.me.id, txt, "parent"))) ta.value = txt;
    return;
  }
  if (S.role !== "teacher") return;
  if (f.id === "tsend") {
    const ta = f.querySelector("#tmsg"), txt = ta.value; if (!txt.trim() || !S.chat) return;
    ta.value = ""; if (!(await sendMsg(S.chat.sid, txt, "teacher"))) ta.value = txt;
    return;
  }
  if (f.id === "tform" && S.isAdmin) {
    const n = $("#tname").value.trim(); if (!n || S.credBusy) return; $("#tname").value = "";
    createTeacher(n.slice(0, 60)); return;
  }
  if (f.id === "gform") {
    const n = $("#gname").value.trim(); if (!n) return;
    const ref = doc(collection(db, "groups")); S.gid = ref.id; ls.set("dv_gid", S.gid); $("#gname").value = "";
    setDoc(ref, { name: n, created: Date.now(), owner: S.uid }).then(() => toast("Guruh qo'shildi")).catch(err => { console.error(err); toast("Guruh qo'shilmadi."); });
    return;
  }
  if (f.classList.contains("sform")) {
    const ta = f.querySelector("textarea");
    const names = ta.value.split("\n").map(s => s.trim()).filter(Boolean); if (!names.length) return; ta.value = "";
    const bt = writeBatch(db);
    const g = S.groups.find(x => x.id === f.dataset.g) || {};
    names.slice(0, 200).forEach(n => bt.set(doc(collection(db, "students")), { name: n.slice(0, 80), groupId: f.dataset.g, groupName: g.name || "", owner: g.owner || S.uid, active: true, code: null, parentUid: null, created: Date.now() }));
    bt.commit().then(() => toast(names.length + " ta o'quvchi qo'shildi")).catch(err => { console.error(err); ta.value = names.join("\n"); toast("Qo'shilmadi. Qayta urinib ko'ring."); });
  }
});
