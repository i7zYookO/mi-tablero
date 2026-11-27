// Manda los recordatorios de Mi Tablero. Lo corre GitHub Actions cada 15 minutos.
// Lee la llave de servicio de Firebase desde el secreto FIREBASE_SA (nunca va en el código).
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const sa = JSON.parse(process.env.FIREBASE_SA || "{}");
if (!sa.project_id) { console.log("Falta el secreto FIREBASE_SA"); process.exit(0); }
initializeApp({ credential: cert(sa) });
const db = getFirestore(), fcm = getMessaging();
const LATE_MIN = 75;           // si GitHub se atrasa, aún avisa hasta 75 min después
const DOWN = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function localNow(tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { key: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute), wd };
}
const toMin = s => /^\d{1,2}:\d{2}$/.test(s || "") ? Number(s.split(":")[0]) * 60 + Number(s.split(":")[1]) : null;
const due = (hhmm, now) => { const m = toMin(hhmm); return m != null && now.min >= m && now.min - m <= LATE_MIN; };
// lunes=0 … domingo=6, igual que la app
const scheduled = (h, now) => { const w = Array.isArray(h.dow) && h.dow.length ? h.dow : null; return !w || w.includes((now.wd + 6) % 7); };
function weekDone(h, todayKey, wd) {
  const t = new Date(todayKey + "T12:00:00Z"); let n = 0; const back = (wd + 6) % 7;
  for (let i = 0; i <= back; i++) { const d = new Date(t - i * 864e5).toISOString().slice(0, 10); if (h.days && h.days[d]) n++; }
  return n;
}
function needsToday(h, now) {
  if (h.archived || !scheduled(h, now) || (h.days && h.days[now.key])) return false;
  if (Array.isArray(h.dow) && h.dow.length) return true;
  const target = Math.min(7, Math.max(1, Number(h.target) || 7));
  return weekDone(h, now.key, now.wd) < target;
}

async function runUser(u) {
  const prefs = u.data(), tokens = Object.keys(prefs.tokens || {});
  if (!tokens.length) return;
  const tz = prefs.tz || "America/Hermosillo", now = localNow(tz);
  const ref = u.ref, sentRef = ref.collection("meta").doc("sent");
  const sent = (await sentRef.get()).data() || {};
  const [hs, its] = await Promise.all([ref.collection("habits").get(), ref.collection("items").get()]);
  const habits = hs.docs.map(d => ({ id: d.id, ...d.data() }));
  const pendingH = habits.filter(h => needsToday(h, now));
  const tasks = its.docs.map(d => d.data()).filter(i => i.kind === "task" && !i.done && i.due && i.due <= now.key);
  const msgs = [];
  const add = (id, title, body, url = "./") => { const k = now.key + "|" + id; if (!sent[k]) msgs.push({ k, title, body, tag: id, url }); };

  for (const h of pendingH) if (h.remind && due(h.remind, now)) add("h:" + h.id, "⏰ " + h.name, "Toca hoy. Márcalo cuando lo hagas.");
  if (due(prefs.morning || "06:00", now)) {
    const late = tasks.filter(t => t.due < now.key).length, list = pendingH.map(h => h.name).slice(0, 4).join(", ");
    const parts = [];
    if (pendingH.length) parts.push(`${pendingH.length} hábito${pendingH.length > 1 ? "s" : ""}: ${list}`);
    if (tasks.length) parts.push(`${tasks.length} tarea${tasks.length > 1 ? "s" : ""} para hoy` + (late ? ` (${late} vencida${late > 1 ? "s" : ""})` : ""));
    add("morning", "Buenos días · " + DOWN[now.wd], parts.length ? parts.join(" · ") : "Día libre de pendientes. Elige tu siguiente paso.");
  }
  if (due(prefs.evening || "20:45", now) && pendingH.length)
    add("evening", "Te faltan " + pendingH.length + " hábito" + (pendingH.length > 1 ? "s" : ""), pendingH.map(h => h.name).join(", "));
  if (!msgs.length) return;

  const dead = new Set(), upd = {};
  for (const m of msgs) {
    const r = await fcm.sendEachForMulticast({ tokens, data: { title: m.title, body: m.body, tag: m.tag, url: m.url },
      webpush: { headers: { Urgency: "high", TTL: "7200" } } });
    r.responses.forEach((x, i) => { const c = x.error && x.error.code; if (c === "messaging/registration-token-not-registered" || c === "messaging/invalid-registration-token" || c === "messaging/invalid-argument") dead.add(tokens[i]); });
    if (r.successCount) upd[m.k] = Date.now();
    console.log(u.id.slice(0, 6), m.tag, "ok", r.successCount, "fail", r.failureCount);
  }
  // limpiar registro viejo (más de 3 días)
  const cutoff = Date.now() - 3 * 864e5;
  for (const [k, v] of Object.entries(sent)) if (v < cutoff) upd[k] = FieldValue.delete();
  if (Object.keys(upd).length) await sentRef.set(upd, { merge: true });
  if (dead.size) { const d = {}; for (const t of dead) d["tokens." + t] = FieldValue.delete(); await ref.update(d).catch(() => {}); }
}

const users = await db.collection("users").get();
for (const u of users.docs) { try { await runUser(u); } catch (e) { console.error("usuario", u.id.slice(0, 6), e.message); } }
console.log("listo", new Date().toISOString(), users.size, "usuarios");
