require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;
const stripe = require("stripe")(process.env.PAYMENT_SECRET);

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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
		const loanApplicationsCollection = db.collection("loanApplications");

		app.get("/users", async (req, res) => {
			const query = {};
			const searchText = req.query.searchText || "";
			const page = parseInt(req.query.page) || 1;
			const limit = parseInt(req.query.limit) || 5;

			if (searchText) {
				query.$or = [
					{ displayName: { $regex: searchText, $options: "i" } },
				];
			}

			const skip = (page - 1) * limit;

			const users = await usersCollection
				.find(query)
				.skip(skip)
				.limit(limit)
				.sort({ create_at: -1 })
				.toArray();

			const totalUsers = await usersCollection.countDocuments(query);

			res.send({
				users,
				totalUsers,
				totalPages: Math.ceil(totalUsers / limit),
				currentPage: page,
			});
		});

		app.get("/users/:email/role", async (req, res) => {
			const { email } = req.params;
			const query = { email };
			const user = await usersCollection.findOne(query);
			res.send({ role: user?.role, userStatus: user?.userStatus });
		});

		app.get("/users/:userId", async (req, res) => {
			const { userId } = req.params;
			const query = { _id: new ObjectId(userId) };
			const result = await usersCollection.findOne(query);
			res.send(result);
		});

		app.patch("/users/:userId", async (req, res) => {
			const { userId } = req.params;
			const newStatus = req.body;
			const query = { _id: new ObjectId(userId) };
			const updateDoc = {
				$set: {
					userStatus: newStatus.userStatus,
				},
			};
			const result = await usersCollection.updateOne(query, updateDoc);
			res.send(result);
		});

		app.patch("/users/suspended/:userId", async (req, res) => {
			const { userId } = req.params;
			const updateInfo = req.body;
			const query = { _id: new ObjectId(userId) };
			const updatedDoc = {
				$set: {
					userStatus: updateInfo.userStatus,
					suspendReason: updateInfo.suspendReason,
					suspendFeedback: updateInfo.suspendFeedback,
				},
			};
			const result = await usersCollection.updateOne(query, updatedDoc);
			res.send(result);
		});

		app.post("/users", async (req, res) => {
			const userInfo = req.body;
			userInfo.userStatus = "pending";
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
			const { email, searchText } = req.query;
			if (email) {
				query.managerEmail = email;
			}
			if (searchText) {
				query.$or = [{ title: { $regex: searchText, $options: "i" } }];
			}
			const cursor = loansCollection.find(query).sort({ create_at: -1 });
			const result = await cursor.toArray();
			res.send(result);
		});

		app.get("/featured-loans", async (req, res) => {
			const query = { showHome: true };
			const cursor = loansCollection
				.find(query)
				.limit(3)
				.sort({ create_at: -1 });
			const result = await cursor.toArray();
			res.send(result);
		});

		app.get("/loans/:loanID", async (req, res) => {
			const { loanID } = req.params;
			const query = { _id: new ObjectId(loanID) };
			const result = await loansCollection.findOne(query);
			res.send(result);
		});

		app.patch("/loans/:loanID", async (req, res) => {
			const { loanID } = req.params;
			const newStatus = req.body;
			const query = { _id: new ObjectId(loanID) };
			const updatedDoc = {
				$set: {
					showHome: newStatus.showHome,
				},
			};
			const result = await loansCollection.updateOne(query, updatedDoc);
			res.send(result);
		});

		app.post("/loans", async (req, res) => {
			const newLoan = req.body;
			newLoan.create_at = new Date();
			const result = await loansCollection.insertOne(newLoan);
			res.send(result);
		});

		app.delete("/loans/:loanID", async (req, res) => {
			const { loanID } = req.params;
			const query = { _id: new ObjectId(loanID) };
			const result = await loansCollection.deleteOne(query);
			res.send(result);
		});

		// Loan Application Related API's
		app.get("/loan-applications", async (req, res) => {
			const qurey = {};
			const { email, feeStatus, searchText } = req.query;

			if (email) {
				qurey.email = email;
			}
			if (feeStatus) {
				qurey.feeStatus = feeStatus;
			}
			if (searchText) {
				qurey.$or = [
					{ feeStatus: { $regex: searchText, $options: "i" } },
				];
			}
			const cursor = loanApplicationsCollection
				.find(qurey)
				.sort({ create_at: -1 });

			const result = await cursor.toArray();
			res.send(result);
		});

		app.post("/loan-applications", async (req, res) => {
			const applicationInfo = req.body;
			applicationInfo.feeStatus = "unpaid";
			applicationInfo.create_at = new Date();
			const result = await loanApplicationsCollection.insertOne(
				applicationInfo
			);
			res.send(result);
		});

		app.patch("/loan-applications/:id", async (req, res) => {
			const { id } = req.params;
			const { status } = req.body;
			const qurey = { _id: new ObjectId(id) };
			const updatedDoc = {
				$set: {
					feeStatus: status,
					approvedAt: new Date(),
				},
			};

			const result = await loanApplicationsCollection.updateOne(
				qurey,
				updatedDoc
			);

			res.send(result);
		});

		app.delete("/loan-applications/:id", async (req, res) => {
			const { id } = req.params;
			const query = { _id: new ObjectId(id) };
			const result = await loanApplicationsCollection.deleteOne(query);
			res.send(result);
		});

		// Payment Related API's
		app.post("/payment-checkout-session", async (req, res) => {
			const paymentInfo = req.body;
			console.log(paymentInfo);
			const session = await stripe.checkout.sessions.create({
				line_items: [
					{
						price_data: {
							currency: "USD",
							product_data: {
								name: "Loan Processing Fee", // any name you want
							},
							unit_amount: 1000,
						},
						quantity: 1,
					},
				],
				metadata: { loanId: paymentInfo.loanId },
				mode: "payment",
				customer_email: paymentInfo.userEmail,
				success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
				cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancel`,
			});

			res.send({ url: session.url });
		});

		app.patch("/payment-success", async (req, res) => {
			const sessionId = req.query.session_id;
			const session = await stripe.checkout.sessions.retrieve(sessionId);

			if (session.payment_status === "paid") {
				const id = session.metadata.loanId;
				const query = { _id: new ObjectId(id) };
				const update = {
					$set: {
						feeStatus: "pending",
						paid_at: new Date(),
						transactionId: session.payment_intent,
					},
				};
				const result = await loanApplicationsCollection.updateOne(
					query,
					update
				);

				res.send(result);
			}

			res.send({ success: false });
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
