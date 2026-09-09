import React, { useState } from "react";
import { X, Copy, Check, ExternalLink, QrCode, Share2, Sparkles } from "lucide-react";
import { ProcurementRecord } from "../types";
import { formatTopicTitle } from "../utils/excelExport";

interface ShareModalProps {
  record: ProcurementRecord;
  onClose: () => void;
  onOpenCommitteeView?: (rec: ProcurementRecord) => void;
  onOpenInspectorView?: (rec: ProcurementRecord) => void;
  showToast: (type: "success" | "error", msg: string) => void;
}

export function ShareModal({
  record,
  onClose,
  onOpenCommitteeView,
  onOpenInspectorView,
  showToast,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  const topicTitle = formatTopicTitle(record);

  // Generate direct link with query parameter for committee mode
  const currentUrl = window.location.origin + window.location.pathname;
  const shareUrl = `${currentUrl}?shareRecordId=${encodeURIComponent(record.id)}&mode=committee`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showToast("success", "คัดลอกลิงก์สำหรับกรรมการเรียบร้อยแล้ว");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      showToast("success", "คัดลอกลิงก์เรียบร้อยแล้ว");
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
      <div className="bg-[#F8F9FA] rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-[#2D1457]/30">
        {/* Header */}
        <div className="bg-[#2D1457] text-white px-5 py-4 flex items-center justify-between border-b border-[#44207f]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFC300] text-[#1F1F1F] flex items-center justify-center font-bold">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                แชร์ให้กรรมการแนบรูปภาพ
              </h3>
              <p className="text-xs text-[#FFC300]">
                {topicTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs leading-relaxed space-y-1">
            <div className="font-bold text-[#2D1457] text-sm">
              ส่งลิงก์นี้ให้กรรมการตรวจรับพัสดุ:
            </div>
            <p className="text-slate-600">
              กรรมการสามารถเปิดลิงก์บนสมาร์ตโฟนหรือคอมพิวเตอร์เพื่อถ่ายภาพ / อัปโหลดรูปภาพพัสดุ พร้อมระบุ <strong>"ชื่อรายการ"</strong> และ <strong>"จำนวน"</strong> กำกับได้โดยตรง และกดเพิ่มรูปเพิ่มเติมได้ไม่จำกัด
            </p>
          </div>

          {/* Share Link Box */}
          <div>
            <label className="block text-xs font-bold text-[#1F1F1F] mb-1.5">
              ลิงก์หน้าแนบรูปภาพสำหรับกรรมการ:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-[#1F1F1F] font-mono select-all focus:outline-none focus:ring-2 focus:ring-[#FFC300]"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-sm ${
                  copied
                    ? "bg-emerald-600 text-white"
                    : "bg-[#FFC300] hover:bg-[#e5b000] text-[#1F1F1F]"
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? "คัดลอกแล้ว" : "คัดลอก"}</span>
              </button>
            </div>
          </div>

          {/* Summary Box */}
          <div className="bg-slate-100/80 rounded-xl p-3.5 text-xs text-slate-700 space-y-1 border border-slate-200">
            <div>
              <strong>ร้านค้า:</strong> {record.purchaseStore || "-"}
            </div>
            <div>
              <strong>หัวข้อรายการ:</strong> {topicTitle}
            </div>
            <div>
              <strong>ผู้ตรวจรับพัสดุ:</strong> {record.inspectorName || "ตามคำสั่งแต่งตั้ง"}
            </div>
          </div>

          {/* Direct open button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onOpenCommitteeView) onOpenCommitteeView(record);
                else if (onOpenInspectorView) onOpenInspectorView(record);
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#2D1457] hover:bg-[#3d1c75] text-[#FFC300] text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>เปิดหน้าสำหรับกรรมการตรวจรับพัสดุเดี๋ยวนี้</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-5 py-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
