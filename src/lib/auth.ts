import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { verifyTurnstile } from "./turnstile";
import { decryptIfEncrypted } from "./crypto";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        turnstileToken: { label: "Turnstile", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const config = await prisma.appConfig.findUnique({ where: { id: "default" } });
        const turnstileSecretKey = config?.turnstileSecretKey
          ? decryptIfEncrypted(config.turnstileSecretKey)
          : "";
        if (turnstileSecretKey) {
          const token = credentials.turnstileToken;
          if (!token || !(await verifyTurnstile(token, turnstileSecretKey))) {
            return null;
          }
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
        });
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;
        if (
          user.role !== "ADMIN" &&
          !user.emailVerifiedAt &&
          (config?.emailVerificationRequired || user.status === "PENDING_EMAIL")
        ) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }
        if (user.status !== "ACTIVE") return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.id as string;
        (session.user as { role: string }).role = token.role as string;
      }
      return session;
    },
  },
};
