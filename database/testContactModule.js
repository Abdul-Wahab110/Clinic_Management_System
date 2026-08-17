const contactService = require('../server/services/contact.service');
const db = require('../server/config/db');

async function runContactIntegrationTests() {
  console.log('🧪 Starting Contact & Inquiry Management Module Integration Tests...\n');
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
    const adminUser = { id: 1, name: 'Dr. Administrator', role: 'hospital_admin' };

    // Test Suite 1: Inquiry Submission & Validation
    console.log('--- Test Suite 1: Inquiry Submission & Validation ---');
    const newInquiry = await contactService.submitInquiry({
      name: 'Alexander Pierce',
      email: 'alexander.p@example.com',
      phone: '+1 (555) 901-2233',
      subject: 'Inquiry on Cardiac Catheterization Recovery Time',
      message: 'Hello, what is the typical inpatient stay duration following a diagnostic catheterization procedure?',
      department_id: 1,
      inquiry_type: 'Appointment Question'
    });

    assert(newInquiry.id !== undefined, 'Inquiry created in MySQL');
    assert(newInquiry.status === 'new', 'Inquiry initially assigned status "new"');

    // Test Suite 2: Admin Inquiries Retrieval & Multi-Criteria Filtering
    console.log('\n--- Test Suite 2: Admin Inquiries Retrieval & Multi-Criteria Filtering ---');
    const allList = await contactService.listInquiries({ page: 1, limit: 10 });
    assert(allList.inquiries.length >= 1, 'Retrieves inquiries list from MySQL');
    assert(allList.hasOwnProperty('pagination'), 'Includes pagination metadata');

    // Filter by Status "new"
    const newList = await contactService.listInquiries({ status: 'new' });
    assert(newList.inquiries.every(i => i.status === 'new'), 'Filters inquiries by status "new"');

    // Filter by Inquiry Type
    const typeList = await contactService.listInquiries({ inquiry_type: 'Appointment Question' });
    assert(typeList.inquiries.every(i => i.inquiry_type === 'Appointment Question'), 'Filters inquiries by inquiry_type');

    // Search by Name / Subject
    const searchList = await contactService.listInquiries({ search: 'Alexander' });
    assert(searchList.inquiries.length >= 1, 'Search finds inquiry by name');
    assert(searchList.inquiries[0].email === 'alexander.p@example.com', 'Search result matches submitted email');

    // Test Suite 3: Get Inquiry by ID
    console.log('\n--- Test Suite 3: Get Inquiry by ID ---');
    const singleInq = await contactService.getInquiryById(newInquiry.id);
    assert(singleInq.id === newInquiry.id, 'Fetches single inquiry by ID');
    assert(singleInq.department_name !== undefined, 'Includes joined department name');

    // Test Suite 4: Status Lifecycle: Mark Read -> Reply -> Archive
    console.log('\n--- Test Suite 4: Status Lifecycle: Mark Read -> Reply -> Archive ---');
    
    // 1. Mark as Read
    const readRes = await contactService.markAsRead(newInquiry.id, adminUser);
    assert(readRes.status === 'read', 'Inquiry marked as read');

    const inqAfterRead = await contactService.getInquiryById(newInquiry.id);
    assert(inqAfterRead.status === 'read', 'Status persisted as "read" in MySQL');

    // 2. Mark as Replied with Reply Notes
    const replyRes = await contactService.markAsReplied(
      newInquiry.id,
      'Recovery is typically 4 to 6 hours in our outpatient recovery lounge before discharge.',
      adminUser
    );
    assert(replyRes.status === 'replied', 'Inquiry marked as replied');
    assert(replyRes.reply_notes.includes('4 to 6 hours'), 'Reply notes attached');

    const inqAfterReply = await contactService.getInquiryById(newInquiry.id);
    assert(inqAfterReply.status === 'replied', 'Status persisted as "replied" in MySQL');
    assert(inqAfterReply.replied_by === adminUser.id, 'Replied_by admin ID recorded');
    assert(inqAfterReply.replied_at !== null, 'Replied_at timestamp recorded');

    // 3. Archive Inquiry
    const archiveRes = await contactService.archiveInquiry(newInquiry.id, adminUser);
    assert(archiveRes.status === 'archived', 'Inquiry archived');

    const inqAfterArchive = await contactService.getInquiryById(newInquiry.id);
    assert(inqAfterArchive.status === 'archived', 'Status persisted as "archived" in MySQL');

    // Test Suite 5: Aggregated Inquiry KPI Analytics
    console.log('\n--- Test Suite 5: Aggregated Inquiry KPI Analytics ---');
    const stats = await contactService.getInquiryStats();
    assert(stats.hasOwnProperty('total_inquiries'), 'Calculates total inquiries');
    assert(stats.hasOwnProperty('new_inquiries'), 'Calculates new inquiries');
    assert(stats.hasOwnProperty('replied_inquiries'), 'Calculates replied inquiries');
    assert(stats.hasOwnProperty('archived_inquiries'), 'Calculates archived inquiries');
    assert(stats.archived_inquiries >= 1, 'Archived inquiries count updated');

    // Test Suite 6: Delete Inquiry
    console.log('\n--- Test Suite 6: Delete Inquiry ---');
    const deleteRes = await contactService.deleteInquiry(newInquiry.id);
    assert(deleteRes.id === newInquiry.id, 'Admin deleted the inquiry');

    const [delCheck] = await db.query('SELECT id FROM contact_messages WHERE id = ?', [newInquiry.id]);
    assert(delCheck.length === 0, 'Inquiry permanently removed from MySQL');

    console.log('\n======================================================');
    console.log(`🏁 CONTACT MODULE INTEGRATION TEST RESULTS:`);
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

runContactIntegrationTests();
