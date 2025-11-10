const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class CommentSetting extends Model {}

  CommentSetting.init({
    nodeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    contentType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    frozen: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    sequelize,
    modelName: 'CommentSetting',
  });

  return CommentSetting;
};
