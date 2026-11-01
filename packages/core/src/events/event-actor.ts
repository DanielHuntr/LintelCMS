import type { FastifyRequest } from "fastify";
import { getSignedIn } from "../auth/require-permission.js";
import type { EventActor } from "./event-catalogue.js";

/** The signed-in person, as events name them. For handlers behind a permission guard. */
export function actorOf(request: FastifyRequest): EventActor {
  const { user } = getSignedIn(request);
  return { id: user.id, name: user.name, email: user.email };
}
