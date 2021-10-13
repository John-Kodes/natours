const mongoose = require('mongoose');
const Tour = require('./tourModel');

//// Creating the schema
const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review can not be empty'],
      trim: true,
    },
    rating: {
      type: Number,
      min: [1, 'Rating must at least be 1'],
      max: [5, 'Max rating is 5'],
    },
    createdAt: {
      type: Date,
      default: Date.now(),
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must belong to a tour'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user'],
    },
  },
  {
    // When we have a virtual property, a field that is not stored in the database but calculated using some other value, we want it to show up whenever there is an output.
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

//// Preventing duplicate reviews: With this, each combination of tour and user always has to be unique
reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

reviewSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'name photo',
  });

  next();
});

// "this" keyword points to the current model
reviewSchema.statics.calcAverageRatings = async function (tourId) {
  // To do the calculation, we use the aggregation pipeline. aggregate() returns a promise
  const stats = await this.aggregate([
    {
      // getting all the reviews of the same tour
      $match: { tour: tourId },
    },
    {
      $group: {
        // grouping all the tours by their tour
        _id: '$tour',
        nRating: { $sum: 1 }, // Creating a counter of documents passed through the pipeline
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  // Persisting the data into the tour document
  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5,
    });
  }
};

//// Updating calculations after save/create
// Should use post save so we get access to the review after it's been added to the collection
reviewSchema.post('save', function () {
  // "this" points to current review

  // We can't use the Review Model in this function since it isn't declared yet. We also cant declare the model before this middleware because the middleware wont be saved into the model. To get around this, we use the constructor. The constructor is basically the model who created that document
  this.constructor.calcAverageRatings(this.tour);
});

//// Updating calculations after update/delete
reviewSchema.post(/^findOneAnd/, async (doc) => {
  await doc.constructor.calcAverageRatings(doc.tour);
});

//// Creating the Model
const Review = mongoose.model('Review', reviewSchema);

//// Exporting the Model
module.exports = Review;
