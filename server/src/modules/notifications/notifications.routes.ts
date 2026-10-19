import { Router } from "express";
import { list, read, readAll } from "./notifications.controller";

const router = Router();

router.get("/", list);
router.post("/:id/read", read);
router.post("/read-all", readAll);

export default router;
