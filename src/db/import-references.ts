import { installOpeningReferences } from "./seed";

installOpeningReferences().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
