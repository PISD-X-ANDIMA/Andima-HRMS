import { handle, methodNotAllowed } from "@/modules/d4/server/_lib/http";
import { getMe } from "@/modules/d4/server/snapshot";

export const GET = () => handle(getMe);

const notAllowed = methodNotAllowed("GET");
export { notAllowed as POST, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
