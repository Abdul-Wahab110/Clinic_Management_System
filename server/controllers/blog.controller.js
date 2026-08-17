const blogService = require('../services/blog.service');
const { sendSuccess, sendCreated } = require('../utils/response');

async function listPublicArticles(req, res, next) {
  try {
    const result = await blogService.listPublicArticles(req.query);
    return sendSuccess(res, result.articles, 'Published articles retrieved successfully.', 200, {
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

async function getArticleBySlug(req, res, next) {
  try {
    const result = await blogService.getArticleBySlug(req.params.slug);
    return sendSuccess(res, result, 'Article retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function listCategories(req, res, next) {
  try {
    const categories = await blogService.listCategories();
    return sendSuccess(res, categories, 'Blog categories retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function listPopularTags(req, res, next) {
  try {
    const tags = await blogService.listPopularTags();
    return sendSuccess(res, tags, 'Popular tags retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getFeaturedArticles(req, res, next) {
  try {
    const featured = await blogService.getFeaturedArticles(req.query.limit);
    return sendSuccess(res, featured, 'Featured articles retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function listAdminArticles(req, res, next) {
  try {
    const result = await blogService.listAdminArticles(req.query);
    return sendSuccess(res, result.articles, 'Admin articles retrieved successfully.', 200, {
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

async function getArticleById(req, res, next) {
  try {
    const article = await blogService.getArticleById(req.params.id);
    return sendSuccess(res, article, 'Article retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function createArticle(req, res, next) {
  try {
    const result = await blogService.createArticle(req.body, req.user);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function updateArticle(req, res, next) {
  try {
    const result = await blogService.updateArticle(req.params.id, req.body);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function publishArticle(req, res, next) {
  try {
    const result = await blogService.publishArticle(req.params.id);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function unpublishArticle(req, res, next) {
  try {
    const result = await blogService.unpublishArticle(req.params.id);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function deleteArticle(req, res, next) {
  try {
    const result = await blogService.deleteArticle(req.params.id);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listPublicArticles,
  getArticleBySlug,
  listCategories,
  listPopularTags,
  getFeaturedArticles,
  listAdminArticles,
  getArticleById,
  createArticle,
  updateArticle,
  publishArticle,
  unpublishArticle,
  deleteArticle
};
