import {
  getDeploymentMetadata,
  DeploymentMetadata,
  DeploymentShaStatus,
} from './deployment-metadata';

export type { DeploymentMetadata, DeploymentShaStatus };

export interface CommitResolution {
  commit: string | null;
  commitSource: string | null;
  deploymentShaStatus: 'available' | 'missing' | 'invalid' | 'development';
  buildTime: string | null;
  isValid: boolean;
}

export function resolveCommitSha(
  env: NodeJS.ProcessEnv = process.env
): CommitResolution {
  const meta = getDeploymentMetadata(env);
  return {
    commit: meta.commit,
    commitSource: meta.commitSource,
    deploymentShaStatus:
      env.NODE_ENV !== 'production' &&
      !env.APP_COMMIT_SHA &&
      !env.VERCEL_GIT_COMMIT_SHA &&
      !env.GITHUB_SHA
        ? 'development'
        : meta.deploymentShaStatus,
    buildTime: meta.buildTime,
    isValid: meta.isValid,
  };
}
