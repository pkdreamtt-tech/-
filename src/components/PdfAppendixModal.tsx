import React, { useEffect, useState } from "react";
import { X, Printer, FileDown, Share2, ImageIcon } from "lucide-react";
import { ProcurementRecord } from "../types";
import { formatTopicTitle } from "../utils/excelExport";
import { getImagesByRecordId, StoredImage } from "../imageStorage";

interface PdfAppendixModalProps {
  record: ProcurementRecord;
  onClose: () => void;
  onShare?: (rec: ProcurementRecord) => void;
  showToast: (type: "success" | "error", msg: string) => void;
}

export function PdfAppendixModal({
  record,
  onClose,
  onShare,
  showToast,
}: PdfAppendixModalProps) {
  const [images, setImages] = useState<StoredImage[]>([]);
  const [loading, setLoading] = useState(true);

  // Load photos from IndexedDB image storage + legacy record image fields
  useEffect(() => {
    let isMounted = true;
    async function loadPhotos() {
      setLoading(true);
      try {
        const stored = await getImagesByRecordId(record.id);
        const combined: StoredImage[] = [...stored];

        // If no stored images in IndexedDB yet, check if legacy image1 or image2 exists
        if (combined.length === 0) {
          if (record.image1) {
            combined.push({
              id: "legacy_1",
              recordId: record.id,
              dataUrl: record.image1,
              itemName: record.items?.split("\n")[0] || "",
              quantity: String(record.itemCount || 1),
              caption: "ภาพถ่ายพัสดุ / การส่งมอบและตรวจรับพัสดุตามสัญญา",
              createdAt: 1,
            });
          }
          if (record.image2) {
            combined.push({
              id: "legacy_2",
              recordId: record.id,
              dataUrl: record.image2,
              itemName: "",
              quantity: "",
              caption: "ภาพถ่ายการตรวจสอบพัสดุและสถานที่ดำเนินงานจริง",
              createdAt: 2,
            });
          }
        }

        if (isMounted) {
          setImages(combined);
        }
      } catch (err) {
        console.error("Error loading images for PDF:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPhotos();
    return () => {
      isMounted = false;
    };
  }, [record]);

  // Format header line 2: clean topic without prefixes like 'พัสดุ' or 'โครงการ'
  // e.g. "วัสดุก่อสร้าง จำนวน 21 รายการ" หรือ "วัสดุการเกษตร จำนวน 1 รายการ"
  const headerTopic = formatTopicTitle(record);

  // Download standalone HTML version
  const handleDownloadHtml = () => {
    const photoList =
      images.length > 0
        ? images
        : [
            {
              id: "empty",
              recordId: record.id,
              dataUrl: "",
              itemName: "",
              quantity: "",
              caption: "ยังไม่มีรูปภาพประกอบในระบบ",
              createdAt: 0,
            },
          ];

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>ภาคผนวกรูปภาพประกอบ - ${headerTopic}</title>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 15mm 15mm 15mm 15mm; }
    body { font-family: 'Sarabun', sans-serif; margin: 0; padding: 0; color: #111; background: #fff; }
    .page { page-break-after: always; min-height: 270mm; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; padding: 10px; }
    .page:last-child { page-break-after: auto; }
    .header { text-align: center; border-bottom: 2px solid #2D1457; padding-bottom: 12px; margin-bottom: 20px; }
    .header h2 { margin: 0 0 6px; font-size: 22px; font-weight: 700; color: #2D1457; }
    .header h3 { margin: 0 0 6px; font-size: 18px; font-weight: 600; }
    .header p { margin: 0; font-size: 14px; color: #333; }
    .img-container { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 140mm; }
    .img-container img { max-width: 100%; max-height: 145mm; object-fit: contain; border: 1px solid #cbd5e1; border-radius: 6px; }
    .img-caption { margin-top: 14px; font-size: 15px; font-weight: 600; color: #222; text-align: center; }
    .img-subcaption { margin-top: 4px; font-size: 13px; color: #555; text-align: center; }
    .signature-box { margin-top: 25px; padding-top: 18px; border-top: 1px solid #94a3b8; text-align: right; font-size: 14px; line-height: 1.9; }
    .sign-inner { display: inline-block; text-align: center; min-width: 290px; }
  </style>
</head>
<body>
  ${photoList
    .map(
      (img, idx) => `
    <div class="page">
      <div>
        <div class="header">
          <h2>ภาคผนวก</h2>
          <h3>รูปภาพประกอบการจัดซื้อจัดจ้าง</h3>
          <h3 style="font-weight: 700; color: #111;">${headerTopic}</h3>
          <p>กองการศึกษา เทศบาลตำบลท่าทอง อำเภอเมืองพิษณุโลก จังหวัดพิษณุโลก</p>
        </div>
      </div>

      <div class="img-container">
        ${
          img.dataUrl
            ? `<img src="${img.dataUrl}" alt="รูปภาพประกอบ">`
            : `<div style="padding: 50px; border: 2px dashed #94a3b8; border-radius: 8px; color: #64748b;">(ไม่มีรูปภาพประกอบ)</div>`
        }
        <div class="img-caption">
          รูปภาพที่ ${idx + 1}${img.itemName ? `: ${img.itemName}` : ""}${
        img.quantity ? ` (จำนวน ${img.quantity})` : ""
      }
        </div>
        ${
          img.caption && img.caption !== img.itemName
            ? `<div class="img-subcaption">${img.caption}</div>`
            : ""
        }
      </div>

      <div class="signature-box">
        <div class="sign-inner">
          <div>(ลงชื่อ)............................................................................ ผู้ตรวจรับพัสดุ</div>
          <div style="margin-top: 4px;">( ${
            record.inspectorName ||
            "..........................................................................."
          } )</div>
          <div>ตำแหน่ง ${
            record.inspectorPosition ||
            "..........................................................................."
          }</div>
          <div>วันที่ ............ เดือน ................................... พ.ศ. ...............</div>
        </div>
      </div>
    </div>
  `
    )
    .join("")}
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ภาคผนวกรูปภาพ_${record.purchaseStore || "พัสดุ"}_${new Date()
      .toISOString()
      .slice(0, 10)}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("success", "ดาวน์โหลดเอกสารภาคผนวกรูปภาพเรียบร้อยแล้ว");
  };

  const photoList =
    images.length > 0
      ? images
      : [
          {
            id: "empty",
            recordId: record.id,
            dataUrl: "",
            itemName: "",
            quantity: "",
            caption: "(ยังไม่มีรูปภาพในระบบ สามารถกดปุ่มจัดการรูปภาพเพื่อแนบรูป)",
            createdAt: 0,
          },
        ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 animate-in fade-in">
      <div className="bg-[#F8F9FA] rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[94vh] overflow-hidden border border-[#2D1457]/20">
        {/* Top Action Toolbar (no-print) */}
        <div className="no-print bg-[#2D1457] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-[#44207f]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FFC300] text-[#1F1F1F] flex items-center justify-center font-bold">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                ภาคผนวกรูปภาพประกอบการตรวจรับพัสดุ
              </h3>
              <p className="text-xs text-[#FFC300] font-medium">
                {headerTopic} • มีช่องลงนามผู้ตรวจรับพัสดุทุกหน้าตามระเบียบ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Share to committee button */}
            {onShare && (
              <button
                type="button"
                onClick={() => onShare(record)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/20 cursor-pointer"
                title="แชร์ให้กรรมการแนบรูปใส่ชื่อรายการและจำนวน"
              >
                <Share2 className="w-3.5 h-3.5 text-[#FFC300]" />
                <span>แชร์ให้กรรมการ</span>
              </button>
            )}

            {/* Download HTML */}
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/20"
              title="ดาวน์โหลดไฟล์เอกสาร HTML สำหรับเปิดพิมพ์ออฟไลน์"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>ดาวน์โหลด HTML</span>
            </button>

            {/* Print / Save as PDF Button (High contrast yellow) */}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-[#1F1F1F] bg-[#FFC300] hover:bg-[#e5b000] rounded-lg shadow-md transition-colors"
              title="พิมพ์เอกสารออกเครื่องพิมพ์ หรือบันทึกเป็น PDF"
            >
              <Printer className="w-4 h-4 text-[#1F1F1F]" />
              <span>พิมพ์ / บันทึก PDF</span>
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              title="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200/80">
          <div
            id="printable-appendix"
            className="max-w-[210mm] mx-auto bg-white text-[#1F1F1F] shadow-lg print:shadow-none p-6 sm:p-10 font-sans"
          >
            {loading ? (
              <div className="py-20 text-center text-slate-500">
                กำลังโหลดรูปภาพประกอบ...
              </div>
            ) : (
              photoList.map((img, pageIndex) => (
                <div
                  key={img.id || pageIndex}
                  className={`min-h-[265mm] flex flex-col justify-between ${
                    pageIndex < photoList.length - 1
                      ? "page-break pb-12 mb-12 border-b-2 border-dashed border-slate-300 print:border-none print:pb-0 print:mb-0"
                      : ""
                  }`}
                >
                  {/* 1. Official Header: Strictly no project name, no meta table */}
                  <div>
                    <div className="text-center pb-3 border-b-2 border-[#2D1457]">
                      <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#2D1457] mb-1">
                        ภาคผนวก
                      </h2>
                      <h3 className="text-base sm:text-lg font-bold text-[#1F1F1F] mb-1">
                        รูปภาพประกอบการจัดซื้อจัดจ้าง
                      </h3>
                      <h4 className="text-base sm:text-lg font-bold text-[#1F1F1F] mb-1">
                        {headerTopic}
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-600">
                        กองการศึกษา เทศบาลตำบลท่าทอง อำเภอเมืองพิษณุโลก จังหวัดพิษณุโลก
                      </p>
                    </div>
                  </div>

                  {/* 2. Photo Display Container */}
                  <div className="my-auto py-4 flex flex-col items-center justify-center">
                    {img.dataUrl ? (
                      <div className="w-full flex justify-center bg-white p-2 border border-slate-300 rounded-xl shadow-xs">
                        <img
                          src={img.dataUrl}
                          alt="รูปภาพประกอบการตรวจรับ"
                          className="max-h-[420px] max-w-full object-contain rounded-lg"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-64 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                        <ImageIcon className="w-12 h-12 mb-2 stroke-1 text-slate-400" />
                        <p className="text-xs">{img.caption}</p>
                      </div>
                    )}

                    <p className="mt-3 text-sm sm:text-base font-bold text-[#1F1F1F] text-center">
                      รูปภาพที่ {pageIndex + 1}
                      {img.itemName ? `: ${img.itemName}` : ""}
                      {img.quantity ? ` (จำนวน ${img.quantity})` : ""}
                    </p>
                    {img.caption && img.caption !== img.itemName && (
                      <p className="text-xs sm:text-sm text-slate-600 text-center mt-1">
                        {img.caption}
                      </p>
                    )}
                  </div>

                  {/* 3. Mandatory Inspector Signature Block (Every single page) */}
                  <div className="pt-4 border-t border-slate-300 mt-6">
                    <div className="flex justify-end">
                      <div className="text-center min-w-[290px] text-xs sm:text-sm leading-relaxed text-[#1F1F1F]">
                        <div className="mb-2">
                          (ลงชื่อ)............................................................................
                          ผู้ตรวจรับพัสดุ
                        </div>
                        <div className="mb-1 font-medium">
                          (&nbsp;
                          {record.inspectorName ||
                            "..........................................................................."}
                          &nbsp;)
                        </div>
                        <div className="mb-1 text-slate-700">
                          ตำแหน่ง{" "}
                          {record.inspectorPosition ||
                            "..........................................................................."}
                        </div>
                        <div className="text-slate-600">
                          วันที่ ............ เดือน
                          ................................... พ.ศ. ...............
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
