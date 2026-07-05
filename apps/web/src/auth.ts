import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        (session.user as { id?: string }).id = user.id;
        (session.user as { locale?: string }).locale = (user as { locale?: string }).locale ?? "en";
        (session.user as { onboardingCompletedAt?: Date | null }).onboardingCompletedAt = (
          user as { onboardingCompletedAt?: Date | null }
        ).onboardingCompletedAt ?? null;
      }
      return session;
    },
  },
});
