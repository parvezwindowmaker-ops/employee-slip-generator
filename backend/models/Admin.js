const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { hashPassword } = require('../utils/password');

const Admin = sequelize.define('Admin', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Administrator',
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  lastLoginAt: {
    type: DataTypes.DATE,
  },
}, {
  tableName: 'admins',
  timestamps: true,
  defaultScope: {
    attributes: { exclude: ['passwordHash'] },
  },
});

Admin.beforeCreate(async (admin) => {
  if (admin.changed('passwordHash') && !admin.passwordHash.includes(':')) {
    admin.passwordHash = await hashPassword(admin.passwordHash);
  }
});

Admin.beforeUpdate(async (admin) => {
  if (admin.changed('passwordHash') && !admin.passwordHash.includes(':')) {
    admin.passwordHash = await hashPassword(admin.passwordHash);
  }
});

module.exports = Admin;
