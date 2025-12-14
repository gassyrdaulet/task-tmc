import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = 4000;

// -------------------- Методика хранения записей --------------------
// Представим что миллион записей уже сущуствуют, не храним их всех в памяти 
// Мы только храним:
// - добавленные записи
// - порядок выбранных записей
// - сет выбранных записей
// Левая сторона будет считаться как миллион элементов минус выбранные записи
const MAX_INITIAL = 1_000_000;
const addedIds = new Set();
const selectedOrder = [];
const selectedSet = new Set();
const pendingAdds = new Map();
const addQueue = new Set();
const actionQueue = [];

// -------------------- Очереди --------------------
// 1) Очередь добавления новых записей. Дедупликация через Set
app.post("/api/enqueue-add", async (req, res) => {
  const { id } = req.body;
  if (id === undefined || id === null) {
    return res.status(400).json({ error: "id required" });
  }

  const sid = String(id);

  // уже существует
  if (addedIds.has(sid) || selectedSet.has(sid)) {
    return res.status(409).json({ error: "ID already exists" });
  }

  addQueue.add(sid);

  // ждём фактического применения
  await new Promise(resolve => {
    pendingAdds.set(sid, resolve);
  });

  res.json({ status: "added", id: sid });
});

// Батчи каждые 10 сек.
setInterval(() => {
  if (addQueue.size === 0) return;
  const toProcess = Array.from(addQueue);
  addQueue.clear();
  toProcess.forEach(id => {
    const n = Number(id);
    if (!Number.isNaN(n) && n >= 1 && n <= MAX_INITIAL) return;
    addedIds.add(id);
    // подтверждаем ожидающему HTTP-запросу
    const resolve = pendingAdds.get(id);
    if (resolve) {
      resolve();
      pendingAdds.delete(id);
    }
  });
  console.log(`[ADD-BATCH] applied ${toProcess.length} ids`);
}, 10_000);

// 2) Очередь получения и изменения записей.
// Виды операций:
// - select
// - deselect
// - reorder
app.post("/api/toggle-select", (req, res) => {
  const { id, action } = req.body;
  if (!id || !action) return res.status(400).json({ error: "id & action required" });
  switch (action){
    case 'select': 
        actionQueue.push({ type: "select", id: String(id) });
        break;
    case 'deselect': 
        actionQueue.push({ type: "deselect", id: String(id) });
        break;
  }
  res.status(202).json({ status: "queued" });
});

app.post("/api/enqueue-reorder", (req, res) => {
  const { dragId, targetIndex } = req.body;
  if (!dragId) return res.status(400).json({ error: "dragId required" });
  actionQueue.push({ type: "reorder", dragId: String(dragId), targetIndex });
  res.status(202).json({ status: "queued" });
});

// Работает каждую секунду
setInterval(() => {
  if (actionQueue.length === 0) return;
  const orderChanges = [];
  const lastAction = {};
  while (actionQueue.length) {
    const a = actionQueue.shift();
    if (a.type === "reorder") orderChanges.push(a);
    else lastAction[a.id] = a.type;
  }
  for (const [id, type] of Object.entries(lastAction)) {
    if (type === "select") {
      if (!selectedSet.has(id)) {
        selectedSet.add(id);
        selectedOrder.unshift(id);
      }
    }
    if (type === "deselect") {
      if (selectedSet.has(id)) {
        selectedSet.delete(id);
        const idx = selectedOrder.indexOf(id);
        if (idx !== -1) selectedOrder.splice(idx, 1);
      }
    }
  }
  for (const { dragId, targetIndex } of orderChanges) {
    const idx = selectedOrder.indexOf(dragId);
    if (idx === -1) continue;
    selectedOrder.splice(idx, 1);
    const newIndex = Math.max(0, Math.min(targetIndex, selectedOrder.length));
    selectedOrder.splice(newIndex, 0, dragId);
  }
  console.log(`[ACTION-BATCH] applied. selected count=${selectedOrder.length}`);
}, 1000);

// -------------------- Итератор левого окна --------------------
// Поддерживает фильтрацию по айди и инфинит скролл
// Возвращает элементы до миллиона исключая выбранные элементы

function leftIterator({ filter }) {
  const f = filter ? String(filter) : null;
  const addedArray = Array.from(addedIds).sort((a,b)=>{
    const na = Number(a), nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na-nb;
    return String(a).localeCompare(String(b));
  });
  function* gen() {
    for (const id of addedArray) {
      const s = String(id);
      if (f && !s.includes(f)) continue;
      yield s;
    }
    for (let i = 1; i <= MAX_INITIAL; i++) {
      const s = String(i);
      if (f && !s.includes(f)) continue;
      yield s;
    }
  }
  return gen();
}

app.get("/api/left", (req, res) => {
  const filter = req.query.filter || null;
  const offset = Number(req.query.offset || "0");
  const limit = Math.min(Number(req.query.limit || "20"), 200);
  const it = leftIterator({ filter });
  const out = [];
  let index = 0;
  for (const id of it) {
    if (selectedSet.has(id)) continue;
    if (index >= offset && out.length < limit) out.push({ id });
    index++;
    if (out.length >= limit) break;
  }
  res.json({
    items: out,
    offset,
    limit,
    total: MAX_INITIAL + addedIds.size - selectedOrder.length
  });
});

app.get("/api/right", (req, res) => {
  const filter = req.query.filter || null;
  const offset = Number(req.query.offset || "0");
  const limit = Math.min(Number(req.query.limit || "20"), 200);
  const f = filter ? String(filter) : null;
  const out = [];
  let passed = 0;
  for (let i = 0; i < selectedOrder.length && out.length < limit; i++) {
    const id = selectedOrder[i];
    if (f && !id.includes(f)) continue;
    if (passed < offset) { passed++; continue; }
    out.push({ id, orderIndex: i });
  }
  res.json({ items: out, offset, limit, total: selectedOrder.length });
});

app.listen(PORT, () => {
  console.log("Сервер запущен на порту", PORT);
});
