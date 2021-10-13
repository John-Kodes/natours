const fs = require('fs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Tour = require('../../models/tourModel');
const Review = require('../../models/reviewModel');
const User = require('../../models/userModel');

dotenv.config({ path: './config.env' });

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
  })
  .then(() => console.log('DB connection successful!'));

// Read JSON file
const tours = JSON.parse(
  fs.readFileSync(`${__dirname}/tours.json`, 'utf-8') // by default, the root folder is where the application is running. __dirname is the directory of where the current file is
);
const users = JSON.parse(fs.readFileSync(`${__dirname}/users.json`, 'utf-8'));
const reviews = JSON.parse(
  fs.readFileSync(`${__dirname}/reviews.json`, 'utf-8')
);

// Import data into DB
const importData = async () => {
  try {
    await Tour.create(tours); // the Model.create() method is used to create documents to insert into the datatbase but it can also accept an array of documents
    await User.create(users, { validateBeforeSave: false });
    await Review.create(reviews);
    console.log('Data successfully loaded!');
  } catch (err) {
    console.log(err);
  }
  process.exit(); // Exits no matter if an error occurs or not
};

// Delete all data from collection
const deleteData = async () => {
  try {
    await Tour.deleteMany();
    await User.deleteMany();
    await Review.deleteMany();
    console.log('Data successfully deleted!');
  } catch (err) {
    console.log(err);
  }
  process.exit(); // An aggressive way of stopping an application. *use wisely*
};

// an array of 2 arguments of running this node
console.log(process.argv);
/* 
   command: node dev-data/data/import-dev-data --import
   output: [
  'C:\\Program Files\\nodejs\\node.exe',
  'C:\\Users\\jdani\\Desktop\\Code\\Node JS Course\\4-Natours-project\\dev-data\\data\\import-dev-data',
  '--import'
] */

// node dev-data/data/import-dev-data --import: We can use this to create a simple command line application which will import/delete the data when we specify this option like so:
if (process.argv[2] === '--import') {
  importData();
} else if (process.argv[2] === '--delete') {
  deleteData();
}
