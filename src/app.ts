import express from "express";
import path from "path";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { createProductRouter } from "./controllers/product.controller";
import { GroqAnalyzer } from "./integrations/groqAnalyzer";
import { errorHandler } from "./middleware/errorHandler";
import { ProductService } from "./services/product.service";

export function createApp(): express.Application {
  const app = express();

  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Ingredient Analyzer API",
        version: "1.0.0",
        description: "Analysiert Lebensmittelzutaten und identifiziert Rohstoffe per KI.",
      },
      servers: [{ url: "http://localhost:3000" }],
    },
    apis: [path.join(__dirname, "controllers/*.ts"), path.join(__dirname, "controllers/*.js")],
  });

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get("/api-docs.json", (_req, res) => res.json(swaggerSpec));
  app.use(express.json());

  const productService = new ProductService(new GroqAnalyzer());
  app.use("/api/products", createProductRouter(productService));

  app.use((_req, res) => res.status(404).json({ error: "Route not found" }));
  app.use(errorHandler);

  return app;
}
