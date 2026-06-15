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
import usersRouter from "./app/modules/users/users.modules.ts";
import auctionsRouter from "./app/modules/auctions/auctions.routes.ts";
import biddingRouter from "./app/modules/bidding/bidding.routes.ts";
import blogRouter from "./app/modules/blog/blog.routes.ts";
import announcementsRouter from "./app/modules/announcements/announcements.routes.ts";

export const CreateApp = (): Application => {
    const app: Application = express();

    app.use(helmet());

    app.use(
        cors({
          origin: ENV.ALLOWED_ORIGINS,
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
          allowedHeaders: ['Content-Type'],
        })
    );

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

    // Passport initialize only — no sessions needed (JWT-based auth)
    app.use(passport.initialize());

    app.use(express.json({ limit: '10kb' }));
    app.use(express.urlencoded({ extended: true, limit: '10kb' }));
    app.use(cookieParser());

    app.use(hpp());

    app.use(
        "/api/docs",
        swaggerUi.serve,
        swaggerUi.setup(swaggerSpec, {
          customSiteTitle: "Rex Auction API Docs",
          swaggerOptions: {
            withCredentials: true,
            filter: true,
          },
        })
    );

    app.use('/api/v1/auth', authLimiter, authRouter);
    app.use('/api/v1/users', usersRouter);
    app.use('/api/v1/auctions', auctionsRouter);
    app.use('/api/v1/bidding', biddingRouter);
    app.use('/api/v1/blogs', blogRouter);
    app.use('/api/v1/announcements', announcementsRouter);

    app.get("/", (req: Request, res: Response) => {
      res.send("Welcome to Rex Auction Server");
    });

    app.use(errorHandler)

    return app;
}