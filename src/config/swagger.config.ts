import swaggerJsdoc from "swagger-jsdoc";
import { authpaths } from "../app/modules/auth/doc/auth.swagger.ts";
import { usersPaths } from "../app/modules/users/doc/users.swagger.ts";

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",

    info: {
      title: "MVC API Documentation",
      version: "1.0.0",
      description: "Production Ready Node.js MVC API Documentation featuring full Session Auth and User Profiles.",
    },

    servers: [
      {
        url: "http://localhost:5000/api/v1",
        description: "Development Server",
      },
    ],

    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },

    paths: {
      ...authpaths,
      ...usersPaths,
    },
  },

  apis: [],
});