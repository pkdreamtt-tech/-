import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  FileText,
  List,
  Plus,
  Trash2,
  Sparkles,
  Download,
  Save,
  RotateCcw,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  Edit,
  Eye,
  Calendar,
  Building2,
  Coins,
  Store,
  Truck,
  Image as ImageIcon,
  ChevronRight,
  Search,
  ExternalLink,
  Table,
  LogOut,
  Loader2,
  Printer,
  Filter,
  FileDown,
  Share2,
  Camera,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import { signInWithGoogle, signOutGoogle, getCachedToken, subscribeAuth } from "./googleAuth";
import { exportToNewGoogleSheet } from "./googleSheets";
import type { User } from "firebase/auth";
import { ImageManagerModal } from "./components/ImageManagerModal";
import { PdfAppendixModal } from "./components/PdfAppendixModal";
import { ShareModal } from "./components/ShareModal";
import { CommitteePhotoView } from "./components/CommitteePhotoView";
import {
  exportToExcelFile,
  exportToMailMergeCsv,
  exportJsonBackup,
  formatTopicTitle,
} from "./utils/excelExport";
import { parseCsvImport, parseJsonBackup } from "./utils/dataImport";
import { compressImageToJpeg, saveImageToStore } from "./imageStorage";

// ==========================================
// 1. UTILS & SPECIAL LOGIC
// ==========================================

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

export function formatDateToThai(isoDate: string): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(monthIdx) || isNaN(day) || monthIdx < 0 || monthIdx > 11) {
    return isoDate;
  }
  const thaiYear = year + 543;
  return `${day} ${THAI_MONTHS[monthIdx]} ${thaiYear}`;
}

