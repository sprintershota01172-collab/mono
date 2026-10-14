import { STORES, VERSION, initialData, validateData, upgradeRateRecord } from "./core.js";
let dbPromise;
export function openDB() {
  if (!dbPromise)
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open("kotori-budget-v1", 2);
      req.onupgradeneeded = event => {
        for (const name of STORES) {
          if(req.result.objectStoreNames.contains(name))continue;
          const s = req.result.createObjectStore(name, { keyPath: "id" });
          if (!["groups", "settings"].includes(name))
            s.createIndex("groupId", "groupId", { unique: false });
        }
        if(event.oldVersion>0 && event.oldVersion<2) {
          for(const name of ['groups','trips']) {
            const cursor=req.transaction.objectStore(name).openCursor();
            cursor.onsuccess=()=>{const c=cursor.result;if(c){c.update(upgradeRateRecord(c.value));c.continue();}};
          }
        }
      };
      req.onsuccess = () => {
        req.result.onversionchange = () => {
          req.result.close();
          dbPromise = null;
        };
        resolve(req.result);
      };
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
      req.onblocked = () => {
        dbPromise = null;
        reject(new Error("ほかのタブを閉じてから、もう一度開いてください。"));
      };
    });
  return dbPromise;
}
export async function loadData() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const result = { version: VERSION };
    const tx = db.transaction(STORES, "readonly");
    for (const s of STORES) {
      const req = tx.objectStore(s).getAll();
      req.onsuccess = () => {
        result[s] = req.result;
      };
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}
export async function initialize() {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, "readwrite");
    const req = tx.objectStore("groups").count();
    req.onsuccess = () => {
      if (req.result === 0) {
        const data = initialData();
        for (const s of STORES)
          for (const r of data[s]) tx.objectStore(s).put(r);
      }
    };
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  return loadData();
}
// A revision is checked inside the write transaction, so two tabs cannot silently overwrite each other.
export async function saveData(data, expectedRevision) {
  validateData(data);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, "readwrite");
    let conflict = false;
    const req = tx.objectStore("settings").get("app");
    req.onsuccess = () => {
      const revision = req.result?.revision || 0;
      if (revision !== expectedRevision) {
        conflict = true;
        tx.abort();
        return;
      }
      data.settings[0].revision = revision + 1;
      for (const s of STORES) {
        const store = tx.objectStore(s);
        store.clear();
        for (const r of data[s]) store.put(r);
      }
    };
    tx.oncomplete = () => resolve(data);
    tx.onabort = () =>
      reject(
        conflict
          ? new Error(
              "別のタブで更新されました。内容を読み直して、もう一度操作してください。",
            )
          : tx.error || new Error("保存できませんでした。"),
      );
  });
}
