import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";
import { prisma } from "@modulus/database";
import {
	sendVerificationEmail,
	sendPasswordResetEmail,
	sendTwoFactorOtp,
} from "@modulus/email";
import { audit } from "../audit";
// create connection (with Organization and Membership models maintain flow)
import { personalOrg } from "./bootstrap.js";

export const auth = betterAuth({
	database: prismaAdapter(prisma, { provider: "postgresql" }),
	appName: "Modulus",
	secret: process.env.BETTER_AUTH_SECRET!,
	baseURL: "https://modulus-api-qr74.onrender.com",
	trustedOrigins: ["*"],
	// baseURL: process.env.API_BASE_URL,
	// trustedOrigins: [process.env.WEB_APP_URL!],

	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		sendResetPassword: async ({ user, url }) =>
			sendPasswordResetEmail(user.email, url),
	},

	emailVerification: {
		sendOnSignUp: true,
		autoSignInAfterVerification: true,
		sendVerificationEmail: async ({ user, url }) =>
			sendVerificationEmail(user.email, url),
	},

	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		},
		// Reuses the same GitHub App client credentials
		github: {
			clientId: process.env.GITHUB_APP_CLIENT_ID!,
			clientSecret: process.env.GITHUB_APP_CLIENT_SECRET!,
		},
	},

	plugins: [
		twoFactor({
			issuer: "Modulus",
			totpOptions: { digits: 6, period: 30 }, // authenticator app
			otpOptions: {
				sendOTP: async ({ user, otp }) => sendTwoFactorOtp(user.email, otp),
				period: 5,
				allowedAttempts: 5,
				storeOTP: "encrypted",
			},
			backupCodeOptions: {
				amount: 10,
				length: 10,
				storeBackupCodes: "encrypted",
			},
		}),
	],

	//   7-day expiry
	session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
	rateLimit: { window: 15 * 60, max: 10 },

	databaseHooks: {
		user: {
			create: {
				// Better Auth never needs to know that model exists (Organization and Membership models)
				after: async (user) => personalOrg(user.id, user.email),
			},
		},
		session: {
			create: {
				after: async (session) =>
					audit({
						userId: session.userId,
						action: "login",
						resourceType: "user",
						resourceId: session.userId,
						...(typeof session.ipAddress === "string"
							? { ipAddress: session.ipAddress }
							: {}),
					}),
			},
		},
	},
});
