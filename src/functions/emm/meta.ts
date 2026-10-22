import type { FunctionModule } from "../../core/registry";
import "./styles/brand.css";

export const EMM_LAYOUTS = ["warroom", "projects", "pulse", "goals"] as const;
export type EmmLayout = (typeof EMM_LAYOUTS)[number];

/** Registry entry for the EMM pack. The pack code itself loads lazily. */
export const emmModule: FunctionModule = {
  id: "emm",
  title: "EMM board",
  wordmark: "EMM Advertising",
  logo: "/brand/emm-logo-light.png",
  layouts: EMM_LAYOUTS,
  defaultLayout: "warroom",
  wantsClock: true,
  load: () => import("./index"),
};
