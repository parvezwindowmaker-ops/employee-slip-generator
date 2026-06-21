const fs = require('fs');
const path = require('path');
const { generateSalarySlipPDF } = require('../services/slipPdf');

const mockEmployee = {
  employeeName: 'Kevin Gladvin Rozario',
  serialNumber: 'ETPL112955',
  departmentGroup: 'Human Resources',
  post: 'Front Desk Executive',
  bankAccount: '40890685795',
  pfStatus: 'Yes',
  uanNumber: '101968504183',
  totalDays: 28,
  presentDays: 24,
  weekOff: 4,
  otherAllowanceDays: 0,
  basic: 7877,
  hra: 5908,
  meal: 0,
  otherAllowance: 1533,
  medical: 1250,
  conveyance: 0,
  specialAllowance: 0,
  pfEmployee: 945,
  esiEmployee: 0,
  professionalTax: 200,
  tds: 0,
  advance: 0,
  store: 0,
  otherDeduction: 0,
  gross: 22333,
  netAmount: 21188
};

const mockPeriod = {
  label: 'Apr-2024',
  month: '04',
  year: '2024'
};

async function run() {
  try {
    // Test 1: Without signature
    const pdfBuffer1 = await generateSalarySlipPDF(mockEmployee, mockPeriod, { includeSignature: false });
    fs.writeFileSync(path.join(__dirname, '..', 'test_slip_no_sig.pdf'), pdfBuffer1);
    console.log('Successfully generated test_slip_no_sig.pdf');

    // Create a dummy signature image
    const dummySignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

    // Test 2: With signature
    const pdfBuffer2 = await generateSalarySlipPDF(mockEmployee, mockPeriod, { includeSignature: true, signature: dummySignature });
    fs.writeFileSync(path.join(__dirname, '..', 'test_slip_with_sig.pdf'), pdfBuffer2);
    console.log('Successfully generated test_slip_with_sig.pdf');

  } catch (err) {
    console.error('Error generating PDF:', err);
  }
}

run();
