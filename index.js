const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express()
const port = process.env.PORT || 5000;

//middle ware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fmeaiip.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// middle tare:
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorization' });
    }

    const token = authHeader.split(' ')[1];
    // console.log(token);
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' });
        }
        req.decoded = decoded;
        // console.log(decoded.email);
        next();
    });

}

async function run() {

    try {
        await client.connect();
        const servicesCollection = client.db('doctor_portal').collection('services');
        const bookingCollection = client.db('doctor_portal').collection('booking');
        const usersCollection = client.db('doctor_portal').collection('users');

        // all get api :
        app.get('/services', async (req, res) => {
            const query = {}
            const cursor = servicesCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        })


        //available services
        app.get('/available', async (req, res) => {
            // const date = 'Nov 11, 2022';
            const date = req.query.date;
            //stap 1: get all services:
            const services = await servicesCollection.find().toArray();
            //stap 2:
            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();
            // stap 3:
            services.forEach(service => {
                const bookingServices = bookings.filter(b => b.treatment === service.name);
                const booked = bookingServices.map(b => b.slot);

                const available = service.slots.filter(s => !booked.includes(s));

                service.slots = available;
                //   console.log(services);
            })
            res.send(services);

        })




        // get patient informational:
        app.get('/booking', verifyJWT, async (req, res) => {
            const patient = req.query.patient;
            const decodedEmail = req.decoded.email;
            if (patient === decodedEmail) {
                const query = { patient: patient };
                const bookings = await bookingCollection.find(query).toArray();
                 return res.send(bookings);
            }else{
              return res.status(403).send({message:'forbidden access'});
            }
            // console.log(decodedEmail);

           
        })



        //all put api :
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
            res.send({ result, accessToken: token });

        })



        // api post api :
        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient };
            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists });
            }
            const result = await bookingCollection.insertOne(booking);
            return res.send({ success: true, result });
        })



    }
    finally {

        // console.log('efefefefef');
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello doctor World test!')
})

app.listen(port, () => {
    console.log(`Doctor app listening on port ${port}`)
})
