const XLSX = require("xlsx");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// Configuration
const EXCEL_FILE = path.join(__dirname, "..", "public", "APRIL.xlsx");
const COMPANY_NAME = "NANDINI HERBAL CARE PVT. LTD.";

function parseExcelData(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const sheetName = wb.SheetNames[0]; // e.g., "APRIL-26"
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // Extract month-year from row 1 (the title row)
  let monthYear = "April-2026";
  for (const row of data.slice(0, 5)) {
    if (row) {
      for (const cell of row) {
        if (cell && typeof cell === "string" && cell.includes("PVT.LTD")) {
          // e.g., "NANDINI HERBLE CARE PVT.LTD APRIL.-2026"
          const match = cell.match(/(\w+)[\.\-]*(\d{4})/);
          if (match) {
            monthYear = `${match[1]}-${match[2]}`;
          }
        }
      }
    }
  }

  // Header row is at index 3
  const headers = data[3];

  // Parse employee rows (skip header, sub-header, and summary rows)
  const employees = [];
  for (let i = 5; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[11] || !row[9]) continue; // Must have employee name and SR number
    if (typeof row[9] !== "number") continue; // SR must be a number
    if (typeof row[11] !== "string") continue; // Name must be a string
    if (row[11].trim().toUpperCase() === "TOTAL") continue; // Skip summary rows

    const emp = {
      srNo: row[9],
      name: row[11].trim(),
      group: row[4] || "",
      post: row[5] || "",
      status: row[6] || "",
      pfStatus: row[10] || "",
      uanNo: row[8] || "",
      salaryAmount: row[12] || 0,
      // Earnings
      basic: row[13] || 0,
      hra: row[14] || 0,
      conveyance: row[15] || 0,
      medical: row[16] || 0,
      specialAllowance: row[17] || 0,
      totalEarningsFixed: row[18] || 0,
      pfSalary: row[19] || 0,
      // Attendance
      presentDays: row[20] || 0,
      weekOff: row[21] || 0,
      otherAllowanceDays: row[22] || 0,
      totalDays: row[23] || 0,
      // Actual Earnings
      earnedTotal: row[24] || 0,
      otherAllowance: row[25] || 0,
      grossEarnings: row[26] || 0,
      earningBasic: row[27] || 0,
      // Deductions
      pfEmployee: row[28] || 0, // 12%
      pfEmployer: row[29] || 0, // 13%
      esiEmployee: row[30] || 0, // 0.75%
      esiEmployer: row[31] || 0, // 3.25%
      professionalTax: row[32] || 0,
      tds: row[33] || 0,
      advance: row[34] || 0,
      meal: row[35] || 0,
      store: row[36] || 0,
      otherDeduction: row[37] || 0,
      totalDeductions: row[38] || 0,
      // Net
      netAmount: row[39] || 0,
      // Personal details
      aadhar: row[41] || "",
      pan: row[42] || "",
      bankAccount: row[43] || "",
      ifsc: row[44] || "",
      mobile: row[45] || "",
    };

    employees.push(emp);
  }

  return { employees, monthYear };
}

function formatCurrency(amount) {
  if (!amount || isNaN(amount)) return "0.00";
  return Math.round(amount * 100) / 100;
}

