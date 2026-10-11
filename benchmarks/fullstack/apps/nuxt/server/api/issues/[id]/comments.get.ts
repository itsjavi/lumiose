import { listComments } from "@bench/data";

export default defineEventHandler((event) => listComments(idParam(event)));
