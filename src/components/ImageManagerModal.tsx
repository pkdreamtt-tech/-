import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Upload,
  Trash2,
  Share2,
  Printer,
  Plus,
  Image as ImageIcon,
  Check,
  Loader2,
  Camera,
  Layers,
} from "lucide-react";
import { ProcurementRecord } from "../types";
import { formatTopicTitle } from "../utils/excelExport";
import {
  compressImageToJpeg,
  saveImageToStore,
  getImagesByRecordId,
  deleteImageFromStore,
  updateImageMeta,
  StoredImage,
} from "../imageStorage";

interface ImageManagerModalProps {
  record: ProcurementRecord;
  onClose: () => void;
  onOpenPdf: (rec: ProcurementRecord) => void;
  onShare?: (rec: ProcurementRecord) => void;
  onUpdateRecord?: (rec: ProcurementRecord) => void;
  showToast: (type: "success" | "error", msg: string) => void;
}

export function ImageManagerModal({
  record,
  onClose,
  onOpenPdf,
  onShare,
  onUpdateRecord,
  showToast,
}: ImageManagerModalProps) {
  const [images, setImages] = useState<StoredImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const topicTitle = formatTopicTitle(record);

  // Load existing photos from IndexedDB + migrate legacy images if needed
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        let stored = await getImagesByRecordId(record.id);

        // Migrate legacy image1 & image2 if IndexedDB is empty for this record
        if (stored.length === 0) {
          if (record.image1) {
            const img1 = await saveImageToStore(
              record.id,
              record.image1,
              record.items?.split("\n")[0] || "",
              String(record.itemCount || 1),
              "ภาพถ่ายพัสดุ / การส่งมอบและตรวจรับพัสดุตามสัญญา"
            );
            stored.push(img1);
          }
          if (record.image2) {
            const img2 = await saveImageToStore(
              record.id,
              record.image2,
              "",
              "",
              "ภาพถ่ายการตรวจสอบพัสดุและสถานที่ดำเนินงานจริง"
            );
            stored.push(img2);
          }
        }

        if (isMounted) {
          setImages(stored);
        }
      } catch (err) {
        console.error("Error loading images:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [record]);

  // Instant upload with Auto-Compress to 70% quality .jpg
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const defaultItemName =
        record.torItems && record.torItems.length > 0
          ? record.torItems[0].name
          : "";
      const defaultQty =
        record.torItems && record.torItems.length > 0
          ? `${record.torItems[0].quantity} ${record.torItems[0].unit || "ชิ้น"}`
          : "";

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Auto-compress 70% JPEG
        const compressedJpeg = await compressImageToJpeg(file, 0.7);

        // Instant upload to IndexedDB
        const saved = await saveImageToStore(
          record.id,
          compressedJpeg,
          defaultItemName,
          defaultQty,
          `รูปภาพที่ ${images.length + i + 1}`
        );
        setImages((prev) => [...prev, saved]);
      }

      showToast(
        "success",
        `บีบอัด 70% (.jpg) และอัปโหลดรูปภาพสำเร็จ (${files.length} รูป)`
      );
    } catch (err) {
      console.error("Error uploading image:", err);
      showToast("error", "เกิดข้อผิดพลาดในการประมวลผลรูปภาพ");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Update item metadata
  const handleMetaChange = async (
    id: string,
    field: "itemName" | "quantity" | "caption",
    value: string
  ) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, [field]: value } : img))
    );
    try {
      await updateImageMeta(id, { [field]: value });
    } catch (err) {
      console.error("Error updating image meta:", err);
    }
  };

  // Delete an image
  const handleDelete = async (id: string) => {
    if (!window.confirm("ยืนยันการลบรูปภาพนี้หรือไม่?")) return;
    try {
      await deleteImageFromStore(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
      showToast("success", "ลบรูปภาพเรียบร้อยแล้ว");
    } catch (err) {
      console.error("Error deleting image:", err);
      showToast("error", "เกิดข้อผิดพลาดในการลบรูปภาพ");
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
      <div className="bg-[#F8F9FA] rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden border border-[#2D1457]/30">
        {/* Top Header */}
        <div className="bg-[#2D1457] text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-[#44207f]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFC300] text-[#1F1F1F] flex items-center justify-center font-bold shadow-md">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  จัดการรูปภาพประกอบการตรวจรับพัสดุ
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-[#FFC300] text-[#1F1F1F] text-xs font-bold">
                  {images.length} รูป
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                ร้านค้า: <strong className="text-white">{record.purchaseStore || "-"}</strong> • {topicTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Share to committee button */}
            {onShare && (
              <button
                type="button"
                onClick={() => onShare(record)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/20"
                title="แชร์ลิงก์ให้กรรมการแนบรูปใส่ชื่อรายการและจำนวน"
              >
                <Share2 className="w-3.5 h-3.5 text-[#FFC300]" />
                <span>แชร์ให้กรรมการ</span>
              </button>
            )}

            {/* View PDF Appendix */}
            <button
              type="button"
              onClick={() => onOpenPdf(record)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#1F1F1F] bg-[#FFC300] hover:bg-[#e5b000] rounded-lg shadow-md transition-colors"
              title="ดูและพิมพ์เอกสารภาคผนวกรูปภาพ PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>ดูเอกสาร PDF</span>
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              title="ปิด"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Callout Bar */}
        <div className="bg-[#2D1457]/5 border-b border-[#2D1457]/10 px-5 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-[#1F1F1F] leading-relaxed">
            <span className="font-bold text-[#2D1457]">ระบบแยกฐานข้อมูลรูปภาพ (IndexedDB):</span>{" "}
            บีบอัดอัตโนมัติคุณภาพ 70% แปลงเป็น .jpg ทันที ไม่เปลืองพื้นที่หน่วยความจำ และสามารถแนบรูปเพิ่มได้ไม่จำกัด
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              multiple
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFC300] hover:bg-[#e5b000] text-[#1F1F1F] text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#1F1F1F]" />
              ) : (
                <Plus className="w-4 h-4 text-[#1F1F1F]" />
              )}
              <span>{uploading ? "กำลังบีบอัดและอัปโหลด..." : "➕ แนบรูปภาพเพิ่มเติม"}</span>
            </button>
          </div>
        </div>

        {/* Photos Grid / List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="py-16 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#2D1457]" />
              กำลังโหลดรูปภาพจากฐานข้อมูล...
            </div>
          ) : images.length === 0 ? (
            <div className="py-14 text-center border-2 border-dashed border-[#2D1457]/20 rounded-2xl bg-white p-6">
              <div className="w-14 h-14 rounded-2xl bg-[#FFC300]/20 text-[#2D1457] flex items-center justify-center mx-auto mb-3">
                <ImageIcon className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-[#1F1F1F]">ยังไม่มีรูปภาพประกอบในรายการนี้</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                กดปุ่ม "แนบรูปภาพเพิ่มเติม" เพื่ออัปโหลดภาพถ่ายพัสดุหรือการส่งมอบ ระบบจะบีบอัดอัตโนมัติและแสดงผลทันที
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FFC300] hover:bg-[#e5b000] text-[#1F1F1F] font-bold text-xs rounded-xl shadow-md transition-all"
              >
                <Upload className="w-4 h-4" />
                <span>เลือกรูปภาพจากเครื่อง หรือถ่ายภาพ</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {images.map((img, idx) => (
                <div
                  key={img.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between hover:border-[#2D1457]/40 transition-all"
                >
                  <div className="space-y-3">
                    {/* Header badge & delete */}
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#2D1457] text-[#FFC300]">
                        <Layers className="w-3 h-3" />
                        <span>รูปภาพที่ {idx + 1}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(img.id)}
                        className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                        title="ลบรูปภาพนี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Image Preview */}
                    <div className="relative aspect-4/3 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                      <img
                        src={img.dataUrl}
                        alt={`รูปภาพที่ ${idx + 1}`}
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-md font-mono">
                        Auto 70% .jpg
                      </div>
                    </div>

                    {/* Item Name & Quantity Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-[#1F1F1F] mb-1">
                          ชื่อรายการพัสดุ:
                        </label>
                        <input
                          type="text"
                          value={img.itemName || ""}
                          onChange={(e) =>
                            handleMetaChange(img.id, "itemName", e.target.value)
                          }
                          placeholder="เช่น โต๊ะทำงาน, สีน้ำมันทาอาคาร"
                          className="w-full px-2.5 py-1.5 text-xs bg-[#F8F9FA] border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#FFC300] focus:border-[#2D1457] text-[#1F1F1F]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#1F1F1F] mb-1">
                          จำนวนกำกับ:
                        </label>
                        <input
                          type="text"
                          value={img.quantity || ""}
                          onChange={(e) =>
                            handleMetaChange(img.id, "quantity", e.target.value)
                          }
                          placeholder="เช่น 21 รายการ, 5 ชุด"
                          className="w-full px-2.5 py-1.5 text-xs bg-[#F8F9FA] border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#FFC300] focus:border-[#2D1457] text-[#1F1F1F]"
                        />
                      </div>
                    </div>

                    {/* Caption */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#1F1F1F] mb-1">
                        คำอธิบายเพิ่มเติม (ใต้รูป):
                      </label>
                      <input
                        type="text"
                        value={img.caption || ""}
                        onChange={(e) =>
                          handleMetaChange(img.id, "caption", e.target.value)
                        }
                        placeholder="เช่น ภาพถ่ายขณะตรวจนับพัสดุ ณ กองการศึกษา"
                        className="w-full px-2.5 py-1.5 text-xs bg-[#F8F9FA] border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#FFC300] focus:border-[#2D1457] text-[#1F1F1F]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Footer */}
        <div className="bg-white border-t border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            รูปภาพทั้งหมดจะถูกนำไปจัดหน้าเอกสารภาคผนวก PDF พร้อมช่องลงนามผู้ตรวจรับพัสดุอัตโนมัติ
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              ปิดหน้าต่าง
            </button>
            <button
              type="button"
              onClick={() => onOpenPdf(record)}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-[#1F1F1F] bg-[#FFC300] hover:bg-[#e5b000] rounded-xl shadow-md transition-all"
            >
              <Printer className="w-4 h-4 text-[#1F1F1F]" />
              <span>เปิดเอกสาร PDF ภาคผนวก</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
