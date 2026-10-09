import { useQueries } from "@tanstack/react-query";
import { getSubstate } from "./indexer";
import { calledComponents, claimsBurn, type TxBody } from "./txShape";
import { getKnownAddress } from "./knownAddresses";

/** A "burn transaction" either claims an L1 burn directly, or calls a component whose template is
 * flagged `burn` in the known-address list (e.g. CaravelBurnWallet deposits). The component lookup
 * shares the substate query cache with the rest of the app, so rows calling the same component
 * cost one request. */
export function useIsBurnTx(body: TxBody): boolean {
  const direct = claimsBurn(body);
  const components = direct ? [] : calledComponents(body);
  const results = useQueries({
    queries: components.map((id) => ({ queryKey: ["substate", id], queryFn: () => getSubstate(id), retry: false, staleTime: 60_000 })),
  });
  if (direct) return true;
  return results.some((r) => {
    const template = (r.data as { substate?: { Component?: { header?: { template_address?: string } } } } | undefined)?.substate?.Component
      ?.header?.template_address;
    return !!template && !!getKnownAddress(template)?.burn;
  });
}
