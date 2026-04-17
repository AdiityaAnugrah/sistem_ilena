const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TutorialVideo = sequelize.define('tutorial_videos', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  form_type: {
    type: DataTypes.ENUM('PENJUALAN_OFFLINE', 'PENJUALAN_INTERIOR'),
    allowNull: false,
    unique: true,
  },
  youtube_url: { type: DataTypes.STRING(255), allowNull: false },
  start_second: { type: DataTypes.INTEGER, defaultValue: 0 },
  end_second: { type: DataTypes.INTEGER, defaultValue: null },
  active: { type: DataTypes.TINYINT(1), defaultValue: 1 },
  updated_by: { type: DataTypes.INTEGER, defaultValue: null },
}, { timestamps: false });

module.exports = TutorialVideo;
