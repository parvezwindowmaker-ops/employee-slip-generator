const express = require('express');
const multer = require('multer');
const { ZipArchive } = require('archiver');
const { Op } = require('sequelize');
const requireAdmin = require('../middleware/requireAdmin');
const { sequelize, PayrollPeriod, SalarySlip } = require('../models');
const { parsePayrollWorkbook } = require('../services/payrollParser');
const { createSlipFilename, generateSalarySlipPDF, sanitizeFilename } = require('../services/slipPdf');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

router.use(requireAdmin);

function isXlsxFile(fileName) {
  return /\.(xlsx|xls)$/i.test(fileName || '');
}

function buildSlipWhere(periodId, query) {
  const where = { payrollPeriodId: periodId };

  if (query.employeeId) {
    where.id = query.employeeId;
  }

  if (query.search) {
    where.employeeName = { [Op.iLike]: `%${String(query.search).trim()}%` };
  }

  return where;
}

async function findPeriod(req, res, next) {
  try {
    const period = await PayrollPeriod.findByPk(req.params.periodId);

    if (!period) {
      const error = new Error('Payroll period not found');
      error.status = 404;
      return next(error);
    }

    return period;
  } catch (error) {
    next(error);
    return null;
  }
}

router.get('/', async (req, res, next) => {
  try {
    const periods = await PayrollPeriod.findAll({
      order: [
        ['year', 'DESC'],
        ['month', 'DESC'],
      ],
    });

    res.json(periods);
  } catch (error) {
    next(error);
  }
});

router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      const error = new Error('XLSX file is required');
      error.status = 400;
      return next(error);
    }

    if (!isXlsxFile(req.file.originalname)) {
      const error = new Error('Only .xlsx and .xls files are supported');
      error.status = 400;
      return next(error);
    }

    // Validate month and year if provided
    if (req.body.month && (isNaN(req.body.month) || req.body.month < 1 || req.body.month > 12)) {
      const error = new Error('Invalid month. Must be between 1 and 12');
      error.status = 400;
      return next(error);
    }

    if (req.body.year && isNaN(req.body.year)) {
      const error = new Error('Invalid year');
      error.status = 400;
      return next(error);
    }

    let parsed;

    try {
      parsed = parsePayrollWorkbook(req.file.buffer, req.file.originalname, {
        month: req.body.month,
        year: req.body.year,
      });
    } catch (parseError) {
      const error = new Error(parseError.message);
      error.status = 400;
      return next(error);
    }

    const { results, skippedSheets, errors: parseWarnings } = parsed;

    if (!results || results.length === 0) {
      const error = new Error('No valid employee records found in file');
      error.status = 400;
      return next(error);
    }

    const importedPeriods = [];

    await sequelize.transaction(async (transaction) => {
      for (const { period, employees } of results) {
        if (!employees || employees.length === 0) continue;

        const totalNetPay = employees.reduce(
          (total, employee) => total + Number(employee.netAmount || 0),
          0,
        );

        const [payrollPeriod, created] = await PayrollPeriod.findOrCreate({
          where: {
            month: period.month,
            year: period.year,
          },
          defaults: {
            ...period,
            sourceFileName: req.file.originalname,
            employeeCount: employees.length,
            totalNetPay,
            uploadedAt: new Date(),
            uploadedByAdminId: req.admin.id,
          },
          transaction,
        });

        await payrollPeriod.update({
          label: period.label,
          sourceFileName: req.file.originalname,
          employeeCount: employees.length,
          totalNetPay,
          uploadedAt: new Date(),
          uploadedByAdminId: req.admin.id,
        }, { transaction });

        await SalarySlip.destroy({
          where: { payrollPeriodId: payrollPeriod.id },
          transaction,
        });

        await SalarySlip.bulkCreate(
          employees.map((employee) => ({
            ...employee,
            payrollPeriodId: payrollPeriod.id,
          })),
          { transaction },
        );

        importedPeriods.push({
          period: payrollPeriod,
          employeesImported: employees.length,
          replacedExisting: !created,
        });
      }
    });

    // Reload all saved periods to get updated data
    for (const entry of importedPeriods) {
      await entry.period.reload();
    }

    const totalEmployees = importedPeriods.reduce((sum, p) => sum + p.employeesImported, 0);

    // Build response — keep backwards compatibility for single-period uploads
    // while also providing full multi-period info
    const response = {
      periods: importedPeriods.map((entry) => ({
        period: entry.period,
        employeesImported: entry.employeesImported,
        replacedExisting: entry.replacedExisting,
      })),
      totalPeriodsImported: importedPeriods.length,
      totalEmployeesImported: totalEmployees,
      // Backwards compat: also include first period as "period" for single-sheet uploads
      period: importedPeriods[0]?.period || null,
      employeesImported: totalEmployees,
    };

    if (skippedSheets.length > 0) {
      response.skippedSheets = skippedSheets;
    }
    if (parseWarnings.length > 0) {
      response.warnings = parseWarnings;
    }

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

