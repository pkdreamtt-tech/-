// Excel & CSV Export utilities with guaranteed Thai language character encoding (UTF-8 BOM / Excel HTML format)
import { ProcurementRecord } from "../types";

/**
 * Clean string for CSV cell, neutralizing interior double quotes and normalizing newlines
 */
function sanitizeCsvValue(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""').replace(/\r?\n/g, " ");
  return `"${str}"`;
}

/**
 * Format topic title cleanly: e.g. "วัสดุก่อสร้าง จำนวน 21 รายการ"
 */
export function formatTopicTitle(rec: Partial<ProcurementRecord>): string {
  const count =
    rec.itemCount ||
    (rec.torItems && rec.torItems.length > 0 ? rec.torItems.length : 1);

  let cleanName = rec.expenseType?.trim() || "";
  if (!cleanName && rec.torItems && rec.torItems[0]?.name) {
    cleanName = rec.torItems[0].name.trim();
  }
  if (!cleanName && rec.expenseName) {
    cleanName = rec.expenseName.trim();
  }
  if (!cleanName) {
    cleanName = "วัสดุ/ครุภัณฑ์";
  }

  // Strip leading redundant words
  cleanName = cleanName
    .replace(/^(พัสดุ\s*|การจัดซื้อ\s*|การจัดจ้าง\s*|จัดซื้อ\s*|จัดจ้าง\s*)/i, "")
    .trim();
  if (!cleanName) cleanName = "วัสดุ/ครุภัณฑ์";

  return `${cleanName} จำนวน ${count} รายการ`;
}

/**
 * ส่งออกไฟล์ Excel (.xls) ผ่าน HTML Spreadsheet Format พร้อม UTF-8 Meta
 * โปรแกรม Microsoft Excel ทุกเวอร์ชันจะเปิดอ่านภาษาไทยได้ 100% ไม่เป็นภาษาต่างดาว
 */
