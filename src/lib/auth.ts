import crypto from "crypto";
import type { NextAuthOptions, User as NextAuthUser } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { OAuthConfig } from "next-auth/providers/oauth";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { verifyTurnstile } from "./turnstile";
import { decryptIfEncrypted } from "./crypto";
import { getAppConfig } from "@/services/app-config";

const OAUTH_PROVIDER_ID = "custom-oauth";
const DEFAULT_OAUTH_SCOPES = "openid email profile";

type OAuthProfile = Record<string, unknown>;
type MutableAuthUser = NextAuthUser & { role?: string | null };

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email && email.includes("@") ? email : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function oauthProfile(profile: unknown): OAuthProfile {
  return profile && typeof profile === "object" ? (profile as OAuthProfile) : {};
}

function oauthProfileEmail(profile: OAuthProfile) {
  return normalizeEmail(profile.email ?? profile.mail ?? profile.upn ?? profile.preferred_username);
}

function oauthProfileName(profile: OAuthProfile, fallbackEmail: string) {
  return (
    stringValue(profile.name) ??
    stringValue(profile.displayName) ??
    stringValue(profile.preferred_username) ??
    fallbackEmail.split("@")[0]
  );
}

function oauthProfileImage(profile: OAuthProfile) {
  return stringValue(profile.picture) ?? stringValue(profile.avatar) ?? stringValue(profile.avatar_url);
}

function oauthProfileId(profile: OAuthProfile, email: string) {
  const id = profile.sub ?? profile.id ?? profile.uid ?? profile.openid ?? profile.user_id;
  return String(id ?? email);
}

function isOauthEmailVerified(profile: OAuthProfile) {
  const value = profile.email_verified ?? profile.emailVerified;
  return value !== false && value !== "false";
}

function loginError(code: string) {
  return `/login?error=${encodeURIComponent(code)}`;
}

function assignSessionUser(target: MutableAuthUser, user: { id: string; email: string; name: string | null; role: string }) {
  target.id = user.id;
  target.email = user.email;
  target.name = user.name;
  target.role = user.role;
}

async function createRandomPasswordHash() {
  return bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
}

async function handleOauthSignIn(user: MutableAuthUser, rawProfile: unknown) {
  const profile = oauthProfile(rawProfile);
  const email = oauthProfileEmail(profile) ?? normalizeEmail(user.email);
  if (!email) return loginError("OAuthEmailMissing");
  if (!isOauthEmailVerified(profile)) return loginError("OAuthEmailUnverified");

  const name = oauthProfileName(profile, email);
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, status: true, emailVerifiedAt: true },
  });

  if (existing) {
    if (existing.status === "DISABLED" || existing.status === "BANNED") {
      return loginError("OAuthUserDisabled");
    }

    const shouldActivatePendingEmail = existing.status === "PENDING_EMAIL";
    const shouldBackfillProfile = !existing.emailVerifiedAt || (!existing.name && name);
    const nextUser = shouldActivatePendingEmail || shouldBackfillProfile
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            status: shouldActivatePendingEmail ? "ACTIVE" : existing.status,
            emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
            name: existing.name || name,
          },
          select: { id: true, email: true, name: true, role: true },
        })
      : existing;

    if (shouldActivatePendingEmail || existing.status === "ACTIVE") {
      assignSessionUser(user, nextUser);
      return true;
    }

    return loginError("OAuthUserDisabled");
  }

  const config = await getAppConfig();
  if (!config.allowRegistration) return loginError("OAuthRegistrationDisabled");
  if (config.requireInviteCode) return loginError("OAuthInviteRequired");

  const created = await prisma.user.create({
    data: {
      email,
      name,
      password: await createRandomPasswordHash(),
      emailVerifiedAt: new Date(),
      status: "ACTIVE",
    },
    select: { id: true, email: true, name: true, role: true },
  });
  assignSessionUser(user, created);
  return true;
}

async function buildOauthProvider() {
  const config = await getAppConfig();
  if (!config.oauthEnabled || !config.oauthIssuer || !config.oauthClientId || !config.oauthClientSecret) {
    return null;
  }

  const issuer = config.oauthIssuer.replace(/\/+$/, "");
  const clientSecret = decryptIfEncrypted(config.oauthClientSecret);
  const scopes = config.oauthScopes?.trim() || DEFAULT_OAUTH_SCOPES;

  const provider: OAuthConfig<OAuthProfile> = {
    id: OAUTH_PROVIDER_ID,
    name: config.oauthButtonText || "OAuth 登录",
    type: "oauth",
    wellKnown: `${issuer}/.well-known/openid-configuration`,
    authorization: { params: { scope: scopes } },
    checks: ["state"],
    clientId: config.oauthClientId,
    clientSecret,
    profile(profile) {
      const data = oauthProfile(profile);
      const email = oauthProfileEmail(data) ?? "";
      return {
        id: oauthProfileId(data, email),
        name: oauthProfileName(data, email),
        email,
        image: oauthProfileImage(data),
        role: "USER",
      };
    },
  };

  return provider;
}

function credentialsProvider() {
  return CredentialsProvider({
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
  });
}

function buildAuthOptions(providers: NextAuthOptions["providers"]): NextAuthOptions {
  return {
    providers,
    session: { strategy: "jwt" },
    pages: { signIn: "/login" },
    callbacks: {
      async signIn({ account, profile, user }) {
        if (account?.provider !== OAUTH_PROVIDER_ID) return true;
        return handleOauthSignIn(user as MutableAuthUser, profile);
      },
      async jwt({ token, user }) {
        if (user) {
          const authUser = user as MutableAuthUser;
          token.id = authUser.id;
          token.role = authUser.role ?? token.role;
        }

        const email = normalizeEmail(token.email ?? user?.email);
        if (email) {
          const dbUser = await prisma.user.findUnique({
            where: { email },
            select: { id: true, email: true, name: true, role: true, status: true },
          });
          if (dbUser?.status === "ACTIVE") {
            token.id = dbUser.id;
            token.email = dbUser.email;
            token.name = dbUser.name ?? token.name;
            token.role = dbUser.role;
          }
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
}

export async function getAuthOptions(): Promise<NextAuthOptions> {
  const oauthProvider = await buildOauthProvider();
  return buildAuthOptions([credentialsProvider(), ...(oauthProvider ? [oauthProvider] : [])]);
}

export const authOptions: NextAuthOptions = buildAuthOptions([credentialsProvider()]);
