// Importing all dependencies
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const { User, Note } = require('./models/Note'); // Schema is in a file named 'Note.js'
const methodOverride = require('method-override');
const flash = require('connect-flash');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const port = 3000;

//Middlewares
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(session({
  secret: 'your_session_secret',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Configure flash middleware
app.use(flash());

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'dy3hvnjb6',
  api_key: '147847545734533',
  api_secret: 'ZoqmXqFBB-vHhAxQnNQGAJUMA8M',
  secure: true
});
// Configure multer storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'notes',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'xlsx','docx','ppt'] // Add more allowed formats if needed
  }
});
// Serve static files from the public directory
app.use(express.static('public'));



// Configure Multer for file uploads
const upload = multer({ storage: storage });
// Configuring Passport.js Strategy
passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return done(null, false, { message: 'Incorrect email' });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return done(null, false, { message: 'Incorrect password' });
    }
    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    done(err, user);
  });
});
// Define authentication middleware
const isAuthenticated = (req, res, next) => {
  // If user is authenticated, continue to the next middleware or route handler
  if (req.isAuthenticated()) {
    return next();
  }
  // If user is not authenticated, redirect to the login page
  res.redirect('/login');
};

// Connecting Database
mongoose.connect('mongodb://localhost:27017/NoteApp', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

//User Routes---------------->

//Register Route
app.get('/register', (req, res) => {
  res.render('register');
});
app.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).send('User already exists');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      email,
      password: hashedPassword
    });
    await newUser.save();
    res.send('User registered successfully');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// User Routes
app.get('/login', (req, res) => {
  res.render('login');
});
//Login Route
app.post('/login', passport.authenticate('local', {
  successRedirect: '/notes',
  failureRedirect: '/login',
  failureFlash: true
}));
//Logout Route
app.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error logging out' });
    }
    res.redirect('/login');
  });
});


//Notes Routes------------------------>

// Home Route
app.get('/home',(req,res)=>{
    res.render('home');
});
// Creating a new note
app.get('/notes/new', (req, res) => {
  res.render('createNote');
});
app.post('/notes', upload.array('files', 5) ,async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Extract file URLs from the uploaded files
    const fileUrls = req.files.map(file => file.path);
    const fileNames=req.files.map(file => file.originalname);

    const newNote = new Note({
      title,
      content,
      fileUrls: fileUrls,
      fileNames:fileNames,
      user: req.user._id
    });
    console.log(newNote);
    const savedNote = await newNote.save();
    res.redirect('/notes');
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error saving note' });
  }
});
app.get('/notes', isAuthenticated ,(req, res) => {
  Note.find({ user: req.user._id }, (err, notes) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Error fetching notes' });
    } else {
      res.render('allNotes', { notes });
    }
  });
});

// File download Route
app.post('/download', isAuthenticated ,async (req, res) => {
  try {
    // Retrieve the file URL from the request body
    const { fileUrl } = req.body;

    // Get the public_id from the fileUrl
    const publicId = fileUrl.substring(fileUrl.lastIndexOf('/') + 1, fileUrl.lastIndexOf('.'));

    // Generate a signed URL for the file download
    const timestamp = Math.round(new Date().getTime() / 1000); // Current Unix timestamp
    const signature = cloudinary.utils.api_sign_request({ public_id: publicId, timestamp: timestamp }, 'ZoqmXqFBB-vHhAxQnNQGAJUMA8M');
    const signedUrl = `${fileUrl}?_a=${signature}`;

    // Redirect the client to the signed URL for download
    res.redirect(signedUrl);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).send('Error downloading file');
  }
});
app.get('/notes/:id', isAuthenticated,(req, res) => {
  const noteId = req.params.id;
  Note.findOne({ _id: noteId, user: req.user._id }, (err, note) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Error fetching note' });
    } else if (!note) {
      res.status(404).json({ error: 'Note not found' });
    } else {
      res.render('singleNote', { note });
    }
  });
});
// Update Routes
app.get('/notes/:id/edit', isAuthenticated ,(req, res) => {
  const noteId = req.params.id;
  Note.findOne({ _id: noteId, user: req.user._id }, (err, note) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Error fetching note' });
    } else if (!note) {
      res.status(404).json({ error: 'Note not found' });
    } else {
      res.render('updateNote', { note });
    }
  });
});
app.put('/notes/:id', upload.array('files',5),async(req, res) => {
  try{
    const noteId = req.params.id;
    const { title, content } = req.body;
    console.log(noteId)
    // Check if note exists and user owns it
    const note = await Note.findOne({ _id: noteId, user: req.user._id });
    if (!note) {
      return res.status(404).json({ error: 'Note not found or unauthorized' });
    }
    // Update note title and content
    note.title = title;
    note.content = content;

    // Check if files were uploaded
    if (req.files && req.files.length > 0) {
      // Extract file URLs and original names from the uploaded files
      const newFileUrls = req.files.map(file => file.path);
      const newFileNames = req.files.map(file => file.originalname);

      // Update note fileUrls and fileNames with the new file URLs and original names
      note.fileUrls = note.fileUrls.concat(newFileUrls);;
      note.fileNames =  note.fileNames.concat(newFileNames);
    }
    console.log(note)

    // Save the updated note
    await note.save();

    // Redirect to the updated note page
    res.redirect('/notes/' + noteId);
  }
  catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error updating note' });
  }
});
// Delete Route
app.get('/notes/:id/delete',isAuthenticated,(req, res) => {
  const noteId = req.params.id;
  Note.findOne({ _id: noteId, user: req.user._id }, (err, note) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Error fetching note' });
    } else if (!note) {
      res.status(404).json({ error: 'Note not found' });
    } else {
      res.render('deleteNote', { note });
    }
  });
});
// Delete Route
app.delete('/notes/:id',(req, res) => {
  const noteId = req.params.id;
  Note.findOneAndDelete({ _id: noteId, user: req.user._id }, (err) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Error deleting note' });
    } else {
      res.redirect('/notes');
    }
  });
});
// Server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
