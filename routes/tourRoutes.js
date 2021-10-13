// The route folder contains files for each resource. This kinda creates sub apps within our app.

const express = require('express');
const tourController = require('../controllers/tourController');
const authController = require('../controllers/authController');
const reviewRouter = require('./reviewRoutes');

// was tourRouter but it's a convention to call it router
const router = express.Router();

// POST /tour/{tourID}/reviews
// GET /tour/{tourID}/reviews
// GET /tour/{tourID}/reviews/{reviewID}

// // it doesnt make sense to use the reviewController in the tourRoutes file but this will be fixed later.
// router
//   .route('/:tourId/reviews')
//   .post(
//     authController.protect,
//     authController.restrictTo('user'),
//     reviewController.createReview
//   );

// Mounting a router on a router: What we are saying here is to use the review router incase we run a specified route
// We can mount routers on routers for nesting
// The reviewRouter needs to gain access to the URL params. It will happen inside (mergeParams)
router.use('/:tourId/reviews', reviewRouter);

// top 5 cheapest tours route: They key is to run a middleware function which is gonna manipulate the query object incoming.
router
  .route('/top-5-cheap')
  .get(tourController.aliasTopTours, tourController.getAllTours);

router.route('/tour-stats').get(tourController.getTourStats);
router
  .route('/monthly-plan/:year')
  .get(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide', 'guide'),
    tourController.getMonthlyPlan
  );

// Geospatial
router
  .route('/tours-within/:distance/center/:latlng/unit/:unit')
  .get(tourController.getToursWithin);

router.route('/distances/:latlng/unit/:unit').get(tourController.getDistances);

// the route url becomes the url from /api/v1/tours
router
  .route('/')
  .get(tourController.getAllTours)
  .post(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.createTour
  );

router
  .route('/:id')
  .get(tourController.getTour)
  .patch(
    authController.protect,
    // Inside, we pass in some user roles which are authorized to interact with the resource.
    authController.restrictTo('admin', 'lead-guide'),
    tourController.updateTour
  )
  .delete(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.deleteTour
  );

module.exports = router;
