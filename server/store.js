const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const dataDir = path.join(process.cwd(), ".data");
const dataFile = path.join(dataDir, "store.json");
const emptyStore = () => ({ users: [], sessions: [], targets: [], scans: [], auditLogs: [] });

function ensureStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, JSON.stringify(emptyStore(), null, 2), { mode: 0o600 });
}

function readStore() {
  ensureStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    return { ...emptyStore(), ...parsed };
  } catch {
    return emptyStore();
  }
}

function writeStore(store) {
  ensureStore();
  const tempFile = `${dataFile}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(store, null, 2), { mode: 0o600 });
  fs.renameSync(tempFile, dataFile);
}

function updateStore(mutator) {
  const store = readStore();
  const result = mutator(store);
  writeStore(store);
  return result;
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, encoded) {
  const [salt, expected] = String(encoded || "").split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function createUser({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  return updateStore((store) => {
    if (store.users.some((user) => user.email === normalizedEmail)) throw new Error("An account with that email already exists.");
    const user = { id: id("usr"), name: name.trim(), email: normalizedEmail, passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
    store.users.push(user);
    return { id: user.id, name: user.name, email: user.email };
  });
}

function findUserByEmail(email) {
  const store = readStore();
  return store.users.find((user) => user.email === email.trim().toLowerCase()) || null;
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  updateStore((store) => {
    store.sessions = store.sessions.filter((session) => new Date(session.expiresAt) > new Date());
    store.sessions.push({ token, userId, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString() });
  });
  return token;
}

function getUserBySession(token) {
  if (!token) return null;
  const store = readStore();
  const session = store.sessions.find((item) => item.token === token && new Date(item.expiresAt) > new Date());
  if (!session) return null;
  const user = store.users.find((item) => item.id === session.userId);
  return user ? { id: user.id, name: user.name, email: user.email } : null;
}

function createTarget(target) {
  return updateStore((store) => {
    const record = { id: id("tgt"), ...target, createdAt: new Date().toISOString() };
    store.targets.push(record);
    return record;
  });
}

function getTarget(targetId) {
  return readStore().targets.find((target) => target.id === targetId) || null;
}

function createScan(scan) {
  return updateStore((store) => {
    const record = { id: id("scan"), ...scan, status: "queued", findings: [], startedAt: null, finishedAt: null, error: null, createdAt: new Date().toISOString() };
    store.scans.push(record);
    return record;
  });
}

function getScan(scanId) {
  return readStore().scans.find((scan) => scan.id === scanId) || null;
}

function updateScan(scanId, patch) {
  return updateStore((store) => {
    const scan = store.scans.find((item) => item.id === scanId);
    if (!scan) return null;
    Object.assign(scan, patch);
    return scan;
  });
}

function addAuditLog(log) {
  return updateStore((store) => {
    store.auditLogs.push({ id: id("audit"), ...log, createdAt: new Date().toISOString() });
  });
}

module.exports = { readStore, writeStore, createUser, findUserByEmail, verifyPassword, createSession, getUserBySession, createTarget, getTarget, createScan, getScan, updateScan, addAuditLog };
