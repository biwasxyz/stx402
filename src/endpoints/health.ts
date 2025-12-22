import { OpenAPIRoute } from "chanfana";
import { handle } from "hono/cloudflare-pages";
import z from "zod";
import { type AppContext } from "../types";

export class Health extends OpenAPIRoute {
  schema = {
    tags: ["Health"],
    summary: "Check the stx402 service health",
    request: {},
    responses: {
      "200": {
        "application/json": {
          schema: z.object({}),
        },
      },
    },
  };
}

async handle(c: AppContext) {

}
