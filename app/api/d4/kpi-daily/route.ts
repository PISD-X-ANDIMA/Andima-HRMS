import { handle, methodNotAllowed } from "@/modules/d4/server/_lib/http";
import { createDailyEntry, listDailyEntries } from "@/modules/d4/server/kpi-daily";

export const GET = (request: Request) => handle(() => listDailyEntries(request));
export const POST = (request: Request) => handle(() => createDailyEntry(request), 201);

const notAllowed = methodNotAllowed("GET, POST");
export { notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
