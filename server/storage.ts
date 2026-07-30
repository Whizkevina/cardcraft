export { initDb, getPgPool, db, queryClient } from "./storage/db";
import { pingDatabase } from "./storage/db";
import * as users from "./storage/users";
import * as templates from "./storage/templates";
import * as projects from "./storage/projects";
import * as payments from "./storage/payments";
import * as auditLog from "./storage/auditLog";
import * as systemMeta from "./storage/systemMeta";
import * as analytics from "./storage/analytics";
import * as adminAggregates from "./storage/adminAggregates";

export const storage = {
  ...users,
  ...templates,
  ...projects,
  ...payments,
  ...auditLog,
  ...systemMeta,
  ...analytics,
  ...adminAggregates,
  pingDatabase,
};
