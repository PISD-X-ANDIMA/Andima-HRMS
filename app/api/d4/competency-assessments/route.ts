import { handle, methodNotAllowed } from "@/modules/d4/server/_lib/http";
import { createCompetency, listCompetency } from "@/modules/d4/server/competency-assessments";

export const GET = (request: Request) => handle(() => listCompetency(request));
export const POST = (request: Request) => handle(() => createCompetency(request), 201);

const notAllowed = methodNotAllowed("GET, POST");
export { notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
