import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "20mb" }));

// Lazy initialization of Gemini client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "procurement-thathong" });
});

// Gemini AI Spec Draft endpoint
app.post("/api/gemini/spec", async (req, res) => {
  try {
    const { itemName } = req.body;
    if (!itemName || typeof itemName !== "string") {
      return res.status(400).json({ error: "itemName is required" });
    }

    const ai = getGeminiClient();
    if (!ai) {
      // Graceful fallback if no API key configured
      return res.json({
        spec: `ตามมาตรฐานครุภัณฑ์/พัสดุราชการ คุณภาพดี มีความแข็งแรงทนทาน เหมาะสำหรับใช้งานในราชการกองการศึกษา (${itemName.trim()})`,
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `เขียนคุณลักษณะเฉพาะ (Specification) สำหรับจัดซื้อ/จ้าง: ${itemName.trim()}`,
      config: {
        systemInstruction:
          "คุณคือเจ้าหน้าที่พัสดุ ให้เขียนคุณลักษณะเฉพาะ สั้นๆ เป็นทางการ บรรทัดเดียว ไม่เกิน 150 ตัวอักษร ห้ามมีอารัมภบท",
      },
    });

    const text = response.text?.trim() || "";
    return res.json({ spec: text });
  } catch (error: any) {
    console.error("Gemini spec error:", error);
    const itemName = req.body?.itemName || "พัสดุ";
    return res.json({
      spec: `เป็นวัสดุ/ครุภัณฑ์ที่มีมาตรฐานและคุณภาพตามที่ทางราชการกำหนด เหมาะสมแก่การใช้งาน (${itemName})`,
    });
  }
});

// Gemini AI Reason & Objective Draft endpoint
app.post("/api/gemini/reason-objective", async (req, res) => {
  try {
    const { itemsText, keywords } = req.body;
    if (!itemsText || typeof itemsText !== "string") {
      return res.status(400).json({ error: "itemsText is required" });
    }

    const keywordText = keywords && typeof keywords === "string" && keywords.trim()
      ? `\n\nคีย์เวิร์ด / ประเด็นเพิ่มเติมที่ผู้ใช้ต้องการให้นำมาประมวลผลร่วมด้วย: ${keywords.trim()}`
      : "";

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        reason: keywords?.trim()
          ? `เนื่องจากกองการศึกษา เทศบาลตำบลท่าทอง มีความจำเป็นในการดำเนินงานตามประเด็น: ${keywords.trim()} เพื่อสนับสนุนการปฏิบัติงานราชการและเกิดประโยชน์สูงสุดแก่ทางราชการ`
          : "เนื่องจากกองการศึกษา เทศบาลตำบลท่าทอง มีความจำเป็นต้องใช้พัสดุดังกล่าวในการสนับสนุนการจัดการศึกษาและการปฏิบัติงานราชการให้มีประสิทธิภาพและเกิดประโยชน์สูงสุดแก่ทางราชการ",
        objective: keywords?.trim()
          ? `เพื่อให้มีพัสดุและอุปกรณ์พร้อมสำหรับ${keywords.trim()} และสนับสนุนภารกิจทางการศึกษาของเทศบาลตำบลท่าทองอย่างต่อเนื่อง`
          : "เพื่อให้มีพัสดุและอุปกรณ์ที่จำเป็นพร้อมสำหรับการจัดการเรียนการสอนและสนับสนุนภารกิจทางการศึกษาของเทศบาลตำบลท่าทองให้เป็นไปอย่างมีประสิทธิภาพและต่อเนื่อง",
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `จากรายการพัสดุต่อไปนี้:\n${itemsText}${keywordText}\n\nกรุณาร่างเหตุผลความจำเป็น และวัตถุประสงค์ สำหรับการจัดซื้อจัดจ้าง กองการศึกษา เทศบาลตำบลท่าทอง โดยนำรายการพัสดุและคีย์เวิร์ดเพิ่มเติมมาเรียบเรียงและประมวลผลเป็นภาษาราชการที่ถูกต้อง สละสลวย เป็นทางการ`,
      config: {
        systemInstruction:
          "คุณคือเจ้าหน้าที่พัสดุมืออาชีพ ให้เขียน 1. เหตุผลความจำเป็น และ 2. วัตถุประสงค์ ในรูปแบบภาษาราชการที่เป็นทางการ กระชับ ชัดเจน ไม่เกิน 400 ตัวอักษรต่อหัวข้อ โดยนำคีย์เวิร์ดที่ผู้ใช้ระบุมาบูรณาการเรียบเรียงให้สอดคล้อง ตอบกลับเป็น JSON ในรูปแบบ { 'reason': '...', 'objective': '...' } เท่านั้น",
        responseMimeType: "application/json",
      },
    });

    const rawText = response.text?.trim() || "{}";
    let parsed: { reason?: string; objective?: string } = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const matchReason = rawText.match(/"reason"\s*:\s*"([^"]+)"/);
      const matchObj = rawText.match(/"objective"\s*:\s*"([^"]+)"/);
      parsed = {
        reason: matchReason ? matchReason[1] : rawText,
        objective: matchObj ? matchObj[1] : "",
      };
    }

    return res.json({
      reason:
        parsed.reason ||
        "เนื่องจากพัสดุเดิมชำรุดหรือมีไม่เพียงพอต่อการจัดกิจกรรมการเรียนรู้ของกองการศึกษา เทศบาลตำบลท่าทอง จึงจำเป็นต้องจัดซื้อจัดจ้างเพื่อประโยชน์ของทางราชการ",
      objective:
        parsed.objective ||
        "เพื่อสนับสนุนการเรียนการสอนและอำนวยความสะดวกในการดำเนินงานด้านการศึกษาของเทศบาลตำบลท่าทอง",
    });
  } catch (error: any) {
    console.error("Gemini reason-objective error:", error);
    return res.json({
      reason:
        "เพื่อรองรับภารกิจการจัดการศึกษาและพัฒนาคุณภาพการเรียนรู้ของเด็กและเยาวชนในเขตเทศบาลตำบลท่าทองให้เป็นไปอย่างมีประสิทธิภาพ",
      objective:
        "เพื่อให้มีวัสดุอุปกรณ์และครุภัณฑ์พร้อมสำหรับการดำเนินงานตามแผนงานการศึกษาของเทศบาลตำบลท่าทอง",
    });
  }
});

// Vite middleware & static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
