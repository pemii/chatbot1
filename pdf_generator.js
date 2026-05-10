// pdf_generator.js

const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { formatPercentages } = require("./pdf_utils");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function safeText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function createPdfReport(result, userId) {
  return new Promise((resolve, reject) => {
    try {
      const reportsDir = path.join(__dirname, "reports");
      ensureDir(reportsDir);

      const fileName = `mbti_report_${userId}_${Date.now()}.pdf`;
      const filePath = path.join(reportsDir, fileName);

      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        bufferPages: true
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // =========================
      // Font setup
      // =========================
      const fontPath = path.join(__dirname, "fonts", "Vazirmatn-Regular.ttf");

      if (fs.existsSync(fontPath)) {
        doc.registerFont("Vazir", fontPath);
        doc.font("Vazir");
      } else {
        console.warn("Persian font not found:", fontPath);
        doc.font("Helvetica");
      }

      const lineGap = 8;

      const report = result.report || {};
      const finalType = safeText(result.finalType || result.type, "نامشخص");
      const title = safeText(report.title, "بدون عنوان");
      const summary = safeText(report.summary, "اطلاعاتی ثبت نشده است.");
      const communication = safeText(report.communication, "اطلاعاتی ثبت نشده است.");
      const workStyle = safeText(report.workStyle, "اطلاعاتی ثبت نشده است.");
      const growth = safeText(report.growth, "اطلاعاتی ثبت نشده است.");
      const compatibility = safeText(report.compatibility, "اطلاعاتی ثبت نشده است.");

      const strengths = safeArray(report.strengths);
      const challenges = safeArray(report.challenges);

      // Helper for RTL-like right aligned text
      function addTitle(text) {
        doc
          .fillColor("#111111")
          .fontSize(18)
          .text(text, {
            align: "center",
            lineGap
          });
      }

      function addSectionTitle(text) {
        doc.moveDown(0.8);
        doc
          .fillColor("#111111")
          .fontSize(13)
          .text(text, {
            align: "right",
            underline: true,
            lineGap
          });
        doc.moveDown(0.3);
      }

      function addParagraph(text) {
        doc
          .fillColor("#222222")
          .fontSize(11)
          .text(safeText(text), {
            align: "right",
            lineGap
          });
      }

      function addBullet(text) {
        doc
          .fillColor("#222222")
          .fontSize(11)
          .text(`• ${safeText(text)}`, {
            align: "right",
            lineGap
          });
      }

      // =========================
      // PDF Content
      // =========================

      addTitle("گزارش شخصیت‌شناسی بر پایه مدل MBTI");

      doc.moveDown();

      doc
        .fillColor("#111111")
        .fontSize(14)
        .text(`تیپ شخصیتی شما: ${finalType}`, {
          align: "right",
          lineGap
        });

      doc
        .fontSize(12)
        .text(`عنوان: ${title}`, {
          align: "right",
          lineGap
        });

      doc.moveDown();

      addSectionTitle("خلاصه نتیجه");
      addParagraph(summary);

      addSectionTitle("نقاط قوت");
      if (strengths.length > 0) {
        strengths.forEach(item => addBullet(item));
      } else {
        addParagraph("اطلاعاتی ثبت نشده است.");
      }

      addSectionTitle("چالش‌ها");
      if (challenges.length > 0) {
        challenges.forEach(item => addBullet(item));
      } else {
        addParagraph("اطلاعاتی ثبت نشده است.");
      }

      addSectionTitle("سبک ارتباطی");
      addParagraph(communication);

      addSectionTitle("سبک کاری");
      addParagraph(workStyle);

      addSectionTitle("پیشنهادهای رشد فردی");
      addParagraph(growth);

      addSectionTitle("سازگاری و تعامل با دیگران");
      addParagraph(compatibility);

      addSectionTitle("درصد گرایش‌ها");

      let percentagesText = "اطلاعات درصدها موجود نیست.";

      try {
        if (result.percentages) {
          percentagesText = formatPercentages(result.percentages);
        }
      } catch (err) {
        percentagesText = "خطا در نمایش درصدها.";
      }

      doc
        .fillColor("#222222")
        .fontSize(11)
        .text(percentagesText, {
          align: "right",
          lineGap
        });

      doc.moveDown();

      doc
        .fillColor("gray")
        .fontSize(10)
        .text(
          "توجه: این گزارش صرفاً برای خودشناسی، توسعه فردی و افزایش آگاهی شخصی تهیه شده است و نباید به‌عنوان ارزیابی بالینی، تشخیصی یا روان‌پزشکی در نظر گرفته شود.",
          {
            align: "right",
            lineGap
          }
        );

      // =========================
      // Footer with page numbers
      // =========================
      const pages = doc.bufferedPageRange();

      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);

        doc
          .fillColor("gray")
          .fontSize(9)
          .text(
            `صفحه ${i + 1} از ${pages.count}`,
            50,
            doc.page.height - 40,
            {
              align: "center",
              width: doc.page.width - 100
            }
          );
      }

      doc.end();

      stream.on("finish", () => resolve(filePath));
      stream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { createPdfReport };
