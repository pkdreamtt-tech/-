import { ProcurementRecord } from "../types";

/**
 * Parse uploaded JSON backup file
 */
export async function parseJsonBackup(file: File): Promise<ProcurementRecord[]> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) {
    return parsed.map((item, index) => ({
      ...item,
      id: item.id || `REC-IMP-${Date.now()}-${index}`,
    }));
  } else if (parsed && Array.isArray(parsed.records)) {
    return parsed.records.map((item: any, index: number) => ({
      ...item,
      id: item.id || `REC-IMP-${Date.now()}-${index}`,
    }));
  } else {
    throw new Error("โครงสร้างไฟล์ JSON ไม่ถูกต้อง (ต้องเป็นรายการอาร์เรย์ของข้อมูลจัดซื้อจัดจ้าง)");
  }
}

/**
 * Parse uploaded CSV file
 */
export async function parseCsvImport(file: File): Promise<Partial<ProcurementRecord>[]> {
  const text = await file.text();
  // Strip BOM if present
  const cleanText = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const lines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("ไฟล์ CSV ว่างเปล่าหรือไม่มีข้อมูลแถวรายการ");
  }

  // Simple CSV row parser handling quotes
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);

  const parsedRecords: Partial<ProcurementRecord>[] = rows.map((row, idx) => {
    const rec: Record<string, any> = {
      id: `REC-IMP-${Date.now()}-${idx}`,
      createdAt: new Date().toISOString(),
    };

    headers.forEach((h, colIdx) => {
      const val = row[colIdx] || "";
      const headerName = h.trim();
      if (headerName === "ต้นเรื่อง" || headerName === "เลขที่ต้นเรื่อง") rec.trackingNo = val;
      else if (headerName === "ขอซื้อ" || headerName === "เลขที่ขอซื้อ") rec.procureNo = val;
      else if (headerName === "วันที่") rec.docDate = val;
      else if (headerName === "ที่TOR") rec.torNo = val;
      else if (headerName === "ที่ราคากลาง") rec.medianPriceNo = val;
      else if (headerName === "วิธีซื้อ" || headerName === "ประเภท") rec.procureType = val;
      else if (headerName === "แผนงาน") rec.planName = val;
      else if (headerName === "งาน") rec.workName = val;
      else if (headerName === "หมวด") rec.expenseName = val;
      else if (headerName === "รายจ่าย" || headerName === "ประเภทรายจ่าย") rec.expenseType = val;
      else if (headerName === "โครงการ") rec.projectName = val;
      else if (headerName === "งบเทศ") rec.budgetAmount = Number(val) || 0;
      else if (headerName === "โอนเพิ่ม") rec.transferInAmount = Number(val) || 0;
      else if (headerName === "ผูกพัน") rec.committedAmount = Number(val) || 0;
      else if (headerName === "เบิกจ่าย") rec.disbursedAmount = Number(val) || 0;
      else if (headerName === "ใช้ไป") rec.usedAmount = Number(val) || 0;
      else if (headerName === "เหลือ") rec.remainingAmount = Number(val) || 0;
      else if (headerName === "เหตุผล") rec.reason = val;
      else if (headerName === "จำนวน รายการ" || headerName === "จำนวนรายการ") rec.itemCount = Number(val) || 1;
      else if (headerName === "รายการดังนี้" || headerName === "รายการ") rec.items = val;
      else if (headerName === "ร้าน" || headerName === "ร้านที่ซื้อ") rec.purchaseStore = val;
      else if (headerName === "ราคาที่ซื้อ") rec.purchasePrice = Number(val) || 0;
      else if (headerName === "อักษร ราคา") rec.purchasePriceText = val;
      else if (headerName === "ผู้ตรวจรับ") rec.inspectorName = val;
      else if (headerName === "ตำแหน่งผู้ตรวจรับ") rec.inspectorPosition = val;
      else if (headerName === "วัตถุประสงค์") rec.objective = val;
      else if (headerName === "ขอซื้อ EGP") rec.egpRequestNo = val;
      else if (headerName === "ใบสั่งซื้อ") rec.poNumber = val;
    });

    return rec as Partial<ProcurementRecord>;
  });

  return parsedRecords;
}

/**
 * Export full JSON backup
 */
export function exportJsonBackup(records: ProcurementRecord[]) {
  const jsonStr = JSON.stringify(records, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `สำรองข้อมูล_จัดซื้อจัดจ้าง_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
