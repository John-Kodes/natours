const mongoose = require('mongoose');
const slugify = require('slugify');
// const User = require('./userModel');
// const validator = require('validator');

// inside we pass our schema as an object. Mongoose uses the native JS data types
const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'], // specifying the error we want to display if field is missing
      unique: true,
      trim: true, // removes all the 'space' in the beginning and end of the string
      maxlength: [40, 'A tour name must have less or equal than 40 characters'],
      minlength: [10, 'A tour name must have more or equal to 10 characters'],
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either: easy, medium, difficult',
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      // Creating a setter function. This will run each time a new value is set for this field
      set: (val) => Math.round(val * 10) / 10,
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price'],
    },
    priceDiscount: {
      type: Number,
      // Should be an object to assign both error message and validator function
      validate: {
        // Caveat: The "this" keyword is only gonna point to the current document when we are creating a new document so this won't work on UPDATE methods. So creating validators with the "this" keyword will only work if you're creating new documents.
        validator: function (val) {
          return val < this.price; // 'this' keyword points to the current document
        },
        // message also has access to the value by using '{VALUE}'. Works weird way cuz of mongoose
        message: 'Discount price ({VALUE}) should be less than price',
      },
    },
    summary: {
      type: String,
      trim: true, // removes all the 'space' in the beginning and end of the string
      required: [true, 'A tour must have a summary'],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image'],
    },
    images: [String], // This specifies an array of strings
    createdAt: {
      type: Date,
      default: Date.now(), // Gives us a time stamp in milliseconds of when executed.
      select: false,
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false,
    },
    // the object is not a schema type options object. This time, it's an embedded object. Inside, we specify a couple of properties. For it to be recognized as geospatial JSON, we need the type and coordinates properies. Each of those fields will have their own schema type options (at least "type" and "coordinates" field)
    startLocation: {
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'],
      },
      coordinates: [Number], // This means we expect an array of numbers
      address: String,
      description: String,
    },
    // Wrapping the embedded object in an array means we can accept multiple locations/coordinates
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number,
      },
    ],
    guides: [
      {
        // Type is basically mongoDB ID
        type: mongoose.Schema.ObjectId,
        // specifies which collection we are referencing to
        ref: 'User',
      },
    ],
  },
  {
    // each time the data is outputted as JSON and Object, we want virtuals to be true. A virtual property is a property that is not stroed in MongoDB
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// tourSchema.index({ price: 1 }); // 1 means we are sorting the price index in an ascending order while -1 is descending
tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ slug: 1 });

// IMP: Inorder to do geospatial queries, we need to first attribute an index to the field where the geospatial data that we search for is stored (in this case, startLocation)
// For geospatial data, the index needs to be a 2D sphere index if the data describes real points on the Earth like sphere('2dsphere'). Or instead, we can also use a 2D index if we're using just fictional points on a simple 2D plane.
tourSchema.index({ startLocation: '2dsphere' });

//__ Defining virtual properties on a schema
// .virtual(name)
// .get(function(){}): the virtual property will be created each time that we get some data out of the database. It's called a  getter. The callback function should be a real function because arrow functinos dont get their own "this" keyword
tourSchema.virtual('durationWeeks').get(function () {
  return this.duration / 7; // calculating the duration in weeks. The "this" keyword is pointing to the current document (JSON data)
  // what we return is the value of the virtual property
});
// lastly we need to add a schema options
// With this, durationWeeks wont be persisted into the database but only wil be there as soon as we get the data.

//// VIRTUAL POPULATE
tourSchema.virtual('reviews', {
  ref: 'Review', // name of model
  // specifying the the name of the fields in order to connect the 2 datasets (parent/child)
  foreignField: 'tour', // name of field in the other model (reviewModel) where the reference to the current model is stored (tourModel)
  localField: '_id', // specifying where the id is stored in the current model
});

////__ Document middleware
// .pre('event', function(){}): runs before secified event
tourSchema.pre('save', function (next) {
  // Since we are using the pre() method, the function will run before the .save() and create()
  // The "this" points to the currently processed document. "this" is used to process the current document
  //// Creating a slug for each document: we usee the slugify package
  // We acheive this by creating a new property to the document object and using the slugify function. Make sure the slug property field is defined in the schema first in order for it to persist
  this.slug = slugify(this.name, { lower: true });
  // Just like in express, we have access to the next() to call the next middleware in the stack
  next();
});

//// EMBEDDING
// tourSchema.pre('save', async function (next) {
//   // We need the userModel(User) for query searching
//   // The result of this is an array of promises
//   const guidesPromises = this.guides.map(async (id) => await User.findById(id));

//   // settling all the promises before we reach the next line of code and embedding the user documents into the guides property
//   this.guides = await Promise.all(guidesPromises);
//   next();
// });

// handling a document middleware AFTER an event .post()
// has access to the next() but also the document that was just saved. The "this" keyword no longer points to the document
tourSchema.post('save', (doc, next) => {
  // console.log(doc);
  next(); // it's good practice to always include next() even if there arent other middleware
});

////__ QUERY MIDDLEWARE: PRE HOOK
// We still use .pre() but inside, we put the hook 'find'
// "this" keyword points to the current query that we will process
// use case: let's suppose we can have secret tours in our database. Tours that are only offered internally or for a small VIP group of people that the public shouldn't know about. Since these tours are secret, we dont want the secret tours to appear in the results outputs. What we will do is create a secret tour field and only query for tours that are not secret
// We first add secret tour field in our schema
// This middleware does not affect queries that use .findOne(). With this regular expression, this middleware should be executed for any commands that start with "find". fineOne, findOneAndDelete, findOneAndUpdate, etc.
tourSchema.pre(/^find/, function (next) {
  // "this" keyword is the query object so we can use query methods on it
  this.find({ secretTour: { $ne: true } });

  // Adding a property to the query object to calculate the time
  this.start = Date.now();
  next();
});

// QUERY MIDDLEWARE: POST HOOK
tourSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt',
  });

  next();
});

// // In the callback function, we get access to all the documents from the query
// tourSchema.post(/^find/, function (docs, next) {
//   // calculating the time it took to call this hook after the query pre hook
//   console.log(`Query took: ${Date.now() - this.start} ms`);

//   next();
// });

////__ AGREGATION MIDDLEWARE
// 'this' keyword points to the current aggregation. this.pipeline() outputs the array of stages.
tourSchema.pre('aggregate', function (next) {
  // conditionally show all secret tours if we arent using $geoNear in the aggregation pipeline
  if (!Object.keys(this.pipeline()[0])[0] === '$geoNear') {
    // adding a stage at the start of the array. This will exclude all secret tour documents
    this.pipeline().unshift({ $match: { secretTour: { $ne: true } } });
  }

  // console.log(this.pipeline());
  next();
});

//// Creating a model from the schema
// mongoose.model('ModelName', schema)
// Convention to use upercase on modelname and variables, just to know we are dealing with a model
const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
