import os
import httpx
from typing import Optional, Dict, Any


class GitHubClient:
    def __init__(self, token: Optional[str] = None):
        self.token = token or os.getenv("GITHUB_TOKEN")
        self.base_url = "https://api.github.com"
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "Bending-Spoons-Challenge-Backend",
        }
        if self.token:
            self.headers["Authorization"] = f"token {self.token}"

    async def get_repository_info(self, owner: str, repo: str) -> Dict[str, Any]:
        """Fetch basic repository information including the README."""
        async with httpx.AsyncClient(headers=self.headers) as client:
            # Fetch repo metadata
            repo_resp = await client.get(f"{self.base_url}/repos/{owner}/{repo}")
            repo_resp.raise_for_status()
            repo_data = repo_resp.json()

            # Fetch README content
            readme_resp = await client.get(f"{self.base_url}/repos/{owner}/{repo}/readme")
            readme_content = ""
            if readme_resp.status_code == 200:
                # README is base64 encoded by default in GitHub API
                import base64
                readme_data = readme_resp.json()
                readme_content = base64.b64decode(readme_data["content"]).decode("utf-8")

            # Fetch file tree (top-level and one level down)
            tree_resp = await client.get(f"{self.base_url}/repos/{owner}/{repo}/git/trees/main?recursive=1")
            if tree_resp.status_code != 200:
                # Try 'master' if 'main' fails
                tree_resp = await client.get(f"{self.base_url}/repos/{owner}/{repo}/git/trees/master?recursive=1")
            
            tree_data = []
            if tree_resp.status_code == 200:
                tree_data = [
                    item["path"] for item in tree_resp.json().get("tree", [])
                    if item["type"] == "blob" or item["type"] == "tree"
                ]
                # Limit to first 100 files to avoid huge prompts
                tree_data = tree_data[:100]

            return {
                "name": repo_data["name"],
                "description": repo_data["description"],
                "language": repo_data["language"],
                "topics": repo_data["topics"],
                "readme": readme_content,
                "file_tree": tree_data,
            }

    @staticmethod
    def parse_github_url(url: str) -> tuple[str, str]:
        """Parse owner and repo from a GitHub URL."""
        parts = url.rstrip("/").split("/")
        if len(parts) >= 2:
            return parts[-2], parts[-1]
        raise ValueError(f"Invalid GitHub URL: {url}")
