const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// List registered users
router.get('/', userController.getUsers);

// Get single user by email
router.get('/:email', userController.getUserByEmail);

module.exports = router;
