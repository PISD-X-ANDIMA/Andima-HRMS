import { handle, methodNotAllowed } from "@/modules/d4/server/_lib/http";
import { createTraining, listTraining } from "@/modules/d4/server/training-records";

export const GET = (request: Request) => handle(() => listTraining(request));
export const POST = (request: Request) => handle(() => createTraining(request), 201);

const notAllowed = methodNotAllowed("GET, POST");
export { notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
