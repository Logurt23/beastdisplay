import type { FunctionModule } from "../core/registry";
import { emmModule } from "./emm/meta";

/**
 * Function registry. v1 ships one pack. Later packs get a slot here and are
 * not built in v1.
 */
export const FUNCTIONS: readonly FunctionModule[] = [emmModule];
