import NextAuth from "next-auth";
import { getAuthOptions } from "@/lib/auth";

type AuthRouteContext = { params: Promise<{ nextauth: string[] }> };

async function handler(req: Request, context: AuthRouteContext) {
  const nextAuthHandler = NextAuth(await getAuthOptions());
  return nextAuthHandler(req, context);
}

export { handler as GET, handler as POST };
