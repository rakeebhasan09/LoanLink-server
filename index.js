require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;

const { MongoClient, ServerApiVersion } = require("mongodb");

// Middlewares
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.x65kkeb.mongodb.net/?appName=Cluster0`;

app.get("/", (req, res) => {
	res.send("LoanLink server always running!");
});

const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

async function run() {
	try {
		// Connect the client to the server	(optional starting in v4.7)
		await client.connect();

		const db = client.db("loanlink_db");
		const usersCollection = db.collection("users");
		const loansCollection = db.collection("loans");

		// Users Related API's
		app.get("/users/:email/role", async (req, res) => {
			const { email } = req.params;
			const query = { email };
			const user = await usersCollection.findOne(query);
			res.send({ role: user?.role });
		});

		app.post("/users", async (req, res) => {
			const userInfo = req.body;
			userInfo.create_at = new Date();

			const email = userInfo.email;

			const userExsits = await usersCollection.findOne({ email });
			if (userExsits) {
				return res.send({ message: "User Exist" });
			}

			const result = await usersCollection.insertOne(userInfo);
			res.send(result);
		});

		// Loans Related API's
		app.get("/loans", async (req, res) => {
			const query = {};
			const { email } = req.query;
			if (email) {
				query.managerEmail = email;
			}
			const cursor = loansCollection.find(query).sort({ create_at: -1 });
			const result = await cursor.toArray();
			res.send(result);
		});

		app.post("/loans", async (req, res) => {
			const newLoan = req.body;
			newLoan.create_at = new Date();
			const result = await loansCollection.insertOne(newLoan);
			res.send(result);
		});

		// Send a ping to confirm a successful connection
		await client.db("admin").command({ ping: 1 });
		console.log(
			"Pinged your deployment. You successfully connected to MongoDB!"
		);
	} finally {
		// Ensures that the client will close when you finish/error
		// await client.close();
	}
}
run().catch(console.dir);

app.listen(port, () => {
	console.log(`Example app listening on port ${port}`);
});
