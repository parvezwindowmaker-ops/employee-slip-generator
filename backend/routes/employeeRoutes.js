const express = require('express');
const requireAdmin = require('../middleware/requireAdmin');
const { PayrollPeriod, SalarySlip } = require('../models');

const router = express.Router();

router.use(requireAdmin);

router.get('/', async (req, res, next) => {
  try {
    let periodId = req.query.periodId;

    if (!periodId) {
      const latestPeriod = await PayrollPeriod.findOne({
        order: [
          ['year', 'DESC'],
          ['month', 'DESC'],
        ],
      });

      periodId = latestPeriod?.id;
    }

    if (!periodId) {
      return res.json([]);
    }

    const slips = await SalarySlip.findAll({
      where: { payrollPeriodId: periodId },
      order: [
        ['employeeName', 'ASC'],
        ['serialNumber', 'ASC'],
      ],
    });

    res.json(slips);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
