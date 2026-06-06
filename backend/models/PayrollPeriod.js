const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PayrollPeriod = sequelize.define('PayrollPeriod', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  month: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 12,
    },
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 2000,
      max: 2100,
    },
  },
  label: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  sourceFileName: {
    type: DataTypes.STRING,
  },
  employeeCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  totalNetPay: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0,
  },
  uploadedAt: {
    type: DataTypes.DATE,
  },
}, {
  tableName: 'payroll_periods',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['month', 'year'],
    },
  ],
});

module.exports = PayrollPeriod;
