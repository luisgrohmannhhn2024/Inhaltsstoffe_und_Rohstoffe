import { NextFunction, Request, Response, Router } from "express";
import { ProductService } from "../services/product.service";

const EAN_REGEX = /^\d{8,14}$/;

export function createProductRouter(service: ProductService): Router {
  const router = Router();

  /**
   * @swagger
   * components:
   *   schemas:
   *     RawMaterial:
   *       type: object
   *       required: [name, category]
   *       properties:
   *         name:
   *           type: string
   *           example: Zuckerrübe
   *         origin:
   *           type: string
   *           example: Europa
   *     Ingredient:
   *       type: object
   *       required: [name, raw_materials]
   *       properties:
   *         name:
   *           type: string
   *           example: Zucker
   *         raw_materials:
   *           type: array
   *           items:
   *             $ref: '#/components/schemas/RawMaterial'
   *         is_allergen:
   *           type: boolean
   *           example: false
   *     ProductMeta:
   *       type: object
   *       properties:
   *         brand:
   *           type: string
   *           example: Nutella
   *         quantity:
   *           type: string
   *           example: 400 g
   *         nutriscore_grade:
   *           type: string
   *           example: e
   *         nova_group:
   *           type: integer
   *           example: 4
   *         ecoscore_grade:
   *           type: string
   *           example: d
   *         nutriments:
   *          type: object
   *          properties:
   *            energy_kcal_100g:
   *              type: number
   *              example: 539
   *            fat_100g:
   *              type: number
   *              example: 30.9
   *            saturated_fat_100g:
   *              type: number
   *              example: 10.6
   *            carbohydrates_100g:
   *              type: number
   *              example: 57.5
   *            sugars_100g:
   *              type: number
   *              example: 57.5
   *            fiber_100g:
   *              type: number
   *              example: 0
   *            proteins_100g:
   *              type: number
   *              example: 6.3
   *            salt_100g:
   *              type: number
   *              example: 0.107
   *     ProductResponse:
   *       type: object
   *       required: [product]
   *       properties:
   *         product:
   *           type: object
   *           required: [ean, name, ingredients, meta]
   *           properties:
   *             ean:
   *               type: string
   *               example: "3017620422003"
   *             name:
   *               type: string
   *               example: Nutella
   *             ingredients:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Ingredient'
   *             meta:
   *               $ref: '#/components/schemas/ProductMeta'
   *     ErrorResponse:
   *       type: object
   *       required: [error]
   *       properties:
   *         error:
   *           type: string
   *           example: Product not found
   *
   * /api/products/{ean}:
   *   get:
   *     summary: Analysiert ein Produkt anhand seiner EAN und gibt Zutaten mit Rohstoffen zurück.
   *     parameters:
   *       - in: path
   *         name: ean
   *         required: true
   *         description: 8–14-stellige numerische EAN (Barcode)
   *         schema:
   *           type: string
   *           example: "3017620422003"
   *     responses:
   *       200:
   *         description: Produkt erfolgreich analysiert
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductResponse'
   *       400:
   *         description: Ungültiges EAN-Format
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Produkt nicht in Open Food Facts gefunden
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       422:
   *         description: Produkt gefunden, aber keine Zutatendaten vorhanden
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       503:
   *         description: Groq API nicht erreichbar oder GROQ_API_KEY nicht konfiguriert
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get("/:ean", async (req: Request, res: Response, next: NextFunction) => {
    const { ean } = req.params;

    if (!EAN_REGEX.test(ean)) {
      res.status(400).json({ error: "Invalid EAN format. Must be 8–14 digits." });
      return;
    }

    try {
      const result = await service.getEnrichedProduct(ean);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
