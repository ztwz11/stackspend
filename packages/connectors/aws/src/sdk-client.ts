import { CostExplorerClient, GetCostAndUsageCommand, type GetCostAndUsageCommandInput } from "@aws-sdk/client-cost-explorer";
import type { AwsCostExplorerClientAdapter, AwsCostExplorerCommand } from "./cost-explorer.js";
import type { AwsCostExplorerGetCostAndUsageOutput } from "./normalize.js";

const DEFAULT_COST_EXPLORER_REGION = "us-east-1";

export interface CreateAwsSdkCostExplorerClientOptions {
  region?: string;
}

export function createAwsSdkCostExplorerClient(
  options: CreateAwsSdkCostExplorerClientOptions = {},
): AwsCostExplorerClientAdapter {
  const region = options.region?.trim() || DEFAULT_COST_EXPLORER_REGION;
  const client = new CostExplorerClient({ region });

  return {
    async send(command: AwsCostExplorerCommand) {
      if (command.name !== "GetCostAndUsage") {
        throw new Error(`Unsupported AWS Cost Explorer command: ${command.name}`);
      }

      const input: GetCostAndUsageCommandInput = {
        ...command.input,
        Metrics: [...command.input.Metrics],
        GroupBy: command.input.GroupBy.map((group) => ({ ...group })),
      };
      const output = await client.send(new GetCostAndUsageCommand(input));

      return output as AwsCostExplorerGetCostAndUsageOutput;
    },
  };
}
