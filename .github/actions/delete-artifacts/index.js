const core = require('@actions/core');
const github = require('@actions/github');

try {
  const octokit = new github.GitHub(process.env.GITHUB_TOKEN);
  const [owner, repo] = github.context.payload.repository.full_name.split('/');
  octokit.actions.listArtifactsForRepo({ owner, repo })
    .then((data, error) => {
      if (err) throw new Error(error);
      console.log(data)
      // core.setOutput('modified', false);
  });
} catch (error) {
  core.setFailed(error.message);
}