const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

console.log(process.env.DB_PASS);
console.log(process.env.DB_USER);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lk92epi.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

/* custom midleware */
// middleware 1
const logger = async (req, res, next) => {
    console.log('called:', req.host, req.originalUrl)
    next();
}

// middleware 2
const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token;
    console.log('value of token in middleware:', token)
    if (!token) {
        return res.status(401).send({ message: 'not authorized' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        // error
        if (err) {
            console.log(err);
            return res.status(401).send({ message: 'unauthorized access' })
        }
        // valid
        req.user = decoded;
        next();
    })
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const roomCollection = client.db('stayZen').collection('rooms');
        const bookingCollection = client.db('stayZen').collection('bookings')


        /* token */
        app.post('/jwt', logger, async (req, res) => {
            const user = req.body;
            console.log(user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: false,
                })
                .send({ success: true })
        })


        /* rooms */
        // get all rooms
        app.get('/rooms', logger, async (req, res) => {
            const cursor = roomCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })

        // get specific room for room detiles page
        app.get('/rooms/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await roomCollection.findOne(query);
            res.send(result);
        })

        // get specific room for booking page
        app.get('/book/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const options = {
                // Include only the `title` and `imdb` fields in the returned document
                projection: { name: 1, price: 1, img: 1, id: 1 },
            };
            const result = await roomCollection.findOne(query, options);
            res.send(result);
        })



        /* bookings */
        // get bookings based on user
        app.get('/bookings', logger, verifyToken, async (req, res) => {
            console.log(req.query.email);
            console.log('user with valid token', req.user);
            if (req.query.email !== req.user.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            let query = {}
            if (req.query?.email) {
                query = { email: req.query.email }
            }
            const cursor = bookingCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        // get booking data to update
        app.get('/booking/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookingCollection.findOne(query);
            res.send(result);
        })

        // add bookings
        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            console.log(booking);
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        })

        // delete booking
        app.delete('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookingCollection.deleteOne(query);
            res.send(result);
        })

        // update booking
        app.put('/booking/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updatedBooking = req.body;
            const booking = {
                $set: {
                    room_name: updatedBooking.room_name,
                    price: updatedBooking.price,
                    img: updatedBooking.img,
                    cheakIn: updatedBooking.cheakIn,
                    cheakOut: updatedBooking.cheakOut,
                    number: updatedBooking.number
                }
            }
            const result = await bookingCollection.updateOne(filter, booking, options);
            res.send(result);
        })






        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('StayZen is running')
})

app.listen(port, () => {
    console.log(`StayZen server is running on port ${port}`);
})