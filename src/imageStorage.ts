// Separate Image Database & Compression Storage Engine
// Uses browser IndexedDB for high-capacity offline image persistence without bloating localStorage

export interface StoredImage {
  id: string;
  recordId: string;
  dataUrl: string; // JPEG compressed at 70%
  itemName: string; // ชื่อรายการ
  quantity: string; // จำนวน เช่น "3 ชิ้น" หรือ "21 รายการ"
  caption: string; // คำอธิบายรูปภาพ
  createdAt: number;
}

const DB_NAME = "ProcurementImageDB";
const DB_VERSION = 1;
const STORE_NAME = "procurement_images";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("เบราว์เซอร์ไม่รองรับ IndexedDB"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("recordId", "recordId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * บีบอัดภาพอัตโนมัติ (Auto Compress) ลดคุณภาพเหลือ 70% และแปลงเป็น .jpg
 */
export async function compressImageToJpeg(
  file: File | Blob,
  quality = 0.7,
  maxDimension = 1600
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Cannot create canvas context"));
          return;
        }

        // Fill white background before JPEG conversion (to handle transparent PNG properly)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG with 70% quality
        const jpegDataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(jpegDataUrl);
      };
      img.onerror = () => reject(new Error("Failed to load image for compression"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * บันทึกรูปภาพลง IndexedDB แยกจาก localStorage หลัก
 */
export async function saveImageToStore(
  recordId: string,
  dataUrl: string,
  itemName = "",
  quantity = "",
  caption = ""
): Promise<StoredImage> {
  const db = await openDB();
  const newImage: StoredImage = {
    id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    recordId,
    dataUrl,
    itemName,
    quantity,
    caption,
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(newImage);

    req.onsuccess = () => resolve(newImage);
    req.onerror = () => reject(req.error);
  });
}

/**
 * ดึงรูปภาพทั้งหมดของรายการจัดซื้อจัดจ้างตาม recordId
 */
export async function getImagesByRecordId(recordId: string): Promise<StoredImage[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("recordId");
      const req = index.getAll(recordId);

      req.onsuccess = () => {
        const results = req.result as StoredImage[];
        results.sort((a, b) => a.createdAt - b.createdAt);
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("IndexedDB error in getImagesByRecordId:", err);
    return [];
  }
}

/**
 * ลบรูปภาพตาม ID
 */
export async function deleteImageFromStore(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * อัปเดตข้อมูลกำกับรูปภาพ (ชื่อรายการ, จำนวน, คำอธิบาย)
 */
export async function updateImageMeta(
  id: string,
  updates: Partial<Pick<StoredImage, "itemName" | "quantity" | "caption">>
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const data = getReq.result as StoredImage;
      if (!data) {
        reject(new Error("ไม่พบรูปภาพ"));
        return;
      }
      const updated = { ...data, ...updates };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * ลบรูปภาพทั้งหมดที่ผูกกับ recordId เมื่อลบรายการจัดซื้อ
 */
export async function deleteAllImagesByRecordId(recordId: string): Promise<void> {
  try {
    const images = await getImagesByRecordId(recordId);
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    for (const img of images) {
      store.delete(img.id);
    }
  } catch (err) {
    console.error("Error deleting images for record:", err);
  }
}
