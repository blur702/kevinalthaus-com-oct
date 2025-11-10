
const Comment = require('./models/Comment');
const CommentSetting = require('./models/CommentSetting');
const routes = require('./routes');

module.exports = {
  name: 'Comments Plugin',
  version: '1.0.0',
  register: async (app, options) => {
    const sequelize = app.get('db').sequelize;
    const CommentModel = Comment(sequelize);
    const CommentSettingModel = CommentSetting(sequelize);

    app.set('db', {
      ...app.get('db'),
      Comment: CommentModel,
      CommentSetting: CommentSettingModel,
    });

    app.use('/api', routes(app, options));
  }
};
