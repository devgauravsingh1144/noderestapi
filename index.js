const express = require('express');
const admin = require('firebase-admin');
const bcrypt = require('bcrypt');
// Initialize Firebase Admin SDK
const serviceAccount = require('./servicekey.json'); // Path to your service account key file
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore(); // Initialize Firestore

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

app.post('/api/data', async (req, res) => {
  try {
    const { name, email, password, mobile } = req.body;
    
    // First, check if the email already exists in the database
    const collectionRef = db.collection('data');
    const emailExists = await collectionRef
      .where('email', '==', email)
      .get()
      .then(snapshot => !snapshot.empty);

    if (emailExists) {
      return res.status(409).json({ error: 'Email already exists' }); // 409 Conflict
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Construct the data to be stored in the database
    const newData = {
      name,
      email,
      password: hashedPassword,
      mobile,
    };

    // Check if the collection exists
    const collectionExists = await collectionRef.get().then(snapshot => !snapshot.empty);

    if (!collectionExists) {
      // Collection doesn't exist, create it
      await collectionRef.doc().set({}); // Creating an empty document to force creation of the collection
    }

    // Add data to the collection
    const docRef = await collectionRef.add(newData);

    res.status(201).json({ message: 'Data created successfully', id: docRef.id });

  } catch (error) {
    console.error('Error adding document: ', error);
    res.status(500).json({ error: 'Failed to create data' });
  }
});


// app.post('/api/data', async (req, res) => {
//   try {
//       const {name, email, password,mobile } = req.body;
      
//       // Hash the password
//       const hashedPassword = await hashPassword(password);

//       // Construct the data to be stored in the database
//       const newData = {
//           name:name,
//           email: email,
//           password: hashedPassword,
//           mobile:mobile
//           // Add other data fields as needed
//       };

//       const collectionRef = db.collection('data');

//       // Check if the collection exists
//       const collectionExists = await collectionRef.get().then(snapshot => !snapshot.empty);

//       if (!collectionExists) {
//           // Collection doesn't exist, create it
//           await collectionRef.doc().set({}); // Creating an empty document to force creation of the collection
//       }

//       // Add data to the collection
//       const docRef = await collectionRef.add(newData);

//       res.status(201).json({ message: 'Data created successfully', id: docRef.id });
//   } catch (error) {
//       console.error('Error adding document: ', error);
//       res.status(500).json({ error: 'Failed to create data' });
//   }
// });

// Function to hash a password
async function hashPassword(password) {
  const saltRounds = 10; // Number of salt rounds (higher is slower but more secure)
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  return hashedPassword;
}
  
// get All
app.get('/api/data/', (req, res) => {
    db.collection('data').get()
      .then(snapshot => {
        const dataArray = [];
        snapshot.forEach(doc => {
          dataArray.push(doc.data());
        });
        res.status(200).json(dataArray);
      })
      .catch(err => {
        console.error('Error getting documents: ', err);
        res.status(500).json({ error: 'Failed to fetch data' });
      });
});

// Read operation
app.get('/api/data/:id', (req, res) => {
  const dataId = req.params.id;
  db.collection('data').doc(dataId).get()
    .then(doc => {
      if (!doc.exists) {
        res.status(404).json({ error: 'Data not found' });
      } else {
        res.status(200).json(doc.data());
      }
    })
    .catch(err => {
      console.error('Error getting document: ', err);
      res.status(500).json({ error: 'Failed to fetch data' });
    });
});

// Update operation
app.put('/api/data/:id', (req, res) => {
  const dataId = req.params.id;
  const updatedData = req.body;
  db.collection('data').doc(dataId).set(updatedData, { merge: true })
    .then(() => {
      res.status(200).json({ message: 'Data updated successfully' });
    })
    .catch(err => {
      console.error('Error updating document: ', err);
      res.status(500).json({ error: 'Failed to update data' });
    });
});

// Delete operation
app.delete('/api/data/:id', (req, res) => {
  const dataId = req.params.id;
  db.collection('data').doc(dataId).delete()
    .then(() => {
      res.status(200).json({ message: 'Data deleted successfully' });
    })
    .catch(err => {
      console.error('Error deleting document: ', err);
      res.status(500).json({ error: 'Failed to delete data' });
    });
});


// Endpoint to retrieve data based on email and password match
app.post('/api/data/retrieve', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Get the user document from Firestore based on the email
        const userSnapshot = await db.collection('data').where('email', '==', email).limit(1).get();
        if (userSnapshot.empty) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Extract user data
        const userData = userSnapshot.docs[0].data();
        const storedHashedPassword = userData.password;

        // Compare provided password with stored hashed password
        const passwordMatch = await bcrypt.compare(password, storedHashedPassword);
        if (!passwordMatch) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }

        // Password matches, respond with user data
        res.status(200).json(userData);
    } catch (error) {
        console.error('Error retrieving data: ', error);
        res.status(500).json({ error: 'Failed to retrieve data' });
    }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
