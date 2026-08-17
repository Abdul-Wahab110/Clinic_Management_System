const reviewService = require('../server/services/review.service');
const db = require('../server/config/db');

async function runReviewIntegrationTests() {
  console.log('🧪 Starting Patient Reviews & Testimonials Module Integration Tests...\n');
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
    const patientUser = { id: 10, name: 'Arthur Pendleton', email: 'arthur.pendleton@example.com', role: 'patient' };

    // Test Suite 1: Public Approved Reviews Retrieval & Analytics
    console.log('--- Test Suite 1: Public Approved Reviews Retrieval & Analytics ---');
    const pubList = await reviewService.listPublicReviews({ page: 1, limit: 10 });
    assert(pubList.reviews.length >= 3, 'Retrieves approved patient reviews from MySQL');
    assert(pubList.reviews.every(r => r.status === undefined || r.status === 'approved'), 'All public reviews have approved status');
    assert(pubList.hasOwnProperty('metrics'), 'Includes metrics object');
    assert(pubList.metrics.hasOwnProperty('average_rating'), 'Calculates average rating score');
    assert(pubList.metrics.hasOwnProperty('rating_distribution'), 'Calculates star distribution breakdown');
    assert(pubList.metrics.rating_distribution.five_star >= 1, 'Includes 5-star count');

    // Filter by Rating
    const filter5 = await reviewService.listPublicReviews({ rating: 5 });
    assert(filter5.reviews.every(r => r.rating === 5), 'Filters reviews by 5-star rating');

    // Test Suite 2: Featured Testimonials for Homepage
    console.log('\n--- Test Suite 2: Featured Testimonials for Homepage ---');
    const featuredList = await reviewService.getFeaturedReviews(5);
    assert(featuredList.length >= 1, 'Retrieves featured testimonials');
    assert(featuredList[0].hasOwnProperty('doctor_name') || featuredList[0].hasOwnProperty('department_name'), 'Featured testimonials contain clinical doctor/department metadata');

    // Test Suite 3: Patient Review Submission & Anti-Spam Protections
    console.log('\n--- Test Suite 3: Patient Review Submission & Anti-Spam Protections ---');
    const newSubmission = await reviewService.submitReview({
      patient_name: 'Jessica Taylor',
      patient_email: 'jessica.t@example.com',
      rating: 5,
      title: 'Flawless Pediatric Care & Kind Medical Staff',
      comment: 'The pediatric wing made my 4-year-old feel so relaxed during her vaccinations. Highly recommended!',
      department_id: 3,
      appointment_id: 99
    });

    assert(newSubmission.id !== undefined, 'Patient review created in MySQL');
    assert(newSubmission.status === 'pending', 'Review is initially assigned pending status');

    // Verify it is NOT visible in public list until approved
    const pubCheckBefore = await reviewService.listPublicReviews({ search: 'Flawless Pediatric Care' });
    assert(pubCheckBefore.reviews.length === 0, 'Pending review is NOT exposed to the public feed');

    // Anti-Spam Test 1: Reject exact duplicate comment text
    let dupTextBlocked = false;
    try {
      await reviewService.submitReview({
        patient_name: 'Jessica Taylor',
        patient_email: 'jessica.t@example.com',
        rating: 5,
        title: 'Flawless Pediatric Care & Kind Medical Staff',
        comment: 'The pediatric wing made my 4-year-old feel so relaxed during her vaccinations. Highly recommended!',
        department_id: 3
      });
    } catch (err) {
      dupTextBlocked = err.statusCode === 409 || err.name === 'ConflictError';
    }
    assert(dupTextBlocked, 'BLOCKED: Anti-Spam rejects duplicate identical review submission');

    // Anti-Spam Test 2: Reject duplicate review on same appointment_id
    let dupAppBlocked = false;
    try {
      await reviewService.submitReview({
        patient_name: 'Jessica Taylor',
        patient_email: 'jessica.t2@example.com',
        rating: 4,
        comment: 'Different comment text but same appointment reference.',
        appointment_id: 99
      });
    } catch (err) {
      dupAppBlocked = err.statusCode === 409 || err.name === 'ConflictError';
    }
    assert(dupAppBlocked, 'BLOCKED: Anti-Spam rejects second review on the same appointment ID');

    // Test Suite 4: Admin Review Moderation & Workflow Lifecycle
    console.log('\n--- Test Suite 4: Admin Review Moderation & Workflow Lifecycle ---');
    const adminStats = await reviewService.getReviewStats();
    assert(adminStats.hasOwnProperty('total_reviews'), 'Admin stats include total reviews');
    assert(adminStats.hasOwnProperty('pending_reviews'), 'Admin stats include pending reviews');
    assert(adminStats.pending_reviews >= 1, 'Pending count reflects newly submitted review');

    // Approve the review
    const approveRes = await reviewService.updateReviewStatus(newSubmission.id, 'approved', 'Verified patient visit.', adminUser);
    assert(approveRes.status === 'approved', 'Admin approved the pending review');

    // Verify it NOW appears publicly
    const pubCheckAfter = await reviewService.listPublicReviews({ search: 'Flawless Pediatric Care' });
    assert(pubCheckAfter.reviews.length === 1, 'Approved review now appears in public feed');

    // Toggle Featured
    const featToggle = await reviewService.toggleFeatured(newSubmission.id, true);
    assert(featToggle.is_featured === 1, 'Admin featured the testimonial');

    // Reject and Hide
    const hideRes = await reviewService.updateReviewStatus(newSubmission.id, 'hidden', 'Hidden temporarily.', adminUser);
    assert(hideRes.status === 'hidden', 'Admin hid the review from public display');

    const pubCheckHidden = await reviewService.listPublicReviews({ search: 'Flawless Pediatric Care' });
    assert(pubCheckHidden.reviews.length === 0, 'Hidden review is removed from public feed');

    // Test Suite 5: Delete Review
    console.log('\n--- Test Suite 5: Delete Review ---');
    const deleteRes = await reviewService.deleteReview(newSubmission.id);
    assert(deleteRes.id === newSubmission.id, 'Admin successfully deleted the review');

    const [verifyDel] = await db.query('SELECT id FROM reviews WHERE id = ?', [newSubmission.id]);
    assert(verifyDel.length === 0, 'Review permanently removed from MySQL');

    console.log('\n======================================================');
    console.log(`🏁 REVIEW MODULE INTEGRATION TEST RESULTS:`);
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

runReviewIntegrationTests();
