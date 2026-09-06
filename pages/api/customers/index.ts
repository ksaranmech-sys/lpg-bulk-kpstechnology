// @ts-nocheck
import { getServerSession } from "next-auth/next";
import bcrypt from "bcryptjs";
import { authOptions } from "../../../lib/auth";
import { dbConnect } from "../../../lib/mongodb";
import Customer from "../../../models/Customer";
import User from "../../../models/User";
import Driver from "../../../models/Driver";
import Trip from "../../../models/Trip";
import Vehicle from "../../../models/Vehicle";

// POST /api/customers  -> KPS staff only. Creates the Customer record AND its
// admin login in one step (this is "KPS will create username and password for
// different customers" from the brief).
// Body: { name, mobileNumber, email, adminUsername, adminPassword }
export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.status(401).json({ error: "Not authenticated" });
    await dbConnect();

    if (session.user.role !== "superadmin" && req.method !== "GET") {
      return res.status(403).json({ error: "Only KPS staff can create customers" });
    }

    if (req.method === "POST") {
      const { name, mobileNumber, email, adminUsername, adminPassword } = req.body;
      if (!name || !mobileNumber || !email || !adminUsername || !adminPassword) {
        return res.status(400).json({ error: "All customer and admin login fields are required" });
      }
      if (await User.exists({ username: adminUsername })) {
        return res.status(409).json({ error: "That admin username is already in use" });
      }

      const customer = await Customer.create({ name, mobileNumber, email });
      try {
        const passwordHash = await bcrypt.hash(adminPassword, 10);
        await User.create({
          username: adminUsername,
          passwordHash,
          role: "admin",
          customerId: customer._id,
        });
      } catch (error) {
        await Customer.deleteOne({ _id: customer._id });
        throw error;
      }

      return res.status(201).json({ customer });
    }

    if (req.method === "PATCH") {
      const { customerId, blocked } = req.body;
      if (!customerId || typeof blocked !== "boolean") {
        return res.status(400).json({ error: "Customer and blocked status are required" });
      }
      const customer = await Customer.findByIdAndUpdate(customerId, { blocked }, { new: true });
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      await User.updateMany({ customerId }, { $set: { active: !blocked } });
      return res.status(200).json({ customer });
    }

    if (req.method === "DELETE") {
      const { customerId } = req.body;
      if (!customerId) return res.status(400).json({ error: "Customer is required" });
      const customer = await Customer.findById(customerId);
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      await Promise.all([
        User.deleteMany({ customerId }),
        Driver.deleteMany({ customerId }),
        Trip.deleteMany({ customerId }),
        Vehicle.deleteMany({ customerId }),
      ]);
      await customer.deleteOne();
      return res.status(200).json({ message: "Customer deleted" });
    }

    if (req.method === "GET") {
      const filter = session.user.role === "admin" ? { _id: session.user.customerId } : {};
      const customers = await Customer.find(filter);
      return res.status(200).json(customers);
    }

    res.setHeader("Allow", ["GET", "POST", "PATCH", "DELETE"]);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Customer API error", error);
    return res.status(500).json({ error: "Could not save customer details" });
  }
}
