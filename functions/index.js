const functions = require('firebase-functions');
const admin     = require('firebase-admin');
admin.initializeApp();

const db        = admin.firestore();
const messaging = admin.messaging();

// ─────────────────────────────────────────────
// HELPER: Send push to all users of a given role
// ─────────────────────────────────────────────
async function sendToRole(roles, title, body, link = '', tag = 'general') {
  const usersSnap = await db.collection('users')
    .where('role', 'in', roles)
    .where('status', '==', 'active')
    .get();

  const tokens = usersSnap.docs
    .map(d => d.data().fcmToken)
    .filter(Boolean);

  if (!tokens.length) return;

  await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: { link, tag },
    webpush: {
      notification: { icon: '/gecc-logo.jpg', badge: '/gecc-logo.jpg', tag },
      fcmOptions: { link }
    }
  });
}

// Helper: Send push to specific user
async function sendToUser(userId, title, body, link = '', tag = 'general') {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) return;
  const token = userDoc.data().fcmToken;
  if (!token) return;
  await messaging.send({
    token,
    notification: { title, body },
    data: { link, tag },
    webpush: {
      notification: { icon: '/gecc-logo.jpg', badge: '/gecc-logo.jpg', tag },
      fcmOptions: { link }
    }
  });
}

// Helper: Save in-app notification to Firestore
async function saveInAppNotification(toUserId, message, type, link = '') {
  await db.collection('notifications').add({
    toUserId, message, type, link,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

// Helper: Save in-app notification to all users of given roles
async function saveInAppToRoles(roles, message, type, link = '') {
  const usersSnap = await db.collection('users')
    .where('role', 'in', roles)
    .where('status', '==', 'active')
    .get();
  const batch = db.batch();
  usersSnap.docs.forEach(d => {
    const ref = db.collection('notifications').doc();
    batch.set(ref, {
      toUserId: d.id, message, type, link,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
}

// ─────────────────────────────────────────────
// TRIGGER 1: Hub post created
// Notify all roles in-app + push
// ─────────────────────────────────────────────
exports.onHubPostCreated = functions.firestore
  .document('hub_posts/{postId}')
  .onCreate(async (snap, context) => {
    const post = snap.data();
    const posterName = post.authorName || 'Someone';
    const preview    = (post.content || '').substring(0, 80) + ((post.content||'').length > 80 ? '…' : '');
    const msg = `${posterName} posted on the Fellowship Hub: "${preview}"`;

    // In-app for all
    await saveInAppToRoles(['member', 'admin', 'superadmin'], msg, 'hub', '/hub.html');

    // Push to all
    await sendToRole(['member','admin','superadmin'], 'New Hub Post', msg, '/hub.html', 'hub-post');
  });

// ─────────────────────────────────────────────
// TRIGGER 2: Event created
// Notify all in-app + push
// Also schedule reminders
// ─────────────────────────────────────────────
exports.onEventCreated = functions.firestore
  .document('events/{eventId}')
  .onCreate(async (snap, context) => {
    const ev  = snap.data();
    const eventId = context.params.eventId;
    const msg = `New event: ${ev.title} on ${ev.date}${ev.time ? ' at ' + ev.time : ''}${ev.venue ? ' · ' + ev.venue : ''}`;

    // In-app for all
    await saveInAppToRoles(['member','admin','superadmin'], msg, 'event', '/events.html');

    // Push to all
    await sendToRole(['member','admin','superadmin'], 'New Event Added', msg, '/events.html', 'event-new');

    // Schedule reminders in event_reminders collection
    const eventDateTime = ev.time
      ? new Date(`${ev.date}T${ev.time}`)
      : new Date(`${ev.date}T08:00:00`);

    const HOUR_OFFSETS = [24, 18, 10, 6, 3, 2, 1];
    const MIN_OFFSETS  = [30, 20, 10, 5];
    const batch = db.batch();

    HOUR_OFFSETS.forEach((hrs, i) => {
      const sendAt = new Date(eventDateTime.getTime() - hrs*60*60*1000);
      if (sendAt > new Date()) {
        batch.set(db.collection('event_reminders').doc(`${eventId}_h${hrs}`), {
          eventId, eventTitle: ev.title, eventDate: ev.date,
          eventTime: ev.time || '', eventVenue: ev.venue || '',
          sendAt: admin.firestore.Timestamp.fromDate(sendAt),
          label: hrs === 1 ? '1 hour' : `${hrs} hours`,
          sent: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });

    MIN_OFFSETS.forEach((mins, i) => {
      const sendAt = new Date(eventDateTime.getTime() - mins*60*1000);
      if (sendAt > new Date()) {
        batch.set(db.collection('event_reminders').doc(`${eventId}_m${mins}`), {
          eventId, eventTitle: ev.title, eventDate: ev.date,
          eventTime: ev.time || '', eventVenue: ev.venue || '',
          sendAt: admin.firestore.Timestamp.fromDate(sendAt),
          label: `${mins} minutes`,
          sent: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });

    await batch.commit();
  });

// ─────────────────────────────────────────────
// TRIGGER 3: Audit log created
// In-app notification to Super Admin only
// ─────────────────────────────────────────────
exports.onAuditLogCreated = functions.firestore
  .document('audit_logs/{logId}')
  .onCreate(async (snap) => {
    const log = snap.data();
    const msg = `[Audit] ${log.performedBy} (${log.performedByRole}): ${log.description || log.action}`;

    const superSnap = await db.collection('users')
      .where('role','==','superadmin')
      .where('status','==','active')
      .limit(1).get();

    if (superSnap.empty) return;
    const superId = superSnap.docs[0].id;
    await saveInAppNotification(superId, msg, 'audit', '/audit-logs.html');
  });

// ─────────────────────────────────────────────
// TRIGGER 4: Finance record added
// In-app to Super Admin + Finance Admins
// ─────────────────────────────────────────────
exports.onFinanceRecordAdded = functions.firestore
  .document('finance_records/{recordId}')
  .onCreate(async (snap) => {
    const rec = snap.data();
    const amt = '₦' + Number(rec.amount||0).toLocaleString('en-NG',{minimumFractionDigits:2});
    const msg = `Finance: ${rec.type === 'income' ? 'Income' : 'Expenditure'} of ${amt} recorded — ${rec.category} via ${rec.bank}`;

    // Super Admin always
    const superSnap = await db.collection('users').where('role','==','superadmin').limit(1).get();
    if (!superSnap.empty) {
      await saveInAppNotification(superSnap.docs[0].id, msg, 'finance', '/finance.html');
    }

    // Admins with finance view permission
    const adminsSnap = await db.collection('users').where('role','==','admin').where('status','==','active').get();
    const batch = db.batch();
    adminsSnap.docs.forEach(d => {
      const perms = d.data().financePerms || {};
      if (perms.view) {
        const ref = db.collection('notifications').doc();
        batch.set(ref, {
          toUserId: d.id, message: msg, type: 'finance',
          link: '/finance.html', read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });
    await batch.commit();
  });

// ─────────────────────────────────────────────
// TRIGGER 5: New member registered (status: pending)
// In-app + push to Super Admin
// ─────────────────────────────────────────────
exports.onNewUserRegistered = functions.firestore
  .document('users/{userId}')
  .onCreate(async (snap) => {
    const user = snap.data();
    if (user.status !== 'pending') return;
    const msg = `New member registration: ${user.name || user.email} is awaiting approval.`;

    const superSnap = await db.collection('users').where('role','==','superadmin').limit(1).get();
    if (superSnap.empty) return;
    const superId = superSnap.docs[0].id;

    await saveInAppNotification(superId, msg, 'member', '/user-management.html');
    await sendToUser(superId, 'New Registration', msg, '/user-management.html', 'member-reg');
  });

// ─────────────────────────────────────────────
// SCHEDULED: Event Reminders
// Runs every 5 minutes — checks event_reminders for due notifications
// ─────────────────────────────────────────────
exports.sendEventReminders = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async () => {
    const now  = admin.firestore.Timestamp.now();
    const snap = await db.collection('event_reminders')
      .where('sent', '==', false)
      .where('sendAt', '<=', now)
      .limit(50)
      .get();

    if (snap.empty) return null;

    for (const doc of snap.docs) {
      const rem = doc.data();
      const title = `Reminder: ${rem.eventTitle}`;
      const body  = `Starting in ${rem.label}${rem.eventVenue ? ' · ' + rem.eventVenue : ''}`;

      // Push to all active users
      await sendToRole(['member','admin','superadmin'], title, body, '/events.html', `event-reminder-${rem.eventId}`);

      // Mark as sent
      await doc.ref.update({ sent: true, sentAt: now });
    }
    return null;
  });

// ─────────────────────────────────────────────
// SCHEDULED: Monthly Finance Report
// Runs on 1st of every month at 8AM
// ─────────────────────────────────────────────
exports.monthlyFinanceReport = functions.pubsub
  .schedule('0 8 1 * *')
  .timeZone('Africa/Lagos')
  .onRun(async () => {
    const now   = new Date();
    const month = now.toLocaleString('en-NG', { month: 'long', timeZone: 'Africa/Lagos' });
    const year  = now.getFullYear();
    const prevMonth = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const startOfPrev = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1).toISOString().split('T')[0];
    const endOfPrev   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

    // Fetch last month's records
    const recSnap = await db.collection('finance_records')
      .where('date', '>=', startOfPrev)
      .where('date', '<=', endOfPrev)
      .get();

    const records  = recSnap.docs.map(d=>d.data());
    const income   = records.filter(r=>r.type==='income').reduce((s,r)=>s+Number(r.amount||0),0);
    const expense  = records.filter(r=>r.type==='expenditure').reduce((s,r)=>s+Number(r.amount||0),0);
    const net      = income - expense;
    const fmtAmt   = n => '₦'+Number(n).toLocaleString('en-NG',{minimumFractionDigits:2});
    const prevMonthName = prevMonth.toLocaleString('en-NG',{month:'long',timeZone:'Africa/Lagos'});

    const msg   = `Monthly Finance Report (${prevMonthName} ${year}): Income ${fmtAmt(income)} · Expenses ${fmtAmt(expense)} · Net ${fmtAmt(net)}`;
    const title = `Finance Report — ${prevMonthName} ${year}`;

    // In-app + push to Super Admin
    const superSnap = await db.collection('users').where('role','==','superadmin').limit(1).get();
    if (!superSnap.empty) {
      const superId = superSnap.docs[0].id;
      await saveInAppNotification(superId, msg, 'finance', '/finance.html');
      await sendToUser(superId, title, msg, '/finance.html', 'finance-monthly');
    }

    // Admins with finance view permission
    const adminsSnap = await db.collection('users').where('role','==','admin').where('status','==','active').get();
    for (const d of adminsSnap.docs) {
      const perms = d.data().financePerms || {};
      if (perms.view) {
        await saveInAppNotification(d.id, msg, 'finance', '/finance.html');
        const token = d.data().fcmToken;
        if (token) {
          await messaging.send({
            token,
            notification: { title, body: msg },
            data: { link: '/finance.html', tag: 'finance-monthly' }
          });
        }
      }
    }

    return null;
  });

// ─────────────────────────────────────────────
// SCHEDULED: Daily Devotional Bible Verse
// Runs every minute, checks each user's preferred time
// ─────────────────────────────────────────────
const BIBLE_VERSES = [
  { ref:'John 3:16',       text:'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.' },
  { ref:'Philippians 4:13',text:'I can do all this through him who gives me strength.' },
  { ref:'Jeremiah 29:11',  text:'For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you a hope and a future.' },
  { ref:'Proverbs 3:5-6',  text:'Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.' },
  { ref:'Romans 8:28',     text:'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.' },
  { ref:'Isaiah 40:31',    text:'But those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary.' },
  { ref:'Matthew 6:33',    text:'But seek first his kingdom and his righteousness, and all these things will be given to you as well.' },
  { ref:'Psalm 23:1',      text:'The Lord is my shepherd, I lack nothing.' },
  { ref:'Psalm 46:1',      text:'God is our refuge and strength, an ever-present help in trouble.' },
  { ref:'Joshua 1:9',      text:'Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.' },
  { ref:'2 Timothy 1:7',   text:'For the Spirit God gave us does not make us timid, but gives us power, love and self-discipline.' },
  { ref:'Psalm 34:8',      text:'Taste and see that the Lord is good; blessed is the one who takes refuge in him.' },
  { ref:'Romans 15:13',    text:'May the God of hope fill you with all joy and peace as you trust in him, so that you may overflow with hope by the power of the Holy Spirit.' },
  { ref:'Lamentations 3:22-23', text:"Because of the Lord's great love we are not consumed, for his compassions never fail. They are new every morning; great is your faithfulness." },
  { ref:'Hebrews 11:1',    text:'Now faith is confidence in what we hope for and assurance about what we do not see.' },
  { ref:'1 Corinthians 13:4', text:'Love is patient, love is kind. It does not envy, it does not boast, it is not proud.' },
  { ref:'Psalm 119:105',   text:'Your word is a lamp for my feet, a light on my path.' },
  { ref:'Matthew 5:16',    text:'Let your light shine before others, that they may see your good deeds and glorify your Father in heaven.' },
  { ref:'Galatians 5:22-23', text:'But the fruit of the Spirit is love, joy, peace, forbearance, kindness, goodness, faithfulness, gentleness and self-control.' },
  { ref:'Ephesians 2:8',   text:'For it is by grace you have been saved, through faith—and this is not from yourselves, it is the gift of God.' },
  { ref:'James 1:2-3',     text:'Consider it pure joy, my brothers and sisters, whenever you face trials of many kinds, because you know that the testing of your faith produces perseverance.' },
  { ref:'Psalm 27:1',      text:'The Lord is my light and my salvation—whom shall I fear? The Lord is the stronghold of my life—of whom shall I be afraid?' },
  { ref:'1 Peter 5:7',     text:'Cast all your anxiety on him because he cares for you.' },
  { ref:'Colossians 3:23', text:'Whatever you do, work at it with all your heart, as working for the Lord, not for human masters.' },
  { ref:'John 14:6',       text:'Jesus answered, "I am the way and the truth and the life. No one comes to the Father except through me."' },
  { ref:'Proverbs 18:10',  text:'The name of the Lord is a fortified tower; the righteous run to it and are safe.' },
  { ref:'Isaiah 41:10',    text:'So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you.' },
  { ref:'Matthew 28:20',   text:"And surely I am with you always, to the very end of the age." },
  { ref:'Psalm 37:4',      text:'Take delight in the Lord, and he will give you the desires of your heart.' },
  { ref:'Revelation 21:4', text:'He will wipe every tear from their eyes. There will be no more death or mourning or crying or pain.' },
];

exports.sendDailyDevotional = functions.pubsub
  .schedule('every 1 minutes')
  .timeZone('Africa/Lagos')
  .onRun(async () => {
    const now      = new Date();
    const hh       = String(now.getHours()).padStart(2,'0');
    const mm       = String(now.getMinutes()).padStart(2,'0');
    const timeNow  = `${hh}:${mm}`;
    const dayOfYear= Math.floor((now - new Date(now.getFullYear(),0,0)) / 86400000);
    const verse    = BIBLE_VERSES[dayOfYear % BIBLE_VERSES.length];

    // Find all active users whose devotional time matches now
    const usersSnap = await db.collection('users')
      .where('devotionalTime', '==', timeNow)
      .where('status','==','active')
      .get();

    if (usersSnap.empty) return null;

    const title = `Daily Devotional · ${verse.ref}`;
    const body  = verse.text.substring(0, 100) + (verse.text.length > 100 ? '…' : '');

    for (const doc of usersSnap.docs) {
      const user  = doc.data();
      const token = user.fcmToken;

      // In-app notification
      await saveInAppNotification(doc.id, `${verse.ref}: "${verse.text}"`, 'devotional', '');

      // Device push
      if (token) {
        await messaging.send({
          token,
          notification: { title, body },
          data: { tag: 'devotional', verse: verse.ref },
          webpush: {
            notification: {
              icon: '/gecc-logo.jpg',
              badge: '/gecc-logo.jpg',
              tag: 'daily-devotional',
              requireInteraction: false
            }
          }
        });
      }
    }

    return null;
  });

// ─────────────────────────────────────────────
// TRIGGER 6: Position transfer
// In-app to Super Admin
// ─────────────────────────────────────────────
exports.onPositionUpdated = functions.firestore
  .document('positions/{positionId}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) return;
    const before = change.before.exists ? change.before.data() : null;
    const after  = change.after.data();
    if (!before) return; // new doc, not a transfer
    if (before.currentHolder === after.currentHolder) return; // no change

    const posId = context.params.positionId;
    const msg   = after.currentHolder
      ? `Position update: ${posId} transferred to ${after.currentHolder}${before.currentHolder?' from '+before.currentHolder:''}`
      : `Position cleared: ${posId} — ${before.currentHolder||''} removed`;

    const superSnap = await db.collection('users').where('role','==','superadmin').limit(1).get();
    if (superSnap.empty) return;
    await saveInAppNotification(superSnap.docs[0].id, msg, 'position', '/positions.html');
  });
