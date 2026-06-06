import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";

dotenv.config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL: process.env.GOOGLE_CALLBACK_URL as string,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // 👉 DB logic goes here (MVC model layer later)
        const user = {
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails?.[0]?.value || "",
          avatar: profile.photos?.[0]?.value || "",
        };

        return done(null, user);
      } catch (error) {
        return done(error as Error, undefined);
      }
    }
  )
);

// Serialize user into session
passport.serializeUser((user: any, done) => {
  done(null, user);
});

// Deserialize user
passport.deserializeUser((user: any, done) => {
  done(null, user);
});

export default passport;