const db = require('../config/db');
const { NotFoundError, ConflictError } = require('../utils/errors');

/**
 * Generate a clean SEO Slug from Title
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Ensure unique slug in database
 */
async function generateUniqueSlug(title, currentId = null) {
  let baseSlug = slugify(title);
  if (!baseSlug) baseSlug = 'medical-article';
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const query = currentId
      ? 'SELECT id FROM blog_posts WHERE slug = ? AND id != ?'
      : 'SELECT id FROM blog_posts WHERE slug = ?';
    const params = currentId ? [slug, currentId] : [slug];

    const [rows] = await db.query(query, params);
    if (rows.length === 0) return slug;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

/**
 * 1. Public List Articles (Published only, with Search, Category, Tag, Featured filters)
 */
async function listPublicArticles(query = {}) {
  const { category, tag, search, featured, page = 1, limit = 12 } = query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 12));
  const offset = (pageNum - 1) * limitNum;

  const conditions = ["status = 'published'"];
  const params = [];

  if (category && category !== 'all') {
    conditions.push('(category_name = ? OR category_id = (SELECT id FROM blog_categories WHERE slug = ? LIMIT 1))');
    params.push(category, category);
  }

  if (tag && tag.trim().length > 0) {
    conditions.push('tags LIKE ?');
    params.push(`%${tag.trim()}%`);
  }

  if (featured === 'true' || featured === '1') {
    conditions.push('is_featured = 1');
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(title LIKE ? OR summary LIKE ? OR content LIKE ? OR tags LIKE ?)');
    params.push(term, term, term, term);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const [countRows] = await db.query(
    `SELECT COUNT(*) as total FROM blog_posts ${whereClause}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await db.query(
    `SELECT 
      id, title, slug, summary, author_name, category_name, tags, featured_image,
      is_featured, views_count, reading_time_minutes, published_at, created_at
    FROM blog_posts
    ${whereClause}
    ORDER BY is_featured DESC, published_at DESC
    LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  return {
    articles: rows,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
}

/**
 * 2. Get Public Article by Slug with View Counter & Related Articles
 */
async function getArticleBySlug(slug) {
  const [rows] = await db.query(
    `SELECT * FROM blog_posts WHERE slug = ? AND status = 'published'`,
    [slug]
  );

  if (rows.length === 0) {
    throw new NotFoundError(`Article with slug '${slug}' not found.`);
  }

  const article = rows[0];

  // Atomically increment views count
  await db.query('UPDATE blog_posts SET views_count = views_count + 1 WHERE id = ?', [article.id]);
  article.views_count += 1;

  // Fetch 3 Related Articles in the same category or related topics
  const [related] = await db.query(
    `SELECT id, title, slug, summary, category_name, featured_image, reading_time_minutes, published_at
     FROM blog_posts
     WHERE status = 'published' AND id != ? AND category_name = ?
     ORDER BY published_at DESC
     LIMIT 3`,
    [article.id, article.category_name]
  );

  return {
    article,
    related_articles: related
  };
}

/**
 * 3. List Blog Categories with Article Count
 */
async function listCategories() {
  const [categories] = await db.query(`
    SELECT 
      c.*,
      (SELECT COUNT(*) FROM blog_posts p WHERE (p.category_id = c.id OR p.category_name = c.name) AND p.status = 'published') as articles_count
    FROM blog_categories c
    ORDER BY articles_count DESC, c.name ASC
  `);
  return categories;
}

/**
 * 4. List Popular Tags
 */
async function listPopularTags() {
  const [rows] = await db.query(
    `SELECT tags FROM blog_posts WHERE status = 'published' AND tags IS NOT NULL`
  );

  const tagCounts = {};
  rows.forEach(r => {
    if (r.tags) {
      r.tags.split(',').forEach(t => {
        const clean = t.trim();
        if (clean.length > 1) {
          tagCounts[clean] = (tagCounts[clean] || 0) + 1;
        }
      });
    }
  });

  return Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

/**
 * 5. Get Featured Articles
 */
async function getFeaturedArticles(limit = 3) {
  const [rows] = await db.query(
    `SELECT id, title, slug, summary, author_name, category_name, tags, featured_image, is_featured, reading_time_minutes, published_at
     FROM blog_posts
     WHERE status = 'published' AND is_featured = 1
     ORDER BY published_at DESC
     LIMIT ?`,
    [Math.min(10, parseInt(limit, 10) || 3)]
  );
  return rows;
}

/**
 * 6. Admin: List All Articles (Drafts, Published, Archived)
 */
async function listAdminArticles(query = {}) {
  const { status, category, search, page = 1, limit = 50 } = query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  const params = [];

  if (status && status !== 'all') {
    conditions.push('status = ?');
    params.push(status);
  }

  if (category && category !== 'all') {
    conditions.push('category_name = ?');
    params.push(category);
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(title LIKE ? OR author_name LIKE ? OR tags LIKE ?)');
    params.push(term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await db.query(
    `SELECT COUNT(*) as total FROM blog_posts ${whereClause}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await db.query(
    `SELECT * FROM blog_posts
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  return {
    articles: rows,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
}

/**
 * 7. Admin: Get Article By ID
 */
async function getArticleById(id) {
  const [rows] = await db.query('SELECT * FROM blog_posts WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('Article not found.');
  return rows[0];
}

/**
 * 8. Admin: Create Article
 */
async function createArticle(data, user) {
  const title = data.title.trim();
  const slug = data.slug && data.slug.trim().length > 0 
    ? slugify(data.slug) 
    : await generateUniqueSlug(title);

  // Compute approximate reading time (approx 200 words/min)
  const wordCount = (data.content || '').split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  const status = data.status || 'draft';
  const publishedAt = status === 'published' ? new Date() : (data.published_at || null);

  const [res] = await db.query(
    `INSERT INTO blog_posts 
     (title, slug, summary, content, author_id, author_name, category_id, category_name, tags, featured_image, is_featured, status, seo_title, meta_description, reading_time_minutes, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      title,
      slug,
      data.summary || title,
      data.content,
      user ? user.id : null,
      data.author_name || (user ? user.name : 'AuraCare Clinical Team'),
      data.category_id || null,
      data.category_name || 'General Health',
      data.tags || 'Healthcare',
      data.featured_image || '/images/blog-default.jpg',
      data.is_featured ? 1 : 0,
      status,
      data.seo_title || title,
      data.meta_description || data.summary || title,
      readingTime,
      publishedAt
    ]
  );

  return {
    id: res.insertId,
    title,
    slug,
    status,
    message: 'Medical article created successfully.'
  };
}

/**
 * 9. Admin: Update Article
 */
async function updateArticle(id, data) {
  const [existing] = await db.query('SELECT * FROM blog_posts WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Article not found.');
  const curr = existing[0];

  let slug = curr.slug;
  if (data.slug && data.slug !== curr.slug) {
    slug = await generateUniqueSlug(data.slug, id);
  } else if (data.title && data.title !== curr.title && !data.slug) {
    slug = await generateUniqueSlug(data.title, id);
  }

  let readingTime = curr.reading_time_minutes;
  if (data.content) {
    const wordCount = data.content.split(/\s+/).filter(Boolean).length;
    readingTime = Math.max(1, Math.ceil(wordCount / 200));
  }

  let publishedAt = curr.published_at;
  const status = data.status || curr.status;
  if (status === 'published' && !publishedAt) {
    publishedAt = new Date();
  }

  await db.query(
    `UPDATE blog_posts SET 
      title = ?,
      slug = ?,
      summary = ?,
      content = ?,
      author_name = ?,
      category_name = ?,
      tags = ?,
      featured_image = ?,
      is_featured = ?,
      status = ?,
      seo_title = ?,
      meta_description = ?,
      reading_time_minutes = ?,
      published_at = ?
     WHERE id = ?`,
    [
      data.title !== undefined ? data.title.trim() : curr.title,
      slug,
      data.summary !== undefined ? data.summary : curr.summary,
      data.content !== undefined ? data.content : curr.content,
      data.author_name !== undefined ? data.author_name : curr.author_name,
      data.category_name !== undefined ? data.category_name : curr.category_name,
      data.tags !== undefined ? data.tags : curr.tags,
      data.featured_image !== undefined ? data.featured_image : curr.featured_image,
      data.is_featured !== undefined ? (data.is_featured ? 1 : 0) : curr.is_featured,
      status,
      data.seo_title !== undefined ? data.seo_title : curr.seo_title,
      data.meta_description !== undefined ? data.meta_description : curr.meta_description,
      readingTime,
      publishedAt,
      id
    ]
  );

  return { id, slug, status, message: 'Article updated successfully.' };
}

/**
 * 10. Admin: Publish Article
 */
async function publishArticle(id) {
  const [rows] = await db.query('SELECT * FROM blog_posts WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('Article not found.');
  await db.query(`UPDATE blog_posts SET status = 'published', published_at = COALESCE(published_at, NOW()) WHERE id = ?`, [id]);
  return { id, status: 'published', message: 'Article published successfully.' };
}

/**
 * 11. Admin: Unpublish Article (Revert to Draft)
 */
async function unpublishArticle(id) {
  const [rows] = await db.query('SELECT * FROM blog_posts WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('Article not found.');
  await db.query(`UPDATE blog_posts SET status = 'draft' WHERE id = ?`, [id]);
  return { id, status: 'draft', message: 'Article unpublished and reverted to draft.' };
}

/**
 * 12. Admin: Delete Article
 */
async function deleteArticle(id) {
  const [rows] = await db.query('SELECT * FROM blog_posts WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('Article not found.');
  await db.query('DELETE FROM blog_posts WHERE id = ?', [id]);
  return { id, message: 'Article deleted successfully.' };
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
