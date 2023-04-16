import { pino } from "pino";
import { logLevel } from "./env";

export const glog = pino();
glog.level = logLevel;
