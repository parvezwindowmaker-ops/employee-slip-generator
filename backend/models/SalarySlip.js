const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

function moneyField() {
  return {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0,
  };
}

const SalarySlip = sequelize.define('SalarySlip', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  payrollPeriodId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  serialNumber: {
    type: DataTypes.INTEGER,
  },
  employeeName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  departmentGroup: {
    type: DataTypes.STRING,
  },
  post: {
    type: DataTypes.STRING,
  },
  status: {
    type: DataTypes.STRING,
  },
  pfStatus: {
    type: DataTypes.STRING,
  },
  pfEligible: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  uanNumber: {
    type: DataTypes.STRING,
  },
  salaryAmount: moneyField(),
  basic: moneyField(),
  hra: moneyField(),
  conveyance: moneyField(),
  medical: moneyField(),
  specialAllowance: moneyField(),
  totalEarningsFixed: moneyField(),
  pfSalary: moneyField(),
  presentDays: moneyField(),
  weekOff: moneyField(),
  otherAllowanceDays: moneyField(),
  totalDays: moneyField(),
  earnedTotal: moneyField(),
  otherAllowance: moneyField(),
  gross: moneyField(),
  earningBasic: moneyField(),
  pfEmployee: moneyField(),
  pfEmployer: moneyField(),
  esiEmployee: moneyField(),
  esiEmployer: moneyField(),
  professionalTax: moneyField(),
  tds: moneyField(),
  advance: moneyField(),
  meal: moneyField(),
  store: moneyField(),
  otherDeduction: moneyField(),
  totalDeductions: moneyField(),
  netAmount: moneyField(),
  aadhar: {
    type: DataTypes.STRING,
  },
  pan: {
    type: DataTypes.STRING,
  },
  bankAccount: {
    type: DataTypes.STRING,
  },
  ifsc: {
    type: DataTypes.STRING,
  },
  mobile: {
    type: DataTypes.STRING,
  },
  rawData: {
    type: DataTypes.JSONB,
  },
}, {
  tableName: 'salary_slips',
  timestamps: true,
  indexes: [
    {
      fields: ['payrollPeriodId'],
    },
    {
      fields: ['employeeName'],
    },
  ],
});

module.exports = SalarySlip;
