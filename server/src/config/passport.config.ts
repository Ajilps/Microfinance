import passport from "passport";
import {
  Strategy as GoogleStrategy,
  Profile,
  VerifyCallback,
} from "passport-google-oauth20";
import config from "./env.config";
import User from "../modules/auth/model";
import { UserRole } from "../types";

/**
 * Configure the Google OAuth 2.0 strategy.
 *
 * Flow:
 *  1. User visits  GET /api/v1/auth/google  → redirected to Google consent page
 *  2. Google redirects to GET /api/v1/auth/google/callback
 *  3. Passport exchanges the code for tokens, calls the verify callback below
 *  4. We upsert the user in MongoDB and return the user document
 *  5. The route handler converts the user into a signed JWT and sends it to the client
 *
 * NOTE: We use the stateless JWT approach (no session).
 *       Passport's serializeUser / deserializeUser are intentionally left as
 *       pass-through, since we never call req.session.
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: config.googleClientId,
      clientSecret: config.googleClientSecret,
      callbackURL: config.googleCallbackUrl,
      scope: ["profile", "email"],
    },
    async (
      _accessToken: string,
      _refreshToken: string,
      profile: Profile,
      done: VerifyCallback,
    ) => {
      try {
        const email =
          profile.emails && profile.emails[0] ? profile.emails[0].value : null;

        if (!email) {
          return done(
            new Error("Google account does not have an associated email."),
          );
        }

        // Try to find an existing user by Google profile ID OR email.
        // We use a "default" organization for OAuth users; in a real multi-tenant
        // setup you would resolve the organization from the request context.
        let user = await User.findOne({ "oauth.googleId": profile.id });

        if (!user) {
          // Fall back to email match (e.g. user registered normally first)
          user = await User.findOne({ email });
        }

        if (user) {
          // Update Google ID if not already stored
          if (!user.get("oauth.googleId")) {
            await User.updateOne(
              { _id: user._id },
              { $set: { "oauth.googleId": profile.id } },
            );
          }
          return done(null, user as any);
        }

        // Create a new user — requires an organizationId. For OAuth we allow
        // a "pending" organization that the user can complete via onboarding.
        // Here we create the user without an organizationId and let the
        // onboarding flow handle it.  The model's required validation is
        // bypassed by using { validateBeforeSave: false }.
        const newUser = new User({
          email,
          fullName: profile.displayName || email,
          role: UserRole.MEMBER,
          isActive: true,
          oauth: { googleId: profile.id },
        });

        await newUser.save({ validateBeforeSave: false });

        return done(null, newUser as any);
      } catch (err) {
        return done(err as Error);
      }
    },
  ),
);

// Minimal serialize/deserialize — we never actually use sessions, but Passport
// requires them to be defined when passport.initialize() is called.
passport.serializeUser((user: any, done) => done(null, user._id));
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user as any);
  } catch (err) {
    done(err);
  }
});

export default passport;
