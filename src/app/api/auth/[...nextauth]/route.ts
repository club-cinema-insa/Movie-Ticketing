import NextAuth from "next-auth";
import { authOptions } from "@/server/auth/config";

// next-auth v4 type son handler `any` dans l'App Router.
const handler = NextAuth(authOptions) as (req: Request, context: unknown) => Promise<Response>;

export { handler as GET, handler as POST };
