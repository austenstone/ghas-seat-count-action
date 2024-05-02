import * as core from '@actions/core';
import * as github from '@actions/github';

interface Input {
  token: string;
  org: string;
  enterprise: string;
}

export function getInputs(): Input {
  const result = {} as Input;
  result.token = core.getInput('github-token');
  result.org = core.getInput('org');
  result.enterprise = core.getInput('enterprise');
  return result;
}

const run = async (): Promise<void> => {
  try {
    const input = getInputs();
    const octokit: ReturnType<typeof github.getOctokit> = github.getOctokit(input.token);

    let advancedSecurityCommitters;
    if (input.org) {
      advancedSecurityCommitters = await octokit.request(`GET /orgs/${input.org}/settings/billing/advanced-security`);
    } else if (input.enterprise) {
      advancedSecurityCommitters = await octokit.request(`GET /enterprises/${input.enterprise}/settings/billing/advanced-security`);
    } else {
      throw new Error('Either org or enterprise must be specified');
    }

    const maxAdvancedSecurityCommitters = advancedSecurityCommitters.data.maximum_advanced_security_committers
    const purchasedAdvancedSecurityCommitters = advancedSecurityCommitters.data.purchased_advanced_security_committers
    const totalAdvancedSecurityCommitters = advancedSecurityCommitters.data.total_advanced_security_committers;
    
    if (isNaN(totalAdvancedSecurityCommitters) || isNaN(maxAdvancedSecurityCommitters) || isNaN(purchasedAdvancedSecurityCommitters)) {
      throw new Error('Invalid number of advanced security committers');
    }
    core.setOutput('maximum_advanced_security_committers', maxAdvancedSecurityCommitters);
    core.setOutput('purchased_advanced_security_committers', purchasedAdvancedSecurityCommitters);
    core.setOutput('total_advanced_security_committers', totalAdvancedSecurityCommitters);

    if (totalAdvancedSecurityCommitters && purchasedAdvancedSecurityCommitters) {
      const percentage = Math.round(((totalAdvancedSecurityCommitters / purchasedAdvancedSecurityCommitters) * 100));
      core.setOutput('percentage', percentage);
      const remaining = purchasedAdvancedSecurityCommitters - totalAdvancedSecurityCommitters;
      core.setOutput('remaining', remaining);
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : JSON.stringify(error))
  }
};

export default run;