router.get('/slips/multi-period-download', async (req, res, next) => {
  try {
    const { employeeName, periodIds } = req.query;

    if (!employeeName || !periodIds) {
      const error = new Error('Both employeeName and periodIds query parameters are required');
      error.status = 400;
      return next(error);
    }

    const parsedPeriodIds = periodIds.split(',').map((id) => parseInt(id.trim(), 10));

    if (parsedPeriodIds.some(isNaN)) {
      const error = new Error('periodIds must be a comma-separated list of integers');
      error.status = 400;
      return next(error);
    }

    const periods = await PayrollPeriod.findAll({
      where: { id: { [Op.in]: parsedPeriodIds } },
    });

    if (periods.length === 0) {
      const error = new Error('No payroll periods found for the given IDs');
      error.status = 404;
      return next(error);
    }

    const files = [];

    for (const period of periods) {
      const slip = await SalarySlip.findOne({
        where: {
          payrollPeriodId: period.id,
          employeeName: { [Op.iLike]: employeeName },
        },
      });

      if (!slip) continue;

      try {
        const buffer = await generateSalarySlipPDF(slip, period);
        files.push({
          name: createSlipFilename(slip, period),
          buffer,
        });
      } catch (slipError) {
        console.error(`Failed to generate PDF for slip ${slip.id}:`, slipError);
        throw new Error(`Failed to generate PDF for period ${period.label}: ${slipError.message}`);
      }
    }

    if (files.length === 0) {
      const error = new Error(`No salary slips found for employee "${employeeName}" in the selected periods`);
      error.status = 404;
      return next(error);
    }

    const archiveName = `Salary_Slips_${sanitizeFilename(employeeName)}_Multi_Period.zip`;
    const archive = new ZipArchive({ zlib: { level: 9 } });

    archive.on('error', (error) => {
      console.error('Archive error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to generate archive' });
      } else {
        res.destroy();
      }
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${archiveName}"`);

    archive.pipe(res);

    try {
      files.forEach((file) => {
        archive.append(file.buffer, { name: file.name });
      });
      await archive.finalize();
    } catch (finalizeError) {
      console.error('Archive finalize error:', finalizeError);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to finalize archive' });
      } else {
        res.destroy();
      }
    }
  } catch (error) {
    next(error);
  }
});

router.get('/:periodId/slips', async (req, res, next) => {
  try {
    const period = await findPeriod(req, res, next);
    if (!period) return;

    const slips = await SalarySlip.findAll({
      where: buildSlipWhere(period.id, req.query),
      order: [
        ['employeeName', 'ASC'],
        ['serialNumber', 'ASC'],
      ],
    });

    res.json({ period, slips });
  } catch (error) {
    next(error);
  }
});

router.get('/:periodId/slips/:slipId/pdf', async (req, res, next) => {
  try {
    const period = await findPeriod(req, res, next);
    if (!period) return;

    const slip = await SalarySlip.findOne({
      where: {
        id: req.params.slipId,
        payrollPeriodId: period.id,
      },
    });

    if (!slip) {
      const error = new Error('Salary slip not found');
      error.status = 404;
      return next(error);
    }

    const pdf = await generateSalarySlipPDF(slip, period);
    const filename = createSlipFilename(slip, period);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

router.get('/:periodId/slips/download', async (req, res, next) => {
  try {
    const period = await findPeriod(req, res, next);
    if (!period) return;

    const slips = await SalarySlip.findAll({
      where: buildSlipWhere(period.id, req.query),
      order: [
        ['employeeName', 'ASC'],
        ['serialNumber', 'ASC'],
      ],
    });

    if (slips.length === 0) {
      const error = new Error('No salary slips matched the selected filters');
      error.status = 404;
      return next(error);
    }

    const files = [];

    // Generate PDFs sequentially with proper error handling
    try {
      for (const slip of slips) {
        try {
          const buffer = await generateSalarySlipPDF(slip, period);
          files.push({
            name: createSlipFilename(slip, period),
            buffer,
          });
        } catch (slipError) {
          console.error(`Failed to generate PDF for slip ${slip.id}:`, slipError);
          throw new Error(`Failed to generate PDF for employee ${slip.employeeName}: ${slipError.message}`);
        }
      }
    } catch (pdfError) {
      const error = new Error(pdfError.message || 'Failed to generate salary slip PDFs');
      error.status = 500;
      return next(error);
    }

    const suffix = req.query.employeeId || req.query.search
      ? sanitizeFilename(req.query.search || slips[0].employeeName)
      : 'All_Employees';
    const archiveName = `Salary_Slips_${sanitizeFilename(period.label)}_${suffix}.zip`;
    const archive = new ZipArchive({ zlib: { level: 9 } });

    // Handle archive errors
    archive.on('error', (error) => {
      console.error('Archive error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to generate archive' });
      } else {
        res.destroy();
      }
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${archiveName}"`);

    archive.pipe(res);
    
    try {
      files.forEach((file) => {
        archive.append(file.buffer, { name: file.name });
      });
      await archive.finalize();
    } catch (finalizeError) {
      console.error('Archive finalize error:', finalizeError);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to finalize archive' });
      } else {
        res.destroy();
      }
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
