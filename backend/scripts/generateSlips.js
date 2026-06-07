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

    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("NANDINI HERBAL CARE PVT LTD", leftMargin, 40, {
        align: "center",
        width: pageWidth,
      });

    doc
      .fontSize(8)
      .font("Helvetica")
      .text(
        "S-201, SIGNATURE COMPLEX, ZYDUS HOSPITAL ROAD, THALTEJ, AHMEDABAD 380059",
        leftMargin,
        55,
        {
          align: "center",
          width: pageWidth,
        }
      );

    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("SALARY SLIP", leftMargin, 85, {
        align: "center",
        width: pageWidth,
        underline: true,
      });

    let y = 115;
    doc.fontSize(10).font("Helvetica-Bold");

    const col1 = leftMargin;
    const col2 = leftMargin + 100;

    doc.text("Employee", col1, y);
    y += 15;
    doc.text("Name:", col1, y);
    doc.font("Helvetica").text(employee.name, col2, y);

    y += 25;
    doc.font("Helvetica-Bold").text("Designation:", col1, y);
    doc.font("Helvetica").text(String(employee.post || ""), col2, y);

    y += 25;
    const [month, year] = monthYear.split("-");
    const monthFormatted = month.substring(0, 3).toUpperCase();
    doc.font("Helvetica-Bold").text("Month & Year:", col1, y);
    doc.font("Helvetica").text(`${monthFormatted}-${year.substring(2)}`, col2, y);

    y += 35;
    doc.font("Helvetica-Bold").text("No of Days:", col1, y);
    doc.font("Helvetica").text(String(employee.totalDays || 0), col1 + 70, y);

    doc.font("Helvetica-Bold").text("Leaves:", leftMargin + pageWidth / 2, y);
    const leaves =
      Number(employee.totalDays || 0) -
      Number(employee.presentDays || 0) -
      Number(employee.weekOff || 0) -
      Number(employee.otherAllowanceDays || 0);
    const leavesStr = leaves > 0 ? String(leaves) : "0";
    doc.font("Helvetica").text(leavesStr, leftMargin + pageWidth / 2 + 50, y);

    y += 25;
    const tableLeft = leftMargin;
    const tableMid = leftMargin + pageWidth / 2;

    doc.fontSize(10).font("Helvetica-Bold");

    doc.rect(tableLeft, y, pageWidth / 2, 20).stroke();
    doc.rect(tableMid, y, pageWidth / 2, 20).stroke();

    doc.text("Earnings", tableLeft + 5, y + 5, { width: pageWidth / 2 - 10 });
    doc.text("Deductions", tableMid + 5, y + 5, { width: pageWidth / 2 - 10 });

    y += 20;

    const earnings = [
      ["Basic", formatCurrency(employee.earningBasic || employee.basic)],
      [
        "H.R.A",
        formatCurrency((employee.hra * employee.totalDays) / 30),
      ],
      [
        "Conv.",
        formatCurrency((employee.conveyance * employee.totalDays) / 30),
      ],
      [
        "Medical",
        formatCurrency((employee.medical * employee.totalDays) / 30),
      ],
    ];

    const deductions = [
      ["Provident Fund", formatCurrency(employee.pfEmployee)],
      ["E.S.I.", formatCurrency(employee.esiEmployee)],
      ["Professional Tax", formatCurrency(employee.professionalTax)],
      ["Loan", formatCurrency(employee.advance)],
      ["TDS/IT", formatCurrency(employee.tds)],
    ];

    const maxRows = Math.max(earnings.length, deductions.length);
    doc.fontSize(10).font("Helvetica");

    for (let i = 0; i < maxRows; i++) {
      const rowHeight = 20;

      doc.rect(tableLeft, y, pageWidth / 2, rowHeight).stroke();
      doc.rect(tableMid, y, pageWidth / 2, rowHeight).stroke();

      if (i < earnings.length) {
        doc.text(earnings[i][0], tableLeft + 5, y + 5);
        let val = earnings[i][1];
        if (Number(val) === 0) val = "-";
        doc.text(val, tableLeft + pageWidth / 2 - 85, y + 5, {
          width: 80,
          align: "right",
        });
      }

      if (i < deductions.length) {
        doc.text(deductions[i][0], tableMid + 5, y + 5);
        let val = deductions[i][1];
        if (Number(val) === 0) val = "-";
        doc.text(val, tableMid + pageWidth / 2 - 85, y + 5, {
          width: 80,
          align: "right",
        });
      }

      y += rowHeight;
    }

    doc.rect(tableLeft, y, pageWidth / 2, 20).stroke();
    doc.rect(tableMid, y, pageWidth / 2, 20).stroke();

    doc.font("Helvetica-Bold");
    doc.text("Total Addition", tableLeft + 5, y + 5);
    doc.text(
      `RS. ${formatCurrency(employee.grossEarnings)}`,
      tableLeft + pageWidth / 2 - 105,
      y + 5,
      { width: 100, align: "right" }
    );

    doc.text("Paid Salary", tableMid + 5, y + 5);
    doc.text(
      formatCurrency(employee.netAmount),
      tableMid + pageWidth / 2 - 85,
      y + 5,
      { width: 80, align: "right" }
    );

    y += 20;

    doc.rect(tableLeft, y, pageWidth / 2, 20).stroke();
    doc.rect(tableMid, y, pageWidth / 2, 20).stroke();

    doc.font("Helvetica");
    doc.text("Incentive", tableLeft + 5, y + 5);
    let incentive = formatCurrency(
      employee.otherAllowance || employee.specialAllowance || 0
    );
    doc.text(incentive, tableLeft + pageWidth / 2 - 85, y + 5, {
      width: 80,
      align: "right",
    });

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
