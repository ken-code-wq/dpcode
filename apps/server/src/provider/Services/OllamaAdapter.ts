import { ServiceMap } from "effect";

import type { ProviderAdapterError } from "../Errors.ts";
import type { ProviderAdapterShape } from "./ProviderAdapter.ts";

export interface OllamaAdapterShape extends ProviderAdapterShape<ProviderAdapterError> {
  readonly provider: "ollama";
}

export class OllamaAdapter extends ServiceMap.Service<OllamaAdapter, OllamaAdapterShape>()(
  "t3/provider/Services/OllamaAdapter",
) {}
