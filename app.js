const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const app = express();
const port = 3000;

// Configure sessions and connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/attendance', { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Set up session middleware
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));

// Set up body parser for handling form data
app.use(express.urlencoded({ extended: true }));

// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname));

// Define MongoDB schema and models
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String
});

const User = mongoose.model('User', userSchema);

const attendanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: Date
});

const AttendanceRecord = mongoose.model('AttendanceRecord', attendanceSchema);

// Function to create and save a new user
const createNewUser = async (username, password, role) => {
  const newUser = new User({
    username: username,
    password: password,
    role: role
  });

  try {
    await newUser.save();
    console.log(`New ${role} user created and saved`);
  } catch (error) {
    console.error(`Error creating and saving ${role} user:`, error);
  }
};

// Create initial users
createNewUser('john_doe', 'secret_password', 'student');
createNewUser('jane_smith', 'teacher_password', 'teacher');

// Create 10 additional student users
for (let i = 1; i <= 10; i++) {
  createNewUser(`student${i}`, `student${i}_password`, 'student');
}

// Define routes
app.get('/', (req, res) => {
  res.redirect('/login'); // Redirect to the login page
});

app.get('/login', (req, res) => {
  res.render('login');
});




app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });

  if (user) {
    req.session.user = user;
    if (user.role === 'student') {
      res.redirect('/dashboard');
    } else if (user.role === 'teacher') {
      res.redirect('/teacher-dashboard');
    }
  } else {
    res.send('Invalid username or password');
  }
});

app.get('/dashboard', async (req, res) => {
  if (req.session.user && req.session.user.role === 'student') {
    const attendanceRecords = await AttendanceRecord.find({ user: req.session.user._id });
    res.render('dashboard', { user: req.session.user, attendanceRecords });
  } else {
    res.redirect('/login');
  }
});

app.get('/teacher-dashboard', async (req, res) => {
  if (req.session.user && req.session.user.role === 'teacher') {
      try {
          const students = await User.find({ role: 'student' });
          res.render('teacher-dashboard', { user: req.session.user, students, attendanceReport: null });
      } catch (error) {
          console.error('Error fetching students:', error);
          res.status(500).send('Error fetching students');
      }
  } else {
      res.redirect('/login');   }
    });



app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/login');
  });
});

  // Handle Punch In
app.post('/punch_in', async (req, res) => {
    if (req.session.user && req.session.user.role === 'student') {
      const newAttendanceRecord = new AttendanceRecord({
        user: req.session.user._id,
        timestamp: new Date(),
        punchType: 'Punch In' // Add a new field to indicate the punch type
      });
  
      try {
        await newAttendanceRecord.save();
        res.redirect('/dashboard');
      } catch (error) {
        console.error('Error recording attendance:', error);
        res.status(500).send('Error recording attendance');
      }
    } else {
      res.redirect('/login');
    }
  });
  
  // Handle Punch Out
  app.post('/punch_out', async (req, res) => {
    if (req.session.user && req.session.user.role === 'student') {
      const newAttendanceRecord = new AttendanceRecord({
        user: req.session.user._id,
        timestamp: new Date(),
        punchType: 'Punch Out' // Add a new field to indicate the punch type
      });
  
      try {
        await newAttendanceRecord.save();
        res.redirect('/dashboard');
      } catch (error) {
        console.error('Error recording attendance:', error);
        res.status(500).send('Error recording attendance');
      }
    } else {
      res.redirect('/login');
    }
  });
  
 

  app.post('/generate_report', async (req, res) => {
    if (req.session.user && req.session.user.role === 'teacher') {
        const selectedStudent = req.body.student; // Get the selected student's ID from the form
        const startDate = new Date(req.body.startDate);
        const endDate = new Date(req.body.endDate);

        try {
            const doc = new PDFDocument();
            const reportFilename = `attendance_report_${selectedStudent}.pdf`;

            res.setHeader('Content-Disposition', `attachment; filename="${reportFilename}"`);
            res.setHeader('Content-Type', 'application/pdf');

            const studentUser = await User.findOne({ _id: selectedStudent });

            const attendanceRecords = await AttendanceRecord.find({
                user: selectedStudent,
                timestamp: { $gte: startDate, $lte: endDate }
            });

            doc.pipe(res);
            doc.fontSize(16).text(`Attendance Report for ${studentUser.username}`, { align: 'center' });

            attendanceRecords.forEach(record => {
                doc.text(`Date: ${record.timestamp.toDateString()}`, { continued: true });
                doc.text(`Event: ${record.punchType}`);
                doc.moveDown(1);
            });

            doc.end();
        } catch (error) {
            console.error('Error generating attendance report:', error);
            res.status(500).send('Error generating attendance report');
        }
    } else {
        res.redirect('/login');
    }
});

app.post('/create_student', async (req, res) => {
  if (req.session.user && req.session.user.role === 'teacher') {
    const { username, password } = req.body;

    try {
      const newStudent = new User({
        username: username,
        password: password,
        role: 'student',
      });

      await newStudent.save();
      res.sendStatus(201); // Created
    } catch (error) {
      console.error('Error creating student:', error);
      res.status(500).send('Error creating student');
    }
  } else {
    res.sendStatus(403); // Forbidden
  }
});
  
// ... (other routes)

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
