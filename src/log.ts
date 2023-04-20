import { pino } from "pino";
import { logLevel } from "./env";

/** The global logger */
export const glog = pino();
glog.level = logLevel;
