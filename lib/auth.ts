// @ts-nocheck
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { dbConnect } from "./mongodb";
import User from "../models/User";

export const authOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        await dbConnect();
        const user = await User.findOne({ username: credentials.username, active: true });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user._id.toString(),
          username: user.username,
          role: user.role,
          customerId: user.customerId?.toString() || null,
          assignedVehicle: user.assignedVehicle?.toString() || null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.customerId = user.customerId;
        token.assignedVehicle = user.assignedVehicle;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.role = token.role;
      session.user.customerId = token.customerId;
      session.user.assignedVehicle = token.assignedVehicle;
      return session;
    },
  },
};

// Small guard used inside API routes to enforce the access model described in the brief:
//  - superadmin: everything
//  - admin: only within their own customerId
//  - user: only their single assignedVehicle
export function canAccessVehicle(sessionUser, vehicle) {
  if (sessionUser.role === "superadmin") return true;
  if (sessionUser.role === "admin") return sessionUser.customerId === vehicle.customerId.toString();
  if (sessionUser.role === "user") return sessionUser.assignedVehicle === vehicle._id.toString();
  if (sessionUser.role === "driver") return sessionUser.customerId === vehicle.customerId.toString();
  return false;
}
