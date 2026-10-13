import { installOpeningReferences } from "./seed";
import { database } from "./runtime";

installOpeningReferences()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => database.client.end());
