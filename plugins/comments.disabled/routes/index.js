const express = require('express');
const Joi = require('joi');

module.exports = (app, options) => {
  const router = express.Router();
  const { Comment, CommentSetting } = app.get('db');

  router.post('/comments', async (req, res) => {
    const schema = Joi.object({
      content: Joi.string().required(),
      author: Joi.string().required(),
      nodeId: Joi.number().integer().required(),
      contentType: Joi.string().required(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { content, author, nodeId, contentType } = value;
    const comment = await Comment.create({ content, author, nodeId, contentType });
    res.status(201).json(comment);
  });

  router.get('/comments/:contentType/:nodeId', async (req, res) => {
    const { contentType, nodeId } = req.params;
    const comments = await Comment.findAll({
      where: {
        contentType,
        nodeId,
        status: 'approved',
      },
    });
    res.json(comments);
  });

  router.put('/comments/:id', async (req, res) => {
    const schema = Joi.object({
      status: Joi.string().valid('pending', 'approved', 'rejected').required(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { id } = req.params;
    const { status } = value;
    const comment = await Comment.findByPk(id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    comment.status = status;
    await comment.save();
    res.json(comment);
  });

  router.delete('/comments/:id', async (req, res) => {
    const { id } = req.params;
    const comment = await Comment.findByPk(id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    await comment.destroy();
    res.status(204).send();
  });

  router.get('/comments/settings/:contentType/:nodeId', async (req, res) => {
    const { contentType, nodeId } = req.params;
    const settings = await CommentSetting.findOne({
      where: {
        contentType,
        nodeId,
      },
    });
    res.json(settings || { enabled: true, frozen: false });
  });

  router.put('/comments/settings/:contentType/:nodeId', async (req, res) => {
    const schema = Joi.object({
      enabled: Joi.boolean(),
      frozen: Joi.boolean(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { contentType, nodeId } = req.params;
    const { enabled, frozen } = value;
    let settings = await CommentSetting.findOne({
      where: {
        contentType,
        nodeId,
      },
    });
    if (!settings) {
      settings = await CommentSetting.create({ contentType, nodeId, enabled, frozen });
    } else {
      settings.enabled = enabled;
      settings.frozen = frozen;
      await settings.save();
    }
    res.json(settings);
  });

  return router;
};
