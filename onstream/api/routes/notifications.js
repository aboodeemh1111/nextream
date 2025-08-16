const router = require('express').Router();
const verify = require('../verifyToken');
const admin = require('../firebase');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Register or update a device token
router.post('/devices/register', verify, async (req, res) => {
  try {
    const { token, platform = 'web', userAgent } = req.body;
    if (!token) return res.status(400).json({ message: 'token required' });
    await User.updateOne(
      { _id: req.user.id, 'deviceTokens.token': { $ne: token } },
      { $push: { deviceTokens: { token, platform, userAgent } } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'REGISTER_DEVICE_FAILED', message: err.message });
  }
});

// Get/update notification preferences
router.get('/prefs', verify, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('notificationPrefs').lean();
    res.json(user?.notificationPrefs || {});
  } catch (err) {
    res.status(500).json({ error: 'PREFS_FETCH_FAILED', message: err.message });
  }
});

router.post('/prefs', verify, async (req, res) => {
  try {
    const allowed = ['marketing', 'product', 'reminders', 'quietHours'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[`notificationPrefs.${key}`] = req.body[key];
    }
    await User.updateOne({ _id: req.user.id }, { $set: update });
    const user = await User.findById(req.user.id).select('notificationPrefs').lean();
    res.json(user.notificationPrefs || {});
  } catch (err) {
    res.status(500).json({ error: 'PREFS_UPDATE_FAILED', message: err.message });
  }
});

// Unregister device token
router.delete('/devices/:token', verify, async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.user.id },
      { $pull: { deviceTokens: { token: req.params.token } } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'UNREGISTER_DEVICE_FAILED', message: err.message });
  }
});

// Subscribe to topic
router.post('/topics/subscribe', verify, async (req, res) => {
  try {
    const { token, topic } = req.body;
    if (!token || !topic) return res.status(400).json({ message: 'token and topic required' });
    if (!admin?.apps?.length) return res.status(500).json({ error: 'FCM_NOT_CONFIGURED', message: 'Firebase Admin app not initialized' });
    await admin.messaging().subscribeToTopic([token], topic);
    await User.updateOne(
      { _id: req.user.id, 'deviceTokens.token': token },
      { $addToSet: { 'deviceTokens.$.subscribedTopics': topic } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'TOPIC_SUBSCRIBE_FAILED', message: err.message });
  }
});

router.post('/topics/unsubscribe', verify, async (req, res) => {
  try {
    const { token, topic } = req.body;
    if (!token || !topic) return res.status(400).json({ message: 'token and topic required' });
    if (!admin?.apps?.length) return res.status(500).json({ error: 'FCM_NOT_CONFIGURED', message: 'Firebase Admin app not initialized' });
    await admin.messaging().unsubscribeFromTopic([token], topic);
    await User.updateOne(
      { _id: req.user.id, 'deviceTokens.token': token },
      { $pull: { 'deviceTokens.$.subscribedTopics': topic } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'TOPIC_UNSUBSCRIBE_FAILED', message: err.message });
  }
});

// Send to specific users (admin only)
router.post('/send/user', verify, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json('You are not allowed!');
    const { userIds = [], notification = {}, data = {} } = req.body;
    const users = await User.find({ _id: { $in: userIds } }, { deviceTokens: 1 }).lean();
    const tokens = users.flatMap(u => (u.deviceTokens || []).map(d => d.token));
    if (!tokens.length) return res.json({ sent: 0, success: 0 });
    if (!admin?.apps?.length) return res.status(500).json({ error: 'FCM_NOT_CONFIGURED', message: 'Firebase Admin app not initialized' });

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification,
      data,
      webpush: { fcmOptions: { link: data?.deepLink || '/' } },
    });

    // Remove invalid tokens
    const invalidIdx = response.responses
      .map((r, i) => (!r.success && r.error?.errorInfo?.code === 'messaging/registration-token-not-registered' ? i : -1))
      .filter(i => i !== -1);
    const invalidTokens = invalidIdx.map(i => tokens[i]);
    if (invalidTokens.length) {
      await User.updateMany({}, { $pull: { deviceTokens: { token: { $in: invalidTokens } } } });
    }

    // Persist notifications (optional: one per user)
    await Notification.insertMany(
      userIds.map(uid => ({ userId: uid, title: notification.title, body: notification.body, data, status: 'sent', sentAt: new Date() }))
    );

    res.json({ sent: tokens.length, success: response.successCount, failure: response.failureCount });
  } catch (err) {
    res.status(500).json({ error: 'SEND_USER_FAILED', message: err.message });
  }
});

// Send to topic (admin only)
router.post('/send/topic', verify, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json('You are not allowed!');
    const { topic, notification = {}, data = {} } = req.body;
    if (!topic) return res.status(400).json({ message: 'topic required' });
    if (!admin?.apps?.length) return res.status(500).json({ error: 'FCM_NOT_CONFIGURED', message: 'Firebase Admin app not initialized' });
    const id = await admin.messaging().send({ topic, notification, data, webpush: { fcmOptions: { link: data?.deepLink || '/' } } });
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: 'SEND_TOPIC_FAILED', message: err.message });
  }
});

// Get in-app notifications for user
router.get('/', verify, async (req, res) => {
  try {
    const items = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50).lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'FETCH_NOTIFICATIONS_FAILED', message: err.message });
  }
});

router.patch('/:id/read', verify, async (req, res) => {
  try {
    await Notification.updateOne({ _id: req.params.id, userId: req.user.id }, { $set: { read: true } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'MARK_READ_FAILED', message: err.message });
  }
});

router.post('/events/open', async (req, res) => {
  try {
    const { id } = req.body;
    if (id) await Notification.updateOne({ _id: id }, { $set: { status: 'opened', openedAt: new Date() } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'TRACK_OPEN_FAILED', message: err.message });
  }
});

module.exports = router;

// Health/status endpoint for debugging FCM configuration
router.get('/health', (req, res) => {
  try {
    const projectId = !!process.env.FIREBASE_PROJECT_ID;
    const clientEmail = !!process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = !!process.env.FIREBASE_PRIVATE_KEY;
    const adminInitialized = Array.isArray(admin?.apps) && admin.apps.length > 0;
    res.json({ adminInitialized, env: { projectId, clientEmail, privateKey } });
  } catch (err) {
    res.status(500).json({ error: 'HEALTH_CHECK_FAILED', message: err.message });
  }
});


