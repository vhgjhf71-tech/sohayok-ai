const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const OpenAI = require("openai");
const path = require("path");
const fs = require("fs");

const app = express();
const dbFile = process.env.DB_FILE || path.join(__dirname, "data", "sohayok.sqlite");
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const db = new Database(dbFile);
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "";
if (process.env.NODE_ENV === "production" && JWT_SECRET.length < 32) {
  throw new Error("Production requires a JWT_SECRET of at least 32 characters");
}
if (!JWT_SECRET) console.warn("WARNING: Set a strong JWT_SECRET before public deployment.");
const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v23.0"}`;

db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings(user_id INTEGER PRIMARY KEY, business_name TEXT DEFAULT '', fb_page_id TEXT DEFAULT '', fb_page_token TEXT DEFAULT '', wa_phone_number_id TEXT DEFAULT '', wa_access_token TEXT DEFAULT '', wa_display_number TEXT DEFAULT '', fb_wa_enabled INTEGER DEFAULT 0, ai_enabled INTEGER DEFAULT 1, instructions TEXT DEFAULT '', FOREIGN KEY(user_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS conversations(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, channel TEXT NOT NULL, customer_id TEXT NOT NULL, customer_name TEXT DEFAULT '', last_message TEXT DEFAULT '', updated_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id,channel,customer_id));
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL, direction TEXT NOT NULL, body TEXT NOT NULL, external_id TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(conversation_id) REFERENCES conversations(id));
CREATE TABLE IF NOT EXISTS processed_events(channel TEXT NOT NULL, external_id TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(channel, external_id));
`);
function seed(email, password, role) {
  if (!email || !password) return;
  const existing = db.prepare("SELECT id FROM users WHERE email=?").get(email.toLowerCase());
  if (!existing) {
    const info = db.prepare("INSERT INTO users(email,password_hash,role) VALUES(?,?,?)")
      .run(email.toLowerCase(), bcrypt.hashSync(password, 12), role);
    db.prepare("INSERT INTO settings(user_id) VALUES(?)").run(info.lastInsertRowid);
  }
}
seed(process.env.OWNER_EMAIL, process.env.OWNER_PASSWORD, "owner");
seed(process.env.WIFE_EMAIL, process.env.WIFE_PASSWORD, "wife");

function verifyMeta(req) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return false;
  const sig = req.get("x-hub-signature-256") || "";
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(req.rawBody || Buffer.from("")).digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); } catch { return false; }
}
app.use(express.json({ limit: "1mb", verify: (req, res, buf) => { req.rawBody = Buffer.from(buf); } }));
// Serve only the public dashboard. Never expose server.js, package files, database or secrets.
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPT_KEYS = 10000;
function auth(req, res, next) {
  const token = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "লগইন করুন" }); }
}
function getSettings(userId) {
  return db.prepare("SELECT * FROM settings WHERE user_id=?").get(userId);
}
function saveMessage(userId, channel, customerId, text, direction, customerName = "", externalId = "") {
  let c = db.prepare("SELECT * FROM conversations WHERE user_id=? AND channel=? AND customer_id=?").get(userId, channel, customerId);
  if (!c) {
    const info = db.prepare("INSERT INTO conversations(user_id,channel,customer_id,customer_name,last_message) VALUES(?,?,?,?,?)")
      .run(userId, channel, customerId, customerName, text);
    c = db.prepare("SELECT * FROM conversations WHERE id=?").get(info.lastInsertRowid);
  }
  db.prepare("INSERT INTO messages(conversation_id,direction,body,external_id) VALUES(?,?,?,?)").run(c.id, direction, text, externalId);
  db.prepare("UPDATE conversations SET last_message=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(text, c.id);
  return c.id;
}
async function sendFacebook(s, recipientId, text) {
  if (!s.fb_page_token) throw new Error("Facebook Page Access Token সেট করা নেই");
  const r = await fetch(`${GRAPH}/${s.fb_page_id || "me"}/messages?access_token=${encodeURIComponent(s.fb_page_token)}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, messaging_type: "RESPONSE", message: { text } })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || "Facebook message পাঠানো যায়নি");
  return data;
}
async function sendWhatsApp(s, to, text) {
  if (!s.wa_phone_number_id || !s.wa_access_token) throw new Error("WhatsApp Cloud API credentials সেট করা নেই");
  const r = await fetch(`${GRAPH}/${s.wa_phone_number_id}/messages`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${s.wa_access_token}` },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body: text } })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || "WhatsApp message পাঠানো যায়নি");
  return data;
}
async function makeAIReply(s, incoming, channel) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY সেট করা নেই");
  const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = `আপনি ${s.business_name || "এই ব্যবসা"}-এর ভদ্র, সহায়ক কাস্টমার সার্ভিস সহকারী। বাংলায় স্বাভাবিকভাবে উত্তর দিন। অজানা দাম, ঠিকানা, সময় বা সেবা বানিয়ে বলবেন না; প্রয়োজন হলে মানুষের সঙ্গে যোগাযোগ করতে বলুন। ব্যবসার নির্দেশনা: ${s.instructions || "গ্রাহকের প্রশ্ন বুঝে সংক্ষিপ্ত উত্তর দিন।"}\nচ্যানেল: ${channel}\nগ্রাহকের বার্তা: ${incoming}`;
  const result = await ai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    messages: [{ role: "system", content: "আপনি নির্ভুল ও সহায়ক কাস্টমার সাপোর্ট সহকারী।" }, { role: "user", content: prompt }],
    temperature: 0.4
  });
  return result.choices?.[0]?.message?.content?.trim() || "আপনার বার্তাটি পেয়েছি। একটু পরে জানাচ্ছি।";
}
async function handleIncoming(userId, channel, customerId, text, name = "", externalId = "") {
  if (externalId) {
    const inserted = db.prepare("INSERT OR IGNORE INTO processed_events(channel,external_id) VALUES(?,?)").run(channel, externalId);
    if (!inserted.changes) return;
  }
  const cid = saveMessage(userId, channel, customerId, text, "in", name, externalId);
  const s = getSettings(userId);
  if (!s || !s.ai_enabled) return;
  try {
    const reply = await makeAIReply(s, text, channel);
    if (channel === "messenger") await sendFacebook(s, customerId, reply);
    if (channel === "whatsapp") await sendWhatsApp(s, customerId, reply);
    db.prepare("INSERT INTO messages(conversation_id,direction,body) VALUES(?,?,?)").run(cid, "out", reply);
    db.prepare("UPDATE conversations SET last_message=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(reply, cid);
  } catch (e) {
    console.error("Auto reply error:", e.message);
  }
}

app.post("/api/login", (req, res) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  const password = String(req.body.password || "");
  const attemptKey = `${req.ip}:${email}`;
  const now = Date.now(), attempts = loginAttempts.get(attemptKey) || { count: 0, until: 0 };
  if (attempts.until > now) return res.status(429).json({ error: "অনেকবার চেষ্টা হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।" });
  const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    attempts.count += 1;
    if (attempts.count >= 5) { attempts.until = now + 15 * 60 * 1000; attempts.count = 0; }
    if (loginAttempts.size >= MAX_LOGIN_ATTEMPT_KEYS) loginAttempts.clear();
    loginAttempts.set(attemptKey, attempts);
    return res.status(401).json({ error: "ইমেইল বা পাসওয়ার্ড ভুল" });
  }
  loginAttempts.delete(attemptKey);
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "12h" });
  res.json({ token, email: user.email, role: user.role });
});
app.get("/api/me", auth, (req, res) => res.json({ email: req.user.email, role: req.user.role }));
app.get("/api/settings", auth, (req, res) => {
  const s = getSettings(req.user.id);
  const { fb_page_token, wa_access_token, ...safe } = s;
  res.json({ ...safe, fb_page_token_set: !!fb_page_token, wa_access_token_set: !!wa_access_token });
});
app.put("/api/settings", auth, (req, res) => {
  const b = req.body || {};
  db.prepare(`UPDATE settings SET business_name=?,fb_page_id=?,fb_page_token=COALESCE(?,fb_page_token),
    wa_phone_number_id=?,wa_access_token=COALESCE(?,wa_access_token),wa_display_number=?,
    fb_wa_enabled=?,ai_enabled=?,instructions=? WHERE user_id=?`).run(
    String(b.business_name || ""), String(b.fb_page_id || ""), b.fb_page_token || null,
    String(b.wa_phone_number_id || ""), b.wa_access_token || null, String(b.wa_display_number || ""),
    b.fb_wa_enabled ? 1 : 0, b.ai_enabled === false ? 0 : 1, String(b.instructions || ""), req.user.id
  );
  res.json({ ok: true });
});
app.get("/api/conversations", auth, (req, res) => {
  const rows = db.prepare("SELECT * FROM conversations WHERE user_id=? ORDER BY updated_at DESC LIMIT 100").all(req.user.id);
  res.json(rows);
});
app.get("/api/conversations/:id/messages", auth, (req, res) => {
  const c = db.prepare("SELECT id FROM conversations WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!c) return res.status(404).json({ error: "কথোপকথন পাওয়া যায়নি" });
  res.json(db.prepare("SELECT * FROM messages WHERE conversation_id=? ORDER BY id").all(c.id));
});
app.post("/api/conversations/:id/reply", auth, async (req, res) => {
  const c = db.prepare("SELECT * FROM conversations WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!c) return res.status(404).json({ error: "কথোপকথন পাওয়া যায়নি" });
  const body = String(req.body.text || "").trim();
  if (!body) return res.status(400).json({ error: "উত্তর লিখুন" });
  try {
    const s = getSettings(req.user.id);
    if (c.channel === "messenger") await sendFacebook(s, c.customer_id, body);
    else if (c.channel === "whatsapp") await sendWhatsApp(s, c.customer_id, body);
    saveMessage(req.user.id, c.channel, c.customer_id, body, "out");
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Meta webhook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"], token = req.query["hub.verify_token"], challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) return res.status(200).send(challenge);
  res.sendStatus(403);
});
app.post("/webhook", (req, res) => {
  if (!verifyMeta(req)) return res.sendStatus(401);
  // Acknowledge quickly; process events asynchronously.
  res.sendStatus(200);
  const body = req.body || {};
  if (body.object === "page") {
    for (const entry of body.entry || []) for (const ev of entry.messaging || []) {
      if (!ev.message || ev.message.is_echo || !ev.sender?.id) continue;
      const pageId = String(entry.id);
      const owner = db.prepare("SELECT user_id FROM settings WHERE fb_page_id=?").get(pageId);
      if (owner) handleIncoming(owner.user_id, "messenger", ev.sender.id, ev.message.text || "[সংযুক্তি]", "", ev.message.mid).catch(console.error);
    }
  } else if (body.object === "whatsapp_business_account") {
    for (const entry of body.entry || []) for (const change of entry.changes || []) {
      const value = change.value || {};
      const phoneId = value.metadata?.phone_number_id;
      const owner = phoneId && db.prepare("SELECT user_id FROM settings WHERE wa_phone_number_id=?").get(phoneId);
      if (!owner) continue;
      for (const m of value.messages || []) if (m.type === "text") {
        const name = value.contacts?.[0]?.profile?.name || "";
        handleIncoming(owner.user_id, "whatsapp", m.from, m.text.body, name, m.id).catch(console.error);
      }
    }
  }
});
app.get("/health", (req, res) => res.json({
  ok: true, service: "Sohayok AI Assistant",
  configured: { openai: !!process.env.OPENAI_API_KEY, metaWebhook: !!(process.env.META_APP_SECRET && process.env.META_VERIFY_TOKEN) }
}));
app.listen(PORT, () => console.log(`Sohayok server listening on ${PORT}`));
