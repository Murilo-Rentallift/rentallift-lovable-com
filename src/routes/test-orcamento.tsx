import { createFileRoute } from "@tanstack/react-router";
import { OrcamentoEmailTool } from "@/components/OrcamentoEmailTool";

export const Route = createFileRoute("/test-orcamento")({
  component: () => <OrcamentoEmailTool />,
});
