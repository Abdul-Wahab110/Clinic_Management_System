const notificationService = require('../server/services/notification.service');
const { ForbiddenError } = require('../server/utils/errors');
const db = require('../server/config/db');

async function runNotificationIntegrationTests() {
  console.log('🧪 Starting Notification Management Module Integration Tests...\n');
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
    const adminUser = { id: 1, role: 'super_admin' };
    const doctorUser = { id: 3, role: 'doctor' };
    const patientUser = { id: 10, role: 'patient' };

    // Clean up previous transient broadcast test notifications
    await db.query("DELETE FROM notifications WHERE title LIKE 'Clinical Protocol Update%' OR title LIKE '📬 New Patient Inquiry%'");

    // Ensure prescription_created modality exists with fresh timestamp
    await db.query("INSERT INTO notifications (user_id, title, message, notification_type, priority, created_at) VALUES (1, 'Prescription Ready', 'Test Rx created', 'prescription_created', 'normal', NOW())");

    // Test Suite 1: List Notifications & Modality Types
    console.log('--- Test Suite 1: List Notifications & Modality Types ---');
    const adminNotifs = await notificationService.listNotifications(adminUser, { all_users: 'true', limit: 50 });
    assert(adminNotifs.notifications.length > 0, 'Retrieves seeded notifications from database');
    assert(adminNotifs.hasOwnProperty('unread_count'), 'Response includes unread_count property');
    assert(adminNotifs.hasOwnProperty('pagination'), 'Response includes pagination metadata');

    const [modalities] = await db.query('SELECT DISTINCT notification_type FROM notifications');
    const typesFound = new Set(modalities.map(n => n.notification_type));
    console.log('    Found modalities in DB:', Array.from(typesFound).join(', '));
    assert(typesFound.has('low_stock'), 'Includes low_stock notification modality');
    assert(typesFound.has('payment_received'), 'Includes payment_received notification modality');
    assert(typesFound.has('appointment_confirmation'), 'Includes appointment_confirmation modality');
    assert(typesFound.has('lab_report_ready'), 'Includes lab_report_ready modality');
    assert(typesFound.has('prescription_created'), 'Includes prescription_created modality');

    // Test Suite 2: Real-Time Unread Count
    console.log('\n--- Test Suite 2: Real-Time Unread Count ---');
    await db.query("INSERT INTO notifications (user_id, title, message, notification_type, priority, is_read) VALUES (?, 'Clinical Protocol Notice', 'Protocol update', 'system_notification', 'normal', 0)", [doctorUser.id]);
    const unreadCountRes = await notificationService.getUnreadCount(doctorUser);
    assert(typeof unreadCountRes.unread_count === 'number', 'Returns numeric unread count for doctor');
    assert(unreadCountRes.unread_count >= 1, 'Doctor has active unread notifications');

    // Test Suite 3: Create Single Database Notification
    console.log('\n--- Test Suite 3: Create Single Database Notification ---');
    const newNotif = await notificationService.createNotification({
      user_id: 10,
      title: 'Appointment Cancelled: Dr. Marcus Vance',
      message: 'Your appointment scheduled for tomorrow has been cancelled due to emergency surgery.',
      notification_type: 'appointment_cancellation',
      priority: 'urgent',
      action_url: '/patient/appointments'
    }, adminUser);

    assert(newNotif.id !== undefined, 'Created database-backed notification');
    assert(newNotif.user_id === 10, 'Target user is patient ID 10');

    // Verify it appears in patient's list
    const patientList = await notificationService.listNotifications(patientUser);
    const createdFound = patientList.notifications.find(n => n.id === newNotif.id);
    assert(createdFound !== undefined, 'Created notification appears in patient notifications list');
    assert(createdFound.notification_type === 'appointment_cancellation', 'Notification type is appointment_cancellation');
    assert(createdFound.priority === 'urgent', 'Priority is urgent');

    // Test Suite 4: Mark Notification as Read & Unread
    console.log('\n--- Test Suite 4: Mark Notification as Read & Unread ---');
    const markReadRes = await notificationService.markAsRead(newNotif.id, patientUser);
    assert(markReadRes.is_read === true, 'Marked notification as read');

    const [readCheck] = await db.query('SELECT is_read, read_at FROM notifications WHERE id = ?', [newNotif.id]);
    assert(readCheck[0].is_read === 1, 'Database is_read column updated to 1');
    assert(readCheck[0].read_at !== null, 'Database read_at timestamp populated');

    const markUnreadRes = await notificationService.markAsUnread(newNotif.id, patientUser);
    assert(markUnreadRes.is_read === false, 'Marked notification as unread');

    const [unreadCheck] = await db.query('SELECT is_read, read_at FROM notifications WHERE id = ?', [newNotif.id]);
    assert(unreadCheck[0].is_read === 0, 'Database is_read column restored to 0');
    assert(unreadCheck[0].read_at === null, 'Database read_at timestamp cleared to NULL');

    // Test Suite 5: Broadcast Notification to Entire Role
    console.log('\n--- Test Suite 5: Broadcast Notification to Entire Role ---');
    const broadcastRes = await notificationService.createNotification({
      target_role: 'doctor',
      title: 'Clinical Protocol Update',
      message: 'Updated emergency resuscitation protocols are now in effect.',
      notification_type: 'system_notification',
      priority: 'high',
      action_url: '/doctor/protocols'
    }, adminUser);

    assert(broadcastRes.message.includes('broadcast to'), 'Broadcasted notification to doctor role');

    // Test Suite 6: Mark All As Read
    console.log('\n--- Test Suite 6: Mark All As Read ---');
    await db.query("INSERT INTO notifications (user_id, title, message, notification_type, priority, is_read) VALUES (?, 'Test Unread', 'Msg', 'system_notification', 'normal', 0)", [patientUser.id]);
    const markAllRes = await notificationService.markAllAsRead(patientUser);
    assert(markAllRes.affected_rows >= 1, 'Marked all unread patient notifications as read');

    const patientCountAfter = await notificationService.getUnreadCount(patientUser);
    assert(patientCountAfter.unread_count === 0, 'Patient unread count is now 0');

    // Test Suite 7: User Isolation & Security Access Control
    console.log('\n--- Test Suite 7: User Isolation & Security Access Control ---');
    let isolationBlocked = false;
    try {
      // Patient 10 attempting to mark or delete Doctor's notification (User 3)
      const [docNotif] = await db.query('SELECT id FROM notifications WHERE user_id = 3 LIMIT 1');
      if (docNotif.length > 0) {
        await notificationService.deleteNotification(docNotif[0].id, patientUser);
      }
    } catch (err) {
      isolationBlocked = err.statusCode === 403 || err instanceof ForbiddenError;
    }
    assert(isolationBlocked, 'BLOCKED: Non-admin patient is forbidden from deleting another user notification');

    // Test Suite 8: Delete Notification
    console.log('\n--- Test Suite 8: Delete Notification ---');
    const deleteRes = await notificationService.deleteNotification(newNotif.id, patientUser);
    assert(deleteRes.id === newNotif.id, 'Patient successfully deleted their own notification');

    const [verifyDelete] = await db.query('SELECT id FROM notifications WHERE id = ?', [newNotif.id]);
    assert(verifyDelete.length === 0, 'Notification removed from database');

    console.log('\n======================================================');
    console.log(`🏁 NOTIFICATION MODULE INTEGRATION TEST RESULTS:`);
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

runNotificationIntegrationTests();
