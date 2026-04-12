const { LogActivity } = require('../models');

const logAction = async (userId, action, detail, ipAddress) => {
  try {
    await LogActivity.create({
      user_id: userId,
      action,
      detail: typeof detail === 'object' ? JSON.stringify(detail) : detail,
      ip_address: ipAddress,
    });
  } catch (err) {
    // Non-blocking - log errors don't stop the request
    console.error('Log activity error:', err.message);
  }
};

module.exports = { logAction };
