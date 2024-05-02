import * as core from '@actions/core';
import * as github from '@actions/github';

import { writeFileSync } from 'fs';

interface Input {
  token: string;
  org: string;
  enterprise: string;
  maxAdvancedSecurityCommitters: number;
}

interface CommitterInfo {
  user_login: string;
  last_pushed_date: string;
  last_pushed_email: string;
}

export function getInputs(): Input {
  const result = {} as Input;
  result.token = core.getInput('github-token');
  result.org = core.getInput('org');
  result.enterprise = core.getInput('enterprise');
  result.maxAdvancedSecurityCommitters = parseInt(core.getInput('max_advanced_security_committers'));
  return result;
}

// Paginate with Octokit
async function fetchAll(endpoint: string, octokit: any): Promise<any[]> {
  const options = octokit.request.endpoint.merge(endpoint, { per_page: 100 });
  const results = await octokit.paginate(options);
  return results;
}

const run = async (): Promise<void> => {
  try {
    const input = getInputs();
    const octokit: ReturnType<typeof github.getOctokit> = github.getOctokit(input.token);

    let maxAdvancedSecurityCommitters;
    let purchasedAdvancedSecurityCommitters;
    let advancedSecurityCommitters;
    let advancedSecurityCommittersSummary;
    if (input.enterprise) {
      advancedSecurityCommittersSummary = await octokit.request(`GET /enterprises/${input.enterprise}/settings/billing/advanced-security`);
      advancedSecurityCommitters = await fetchAll(`GET /enterprises/${input.enterprise}/settings/billing/advanced-security`, octokit);
      maxAdvancedSecurityCommitters = advancedSecurityCommittersSummary.data.maximum_advanced_security_committers;
      purchasedAdvancedSecurityCommitters = advancedSecurityCommittersSummary.data.purchased_advanced_security_committers;
    } else if (input.org) {
      //advancedSecurityCommitters = await octokit.request(`GET /orgs/${input.org}/settings/billing/advanced-security`);
      advancedSecurityCommittersSummary = await octokit.request(`GET /orgs/${input.org}/settings/billing/advanced-security`);
      advancedSecurityCommitters = await fetchAll(`GET /orgs/${input.org}/settings/billing/advanced-security`, octokit);
      // Purchased seats not available for orgs - Pull from input instead
      maxAdvancedSecurityCommitters = null;
      purchasedAdvancedSecurityCommitters = input.maxAdvancedSecurityCommitters;
      // throw error if purchased seats are not provided
      if (!purchasedAdvancedSecurityCommitters) {
        throw new Error('max_advanced_security_committers must be set in input if not specifying an enterprise');
      }
    } else {
      throw new Error('Either org or enterprise must be specified');
    }

    const totalAdvancedSecurityCommitters = advancedSecurityCommittersSummary.data.total_advanced_security_committers;
    
    core.debug(`Maximum advanced security committers: ${maxAdvancedSecurityCommitters}`);
    core.debug(`Purchased advanced security committers: ${purchasedAdvancedSecurityCommitters}`);
    core.debug(`Total advanced security committers: ${totalAdvancedSecurityCommitters}`);
    core.debug("\n\n\nCommitters Data:");
    core.debug(JSON.stringify(advancedSecurityCommitters, null, 2));
    core.debug("\n\n\nSummary Data:");
    core.debug(JSON.stringify(advancedSecurityCommittersSummary.data, null, 2));

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

    // Report last pushed date and email for each committer
    // Parse and Aggregate Data
    const userMap = new Map<string, CommitterInfo>();

    //advancedSecurityCommitters.data.repositories.forEach((repo) => {
    advancedSecurityCommitters.data.forEach((repo) => {  
      repo.advanced_security_committers_breakdown.forEach((committer) => {
        const existing = userMap.get(committer.user_login);
        if (!existing || existing.last_pushed_date < committer.last_pushed_date) {
          userMap.set(committer.user_login, committer);
        }
      });
    });

    // Sort and Prepare Data for Output
    const sortedUsers = Array.from(userMap.values()).sort((a, b) => a.user_login.localeCompare(b.user_login));
    const csvRows = sortedUsers.map(user => `${user.user_login},${user.last_pushed_date},${user.last_pushed_email}`);
    const csvContent = "user_login,last_pushed_date,last_pushed_email\n" + csvRows.join("\n");

    // Output the CSV file
    core.debug(`CSV Content:\n${csvContent}`)

    writeFileSync('committer-last-pushed.csv', csvContent);

    // TODO 
    // Summarize next 5 dates where users will return licenses... 

  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : JSON.stringify(error))
  }
};

export default run;