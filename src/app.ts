import express , { type Application , type Request , type Response } from "express";
import helmet from "helmet";
import { ENV } from "./config/env.config.ts";
import cors from "cors";
import cookieParser from 'cookie-parser';
import rateLimit from "express-rate-limit"
import hpp from 'hpp';
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger.config.ts";
import authRouter from "./app/modules/auth/auth.modules.ts"
import { errorHandler } from "./app/common/exceptions/error-handler.exeption.ts";
import passport from "./config/passport.config.ts";
import session from "express-session";
import usersRouter from "./app/modules/users/users.modules.ts";

export const CreateApp  = () : Application =>{
    const app : Application = express();

    // ─── Security Headers ───────────────────────────────────────────────────────
    app.use(helmet());

    app.use(
        cors({
          origin: ENV.ALLOWED_ORIGINS,
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization'],
        })
    );

    app.use(
    session({
    secret: process.env.SESSION_SECRET as string,
    resave: false,
    saveUninitialized: false,
    })
  );

      // ─── Rate Limiting ───────────────────────────────────────────────────────────
    app.use(rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, message: 'Too many requests, please try again later' },
    }));

    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 10,
        message: { success: false, message: 'Too many auth attempts, please try again later' },
    });

    app.use(passport.initialize());
    app.use(passport.session());

    // ─── Body Parsers ────────────────────────────────────────────────────────────
    app.use(express.json({ limit: '10kb' }));      
    app.use(express.urlencoded({ extended: true, limit: '10kb' }));
    app.use(cookieParser());

    app.use(hpp());

    app.use(
        "/api/docs",
        swaggerUi.serve,
        swaggerUi.setup(swaggerSpec, {
          // explorer: true,
          customSiteTitle: "MVC API Docs",
          swaggerOptions: {
            persistAuthorization: true,
            filter: true,
          },
        })
    );

    // ─── Routes ──────────────────────────────────────────────────────────────────
  app.use('/auth', authLimiter, authRouter);
  app.use('/users', usersRouter);

  app.get("/", (req: Request, res: Response) => {
    res.send("WellCome to Rex Auction Server ");
  });

  app.use(errorHandler)

  return app;
}