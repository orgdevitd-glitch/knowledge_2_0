import { z } from "zod";

import { GoogleDriveBoundaryPolicy } from "@/server/google-workspace/drive/boundary-policy";
import { getIntegrationPorts } from "@/server/composition/integration-ports";
import { assertGoogleEnabled } from "@/server/http/admin-get";
import {
  googleSourceTestLimiter,
  okJson,
  runAdminMutation,
} from "@/server/http/admin-mutation";
import { createAuditEvent } from "@/domain/content/audit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ csrfToken: z.string().min(1) });

export async function POST(request: Request) {
  return runAdminMutation({
    request,
    limiter: googleSourceTestLimiter,
    schema: bodySchema,
    maxBodyBytes: 4_000,
    async handler({ principal, requestId }) {
      assertGoogleEnabled();
      const ports = await getIntegrationPorts();
      const policy = new GoogleDriveBoundaryPolicy(
        ports.google.drive,
        ports.config,
      );
      const root = await policy.verifyFolderForBrowse(ports.config.rootFolderId);
      await ports.content.audit.append(
        createAuditEvent({
          id: ports.content.ids.next("audit"),
          eventType: "integration.source.tested",
          entityType: "source-connection",
          entityId: "workspace",
          actorId: principal.uid,
          occurredAt: ports.content.clock.now(),
          metadata: { requestId, scope: "connection-test" },
        }),
      );
      return okJson({
        ok: true,
        rootFolderName: root.name,
        sharedDriveConfigured: true,
      });
    },
  });
}
