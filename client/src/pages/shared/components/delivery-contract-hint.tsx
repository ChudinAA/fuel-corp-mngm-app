import { ContractHint } from "./contract-hint";

type TariffContract = {
  contractId?: string | null;
  contractNumber?: string | null;
  contractName?: string | null;
  parentContractId?: string | null;
};

/** Uses the very tariff returned by the cost calculation, not a carrier-only guess. */
export function DeliveryContractHint({ tariff }: { tariff?: TariffContract | null }) {
  return (
    <ContractHint
      contractNumber={tariff?.contractNumber}
      contractName={tariff?.contractName}
    />
  );
}
