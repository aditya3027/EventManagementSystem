const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define User Schema
const userSchema = new Schema({
  username: { 
    type: String, 
    required: true
  },
  email: { 
    type: String, 
    required: true 
  },
  password: { 
    type: String, 
    required: true 
  }
});

// Define Note Schema
const noteSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  //For uploading images and files
  imageUrls: [{
    type: String
  }],
  fileUrls: [{
    type: String
  }],
  //Storing original filenames
  fileNames: [{
    type: String
  }],
  // Reference to the User model
  user: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  }
});

// Define User model
const User = mongoose.model('User', userSchema);

// Define Note model
const Note = mongoose.model('Note', noteSchema);

// Export models
module.exports = { User, Note };
