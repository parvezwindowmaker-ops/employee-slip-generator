const PDFDocument = require('pdfkit');

const COMPANY_NAME = 'NANDINI HERBAL CARE PVT. LTD.';

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(amount) {
  return (Math.round(toNumber(amount) * 100) / 100).toFixed(2);
}

function numberToWords(num) {
  if (num === 0) return 'Zero Only';
  if (num < 0) return `Minus ${numberToWords(Math.abs(num))}`;

  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n) {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ` ${ones[n % 10]}` : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ` ${convert(n % 100)}` : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ` ${convert(n % 1000)}` : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ` ${convert(n % 100000)}` : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ` ${convert(n % 10000000)}` : '');
  }

  return `Rupees ${convert(Math.round(num))} Only`;
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

function generateSalarySlipPDF(employeeRecord, periodRecord) {
  const employee = getPlainRecord(employeeRecord);
  const period = getPlainRecord(periodRecord);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 80;
    const leftMargin = 40;

    doc.fontSize(14).font('Helvetica-Bold').text('NANDINI HERBAL CARE PVT LTD', leftMargin, 40, {
      align: 'center',
      width: pageWidth,
    });

    doc.fontSize(8).font('Helvetica').text('S-201, SIGNATURE COMPLEX, ZYDUS HOSPITAL ROAD, THALTEJ, AHMEDABAD 380059', leftMargin, 55, {
      align: 'center',
      width: pageWidth,
    });

    doc.fontSize(10).font('Helvetica-Bold').text('SALARY SLIP', leftMargin, 85, {
      align: 'center',
      width: pageWidth,
      underline: true
    });

    let y = 115;
    doc.fontSize(10).font('Helvetica-Bold');

    const col1 = leftMargin;
    const col2 = leftMargin + 100;

    doc.text('Employee', col1, y);
    y += 15;
    doc.text('Name:', col1, y);
    doc.font('Helvetica').text(employee.employeeName, col2, y);

    y += 25;
    doc.font('Helvetica-Bold').text('Designation:', col1, y);
    doc.font('Helvetica').text(String(employee.post || ''), col2, y);

    y += 25;
    doc.font('Helvetica-Bold').text('Month & Year:', col1, y);
    doc.font('Helvetica').text(String(period.label || ''), col2, y);

    y += 35;
    doc.font('Helvetica-Bold').text('No of Days:', col1, y);
    doc.font('Helvetica').text(String(employee.totalDays || 0), col1 + 70, y);
    
    doc.font('Helvetica-Bold').text('Leaves:', leftMargin + pageWidth / 2, y);
    const leaves = toNumber(employee.totalDays) - toNumber(employee.presentDays) - toNumber(employee.weekOff) - toNumber(employee.otherAllowanceDays);
    const leavesStr = leaves > 0 ? String(leaves) : '0';
    doc.font('Helvetica').text(leavesStr, leftMargin + pageWidth / 2 + 50, y);

    y += 25;
    const tableLeft = leftMargin;
    const tableMid = leftMargin + pageWidth / 2;

    doc.fontSize(10).font('Helvetica-Bold');
    
    doc.rect(tableLeft, y, pageWidth / 2, 20).stroke();
    doc.rect(tableMid, y, pageWidth / 2, 20).stroke();

    doc.text('Earnings', tableLeft + 5, y + 5, { width: pageWidth / 2 - 10 });
    doc.text('Deductions', tableMid + 5, y + 5, { width: pageWidth / 2 - 10 });

    y += 20;

    const earnings = [
      ['Basic', formatCurrency(employee.earningBasic || employee.basic)],
      ['H.R.A', formatCurrency((toNumber(employee.hra) * toNumber(employee.totalDays)) / 30)],
      ['Conv.', formatCurrency((toNumber(employee.conveyance) * toNumber(employee.totalDays)) / 30)],
      ['Medical', formatCurrency((toNumber(employee.medical) * toNumber(employee.totalDays)) / 30)],
    ];

    const deductions = [
      ['Provident Fund', formatCurrency(employee.pfEmployee)],
      ['E.S.I.', formatCurrency(employee.esiEmployee)],
      ['Professional Tax', formatCurrency(employee.professionalTax)],
      ['Loan', formatCurrency(employee.advance)],
      ['TDS/IT', formatCurrency(employee.tds)],
    ];

    const maxRows = Math.max(earnings.length, deductions.length);
    doc.fontSize(10).font('Helvetica');

    for (let i = 0; i < maxRows; i += 1) {
      const rowHeight = 20;

      doc.rect(tableLeft, y, pageWidth / 2, rowHeight).stroke();
      doc.rect(tableMid, y, pageWidth / 2, rowHeight).stroke();

      if (i < earnings.length) {
        doc.text(earnings[i][0], tableLeft + 5, y + 5);
        let val = earnings[i][1];
        if (toNumber(val) === 0) val = '-';
        doc.text(val, tableLeft + pageWidth / 2 - 85, y + 5, {
          width: 80,
          align: 'right',
        });
      }

      if (i < deductions.length) {
        doc.text(deductions[i][0], tableMid + 5, y + 5);
        let val = deductions[i][1];
        if (toNumber(val) === 0) val = '-';
        doc.text(val, tableMid + pageWidth / 2 - 85, y + 5, {
          width: 80,
          align: 'right',
        });
      }

      y += rowHeight;
    }

    doc.rect(tableLeft, y, pageWidth / 2, 20).stroke();
    doc.rect(tableMid, y, pageWidth / 2, 20).stroke();

    doc.font('Helvetica-Bold');
    doc.text('Total Addition', tableLeft + 5, y + 5);
    doc.text(`RS. ${formatCurrency(employee.gross)}`, tableLeft + pageWidth / 2 - 105, y + 5, {
      width: 100,
      align: 'right',
    });

    doc.text('Paid Salary', tableMid + 5, y + 5);
    doc.text(formatCurrency(employee.netAmount), tableMid + pageWidth / 2 - 85, y + 5, {
      width: 80,
      align: 'right',
    });

    y += 20;

    doc.rect(tableLeft, y, pageWidth / 2, 20).stroke();
    doc.rect(tableMid, y, pageWidth / 2, 20).stroke();

    doc.font('Helvetica');
    doc.text('Incentive', tableLeft + 5, y + 5);
    let incentive = formatCurrency(employee.otherAllowance || employee.specialAllowance || 0);
    doc.text(incentive, tableLeft + pageWidth / 2 - 85, y + 5, {
      width: 80,
      align: 'right',
    });

    doc.end();
  });
}

module.exports = {
  createSlipFilename,
  generateSalarySlipPDF,
  sanitizeFilename,
};
