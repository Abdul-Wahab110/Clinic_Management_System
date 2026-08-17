const blogService = require('../server/services/blog.service');
const db = require('../server/config/db');

async function runBlogIntegrationTests() {
  console.log('🧪 Starting Healthcare Blog & Medical Articles CMS Module Integration Tests...\n');
  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      testsPassed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      testsFailed++;
    }
  }

  try {
    const adminUser = { id: 1, name: 'Dr. Administrator', role: 'super_admin' };

    // Test Suite 1: Public Article Discovery & Filtering
    console.log('--- Test Suite 1: Public Article Discovery & Filtering ---');
    const pubList = await blogService.listPublicArticles({ page: 1, limit: 10 });
    assert(pubList.articles.length >= 6, 'Retrieves all published clinical articles from MySQL');
    assert(pubList.hasOwnProperty('pagination'), 'Includes pagination metadata');
    assert(pubList.articles[0].hasOwnProperty('slug'), 'Articles have SEO slug');
    assert(pubList.articles[0].hasOwnProperty('reading_time_minutes'), 'Articles have estimated reading time');

    // Search
    const searchRes = await blogService.listPublicArticles({ search: 'Cardiovascular' });
    assert(searchRes.articles.length >= 1, 'Search finds article with term "Cardiovascular"');

    // Category Filter
    const catRes = await blogService.listPublicArticles({ category: 'Cardiology & Heart Health' });
    assert(catRes.articles.length >= 1, 'Filter finds articles in Cardiology & Heart Health category');
    assert(catRes.articles.every(a => a.category_name === 'Cardiology & Heart Health'), 'All filtered articles belong to specified category');

    // Tag Filter
    const tagRes = await blogService.listPublicArticles({ tag: 'BE-FAST' });
    assert(tagRes.articles.length >= 1, 'Filter finds articles tagged with "BE-FAST"');

    // Test Suite 2: Featured Articles & Categories
    console.log('\n--- Test Suite 2: Featured Articles & Categories ---');
    const featArticles = await blogService.getFeaturedArticles(3);
    assert(featArticles.length >= 1, 'Retrieves featured articles');
    assert(featArticles.every(a => a.is_featured === 1), 'All returned articles have is_featured = 1');

    const categories = await blogService.listCategories();
    assert(categories.length >= 6, 'Retrieves all 6 healthcare categories');
    assert(categories[0].hasOwnProperty('articles_count'), 'Categories include dynamic article counts');

    const tags = await blogService.listPopularTags();
    assert(Array.isArray(tags) && tags.length >= 5, 'Retrieves aggregated popular tags');
    assert(tags[0].hasOwnProperty('tag') && tags[0].hasOwnProperty('count'), 'Tag objects contain tag name and frequency count');

    // Test Suite 3: Single Article by SEO Slug & View Tracking
    console.log('\n--- Test Suite 3: Single Article by SEO Slug & View Tracking ---');
    const targetSlug = 'early-detection-cardiovascular-disease';
    const beforeArticle = await blogService.getArticleBySlug(targetSlug);
    const initialViews = beforeArticle.article.views_count;

    const afterArticle = await blogService.getArticleBySlug(targetSlug);
    assert(afterArticle.article.slug === targetSlug, 'Retrieves article by exact SEO slug');
    assert(afterArticle.article.views_count === initialViews + 1, 'Atomically increments article views_count in MySQL');
    assert(Array.isArray(afterArticle.related_articles), 'Returns related articles array');
    assert(afterArticle.related_articles.every(r => r.id !== afterArticle.article.id), 'Related articles exclude the current article');

    // Test Suite 4: Admin Article Creation & Slug Generation
    console.log('\n--- Test Suite 4: Admin Article Creation & Slug Generation ---');
    const createRes = await blogService.createArticle({
      title: 'Advanced Robotic Surgery in Modern Urological Oncology',
      summary: 'Exploring da Vinci robotic surgical systems in prostatectomy and kidney-sparing oncology.',
      content: 'Robotic-assisted laparoscopic surgery offers unmatched 3D high-definition visualization and wristed instrumentation with 7 degrees of freedom.\n\n### Clinical Advantages\n- Substantially decreased intraoperative blood loss.\n- Shorter hospital length of stay.\n- Accelerated postoperative functional recovery.',
      category_name: 'General Medicine',
      tags: 'Robotic Surgery, Oncology, Urology, Innovation',
      featured_image: '/images/blog-robotics.jpg',
      is_featured: 1,
      status: 'draft',
      seo_title: 'Advanced Robotic Surgery in Urological Oncology | AuraCare',
      meta_description: 'Discover how robotic-assisted surgical systems are transforming modern urological oncology outcomes.'
    }, adminUser);

    assert(createRes.id !== undefined, 'New medical article created in MySQL');
    assert(createRes.slug === 'advanced-robotic-surgery-in-modern-urological-oncology', 'Auto-generates clean SEO-friendly slug');
    assert(createRes.status === 'draft', 'Article initially saved as draft');

    // Test Suite 5: Admin Edit & Update
    console.log('\n--- Test Suite 5: Admin Edit & Update ---');
    const updateRes = await blogService.updateArticle(createRes.id, {
      title: 'Advanced Robotic Surgery in Modern Urological Oncology (Updated)',
      category_name: 'Surgery & Oncology'
    });
    assert(updateRes.status === 'draft', 'Updated article successfully');

    const updatedArticle = await blogService.getArticleById(createRes.id);
    assert(updatedArticle.title.includes('(Updated)'), 'Title updated in MySQL');
    assert(updatedArticle.category_name === 'Surgery & Oncology', 'Category updated in MySQL');

    // Test Suite 6: Publish and Unpublish Controls
    console.log('\n--- Test Suite 6: Publish and Unpublish Controls ---');
    const publishRes = await blogService.publishArticle(createRes.id);
    assert(publishRes.status === 'published', 'Article transitioned to published status');

    const pubCheck = await blogService.getArticleById(createRes.id);
    assert(pubCheck.status === 'published' && pubCheck.published_at !== null, 'published_at timestamp assigned');

    const unpubRes = await blogService.unpublishArticle(createRes.id);
    assert(unpubRes.status === 'draft', 'Article reverted to draft status');

    // Test Suite 7: Delete Article
    console.log('\n--- Test Suite 7: Delete Article ---');
    const deleteRes = await blogService.deleteArticle(createRes.id);
    assert(deleteRes.id === createRes.id, 'Article successfully deleted');

    let notFound = false;
    try {
      await blogService.getArticleById(createRes.id);
    } catch (err) {
      notFound = err.statusCode === 404 || err.name === 'NotFoundError';
    }
    assert(notFound, 'Deleted article no longer exists in MySQL');

    console.log('\n======================================================');
    console.log(`🏁 BLOG MODULE INTEGRATION TEST RESULTS:`);
    console.log(`   Passed: ${testsPassed}`);
    console.log(`   Failed: ${testsFailed}`);
    console.log('======================================================\n');

    if (testsFailed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('❌ Test execution error:', err);
    process.exit(1);
  }
}

runBlogIntegrationTests();
