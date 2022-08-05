import * as core from '@actions/core';
import * as github from '@actions/github';

interface Input {
  token: string;
  org: string;
  enterprise: string;
  maxAdvancedSecurityCommitters: number;
}

export function getInputs(): Input {
  const result = {} as Input;
  result.token = core.getInput('github-token');
  result.org = core.getInput('org');
  result.enterprise = core.getInput('enterprise');
  result.maxAdvancedSecurityCommitters = parseInt(core.getInput('max_advanced_security_committers'));
  return result;
}

const run = async (): Promise<void> => {
  try {
    const input = getInputs();
    const octokit: ReturnType<typeof github.getOctokit> = github.getOctokit(input.token);

    let totalAdvancedSecurityCommitters;
    if (input.org) {
      const response = await octokit.request(`GET /orgs/${input.org}/settings/billing/advanced-security`);
      totalAdvancedSecurityCommitters = response.data.total_advanced_security_committers;
    } else if (input.enterprise) {
      const response = await octokit.request(`GET /enterprises/${input.enterprise}/settings/billing/advanced-security`);
      totalAdvancedSecurityCommitters = response.data.total_advanced_security_committers;
    } else {
      throw new Error('Either org or enterprise must be specified');
    }
    
    if (isNaN(totalAdvancedSecurityCommitters)) {
      throw new Error('Invalid number of advanced security committers');
    }
    core.setOutput('total_advanced_security_committers', totalAdvancedSecurityCommitters);

    if (totalAdvancedSecurityCommitters && input.maxAdvancedSecurityCommitters) {
      const percentage = Math.round(((totalAdvancedSecurityCommitters / input.maxAdvancedSecurityCommitters) * 100));
      core.setOutput('percentage', percentage);
      const remaining = input.maxAdvancedSecurityCommitters - totalAdvancedSecurityCommitters;
      core.setOutput('remaining', remaining);
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : JSON.stringify(error))
  }
};

export default run;