function generateSalarySlipPDF(employee, monthYear, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    const pageWidth = doc.page.width - 80;
    const leftMargin = 40;

    // Header - Company Name
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text(COMPANY_NAME, leftMargin, 40, {
        align: "center",
        width: pageWidth,
      });

    doc
      .fontSize(10)
      .font("Helvetica")
      .text("Salary Slip", leftMargin, 60, {
        align: "center",
        width: pageWidth,
      });

    // Month-Year
    const [month, year] = monthYear.split("-");
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(
        `Month: ${month.charAt(0).toUpperCase() + month.slice(1).toLowerCase()} ${year}`,
        leftMargin,
        78,
        { align: "center", width: pageWidth }
      );

    // Divider
    doc
      .moveTo(leftMargin, 95)
      .lineTo(leftMargin + pageWidth, 95)
      .stroke();

    // Employee Information Section
    let y = 108;
    doc.fontSize(9).font("Helvetica-Bold");

    const col1 = leftMargin;
    const col2 = leftMargin + 130;
    const col3 = leftMargin + pageWidth / 2 + 10;
    const col4 = leftMargin + pageWidth / 2 + 130;

    // Row 1
    doc.text("Employee Name:", col1, y);
    doc.font("Helvetica").text(employee.name, col2, y);
    doc.font("Helvetica-Bold").text("Designation:", col3, y);
    doc.font("Helvetica").text(String(employee.post), col4, y);

    y += 18;
    // Row 2
    doc.font("Helvetica-Bold").text("Department:", col1, y);
    doc.font("Helvetica").text(String(employee.group), col2, y);
    doc.font("Helvetica-Bold").text("PF Status:", col3, y);
    doc.font("Helvetica").text(String(employee.pfStatus), col4, y);

    y += 18;
    // Row 3
    doc.font("Helvetica-Bold").text("UAN No.:", col1, y);
    doc.font("Helvetica").text(String(employee.uanNo || "N/A"), col2, y);
    doc.font("Helvetica-Bold").text("PAN:", col3, y);
    doc.font("Helvetica").text(String(employee.pan || "N/A"), col4, y);

    y += 18;
    // Row 4
    doc.font("Helvetica-Bold").text("CTC (Monthly):", col1, y);
    doc
      .font("Helvetica")
      .text(`Rs. ${formatCurrency(employee.salaryAmount)}`, col2, y);
    doc.font("Helvetica-Bold").text("Bank A/C:", col3, y);
    doc
      .font("Helvetica")
      .text(String(employee.bankAccount || "N/A"), col4, y);

    // Divider
    y += 25;
    doc.moveTo(leftMargin, y).lineTo(leftMargin + pageWidth, y).stroke();

    // Attendance Section
    y += 10;
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("ATTENDANCE", leftMargin, y, { align: "center", width: pageWidth });

    y += 18;
    const attCol1 = leftMargin + 20;
    const attCol2 = leftMargin + 140;
    const attCol3 = leftMargin + 260;
    const attCol4 = leftMargin + 380;

    doc.fontSize(9).font("Helvetica-Bold");
    doc.text("Present Days:", attCol1, y);
    doc.font("Helvetica").text(String(employee.presentDays), attCol2, y);
    doc.font("Helvetica-Bold").text("Week Off:", attCol3, y);
    doc.font("Helvetica").text(String(employee.weekOff), attCol4, y);

    y += 16;
    doc.font("Helvetica-Bold").text("Other Allowance:", attCol1, y);
    doc
      .font("Helvetica")
      .text(String(employee.otherAllowanceDays), attCol2, y);
    doc.font("Helvetica-Bold").text("Total Days:", attCol3, y);
    doc.font("Helvetica").text(String(employee.totalDays), attCol4, y);

    // Divider
    y += 25;
    doc.moveTo(leftMargin, y).lineTo(leftMargin + pageWidth, y).stroke();

    // Earnings & Deductions Table
    y += 10;
    const tableLeft = leftMargin;
    const tableMid = leftMargin + pageWidth / 2;
    const tableRight = leftMargin + pageWidth;

    // Table Header
    doc.fontSize(10).font("Helvetica-Bold");
    doc
      .rect(tableLeft, y, pageWidth / 2, 20)
      .fill("#e8e8e8")
      .stroke();
    doc
      .rect(tableMid, y, pageWidth / 2, 20)
      .fill("#e8e8e8")
      .stroke();

    doc.fillColor("black");
    doc.text("EARNINGS", tableLeft + 5, y + 5, { width: pageWidth / 2 - 10 });
    doc.text("DEDUCTIONS", tableMid + 5, y + 5, {
      width: pageWidth / 2 - 10,
    });

    y += 20;

    // Table rows
    const earnings = [
      ["Basic", formatCurrency(employee.earningBasic || employee.basic)],
      ["HRA", formatCurrency((employee.hra * employee.totalDays) / 30)],
      [
        "Conveyance",
        formatCurrency((employee.conveyance * employee.totalDays) / 30),
      ],
      [
        "Medical",
        formatCurrency((employee.medical * employee.totalDays) / 30),
      ],
      [
        "Special Allowance",
        formatCurrency(
          (employee.specialAllowance * employee.totalDays) / 30
        ),
      ],
      ["Other Allowance", formatCurrency(employee.otherAllowance)],
    ];

    const deductions = [
      ["PF (Employee 12%)", formatCurrency(employee.pfEmployee)],
      ["ESI (Employee 0.75%)", formatCurrency(employee.esiEmployee)],
      ["Professional Tax", formatCurrency(employee.professionalTax)],
      ["TDS", formatCurrency(employee.tds)],
      ["Advance", formatCurrency(employee.advance)],
      ["Meal", formatCurrency(employee.meal)],
      ["Store", formatCurrency(employee.store)],
      ["Other", formatCurrency(employee.otherDeduction)],
    ];

    const maxRows = Math.max(earnings.length, deductions.length);
    doc.fontSize(9).font("Helvetica");

    for (let i = 0; i < maxRows; i++) {
      const rowHeight = 16;
      // Left side (Earnings)
      if (i < earnings.length) {
        doc.text(earnings[i][0], tableLeft + 5, y + 3);
        doc.text(
          `Rs. ${earnings[i][1]}`,
          tableLeft + pageWidth / 2 - 85,
          y + 3,
          { width: 80, align: "right" }
        );
      }
      // Right side (Deductions)
      if (i < deductions.length) {
        doc.text(deductions[i][0], tableMid + 5, y + 3);
        doc.text(
          `Rs. ${deductions[i][1]}`,
          tableMid + pageWidth / 2 - 85,
          y + 3,
          { width: 80, align: "right" }
        );
      }
      y += rowHeight;
    }

    // Totals row
    y += 5;
    doc
      .moveTo(leftMargin, y)
      .lineTo(leftMargin + pageWidth, y)
      .stroke();
    y += 5;

    doc.font("Helvetica-Bold");
    doc.text("Gross Earnings:", tableLeft + 5, y + 3);
    doc.text(
      `Rs. ${formatCurrency(employee.grossEarnings)}`,
      tableLeft + pageWidth / 2 - 85,
      y + 3,
      { width: 80, align: "right" }
    );
    doc.text("Total Deductions:", tableMid + 5, y + 3);

    const totalDed =
      (employee.pfEmployee || 0) +
      (employee.esiEmployee || 0) +
      (employee.professionalTax || 0) +
      (employee.tds || 0) +
      (employee.advance || 0) +
      (employee.meal || 0) +
      (employee.store || 0) +
      (employee.otherDeduction || 0);

    doc.text(
      `Rs. ${formatCurrency(totalDed)}`,
      tableMid + pageWidth / 2 - 85,
      y + 3,
      { width: 80, align: "right" }
    );

    // Net Salary
    y += 30;
    doc
      .moveTo(leftMargin, y)
      .lineTo(leftMargin + pageWidth, y)
      .stroke();
    y += 8;

    doc.fontSize(12).font("Helvetica-Bold");
    doc.text(
      `NET SALARY: Rs. ${formatCurrency(employee.netAmount)}`,
      leftMargin,
      y,
      { align: "center", width: pageWidth }
    );

    y += 25;
    doc.fontSize(9).font("Helvetica");
    doc.text(
      `(${numberToWords(Math.round(employee.netAmount || 0))})`,
      leftMargin,
      y,
      { align: "center", width: pageWidth }
    );

    // Footer
    y += 50;
    doc
      .moveTo(leftMargin, y)
      .lineTo(leftMargin + pageWidth, y)
      .stroke();
    y += 10;

    doc.fontSize(8).font("Helvetica");
    doc.text(
      "This is a computer-generated salary slip and does not require a signature.",
      leftMargin,
      y,
      { align: "center", width: pageWidth }
    );

    // Employer contribution info at bottom
    if (employee.pfEmployer > 0 || employee.esiEmployer > 0) {
      y += 20;
      doc.fontSize(7).font("Helvetica");
      doc.text(
        `Employer Contribution - PF (13%): Rs. ${formatCurrency(employee.pfEmployer)} | ESI (3.25%): Rs. ${formatCurrency(employee.esiEmployer)}`,
        leftMargin,
        y,
        { align: "center", width: pageWidth }
      );
    }

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

function numberToWords(num) {
  if (num === 0) return "Zero Only";
  if (num < 0) return "Minus " + numberToWords(Math.abs(num));

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convert(n) {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + convert(n % 100) : "");
    if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
    if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + convert(n % 100000) : "");
    return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + convert(n % 10000000) : "");
  }

  return "Rupees " + convert(Math.round(num)) + " Only";
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9.\- ]/g, "").replace(/\s+/g, "_");
}

async function main() {
  console.log("Reading Excel file...");
  const { employees, monthYear } = parseExcelData(EXCEL_FILE);
  console.log(`Found ${employees.length} employees for ${monthYear}`);

  // Create output directory
  const outputDir = path.join(
    __dirname,
    "..",
    "public",
    "Salary_Slips",
    monthYear
  );
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Generating salary slips in: ${outputDir}\n`);

  let generated = 0;
  for (const emp of employees) {
    const filename = `${sanitizeFilename(emp.name)}_Salary_Slip_${monthYear}.pdf`;
    const outputPath = path.join(outputDir, filename);

    try {
      await generateSalarySlipPDF(emp, monthYear, outputPath);
      generated++;
      console.log(`[${generated}/${employees.length}] Generated: ${filename}`);
    } catch (err) {
      console.error(`Failed for ${emp.name}:`, err.message);
    }
  }

  console.log(`\nDone! ${generated} salary slips generated.`);
  console.log(`Location: ${outputDir}`);
}

main().catch(console.error);
