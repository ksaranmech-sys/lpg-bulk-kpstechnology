// @ts-nocheck
import { getServerSession } from "next-auth/next";
import bcrypt from "bcryptjs";
import { authOptions } from "../../../lib/auth";
import { dbConnect } from "../../../lib/mongodb";
import Customer from "../../../models/Customer";
import User from "../../../models/User";

// POST /api/customers  -> KPS staff only. Creates the Customer record AND its
// admin login in one step (this is "KPS will create username and password for
// different customers" from the brief).
// Body: { name, mobileNumber, email, adminUsername, adminPassword }
export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  await dbConnect();

  if (session.user.role !== "superadmin") {
    return res.status(403).json({ error: "Only KPS staff can create customers" });
  }

  if (req.method === "POST") {
    const { name, mobileNumber, email, adminUsername, adminPassword } = req.body;
    const customer = await Customer.create({ name, mobileNumber, email });

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await User.create({
      username: adminUsername,
      passwordHash,
      role: "admin",
      customerId: customer._id,
    });

    return res.status(201).json({ customer });
  }

  if (req.method === "GET") {
    const customers = await Customer.find({});
    return res.status(200).json(customers);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