export function exportToExcelFile(records: ProcurementRecord[]) {
  if (!records || records.length === 0) {
    throw new Error("ไม่มีข้อมูลสำหรับส่งออก");
  }

  const tableRows = records
    .map((rec, index) => {
      const topic = formatTopicTitle(rec);
      const price = Number(rec.purchasePrice || 0);
      return `<tr>
        <td style="text-align: center;">${index + 1}</td>
        <td>${rec.purchaseStore || "-"}</td>
        <td>${topic}</td>
        <td style="text-align: right;">${price.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td>${rec.trackingNo || "-"}</td>
        <td>${rec.docDate || "-"}</td>
        <td>${rec.procureType || "ซื้อ"}</td>
        <td>${rec.purchasePriceText || "-"}</td>
        <td>${rec.inspectorName || "-"}</td>
        <td>${rec.inspectorPosition || "-"}</td>
        <td>${(rec.items || "").replace(/\n/g, ", ")}</td>
      </tr>`;
    })
    .join("\n");

  const excelTemplate = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" 
      xmlns:x="urn:schemas-microsoft-com:office:excel" 
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>รายงานการจัดซื้อจัดจ้าง</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    body { font-family: 'Sarabun', Tahoma, sans-serif; font-size: 13px; }
    table { border-collapse: collapse; width: 100%; }
    th { background-color: #2D1457; color: #FFFFFF; font-weight: bold; border: 1px solid #999; padding: 8px; }
    td { border: 1px solid #ccc; padding: 6px; }
  </style>
</head>
<body>
  <h2>รายงานสรุปข้อมูลการจัดซื้อจัดจ้าง - กองการศึกษา เทศบาลตำบลท่าทอง</h2>
  <p>ข้อมูล ณ วันที่: ${new Date().toLocaleDateString("th-TH")}</p>
  <table>
    <thead>
      <tr>
        <th>ลำดับ</th>
        <th>ร้านที่ซื้อ / ผู้รับจ้าง</th>
        <th>หัวข้อ / รายการ</th>
        <th>ราคาที่ซื้อ (บาท)</th>
        <th>เลขที่ต้นเรื่อง</th>
        <th>วันที่</th>
        <th>ประเภท</th>
        <th>ราคาตัวอักษร</th>
        <th>ผู้ตรวจรับพัสดุ</th>
        <th>ตำแหน่ง</th>
        <th>รายละเอียดพัสดุ</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
</body>
</html>`;

  const blob = new Blob(["\uFEFF" + excelTemplate], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `รายงานจัดซื้อจัดจ้าง_เทศบาลตำบลท่าทอง_${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * ส่งออกไฟล์ CSV สำหรับ Mail Merge (43 คอลัมน์) พร้อม UTF-8 BOM \uFEFF ป้องกันภาษาต่างดาว
 */
export function exportToMailMergeCsv(records: ProcurementRecord[]) {
  if (!records || records.length === 0) {
    throw new Error("ไม่มีข้อมูลสำหรับส่งออก");
  }

  const headers = [
    "ต้นเรื่อง",
    "ขอซื้อ",
    "วันที่",
    "ที่TOR",
    "ที่ราคากลาง",
    "วิธีซื้อ",
    "แผนงาน",
    "งาน",
    "หมวด",
    "รายจ่าย",
    "ประเภท",
    "โครงการ",
    "งบเทศ",
    "โอนเพิ่ม",
    "ผูกพัน",
    "เบิกจ่าย",
    "ใช้ไป",
    "เหลือ",
    "เหตุผล",
    "จำนวน รายการ",
    "รายการดังนี้",
    "ร้าน",
    "ราคาที่ซื้อ",
    "อักษร ราคา",
    "สืบร้าน1",
    "ราคาสืบ1",
    "สืบร้าน2",
    "ราคาสืบ2",
    "สืบร้าน3",
    "ราคาสืบ3",
    "วิธีสืบราคา",
    "อ้างอิงตามเอกสาร",
    "ราคาที่อ้างอิง",
    "จำนวนวัน ส่ง",
    "ผู้ตรวจรับ",
    "ตำแหน่งผู้ตรวจรับ",
    "วัตถุประสงค์",
    "ขอซื้อ EGP",
    "วันที่ ขอซื้อ",
    "ใบสั่งซื้อ",
    "วันที่สั่ง",
    "เอกสาร ส่ง",
    "เลขที่บิล",
    "วันที่ส่ง",
  ];

  const rows = records.map((rec) => [
    sanitizeCsvValue(rec.trackingNo),
    sanitizeCsvValue(rec.procureNo),
    sanitizeCsvValue(rec.docDate),
    sanitizeCsvValue(rec.torNo),
    sanitizeCsvValue(rec.medianPriceNo),
    sanitizeCsvValue(rec.procureType),
    sanitizeCsvValue(rec.planName),
    sanitizeCsvValue(rec.workName),
    sanitizeCsvValue(rec.expenseName),
    sanitizeCsvValue(rec.expenseType),
    sanitizeCsvValue(rec.projectName),
    sanitizeCsvValue(rec.budgetAmount),
    sanitizeCsvValue(rec.transferInAmount),
    sanitizeCsvValue(rec.committedAmount),
    sanitizeCsvValue(rec.disbursedAmount),
    sanitizeCsvValue(rec.usedAmount),
    sanitizeCsvValue(rec.remainingAmount),
    sanitizeCsvValue(rec.reason),
    sanitizeCsvValue(rec.itemCount),
    sanitizeCsvValue(rec.items),
    sanitizeCsvValue(rec.purchaseStore),
    sanitizeCsvValue(rec.purchasePrice),
    sanitizeCsvValue(rec.purchasePriceText),
    sanitizeCsvValue(rec.surveyStore1),
    sanitizeCsvValue(rec.surveyPrice1),
    sanitizeCsvValue(rec.surveyStore2),
    sanitizeCsvValue(rec.surveyPrice2),
    sanitizeCsvValue(rec.surveyStore3),
    sanitizeCsvValue(rec.surveyPrice3),
    sanitizeCsvValue(rec.surveyMethod),
    sanitizeCsvValue(rec.surveyDocRef),
    sanitizeCsvValue(rec.surveyRefPrice),
    sanitizeCsvValue(rec.deliveryDays),
    sanitizeCsvValue(rec.inspectorName),
    sanitizeCsvValue(rec.inspectorPosition),
    sanitizeCsvValue(rec.objective),
    sanitizeCsvValue(rec.egpRequestNo),
    sanitizeCsvValue(rec.egpRequestDate),
    sanitizeCsvValue(rec.poNumber),
    sanitizeCsvValue(rec.poDate),
    sanitizeCsvValue(rec.deliveryDocType),
    sanitizeCsvValue(rec.invoiceNo),
    sanitizeCsvValue(rec.deliveryDate),
  ]);

  const csvContent =
    "\uFEFF" +
    [
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `จัดซื้อจัดจ้าง_MailMerge_${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * ส่งออกข้อมูลสำรอง JSON พร้อมดาวน์โหลด
 */
export function exportJsonBackup(records: ProcurementRecord[]) {
  if (!records || records.length === 0) {
    throw new Error("ไม่มีข้อมูลสำหรับส่งออก");
  }

  const jsonContent = JSON.stringify(records, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `สำรองข้อมูล_จัดซื้อจัดจ้าง_${new Date().toISOString().slice(0, 10)}.json`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
