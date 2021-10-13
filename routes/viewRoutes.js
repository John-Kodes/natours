const express = require('express');
const viewsController = require('../controllers/viewsController');
const authController = require('../controllers/authController');

const router = express.Router();

// every router after this point will have this middleware
router.use(authController.isLoggedIn);

router.get('/', viewsController.getOverview);
router.get('/tour/:slug', viewsController.getTour);
router.get('/tour', viewsController.getTour);
router.get('/login', viewsController.getLoginForm);

module.exports = router;
