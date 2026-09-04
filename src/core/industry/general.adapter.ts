import type { IndustryAdapter } from './industry-adapter.interface';

const GENERAL_ACTION_POLICY = `[WORKSPACE-SPECIFIC CLIENT BEHAVIOR]
- Adapt to the selected workspace and the client's exact request. Answer using trusted workspace facts and complete any supported action through the available workflow.
- If details are missing, ask one focused follow-up question. If the request needs a capability this workspace does not support, offer a practical alternative or human handoff.`;

export class GeneralAdapter implements IndustryAdapter {
  readonly id = 'general';
  readonly industryIds = ['general'] as const;

  getPromptRules(): string {
    return '';
  }

  getOverrideRules(): string {
    return '';
  }

  getJsonSchemaFields(): string[] {
    return [];
  }

  getIntentPolicy(): string {
    return GENERAL_ACTION_POLICY;
  }

  getContextSectionHeader(): string {
    return '';
  }
}

export const generalAdapter = new GeneralAdapter();
