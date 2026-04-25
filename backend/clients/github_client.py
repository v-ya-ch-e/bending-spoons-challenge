import base64
import os
import httpx
from typing import Optional, Dict, Any


DOC_CONTEXT_MAX_TREE_PATHS = 200
DOC_CONTEXT_MAX_FILES = 12
DOC_CONTEXT_MAX_FILE_BYTES = 20_000
DOC_CONTEXT_MAX_TOTAL_CHARS = 60_000


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

    async def get_repository_documentation_context(self, owner: str, repo: str) -> Dict[str, Any]:
        """Fetch capped repository context useful for generated documentation."""
        async with httpx.AsyncClient(headers=self.headers) as client:
            repo_resp = await client.get(f"{self.base_url}/repos/{owner}/{repo}")
            repo_resp.raise_for_status()
            repo_data = repo_resp.json()
            default_branch = repo_data.get("default_branch") or "main"

            readme_content = ""
            readme_resp = await client.get(f"{self.base_url}/repos/{owner}/{repo}/readme")
            if readme_resp.status_code == 200:
                readme_content = self._decode_content_response(readme_resp.json())

            tree_resp = await client.get(
                f"{self.base_url}/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1"
            )
            branch = default_branch
            if tree_resp.status_code != 200 and default_branch != "master":
                tree_resp = await client.get(
                    f"{self.base_url}/repos/{owner}/{repo}/git/trees/master?recursive=1"
                )
                branch = "master"

            tree_items = tree_resp.json().get("tree", []) if tree_resp.status_code == 200 else []
            file_tree = [
                item["path"]
                for item in tree_items
                if item.get("type") in {"blob", "tree"} and item.get("path")
            ][:DOC_CONTEXT_MAX_TREE_PATHS]
            selected_paths = self._select_documentation_paths(tree_items)

            sampled_files: list[dict[str, Any]] = []
            total_chars = 0
            for path in selected_paths:
                if total_chars >= DOC_CONTEXT_MAX_TOTAL_CHARS:
                    break
                content = await self._fetch_file_content(client, owner, repo, path, branch)
                if not content:
                    continue
                remaining = DOC_CONTEXT_MAX_TOTAL_CHARS - total_chars
                content = content[:remaining]
                sampled_files.append({"path": path, "content": content})
                total_chars += len(content)

            return {
                "owner": owner,
                "name": repo_data["name"],
                "full_name": repo_data.get("full_name") or f"{owner}/{repo}",
                "html_url": repo_data.get("html_url"),
                "description": repo_data.get("description"),
                "language": repo_data.get("language"),
                "topics": repo_data.get("topics") or [],
                "default_branch": default_branch,
                "readme": readme_content[:20_000],
                "file_tree": file_tree,
                "sampled_files": sampled_files,
            }

    async def _fetch_file_content(
        self,
        client: httpx.AsyncClient,
        owner: str,
        repo: str,
        path: str,
        branch: str,
    ) -> str:
        response = await client.get(
            f"{self.base_url}/repos/{owner}/{repo}/contents/{path}",
            params={"ref": branch},
        )
        if response.status_code != 200:
            return ""
        payload = response.json()
        if payload.get("type") != "file" or payload.get("size", 0) > DOC_CONTEXT_MAX_FILE_BYTES:
            return ""
        return self._decode_content_response(payload)

    @staticmethod
    def _decode_content_response(payload: Dict[str, Any]) -> str:
        content = payload.get("content") or ""
        if payload.get("encoding") != "base64" or not content:
            return ""
        try:
            return base64.b64decode(content).decode("utf-8", errors="replace")
        except (ValueError, UnicodeDecodeError):
            return ""

    @staticmethod
    def _select_documentation_paths(tree_items: list[Dict[str, Any]]) -> list[str]:
        candidates: list[tuple[int, str]] = []
        for item in tree_items:
            path = item.get("path")
            if item.get("type") != "blob" or not path:
                continue
            lowered = path.lower()
            if item.get("size", 0) > DOC_CONTEXT_MAX_FILE_BYTES:
                continue
            score = GitHubClient._documentation_path_score(lowered)
            if score is not None:
                candidates.append((score, path))
        candidates.sort(key=lambda entry: (entry[0], entry[1]))
        return [path for _, path in candidates[:DOC_CONTEXT_MAX_FILES]]

    @staticmethod
    def _documentation_path_score(path: str) -> int | None:
        filename = path.rsplit("/", 1)[-1]
        if filename.startswith("readme"):
            return 0
        if path.startswith("docs/") or "/docs/" in path or filename.endswith(".md"):
            return 1
        if filename in {
            "package.json",
            "pyproject.toml",
            "requirements.txt",
            "dockerfile",
            "docker-compose.yml",
            "compose.yml",
            "next.config.ts",
            "next.config.js",
        }:
            return 2
        if filename in {"schema.sql", "main.py", "app.py", "server.py"}:
            return 3
        if path.startswith(("src/", "app/", "backend/", "frontend/")) and filename.endswith(
            (".py", ".ts", ".tsx", ".js")
        ):
            return 4
        return None

    @staticmethod
    def parse_github_url(url: str) -> tuple[str, str]:
        """Parse owner and repo from a GitHub URL."""
        parts = url.rstrip("/").removesuffix(".git").split("/")
        if len(parts) >= 2:
            return parts[-2], parts[-1]
        raise ValueError(f"Invalid GitHub URL: {url}")
