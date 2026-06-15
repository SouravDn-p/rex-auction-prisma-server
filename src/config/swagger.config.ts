import swaggerJsdoc from "swagger-jsdoc";
import { authpaths } from "../app/modules/auth/doc/auth.swagger.ts";
import { usersPaths } from "../app/modules/users/doc/users.swagger.ts";
import { auctionsPaths } from "../app/modules/auctions/doc/auctions.swagger.ts";
import { biddingPaths } from "../app/modules/bidding/doc/bidding.swagger.ts";
import { blogPaths } from "../app/modules/blog/doc/blog.swagger.ts";
import { announcementsPaths } from "../app/modules/announcements/doc/announcements.swagger.ts";
import { paymentsPaths } from "../app/modules/payments/doc/payments.swagger.ts";
import { chatPaths } from "../app/modules/chat/doc/chat.swagger.ts";

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",

    info: {
      title: "MVC API Documentation",
      version: "1.0.0",
      description:
        "Production Ready Node.js MVC API Documentation. Authentication uses HttpOnly cookies (accessToken, refreshToken) — tokens are never returned in JSON responses.",
    },

    servers: [
      {
        url: "http://localhost:5000/api/v1",
        description: "Development Server",
      },
    ],

    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "accessToken",
          description: "HttpOnly access token cookie set on login / verify-email / refresh",
        },
      },
    },

    paths: {
      ...authpaths,
      ...usersPaths,
      ...auctionsPaths,
      ...biddingPaths,
      ...blogPaths,
      ...announcementsPaths,
      ...paymentsPaths,
      ...chatPaths,
    },
  },

  apis: [],
});