export function parseThaiToIso(thaiDate: string): string {
  if (!thaiDate) return "";
  const tokens = thaiDate.trim().split(/\s+/);
  if (tokens.length !== 3) return "";
  const day = parseInt(tokens[0], 10);
  const monthName = tokens[1];
  const thaiYear = parseInt(tokens[2], 10);
  const monthIdx = THAI_MONTHS.indexOf(monthName);
  if (isNaN(day) || monthIdx === -1 || isNaN(thaiYear)) return "";
  const cYear = thaiYear - 543;
  const mm = String(monthIdx + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${cYear}-${mm}-${dd}`;
}

export function bahtText(num: number): string {
  if (isNaN(num) || num === null || num === undefined) return "";
  if (num === 0) return "ศูนย์บาทถ้วน";

  const numStr = num.toFixed(2);
  const [intPart, decPart] = numStr.split(".");
  const digits = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const positions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

  function convertGroup(nStr: string): string {
    let result = "";
    const len = nStr.length;
    for (let i = 0; i < len; i++) {
      const d = parseInt(nStr[i], 10);
      const pos = len - 1 - i;
      if (d !== 0) {
        if (pos === 1 && d === 1) {
          result += "สิบ";
        } else if (pos === 1 && d === 2) {
          result += "ยี่สิบ";
        } else if (pos === 0 && d === 1 && len > 1 && parseInt(nStr[len - 2], 10) !== 0) {
          result += "เอ็ด";
        } else {
          result += digits[d] + positions[pos];
        }
      }
    }
    return result;
  }

  let bahtOutput = "";
  if (parseInt(intPart, 10) === 0) {
    bahtOutput = "ศูนย์บาท";
  } else {
    // Handling millions if larger
    if (intPart.length > 6) {
      const milPart = intPart.slice(0, intPart.length - 6);
      const remPart = intPart.slice(intPart.length - 6);
      bahtOutput = convertGroup(milPart) + "ล้าน" + convertGroup(remPart) + "บาท";
    } else {
      bahtOutput = convertGroup(intPart) + "บาท";
    }
  }

  const decNum = parseInt(decPart, 10);
  if (decNum === 0) {
    return bahtOutput + "ถ้วน";
  } else {
    let satangOutput = "";
    const d1 = parseInt(decPart[0], 10);
    const d2 = parseInt(decPart[1], 10);
    if (d1 === 1) satangOutput += "สิบ";
    else if (d1 === 2) satangOutput += "ยี่สิบ";
    else if (d1 > 2) satangOutput += digits[d1] + "สิบ";

    if (d2 === 1 && d1 > 0) satangOutput += "เอ็ด";
    else if (d2 > 0) satangOutput += digits[d2];

    return (bahtOutput === "ศูนย์บาท" ? "" : bahtOutput) + satangOutput + "สตางค์";
  }
}

// ==========================================
// 2. TYPES
// ==========================================

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

// Initial Mock Records
const INITIAL_RECORDS: ProcurementRecord[] = [
  {
    id: "REC-2569-001",
    trackingNo: "กศ.01/2569",
    docDate: "15 พฤษภาคม 2569",
    procureNo: "ซ.12/2569",
    torNo: "TOR-04/2569",
    medianPriceNo: "มก.08/2569",
    procureType: "ซื้อ",
    planName: "แผนงานการศึกษา",
    workName: "งานระดับก่อนวัยเรียนและประถมศึกษา",
    expenseName: "งบดำเนินงาน",
    expenseType: "ค่าวัสดุการศึกษา",
    projectName: "โครงการพัฒนาศูนย์พัฒนาเด็กเล็กเทศบาลตำบลท่าทอง",
    budgetAmount: 100000,
    transferInAmount: 0,
    committedAmount: 0,
    disbursedAmount: 0,
    usedAmount: 45000,
    remainingAmount: 55000,
    torItems: [
      {
        id: "1",
        name: "ชุดสื่อเสริมพัฒนาการเด็กปฐมวัย",
        spec: "ชุดบล็อกไม้เสริมพัฒนาการ ปลอดสารพิษ ได้มาตรฐาน มอก.",
        quantity: 10,
        unit: "ชุด",
        pricePerUnit: 2500,
        total: 25000,
      },
      {
        id: "2",
        name: "เบาะรองนอนสำหรับเด็กเล็ก",
        spec: "เบาะฟองน้ำอัดแน่น หุ้มหนังเทียม PVC กันน้ำ ขนาด 60x120 ซม.",
        quantity: 20,
        unit: "ผืน",
        pricePerUnit: 1000,
        total: 20000,
      },
    ],
    items:
      "1. ชุดสื่อเสริมพัฒนาการเด็กปฐมวัย (คุณลักษณะ: ชุดบล็อกไม้เสริมพัฒนาการ ปลอดสารพิษ ได้มาตรฐาน มอก.) จำนวน 10 ชุด ราคาหน่วยละ 2,500.00 บาท รวมเป็นเงิน 25,000.00 บาท\n2. เบาะรองนอนสำหรับเด็กเล็ก (คุณลักษณะ: เบาะฟองน้ำอัดแน่น หุ้มหนังเทียม PVC กันน้ำ ขนาด 60x120 ซม.) จำนวน 20 ผืน ราคาหน่วยละ 1,000.00 บาท รวมเป็นเงิน 20,000.00 บาท\n",
    itemCount: 2,
    reason:
      "เนื่องจากสื่อการเรียนการสอนและอุปกรณ์การนอนเดิมของศูนย์พัฒนาเด็กเล็กเทศบาลตำบลท่าทองมีสภาพทรุดโทรมและไม่เพียงพอต่อจำนวนเด็กปฐมวัยที่เพิ่มขึ้นในภาคเรียนใหม่ จึงจำเป็นต้องจัดซื้อเพื่อสุขอนามัยและพัฒนาการที่สมบูรณ์",
    objective:
      "เพื่อพัฒนาคุณภาพการจัดการศึกษาปฐมวัย ส่งเสริมพัฒนาการทั้ง 4 ด้านของเด็ก และจัดสภาพแวดล้อมที่เอื้อต่อการเรียนรู้อย่างปลอดภัยในศูนย์พัฒนาเด็กเล็ก",
    surveyStore1: "ร้านศึกษาภัณฑ์ท่าทองพาณิชย์",
    surveyPrice1: 45000,
    surveyStore2: "ห้างหุ้นส่วนจำกัด พิษณุโลกการศึกษา",
    surveyPrice2: 46500,
    surveyStore3: "บริษัท มีเดียเอ็ดดูเคชั่น จำกัด",
    surveyPrice3: 47000,
    surveyMethod: "สืบราคาจากผู้มีอาชีพขายโดยตรงจำนวน 3 ราย",
    surveyDocRef: "ใบเสนอราคาลงวันที่ 10 พฤษภาคม 2569",
    surveyRefPrice: 45000,
    purchaseStore: "ร้านศึกษาภัณฑ์ท่าทองพาณิชย์",
    purchasePrice: 45000,
    purchasePriceText: "สี่หมื่นห้าพันบาทถ้วน",
    egpRequestNo: "EGP-690515-0089",
    egpRequestDate: "18 พฤษภาคม 2569",
    poNumber: "PO-69/0045",
    poDate: "20 พฤษภาคม 2569",
    deliveryDays: 15,
    inspectorName: "นางสาวสมใจ รักเรียน",
    inspectorPosition: "ผู้อำนวยการกองการศึกษา",
    deliveryDocType: "ใบส่งของ/ใบแจ้งหนี้",
    invoiceNo: "INV-6905-112",
    deliveryDate: "28 พฤษภาคม 2569",
    image1: "",
    image2: "",
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_FORM: ProcurementRecord = {
  id: "",
  trackingNo: "",
  docDate: formatDateToThai(new Date().toISOString().split("T")[0]),
  procureNo: "",
  torNo: "",
  medianPriceNo: "",
  procureType: "ซื้อ",
  planName: "แผนงานการศึกษา",
  workName: "งานบริหารทั่วไปเกี่ยวกับการศึกษา",
  expenseName: "งบดำเนินงาน",
  expenseType: "ค่าวัสดุ",
  projectName: "โครงการจัดหาพัสดุเพื่อการศึกษา กองการศึกษา",
  budgetAmount: 50000,
  transferInAmount: 0,
  committedAmount: 0,
  disbursedAmount: 0,
  usedAmount: 0,
  remainingAmount: 50000,
  torItems: [
    {
      id: "1",
      name: "",
      spec: "",
      quantity: 1,
      unit: "ชุด",
      pricePerUnit: 0,
      total: 0,
    },
  ],
  items: "",
  itemCount: 0,
  reason: "",
  objective: "",
  surveyStore1: "",
  surveyPrice1: "",
  surveyStore2: "",
  surveyPrice2: "",
  surveyStore3: "",
  surveyPrice3: "",
  surveyMethod: "สืบราคาจากผู้ประกอบการในพื้นที่ 3 ราย",
  surveyDocRef: "ใบเสนอราคา",
  surveyRefPrice: "",
  purchaseStore: "",
  purchasePrice: 0,
  purchasePriceText: "",
  egpRequestNo: "",
  egpRequestDate: "",
  poNumber: "",
  poDate: "",
  deliveryDays: 7,
  inspectorName: "",
  inspectorPosition: "ผู้อำนวยการกองการศึกษา",
  deliveryDocType: "ใบส่งของ",
  invoiceNo: "",
  deliveryDate: "",
  image1: "",
  image2: "",
  createdAt: "",
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"form" | "list">("form");
  const [formData, setFormData] = useState<ProcurementRecord>(DEFAULT_FORM);
  const [records, setRecords] = useState<ProcurementRecord[]>(() => {
    try {
      const saved = localStorage.getItem("thathong_procurements");
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return INITIAL_RECORDS;
  });

  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loadingAI, setLoadingAI] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProcureType, setFilterProcureType] = useState<string>("all");
  const [aiKeywords, setAiKeywords] = useState("");
  const [pdfPreviewRecord, setPdfPreviewRecord] = useState<ProcurementRecord | null>(null);
  const [photoManagerRecord, setPhotoManagerRecord] = useState<ProcurementRecord | null>(null);
  const [shareModalRecord, setShareModalRecord] = useState<ProcurementRecord | null>(null);
  const [committeeRecord, setCommitteeRecord] = useState<ProcurementRecord | null>(null);
  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Check URL params for shared committee inspector link
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const shareId = params.get("shareRecordId");
      const mode = params.get("mode");
      if (shareId && mode === "committee") {
        const found = records.find((r) => r.id === shareId);
        if (found) {
          setCommitteeRecord(found);
        } else {
          setCommitteeRecord({
            ...DEFAULT_FORM,
            id: shareId,
            trackingNo: shareId,
          });
        }
      }
    } catch (err) {
      console.error("Error reading URL search params:", err);
    }
  }, [records]);

  // Google Sheets state
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);
  const [isExportingSheet, setIsExportingSheet] = useState(false);
  const [lastExportedSheetUrl, setLastExportedSheetUrl] = useState<string | null>(null);
  const [showConfirmSheetModal, setShowConfirmSheetModal] = useState(false);

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = subscribeAuth((user) => {
      setGoogleUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    setIsSigningInGoogle(true);
    try {
      const res = await signInWithGoogle();
      setGoogleUser(res.user);
      showToast("success", `เข้าสู่ระบบ Google สำเร็จ (${res.user.email || "พร้อมใช้งาน"})`);
    } catch (err: any) {
      console.error(err);
      showToast("error", err?.message || "ไม่สามารถเชื่อมต่อ Google ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await signOutGoogle();
      setGoogleUser(null);
      showToast("success", "ออกจากระบบ Google เรียบร้อยแล้ว");
    } catch {
      showToast("error", "ไม่สามารถออกจากระบบได้");
    }
  };

  const handleTriggerExportSheet = () => {
    if (records.length === 0) {
      showToast("error", "ไม่มีข้อมูลสำหรับส่งออก");
      return;
    }
    if (!googleUser || !getCachedToken()) {
      handleGoogleSignIn();
      return;
    }
    setShowConfirmSheetModal(true);
  };

  const handleConfirmExportSheet = async () => {
    setShowConfirmSheetModal(false);
    setIsExportingSheet(true);
    try {
      const token = getCachedToken();
      if (!token) {
        throw new Error("เซสชัน Google หมดอายุ กรุณาเข้าสู่ระบบ Google ใหม่อีกครั้ง");
      }
      const result = await exportToNewGoogleSheet(
        token,
        records,
        `ข้อมูลจัดซื้อจัดจ้าง_กองการศึกษา_เทศบาลตำบลท่าทอง_${new Date().toLocaleDateString("th-TH")}`
      );
      setLastExportedSheetUrl(result.spreadsheetUrl);
      showToast("success", "สร้างและส่งออกข้อมูลไปยัง Google Sheets สำเร็จเรียบร้อย!");
    } catch (err: any) {
      console.error("Google Sheets export error:", err);
      showToast("error", err?.message || "เกิดข้อผิดพลาดในการส่งออกไปยัง Google Sheets");
    } finally {
      setIsExportingSheet(false);
    }
  };

  // Save records to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem("thathong_procurements", JSON.stringify(records));
    } catch {
      // storage full fallback
    }
  }, [records]);

  // Show Toast
  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // -------------------------------------------------------------
  // AUTO FORMAT ITEMS TEXT & BAHT TEXT WHEN TOR ITEMS CHANGE
  // -------------------------------------------------------------
  const syncTorCalculations = (itemsList: TorItem[]) => {
    let formattedText = "";
    let grandTotal = 0;

    itemsList.forEach((item, index) => {
      const rowTotal = (Number(item.quantity) || 0) * (Number(item.pricePerUnit) || 0);
      item.total = rowTotal;
      grandTotal += rowTotal;

      const formattedPrice = Number(item.pricePerUnit || 0).toLocaleString("th-TH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const formattedRowTotal = rowTotal.toLocaleString("th-TH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      formattedText += `${index + 1}. ${item.name || "-"} (คุณลักษณะ: ${item.spec || "-"}) จำนวน ${
        item.quantity || 0
      } ${item.unit || "หน่วย"} ราคาหน่วยละ ${formattedPrice} บาท รวมเป็นเงิน ${formattedRowTotal} บาท\n`;
    });

    const bText = bahtText(grandTotal);

    setFormData((prev) => {
      const remaining = Number(prev.budgetAmount || 0) + Number(prev.transferInAmount || 0) - grandTotal;
      return {
        ...prev,
        torItems: itemsList,
        items: formattedText,
        itemCount: itemsList.length,
        purchasePrice: grandTotal,
        purchasePriceText: bText,
        usedAmount: grandTotal,
        remainingAmount: remaining,
        surveyRefPrice: prev.surveyRefPrice || grandTotal,
      };
    });
  };

  // -------------------------------------------------------------
  // GEMINI AI INTEGRATION
  // -------------------------------------------------------------
  const handleGenerateSpec = async (index: number, itemName: string) => {
    if (!itemName || itemName.trim() === "") {
      showToast("error", "กรุณากรอกชื่อรายการพัสดุก่อนร่างสเปค");
      return;
    }

    setLoadingAI((prev) => ({ ...prev, [`spec_${index}`]: true }));
    try {
      const res = await fetch("/api/gemini/spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemName }),
      });
      const data = await res.json();
      if (data?.spec) {
        const updated = [...formData.torItems];
        updated[index].spec = data.spec;
        syncTorCalculations(updated);
        showToast("success", `AI ร่างคุณลักษณะเฉพาะสำหรับ "${itemName}" เรียบร้อยแล้ว`);
      } else {
        throw new Error("No spec returned");
      }
    } catch {
      showToast("error", "ไม่สามารถติดต่อระบบ AI ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoadingAI((prev) => ({ ...prev, [`spec_${index}`]: false }));
    }
  };

  const handleGenerateReasonAndObjective = async () => {
    if (!formData.items || formData.items.trim() === "") {
      showToast("error", "กรุณาระบุรายการพัสดุในตารางก่อนร่างเหตุผลและวัตถุประสงค์");
      return;
    }

    setLoadingAI((prev) => ({ ...prev, reason_objective: true }));
    try {
      const res = await fetch("/api/gemini/reason-objective", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemsText: formData.items,
          keywords: aiKeywords.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data?.reason || data?.objective) {
        setFormData((prev) => ({
          ...prev,
          reason: data.reason || prev.reason,
          objective: data.objective || prev.objective,
        }));
        showToast("success", "AI ร่างเหตุผลความจำเป็นและวัตถุประสงค์สำเร็จแล้ว");
      } else {
        throw new Error("Invalid response format");
      }
    } catch {
      showToast("error", "เกิดข้อผิดพลาดในการเรียก AI กรุณาลองใหม่");
    } finally {
      setLoadingAI((prev) => ({ ...prev, reason_objective: false }));
    }
  };

  // -------------------------------------------------------------
  // FORM FIELD CHANGERS
  // -------------------------------------------------------------
  const handleFieldChange = (field: keyof ProcurementRecord, value: any) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (
        field === "budgetAmount" ||
        field === "transferInAmount" ||
        field === "usedAmount" ||
        field === "committedAmount" ||
        field === "disbursedAmount"
      ) {
        const b = Number(field === "budgetAmount" ? value : next.budgetAmount) || 0;
        const t = Number(field === "transferInAmount" ? value : next.transferInAmount) || 0;
        const u = Number(field === "usedAmount" ? value : next.usedAmount) || 0;
        next.remainingAmount = b + t - u;
      }
      if (field === "purchasePrice") {
        next.purchasePriceText = bahtText(Number(value) || 0);
      }
      return next;
    });
  };

  const handleDateChange = (field: "docDate" | "egpRequestDate" | "poDate" | "deliveryDate", isoValue: string) => {
    const thaiStr = formatDateToThai(isoValue);
    setFormData((prev) => ({ ...prev, [field]: thaiStr }));
  };

  // TOR Items row manipulation
  const addTorRow = () => {
    const newItems = [
      ...formData.torItems,
      {
        id: String(Date.now()),
        name: "",
        spec: "",
        quantity: 1,
        unit: "ชิ้น",
        pricePerUnit: 0,
        total: 0,
      },
    ];
    syncTorCalculations(newItems);
  };

  const removeTorRow = (index: number) => {
    if (formData.torItems.length <= 1) {
      showToast("error", "ต้องมีรายการพัสดุอย่างน้อย 1 รายการ");
      return;
    }
    const newItems = formData.torItems.filter((_, i) => i !== index);
    syncTorCalculations(newItems);
  };

  const updateTorRow = (index: number, key: keyof TorItem, val: any) => {
    const updated = [...formData.torItems];
    updated[index] = { ...updated[index], [key]: val };
    syncTorCalculations(updated);
  };

  // Image Upload handler with instant 70% compression (.jpg)
  const handleImageUpload = async (file: File, imgKey: "image1" | "image2") => {
    if (!file) return;
    try {
      const compressed = await compressImageToJpeg(file, 0.7);
      setFormData((prev) => ({ ...prev, [imgKey]: compressed }));
      if (formData.id) {
        await saveImageToStore(
          formData.id,
          compressed,
          formData.torItems?.[0]?.name || "",
          String(formData.itemCount || 1),
          imgKey === "image1" ? "ภาพถ่ายพัสดุ / การส่งมอบของ" : "ภาพถ่ายการตรวจสอบสถานที่จริง"
        );
      }
      showToast("success", `บีบอัด 70% (.jpg) และแนบรูปภาพที่ ${imgKey === "image1" ? "1" : "2"} สำเร็จ`);
    } catch (err) {
      console.error("Image upload error:", err);
      showToast("error", "ไม่สามารถอัปโหลดรูปภาพได้");
    }
  };

  // Save form: กรอกไม่ครบก็สามารถบันทึกได้!
  const handleSaveForm = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Auto fallback for trackingNo if empty, allowing partial saves
    const finalTrackingNo = formData.trackingNo?.trim() || `เรื่องจัดซื้อ-${Date.now().toString().slice(-4)}`;
    const dataToSave: ProcurementRecord = {
      ...formData,
      trackingNo: finalTrackingNo,
    };

    if (formData.id) {
      // update existing
      setRecords((prev) => prev.map((r) => (r.id === formData.id ? { ...dataToSave } : r)));
      showToast("success", `บันทึกการแก้ไข "${finalTrackingNo}" สำเร็จ`);
    } else {
      // create new
      const newRec: ProcurementRecord = {
        ...dataToSave,
        id: `REC-${Date.now().toString().slice(-6)}`,
        createdAt: new Date().toISOString(),
      };
      setRecords((prev) => [newRec, ...prev]);
      showToast("success", `บันทึกรายการจัดซื้อ "${newRec.trackingNo}" สำเร็จ`);
    }

    setActiveTab("list");
  };

  const handleResetForm = () => {
    setFormData({
      ...DEFAULT_FORM,
      docDate: formatDateToThai(new Date().toISOString().split("T")[0]),
    });
    showToast("success", "ล้างข้อมูลฟอร์มเรียบร้อยแล้ว");
  };

  const handleEditRecord = (rec: ProcurementRecord) => {
    setFormData({ ...rec });
    setActiveTab("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteRecord = (id: string) => {
    if (window.confirm("ยืนยันการลบรายการจัดซื้อจัดจ้างนี้หรือไม่?")) {
      setRecords((prev) => prev.filter((r) => r.id !== id));
      showToast("success", "ลบรายการจัดซื้อจัดจ้างสำเร็จ");
    }
  };

  // -------------------------------------------------------------
  // IMPORT / EXPORT HANDLERS
  // -------------------------------------------------------------
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.name.toLowerCase().endsWith(".json")) {
        const imported = await parseJsonBackup(file);
        setRecords((prev) => [...imported, ...prev]);
        showToast("success", `นำเข้าข้อมูลสำรอง JSON สำเร็จ (${imported.length} รายการ)`);
      } else if (file.name.toLowerCase().endsWith(".csv")) {
        const imported = await parseCsvImport(file);
        const fullRecords: ProcurementRecord[] = imported.map((r, i) => ({
          ...DEFAULT_FORM,
          ...r,
          id: r.id || `REC-CSV-${Date.now()}-${i}`,
          createdAt: new Date().toISOString(),
        } as ProcurementRecord));
        setRecords((prev) => [...fullRecords, ...prev]);
        showToast("success", `นำเข้าข้อมูลจาก CSV สำเร็จ (${fullRecords.length} รายการ)`);
      } else {
        showToast("error", "รองรับเฉพาะไฟล์ .json หรือ .csv เท่านั้น");
      }
    } catch (err: any) {
      console.error("Import error:", err);
      showToast("error", err?.message || "เกิดข้อผิดพลาดในการนำเข้าไฟล์");
    } finally {
      if (importFileInputRef.current) importFileInputRef.current.value = "";
    }
  };

  const handleExportExcel = () => {
    try {
      exportToExcelFile(records);
      showToast("success", "ส่งออกไฟล์ Excel (.xls) เรียบร้อยแล้ว ภาษาไทยสมบูรณ์ 100%");
    } catch (err) {
      console.error(err);
      showToast("error", "ไม่สามารถส่งออก Excel ได้");
    }
  };

  const handleExportCsv = () => {
    try {
      exportToMailMergeCsv(records);
      showToast("success", "ส่งออกไฟล์ CSV สำหรับ Mail Merge เรียบร้อยแล้ว (UTF-8)");
    } catch (err) {
      console.error(err);
      showToast("error", "ไม่สามารถส่งออก CSV ได้");
    }
  };

  const handleExportJson = () => {
    try {
      exportJsonBackup(records);
      showToast("success", "ส่งออกไฟล์สำรองข้อมูล JSON สำเร็จ");
    } catch (err) {
      console.error(err);
      showToast("error", "ไม่สามารถส่งออก JSON ได้");
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const q = searchTerm.toLowerCase().trim();
      const topic = formatTopicTitle(r).toLowerCase();
      const matchSearch =
        !q ||
        r.purchaseStore?.toLowerCase().includes(q) ||
        r.expenseType?.toLowerCase().includes(q) ||
        r.expenseName?.toLowerCase().includes(q) ||
        topic.includes(q) ||
        r.trackingNo?.toLowerCase().includes(q) ||
        r.procureNo?.toLowerCase().includes(q) ||
        r.items?.toLowerCase().includes(q) ||
        r.inspectorName?.toLowerCase().includes(q);

      const matchType =
        filterProcureType === "all" ||
        r.procureType === filterProcureType;

      return matchSearch && matchType;
    });
  }, [records, searchTerm, filterProcureType]);

  // Committee Inspector Mode
  if (committeeRecord) {
    return (
      <CommitteePhotoView
        record={committeeRecord}
        onBack={() => setCommitteeRecord(null)}
        onOpenPdf={(rec) => setPdfPreviewRecord(rec)}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-[#1F1F1F]">
      {/* ==========================================
          STICKY HEADER - Modern & Bold Deep Purple
      ========================================== */}
      <header className="sticky top-0 z-40 bg-[#2D1457] text-white border-b border-[#44207f] shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-18">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#FFC300] text-[#1F1F1F] flex items-center justify-center font-bold shadow-md">
                <Building2 className="w-6 h-6 text-[#1F1F1F]" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-white leading-tight">
                  ระบบจัดซื้อจัดจ้างอัจฉริยะ
                </h1>
                <p className="text-xs sm:text-sm text-[#FFC300] font-medium">
                  กองการศึกษา เทศบาลตำบลท่าทอง จ.พิษณุโลก
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-black/25 rounded-xl border border-white/10">
              <button
                id="tab-create-form"
                onClick={() => setActiveTab("form")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                  activeTab === "form"
                    ? "bg-[#FFC300] text-[#1F1F1F] shadow-sm"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>สร้างรายการใหม่ (Form)</span>
              </button>
              <button
                id="tab-record-list"
                onClick={() => setActiveTab("list")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                  activeTab === "list"
                    ? "bg-[#FFC300] text-[#1F1F1F] shadow-sm"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                <List className="w-4 h-4" />
                <span>รายการทั้งหมด ({records.length})</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ==========================================
          TOAST NOTIFICATION
      ========================================== */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
              toast.type === "success"
                ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                : "bg-rose-50 text-rose-900 border-rose-300"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ==========================================
          MAIN CONTENT AREA
      ========================================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28">
        {activeTab === "form" ? (
          /* ==========================================
             TAB 1: FORM SECTIONS (7 SECTIONS)
          ========================================== */
          <form onSubmit={handleSaveForm} className="space-y-6">
            {/* Banner info - Modern & Bold */}
            <div className="bg-gradient-to-r from-[#2D1457] via-[#3a1a6e] to-[#2D1457] text-white rounded-2xl p-5 sm:p-6 shadow-md border border-[#44207f] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[#FFC300] text-xs font-semibold uppercase tracking-wider mb-1">
                  <span>แบบฟอร์มขอความเห็นชอบและบันทึกข้อความ</span>
                  <span>•</span>
                  <span>กองการศึกษา เทศบาลตำบลท่าทอง</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold">
                  {formData.id ? `แก้ไขรายการ: ${formData.trackingNo || formData.id}` : "บันทึกข้อมูลจัดซื้อจัดจ้างฉบับใหม่"}
                </h2>
                <p className="text-white/80 text-xs sm:text-sm mt-1">
                  กรอกไม่ครบก็สามารถบันทึกร่างไว้ได้ พร้อมระบบคำนวณงบประมาณอัตโนมัติและระบบบีบอัดภาพ 70%
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>ล้างฟอร์ม</span>
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-bold bg-[#FFC300] hover:bg-[#e5b000] text-[#1F1F1F] rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{formData.id ? "อัปเดตข้อมูล" : "บันทึกรายการ (กรอกไม่ครบก็บันทึกได้)"}</span>
                </button>
              </div>
            </div>

            {/* ----------------------------------------------------
                SECTION 1: ข้อมูลเอกสารอ้างอิง
            ---------------------------------------------------- */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-[#2D1457] text-[#FFC300] flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1F1F1F]">ข้อมูลเอกสารอ้างอิง</h3>
                  <p className="text-xs text-slate-500">เลขที่หนังสือ วันที่ และประเภทการจัดหาพัสดุ</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    เลขที่ต้นเรื่อง <span className="text-xs text-slate-400 font-normal">(เว้นว่างได้ ระบบจะสร้างเลขอัตโนมัติ)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น กศ.01/2569 (หรือเว้นว่างได้)"
                    value={formData.trackingNo}
                    onChange={(e) => handleFieldChange("trackingNo", e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#2D1457]/20 focus:border-[#2D1457] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    วันที่ (ปฏิทิน &gt; ข้อความไทย) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={parseThaiToIso(formData.docDate)}
                      onChange={(e) => handleDateChange("docDate", e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>
                  <p className="text-xs text-blue-600 font-medium mt-1">
                    แสดงผลทางการ: <span className="font-semibold">{formData.docDate || "-"}</span>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    เลขที่จัดซื้อ / จ้าง
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น ซ.05/2569"
                    value={formData.procureNo}
                    onChange={(e) => handleFieldChange("procureNo", e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    เลขที่ TOR
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น TOR-05/2569"
                    value={formData.torNo}
                    onChange={(e) => handleFieldChange("torNo", e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    เลขที่ ราคากลาง
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น มก.05/2569"
                    value={formData.medianPriceNo}
                    onChange={(e) => handleFieldChange("medianPriceNo", e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ประเภทการจัดหา (ซื้อ/จ้าง)
                  </label>
                  <select
                    value={formData.procureType}
                    onChange={(e) => handleFieldChange("procureType", e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  >
                    <option value="ซื้อ">ซื้อ</option>
                    <option value="จ้าง">จ้าง</option>
                    <option value="จ้างเหมาบริการ">จ้างเหมาบริการ</option>
                    <option value="จ้างปรับปรุง/ซ่อมแซม">จ้างปรับปรุง/ซ่อมแซม</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ----------------------------------------------------
                SECTION 2: ข้อมูลงบประมาณและโครงการ
            ---------------------------------------------------- */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">ข้อมูลงบประมาณและโครงการ</h3>
                  <p className="text-xs text-slate-500">แผนงาน โครงการ และรายการงบประมาณเทศบาลตำบลท่าทอง</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    แผนงาน
                  </label>
                  <input
                    type="text"
                    value={formData.planName}
                    onChange={(e) => handleFieldChange("planName", e.target.value)}
                    placeholder="เช่น แผนงานการศึกษา"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    งาน
                  </label>
                  <input
                    type="text"
                    value={formData.workName}
                    onChange={(e) => handleFieldChange("workName", e.target.value)}
                    placeholder="เช่น งานระดับก่อนวัยเรียนและประถมศึกษา"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    รายจ่าย
                  </label>
                  <input
                    type="text"
                    value={formData.expenseName}
                    onChange={(e) => handleFieldChange("expenseName", e.target.value)}
                    placeholder="เช่น งบดำเนินงาน"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ประเภทรายจ่าย
                  </label>
                  <input
                    type="text"
                    value={formData.expenseType}
                    onChange={(e) => handleFieldChange("expenseType", e.target.value)}
                    placeholder="เช่น ค่าวัสดุการศึกษา"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ชื่อโครงการ
                  </label>
                  <input
                    type="text"
                    value={formData.projectName}
                    onChange={(e) => handleFieldChange("projectName", e.target.value)}
                    placeholder="เช่น โครงการจัดซื้อสื่อการเรียนการสอนศูนย์พัฒนาเด็กเล็ก"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              {/* Budget Numerics (Highlighted with clear badges) */}
              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-indigo-600" />
                    สถานะงบประมาณ (คำนวณและเน้นสีอัตโนมัติ)
                  </span>
                  <span className="text-xs text-slate-500">หน่วย: บาท</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-2xs">
                    <label className="block text-[11px] font-bold text-blue-700 mb-1">
                      งบเทศ (ตั้งไว้)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.budgetAmount}
                      onChange={(e) => handleFieldChange("budgetAmount", parseFloat(e.target.value) || 0)}
                      className="w-full text-sm font-semibold text-blue-900 bg-blue-50/50 rounded-lg px-2 py-1 border border-blue-200 focus:bg-white"
                    />
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-indigo-200 shadow-2xs">
                    <label className="block text-[11px] font-bold text-indigo-700 mb-1">
                      โอนเพิ่ม
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.transferInAmount}
                      onChange={(e) => handleFieldChange("transferInAmount", parseFloat(e.target.value) || 0)}
                      className="w-full text-sm font-semibold text-indigo-900 bg-indigo-50/50 rounded-lg px-2 py-1 border border-indigo-200 focus:bg-white"
                    />
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs">
                    <label className="block text-[11px] font-bold text-amber-700 mb-1">
                      ผูกพัน
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.committedAmount}
                      onChange={(e) => handleFieldChange("committedAmount", parseFloat(e.target.value) || 0)}
                      className="w-full text-sm font-semibold text-amber-900 bg-amber-50/50 rounded-lg px-2 py-1 border border-amber-200 focus:bg-white"
                    />
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-purple-200 shadow-2xs">
                    <label className="block text-[11px] font-bold text-purple-700 mb-1">
                      เบิกจ่าย
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.disbursedAmount}
                      onChange={(e) => handleFieldChange("disbursedAmount", parseFloat(e.target.value) || 0)}
                      className="w-full text-sm font-semibold text-purple-900 bg-purple-50/50 rounded-lg px-2 py-1 border border-purple-200 focus:bg-white"
                    />
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-rose-200 shadow-2xs">
                    <label className="block text-[11px] font-bold text-rose-700 mb-1">
                      ใช้ไป (ครั้งนี้)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.usedAmount}
                      onChange={(e) => handleFieldChange("usedAmount", parseFloat(e.target.value) || 0)}
                      className="w-full text-sm font-semibold text-rose-900 bg-rose-50/50 rounded-lg px-2 py-1 border border-rose-200 focus:bg-white"
                    />
                  </div>

                  <div className="bg-emerald-500 text-white p-3 rounded-xl shadow-xs">
                    <label className="block text-[11px] font-bold text-emerald-100 mb-1">
                      คงเหลือสุทธิ
                    </label>
                    <div className="text-base font-extrabold tracking-tight">
                      {Number(formData.remainingAmount || 0).toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ----------------------------------------------------
                SECTION 3: ข้อมูลรายการพัสดุ (TOR) & AI
            ---------------------------------------------------- */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-5 border-b border-slate-100 gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      ข้อมูลรายการพัสดุ (TOR) &amp; ระบบช่วยร่างด้วย AI
                    </h3>
                    <p className="text-xs text-slate-500">
                      ตารางรายการพัสดุ พร้อมฟังก์ชัน AI ร่างสเปคเฉพาะ และร่างเหตุผลความจำเป็น
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addTorRow}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>เพิ่มรายการพัสดุ</span>
                </button>
              </div>

              {/* Dynamic Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-2 text-center w-10">ลำดับ</th>
                      <th className="py-3 px-3 min-w-[170px]">รายการพัสดุ/งานจ้าง</th>
                      <th className="py-3 px-3 min-w-[260px]">คุณลักษณะเฉพาะ (Specification)</th>
                      <th className="py-3 px-2 w-20 text-center">จำนวน</th>
                      <th className="py-3 px-2 w-20 text-center">หน่วย</th>
                      <th className="py-3 px-3 w-28 text-right">ราคา/หน่วย</th>
                      <th className="py-3 px-3 w-28 text-right">รวมเป็นเงิน</th>
                      <th className="py-3 px-2 w-12 text-center">ลบ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {formData.torItems.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-2 text-center font-bold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            placeholder="ระบุชื่อพัสดุ..."
                            value={item.name}
                            onChange={(e) => updateTorRow(idx, "name", e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="space-y-1.5">
                            <textarea
                              rows={2}
                              placeholder="คุณลักษณะเฉพาะหรือสเปคพัสดุ..."
                              value={item.spec}
                              onChange={(e) => updateTorRow(idx, "spec", e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 resize-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleGenerateSpec(idx, item.name)}
                              disabled={loadingAI[`spec_${idx}`]}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 shadow-xs transition-all disabled:opacity-50"
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>{loadingAI[`spec_${idx}`] ? "กำลังร่าง..." : "✨ AI ร่างสเปค"}</span>
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateTorRow(idx, "quantity", parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 text-xs text-center bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-2.5 px-2">
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => updateTorRow(idx, "unit", e.target.value)}
                            placeholder="ชุด/ชิ้น"
                            className="w-full px-2 py-1.5 text-xs text-center bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            step="0.01"
                            value={item.pricePerUnit}
                            onChange={(e) => updateTorRow(idx, "pricePerUnit", parseFloat(e.target.value) || 0)}
                            className="w-full px-2.5 py-1.5 text-xs text-right bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 font-medium"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {(item.total || 0).toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeTorRow(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total summary bar */}
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">จำนวนพัสดุ:</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
                    {formData.itemCount} รายการ
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">ยอดรวมราคาจัดซื้อทั้งสิ้น:</span>
                  <span className="text-lg font-extrabold text-blue-900">
                    {Number(formData.purchasePrice || 0).toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    บาท
                  </span>
                </div>
              </div>

              {/* Auto-Formatted Items text preview */}
              <div className="mt-4 p-3 bg-amber-50/60 rounded-xl border border-amber-200/80">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-700" />
                    ข้อความรายการพัสดุจัดรูปแบบอัตโนมัติ (State: items สำหรับพิมพ์เอกสาร / Mail Merge):
                  </label>
                </div>
                <pre className="text-xs font-sans text-amber-950 whitespace-pre-wrap leading-relaxed bg-white/70 p-3 rounded-lg border border-amber-200/60 max-h-36 overflow-y-auto">
                  {formData.items || "ยังไม่มีข้อมูลรายการพัสดุ"}
                </pre>
              </div>

              {/* Big AI Button for Reason & Objective */}
              <div className="mt-5 p-4 sm:p-5 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                  <div>
                    <h4 className="text-sm font-bold text-violet-950 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-violet-600" />
                      AI ร่างเหตุผลความจำเป็นและวัตถุประสงค์ (รวม)
                    </h4>
                    <p className="text-xs text-violet-700 mt-0.5">
                      สังเคราะห์ภาษาทางการกระชับ จากรายการพัสดุในตาราง พร้อมนำคีย์เวิร์ดเพิ่มเติมมาประมวลผลร่วมด้วย
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateReasonAndObjective}
                    disabled={loadingAI.reason_objective}
                    className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {loadingAI.reason_objective
                        ? "AI กำลังสังเคราะห์..."
                        : "✨ ร่างเหตุผล & วัตถุประสงค์ ด้วย AI"}
                    </span>
                  </button>
                </div>

                {/* Optional Keywords Input Field */}
                <div className="mb-4 bg-white/80 p-3 rounded-xl border border-violet-200/80">
                  <label className="block text-xs font-bold text-violet-950 mb-1.5 flex items-center gap-1.5">
                    <span>คีย์เวิร์ด / ประเด็นเพิ่มเติม (ถ้ามี เพื่อนำไปร่วมประมวลผลเป็นภาษาราชการ):</span>
                  </label>
                  <input
                    type="text"
                    value={aiKeywords}
                    onChange={(e) => setAiKeywords(e.target.value)}
                    placeholder="เช่น เพื่อใช้ในกิจกรรมวันเด็กแห่งชาติ, ของเดิมชำรุดเสียหายหนัก, เพื่อให้เป็นไปตามมาตรฐานการศึกษา สพฐ."
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-violet-200 rounded-lg focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-800 placeholder:text-slate-400"
                  />
                  <p className="text-[11px] text-violet-600 mt-1">
                    * ระบุคำสำคัญหรือบริบทความจำเป็นเพิ่มเติม AI จะนำไปเรียบเรียงผสานกับรายการพัสดุเป็นภาษาราชการที่เป็นทางการ
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      1. เหตุผลความจำเป็น (reason)
                    </label>
                    <textarea
                      rows={3}
                      value={formData.reason}
                      onChange={(e) => handleFieldChange("reason", e.target.value)}
                      placeholder="ระบุเหตุผลความจำเป็น..."
                      className="w-full px-3 py-2 text-xs bg-white border border-violet-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      2. วัตถุประสงค์ (objective)
                    </label>
                    <textarea
                      rows={3}
                      value={formData.objective}
                      onChange={(e) => handleFieldChange("objective", e.target.value)}
                      placeholder="ระบุวัตถุประสงค์การจัดซื้อ..."
                      className="w-full px-3 py-2 text-xs bg-white border border-violet-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ----------------------------------------------------
                SECTION 4: การสืบราคา
            ---------------------------------------------------- */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold text-sm">
                  4
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">การสืบราคา</h3>
                  <p className="text-xs text-slate-500">
                    บันทึกข้อมูลราคาสืบจากท้องตลาดหรือผู้ประกอบการ 3 ราย
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                {/* Store 1 */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-cyan-600" />
                    ร้านที่ 1 (สืบราคา)
                  </div>
                  <div className="space-y-2.5">
                    <input
                      type="text"
                      placeholder="ชื่อร้านที่ 1..."
                      value={formData.surveyStore1}
                      onChange={(e) => handleFieldChange("surveyStore1", e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-0.5">ราคาสืบ 1 (บาท)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.surveyPrice1}
                        onChange={(e) => handleFieldChange("surveyPrice1", e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-right font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Store 2 */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-cyan-600" />
                    ร้านที่ 2 (สืบราคา)
                  </div>
                  <div className="space-y-2.5">
                    <input
                      type="text"
                      placeholder="ชื่อร้านที่ 2..."
                      value={formData.surveyStore2}
                      onChange={(e) => handleFieldChange("surveyStore2", e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-0.5">ราคาสืบ 2 (บาท)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.surveyPrice2}
                        onChange={(e) => handleFieldChange("surveyPrice2", e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-right font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Store 3 */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-cyan-600" />
                    ร้านที่ 3 (สืบราคา)
                  </div>
                  <div className="space-y-2.5">
                    <input
                      type="text"
                      placeholder="ชื่อร้านที่ 3..."
                      value={formData.surveyStore3}
                      onChange={(e) => handleFieldChange("surveyStore3", e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-0.5">ราคาสืบ 3 (บาท)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.surveyPrice3}
                        onChange={(e) => handleFieldChange("surveyPrice3", e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-right font-medium"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    วิธีสืบราคา
                  </label>
                  <input
                    type="text"
                    value={formData.surveyMethod}
                    onChange={(e) => handleFieldChange("surveyMethod", e.target.value)}
                    placeholder="เช่น สืบราคาจากท้องตลาด 3 ราย"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    อ้างอิงตามเอกสาร
                  </label>
                  <input
                    type="text"
                    value={formData.surveyDocRef}
                    onChange={(e) => handleFieldChange("surveyDocRef", e.target.value)}
                    placeholder="เช่น ใบเสนอราคาลงวันที่..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ราคาที่อ้างอิง (บาท)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.surveyRefPrice}
                    onChange={(e) => handleFieldChange("surveyRefPrice", e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-right font-medium"
                  />
                </div>
              </div>
            </div>

            {/* ----------------------------------------------------
                SECTION 5: การสั่งซื้อและ e-GP
            ---------------------------------------------------- */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
                  5
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">การสั่งซื้อและระบบ e-GP</h3>
                  <p className="text-xs text-slate-500">
                    ร้านที่ตกลงซื้อ ราคาที่ซื้อ การแปลงอักษรราคา และเลขคุม e-GP
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ร้านที่ซื้อ / จ้าง <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ชื่อร้านหรือผู้ประกอบการที่ซื้อ..."
                    value={formData.purchaseStore}
                    onChange={(e) => handleFieldChange("purchaseStore", e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ราคาที่ซื้อ (ดึงจากตาราง TOR อัตโนมัติ)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.purchasePrice}
                    onChange={(e) => handleFieldChange("purchasePrice", parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 text-sm bg-blue-50/50 border border-blue-200 text-blue-900 font-bold rounded-xl focus:bg-white text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    อักษรราคา (Thai Baht Text แปลงอัตโนมัติ)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={formData.purchasePriceText}
                    className="w-full px-3.5 py-2 text-sm bg-slate-100 border border-slate-200 text-slate-800 font-semibold rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ขอซื้อ EGP (เลขคุมโครงการ)
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น EGP-6905001"
                    value={formData.egpRequestNo}
                    onChange={(e) => handleFieldChange("egpRequestNo", e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    วันที่ ขอซื้อ EGP (ปฏิทิน &gt; ข้อความไทย)
                  </label>
                  <input
                    type="date"
                    value={parseThaiToIso(formData.egpRequestDate)}
                    onChange={(e) => handleDateChange("egpRequestDate", e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                  <span className="text-xs text-slate-500 mt-1 block">
                    ค่าที่จัดเก็บ: {formData.egpRequestDate || "-"}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ใบสั่งซื้อ / จ้าง (PO Number)
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น PO-69/001"
                    value={formData.poNumber}
                    onChange={(e) => handleFieldChange("poNumber", e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    วันที่สั่ง (ปฏิทิน &gt; ข้อความไทย)
                  </label>
                  <input
                    type="date"
                    value={parseThaiToIso(formData.poDate)}
                    onChange={(e) => handleDateChange("poDate", e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                  <span className="text-xs text-slate-500 mt-1 block">
                    ค่าที่จัดเก็บ: {formData.poDate || "-"}
                  </span>
                </div>
              </div>
            </div>

            {/* ----------------------------------------------------
                SECTION 6: การส่งมอบและตรวจรับ
            ---------------------------------------------------- */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">
                  6
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">การส่งมอบและตรวจรับ</h3>
                  <p className="text-xs text-slate-500">กำหนดระยะเวลา ผู้ตรวจรับ และเอกสารการส่งของ</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    กำหนดส่ง (จำนวนวันส่ง)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      placeholder="เช่น 7"
                      value={formData.deliveryDays}
                      onChange={(e) => handleFieldChange("deliveryDays", e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white pr-10"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-500 font-medium">วัน</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ผู้ตรวจรับ
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น นางสาวสมใจ รักเรียน"
                    value={formData.inspectorName}
                    onChange={(e) => handleFieldChange("inspectorName", e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ตำแหน่งผู้ตรวจรับ
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น ผู้อำนวยการกองการศึกษา"
                    value={formData.inspectorPosition}
                    onChange={(e) => handleFieldChange("inspectorPosition", e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    เอกสารส่ง (เช่น ใบส่งของ)
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น ใบส่งของ / ใบกำกับภาษี"
                    value={formData.deliveryDocType}
                    onChange={(e) => handleFieldChange("deliveryDocType", e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    เลขที่บิล / ใบส่งของ
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น INV-69/0123"
                    value={formData.invoiceNo}
                    onChange={(e) => handleFieldChange("invoiceNo", e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    วันที่ส่ง (ปฏิทิน &gt; ข้อความไทย)
                  </label>
                  <input
                    type="date"
                    value={parseThaiToIso(formData.deliveryDate)}
                    onChange={(e) => handleDateChange("deliveryDate", e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                  <span className="text-xs text-slate-500 mt-1 block">
                    ค่าที่จัดเก็บ: {formData.deliveryDate || "-"}
                  </span>
                </div>
              </div>
            </div>

            {/* ----------------------------------------------------
                SECTION 7: ภาคผนวก (รูปภาพประกอบ)
            ---------------------------------------------------- */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100 flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#2D1457] text-[#FFC300] flex items-center justify-center font-bold text-sm">
                    7
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1F1F1F]">ภาคผนวก (รูปภาพประกอบ)</h3>
                    <p className="text-xs text-slate-500">
                      บีบอัดอัตโนมัติ Auto Compress ลดคุณภาพไฟล์เหลือ 70% (.jpg) และอัปโหลดทันที (Instant Upload)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setPhotoManagerRecord(formData)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2D1457] hover:bg-[#3d1c75] text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                  >
                    <Camera className="w-3.5 h-3.5 text-[#FFC300]" />
                    <span>📸 จัดการรูปภาพในระบบ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShareModalRecord(formData)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFC300] hover:bg-[#e5b000] text-[#1F1F1F] text-xs font-bold rounded-xl transition-all shadow-xs"
                  >
                    <Share2 className="w-3.5 h-3.5 text-[#1F1F1F]" />
                    <span>🔗 แชร์ให้กรรมการตรวจรับ</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Image 1 */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-[#1F1F1F] flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-[#2D1457]" />
                      รูปภาพประกอบที่ 1 (ภาพส่งมอบ / พัสดุ)
                    </span>
                    {formData.image1 && (
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, image1: "" }))}
                        className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ลบรูปภาพ</span>
                      </button>
                    )}
                  </div>

                  {formData.image1 ? (
                    <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-white aspect-video flex items-center justify-center">
                      <img
                        src={formData.image1}
                        alt="ภาคผนวก 1"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef1.current?.click()}
                      className="cursor-pointer border-2 border-dashed border-slate-300 hover:border-[#2D1457] rounded-xl p-6 text-center bg-white/70 hover:bg-[#2D1457]/5 transition-colors"
                    >
                      <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                      <p className="text-xs font-bold text-slate-700">คลิกหรือลากไฟล์ภาพมาที่นี่</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">บีบอัดอัตโนมัติ 70% (.jpg) ทันที</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef1}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleImageUpload(e.target.files[0], "image1");
                      }
                    }}
                  />
                </div>

                {/* Image 2 */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-[#1F1F1F] flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-[#2D1457]" />
                      รูปภาพประกอบที่ 2 (ตรวจรับ / สถานที่จริง)
                    </span>
                    {formData.image2 && (
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, image2: "" }))}
                        className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ลบรูปภาพ</span>
                      </button>
                    )}
                  </div>

                  {formData.image2 ? (
                    <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-white aspect-video flex items-center justify-center">
                      <img
                        src={formData.image2}
                        alt="ภาคผนวก 2"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef2.current?.click()}
                      className="cursor-pointer border-2 border-dashed border-slate-300 hover:border-[#2D1457] rounded-xl p-6 text-center bg-white/70 hover:bg-[#2D1457]/5 transition-colors"
                    >
                      <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                      <p className="text-xs font-bold text-slate-700">คลิกหรือลากไฟล์ภาพมาที่นี่</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">บีบอัดอัตโนมัติ 70% (.jpg) ทันที</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef2}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleImageUpload(e.target.files[0], "image2");
                      }
                    }}
                  />
                </div>
              </div>

              {/* PDF Photo Appendix Export button in Section 7 */}
              <div className="mt-5 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-purple-50/50 p-4 rounded-xl border border-purple-200/60">
                <div>
                  <h4 className="text-xs font-bold text-[#2D1457] flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#2D1457]" />
                    เอกสารภาคผนวกรูปภาพประกอบ (สำหรับพิมพ์ / ส่งออก PDF)
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    มีหัวกระดาษระบุข้อมูลการจัดซื้อจัดจ้าง และช่องลงนามผู้ตรวจรับพัสดุทุกหน้าตามระเบียบ
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPdfPreviewRecord(formData)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FFC300] hover:bg-[#e5b000] text-[#1F1F1F] text-xs font-bold rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>ส่งออก / พิมพ์ PDF ภาคผนวกรูปภาพ</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* ==========================================
             TAB 2: LIST VIEW & EXPORT
          ========================================== */
          <div className="space-y-6">
            {/* Hidden Import Input */}
            <input
              ref={importFileInputRef}
              type="file"
              accept=".json,.csv"
              className="hidden"
              onChange={handleImportFile}
            />

            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-[#1F1F1F]">
                    รายการจัดซื้อจัดจ้างทั้งหมด (กองการศึกษา เทศบาลตำบลท่าทอง)
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    มีข้อมูลทั้งหมด {records.length} รายการ พร้อมระบบจัดการรูปภาพ, ส่งออก Excel/CSV และแชร์ตรวจรับ
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* 1. Import Data Button */}
                  <button
                    type="button"
                    onClick={() => importFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 transition-colors cursor-pointer"
                    title="นำเข้าข้อมูลจากไฟล์ JSON สำรอง หรือไฟล์ CSV"
                  >
                    <Upload className="w-4 h-4 text-slate-600" />
                    <span>📥 นำเข้าข้อมูล (Import)</span>
                  </button>

                  {/* 2. Export Excel (.xls) */}
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                    title="ส่งออกไฟล์ Excel (.xls) ภาษาไทยสมบูรณ์"
                  >
                    <Table className="w-4 h-4" />
                    <span>📊 ส่งออก Excel</span>
                  </button>

                  {/* 3. Export CSV (Mail Merge) */}
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#2D1457] hover:bg-[#3d1c75] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                    title="ส่งออกไฟล์ CSV 43 คอลัมน์สำหรับ Mail Merge"
                  >
                    <Download className="w-4 h-4 text-[#FFC300]" />
                    <span>📄 ส่งออก CSV (Mail Merge)</span>
                  </button>

                  {/* 4. Google Sheets */}
                  {googleUser ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleTriggerExportSheet}
                        disabled={isExportingSheet}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
                        title="ส่งออกไปยัง Google Sheets"
                      >
                        {isExportingSheet ? <Loader2 className="w-4 h-4 animate-spin" /> : <Table className="w-4 h-4" />}
                        <span>{isExportingSheet ? "ส่งออก..." : "Google Sheets"}</span>
                      </button>

                      {lastExportedSheetUrl && (
                        <a
                          href={lastExportedSheetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl transition-colors"
                          title="เปิดดูชีต"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isSigningInGoogle}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs sm:text-sm font-medium rounded-xl transition-colors disabled:opacity-60 cursor-pointer"
                      title="เข้าสู่ระบบ Google เพื่อเชื่อมโยง Sheets"
                    >
                      <Table className="w-4 h-4 text-emerald-600" />
                      <span>Google Sheets</span>
                    </button>
                  )}

                  {/* 5. Create New Record CTA */}
                  <button
                    type="button"
                    onClick={() => {
                      handleResetForm();
                      setActiveTab("form");
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FFC300] hover:bg-[#e5b000] text-[#1F1F1F] text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>สร้างรายการใหม่</span>
                  </button>
                </div>
              </div>

              {/* Search & Filter Controls */}
              <div className="mt-4 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="พิมพ์ชื่อร้าน หรือชื่อประเภทของ (เช่น วัสดุก่อสร้าง, วัสดุการเกษตร, ค่าจ้าง)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#2D1457]/20 focus:border-[#2D1457]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-slate-500" />
                    <select
                      value={filterProcureType}
                      onChange={(e) => setFilterProcureType(e.target.value)}
                      className="px-2.5 py-1.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#2D1457]/20 focus:border-[#2D1457] text-slate-700 font-medium"
                    >
                      <option value="all">ทุกประเภทการจัดซื้อ</option>
                      <option value="ซื้อ">ซื้อ</option>
                      <option value="จ้าง">จ้าง</option>
                      <option value="จ้างเหมาบริการ">จ้างเหมาบริการ</option>
                      <option value="จ้างก่อสร้าง">จ้างก่อสร้าง</option>
                      <option value="เช่า">เช่า</option>
                      <option value="อื่นๆ">อื่นๆ</option>
                    </select>
                  </div>

                  {(searchTerm || filterProcureType !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm("");
                        setFilterProcureType("all");
                      }}
                      className="px-2 py-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors font-medium flex items-center gap-1 whitespace-nowrap"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>ล้างตัวกรอง</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Table Result Counter */}
              <div className="mb-2 flex items-center justify-between text-xs text-slate-500 px-1">
                <span>
                  พบ <strong className="text-[#1F1F1F] font-bold">{filteredRecords.length}</strong> รายการ จากทั้งหมด {records.length} รายการ
                </span>
                {filterProcureType !== "all" && (
                  <span className="text-[#2D1457] font-semibold">
                    กรองเฉพาะประเภท: {filterProcureType}
                  </span>
                )}
              </div>

              {/* Records Table - Layout: ร้าน, หัวข้อ, ราคาที่ซื้อ, จัดการ */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#2D1457] text-white font-bold border-b border-[#44207f]">
                    <tr>
                      <th className="py-3 px-4 w-[24%]">ร้าน</th>
                      <th className="py-3 px-4 w-[38%]">หัวข้อ</th>
                      <th className="py-3 px-4 text-right w-[18%]">ราคาที่ซื้อ (บาท)</th>
                      <th className="py-3 px-4 text-center w-[20%]">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-slate-400 text-sm">
                          ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50/90 transition-colors">
                          {/* 1. ร้าน */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-bold text-[#1F1F1F] text-sm">
                              {rec.purchaseStore || "-"}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              เลขที่: <span className="font-medium text-slate-700">{rec.trackingNo || "-"}</span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              วันที่: {rec.docDate || "-"}
                            </div>
                          </td>

                          {/* 2. หัวข้อ (Auto formatted topic + details) */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-semibold text-[#2D1457] text-xs sm:text-sm leading-snug">
                              {formatTopicTitle(rec)}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              <span className="px-2 py-0.5 rounded-md bg-purple-50 text-[#2D1457] font-semibold text-[11px] border border-purple-200">
                                {rec.procureType || "ซื้อ"}
                              </span>
                              {rec.expenseType && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 font-medium text-[11px] border border-amber-200">
                                  {rec.expenseType}
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px]">
                                {rec.itemCount || rec.torItems?.length || 1} รายการ
                              </span>
                              {rec.inspectorName && (
                                <span className="text-[11px] text-slate-500 ml-1">
                                  ผู้ตรวจ: {rec.inspectorName}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 3. ราคาที่ซื้อ */}
                          <td className="py-3.5 px-4 text-right align-top whitespace-nowrap">
                            <div className="font-bold text-[#1F1F1F] text-sm sm:text-base">
                              {Number(rec.purchasePrice || 0).toLocaleString("th-TH", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                            <div className="text-[11px] text-slate-500 italic mt-0.5">
                              {rec.purchasePriceText || ""}
                            </div>
                          </td>

                          {/* 4. จัดการ (📸 จัดการรูปภาพ, 🖨️ PDF, 🔗 แชร์, ✏️ แก้ไข, 🗑️ ลบ) */}
                          <td className="py-3.5 px-4 text-center align-top whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                              {/* 📸 จัดการรูปภาพ */}
                              <button
                                type="button"
                                onClick={() => setPhotoManagerRecord(rec)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#2D1457] hover:bg-[#3d1c75] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                                title="📸 จัดการรูปภาพในระบบ (เพิ่มรูป / ระบุชื่อรายการและจำนวน)"
                              >
                                <Camera className="w-3.5 h-3.5 text-[#FFC300]" />
                                <span>รูปภาพ</span>
                              </button>

                              {/* 🖨️ พิมพ์ / ส่งออก PDF */}
                              <button
                                type="button"
                                onClick={() => setPdfPreviewRecord(rec)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                                title="🖨️ พิมพ์ / ส่งออก PDF ภาคผนวกรูปภาพ"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>PDF</span>
                              </button>

                              {/* 🔗 แชร์ให้กรรมการตรวจรับ */}
                              <button
                                type="button"
                                onClick={() => setShareModalRecord(rec)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#FFC300] hover:bg-[#e5b000] text-[#1F1F1F] text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                                title="🔗 แชร์ลิงก์ให้กรรมการตรวจรับพัสดุถ่ายภาพหน้างาน"
                              >
                                <Share2 className="w-3.5 h-3.5 text-[#1F1F1F]" />
                                <span>แชร์</span>
                              </button>

                              {/* ✏️ แก้ไข */}
                              <button
                                type="button"
                                onClick={() => handleEditRecord(rec)}
                                className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="แก้ไขข้อมูล"
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              {/* 🗑️ ลบ */}
                              <button
                                type="button"
                                onClick={() => handleDeleteRecord(rec.id)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="ลบรายการนี้"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ==========================================
          STICKY FOOTER FOR SAVE / RESET
      ========================================== */}
      {activeTab === "form" && (
        <footer className="fixed bottom-0 left-0 right-0 z-40 bg-[#2D1457] text-white border-t border-[#44207f] py-3 shadow-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <div className="hidden sm:flex items-center gap-3 text-xs text-white/80">
              <span className="font-semibold text-white">
                เลขที่: {formData.trackingNo || "(จะสร้างเลขอัตโนมัติ)"}
              </span>
              <span>•</span>
              <span>
                ยอดจัดซื้อ:{" "}
                <strong className="text-[#FFC300] text-sm">
                  {Number(formData.purchasePrice || 0).toLocaleString("th-TH", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  บาท
                </strong>
              </span>
              <span>•</span>
              <span className="text-[#FFC300]/90 italic truncate max-w-xs">
                ({formData.purchasePriceText || "ศูนย์บาทถ้วน"})
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                ล้างฟอร์ม
              </button>
              <button
                type="button"
                onClick={() => handleSaveForm()}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#FFC300] hover:bg-[#e5b000] text-[#1F1F1F] text-xs sm:text-sm font-bold rounded-xl shadow-lg transition-all cursor-pointer"
              >
                <Save className="w-4 h-4 text-[#1F1F1F]" />
                <span>{formData.id ? "บันทึกการแก้ไข" : "บันทึกข้อมูลจัดซื้อ (กรอกไม่ครบก็บันทึกได้)"}</span>
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* ==========================================
          CONFIRMATION MODAL FOR GOOGLE SHEETS
      ========================================== */}
      {showConfirmSheetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Table className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  ยืนยันการส่งออกไปยัง Google Sheets
                </h3>
                <p className="text-xs text-slate-500">
                  ระบบจะสร้างสเปรดชีตใหม่ใน Google Drive บัญชีของคุณ
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 mb-5 space-y-2 text-xs text-slate-600 border border-slate-200">
              <div className="flex justify-between">
                <span>บัญชี Google:</span>
                <span className="font-semibold text-slate-800">{googleUser?.email}</span>
              </div>
              <div className="flex justify-between">
                <span>จำนวนรายการที่จะส่งออก:</span>
                <span className="font-semibold text-slate-800">{records.length} รายการ</span>
              </div>
              <div className="flex justify-between">
                <span>โครงสร้างคอลัมน์:</span>
                <span className="font-semibold text-slate-800">43 คอลัมน์ (พร้อมใช้งาน Mail Merge)</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmSheetModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmExportSheet}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Table className="w-4 h-4" />
                <span>ยืนยันสร้างและส่งออก</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 1: IMAGE MANAGER (📸 จัดการรูปภาพในระบบ)
      ========================================== */}
      {photoManagerRecord && (
        <ImageManagerModal
          record={photoManagerRecord}
          onClose={() => setPhotoManagerRecord(null)}
          onOpenPdf={(rec) => setPdfPreviewRecord(rec)}
          onUpdateRecord={(updated) => {
            setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            if (formData.id === updated.id) {
              setFormData(updated);
            }
          }}
          showToast={showToast}
        />
      )}

      {/* ==========================================
          MODAL 2: SHARE FOR COMMITTEE (🔗 แชร์ให้กรรมการตรวจรับ)
      ========================================== */}
      {shareModalRecord && (
        <ShareModal
          record={shareModalRecord}
          onClose={() => setShareModalRecord(null)}
          onOpenInspectorView={(rec) => setCommitteeRecord(rec)}
          showToast={showToast}
        />
      )}

      {/* ==========================================
          MODAL 3: PDF APPENDIX PREVIEW & EXPORT (🖨️ PDF ภาคผนวก)
      ========================================== */}
      {pdfPreviewRecord && (
        <PdfAppendixModal
          record={pdfPreviewRecord}
          onClose={() => setPdfPreviewRecord(null)}
          showToast={showToast}
        />
      )}
    </div>
  );
}
