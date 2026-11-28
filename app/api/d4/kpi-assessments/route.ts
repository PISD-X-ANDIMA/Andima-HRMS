import { handle, methodNotAllowed } from "@/modules/d4/server/_lib/http";
import { createAssessment, listAssessments } from "@/modules/d4/server/kpi-assessments";

export const GET = (request: Request) => handle(() => listAssessments(request));
export const POST = (request: Request) => handle(() => createAssessment(request), 201);

const notAllowed = methodNotAllowed("GET, POST");
export { notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
