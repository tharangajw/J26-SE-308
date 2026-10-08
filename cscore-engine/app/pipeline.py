"""Runs the full analysis for one Pull Request.
Phases 1, 2, 3 and the GitHub Check are plugged in here in later steps."""


def run_pipeline(repo: dict, pr_number: int, head_sha: str, base_branch: str):
    print(f"[pipeline] repo={repo['full_name']} PR=#{pr_number} sha={head_sha[:7]} base={base_branch}")
    # TODO Step 4: phase1 features
    # TODO Step 5: phase2 features
    # TODO Step 6: score + GitHub Check + PR comment
