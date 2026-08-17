const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blog.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { validateCreateArticle, validateUpdateArticle } = require('../validators/blog.validator');

// --- PUBLIC ROUTES ---

// 1. List Public Articles with filters (category, tag, search, featured)
router.get('/', blogController.listPublicArticles);
router.get('/posts', blogController.listPublicArticles);
router.get('/articles', blogController.listPublicArticles);

// 2. Get Featured Articles
router.get('/featured', blogController.getFeaturedArticles);

// 3. List Categories with counts
router.get('/categories', blogController.listCategories);

// 4. List Popular Tags
router.get('/tags', blogController.listPopularTags);

// 5. Get Public Article by SEO Slug
router.get('/articles/:slug', blogController.getArticleBySlug);

// --- ADMIN / CMS ROUTES ---

// 6. Admin: List all articles (including drafts)
router.get(
  '/admin/articles',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor'),
  blogController.listAdminArticles
);

// 7. Admin: Get article by ID
router.get(
  '/admin/articles/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor'),
  blogController.getArticleById
);

// 8. Admin: Create new article
router.post(
  '/admin/articles',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor'),
  validate(validateCreateArticle),
  blogController.createArticle
);

// 9. Admin: Update article
router.put(
  '/admin/articles/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor'),
  validate(validateUpdateArticle),
  blogController.updateArticle
);

// 10. Admin: Publish article
router.patch(
  '/admin/articles/:id/publish',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor'),
  blogController.publishArticle
);

// 11. Admin: Unpublish article (Draft)
router.patch(
  '/admin/articles/:id/unpublish',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor'),
  blogController.unpublishArticle
);

// 12. Admin: Delete article
router.delete(
  '/admin/articles/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  blogController.deleteArticle
);

module.exports = router;
