const cron = require('node-cron');
const Invite = require('../models/Invite');

const expireInvites = cron.schedule('0 0 * * *', async () => {
  try {
    const result = await Invite.updateMany(
      {
        status: { $in: ['pending', 'sent'] },
        expiresAt: { $lt: new Date() }
      },
      { $set: { status: 'expired' } }
    );
    console.log(`Expired ${result.modifiedCount} invites`);
  } catch (error) {
    console.error('Expiration job failed:', error);
  }
});

module.exports = expireInvites;