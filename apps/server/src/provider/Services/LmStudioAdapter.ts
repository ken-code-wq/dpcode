import { ServiceMap } from "effect";

import type { ProviderAdapterError } from "../Errors.ts";
import type { ProviderAdapterShape } from "./ProviderAdapter.ts";

export interface LmStudioAdapterShape extends ProviderAdapterShape<ProviderAdapterError> {
  readonly provider: "lmstudio";
}

export class LmStudioAdapter extends ServiceMap.Service<LmStudioAdapter, LmStudioAdapterShape>()(
  "t3/provider/Services/LmStudioAdapter",
) {}
