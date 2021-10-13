const express = require('express');
const authController = require('../controllers/authController');
const reviewController = require('../controllers/reviewController');

// By default, each other has access to params in their specific routes. This optionsObj enables this route to gain access to the params of the route it was nested in.
const router = express.Router({ mergeParams: true });

// No one can access these routes without being authenticated
router.use(authController.protect);

// create an endpoint for getting all reviews and creating a new review
router
  .route('/')
  .get(reviewController.getAllReviews)
  .post(
    authController.restrictTo('user'),
    reviewController.setTourUserIds,
    reviewController.createReview
  );

router
  .route('/:id')
  .get(reviewController.getReview)
  .delete(
    authController.restrictTo('user', 'admin'),
    reviewController.deleteReview
  )
  .patch(
    authController.restrictTo('user', 'admin'),
    reviewController.updateReview
  );

module.exports = router;
