const AIPhotoBoothUser = require('../models/AIPhotoBoothUser');

/**
 * Get all registered AI PhotoBooth users
 */
exports.getUsers = async (req, res, next) => {
  try {
    const users = await AIPhotoBoothUser.find({});
    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user profile and booth history by email
 */
exports.getUserByEmail = async (req, res, next) => {
  try {
    const { email } = req.params;
    const user = await AIPhotoBoothUser.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: `User with email ${email} not found` },
      });
    }
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
