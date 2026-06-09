const fs = require('fs');
const path = require('path');
const { generateSalarySlipPDF, createSlipFilename } = require('../services/slipPdf');

const sampleEmployee = {
  employeeName: 'John Doe',
  post: 'Sales Executive',
  totalDays: 30,
  presentDays: 28,
  weekOff: 2,
  otherAllowanceDays: 0,
  earningBasic: 20000,
  basic: 20000,
  hra: 3000,
  conveyance: 800,
  medical: 200,
  pfEmployee: 2400,
  esiEmployee: 0,
  professionalTax: 200,
  advance: 0,
  tds: 0,
  gross: 24000,
  netAmount: 21200,
  otherAllowance: 0,
  specialAllowance: 0,
};

const samplePeriod = { label: 'APR-2026', month: 'APR', year: '2026' };

(async () => {
  try {
    const buffer = await generateSalarySlipPDF(sampleEmployee, samplePeriod);
    const filename = createSlipFilename(sampleEmployee, samplePeriod);
    const outDir = path.join(__dirname, '..', 'public', 'Salary_Slips', 'TEST');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, filename);
    fs.writeFileSync(outPath, buffer);
    console.log('Generated test PDF at:', outPath);
  } catch (err) {
    console.error('Failed to generate PDF:', err);
    process.exit(1);
  }
})();
