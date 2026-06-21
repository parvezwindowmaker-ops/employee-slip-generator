const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const COMPANY_NAME = 'Nandini Herbal Care Pvt. Ltd.';

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(amount) {
  return Number(Math.round(toNumber(amount) * 100) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function sanitizeFilename(name) {
  return String(name || 'salary-slip')
    .replace(/[^a-zA-Z0-9.\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

function createSlipFilename(employee, period) {
  const monthYear = `${String(period.label || `${period.month}-${period.year}`).replace(/\s+/g, '-')}`;
  return `${sanitizeFilename(employee.employeeName)}_Salary_Slip_${monthYear}.pdf`;
}

function getPlainRecord(record) {
  return typeof record.toJSON === 'function' ? record.toJSON() : record;
}

function normalizeSignature(signature) {
  if (!signature) return null;
  if (Buffer.isBuffer(signature)) return signature;
  if (typeof signature === 'string') {
    const match = signature.match(/^data:image\/[a-zA-Z+]+;base64,(.+)$/);
    if (match) {
      try { return Buffer.from(match[1], 'base64'); } catch { return null; }
    }
  }
  return null;
}

function generateSalarySlipPDF(employeeRecord, periodRecord, options = {}) {
  const employee = getPlainRecord(employeeRecord);
  const period = getPlainRecord(periodRecord);
  const signatureBuffer = options.includeSignature ? normalizeSignature(options.signature) : null;
  const includeSignature = Boolean(signatureBuffer);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 20 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // --- Header Section ---
    const leftMargin = 20;
    const rightMargin = 20;
    const pageWidth = doc.page.width - leftMargin - rightMargin;
    
    // Header Texts
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text(COMPANY_NAME, leftMargin, 30);
    doc.fontSize(8).font('Helvetica').text('Regd. Office:', leftMargin, 45);
    doc.text('S-201, Signature Complex, Nr.Zydus hospital,', leftMargin, 55);
    doc.text('Hebatpur Road, Thaltej, Ahmedabad-380054 Gujarat India.', leftMargin, 65);
    doc.fillColor('blue').text('https://www.nandiniherbalcare.com/', leftMargin, 75);
    doc.fillColor('#000000').text('+91 99988 74048 | info@nandiniherbalcare.com', leftMargin, 85);

    // Try to embed a logo if available at public/logo.png
    const logoPath = path.join(__dirname, '..', 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, doc.page.width - rightMargin - 150, 30, { fit: [150, 60], align: 'right' });
    } else {
      // Placeholder for logo
      doc.fontSize(20).font('Helvetica-Bold').fillColor('green').text('NANDINI', doc.page.width - rightMargin - 150, 45, { width: 150, align: 'right' });
      doc.fontSize(10).font('Helvetica').fillColor('black').text('HERBAL', doc.page.width - rightMargin - 150, 65, { width: 150, align: 'right' });
    }

    doc.moveDown(2);
    
    // Title
    doc.fontSize(12).font('Helvetica-Bold').fillColor('blue').text(`Pay Slip For The Month of ${period.label || ''}`, leftMargin, 110, { align: 'center', width: pageWidth });

    // --- Helper for drawing cells ---
    function drawCell(x, y, w, h, text, isBold = false, align = 'left', fillColor = 'black') {
      doc.rect(x, y, w, h).stroke();
      if(text !== undefined && text !== null) {
        doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(fillColor);
        // padding
        const textY = y + (h - 8) / 2 - 1; 
        doc.text(String(text), x + 4, textY, { width: w - 8, align: align });
      }
    }

    function drawCellNoBorder(x, y, w, h, label, value) {
       doc.font('Helvetica-Bold').fontSize(8).fillColor('black').text(label, x + 4, y + (h-8)/2 - 1);
       doc.font('Helvetica').fontSize(8).fillColor('black').text(value || '-', x + 75, y + (h-8)/2 - 1, { width: w - 80, ellipsis: true });
    }

    let y = 135;
    const rowH = 18;
    
    // --- Employee Details Block ---
    doc.rect(leftMargin, y, pageWidth, rowH * 5).stroke();
    
    // Row 1 Above Table
    doc.font('Helvetica-Bold').fontSize(8).fillColor('black');
    doc.text(`Payroll process date : ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')}`, leftMargin + 4, y - 10);
    doc.text(`Hire Date : -`, leftMargin + pageWidth - 100, y - 10, { width: 100, align: 'right' });

    const colW1 = pageWidth * 0.4;
    const colW2 = pageWidth * 0.35;
    const colW3 = pageWidth * 0.25;

    // Draw inner vertical lines
    doc.moveTo(leftMargin + colW1, y).lineTo(leftMargin + colW1, y + rowH * 5).stroke();
    doc.moveTo(leftMargin + colW1 + colW2, y).lineTo(leftMargin + colW1 + colW2, y + rowH * 5).stroke();
    
    // Draw horizontal lines inside block
    for(let i=1; i<5; i++) {
        doc.moveTo(leftMargin, y + i*rowH).lineTo(leftMargin + pageWidth, y + i*rowH).stroke();
    }

    // Row 1
    drawCellNoBorder(leftMargin, y, colW1, rowH, 'Name :', employee.employeeName);
    drawCellNoBorder(leftMargin + colW1, y, colW2, rowH, 'Bank A/C No :', employee.bankAccount);
    drawCellNoBorder(leftMargin + colW1 + colW2, y, colW3, rowH, 'No Of Days :', employee.totalDays);

    // Row 2
    y += rowH;
    drawCellNoBorder(leftMargin, y, colW1, rowH, 'Emp Id :', employee.serialNumber || '-');
    drawCellNoBorder(leftMargin + colW1, y, colW2, rowH, 'PF A/C No :', employee.pfStatus === 'Yes' ? 'YES' : '-');
    drawCellNoBorder(leftMargin + colW1 + colW2, y, colW3, rowH, 'Full/Part Timer :', 'Full Timer');

    // Row 3
    y += rowH;
    drawCellNoBorder(leftMargin, y, colW1, rowH, 'Department :', employee.departmentGroup);
    drawCellNoBorder(leftMargin + colW1, y, colW2, rowH, 'ESIC A/C No :', '-');
    drawCellNoBorder(leftMargin + colW1 + colW2, y, colW3, rowH, 'Location :', '-');

    // Row 4
    y += rowH;
    drawCellNoBorder(leftMargin, y, colW1, rowH, 'Designation :', employee.post);
    drawCellNoBorder(leftMargin + colW1, y, colW2, rowH, '', '');
    drawCellNoBorder(leftMargin + colW1 + colW2, y, colW3, rowH, 'UAN :', employee.uanNumber);

    y += rowH * 1.5; // Move past the block

    // --- Salary Table ---
    // Table Header
    const colEarning = pageWidth * 0.35;
    const colAmtE = pageWidth * 0.15;
    const colDed = pageWidth * 0.35;
    const colAmtD = pageWidth * 0.15;

    // Earning / Deduction Headers
    drawCell(leftMargin, y, colEarning, rowH, 'Earning', true, 'left', 'black');
    drawCell(leftMargin + colEarning, y, colAmtE, rowH, 'Amount in Rs.', true, 'right', 'black');
    drawCell(leftMargin + colEarning + colAmtE, y, colDed, rowH, 'Deduction', true, 'left', 'black');
    drawCell(leftMargin + colEarning + colAmtE + colDed, y, colAmtD, rowH, 'Amount in Rs.', true, 'right', 'black');

    y += rowH;

    const earnings = [
      ['Basic', employee.earningBasic || employee.basic],
      ['HRA', (toNumber(employee.hra) * toNumber(employee.totalDays)) / 30],
      ['Advanced Bonus', 0],
      ['Meal Pass', employee.meal],
      ['Other Allowance', employee.otherAllowance],
      ['Medical Allowance', (toNumber(employee.medical) * toNumber(employee.totalDays)) / 30],
      ['Emp. Cont. NPS', 0],
      ['Uniform Allowance', 0],
      ['Mobile / Telephone Allowance', 0],
      ['Loyalty Bonus', 0],
      ['Canteen Subsidy', 0],
      ['Shift Differential Allowance', 0],
      ['Conveyance', (toNumber(employee.conveyance) * toNumber(employee.totalDays)) / 30],
      ['Special Allowance', (toNumber(employee.specialAllowance) * toNumber(employee.totalDays)) / 30],
    ].filter(e => e[1] || e[0] === 'Basic' || e[0] === 'HRA' || e[0] === 'Advanced Bonus' || e[0] === 'Meal Pass' || e[0] === 'Other Allowance' || e[0] === 'Medical Allowance' || e[0] === 'Emp. Cont. NPS' || e[0] === 'Uniform Allowance' || e[0] === 'Mobile / Telephone Allowance' || e[0] === 'Loyalty Bonus' || e[0] === 'Canteen Subsidy' || e[0] === 'Shift Differential Allowance');

    const deductions = [
      ['P.F.', employee.pfEmployee],
      ['ESIC', employee.esiEmployee],
      ['Food Exp', 0],
      ['Prof Tax', employee.professionalTax],
      ['T.D.S.', employee.tds],
      ['Loan / Advance', employee.advance],
      ['Store', employee.store],
      ['Other Deduction', employee.otherDeduction],
    ].filter(d => d[1] || d[0] === 'P.F.' || d[0] === 'ESIC' || d[0] === 'Food Exp' || d[0] === 'Prof Tax' || d[0] === 'T.D.S.' || d[0] === 'Other Deduction');

    const maxRows = Math.max(earnings.length, deductions.length);
    const tableHeight = maxRows * 14;

    // Draw outer borders for the data section
    doc.rect(leftMargin, y, colEarning, tableHeight).stroke();
    doc.rect(leftMargin + colEarning, y, colAmtE, tableHeight).stroke();
    doc.rect(leftMargin + colEarning + colAmtE, y, colDed, tableHeight).stroke();
    doc.rect(leftMargin + colEarning + colAmtE + colDed, y, colAmtD, tableHeight).stroke();

    for(let i=0; i<maxRows; i++) {
        const lineY = y + i * 14;
        
        if (earnings[i]) {
            doc.font('Helvetica-Bold').fontSize(8).fillColor('black').text(earnings[i][0], leftMargin + 4, lineY + 3);
            doc.font('Helvetica').fontSize(8).text(toNumber(earnings[i][1]) === 0 ? '0' : formatCurrency(earnings[i][1]), leftMargin + colEarning - 4, lineY + 3, { width: colAmtE - 4, align: 'right' });
        }
        
        if (deductions[i]) {
            doc.font('Helvetica-Bold').fontSize(8).fillColor('black').text(deductions[i][0], leftMargin + colEarning + colAmtE + 4, lineY + 3);
            doc.font('Helvetica').fontSize(8).text(toNumber(deductions[i][1]) === 0 ? '0' : formatCurrency(deductions[i][1]), leftMargin + colEarning + colAmtE + colDed - 4, lineY + 3, { width: colAmtD - 4, align: 'right' });
        }
    }

    y += tableHeight;

    // Totals Row
    drawCell(leftMargin, y, colEarning, rowH, 'Total Earning', true, 'left');
    drawCell(leftMargin + colEarning, y, colAmtE, rowH, formatCurrency(employee.gross), true, 'right');
    drawCell(leftMargin + colEarning + colAmtE, y, colDed, rowH, 'Total Deduction', true, 'left');
    
    const totalDeductions = deductions.reduce((sum, item) => sum + toNumber(item[1]), 0);
    drawCell(leftMargin + colEarning + colAmtE + colDed, y, colAmtD, rowH, formatCurrency(totalDeductions), true, 'right');

    y += rowH;

    // Net Pay Row
    doc.rect(leftMargin, y, colEarning + colAmtE + colDed + colAmtD, rowH).fillAndStroke('#e0f7e0', 'black');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('black').text('Net Pay', leftMargin + 4, y + 4);
    doc.text(formatCurrency(employee.netAmount), leftMargin + colEarning - 4, y + 4, { width: colAmtE - 4, align: 'right' });
    
    y += rowH * 1.5;
    
    // Leave Information
    doc.rect(leftMargin, y, pageWidth, rowH).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('black').text('Leave Information', leftMargin, y + 4, { align: 'center', width: pageWidth });
    
    y += rowH;

    const leaveCols = 6;
    const lColW = pageWidth / leaveCols;
    const leaveHeaders = ['Days', 'Casual Leave', 'Sick Leave', 'Privilege Leave', 'Unpaid Leave', 'FFH'];
    
    for(let i=0; i<leaveCols; i++) {
        drawCell(leftMargin + i*lColW, y, lColW, rowH, leaveHeaders[i], true, 'center');
    }
    y += rowH;

    const unpaidLeaves = Math.max(0, toNumber(employee.totalDays) - toNumber(employee.presentDays) - toNumber(employee.weekOff) - toNumber(employee.otherAllowanceDays));
    const fullHalf = ['Full / Half', '0', '0', '0', unpaidLeaves, '0'];
    for(let i=0; i<leaveCols; i++) {
        drawCell(leftMargin + i*lColW, y, lColW, rowH, String(fullHalf[i]), false, 'center');
    }
    y += rowH;

    const remaining = ['Remaining', '0', '0', '0', '-', '0'];
    for(let i=0; i<leaveCols; i++) {
        drawCell(leftMargin + i*lColW, y, lColW, rowH, String(remaining[i]), false, 'center');
    }
    y += rowH + 10;

    // Notes
    doc.font('Helvetica-Bold').fontSize(8).fillColor('black').text('Notes :', leftMargin, y);
    y += 10;
    doc.font('Helvetica').fontSize(7);
    doc.text('A. Transport Allowance where ever applicable, shall be paid to the employee, based on no. of days attending the office, during the month.', leftMargin + 10, y);
    y += 10;
    doc.text('B. Duplicate payslip will not be issued.', leftMargin + 10, y);

    y += 30;

    // Signature Area
    const sigW = 150;
    const sigH = 40;
    const sigX = leftMargin + pageWidth - sigW;
    
    if (includeSignature) {
        try {
            // position the image relative to the signature text
            doc.image(signatureBuffer, sigX, y - sigH, { fit: [sigW, sigH], align: 'right' });
        } catch { }
        doc.font('Helvetica').fontSize(8).text('Authorized Signatory', sigX, y + 5, { width: sigW, align: 'right' });
    } else {
        doc.font('Helvetica').fontSize(8).text('Computer generated Pay Slip hence signature is not required.', sigX - 100, y, { width: sigW + 100, align: 'right' });
    }

    // Footer
    doc.font('Helvetica').fontSize(8).fillColor('black').text('(An ISO 9001:2015 Company)', leftMargin, doc.page.height - 40, { align: 'center', width: pageWidth });

    doc.end();
  });
}

module.exports = {
  createSlipFilename,
  generateSalarySlipPDF,
  sanitizeFilename,
};
