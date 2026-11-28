import { handle, methodNotAllowed } from "@/modules/d4/server/_lib/http";
import { createDevelopment, listDevelopment } from "@/modules/d4/server/development-needs";

export const GET = (request: Request) => handle(() => listDevelopment(request));
export const POST = (request: Request) => handle(() => createDevelopment(request), 201);

const notAllowed = methodNotAllowed("GET, POST");
export { notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
