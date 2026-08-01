"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DirectionView } from "./DirectionView";
import { ProtoPicker } from "./ProtoPicker";
import type { DesignDirectionId } from "./types";
import { DESIGN_DIRECTIONS } from "./types";

function parseDirection(value: string | null): DesignDirectionId {
  if (value === "editorial" || value === "workspace" || value === "learning") {
    return value;
  }
  const asIndex = Number.parseInt(value ?? "", 10);
  if (asIndex >= 1 && asIndex <= DESIGN_DIRECTIONS.length) {
    const found = DESIGN_DIRECTIONS[asIndex - 1];
    if (found) return found.id;
  }
  return "editorial";
}

/** Fixed single-direction page (no URL picker sync). */
export function DesignDirectionPage({
  direction,
}: {
  direction: DesignDirectionId;
}) {
  return <DirectionView key={direction} direction={direction} remountKey={0} />;
}

function PickerHarnessInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const direction = parseDirection(searchParams.get("v"));
  const [remountKey, setRemountKey] = useState(0);

  const onChange = useCallback(
    (id: DesignDirectionId) => {
      setRemountKey((k) => k + 1);
      const index = DESIGN_DIRECTIONS.findIndex((d) => d.id === id) + 1;
      const params = new URLSearchParams(searchParams.toString());
      params.set("v", String(index));
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const onReplay = useCallback(() => {
    setRemountKey((k) => k + 1);
  }, []);

  return (
    <div style={{ paddingTop: "4.5rem" }}>
      <ProtoPicker
        activeId={direction}
        onChange={onChange}
        onReplay={onReplay}
      />
      <DirectionView
        key={`${direction}-${remountKey}`}
        direction={direction}
        remountKey={remountKey}
      />
    </div>
  );
}

export function DesignDirectionsHarness() {
  return <PickerHarnessInner />;
}
