import { ProcurementRecord } from './App';

export const SHEET_HEADERS = [
  "เลขที่ต้นเรื่อง",
  "เลขที่จัดซื้อ",
  "วันที่",
  "เลขที่ TOR",
  "เลขที่ ราคากลาง",
  "ซื้อ/จ้าง",
  "แผน",
  "งาน",
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

export function recordToRowValues(rec: ProcurementRecord): (string | number)[] {
  return [
    rec.trackingNo || "",
    rec.procureNo || "",
    rec.docDate || "",
    rec.torNo || "",
    rec.medianPriceNo || "",
    rec.procureType || "",
    rec.planName || "",
    rec.workName || "",
    rec.expenseName || "",
    rec.expenseType || "",
    rec.projectName || "",
    rec.budgetAmount ?? 0,
    rec.transferInAmount ?? 0,
    rec.committedAmount ?? 0,
    rec.disbursedAmount ?? 0,
    rec.usedAmount ?? 0,
    rec.remainingAmount ?? 0,
    rec.reason || "",
    rec.itemCount ?? (rec.torItems ? rec.torItems.length : 0),
    rec.items || "",
    rec.purchaseStore || "",
    rec.purchasePrice ?? 0,
    rec.purchasePriceText || "",
    rec.surveyStore1 || "",
    rec.surveyPrice1 ?? 0,
    rec.surveyStore2 || "",
    rec.surveyPrice2 ?? 0,
    rec.surveyStore3 || "",
    rec.surveyPrice3 ?? 0,
    rec.surveyMethod || "",
    rec.surveyDocRef || "",
    rec.surveyRefPrice ?? 0,
    rec.deliveryDays ?? 0,
    rec.inspectorName || "",
    rec.inspectorPosition || "",
    rec.objective || "",
    rec.egpRequestNo || "",
    rec.egpRequestDate || "",
    rec.poNumber || "",
    rec.poDate || "",
    rec.deliveryDocType || "",
    rec.invoiceNo || "",
    rec.deliveryDate || "",
  ];
}

export async function exportToNewGoogleSheet(
  accessToken: string,
  records: ProcurementRecord[],
  sheetTitle?: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const title = sheetTitle || `ระบบจัดซื้อจัดจ้าง ทต.ท่าทอง - ${new Date().toLocaleDateString('th-TH')}`;

  // 1. Create a new Spreadsheet
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
    }),
  });

  if (!createRes.ok) {
    const errData = await createRes.json().catch(() => ({}));
    throw new Error(errData?.error?.message || 'ไม่สามารถสร้าง Google Spreadsheet ใหม่ได้');
  }

  const createdData = await createRes.json();
  const spreadsheetId = createdData.spreadsheetId;
  const spreadsheetUrl = createdData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Get the first sheet's title
  const firstSheetTitle = createdData.sheets?.[0]?.properties?.title || 'Sheet1';

  // 2. Prepare all values: Header + Records
  const allRows: (string | number)[][] = [
    SHEET_HEADERS,
    ...records.map((rec) => recordToRowValues(rec)),
  ];

  // 3. Append / write to the sheet
  const appendRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      firstSheetTitle
    )}!A1:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: allRows,
      }),
    }
  );

  if (!appendRes.ok) {
    const errData = await appendRes.json().catch(() => ({}));
    throw new Error(errData?.error?.message || 'ไม่สามารถเขียนข้อมูลลงใน Google Sheet ได้');
  }

  return { spreadsheetId, spreadsheetUrl };
}
