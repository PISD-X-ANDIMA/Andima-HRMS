import { handle, methodNotAllowed } from "@/modules/d4/server/_lib/http";
import { createPeriodReopening } from "@/modules/d4/server/period-reopenings";

export const POST = (request: Request) => handle(() => createPeriodReopening(request), 201);

const notAllowed = methodNotAllowed("POST");
export { notAllowed as GET, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
