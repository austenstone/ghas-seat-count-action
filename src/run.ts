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

    let maxAdvancedSecurityCommitters;
    let purchasedAdvancedSecurityCommitters;
    let advancedSecurityCommitters;
    if (input.enterprise) {
      advancedSecurityCommitters = await octokit.request(`GET /enterprises/${input.enterprise}/settings/billing/advanced-security`);
      maxAdvancedSecurityCommitters = advancedSecurityCommitters.data.maximum_advanced_security_committers;
      purchasedAdvancedSecurityCommitters = advancedSecurityCommitters.data.purchased_advanced_security_committers;
    } else if (input.org) {
      advancedSecurityCommitters = await octokit.request(`GET /orgs/${input.org}/settings/billing/advanced-security`);
      // Purchased seats not available for orgs - Pull from input instead
      maxAdvancedSecurityCommitters = null;
      purchasedAdvancedSecurityCommitters = input.maxAdvancedSecurityCommitters;
    } else {
      throw new Error('Either org or enterprise must be specified');
    }

    const totalAdvancedSecurityCommitters = advancedSecurityCommitters.data.total_advanced_security_committers;
    
    core.debug(`Maximum advanced security committers: ${maxAdvancedSecurityCommitters}`);
    core.debug(`Purchased advanced security committers: ${purchasedAdvancedSecurityCommitters}`);
    core.debug(`Total advanced security committers: ${totalAdvancedSecurityCommitters}`);
    core.debug(JSON.stringify(advancedSecurityCommitters.data, null, 2));

    if (isNaN(totalAdvancedSecurityCommitters) || isNaN(purchasedAdvancedSecurityCommitters)) {
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