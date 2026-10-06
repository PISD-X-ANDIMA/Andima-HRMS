import { handle, methodNotAllowed } from "@/modules/d4/server/_lib/http";
import { getCatalog } from "@/modules/d4/server/kpi-catalog";

export const GET = (request: Request) => handle(() => getCatalog(request));

const notAllowed = methodNotAllowed("GET");
export { notAllowed as POST, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
