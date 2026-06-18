const sequelize = require('../config/database');
const Admin = require('./Admin');
const PayrollPeriod = require('./PayrollPeriod');
const SalarySlip = require('./SalarySlip');
const Setting = require('./Setting');

Admin.hasMany(PayrollPeriod, {
  as: 'uploadedPayrollPeriods',
  foreignKey: 'uploadedByAdminId',
});

PayrollPeriod.belongsTo(Admin, {
  as: 'uploadedBy',
  foreignKey: 'uploadedByAdminId',
});

PayrollPeriod.hasMany(SalarySlip, {
  as: 'salarySlips',
  foreignKey: 'payrollPeriodId',
  onDelete: 'CASCADE',
});

SalarySlip.belongsTo(PayrollPeriod, {
  as: 'payrollPeriod',
  foreignKey: 'payrollPeriodId',
});

module.exports = {
  sequelize,
  Admin,
  PayrollPeriod,
  SalarySlip,
  Setting,
};
