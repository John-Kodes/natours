// The controllers are responsible for handling all the requests and responses.
const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');
const AppError = require('../utils/appError');

exports.aliasTopTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,summary,difficulty';

  next();
};

exports.getAllTours = factory.getAll(Tour);
exports.getTour = factory.getOne(Tour, { path: 'reviews' });
exports.createTour = factory.createOne(Tour);
exports.updateTour = factory.updateOne(Tour);
exports.deleteTour = factory.deleteOne(Tour);

// calculates statistics of tours
exports.getTourStats = catchAsync(async (req, res, next) => {
  // The aggregation pipeline is a bit like a regular query. The difference is that in aggregation, we can manipulate in a couple of steps
  // We define the steps in so called stages in an array. The documents pass through the stages one by one in the defined sequence.
  // Each stage is an object
  // .agregate() returns an aggregate object
  const stats = await Tour.aggregate([
    // match: to filter or select certain documents. Usually the match stage is a preliminary stage to prepare for the next stages
    {
      $match: { ratingsAverage: { $gte: 4.5 } },
    },
    // Group allows us to group documents together using accumulators. For example, calculating averages
    // first thing we need to specify is the _id because this is where we specify what we want to group by
    {
      $group: {
        // To group results for different fields, in this case difficulty, we specify the field name with ofc, the '$' added
        _id: null, // for now null so everything will be in 1 group so we can calculate all the statistics together and not in groups
        numTours: { $sum: 1 }, // for each of the document going through this pipeline, 1 will be added to this num counter.
        numRatings: { $sum: '$ratingsQuantity' }, // $sum: adds all field values
        // $avg is a Mongoose operator to find the average of a field. We put in the field name but with a '$'
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    {
      // We will need to specify the newly created fieldnames because the old ones no longer exist and we are working from what's left from the previous stage
      $sort: { avgPrice: 1 }, // 1 for ascending, -1 for descending
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: stats,
  });
});

exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = req.params.year * 1;

  // count how many tours there are for each of the month in a given year
  const plan = await Tour.aggregate([
    // $unwind is gonna deconstruct an array field from the input documents and output one document for each element of the array. So basically, if the field array of a document has 3 elements, it will return 3 documents and that field will have their corresponding values and is no longer an array
    { $unwind: '$startDates' }, // output: 3 documents with different startDates
    // We use match to select documents
    {
      $match: {
        startDates: {
          // We want our date to be between the first and last day of the current year
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    // We use group to group the tours by months
    {
      $group: {
        // MongoDB provides operators that work for dates
        _id: { $month: '$startDates' },
        // As a document is processed, it adds 1 to the counter
        numTourStarts: { $sum: 1 },
        // Creating an array of tour names. As each document goes through the pipeline, the selected element will be pushed into the array
        tours: { $push: '$name' },
      },
    },
    // $addFields: Adds fields to documents. Here we use it to create a new month field with the same value as _id
    {
      $addFields: { month: '$_id' },
    },
    // $project: to remove a field from the output
    {
      $project: {
        _id: 0,
      },
    },
    // sorting by num of tours in descending order
    {
      $sort: { numTourStarts: -1 },
    },
    // $limit: limits amount of documents we output
    {
      $limit: 12,
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: plan,
  });
});

// /tours-within/:distance/center/:latlng/unit/:unit
// /tours-within/233/center/10,-123/unit/mi

exports.getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  // The radius is the distance we want to have as the radius but converted to a special unit called radians. radians = distance/radius-of-earth
  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;

  if (!lat || !lng)
    return next(
      new AppError(
        'Please provide latitude and longitured in the format lat,lng.',
        400
      )
    );

  // $geoWithin operator finds document with the location within a certain geometry
  // $centerSphere takes in an array of the coordinates and radius NOTE: in Mongoose, we specify the lng first before the lat cuz it just works that way
  const tours = await Tour.find({
    startLocation: {
      $geoWithin: {
        $centerSphere: [[lng, lat], radius],
      },
    },
  });

  res.status(200).json({
    status: 'success',
    results: tours.length,
    data: {
      data: tours,
    },
  });
});

exports.getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  // converting distance to miles or km
  const multiplier = unit === 'mi' ? 0.000621371 : 0.001;

  if (!lat || !lng)
    return next(
      new AppError(
        'Please provide latitude and longitured in the format lat,lng.',
        400
      )
    );

  const distances = await Tour.aggregate([
    // For geospatial aggregation, there is only 1 stage, $geoNear. $geoNear always needs to be first in the pipeline. $geoNear requires at lest one of our fields contains a geospatial index (in this case, startLocation). $geoNear will use that index to perform the calculation automatically. If you have multiple fields with indexes, you'll need to use the keys parameter in order to define the field that you want to use for calculations.
    // Fixed: This doesn't work still because it's not the first stage in the pipeline(even though it is here). But that's because of an aggregation middleware we wrote in the tourModel.
    {
      $geoNear: {
        // "near" is the point from which to calculate the distances. All the distances will be calculated from the "near" point and then all the start locations. The point needs to be defined as geoJSON, like how we did in the schema (define type and coordinates)
        near: {
          type: 'Point',
          coordinates: [lng * 1, lat * 1], // We multiply by 1 to convert to numbers
        },
        // the field that will be created and where all the calculated distances will be stored
        distanceField: 'distance', // We name the field distance
        distanceMultiplier: multiplier, // converting meters to km by dividing by 1000
      },
    },
    // $project stage is for deselecting or selecting specific fields to output
    {
      $project: {
        distance: 1,
        name: 1,
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      data: distances,
    },
  });
});
