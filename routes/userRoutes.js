const express = require('express');

const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

const router = express.Router();

// Doesn't have multiple HTTP methods to handle because it only makes sense to POST a signup to create a new account.
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);

// This automatically protects all the routes after this point because middleware runs in sequence
router.use(authController.protect);

router.patch('/updatePassword', authController.updatePassword);

router.get('/me', userController.getMe, userController.getUser);

router.patch('/updateMe', userController.updateMe);
router.delete('/deleteMe', userController.deleteMe);

// Only admins can do the api calls from this point onwards
router.use(authController.restrictTo('admin'));

router
  .route('/')
  .get(userController.getAllUsers)
  .post(userController.createUser);

router
  .route('/:id')
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;
