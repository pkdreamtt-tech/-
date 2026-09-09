import React, { useState, useEffect, useRef } from "react";
import {
  Camera,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  Printer,
  ArrowLeft,
  Loader2,
  Layers,
  Share2,
  Building2,
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

interface CommitteePhotoViewProps {
  record: ProcurementRecord;
  onBack: () => void;
  onOpenPdf: (rec: ProcurementRecord) => void;
  showToast: (type: "success" | "error", msg: string) => void;
}

export function CommitteePhotoView({
  record,
  onBack,
  onOpenPdf,
  showToast,
}: CommitteePhotoViewProps) {
  const [images, setImages] = useState<StoredImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const topicTitle = formatTopicTitle(record);

  // Load photos
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        let stored = await getImagesByRecordId(record.id);
        if (stored.length === 0) {
          if (record.image1) {
            const img1 = await saveImageToStore(
              record.id,
              record.image1,
              record.items?.split("\n")[0] || "",
              String(record.itemCount || 1),
              "ภาพถ่ายพัสดุ / การส่งมอบของ"
            );
            stored.push(img1);
          }
          if (record.image2) {
            const img2 = await saveImageToStore(
              record.id,
              record.image2,
              "",
              "",
              "ภาพถ่ายการตรวจสอบสถานที่จริง"
            );
            stored.push(img2);
          }
        }
        if (isMounted) setImages(stored);
      } catch (err) {
        console.error("Error loading committee photos:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [record]);

  // Instant upload & 70% compression
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
        const compressedJpeg = await compressImageToJpeg(file, 0.7);
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
        `บีบอัด 70% (.jpg) และแนบรูปภาพสำเร็จ (${files.length} รูป)`
      );
    } catch (err) {
      console.error("Error uploading photo:", err);
      showToast("error", "เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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

  const handleDelete = async (id: string) => {
    if (!window.confirm("ยืนยันการลบรูปภาพนี้หรือไม่?")) return;
    try {
      await deleteImageFromStore(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
      showToast("success", "ลบรูปภาพเรียบร้อยแล้ว");
    } catch (err) {
      console.error("Error deleting image:", err);
      showToast("error", "เกิดข้อผิดพลาดในการลบ");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1F1F1F] flex flex-col">
      {/* Top Header - Deep Purple */}
      <header className="bg-[#2D1457] text-white border-b border-[#44207f] sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
              title="กลับสู่หน้ารายการ"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#FFC300] text-[#1F1F1F] text-xs font-bold">
                  สำหรับกรรมการตรวจรับพัสดุ
                </span>
                <span className="text-xs text-slate-300">
                  กองการศึกษา เทศบาลตำบลท่าทอง
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-white leading-snug">
                หน้าแนบรูปภาพประกอบการตรวจรับพัสดุ
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenPdf(record)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#1F1F1F] bg-[#FFC300] hover:bg-[#e5b000] rounded-xl shadow-md transition-all"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">ดูเอกสาร PDF ภาคผนวก</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 space-y-6">
        {/* Info Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#F8F9FA] p-3.5 rounded-xl border border-slate-200">
              <span className="block text-[11px] text-slate-500 font-medium">ร้านค้า / ผู้ขาย:</span>
              <strong className="text-sm text-[#2D1457]">{record.purchaseStore || "-"}</strong>
            </div>
            <div className="bg-[#F8F9FA] p-3.5 rounded-xl border border-slate-200">
              <span className="block text-[11px] text-slate-500 font-medium">หัวข้อรายการ:</span>
              <strong className="text-sm text-[#1F1F1F]">{topicTitle}</strong>
            </div>
            <div className="bg-[#F8F9FA] p-3.5 rounded-xl border border-slate-200">
              <span className="block text-[11px] text-slate-500 font-medium">ผู้ตรวจรับพัสดุ:</span>
              <strong className="text-sm text-[#1F1F1F]">
                {record.inspectorName || "-"}
              </strong>
              {record.inspectorPosition && (
                <div className="text-xs text-slate-500 mt-0.5">
                  ตำแหน่ง {record.inspectorPosition}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upload & Action Toolbar */}
        <div className="bg-gradient-to-r from-[#2D1457] to-[#44207f] text-white rounded-2xl p-5 sm:p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[#FFC300] text-xs font-bold uppercase tracking-wider mb-1">
              <Camera className="w-4 h-4" />
              <span>แนบรูปภาพพร้อมระบุชื่อรายการและจำนวน</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold">
              แนบรูปภาพประกอบการตรวจรับ ({images.length} รูป)
            </h3>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              ถ่ายภาพจากกล้องมือถือหรือเลือกรูปภาพ ระบบจะบีบอัดอัตโนมัติเหลือ 70% และแสดงผลทันที
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
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
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FFC300] hover:bg-[#e5b000] text-[#1F1F1F] text-xs sm:text-sm font-bold rounded-xl shadow-lg transition-all disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#1F1F1F]" />
              ) : (
                <Plus className="w-4 h-4 text-[#1F1F1F]" />
              )}
              <span>{uploading ? "กำลังบีบอัดและบันทึก..." : "➕ แนบรูปภาพเพิ่มเติม"}</span>
            </button>
          </div>
        </div>

        {/* Photos Grid */}
        <div>
          {loading ? (
            <div className="py-20 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#2D1457]" />
              กำลังโหลดรูปภาพ...
            </div>
          ) : images.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-[#2D1457]/20 rounded-2xl bg-white p-8">
              <div className="w-16 h-16 rounded-2xl bg-[#FFC300]/20 text-[#2D1457] flex items-center justify-center mx-auto mb-3">
                <Camera className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-[#1F1F1F]">ยังไม่มีรูปภาพที่แนบ</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
                กดปุ่มด้านล่างเพื่อถ่ายภาพหรือเลือกภาพถ่ายพัสดุและสถานที่ตรวจรับจริง
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#FFC300] hover:bg-[#e5b000] text-[#1F1F1F] font-bold text-sm rounded-xl shadow-md transition-all"
              >
                <Camera className="w-5 h-5 text-[#1F1F1F]" />
                <span>ถ่ายภาพ หรือเลือกรูปจากมือถือ</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {images.map((img, idx) => (
                <div
                  key={img.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col justify-between hover:border-[#2D1457]/40 transition-all"
                >
                  <div className="space-y-3">
                    {/* Badge & Delete */}
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#2D1457] text-[#FFC300]">
                        <Layers className="w-3.5 h-3.5" />
                        <span>รูปภาพที่ {idx + 1}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(img.id)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                        title="ลบรูปภาพนี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Image View */}
                    <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                      <img
                        src={img.dataUrl}
                        alt={`รูปภาพที่ ${idx + 1}`}
                        className="w-full h-full object-contain"
                      />
                      <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-md font-mono">
                        Auto 70% .jpg
                      </span>
                    </div>

                    {/* Metadata fields: ชื่อรายการ & จำนวน */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="block text-xs font-bold text-[#1F1F1F] mb-1">
                          ชื่อรายการพัสดุ:
                        </label>
                        <input
                          type="text"
                          value={img.itemName || ""}
                          onChange={(e) =>
                            handleMetaChange(img.id, "itemName", e.target.value)
                          }
                          placeholder="เช่น โต๊ะพับอเนกประสงค์"
                          className="w-full px-3 py-1.5 text-xs bg-[#F8F9FA] border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#FFC300] focus:border-[#2D1457] text-[#1F1F1F]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#1F1F1F] mb-1">
                          จำนวนกำกับ:
                        </label>
                        <input
                          type="text"
                          value={img.quantity || ""}
                          onChange={(e) =>
                            handleMetaChange(img.id, "quantity", e.target.value)
                          }
                          placeholder="เช่น 10 ตัว, 21 รายการ"
                          className="w-full px-3 py-1.5 text-xs bg-[#F8F9FA] border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#FFC300] focus:border-[#2D1457] text-[#1F1F1F]"
                        />
                      </div>
                    </div>

                    {/* Caption */}
                    <div>
                      <label className="block text-xs font-bold text-[#1F1F1F] mb-1">
                        คำอธิบายภาพประกอบ:
                      </label>
                      <input
                        type="text"
                        value={img.caption || ""}
                        onChange={(e) =>
                          handleMetaChange(img.id, "caption", e.target.value)
                        }
                        placeholder="เช่น ภาพการตรวจนับพัสดุและทดสอบการใช้งาน"
                        className="w-full px-3 py-1.5 text-xs bg-[#F8F9FA] border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#FFC300] focus:border-[#2D1457] text-[#1F1F1F]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-600">
            ระบบจะบันทึกรูปภาพและข้อมูลกำกับลงฐานข้อมูลของรายการนี้ทันทีโดยอัตโนมัติ
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-semibold rounded-xl transition-colors"
            >
              กลับสู่หน้ารายการ
            </button>
            <button
              type="button"
              onClick={() => onOpenPdf(record)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#FFC300] hover:bg-[#e5b000] text-[#1F1F1F] text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all"
            >
              <Printer className="w-4 h-4 text-[#1F1F1F]" />
              <span>ดูเอกสาร PDF ภาคผนวก</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
