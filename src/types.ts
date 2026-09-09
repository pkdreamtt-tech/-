// Global TypeScript types and interfaces for the Procurement Management System

export interface TorItem {
  id: string;
  name: string;
  spec: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  total: number;
}

export interface ProcurementRecord {
  id: string;
  // Section 1: ข้อมูลเอกสารอ้างอิง
  trackingNo: string;
  docDate: string; // Thai format
  procureNo: string;
  torNo: string;
  medianPriceNo: string;
  procureType: string;

  // Section 2: ข้อมูลงบประมาณและโครงการ
  planName: string;
  workName: string;
  expenseName: string;
  expenseType: string;
  projectName: string;
  budgetAmount: number;
  transferInAmount: number;
  committedAmount: number;
  disbursedAmount: number;
  usedAmount: number;
  remainingAmount: number;

  // Section 3: รายการพัสดุ (TOR) & AI
  torItems: TorItem[];
  items: string; // formatted text
  itemCount: number;
  reason: string;
  objective: string;

  // Section 4: การสืบราคา
  surveyStore1: string;
  surveyPrice1: number | string;
  surveyStore2: string;
  surveyPrice2: number | string;
  surveyStore3: string;
  surveyPrice3: number | string;
  surveyMethod: string;
  surveyDocRef: string;
  surveyRefPrice: number | string;

  // Section 5: การสั่งซื้อและ e-GP
  purchaseStore: string;
  purchasePrice: number;
  purchasePriceText: string;
  egpRequestNo: string;
  egpRequestDate: string; // Thai format
  poNumber: string;
  poDate: string; // Thai format

  // Section 6: การส่งมอบและตรวจรับ
  deliveryDays: number | string;
  inspectorName: string;
  inspectorPosition: string;
  deliveryDocType: string;
  invoiceNo: string;
  deliveryDate: string; // Thai format

  // Section 7: ภาคผนวก (รูปภาพ Base64)
  image1: string;
  image2: string;

  createdAt: string;
}
