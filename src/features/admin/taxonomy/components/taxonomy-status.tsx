import { Status } from "@/components/ui";
import type { AdminTaxonomyStatus } from "@/features/admin/taxonomy/types";

export function TaxonomyStatusBadge({ status }: { status: AdminTaxonomyStatus }) {
  if (status === "archived") {
    return <Status tone="warning" label="В архиве" />;
  }
  return <Status tone="success" label="Активна" />;
}
