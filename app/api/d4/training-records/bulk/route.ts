import { handle, methodNotAllowed } from "@/modules/d4/server/_lib/http";
import { bulkTraining } from "@/modules/d4/server/training-records";

export const POST = (request: Request) => handle(() => bulkTraining(request));

const notAllowed = methodNotAllowed("POST");
export { notAllowed as GET, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
