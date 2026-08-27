import { Router } from "express";

export const whoamiRouter = Router();

whoamiRouter.get("/whoami", (req, res) => res.json({ uid: req.uid }));
